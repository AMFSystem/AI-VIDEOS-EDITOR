import { exec } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";

const execAsync = promisify(exec);

export async function detectGpuCapabilities(ffmpegPath = "ffmpeg") {
  const platform = os.platform();
  const result = {
    platform,
    arch: os.arch(),
    hardwareEncoders: [],
    recommendedEncoder: "libx264",
    detectedGpuType: "CPU Fallback",
  };

  try {
    const { stdout } = await execAsync(`"${ffmpegPath}" -encoders`);

    if (platform === "darwin") {
      result.detectedGpuType = "Apple Silicon / VideoToolbox";
      if (stdout.includes("h264_videotoolbox")) {
        result.hardwareEncoders.push("h264_videotoolbox");
        result.recommendedEncoder = "h264_videotoolbox";
      }
      if (stdout.includes("hevc_videotoolbox")) {
        result.hardwareEncoders.push("hevc_videotoolbox");
      }
      if (stdout.includes("prores_videotoolbox")) {
        result.hardwareEncoders.push("prores_videotoolbox");
      }
    } else if (platform === "win32" || platform === "linux") {
      if (stdout.includes("h264_nvenc")) {
        result.detectedGpuType = "NVIDIA NVENC";
        result.hardwareEncoders.push("h264_nvenc");
        result.recommendedEncoder = "h264_nvenc";
      }
      if (stdout.includes("hevc_nvenc")) {
        result.hardwareEncoders.push("hevc_nvenc");
      }
      if (stdout.includes("h264_qsv")) {
        result.detectedGpuType = result.detectedGpuType === "CPU Fallback" ? "Intel QuickSync" : result.detectedGpuType;
        result.hardwareEncoders.push("h264_qsv");
      }
      if (stdout.includes("h264_amf")) {
        result.detectedGpuType = result.detectedGpuType === "CPU Fallback" ? "AMD AMF" : result.detectedGpuType;
        result.hardwareEncoders.push("h264_amf");
      }
    }
  } catch {
    // Return default result if ffmpeg not available
  }

  return result;
}
