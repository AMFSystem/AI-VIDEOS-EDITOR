import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const rootDir = process.cwd();
const isWindows = process.platform === "win32";
const targetOsDir = isWindows ? "win" : "mac";
const binDir = path.join(rootDir, "desktop", "bin", targetOsDir);

if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir, { recursive: true });
}

console.log(`[Setup Binaries] Checking FFmpeg / FFprobe for ${targetOsDir}...`);

const ffmpegBinary = isWindows ? "ffmpeg.exe" : "ffmpeg";
const ffprobeBinary = isWindows ? "ffprobe.exe" : "ffprobe";

const destFfmpeg = path.join(binDir, ffmpegBinary);
const destFfprobe = path.join(binDir, ffprobeBinary);

function copyBinary(name, dest) {
  if (fs.existsSync(dest)) {
    console.log(`[Setup Binaries] ✅ Found existing: ${dest}`);
    return true;
  }
  try {
    const whichCmd = isWindows ? `where ${name}` : `which ${name}`;
    const foundPath = execSync(whichCmd, { encoding: "utf8" }).split("\n")[0].trim();
    if (foundPath && fs.existsSync(foundPath)) {
      console.log(`[Setup Binaries] Copying ${name} from ${foundPath} to ${dest}...`);
      fs.copyFileSync(foundPath, dest);
      if (!isWindows) {
        fs.chmodSync(dest, 0o755);
      }
      return true;
    }
  } catch (err) {
    console.warn(`[Setup Binaries] Could not locate ${name} in system PATH: ${err.message}`);
  }
  return false;
}

const ffmpegOk = copyBinary(ffmpegBinary, destFfmpeg);
const ffprobeOk = copyBinary(ffprobeBinary, destFfprobe);

if (ffmpegOk && ffprobeOk) {
  console.log(`[Setup Binaries] ✅ Successfully prepared FFmpeg & FFprobe in ${binDir}`);
} else {
  console.log(`[Setup Binaries] ⚠️ Please ensure static FFmpeg and FFprobe binaries are placed in ${binDir}`);
}

// Ensure critical backend dependencies (like cors, express, ws) are present in backend/node_modules
const backendNodeModules = path.join(rootDir, "backend", "node_modules");
const rootNodeModules = path.join(rootDir, "node_modules");
if (!fs.existsSync(backendNodeModules)) {
  fs.mkdirSync(backendNodeModules, { recursive: true });
}

const requiredDeps = ["cors", "express", "ws"];
for (const dep of requiredDeps) {
  const targetDep = path.join(backendNodeModules, dep);
  const srcDep = path.join(rootNodeModules, dep);
  if (!fs.existsSync(targetDep) && fs.existsSync(srcDep)) {
    console.log(`[Setup Binaries] Copying hoisted dependency '${dep}' to backend/node_modules...`);
    fs.cpSync(srcDep, targetDep, { recursive: true });
  }
}


