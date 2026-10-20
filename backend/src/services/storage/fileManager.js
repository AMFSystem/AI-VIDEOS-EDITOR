import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../../config/index.js";

export class FileManager {
  constructor() {
    this.baseDir = config.storagePath;
    this.dirs = {
      uploads: path.join(this.baseDir, "uploads"),
      proxies: path.join(this.baseDir, "proxies"),
      ai_cache: path.join(this.baseDir, "ai_cache"),
      temp: path.join(this.baseDir, "temp"),
      exports: path.join(this.baseDir, "exports"),
    };
  }

  async init() {
    for (const dir of Object.values(this.dirs)) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  getFilePath(category, filename) {
    const dir = this.dirs[category] || this.dirs.temp;
    return path.join(dir, filename);
  }

  async listFiles(category) {
    const dir = this.dirs[category];
    if (!dir) return [];
    try {
      const files = await fs.readdir(dir);
      return files.filter((f) => !f.startsWith("."));
    } catch {
      return [];
    }
  }
}

export const fileManager = new FileManager();
