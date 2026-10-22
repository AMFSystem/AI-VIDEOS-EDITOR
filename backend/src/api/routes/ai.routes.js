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
aiRouter.get("/gemini/status", aiController.geminiStatus);
aiRouter.post("/gemini/verify", aiController.geminiVerifyKey);
aiRouter.post("/gemini/tts", aiController.geminiTts);
aiRouter.post("/gemini/analyze-voice", aiController.geminiAnalyzeVoice);
aiRouter.post("/gemini/generate-script", aiController.geminiGenerateScript);

// VoxCPM2 OpenBMB 48kHz Neural Diffusion Cloner & TTS
aiRouter.get("/voxcpm/status", aiController.voxcpmStatus);
aiRouter.post("/voxcpm/clone", aiController.voxcpmClone);
aiRouter.post("/voxcpm/tts", aiController.voxcpmTts);
aiRouter.get("/voxcpm/lora/models", aiController.voxcpmLoraModels);
aiRouter.post("/voxcpm/lora/load", aiController.voxcpmLoraLoad);
aiRouter.get("/voxcpm/train/prompts", aiController.voxcpmTrainPrompts);
aiRouter.post("/voxcpm/train/start", aiController.voxcpmTrainStart);
aiRouter.get("/voxcpm/train/status", aiController.voxcpmTrainStatus);
aiRouter.post("/voxcpm/train/stop", aiController.voxcpmTrainStop);

// F5-TTS Flow Matching Diffusion Voice Cloner & TTS
aiRouter.get("/f5tts/status", aiController.f5ttsStatus);
aiRouter.post("/f5tts/clone", aiController.f5ttsClone);
aiRouter.post("/f5tts/tts", aiController.f5ttsTts);

// PyVideoTrans Video Translation, Alignment & Dubber Pipeline
aiRouter.get("/pyvideotrans/status", aiController.pyvideotransStatus);
aiRouter.post("/pyvideotrans/align-dub", aiController.pyvideotransAlignDub);
aiRouter.post("/pyvideotrans/setup-repo", aiController.pyvideotransSetupRepo);


