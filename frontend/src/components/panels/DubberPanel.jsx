import React, { useState, useRef, useEffect } from "react";
import {
  Sparkle,
  Translate,
  CloudArrowUp,
  VideoCamera,
  Copy,
  Check,
  ArrowsClockwise,
  X,
  Key,
  GearSix,
} from "@phosphor-icons/react";
import { dubberService } from "../../services/dubberService.js";
import { getStoredGeminiKey } from "../../lib/geminiRuntime.js";
import { ApiKeyModal } from "../../pages/VoiceCloneStudio/modals/ApiKeyModal.jsx";
import "./DubberPanel.css";

// Engine configurations (Cloud AI with API Keys vs. Local Computer)
const ENGINE_CONFIG = {
  "gemini-2.5-flash": {
    name: "Google Gemini 2.5 Flash",
    provider: "gemini",
    type: "cloud",
    storageKey: "ai_video_editor_gemini_api_keys",
    legacyKey: "ai_video_editor_gemini_api_key",
    placeholder: "AIzaSy... (Gemini API Key)",
  },
  "gemini-2.5-flash-lite": {
    name: "Google Gemini 2.5 Flash Lite",
    provider: "gemini",
    type: "cloud",
    storageKey: "ai_video_editor_gemini_api_keys",
    legacyKey: "ai_video_editor_gemini_api_key",
    placeholder: "AIzaSy... (Gemini API Key)",
  },
  "gemini-2.0-flash": {
    name: "Google Gemini 2.0 Flash",
    provider: "gemini",
    type: "cloud",
    storageKey: "ai_video_editor_gemini_api_keys",
    legacyKey: "ai_video_editor_gemini_api_key",
    placeholder: "AIzaSy... (Gemini API Key)",
  },
  "gemini-1.5-flash": {
    name: "Google Gemini 1.5 Flash",
    provider: "gemini",
    type: "cloud",
    storageKey: "ai_video_editor_gemini_api_keys",
    legacyKey: "ai_video_editor_gemini_api_key",
    placeholder: "AIzaSy... (Gemini API Key)",
  },
  "gemini-1.5-pro": {
    name: "Google Gemini 1.5 Pro",
    provider: "gemini",
    type: "cloud",
    storageKey: "ai_video_editor_gemini_api_keys",
    legacyKey: "ai_video_editor_gemini_api_key",
    placeholder: "AIzaSy... (Gemini API Key)",
  },
  "openai-gpt4o": {
    name: "OpenAI GPT-4o / Whisper",
    provider: "openai",
    type: "cloud",
    storageKey: "ai_video_editor_openai_api_keys",
    legacyKey: "ai_video_editor_openai_api_key",
    placeholder: "sk-proj-... (OpenAI API Key)",
  },
  "deepseek-v3": {
    name: "DeepSeek-V3 Chat",
    provider: "deepseek",
    type: "cloud",
    storageKey: "ai_video_editor_deepseek_api_keys",
    legacyKey: "ai_video_editor_deepseek_api_key",
    placeholder: "sk-... (DeepSeek API Key)",
  },
  "claude-3.5-sonnet": {
    name: "Anthropic Claude 3.5 Sonnet",
    provider: "anthropic",
    type: "cloud",
    storageKey: "ai_video_editor_anthropic_api_keys",
    legacyKey: "ai_video_editor_anthropic_api_key",
    placeholder: "sk-ant-... (Anthropic API Key)",
  },
  "local-whisper": {
    name: "Local Whisper ONNX",
    type: "local",
  },
  "local-offline": {
    name: "Local Offline Model",
    type: "local",
  },
};

// Check which Cloud AI providers have active keys configured
function getActiveProviders() {
  const active = {
    gemini: false,
    openai: false,
    anthropic: false,
    deepseek: false,
  };
  try {
    const gemArr = localStorage.getItem("ai_video_editor_gemini_api_keys");
    if (gemArr) {
      try {
        const parsed = JSON.parse(gemArr);
        if (Array.isArray(parsed) && parsed.some((k) => k && k.trim())) active.gemini = true;
      } catch {}
    }
    if (!active.gemini) {
      const gSingle =
        localStorage.getItem("ai_video_editor_gemini_api_key") ||
        localStorage.getItem("ai_video_editor_gemini_key") ||
        localStorage.getItem("ai_video_editor_translation_key") ||
        localStorage.getItem("timeline_studio_gemini_keys");
      if (gSingle && gSingle.trim()) active.gemini = true;
    }

    const oaArr = localStorage.getItem("ai_video_editor_openai_api_keys");
    if (oaArr) {
      try {
        const parsed = JSON.parse(oaArr);
        if (Array.isArray(parsed) && parsed.some((k) => k && k.trim())) active.openai = true;
      } catch {}
    }
    if (!active.openai) {
      const oaSingle = localStorage.getItem("ai_video_editor_openai_api_key");
      if (oaSingle && oaSingle.trim()) active.openai = true;
    }

    const antArr = localStorage.getItem("ai_video_editor_anthropic_api_keys");
    if (antArr) {
      try {
        const parsed = JSON.parse(antArr);
        if (Array.isArray(parsed) && parsed.some((k) => k && k.trim())) active.anthropic = true;
      } catch {}
    }
    if (!active.anthropic) {
      const antSingle = localStorage.getItem("ai_video_editor_anthropic_api_key");
      if (antSingle && antSingle.trim()) active.anthropic = true;
    }

    const dsArr = localStorage.getItem("ai_video_editor_deepseek_api_keys");
    if (dsArr) {
      try {
        const parsed = JSON.parse(dsArr);
        if (Array.isArray(parsed) && parsed.some((k) => k && k.trim())) active.deepseek = true;
      } catch {}
    }
    if (!active.deepseek) {
      const dsSingle = localStorage.getItem("ai_video_editor_deepseek_api_key");
      if (dsSingle && dsSingle.trim()) active.deepseek = true;
    }
  } catch (err) {
    console.error("Error checking active providers:", err);
  }
  return active;
}

export function DubberPanel({
  t = (k, f) => f || k,
  notify = console.log,
  sourceAudioBlob,
  sourceAudioDuration,
  sourceAudioName,
  setCaptionSegments,
  setCaptionsEnabled,
  updateScript,
  script,
  captionSegments,
  captionStyle,
  handleFiles,
  seekTo,
  setSelectedTrack,
}) {
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // Translation configuration
  const [sourceLang, setSourceLang] = useState("auto");
  const [targetLang, setTargetLang] = useState(() => {
    const saved = localStorage.getItem("ai_video_editor_dubber_target_lang");
    return (!saved || saved === "zh") ? "km" : saved;
  });
  const [dubbingStyle, setDubbingStyle] = useState(() => {
    return localStorage.getItem("ai_video_editor_dubber_style") || "cinematic_story";
  });
  const [selectedEngine, setSelectedEngine] = useState(() => {
    let saved = localStorage.getItem("ai_video_editor_dubber_engine") || "gemini-2.5-flash";
    if (saved === "gemini-2.0-flash-lite") saved = "gemini-2.5-flash-lite";
    return saved;
  });

  // Target language display names
  const TARGET_LANG_NAMES = {
    km: "🇰🇭 ខ្មែរ (Khmer)",
    en: "🇺🇸 អង់គ្លេស (English)",
    zh: "🇨🇳 ចិន (Chinese)",
    th: "🇹🇭 ថៃ (Thai)",
    ko: "🇰🇷 កូរ៉េ (Korean)",
    ja: "🇯🇵 ជប៉ុន (Japanese)",
    vi: "🇻🇳 វៀតណាម (Vietnamese)",
    fr: "🇫🇷 បារាំង (French)",
    es: "🇪🇸 អេស្ប៉ាញ (Spanish)",
    de: "🇩🇪 អាល្លឺម៉ង់ (German)",
    pt: "🇵🇹 ព័រទុយហ្គាល់ (Portuguese)",
    ru: "🇷🇺 រុស្ស៊ី (Russian)",
    ar: "🇸🇦 អារ៉ាប់ (Arabic)",
    hi: "🇮🇳 ហិណ្ឌូ (Hindi)",
    id: "🇮🇩 ឥណ្ឌូនេស៊ី (Indonesian)",
    ms: "🇲🇾 ម៉ាឡេស៊ី (Malay)",
    tl: "🇵🇭 ហ្វីលីពីន (Filipino)",
    my: "🇲🇲 ភូមា (Burmese)",
    lo: "🇱🇦 ឡាវ (Lao)",
  };

  // Transcripts & Subtitles state
  const [originalTranscript, setOriginalTranscript] = useState("");
  const [detectedLanguage, setDetectedLanguage] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTranslatingOnly, setIsTranslatingOnly] = useState(false);
  const [processingStatus, setProcessingStatus] = useState("");
  const [hasCopied, setHasCopied] = useState(false);
  const [generatedSubtitlesCount, setGeneratedSubtitlesCount] = useState(0);

  // Unified API Keys Modal State
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [activeProviders, setActiveProviders] = useState(() => getActiveProviders());

  const refreshActiveKeys = () => {
    const updated = getActiveProviders();
    setActiveProviders(updated);
  };

  // Sync selectedEngine: if selected cloud model has no key, gracefully switch
  useEffect(() => {
    const conf = ENGINE_CONFIG[selectedEngine];
    if (!conf || conf.type === "local") return;

    if (!activeProviders[conf.provider]) {
      if (activeProviders.gemini) {
        setSelectedEngine("gemini-2.5-flash");
        localStorage.setItem("ai_video_editor_dubber_engine", "gemini-2.5-flash");
      } else if (activeProviders.openai) {
        setSelectedEngine("openai-gpt4o");
        localStorage.setItem("ai_video_editor_dubber_engine", "openai-gpt4o");
      } else if (activeProviders.deepseek) {
        setSelectedEngine("deepseek-v3");
        localStorage.setItem("ai_video_editor_dubber_engine", "deepseek-v3");
      } else if (activeProviders.anthropic) {
        setSelectedEngine("claude-3.5-sonnet");
        localStorage.setItem("ai_video_editor_dubber_engine", "claude-3.5-sonnet");
      } else {
        setSelectedEngine("local-whisper");
        localStorage.setItem("ai_video_editor_dubber_engine", "local-whisper");
      }
    }
  }, [activeProviders, selectedEngine]);

  const uploadFileInputRef = useRef(null);

  // Helper to read stored API Key for the active engine
  const getEngineApiKey = (engineId) => {
    const conf = ENGINE_CONFIG[engineId];
    if (!conf || conf.type === "local") return "";
    try {
      const raw = localStorage.getItem(conf.storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]) {
          return parsed[0].trim();
        }
      }
      const single = localStorage.getItem(conf.legacyKey);
      if (single) return single.trim();
      if (engineId.startsWith("gemini")) {
        return getStoredGeminiKey() || "";
      }
      return "";
    } catch {
      return "";
    }
  };

  const currentKey = getEngineApiKey(selectedEngine);
  const isLocalEngine = ENGINE_CONFIG[selectedEngine]?.type === "local";
  const effectiveKey = currentKey || (isLocalEngine ? getStoredGeminiKey() : "");

  const formatFileSize = (bytes) => {
    if (!bytes || isNaN(bytes)) return "";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleSelectFile = (file) => {
    if (!file) return;
    setUploadedFile(file);
    handleFiles?.([file]);
    notify(`បានជ្រើសរើសវីដេអូ៖ ${file.name}`);
  };

  // Handle Copy Translated Text
  const handleCopyTranslated = () => {
    if (!translatedText) return;
    navigator.clipboard?.writeText(translatedText).then(() => {
      setHasCopied(true);
      notify("បានចម្លងអត្ថបទបកប្រែដោយជោគជ័យ!");
      setTimeout(() => setHasCopied(false), 2000);
    });
  };

  // Build Timed Subtitle Segments and apply directly to Timeline
  const applySubtitlesToTimeline = (subtitlesArray, fallbackText = "", totalDuration = 0) => {
    if (!setCaptionSegments) return 0;

    let newSegments = [];
    const defaultFont = captionStyle?.fontId || "default";

    if (Array.isArray(subtitlesArray) && subtitlesArray.length > 0) {
      newSegments = subtitlesArray
        .map((sub, idx) => ({
          id: `caption-dub-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
          text: (sub.khmer || sub.text || sub.original || "").trim(),
          start: Number(sub.start ?? idx * 3.5),
          end: Number(sub.end ?? (idx + 1) * 3.5),
          hidden: false,
          fontId: defaultFont,
        }))
        .filter((s) => s.text.length > 0);
    }

    if (newSegments.length === 0 && fallbackText) {
      const lines = fallbackText
        .split(/\n+|(?<=[។!?])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      const duration = totalDuration > 0 ? totalDuration : Math.max(15, lines.length * 3.5);
      const durPerLine = duration / lines.length;

      newSegments = lines.map((line, idx) => ({
        id: `caption-dub-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        text: line,
        start: Number((idx * durPerLine).toFixed(2)),
        end: Number(((idx + 1) * durPerLine).toFixed(2)),
        hidden: false,
        fontId: defaultFont,
      }));
    }

    if (newSegments.length > 0) {
      setCaptionSegments(newSegments);
      setCaptionsEnabled?.(true);
      const fullKhmerScript = newSegments.map((s) => s.text).join("\n");
      updateScript?.(fullKhmerScript);
      setSelectedTrack?.("caption");
      seekTo?.(0);
      setGeneratedSubtitlesCount(newSegments.length);
    }

    return newSegments.length;
  };

  // Direct Translate Current Transcript to Target Language (Khmer, etc.) without re-extracting video
  const handleTranslateCurrentTranscript = async () => {
    const textToTranslate = originalTranscript || translatedText || script;
    if (!textToTranslate || !textToTranslate.trim()) {
      notify("មិនមានអត្ថបទ Transcript សម្រាប់បកប្រែទេ");
      return;
    }

    if (!effectiveKey) {
      notify(`⚠️ សូមកំណត់ API Key សម្រាប់ ${ENGINE_CONFIG[selectedEngine]?.name || "AI"} ដើម្បីដំណើរការបកប្រែ`);
      setIsApiKeyModalOpen(true);
      return;
    }

    setIsTranslatingOnly(true);
    notify(`កំពុងបកប្រែអត្ថបទទៅជា ${TARGET_LANG_NAMES[targetLang] || targetLang}...`);

    try {
      // If timeline subtitles already exist, perform high-precision 1:1 segment translation!
      if (captionSegments && captionSegments.length > 0) {
        const updated = await dubberService.translateCaptionSegments({
          segments: captionSegments,
          sourceLang,
          targetLang,
          style: dubbingStyle,
          apiKey: effectiveKey,
          model: selectedEngine,
          onProgress: (p) => {
            if (p?.phase) notify(p.phase);
          },
        });

        if (updated && updated.length > 0) {
          setCaptionSegments(updated);
          setCaptionsEnabled?.(true);
          const fullScript = updated.map((s) => s.text).join("\n");
          setTranslatedText(fullScript);
          updateScript?.(fullScript);
          setGeneratedSubtitlesCount(updated.length);
          notify(`✅ បានបកប្រែ និងធ្វើបច្ចុប្បន្នភាព Subtitles ${updated.length} ឃ្លាលើ Timeline ជា ${TARGET_LANG_NAMES[targetLang] || targetLang}!`);
          return;
        }
      }

      // Fallback: translate full script and apply
      const res = await dubberService.translateStory({
        text: textToTranslate,
        sourceLang,
        targetLang,
        style: dubbingStyle,
        apiKey: effectiveKey,
        model: selectedEngine,
      });

      if (res && res.translatedText) {
        const cleanKhmer = res.translatedText.trim();
        setTranslatedText(cleanKhmer);
        const targetDuration = sourceAudioDuration || 30;
        const count = applySubtitlesToTimeline(null, cleanKhmer, targetDuration);
        notify(`✅ បានបកប្រែ និងបញ្ចូល Subtitles ${count} ឃ្លាលើ Timeline ជា ${TARGET_LANG_NAMES[targetLang] || targetLang}!`);
      }
    } catch (err) {
      console.error(err);
      notify(`ការបកប្រែមិនទាន់ជោគជ័យ៖ ${err.message}`);
    } finally {
      setIsTranslatingOnly(false);
    }
  };

  // Transcribe Video Audio directly and Translate to Khmer Subtitles on Timeline
  const handleTranscribeAndTranslateVideo = async () => {
    if (!uploadedFile) {
      notify("សូមផ្ទុកឡើង ឬជ្រើសរើសឯកសារវីដេអូជាមុនសិន");
      uploadFileInputRef.current?.click();
      return;
    }

    // Check if cloud model requires API key
    if (!isLocalEngine && !effectiveKey) {
      notify(`⚠️ សូមកំណត់ API Key សម្រាប់ ${ENGINE_CONFIG[selectedEngine]?.name || "AI"} ជាមុនសិន`);
      setIsApiKeyModalOpen(true);
      return;
    }

    setIsProcessing(true);

    try {
      setProcessingStatus("កំពុងស្រង់សំឡេង 16kHz ចេញពីវីដេអូ...");
      notify("កំពុងស្រង់សំឡេង 16kHz ចេញពីវីដេអូ...");

      // Ultra-fast, lightweight 16kHz mono audio extraction
      const audioBlobToProcess = await dubberService.extractOptimizedAudio(uploadedFile);

      setProcessingStatus(
        isLocalEngine
          ? "កំពុងដំណើរការ Local Whisper លើកុំព្យូទ័រ..."
          : `កំពុងស្រង់ Transcript & បកប្រែជាមួយ ${ENGINE_CONFIG[selectedEngine]?.name}...`
      );
      notify(
        isLocalEngine
          ? "កំពុងស្រង់សាច់រឿងលើម៉ាស៊ីនផ្ទាល់ (Local)..."
          : `កំពុងស្រង់ និងបកប្រែជាមួយ ${ENGINE_CONFIG[selectedEngine]?.name}...`
      );

      const result = await dubberService.transcribeAndTranslateMedia({
        audioBlob: audioBlobToProcess,
        sourceLang,
        targetLang,
        style: dubbingStyle,
        engine: selectedEngine,
        apiKey: effectiveKey,
        onProgress: (p) => {
          if (p.phase) setProcessingStatus(p.phase);
        },
      });

      if (result) {
        const rawTranscript = result.originalTranscript || "";
        const khmerText = result.translatedKhmerText || "";
        const detected = result.detectedLanguage || sourceLang;

        setOriginalTranscript(rawTranscript);
        setTranslatedText(khmerText);
        setDetectedLanguage(detected);

        // Apply Subtitles directly to Timeline!
        const targetDuration = sourceAudioDuration || 30;
        const count = applySubtitlesToTimeline(result.subtitles, khmerText, targetDuration);

        // Notify user of result
        if (isLocalEngine) {
          notify(`✅ បានស្រង់ Transcript (${detected}) និងបញ្ចូល Subtitles ចំនួន ${count} ឃ្លាលើ Timeline ដោយប្រើ Local CPU ដោយជោគជ័យ!`);
        } else if (
          targetLang === "km" &&
          (/[\u4e00-\u9fa5]/.test(khmerText) || !/[\u1780-\u17ff]/.test(khmerText) || (rawTranscript && khmerText.trim() === rawTranscript.trim()))
        ) {
          notify(`🔄 កំពុងបកប្រែ Subtitles ទាំងអស់ទៅជាភាសាខ្មែរ...`);
          setTimeout(() => {
            handleTranslateCurrentTranscript();
          }, 300);
        } else {
          notify(`✅ បានស្រង់ Transcript (${detected}) និងបញ្ចូល Subtitles ចំនួន ${count} ឃ្លាជា ${TARGET_LANG_NAMES[targetLang] || targetLang} លើ Timeline!`);
        }
      } else {
        notify("មិនអាចស្រង់ Transcript ពីវីដេអូបានទេ សូមព្យាយាមម្តងទៀត");
      }
    } catch (err) {
      console.error(err);
      notify(`ការស្រង់ Transcript / បកប្រែមានបញ្ហា៖ ${err.message}`);
    } finally {
      setIsProcessing(false);
      setProcessingStatus("");
    }
  };

  return (
    <div className="dubber-panel">
      {/* Hidden File Input */}
      <input
        ref={uploadFileInputRef}
        type="file"
        accept="video/*,audio/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleSelectFile(file);
          }
        }}
      />

      {/* Upload Video Dropzone / Selected File Card */}
      {!uploadedFile ? (
        <div
          className={`dubber-upload-dropzone ${isDragging ? "is-dragging" : ""}`}
          onClick={() => uploadFileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
            const file = e.dataTransfer?.files?.[0];
            if (file) {
              handleSelectFile(file);
            }
          }}
        >
          <div className="dubber-upload-icon-wrapper">
            <CloudArrowUp size={22} weight="fill" />
          </div>
          <div className="dubber-upload-title">ផ្ទុកឡើងវីដេអូដើម្បីបកប្រែ & បញ្ចូលសំឡេង</div>
          <div className="dubber-upload-hint">
            ចុច ឬអូសទម្លាក់ឯកសារវីដេអូនៅទីនេះ (MP4, MKV, WebM, MOV...)
          </div>
        </div>
      ) : (
        <div className="dubber-uploaded-card">
          <div className="dubber-uploaded-main">
            <div className="dubber-uploaded-icon">
              <VideoCamera size={18} weight="fill" />
            </div>
            <div className="dubber-uploaded-details">
              <span className="dubber-uploaded-name" title={uploadedFile.name}>
                {uploadedFile.name}
              </span>
              <span className="dubber-uploaded-meta">
                {formatFileSize(uploadedFile.size)} • ឯកសាររួចរាល់
              </span>
            </div>
          </div>
          <div className="dubber-uploaded-actions">
            <button
              type="button"
              className="dubber-change-file-btn"
              onClick={() => uploadFileInputRef.current?.click()}
              title="ជ្រើសរើសវីដេអូថ្មី"
            >
              ប្តូរវីដេអូ
            </button>
            <button
              type="button"
              className="dubber-icon-btn"
              onClick={() => {
                setUploadedFile(null);
                setOriginalTranscript("");
                setTranslatedText("");
                if (uploadFileInputRef.current) uploadFileInputRef.current.value = "";
              }}
              title="លុបឯកសារចេញ"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      )}

      {/* TRANSCRIBE VIDEO & TRANSLATE TO SUBTITLES ON TIMELINE */}
      <div className="dubber-card">
        <div className="dubber-card-header">
          <div className="dubber-step-title">
            <Translate size={16} color="#38bdf8" />
            <span>បកប្រែរឿង & Subtitles លើ Timeline</span>
          </div>
          <span className="dubber-chip-ai">
            {isLocalEngine ? "Local AI" : "Cloud AI"}
          </span>
        </div>

        <div className="dubber-grid-fields">
          <div className="dubber-field">
            <label>ភាសាដើមនៃវីដេអូ</label>
            <select
              className="dubber-select"
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value)}
            >
              <option value="auto">🌐 ស្វ័យប្រវត្ត (Auto Detect)</option>
              <option value="en">🇺🇸 អង់គ្លេស (English)</option>
              <option value="zh">🇨🇳 ចិន (Chinese)</option>
              <option value="th">🇹🇭 ថៃ (Thai)</option>
              <option value="ko">🇰🇷 កូរ៉េ (Korean)</option>
              <option value="ja">🇯🇵 ជប៉ុន (Japanese)</option>
              <option value="vi">🇻🇳 វៀតណាម (Vietnamese)</option>
              <option value="fr">🇫🇷 បារាំង (French)</option>
              <option value="es">🇪🇸 អេស្ប៉ាញ (Spanish)</option>
              <option value="de">🇩🇪 អាល្លឺម៉ង់ (German)</option>
              <option value="pt">🇵🇹 ព័រទុយហ្គាល់ (Portuguese)</option>
              <option value="ru">🇷🇺 រុស្ស៊ី (Russian)</option>
              <option value="ar">🇸🇦 អារ៉ាប់ (Arabic)</option>
              <option value="hi">🇮🇳 ហិណ្ឌូ (Hindi)</option>
              <option value="km">🇰🇭 ខ្មែរ (Khmer)</option>
            </select>
          </div>

          <div className="dubber-field">
            <label>បកប្រែទៅភាសា</label>
            <select
              className="dubber-select"
              value={targetLang}
              onChange={(e) => {
                setTargetLang(e.target.value);
                localStorage.setItem("ai_video_editor_dubber_target_lang", e.target.value);
              }}
            >
              <option value="km">🇰🇭 ខ្មែរ (Khmer)</option>
              <option value="en">🇺🇸 អង់គ្លេស (English)</option>
              <option value="th">🇹🇭 ថៃ (Thai)</option>
              <option value="ko">🇰🇷 កូរ៉េ (Korean)</option>
              <option value="ja">🇯🇵 ជប៉ុន (Japanese)</option>
              <option value="vi">🇻🇳 វៀតណាម (Vietnamese)</option>
              <option value="fr">🇫🇷 បារាំង (French)</option>
              <option value="es">🇪🇸 អេស្ប៉ាញ (Spanish)</option>
              <option value="de">🇩🇪 អាល្លឺម៉ង់ (German)</option>
              <option value="pt">🇵🇹 ព័រទុយហ្គាល់ (Portuguese)</option>
              <option value="ru">🇷🇺 រុស្ស៊ី (Russian)</option>
              <option value="ar">🇸🇦 អារ៉ាប់ (Arabic)</option>
              <option value="hi">🇮🇳 ហិណ្ឌូ (Hindi)</option>
              <option value="id">🇮🇩 ឥណ្ឌូនេស៊ី (Indonesian)</option>
              <option value="ms">🇲🇾 ម៉ាឡេស៊ី (Malay)</option>
              <option value="tl">🇵🇭 ហ្វីលីពីន (Filipino)</option>
              <option value="my">🇲🇲 ភូមា (Burmese)</option>
              <option value="lo">🇱🇦 ឡាវ (Lao)</option>
            </select>
          </div>

          <div className="dubber-field">
            <label>រចនាប័ទ្មបញ្ចូលសំឡេង (Style)</label>
            <select
              className="dubber-select"
              value={dubbingStyle}
              onChange={(e) => {
                setDubbingStyle(e.target.value);
                localStorage.setItem("ai_video_editor_dubber_style", e.target.value);
              }}
            >
              <option value="cinematic_story">🎬 ភាពយន្ត & សម្រាយរឿង (Cinematic Dubbing)</option>
              <option value="dialogue">💬 សន្ទនាតួអង្គរស់រវើក (Character Dialogue)</option>
              <option value="documentary">🎙️ អត្ថាធិប្បាយឯកសារ & ព័ត៌មាន (Documentary)</option>
              <option value="dramatic">🎭 មនោសញ្ចេតនា & កម្សត់ (Dramatic & Emotional)</option>
            </select>
          </div>

          <div className="dubber-field">
            <label>ជ្រើសរើស Model AI</label>
            <select
              className="dubber-select"
              value={selectedEngine}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "__add_key__") {
                  setIsApiKeyModalOpen(true);
                  return;
                }
                setSelectedEngine(val);
                localStorage.setItem("ai_video_editor_dubber_engine", val);
              }}
            >
              <optgroup label="💻 Run Local Computer (100% Offline & Free)">
                <option value="local-whisper">💻 Local Whisper ONNX (CPU / Local Machine)</option>
                <option value="local-offline">🏠 Local Offline Model (CPU / គ្មាន Key)</option>
              </optgroup>

              {activeProviders.gemini && (
                <optgroup label="⚡ Google Gemini (Active Key)">
                  <option value="gemini-2.5-flash">⚡ Gemini 2.5 Flash (ចុងក្រោយ & ឆ្លាតវៃបំផុត)</option>
                  <option value="gemini-2.5-flash-lite">🚀 Gemini 2.5 Flash Lite (លឿនបំផុត)</option>
                  <option value="gemini-2.0-flash">⚡ Gemini 2.0 Flash</option>
                  <option value="gemini-1.5-flash">🚀 Gemini 1.5 Flash (ស្ថិរភាពខ្ពស់)</option>
                  <option value="gemini-1.5-pro">💎 Gemini 1.5 Pro (គុណភាពភាពយន្ត)</option>
                </optgroup>
              )}

              {activeProviders.openai && (
                <optgroup label="🤖 OpenAI / Whisper (Active Key)">
                  <option value="openai-gpt4o">🤖 OpenAI GPT-4o / Whisper</option>
                </optgroup>
              )}

              {activeProviders.deepseek && (
                <optgroup label="🧠 DeepSeek AI (Active Key)">
                  <option value="deepseek-v3">🧠 DeepSeek-V3 Chat</option>
                </optgroup>
              )}

              {activeProviders.anthropic && (
                <optgroup label="🔮 Anthropic Claude (Active Key)">
                  <option value="claude-3.5-sonnet">🔮 Claude 3.5 Sonnet</option>
                </optgroup>
              )}

              <option value="__add_key__">➕ បន្ថែម Cloud AI Model (កំណត់ API Key)...</option>
            </select>
          </div>
        </div>

        {/* Action Button: Transcribe directly from video & translate to Khmer subtitles */}
        <button
          className="dubber-btn-primary"
          type="button"
          disabled={isProcessing}
          onClick={handleTranscribeAndTranslateVideo}
        >
          <Sparkle size={15} weight="fill" />
          <span>
            {isProcessing
              ? processingStatus || "កំពុងស្រង់ Transcript & បកប្រែ..."
              : "ស្រង់ Transcript & បង្កើត Subtitles លើ Timeline"}
          </span>
        </button>

        {/* Display Original Video Transcript */}
        {originalTranscript && (
          <div className="dubber-transcript-box">
            <div className="dubber-result-header">
              <span className="dubber-result-title" style={{ color: "#94a3b8" }}>
                🎙️ Transcript ដើមចេញពីវីដេអូ {detectedLanguage ? `(${detectedLanguage})` : ""}
              </span>
            </div>
            <textarea
              className="dubber-textarea is-transcript"
              rows={3}
              value={originalTranscript}
              readOnly
            />
          </div>
        )}

        {/* Quick Translate Button: Translates existing transcript directly to Khmer without re-extracting video! */}
        {(originalTranscript || (translatedText && generatedSubtitlesCount > 0) || (captionSegments && captionSegments.length > 0)) && (
          <button
            className="dubber-btn-translate-now"
            type="button"
            disabled={isTranslatingOnly || isProcessing}
            onClick={handleTranslateCurrentTranscript}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "10px 14px",
              borderRadius: 8,
              background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
              color: "#ffffff",
              fontWeight: 600,
              fontSize: 13,
              cursor: isTranslatingOnly ? "not-allowed" : "pointer",
              border: "1px solid rgba(56, 189, 248, 0.4)",
              boxShadow: "0 2px 8px rgba(2, 132, 199, 0.25)",
              margin: "6px 0 10px 0",
              width: "100%",
            }}
          >
            <ArrowsClockwise size={16} weight="bold" />
            <span>
              {isTranslatingOnly
                ? `កំពុងបកប្រែទៅជា ${TARGET_LANG_NAMES[targetLang] || targetLang}...`
                : `🌐 បកប្រែ Transcript ទៅជា ${TARGET_LANG_NAMES[targetLang] || targetLang} (Translate Now)`}
            </span>
          </button>
        )}

        {/* Display Translated Khmer Subtitles Script */}
        {translatedText && (
          <div className="dubber-result-box">
            <div className="dubber-result-header">
              <span className="dubber-result-title">
                {TARGET_LANG_NAMES[targetLang] || targetLang} — Subtitles លើ Timeline ({generatedSubtitlesCount || "រួចរាល់"})
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span className="dubber-char-count">{translatedText.length} តួអក្សរ</span>
                <button
                  type="button"
                  className="dubber-icon-btn"
                  onClick={handleCopyTranslated}
                  title="ចម្លងអត្ថបទ"
                >
                  {hasCopied ? <Check size={13} color="#4ade80" /> : <Copy size={13} />}
                </button>
                <button
                  type="button"
                  className="dubber-icon-btn"
                  onClick={() => {
                    const count = applySubtitlesToTimeline(null, translatedText, sourceAudioDuration || 30);
                    notify(`បានធ្វើបច្ចុប្បន្នភាព Subtitles ${count} ឃ្លាលើ Timeline!`);
                  }}
                  title="ធ្វើបច្ចុប្បន្នភាព Subtitles លើ Timeline ឡើងវិញ"
                >
                  <ArrowsClockwise size={13} color="#38bdf8" />
                </button>
              </div>
            </div>
            <textarea
              className="dubber-textarea is-result"
              rows={4}
              value={translatedText}
              onChange={(e) => setTranslatedText(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Unified API Keys Setup Modal (Multi-Key Management) */}
      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => {
          setIsApiKeyModalOpen(false);
          refreshActiveKeys();
        }}
        onSaved={() => {
          refreshActiveKeys();
          notify("✅ បានធ្វើបច្ចុប្បន្នភាព API Keys ដោយជោគជ័យ!");
        }}
        notify={notify}
      />
    </div>
  );
}

export default DubberPanel;
