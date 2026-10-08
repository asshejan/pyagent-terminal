import React, { useEffect, useRef, useState } from "react";
import { PythonCode, RichText } from "./RichText.jsx";
import { complete } from "../terminal/commands.js";

function Entry({ entry }) {
  if (entry.kind === "cmd") {
    return (
      <div className="line">
        <span className="prompt">{entry.prompt}</span> <span className="typed">{entry.text}</span>
      </div>
    );
  }
  if (entry.kind === "code") return <PythonCode text={entry.text} />;
  return (
    <div className={`line ${entry.cls || ""}`}>
      <RichText text={entry.text} fences={entry.kind === "rich"} />
    </div>
  );
}

export default function Terminal({ entries, prompt, busy, onCommand, onClear }) {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState([]);
  const [cursor, setCursor] = useState(-1);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries, busy]);

  const submit = () => {
    const line = input;
    setInput("");
    setCursor(-1);
    if (line.trim()) setHistory((h) => [...h.filter((x) => x !== line), line]);
    onCommand(line);
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!busy) submit();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!history.length) return;
      const next = cursor === -1 ? history.length - 1 : Math.max(0, cursor - 1);
      setCursor(next);
      setInput(history[next]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (cursor === -1) return;
      const next = cursor + 1;
      if (next >= history.length) {
        setCursor(-1);
        setInput("");
      } else {
        setCursor(next);
        setInput(history[next]);
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      const done = complete(input);
      if (done) setInput(done);
    } else if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      onClear();
    } else if (e.key === "c" && e.ctrlKey && !window.getSelection()?.toString()) {
      e.preventDefault();
      setInput("");
    }
  };

  const focusInput = () => {
    if (!window.getSelection()?.toString()) inputRef.current?.focus();
  };

  return (
    <section className="terminal" onClick={focusInput} aria-label="Terminal">
      <div className="scroll" ref={scrollRef}>
        {entries.map((e) => <Entry key={e.id} entry={e} />)}
        {busy ? (
          <div className="line dim">
            <span className="spinner" /> working...
          </div>
        ) : (
          <div className="line input-line">
            <span className="prompt">{prompt}</span>
            <input
              ref={inputRef}
              className="cmd-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="off"
              aria-label="Command input"
              autoFocus
            />
          </div>
        )}
      </div>
    </section>
  );
}
