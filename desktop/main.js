const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("node:path");

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: "Timeline Studio — AI Video Editor",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
    backgroundColor: "#101720",
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL || "http://localhost:5173";
  mainWindow.loadURL(devUrl).catch(() => {
    // If dev server on 5173 fails, try 5174 or fallback to local dist/index.html
    mainWindow.loadURL("http://localhost:5174").catch(() => {
      const distPath = path.join(__dirname, "../frontend/dist/index.html");
      mainWindow.loadFile(distPath);
    });
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// IPC Handlers
ipcMain.handle("desktop:ping", () => "pong");

ipcMain.handle("desktop:select-file", async (_event, options = {}) => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    filters: options.filters || [
      { name: "Media Files", extensions: ["mp4", "mov", "webm", "mp3", "wav", "png", "jpg", "jpeg"] },
    ],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("desktop:save-file", async (_event, options = {}) => {
  if (!mainWindow) return null;
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: options.defaultPath || "export.mp4",
    filters: options.filters || [{ name: "MP4 Video", extensions: ["mp4"] }],
  });
  return result.canceled ? null : result.filePath;
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
