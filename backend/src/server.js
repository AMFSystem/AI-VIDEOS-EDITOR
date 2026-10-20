import http from "node:http";
import { app } from "./app.js";
import { config } from "./config/index.js";
import { socketManager } from "./sockets/socketManager.js";
import { logger } from "./utils/logger.js";
import { detectGpuCapabilities } from "./config/gpuDetector.js";

const server = http.createServer(app);

// Initialize WebSocket Manager
socketManager.init(server);

server.listen(config.port, config.host, async () => {
  logger.info(`[Backend] HTTP & WebSocket Server running at http://${config.host}:${config.port}`);
  
  const gpu = await detectGpuCapabilities(config.ffmpegPath);
  logger.info(`[Backend] Detected GPU Engine: ${gpu.detectedGpuType}`);
  if (gpu.hardwareEncoders.length > 0) {
    logger.info(`[Backend] Hardware Acceleration available: ${gpu.hardwareEncoders.join(", ")}`);
  }
});
