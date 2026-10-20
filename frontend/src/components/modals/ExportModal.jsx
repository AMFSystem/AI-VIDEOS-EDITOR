import React, { useState } from "react";

export function ExportModal({ isOpen = false, onClose, onStartExport }) {
  const [resolution, setResolution] = useState("1080p");
  const [fps, setFps] = useState("30");
  const [codec, setCodec] = useState("h264");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <div className="bg-[#121824] border border-slate-700 rounded-xl p-5 w-full max-w-md shadow-2xl text-slate-200 flex flex-col gap-4 text-xs">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <span className="text-sm font-semibold text-white">Export Video</span>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-slate-400">Resolution</label>
          <select
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded p-2 text-white"
          >
            <option value="720p">720p (HD)</option>
            <option value="1080p">1080p (Full HD)</option>
            <option value="4k">4K (Ultra HD)</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-slate-400">Frame Rate</label>
          <select
            value={fps}
            onChange={(e) => setFps(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded p-2 text-white"
          >
            <option value="24">24 FPS (Cinematic)</option>
            <option value="30">30 FPS (Standard)</option>
            <option value="60">60 FPS (Smooth)</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-slate-400">Codec</label>
          <select
            value={codec}
            onChange={(e) => setCodec(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded p-2 text-white"
          >
            <option value="h264">H.264 / MP4 (High Compatibility)</option>
            <option value="hevc">HEVC / H.265 (High Efficiency)</option>
            <option value="prores">Apple ProRes (Editing Master)</option>
          </select>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <button onClick={onClose} className="px-4 py-2 rounded text-slate-400 hover:text-white">
            Cancel
          </button>
          <button
            onClick={() => onStartExport && onStartExport({ resolution, fps, codec })}
            className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-medium shadow-md"
          >
            Render & Export
          </button>
        </div>
      </div>
    </div>
  );
}
