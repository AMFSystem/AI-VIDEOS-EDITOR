import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  VideoCamera,
  Play,
  Pause,
  SpeakerHigh,
  SpeakerSlash,
  Sparkle,
  DownloadSimple,
  Plus,
  ArrowsClockwise,
  Check,
  X,
  FileText,
  TerminalWindow,
  CaretDown,
  CaretRight,
  ArrowsOut,
  ArrowsIn,
} from "@phosphor-icons/react";
import { getStoredGeminiKey } from "../../lib/geminiRuntime.js";
import { listVoiceProfiles } from "../../lib/voiceProfileStorage.js";
import "./DubberPanel.css";

// ─────────────────────────────────────────────────────────────────────────────
// EXACT OPTIONS FROM pyvideotrans (webui.py) — 100% Identical
// ─────────────────────────────────────────────────────────────────────────────

export const RECOGN_NAMES = [
  "faster-whisper(Built-in)",
  "openai-whisper(Built-in)",
  "Qwen-ASR(Built-in)",
  "Alibaba FunASR(Built-in)",
  "Nemotron-3.5-asr-0.6b(Built-in)",
  "FireRed Chinese(Built-in)",
  "Dolphin Asian(Built-in)",
  "Omnilingual(Built-in)",
  "Huggingface_ASR(Built-in)",
  "MOSS-Diarize(Built-in)",
  "VibeVoice-ASR(Built-in)",
  "Whisper.cpp(WinBuilt-in)",
  "OpenAI STT API",
  "Ali Bailian API",
  "Xiaomi",
  "ByteDance STT Turbo",
  "Zhipu AI GLM-ASR",
  "Gemini STT",
  "Faster-Whisper-XXL.exe",
  "WhisperX(LocalAPI)",
  "Parakeet-tdt(LocalAPI)",
  "302.ai",
  "ElevenLabs.io",
  "Google STT API (Free)",
  "Deepgram.com",
  "CAMB.ai",
  "STT(LocalAPI)",
  "Whisper.NET",
  "Custom STT API",
  "SiliconFlow",
  "OpenRouter.ai",
  "Minimax AI",
  "Audexum.com",
  "Fish-Audio API",
];

export const FASTER_MODEL_NAMES = [
  "large-v3-turbo",
  "large-v3",
  "large-v2",
  "large-v1",
  "medium",
  "small",
  "base",
  "tiny",
];

export const TRANSLATE_NAMES = [
  "Google Translate (Free)",
  "Microsoft Translate (Free)",
  "M2M100(Built-in)",
  "Hy-MT2-1.8B(Built-in)",
  "OpenAI ChatGPT",
  "DeepSeek",
  "Gemini AI",
  "Zhipu AI",
  "Azure AI",
  "Local LLM (OpenAI-compatible)",
  "OpenRouter",
  "SiliconFlow",
  "302.ai",
  "Ali Bailian API",
  "ByteDance Ark LLM",
  "Xiaomi",
  "MiniMax AI",
  "CAMB.ai",
  "DeepL",
  "DeepLx",
  "Baidu Translate",
  "Alibaba Machine Translation",
  "LibreTranslate(LocalAPI)",
  "Tencent Translate",
  "Custom Translation API",
  "LiteLLM",
  "API Route",
  "Cheaper Inference",
  "Infistar",
  "Atlas Cloud",
  "Opper",
];

export const TTS_NAMES = [
  "Edge-TTS (Free)",
  "Qwen3-TTS(Built-in)",
  "F5-TTS(Built-in)",
  "OmniVoice(Built-in)",
  "Confucius4(Built-in)",
  "MOSS-TTS-Nano(Built-in)",
  "ZipVoice ZH/EN(Built-in)",
  "Piper(Built-in)",
  "ChatterBox(Built-in)",
  "Supertonic3(Built-in)",
  "VITS ZH/EN(Built-in)",
  "Higgs-audio-v3(Built-in)",
  "Index-TTS(LocalAPI)",
  "GPT-SoVITS(LocalAPI)",
  "CosyVoice(LocalAPI)",
  "VoxCPM(LocalAPI)",
  "FireRed3(LocalAPI)",
  "Doubao Voice 2.0",
  "Ali Bailian API",
  "Xiaomi",
  "Zhipu AI",
  "Minimaxi TTS",
  "OpenAI TTS",
  "Gemini TTS",
  "Elevenlabs.io",
  "Audio.cpp(Local)",
  "ChatTTS(LocalAPI)",
  "Spark-TTS(LocalAPI)",
  "kokoro(LocalAPI)",
  "Fish TTS(LocalAPI)",
  "X.AI TTS",
  "gTTS(Free)",
  "Azure TTS",
  "302.ai",
  "CAMB.ai",
  "Custom TTS API",
  "SiliconFlow",
  "OpenRouter.ai",
  "Deepgram.com",
  "clone-voice(LocalAPI)",
  "Fish-Audio API",
];

export const LANG_CHOICES = [
  { code: "zh-cn", name: "Simplified Chinese" },
  { code: "zh-tw", name: "Traditional Chinese" },
  { code: "en", name: "English" },
  { code: "km", name: "Khmer" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "th", name: "Thai" },
  { code: "vi", name: "Vietnamese" },
  { code: "fr", name: "French" },
  { code: "es", name: "Spanish" },
  { code: "de", name: "German" },
  { code: "ru", name: "Russian" },
  { code: "ar", name: "Arabic" },
  { code: "hi", name: "Hindi" },
  { code: "pt", name: "Portuguese" },
  { code: "it", name: "Italian" },
  { code: "id", name: "Indonesian" },
  { code: "ms", name: "Malay" },
  { code: "tl", name: "Filipino (Tagalog)" },
  { code: "my", name: "Burmese" },
  { code: "lo", name: "Lao" },
];

export const SUBTITLE_TYPES = [
  "No Subtitles",
  "Embed Hard Subtitles",
  "Embed Soft Subtitles",
  "Embed Bilingual Hard Subtitles",
  "Embed Bilingual Soft Subtitles",
];

export const PUNC_OPTIONS = [
  "Default Punctuation",
  "Restore Punctuation",
  "Clear Punctuation",
];

export const LOOP_BGM_OPTIONS = [
  "Truncate Background Audio",
  "Loop Background Audio",
];

export function DubberPanel({
  notify = console.log,
  sourceAudioBlob,
  sourceAudioDuration,
  sourceAudioName,
  applyAssetToTrack,
  handleAssetPointerDown,
  setUserAssets,
  setCaptionSegments,
  setCaptionsEnabled,
  updateScript,
  captionStyle,
  handleFiles,
  seekTo,
  setSelectedTrack,
}) {
  // Navigation Tabs: "translate" | "settings" | "advanced"
  const [activeTab, setActiveTab] = useState("translate");
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Translated Video Outputs (Ready for Timeline Drag & Drop or 1-Click Insert)
  const [translatedVideoBlob, setTranslatedVideoBlob] = useState(null);
  const [translatedVideoUrl, setTranslatedVideoUrl] = useState(null);
  const [translatedVideoFile, setTranslatedVideoFile] = useState(null);
  const [translatedVideoAsset, setTranslatedVideoAsset] = useState(null);

  // PyVideoTrans Config Synchronization (params.json & cfg.json)
  const [pyvtConfig, setPyvtConfig] = useState({ params: {}, cfg: {} });
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configSaveStatus, setConfigSaveStatus] = useState(null);

  const fetchConfig = async () => {
    try {
      setIsLoadingConfig(true);
      const res = await fetch("/api/ai/pyvideotrans/config");
      if (res.ok) {
        const data = await res.json();
        setPyvtConfig(data || { params: {}, cfg: {} });
      }
    } catch (err) {
      console.warn("Failed to fetch PyVideoTrans config:", err);
    } finally {
      setIsLoadingConfig(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  // Determine if full-screen overlay should be active (Either manual fullscreen or when Setting / Advance is selected)
  const isSettingsOrAdvanced = activeTab === "settings" || activeTab === "advanced";
  const shouldRenderFullscreen = isFullscreen || isSettingsOrAdvanced;

  const closeFullscreenOrSettings = () => {
    setIsFullscreen(false);
    if (activeTab !== "translate") {
      setActiveTab("translate");
    }
  };

  // Keyboard shortcut: Escape to exit fullscreen or close settings/advance modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && shouldRenderFullscreen) {
        closeFullscreenOrSettings();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shouldRenderFullscreen, activeTab]);

  // Lock background scroll when fullscreen or modal is open
  useEffect(() => {
    if (shouldRenderFullscreen) {
      const origOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = origOverflow;
      };
    }
  }, [shouldRenderFullscreen]);

  const updateParam = (key, value) => {
    setPyvtConfig((prev) => ({
      ...prev,
      params: { ...prev.params, [key]: value },
    }));
  };

  const updateCfg = (key, value) => {
    setPyvtConfig((prev) => ({
      ...prev,
      cfg: { ...prev.cfg, [key]: value },
    }));
  };

  const saveChannelSettings = async () => {
    try {
      setIsSavingConfig(true);
      setConfigSaveStatus(null);
      const res = await fetch("/api/ai/pyvideotrans/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ params: pyvtConfig.params }),
      });
      const data = await res.json();
      if (data.success) {
        setConfigSaveStatus("✓ Channel settings saved to params.json");
        notify?.("Channel settings saved to params.json");
        setTimeout(() => setConfigSaveStatus(null), 4000);
      }
    } catch (err) {
      setConfigSaveStatus("❌ Error saving: " + err.message);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const saveAdvancedSettings = async () => {
    try {
      setIsSavingConfig(true);
      setConfigSaveStatus(null);
      const res = await fetch("/api/ai/pyvideotrans/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cfg: pyvtConfig.cfg }),
      });
      const data = await res.json();
      if (data.success) {
        setConfigSaveStatus("✓ Advanced options saved to cfg.json");
        notify?.("Advanced options saved to cfg.json");
        setTimeout(() => setConfigSaveStatus(null), 4000);
      }
    } catch (err) {
      setConfigSaveStatus("❌ Error saving: " + err.message);
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Video State (Left Column)
  const [uploadedFile, setUploadedFile] = useState(null);
  const [videoSrc, setVideoSrc] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);

  // Dubbed Output Audio & Preview
  const [dubbedAudioBlob, setDubbedAudioBlob] = useState(null);
  const [dubbedAudioUrl, setDubbedAudioUrl] = useState(null);
  const previewVideoRef = useRef(null);
  const previewAudioRef = useRef(null);

  // PyVideoTrans Parameters (Exact 100% Dropdowns & Settings)
  const [recognChoice, setRecognChoice] = useState("faster-whisper(Built-in)");
  const [modelChoice, setModelChoice] = useState("large-v3-turbo");
  const [translateChoice, setTranslateChoice] = useState("Google Translate (Free)");
  const [sourceLang, setSourceLang] = useState("zh-cn");
  const [targetLang, setTargetLang] = useState("km");
  const [ttsChoice, setTtsChoice] = useState("Edge-TTS (Free)");
  const [voiceRole, setVoiceRole] = useState("Piseth(Male/KH)");

  // Speedup & Sliders (Exact defaults from webui.py)
  const [voiceAutoRate, setVoiceAutoRate] = useState(true);
  const [videoAutoRate, setVideoAutoRate] = useState(false);
  const [voiceRate, setVoiceRate] = useState(0); // -50 to 50
  const [volumeRate, setVolumeRate] = useState(0); // -95 to 100
  const [pitchRate, setPitchRate] = useState(0); // -100 to 100
  const [subtitleType, setSubtitleType] = useState("Embed Soft Subtitles");

  // Accordions
  const [isAssEditorOpen, setIsAssEditorOpen] = useState(false);
  const [isMoreSettingsOpen, setIsMoreSettingsOpen] = useState(false);

  // More Settings Parameters
  const [removeNoise, setRemoveNoise] = useState(false);
  const [fixPunc, setFixPunc] = useState("Default Punctuation");
  const [isSeparate, setIsSeparate] = useState(false);
  const [embedBgm, setEmbedBgm] = useState(true);
  const [loopBgm, setLoopBgm] = useState("Truncate Background Audio");
  const [backaudioVolume, setBackaudioVolume] = useState(0.8); // 0.0 to 2.0
  const [cudaAccel, setCudaAccel] = useState(false);

  // Execution & Output State (Right Column)
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState([]);
  const [outputFiles, setOutputFiles] = useState([]);
  const [previewVideoUrl, setPreviewVideoUrl] = useState(null);
  const logBoxRef = useRef(null);

  // Load Custom Cloned Voices
  const [clonedVoices, setClonedVoices] = useState([]);
  useEffect(() => {
    listVoiceProfiles()
      .then((profs) => setClonedVoices(profs || []))
      .catch(() => {});
  }, []);

  // Format Helper: Timestamp hh:mm:ss
  const getLogTimestamp = () => {
    const now = new Date();
    return now.toTimeString().split(" ")[0];
  };

  const addLog = (msg) => {
    const timestamped = `[${getLogTimestamp()}] ${msg}`;
    setLogs((prev) => [...prev, timestamped]);
    setTimeout(() => {
      if (logBoxRef.current) {
        logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
      }
    }, 50);
  };

  // Video Selection
  const handleSelectFile = (file) => {
    if (!file) return;
    setUploadedFile(file);
    const url = URL.createObjectURL(file);
    setVideoSrc(url);
    handleFiles?.([file]);
    notify(`✅ Selected file: ${file.name}`);
    addLog(`Source File: ${file.name}`);
  };

  // Video Player Controls
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration);
  };

  const handleSeek = (e) => {
    const t = parseFloat(e.target.value);
    setCurrentTime(t);
    if (videoRef.current) videoRef.current.currentTime = t;
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const formatSeconds = (sec) => {
    if (!sec || isNaN(sec)) return "00:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  // START PROCESSING (100% Native PyVideoTrans Engine Execution)
  const handleStart = async () => {
    if (!uploadedFile && !sourceAudioBlob) {
      notify("⚠️ Please select a video file first");
      return;
    }

    setIsProcessing(true);
    setLogs([]);
    setOutputFiles([]);
    setPreviewVideoUrl(null);
    setDubbedAudioBlob(null);
    setDubbedAudioUrl(null);

    const fName = uploadedFile?.name || sourceAudioName || "video.mp4";
    addLog(`Source File: ${fName}`);
    addLog(`ASR: ${recognChoice} | Translation: ${translateChoice} | TTS: ${ttsChoice}`);
    addLog(`Language: ${sourceLang} -> ${targetLang} | Voice: ${voiceRole}`);
    addLog(`▶ Uploading source file to local server...`);

    try {
      // 1. Upload video / audio to backend storage
      const uploadPayload = uploadedFile || sourceAudioBlob;
      const uploadRes = await fetch("/api/media/upload", {
        method: "POST",
        headers: {
          "x-filename": encodeURIComponent(fName),
        },
        body: uploadPayload,
      });

      if (!uploadRes.ok) {
        throw new Error("Failed to upload video to local storage");
      }

      const uploadData = await uploadRes.json();
      const serverFilePath = uploadData?.file?.filePath;
      if (!serverFilePath) {
        throw new Error("Server did not return a valid file path");
      }
      addLog(`✓ Stored on server: ${uploadData.file.filename} (${(uploadData.file.size / (1024 * 1024)).toFixed(1)} MB)`);
      addLog(`▶ Launching Native PyVideoTrans engine (100% Free / Zero-API-Key)...`);

      // 2. Start PyVideoTrans native pipeline with SSE streaming
      const recognIdx = RECOGN_NAMES.indexOf(recognChoice);
      const transIdx = TRANSLATE_NAMES.indexOf(translateChoice);
      const ttsIdx = TTS_NAMES.indexOf(ttsChoice);
      const subIdx = SUBTITLE_TYPES.indexOf(subtitleType);

      const processRes = await fetch("/api/ai/pyvideotrans/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filePath: serverFilePath,
          sourceLang: sourceLang === "auto" ? "auto" : sourceLang,
          targetLang: targetLang || "km",
          voiceRole: voiceRole || "Piseth(Male/KH)",
          modelName: modelChoice || "tiny",
          recognType: recognIdx >= 0 ? recognIdx : 0,
          translateType: transIdx >= 0 ? transIdx : 0,
          ttsType: ttsIdx >= 0 ? ttsIdx : 0,
          voiceRate: `${voiceRate >= 0 ? "+" : ""}${voiceRate}%`,
          volume: `${volumeRate >= 0 ? "+" : ""}${volumeRate}%`,
          pitch: `${pitchRate >= 0 ? "+" : ""}${pitchRate}Hz`,
          voiceAutoRate,
          videoAutoRate,
          isSeparate,
          embedBgm,
          backaudioVolume,
          cuda: Boolean(cudaAccel),
          subtitleType: subIdx >= 0 ? subIdx : 2,
        }),
      });

      if (!processRes.ok) {
        const errText = await processRes.text();
        throw new Error(`Process start failed: ${errText}`);
      }

      // 3. Read SSE stream in real-time
      const reader = processRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalResult = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() || "";

        for (const block of blocks) {
          const clean = block.replace(/^data:\s*/, "").trim();
          if (!clean) continue;
          try {
            const event = JSON.parse(clean);
            if (event.type === "log" && event.message) {
              addLog(event.message);
            } else if (event.type === "stage") {
              addLog(`Stage ${event.stage}/${event.total_stages}: ${event.title}`);
            } else if (event.type === "error") {
              addLog(`❌ Error: ${event.error}`);
            } else if (event.type === "done") {
              finalResult = event;
            }
          } catch {}
        }
      }

      if (!finalResult) {
        throw new Error("PyVideoTrans completed without generating target outputs.");
      }

      // 4. Handle outputs
      let fetchedDubbedBlob = null;
      let fetchedDubbedUrl = null;
      if (finalResult.target_audio_url) {
        try {
          const aRes = await fetch(finalResult.target_audio_url);
          if (aRes.ok) {
            fetchedDubbedBlob = await aRes.blob();
            fetchedDubbedUrl = URL.createObjectURL(fetchedDubbedBlob);
            setDubbedAudioBlob(fetchedDubbedBlob);
            setDubbedAudioUrl(fetchedDubbedUrl);
          }
        } catch {}
      }

      const generatedSubtitles = finalResult.subtitles || [];
      const generated = [];

      let fetchedVideoBlob = null;
      let fetchedVideoUrl = null;
      let fetchedVideoFile = null;
      let createdVideoAsset = null;

      if (finalResult.target_mp4_url) {
        try {
          const vRes = await fetch(finalResult.target_mp4_url);
          if (vRes.ok) {
            fetchedVideoBlob = await vRes.blob();
            fetchedVideoUrl = URL.createObjectURL(fetchedVideoBlob);
            const fileName = `${targetLang}-${uploadedFile?.name || "translated_video.mp4"}`;
            fetchedVideoFile = new File([fetchedVideoBlob], fileName, { type: "video/mp4" });
            createdVideoAsset = {
              id: `trans-video-${Date.now()}`,
              name: fileName,
              type: "video",
              blob: fetchedVideoBlob,
              src: fetchedVideoUrl,
              duration: duration || 30,
            };

            setTranslatedVideoBlob(fetchedVideoBlob);
            setTranslatedVideoUrl(fetchedVideoUrl);
            setTranslatedVideoFile(fetchedVideoFile);
            setTranslatedVideoAsset(createdVideoAsset);
            setUserAssets?.((prev) => [createdVideoAsset, ...(prev || [])]);
          }
        } catch (err) {
          console.warn("Could not fetch translated video blob:", err);
        }

        generated.push({
          name: `${targetLang}.mp4`,
          size: fetchedVideoBlob ? `${(fetchedVideoBlob.size / (1024 * 1024)).toFixed(1)} MB` : "Video",
          desc: "Target Dubbed & Subtitled Video",
          blob: fetchedVideoBlob,
          url: finalResult.target_mp4_url,
        });
        setPreviewVideoUrl(fetchedVideoUrl || finalResult.target_mp4_url);
      } else if (videoSrc) {
        setPreviewVideoUrl(videoSrc);
      }

      if (finalResult.target_audio_url) {
        generated.push({
          name: `${targetLang}.m4a`,
          size: fetchedDubbedBlob ? `${(fetchedDubbedBlob.size / (1024 * 1024)).toFixed(1)} MB` : "Audio",
          desc: "Dubbed Master Audio Track",
          blob: fetchedDubbedBlob,
          url: finalResult.target_audio_url,
        });
      }

      if (finalResult.target_sub_url) {
        generated.push({
          name: `${targetLang}.srt`,
          size: "SRT",
          desc: "Target Language Subtitles (Khmer)",
          subtitles: generatedSubtitles,
          url: finalResult.target_sub_url,
        });
      }

      if (finalResult.source_audio_url) {
        generated.push({
          name: `${sourceLang}.m4a`,
          size: "Audio",
          desc: "Source Extracted Audio",
          url: finalResult.source_audio_url,
        });
      }

      if (finalResult.source_sub_url) {
        generated.push({
          name: `${sourceLang}.srt`,
          size: "SRT",
          desc: "Source Language Subtitles",
          url: finalResult.source_sub_url,
        });
      }

      setOutputFiles(generated);
      addLog(`✨ PyVideoTrans completed successfully!`);
      notify("🎉 Video translation and dubbing completed successfully with 100% Native PyVideoTrans!");
    } catch (err) {
      addLog(`❌ Error: ${err.message}`);
      notify(`Error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // 1. Add Translated Video directly to Timeline (Visual "image" track)
  const handleAddVideoToTimeline = () => {
    if (translatedVideoFile && handleFiles) {
      handleFiles([translatedVideoFile]);
      setSelectedTrack?.("image");
      seekTo?.(0);
      notify("🎬 បានបញ្ចូលវីដេអូបកប្រែទៅក្នុង Timeline Track រួចរាល់!");
      return;
    }
    if (translatedVideoAsset && applyAssetToTrack) {
      applyAssetToTrack(translatedVideoAsset, "image", { startTime: 0 });
      setSelectedTrack?.("image");
      seekTo?.(0);
      notify("🎬 បានបញ្ចូលវីដេអូបកប្រែទៅក្នុង Timeline Track រួចរាល់!");
      return;
    }
    if (uploadedFile && handleFiles) {
      handleFiles([uploadedFile]);
      setSelectedTrack?.("image");
      seekTo?.(0);
      notify("🎬 បានបញ្ចូលវីដេអូទៅក្នុង Timeline Track រួចរាល់!");
      return;
    }
    notify("មិនទាន់មានវីដេអូបកប្រែសម្រាប់ដាក់ចូល Timeline ទេ");
  };

  // 2. Add Everything (Translated Video, Subtitles & Audio) to Timeline
  const handleApplyAllToTimeline = () => {
    // A. Add Video to Timeline Track
    if (translatedVideoFile && handleFiles) {
      handleFiles([translatedVideoFile]);
    } else if (translatedVideoAsset && applyAssetToTrack) {
      applyAssetToTrack(translatedVideoAsset, "image", { startTime: 0 });
    }

    // B. Add Subtitles to Captions Track
    const srt = outputFiles.find((f) => f.name.endsWith(".srt") && f.subtitles);
    if (srt?.subtitles && setCaptionSegments) {
      const formatted = srt.subtitles.map((sub, idx) => ({
        id: `caption-pvt-${Date.now()}-${idx}`,
        text: (sub.khmer || sub.text || "").trim(),
        start: Number(sub.start ?? idx * 3.5),
        end: Number(sub.end ?? (idx + 1) * 3.5),
        hidden: false,
        fontId: captionStyle?.fontId || "default",
      }));

      setCaptionSegments(formatted);
      setCaptionsEnabled?.(true);
      const fullText = formatted.map((s) => s.text).join("\n");
      updateScript?.(fullText);
      setSelectedTrack?.("caption");
    }

    // C. Add Khmer Dubbed Audio to Audio Track
    if (dubbedAudioBlob && applyAssetToTrack) {
      const audioAsset = {
        id: `dub-audio-${Date.now()}`,
        name: `Khmer Audio (${voiceRole})`,
        type: "audio",
        blob: dubbedAudioBlob,
        duration: duration || sourceAudioDuration || 30,
      };
      applyAssetToTrack(audioAsset, "audio", { startTime: 0 });
    }

    seekTo?.(0);
    notify("🎉 បានដាក់វីដេអូបកប្រែ, Subtitles & សំឡេងខ្មែរ ចូល Timeline ទាំងអស់រួចរាល់!");
  };

  // 3. Add Subtitles & Audio only
  const handleApplyToTimeline = () => {
    handleApplyAllToTimeline();
  };

  const handleDownloadFile = (file) => {
    if (file.url) {
      const a = document.createElement("a");
      a.href = file.url;
      a.download = file.name;
      a.click();
      notify(`Downloaded: ${file.name}`);
      return;
    }
    if (file.blob || (file.name.endsWith(".m4a") && dubbedAudioBlob)) {
      const b = file.blob || dubbedAudioBlob;
      const url = URL.createObjectURL(b);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
      notify(`Downloaded: ${file.name}`);
      return;
    }
    if (file.name.endsWith(".srt") && file.subtitles) {
      const formatTime = (sec) => {
        const date = new Date(sec * 1000);
        const hh = String(Math.floor(sec / 3600)).padStart(2, "0");
        const mm = String(date.getUTCMinutes()).padStart(2, "0");
        const ss = String(date.getUTCSeconds()).padStart(2, "0");
        const ms = String(date.getUTCMilliseconds()).padStart(3, "0");
        return `${hh}:${mm}:${ss},${ms}`;
      };
      const srtText = file.subtitles
        .map((s, idx) => {
          return `${idx + 1}\n${formatTime(s.start)} --> ${formatTime(s.end)}\n${s.khmer || s.text}\n`;
        })
        .join("\n");
      const blob = new Blob([srtText], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
      notify(`Downloaded: ${file.name}`);
      return;
    }
    notify(`Downloaded: ${file.name}`);
  };

  const renderPanelBody = () => {
    // ─────────────────────────────────────────────────────────────────────────
    // TAB 2: CHANNEL SETTINGS (params.json)
    // ─────────────────────────────────────────────────────────────────────────
    if (activeTab === "settings") {
      return (
        <div className="pvt-settings-body">
          <div className="pvt-save-bar">
            <button
              type="button"
              className="pvt-save-btn"
              onClick={saveChannelSettings}
              disabled={isSavingConfig}
            >
              <Check size={14} weight="bold" />
              <span>{isSavingConfig ? "Saving..." : "Save Channel Settings"}</span>
            </button>
            {configSaveStatus && (
              <div className="pvt-save-feedback">
                {configSaveStatus}
              </div>
            )}
          </div>

          {/* Subtitle Translation Channels */}
          <div className="pvt-category-section">
            <div className="pvt-category-title">🔤 Subtitle Translation Channels</div>
            <div className="pvt-cards-grid is-multi-col">
              {/* Google Translate (Free) */}
              <div className="pvt-channel-card is-active-service">
                <div className="pvt-card-header">
                  <div className="pvt-card-title">Google Translate</div>
                  <span className="pvt-badge-free">100% Free / Built-in</span>
                </div>
                <div className="pvt-field-hint">
                  Standard free Google web endpoint. Zero API key required, automatically configured and tested with Khmer.
                </div>
              </div>

              {/* OpenAI / ChatGPT */}
              <div className="pvt-channel-card">
                <div className="pvt-card-header">
                  <div className="pvt-card-title">OpenAI / ChatGPT</div>
                  <span className="pvt-badge-api">Custom API</span>
                </div>
                <div className="pvt-field-group">
                  <label className="pvt-field-label">API Key</label>
                  <input
                    type="password"
                    placeholder="sk-..."
                    className="pvt-field-input"
                    value={pyvtConfig.params?.chatgpt_key || ""}
                    onChange={(e) => updateParam("chatgpt_key", e.target.value)}
                  />
                </div>
                <div className="pvt-field-group">
                  <label className="pvt-field-label">Base URL (Optional)</label>
                  <input
                    type="text"
                    placeholder="https://api.openai.com/v1"
                    className="pvt-field-input"
                    value={pyvtConfig.params?.chatgpt_api || ""}
                    onChange={(e) => updateParam("chatgpt_api", e.target.value)}
                  />
                </div>
                <div className="pvt-field-group">
                  <label className="pvt-field-label">Model</label>
                  <input
                    type="text"
                    placeholder="gpt-4o-mini"
                    className="pvt-field-input"
                    value={pyvtConfig.params?.chatgpt_model || ""}
                    onChange={(e) => updateParam("chatgpt_model", e.target.value)}
                  />
                </div>
              </div>

              {/* Google Gemini AI */}
              <div className="pvt-channel-card">
                <div className="pvt-card-header">
                  <div className="pvt-card-title">Gemini AI</div>
                  <span className="pvt-badge-api">Custom API</span>
                </div>
                <div className="pvt-field-group">
                  <label className="pvt-field-label">Gemini API Key</label>
                  <input
                    type="password"
                    placeholder="AIzaSy..."
                    className="pvt-field-input"
                    value={pyvtConfig.params?.gemini_key || ""}
                    onChange={(e) => updateParam("gemini_key", e.target.value)}
                  />
                </div>
                <div className="pvt-field-group">
                  <label className="pvt-field-label">Model</label>
                  <input
                    type="text"
                    placeholder="gemini-2.0-flash"
                    className="pvt-field-input"
                    value={pyvtConfig.params?.gemini_model || "gemini-2.0-flash"}
                    onChange={(e) => updateParam("gemini_model", e.target.value)}
                  />
                </div>
              </div>

              {/* DeepSeek */}
              <div className="pvt-channel-card">
                <div className="pvt-card-header">
                  <div className="pvt-card-title">DeepSeek AI</div>
                  <span className="pvt-badge-api">Custom API</span>
                </div>
                <div className="pvt-field-group">
                  <label className="pvt-field-label">API Key</label>
                  <input
                    type="password"
                    placeholder="sk-..."
                    className="pvt-field-input"
                    value={pyvtConfig.params?.deepseek_key || ""}
                    onChange={(e) => updateParam("deepseek_key", e.target.value)}
                  />
                </div>
                <div className="pvt-field-group">
                  <label className="pvt-field-label">Model</label>
                  <input
                    type="text"
                    placeholder="deepseek-chat"
                    className="pvt-field-input"
                    value={pyvtConfig.params?.deepseek_model || "deepseek-chat"}
                    onChange={(e) => updateParam("deepseek_model", e.target.value)}
                  />
                </div>
              </div>

              {/* DeepL Translate */}
              <div className="pvt-channel-card">
                <div className="pvt-card-header">
                  <div className="pvt-card-title">DeepL Translate</div>
                  <span className="pvt-badge-api">Auth Key</span>
                </div>
                <div className="pvt-field-group">
                  <label className="pvt-field-label">Auth Key</label>
                  <input
                    type="password"
                    placeholder="DeepL Auth Key"
                    className="pvt-field-input"
                    value={pyvtConfig.params?.deepl_key || ""}
                    onChange={(e) => updateParam("deepl_key", e.target.value)}
                  />
                </div>
                <div className="pvt-field-group">
                  <label className="pvt-field-label">API URL (Optional)</label>
                  <input
                    type="text"
                    placeholder="https://api-free.deepl.com"
                    className="pvt-field-input"
                    value={pyvtConfig.params?.deepl_api || ""}
                    onChange={(e) => updateParam("deepl_api", e.target.value)}
                  />
                </div>
              </div>

              {/* Ollama / Local LLM */}
              <div className="pvt-channel-card">
                <div className="pvt-card-header">
                  <div className="pvt-card-title">Ollama / Local LLM</div>
                  <span className="pvt-badge-free">Local / Self-Hosted</span>
                </div>
                <div className="pvt-field-group">
                  <label className="pvt-field-label">Local API URL</label>
                  <input
                    type="text"
                    placeholder="http://localhost:11434/v1"
                    className="pvt-field-input"
                    value={pyvtConfig.params?.localllm_api || ""}
                    onChange={(e) => updateParam("localllm_api", e.target.value)}
                  />
                </div>
                <div className="pvt-field-group">
                  <label className="pvt-field-label">Model Name</label>
                  <input
                    type="text"
                    placeholder="qwen2.5:7b"
                    className="pvt-field-input"
                    value={pyvtConfig.params?.localllm_model || ""}
                    onChange={(e) => updateParam("localllm_model", e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Speech Recognition (ASR) Channels */}
          <div className="pvt-category-section">
            <div className="pvt-category-title">🎙️ Speech Recognition (ASR) Channels</div>
            <div className="pvt-cards-grid is-multi-col">
              {/* Faster-Whisper */}
              <div className="pvt-channel-card is-active-service">
                <div className="pvt-card-header">
                  <div className="pvt-card-title">Faster-Whisper (Built-in)</div>
                  <span className="pvt-badge-free">100% Free / Local</span>
                </div>
                <div className="pvt-field-hint">
                  Fast native offline speech-to-text with CTranslate2. Models: tiny (cached locally), base, small, medium, large-v3-turbo.
                </div>
              </div>

              {/* OpenAI STT API */}
              <div className="pvt-channel-card">
                <div className="pvt-card-header">
                  <div className="pvt-card-title">OpenAI Speech to Text</div>
                  <span className="pvt-badge-api">Custom API</span>
                </div>
                <div className="pvt-field-group">
                  <label className="pvt-field-label">API Key</label>
                  <input
                    type="password"
                    placeholder="sk-..."
                    className="pvt-field-input"
                    value={pyvtConfig.params?.openairecognapi_key || ""}
                    onChange={(e) => updateParam("openairecognapi_key", e.target.value)}
                  />
                </div>
                <div className="pvt-field-group">
                  <label className="pvt-field-label">Model</label>
                  <input
                    type="text"
                    placeholder="whisper-1"
                    className="pvt-field-input"
                    value={pyvtConfig.params?.openairecognapi_model || "whisper-1"}
                    onChange={(e) => updateParam("openairecognapi_model", e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* TTS Dubbing Channels */}
          <div className="pvt-category-section">
            <div className="pvt-category-title">🔊 TTS Dubbing Channels</div>
            <div className="pvt-cards-grid is-multi-col">
              {/* Edge-TTS */}
              <div className="pvt-channel-card is-active-service">
                <div className="pvt-card-header">
                  <div className="pvt-card-title">Edge-TTS (Built-in)</div>
                  <span className="pvt-badge-free">100% Free / Zero API Key</span>
                </div>
                <div className="pvt-field-hint">
                  Supports Khmer (Piseth Male / Sreymom Female), Chinese, English, and 70+ languages worldwide with neural synthesis.
                </div>
              </div>

              {/* ElevenLabs */}
              <div className="pvt-channel-card">
                <div className="pvt-card-header">
                  <div className="pvt-card-title">ElevenLabs</div>
                  <span className="pvt-badge-api">Custom API</span>
                </div>
                <div className="pvt-field-group">
                  <label className="pvt-field-label">API Key</label>
                  <input
                    type="password"
                    placeholder="xi-api-key..."
                    className="pvt-field-input"
                    value={pyvtConfig.params?.elevenlabstts_key || ""}
                    onChange={(e) => updateParam("elevenlabstts_key", e.target.value)}
                  />
                </div>
                <div className="pvt-field-group">
                  <label className="pvt-field-label">Model</label>
                  <input
                    type="text"
                    placeholder="eleven_multilingual_v2"
                    className="pvt-field-input"
                    value={pyvtConfig.params?.elevenlabstts_model || "eleven_multilingual_v2"}
                    onChange={(e) => updateParam("elevenlabstts_model", e.target.value)}
                  />
                </div>
              </div>

              {/* OpenAI TTS */}
              <div className="pvt-channel-card">
                <div className="pvt-card-header">
                  <div className="pvt-card-title">OpenAI TTS</div>
                  <span className="pvt-badge-api">Custom API</span>
                </div>
                <div className="pvt-field-group">
                  <label className="pvt-field-label">API Key</label>
                  <input
                    type="password"
                    placeholder="sk-..."
                    className="pvt-field-input"
                    value={pyvtConfig.params?.openaitts_key || ""}
                    onChange={(e) => updateParam("openaitts_key", e.target.value)}
                  />
                </div>
                <div className="pvt-field-group">
                  <label className="pvt-field-label">Model</label>
                  <input
                    type="text"
                    placeholder="tts-1 / tts-1-hd"
                    className="pvt-field-input"
                    value={pyvtConfig.params?.openaitts_model || "tts-1"}
                    onChange={(e) => updateParam("openaitts_model", e.target.value)}
                  />
                </div>
              </div>

              {/* GPT-SoVITS */}
              <div className="pvt-channel-card">
                <div className="pvt-card-header">
                  <div className="pvt-card-title">GPT-SoVITS</div>
                  <span className="pvt-badge-free">Local API</span>
                </div>
                <div className="pvt-field-group">
                  <label className="pvt-field-label">API URL</label>
                  <input
                    type="text"
                    placeholder="http://127.0.0.1:9880"
                    className="pvt-field-input"
                    value={pyvtConfig.params?.gptsovits_url || "http://127.0.0.1:9880"}
                    onChange={(e) => updateParam("gptsovits_url", e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TAB 3: ADVANCED OPTIONS (cfg.json)
    // ─────────────────────────────────────────────────────────────────────────
    if (activeTab === "advanced") {
      return (
        <div className="pvt-advanced-body">
          <div className="pvt-save-bar">
            <button
              type="button"
              className="pvt-save-btn"
              onClick={saveAdvancedSettings}
              disabled={isSavingConfig}
            >
              <Check size={14} weight="bold" />
              <span>{isSavingConfig ? "Saving..." : "Save Advanced Options"}</span>
            </button>
            {configSaveStatus && (
              <div className="pvt-save-feedback">
                {configSaveStatus}
              </div>
            )}
          </div>

          {/* 1. General & Hardware */}
          <div className="pvt-category-section">
            <div className="pvt-category-title">⚙️ General & Hardware Acceleration</div>
            <div className="pvt-cards-grid is-multi-col">
              <div className="pvt-channel-card">
                <div className="pvt-field-group">
                  <label className="pvt-field-label">Compute Device (device_name)</label>
                  <select
                    className="pvt-field-select"
                    value={pyvtConfig.cfg?.device_name || "auto"}
                    onChange={(e) => updateCfg("device_name", e.target.value)}
                  >
                    <option value="auto">auto (Automatic Detection)</option>
                    <option value="mps">mps (Apple Silicon Metal)</option>
                    <option value="cpu">cpu (Standard CPU)</option>
                    <option value="cuda">cuda (NVIDIA GPU)</option>
                  </select>
                  <span className="pvt-field-hint">Select MPS for Mac M1/M2/M3/M4 or CUDA for NVIDIA.</span>
                </div>
                <div className="pvt-field-group">
                  <label className="pvt-field-label">Max Concurrency Process Threads</label>
                  <input
                    type="number"
                    min="0"
                    max="16"
                    className="pvt-field-input"
                    value={pyvtConfig.cfg?.process_max ?? 0}
                    onChange={(e) => updateCfg("process_max", parseInt(e.target.value, 10) || 0)}
                  />
                  <span className="pvt-field-hint">0 means automatic based on system CPU cores.</span>
                </div>
              </div>

              <div className="pvt-channel-card">
                <div className="pvt-field-group">
                  <label className="pvt-field-label">Vocal & BGM Separation Model (uvr_models)</label>
                  <select
                    className="pvt-field-select"
                    value={pyvtConfig.cfg?.uvr_models || "spleeter"}
                    onChange={(e) => updateCfg("uvr_models", e.target.value)}
                  >
                    <option value="spleeter">spleeter (Fast & Lightweight)</option>
                    <option value="UVR-MDX-NET-Inst_HQ_4">UVR-MDX-NET-Inst_HQ_4 (High Quality)</option>
                    <option value="UVR-MDX-NET-Inst_1">UVR-MDX-NET-Inst_1</option>
                    <option value="UVR-MDX-NET-Inst_Main">UVR-MDX-NET-Inst_Main</option>
                  </select>
                </div>
                <div className="pvt-field-checkbox-row">
                  <input
                    type="checkbox"
                    id="cfg_hw_decode"
                    checked={!!pyvtConfig.cfg?.hw_decode}
                    onChange={(e) => updateCfg("hw_decode", e.target.checked)}
                  />
                  <label htmlFor="cfg_hw_decode" className="pvt-field-checkbox-label">
                    Enable Hardware Decoding (hw_decode)
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Video Encoding & Format */}
          <div className="pvt-category-section">
            <div className="pvt-category-title">🎬 Video Encoding & Quality</div>
            <div className="pvt-cards-grid is-multi-col">
              <div className="pvt-channel-card">
                <div className="pvt-field-group">
                  <label className="pvt-field-label">Video Codec</label>
                  <select
                    className="pvt-field-select"
                    value={String(pyvtConfig.cfg?.video_codec || "264")}
                    onChange={(e) => updateCfg("video_codec", e.target.value === "265" ? 265 : 264)}
                  >
                    <option value="264">H.264 / AVC (Most Compatible)</option>
                    <option value="265">H.265 / HEVC (Higher Compression)</option>
                  </select>
                </div>
                <div className="pvt-field-group">
                  <label className="pvt-field-label">Video Quality CRF (crf: 0-51)</label>
                  <input
                    type="number"
                    min="0"
                    max="51"
                    className="pvt-field-input"
                    value={pyvtConfig.cfg?.crf ?? 20}
                    onChange={(e) => updateCfg("crf", parseInt(e.target.value, 10) || 20)}
                  />
                  <span className="pvt-field-hint">Lower value = higher video quality (default: 20-23).</span>
                </div>
              </div>

              <div className="pvt-channel-card">
                <div className="pvt-field-group">
                  <label className="pvt-field-label">Encoding Preset</label>
                  <select
                    className="pvt-field-select"
                    value={pyvtConfig.cfg?.preset || "medium"}
                    onChange={(e) => updateCfg("preset", e.target.value)}
                  >
                    <option value="ultrafast">ultrafast (Fastest)</option>
                    <option value="veryfast">veryfast</option>
                    <option value="faster">faster</option>
                    <option value="fast">fast</option>
                    <option value="medium">medium (Recommended)</option>
                    <option value="slow">slow (Highest Quality)</option>
                  </select>
                </div>
                <div className="pvt-field-group">
                  <label className="pvt-field-label">Output Container Extension</label>
                  <select
                    className="pvt-field-select"
                    value={pyvtConfig.cfg?.out_video_ext || ".mp4"}
                    onChange={(e) => updateCfg("out_video_ext", e.target.value)}
                  >
                    <option value=".mp4">.mp4</option>
                    <option value=".mkv">.mkv</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Whisper & VAD Parameters */}
          <div className="pvt-category-section">
            <div className="pvt-category-title">🎙️ Speech-to-Text & VAD Tuning</div>
            <div className="pvt-cards-grid is-multi-col">
              <div className="pvt-channel-card">
                <div className="pvt-field-group">
                  <label className="pvt-field-label">Voice Activity Detection (vad_type)</label>
                  <select
                    className="pvt-field-select"
                    value={pyvtConfig.cfg?.vad_type || "silero"}
                    onChange={(e) => updateCfg("vad_type", e.target.value)}
                  >
                    <option value="silero">silero (Default & Accurate)</option>
                    <option value="tenvad">tenvad</option>
                  </select>
                </div>
                <div className="pvt-field-group">
                  <label className="pvt-field-label">VAD Speech Threshold (0.1 - 0.9)</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0.1"
                    max="0.9"
                    className="pvt-field-input"
                    value={pyvtConfig.cfg?.threshold ?? 0.45}
                    onChange={(e) => updateCfg("threshold", parseFloat(e.target.value) || 0.45)}
                  />
                </div>
              </div>

              <div className="pvt-channel-card">
                <div className="pvt-field-group">
                  <label className="pvt-field-label">Beam Size (beam_size)</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    className="pvt-field-input"
                    value={pyvtConfig.cfg?.beam_size ?? 5}
                    onChange={(e) => updateCfg("beam_size", parseInt(e.target.value, 10) || 5)}
                  />
                </div>
                <div className="pvt-field-checkbox-row">
                  <input
                    type="checkbox"
                    id="cfg_del_end_punc"
                    checked={!!pyvtConfig.cfg?.del_end_punc}
                    onChange={(e) => updateCfg("del_end_punc", e.target.checked)}
                  />
                  <label htmlFor="cfg_del_end_punc" className="pvt-field-checkbox-label">
                    Remove punctuation marks at end of subtitles (del_end_punc)
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Audio Speed & Video Alignment (Justification) */}
          <div className="pvt-category-section">
            <div className="pvt-category-title">⏱️ Audio Speed & Video Alignment (Justification)</div>
            <div className="pvt-cards-grid is-multi-col">
              <div className="pvt-channel-card">
                <div className="pvt-field-group">
                  <label className="pvt-field-label">Max Audio Speed Rate (max_audio_speed_rate %)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="pvt-field-input"
                    value={pyvtConfig.cfg?.max_audio_speed_rate ?? 50}
                    onChange={(e) => updateCfg("max_audio_speed_rate", parseInt(e.target.value, 10) || 50)}
                  />
                  <span className="pvt-field-hint">Prevents audio from playing too fast (chipmunk voice effect). Default: 50.</span>
                </div>
                <div className="pvt-field-group">
                  <label className="pvt-field-label">Max Video Slowdown Rate (max_video_pts_rate %)</label>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    className="pvt-field-input"
                    value={pyvtConfig.cfg?.max_video_pts_rate ?? 10}
                    onChange={(e) => updateCfg("max_video_pts_rate", parseInt(e.target.value, 10) || 10)}
                  />
                  <span className="pvt-field-hint">Allows video to slow down slightly if dubbed audio exceeds clip duration.</span>
                </div>
              </div>

              <div className="pvt-channel-card">
                <div className="pvt-field-group">
                  <label className="pvt-field-label">Silence Removal Level (remove_dubb_silence_level)</label>
                  <select
                    className="pvt-field-select"
                    value={pyvtConfig.cfg?.remove_dubb_silence_level || "default"}
                    onChange={(e) => updateCfg("remove_dubb_silence_level", e.target.value)}
                  >
                    <option value="low">low</option>
                    <option value="default">default (Standard)</option>
                    <option value="max">max (Aggressive)</option>
                  </select>
                </div>
                <div className="pvt-field-group">
                  <label className="pvt-field-label">Edge-TTS Max Concurrency Tasks</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    className="pvt-field-input"
                    value={pyvtConfig.cfg?.edgetts_max_concurrent_tasks ?? 10}
                    onChange={(e) => updateCfg("edgetts_max_concurrent_tasks", parseInt(e.target.value, 10) || 10)}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TAB 1: VIDEO TRANSLATION (Default 2-Column Studio)
    // ─────────────────────────────────────────────────────────────────────────
    return (
      <div className="pvt-exact-body is-translate-grid">
        {/* ======================================================
            LEFT COLUMN (Scale 3): Video Player + All Dropdowns & Settings
            ====================================================== */}
        <div className="pvt-exact-left-col">
          {/* 1. Select Video File */}
          <div className="pvt-component-box">
            <label className="pvt-component-label">Select Video File</label>

            <div className="pvt-video-drop-area">
              {videoSrc ? (
                <div className="pvt-active-video-box">
                  <video
                    ref={videoRef}
                    src={videoSrc}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                    onEnded={() => setIsPlaying(false)}
                    className="pvt-actual-video"
                  />
                  <div className="pvt-native-video-controls">
                    <button type="button" className="pvt-v-btn" onClick={togglePlay}>
                      {isPlaying ? <Pause size={14} weight="fill" /> : <Play size={14} weight="fill" />}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max={duration || 100}
                      step="0.1"
                      value={currentTime}
                      onChange={handleSeek}
                      className="pvt-v-seeker"
                    />
                    <span className="pvt-v-time">
                      {formatSeconds(currentTime)} / {formatSeconds(duration)}
                    </span>
                    <button type="button" className="pvt-v-btn" onClick={toggleMute}>
                      {isMuted ? <SpeakerSlash size={14} /> : <SpeakerHigh size={14} />}
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className={`pvt-empty-drop-zone ${isDragging ? "is-drag" : ""}`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const file = e.dataTransfer?.files?.[0];
                    if (file) handleSelectFile(file);
                  }}
                >
                  <VideoCamera size={32} color="#6366f1" />
                  <span className="pvt-drop-title">Drop video here or click to upload</span>
                  <span className="pvt-drop-sub">MP4, MKV, WebM, MOV, AVI</span>
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="video/*,audio/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleSelectFile(f);
              }}
            />

            {uploadedFile && (
              <div className="pvt-video-file-actions">
                <span className="pvt-file-badge" title={uploadedFile.name}>
                  {uploadedFile.name} ({(uploadedFile.size / (1024 * 1024)).toFixed(1)} MB)
                </span>
                <button
                  type="button"
                  className="pvt-mini-action-btn"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Change Video
                </button>
                <button
                  type="button"
                  className="pvt-mini-action-btn is-danger"
                  onClick={() => {
                    setUploadedFile(null);
                    setVideoSrc(null);
                  }}
                >
                  <X size={12} />
                </button>
              </div>
            )}
          </div>

          {/* 2. ASR Channel Dropdown */}
          <div className="pvt-component-box">
            <label className="pvt-component-label">ASR Channel</label>
            <select
              className="pvt-exact-select"
              value={recognChoice}
              onChange={(e) => setRecognChoice(e.target.value)}
            >
              {RECOGN_NAMES.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Model Dropdown */}
          <div className="pvt-component-box">
            <label className="pvt-component-label">Model</label>
            <select
              className="pvt-exact-select"
              value={modelChoice}
              onChange={(e) => setModelChoice(e.target.value)}
            >
              {FASTER_MODEL_NAMES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Translation Channel Dropdown */}
          <div className="pvt-component-box">
            <label className="pvt-component-label">Translation Channel</label>
            <select
              className="pvt-exact-select"
              value={translateChoice}
              onChange={(e) => setTranslateChoice(e.target.value)}
            >
              {TRANSLATE_NAMES.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* 5. Source Language (Spoken) */}
          <div className="pvt-component-box">
            <label className="pvt-component-label">Source Language</label>
            <select
              className="pvt-exact-select"
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value)}
            >
              <option value="auto">Auto Detect</option>
              {LANG_CHOICES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          {/* 6. Target Language */}
          <div className="pvt-component-box">
            <label className="pvt-component-label">Target Language</label>
            <select
              className="pvt-exact-select"
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
            >
              <option value="-">-</option>
              {LANG_CHOICES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          {/* 7. TTS Channel Dropdown */}
          <div className="pvt-component-box">
            <label className="pvt-component-label">TTS Channel</label>
            <select
              className="pvt-exact-select"
              value={ttsChoice}
              onChange={(e) => setTtsChoice(e.target.value)}
            >
              {TTS_NAMES.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* 8. Voice Role Dropdown */}
          <div className="pvt-component-box">
            <label className="pvt-component-label">Voice Role</label>
            <select
              className="pvt-exact-select"
              value={voiceRole}
              onChange={(e) => setVoiceRole(e.target.value)}
            >
              <optgroup label="🇰🇭 Khmer Dubbing Voices">
                <option value="Piseth(Male/KH)">Piseth - ពិសិដ្ឋ (Male/KH)</option>
                <option value="Sreymom(Female/KH)">Sreymom / Sophea - ស្រីមុំ (Female/KH)</option>
                <option value="Dara(Male/KH)">Dara - តារា (Male/KH)</option>
                <option value="Bopha(Female/KH)">Bopha - បុប្ផា (Female/KH)</option>
              </optgroup>
              <optgroup label="🇨🇳 Chinese Voices">
                <option value="zh-CN-YunxiNeural">zh-CN-YunxiNeural</option>
                <option value="zh-CN-XiaoxiaoNeural">zh-CN-XiaoxiaoNeural</option>
              </optgroup>
              <optgroup label="🇺🇸 English Voices">
                <option value="en-US-GuyNeural">en-US-GuyNeural</option>
                <option value="en-US-JennyNeural">en-US-JennyNeural</option>
              </optgroup>
              {clonedVoices.length > 0 && (
                <optgroup label="✨ Cloned Voice Profiles">
                  {clonedVoices.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.engine?.toUpperCase()})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          {/* 9. Checkbox Row: Audio Speedup & Video Slowdown */}
          <div className="pvt-exact-row">
            <label className="pvt-checkbox-item">
              <input
                type="checkbox"
                checked={voiceAutoRate}
                onChange={(e) => setVoiceAutoRate(e.target.checked)}
              />
              <span>Audio Speedup</span>
            </label>
            <label className="pvt-checkbox-item">
              <input
                type="checkbox"
                checked={videoAutoRate}
                onChange={(e) => setVideoAutoRate(e.target.checked)}
              />
              <span>Video Slowdown</span>
            </label>
          </div>

          {/* 10. Sliders Row: Voice Speed (%), Volume (%), Pitch (Hz) */}
          <div className="pvt-exact-sliders-row">
            <div className="pvt-slider-item">
              <div className="pvt-slider-label-row">
                <span>Voice Speed (%)</span>
                <code>{voiceRate}</code>
              </div>
              <input
                type="range"
                min="-50"
                max="50"
                value={voiceRate}
                onChange={(e) => setVoiceRate(parseInt(e.target.value))}
                className="pvt-range-slider"
              />
            </div>

            <div className="pvt-slider-item">
              <div className="pvt-slider-label-row">
                <span>Volume (%)</span>
                <code>{volumeRate}</code>
              </div>
              <input
                type="range"
                min="-95"
                max="100"
                value={volumeRate}
                onChange={(e) => setVolumeRate(parseInt(e.target.value))}
                className="pvt-range-slider"
              />
            </div>

            <div className="pvt-slider-item">
              <div className="pvt-slider-label-row">
                <span>Pitch (Hz)</span>
                <code>{pitchRate}</code>
              </div>
              <input
                type="range"
                min="-100"
                max="100"
                value={pitchRate}
                onChange={(e) => setPitchRate(parseInt(e.target.value))}
                className="pvt-range-slider"
              />
            </div>
          </div>

          {/* 11. Subtitle Embedding Type */}
          <div className="pvt-component-box">
            <label className="pvt-component-label">Subtitle Embedding Type</label>
            <select
              className="pvt-exact-select"
              value={subtitleType}
              onChange={(e) => setSubtitleType(e.target.value)}
            >
              {SUBTITLE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* 12. Accordion: Hard Subtitle Style Editor */}
          <div className="pvt-accordion-box">
            <div
              className="pvt-accordion-bar"
              onClick={() => setIsAssEditorOpen(!isAssEditorOpen)}
            >
              <div className="pvt-acc-title">
                {isAssEditorOpen ? <CaretDown size={14} /> : <CaretRight size={14} />}
                <span>🎨 Hard Subtitle Style Editor</span>
              </div>
            </div>
            {isAssEditorOpen && (
              <div className="pvt-accordion-content">
                <div className="pvt-acc-grid">
                  <div>
                    <label className="pvt-mini-label">Font Family</label>
                    <select className="pvt-exact-select">
                      <option>Kantumruy Pro (Khmer)</option>
                      <option>Hanuman</option>
                      <option>Microsoft YaHei</option>
                      <option>Arial</option>
                    </select>
                  </div>
                  <div>
                    <label className="pvt-mini-label">Font Size</label>
                    <input type="number" defaultValue="22" className="pvt-mini-input" />
                  </div>
                  <div>
                    <label className="pvt-mini-label">Primary Color</label>
                    <input type="color" defaultValue="#ffffff" className="pvt-color-input" />
                  </div>
                  <div>
                    <label className="pvt-mini-label">Outline Color</label>
                    <input type="color" defaultValue="#000000" className="pvt-color-input" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 13. Accordion: More Settings */}
          <div className="pvt-accordion-box">
            <div
              className="pvt-accordion-bar"
              onClick={() => setIsMoreSettingsOpen(!isMoreSettingsOpen)}
            >
              <div className="pvt-acc-title">
                {isMoreSettingsOpen ? <CaretDown size={14} /> : <CaretRight size={14} />}
                <span>🗂️ More Settings</span>
              </div>
            </div>
            {isMoreSettingsOpen && (
              <div className="pvt-accordion-content">
                <div className="pvt-exact-row">
                  <label className="pvt-checkbox-item">
                    <input
                      type="checkbox"
                      checked={removeNoise}
                      onChange={(e) => setRemoveNoise(e.target.checked)}
                    />
                    <span>Noise Reduction</span>
                  </label>
                  <div style={{ flex: 1 }}>
                    <label className="pvt-mini-label">Punctuation Processing</label>
                    <select
                      className="pvt-exact-select"
                      value={fixPunc}
                      onChange={(e) => setFixPunc(e.target.value)}
                    >
                      {PUNC_OPTIONS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="pvt-exact-row" style={{ marginTop: 8 }}>
                  <label className="pvt-checkbox-item">
                    <input
                      type="checkbox"
                      checked={isSeparate}
                      onChange={(e) => setIsSeparate(e.target.checked)}
                    />
                    <span>Separate Vocals and BGM</span>
                  </label>
                  <label className="pvt-checkbox-item">
                    <input
                      type="checkbox"
                      checked={embedBgm}
                      onChange={(e) => setEmbedBgm(e.target.checked)}
                    />
                    <span>Re-embed Background Audio</span>
                  </label>
                </div>

                <div className="pvt-exact-row" style={{ marginTop: 8 }}>
                  <div style={{ flex: 1 }}>
                    <label className="pvt-mini-label">Background Audio Processing</label>
                    <select
                      className="pvt-exact-select"
                      value={loopBgm}
                      onChange={(e) => setLoopBgm(e.target.value)}
                    >
                      {LOOP_BGM_OPTIONS.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="pvt-slider-label-row">
                      <span className="pvt-mini-label">Background Audio Volume</span>
                      <code>{backaudioVolume.toFixed(1)}</code>
                    </div>
                    <input
                      type="range"
                      min="0.0"
                      max="2.0"
                      step="0.1"
                      value={backaudioVolume}
                      onChange={(e) => setBackaudioVolume(parseFloat(e.target.value))}
                      className="pvt-range-slider"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 14. Enable CUDA Acceleration */}
          <div className="pvt-component-box">
            <label className="pvt-checkbox-item" title="Hardware acceleration (CUDA / GPU)">
              <input
                type="checkbox"
                checked={cudaAccel}
                onChange={(e) => setCudaAccel(e.target.checked)}
              />
              <span>CUDA Acceleration</span>
            </label>
          </div>

          {/* 15. Start Button (Primary Blue Button) */}
          <button
            type="button"
            className="pvt-start-processing-btn"
            disabled={isProcessing}
            onClick={handleStart}
          >
            <Sparkle size={18} weight="fill" />
            <span>{isProcessing ? "Processing..." : "🚀 Start Processing"}</span>
          </button>
        </div>

        {/* ======================================================
            RIGHT COLUMN (Scale 2): Execution Log + Video Preview + Output Files
            ====================================================== */}
        <div className="pvt-exact-right-col">
          {/* 1. Execution Log */}
          <div className="pvt-component-box">
            <div className="pvt-component-header-row">
              <label className="pvt-component-label">
                <TerminalWindow size={15} />
                <span>Execution Log</span>
              </label>
              {isProcessing && <span className="pvt-pulse-badge">Running</span>}
            </div>

            <div className="pvt-execution-console" ref={logBoxRef}>
              {logs.length > 0 ? (
                logs.map((line, idx) => (
                  <div
                    key={idx}
                    className={`pvt-log-text ${
                      line.includes("✓") || line.includes("✨") ? "is-success" : ""
                    } ${line.includes("▶") ? "is-heading" : ""} ${
                      line.includes("❌") ? "is-err" : ""
                    }`}
                  >
                    {line}
                  </div>
                ))
              ) : (
                <div className="pvt-empty-console">Ready. Click 'Start Processing' to begin...</div>
              )}
            </div>
          </div>

          {/* 2. Video Preview */}
          <div className="pvt-component-box">
            <label className="pvt-component-label">Video Preview (Khmer Dubbed)</label>
            <div className="pvt-preview-video-container">
              {previewVideoUrl ? (
                <div style={{ width: "100%", display: "flex", flexDirection: "column" }}>
                  <video
                    ref={previewVideoRef}
                    src={previewVideoUrl}
                    controls
                    muted={Boolean(dubbedAudioUrl)}
                    onPlay={() => {
                      if (previewAudioRef.current && dubbedAudioUrl) {
                        previewAudioRef.current.currentTime = previewVideoRef.current.currentTime;
                        previewAudioRef.current.play().catch(() => {});
                      }
                    }}
                    onPause={() => {
                      if (previewAudioRef.current) previewAudioRef.current.pause();
                    }}
                    onSeeked={() => {
                      if (previewAudioRef.current && previewVideoRef.current) {
                        previewAudioRef.current.currentTime = previewVideoRef.current.currentTime;
                      }
                    }}
                    className="pvt-preview-video-tag"
                  />
                  {dubbedAudioUrl && (
                    <audio ref={previewAudioRef} src={dubbedAudioUrl} style={{ display: "none" }} />
                  )}
                </div>
              ) : (
                <div className="pvt-empty-preview-tag">
                  <span>No video preview available</span>
                </div>
              )}
            </div>

            {/* Direct Integration with AI Video Editor Timeline */}
            {(previewVideoUrl || translatedVideoAsset || outputFiles.length > 0) && (
              <div className="pvt-timeline-actions-wrap">
                <div className="pvt-timeline-buttons-row">
                  <button
                    type="button"
                    className="pvt-add-video-btn"
                    onClick={handleAddVideoToTimeline}
                    title="ដាក់វីដេអូបកប្រែចូលបន្ទាត់ Video នៃ Timeline"
                  >
                    <VideoCamera size={16} weight="bold" />
                    <span>🎬 ដាក់វីដេអូបកប្រែចូល Timeline (Add Video)</span>
                  </button>

                  <button
                    type="button"
                    className="pvt-add-all-btn"
                    onClick={handleApplyAllToTimeline}
                    title="ដាក់ទាំងវីដេអូ, Subtitles និងសំឡេងខ្មែរចូល Timeline ទាំងអស់"
                  >
                    <Plus size={16} weight="bold" />
                    <span>✨ ដាក់ទាំងអស់ (Video + Subtitles + Audio)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const panelContent = (
    <div className={`pvt-exact-root ${shouldRenderFullscreen ? "is-fullscreen" : ""}`}>
      {/* ========================================================
          Top Navigation Tabs (Fully Responsive: Video Translation | Channel Settings | Advanced Options)
          ======================================================== */}
      <div className="pvt-exact-header">
        <div className="pvt-exact-tabs">
          <button
            type="button"
            className={`pvt-exact-tab ${activeTab === "translate" ? "is-active" : ""}`}
            onClick={() => {
              setActiveTab("translate");
              setIsFullscreen(false);
            }}
            title="Video Translation"
          >
            <span>🎬</span>
            <span>Video</span>
          </button>
          <button
            type="button"
            className={`pvt-exact-tab ${activeTab === "settings" ? "is-active" : ""}`}
            onClick={() => {
              setActiveTab("settings");
              setIsFullscreen(true);
            }}
            title="Channel & API Settings (Full Screen)"
          >
            <span>⚙️</span>
            <span>Setting</span>
          </button>
          <button
            type="button"
            className={`pvt-exact-tab ${activeTab === "advanced" ? "is-active" : ""}`}
            onClick={() => {
              setActiveTab("advanced");
              setIsFullscreen(true);
            }}
            title="Global Advanced Options (Full Screen)"
          >
            <span>🔧</span>
            <span>Advance</span>
          </button>
        </div>

        {shouldRenderFullscreen ? (
          <button
            type="button"
            className="pvt-fullscreen-close-btn"
            onClick={closeFullscreenOrSettings}
            title="Close & Return to Video (Esc)"
          >
            <X size={14} weight="bold" />
            <span>Close (Esc)</span>
          </button>
        ) : (
          <button
            type="button"
            className="pvt-fullscreen-toggle"
            onClick={() => setIsFullscreen(true)}
            title="Fullscreen Studio Mode"
          >
            <ArrowsOut size={15} />
          </button>
        )}
      </div>

      {renderPanelBody()}
    </div>
  );

  if (shouldRenderFullscreen) {
    return createPortal(
      <div className="pvt-fullscreen-overlay">
        {panelContent}
      </div>,
      document.body
    );
  }

  return panelContent;
}

export default DubberPanel;
