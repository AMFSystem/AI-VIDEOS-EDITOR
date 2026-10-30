import http from "node:http";
import { app } from "./app.js";
import { config } from "./config/index.js";
import { socketManager } from "./sockets/socketManager.js";
import { logger } from "./utils/logger.js";
import { detectGpuCapabilities } from "./config/gpuDetector.js";
import { cleanOldTempFiles } from "./services/storage/cacheCleaner.js";

const server = http.createServer(app);

// Initialize WebSocket Manager
socketManager.init(server);

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    logger.warn(`[Backend] Port ${config.port} already in use. Service is active or shared.`);
  } else {
    logger.error("[Backend] Server error:", err);
  }
});

server.listen(config.port, config.host, async () => {
  logger.info(`[Backend] HTTP & WebSocket Server running at http://${config.host}:${config.port}`);
  
  const gpu = await detectGpuCapabilities(config.ffmpegPath);
  logger.info(`[Backend] Detected GPU Engine: ${gpu.detectedGpuType}`);
  if (gpu.hardwareEncoders.length > 0) {
    logger.info(`[Backend] Hardware Acceleration available: ${gpu.hardwareEncoders.join(", ")}`);
  }

  // Initial temp cache cleanup and schedule periodic run every 6 hours
  try {
    await cleanOldTempFiles();
    setInterval(() => {
      cleanOldTempFiles().catch((err) => logger.error("Scheduled cache cleanup failed:", err));
    }, 6 * 60 * 60 * 1000);
  } catch (err) {
    logger.warn("Initial cache cleanup skipped:", err?.message || err);
  }
});
