// Terminal command handlers. Each handler receives (args, ctx) where ctx is
// the app's API (print, open, run, progress...). Output is a list of entries:
//   { kind: "rich" | "pre" | "code", text, cls }
import { ALL_PROBLEMS, CURRICULUM, PROBLEM_BY_ID, TRACK_BY_ID, setupFor } from "../curriculum/index.js";

export const SOLUTION_UNLOCK_FAILS = 3;

export const rich = (text, cls = "") => ({ kind: "rich", text, cls });
export const pre = (text, cls = "") => ({ kind: "pre", text, cls });
export const code = (text) => ({ kind: "code", text });

const stars = (n) => "★".repeat(n) + "☆".repeat(5 - n);

export function bar(done, total, width = 16) {
  const filled = total ? Math.round((done / total) * width) : 0;
  return "█".repeat(filled) + "░".repeat(width - filled);
}

const solvedIn = (track, progress) => track.problems.filter((p) => progress.solved[p.id]).length;

export function problemHeader(p, progress) {
  const track = TRACK_BY_ID[p.track];
  const status = progress.solved[p.id] ? "  ✔ solved" : "";
  return [
    pre(`== ${p.id} · ${p.title} ==`, "title"),
    pre(`track ${track.number}/${CURRICULUM.length} ${track.title}   level ${stars(p.level)}${status}`, "dim"),
  ];
}

export function problemView(p, progress) {
  const out = [...problemHeader(p, progress), rich(p.story)];
  out.push(pre("TASK", "section"), rich(p.task));
  if (p.preludes.length || p.setupCode) {
    out.push(rich(`Provided for you: ${[...p.preludes, p.setupCode ? "extra setup code" : ""].filter(Boolean).join(", ")} — type \`setup\` to read it.`, "dim"));
  }
  out.push(rich("Edit the code on the right. `run` (Ctrl+Enter) executes it, `submit` (Ctrl+S) runs the hidden tests, `hint` gives a nudge.", "dim"));
  return out;
}

function findProblem(arg) {
  if (!arg) return null;
  const key = arg.toLowerCase();
  if (PROBLEM_BY_ID[key]) return PROBLEM_BY_ID[key];
  const n = Number(key);
  if (Number.isInteger(n) && n >= 1 && n <= ALL_PROBLEMS.length) return ALL_PROBLEMS[n - 1];
  return null;
}

const HELP = [
  ["help", "show this help"],
  ["ls", "list tracks and progress"],
  ["ls <track>", "list problems in a track (e.g. ls oop)"],
  ["open <id|#>", "open a problem (e.g. open lc-03, open 1)"],
  ["next / prev", "move to the next / previous problem"],
  ["cat", "re-print the current problem"],
  ["run", "run your code, show printed output     [Ctrl+Enter]"],
  ["submit", "run the hidden tests (alias: test)    [Ctrl+S]"],
  ["hint", "reveal the next hint"],
  ["setup", "show the code provided for this problem (FakeLLM, StateGraph...)"],
  ["solution", `show the reference solution (unlocks after ${SOLUTION_UNLOCK_FAILS} failed submits)`],
  ["realworld", "how this maps to real Python / LangChain / LangGraph"],
  ["reset", "restore the starter code"],
  ["progress", "overall progress"],
  ["theme <name>", "green | amber | cyan"],
  ["clear", "clear the screen (Ctrl+L)"],
  ["wipe --yes", "erase ALL progress and drafts"],
];

export const COMMANDS = {
  help() {
    const width = Math.max(...HELP.map(([c]) => c.length)) + 3;
    return [
      pre("COMMANDS", "section"),
      pre(HELP.map(([c, d]) => `  ${c.padEnd(width)}${d}`).join("\n")),
      rich("Tip: ↑/↓ browse history, Tab completes commands and problem ids.", "dim"),
    ];
  },

  ls(args, ctx) {
    const { progress } = ctx;
    if (args[0]) {
      const track = TRACK_BY_ID[args[0].toLowerCase()] || CURRICULUM[Number(args[0]) - 1];
      if (!track) return [pre(`ls: no such track '${args[0]}'. Tracks: ${CURRICULUM.map((t) => t.id).join(", ")}`, "err")];
      const lines = track.problems.map((p) => {
        const mark = progress.solved[p.id] ? "✔" : ctx.current?.id === p.id ? "▸" : " ";
        return `  ${mark} ${p.id.padEnd(7)} ${stars(p.level)}  ${p.title}`;
      });
      return [pre(`${track.number}. ${track.title} — ${track.blurb}`, "section"), pre(lines.join("\n")), rich("`open <id>` to start one.", "dim")];
    }
    const lines = CURRICULUM.map((t) => {
      const done = solvedIn(t, progress);
      return `  ${String(t.number)}. ${t.id.padEnd(4)} ${t.title.padEnd(26)} ${bar(done, t.problems.length, 12)} ${done}/${t.problems.length}`;
    });
    return [pre("TRACKS  (basic → hard)", "section"), pre(lines.join("\n")), rich("`ls <track>` to see problems, e.g. `ls py`.", "dim")];
  },

  open(args, ctx) {
    const p = findProblem(args[0]);
    if (!p) return [pre(`open: unknown problem '${args[0] ?? ""}'. Try \`ls\`.`, "err")];
    ctx.open(p.id);
    return [];
  },

  next(_, ctx) {
    const i = ctx.current ? ALL_PROBLEMS.indexOf(ctx.current) : -1;
    const p = ALL_PROBLEMS[i + 1];
    if (!p) return [pre("🎉 That was the last problem. You've reached the end of the curriculum!", "ok")];
    ctx.open(p.id);
    return [];
  },

  prev(_, ctx) {
    const i = ctx.current ? ALL_PROBLEMS.indexOf(ctx.current) : 0;
    if (i <= 0) return [pre("prev: already at the first problem.", "dim")];
    ctx.open(ALL_PROBLEMS[i - 1].id);
    return [];
  },

  cat(_, ctx) {
    if (!ctx.current) return [pre("cat: no problem open. Try `open 1`.", "err")];
    return problemView(ctx.current, ctx.progress);
  },

  async run(_, ctx) {
    if (!ctx.current) return [pre("run: no problem open.", "err")];
    return ctx.runCode("run");
  },

  async submit(_, ctx) {
    if (!ctx.current) return [pre("submit: no problem open.", "err")];
    return ctx.runCode("test");
  },

  hint(_, ctx) {
    const p = ctx.current;
    if (!p) return [pre("hint: no problem open.", "err")];
    const used = ctx.progress.hints[p.id] || 0;
    if (used >= p.hints.length) {
      return [
        ...p.hints.map((h, i) => rich(`hint ${i + 1}/${p.hints.length}: ${h}`, "hint")),
        rich("No more hints. Still stuck? Read the failing test messages carefully, or `solution`.", "dim"),
      ];
    }
    ctx.updateProgress((pr) => ({ ...pr, hints: { ...pr.hints, [p.id]: used + 1 } }));
    return [rich(`hint ${used + 1}/${p.hints.length}: ${p.hints[used]}`, "hint")];
  },

  setup(_, ctx) {
    const p = ctx.current;
    if (!p) return [pre("setup: no problem open.", "err")];
    const src = setupFor(p);
    if (!src.trim()) return [pre("This problem has no provided code — it's all you!", "dim")];
    return [rich("This code runs BEFORE yours; everything it defines is available to you:", "dim"), code(src)];
  },

  solution(args, ctx) {
    const p = ctx.current;
    if (!p) return [pre("solution: no problem open.", "err")];
    const fails = ctx.progress.fails[p.id] || 0;
    const unlocked = ctx.progress.unlocked?.[p.id];
    const allowed = ctx.progress.solved[p.id] || unlocked || fails >= SOLUTION_UNLOCK_FAILS || args.includes("--force");
    if (allowed && !unlocked) {
      ctx.updateProgress((pr) => ({ ...pr, unlocked: { ...pr.unlocked, [p.id]: true } }));
    }
    if (!allowed) {
      return [
        pre(`solution: locked. Submit ${SOLUTION_UNLOCK_FAILS - fails} more attempt(s) first — struggling is where the learning happens.`, "warn"),
        rich("(If you really must: `solution --force`.)", "dim"),
      ];
    }
    if (args.includes("--load")) {
      ctx.setCode(p.solution);
      return [pre("Reference solution loaded into the editor. Read it line by line, then `submit`.", "ok")];
    }
    return [pre("REFERENCE SOLUTION", "section"), code(p.solution), rich("`solution --load` puts it in the editor. Compare with yours — there are many correct answers.", "dim")];
  },

  realworld(_, ctx) {
    const p = ctx.current;
    if (!p) return [pre("realworld: no problem open.", "err")];
    if (!p.realworld) return [pre("No real-world note for this one — the concept is plain Python you'll use everywhere.", "dim")];
    return [pre("IN THE REAL WORLD", "section"), code(p.realworld)];
  },

  reset(_, ctx) {
    if (!ctx.current) return [pre("reset: no problem open.", "err")];
    ctx.setCode(ctx.current.starter);
    return [pre("Editor reset to starter code.", "dim")];
  },

  progress(_, ctx) {
    const solved = Object.keys(ctx.progress.solved).filter((id) => PROBLEM_BY_ID[id]).length;
    const total = ALL_PROBLEMS.length;
    const nextUp = ALL_PROBLEMS.find((p) => !ctx.progress.solved[p.id]);
    return [
      pre(`OVERALL  ${bar(solved, total, 30)} ${solved}/${total} (${Math.round((solved / total) * 100)}%)`, "section"),
      ...COMMANDS.ls([], ctx).slice(1, 2),
      rich(nextUp ? `Next unsolved: \`open ${nextUp.id}\` — ${nextUp.title}` : "Everything solved. You are an agent engineer now.", "dim"),
    ];
  },

  theme(args, ctx) {
    const name = (args[0] || "").toLowerCase();
    if (!["green", "amber", "cyan"].includes(name)) return [pre("theme: choose green, amber or cyan", "err")];
    ctx.setTheme(name);
    return [pre(`theme set to ${name}`, "dim")];
  },

  clear(_, ctx) {
    ctx.clear();
    return [];
  },

  wipe(args, ctx) {
    if (!args.includes("--yes")) return [pre("wipe: this erases ALL progress and drafts. Run `wipe --yes` to confirm.", "warn")];
    ctx.wipe();
    return [pre("All progress erased.", "warn")];
  },

  whoami() {
    return [pre("a future AI engineer.", "ok")];
  },

  sudo() {
    return [pre("Nice try. Permission granted only to those who finish the capstone.", "warn")];
  },
};

COMMANDS.test = COMMANDS.submit;
COMMANDS.cls = COMMANDS.clear;
COMMANDS.dir = COMMANDS.ls;

export const COMMAND_NAMES = Object.keys(COMMANDS);

export function complete(input) {
  const parts = input.split(/\s+/);
  if (parts.length === 1) {
    const hits = COMMAND_NAMES.filter((c) => c.startsWith(parts[0]));
    return hits.length === 1 ? `${hits[0]} ` : null;
  }
  const last = parts[parts.length - 1].toLowerCase();
  const pool = parts[0] === "ls" ? CURRICULUM.map((t) => t.id) : ALL_PROBLEMS.map((p) => p.id);
  const hits = pool.filter((id) => id.startsWith(last));
  if (hits.length !== 1) return null;
  return [...parts.slice(0, -1), hits[0]].join(" ");
}

export async function execute(line, ctx) {
  const [name, ...args] = line.trim().split(/\s+/);
  if (!name) return [];
  const cmd = COMMANDS[name.toLowerCase()];
  if (!cmd) {
    if (findProblem(name)) return COMMANDS.open([name], ctx);
    return [pre(`${name}: command not found. Type \`help\`.`, "err")];
  }
  return (await cmd(args, ctx)) || [];
}
