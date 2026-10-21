import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

console.log("\x1b[36m%s\x1b[0m", "🚀 Starting AI Video Editor Monorepo (Frontend + Backend + Python XTTS)...");

const isWindows = process.platform === "win32";
const npmCmd = isWindows ? "npm.cmd" : "npm";

// 1. Start Node.js Backend Service (Port 3001)
const backend = spawn(npmCmd, ["run", "dev", "--prefix", "backend"], {
  stdio: "inherit",
  shell: isWindows,
});

// 2. Start Frontend Vite Dev Server (Port 5173)
const frontend = spawn(npmCmd, ["run", "dev", "--prefix", "frontend"], {
  stdio: "inherit",
  shell: isWindows,
});

// 3. Start Python XTTS v2 Neural Voice Cloning Server (Port 3002)
let pythonProcess = null;
const xttsScriptPath = path.join(process.cwd(), "backend", "python", "xtts_server.py");

if (fs.existsSync(xttsScriptPath)) {
  const py311Path = path.join(process.env.LOCALAPPDATA || "", "Programs", "Python", "Python311", "python.exe");
  let pythonCmd = isWindows ? "python" : "python3";
  if (isWindows && fs.existsSync(py311Path)) {
    pythonCmd = py311Path;
    console.log("\x1b[32m%s\x1b[0m", `[Python XTTS] Detected Python 3.11 at: ${py311Path}`);
  }
  try {
    pythonProcess = spawn(pythonCmd, [xttsScriptPath], {
      stdio: "inherit",
      shell: false,
      env: { ...process.env, COQUI_TOS_AGREED: "1" },
    });

    pythonProcess.on("error", (err) => {
      console.log("\x1b[33m%s\x1b[0m", `[Python XTTS Notice] Python not detected or failed to start: ${err.message}`);
      console.log("\x1b[33m%s\x1b[0m", "👉 Frontend and Backend are running normally. To enable local XTTS voice cloning, install Python 3.10/3.11 & requirements.txt.");
      pythonProcess = null;
    });

    pythonProcess.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        console.log("\x1b[33m%s\x1b[0m", `[Python XTTS] Service stopped (code ${code}). Node.js backend & frontend continue running.`);
      }
    });
  } catch (err) {
    console.log("\x1b[33m%s\x1b[0m", `[Python XTTS] Could not spawn Python: ${err.message}`);
  }
}

function handleExit(code) {
  if (backend && !backend.killed) backend.kill();
  if (frontend && !frontend.killed) frontend.kill();
  if (pythonProcess && !pythonProcess.killed) pythonProcess.kill();
  process.exit(code || 0);
}

process.on("SIGINT", () => handleExit(0));
process.on("SIGTERM", () => handleExit(0));

backend.on("exit", (code) => {
  if (code !== 0 && code !== null) {
    console.error(`Backend process exited with code ${code}`);
  }
});

frontend.on("exit", (code) => {
  if (code !== 0 && code !== null) {
    console.error(`Frontend process exited with code ${code}`);
  }
});

