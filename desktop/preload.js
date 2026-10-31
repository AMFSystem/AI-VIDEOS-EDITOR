const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopAPI", {
  isDesktop: true,
  platform: process.platform,
  getBackendUrl: () => "http://127.0.0.1:3001",
  ping: () => ipcRenderer.invoke("desktop:ping"),
  selectFile: (options) => ipcRenderer.invoke("desktop:select-file", options),
  saveFile: (options) => ipcRenderer.invoke("desktop:save-file", options),
  downloadModel: (modelId) => ipcRenderer.invoke("desktop:download-model", modelId),
  cancelDownloadModel: (modelId) => ipcRenderer.invoke("desktop:cancel-download-model", modelId),
  getModelsStatus: () => ipcRenderer.invoke("desktop:get-models-status"),
});
