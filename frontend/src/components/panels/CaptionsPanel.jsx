import React from "react";

export function CaptionsPanel({ onGenerateCaptions }) {
  return (
    <div className="p-3 bg-[#101622] text-slate-200 h-full flex flex-col gap-3 text-xs">
      <div className="font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2 flex items-center justify-between">
        <span>Automatic Captions</span>
        <span className="text-[10px] bg-cyan-950 text-cyan-400 border border-cyan-800 px-1.5 py-0.5 rounded">
          Whisper AI
        </span>
      </div>

      <p className="text-slate-400 text-[11px] leading-relaxed">
        Generate word-accurate multilingual subtitles directly using browser Whisper or local backend.
      </p>

      <button
        onClick={onGenerateCaptions}
        className="w-full py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium rounded text-xs transition-all shadow-md"
      >
        Auto-Generate Captions
      </button>
    </div>
  );
}
