const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const net = require("node:net");
const { spawn } = require("node:child_process");

let mainWindow = null;
let backendProcess = null;

function checkPortOpen(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(400);
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", () => {
      resolve(false);
    });
    socket.connect(port, host);
  });
}

async function ensureBackendServer() {
  const isRunning = await checkPortOpen(3001);
  if (isRunning) {
    console.log("[Desktop] Local Backend Server already active on port 3001");
    return;
  }

  const isPackaged = app.isPackaged;
  const isWindows = process.platform === "win32";

  let backendScript;
  let backendCwd;
  let frontendDist;
  let storageDir;
  let modelsDir;

  if (isPackaged) {
    const resourcesPath = process.resourcesPath;
    backendScript = path.join(resourcesPath, "backend", "src", "server.js");
    backendCwd = path.join(resourcesPath, "backend");
    frontendDist = path.join(__dirname, "dist");
    // Models stored in user data directory so app installer remains lightweight
    modelsDir = path.join(app.getPath("userData"), "models");
    storageDir = path.join(app.getPath("userData"), "storage");
  } else {
    backendScript = path.resolve(__dirname, "../backend/src/server.js");
    backendCwd = path.resolve(__dirname, "../backend");
    frontendDist = path.resolve(__dirname, "../frontend/dist");
    modelsDir = path.resolve(__dirname, "../backend/ai_clone/models");
    storageDir = path.resolve(__dirname, "../backend/storage");
  }

  // Ensure directories exist
  try {
    if (!fs.existsSync(modelsDir)) fs.mkdirSync(modelsDir, { recursive: true });
    if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });
  } catch (err) {
    console.warn("[Desktop] Directory init error:", err);
  }

  console.log("[Desktop] Starting backend server:", backendScript);
  console.log("[Desktop] Packaged mode:", isPackaged);
  console.log("[Desktop] Storage directory:", storageDir);
  console.log("[Desktop] Models directory:", modelsDir);

  const env = {
    ...process.env,
    PORT: "3001",
    HOST: "127.0.0.1",
    STORAGE_PATH: storageDir,
    FRONTEND_DIST: frontendDist,
    AI_MODELS_DIR: modelsDir,
    BONDETH_MODEL_DIR: modelsDir,
    HF_HOME: path.join(modelsDir, "hf"),
  };

  let execCmd;
  if (isPackaged) {
    // In packaged Electron, execute using Electron's internal Node engine
    execCmd = process.execPath;
    env.ELECTRON_RUN_AS_NODE = "1";
  } else {
    execCmd = isWindows ? "node.exe" : "node";
  }

  backendProcess = spawn(execCmd, [backendScript], {
    cwd: backendCwd,
    env,
    stdio: "inherit",
    shell: !isPackaged && isWindows,
  });

  backendProcess.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error(`[Desktop] Local backend exited with code ${code}`);
    }
    backendProcess = null;
  });

  // Wait for port 3001 to come online
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 250));
    if (await checkPortOpen(3001)) {
      console.log("[Desktop] Local backend successfully online on port 3001");
      break;
    }
  }
}

async function createWindow() {
  await ensureBackendServer();

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 800,
    minHeight: 560,
    show: false,
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

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  const isPackaged = app.isPackaged;
  if (!isPackaged) {
    const isDevRunning = await checkPortOpen(5173);
    if (isDevRunning) {
      mainWindow.loadURL("http://localhost:5173");
      mainWindow.on("closed", () => {
        mainWindow = null;
      });
      return;
    }
  }

  // Priority: Production Local Backend Server (serves frontend/dist + API with COOP/COEP headers)
  mainWindow.loadURL("http://127.0.0.1:3001").catch(() => {
    const distPath = isPackaged
      ? path.join(__dirname, "dist", "index.html")
      : path.join(__dirname, "../frontend/dist/index.html");
    mainWindow.loadFile(distPath);
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
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("quit", () => {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
});
