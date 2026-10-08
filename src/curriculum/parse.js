// Parses the plain-text curriculum format (shared by the app and scripts/check-solutions.mjs).
//
//   === <id> | <title> | <level 1-5>
//   ::: story              free text shown first (supports `code` and ``` fences)
//   ::: task               what to build
//   ::: setup [prelude..]  preludes to load + optional extra python run before user code
//   ::: starter            code placed in the editor
//   ::: solution           reference solution
//   ::: hint               may repeat; shown one at a time
//   ::: test <name>        may repeat; python asserts run after the user's code
//   ::: realworld          how this maps onto real Python / LangChain / LangGraph code

const trimBlock = (s) => s.replace(/^\n+/, "").replace(/\s+$/, "");

export function parseTrack(text, track) {
  const problems = [];
  let current = null;
  let section = null;

  const flush = () => {
    if (!current || !section) return;
    const body = trimBlock(section.lines.join("\n"));
    const { name, arg } = section;
    if (name === "hint") current.hints.push(body);
    else if (name === "test") current.tests.push({ name: arg || `test ${current.tests.length + 1}`, code: body });
    else if (name === "setup") {
      current.preludes = arg ? arg.split(/\s+/) : [];
      current.setupCode = body;
    } else current[name] = body;
    section = null;
  };

  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    const header = raw.match(/^=== (\S+) \| (.+?) \| (\d)\s*$/);
    if (header) {
      flush();
      current = {
        id: header[1], title: header[2].trim(), level: Number(header[3]), track: track.id,
        story: "", task: "", starter: "", solution: "", realworld: "",
        hints: [], tests: [], preludes: [], setupCode: "",
      };
      problems.push(current);
      continue;
    }
    const sec = raw.match(/^::: (\w+)\s*(.*)$/);
    if (sec && current) {
      flush();
      section = { name: sec[1], arg: sec[2].trim(), lines: [] };
      continue;
    }
    if (section) section.lines.push(raw);
  }
  flush();
  return problems;
}

export function buildSetup(problem, preludes) {
  const parts = problem.preludes.map((name) => {
    if (!(name in preludes)) throw new Error(`${problem.id}: unknown prelude "${name}"`);
    return preludes[name];
  });
  if (problem.setupCode) parts.push(problem.setupCode);
  return parts.join("\n\n");
}
