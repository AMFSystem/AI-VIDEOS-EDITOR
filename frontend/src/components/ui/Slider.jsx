import React from "react";

export function Slider({ label, value, min = 0, max = 100, step = 1, onChange, unit = "" }) {
  return (
    <div className="flex flex-col gap-1 text-xs">
      <div className="flex justify-between text-slate-400">
        <span>{label}</span>
        <span className="font-mono text-cyan-400">
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange && onChange(parseFloat(e.target.value))}
        className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
      />
    </div>
  );
}
