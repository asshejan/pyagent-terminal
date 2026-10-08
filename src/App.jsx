import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Terminal from "./components/Terminal.jsx";
import Editor from "./components/Editor.jsx";
import StatusBar from "./components/StatusBar.jsx";
import { ALL_PROBLEMS, CURRICULUM, PROBLEM_BY_ID, TRACK_BY_ID, setupFor } from "./curriculum/index.js";
import { SOLUTION_UNLOCK_FAILS, execute, pre, problemView, rich, code } from "./terminal/commands.js";
import { freshProgress, loadProgress, saveProgress } from "./state/progress.js";
import { PyRunner } from "./runner/pyClient.js";

const BANNER = `
+------------------------------------------+
|  >_  P Y A G E N T   T E R M I N A L     |
|      python  ->  agents  ->  graphs      |
+------------------------------------------+`;

const SOLVED_ART = `
  +-------------------------------+
  |   ACCESS GRANTED - ALL PASS   |
  +-------------------------------+`;

let nextEntryId = 1;
const withIds = (list) => list.map((e) => ({ ...e, id: nextEntryId++ }));
const clip = (s, n = 4000) => (s.length > n ? `${s.slice(0, n)}\n... (${s.length - n} more characters)` : s);

export default function App() {
  const [progress, setProgress] = useState(loadProgress);
  const [entries, setEntries] = useState([]);
  const [currentId, setCurrentId] = useState(null);
  const [code_, setCode_] = useState("");
  const [busy, setBusy] = useState(false);
  const [py, setPy] = useState({ state: "loading" });

  const progressRef = useRef(progress);
  const codeRef = useRef(code_);
  const runnerRef = useRef(null);
  progressRef.current = progress;
  codeRef.current = code_;
  const current = currentId ? PROBLEM_BY_ID[currentId] : null;

  const print = useCallback((list) => setEntries((prev) => [...prev, ...withIds(list)].slice(-600)), []);
  const updateProgress = useCallback((fn) => setProgress((p) => fn(p)), []);

  useEffect(() => saveProgress(progress), [progress]);
  useEffect(() => {
    document.documentElement.dataset.theme = progress.theme;
  }, [progress.theme]);

  // Persist the editor content as a per-problem draft (debounced).
  useEffect(() => {
    if (!currentId) return undefined;
    const t = setTimeout(() => {
      setProgress((p) => (p.drafts[currentId] === code_ ? p : { ...p, drafts: { ...p.drafts, [currentId]: code_ } }));
    }, 400);
    return () => clearTimeout(t);
  }, [code_, currentId]);

  const open = useCallback((id) => {
    const p = PROBLEM_BY_ID[id];
    const draft = progressRef.current.drafts[id];
    setCurrentId(id);
    setCode_(draft ?? p.starter);
    setProgress((pr) => ({ ...pr, current: id }));
    print(problemView(p, progressRef.current));
  }, [print]);

  const runCode = useCallback(async (mode) => {
    const p = PROBLEM_BY_ID[currentId];
    print([pre(mode === "test" ? `running ${p.tests.length} hidden tests...` : "running solution.py ...", "dim")]);
    const report = await runnerRef.current.run({ setup: setupFor(p), code: codeRef.current, tests: p.tests, mode });
    const out = [];
    if (report.stdout) out.push(pre("stdout:", "dim"), pre(clip(report.stdout), "stdout"));
    if (report.error) out.push(pre(report.error, "err"));
    if (mode === "run") {
      if (!report.stdout && !report.error) out.push(pre("(ran without errors, printed nothing — add print() calls to see values, or `submit` to test)", "dim"));
      return out;
    }
    if (report.timedOut) return out;
    const passed = report.results.filter((r) => r.passed).length;
    for (const r of report.results) {
      out.push(pre(`  ${r.passed ? "✔" : "✘"} ${r.name}`, r.passed ? "ok" : "err"));
      if (!r.passed && r.error && !report.error) out.push(pre(r.error.replace(/^/gm, "      "), "err-detail"));
    }
    const total = report.results.length;
    if (passed === total && total > 0) {
      const first = !progressRef.current.solved[p.id];
      setProgress((pr) => ({ ...pr, solved: { ...pr.solved, [p.id]: new Date().toISOString() } }));
      out.push(pre(SOLVED_ART, "ok banner"), pre(`${passed}/${total} tests passed${first ? " — problem solved!" : ""}`, "ok"));
      if (p.realworld) out.push(pre("IN THE REAL WORLD", "section"), code(p.realworld));
      const idx = ALL_PROBLEMS.indexOf(p);
      const nxt = ALL_PROBLEMS[idx + 1];
      if (nxt && nxt.track !== p.track) {
        out.push(pre(`★ Track complete: ${TRACK_BY_ID[p.track].title}! Next up: ${TRACK_BY_ID[nxt.track].title}.`, "ok"));
      }
      out.push(rich(nxt ? `Type \`next\` for ${nxt.id} · ${nxt.title}` : "That was the final capstone. Congratulations, agent engineer!", "dim"));
    } else {
      const fails = (progressRef.current.fails[p.id] || 0) + 1;
      setProgress((pr) => ({ ...pr, fails: { ...pr.fails, [p.id]: fails } }));
      out.push(pre(`${passed}/${total} tests passed`, "warn"));
      const unused = p.hints.length - (progressRef.current.hints[p.id] || 0);
      if (fails === SOLUTION_UNLOCK_FAILS) out.push(rich("`solution` is now unlocked if you need it.", "dim"));
      else if (unused > 0) out.push(rich(`Stuck? \`hint\` (${unused} left)`, "dim"));
    }
    return out;
  }, [currentId, print]);

  const ctx = useMemo(() => ({
    progress,
    current,
    open,
    print,
    runCode,
    updateProgress,
    setCode: setCode_,
    setTheme: (theme) => setProgress((p) => ({ ...p, theme })),
    clear: () => setEntries([]),
    wipe: () => setProgress({ ...freshProgress(), theme: progressRef.current.theme }),
  }), [progress, current, open, print, runCode, updateProgress]);

  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  const runCommand = useCallback(async (line, { echo = true } = {}) => {
    const c = ctxRef.current;
    const promptText = `pyagent:~/${c.current ? `${c.current.track}/${c.current.id}` : ""}$`;
    if (echo) print([{ kind: "cmd", prompt: promptText, text: line }]);
    setBusy(true);
    try {
      print(await execute(line, c));
    } catch (err) {
      print([pre(`internal error: ${err.message}`, "err")]);
    } finally {
      setBusy(false);
    }
  }, [print]);

  // Boot: start Python, print the banner, resume where the learner left off.
  useEffect(() => {
    runnerRef.current = new PyRunner(setPy);
    const solved = Object.keys(progressRef.current.solved).length;
    print([
      pre(BANNER, "banner"),
      pre(`Learn Python → OOP → LangChain → LangGraph → multi-agent systems, one problem at a time.`, "accent"),
      pre(`${ALL_PROBLEMS.length} problems · ${CURRICULUM.length} tracks · real Python runs in your browser · no API key needed`, "dim"),
      rich("Type `help` for commands, `ls` for the curriculum.", "dim"),
    ]);
    const resume = progressRef.current.current;
    if (resume && PROBLEM_BY_ID[resume]) {
      print([pre(`resuming ${resume} (${solved} solved so far)`, "dim")]);
      open(resume);
    } else {
      open(ALL_PROBLEMS[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const promptText = `pyagent:~/${current ? `${current.track}/${current.id}` : ""}$`;
  const solvedCount = Object.keys(progress.solved).filter((id) => PROBLEM_BY_ID[id]).length;

  return (
    <div className="app">
      <header className="titlebar">
        <span className="dots" aria-hidden="true"><i /><i /><i /></span>
        <span className="title">pyagent@learn: ~/{current ? `${TRACK_BY_ID[current.track].file}/${current.id}.py` : ""}</span>
        <span className="title-right">{current ? current.title : ""}</span>
      </header>
      <main className="panes">
        <Terminal
          entries={entries}
          prompt={promptText}
          busy={busy}
          onCommand={(line) => runCommand(line)}
          onClear={() => setEntries([])}
        />
        <section className="editor-pane" aria-label="Code editor">
          <div className="editor-tabs">
            <span className="tab">{current ? `${current.id}.py` : "solution.py"}</span>
            <span className="toolbar">
              <button type="button" onClick={() => runCommand("run")} disabled={busy} title="Ctrl+Enter">▶ run</button>
              <button type="button" className="primary" onClick={() => runCommand("submit")} disabled={busy} title="Ctrl+S">✔ submit</button>
              <button type="button" onClick={() => runCommand("hint")} disabled={busy}>? hint</button>
              <button type="button" onClick={() => runCommand("reset")} disabled={busy}>↺ reset</button>
            </span>
          </div>
          <div className="editor-body">
            <Editor
              value={code_}
              onChange={setCode_}
              onRun={() => !busy && runCommand("run")}
              onSubmit={() => !busy && runCommand("submit")}
              theme={progress.theme}
              filename={current ? `${current.id}.py` : "solution.py"}
            />
          </div>
        </section>
      </main>
      <StatusBar py={py} current={current} solved={solvedCount} total={ALL_PROBLEMS.length} theme={progress.theme} />
    </div>
  );
}
