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
    const isFileProtocol = typeof window !== "undefined" && window.location.protocol === "file:";
    const backendBase =
      (window.desktopAPI?.getBackendUrl && window.desktopAPI.getBackendUrl()) ||
      "http://127.0.0.1:3001";

    if (isFileProtocol) {
      if (typeof input === "string") {
        if (input.startsWith("/api") || input.startsWith("/storage")) {
          input = `${backendBase}${input.startsWith("/") ? "" : "/"}${input}`;
        }
      } else if (input instanceof Request) {
        const url = input.url;
        if (
          url.startsWith("/api") ||
          url.startsWith("/storage") ||
          (!url.startsWith("http:") && !url.startsWith("https:"))
        ) {
          input = new Request(`${backendBase}${url.startsWith("/") ? "" : "/"}${url}`, input);
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
