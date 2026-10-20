export function parseTimecodeToSeconds(timecode) {
  if (!timecode) return 0;
  const parts = timecode.split(":").map(parseFloat);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return parseFloat(timecode) || 0;
}

export function parseFfmpegProgress(stderrChunk, totalDurationSeconds) {
  const timeMatch = stderrChunk.match(/time=(\d{2}:\d{2}:\d{2}\.\d{2})/);
  if (!timeMatch || !totalDurationSeconds) return null;

  const currentSeconds = parseTimecodeToSeconds(timeMatch[1]);
  const percent = Math.min(100, Math.round((currentSeconds / totalDurationSeconds) * 100));

  const fpsMatch = stderrChunk.match(/fps=\s*([\d.]+)/);
  const speedMatch = stderrChunk.match(/speed=\s*([\d.]+)x/);

  return {
    currentTime: timeMatch[1],
    currentSeconds,
    percent,
    fps: fpsMatch ? parseFloat(fpsMatch[1]) : null,
    speed: speedMatch ? parseFloat(speedMatch[1]) : null,
  };
}
