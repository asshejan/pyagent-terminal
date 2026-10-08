// Promise API around the Pyodide worker, with a per-run timeout that kills
// and respawns the worker (the only way to stop `while True: pass`).
const TIMEOUT_MS = 6000;

export class PyRunner {
  constructor(onStatus) {
    this.onStatus = onStatus;
    this.nextId = 1;
    this.pending = new Map();
    this.queue = Promise.resolve();
    this.spawn();
  }

  spawn() {
    this.onStatus({ state: "loading" });
    this.worker = new Worker(new URL("./pyWorker.js", import.meta.url), { type: "module" });
    this.worker.onmessage = ({ data }) => this.handle(data);
    this.worker.onerror = (e) => this.onStatus({ state: "error", error: e.message || "worker failed to start" });
  }

  handle(msg) {
    if (msg.type === "ready") return this.onStatus({ state: "ready", version: msg.version });
    if (msg.type === "fatal") return this.onStatus({ state: "error", error: msg.error });
    const job = this.pending.get(msg.id);
    if (!job) return;
    if (msg.type === "started") {
      job.timer = setTimeout(() => this.timeout(msg.id), TIMEOUT_MS);
    } else if (msg.type === "result") {
      clearTimeout(job.timer);
      this.pending.delete(msg.id);
      job.resolve(msg.report);
    }
  }

  timeout(id) {
    const job = this.pending.get(id);
    if (!job) return;
    this.pending.delete(id);
    this.worker.terminate();
    job.resolve({ stdout: "", results: [], timedOut: true,
      error: `TimeoutError: your code ran longer than ${TIMEOUT_MS / 1000}s (infinite loop?). Python was restarted.` });
    this.spawn();
  }

  // Runs are serialised: one Python interpreter, one job at a time.
  run({ setup, code, tests, mode }) {
    const job = () => new Promise((resolve) => {
      const id = this.nextId++;
      this.pending.set(id, { resolve, timer: null });
      this.worker.postMessage({ id, setup, code, tests, mode });
    });
    const result = this.queue.then(job);
    this.queue = result.catch(() => {});
    return result;
  }
}
