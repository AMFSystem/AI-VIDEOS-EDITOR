import React from "react";

export function StatusBar({ fps = 60, status = "Ready", backendOnline = false }) {
  return (
    <footer className="h-6 bg-[#090d14] border-t border-slate-800/80 px-3 flex items-center justify-between text-[11px] text-slate-500 font-mono select-none">
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${backendOnline ? "bg-emerald-500" : "bg-slate-600"}`} />
          {backendOnline ? "Backend Connected (Port 3001)" : "Browser Mode"}
        </span>
        <span>Status: {status}</span>
      </div>

      <div className="flex items-center gap-3">
        <span>Render Engine: WebGPU / VideoToolbox</span>
        <span>{fps} FPS</span>
      </div>
    </footer>
  );
}
