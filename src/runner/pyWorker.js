// Runs Python (Pyodide) off the main thread so a runaway loop can't freeze the UI.
import harness from "./harness.py?raw";

export const PYODIDE_URL = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/";

const ready = (async () => {
  const { loadPyodide } = await import(/* @vite-ignore */ `${PYODIDE_URL}pyodide.mjs`);
  const py = await loadPyodide({ indexURL: PYODIDE_URL });
  py.runPython(harness);
  return py;
})();

ready
  .then((py) => postMessage({ type: "ready", version: py.runPython("import sys; sys.version.split()[0]") }))
  .catch((err) => postMessage({ type: "fatal", error: String(err) }));

self.onmessage = async ({ data }) => {
  const { id, setup, code, tests, mode } = data;
  try {
    const py = await ready;
    await py.loadPackagesFromImports(`${setup}\n${code}`);
    postMessage({ type: "started", id });
    const json = await py.globals.get("run_harness")(JSON.stringify({ setup, code, tests, mode }));
    postMessage({ type: "result", id, report: JSON.parse(json) });
  } catch (err) {
    postMessage({ type: "result", id, report: { stdout: "", error: String(err), results: [] } });
  }
};
