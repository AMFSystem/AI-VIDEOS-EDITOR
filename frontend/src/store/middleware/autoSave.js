// IndexedDB / LocalStorage autosave middleware
export class AutoSaveMiddleware {
  constructor(storageKey = "timeline_studio_autosave") {
    this.storageKey = storageKey;
  }

  save(data) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify({ data, savedAt: Date.now() }));
    } catch {
      // Ignore quota exceeded
    }
  }

  load() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}
