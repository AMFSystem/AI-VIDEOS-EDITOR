import { whisperService } from "../../services/ai/whisperService.js";
import { audioStemService } from "../../services/ai/audioStemService.js";
import { visionAIService } from "../../services/ai/visionAIService.js";
import { silenceCutService } from "../../services/ai/silenceCutService.js";
import { externalAIBridge } from "../../services/ai/externalAIBridge.js";

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
};
