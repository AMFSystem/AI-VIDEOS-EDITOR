import React from "react";

export function MediaBinPanel({ mediaList = [], onUpload, onSelectMedia, onOpenUrlDownloader }) {
  return (
    <div className="flex flex-col h-full bg-[#101622] text-slate-200">
      <div className="p-3 border-b border-slate-800 flex items-center justify-between">
        <span className="font-semibold text-xs tracking-wider uppercase text-slate-400">Media Bin</span>
        <div className="flex items-center gap-2">
          {onOpenUrlDownloader && (
            <button
              type="button"
              onClick={onOpenUrlDownloader}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 rounded text-xs font-medium cursor-pointer transition-colors flex items-center gap-1"
            >
              <span>📥</span> URL
            </button>
          )}
          <label className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-medium cursor-pointer transition-colors">
            Upload
            <input type="file" multiple onChange={onUpload} className="hidden" accept="video/*,audio/*,image/*" />
          </label>
        </div>
      </div>

      <div className="p-3 grid grid-cols-2 gap-2 overflow-y-auto flex-1">
        {mediaList.length === 0 ? (
          <div className="col-span-2 py-8 text-center text-xs text-slate-500">
            No media imported yet.<br />Click Upload to add videos or audio.
          </div>
        ) : (
          mediaList.map((m, i) => (
            <div
              key={m.id || i}
              onClick={() => onSelectMedia && onSelectMedia(m)}
              className="p-2 bg-slate-800/60 hover:bg-slate-700/60 rounded border border-slate-700/50 cursor-pointer text-xs truncate"
            >
              {m.name || `Media ${i + 1}`}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
