import {
  translateStoryScript,
  transcribeAndTranslateVideoAudio,
  synthesizeDubbingSpeech,
} from "../../services/ai/dubberService.js";

export const dubberController = {
  /**
   * Transcribe video audio directly and translate to Khmer
   * POST /api/dubber/transcribe-translate
   */
  async transcribeAndTranslate(req, res) {
    try {
      const { audioBase64, mimeType, sourceLang, targetLang, style, apiKey, model } = req.body || {};
      const gemKey = apiKey || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

      const result = await transcribeAndTranslateVideoAudio({
        audioBase64,
        mimeType: mimeType || "audio/mp3",
        sourceLang: sourceLang || "auto",
        targetLang: targetLang || "km",
        style: style || "cinematic_story",
        apiKey: gemKey,
        model: model || "gemini-2.0-flash",
      });

      res.json({
        success: true,
        ...result,
      });
    } catch (err) {
      console.error("Dubber transcribe-translate error:", err);
      res.status(400).json({
        success: false,
        error: err.message,
      });
    }
  },
  /**
   * Translate story/dialogue to Khmer narration
   * POST /api/dubber/translate
   */
  async translateStory(req, res) {
    try {
      const { text, sourceLang, targetLang, style, apiKey, model } = req.body || {};
      const gemKey = apiKey || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

      const result = await translateStoryScript({
        text,
        sourceLang: sourceLang || "auto",
        targetLang: targetLang || "km",
        style: style || "cinematic_story",
        apiKey: gemKey,
        model: model || "gemini-2.0-flash",
      });

      res.json({
        success: true,
        ...result,
      });
    } catch (err) {
      console.error("Dubber translation error:", err);
      res.status(400).json({
        success: false,
        error: err.message,
      });
    }
  },

  /**
   * Synthesize dubbed audio with cloned voice
   * POST /api/dubber/synthesize
   */
  async synthesizeDubbing(req, res) {
    try {
      const { text, profile, speed, geminiKey, elevenLabsKey } = req.body || {};
      const gemKey = geminiKey || process.env.GEMINI_API_KEY;
      const elKey = elevenLabsKey || process.env.ELEVENLABS_API_KEY;

      const { audioBuffer, mimeType } = await synthesizeDubbingSpeech({
        text,
        profile,
        speed: speed || 1.0,
        geminiKey: gemKey,
        elevenLabsKey: elKey,
      });

      res.setHeader("Content-Type", mimeType);
      res.setHeader("Content-Length", audioBuffer.length);
      res.send(audioBuffer);
    } catch (err) {
      console.error("Dubber speech synthesis error:", err);
      res.status(400).json({
        success: false,
        error: err.message,
      });
    }
  },
};
