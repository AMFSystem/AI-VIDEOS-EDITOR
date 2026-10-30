import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { config } from "../../config/index.js";

export class FileManager {
  constructor() {
    this.baseDir = config.storagePath;
    this.dirs = {
      uploads: path.join(this.baseDir, "uploads"),
      proxies: path.join(this.baseDir, "proxies"),
      ai_cache: path.join(this.baseDir, "ai_cache"),
      projects: path.join(this.baseDir, "projects"),
      temp: path.join(this.baseDir, "temp"),
      exports: path.join(this.baseDir, "exports"),
      voices: path.join(this.baseDir, "voices"),
    };
  }

  async init() {
    for (const [key, dir] of Object.entries(this.dirs)) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (err) {
        console.warn(`[FileManager] Primary mkdir failed for ${dir} (${err.code}), falling back to user temp.`);
        // Fallback to user temp if AppData or Program Files has permission issues
        try {
          const fallbackBase = path.join(os.tmpdir(), "ai-video-editor-storage");
          const fallbackDir = path.join(fallbackBase, key);
          await fs.mkdir(fallbackDir, { recursive: true });
          this.dirs[key] = fallbackDir;
        } catch {}
      }
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
