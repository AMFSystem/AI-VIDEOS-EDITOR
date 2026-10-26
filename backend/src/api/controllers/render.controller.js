import path from "node:path";
import { renderEngine } from "../../services/ffmpeg/renderEngine.js";
import { buildFilterComplex } from "../../services/ffmpeg/filterGraphBuilder.js";
import { socketManager } from "../../sockets/socketManager.js";
import { fileManager } from "../../services/storage/fileManager.js";
import { jobQueue } from "../../jobs/jobQueue.js";
import { processRenderJob } from "../../jobs/renderWorker.js";

export const renderController = {
  async startRender(req, res) {
    const { timeline, settings } = req.body;
    const jobId = `render_${Date.now()}`;
    const outputFilename = `export_${jobId}.mp4`;
    const outputPath = fileManager.getFilePath("exports", outputFilename);

    let args = [];
    let duration = Number(settings?.duration) || 5;

    // Build FFmpeg arguments from timeline clips if provided
    if (timeline && Array.isArray(timeline.clips) && timeline.clips.length > 0) {
      const { inputs, filterComplex } = buildFilterComplex(timeline);
      args = ["-y", ...inputs];
      if (filterComplex) {
        args.push("-filter_complex", filterComplex);
      }
      args.push("-c:v", settings?.videoCodec || "libx264", outputPath);
    } else {
      // Default fallback test pattern
      args = ["-y", "-f", "lavfi", "-i", `color=c=black:s=1920x1080:d=${duration}`, "-c:v", "libx264", outputPath];
    }

    res.json({ success: true, jobId, outputFilename });

    // Enqueue job via JobQueue
    jobQueue.addJob(jobId, () => {
      return processRenderJob(
        { jobId, args, duration },
        (prog) => {
          socketManager.broadcast("render:progress", { jobId, ...prog });
        }
      )
        .then(() => {
          socketManager.broadcast("render:complete", { jobId, outputPath, outputFilename });
        })
        .catch((err) => {
          socketManager.broadcast("render:error", { jobId, error: err.message });
          throw err;
        });
    });
  },

  getQueueStatus(_req, res) {
    res.json({ success: true, queue: jobQueue.getStatus() });
  },

  cancelRender(req, res) {
    const { jobId } = req.params;
    const canceled = renderEngine.cancelRender(jobId);
    res.json({ success: canceled, jobId });
  },

  downloadRender(req, res) {
    const { jobId } = req.params;
    const filePath = fileManager.getFilePath("exports", `export_${jobId}.mp4`);
    res.download(filePath);
  },
};
