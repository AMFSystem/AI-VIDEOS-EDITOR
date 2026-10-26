import { execSync } from "node:child_process";

console.log("\x1b[33m%s\x1b[0m", "🛑 Stopping all AI Video Editor services (ports 3000, 3001, 3002, 3003, 3004, 5173, 5174, 8000)...");

const ports = [3000, 3001, 3002, 3003, 3004, 5173, 5174, 8000];
for (const port of ports) {
  try {
    const pids = execSync(`lsof -ti :${port}`, { encoding: "utf8" }).trim().split("\n").filter(Boolean);
    for (const pid of pids) {
      try {
        process.kill(Number(pid), "SIGTERM");
        console.log(`  ✓ Stopped process ${pid} on port ${port}`);
      } catch {}
    }
  } catch {
    // Port not in use
  }
}

console.log("\x1b[32m%s\x1b[0m", "✅ All services stopped successfully.");
