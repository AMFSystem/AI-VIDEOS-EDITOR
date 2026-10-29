import { Router } from "express";
import http from "node:http";
import net from "node:net";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { Readable } from "node:stream";
import { fileManager } from "../../services/storage/fileManager.js";
import { config } from "../../config/index.js";
import { logger } from "../../utils/logger.js";

const execAsync = promisify(exec);
export const v1Router = Router();

function checkPortOpen(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(250);
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", () => {
      resolve(false);
    });
    socket.connect(port, host);
  });
}

async function getAudioDuration(filePath) {
  try {
    const { stdout } = await execAsync(
      `"${config.ffprobePath}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`
    );
    const dur = parseFloat(stdout.trim());
    if (!isNaN(dur) && dur > 0) return Math.round(dur * 100) / 100;
  } catch {}
  return 15.0;
}

// Master /api/v1 Dispatcher: Proxy to port 8000 when available, or handle with local fallback
v1Router.use(async (req, res, next) => {
  const isFastApiRunning = await checkPortOpen(8000);

  if (isFastApiRunning) {
    // Pipe directly to FastAPI on Port 8000
    const proxyReq = http.request(
      {
        hostname: "127.0.0.1",
        port: 8000,
        path: `/api/v1${req.url}`,
        method: req.method,
        headers: {
          ...req.headers,
          host: "127.0.0.1:8000",
        },
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
      }
    );

    proxyReq.on("error", (err) => {
      logger.warn(`[Proxy /api/v1] Error during pipe to FastAPI: ${err.message}`);
      if (!res.headersSent) {
        res.status(502).json({ error: "AI Engine connection error", detail: err.message });
      }
    });

    req.pipe(proxyReq);
    return;
  }

  // --- LOCAL FALLBACK (When FastAPI is not yet running) ---
  const voicesDir = fileManager.dirs.voices;
  const manifestPath = path.join(voicesDir, "voices.json");

  const loadManifest = async () => {
    try {
      if (fsSync.existsSync(manifestPath)) {
        const raw = await fs.readFile(manifestPath, "utf-8");
        return JSON.parse(raw);
      }
    } catch {}
    return [];
  };

  const saveManifest = async (data) => {
    await fs.mkdir(voicesDir, { recursive: true });
    await fs.writeFile(manifestPath, JSON.stringify(data, null, 2), "utf-8");
  };

  const cleanUrl = req.url.split("?")[0].replace(/\/$/, "");

  // 1. GET /api/v1/voices
  if (req.method === "GET" && cleanUrl === "/voices") {
    const voices = await loadManifest();
    return res.json(voices);
  }

  // 2. POST /api/v1/voices (Adding new character voice)
  if (req.method === "POST" && cleanUrl === "/voices") {
    try {
      const formData = await new Response(Readable.toWeb(req), {
        headers: { "content-type": req.headers["content-type"] || "multipart/form-data" },
      }).formData();

      const voiceAlias = String(formData.get("voice_alias") || "Custom Voice").trim();
      const referenceText = String(formData.get("reference_text") || "").trim();
      const audioFile = formData.get("reference_audio");

      const voiceId = crypto.randomUUID();
      const audioFileName = `${voiceId}.wav`;
      const targetAudioPath = path.join(voicesDir, audioFileName);

      await fs.mkdir(voicesDir, { recursive: true });

      if (audioFile && typeof audioFile.arrayBuffer === "function") {
        const buffer = Buffer.from(await audioFile.arrayBuffer());
        await fs.writeFile(targetAudioPath, buffer);
      } else {
        // Fallback placeholder audio if empty
        await fs.writeFile(targetAudioPath, Buffer.alloc(1024));
      }

      const duration = await getAudioDuration(targetAudioPath);

      const newVoice = {
        id: voiceId,
        voice_alias: voiceAlias,
        reference_text: referenceText || "សំឡេងគំរូដែលបានរក្សាទុកក្នុងប្រព័ន្ធ។",
        reference_duration_seconds: duration,
        consent_confirmed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      const voices = await loadManifest();
      voices.unshift(newVoice);
      await saveManifest(voices);

      logger.info(`[Local Voice Fallback] Successfully created voice: ${voiceAlias} (${voiceId})`);
      return res.status(201).json(newVoice);
    } catch (err) {
      logger.error(`[Local Voice Fallback] Failed to save voice: ${err.message}`);
      return res.status(500).json({ error: "បរាជ័យក្នុងការរក្សាទុកសំឡេង", detail: err.message });
    }
  }

  // 3. GET /api/v1/voices/:id/audio
  const audioMatch = req.url.match(/^\/voices\/([^/]+)\/audio/);
  if (req.method === "GET" && audioMatch) {
    const voiceId = audioMatch[1];
    const audioPath = path.join(voicesDir, `${voiceId}.wav`);
    if (fsSync.existsSync(audioPath)) {
      res.setHeader("Content-Type", "audio/wav");
      return res.sendFile(audioPath);
    }
    return res.status(404).json({ error: "Voice audio not found" });
  }

  // 4. DELETE /api/v1/voices/:id
  const deleteMatch = req.url.match(/^\/voices\/([^/]+)$/);
  if (req.method === "DELETE" && deleteMatch) {
    const voiceId = deleteMatch[1];
    const audioPath = path.join(voicesDir, `${voiceId}.wav`);
    try {
      if (fsSync.existsSync(audioPath)) await fs.unlink(audioPath);
      const voices = await loadManifest();
      const filtered = voices.filter((v) => v.id !== voiceId);
      await saveManifest(filtered);
      return res.json({ success: true, message: "Voice deleted" });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // 5. GET /api/v1/training/models
  if (req.method === "GET" && req.url.startsWith("/training/models")) {
    return res.json([]);
  }

  // Fallback for heavy AI endpoints when FastAPI is not running
  return res.status(503).json({
    error: "AI Voice Studio (FastAPI) is currently offline or initializing.",
    detail: "FastAPI on port 8000 is not yet reachable. Please ensure the AI service is started.",
  });
});

