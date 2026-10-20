import React from "react";

export function TrackSidebar({ tracks = [], onToggleMute, onToggleLock, onAddTrack }) {
  return (
    <div className="w-48 bg-[#0f141f] border-r border-slate-800 flex flex-col shrink-0">
      <div className="h-7 border-b border-slate-800 px-3 flex items-center justify-between text-xs text-slate-400">
        <span>Tracks</span>
        <button
          onClick={onAddTrack}
          className="hover:text-cyan-400 font-bold px-1"
          title="Add Track"
        >
          +
        </button>
      </div>

      <div className="flex flex-col">
        {tracks.map((track, i) => (
          <div
            key={track.id || i}
            className="h-16 border-b border-slate-800/80 px-3 flex items-center justify-between text-xs text-slate-300"
          >
            <span className="truncate font-medium">{track.name || `Track ${i + 1}`}</span>
            <div className="flex items-center gap-1.5 text-[11px]">
              <button
                onClick={() => onToggleMute && onToggleMute(track.id)}
                className={`p-1 rounded ${track.muted ? "text-red-400 font-bold" : "text-slate-500 hover:text-slate-300"}`}
              >
                M
              </button>
              <button
                onClick={() => onToggleLock && onToggleLock(track.id)}
                className={`p-1 rounded ${track.locked ? "text-amber-400 font-bold" : "text-slate-500 hover:text-slate-300"}`}
              >
                L
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
