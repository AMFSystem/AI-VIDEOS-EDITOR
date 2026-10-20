import path from "node:path";
import { renderEngine } from "../../services/ffmpeg/renderEngine.js";
import { socketManager } from "../../sockets/socketManager.js";
import { fileManager } from "../../services/storage/fileManager.js";

export const renderController = {
  async startRender(req, res) {
    const { timeline, settings } = req.body;
    const jobId = `render_${Date.now()}`;
    const outputFilename = `export_${jobId}.mp4`;
    const outputPath = fileManager.getFilePath("exports", outputFilename);

    // Simple default render args or build from timeline
    const args = ["-y", "-f", "lavfi", "-i", "color=c=black:s=1920x1080:d=5", "-c:v", "libx264", outputPath];

    res.json({ success: true, jobId, outputFilename });

    renderEngine
      .renderTimeline(jobId, args, 5, (prog) => {
        socketManager.broadcast("render:progress", { jobId, ...prog });
      })
      .then(() => {
        socketManager.broadcast("render:complete", { jobId, outputPath });
      })
      .catch((err) => {
        socketManager.broadcast("render:error", { jobId, error: err.message });
      });
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
