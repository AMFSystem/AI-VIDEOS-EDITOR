import { downloaderService } from "../../services/downloader/downloaderService.js";
import { socketManager } from "../../sockets/socketManager.js";
import { logger } from "../../utils/logger.js";

export const downloaderController = {
  async getStatus(_req, res) {
    const status = await downloaderService.checkAvailability();
    res.json(status);
  },

  async getInfo(req, res) {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    try {
      const info = await downloaderService.getMediaInfo(url);
      res.json({ success: true, ...info });
    } catch (err) {
      logger.error("Failed to get media info:", err);
      res.status(500).json({ error: err.message });
    }
  },

  async startDownload(req, res) {
    const { url, format, isAudioOnly } = req.body;
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    const downloadId = `dl_${Date.now()}`;
    logger.info(`Starting download for: ${url} (ID: ${downloadId})`);

    try {
      // Stream download progress via WebSocket
      const result = await downloaderService.downloadMedia(
        url,
        { format, isAudioOnly },
        (progress) => {
          socketManager.broadcast("downloader:progress", { downloadId, ...progress });
        }
      );

      socketManager.broadcast("downloader:complete", { downloadId, ...result });
      res.json({ success: true, downloadId, file: result });
    } catch (err) {
      logger.error("Download failed:", err);
      socketManager.broadcast("downloader:error", { downloadId, error: err.message });
      res.status(500).json({ error: err.message });
    }
  },
};
