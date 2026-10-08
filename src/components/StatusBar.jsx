import React from "react";
import { TRACK_BY_ID, CURRICULUM } from "../curriculum/index.js";
import { bar } from "../terminal/commands.js";

const PY_LABEL = {
  loading: "python: booting…",
  ready: "python",
  error: "python: failed",
};

export default function StatusBar({ py, current, solved, total, theme }) {
  const track = current ? TRACK_BY_ID[current.track] : null;
  return (
    <footer className="statusbar">
      <span className={`py py-${py.state}`} title={py.error || ""}>
        ● {PY_LABEL[py.state]}{py.version ? ` ${py.version}` : ""}
      </span>
      {track && <span>track {track.number}/{CURRICULUM.length} · {track.title}</span>}
      {current && <span className="hide-sm">{current.id} · lvl {current.level}</span>}
      <span className="grow" />
      <span>solved {solved}/{total} <span className="bar">{bar(solved, total, 12)}</span> {Math.round((solved / total) * 100)}%</span>
      <span className="hide-sm">theme:{theme}</span>
    </footer>
  );
}
