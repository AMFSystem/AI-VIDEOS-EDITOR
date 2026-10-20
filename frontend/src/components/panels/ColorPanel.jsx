import React from "react";

export function ColorPanel({ onColorChange }) {
  return (
    <div className="p-3 bg-[#101622] text-slate-200 h-full flex flex-col gap-3 text-xs">
      <div className="font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2">
        Color Grading & Wheels
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-slate-400">Brightness</label>
        <input
          type="range"
          min="-1"
          max="1"
          step="0.05"
          defaultValue="0"
          onChange={(e) => onColorChange && onColorChange("brightness", e.target.value)}
          className="w-full accent-cyan-400"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-slate-400">Contrast</label>
        <input
          type="range"
          min="0"
          max="2"
          step="0.05"
          defaultValue="1"
          onChange={(e) => onColorChange && onColorChange("contrast", e.target.value)}
          className="w-full accent-cyan-400"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-slate-400">Saturation</label>
        <input
          type="range"
          min="0"
          max="2"
          step="0.05"
          defaultValue="1"
          onChange={(e) => onColorChange && onColorChange("saturation", e.target.value)}
          className="w-full accent-cyan-400"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-slate-400">3D LUT (.cube)</label>
        <select className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200">
          <option value="none">None</option>
          <option value="cinematic">Cinematic Teal & Orange</option>
          <option value="vintage">Vintage Film</option>
          <option value="warm">Golden Hour Warmth</option>
        </select>
      </div>
    </div>
  );
}
