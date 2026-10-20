import { exec } from "node:child_process";
import { promisify } from "node:util";
import { config } from "../../config/index.js";

const execAsync = promisify(exec);

export async function probeMedia(filePath) {
  try {
    const { stdout } = await execAsync(
      `"${config.ffprobePath}" -v quiet -print_format json -show_format -show_streams "${filePath}"`
    );
    const data = JSON.parse(stdout);
    const videoStream = data.streams?.find((s) => s.codec_type === "video");
    const audioStream = data.streams?.find((s) => s.codec_type === "audio");

    return {
      duration: parseFloat(data.format?.duration || "0"),
      sizeBytes: parseInt(data.format?.size || "0", 10),
      bitrate: parseInt(data.format?.bit_rate || "0", 10),
      formatName: data.format?.format_name,
      video: videoStream
        ? {
            codec: videoStream.codec_name,
            width: videoStream.width,
            height: videoStream.height,
            fps: evalFps(videoStream.r_frame_rate),
          }
        : null,
      audio: audioStream
        ? {
            codec: audioStream.codec_name,
            sampleRate: parseInt(audioStream.sample_rate || "0", 10),
            channels: audioStream.channels,
          }
        : null,
    };
  } catch (err) {
    throw new Error(`ffprobe failed: ${err.message}`);
  }
}

function evalFps(fpsString) {
  if (!fpsString) return 30;
  const parts = fpsString.split("/");
  if (parts.length === 2 && parseFloat(parts[1]) > 0) {
    return Math.round((parseFloat(parts[0]) / parseFloat(parts[1])) * 100) / 100;
  }
  return parseFloat(fpsString) || 30;
}
