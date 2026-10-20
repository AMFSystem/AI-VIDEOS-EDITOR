import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

export class FileService {
  constructor() {
    this.scratchDir = path.join(os.tmpdir(), "ai-video-editor-cache");
  }

  async ensureScratchDir() {
    try {
      await fs.mkdir(this.scratchDir, { recursive: true });
    } catch {
      // Ignore if exists
    }
    return this.scratchDir;
  }

  async getDiskInfo() {
    return {
      tmpDir: os.tmpdir(),
      scratchDir: this.scratchDir,
      totalMemMB: Math.round(os.totalmem() / 1024 / 1024),
      freeMemMB: Math.round(os.freemem() / 1024 / 1024),
    };
  }

  async clearScratchCache() {
    try {
      await fs.rm(this.scratchDir, { recursive: true, force: true });
      await this.ensureScratchDir();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

export const fileService = new FileService();
