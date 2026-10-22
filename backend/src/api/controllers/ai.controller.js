import { whisperService } from "../../services/ai/whisperService.js";
import { audioStemService } from "../../services/ai/audioStemService.js";
import { visionAIService } from "../../services/ai/visionAIService.js";
import { silenceCutService } from "../../services/ai/silenceCutService.js";
import { externalAIBridge } from "../../services/ai/externalAIBridge.js";
import { googleTtsService } from "../../services/ai/googleTtsService.js";
import { elevenlabsService } from "../../services/ai/elevenlabsService.js";
import {
  verifyGeminiApiKey,
  synthesizeGeminiSpeech,
  generateGeminiScript,
  analyzeGeminiVocalPersona,
} from "../../services/ai/geminiService.js";
import { config } from "../../config/index.js";
import { voxcpmService } from "../../services/ai/voxcpmService.js";
import { f5ttsService } from "../../services/ai/f5ttsService.js";
import { pyvideotransService } from "../../services/ai/pyvideotransService.js";

export const aiController = {
  async transcribe(req, res) {
    const { audioPath, language } = req.body;
    try {
      const result = await whisperService.transcribeAudio(audioPath, { language });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async separateAudio(req, res) {
    const { audioPath } = req.body;
    try {
      const result = await audioStemService.separateStems(audioPath);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async removeBackground(req, res) {
    const { videoPath } = req.body;
    try {
      const result = await visionAIService.removeBackground(videoPath);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async cutSilence(req, res) {
    const { audioPath, thresholdDb, minDurationSec } = req.body;
    try {
      const result = await silenceCutService.detectSilence(audioPath, thresholdDb, minDurationSec);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async comfyUiStatus(_req, res) {
    const status = await externalAIBridge.checkComfyUiStatus();
    res.json(status);
  },

  async googleTts(req, res) {
    const text = req.method === "POST" ? req.body.text : req.query.text;
    const lang = (req.method === "POST" ? req.body.lang : req.query.lang) || "km";
    const speed = parseFloat((req.method === "POST" ? req.body.speed : req.query.speed) || 1.0);

    if (!text || !String(text).trim()) {
      return res.status(400).json({ error: "Text is required" });
    }

    try {
      const audioBuffer = await googleTtsService.synthesize(text, { lang, speed });
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.send(audioBuffer);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async elevenLabsCloneVoice(req, res) {
    const { name, apiKey, audioBase64, mimeType = "audio/wav", description } = req.body;
    if (!apiKey) {
      return res.status(400).json({ error: "ElevenLabs API Key គឺចាំបាច់" });
    }
    if (!audioBase64) {
      return res.status(400).json({ error: "ទិន្នន័យសំឡេង (audioBase64) គឺចាំបាច់" });
    }

    try {
      // Strip data URL header if present
      const base64Clean = audioBase64.replace(/^data:[^;]+;base64,/, "");
      const audioBuffer = Buffer.from(base64Clean, "base64");
      const result = await elevenlabsService.cloneVoice({
        name,
        apiKey,
        audioBuffer,
        mimeType,
        description,
      });
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async elevenLabsTts(req, res) {
    const { text, voiceId, apiKey, modelId, voiceSettings } = req.body;
    if (!apiKey) {
      return res.status(400).json({ error: "ElevenLabs API Key គឺចាំបាច់" });
    }
    if (!voiceId) {
      return res.status(400).json({ error: "Voice ID គឺចាំបាច់" });
    }
    if (!text || !String(text).trim()) {
      return res.status(400).json({ error: "អត្ថបទត្រូវនិយាយគឺចាំបាច់" });
    }

    try {
      const audioBuffer = await elevenlabsService.synthesize({
        text,
        voiceId,
        apiKey,
        modelId,
        voiceSettings,
      });
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.send(audioBuffer);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async elevenLabsVerifyKey(req, res) {
    const { apiKey } = req.body;
    if (!apiKey) {
      return res.status(400).json({ error: "ElevenLabs API Key គឺចាំបាច់" });
    }
    try {
      const info = await elevenlabsService.verifyApiKey({ apiKey });
      res.json(info);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },

  async geminiStatus(_req, res) {
    const key = config.geminiApiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
    return res.json({
      configured: !!key,
      hasServerKey: !!key,
    });
  },

  async geminiVerifyKey(req, res) {
    const apiKey = req.body?.apiKey || config.geminiApiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ error: "Google Gemini API Key គឺចាំបាច់" });
    }
    try {
      const result = await verifyGeminiApiKey(apiKey);
      if (!result.valid) {
        return res.status(400).json({ error: result.error });
      }
      res.json({ ...result, hasServerKey: !!config.geminiApiKey });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async geminiTts(req, res) {
    const apiKey = req.body?.apiKey || config.geminiApiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    const { text, voiceName, audioBase64, referenceMimeType, vocalStyle, vocalPersona } = req.body;
    if (!apiKey) {
      return res.status(400).json({ error: "Google Gemini API Key គឺចាំបាច់" });
    }
    if (!text || !String(text).trim()) {
      return res.status(400).json({ error: "អត្ថបទត្រូវនិយាយគឺចាំបាច់" });
    }

    try {
      const { buffer, mimeType } = await synthesizeGeminiSpeech({
        apiKey,
        text,
        voiceName,
        audioBase64,
        mimeType: referenceMimeType || "audio/wav",
        vocalStyle,
        vocalPersona: vocalPersona || "",
      });
      res.setHeader("Content-Type", mimeType);
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.send(buffer);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async geminiAnalyzeVoice(req, res) {
    const apiKey = req.body?.apiKey || config.geminiApiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    const { audioBase64, mimeType = "audio/wav", language = "km" } = req.body;
    if (!apiKey) {
      return res.status(400).json({ error: "Google Gemini API Key គឺចាំបាច់" });
    }
    if (!audioBase64) {
      return res.status(400).json({ error: "ទិន្នន័យសំឡេងគឺចាំបាច់" });
    }

    try {
      const persona = await analyzeGeminiVocalPersona({
        apiKey,
        audioBase64,
        mimeType,
        language,
      });
      res.json({ success: true, persona });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async geminiGenerateScript(req, res) {
    const apiKey = req.body?.apiKey || config.geminiApiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    const { prompt, topic, tone } = req.body;
    if (!apiKey) {
      return res.status(400).json({ error: "Google Gemini API Key គឺចាំបាច់" });
    }

    try {
      const result = await generateGeminiScript({ apiKey, prompt, topic, tone });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async voxcpmStatus(_req, res) {
    try {
      const status = await voxcpmService.getStatus();
      res.json(status);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async voxcpmClone(req, res) {
    const { name, audioBase64, mimeType = "audio/wav", language = "km" } = req.body;
    if (!audioBase64) {
      return res.status(400).json({ error: "ទិន្នន័យសំឡេង (audioBase64) គឺចាំបាច់" });
    }

    try {
      const base64Clean = audioBase64.replace(/^data:[^;]+;base64,/, "");
      const audioBuffer = Buffer.from(base64Clean, "base64");
      const profile = await voxcpmService.extractProfile({
        name,
        audioBuffer,
        mimeType,
        language,
      });
      res.json({ success: true, profile });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async voxcpmLoraModels(_req, res) {
    try {
      const data = await voxcpmService.getLoraModels();
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async voxcpmLoraLoad(req, res) {
    const { modelName } = req.body;
    if (!modelName) {
      return res.status(400).json({ error: "ឈ្មោះ LoRA modelName គឺចាំបាច់" });
    }
    try {
      const data = await voxcpmService.loadLora(modelName);
      res.json({ success: true, ...data });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async voxcpmTrainPrompts(_req, res) {
    try {
      const data = await voxcpmService.getTrainingPrompts();
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async voxcpmTrainStart(req, res) {
    const { modelName, samples, steps = 300, learningRate = 0.0001 } = req.body;
    if (!modelName || !samples || samples.length === 0) {
      return res.status(400).json({ error: "modelName និង samples គឺចាំបាច់" });
    }
    try {
      const data = await voxcpmService.startTraining({
        modelName,
        samples,
        steps,
        learningRate,
      });
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async voxcpmTrainStatus(_req, res) {
    try {
      const data = await voxcpmService.getTrainingStatus();
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async voxcpmTrainStop(_req, res) {
    try {
      const data = await voxcpmService.stopTraining();
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },


  async voxcpmTts(req, res) {
    const { text, profile, speed = 1.0, language = "km", loraModel = "" } = req.body;
    if (!text || !String(text).trim()) {
      return res.status(400).json({ error: "អត្ថបទត្រូវនិយាយគឺចាំបាច់" });
    }

    try {
      const { buffer, mimeType } = await voxcpmService.synthesizeSpeech({
        text,
        profile,
        speed: parseFloat(speed) || 1.0,
        language,
        loraModel: loraModel || profile?.loraModel,
      });
      res.setHeader("Content-Type", mimeType);
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.send(buffer);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // F5-TTS Flow Matching Diffusion Voice Cloner & TTS
  // ─────────────────────────────────────────────────────────────────────────────
  async f5ttsStatus(_req, res) {
    try {
      const status = await f5ttsService.checkServerStatus();
      res.json(status);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async f5ttsClone(req, res) {
    const { name, audioBase64, mimeType = "audio/wav", refText = "", language = "km" } = req.body;
    if (!audioBase64) {
      return res.status(400).json({ error: "ទិន្នន័យសំឡេង (audioBase64) គឺចាំបាច់" });
    }

    try {
      const base64Clean = audioBase64.replace(/^data:[^;]+;base64,/, "");
      const audioBuffer = Buffer.from(base64Clean, "base64");
      const profile = await f5ttsService.extractProfile({
        name,
        audioBuffer,
        mimeType,
        refText,
        language,
      });
      res.json({ success: true, profile });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async f5ttsTts(req, res) {
    const { text, profile, speed = 1.0, language = "km", nfeStep = 32, cfgStrength = 2.0 } = req.body;
    if (!text || !String(text).trim()) {
      return res.status(400).json({ error: "អត្ថបទត្រូវនិយាយគឺចាំបាច់" });
    }

    try {
      const { buffer, mimeType } = await f5ttsService.synthesizeSpeech({
        text,
        profile,
        speed: parseFloat(speed) || 1.0,
        language,
        nfeStep: parseInt(nfeStep, 10) || 32,
        cfgStrength: parseFloat(cfgStrength) || 2.0,
      });
      res.setHeader("Content-Type", mimeType);
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.send(buffer);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // PyVideoTrans Video Translation, Alignment & Dubber Pipeline
  // ─────────────────────────────────────────────────────────────────────────────
  async pyvideotransStatus(_req, res) {
    try {
      const status = await pyvideotransService.checkStatus();
      res.json(status);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async pyvideotransAlignDub(req, res) {
    const { segments, preserveBgm = true, bgmVolume = 0.25, voiceVolume = 1.0 } = req.body;
    if (!segments || segments.length === 0) {
      return res.status(400).json({ error: "បញ្ជី segments គឺចាំបាច់" });
    }

    try {
      const { buffer, mimeType } = await pyvideotransService.alignAndMixDubbing({
        segments,
        preserveBgm,
        bgmVolume,
        voiceVolume,
      });
      res.setHeader("Content-Type", mimeType);
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.send(buffer);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async pyvideotransSetupRepo(_req, res) {
    try {
      const result = await pyvideotransService.setupRepo();
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
};
