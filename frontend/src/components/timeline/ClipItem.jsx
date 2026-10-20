import React from "react";

export function ClipItem({
  clip,
  scale = 50,
  isSelected = false,
  onSelect,
  onTrimLeft,
  onTrimRight,
}) {
  const left = clip.startTime * scale;
  const width = Math.max(10, clip.duration * scale);

  return (
    <div
      onClick={onSelect}
      className={`absolute top-1 bottom-1 rounded-md overflow-hidden cursor-pointer select-none border transition-all ${
        isSelected
          ? "border-cyan-400 bg-cyan-950/80 shadow-md ring-1 ring-cyan-400"
          : "border-slate-700 bg-slate-800/90 hover:border-slate-500"
      }`}
      style={{ left: `${left}px`, width: `${width}px` }}
    >
      {/* Left Trim Handle */}
      <div
        onMouseDown={onTrimLeft}
        className="absolute left-0 top-0 bottom-0 w-2 hover:bg-cyan-400/50 cursor-ew-resize z-10"
      />

      {/* Clip Content & Label */}
      <div className="px-2.5 py-1 text-xs font-medium text-slate-200 truncate">
        {clip.name || "Untitled Clip"}
      </div>

      {/* Right Trim Handle */}
      <div
        onMouseDown={onTrimRight}
        className="absolute right-0 top-0 bottom-0 w-2 hover:bg-cyan-400/50 cursor-ew-resize z-10"
      />
    </div>
  );
}
