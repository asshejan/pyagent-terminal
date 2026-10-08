"""Test harness: runs setup + user code + hidden tests and reports JSON."""
import ast
import inspect
import io
import json
import linecache
import sys
import traceback
from contextlib import redirect_stderr, redirect_stdout

_FLAGS = ast.PyCF_ALLOW_TOP_LEVEL_AWAIT
_USER_FILES = ("setup.py", "solution.py", "test.py")


def _register(src, filename):
    linecache.cache[filename] = (len(src), None, src.splitlines(True), filename)


async def _exec(src, filename, ns):
    _register(src, filename)
    code = compile(src, filename, "exec", flags=_FLAGS)
    result = eval(code, ns)
    if inspect.iscoroutine(result):
        await result


def _format_error(exc):
    frames = [f for f in traceback.extract_tb(exc.__traceback__) if f.filename in _USER_FILES]
    lines = []
    for f in frames[-3:]:
        lines.append(f'  File "{f.filename}", line {f.lineno}, in {f.name}')
        if f.line:
            lines.append(f"    {f.line.strip()}")
    msg = str(exc)
    lines.append(f"{type(exc).__name__}: {msg}" if msg else type(exc).__name__)
    return "\n".join(lines)


def capture_output(fn, *args, **kwargs):
    """Call fn and return everything it printed (used by tests)."""
    buf = io.StringIO()
    with redirect_stdout(buf):
        fn(*args, **kwargs)
    return buf.getvalue()


async def run_harness(payload_json):
    payload = json.loads(payload_json)
    setup, code, tests, mode = payload["setup"], payload["code"], payload["tests"], payload["mode"]
    out = io.StringIO()
    report = {"stdout": "", "error": None, "results": []}
    ns = {"__name__": "__main__", "capture_output": capture_output}
    sys.modules.pop("solution", None)

    with redirect_stdout(out), redirect_stderr(out):
        try:
            if setup.strip():
                await _exec(setup, "setup.py", ns)
            await _exec(code, "solution.py", ns)
        except BaseException as exc:  # noqa: BLE001 - report everything to the learner
            report["error"] = _format_error(exc)

    report["stdout"] = out.getvalue()
    if mode == "test":
        for test in tests:
            result = {"name": test["name"], "passed": False, "error": None}
            if report["error"]:
                result["error"] = "your code crashed before tests could run"
            else:
                tns = dict(ns)
                try:
                    with redirect_stdout(io.StringIO()):
                        await _exec(test["code"], "test.py", tns)
                    result["passed"] = True
                except BaseException as exc:  # noqa: BLE001
                    result["error"] = _format_error(exc)
            report["results"].append(result)
    return json.dumps(report)
