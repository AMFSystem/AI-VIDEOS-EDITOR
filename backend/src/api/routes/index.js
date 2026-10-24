import { Router } from "express";
import { projectRouter } from "./project.routes.js";
import { mediaRouter } from "./media.routes.js";
import { renderRouter } from "./render.routes.js";
import { aiRouter } from "./ai.routes.js";
import { downloaderRouter } from "./downloader.routes.js";
import { detectGpuCapabilities } from "../../config/gpuDetector.js";
import { config } from "../../config/index.js";

export const apiRouter = Router();

// Health check
apiRouter.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "AI Video Editor Backend API",
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// System & GPU capabilities
apiRouter.get("/system/gpu", async (_req, res) => {
  const gpu = await detectGpuCapabilities(config.ffmpegPath);
  res.json(gpu);
});

apiRouter.use("/projects", projectRouter);
apiRouter.use("/media", mediaRouter);
apiRouter.use("/render", renderRouter);
apiRouter.use("/ai", aiRouter);
apiRouter.use("/downloader", downloaderRouter);

