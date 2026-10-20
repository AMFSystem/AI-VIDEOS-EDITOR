export function buildFilterComplex(timelineData) {
  // Simple, robust builder that takes timeline track clips and translates to FFmpeg filter_complex
  const clips = timelineData.clips || [];
  if (clips.length === 0) {
    return { inputs: [], filterComplex: "" };
  }

  const inputs = [];
  const filters = [];

  clips.forEach((clip, index) => {
    inputs.push("-i", clip.filePath);
    // Apply trimming and offsets if provided
    if (clip.startSec !== undefined && clip.durationSec !== undefined) {
      filters.push(`[${index}:v]trim=start=${clip.startSec}:duration=${clip.durationSec},setpts=PTS-STARTPTS[v${index}]`);
      filters.push(`[${index}:a]atrim=start=${clip.startSec}:duration=${clip.durationSec},asetpts=PTS-STARTPTS[a${index}]`);
    } else {
      filters.push(`[${index}:v]null[v${index}]`);
      filters.push(`[${index}:a]anull[a${index}]`);
    }
  });

  return {
    inputs,
    filterComplex: filters.join(";"),
  };
}
