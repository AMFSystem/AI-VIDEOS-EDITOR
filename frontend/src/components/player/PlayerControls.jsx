import React from "react";
import { formatSecondsToTimecode } from "../../hooks/useTimecodeFormat.js";

export function PlayerControls({
  isPlaying,
  currentTime = 0,
  duration = 0,
  onPlayPause,
  onStepForward,
  onStepBackward,
  onToggleLoop,
  isLooping = false,
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-[#121824] border-t border-slate-800 text-sm text-slate-300">
      <div className="flex items-center gap-2 font-mono text-cyan-400">
        <span>{formatSecondsToTimecode(currentTime)}</span>
        <span className="text-slate-600">/</span>
        <span className="text-slate-500">{formatSecondsToTimecode(duration)}</span>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onStepBackward}
          className="p-1.5 hover:text-white transition-colors"
          title="Previous Frame"
        >
          ⏮
        </button>
        <button
          onClick={onPlayPause}
          className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-medium transition-colors"
        >
          {isPlaying ? "Pause" : "Play"}
        </button>
        <button
          onClick={onStepForward}
          className="p-1.5 hover:text-white transition-colors"
          title="Next Frame"
        >
          ⏭
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onToggleLoop}
          className={`px-2 py-1 rounded text-xs transition-colors ${
            isLooping ? "bg-cyan-500/20 text-cyan-400" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          Loop
        </button>
      </div>
    </div>
  );
}
