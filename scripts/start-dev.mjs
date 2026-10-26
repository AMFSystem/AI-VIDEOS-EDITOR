import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import net from "node:net";

console.log("\x1b[36m%s\x1b[0m", "🚀 Starting AI Video Editor Monorepo (Frontend + Backend + AI Voice Studio)...");

const isWindows = process.platform === "win32";
const npmCmd = isWindows ? "npm.cmd" : "npm";

function checkPortOpen(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(500);
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

let backend = null;
let frontend = null;
let aicloneBackendProcess = null;

async function bootstrap() {
  // 1. Check & Start Node.js Backend Service (Port 3001)
  const backendRunning = await checkPortOpen(3001);
  if (backendRunning) {
    console.log("\x1b[32m%s\x1b[0m", "[Backend] ✅ Service is already running on http://127.0.0.1:3001 (Reusing active instance)");
  } else {
    backend = spawn(npmCmd, ["run", "dev", "--prefix", "backend"], {
      stdio: "inherit",
      shell: isWindows,
    });
    backend.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        console.error(`Backend process exited with code ${code}`);
      }
    });
  }

  // 2. Check & Start Frontend Vite Dev Server (Port 5173)
  const frontendRunning = await checkPortOpen(5173);
  if (frontendRunning) {
    console.log("\x1b[32m%s\x1b[0m", "[Frontend] ✅ Vite dev server is already running on http://localhost:5173 (Reusing active instance)");
  } else {
    frontend = spawn(npmCmd, ["run", "dev", "--prefix", "frontend"], {
      stdio: "inherit",
      shell: isWindows,
    });
    frontend.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        console.error(`Frontend process exited with code ${code}`);
      }
    });
  }

  // Determine python command and virtual environment path
  const venvBinDir = isWindows ? "Scripts" : "bin";
  const venvExe = isWindows ? "python.exe" : "python";
  const backendPythonVenv = path.join(process.cwd(), "backend", "python", ".venv", venvBinDir, venvExe);
  const backendVenv = path.join(process.cwd(), "backend", ".venv", venvBinDir, venvExe);
  const rootVenv = path.join(process.cwd(), ".venv", venvBinDir, venvExe);
  const py311Path = path.join(process.env.LOCALAPPDATA || "", "Programs", "Python", "Python311", "python.exe");

  let pythonCmd = isWindows ? "python" : "python3";
  if (fs.existsSync(backendPythonVenv)) {
    pythonCmd = backendPythonVenv;
  } else if (fs.existsSync(backendVenv)) {
    pythonCmd = backendVenv;
  } else if (fs.existsSync(rootVenv)) {
    pythonCmd = rootVenv;
  } else if (isWindows && fs.existsSync(py311Path)) {
    pythonCmd = py311Path;
  }

  // 3. Check & Start AI Voice Studio Backend (FastAPI - Port 8000)
  const aicloneBackendPath = path.join(process.cwd(), "backend", "ai_clone");
  let aicloneBackendRunning = false;
  if (fs.existsSync(aicloneBackendPath)) {
    aicloneBackendRunning = await checkPortOpen(8000);
    if (aicloneBackendRunning) {
      console.log("\x1b[32m%s\x1b[0m", "[AI Voice Studio API] ✅ FastAPI is already running on http://127.0.0.1:8000 (Reusing active instance)");
    } else {
      const aicloneVenv = path.join(aicloneBackendPath, ".venv", venvBinDir, venvExe);
      const aiclonePython = fs.existsSync(aicloneVenv) ? aicloneVenv : pythonCmd;
      try {
        aicloneBackendProcess = spawn(aiclonePython, ["-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"], {
          cwd: aicloneBackendPath,
          stdio: "inherit",
          shell: isWindows,
        });
        aicloneBackendProcess.on("exit", (code) => {
          if (code !== 0 && code !== null) {
            console.log("\x1b[33m%s\x1b[0m", `[AI Voice Studio API] Stopped (code ${code}).`);
          }
        });
      } catch (err) {
        console.log("\x1b[33m%s\x1b[0m", `[AI Voice Studio API] Could not spawn FastAPI: ${err.message}`);
      }
    }
  }

  // If services were already running, keep this terminal process active and show helpful guide
  if (backendRunning && frontendRunning) {
    console.log("\n\x1b[36m%s\x1b[0m", "✨ All AI Video Editor services are currently running & ready:");
    console.log("  ➜ Frontend:     \x1b[32mhttp://localhost:5173\x1b[0m");
    console.log("  ➜ Backend:      \x1b[32mhttp://127.0.0.1:3001\x1b[0m");
    console.log("  ➜ Voice API:    \x1b[32mhttp://127.0.0.1:8000\x1b[0m");
    console.log("\n\x1b[90m%s\x1b[0m", "👉 Open http://localhost:5173 in your browser to use the app.");
    console.log("\x1b[90m%s\x1b[0m", "👉 To restart all services fresh, run: npm run restart");
    console.log("\x1b[90m%s\x1b[0m", "Press Ctrl+C to exit this monitor.");

    // Keep process active in terminal
    setInterval(() => {}, 1000 * 60 * 60);
  }
}

function handleExit(code) {
  if (backend && !backend.killed) backend.kill();
  if (frontend && !frontend.killed) frontend.kill();
  if (aicloneBackendProcess && !aicloneBackendProcess.killed) aicloneBackendProcess.kill();
  process.exit(code || 0);
}

process.on("SIGINT", () => handleExit(0));
process.on("SIGTERM", () => handleExit(0));

bootstrap();
