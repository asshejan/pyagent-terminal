# ---- prelude: mini_lc ---------------------------------------------------
# A tiny re-implementation of LangChain's core (LCEL). You built most of this
# yourself in earlier problems; here it is provided so you can focus on usage.
import inspect
import json
import re


class Runnable:
    def invoke(self, input):
        raise NotImplementedError

    def batch(self, inputs):
        return [self.invoke(x) for x in inputs]

    def __or__(self, other):
        return RunnableSequence(self, coerce(other))

    def __ror__(self, other):
        return RunnableSequence(coerce(other), self)


class RunnableLambda(Runnable):
    def __init__(self, fn):
        self.fn = fn

    def invoke(self, input):
        return self.fn(input)


class RunnableSequence(Runnable):
    def __init__(self, *steps):
        self.steps = list(steps)

    def invoke(self, input):
        for step in self.steps:
            input = step.invoke(input)
        return input


class RunnableParallel(Runnable):
    def __init__(self, steps):
        self.steps = {k: coerce(v) for k, v in steps.items()}

    def invoke(self, input):
        return {k: step.invoke(input) for k, step in self.steps.items()}


class RunnablePassthrough(Runnable):
    def invoke(self, input):
        return input


def coerce(obj):
    """Turn functions, dicts and objects with .invoke into Runnables."""
    if isinstance(obj, Runnable):
        return obj
    if isinstance(obj, dict):
        return RunnableParallel(obj)
    if hasattr(obj, "invoke"):
        return RunnableLambda(obj.invoke)
    if callable(obj):
        return RunnableLambda(obj)
    raise TypeError(f"cannot turn {type(obj).__name__} into a Runnable")


class PromptTemplate(Runnable):
    def __init__(self, template):
        self.template = template
        self.input_variables = sorted(set(re.findall(r"{(\w+)}", template)))

    @classmethod
    def from_template(cls, template):
        return cls(template)

    def format(self, **kwargs):
        missing = [v for v in self.input_variables if v not in kwargs]
        if missing:
            raise KeyError(f"missing variables: {missing}")
        return self.template.format(**kwargs)

    def invoke(self, input):
        return self.format(**input)


class StrOutputParser(Runnable):
    def invoke(self, input):
        if isinstance(input, dict):
            return str(input.get("content", "")).strip()
        return str(input).strip()


class JsonOutputParser(Runnable):
    def invoke(self, input):
        text = StrOutputParser().invoke(input)
        fenced = re.search(r"`{3}(?:json)?\s*(.*?)`{3}", text, re.S)
        if fenced:
            text = fenced.group(1)
        return json.loads(text)


class Tool:
    def __init__(self, fn):
        self.fn = fn
        self.name = fn.__name__
        self.description = (inspect.getdoc(fn) or "").strip()
        self.args = {
            p.name: getattr(p.annotation, "__name__", str(p.annotation))
            for p in inspect.signature(fn).parameters.values()
        }

    def invoke(self, args):
        return self.fn(**args)

    def __call__(self, *a, **kw):
        return self.fn(*a, **kw)

    def __repr__(self):
        return f"Tool({self.name!r}, args={self.args})"


def tool(fn):
    """Decorator: turn a typed, documented function into a Tool."""
    return Tool(fn)
