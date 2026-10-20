import { apiRequest } from "./apiClient.js";

export const renderService = {
  async startNativeRender(timeline, settings) {
    return apiRequest("/api/render/start", {
      method: "POST",
      body: JSON.stringify({ timeline, settings }),
    });
  },

  async cancelNativeRender(jobId) {
    return apiRequest(`/api/render/cancel/${jobId}`, {
      method: "POST",
    });
  },
};
