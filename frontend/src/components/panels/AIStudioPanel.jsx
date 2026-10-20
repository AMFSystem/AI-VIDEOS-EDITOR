import React from "react";

export function AIStudioPanel({ onTriggerAction }) {
  const tools = [
    { id: "bg-remove", name: "AI Background Removal", desc: "MODNet / SlimSAM Matting", icon: "✂️" },
    { id: "voiceover", name: "AI Multilingual Voiceover", desc: "Kokoro & Piper TTS", icon: "🎙️" },
    { id: "avatar", name: "Talking Digital Avatar", desc: "LivePortrait & JoyVASA", icon: "👤" },
    { id: "repair", name: "AI Watermark Repair", desc: "MI-GAN 256 inpainting", icon: "🩹" },
    { id: "upscale", name: "4x AI Restoration", desc: "NanoVSR 644K Video Upscale", icon: "💎" },
  ];

  return (
    <div className="p-3 bg-[#101622] text-slate-200 h-full flex flex-col gap-3 text-xs">
      <div className="font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2">
        AI Studio & Generators
      </div>

      <div className="flex flex-col gap-2 overflow-y-auto">
        {tools.map((t) => (
          <div
            key={t.id}
            onClick={() => onTriggerAction && onTriggerAction(t.id)}
            className="p-2.5 bg-slate-800/50 hover:bg-slate-700/60 rounded border border-slate-700/40 cursor-pointer flex items-center gap-3 transition-colors"
          >
            <span className="text-xl">{t.icon}</span>
            <div className="flex flex-col">
              <span className="font-medium text-slate-200">{t.name}</span>
              <span className="text-[10px] text-slate-400">{t.desc}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
