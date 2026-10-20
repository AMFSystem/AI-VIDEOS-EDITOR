import React from "react";

export function SnapLine({ visible = false, positionX = 0 }) {
  if (!visible) return null;

  return (
    <div
      className="absolute top-0 bottom-0 w-[1px] bg-cyan-400 z-40 pointer-events-none shadow-[0_0_8px_rgba(34,211,238,0.8)]"
      style={{ left: `${positionX}px` }}
    />
  );
}
