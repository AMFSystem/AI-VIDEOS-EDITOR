import { spawn } from "node:child_process";

console.log("\x1b[36m%s\x1b[0m", "🚀 Starting AI Video Editor Monorepo (Frontend + Backend)...");

const backend = spawn("npm", ["run", "dev", "--prefix", "backend"], {
  stdio: "inherit",
});

const frontend = spawn("npm", ["run", "dev", "--prefix", "frontend"], {
  stdio: "inherit",
});

function handleExit(code) {
  backend.kill();
  frontend.kill();
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
