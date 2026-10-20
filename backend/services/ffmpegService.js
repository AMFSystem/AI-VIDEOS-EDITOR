import { exec, spawn } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";

const execAsync = promisify(exec);

export class FFmpegService {
  constructor() {
    this.ffmpegAvailable = null;
    this.ffmpegVersion = null;
    this.hardwareEncoders = [];
  }

  async checkAvailability() {
    try {
      const { stdout } = await execAsync("ffmpeg -version");
      this.ffmpegAvailable = true;
      const firstLine = stdout.split("\n")[0] || "";
      this.ffmpegVersion = firstLine;

      await this.detectHardwareEncoders();
      return {
        available: true,
        version: this.ffmpegVersion,
        hardwareEncoders: this.hardwareEncoders,
      };
    } catch {
      this.ffmpegAvailable = false;
      return {
        available: false,
        version: null,
        hardwareEncoders: [],
        note: "Native ffmpeg binary not found in system PATH. Can fallback to in-browser WebCodecs/WASM.",
      };
    }
  }

  async detectHardwareEncoders() {
    try {
      const { stdout } = await execAsync("ffmpeg -encoders");
      const encoders = [];
      const platform = os.platform();

      if (platform === "darwin") {
        if (stdout.includes("h264_videotoolbox")) encoders.push("h264_videotoolbox");
        if (stdout.includes("hevc_videotoolbox")) encoders.push("hevc_videotoolbox");
        if (stdout.includes("prores_videotoolbox")) encoders.push("prores_videotoolbox");
      } else if (platform === "win32" || platform === "linux") {
        if (stdout.includes("h264_nvenc")) encoders.push("h264_nvenc");
        if (stdout.includes("hevc_nvenc")) encoders.push("hevc_nvenc");
        if (stdout.includes("h264_qsv")) encoders.push("h264_qsv");
        if (stdout.includes("h264_amf")) encoders.push("h264_amf");
      }

      this.hardwareEncoders = encoders;
    } catch {
      this.hardwareEncoders = [];
    }
  }

  async probeMedia(filePath) {
    try {
      const { stdout } = await execAsync(
        `ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}"`
      );
      return JSON.parse(stdout);
    } catch (err) {
      throw new Error(`Failed to probe media: ${err.message}`);
    }
  }

  renderVideo(args, onProgress) {
    return new Promise((resolve, reject) => {
      const process = spawn("ffmpeg", args);
      let stderrOutput = "";

      process.stderr.on("data", (chunk) => {
        const text = chunk.toString();
        stderrOutput += text;
        if (onProgress) {
          onProgress(text);
        }
      });

      process.on("close", (code) => {
        if (code === 0) {
          resolve({ success: true });
        } else {
          reject(new Error(`FFmpeg exited with code ${code}: ${stderrOutput}`));
        }
      });

      process.on("error", (err) => {
        reject(err);
      });
    });
  }
}

export const ffmpegService = new FFmpegService();
