import fs from "node:fs/promises";
import path from "node:path";
import { pyvideotransService } from "./pyvideotransService.js";
import { fileManager } from "../storage/fileManager.js";
import { logger } from "../../utils/logger.js";

export class AudioStemService {
  async separateStems(audioPath) {
    if (!audioPath) {
      throw new Error("Missing audioPath");
    }

    try {
      const buffer = await fs.readFile(audioPath);
      const filename = path.basename(audioPath);
      const bgmBuffer = await pyvideotransService.separateBgm(buffer, filename);

      const instrumentalFilename = `stem_bgm_${Date.now()}_${filename}.wav`;
      const instrumentalPath = fileManager.getFilePath("temp", instrumentalFilename);
      await fs.writeFile(instrumentalPath, bgmBuffer);

      return {
        success: true,
        audioPath,
        stems: {
          vocals: null,
          instrumental: instrumentalPath,
        },
      };
    } catch (err) {
      logger.warn(`[AudioStemService] Fallback stem note: ${err.message}`);
      return {
        success: true,
        audioPath,
        stems: {
          vocals: null,
          instrumental: null,
        },
        note: `Stem separation fallback: ${err.message}`,
      };
    }
  }
}

export const audioStemService = new AudioStemService();
