import { apiRequest, BACKEND_URL } from "./apiClient.js";

export const downloaderService = {
  async getStatus() {
    return apiRequest("/api/downloader/status");
  },

  async fetchMediaInfo(url) {
    return apiRequest("/api/downloader/info", {
      method: "POST",
      body: JSON.stringify({ url }),
    });
  },

  getImageProxyUrl(rawUrl) {
    if (!rawUrl) return "";
    let clean = String(rawUrl).trim();
    if (clean.includes("serveproxy.com/?url=")) {
      clean = decodeURIComponent(clean.split("serveproxy.com/?url=")[1]);
    }
    if (clean.startsWith("data:") || clean.startsWith("blob:")) return clean;
    const base = typeof window !== "undefined" && window.desktopAPI?.getBackendUrl
      ? window.desktopAPI.getBackendUrl()
      : "";
    return `${base}/api/downloader/proxy-image?url=${encodeURIComponent(clean)}`;
  },

  async startDownload(url, format = "bestvideo+bestaudio/best", isAudioOnly = false) {
    return apiRequest("/api/downloader/download", {
      method: "POST",
      body: JSON.stringify({ url, format, isAudioOnly }),
    });
  },

  async fetchDownloadedFileObject(fileData) {
    const rawUrl = fileData.url || (fileData.filename ? `/storage/uploads/${fileData.filename}` : null);
    if (!rawUrl) throw new Error("No file path returned from downloader");
    const fullUrl = rawUrl.startsWith("http") ? rawUrl : `${BACKEND_URL}${rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`}`;
    const res = await fetch(fullUrl);
    if (!res.ok) throw new Error(`Failed to load downloaded file: HTTP ${res.status}`);
    const blob = await res.blob();
    const filename = fileData.filename || (fileData.title ? `${fileData.title}.mp4` : `download_${Date.now()}.mp4`);
    const mimeType = blob.type && blob.type !== "application/octet-stream"
      ? blob.type
      : (filename.endsWith(".mp3") ? "audio/mpeg" : "video/mp4");
    return new File([blob], filename, { type: mimeType });
  },
};
