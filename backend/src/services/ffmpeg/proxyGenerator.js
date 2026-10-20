import { spawn } from "node:child_process";
import { config } from "../../config/index.js";
import { detectGpuCapabilities } from "../../config/gpuDetector.js";
import { parseFfmpegProgress } from "../../utils/timeParser.js";

export async function generateProxyVideo(inputPath, outputPath, totalDuration, onProgress) {
  const gpu = await detectGpuCapabilities(config.ffmpegPath);
  const encoder = gpu.recommendedEncoder === "h264_videotoolbox"
    ? "h264_videotoolbox"
    : gpu.recommendedEncoder === "h264_nvenc"
    ? "h264_nvenc"
    : "libx264";

  const args = [
    "-y",
    "-i", inputPath,
    "-vf", "scale=-2:540",
    "-c:v", encoder,
    "-b:v", "1500k",
    "-c:a", "aac",
    "-b:a", "128k",
    outputPath,
  ];

  return new Promise((resolve, reject) => {
    const proc = spawn(config.ffmpegPath, args);

    proc.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      if (onProgress) {
        const prog = parseFfmpegProgress(text, totalDuration);
        if (prog) onProgress(prog);
      }
    });

    proc.on("close", (code) => {
      if (code === 0) resolve({ success: true, outputPath });
      else reject(new Error(`Proxy generation failed with code ${code}`));
    });

    proc.on("error", reject);
  });
}
