import { spawn } from "node:child_process";
import { logger } from "../../utils/logger.js";

function splitText(text, maxLen = 160) {
  if (!text) return [];
  const clean = String(text).trim();
  if (clean.length <= maxLen) return [clean];

  const parts = [];
  const sentences = clean.split(/([។\n\r!?]+)/);
  let current = "";
  for (const part of sentences) {
    if ((current + part).length > maxLen) {
      if (current.trim()) parts.push(current.trim());
      current = part;
    } else {
      current += part;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts.length > 0 ? parts : [clean];
}

async function adjustSpeed(buffer, speed = 1.0) {
  if (speed === 1.0 || Math.abs(speed - 1.0) < 0.02) return buffer;
  const clamped = Math.max(0.5, Math.min(2.0, speed));
  return new Promise((resolve) => {
    const proc = spawn("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      "pipe:0",
      "-filter:a",
      `atempo=${clamped}`,
      "-f",
      "mp3",
      "pipe:1",
    ]);
    const chunks = [];
    proc.stdout.on("data", (c) => chunks.push(c));
    proc.on("close", (code) => {
      if (code === 0 && chunks.length > 0) resolve(Buffer.concat(chunks));
      else resolve(buffer);
    });
    proc.on("error", () => resolve(buffer));
    proc.stdin.write(buffer);
    proc.stdin.end();
  });
}

export const googleTtsService = {
  async synthesize(text, options = {}) {
    const { lang = "km", speed = 1.0 } = options;
    const chunks = splitText(text);
    if (chunks.length === 0) {
      throw new Error("Text is empty");
    }

    const buffers = [];
    for (const chunk of chunks) {
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${encodeURIComponent(lang)}&client=tw-ob&q=${encodeURIComponent(chunk)}`;
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Referer: "https://translate.google.com/",
        },
      });
      if (!res.ok) {
        throw new Error(`Google TTS returned HTTP ${res.status}`);
      }
      const arrayBuf = await res.arrayBuffer();
      buffers.push(Buffer.from(arrayBuf));
    }

    let combined = Buffer.concat(buffers);
    if (speed !== 1.0) {
      try {
        combined = await adjustSpeed(combined, speed);
      } catch (err) {
        logger.warn("Failed to adjust TTS speed with ffmpeg:", err.message);
      }
    }

    return combined;
  },
};
