import React from "react";

export function InspectorPanel({ selectedClip, onPropertyChange }) {
  if (!selectedClip) {
    return (
      <div className="p-4 text-center text-xs text-slate-500 bg-[#101622] h-full flex items-center justify-center">
        Select a clip on the timeline to inspect and edit properties.
      </div>
    );
  }

  return (
    <div className="p-3 bg-[#101622] text-slate-200 h-full flex flex-col gap-4 text-xs">
      <div className="font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2">
        Clip Inspector
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-slate-400">Scale</label>
        <input
          type="range"
          min="0.1"
          max="3"
          step="0.05"
          defaultValue="1"
          onChange={(e) => onPropertyChange && onPropertyChange("scale", e.target.value)}
          className="w-full accent-cyan-400"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-slate-400">Opacity</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          defaultValue="1"
          onChange={(e) => onPropertyChange && onPropertyChange("opacity", e.target.value)}
          className="w-full accent-cyan-400"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-slate-400">Speed</label>
        <select
          defaultValue="1"
          onChange={(e) => onPropertyChange && onPropertyChange("speed", e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200"
        >
          <option value="0.5">0.5x (Slow)</option>
          <option value="1">1.0x (Normal)</option>
          <option value="1.5">1.5x (Fast)</option>
          <option value="2">2.0x (Double)</option>
        </select>
      </div>
    </div>
  );
}
