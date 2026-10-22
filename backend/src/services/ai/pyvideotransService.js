import { logger } from "../../utils/logger.js";

const PYVIDEOTRANS_PORT = process.env.PYVIDEOTRANS_PORT || 3004;
const PYVIDEOTRANS_URL = `http://127.0.0.1:${PYVIDEOTRANS_PORT}`;

export const pyvideotransService = {
  /**
   * Health and capability status of PyVideoTrans microservice
   */
  async checkStatus() {
    try {
      const res = await fetch(`${PYVIDEOTRANS_URL}/status`, {
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
      engine: "pyvideotrans",
      name: "PyVideoTrans Video Dubber",
      github: "https://github.com/jianchang512/pyvideotrans",
      hint: "PyVideoTrans server is offline. Run 'python backend/python/pyvideotrans_server.py' to launch.",
    };
  },

  /**
   * Auto-align and synchronize dubbed segments to exact video timecodes
   */
  async alignAndMixDubbing({ segments, preserveBgm = true, bgmVolume = 0.25, voiceVolume = 1.0 }) {
    if (!segments || segments.length === 0) {
      throw new Error("បញ្ជី Segments គឺចាំបាច់");
    }

    const srvStatus = await this.checkStatus();
    if (!srvStatus.available) {
      logger.warn("[PyVideoTrans] Server offline, falling back to basic audio assembly");
      throw new Error("PyVideoTrans Server មិនទាន់ដំណើរការ (Port 3004)");
    }

    logger.info(`[PyVideoTrans] Aligning and mixing ${segments.length} dubbed audio segments...`);
    const res = await fetch(`${PYVIDEOTRANS_URL}/align-dub`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        segments,
        preserveBgm,
        bgmVolume,
        voiceVolume,
      }),
      signal: AbortSignal.timeout(180000), // 3 min timeout for long video mixing
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`PyVideoTrans audio alignment failed: ${err}`);
    }

    const arrayBuf = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    logger.info(`[PyVideoTrans] Aligned master audio generated: ${buffer.length} bytes @ 24kHz`);
    return {
      buffer,
      mimeType: "audio/wav",
      sampleRate: 24000,
    };
  },

  /**
   * Clone or update PyVideoTrans repository
   */
  async setupRepo() {
    try {
      const res = await fetch(`${PYVIDEOTRANS_URL}/setup-repo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch: "main" }),
        signal: AbortSignal.timeout(120000),
      });
      return await res.json();
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
};

