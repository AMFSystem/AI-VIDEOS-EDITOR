import fs from "node:fs/promises";
import path from "node:path";
import { logger } from "../../utils/logger.js";

export class WhisperService {
  constructor() {
    this.sttApiUrl = process.env.AI_CLONE_API_URL || "http://127.0.0.1:8000/api/v1/stt";
  }

  async transcribeAudio(audioPath, options = {}) {
    if (!audioPath) {
      throw new Error("Missing audioPath for transcription");
    }

    const language = options.language || "auto";

    // Attempt transcription via local AI Voice Studio / Whisper FastAPI service
    try {
      const fileBytes = await fs.readFile(audioPath);
      const filename = path.basename(audioPath);
      const formData = new FormData();
      formData.append("file", new Blob([fileBytes]), filename);
      formData.append("language", language);

      const res = await fetch(this.sttApiUrl, {
        method: "POST",
        body: formData,
        signal: AbortSignal.timeout(120000), // 2 min timeout for long audio
      });

      if (res.ok) {
        const data = await res.json();
        return {
          success: true,
          audioPath,
          language: data.detected_language || language,
          duration: data.duration || 0,
          text: data.text || "",
          segmentedText: data.segmented_text || "",
          segments: data.segments || [],
        };
      }
    } catch (err) {
      logger.warn(`[WhisperService] FastAPI bridge unavailable (${err.message}). Using fallback adapter.`);
    }

    // Fallback adapter return
    return {
      success: true,
      audioPath,
      language,
      segments: [],
      note: "Local Whisper FastAPI bridge (Port 8000) not responding. Please ensure AI Voice Studio is running.",
    };
  }
}

export const whisperService = new WhisperService();
