import { useMemo } from "react";

export function formatSecondsToTimecode(seconds = 0, fps = 30) {
  const totalFrames = Math.floor(seconds * fps);
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const frames = totalFrames % fps;

  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)}:${pad(frames)}`;
}

export function useTimecodeFormat(seconds, fps = 30) {
  return useMemo(() => formatSecondsToTimecode(seconds, fps), [seconds, fps]);
}
