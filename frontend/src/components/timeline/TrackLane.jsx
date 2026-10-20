import React from "react";

export function TrackLane({ track, children, height = 64 }) {
  return (
    <div
      className="relative w-full border-b border-slate-800/60 bg-[#0d121c]/50 hover:bg-[#121926]/30 transition-colors"
      style={{ height: `${height}px` }}
    >
      {children}
    </div>
  );
}
