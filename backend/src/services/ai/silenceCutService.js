import { spawn } from "node:child_process";
import fs from "node:fs";
import { config } from "../../config/index.js";
import { logger } from "../../utils/logger.js";

export class SilenceCutService {
  async detectSilence(audioPath, thresholdDb = -35, minDurationSec = 0.5) {
    if (!audioPath || !fs.existsSync(audioPath)) {
      throw new Error(`Audio file not found: ${audioPath}`);
    }

    return new Promise((resolve) => {
      const args = [
        "-i", audioPath,
        "-af", `silencedetect=noise=${thresholdDb}dB:d=${minDurationSec}`,
        "-f", "null",
        "-"
      ];

      const proc = spawn(config.ffmpegPath, args);
      let stderrOutput = "";

      proc.stderr.on("data", (chunk) => {
        stderrOutput += chunk.toString();
      });

      proc.on("close", () => {
        const intervals = [];
        const startRegex = /silence_start:\s*([0-9.]+)/g;
        const endRegex = /silence_end:\s*([0-9.]+)\s*\|\s*silence_duration:\s*([0-9.]+)/g;

        const starts = [];
        let match;
        while ((match = startRegex.exec(stderrOutput)) !== null) {
          starts.push(parseFloat(match[1]));
        }

        let idx = 0;
        while ((match = endRegex.exec(stderrOutput)) !== null) {
          const end = parseFloat(match[1]);
          const duration = parseFloat(match[2]);
          const start = starts[idx] !== undefined ? starts[idx] : Math.max(0, end - duration);
          intervals.push({ start, end, duration });
          idx++;
        }

        resolve({
          success: true,
          audioPath,
          thresholdDb,
          minDurationSec,
          silentIntervals: intervals,
        });
      });

      proc.on("error", (err) => {
        logger.warn(`[SilenceCutService] FFmpeg error: ${err.message}`);
        resolve({
          success: false,
          audioPath,
          thresholdDb,
          minDurationSec,
          silentIntervals: [],
          error: err.message,
        });
      });
    });
  }
}

export const silenceCutService = new SilenceCutService();
