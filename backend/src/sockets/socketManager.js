import { WebSocketServer } from "ws";
import { logger } from "../utils/logger.js";

export class SocketManager {
  constructor() {
    this.wss = null;
    this.clients = new Set();
  }

  init(httpServer) {
    try {
      this.wss = new WebSocketServer({ server: httpServer, path: "/ws" });
      this.wss.on("error", (err) => {
        logger.warn("[WebSocket] WebSocketServer warning: " + (err?.message || err));
      });
      this.wss.on("connection", (ws) => {
        this.clients.add(ws);
        logger.info("[WebSocket] Client connected. Total clients: " + this.clients.size);

        ws.on("close", () => {
          this.clients.delete(ws);
          logger.info("[WebSocket] Client disconnected.");
        });

        ws.on("message", (message) => {
          logger.debug("[WebSocket] Received message: " + message);
        });
      });
    } catch (err) {
      logger.warn("[WebSocket] WebSocketServer could not be initialized:", err.message);
    }
  }

  broadcast(event, data) {
    if (!this.wss) return;
    const payload = JSON.stringify({ event, data, timestamp: Date.now() });
    for (const client of this.clients) {
      if (client.readyState === 1) { // OPEN
        client.send(payload);
      }
    }
  }
}

export const socketManager = new SocketManager();
