export class WhisperService {
  async transcribeAudio(audioPath, options = {}) {
    // Backend Whisper transcription service placeholder/adapter
    return {
      success: true,
      audioPath,
      language: options.language || "auto",
      segments: [],
      note: "Server-side Whisper transcription service ready for local Whisper model or API bridge.",
    };
  }
}

export const whisperService = new WhisperService();
