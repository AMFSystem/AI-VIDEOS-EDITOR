const { app, BrowserWindow, ipcMain, dialog, protocol, net: electronNet } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const netSocket = require("node:net");
const { spawn } = require("node:child_process");
const { pathToFileURL } = require("node:url");

// Register privileged custom scheme 'app' BEFORE app is ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
      allowServiceWorkers: true,
    },
  },
]);

let mainWindow = null;
let backendProcess = null;
let pythonProcess = null;
let devServerProcess = null;
let appPaths = null;

function setupFileLogging() {
  try {
    const logFile = path.join(app.getPath("userData"), "app-debug.log");
    const logStream = fs.createWriteStream(logFile, { flags: "a" });
    const origLog = console.log;
    const origWarn = console.warn;
    const origErr = console.error;

    console.log = (...args) => {
      origLog(...args);
      try { logStream.write(`[${new Date().toISOString()}] [INFO] ${args.join(" ")}\n`); } catch {}
    };
    console.warn = (...args) => {
      origWarn(...args);
      try { logStream.write(`[${new Date().toISOString()}] [WARN] ${args.join(" ")}\n`); } catch {}
    };
    console.error = (...args) => {
      origErr(...args);
      try { logStream.write(`[${new Date().toISOString()}] [ERR] ${args.join(" ")}\n`); } catch {}
    };
  } catch {}
}

function resolveAppPaths() {
  if (appPaths) return appPaths;
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

  try {
    if (!fs.existsSync(modelsDir)) fs.mkdirSync(modelsDir, { recursive: true });
    if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });
  } catch (err) {
    console.warn("[Desktop] Directory init error:", err);
  }

  appPaths = { isPackaged, resourcesPath, frontendDist, storageDir, modelsDir };
  return appPaths;
}

function checkPortOpen(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const socket = new netSocket.Socket();
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
    PYTHONPATH: pythonCwd,
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
    return true;
  }

  const isPackaged = app.isPackaged;
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

  const backendModules = path.join(backendCwd, "node_modules");

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
    NODE_PATH: backendModules + (process.env.NODE_PATH ? path.delimiter + process.env.NODE_PATH : ""),
  };

  // 1. Bulletproof In-Process Backend Startup:
  // Starts Express HTTP & WebSocket server directly inside Electron's Main process.
  // This guarantees port 3001 starts in <50ms without external child processes or permission friction.
  try {
    Object.assign(process.env, env);
    console.log("[Desktop] Launching Node backend in-process via dynamic import...");
    await import(pathToFileURL(backendScript).href);
    console.log("[Desktop] In-process backend loaded successfully.");
  } catch (err) {
    console.warn("[Desktop] In-process backend import failed, trying child process fallback:", err);
    const { utilityProcess } = require("electron");
    if (utilityProcess && typeof utilityProcess.fork === "function") {
      try {
        backendProcess = utilityProcess.fork(backendScript, [], {
          cwd: backendCwd,
          env,
          stdio: "pipe",
        });
        backendProcess.stdout?.on("data", (d) => console.log(`[Backend] ${d}`));
        backendProcess.stderr?.on("data", (d) => console.error(`[Backend ERR] ${d}`));
      } catch (uErr) {
        console.warn("[Desktop] utilityProcess failed:", uErr.message);
      }
    } else {
      try {
        backendProcess = spawn(process.execPath, [backendScript], {
          cwd: backendCwd,
          env: { ...env, ELECTRON_RUN_AS_NODE: "1" },
          stdio: "pipe",
        });
        backendProcess.stdout?.on("data", (d) => console.log(`[Backend] ${d}`));
        backendProcess.stderr?.on("data", (d) => console.error(`[Backend ERR] ${d}`));
      } catch (spErr) {
        console.warn("[Desktop] child_process spawn failed:", spErr.message);
      }
    }
  }

  // 2. Poll until port 3001 is listening (up to 10 seconds)
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 250));
    if (await checkPortOpen(3001)) {
      console.log("[Desktop] Local backend successfully online on port 3001");
      return true;
    }
  }

  console.error("[Desktop] Backend port 3001 did not respond in time.");
  return false;
}

async function createWindow() {
  const { isPackaged, resourcesPath, frontendDist, storageDir, modelsDir } = resolveAppPaths();
  const ffmpegConfig = resolveBinaries(resourcesPath, isPackaged);

  // 1. Start FastAPI in background (non-blocking) so app startup is never delayed
  ensureFastApiServer(modelsDir, storageDir).catch((err) => {
    console.warn("[Desktop] Background FastAPI notice:", err?.message || err);
  });

  // 2. Start Node backend on port 3001
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

  // DevTools Toggle Shortcut (F12 or Ctrl+Shift+I / Cmd+Option+I)
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (
      input.key === "F12" ||
      (input.control && input.shift && input.key.toLowerCase() === "i") ||
      (input.meta && input.alt && input.key.toLowerCase() === "i")
    ) {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  if (!isPackaged) {
    let isDevRunning = await checkPortOpen(5173);
    if (!isDevRunning) {
      console.log("[Desktop] Vite dev server offline on port 5173. Auto-starting local Vite dev server...");
      const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
      const frontendDir = path.resolve(__dirname, "../frontend");
      try {
        devServerProcess = spawn(npmCmd, ["run", "dev"], {
          cwd: frontendDir,
          stdio: "inherit",
          shell: process.platform === "win32",
        });
        devServerProcess.on("exit", (code) => {
          if (code !== 0 && code !== null) console.warn(`[Desktop] Vite server exited with code ${code}`);
          devServerProcess = null;
        });
      } catch (devErr) {
        console.warn("[Desktop] Could not auto-spawn Vite server:", devErr.message);
      }
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 250));
        if (await checkPortOpen(5173)) {
          isDevRunning = true;
          console.log("[Desktop] Local Vite dev server successfully online on port 5173");
          break;
        }
      }
    }
    if (isDevRunning) {
      mainWindow.loadURL("http://localhost:5173");
      mainWindow.on("closed", () => {
        mainWindow = null;
      });
      return;
    }
  }

  // Packaged mode: load local backend or app:// protocol
  console.log("[Desktop] Determining best entry URL for packaged application...");
  const isBackendOpen = await checkPortOpen(3001);
  if (isBackendOpen) {
    console.log("[Desktop] Connecting to local server on http://127.0.0.1:3001");
    mainWindow.loadURL("http://127.0.0.1:3001").catch((err) => {
      console.warn("[Desktop] Initial loadURL failed, falling back to app://localhost/index.html:", err);
      mainWindow.loadURL("app://localhost/index.html");
    });
  } else {
    console.log("[Desktop] Backend port 3001 not ready yet. Directly loading app://localhost/index.html!");
    mainWindow.loadURL("app://localhost/index.html");
  }

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    console.warn(`[Desktop] Page failed to load: ${validatedURL} (${errorCode}: ${errorDescription})`);
    if (validatedURL.includes("3001")) {
      console.log("[Desktop] Load failed on 3001, falling back to app://localhost/index.html");
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.loadURL("app://localhost/index.html");
        }
      }, 300);
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function terminateChildren() {
  if (devServerProcess) {
    try { devServerProcess.kill(); } catch {}
    devServerProcess = null;
  }
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
  setupFileLogging();
  const paths = resolveAppPaths();

  // Handle custom 'app' protocol
  protocol.handle("app", async (request) => {
    try {
      const url = new URL(request.url);
      let pathname = decodeURIComponent(url.pathname);
      if (pathname.startsWith("/")) pathname = pathname.slice(1);

      // Proxy API and storage requests to backend server on port 3001
      if (pathname.startsWith("api/") || pathname.startsWith("storage/")) {
        const targetUrl = `http://127.0.0.1:3001/${pathname}${url.search}`;
        return electronNet.fetch(targetUrl, {
          method: request.method,
          headers: request.headers,
          body: request.body,
          duplex: "half",
        });
      }

      // Serve static asset if file exists
      const targetPath = path.join(paths.frontendDist, pathname);
      if (pathname && fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) {
        return electronNet.fetch(pathToFileURL(targetPath).toString());
      }

      // Default to index.html for SPA
      const indexPath = path.join(paths.frontendDist, "index.html");
      return electronNet.fetch(pathToFileURL(indexPath).toString());
    } catch (err) {
      console.error("[Protocol app] Error:", err);
      const indexPath = path.join(paths.frontendDist, "index.html");
      return electronNet.fetch(pathToFileURL(indexPath).toString());
    }
  });

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
