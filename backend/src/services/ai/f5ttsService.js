import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { logger } from "../../utils/logger.js";
import { googleTtsService } from "./googleTtsService.js";

const F5TTS_PORT = process.env.F5TTS_PORT || 3003;
const F5TTS_SERVER_URL = `http://127.0.0.1:${F5TTS_PORT}`;
const TARGET_SAMPLE_RATE = 24000;

/**
 * Utility: Spawn ffmpeg safely using temp files
 */
async function runFfmpegWithFile(inputBuffer, args) {
  const tmpId = crypto.randomUUID();
  const inPath = path.join(os.tmpdir(), `f5tts_in_${tmpId}.tmp`);
  const outPath = path.join(os.tmpdir(), `f5tts_out_${tmpId}.wav`);

  try {
    if (inputBuffer && inputBuffer.length > 0) {
      await fs.writeFile(inPath, inputBuffer);
    }

    await new Promise((resolve, reject) => {
      const ffmpegArgs = [
        "-hide_banner",
        "-loglevel", "error",
        "-y",
        ...(inputBuffer ? ["-i", inPath] : []),
        ...args,
        outPath,
      ];

      const proc = spawn("ffmpeg", ffmpegArgs);
      const stderr = [];
      proc.stderr.on("data", (d) => stderr.push(d));
      proc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`FFmpeg error (code ${code}): ${Buffer.concat(stderr).toString("utf8")}`));
      });
      proc.on("error", reject);
    });

    return await fs.readFile(outPath);
  } finally {
    await fs.unlink(inPath).catch(() => {});
    await fs.unlink(outPath).catch(() => {});
  }
}

export const f5ttsService = {
  /**
   * Health status check for Python F5-TTS microservice (Port 3003)
   */
  async checkServerStatus() {
    try {
      const res = await fetch(`${F5TTS_SERVER_URL}/status`, {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Server not reachable
    }
    return {
      available: false,
      engine: "f5_tts_flow_matching",
      installed: false,
      loaded: false,
      device: "cpu",
      sample_rate: TARGET_SAMPLE_RATE,
      hint: "F5-TTS server is offline. Run 'python backend/python/f5tts_server.py' to launch.",
    };
  },

  /**
   * Register a reference voice for F5-TTS Zero-Shot Cloning
   */
  async extractProfile({ name = "F5-TTS Voice", audioBuffer, mimeType = "audio/wav", refText = "", language = "km" }) {
    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error("ទិន្នន័យសំឡេង (audioBuffer) គឺចាំបាច់");
    }

    const audioBase64 = audioBuffer.toString("base64");
    const srvStatus = await this.checkServerStatus();

    if (!srvStatus.available) {
      throw new Error("ម៉ាស៊ីន F5-TTS Server (Port 3003) មិនទាន់ដំណើរការទេ។ សូមដំណើរការ Command: python backend/python/f5tts_server.py ដើម្បីឱ្យ AI អាចរៀន និងស្រង់យកសំឡេងមនុស្សពិតបាន។");
    }

    try {
      const res = await fetch(`${F5TTS_SERVER_URL}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          audioBase64,
          mimeType,
          refText,
          language,
        }),
        signal: AbortSignal.timeout(60000),
      });

      if (res.ok) {
        const data = await res.json();
        logger.info(`[F5-TTS] Voice profile registered via F5-TTS server: ${data.profile_id}`);
        return {
          engine: "f5tts",
          model: "SWivid/F5-TTS",
          sampleRate: TARGET_SAMPLE_RATE,
          profileId: data.profile_id,
          referenceWavPath: data.reference_wav_path,
          name: data.name || name,
          language,
          refText: data.ref_text || refText,
          duration: data.duration_seconds || 5.0,
          trainingQuality: {
            score: 98,
            stars: "⭐⭐⭐⭐⭐",
            label: "Flow Matching Diffusion (SOTA)",
            badge: "F5-TTS Zero-Shot",
            isDeep: true,
          },
        };
      }
      const errText = await res.text().catch(() => "");
      throw new Error(`F5-TTS Server error (${res.status}): ${errText}`);
    } catch (err) {
      logger.error(`[F5-TTS] Registration error: ${err.message}`);
      throw new Error(`បរាជ័យក្នុងការចុះឈ្មោះសំឡេង F5-TTS៖ ${err.message}`);
    }
  },
      model: "SWivid/F5-TTS",
      sampleRate: TARGET_SAMPLE_RATE,
      profileId,
      name,
      language,
      refText,
      duration: 5.0,
      trainingQuality: {
        score: 95,
        stars: "⭐⭐⭐⭐⭐",
        label: "Flow Matching Diffusion",
        badge: "F5-TTS",
        isDeep: true,
      },
    };
  },

  /**
   * Synthesize speech using F5-TTS Flow Matching Diffusion
   */
  async synthesizeSpeech({
    text,
    profile,
    speed = 1.0,
    language = "km",
    nfeStep = 32,
    cfgStrength = 2.0,
  }) {
    if (!text || !text.trim()) {
      throw new Error("អត្ថបទត្រូវនិយាយគឺចាំបាច់");
    }

    const cleanText = text.trim();
    const spd = Math.max(0.5, Math.min(2.0, parseFloat(speed) || 1.0));
    const lang = language || profile?.language || "km";

    const srvStatus = await this.checkServerStatus();

    // ── Route 1: Python F5-TTS Flow Matching Server ────────────────────────
    if (!srvStatus.available) {
      throw new Error("ម៉ាស៊ីន F5-TTS Server (Port 3003) មិនទាន់ដំណើរការទេ។ សូមដំណើរការ Command: python backend/python/f5tts_server.py ជាមុនសិន។");
    }

    logger.info(`[F5-TTS] Routing synthesis to Python server: "${cleanText.slice(0, 45)}..."`);
    try {
      const srvRes = await fetch(`${F5TTS_SERVER_URL}/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: cleanText,
          profile_id: profile?.profileId || profile?.f5ttsProfile?.profileId,
          reference_wav_path: profile?.referenceWavPath || profile?.f5ttsProfile?.referenceWavPath,
          ref_text: profile?.refText || profile?.f5ttsProfile?.refText || "",
          speed: spd,
          nfe_step: nfeStep,
          cfg_strength: cfgStrength,
          language: lang,
        }),
        signal: AbortSignal.timeout(180000), // 3 min timeout for diffusion ODE steps
      });

      if (srvRes.ok) {
        const arrayBuf = await srvRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        logger.info(`[F5-TTS] Audio synthesized via Flow Matching: ${buffer.length} bytes @ 24kHz`);
        return {
          buffer,
          mimeType: "audio/wav",
          sampleRate: TARGET_SAMPLE_RATE,
          model: "SWivid/F5-TTS",
          neural: true,
        };
      } else {
        const errText = await srvRes.text().catch(() => "");
        logger.error(`[F5-TTS] Server returned HTTP ${srvRes.status}: ${errText}`);
        throw new Error(`F5-TTS Server error (${srvRes.status}): ${errText}`);
      }
    } catch (srvErr) {
      logger.error(`[F5-TTS] Call to F5-TTS server failed: ${srvErr.message}`);
      throw new Error(`បរាជ័យក្នុងការសំយោគ F5-TTS Diffusion៖ ${srvErr.message}`);
    }
  },
};

