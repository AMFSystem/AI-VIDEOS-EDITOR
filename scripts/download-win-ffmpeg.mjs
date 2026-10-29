import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import { execSync } from "node:child_process";

const winBinDir = path.resolve("desktop/bin/win");
if (!fs.existsSync(winBinDir)) {
  fs.mkdirSync(winBinDir, { recursive: true });
}

const ffmpegDest = path.join(winBinDir, "ffmpeg.exe");
const ffprobeDest = path.join(winBinDir, "ffprobe.exe");

if (fs.existsSync(ffmpegDest) && fs.existsSync(ffprobeDest)) {
  console.log("✅ Windows FFmpeg & FFprobe already present in desktop/bin/win");
  process.exit(0);
}

console.log("Downloading Windows FFmpeg & FFprobe binaries from ffbinaries...");

async function downloadAndExtract(url, targetExeName) {
  const tmpZip = path.join(winBinDir, `${targetExeName}.zip`);
  console.log(`Downloading ${url}...`);

  const downloadFile = (currentUrl) =>
    new Promise((resolve, reject) => {
      https.get(currentUrl, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return resolve(downloadFile(res.headers.location));
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        const file = fs.createWriteStream(tmpZip);
        res.pipe(file);
        file.on("finish", () => file.close(resolve));
        file.on("error", reject);
      }).on("error", reject);
    });

  await downloadFile(url);
  console.log(`Extracting ${tmpZip}...`);
  execSync(`unzip -o -q "${tmpZip}" -d "${winBinDir}"`);
  if (fs.existsSync(tmpZip)) fs.unlinkSync(tmpZip);
  console.log(`✅ Extracted ${targetExeName} into ${winBinDir}`);
}

async function main() {
  try {
    if (!fs.existsSync(ffmpegDest)) {
      await downloadAndExtract(
        "https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v6.1/ffmpeg-6.1-win-64.zip",
        "ffmpeg.exe"
      );
    }
    if (!fs.existsSync(ffprobeDest)) {
      await downloadAndExtract(
        "https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v6.1/ffprobe-6.1-win-64.zip",
        "ffprobe.exe"
      );
    }
    console.log("🎉 Successfully downloaded and installed Windows FFmpeg & FFprobe!");
  } catch (err) {
    console.warn("Could not download ffbinaries automatically:", err.message);
  }
}

main();

