import React from "react";

export function EffectsPanel({ onApplyEffect }) {
  const effects = [
    { id: "blur", name: "Gaussian Blur", icon: "💧" },
    { id: "glow", name: "Bloom & Glow", icon: "✨" },
    { id: "chroma", name: "Green Screen Key", icon: "🟩" },
    { id: "glitch", name: "Digital Glitch", icon: "⚡" },
    { id: "vignette", name: "Vignette Shadow", icon: "🌑" },
  ];

  return (
    <div className="p-3 bg-[#101622] text-slate-200 h-full flex flex-col gap-3 text-xs">
      <div className="font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2">
        Video Effects & Filters
      </div>

      <div className="grid grid-cols-2 gap-2 overflow-y-auto">
        {effects.map((ef) => (
          <div
            key={ef.id}
            onClick={() => onApplyEffect && onApplyEffect(ef.id)}
            className="p-3 bg-slate-800/60 hover:bg-slate-700/60 rounded border border-slate-700/40 cursor-pointer flex flex-col items-center gap-1.5 transition-colors text-center"
          >
            <span className="text-xl">{ef.icon}</span>
            <span className="text-[11px] font-medium">{ef.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
