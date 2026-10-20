import React from "react";

export function Playhead({ currentTime = 0, scale = 50, onScrub }) {
  const leftPos = currentTime * scale;

  return (
    <div
      className="absolute top-0 bottom-0 z-30 pointer-events-none"
      style={{ left: `${leftPos}px` }}
    >
      {/* Playhead Head */}
      <div className="absolute -top-1 -left-2 w-4 h-3 bg-red-500 rounded-sm pointer-events-auto cursor-ew-resize flex items-center justify-center">
        <div className="w-0.5 h-1.5 bg-white rounded-full" />
      </div>
      {/* Playhead Line */}
      <div className="w-[1.5px] h-full bg-red-500" />
    </div>
  );
}
