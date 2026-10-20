import React from "react";

export function SafeAreaGuides({ visible = false }) {
  if (!visible) return null;

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      {/* 90% Action Safe */}
      <div className="w-[90%] h-[90%] border border-cyan-500/30" />
      {/* 80% Title Safe */}
      <div className="absolute w-[80%] h-[80%] border border-cyan-400/20" />
      {/* Center Crosshair */}
      <div className="absolute w-4 h-[1px] bg-cyan-400/50" />
      <div className="absolute h-4 w-[1px] bg-cyan-400/50" />
    </div>
  );
}
