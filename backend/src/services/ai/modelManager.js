import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import https from "node:https";
import http from "node:http";
import { EventEmitter } from "node:events";
import { fileURLToPath } from "node:url";
import { config } from "../../config/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const modelEvents = new EventEmitter();

export const MODELS_REGISTRY = [
  // --- 1. SPEECH TO TEXT (STT & CAPTIONS) ---
  {
    id: "whisper-khmer",
    name: "Whisper Turbo Khmer",
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
    name: "Whisper Word-Sync",
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
    name: "Whisper Large v3",
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
    name: "Silero VAD v5",
    category: "stt",
    badge: "Audio VAD",
    description: "ម៉ូដែលចាប់យកសំឡេងមនុស្សនិយាយ និងកាត់ចន្លោះស្ងាត់ (Silence Cut) ដោយស្វ័យប្រវត្ត",
    sizeBytes: 2 * 1024 * 1024,
    sizeFormatted: "2.4 MB",
    relDir: path.join("hf", "hub", "models--silero-vad-v5"),
    repo: "onnx-community/silero-vad",
    keyFiles: ["model.onnx"],
    downloadUrls: [
      "https://huggingface.co/onnx-community/silero-vad/resolve/main/onnx/model.onnx"
    ]
  },

  // --- 2. TEXT TO SPEECH (TTS) ---
  {
    id: "mms-tts-khm",
    name: "Meta MMS Khmer",
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
    name: "Meta MMS English",
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
    name: "Kokoro-82M TTS",
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
    id: "piper-tts",
    name: "Piper Fast TTS",
    category: "tts",
    badge: "Piper Offline",
    description: "ម៉ូដែលសំឡេងនិយាយល្បឿនលឿនខ្លាំង ស៊ីធនធាន CPU តិចតួចបំផុត (Natural Neural Voice)",
    sizeBytes: 65 * 1024 * 1024,
    sizeFormatted: "65 MB",
    relDir: path.join("hf", "hub", "models--rhasspy--piper-voices"),
    repo: "rhasspy/piper-voices",
    keyFiles: ["zh_CN-xiao_ya-medium.onnx", "zh_CN-xiao_ya-medium.onnx.json"],
    downloadUrls: [
      "https://huggingface.co/rhasspy/piper-voices/resolve/main/zh/zh_CN/xiao_ya/medium/zh_CN-xiao_ya-medium.onnx",
      "https://huggingface.co/rhasspy/piper-voices/resolve/main/zh/zh_CN/xiao_ya/medium/zh_CN-xiao_ya-medium.onnx.json"
    ]
  },

  // --- 3. VOICE CLONING & AUDIO STEMS ---
  {
    id: "voxcpm2-clone",
    name: "VoxCPM2 48kHz",
    category: "clone",
    badge: "VoxCPM2 Studio",
    description: "ម៉ូដែលចម្លងសំឡេងកម្រិតស្ទូឌីយោ 48kHz Foundation Model ដោយ OpenBMB (Full Power)",
    sizeBytes: 2400 * 1024 * 1024,
    sizeFormatted: "2.4 GB",
    relDir: path.join("hf", "hub", "models--openbmb--VoxCPM2"),
    repo: "openbmb/VoxCPM2",
    keyFiles: ["model.safetensors", "audiovae.safetensors", "config.json", "tokenizer.json"],
    downloadUrls: [
      "https://huggingface.co/openbmb/VoxCPM2/resolve/main/model.safetensors",
      "https://huggingface.co/openbmb/VoxCPM2/resolve/main/audiovae.safetensors",
      "https://huggingface.co/openbmb/VoxCPM2/resolve/main/config.json",
      "https://huggingface.co/openbmb/VoxCPM2/resolve/main/tokenizer.json",
      "https://huggingface.co/openbmb/VoxCPM2/resolve/main/tokenizer_config.json",
      "https://huggingface.co/openbmb/VoxCPM2/resolve/main/special_tokens_map.json"
    ]
  },
  {
    id: "omnivoice-clone",
    name: "OmniVoice F5",
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
    name: "Vocal Stem Separator",
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
    name: "AI Music Generator",
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
    name: "NanoVSR 4x HD",
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
    name: "MiGAN Video Inpaint",
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
    name: "SlimSAM Cutout",
    category: "vision",
    badge: "Green Screen",
    description: "កាត់ផ្ទៃខាងក្រោយវីដេអូ (Instant Green Screen Cutout) ដោយមិនបាច់ប្រើក្រណាត់បៃតង",
    sizeBytes: 38 * 1024 * 1024,
    sizeFormatted: "38 MB",
    relDir: path.join("hf", "hub", "models--Xenova--slimsam-77-uniform"),
    repo: "Xenova/slimsam-77-uniform",
    keyFiles: ["config.json", "onnx/vision_encoder_quantized.onnx", "onnx/prompt_encoder_mask_decoder_quantized.onnx"],
    downloadUrls: [
      "https://huggingface.co/Xenova/slimsam-77-uniform/resolve/main/config.json",
      "https://huggingface.co/Xenova/slimsam-77-uniform/resolve/main/onnx/vision_encoder_quantized.onnx",
      "https://huggingface.co/Xenova/slimsam-77-uniform/resolve/main/onnx/prompt_encoder_mask_decoder_quantized.onnx"
    ]
  },
  {
    id: "depth-anything",
    name: "Depth-Anything v2",
    category: "vision",
    badge: "3D Parallax",
    description: "បង្កើតជម្រៅរូបភាព Depth Map, កាមេរ៉ា 3D Parallax, និងព្រិលផ្ទៃក្រោយបែប Cinematic Blur",
    sizeBytes: 98 * 1024 * 1024,
    sizeFormatted: "98 MB",
    relDir: path.join("hf", "hub", "models--depth-anything-v2"),
    repo: "onnx-community/Depth-Anything-V2-Small-ONNX",
    keyFiles: ["config.json", "onnx/model.onnx"],
    downloadUrls: [
      "https://huggingface.co/onnx-community/Depth-Anything-V2-Small-ONNX/resolve/main/config.json",
      "https://huggingface.co/onnx-community/Depth-Anything-V2-Small-ONNX/resolve/main/onnx/model.onnx"
    ]
  },
  {
    id: "liveportrait-talking",
    name: "LivePortrait Lip-Sync",
    category: "vision",
    badge: "Talking Avatar",
    description: "ធ្វើឱ្យរូបភាពមនុស្សមានចលនា និយាយ និងកាច់ក្បាលតាមចង្វាក់សំឡេងនិយាយ",
    sizeBytes: 140 * 1024 * 1024,
    sizeFormatted: "140 MB",
    relDir: path.join("hf", "hub", "models--liveportrait"),
    repo: "KwaiVGI/LivePortrait",
    keyFiles: ["appearance_feature_extractor.pth"],
    downloadUrls: [
      "https://huggingface.co/KwaiVGI/LivePortrait/resolve/main/liveportrait/base_models/appearance_feature_extractor.pth"
    ]
  }
];

// Active in-progress downloads: modelId -> { percent, downloadedBytes, totalBytes, speedFormatted, etaFormatted, status, abortController }
const activeDownloads = new Map();

function formatSize(bytes) {
  if (!bytes || bytes <= 0) return "0 MB";
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatEta(seconds) {
  if (!seconds || seconds <= 0 || !isFinite(seconds)) return "";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function getDirSize(dirPath, visitedPaths = new Set()) {
  let size = 0;
  if (!dirPath || !fs.existsSync(dirPath)) return 0;
  try {
    let canonical = dirPath;
    try {
      canonical = fs.realpathSync(dirPath);
    } catch {}
    if (visitedPaths.has(canonical)) return 0;
    visitedPaths.add(canonical);

    const entries = fs.readdirSync(dirPath);
    for (const name of entries) {
      if (name.endsWith(".part") || name.endsWith(".tmp")) continue;
      const full = path.join(dirPath, name);
      try {
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
          size += getDirSize(full, visitedPaths);
        } else if (stat.isFile()) {
          size += stat.size;
        }
      } catch {}
    }
  } catch {}
  return size;
}

/**
 * Checks recursively if any non-empty model weight files exist in directory or its subdirectories
 */
function hasValidModelWeights(dirPath, maxDepth = 4, currentDepth = 0) {
  if (!dirPath || !fs.existsSync(dirPath) || currentDepth > maxDepth) return false;
  try {
    const entries = fs.readdirSync(dirPath);
    for (const name of entries) {
      if (name.endsWith(".part") || name.endsWith(".tmp")) continue;
      const full = path.join(dirPath, name);
      try {
        const stat = fs.statSync(full);
        if (stat.isFile()) {
          const lower = name.toLowerCase();
          // Model weight extensions
          if (
            lower.endsWith(".safetensors") ||
            lower.endsWith(".onnx") ||
            lower.endsWith(".bin") ||
            lower.endsWith(".pth") ||
            lower.endsWith(".pt") ||
            lower.endsWith(".gguf") ||
            lower === "model.json"
          ) {
            // Must have non-trivial size (> 50 KB) to ensure not an empty/corrupted stub
            if (stat.size > 50 * 1024) return true;
          }
        } else if (stat.isDirectory()) {
          if (hasValidModelWeights(full, maxDepth, currentDepth + 1)) return true;
        }
      } catch {}
    }
  } catch {}
  return false;
}

/**
 * Checks if a specific key file exists in targetDir or subdirectories (handles Windows & Mac path variances)
 */
function keyFileExists(targetDir, keyFile) {
  if (!targetDir || !fs.existsSync(targetDir)) return false;
  const directPath = path.join(targetDir, keyFile);
  if (fs.existsSync(directPath)) {
    try {
      if (fs.statSync(directPath).size > 10) return true;
    } catch {}
  }
  const baseName = path.basename(keyFile);
  const baseDirect = path.join(targetDir, baseName);
  if (fs.existsSync(baseDirect)) {
    try {
      if (fs.statSync(baseDirect).size > 10) return true;
    } catch {}
  }
  // Check snapshots subfolder if exists
  const snapshotsDir = path.join(targetDir, "snapshots");
  if (fs.existsSync(snapshotsDir)) {
    try {
      const subs = fs.readdirSync(snapshotsDir);
      for (const sub of subs) {
        const snapPath = path.join(snapshotsDir, sub, keyFile);
        if (fs.existsSync(snapPath) && fs.statSync(snapPath).size > 10) return true;
        const snapBase = path.join(snapshotsDir, sub, baseName);
        if (fs.existsSync(snapBase) && fs.statSync(snapBase).size > 10) return true;
      }
    } catch {}
  }
  return false;
}

/**
 * Windows & Mac safe atomic rename with retries for open file handle release
 */
function safeRenameSync(src, dest, maxRetries = 10) {
  if (!fs.existsSync(src)) return false;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  for (let i = 0; i < maxRetries; i++) {
    try {
      if (fs.existsSync(dest)) {
        try { fs.unlinkSync(dest); } catch {}
      }
      fs.renameSync(src, dest);
      return true;
    } catch (err) {
      if (i === maxRetries - 1) throw err;
      const start = Date.now();
      while (Date.now() - start < 100 * (i + 1)) {}
    }
  }
  return false;
}

export class ModelManagerService {
  constructor() {
    this.baseModelsDir = config.modelsDir;
    this.installedRegistryFile = path.join(this.baseModelsDir, "installed_models.json");
    try {
      if (!fs.existsSync(this.baseModelsDir)) {
        fs.mkdirSync(this.baseModelsDir, { recursive: true });
      }
    } catch (err) {
      console.warn("[ModelManager] Could not create models dir:", err.message);
    }
  }

  getPersistedInstalledMap() {
    try {
      if (fs.existsSync(this.installedRegistryFile)) {
        const content = fs.readFileSync(this.installedRegistryFile, "utf-8");
        return JSON.parse(content) || {};
      }
    } catch {}
    return {};
  }

  markModelInstalled(modelId, isInstalled = true) {
    try {
      const map = this.getPersistedInstalledMap();
      if (isInstalled) {
        map[modelId] = { installedAt: Date.now(), verified: true };
      } else {
        delete map[modelId];
      }
      fs.writeFileSync(this.installedRegistryFile, JSON.stringify(map, null, 2), "utf-8");
    } catch (err) {
      console.warn("[ModelManager] Could not update installed registry:", err.message);
    }
  }

  getModelPath(modelDef) {
    return path.join(this.baseModelsDir, modelDef.relDir);
  }

  getCandidateModelDirs(modelDef) {
    const candidates = [];
    const baseDir = this.baseModelsDir;
    const relBase = path.basename(modelDef.relDir);

    // Primary paths in baseModelsDir
    candidates.push(path.join(baseDir, modelDef.relDir));
    candidates.push(path.join(baseDir, "hf", "hub", relBase));
    candidates.push(path.join(baseDir, "hub", relBase));
    candidates.push(path.join(baseDir, relBase));
    candidates.push(path.join(baseDir, modelDef.id));

    // Bundled / workspace ai_clone models
    try {
      candidates.push(path.resolve(__dirname, "../../ai_clone/models", modelDef.relDir));
      candidates.push(path.resolve(__dirname, "../../ai_clone/models/hf/hub", relBase));
      candidates.push(path.resolve(process.cwd(), "backend/ai_clone/models", modelDef.relDir));
      candidates.push(path.resolve(process.cwd(), "backend/ai_clone/models/hf/hub", relBase));
    } catch {}

    // HuggingFace system cache (Linux/macOS)
    try {
      const home = os.homedir();
      candidates.push(path.join(home, ".cache", "huggingface", "hub", relBase));
      candidates.push(path.join(home, ".cache", "huggingface", "hub", `models--${modelDef.repo.replace(/\//g, "--")}`));
    } catch {}

    // Windows paths
    if (process.env.USERPROFILE) {
      candidates.push(path.join(process.env.USERPROFILE, ".cache", "huggingface", "hub", relBase));
      candidates.push(path.join(process.env.USERPROFILE, ".cache", "huggingface", "hub", `models--${modelDef.repo.replace(/\//g, "--")}`));
    }
    if (process.env.LOCALAPPDATA) {
      candidates.push(path.join(process.env.LOCALAPPDATA, "huggingface", "hub", relBase));
    }
    if (process.env.HF_HOME) {
      candidates.push(path.join(process.env.HF_HOME, "hub", relBase));
    }

    return [...new Set(candidates.filter(Boolean))];
  }

  /**
   * Returns true if model is completely downloaded and ready to use
   */
  isModelInstalled(modelDef) {
    const active = activeDownloads.get(modelDef.id);
    if (active && active.status === "downloading") {
      return false;
    }

    const candidateDirs = this.getCandidateModelDirs(modelDef);

    for (const targetDir of candidateDirs) {
      if (!fs.existsSync(targetDir)) continue;

      // 1. Verify keyFiles if specified
      if (modelDef.keyFiles && modelDef.keyFiles.length > 0) {
        const allKeyFilesPresent = modelDef.keyFiles.every((kf) => keyFileExists(targetDir, kf));
        if (allKeyFilesPresent) {
          return true;
        }
      }

      // 2. Check model weights presence and directory size
      if (hasValidModelWeights(targetDir)) {
        const dirSize = getDirSize(targetDir);
        const minExpected = (modelDef.sizeBytes && modelDef.sizeBytes > 5 * 1024 * 1024)
          ? Math.floor(modelDef.sizeBytes * 0.45)
          : 50 * 1024;
        if (dirSize >= minExpected) {
          return true;
        }
      }

      // 3. Check snapshots directory explicitly
      const snapshotsDir = path.join(targetDir, "snapshots");
      if (fs.existsSync(snapshotsDir)) {
        if (hasValidModelWeights(snapshotsDir)) return true;
      }
    }

    // 4. Check persistent install map
    const persisted = this.getPersistedInstalledMap();
    if (persisted[modelDef.id]) {
      if (candidateDirs.some((d) => fs.existsSync(d) && hasValidModelWeights(d))) {
        return true;
      }
    }

    return false;
  }

  resolveInstalledPath(modelDef) {
    const candidateDirs = this.getCandidateModelDirs(modelDef);
    for (const d of candidateDirs) {
      if (fs.existsSync(d)) {
        if (hasValidModelWeights(d) || getDirSize(d) > 100 * 1024) {
          return d;
        }
      }
    }
    return this.getModelPath(modelDef);
  }

  getStatus() {
    let totalInstalledBytes = 0;
    const models = MODELS_REGISTRY.map((m) => {
      const isInstalled = this.isModelInstalled(m);
      const modelPath = isInstalled ? this.resolveInstalledPath(m) : this.getModelPath(m);
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
        speedFormatted: downloadState?.speedFormatted || "",
        etaFormatted: downloadState?.etaFormatted || "",
        currentFile: downloadState?.currentFile || "",
        error: downloadState?.error || null,
        localPath: isInstalled ? modelPath : null
      };
    });

    return {
      modelsDir: this.baseModelsDir,
      totalModels: MODELS_REGISTRY.length,
      totalCount: MODELS_REGISTRY.length,
      installedCount: models.filter((m) => m.installed).length,
      totalInstalledSizeBytes: totalInstalledBytes,
      totalInstalledFormatted: formatSize(totalInstalledBytes),
      models
    };
  }

  /**
   * Resilient single-file download with Range resume, socket timeout & redirects
   */
  _attemptSingleDownload(url, destPath, partPath, startByte, onChunk, signal) {
    return new Promise((resolve, reject) => {
      let activeRequest = null;
      let activeStream = null;
      let isDone = false;

      const cleanup = () => {
        isDone = true;
        if (activeRequest) {
          try { activeRequest.destroy(); } catch {}
          activeRequest = null;
        }
        if (activeStream) {
          try { activeStream.close(); } catch {}
          activeStream = null;
        }
      };

      if (signal) {
        signal.addEventListener("abort", () => {
          cleanup();
          reject(new Error("Download aborted by user"));
        }, { once: true });
      }

      const followRedirects = (currentUrl, redirectCount = 0) => {
        if (signal?.aborted || isDone) return;
        if (redirectCount > 10) {
          cleanup();
          return reject(new Error("Too many HTTP redirects (limit 10)"));
        }

        const client = currentUrl.startsWith("https") ? https : http;
        const headers = {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "*/*",
          "Accept-Encoding": "identity",
        };

        if (startByte > 0) {
          headers.Range = `bytes=${startByte}-`;
        }

        const req = client.get(
          currentUrl,
          { headers, timeout: 35000 },
          (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
              try {
                res.resume();
                const nextUrl = new URL(res.headers.location, currentUrl).href;
                return followRedirects(nextUrl, redirectCount + 1);
              } catch (err) {
                cleanup();
                return reject(new Error(`Invalid redirect URL: ${res.headers.location}`));
              }
            }

            if (res.statusCode === 416) {
              res.resume();
              if (startByte > 1000) {
                try {
                  safeRenameSync(partPath, destPath);
                  cleanup();
                  return resolve();
                } catch {}
              }
              try { fs.unlinkSync(partPath); } catch {}
              cleanup();
              return reject(new Error("Range not satisfiable (resetting part file)"));
            }

            if (res.statusCode !== 200 && res.statusCode !== 206) {
              res.resume();
              cleanup();
              return reject(new Error(`Server returned HTTP ${res.statusCode} for ${currentUrl}`));
            }

            const isPartial = res.statusCode === 206;
            const openFlags = isPartial && startByte > 0 ? "a" : "w";
            const actualStart = isPartial ? startByte : 0;

            const fileStream = fs.createWriteStream(partPath, { flags: openFlags });
            activeStream = fileStream;

            let inactivityTimeout = setTimeout(() => {
              cleanup();
              reject(new Error("Download stalled (no data received for 35s)"));
            }, 35000);

            res.on("data", (chunk) => {
              if (isDone) return;
              clearTimeout(inactivityTimeout);
              inactivityTimeout = setTimeout(() => {
                cleanup();
                reject(new Error("Download stalled (no data received for 35s)"));
              }, 35000);

              if (onChunk) {
                onChunk(chunk.length);
              }
            });

            res.pipe(fileStream);

            fileStream.on("finish", () => {
              clearTimeout(inactivityTimeout);
              fileStream.close(() => {
                if (isDone) return;
                try {
                  safeRenameSync(partPath, destPath);
                  cleanup();
                  resolve();
                } catch (rErr) {
                  cleanup();
                  reject(rErr);
                }
              });
            });

            fileStream.on("error", (fErr) => {
              clearTimeout(inactivityTimeout);
              cleanup();
              reject(fErr);
            });
          }
        );

        activeRequest = req;

        req.on("timeout", () => {
          cleanup();
          reject(new Error("Network connection timeout (35s)"));
        });

        req.on("error", (netErr) => {
          cleanup();
          reject(netErr);
        });
      };

      followRedirects(url);
    });
  }

  /**
   * Resilient file downloader with auto-retry & exponential backoff
   */
  async downloadFileWithResume(url, destPath, onChunk, signal) {
    const maxRetries = 6;
    const partPath = `${destPath}.part`;
    fs.mkdirSync(path.dirname(destPath), { recursive: true });

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (signal?.aborted) {
        throw new Error("Download cancelled");
      }

      let startByte = 0;
      if (fs.existsSync(partPath)) {
        try {
          startByte = fs.statSync(partPath).size;
        } catch {
          startByte = 0;
        }
      }

      try {
        await this._attemptSingleDownload(url, destPath, partPath, startByte, onChunk, signal);
        return;
      } catch (err) {
        if (signal?.aborted) {
          throw err;
        }
        console.warn(`[ModelManager] Retry ${attempt}/${maxRetries} for ${path.basename(destPath)}: ${err.message}`);
        if (attempt === maxRetries) {
          throw new Error(`Failed to download ${path.basename(destPath)} after ${maxRetries} attempts: ${err.message}`);
        }
        const waitMs = Math.min(8000, 1000 * Math.pow(2, attempt - 1));
        await new Promise((r) => setTimeout(r, waitMs));
      }
    }
  }

  /**
   * Creates snapshot compatibility directories (snapshots/default and refs/main)
   * for Hugging Face hub library compatibility on Mac and Windows
   */
  ensureSnapshotCompatibility(targetDir, modelDef) {
    try {
      if (!modelDef.repo) return;
      const snapshotsDir = path.join(targetDir, "snapshots", "default");
      const refsDir = path.join(targetDir, "refs");
      fs.mkdirSync(snapshotsDir, { recursive: true });
      fs.mkdirSync(refsDir, { recursive: true });

      // Write refs/main -> default
      fs.writeFileSync(path.join(refsDir, "main"), "default", "utf-8");

      // Hard link or copy files into snapshots/default
      const entries = fs.readdirSync(targetDir);
      for (const entry of entries) {
        if (entry === "snapshots" || entry === "refs" || entry.endsWith(".part")) continue;
        const src = path.join(targetDir, entry);
        const dest = path.join(snapshotsDir, entry);
        if (fs.existsSync(src) && fs.statSync(src).isFile() && !fs.existsSync(dest)) {
          try {
            fs.linkSync(src, dest);
          } catch {
            try { fs.copyFileSync(src, dest); } catch {}
          }
        }
      }
    } catch (err) {
      console.warn("[ModelManager] Snapshot compatibility setup skipped:", err.message);
    }
  }

  async downloadModel(modelId) {
    const modelDef = MODELS_REGISTRY.find((m) => m.id === modelId);
    if (!modelDef) {
      throw new Error(`Model with id "${modelId}" not found in registry`);
    }

    // If model is already fully downloaded and valid, return ready immediately
    if (this.isModelInstalled(modelDef)) {
      return {
        modelId,
        status: "ready",
        percent: 100,
        downloadedBytes: modelDef.sizeBytes,
        totalBytes: modelDef.sizeBytes,
        speedFormatted: "",
        etaFormatted: "",
        error: null
      };
    }

    if (activeDownloads.has(modelId)) {
      return activeDownloads.get(modelId);
    }

    const targetDir = this.getModelPath(modelDef);
    fs.mkdirSync(targetDir, { recursive: true });

    const totalExpectedBytes = modelDef.sizeBytes || 1;
    let totalDownloadedBytes = 0;

    // Check existing progress on disk
    for (const url of modelDef.downloadUrls) {
      const urlObj = new URL(url);
      const parts = urlObj.pathname.split("/resolve/main/");
      const relativeName = parts.length > 1 ? parts[1] : path.basename(urlObj.pathname);
      const dest = path.join(targetDir, relativeName);
      const part = `${dest}.part`;

      if (fs.existsSync(dest)) {
        try { totalDownloadedBytes += fs.statSync(dest).size; } catch {}
      } else if (fs.existsSync(part)) {
        try { totalDownloadedBytes += fs.statSync(part).size; } catch {}
      }
    }

    const abortController = new AbortController();
    const state = {
      modelId,
      status: "downloading",
      percent: Math.min(99, Math.round((totalDownloadedBytes / totalExpectedBytes) * 100)),
      downloadedBytes: totalDownloadedBytes,
      totalBytes: totalExpectedBytes,
      speedFormatted: "0 KB/s",
      etaFormatted: "",
      currentFile: "",
      error: null,
      abortController
    };
    activeDownloads.set(modelId, state);

    // Run background download task
    (async () => {
      let lastTime = Date.now();
      let bytesSinceLastCheck = 0;
      let lastEmitTime = Date.now();

      const onChunk = (chunkLen) => {
        totalDownloadedBytes += chunkLen;
        bytesSinceLastCheck += chunkLen;
        state.downloadedBytes = totalDownloadedBytes;

        const now = Date.now();
        const timeDelta = (now - lastTime) / 1000;
        if (timeDelta >= 1.0) {
          const speed = bytesSinceLastCheck / timeDelta;
          state.speedFormatted = `${formatSize(speed)}/s`;
          const remainingBytes = Math.max(0, totalExpectedBytes - totalDownloadedBytes);
          const etaSeconds = speed > 0 ? Math.round(remainingBytes / speed) : 0;
          state.etaFormatted = formatEta(etaSeconds);

          lastTime = now;
          bytesSinceLastCheck = 0;
        }

        const percent = Math.min(99, Math.round((totalDownloadedBytes / totalExpectedBytes) * 100));
        state.percent = percent;

        if (now - lastEmitTime >= 250) {
          lastEmitTime = now;
          modelEvents.emit(`progress:${modelId}`, { ...state, abortController: undefined });
        }
      };

      try {
        const totalFiles = modelDef.downloadUrls.length;

        for (let i = 0; i < totalFiles; i++) {
          if (abortController.signal.aborted) break;

          const url = modelDef.downloadUrls[i];
          const urlObj = new URL(url);
          const parts = urlObj.pathname.split("/resolve/main/");
          const relativeName = parts.length > 1 ? parts[1] : path.basename(urlObj.pathname);
          const dest = path.join(targetDir, relativeName);

          state.currentFile = `${path.basename(relativeName)} (${i + 1}/${totalFiles})`;
          modelEvents.emit(`progress:${modelId}`, { ...state, abortController: undefined });

          // If file already exists and is complete, skip downloading
          if (fs.existsSync(dest) && fs.statSync(dest).size > 100) {
            continue;
          }

          await this.downloadFileWithResume(url, dest, onChunk, abortController.signal);
        }

        if (!abortController.signal.aborted) {
          state.percent = 100;
          state.status = "ready";
          state.speedFormatted = "";
          state.etaFormatted = "";
          state.currentFile = "Complete";
          this.markModelInstalled(modelId, true);
          this.ensureSnapshotCompatibility(targetDir, modelDef);
          modelEvents.emit(`progress:${modelId}`, { ...state, abortController: undefined });
        }
      } catch (err) {
        if (!abortController.signal.aborted) {
          console.error(`[ModelManager] Download error for ${modelId}:`, err);
          state.status = "error";
          state.error = err.message;
          modelEvents.emit(`progress:${modelId}`, { ...state, abortController: undefined });
        }
      } finally {
        setTimeout(() => {
          activeDownloads.delete(modelId);
        }, 5000);
      }
    })();

    return { ...state, abortController: undefined };
  }

  cancelDownload(modelId) {
    const active = activeDownloads.get(modelId);
    if (active) {
      if (active.abortController) {
        try { active.abortController.abort(); } catch {}
      }
      active.status = "not_downloaded";
      activeDownloads.delete(modelId);
      modelEvents.emit(`progress:${modelId}`, {
        modelId,
        status: "not_downloaded",
        percent: 0,
        error: "Download cancelled"
      });
      return { success: true, message: `Download cancelled for ${modelId}` };
    }
    return { success: false, message: "No active download found" };
  }

  deleteModel(modelId) {
    this.cancelDownload(modelId);
    const modelDef = MODELS_REGISTRY.find((m) => m.id === modelId);
    if (!modelDef) {
      throw new Error(`Model with id "${modelId}" not found in registry`);
    }

    const candidateDirs = this.getCandidateModelDirs(modelDef);
    this.markModelInstalled(modelId, false);

    let deleted = false;
    for (const d of candidateDirs) {
      if (fs.existsSync(d)) {
        try {
          fs.rmSync(d, { recursive: true, force: true });
          deleted = true;
        } catch (err) {
          console.warn(`[ModelManager] Could not delete dir ${d}:`, err.message);
        }
      }
    }

    return {
      success: true,
      message: deleted ? `Model ${modelDef.name} deleted successfully` : "Model directory was already empty"
    };
  }
}

export const modelManager = new ModelManagerService();
