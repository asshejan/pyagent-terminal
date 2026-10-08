# ---- prelude: mini_graph ------------------------------------------------
# A tiny re-implementation of LangGraph's StateGraph. Same names, same ideas:
#   START / END, add_node, add_edge, add_conditional_edges, compile, invoke,
#   stream, reducers via Annotated[list, operator.add], Command, Send,
#   MemorySaver checkpointer and interrupt_before.
from typing import Annotated, get_origin, get_type_hints

START = "__start__"
END = "__end__"


class Command:
    """Return from a node to update state AND choose the next node."""

    def __init__(self, update=None, goto=None):
        self.update = update or {}
        self.goto = goto

    def __repr__(self):
        return f"Command(goto={self.goto!r}, update={self.update!r})"


class Send:
    """Return a list of these from a router to fan out: run `node` with `arg`."""

    def __init__(self, node, arg):
        self.node = node
        self.arg = arg

    def __repr__(self):
        return f"Send({self.node!r}, {self.arg!r})"


class MemorySaver:
    """Checkpointer: remembers state per thread_id between invoke() calls."""

    def __init__(self):
        self.store = {}


class StateSnapshot:
    def __init__(self, values, next):
        self.values = values
        self.next = tuple(next)

    def __repr__(self):
        return f"StateSnapshot(values={self.values!r}, next={self.next!r})"


def _reducers(schema):
    if schema is dict or schema is None:
        return {}
    try:
        hints = get_type_hints(schema, include_extras=True)
    except Exception:
        return {}
    out = {}
    for key, hint in hints.items():
        if get_origin(hint) is Annotated:
            meta = [m for m in hint.__metadata__ if callable(m)]
            if meta:
                out[key] = meta[-1]
    return out


class StateGraph:
    def __init__(self, state_schema=dict):
        self.schema = state_schema
        self.nodes = {}
        self.edges = {}
        self.branches = {}
        self.reducers = _reducers(state_schema)

    def add_node(self, name, fn=None):
        if fn is None:
            name, fn = name.__name__, name
        if name in (START, END):
            raise ValueError(f"{name!r} is reserved")
        if name in self.nodes:
            raise ValueError(f"node {name!r} already exists")
        self.nodes[name] = fn
        return self

    def add_edge(self, src, dst):
        for s in src if isinstance(src, (list, tuple)) else [src]:
            self.edges.setdefault(s, []).append(dst)
        return self

    def add_conditional_edges(self, src, router, path_map=None):
        if isinstance(path_map, (list, tuple)):
            path_map = {p: p for p in path_map}
        self.branches[src] = (router, path_map)
        return self

    def set_entry_point(self, name):
        return self.add_edge(START, name)

    def set_finish_point(self, name):
        return self.add_edge(name, END)

    def compile(self, checkpointer=None, interrupt_before=()):
        if START not in self.edges and START not in self.branches:
            raise ValueError("graph has no entry point: add_edge(START, ...)")
        for src, dsts in self.edges.items():
            for d in [src, *dsts]:
                if d not in (START, END) and d not in self.nodes:
                    raise ValueError(f"edge refers to unknown node {d!r}")
        return CompiledGraph(self, checkpointer, tuple(interrupt_before))


class CompiledGraph:
    def __init__(self, graph, checkpointer, interrupt_before):
        self.g = graph
        self.checkpointer = checkpointer
        self.interrupt_before = interrupt_before
        self._final = {}

    def _apply(self, state, update, source):
        if update is None:
            return
        if not isinstance(update, dict):
            raise TypeError(f"node {source!r} must return a dict (or Command), got {type(update).__name__}")
        for key, value in update.items():
            reducer = self.g.reducers.get(key)
            state[key] = reducer(state[key], value) if reducer and key in state else value

    def _targets(self, node, state, goto=None):
        out = []
        if goto is not None:
            out += list(goto) if isinstance(goto, (list, tuple)) else [goto]
        out += self.g.edges.get(node, [])
        if node in self.g.branches:
            router, path_map = self.g.branches[node]
            picked = router(state)
            for p in picked if isinstance(picked, (list, tuple)) else [picked]:
                if isinstance(p, Send):
                    out.append(p)
                elif path_map is not None:
                    if p not in path_map:
                        raise KeyError(f"router returned {p!r}, not in path_map {list(path_map)}")
                    out.append(path_map[p])
                else:
                    out.append(p)
        return out

    def _thread(self, config):
        if not config:
            return None
        return config.get("configurable", {}).get("thread_id")

    def _save(self, thread, state, tasks):
        self._final = state
        if self.checkpointer and thread is not None:
            self.checkpointer.store[thread] = {"values": dict(state), "next": list(tasks)}

    def _run(self, input, config, max_steps):
        thread = self._thread(config)
        saved = self.checkpointer.store.get(thread) if self.checkpointer and thread is not None else None
        resuming = input is None and saved is not None and bool(saved["next"])
        if resuming:
            state, frontier = dict(saved["values"]), list(saved["next"])
        else:
            state = dict(saved["values"]) if saved else {}
            self._apply(state, input or {}, "input")
            frontier = self._targets(START, state)

        steps, first = 0, True
        while True:
            seen, tasks = set(), []
            for t in frontier:
                if isinstance(t, Send):
                    tasks.append(t)
                elif t != END and t not in seen:
                    seen.add(t)
                    tasks.append(t)
            if not tasks:
                break
            names = [t.node if isinstance(t, Send) else t for t in tasks]
            if not (first and resuming) and any(n in self.interrupt_before for n in names):
                self._save(thread, state, tasks)
                yield "__interrupt__", {"next": names}
                return
            first = False
            steps += 1
            if steps > max_steps:
                raise RecursionError(f"graph ran {max_steps} steps without reaching END (infinite loop?)")
            snapshot = dict(state)
            results = []
            for t, name in zip(tasks, names):
                if name not in self.g.nodes:
                    raise KeyError(f"unknown node {name!r}")
                out = self.g.nodes[name](t.arg if isinstance(t, Send) else snapshot)
                goto = None
                if isinstance(out, Command):
                    goto, out = out.goto, out.update
                results.append((name, out, goto))
                yield name, out
            for name, out, _ in results:
                self._apply(state, out, name)
            frontier = []
            for name, _, goto in results:
                frontier += self._targets(name, state, goto)
        self._save(thread, state, [])

    def invoke(self, input, config=None, max_steps=25):
        for _ in self._run(input, config, max_steps):
            pass
        return dict(self._final)

    def stream(self, input, config=None, max_steps=25):
        for name, update in self._run(input, config, max_steps):
            yield {name: update}

    def update_state(self, config, values):
        """Edit a paused thread's saved state (e.g. a human approves a step)."""
        saved = self.checkpointer.store.get(self._thread(config)) if self.checkpointer else None
        if saved is None:
            raise ValueError("no saved state for this thread")
        state = dict(saved["values"])
        self._apply(state, values, "update_state")
        saved["values"] = state

    def get_state(self, config):
        saved = self.checkpointer.store.get(self._thread(config)) if self.checkpointer else None
        if not saved:
            return StateSnapshot({}, [])
        nxt = [t.node if isinstance(t, Send) else t for t in saved["next"]]
        return StateSnapshot(dict(saved["values"]), nxt)
