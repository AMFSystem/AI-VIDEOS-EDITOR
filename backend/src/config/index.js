import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../../");
const workspaceRoot = path.resolve(rootDir, "../");

// Safely load environment variables from .env if present
if (typeof process.loadEnvFile === "function") {
  const backendEnv = path.resolve(rootDir, ".env");
  const rootEnv = path.resolve(workspaceRoot, ".env");
  if (fs.existsSync(backendEnv)) {
    try { process.loadEnvFile(backendEnv); } catch {}
  } else if (fs.existsSync(rootEnv)) {
    try { process.loadEnvFile(rootEnv); } catch {}
  }
}

export const config = {
  port: parseInt(process.env.PORT || "3001", 10),
  host: process.env.HOST || "127.0.0.1",
  storagePath: process.env.STORAGE_PATH
    ? path.resolve(process.env.STORAGE_PATH)
    : path.resolve(rootDir, "./storage"),
  ffmpegPath: process.env.FFMPEG_PATH || "ffmpeg",
  ffprobePath: process.env.FFPROBE_PATH || "ffprobe",
  comfyUiUrl: process.env.COMFYUI_URL || "http://127.0.0.1:8188",
  openAiApiKey: process.env.OPENAI_API_KEY || "",
  geminiApiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.VITE_GEMINI_API_KEY || "",
  elevenLabsApiKey: process.env.ELEVENLABS_API_KEY || "",
  modelsDir: process.env.AI_MODELS_DIR
    ? path.resolve(process.env.AI_MODELS_DIR)
    : path.resolve(rootDir, "ai_clone/models"),
};

