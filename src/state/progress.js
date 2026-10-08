// Per-browser progress: solved problems, editor drafts, failed attempts, hints used.
const KEY = "pyagent-terminal.v1";

const empty = () => ({ solved: {}, drafts: {}, fails: {}, hints: {}, unlocked: {}, current: null, theme: "green" });

export function loadProgress() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...empty(), ...JSON.parse(raw) } : empty();
  } catch {
    return empty();
  }
}

export function saveProgress(progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    // storage unavailable (private mode) — progress just won't persist
  }
}

export const freshProgress = empty;
