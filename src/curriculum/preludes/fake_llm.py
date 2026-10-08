# ---- prelude: fake_llm --------------------------------------------------
# A deterministic stand-in for a chat model, so every exercise is testable
# without an API key. Real equivalent: ChatOpenAI / ChatAnthropic .invoke().


def _last_text(prompt):
    """Text used for rule matching: the last message's content, or str(prompt)."""
    if isinstance(prompt, list) and prompt:
        last = prompt[-1]
        if isinstance(last, dict):
            return str(last.get("content", ""))
    return str(prompt)


class FakeLLM:
    """FakeLLM(responses=[...]) replies from a queue, in order.
    FakeLLM(rules={"keyword": "reply"}) replies by keyword found in the prompt
    (for a list of messages, only the LAST message is searched).
    A response may be a str, or a dict like
        {"content": "", "tool_calls": [{"id": "1", "name": "add", "args": {"a": 1}}]}
    Every prompt received is recorded in .calls
    """

    def __init__(self, responses=None, rules=None, default="I don't know."):
        self.responses = list(responses or [])
        self.rules = dict(rules or {})
        self.default = default
        self.calls = []

    def invoke(self, prompt):
        self.calls.append(prompt)
        if self.responses:
            return self.responses.pop(0)
        text = _last_text(prompt).lower()
        for keyword, reply in self.rules.items():
            if keyword.lower() in text:
                return reply
        return self.default

    __call__ = invoke

    def __repr__(self):
        return f"FakeLLM(queued={len(self.responses)}, rules={list(self.rules)})"
