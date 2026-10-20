import { Router } from "express";
import { renderController } from "../controllers/render.controller.js";
import { validateTimelineMiddleware } from "../middlewares/validateSchema.js";

export const renderRouter = Router();

renderRouter.post("/start", validateTimelineMiddleware, renderController.startRender);
renderRouter.post("/cancel/:jobId", renderController.cancelRender);
renderRouter.get("/download/:jobId", renderController.downloadRender);
