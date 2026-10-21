import express from "express";
import cors from "cors";
import { corsConfig } from "./config/corsConfig.js";
import { apiRouter } from "./api/routes/index.js";
import { errorHandler } from "./api/middlewares/errorHandler.js";
import { fileManager } from "./services/storage/fileManager.js";

export const app = express();

// Initialize Storage directories
await fileManager.init();

app.use(cors(corsConfig));
app.use((_req, res, next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
});
app.use(express.json({ limit: "500mb" }));
app.use(express.urlencoded({ extended: true, limit: "500mb" }));

// Static file hosting for uploads and exports
app.use("/storage", express.static(fileManager.baseDir));

// API Routes
app.use("/api", apiRouter);

// Error Handling Middleware
app.use(errorHandler);
