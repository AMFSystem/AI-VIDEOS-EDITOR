import { Router } from "express";
import { dubberController } from "../controllers/dubber.controller.js";

export const dubberRouter = Router();

dubberRouter.post("/translate", dubberController.translateStory);
dubberRouter.post("/transcribe-translate", dubberController.transcribeAndTranslate);
dubberRouter.post("/synthesize", dubberController.synthesizeDubbing);
