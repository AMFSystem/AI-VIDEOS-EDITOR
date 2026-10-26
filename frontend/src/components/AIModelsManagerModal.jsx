import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  X,
  Cpu,
  DownloadSimple,
  Trash,
  CheckCircle,
  CircleNotch,
  ArrowClockwise,
  Microphone,
  SpeakerHigh,
  Waveform,
  Sparkle,
  MusicNotes,
  FilmStrip
} from "@phosphor-icons/react";
import "./AIModelsManagerModal.css";

// Comprehensive Catalog of ALL AI Models used across the application
const DEFAULT_MODELS = [
  // --- 1. SPEECH TO TEXT (STT & CAPTIONS) ---
  {
    id: "whisper-khmer",
    name: "Whisper Turbo Khmer v9 (CT2)",
    category: "stt",
    badge: "Khmer STT",
    description: "ម៉ូដែលបម្លែងសំឡេងនិយាយភាសាខ្មែរទៅជាអក្សរស្វ័យប្រវត្ត (CTranslate2 Int8 Optimized)",
    sizeFormatted: "810 MB",
  },
  {
    id: "whisper-small-captions",
    name: "Whisper Small Word-Timestamped",
    category: "stt",
    badge: "Word Sync STT",
    description: "ម៉ូដែលបំបែកពាក្យ និងកំណត់ពេលវេលាអក្សររត់ស្វ័យប្រវត្តកម្រិត Word-Level Timestamps",
    sizeFormatted: "460 MB",
  },
  {
    id: "whisper-multilingual",
    name: "Faster-Whisper Large v3 Turbo",
    category: "stt",
    badge: "Universal STT",
    description: "ម៉ូដែលបម្លែងសំឡេងគ្រប់ភាសាលើពិភពលោក (English, Chinese, Thai, Vietnamese, etc.)",
    sizeFormatted: "1.54 GB",
  },
  {
    id: "silero-vad",
    name: "Silero Voice Activity Detection v5",
    category: "stt",
    badge: "Audio VAD",
    description: "ម៉ូដែលចាប់យកសំឡេងមនុស្សនិយាយ និងកាត់ចន្លោះស្ងាត់ (Silence Cut) ដោយស្វ័យប្រវត្ត",
    sizeFormatted: "2.4 MB",
  },

  // --- 2. TEXT TO SPEECH (TTS) ---
  {
    id: "mms-tts-khm",
    name: "Meta MMS-TTS Khmer Voice",
    category: "tts",
    badge: "Khmer Voice",
    description: "ម៉ូដែលសំឡេងនិយាយភាសាខ្មែរ Offline (Meta VITS MMS)",
    sizeFormatted: "145 MB",
  },
  {
    id: "mms-tts-eng",
    name: "Meta MMS-TTS English Voice",
    category: "tts",
    badge: "English Voice",
    description: "ម៉ូដែលសំឡេងនិយាយភាសាអង់គ្លេស Offline (Meta VITS MMS)",
    sizeFormatted: "145 MB",
  },
  {
    id: "kokoro-82m",
    name: "Kokoro-82M Multilingual Voice",
    category: "tts",
    badge: "Kokoro TTS",
    description: "ម៉ូដែលសំឡេងអានបែបធម្មជាតិកម្រិតខ្ពស់ 82M parameters គាំទ្រភាសាអង់គ្លេស និងភាសាផ្សេងៗ",
    sizeFormatted: "340 MB",
  },
  {
    id: "piper-khmer",
    name: "Piper TTS Khmer Natural Voice",
    category: "tts",
    badge: "Piper Offline",
    description: "ម៉ូដែលសំឡេងនិយាយខ្មែរដារ៉ា ល្បឿនលឿនខ្លាំង ស៊ីធនធាន CPU តិចតួចបំផុត",
    sizeFormatted: "65 MB",
  },

  // --- 3. VOICE CLONING ---
  {
    id: "voxcpm2-clone",
    name: "VoxCPM2 Neural Voice Clone (OpenBMB)",
    category: "clone",
    badge: "VoxCPM2 48kHz",
    description: "ម៉ូដែលចម្លងសំឡេងកម្រិតស្ទូឌីយោ 48kHz Tokenizer-Free Foundation Model ដោយ OpenBMB (Apache 2.0)",
    sizeFormatted: "2.4 GB",
  },
  {
    id: "omnivoice-clone",
    name: "OmniVoice F5 Voice Clone",
    category: "clone",
    badge: "AI Clone",
    description: "ម៉ូដែលក្លូនសំឡេងតួអង្គ និងសំឡេងមនុស្សផ្ទាល់ខ្លួន (F5-TTS Instant Voice Cloning)",
    sizeFormatted: "1.18 GB",
  },

  // --- 4. AUDIO & MUSIC ---
  {
    id: "vocal-remover",
    name: "AI Vocal & Instrumental Stem Separator",
    category: "audio",
    badge: "Stem Separator",
    description: "បំបែកសំឡេងច្រៀង ចម្រៀងភ្លេង និងកាត់បន្ថយសំឡេងរំខានចេញពីវីដេអូ ឬ Audio",
    sizeFormatted: "45 MB",
  },
  {
    id: "ai-music-generator",
    name: "Stable Audio Music & Beat Generator",
    category: "audio",
    badge: "Music Generator",
    description: "បង្កើតភ្លេងកំដរវីដេអូ Background Music និងចង្វាក់ Beat ស្វ័យប្រវត្ត",
    sizeFormatted: "48 MB",
  },

  // --- 5. VIDEO & VISION AI ---
  {
    id: "nanovsr-4x",
    name: "NanoVSR 4x HD Video Upscaler",
    category: "vision",
    badge: "HD Restoration",
    description: "បង្កើនគុណភាពវីដេអូ និងរូបភាពឱ្យច្បាស់គុណនឹង 4x (Super Resolution Upscaling)",
    sizeFormatted: "12 MB",
  },
  {
    id: "migan-repair",
    name: "MiGAN Video Repair & Inpainting",
    category: "vision",
    badge: "Object Remover",
    description: "លុប Logo, Watermark, និងវត្ថុដែលមិនចង់បានចេញពីវីដេអូដោយប្រើ AI Generative Fill",
    sizeFormatted: "25 MB",
  },
  {
    id: "slimsam-cutout",
    name: "SlimSAM AI Background Cutout",
    category: "vision",
    badge: "Green Screen",
    description: "កាត់ផ្ទៃខាងក្រោយវីដេអូ (Instant Green Screen Cutout) ដោយមិនបាច់ប្រើក្រណាត់បៃតង",
    sizeFormatted: "38 MB",
  },
  {
    id: "depth-anything",
    name: "Depth-Anything v2 3D Parallax",
    category: "vision",
    badge: "3D Parallax",
    description: "បង្កើតជម្រៅរូបភាព Depth Map, កាមេរ៉ា 3D Parallax, និងព្រិលផ្ទៃក្រោយបែប Cinematic Blur",
    sizeFormatted: "98 MB",
  },
  {
    id: "liveportrait-talking",
    name: "LivePortrait Talking Face & Lip-Sync",
    category: "vision",
    badge: "Talking Avatar",
    description: "ធ្វើឱ្យរូបភាពមនុស្សមានចលនា និយាយ និងកាច់ក្បាលតាមចង្វាក់សំឡេងនិយាយ",
    sizeFormatted: "140 MB",
  }
];

export function AIModelsManagerModal({ isOpen, onClose, notify = console.log }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [filterCategory, setFilterCategory] = useState("all"); // "all" | "stt" | "tts" | "clone" | "audio" | "vision"
  const [downloadingModels, setDownloadingModels] = useState({}); // modelId -> { percent, status, error }
  const eventSourcesRef = useRef({});

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/ai/models");
      if (res.ok) {
        const json = await res.json();
        setData(json);

        // Sync downloading state if any model is currently downloading
        const downMap = {};
        json.models?.forEach((m) => {
          if (m.downloading) {
            downMap[m.id] = { percent: m.progress, status: "downloading" };
            listenProgress(m.id);
          }
        });
        setDownloadingModels((prev) => ({ ...prev, ...downMap }));
      }
    } catch (err) {
      console.warn("Could not load AI models status from backend:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
    }
    return () => {
      // Close all SSE listeners on unmount
      Object.values(eventSourcesRef.current).forEach((es) => es?.close?.());
      eventSourcesRef.current = {};
    };
  }, [isOpen]);

  const listenProgress = (modelId) => {
    if (eventSourcesRef.current[modelId]) return;

    try {
      const es = new EventSource(`/api/ai/models/progress/${modelId}`);
      eventSourcesRef.current[modelId] = es;

      es.onmessage = (event) => {
        try {
          const state = JSON.parse(event.data);
          setDownloadingModels((prev) => ({
            ...prev,
            [modelId]: { percent: state.percent, status: state.status, error: state.error }
          }));

          if (state.status === "ready") {
            es.close();
            delete eventSourcesRef.current[modelId];
            notify("Model បានទាញយករួចរាល់ និងរក្សាទុកក្នុង Local Computer!", "success");
            fetchStatus();
          } else if (state.status === "error") {
            es.close();
            delete eventSourcesRef.current[modelId];
            notify(`ទាញយក Model បរាជ័យ: ${state.error || "Unknown error"}`, "error");
            fetchStatus();
          }
        } catch {}
      };

      es.onerror = () => {
        es.close();
        delete eventSourcesRef.current[modelId];
      };
    } catch (err) {
      console.warn("SSE error:", err);
    }
  };

  const handleDownload = async (modelId) => {
    try {
      setDownloadingModels((prev) => ({
        ...prev,
        [modelId]: { percent: 0, status: "downloading" }
      }));
      listenProgress(modelId);

      const res = await fetch(`/api/ai/models/download/${modelId}`, {
        method: "POST"
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }

      notify("កំពុងចាប់ផ្ដើមទាញយក Model ពី HuggingFace និងរក្សាទុកក្នុងម៉ាស៊ីន...", "info");
    } catch (err) {
      setDownloadingModels((prev) => {
        const next = { ...prev };
        delete next[modelId];
        return next;
      });
      notify(`មិនអាចទាញយក Model បានទេ: ${err.message}`, "error");
    }
  };

  const handleDelete = async (model) => {
    const ok = window.confirm(
      `តើអ្នកប្រាកដជាចង់លុប Model "${model.name}" មែនទេ?\n(អ្នកអាចទាញយកវាមកវិញបានគ្រប់ពេល)`
    );
    if (!ok) return;

    try {
      const res = await fetch(`/api/ai/models/${model.id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        notify(`បានលុប Model ${model.name} ដោយជោគជ័យ!`, "success");
        fetchStatus();
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (err) {
      notify(`លុប Model បរាជ័យ: ${err.message}`, "error");
    }
  };

  // Merge backend data with DEFAULT_MODELS so the user ALWAYS sees all models
  const modelsList = useMemo(() => {
    const serverModels = data?.models || [];
    const serverMap = new Map(serverModels.map((m) => [m.id, m]));

    return DEFAULT_MODELS.map((def) => {
      const live = serverMap.get(def.id);
      return {
        ...def,
        installed: live?.installed ?? false,
        installedSizeBytes: live?.installedSizeBytes ?? 0,
        installedSizeFormatted: live?.installedSizeFormatted ?? "0 MB",
        downloading: live?.downloading ?? false,
        progress: live?.progress ?? 0,
        status: live?.status ?? "not_downloaded",
        error: live?.error ?? null,
        localPath: live?.localPath ?? null,
      };
    });
  }, [data]);

  const filteredModels = useMemo(() => {
    if (filterCategory === "all") return modelsList;
    return modelsList.filter((m) => m.category === filterCategory);
  }, [modelsList, filterCategory]);

  const getCategoryMeta = (cat) => {
    switch (cat) {
      case "stt":
        return {
          icon: <Microphone size={14} weight="fill" />,
          label: "Speech to Text",
          color: "#38bdf8",
          bg: "rgba(56, 189, 248, 0.12)",
          border: "rgba(56, 189, 248, 0.25)"
        };
      case "tts":
        return {
          icon: <SpeakerHigh size={14} weight="fill" />,
          label: "Text to Speech",
          color: "#a855f7",
          bg: "rgba(168, 85, 247, 0.12)",
          border: "rgba(168, 85, 247, 0.25)"
        };
      case "clone":
        return {
          icon: <Waveform size={14} weight="fill" />,
          label: "Voice Clone",
          color: "#ec4899",
          bg: "rgba(236, 72, 153, 0.12)",
          border: "rgba(236, 72, 153, 0.25)"
        };
      case "audio":
        return {
          icon: <MusicNotes size={14} weight="fill" />,
          label: "Audio & Music",
          color: "#f59e0b",
          bg: "rgba(245, 158, 11, 0.12)",
          border: "rgba(245, 158, 11, 0.25)"
        };
      case "vision":
        return {
          icon: <FilmStrip size={14} weight="fill" />,
          label: "Video & Vision AI",
          color: "#10b981",
          bg: "rgba(16, 185, 129, 0.12)",
          border: "rgba(16, 185, 129, 0.25)"
        };
      default:
        return {
          icon: <Cpu size={14} weight="fill" />,
          label: "AI Model",
          color: "#22c55e",
          bg: "rgba(34, 197, 94, 0.12)",
          border: "rgba(34, 197, 94, 0.25)"
        };
    }
  };

  if (!isOpen) return null;

  return (
    <div className="models-drawer-overlay" onClick={onClose}>
      <aside className="models-drawer-panel" onClick={(e) => e.stopPropagation()}>
        {/* ====================================================================
            HEADER
            ==================================================================== */}
        <div className="models-drawer-header">
          <div className="models-header-brand">
            <div className="models-brand-icon">
              <Cpu size={22} weight="fill" />
            </div>
            <div className="models-brand-text">
              <div className="models-brand-title">
                <h2>AI Models Manager</h2>
                <span className="models-badge-offline">Offline Local</span>
              </div>
              <p className="models-brand-sub">គ្រប់គ្រង និងទាញយក AI Models ទាំងអស់</p>
            </div>
          </div>

          <div className="models-header-controls">
            <button
              className="models-header-btn"
              onClick={fetchStatus}
              title="Refresh Model Status"
              disabled={loading}
            >
              <ArrowClockwise size={16} className={loading ? "is-spinning" : ""} />
            </button>
            <button className="models-header-btn close" onClick={onClose} title="បិទ (Close)">
              <X size={18} weight="bold" />
            </button>
          </div>
        </div>

        {/* ====================================================================
            CATEGORY FILTER TABS (With Clean Line Border)
            ==================================================================== */}
        <div className="models-drawer-tabs">
          <button
            type="button"
            className={`models-filter-tab ${filterCategory === "all" ? "active" : ""}`}
            onClick={() => setFilterCategory("all")}
          >
            <span>All Models</span>
            <span className="tab-count">{modelsList.length}</span>
          </button>
          <button
            type="button"
            className={`models-filter-tab ${filterCategory === "stt" ? "active" : ""}`}
            onClick={() => setFilterCategory("stt")}
          >
            <span>STT</span>
            <span className="tab-count">{modelsList.filter((m) => m.category === "stt").length}</span>
          </button>
          <button
            type="button"
            className={`models-filter-tab ${filterCategory === "tts" ? "active" : ""}`}
            onClick={() => setFilterCategory("tts")}
          >
            <span>TTS</span>
            <span className="tab-count">{modelsList.filter((m) => m.category === "tts").length}</span>
          </button>
          <button
            type="button"
            className={`models-filter-tab ${filterCategory === "clone" ? "active" : ""}`}
            onClick={() => setFilterCategory("clone")}
          >
            <span>Voice Clone</span>
            <span className="tab-count">{modelsList.filter((m) => m.category === "clone").length}</span>
          </button>
          <button
            type="button"
            className={`models-filter-tab ${filterCategory === "audio" ? "active" : ""}`}
            onClick={() => setFilterCategory("audio")}
          >
            <span>Audio & Music</span>
            <span className="tab-count">{modelsList.filter((m) => m.category === "audio").length}</span>
          </button>
          <button
            type="button"
            className={`models-filter-tab ${filterCategory === "vision" ? "active" : ""}`}
            onClick={() => setFilterCategory("vision")}
          >
            <span>Vision & Video</span>
            <span className="tab-count">{modelsList.filter((m) => m.category === "vision").length}</span>
          </button>
        </div>

        {/* ====================================================================
            MODELS LIST (Structured Rows with Clean Lines)
            ==================================================================== */}
        <div className="models-drawer-list">
          {filteredModels.length === 0 ? (
            <div className="models-empty-state">
              <Sparkle size={24} color="#94a3b8" />
              <span>មិនមាន Model ក្នុងប្រភេទនេះទេ</span>
            </div>
          ) : (
            <div className="models-rows-container">
              {filteredModels.map((m) => {
                const liveDownload = downloadingModels[m.id];
                const isDownloading = Boolean(liveDownload && liveDownload.status === "downloading");
                const currentPercent = liveDownload ? liveDownload.percent : (m.installed ? 100 : 0);
                const catMeta = getCategoryMeta(m.category);

                return (
                  <div
                    key={m.id}
                    className={`model-row-item ${m.installed ? "is-ready" : ""} ${isDownloading ? "is-active-download" : ""}`}
                  >
                    {/* Top Row: Tag + Name + Size/Status */}
                    <div className="model-row-header">
                      <div className="model-row-title-area">
                        <span
                          className="model-cat-chip"
                          style={{
                            color: catMeta.color,
                            backgroundColor: catMeta.bg,
                            borderColor: catMeta.border
                          }}
                        >
                          {catMeta.icon}
                          <span>{catMeta.label}</span>
                        </span>
                        <h4 className="model-row-name">{m.name}</h4>
                      </div>

                      <div className="model-status-indicator">
                        {m.installed ? (
                          <span className="status-pill ready">
                            <span className="status-dot green"></span>
                            Ready ({m.installedSizeFormatted || m.sizeFormatted})
                          </span>
                        ) : isDownloading ? (
                          <span className="status-pill downloading">
                            <span className="status-dot blue pulsing"></span>
                            {currentPercent}%
                          </span>
                        ) : (
                          <span className="status-pill uninstalled">
                            <span className="status-dot gray"></span>
                            {m.sizeFormatted}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Middle: Description */}
                    <p className="model-row-desc">{m.description}</p>

                    {/* Download Progress Bar if Downloading */}
                    {isDownloading && (
                      <div className="model-row-progress-block">
                        <div className="model-progress-bar-track">
                          <div
                            className="model-progress-bar-fill"
                            style={{ width: `${currentPercent}%` }}
                          ></div>
                        </div>
                        <div className="model-progress-meta">
                          <span className="model-progress-status">
                            <CircleNotch size={12} className="is-spinning" />
                            Downloading weights from HuggingFace to Local Computer...
                          </span>
                          <span className="model-progress-pct">{currentPercent}%</span>
                        </div>
                      </div>
                    )}

                    {/* Bottom Line: Model ID + Action Buttons */}
                    <div className="model-row-actions-line">
                      <div className="model-row-meta-id">
                        <span className="model-badge-tag">{m.badge}</span>
                        <span className="model-code-id">{m.id}</span>
                      </div>

                      <div className="model-row-btn-group">
                        {m.installed ? (
                          <button
                            type="button"
                            className="model-btn-delete"
                            onClick={() => handleDelete(m)}
                            title="លុប Model ចេញពីកុំព្យូទ័រ"
                          >
                            <Trash size={14} />
                            <span>Delete</span>
                          </button>
                        ) : isDownloading ? (
                          <button type="button" className="model-btn-downloading" disabled>
                            <CircleNotch size={14} className="is-spinning" />
                            <span>Downloading {currentPercent}%</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="model-btn-download"
                            onClick={() => handleDownload(m.id)}
                          >
                            <DownloadSimple size={15} weight="bold" />
                            <span>Download ({m.sizeFormatted})</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ====================================================================
            FOOTER INFO (With Top Line Border)
            ==================================================================== */}
        <div className="models-drawer-footer">
          <p>
            💡 <strong>ចំណាំ:</strong> Model ទាំងអស់នឹងដំណើរការដោយផ្ទាល់ក្នុងម៉ាស៊ីនអ្នក (Offline)
            មិនទាមទារ Internet ឬ API Key ឡើយ។
          </p>
        </div>
      </aside>
    </div>
  );
}

export default AIModelsManagerModal;
