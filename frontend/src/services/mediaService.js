import { apiRequest } from "./apiClient.js";

export const mediaService = {
  async getMediaMetadata(fileId) {
    return apiRequest(`/api/media/meta/${fileId}`);
  },

  async requestProxy(fileId) {
    return apiRequest("/api/media/proxy", {
      method: "POST",
      body: JSON.stringify({ id: fileId }),
    });
  },

  async uploadMediaFile(file, onProgress) {
    const url = "http://127.0.0.1:3001/api/media/upload";
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "x-filename": encodeURIComponent(file.name),
      },
      body: file,
    });
    return response.json();
  },
};
