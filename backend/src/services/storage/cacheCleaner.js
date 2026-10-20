import fs from "node:fs/promises";
import path from "node:path";
import { fileManager } from "./fileManager.js";
import { logger } from "../../utils/logger.js";

export async function cleanOldTempFiles(maxAgeMs = 24 * 60 * 60 * 1000) {
  const tempDir = fileManager.dirs.temp;
  try {
    const files = await fs.readdir(tempDir);
    const now = Date.now();
    let cleaned = 0;

    for (const file of files) {
      const fullPath = path.join(tempDir, file);
      const stat = await fs.stat(fullPath);
      if (now - stat.mtimeMs > maxAgeMs) {
        await fs.rm(fullPath, { recursive: true, force: true });
        cleaned++;
      }
    }
    if (cleaned > 0) {
      logger.info(`Cleaned ${cleaned} expired temp files from cache.`);
    }
    return { success: true, cleaned };
  } catch (err) {
    logger.error("Failed to clean temp cache:", err);
    return { success: false, error: err.message };
  }
}
