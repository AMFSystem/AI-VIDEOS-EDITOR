import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import http from "node:http";
import { EventEmitter } from "node:events";
import { config } from "../../config/index.js";

export const modelEvents = new EventEmitter();

export const MODELS_REGISTRY = [
  // --- 1. SPEECH TO TEXT (STT & CAPTIONS) ---
  {
    id: "whisper-khmer",
    name: "Whisper Turbo Khmer v9 (CT2)",
    category: "stt",
    badge: "Khmer STT",
    description: "ម៉ូដែលបម្លែងសំឡេងនិយាយភាសាខ្មែរទៅជាអក្សរស្វ័យប្រវត្ត (CTranslate2 Int8 Optimized)",
    sizeBytes: 810 * 1024 * 1024,
    sizeFormatted: "810 MB",
    relDir: path.join("hf", "hub", "models--kavatana--whisper-turbo-khmer-v9-ct2-int8"),
    repo: "kavatana/whisper-turbo-khmer-v9-ct2-int8",
    keyFiles: ["model.bin", "config.json", "vocabulary.json", "tokenizer.json"],
    downloadUrls: [
      "https://huggingface.co/kavatana/whisper-turbo-khmer-v9-ct2-int8/resolve/main/model.bin",
      "https://huggingface.co/kavatana/whisper-turbo-khmer-v9-ct2-int8/resolve/main/config.json",
      "https://huggingface.co/kavatana/whisper-turbo-khmer-v9-ct2-int8/resolve/main/vocabulary.json",
      "https://huggingface.co/kavatana/whisper-turbo-khmer-v9-ct2-int8/resolve/main/tokenizer.json"
    ]
  },
  {
    id: "whisper-small-captions",
    name: "Whisper Small Word-Timestamped",
    category: "stt",
    badge: "Word Sync STT",
    description: "ម៉ូដែលបំបែកពាក្យ និងកំណត់ពេលវេលាអក្សររត់ស្វ័យប្រវត្តកម្រិត Word-Level Timestamps",
    sizeBytes: 460 * 1024 * 1024,
    sizeFormatted: "460 MB",
    relDir: path.join("hf", "hub", "models--onnx-community--whisper-small_timestamped"),
    repo: "onnx-community/whisper-small_timestamped",
    keyFiles: ["config.json", "tokenizer.json"],
    downloadUrls: [
      "https://huggingface.co/onnx-community/whisper-small_timestamped/resolve/main/config.json",
      "https://huggingface.co/onnx-community/whisper-small_timestamped/resolve/main/tokenizer.json",
      "https://huggingface.co/onnx-community/whisper-small_timestamped/resolve/main/onnx/encoder_model.onnx",
      "https://huggingface.co/onnx-community/whisper-small_timestamped/resolve/main/onnx/decoder_model_merged.onnx"
    ]
  },
  {
    id: "whisper-multilingual",
    name: "Faster-Whisper Large v3 Turbo",
    category: "stt",
    badge: "Universal STT",
    description: "ម៉ូដែលបម្លែងសំឡេងគ្រប់ភាសាលើពិភពលោក (English, Chinese, Thai, Vietnamese, etc.)",
    sizeBytes: 1540 * 1024 * 1024,
    sizeFormatted: "1.54 GB",
    relDir: path.join("whisper", "models--mobiuslabsgmbh--faster-whisper-large-v3-turbo"),
    repo: "mobiuslabsgmbh/faster-whisper-large-v3-turbo",
    keyFiles: ["model.bin", "config.json", "vocabulary.json", "tokenizer.json"],
    downloadUrls: [
      "https://huggingface.co/mobiuslabsgmbh/faster-whisper-large-v3-turbo/resolve/main/model.bin",
      "https://huggingface.co/mobiuslabsgmbh/faster-whisper-large-v3-turbo/resolve/main/config.json",
      "https://huggingface.co/mobiuslabsgmbh/faster-whisper-large-v3-turbo/resolve/main/vocabulary.json",
      "https://huggingface.co/mobiuslabsgmbh/faster-whisper-large-v3-turbo/resolve/main/tokenizer.json"
    ]
  },
  {
    id: "silero-vad",
    name: "Silero Voice Activity Detection v5",
    category: "stt",
    badge: "Audio VAD",
    description: "ម៉ូដែលចាប់យកសំឡេងមនុស្សនិយាយ និងកាត់ចន្លោះស្ងាត់ (Silence Cut) ដោយស្វ័យប្រវត្ត",
    sizeBytes: 2 * 1024 * 1024,
    sizeFormatted: "2.4 MB",
    relDir: path.join("hf", "hub", "models--silero-vad-v5"),
    repo: "haixin/timeline-studio-onnx-models",
    keyFiles: ["silero_vad.onnx"],
    downloadUrls: [
      "https://huggingface.co/haixin/timeline-studio-onnx-models/resolve/main/silero_vad.onnx"
    ]
  },

  // --- 2. TEXT TO SPEECH (TTS) ---
  {
    id: "mms-tts-khm",
    name: "Meta MMS-TTS Khmer Voice",
    category: "tts",
    badge: "Khmer Voice",
    description: "ម៉ូដែលសំឡេងនិយាយភាសាខ្មែរ Offline (Meta VITS MMS)",
    sizeBytes: 145 * 1024 * 1024,
    sizeFormatted: "145 MB",
    relDir: path.join("hf", "hub", "models--facebook--mms-tts-khm"),
    repo: "facebook/mms-tts-khm",
    keyFiles: ["pytorch_model.bin", "config.json", "vocab.json"],
    downloadUrls: [
      "https://huggingface.co/facebook/mms-tts-khm/resolve/main/pytorch_model.bin",
      "https://huggingface.co/facebook/mms-tts-khm/resolve/main/config.json",
      "https://huggingface.co/facebook/mms-tts-khm/resolve/main/vocab.json"
    ]
  },
  {
    id: "mms-tts-eng",
    name: "Meta MMS-TTS English Voice",
    category: "tts",
    badge: "English Voice",
    description: "ម៉ូដែលសំឡេងនិយាយភាសាអង់គ្លេស Offline (Meta VITS MMS)",
    sizeBytes: 145 * 1024 * 1024,
    sizeFormatted: "145 MB",
    relDir: path.join("hf", "hub", "models--facebook--mms-tts-eng"),
    repo: "facebook/mms-tts-eng",
    keyFiles: ["pytorch_model.bin", "config.json", "vocab.json"],
    downloadUrls: [
      "https://huggingface.co/facebook/mms-tts-eng/resolve/main/pytorch_model.bin",
      "https://huggingface.co/facebook/mms-tts-eng/resolve/main/config.json",
      "https://huggingface.co/facebook/mms-tts-eng/resolve/main/vocab.json"
    ]
  },
  {
    id: "kokoro-82m",
    name: "Kokoro-82M Multilingual Voice",
    category: "tts",
    badge: "Kokoro TTS",
    description: "ម៉ូដែលសំឡេងអានបែបធម្មជាតិកម្រិតខ្ពស់ 82M parameters គាំទ្រភាសាអង់គ្លេស និងភាសាផ្សេងៗ",
    sizeBytes: 340 * 1024 * 1024,
    sizeFormatted: "340 MB",
    relDir: path.join("hf", "hub", "models--onnx-community--Kokoro-82M-v1.0-ONNX"),
    repo: "onnx-community/Kokoro-82M-v1.0-ONNX",
    keyFiles: ["config.json", "onnx/model.onnx"],
    downloadUrls: [
      "https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/config.json",
      "https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/onnx/model.onnx"
    ]
  },
  {
    id: "piper-khmer",
    name: "Piper TTS Khmer Natural Voice",
    category: "tts",
    badge: "Piper Offline",
    description: "ម៉ូដែលសំឡេងនិយាយខ្មែរដារ៉ា ល្បឿនលឿនខ្លាំង ស៊ីធនធាន CPU តិចតួចបំផុត",
    sizeBytes: 65 * 1024 * 1024,
    sizeFormatted: "65 MB",
    relDir: path.join("hf", "hub", "models--rhasspy--piper-voices-km"),
    repo: "rhasspy/piper-voices",
    keyFiles: ["km_KH-dara-medium.onnx", "km_KH-dara-medium.onnx.json"],
    downloadUrls: [
      "https://huggingface.co/rhasspy/piper-voices/resolve/main/km/km_KH/dara/medium/km_KH-dara-medium.onnx",
      "https://huggingface.co/rhasspy/piper-voices/resolve/main/km/km_KH/dara/medium/km_KH-dara-medium.onnx.json"
    ]
  },

  // --- 3. VOICE CLONING & AUDIO STEMS ---
  {
    id: "voxcpm2-clone",
    name: "VoxCPM2 Neural Voice Clone (OpenBMB)",
    category: "clone",
    badge: "VoxCPM2 48kHz",
    description: "ម៉ូដែលចម្លងសំឡេងកម្រិតស្ទូឌីយោ 48kHz Tokenizer-Free Foundation Model ដោយ OpenBMB (Apache 2.0)",
    sizeBytes: 2400 * 1024 * 1024,
    sizeFormatted: "2.4 GB",
    relDir: path.join("hf", "hub", "models--openbmb--VoxCPM2"),
    repo: "openbmb/VoxCPM2",
    keyFiles: ["model.safetensors", "config.json"],
    downloadUrls: [
      "https://huggingface.co/openbmb/VoxCPM2/resolve/main/model.safetensors",
      "https://huggingface.co/openbmb/VoxCPM2/resolve/main/config.json"
    ]
  },
  {
    id: "omnivoice-clone",
    name: "OmniVoice F5 Voice Clone",
    category: "clone",
    badge: "AI Clone",
    description: "ម៉ូដែលក្លូនសំឡេងតួអង្គ និងសំឡេងមនុស្សផ្ទាល់ខ្លួន (F5-TTS Instant Voice Cloning)",
    sizeBytes: 1180 * 1024 * 1024,
    sizeFormatted: "1.18 GB",
    relDir: path.join("hf", "hub", "models--k2-fsa--OmniVoice"),
    repo: "k2-fsa/OmniVoice",
    keyFiles: ["model.safetensors", "config.json"],
    downloadUrls: [
      "https://huggingface.co/k2-fsa/OmniVoice/resolve/main/model.safetensors",
      "https://huggingface.co/k2-fsa/OmniVoice/resolve/main/config.json"
    ]
  },
  {
    id: "vocal-remover",
    name: "AI Vocal & Instrumental Stem Separator",
    category: "audio",
    badge: "Stem Separator",
    description: "បំបែកសំឡេងច្រៀង ចម្រៀងភ្លេង និងកាត់បន្ថយសំឡេងរំខានចេញពីវីដេអូ ឬ Audio",
    sizeBytes: 45 * 1024 * 1024,
    sizeFormatted: "45 MB",
    relDir: path.join("hf", "hub", "models--haixin--timeline-studio-vocal-remover"),
    repo: "haixin/timeline-studio-vocal-remover",
    keyFiles: ["model.json"],
    downloadUrls: [
      "https://huggingface.co/haixin/timeline-studio-vocal-remover/resolve/main/model.json"
    ]
  },
  {
    id: "ai-music-generator",
    name: "Stable Audio Music & Beat Generator",
    category: "audio",
    badge: "Music Generator",
    description: "បង្កើតភ្លេងកំដរវីដេអូ Background Music និងចង្វាក់ Beat ស្វ័យប្រវត្ត",
    sizeBytes: 48 * 1024 * 1024,
    sizeFormatted: "48 MB",
    relDir: path.join("hf", "hub", "models--haixin--stable-audio-3-small-music-onnx"),
    repo: "haixin/stable-audio-3-small-music-onnx",
    keyFiles: ["onnx/dit_q4.onnx", "onnx/decoder_q4.onnx"],
    downloadUrls: [
      "https://huggingface.co/haixin/stable-audio-3-small-music-onnx/resolve/main/onnx/dit_q4.onnx",
      "https://huggingface.co/haixin/stable-audio-3-small-music-onnx/resolve/main/onnx/decoder_q4.onnx"
    ]
  },

  // --- 4. VIDEO & VISION AI ---
  {
    id: "nanovsr-4x",
    name: "NanoVSR 4x HD Video Upscaler",
    category: "vision",
    badge: "HD Restoration",
    description: "បង្កើនគុណភាពវីដេអូ និងរូបភាពឱ្យច្បាស់គុណនឹង 4x (Super Resolution Upscaling)",
    sizeBytes: 12 * 1024 * 1024,
    sizeFormatted: "12 MB",
    relDir: path.join("hf", "hub", "models--nanovsr-4x"),
    repo: "haixin/timeline-studio-onnx-models",
    keyFiles: ["nanovsr-644k-t1-fp16.onnx"],
    downloadUrls: [
      "https://huggingface.co/haixin/timeline-studio-onnx-models/resolve/main/nanovsr-644k/nanovsr-644k-t1-fp16.onnx"
    ]
  },
  {
    id: "migan-repair",
    name: "MiGAN Video Repair & Inpainting",
    category: "vision",
    badge: "Object Remover",
    description: "លុប Logo, Watermark, និងវត្ថុដែលមិនចង់បានចេញពីវីដេអូដោយប្រើ AI Generative Fill",
    sizeBytes: 25 * 1024 * 1024,
    sizeFormatted: "25 MB",
    relDir: path.join("hf", "hub", "models--migan-generator"),
    repo: "haixin/timeline-studio-onnx-models",
    keyFiles: ["migan-generator-256.onnx"],
    downloadUrls: [
      "https://huggingface.co/haixin/timeline-studio-onnx-models/resolve/main/migan-webgpu/migan-generator-256.onnx"
    ]
  },
  {
    id: "slimsam-cutout",
    name: "SlimSAM AI Background Cutout",
    category: "vision",
    badge: "Green Screen",
    description: "កាត់ផ្ទៃខាងក្រោយវីដេអូ (Instant Green Screen Cutout) ដោយមិនបាច់ប្រើក្រណាត់បៃតង",
    sizeBytes: 38 * 1024 * 1024,
    sizeFormatted: "38 MB",
    relDir: path.join("hf", "hub", "models--Xenova--slimsam-77-uniform"),
    repo: "Xenova/slimsam-77-uniform",
    keyFiles: ["config.json"],
    downloadUrls: [
      "https://huggingface.co/Xenova/slimsam-77-uniform/resolve/main/config.json",
      "https://huggingface.co/Xenova/slimsam-77-uniform/resolve/main/onnx/decoder_model.onnx"
    ]
  },
  {
    id: "depth-anything",
    name: "Depth-Anything v2 3D Parallax",
    category: "vision",
    badge: "3D Parallax",
    description: "បង្កើតជម្រៅរូបភាព Depth Map, កាមេរ៉ា 3D Parallax, និងព្រិលផ្ទៃក្រោយបែប Cinematic Blur",
    sizeBytes: 98 * 1024 * 1024,
    sizeFormatted: "98 MB",
    relDir: path.join("hf", "hub", "models--depth-anything-v2"),
    repo: "haixin/timeline-studio-onnx-models",
    keyFiles: ["model.onnx"],
    downloadUrls: [
      "https://huggingface.co/haixin/timeline-studio-onnx-models/resolve/main/depth-anything-v2-small/model.onnx"
    ]
  },
  {
    id: "liveportrait-talking",
    name: "LivePortrait Talking Face & Lip-Sync",
    category: "vision",
    badge: "Talking Avatar",
    description: "ធ្វើឱ្យរូបភាពមនុស្សមានចលនា និយាយ និងកាច់ក្បាលតាមចង្វាក់សំឡេងនិយាយ",
    sizeBytes: 140 * 1024 * 1024,
    sizeFormatted: "140 MB",
    relDir: path.join("hf", "hub", "models--liveportrait"),
    repo: "haixin/timeline-studio-onnx-models",
    keyFiles: ["appearance_feature_extractor.onnx"],
    downloadUrls: [
      "https://huggingface.co/haixin/timeline-studio-onnx-models/resolve/main/liveportrait-webgpu/appearance_feature_extractor.onnx"
    ]
  }
];

// Active in-progress downloads: modelId -> { percent, downloadedBytes, totalBytes, speed, status, abortCtrl }
const activeDownloads = new Map();

function formatSize(bytes) {
  if (!bytes || bytes <= 0) return "0 MB";
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getDirSize(dirPath, visitedInodes = new Set()) {
  let size = 0;
  if (!fs.existsSync(dirPath)) return 0;
  try {
    const entries = fs.readdirSync(dirPath);
    for (const name of entries) {
      const full = path.join(dirPath, name);
      try {
        const stat = fs.statSync(full); // Resolves and follows symlinks to real blob files
        if (visitedInodes.has(stat.ino)) continue;
        visitedInodes.add(stat.ino);

        if (stat.isDirectory()) {
          size += getDirSize(full, visitedInodes);
        } else if (stat.isFile()) {
          size += stat.size;
        }
      } catch {}
    }
  } catch {}
  return size;
}

export class ModelManagerService {
  constructor() {
    this.baseModelsDir = config.modelsDir;
    try {
      if (!fs.existsSync(this.baseModelsDir)) {
        fs.mkdirSync(this.baseModelsDir, { recursive: true });
      }
    } catch (err) {
      console.warn("[ModelManager] Could not create models dir:", err.message);
    }
  }

  getModelPath(modelDef) {
    return path.join(this.baseModelsDir, modelDef.relDir);
  }

  isModelInstalled(modelDef) {
    const targetDir = this.getModelPath(modelDef);
    if (!fs.existsSync(targetDir)) return false;

    // Check resolved size across all snapshots, keyFiles and blobs
    const dirSize = getDirSize(targetDir);
    const minThreshold = (modelDef.sizeBytes && modelDef.sizeBytes < 10 * 1024 * 1024)
      ? 1 * 1024 * 1024
      : 10 * 1024 * 1024;

    if (dirSize >= minThreshold) return true;

    // Also check snapshots directory if symlinks point outside
    const snapshotsDir = path.join(targetDir, "snapshots");
    if (fs.existsSync(snapshotsDir)) {
      const snapSize = getDirSize(snapshotsDir);
      if (snapSize >= minThreshold) return true;
    }

    return false;
  }

  getStatus() {
    let totalInstalledBytes = 0;
    const models = MODELS_REGISTRY.map((m) => {
      const modelPath = this.getModelPath(m);
      const isInstalled = this.isModelInstalled(m);
      const currentSize = isInstalled ? getDirSize(modelPath) : 0;
      if (isInstalled) totalInstalledBytes += currentSize;

      const downloadState = activeDownloads.get(m.id) || null;

      return {
        id: m.id,
        name: m.name,
        category: m.category,
        badge: m.badge,
        description: m.description,
        sizeBytes: m.sizeBytes,
        sizeFormatted: m.sizeFormatted,
        installed: isInstalled,
        installedSizeBytes: currentSize,
        installedSizeFormatted: isInstalled ? formatSize(currentSize) : "0 MB",
        downloading: Boolean(downloadState && downloadState.status === "downloading"),
        progress: downloadState ? downloadState.percent : (isInstalled ? 100 : 0),
        status: downloadState ? downloadState.status : (isInstalled ? "ready" : "not_downloaded"),
        error: downloadState?.error || null,
        localPath: isInstalled ? modelPath : null
      };
    });

    return {
      modelsDir: this.baseModelsDir,
      totalModels: MODELS_REGISTRY.length,
      installedCount: models.filter((m) => m.installed).length,
      totalInstalledSizeBytes: totalInstalledBytes,
      totalInstalledFormatted: formatSize(totalInstalledBytes),
      models
    };
  }

  async downloadFile(url, destPath, onProgress) {
    return new Promise((resolve, reject) => {
      const followRedirects = (currentUrl, redirectCount = 0) => {
        if (redirectCount > 8) {
          return reject(new Error("Too many redirects"));
        }

        const client = currentUrl.startsWith("https") ? https : http;
        const req = client.get(currentUrl, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            try {
              const nextUrl = new URL(res.headers.location, currentUrl).href;
              return followRedirects(nextUrl, redirectCount + 1);
            } catch (err) {
              return reject(new Error(`Invalid redirect URL: ${res.headers.location}`));
            }
          }

          if (res.statusCode !== 200) {
            return reject(new Error(`Download failed with HTTP ${res.statusCode}`));
          }

          const total = parseInt(res.headers["content-length"] || "0", 10);
          let downloaded = 0;

          fs.mkdirSync(path.dirname(destPath), { recursive: true });
          const fileStream = fs.createWriteStream(destPath);

          res.on("data", (chunk) => {
            downloaded += chunk.length;
            if (total && onProgress) {
              onProgress(downloaded, total);
            }
          });

          res.pipe(fileStream);

          fileStream.on("finish", () => {
            fileStream.close(() => resolve());
          });

          fileStream.on("error", (err) => {
            fs.unlink(destPath, () => {});
            reject(err);
          });
        });

        req.on("error", (err) => {
          fs.unlink(destPath, () => {});
          reject(err);
        });
      };

      followRedirects(url);
    });
  }

  async downloadModel(modelId) {
    const modelDef = MODELS_REGISTRY.find((m) => m.id === modelId);
    if (!modelDef) {
      throw new Error(`Model with id "${modelId}" not found in registry`);
    }

    // If model is already downloaded and valid, return ready immediately to prevent duplicate downloads
    if (this.isModelInstalled(modelDef)) {
      return {
        modelId,
        status: "ready",
        percent: 100,
        downloadedBytes: modelDef.sizeBytes,
        totalBytes: modelDef.sizeBytes,
        error: null
      };
    }

    if (activeDownloads.has(modelId)) {
      return activeDownloads.get(modelId);
    }

    const state = {
      modelId,
      status: "downloading",
      percent: 0,
      downloadedBytes: 0,
      totalBytes: modelDef.sizeBytes,
      error: null
    };
    activeDownloads.set(modelId, state);

    // Start background download
    (async () => {
      const targetDir = this.getModelPath(modelDef);
      fs.mkdirSync(targetDir, { recursive: true });

      try {
        const totalFiles = modelDef.downloadUrls.length;
        let completedFiles = 0;

        for (let i = 0; i < totalFiles; i++) {
          const url = modelDef.downloadUrls[i];
          const fileName = path.basename(new URL(url).pathname);
          const dest = path.join(targetDir, fileName);

          await this.downloadFile(url, dest, (fileDownloaded, fileTotal) => {
            const overallPercent = Math.min(
              99,
              Math.round(((completedFiles + (fileTotal ? fileDownloaded / fileTotal : 0)) / totalFiles) * 100)
            );
            state.percent = overallPercent;
            modelEvents.emit(`progress:${modelId}`, state);
          });

          completedFiles++;
        }

        state.percent = 100;
        state.status = "ready";
        modelEvents.emit(`progress:${modelId}`, state);
      } catch (err) {
        console.error(`[ModelManager] Download failed for ${modelId}:`, err);
        state.status = "error";
        state.error = err.message;
        modelEvents.emit(`progress:${modelId}`, state);
      } finally {
        setTimeout(() => {
          activeDownloads.delete(modelId);
        }, 5000);
      }
    })();

    return state;
  }

  deleteModel(modelId) {
    const modelDef = MODELS_REGISTRY.find((m) => m.id === modelId);
    if (!modelDef) {
      throw new Error(`Model with id "${modelId}" not found in registry`);
    }

    const targetDir = this.getModelPath(modelDef);
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
      return { success: true, message: `Model ${modelDef.name} deleted successfully` };
    }
    return { success: true, message: "Model directory was already empty" };
  }
}

export const modelManager = new ModelManagerService();
