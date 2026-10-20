import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../../");

export const config = {
  port: parseInt(process.env.PORT || "3001", 10),
  host: process.env.HOST || "127.0.0.1",
  storagePath: path.resolve(rootDir, process.env.STORAGE_PATH || "./storage"),
  ffmpegPath: process.env.FFMPEG_PATH || "ffmpeg",
  ffprobePath: process.env.FFPROBE_PATH || "ffprobe",
  comfyUiUrl: process.env.COMFYUI_URL || "http://127.0.0.1:8188",
  openAiApiKey: process.env.OPENAI_API_KEY || "",
};
