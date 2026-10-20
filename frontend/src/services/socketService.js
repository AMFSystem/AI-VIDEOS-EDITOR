// Real-time WebSocket connection to backend for render progress & AI status
export class SocketService {
  constructor() {
    this.ws = null;
    this.handlers = new Map();
  }

  connect(url = "ws://127.0.0.1:3001/ws") {
    if (typeof window === "undefined") return;
    try {
      this.ws = new WebSocket(url);

      this.ws.onmessage = (event) => {
        try {
          const { event: evtName, data } = JSON.parse(event.data);
          const listeners = this.handlers.get(evtName);
          if (listeners) {
            listeners.forEach((fn) => fn(data));
          }
        } catch {
          // Ignore parse errors
        }
      };

      this.ws.onclose = () => {
        setTimeout(() => this.connect(url), 3000);
      };
    } catch {
      // Ignore connection failures when backend is offline
    }
  }

  on(event, handler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event).add(handler);
    return () => this.handlers.get(event)?.delete(handler);
  }
}

export const socketService = new SocketService();
