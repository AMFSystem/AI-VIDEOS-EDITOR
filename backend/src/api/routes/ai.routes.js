import { Router } from "express";
import { aiController } from "../controllers/ai.controller.js";

export const aiRouter = Router();

aiRouter.post("/transcribe", aiController.transcribe);
aiRouter.post("/separate-audio", aiController.separateAudio);
aiRouter.post("/remove-bg", aiController.removeBackground);
aiRouter.post("/cut-silence", aiController.cutSilence);
aiRouter.get("/comfyui-status", aiController.comfyUiStatus);
aiRouter.get("/tts-google", aiController.googleTts);
aiRouter.post("/tts-google", aiController.googleTts);
