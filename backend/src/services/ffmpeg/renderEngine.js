import { spawn } from "node:child_process";
import { config } from "../../config/index.js";
import { detectGpuCapabilities } from "../../config/gpuDetector.js";
import { parseFfmpegProgress } from "../../utils/timeParser.js";
import { killProcessSafely } from "../../utils/processKiller.js";

export class RenderEngine {
  constructor() {
    this.activeJobs = new Map();
  }

  async renderTimeline(jobId, args, totalDuration, onProgress) {
    const gpu = await detectGpuCapabilities(config.ffmpegPath);
    return new Promise((resolve, reject) => {
      const proc = spawn(config.ffmpegPath, args);
      this.activeJobs.set(jobId, proc);

      proc.stderr.on("data", (chunk) => {
        const text = chunk.toString();
        if (onProgress) {
          const prog = parseFfmpegProgress(text, totalDuration);
          if (prog) onProgress(prog);
        }
      });

      proc.on("close", (code) => {
        this.activeJobs.delete(jobId);
        if (code === 0) resolve({ success: true });
        else reject(new Error(`Render process exited with code ${code}`));
      });

      proc.on("error", (err) => {
        this.activeJobs.delete(jobId);
        reject(err);
      });
    });
  }

  cancelRender(jobId) {
    const proc = this.activeJobs.get(jobId);
    if (proc) {
      killProcessSafely(proc);
      this.activeJobs.delete(jobId);
      return true;
    }
    return false;
  }
}

export const renderEngine = new RenderEngine();
