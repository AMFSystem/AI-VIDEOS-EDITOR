import React from "react";

export function KeyframeTrack({ keyframes = [], scale = 50, onKeyframeClick }) {
  return (
    <div className="absolute bottom-0 left-0 right-0 h-4 bg-slate-900/60 flex items-center">
      {keyframes.map((kf, i) => (
        <div
          key={i}
          onClick={() => onKeyframeClick && onKeyframeClick(kf)}
          className="absolute w-2 h-2 bg-amber-400 rotate-45 cursor-pointer hover:scale-125 transition-transform"
          style={{ left: `${kf.time * scale}px` }}
        />
      ))}
    </div>
  );
}
