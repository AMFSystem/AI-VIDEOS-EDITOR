import React from "react";

export function AudioMixerPanel({ onVolumeChange, onEqChange }) {
  return (
    <div className="p-3 bg-[#101622] text-slate-200 h-full flex flex-col gap-3 text-xs">
      <div className="font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2">
        Audio Mixer & DSP
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-slate-400">Master Volume (dB)</label>
        <input
          type="range"
          min="0"
          max="2"
          step="0.05"
          defaultValue="1"
          onChange={(e) => onVolumeChange && onVolumeChange(e.target.value)}
          className="w-full accent-cyan-400"
        />
      </div>

      <div className="flex items-center justify-between p-2 bg-slate-800/40 rounded border border-slate-700/50">
        <span>Noise Reduction</span>
        <button className="px-2 py-0.5 bg-cyan-600/80 hover:bg-cyan-500 text-white rounded text-[11px]">
          RNNoise
        </button>
      </div>

      <div className="flex items-center justify-between p-2 bg-slate-800/40 rounded border border-slate-700/50">
        <span>Vocal Separation</span>
        <button className="px-2 py-0.5 bg-cyan-600/80 hover:bg-cyan-500 text-white rounded text-[11px]">
          Demucs/UVR
        </button>
      </div>
    </div>
  );
}
