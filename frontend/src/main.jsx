import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import { registerModelCacheServiceWorker } from "./lib/serviceWorker.js";
import "./styles.css";

// Global Local Backend URL interceptor:
// Ensures all /api/*, /api/v1/*, and /storage/* calls cleanly resolve to the active local backend (port 3001)
// across Windows and macOS packaged Desktop applications without "Failed to fetch" errors.
if (typeof window !== "undefined" && typeof window.fetch === "function") {
  const originalFetch = window.fetch;
  window.fetch = function (input, init) {
    const backendBase =
      (window.desktopAPI?.getBackendUrl && window.desktopAPI.getBackendUrl()) ||
      "http://127.0.0.1:3001";
    const isLocalServer =
      typeof window !== "undefined" &&
      (window.location.origin === "http://127.0.0.1:3001" ||
        window.location.origin === "http://localhost:3001");

    if (!isLocalServer) {
      if (typeof input === "string") {
        if (input.startsWith("/api") || input.startsWith("/storage")) {
          input = `${backendBase}${input.startsWith("/") ? "" : "/"}${input}`;
        } else if (
          input.startsWith("app://localhost/api") ||
          input.startsWith("app://localhost/storage")
        ) {
          input = input.replace("app://localhost", backendBase);
        }
      } else if (input instanceof Request) {
        const url = input.url;
        if (url.startsWith("/api") || url.startsWith("/storage")) {
          input = new Request(`${backendBase}${url.startsWith("/") ? "" : "/"}${url}`, input);
        } else if (
          url.startsWith("app://localhost/api") ||
          url.startsWith("app://localhost/storage")
        ) {
          input = new Request(url.replace("app://localhost", backendBase), input);
        }
      }
    }
    return originalFetch.call(this, input, init);
  };
}

registerModelCacheServiceWorker();

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
