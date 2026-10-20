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

// ElevenLabs Professional Voice Cloning & TTS
aiRouter.post("/elevenlabs/clone-voice", aiController.elevenLabsCloneVoice);
aiRouter.post("/elevenlabs/tts", aiController.elevenLabsTts);
aiRouter.post("/elevenlabs/verify", aiController.elevenLabsVerifyKey);

// Google Gemini 2.0 Flash Audio & Scriptwriting
aiRouter.post("/gemini/verify", aiController.geminiVerifyKey);
aiRouter.post("/gemini/tts", aiController.geminiTts);
aiRouter.post("/gemini/generate-script", aiController.geminiGenerateScript);

// VoxCPM2 OpenBMB 48kHz Neural Diffusion Cloner & TTS
aiRouter.get("/voxcpm/status", aiController.voxcpmStatus);
aiRouter.post("/voxcpm/clone", aiController.voxcpmClone);
aiRouter.post("/voxcpm/tts", aiController.voxcpmTts);
