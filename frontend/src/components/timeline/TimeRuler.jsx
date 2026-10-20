import React from "react";
import { formatSecondsToTimecode } from "../../hooks/useTimecodeFormat.js";

export function TimeRuler({ duration = 60, scale = 50, onSeek }) {
  const totalWidth = duration * scale;
  const stepSeconds = scale > 80 ? 1 : scale > 30 ? 5 : 10;
  const ticks = [];

  for (let s = 0; s <= duration; s += stepSeconds) {
    ticks.push(s);
  }

  const handleClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const seekTime = Math.max(0, clickX / scale);
    if (onSeek) onSeek(seekTime);
  };

  return (
    <div
      onClick={handleClick}
      className="relative h-7 bg-[#111722] border-b border-slate-800 cursor-pointer"
      style={{ width: `${totalWidth}px` }}
    >
      {ticks.map((t) => (
        <div
          key={t}
          className="absolute top-0 bottom-0 border-l border-slate-700/50 pl-1 text-[10px] text-slate-500 font-mono"
          style={{ left: `${t * scale}px` }}
        >
          {formatSecondsToTimecode(t)}
        </div>
      ))}
    </div>
  );
}
