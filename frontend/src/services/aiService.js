import { apiRequest } from "./apiClient.js";

export const aiService = {
  async transcribeAudio(audioPath, language) {
    return apiRequest("/api/ai/transcribe", {
      method: "POST",
      body: JSON.stringify({ audioPath, language }),
    });
  },

  async separateAudioStems(audioPath) {
    return apiRequest("/api/ai/separate-audio", {
      method: "POST",
      body: JSON.stringify({ audioPath }),
    });
  },

  async removeBackground(videoPath) {
    return apiRequest("/api/ai/remove-bg", {
      method: "POST",
      body: JSON.stringify({ videoPath }),
    });
  },

  async checkComfyUi() {
    return apiRequest("/api/ai/comfyui-status");
  },
};
