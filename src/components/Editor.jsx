import React, { useEffect, useRef } from "react";
import MonacoEditor from "@monaco-editor/react";

export const THEME_COLORS = {
  green: { fg: "#33ff66", dim: "#1f9e45", accent: "#b6ffc9", bg: "#050a06" },
  amber: { fg: "#ffb000", dim: "#a87400", accent: "#ffe0a0", bg: "#0a0702" },
  cyan: { fg: "#5ce1ff", dim: "#2b8fa6", accent: "#c8f6ff", bg: "#03080a" },
};

function defineThemes(monaco) {
  for (const [name, c] of Object.entries(THEME_COLORS)) {
    monaco.editor.defineTheme(`term-${name}`, {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "", foreground: c.fg.slice(1) },
        { token: "comment", foreground: c.dim.slice(1), fontStyle: "italic" },
        { token: "keyword", foreground: c.accent.slice(1), fontStyle: "bold" },
        { token: "string", foreground: "e6db74" },
        { token: "number", foreground: "fd971f" },
      ],
      colors: {
        "editor.background": c.bg,
        "editor.foreground": c.fg,
        "editorLineNumber.foreground": c.dim,
        "editorLineNumber.activeForeground": c.fg,
        "editorCursor.foreground": c.fg,
        "editor.selectionBackground": `${c.dim}66`,
        "editor.lineHighlightBackground": `${c.dim}18`,
        "editorIndentGuide.background1": `${c.dim}33`,
        "editorWidget.background": c.bg,
        "editorSuggestWidget.background": c.bg,
        "editorSuggestWidget.border": c.dim,
      },
    });
  }
}

export default function Editor({ value, onChange, onRun, onSubmit, theme, filename }) {
  const handlers = useRef({ onRun, onSubmit });
  const monacoRef = useRef(null);
  handlers.current = { onRun, onSubmit };

  useEffect(() => {
    monacoRef.current?.editor.setTheme(`term-${theme}`);
  }, [theme]);

  const onMount = (editor, monaco) => {
    monacoRef.current = monaco;
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => handlers.current.onRun());
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => handlers.current.onSubmit());
  };

  return (
    <MonacoEditor
      path={filename}
      language="python"
      value={value}
      onChange={(v) => onChange(v ?? "")}
      theme={`term-${theme}`}
      beforeMount={defineThemes}
      onMount={onMount}
      loading={<div className="editor-loading">loading editor...</div>}
      options={{
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        fontSize: 14,
        lineHeight: 21,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        tabSize: 4,
        insertSpaces: true,
        renderLineHighlight: "line",
        cursorBlinking: "phase",
        cursorStyle: "block",
        automaticLayout: true,
        padding: { top: 12 },
        wordWrap: "on",
      }}
    />
  );
}
