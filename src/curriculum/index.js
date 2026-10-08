import { TRACKS } from "./tracks.js";
import { buildSetup, parseTrack } from "./parse.js";

const trackFiles = import.meta.glob("./tracks/*.txt", { query: "?raw", import: "default", eager: true });
const preludeFiles = import.meta.glob("./preludes/*.py", { query: "?raw", import: "default", eager: true });

export const PRELUDES = Object.fromEntries(
  Object.entries(preludeFiles).map(([path, src]) => [path.match(/(\w+)\.py$/)[1], src]),
);

export const CURRICULUM = TRACKS.map((t, i) => ({
  ...t,
  number: i + 1,
  problems: parseTrack(trackFiles[`./tracks/${t.file}.txt`] || "", t),
}));

export const ALL_PROBLEMS = CURRICULUM.flatMap((t) => t.problems);
export const PROBLEM_BY_ID = Object.fromEntries(ALL_PROBLEMS.map((p) => [p.id, p]));
export const TRACK_BY_ID = Object.fromEntries(CURRICULUM.map((t) => [t.id, t]));

export const setupFor = (problem) => buildSetup(problem, PRELUDES);
