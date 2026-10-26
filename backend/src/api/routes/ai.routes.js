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

// PyVideoTrans Video Translation, Alignment & Dubber Pipeline
aiRouter.get("/pyvideotrans/status", aiController.pyvideotransStatus);
aiRouter.get("/pyvideotrans/config", aiController.pyvideotransGetConfig);
aiRouter.post("/pyvideotrans/config", aiController.pyvideotransSaveConfig);
aiRouter.post("/pyvideotrans/process", aiController.pyvideotransProcess);
aiRouter.post("/pyvideotrans/align-dub", aiController.pyvideotransAlignDub);
aiRouter.post("/pyvideotrans/separate-bgm", aiController.pyvideotransSeparateBgm);
aiRouter.post("/pyvideotrans/setup-repo", aiController.pyvideotransSetupRepo);
aiRouter.post("/edge-tts", aiController.edgeTts);
aiRouter.post("/translate", aiController.translateText);

// Local AI Model Hub & Manager
aiRouter.get("/models", aiController.getModelsStatus);
aiRouter.post("/models/download/:id", aiController.downloadModel);
aiRouter.get("/models/progress/:id", aiController.streamModelProgress);
aiRouter.delete("/models/:id", aiController.deleteModel);

// Deep Voice Training Pipeline
aiRouter.post("/training/prepare", aiController.prepareVoiceTraining);
aiRouter.post("/training/start", aiController.startVoiceTraining);
aiRouter.get("/training/status/:id", aiController.getVoiceTrainingStatus);
aiRouter.get("/training/models", aiController.listTrainedVoiceModels);



