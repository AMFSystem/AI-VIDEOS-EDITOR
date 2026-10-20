import React from "react";

export function VideoViewport({ canvasRef, width = 1280, height = 720, children }) {
  return (
    <div className="relative flex items-center justify-center w-full h-full bg-black overflow-hidden select-none">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="max-w-full max-h-full object-contain shadow-2xl"
      />
      {children}
    </div>
  );
}
