import path from "node:path";
import { fileManager } from "../../services/storage/fileManager.js";
import { handleRangeStream } from "../../services/storage/streamService.js";
import { probeMedia } from "../../services/ffmpeg/ffprobeService.js";
import { generateProxyVideo } from "../../services/ffmpeg/proxyGenerator.js";

export const mediaController = {
  uploadMedia(req, res) {
    if (!req.uploadedFile) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    res.json({ success: true, file: req.uploadedFile });
  },

  streamMedia(req, res) {
    const { id } = req.params;
    const filePath = fileManager.getFilePath("uploads", id);
    handleRangeStream(req, res, filePath);
  },

  async getMetadata(req, res) {
    const { id } = req.params;
    const filePath = fileManager.getFilePath("uploads", id);
    try {
      const meta = await probeMedia(filePath);
      res.json({ success: true, metadata: meta });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async createProxy(req, res) {
    const { id } = req.body;
    const inputPath = fileManager.getFilePath("uploads", id);
    const outputPath = fileManager.getFilePath("proxies", `proxy_${id}`);

    try {
      const meta = await probeMedia(inputPath);
      await generateProxyVideo(inputPath, outputPath, meta.duration);
      res.json({ success: true, proxyPath: outputPath });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
};
