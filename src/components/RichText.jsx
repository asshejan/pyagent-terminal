import React from "react";

// Minimal Python highlighter for code blocks printed in the terminal.
const PY_TOKEN = new RegExp(
  [
    String.raw`(?<comment>#[^\n]*)`,
    String.raw`(?<string>[rbfu]{0,2}(?:"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'))`,
    String.raw`(?<decorator>@[\w.]+)`,
    String.raw`(?<keyword>\b(?:def|class|return|if|elif|else|for|while|in|not|and|or|is|import|from|as|try|except|finally|raise|with|yield|lambda|pass|break|continue|async|await|None|True|False|nonlocal|global)\b)`,
    String.raw`(?<number>\b\d+(?:\.\d+)?\b)`,
    String.raw`(?<builtin>\b(?:print|len|range|list|dict|set|tuple|str|int|float|bool|isinstance|super|self|cls|sorted|sum|min|max|enumerate|zip|type)\b)`,
  ].join("|"),
  "g",
);

export function PythonCode({ text }) {
  const parts = [];
  let last = 0;
  for (const m of text.matchAll(PY_TOKEN)) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const kind = Object.keys(m.groups).find((k) => m.groups[k] !== undefined);
    parts.push(<span key={m.index} className={`tok-${kind}`}>{m[0]}</span>);
    last = m.index + m[0].length;
  }
  parts.push(text.slice(last));
  return <pre className="codeblock">{parts}</pre>;
}

function Inline({ text }) {
  return text.split(/(`[^`\n]+`)/).map((chunk, i) =>
    chunk.startsWith("`") && chunk.endsWith("`") && chunk.length > 2
      ? <code key={i} className="inline">{chunk.slice(1, -1)}</code>
      : <React.Fragment key={i}>{chunk}</React.Fragment>,
  );
}

// Text with `inline code` and ``` fenced blocks.
export function RichText({ text, fences = true }) {
  if (!fences) return <Inline text={text} />;
  const out = [];
  const re = /```\w*\n?([\s\S]*?)```/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) out.push(<Inline key={`t${last}`} text={text.slice(last, m.index).replace(/\n$/, "")} />);
    out.push(<PythonCode key={`c${m.index}`} text={m[1].replace(/\n$/, "")} />);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(<Inline key={`t${last}`} text={text.slice(last).replace(/^\n/, "")} />);
  return out;
}
