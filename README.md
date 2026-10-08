# PyAgent Terminal

A terminal-style website for learning Python for AI engineering through problem solving:
**Python → Pythonic idioms → OOP → AI basics → LangChain → LangGraph → multi-agent systems**
(71 problems in 7 tracks, ordered from basic to hard).

Your code is real Python running in the browser through [Pyodide](https://pyodide.org). Hidden tests grade every
submission. The LangChain and LangGraph tracks use a deterministic `FakeLLM` and small re-implementations of
`Runnable` and `StateGraph`, so you don't need an API key and the tests give the same result every time.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/ (host anywhere)
npm run check      # verify every problem: solution passes, starter fails
npm run check lc   # only problems whose id starts with "lc"
```

You need an internet connection the first time: Pyodide and the Monaco editor load from the jsDelivr CDN.

## Using it

Type commands in the terminal (left) and write code in the editor (right).

| command | does |
|---|---|
| `ls`, `ls <track>` | curriculum and progress |
| `open <id or #>`, `next`, `prev` | navigate |
| `run` (Ctrl+Enter) | run your code, show `print` output |
| `submit` (Ctrl+S) | run hidden tests |
| `hint` | progressive hints |
| `setup` | show provided code (FakeLLM, mini LangChain, mini LangGraph) |
| `solution` | unlocked after 3 failed submits (`--force` to override, `--load` into editor) |
| `realworld` | the equivalent real LangChain / LangGraph code |
| `theme green\|amber\|cyan`, `clear`, `wipe --yes` | misc |

Your progress and drafts are saved in your browser's localStorage.

## Adding a problem

Problems are plain text in `src/curriculum/tracks/*.txt`:

```
=== py-13 | Title shown in terminal | 2
::: story
Concept explanation. `inline code` and ``` fenced blocks render nicely.
::: task
What to build.
::: setup fake_llm mini_graph      (optional preludes + extra python)
::: starter
def f(): pass
::: solution
def f(): return 1
::: hint
First nudge.
::: test returns one
assert f() == 1
::: realworld
How it looks in the real library.
```

Each `::: test` block runs in its own copy of the namespace after your code, and top-level `await` is allowed.
Run `npm run check` after editing.

## Layout

- `src/runner/` — Pyodide web worker, test harness (`harness.py`), and a client with a 6s timeout that restarts Python after infinite loops
- `src/curriculum/` — track files, parser, preludes (`fake_llm.py`, `mini_lc.py`, `mini_graph.py`)
- `src/terminal/commands.js` — terminal commands
- `src/components/` — Terminal, Editor (Monaco), StatusBar
- `scripts/check-solutions.mjs` — validates the whole curriculum in Node
