import { Router } from "express";
import { downloaderController } from "../controllers/downloader.controller.js";

export const downloaderRouter = Router();

downloaderRouter.get("/status", downloaderController.getStatus);
downloaderRouter.get("/proxy-image", downloaderController.proxyImage);
downloaderRouter.post("/info", downloaderController.getInfo);
downloaderRouter.post("/download", downloaderController.startDownload);
