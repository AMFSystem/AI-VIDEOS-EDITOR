import { downloaderService } from "../../services/downloader/downloaderService.js";
import { socketManager } from "../../sockets/socketManager.js";
import { logger } from "../../utils/logger.js";

export const downloaderController = {
  async getStatus(_req, res) {
    const status = await downloaderService.checkAvailability();
    res.json(status);
  },

  async proxyImage(req, res) {
    let imageUrl = req.query.url;
    if (!imageUrl) {
      return res.status(400).send("URL parameter is required");
    }
    // Unwrap nested serveproxy if present
    if (imageUrl.includes("serveproxy.com/?url=")) {
      imageUrl = decodeURIComponent(imageUrl.split("serveproxy.com/?url=")[1]);
    }
    try {
      const upstreamRes = await fetch(imageUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        },
      });
      if (!upstreamRes.ok) {
        return res.status(upstreamRes.status).send("Upstream image error");
      }
      const contentType = upstreamRes.headers.get("content-type") || "image/jpeg";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");
      const arrayBuffer = await upstreamRes.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (err) {
      logger.warn(`Failed to proxy image: ${err.message}`);
      res.status(500).send("Proxy error");
    }
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
