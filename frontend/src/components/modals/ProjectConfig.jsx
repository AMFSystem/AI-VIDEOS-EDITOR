import React, { useState } from "react";

export function ProjectConfig({ isOpen = false, onClose, onSaveConfig }) {
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [fps, setFps] = useState("30");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <div className="bg-[#121824] border border-slate-700 rounded-xl p-5 w-full max-w-sm shadow-2xl text-slate-200 flex flex-col gap-4 text-xs">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <span className="text-sm font-semibold text-white">Project Settings</span>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-slate-400">Aspect Ratio</label>
          <select
            value={aspectRatio}
            onChange={(e) => setAspectRatio(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded p-2 text-white"
          >
            <option value="16:9">16:9 (Landscape / YouTube)</option>
            <option value="9:16">9:16 (Portrait / TikTok & Reels)</option>
            <option value="1:1">1:1 (Square / Instagram)</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-slate-400">Base FPS</label>
          <select
            value={fps}
            onChange={(e) => setFps(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded p-2 text-white"
          >
            <option value="24">24 FPS</option>
            <option value="30">30 FPS</option>
            <option value="60">60 FPS</option>
          </select>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <button onClick={onClose} className="px-4 py-2 rounded text-slate-400 hover:text-white">
            Cancel
          </button>
          <button
            onClick={() => onSaveConfig && onSaveConfig({ aspectRatio, fps })}
            className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-medium shadow-md"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
