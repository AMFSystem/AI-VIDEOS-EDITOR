import { renderEngine } from "../services/ffmpeg/renderEngine.js";

export async function processRenderJob(jobData, onProgress) {
  const { jobId, args, duration } = jobData;
  return renderEngine.renderTimeline(jobId, args, duration, onProgress);
}
