import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { logger } from "../../utils/logger.js";
import { config } from "../../config/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = path.resolve(__dirname, "../../../");
const PYTHON_DIR = path.resolve(BACKEND_DIR, "python");
const PYVIDEOTRANS_DIR = path.resolve(PYTHON_DIR, "pyvideotrans");
const RUNNER_SCRIPT = path.resolve(PYTHON_DIR, "pyvideotrans_runner.py");
const PARAMS_PATH = path.resolve(PYVIDEOTRANS_DIR, "videotrans", "params.json");
const CFG_PATH = path.resolve(PYVIDEOTRANS_DIR, "videotrans", "cfg.json");

export const pyvideotransService = {
  /**
   * Read configuration files (params.json and cfg.json) from PyVideoTrans
   */
  async getConfig() {
    let params = {};
    let cfg = {};

    try {
      if (fs.existsSync(PARAMS_PATH)) {
        params = JSON.parse(fs.readFileSync(PARAMS_PATH, "utf-8"));
      }
    } catch (err) {
      logger.warn(`[PyVideoTrans] Could not parse params.json: ${err.message}`);
    }

    try {
      if (fs.existsSync(CFG_PATH)) {
        cfg = JSON.parse(fs.readFileSync(CFG_PATH, "utf-8"));
      }
    } catch (err) {
      logger.warn(`[PyVideoTrans] Could not parse cfg.json: ${err.message}`);
    }

    return { params, cfg };
  },

  /**
   * Save configuration updates to PyVideoTrans params.json and cfg.json
   */
  async saveConfig(updates = {}) {
    const { params: newParams, cfg: newCfg } = updates;
    let savedParams = false;
    let savedCfg = false;

    if (newParams && typeof newParams === "object") {
      try {
        let existing = {};
        if (fs.existsSync(PARAMS_PATH)) {
          try {
            existing = JSON.parse(fs.readFileSync(PARAMS_PATH, "utf-8"));
          } catch {}
        }
        const merged = { ...existing, ...newParams };
        fs.writeFileSync(PARAMS_PATH, JSON.stringify(merged, null, 2), "utf-8");
        savedParams = true;
      } catch (err) {
        logger.error(`[PyVideoTrans] Failed to save params.json: ${err.message}`);
        throw new Error(`Failed to save params.json: ${err.message}`);
      }
    }

    if (newCfg && typeof newCfg === "object") {
      try {
        let existing = {};
        if (fs.existsSync(CFG_PATH)) {
          try {
            existing = JSON.parse(fs.readFileSync(CFG_PATH, "utf-8"));
          } catch {}
        }
        const merged = { ...existing, ...newCfg };
        fs.writeFileSync(CFG_PATH, JSON.stringify(merged, null, 2), "utf-8");
        savedCfg = true;
      } catch (err) {
        logger.error(`[PyVideoTrans] Failed to save cfg.json: ${err.message}`);
        throw new Error(`Failed to save cfg.json: ${err.message}`);
      }
    }

    return {
      success: true,
      savedParams,
      savedCfg,
      message: "PyVideoTrans configuration updated successfully",
    };
  },

  /**
   * Health and capability status of original PyVideoTrans engine
   */
  async checkStatus() {
    const hasRepo = fs.existsSync(path.resolve(PYVIDEOTRANS_DIR, "cli.py"));
    return {
      available: hasRepo,
      engine: "pyvideotrans",
      name: "PyVideoTrans 100% Native Engine",
      repoDir: PYVIDEOTRANS_DIR,
      features: [
        "faster-whisper-local",
        "google-translate-free",
        "microsoft-translate-free",
        "edge-tts-free-khmer",
        "atempo-sync-alignment",
        "vocal-bgm-separation",
        "hard-soft-subtitles",
      ],
    };
  },

  /**
   * Execute full video translation, recognition, dubbing and assembly pipeline
   * using 100% official pyvideotrans engine.
   */
  async runTranslation(options, onEvent = () => {}) {
    const {
      name,
      sourceLang = "zh-cn",
      targetLang = "km",
      voiceRole = "Piseth(Male/KH)",
      modelName = "tiny",
      recognType = 0,
      translateType = 0,
      ttsType = 0,
      voiceRate = "+0%",
      volume = "+0%",
      pitch = "+0Hz",
      voiceAutoRate = true,
      videoAutoRate = false,
      isSeparate = false,
      embedBgm = true,
      backaudioVolume = 0.8,
      cuda = false,
      subtitleType = 2,
    } = options;

    if (!name || !fs.existsSync(name)) {
      throw new Error(`File not found: ${name}`);
    }

    const runId = `pyvt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const tempDir = path.resolve(BACKEND_DIR, "storage", "temp", runId);
    fs.mkdirSync(tempDir, { recursive: true });

    const targetDir = path.resolve(tempDir, "output");
    fs.mkdirSync(targetDir, { recursive: true });

    // Safeguard: CUDA is strictly for NVIDIA GPUs on Linux/Windows.
    // On macOS (Darwin), CUDA does not exist; disable is_cuda to prevent CTranslate2 CUDA errors.
    const isDarwin = process.platform === "darwin";
    const effectiveCuda = isDarwin ? false : Boolean(cuda);

    const configPayload = {
      name: path.resolve(name),
      target_dir: targetDir,
      cache_folder: path.resolve(tempDir, "cache"),
      source_language_code: sourceLang === "auto" ? "auto" : sourceLang,
      target_language_code: targetLang || "km",
      recogn_type: Number(recognType) || 0,
      model_name: modelName || "tiny",
      translate_type: Number(translateType) || 0,
      tts_type: Number(ttsType) || 0,
      voice_role: voiceRole || "Piseth(Male/KH)",
      voice_rate: String(voiceRate).includes("%") ? voiceRate : `${voiceRate >= 0 ? "+" : ""}${voiceRate}%`,
      volume: String(volume).includes("%") ? volume : `${volume >= 0 ? "+" : ""}${volume}%`,
      pitch: String(pitch).includes("Hz") ? pitch : `${pitch >= 0 ? "+" : ""}${pitch}Hz`,
      voice_autorate: Boolean(voiceAutoRate),
      video_autorate: Boolean(videoAutoRate),
      is_separate: Boolean(isSeparate),
      embed_bgm: Boolean(embedBgm),
      backaudio_volume: parseFloat(backaudioVolume) || 0.8,
      is_cuda: effectiveCuda,
      subtitle_type: Number(subtitleType) || 0,
      clear_cache: false,
    };

    const configPath = path.resolve(tempDir, "config.json");
    fs.writeFileSync(configPath, JSON.stringify(configPayload, null, 2), "utf-8");

    logger.info(`[PyVideoTrans] Starting native task for ${path.basename(name)} (${sourceLang} -> ${targetLang})`);

    return new Promise((resolve, reject) => {
      const uvPath = fs.existsSync("/Users/hr/.local/bin/uv") ? "/Users/hr/.local/bin/uv" : "uv";
      const extendedPath = ["/Users/hr/.local/bin", "/opt/homebrew/bin", "/usr/local/bin", process.env.PATH].filter(Boolean).join(":");
      const dyldFallback = ["/opt/homebrew/lib", "/usr/local/lib", process.env.DYLD_FALLBACK_LIBRARY_PATH].filter(Boolean).join(":");

      const child = spawn(uvPath, ["run", "python", RUNNER_SCRIPT, "--config", configPath], {
        cwd: PYVIDEOTRANS_DIR,
        env: {
          ...process.env,
          PATH: extendedPath,
          PYTHONUNBUFFERED: "1",
          DYLD_FALLBACK_LIBRARY_PATH: dyldFallback,
        },
      });

      let stdoutAccum = "";
      let finalResult = null;
      let lastErrorMessage = "";

      child.stdout.on("data", (chunk) => {
        const text = chunk.toString();
        stdoutAccum += text;
        const lines = text.split("\n");

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed.startsWith("__PYVT_EVENT__")) {
            try {
              const eventData = JSON.parse(trimmed.replace("__PYVT_EVENT__", ""));
              if (eventData.type === "done") {
                finalResult = eventData;
              } else if (eventData.type === "error") {
                lastErrorMessage = eventData.error;
              }
              onEvent(eventData);
            } catch (err) {
              logger.warn(`Failed to parse pyvt event: ${err.message}`);
            }
          } else {
            // General stdout output
            if (!trimmed.includes("Uninstalled") && !trimmed.includes("Installed")) {
              onEvent({ type: "log", message: trimmed });
            }
          }
        }
      });

      child.stderr.on("data", (chunk) => {
        const errText = chunk.toString();
        const lines = errText.split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.includes("DEBUG") && !trimmed.includes("filelock")) {
            onEvent({ type: "log", message: trimmed, isError: true });
            lastErrorMessage = trimmed;
          }
        }
      });

      child.on("close", (code) => {
        try { fs.unlinkSync(configPath); } catch {}

        if (code === 0 && finalResult) {
          logger.info(`[PyVideoTrans] Completed native dubbing task ${runId}`);
          resolve(finalResult);
        } else {
          const err = lastErrorMessage || `PyVideoTrans execution failed with exit code ${code}`;
          logger.error(`[PyVideoTrans] ${err}`);
          reject(new Error(err));
        }
      });

      child.on("error", (err) => {
        logger.error(`[PyVideoTrans] Failed to spawn process: ${err.message}`);
        reject(err);
      });
    });
  },

  /**
   * Check / Setup PyVideoTrans repository status
   */
  async setupRepo() {
    const isReady = fs.existsSync(path.resolve(PYVIDEOTRANS_DIR, "videotrans"));
    return {
      success: true,
      isReady,
      repoDir: PYVIDEOTRANS_DIR,
      runnerScript: RUNNER_SCRIPT,
      message: isReady ? "PyVideoTrans is configured and ready" : "PyVideoTrans repository not found",
    };
  },

  /**
   * Separate BGM / Instrumental track from audio/video buffer
   */
  async separateBgm(buffer, filename = "input.mp4") {
    const tmpInput = path.resolve(BACKEND_DIR, "storage", "temp", `stem_in_${Date.now()}_${filename}`);
    const tmpOutput = path.resolve(BACKEND_DIR, "storage", "temp", `stem_out_${Date.now()}.wav`);

    fs.writeFileSync(tmpInput, buffer);

    return new Promise((resolve, reject) => {
      // Use FFmpeg vocal attenuation / center-channel cancellation filter for fast BGM isolation
      const args = [
        "-y",
        "-i", tmpInput,
        "-af", "pan=stereo|c0=c0-c1|c1=c1-c0",
        "-c:a", "pcm_s16le",
        tmpOutput,
      ];

      const proc = spawn(config.ffmpegPath, args);
      proc.on("close", (code) => {
        try { fs.unlinkSync(tmpInput); } catch {}
        if (code === 0 && fs.existsSync(tmpOutput)) {
          const outBuffer = fs.readFileSync(tmpOutput);
          try { fs.unlinkSync(tmpOutput); } catch {}
          resolve(outBuffer);
        } else {
          try { fs.unlinkSync(tmpOutput); } catch {}
          reject(new Error(`BGM separation failed with exit code ${code}`));
        }
      });
      proc.on("error", (err) => {
        try { fs.unlinkSync(tmpInput); } catch {}
        try { fs.unlinkSync(tmpOutput); } catch {}
        reject(err);
      });
    });
  },
};
