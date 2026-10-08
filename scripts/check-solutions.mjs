// Verifies every problem: the reference solution must pass all tests and the
// starter code must fail at least one. Usage: npm run check [-- <id-prefix>]
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadPyodide } from "pyodide";
import { parseTrack, buildSetup } from "../src/curriculum/parse.js";
import { TRACKS } from "../src/curriculum/tracks.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");
const filter = process.argv[2] || "";

const preludes = Object.fromEntries(
  ["fake_llm", "mini_lc", "mini_graph"].map((n) => [n, read(`src/curriculum/preludes/${n}.py`)]),
);

const py = await loadPyodide();
py.runPython(read("src/runner/harness.py"));
const runHarness = py.globals.get("run_harness");

async function run(setup, code, tests) {
  await py.loadPackagesFromImports(setup + "\n" + code);
  const json = await runHarness(JSON.stringify({ setup, code, tests, mode: "test" }));
  return JSON.parse(json);
}

let failures = 0;
let count = 0;
const ids = new Set();
for (const track of TRACKS) {
  const file = `src/curriculum/tracks/${track.file}.txt`;
  if (!existsSync(join(root, file))) { console.log(`- skipping missing ${file}`); continue; }
  const problems = parseTrack(read(file), track);
  for (const p of problems) {
    if (!p.id.startsWith(filter)) continue;
    count++;
    const problems_ = [];
    if (ids.has(p.id)) problems_.push("duplicate id");
    ids.add(p.id);
    if (!p.tests.length) problems_.push("no tests");
    if (!p.hints.length) problems_.push("no hints");
    if (!p.task || !p.starter || !p.solution) problems_.push("missing task/starter/solution");
    const setup = buildSetup(p, preludes);
    const sol = await run(setup, p.solution, p.tests);
    if (sol.error) problems_.push(`solution crashed:\n${sol.error}`);
    for (const r of sol.results) if (!r.passed) problems_.push(`solution fails "${r.name}":\n${r.error}`);
    const start = await run(setup, p.starter, p.tests);
    if (!start.error && start.results.every((r) => r.passed)) problems_.push("starter already passes every test");
    if (problems_.length) {
      failures++;
      console.log(`✘ ${p.id} ${p.title}\n   ${problems_.join("\n   ").replace(/\n/g, "\n      ")}`);
    } else {
      console.log(`✔ ${p.id} ${p.title} (${p.tests.length} tests)`);
    }
  }
}
console.log(`\n${count - failures}/${count} problems OK`);
process.exit(failures ? 1 : 0);
