// Browser Origin Private File System (OPFS) for caching large video media locally
export class OpfsStorage {
  async getRoot() {
    if (typeof navigator !== "undefined" && navigator.storage?.getDirectory) {
      return navigator.storage.getDirectory();
    }
    return null;
  }

  async saveFile(name, blob) {
    const root = await this.getRoot();
    if (!root) return false;
    try {
      const fileHandle = await root.getFileHandle(name, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch {
      return false;
    }
  }

  async getFile(name) {
    const root = await this.getRoot();
    if (!root) return null;
    try {
      const fileHandle = await root.getFileHandle(name);
      return fileHandle.getFile();
    } catch {
      return null;
    }
  }
}

export const opfsStorage = new OpfsStorage();
