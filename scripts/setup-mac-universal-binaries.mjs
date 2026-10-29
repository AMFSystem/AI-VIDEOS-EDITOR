import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import { execSync } from "node:child_process";

const macBinDir = path.resolve("desktop/bin/mac");
const macX64Dir = path.join(macBinDir, "x64");
const macArm64Dir = path.join(macBinDir, "arm64");

for (const dir of [macBinDir, macX64Dir, macArm64Dir]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function downloadBinary(url, destPath) {
  return new Promise((resolve, reject) => {
    console.log(`[Mac Binaries] Downloading ${path.basename(destPath)} from ${url}...`);
    const request = (currentUrl) => {
      https.get(currentUrl, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return request(res.headers.location);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`Failed to download ${url}: HTTP ${res.statusCode}`));
        }
        const fileStream = fs.createWriteStream(destPath);
        res.pipe(fileStream);
        fileStream.on("finish", () => {
          fileStream.close(() => {
            fs.chmodSync(destPath, 0o755);
            resolve();
          });
        });
        fileStream.on("error", reject);
      }).on("error", reject);
    };
    request(url);
  });
}

const BASE_URL = "https://github.com/eugeneware/ffmpeg-static/releases/download/b6.1.1";

async function main() {
  console.log("🚀 Setting up standalone static Mac binaries (Universal: Apple Silicon arm64 + Intel x64)...");

  const x64Ffmpeg = path.join(macX64Dir, "ffmpeg");
  const x64Ffprobe = path.join(macX64Dir, "ffprobe");
  const arm64Ffmpeg = path.join(macArm64Dir, "ffmpeg");
  const arm64Ffprobe = path.join(macArm64Dir, "ffprobe");

  if (!fs.existsSync(x64Ffmpeg)) {
    await downloadBinary(`${BASE_URL}/ffmpeg-darwin-x64`, x64Ffmpeg);
  }
  if (!fs.existsSync(x64Ffprobe)) {
    await downloadBinary(`${BASE_URL}/ffprobe-darwin-x64`, x64Ffprobe);
  }
  if (!fs.existsSync(arm64Ffmpeg)) {
    await downloadBinary(`${BASE_URL}/ffmpeg-darwin-arm64`, arm64Ffmpeg);
  }
  if (!fs.existsSync(arm64Ffprobe)) {
    await downloadBinary(`${BASE_URL}/ffprobe-darwin-arm64`, arm64Ffprobe);
  }

  // Create Universal Binaries using lipo (built-in macOS tool)
  const universalFfmpeg = path.join(macBinDir, "ffmpeg");
  const universalFfprobe = path.join(macBinDir, "ffprobe");

  console.log("[Mac Binaries] Merging arm64 and x64 slices into Universal Fat Binaries with lipo...");
  try {
    execSync(`lipo -create "${arm64Ffmpeg}" "${x64Ffmpeg}" -output "${universalFfmpeg}"`);
    fs.chmodSync(universalFfmpeg, 0o755);
    console.log("✅ Created Universal FFmpeg binary:", universalFfmpeg);
  } catch (err) {
    console.warn("Could not create lipo universal ffmpeg, copying arm64 as fallback:", err.message);
    fs.copyFileSync(arm64Ffmpeg, universalFfmpeg);
  }

  try {
    execSync(`lipo -create "${arm64Ffprobe}" "${x64Ffprobe}" -output "${universalFfprobe}"`);
    fs.chmodSync(universalFfprobe, 0o755);
    console.log("✅ Created Universal FFprobe binary:", universalFfprobe);
  } catch (err) {
    console.warn("Could not create lipo universal ffprobe, copying arm64 as fallback:", err.message);
    fs.copyFileSync(arm64Ffprobe, universalFfprobe);
  }

  console.log("🎉 Successfully configured standalone Universal Mac binaries!");
}

main().catch((err) => {
  console.error("Setup error:", err);
  process.exit(1);
});

