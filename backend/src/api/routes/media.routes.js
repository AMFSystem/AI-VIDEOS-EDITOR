import { Router } from "express";
import { mediaController } from "../controllers/media.controller.js";
import { handleRawStreamUpload } from "../middlewares/uploadMiddleware.js";

export const mediaRouter = Router();

mediaRouter.post("/upload", handleRawStreamUpload, mediaController.uploadMedia);
mediaRouter.get("/stream/:id", mediaController.streamMedia);
mediaRouter.get("/meta/:id", mediaController.getMetadata);
mediaRouter.post("/proxy", mediaController.createProxy);
