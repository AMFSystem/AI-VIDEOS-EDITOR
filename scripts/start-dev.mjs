import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import net from "node:net";

console.log("\x1b[36m%s\x1b[0m", "🚀 Starting AI Video Editor Monorepo (Frontend + Backend + OpenBMB VoxCPM2)...");

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
let pythonProcess = null;
let f5ttsProcess = null;
let pyvideotransProcess = null;

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

  // 3. Check & Start Python OpenBMB VoxCPM2 Server (Port 3002)
  const voxcpmScriptPath = path.join(process.cwd(), "backend", "python", "voxcpm_server.py");
  const xttsScriptPath = path.join(process.cwd(), "backend", "python", "xtts_server.py");
  const pythonScriptPath = fs.existsSync(voxcpmScriptPath) ? voxcpmScriptPath : xttsScriptPath;
  let pythonRunning = false;

  if (fs.existsSync(pythonScriptPath)) {
    const isVoxCPM = pythonScriptPath === voxcpmScriptPath;
    const serverLabel = isVoxCPM ? "OpenBMB VoxCPM2" : "XTTS v2";

    pythonRunning = await checkPortOpen(3002);
    if (pythonRunning) {
      console.log("\x1b[32m%s\x1b[0m", `[Python ${serverLabel}] ✅ Service is already running on port 3002! (Reusing active instance)`);
    } else {
      try {
        pythonProcess = spawn(pythonCmd, [pythonScriptPath], {
          stdio: "inherit",
          shell: false,
          env: { ...process.env, COQUI_TOS_AGREED: "1" },
        });

        pythonProcess.on("error", (err) => {
          console.log("\x1b[33m%s\x1b[0m", `[Python ${serverLabel} Notice] Python not detected or failed to start: ${err.message}`);
          pythonProcess = null;
        });

        pythonProcess.on("exit", (code) => {
          if (code !== 0 && code !== null) {
            console.log("\x1b[33m%s\x1b[0m", `[Python ${serverLabel}] Service stopped (code ${code}). Node.js backend & frontend continue running.`);
          }
        });
      } catch (err) {
        console.log("\x1b[33m%s\x1b[0m", `[Python ${serverLabel}] Could not spawn Python: ${err.message}`);
      }
    }
  }

  // 4. Check & Start Python F5-TTS Server (Port 3003)
  const f5ttsScriptPath = path.join(process.cwd(), "backend", "python", "f5tts_server.py");
  let f5ttsRunning = false;

  if (fs.existsSync(f5ttsScriptPath)) {
    f5ttsRunning = await checkPortOpen(3003);
    if (f5ttsRunning) {
      console.log("\x1b[32m%s\x1b[0m", "[Python F5-TTS] ✅ Service is already running on port 3003! (Reusing active instance)");
    } else {
      try {
        f5ttsProcess = spawn(pythonCmd, [f5ttsScriptPath], {
          stdio: "inherit",
          shell: false,
        });

        f5ttsProcess.on("error", (err) => {
          console.log("\x1b[33m%s\x1b[0m", `[Python F5-TTS Notice] Could not start F5-TTS server: ${err.message}`);
          f5ttsProcess = null;
        });

        f5ttsProcess.on("exit", (code) => {
          if (code !== 0 && code !== null) {
            console.log("\x1b[33m%s\x1b[0m", `[Python F5-TTS] Service stopped (code ${code}).`);
          }
        });
      } catch (err) {
        console.log("\x1b[33m%s\x1b[0m", `[Python F5-TTS] Could not spawn F5-TTS: ${err.message}`);
      }
    }
  }

  // 5. Check & Start Python PyVideoTrans Server (Port 3004)
  const pyvideotransScriptPath = path.join(process.cwd(), "backend", "python", "pyvideotrans_server.py");
  let pyvideotransRunning = false;

  if (fs.existsSync(pyvideotransScriptPath)) {
    pyvideotransRunning = await checkPortOpen(3004);
    if (pyvideotransRunning) {
      console.log("\x1b[32m%s\x1b[0m", "[Python PyVideoTrans] ✅ Service is already running on port 3004! (Reusing active instance)");
    } else {
      try {
        pyvideotransProcess = spawn(pythonCmd, [pyvideotransScriptPath], {
          stdio: "inherit",
          shell: false,
        });

        pyvideotransProcess.on("error", (err) => {
          console.log("\x1b[33m%s\x1b[0m", `[Python PyVideoTrans Notice] Could not start PyVideoTrans server: ${err.message}`);
          pyvideotransProcess = null;
        });

        pyvideotransProcess.on("exit", (code) => {
          if (code !== 0 && code !== null) {
            console.log("\x1b[33m%s\x1b[0m", `[Python PyVideoTrans] Service stopped (code ${code}).`);
          }
        });
      } catch (err) {
        console.log("\x1b[33m%s\x1b[0m", `[Python PyVideoTrans] Could not spawn PyVideoTrans: ${err.message}`);
      }
    }
  }

  // If services were already running, keep this terminal process active and show helpful guide
  if (backendRunning && frontendRunning) {
    console.log("\n\x1b[36m%s\x1b[0m", "✨ All AI Video Editor services are currently running & ready:");
    console.log("  ➜ Frontend:     \x1b[32mhttp://localhost:5173\x1b[0m");
    console.log("  ➜ Backend:      \x1b[32mhttp://127.0.0.1:3001\x1b[0m");
    console.log("  ➜ VoxCPM2:      \x1b[32mhttp://127.0.0.1:3002\x1b[0m");
    console.log("  ➜ F5-TTS:       \x1b[32mhttp://127.0.0.1:3003\x1b[0m");
    console.log("  ➜ PyVideoTrans: \x1b[32mhttp://127.0.0.1:3004\x1b[0m");
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
  if (pythonProcess && !pythonProcess.killed) pythonProcess.kill();
  if (f5ttsProcess && !f5ttsProcess.killed) f5ttsProcess.kill();
  if (pyvideotransProcess && !pyvideotransProcess.killed) pyvideotransProcess.kill();
  process.exit(code || 0);
}

process.on("SIGINT", () => handleExit(0));
process.on("SIGTERM", () => handleExit(0));

bootstrap();
