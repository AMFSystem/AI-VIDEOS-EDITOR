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
      path.join(process.cwd(), "backend", "ai_clone", ".venv", venvBin, pyExe),
      "/Users/hr/Desktop/AI VIDEO EDITOR/backend/ai_clone/.venv/bin/python",
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

    const candidateCwds = [
      path.join(resourcesPath, "backend", "ai_clone"),
      path.resolve(__dirname, "../backend/ai_clone"),
      path.join(process.cwd(), "backend", "ai_clone"),
      "/Users/hr/Desktop/AI VIDEO EDITOR/backend/ai_clone",
    ];
    for (const c of candidateCwds) {
      if (fs.existsSync(c)) {
        pythonCwd = c;
        break;
      }
    }

    if (!pythonCwd) {
      console.warn("[Desktop] Python ai_clone directory not found, running with Node fallback.");
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
  console.log("[Desktop] Frontend dist path:", frontendDist);
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

  const logDir = path.join(app.getPath("userData"), "logs");
  try {
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  } catch {}
  const logFile = path.join(logDir, "backend.log");
  const logStream = fs.createWriteStream(logFile, { flags: "a" });

  let launched = false;
  // 1. In packaged apps, prefer Electron's native utilityProcess.fork (no external node required)
  const { utilityProcess } = require("electron");
  if (isPackaged && utilityProcess && typeof utilityProcess.fork === "function") {
    try {
      console.log("[Desktop] Launching backend via Electron utilityProcess.fork:", backendScript);
      backendProcess = utilityProcess.fork(backendScript, [], {
        cwd: backendCwd,
        env,
        stdio: "pipe",
      });

      backendProcess.stdout?.pipe(logStream);
      backendProcess.stderr?.pipe(logStream);
      backendProcess.stdout?.on("data", (d) => console.log(`[Backend] ${d}`));
      backendProcess.stderr?.on("data", (d) => console.error(`[Backend ERR] ${d}`));

      backendProcess.on("exit", (code) => {
        if (code !== 0 && code !== null) {
          console.error(`[Desktop] utilityProcess backend exited with code ${code}`);
        }
        backendProcess = null;
      });
      launched = true;
    } catch (uErr) {
      console.warn("[Desktop] utilityProcess.fork failed, trying spawn fallback:", uErr.message);
    }
  }

  // 2. Child process spawn fallback
  if (!launched) {
    let execCmd = isPackaged ? process.execPath : (isWindows ? "node.exe" : "node");
    if (isPackaged) env.ELECTRON_RUN_AS_NODE = "1";

    try {
      console.log("[Desktop] Spawning backend process with execCmd:", execCmd, backendScript);
      backendProcess = spawn(execCmd, [backendScript], {
        cwd: backendCwd,
        env,
        stdio: ["ignore", "pipe", "pipe"],
        shell: false,
      });

      backendProcess.stdout?.pipe(logStream);
      backendProcess.stderr?.pipe(logStream);
      backendProcess.stdout?.on("data", (d) => console.log(`[Backend] ${d}`));
      backendProcess.stderr?.on("data", (d) => console.error(`[Backend ERR] ${d}`));

      backendProcess.on("exit", (code) => {
        if (code !== 0 && code !== null) {
          console.error(`[Desktop] Local backend exited with code ${code}`);
        }
        backendProcess = null;
      });
    } catch (err) {
      console.error("[Desktop] Failed to spawn backend process:", err);
    }
  }

  // 3. Wait for port 3001 to come online
  let isPortOpen = false;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 200));
    if (await checkPortOpen(3001)) {
      isPortOpen = true;
      console.log("[Desktop] Local backend successfully online on port 3001");
      break;
    }
  }

  // 4. Bulletproof In-Process Fallback:
  // If external child process failed to bind port 3001 (due to Windows restrictions or permissions),
  // launch Express HTTP & WebSocket server directly inside Electron's Main Node process!
  if (!isPortOpen) {
    console.log("[Desktop] Child process did not bind port 3001. Starting Node backend in-process fallback...");
    try {
      const { pathToFileURL } = require("node:url");
      Object.assign(process.env, env);
      await import(pathToFileURL(backendScript).href);
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 200));
        if (await checkPortOpen(3001)) {
          console.log("[Desktop] In-process backend successfully online on port 3001!");
          break;
        }
      }
    } catch (inProcessErr) {
      console.error("[Desktop] In-process backend start error:", inProcessErr);
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
    const candidateDists = [
      path.join(resourcesPath, "frontend", "dist"),
      path.join(resourcesPath, "dist"),
      path.join(__dirname, "dist"),
    ];
    frontendDist = candidateDists.find((d) => fs.existsSync(d)) || candidateDists[0];
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

  const getFallbackHtmlPath = () => {
    const candidates = isPackaged
      ? [
          path.join(resourcesPath, "frontend", "dist", "index.html"),
          path.join(resourcesPath, "dist", "index.html"),
          path.join(__dirname, "dist", "index.html"),
        ]
      : [path.resolve(__dirname, "../frontend/dist/index.html")];
    return candidates.find((f) => fs.existsSync(f)) || candidates[0];
  };

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    console.warn(`[Desktop] Page failed to load: ${validatedURL} (${errorCode}: ${errorDescription})`);
    if (!validatedURL.startsWith("file://")) {
      const fallback = getFallbackHtmlPath();
      console.log("[Desktop] Falling back to file load:", fallback);
      mainWindow.loadFile(fallback);
    }
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

  const isBackendRunning = await checkPortOpen(3001);
  if (isBackendRunning) {
    console.log("[Desktop] Connecting to local server on http://127.0.0.1:3001");
    mainWindow.loadURL("http://127.0.0.1:3001").catch((err) => {
      console.warn("[Desktop] Failed loadURL to port 3001, loading file directly:", err);
      mainWindow.loadFile(getFallbackHtmlPath());
    });
  } else {
    console.warn("[Desktop] Backend port 3001 not responding, loading file directly");
    mainWindow.loadFile(getFallbackHtmlPath());
  }

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
