import React from "react";

export function TransformGizmo({ bounds, isSelected = false, onTransformChange }) {
  if (!isSelected || !bounds) return null;

  return (
    <div
      className="absolute border-2 border-cyan-400 pointer-events-none"
      style={{
        left: `${bounds.x}px`,
        top: `${bounds.y}px`,
        width: `${bounds.width}px`,
        height: `${bounds.height}px`,
      }}
    >
      {/* Corner Handles */}
      <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border border-cyan-400 cursor-nwse-resize pointer-events-auto" />
      <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border border-cyan-400 cursor-nesw-resize pointer-events-auto" />
      <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border border-cyan-400 cursor-nesw-resize pointer-events-auto" />
      <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border border-cyan-400 cursor-nwse-resize pointer-events-auto" />
    </div>
  );
}
