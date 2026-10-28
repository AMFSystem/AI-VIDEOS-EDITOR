import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import { corsConfig } from "./config/corsConfig.js";
import { apiRouter } from "./api/routes/index.js";
import { errorHandler } from "./api/middlewares/errorHandler.js";
import { fileManager } from "./services/storage/fileManager.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = process.env.FRONTEND_DIST || path.resolve(__dirname, "../../frontend/dist");

export const app = express();

// Initialize Storage directories
await fileManager.init();

app.use(cors(corsConfig));
app.use((_req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
});
app.use(express.json({ limit: "500mb" }));
app.use(express.urlencoded({ extended: true, limit: "500mb" }));

// Static file hosting for uploads and exports
app.use("/storage", express.static(fileManager.baseDir));

// API Routes
app.use("/api", apiRouter);

// Production Static Frontend Hosting
let resolvedDist = frontendDist;
if (!fs.existsSync(resolvedDist)) {
  const candidates = [
    path.resolve(__dirname, "../../frontend/dist"),
    path.resolve(__dirname, "../frontend/dist"),
    path.resolve(__dirname, "../dist"),
    path.resolve(__dirname, "../../dist"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      resolvedDist = c;
      break;
    }
  }
}

if (fs.existsSync(resolvedDist)) {
  app.use(express.static(resolvedDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/storage")) {
      return next();
    }
    res.sendFile(path.join(resolvedDist, "index.html"));
  });
}

// Error Handling Middleware
app.use(errorHandler);
