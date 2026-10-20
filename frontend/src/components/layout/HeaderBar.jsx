import React from "react";

export function HeaderBar({ title = "Timeline Studio", onExport, onOpenSettings }) {
  return (
    <header className="h-11 bg-[#0b0f17] border-b border-slate-800 px-4 flex items-center justify-between select-none">
      <div className="flex items-center gap-3">
        <span className="font-bold text-sm bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
          {title}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onOpenSettings}
          className="px-2.5 py-1 text-xs text-slate-400 hover:text-white transition-colors"
        >
          ⚙️ Settings
        </button>
        <button
          onClick={onExport}
          className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-medium transition-colors shadow-sm"
        >
          Export
        </button>
      </div>
    </header>
  );
}
