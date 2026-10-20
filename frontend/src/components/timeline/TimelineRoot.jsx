import React from "react";

export function TimelineRoot({ children, onScroll, className = "" }) {
  return (
    <div
      onScroll={onScroll}
      className={`relative w-full h-full overflow-x-auto overflow-y-auto select-none bg-[#0d121c] ${className}`}
    >
      {children}
    </div>
  );
}
