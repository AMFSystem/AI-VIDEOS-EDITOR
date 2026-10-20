import { logger } from "../../utils/logger.js";

export function errorHandler(err, _req, res, _next) {
  logger.error("Unhandled error:", err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || "Internal Server Error",
    timestamp: new Date().toISOString(),
  });
}
