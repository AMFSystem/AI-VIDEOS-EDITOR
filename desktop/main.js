const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const net = require("node:net");
const { spawn } = require("node:child_process");

let mainWindow = null;
let backendProcess = null;
let pythonProcess = null;

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

function resolveBinaries(resourcesPath, isPackaged) {
  const isWindows = process.platform === "win32";
  const osFolder = isWindows ? "win" : "mac";
  const ffmpegName = isWindows ? "ffmpeg.exe" : "ffmpeg";
  const ffprobeName = isWindows ? "ffprobe.exe" : "ffprobe";

  const ffmpegCandidates = isPackaged
    ? [
        path.join(resourcesPath, "bin", osFolder, ffmpegName),
        path.join(resourcesPath, "bin", ffmpegName),
      ]
    : [
        path.join(__dirname, "bin", osFolder, ffmpegName),
        path.join(__dirname, "bin", ffmpegName),
      ];

  let resolvedFfmpeg = null;
  for (const c of ffmpegCandidates) {
    if (fs.existsSync(c)) {
      resolvedFfmpeg = c;
      break;
    }
  }

  const probeCandidates = isPackaged
    ? [
        path.join(resourcesPath, "bin", osFolder, ffprobeName),
        path.join(resourcesPath, "bin", ffprobeName),
      ]
    : [
        path.join(__dirname, "bin", osFolder, ffprobeName),
        path.join(__dirname, "bin", ffprobeName),
      ];

  let resolvedFfprobe = null;
  for (const c of probeCandidates) {
    if (fs.existsSync(c)) {
      resolvedFfprobe = c;
      break;
    }
  }

  return {
    ffmpegPath: resolvedFfmpeg || "ffmpeg",
    ffprobePath: resolvedFfprobe || "ffprobe",
  };
}

async function ensureFastApiServer(modelsDir, storageDir) {
  const isRunning = await checkPortOpen(8000);
  if (isRunning) {
    console.log("[Desktop] FastAPI AI Studio already active on port 8000");
    return;
  }

  const isPackaged = app.isPackaged;
  const isWindows = process.platform === "win32";
  const resourcesPath = isPackaged ? process.resourcesPath : path.resolve(__dirname, "..");

  let pythonExec = null;
  let pythonArgs = [];
  let pythonCwd = null;

  // 1. Check for standalone PyInstaller engine binary if packaged
  const engineBinary = isWindows ? "ai_engine.exe" : "ai_engine";
  const bundledEngine = path.join(resourcesPath, "ai_engine", engineBinary);

  if (isPackaged && fs.existsSync(bundledEngine)) {
    pythonExec = bundledEngine;
    pythonArgs = [];
    pythonCwd = path.join(resourcesPath, "ai_engine");
    console.log("[Desktop] Using bundled AI engine binary:", bundledEngine);
  } else {
    // 2. Check for virtual environments or system python
    const venvBin = isWindows ? "Scripts" : "bin";
    const pyExe = isWindows ? "python.exe" : "python";
    const venvCandidates = [
      path.join(resourcesPath, "backend", "ai_clone", ".venv", venvBin, pyExe),
      path.join(resourcesPath, "backend", "python", ".venv", venvBin, pyExe),
      path.join(resourcesPath, ".venv", venvBin, pyExe),
      path.join(__dirname, "../backend/ai_clone/.venv", venvBin, pyExe),
      path.join(__dirname, "../backend/python/.venv", venvBin, pyExe),
      path.join(__dirname, "../.venv", venvBin, pyExe),
    ];

    for (const v of venvCandidates) {
      if (fs.existsSync(v)) {
        pythonExec = v;
        break;
      }
    }

    if (!pythonExec) {
      pythonExec = isWindows ? "python" : "python3";
    }

    pythonCwd = isPackaged
      ? path.join(resourcesPath, "backend", "ai_clone")
      : path.resolve(__dirname, "../backend/ai_clone");

    if (!fs.existsSync(pythonCwd)) {
      console.warn("[Desktop] Python ai_clone directory not found, skipping FastAPI auto-start.");
      return;
    }

    pythonArgs = ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"];
  }

  const pyEnv = {
    ...process.env,
    DESKTOP_MODE: "1",
    BONDETH_DATABASE_URL: `sqlite+aiosqlite:///${path.join(modelsDir, "bondeth.db")}`,
    BONDETH_MODEL_DIR: modelsDir,
    BONDETH_TMP_DIR: path.join(storageDir, "tmp"),
    BONDETH_DATA_DIR: path.join(storageDir, "data"),
  };

  try {
    console.log("[Desktop] Spawning FastAPI server:", pythonExec, pythonArgs.join(" "));
    pythonProcess = spawn(pythonExec, pythonArgs, {
      cwd: pythonCwd,
      env: pyEnv,
      stdio: "inherit",
      shell: !isPackaged && isWindows,
    });

    pythonProcess.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        console.warn(`[Desktop] FastAPI process exited with code ${code}`);
      }
      pythonProcess = null;
    });

    // Wait for port 8000 to be active (up to 6s)
    for (let i = 0; i < 24; i++) {
      await new Promise((r) => setTimeout(r, 250));
      if (await checkPortOpen(8000)) {
        console.log("[Desktop] FastAPI AI Studio successfully online on port 8000");
        break;
      }
    }
  } catch (err) {
    console.warn("[Desktop] Could not launch FastAPI server:", err.message);
  }
}

async function ensureBackendServer(modelsDir, storageDir, frontendDist, ffmpegConfig) {
  const isRunning = await checkPortOpen(3001);
  if (isRunning) {
    console.log("[Desktop] Local Backend Server already active on port 3001");
    return;
  }

  const isPackaged = app.isPackaged;
  const isWindows = process.platform === "win32";
  const resourcesPath = isPackaged ? process.resourcesPath : path.resolve(__dirname, "..");

  let backendScript;
  let backendCwd;

  if (isPackaged) {
    backendScript = path.join(resourcesPath, "backend", "src", "server.js");
    backendCwd = path.join(resourcesPath, "backend");
  } else {
    backendScript = path.resolve(__dirname, "../backend/src/server.js");
    backendCwd = path.resolve(__dirname, "../backend");
  }

  console.log("[Desktop] Starting Node backend server:", backendScript);
  console.log("[Desktop] Packaged mode:", isPackaged);
  console.log("[Desktop] Storage directory:", storageDir);
  console.log("[Desktop] Models directory:", modelsDir);
  console.log("[Desktop] FFmpeg binary:", ffmpegConfig.ffmpegPath);

  const env = {
    ...process.env,
    PORT: "3001",
    HOST: "127.0.0.1",
    STORAGE_PATH: storageDir,
    FRONTEND_DIST: frontendDist,
    AI_MODELS_DIR: modelsDir,
    BONDETH_MODEL_DIR: modelsDir,
    HF_HOME: path.join(modelsDir, "hf"),
    FFMPEG_PATH: ffmpegConfig.ffmpegPath,
    FFPROBE_PATH: ffmpegConfig.ffprobePath,
    AI_CLONE_API_URL: "http://127.0.0.1:8000/api/v1/stt",
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
  const isPackaged = app.isPackaged;
  const resourcesPath = isPackaged ? process.resourcesPath : path.resolve(__dirname, "..");

  let frontendDist;
  let storageDir;
  let modelsDir;

  if (isPackaged) {
    frontendDist = path.join(__dirname, "dist");
    modelsDir = path.join(app.getPath("userData"), "models");
    storageDir = path.join(app.getPath("userData"), "storage");
  } else {
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

  const ffmpegConfig = resolveBinaries(resourcesPath, isPackaged);

  // Start both FastApi (port 8000) and Node backend (port 3001)
  await ensureFastApiServer(modelsDir, storageDir);
  await ensureBackendServer(modelsDir, storageDir, frontendDist, ffmpegConfig);

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 800,
    minHeight: 560,
    show: false,
    title: "Timeline Studio — AI Video Editor",
    icon: path.join(__dirname, "build", "icon.png"),
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

function terminateChildren() {
  if (backendProcess) {
    try { backendProcess.kill(); } catch {}
    backendProcess = null;
  }
  if (pythonProcess) {
    try { pythonProcess.kill(); } catch {}
    pythonProcess = null;
  }
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
  terminateChildren();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  terminateChildren();
});

app.on("quit", () => {
  terminateChildren();
});
