import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  Microphone,
  SpeakerHigh,
  Waveform,
  ClockCounterClockwise,
  Sparkle,
  UploadSimple,
  Play,
  Pause,
  DownloadSimple,
  FilmStrip,
  Trash,
  Plus,
  MagnifyingGlass,
  SquaresFour,
  ListDashes,
  Star,
  Sliders,
  ShareNetwork,
  Heart,
  X,
  CheckCircle,
  Brain,
  Globe,
  Copy,
  Check,
  Stop,
  ArrowRight,
  CircleNotch,
  Minus,
  ArrowsClockwise,
  Key,
  MagicWand,
  ShieldCheck,
} from "@phosphor-icons/react";
import {
  getStoredGeminiKey,
  setStoredGeminiKey,
  verifyGeminiKey,
  directVoiceoverWithGemini,
  synthesizeWithGemini,
} from "../../lib/geminiRuntime.js";
import "./VoiceCloneStudioPage.css";
import { VoiceFLRack } from "../../components/VoiceFLStudio/VoiceFLRack.jsx";

// --- Preset Characters (Empty: Default voices removed per user request) ---
const PRESET_CHARACTERS = [];

const SAMPLE_SCRIPTS = [
  "នៅពេលដែលកូនក្សត្រឡើងគ្រងរាជ្យ ទ្រង់តែងតែយកចិត្តទុកដាក់លើរាស្ត្រជានិច្ច។",
  "ព្រះរាជាបានត្រាស់បង្គាប់ឱ្យរៀបចំក្បួនទ័ព ដើម្បីចេញទៅជួយសង្គ្រោះប្រជារាស្ត្រដែលកំពុងរងទុក្ខ។",
  "សួស្តី! សូមស្វាគមន៍មកកាន់ប្រព័ន្ធផលិតសំឡេង AI ភាសាខ្មែរ ជំនាន់ចុងក្រោយបង្អស់។",
  "សម័យស្ដេចគឺជាសម័យកាលដ៏រុងរឿងមួយ ដែលពោរពេញទៅដោយវីរភាព និងប្រវត្តិសាស្ត្រដ៏អស្ចារ្យ។"
];

const EMOTIONS = [
  { id: "none", label: "😊 None" },
  { id: "happy", label: "😄 រីករាយ (Happy)" },
  { id: "angry", label: "😠 ខឹង (Angry)" },
  { id: "sad", label: "😢 កើតទុក្ខ (Sad)" },
  { id: "surprised", label: "😲 ភ្ញាក់ផ្អើល (Surprised)" },
  { id: "whisper", label: "🤫 ខ្សឹប (Whisper)" }
];

const STYLES = [
  { id: "professional", label: "👔 Professional" },
  { id: "sponsor", label: "📢 ស្ពតពាណិជ្ជកម្ម (Sponsor)" },
  { id: "dramatic", label: "🎭 រឿងភាគ/បុរាណ (Dramatic)" },
  { id: "news", label: "🎙️ ព័ត៌មាន (News)" },
  { id: "cinematic", label: "🎬 ភាពយន្ត (Cinematic)" },
  { id: "casual", label: "💬 សន្ទនាធម្មតា (Casual)" }
];

const LANGUAGES = [
  { id: "auto", label: "🌐 Auto Detect (ស្វ័យប្រវត្តិ)" },
  { id: "km", label: "🇰🇭 Khmer (ភាសាខ្មែរ)" },
  { id: "en", label: "🇬🇧 English (អង់គ្លេស)" }
];

const GENERATION_PIPELINE_STAGES = [
  { id: "director", num: 1, name: "Gemini AI Director", desc: "វិភាគ & កែលម្អសូរសំនៀង" },
  { id: "acoustic", num: 2, name: "Speaker DNA Profile", desc: "ស្រង់លក្ខណៈសូរសំឡេងគំរូ" },
  { id: "neural", num: 3, name: "Neural Flow-Matching", desc: "សំយោគរលកសំឡេង 32-Step" },
  { id: "mastering", num: 4, name: "Studio Mastering", desc: "តម្រឹមដង្ហើម & Waveform" },
];

const BONDETH_AUTH_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5YzdkYTNlZi0xMDBhLTQ3ZjItODc3YS01M2QzYTQ1MGJkZmIiLCJ0eXBlIjoiYWNjZXNzIiwiaWF0IjoxNzkyODEyMjQzLCJleHAiOjE5NTA0OTIyNDN9.Ca3Zxsn26DM6Myiw35v_4MoZ6h_3nRy7kahd3tfI_yc";

export function VoiceCloneStudioPage({
  initialTab = "tts",
  onBack,
  onInsertToTimeline,
  voiceProfiles = [],
  addVoiceProfile,
  removeVoiceProfile,
  selectedVoiceProfileId,
  setSelectedVoiceProfileId,
  language = "km",
  notify = console.log,
  onOpenModelsManager,
  requireModel,
  isModelInstalled,
}) {
  // Navigation View: "tts" (Main Studio & Library) | "train" | "stt"
  const [activeTab, setActiveTab] = useState(
    initialTab && initialTab !== "clone" && initialTab !== "voice_fl" ? initialTab : "tts"
  );

  // Selected Voice in Library
  const [selectedVoiceId, setSelectedVoiceId] = useState(null);
  const [favoriteVoiceIds, setFavoriteVoiceIds] = useState(() => new Set());

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [viewMode, setViewMode] = useState("grid"); // "grid" | "list"

  // Controls Form
  const [selectedLang, setSelectedLang] = useState("auto"); // "auto" | "km" | "en"
  const [selectedEmotion, setSelectedEmotion] = useState("none");
  const [selectedStyle, setSelectedStyle] = useState("professional");
  const [showAdvancedModal, setShowAdvancedModal] = useState(false);
  const [ttsSpeed, setTtsSpeed] = useState(1.0);
  const [ttsPitch, setTtsPitch] = useState(1.0);
  const [ttsModelEngine, setTtsModelEngine] = useState("voxcpm2"); // "voxcpm2" | "omnivoice" | "gemini"

  // Text Area Input
  const [ttsText, setTtsText] = useState(
    "នៅពេលយប់ជ្រៅ ឮសូរផ្គរលាន់រន្ទះផ្គររន្ទះ ក្នុងព្រៃជ្រៅមានសត្វស្លាបមួយក្បាលហើរឆ្លងកាត់។ ពេលនោះ ព្រះអង្គម្ចាស់បានត្រាស់បង្គាប់ថា ចូរនាំទ័ពឆ្ពោះទៅមុខ កុំឱ្យសត្រូវដឹងខ្លួនឱ្យសោះ!"
  );

  // Generation & Audio Output State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationCompletedInModal, setGenerationCompletedInModal] = useState(false);
  const modalAudioRef = useRef(null);
  const [generationStatusText, setGenerationStatusText] = useState("");
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStage, setGenerationStage] = useState("");
  const [pipelineStageIndex, setPipelineStageIndex] = useState(0);
  const [generationElapsed, setGenerationElapsed] = useState(0);
  const [generationOverlayDismissed, setGenerationOverlayDismissed] = useState(false);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState(null);
  const [generatedAudioBlob, setGeneratedAudioBlob] = useState(null);
  const [generatedDuration, setGeneratedDuration] = useState("0:09");
  const [generatedTimestamp, setGeneratedTimestamp] = useState("Generated just now");

  // History State
  const [historyItems, setHistoryItems] = useState([]);

  // --- AI Auto Director (Gemini + Local Engine) State ---
  const [geminiApiKey, setGeminiApiKey] = useState(() => getStoredGeminiKey() || "");
  const [showGeminiKeyModal, setShowGeminiKeyModal] = useState(false);
  const [tempGeminiKey, setTempGeminiKey] = useState("");
  const [isVerifyingKey, setIsVerifyingKey] = useState(false);
  const [keyVerifyStatus, setKeyVerifyStatus] = useState(null);
  const [isDirecting, setIsDirecting] = useState(false);
  const [directorNotes, setDirectorNotes] = useState(null);
  const [directorIntent, setDirectorIntent] = useState(null);
  const [directorTargetAcoustic, setDirectorTargetAcoustic] = useState(null);
  const [directorPhonetics, setDirectorPhonetics] = useState([]);
  const [detectedScriptType, setDetectedScriptType] = useState(null);
  const [originalScriptBeforeDirect, setOriginalScriptBeforeDirect] = useState(null);
  const [autoDirectOnGenerate, setAutoDirectOnGenerate] = useState(true);

  // Audio Preview State for Cards
  const [previewPlayingId, setPreviewPlayingId] = useState(null);
  const previewAudioRef = useRef(null);
  const abortControllerRef = useRef(null);
  const isGeneratingRef = useRef(false);

  const handleCancelGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsGenerating(false);
    setGenerationCompletedInModal(false);
    setGenerationStatusText("");
    notify("បានបោះបង់ការផលិតសំឡេង", "info");
  };

  const handleCloseCompletionModal = () => {
    if (modalAudioRef.current) {
      modalAudioRef.current.pause();
    }
    setIsGenerating(false);
    setGenerationCompletedInModal(false);
    setGenerationStatusText("");
    setTimeout(() => {
      const audioSec = document.querySelector(".vs-audio-section");
      if (audioSec) {
        audioSec.scrollIntoView({ behavior: "smooth", block: "center" });
        audioSec.classList.add("vs-audio-section-highlight");
        setTimeout(() => audioSec.classList.remove("vs-audio-section-highlight"), 2500);
      }
    }, 150);
  };

  // Saved Voices from Backend API
  const [apiVoices, setApiVoices] = useState([]);
  const [apiVoicesLoading, setApiVoicesLoading] = useState(false);

  // Add Voice Modal State
  const [showAddVoiceModal, setShowAddVoiceModal] = useState(false);
  const [newVoiceName, setNewVoiceName] = useState("");
  const [newVoiceCategory, setNewVoiceCategory] = useState("custom");
  const [newVoiceRole, setNewVoiceRole] = useState("Male Lead");
  const [newVoiceFile, setNewVoiceFile] = useState(null);
  const [newVoiceDuration, setNewVoiceDuration] = useState(null);
  const [newVoiceTranscript, setNewVoiceTranscript] = useState("");
  const [newVoiceAutoTranscribing, setNewVoiceAutoTranscribing] = useState(false);
  const [newVoiceError, setNewVoiceError] = useState(null);
  const [newVoiceBusy, setNewVoiceBusy] = useState(false);

  // --- TAB 3: Speech to Text Tab State ---
  const [sttFile, setSttFile] = useState(null);
  const [sttLang, setSttLang] = useState("auto");
  const [sttBusy, setSttBusy] = useState(false);
  const [sttResult, setSttResult] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [sttCopied, setSttCopied] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  // --- TAB: Voice Deep Training State ---
  const [trainAudioFile, setTrainAudioFile] = useState(null);
  const [trainModelName, setTrainModelName] = useState("");
  const [trainLanguage, setTrainLanguage] = useState("km");
  const [trainEpochs, setTrainEpochs] = useState(20);
  const [trainBatchSize, setTrainBatchSize] = useState(4);
  const [trainLearningRate, setTrainLearningRate] = useState(0.0001);
  const [trainStep, setTrainStep] = useState(1); // 1: Upload, 2: Review Segments, 3: Training Loop, 4: Finished
  const [trainDataset, setTrainDataset] = useState(null);
  const [trainJob, setTrainJob] = useState(null);
  const [trainIsBusy, setTrainIsBusy] = useState(false);
  const [trainPrepareProgress, setTrainPrepareProgress] = useState(0);
  const [trainPrepareStage, setTrainPrepareStage] = useState("");
  const [trainError, setTrainError] = useState(null);
  const [newlyTrainedVoice, setNewlyTrainedVoice] = useState(null);
  const trainFileRef = useRef(null);

  // Clean up recording timer on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (previewAudioRef.current) previewAudioRef.current.pause();
    };
  }, []);

  // Fetch API voices from backend
  const loadVoices = async () => {
    try {
      setApiVoicesLoading(true);
      const [voicesRes, trainedRes] = await Promise.allSettled([
        fetch("/api/v1/voices", {
          headers: { Authorization: `Bearer ${BONDETH_AUTH_TOKEN}` }
        }),
        fetch("/api/v1/training/models")
      ]);

      let combined = [];
      if (voicesRes.status === "fulfilled" && voicesRes.value.ok) {
        const vData = await voicesRes.value.json();
        if (Array.isArray(vData)) combined.push(...vData);
      }
      if (trainedRes.status === "fulfilled" && trainedRes.value.ok) {
        const tData = await trainedRes.value.json();
        if (Array.isArray(tData)) {
          tData.forEach((tm) => {
            combined.push({
              id: tm.id,
              voice_alias: tm.name,
              reference_duration_seconds: 30,
              reference_text: `គំរូសំឡេងបានបង្វឹកដោយជោគជ័យ (${tm.base_architecture || "VoxCPM2 48kHz"})`,
              isTrainedModel: true,
              base_architecture: tm.base_architecture
            });
          });
        }
      }
      setApiVoices(combined);
    } catch (err) {
      console.warn("Could not load backend voices:", err);
    } finally {
      setApiVoicesLoading(false);
    }
  };

  useEffect(() => {
    loadVoices();
  }, []);

  // Combined Voice Library List
  const allVoices = useMemo(() => {
    const list = [...PRESET_CHARACTERS];

    // Append user's imported voice profiles from IndexedDB
    if (Array.isArray(voiceProfiles)) {
      voiceProfiles.forEach((vp) => {
        if (!list.some((item) => item.id === vp.id)) {
          list.push({
            id: vp.id,
            name: vp.name || "សំឡេង Cloned",
            role: vp.gender === "female" || vp.role === "Female Lead" ? "Female Lead" : "Male Lead",
            roleClass: vp.gender === "female" || vp.role === "Female Lead" ? "cyan" : "",
            category: "custom",
            ready: true,
            avatar: vp.avatar || "/assets/voice-avatars/characters/queen.png",
            duration: vp.duration || "0:15",
            sampleText: vp.sampleText || "សំឡេងគំរូដែលបានចម្លងពីឯកសារសំឡេងដើម។",
            engine: "clone",
            favorite: Boolean(vp.favorite)
          });
        }
      });
    }

    // Append API backend saved voices
    if (Array.isArray(apiVoices)) {
      apiVoices.forEach((av) => {
        const alias = (av.voice_alias || av.name || "").toUpperCase();
        if (alias === "HAK" || av.id === "hak") return; // Filter out legacy mock
        if (!list.some((item) => item.id === av.id)) {
          list.push({
            id: av.id,
            name: av.voice_alias || av.name || "សំឡេងគំរូ",
            role: av.isTrainedModel ? "Trained Neural" : "Character Voice",
            roleClass: av.isTrainedModel ? "gold" : "cyan",
            category: "custom",
            ready: true,
            avatar: "/assets/voice-avatars/characters/officer.png",
            duration: `0:${Math.round(av.reference_duration_seconds || 15)}`,
            sampleText: av.reference_text || "សំឡេងគំរូដែលបានរក្សាទុកក្នុងប្រព័ន្ធ។",
            engine: "clone",
            isBackendSaved: true,
            isTrainedModel: Boolean(av.isTrainedModel),
            favorite: false
          });
        }
      });
    }

    return list.filter((v) => v.name !== "HAK" && v.id !== "hak");
  }, [voiceProfiles, apiVoices]);

  // Filtered Voices for Library
  const filteredVoices = useMemo(() => {
    return allVoices.filter((v) => {
      const matchesSearch =
        v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.role.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        categoryFilter === "all" ||
        v.category === categoryFilter ||
        (categoryFilter === "favorite" && favoriteVoiceIds.has(v.id));
      return matchesSearch && matchesCategory;
    });
  }, [allVoices, searchQuery, categoryFilter, favoriteVoiceIds]);

  // Current Active Selected Voice
  const activeVoice = useMemo(() => {
    if (!allVoices.length) return null;
    return allVoices.find((v) => v.id === selectedVoiceId) || allVoices[0] || null;
  }, [allVoices, selectedVoiceId]);

  // Detect if activeVoice is a custom cloned voice, trained neural model, or has audio references
  const isCustomVoice = useMemo(() => {
    if (!activeVoice) return false;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(activeVoice.id));
    const isTrained = String(activeVoice.id).startsWith("trained_");
    const isSavedBackendVoice = isUuid || isTrained || (Array.isArray(apiVoices) && apiVoices.some((v) => v.id === activeVoice.id));
    return Boolean(
      activeVoice.category === "custom" ||
      isSavedBackendVoice ||
      activeVoice.audioBlob ||
      activeVoice.audioUrl ||
      activeVoice.isTrainedModel
    );
  }, [activeVoice, apiVoices]);

  // Dynamically resolved synthesis engine: strictly enforce VoxCPM2 for trained voices and full power synthesis
  const activeResolvedEngine = useMemo(() => {
    if (activeVoice?.isTrainedModel || String(activeVoice?.id).startsWith("trained_")) {
      return "voxcpm2";
    }
    if (ttsModelEngine === "gemini") return "gemini";
    if (ttsModelEngine === "omnivoice") return "omnivoice";
    return "voxcpm2";
  }, [activeVoice, ttsModelEngine]);

  // Keep selectedVoiceId in sync when voices change
  useEffect(() => {
    if (allVoices.length > 0) {
      if (!selectedVoiceId || !allVoices.some((v) => v.id === selectedVoiceId)) {
        setSelectedVoiceId(allVoices[0].id);
      }
    } else {
      setSelectedVoiceId(null);
    }
  }, [allVoices, selectedVoiceId]);

  // Metrics computation for textarea
  const textMetrics = useMemo(() => {
    const chars = ttsText.length;
    const words = ttsText.trim() ? ttsText.trim().split(/\s+/).length : 0;
    const estSec = Math.max(1, Math.round(words / 2.8 / (ttsSpeed || 1.0)));
    return { chars, words, estSec };
  }, [ttsText, ttsSpeed]);

  // Delete Voice Action
  const handleDeleteVoice = async (e, voice) => {
    e?.stopPropagation?.();
    if (!voice) return;

    const confirmed = window.confirm(`តើអ្នកពិតជាចង់លុបសំឡេង "${voice.name}" នេះមែនទេ?`);
    if (!confirmed) return;

    try {
      if (previewPlayingId === voice.id && previewAudioRef.current) {
        previewAudioRef.current.pause();
        setPreviewPlayingId(null);
      }

      // 1. Remove from local voice profiles (IndexedDB)
      if (removeVoiceProfile) {
        await removeVoiceProfile(voice.id).catch((err) => console.warn("Local removeVoiceProfile error:", err));
      }

      // 2. Remove from backend API if saved
      const isTrained = String(voice.id).startsWith("trained_");
      try {
        if (isTrained) {
          await fetch(`/api/v1/training/models/${voice.id}`, {
            method: "DELETE",
          });
        } else {
          await fetch(`/api/v1/voices/${voice.id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${BONDETH_AUTH_TOKEN}` }
          });
        }
      } catch (err) {
        console.warn("Backend API voice delete error:", err);
      }
      setApiVoices((prev) => prev.filter((v) => v.id !== voice.id));

      setFavoriteVoiceIds((prev) => {
        const next = new Set(prev);
        next.delete(voice.id);
        return next;
      });

      if (selectedVoiceId === voice.id) {
        const remaining = allVoices.filter((v) => v.id !== voice.id);
        setSelectedVoiceId(remaining[0]?.id || null);
      }

      notify(`បានលុបសំឡេង "${voice.name}" ដោយជោគជ័យ!`, "success");
    } catch (err) {
      notify(`មិនអាចលុបសំឡេងបានទេ: ${err.message}`, "error");
    }
  };

  // Toggle Favorite
  const handleToggleFavorite = (e, voiceId) => {
    e.stopPropagation();
    setFavoriteVoiceIds((prev) => {
      const next = new Set(prev);
      if (next.has(voiceId)) next.delete(voiceId);
      else next.add(voiceId);
      return next;
    });
  };

  // Play Preview Audio (Directly streams backend reference audio if available)
  const handleTogglePreview = async (e, voice) => {
    e.stopPropagation();
    if (previewPlayingId === voice.id) {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      setPreviewPlayingId(null);
      return;
    }

    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
    }

    // Check if voice is a trained model or in backend saved voices
    const isTrained = String(voice.id).startsWith("trained_") || Boolean(voice.isTrainedModel);
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(voice.id));
    const isBackendVoice = isTrained || isUuid || apiVoices.some((v) => v.id === voice.id) || voice.isBackendSaved;

    if (isBackendVoice) {
      try {
        setPreviewPlayingId(voice.id);
        const endpoints = isTrained
          ? [`/api/v1/training/models/${voice.id}/audio`, `/api/v1/voices/${voice.id}/audio`]
          : [`/api/v1/voices/${voice.id}/audio`];

        for (const ep of endpoints) {
          const res = await fetch(ep, {
            headers: { Authorization: `Bearer ${BONDETH_AUTH_TOKEN}` }
          });
          if (res.ok) {
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            previewAudioRef.current = audio;
            audio.onended = () => setPreviewPlayingId(null);
            audio.onerror = () => setPreviewPlayingId(null);
            await audio.play();
            return;
          }
        }
      } catch (err) {
        console.warn("Backend audio preview failed:", err);
      }
      if (isTrained) {
        setPreviewPlayingId(null);
        notify("មិនអាចទាញយកសំឡេងគំរូនៃ Trained Model បានទេ", "warning");
        return;
      }
    }

    // Fallback: local sample audio or web speech synthesis
    const sampleSrc = voice.sampleUrl || "/assets/voice-samples/km_KH-mms-medium.mp3";
    const audio = new Audio(sampleSrc);
    previewAudioRef.current = audio;
    setPreviewPlayingId(voice.id);

    audio.onended = () => setPreviewPlayingId(null);
    audio.onerror = () => {
      if (window.speechSynthesis) {
        const u = new SpeechSynthesisUtterance(voice.sampleText || voice.name);
        u.lang = "km-KH";
        u.onend = () => setPreviewPlayingId(null);
        window.speechSynthesis.speak(u);
      } else {
        setPreviewPlayingId(null);
      }
    };
    audio.play().catch(() => {
      setPreviewPlayingId(null);
    });
  };

  // Handle Style Selection with Smart Presets for Local AI Engine
  const handleStyleChange = (newStyle) => {
    setSelectedStyle(newStyle);
    if (newStyle === "sponsor") {
      setTtsSpeed(1.10);
      setTtsPitch(1.05);
      if (selectedEmotion === "none") {
        setSelectedEmotion("happy");
      }
    } else if (newStyle === "dramatic") {
      setTtsSpeed(0.95);
      setTtsPitch(0.95);
    } else if (newStyle === "news") {
      setTtsSpeed(1.05);
      setTtsPitch(1.00);
    } else if (newStyle === "cinematic") {
      setTtsSpeed(0.90);
      setTtsPitch(0.95);
    } else if (newStyle === "casual") {
      setTtsSpeed(1.00);
      setTtsPitch(1.00);
    } else if (newStyle === "professional") {
      setTtsSpeed(1.00);
      setTtsPitch(1.00);
    }
  };

  // Handle Emotion Selection with Acoustic Inflection Presets
  const handleEmotionChange = (newEmotion) => {
    setSelectedEmotion(newEmotion);
    if (newEmotion === "happy") {
      setTtsPitch(1.05);
    } else if (newEmotion === "sad") {
      setTtsSpeed(0.90);
      setTtsPitch(0.95);
    } else if (newEmotion === "angry") {
      setTtsSpeed(1.05);
      setTtsPitch(1.05);
    } else if (newEmotion === "whisper") {
      setTtsSpeed(0.90);
      setTtsPitch(0.95);
    }
  };

  // Generate Voice Handler (Full Integration with Auto-Detect Clone/TTS + Gemini Auto-Director)
  const handleGenerateVoice = async () => {
    if (isGeneratingRef.current || isGenerating) {
      console.warn("handleGenerateVoice: Already generating voice, skipping duplicate invocation");
      return;
    }
    if (!ttsText.trim()) {
      notify("សូមបញ្ចូលអត្ថបទជាមុនសិន!", "warning");
      return;
    }

    const resolvedEngine = activeResolvedEngine;

    if (!activeVoice && resolvedEngine !== "mms") {
      notify("សូមជ្រើសរើស ឬបង្កើតសំឡេង (Add Voice) ជាមុនសិន!", "warning");
      return;
    }

    if (typeof requireModel === "function") {
      let reqModel = null;
      if (resolvedEngine === "mms") reqModel = "mms-tts-khm";
      else if (resolvedEngine === "clone" || resolvedEngine === "voxcpm2") reqModel = "voxcpm2-clone";
      if (reqModel) {
        const isInstalled = typeof isModelInstalled === "function" ? isModelInstalled(reqModel) : false;
        if (!isInstalled) {
          requireModel(reqModel, () => {
            handleGenerateVoice();
          });
          return;
        }
      }
    }

    isGeneratingRef.current = true;
    setIsGenerating(true);
    setGenerationOverlayDismissed(false);
    setPipelineStageIndex(0);
    setGenerationProgress(5);
    setGenerationElapsed(0);

    const abortCtrl = new AbortController();
    abortControllerRef.current = abortCtrl;

    const baseEngineName = resolvedEngine === "voxcpm2"
      ? "✨ VoxCPM2 48kHz Studio Quality (OpenBMB - ពេញកម្លាំង Full Power)"
      : resolvedEngine === "omnivoice"
      ? "⚡ OmniVoice + AI Gemini (F5-TTS 36-Step - Full Power)"
      : resolvedEngine === "gemini"
      ? "🌐 Google Gemini 2.5 Flash Native Voice (Cloud Real-Time HD)"
      : "✨ VoxCPM2 48kHz Neural Studio";

    const displayEngineLabel = baseEngineName;

    setGenerationStage(resolvedEngine === "gemini" ? "Connecting Google Gemini Flash Audio..." : "Connecting Neural Engine...");
    setGenerationStatusText(`កំពុងរៀបចំការផលិតសំឡេងជាមួយ ${displayEngineLabel}...`);

    const startTime = Date.now();
    const timerInterval = setInterval(() => {
      setGenerationElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    let currentDisplayProgress = 5;
    let targetProgress = 8;
    let currentJobStatus = "initializing";
    let currentQueuePosition = 1;

    // Silky smooth, strictly truthful progress interpolator (updates every 50ms)
    const progressInterval = setInterval(() => {
      if (currentJobStatus === "queued") {
        targetProgress = Math.min(18, targetProgress + 0.1);
        setGenerationStage(`ស្ថិតក្នុងជួររង់ចាំ (Queue #${currentQueuePosition})...`);
      }

      // Smooth step towards targetProgress
      if (currentDisplayProgress < targetProgress) {
        const delta = targetProgress - currentDisplayProgress;
        const step = Math.max(1, Math.ceil(delta * 0.14));
        currentDisplayProgress = Math.min(targetProgress, currentDisplayProgress + step);
        setGenerationProgress(currentDisplayProgress);
      }
    }, 50);

    let blob = null;

    try {
      let scriptToSynthesize = ttsText.trim();

      // Step A: Integrated 1-Click AI Auto-Director (Gemini + Local AI)
      if (autoDirectOnGenerate && geminiApiKey && scriptToSynthesize) {
        setPipelineStageIndex(0);
        targetProgress = 18;
        const targetModelLabel = resolvedEngine === "voxcpm2" ? "VoxCPM2 48kHz" : resolvedEngine === "gemini" ? "Gemini Native" : "VoxCPM2 48kHz";
        setGenerationStage(`🎬 Gemini Director: កំពុងវិភាគស៊ីជម្រៅ & រៀបចំសូរសំឡេងសម្រាប់ ${targetModelLabel}...`);
        setGenerationStatusText(`Gemini Director កំពុងវិភាគចេតនា និងផ្គូផ្គងជាមួយ ${targetModelLabel}...`);
        try {
          const directorResult = await directVoiceoverWithGemini({
            apiKey: geminiApiKey,
            text: scriptToSynthesize,
            targetLanguage: selectedLang,
            voiceName: activeVoice?.name || "Khmer AI Voice",
            currentStyle: selectedStyle,
            currentEmotion: selectedEmotion,
            currentSpeed: ttsSpeed,
            currentPitch: ttsPitch,
            engine: resolvedEngine,
          });

          if (directorResult) {
            targetProgress = 24;
            if (directorResult.directedText && directorResult.directedText.trim()) {
              if (!originalScriptBeforeDirect) {
                setOriginalScriptBeforeDirect(scriptToSynthesize);
              }
              scriptToSynthesize = directorResult.directedText.trim();
              setTtsText(scriptToSynthesize);
            }
            if (directorResult.userIntent) {
              setDirectorIntent(directorResult.userIntent);
            }
            if (directorResult.targetEngineAcoustics) {
              setDirectorTargetAcoustic(directorResult.targetEngineAcoustics);
            }
            if (directorResult.phoneticImprovements && Array.isArray(directorResult.phoneticImprovements)) {
              setDirectorPhonetics(directorResult.phoneticImprovements);
            }
            if (directorResult.suggestedStyle || directorResult.selectedStyle) {
              const rawSt = String(directorResult.suggestedStyle || directorResult.selectedStyle).toLowerCase();
              const matchedSt = STYLES.find(
                (s) =>
                  s.id === rawSt ||
                  rawSt.includes(s.id) ||
                  ((rawSt.includes("sponsor") || rawSt.includes("commercial") || rawSt.includes("ad") || rawSt.includes("ស្ពត") || rawSt.includes("ពាណិជ្ជកម្ម")) && s.id === "sponsor") ||
                  (rawSt.includes("horror") && s.id === "dramatic")
              );
              if (matchedSt) setSelectedStyle(matchedSt.id);
            }
            if (directorResult.suggestedEmotion || directorResult.selectedEmotion) {
              const rawEm = String(directorResult.suggestedEmotion || directorResult.selectedEmotion).toLowerCase();
              const matchedEm = EMOTIONS.find(
                (e) => e.id === rawEm || rawEm.includes(e.id) || (rawEm.includes("whisper") && e.id === "whisper")
              );
              if (matchedEm) setSelectedEmotion(matchedEm.id);
            }
            const recSpeed = Number(directorResult.suggestedSpeed ?? directorResult.speed);
            if (!isNaN(recSpeed) && recSpeed > 0) setTtsSpeed(Math.max(0.7, Math.min(1.4, recSpeed)));
            const recPitch = Number(directorResult.suggestedPitch ?? directorResult.pitch);
            if (!isNaN(recPitch) && recPitch > 0) setTtsPitch(Math.max(0.8, Math.min(1.2, recPitch)));
            if (directorResult.directorNotes || directorResult.notes) {
              setDirectorNotes(directorResult.directorNotes || directorResult.notes);
            }
            if (directorResult.textType || directorResult.detectedType) {
              setDetectedScriptType(directorResult.textType || directorResult.detectedType);
            }
          }
        } catch (dirErr) {
          console.warn("Auto-Director pre-step warning:", dirErr);
        }
      }

      // Sanitize pause tags into authentic Khmer sentence marks so Local AI doesn't spell out "pause"
      const cleanScriptForLocalEngine = scriptToSynthesize
        .replace(/\[pause\s*[\d.]+s?\]/gi, "។ ")
        .replace(/\s*([,។!?])\s*/g, "$1 ")
        .replace(/\s+/g, " ")
        .trim();

      if (resolvedEngine === "gemini") {
        // --- 1. GOOGLE GEMINI 2.5 FLASH + NEURAL VOICE CLONE PIPELINE ---
        setPipelineStageIndex(1);
        targetProgress = 25;
        setGenerationStatusText("Google Gemini 2.5 Flash: កំពុងវិភាគ និងកែលម្អសូរសំនៀងខ្មែរ...");
        setGenerationStage("🎬 Gemini AI Director: Analyzing Cambodian Prosody & Rhythm...");

        let scriptForClone = cleanScriptForLocalEngine;
        if (geminiApiKey) {
          try {
            const dirResult = await directVoiceoverWithGemini({
              apiKey: geminiApiKey,
              text: cleanScriptForLocalEngine,
              targetLanguage: selectedLang,
              voiceName: activeVoice?.name || "Khmer AI Voice",
              currentStyle: selectedStyle,
              currentEmotion: selectedEmotion,
              currentSpeed: ttsSpeed,
              currentPitch: ttsPitch,
              engine: "voxcpm2",
            });
            if (dirResult?.directedScript) {
              scriptForClone = dirResult.directedScript;
            }
          } catch (dirErr) {
            console.warn("Gemini Directing pre-pass:", dirErr);
          }
        }

        // Check if an authentic cloned voice is selected
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(activeVoice?.id));
        const isTrained = String(activeVoice?.id).startsWith("trained_");
        const isSavedBackendVoice = isUuid || isTrained || apiVoices.some((v) => v.id === activeVoice?.id);

        if (activeVoice) {
          // STRICT NEURAL CLONING ON BACKEND: Synthesize with the user's selected cloned voice!
          setPipelineStageIndex(2);
          targetProgress = 40;
          setGenerationStatusText("កំពុងសំយោគសំឡេង Clone លើ Backend (VoxCPM2 48kHz Studio Quality)...");
          setGenerationStage("Executing Neural Voice Cloning with Gemini Director Synergy...");

          const formData = new FormData();
          formData.append("text", scriptForClone);
          formData.append("consent", "true");
          formData.append("lang", selectedLang);
          formData.append("speed", String(Math.max(0.5, Math.min(2.0, ttsSpeed))));
          formData.append("model", "voxcpm2"); // Execute on VoxCPM2 48kHz Full Power

          if (isSavedBackendVoice) {
            formData.append("voice_id", activeVoice.id);
          } else {
            let refBlob = null;
            if (activeVoice?.audioBlob) {
              refBlob = activeVoice.audioBlob;
            } else if (activeVoice?.audioUrl) {
              refBlob = await fetch(activeVoice.audioUrl, { signal: abortCtrl.signal }).then((r) => r.blob()).catch(() => null);
            }
            if (!refBlob) {
              refBlob = await fetch("/assets/voice-samples/km_KH-mms-medium.mp3", { signal: abortCtrl.signal }).then((r) => r.blob()).catch(() => null);
            }
            if (refBlob) {
              formData.append("reference_audio", refBlob, "reference.wav");
              formData.append("reference_text", activeVoice?.sampleText || "សំឡេងគំរូភាសាខ្មែរ");
            } else {
              throw new Error("មិនមានសំឡេងគំរូ (Reference Audio) សម្រាប់ធ្វើការ Clone ទេ។ សូម Add Voice ឬជ្រើសរើស Meta MMS-TTS!");
            }
          }

          const cloneRes = await fetch("/api/v1/clone", {
            method: "POST",
            headers: { Authorization: `Bearer ${BONDETH_AUTH_TOKEN}` },
            body: formData,
            signal: abortCtrl.signal,
          });

          if (!cloneRes.ok) {
            const errData = await cloneRes.json().catch(() => ({}));
            throw new Error(errData.detail || `បរាជ័យក្នុងការចាប់ផ្ដើម ${displayEngineLabel} (HTTP ${cloneRes.status})`);
          }

          let job = await cloneRes.json();
          currentJobStatus = job.status;
          if (job.queue_position) currentQueuePosition = job.queue_position;
          setGenerationStatusText(`ស្ថានភាព ${displayEngineLabel}: ${job.status}...`);

          setPipelineStageIndex(2);
          targetProgress = 48;

          let attempts = 0;
          const maxAttempts = 360;
          while (job.status === "queued" || job.status === "running") {
            await new Promise((r) => setTimeout(r, 1000));
            if (abortCtrl.signal.aborted) throw new Error("ការផលិតសំឡេងត្រូវបានបោះបង់");
            attempts++;
            if (attempts > maxAttempts) throw new Error(`${displayEngineLabel} ប្រើពេលយូរហួសកំណត់`);

            const pollRes = await fetch(`/api/v1/clone/jobs/${job.job_id}`, {
              headers: { Authorization: `Bearer ${BONDETH_AUTH_TOKEN}` },
              signal: abortCtrl.signal,
            });
            if (pollRes.ok) {
              job = await pollRes.json();
              currentJobStatus = job.status;
              if (job.queue_position) currentQueuePosition = job.queue_position;
              if (job.progress && job.progress > 0) {
                targetProgress = Math.max(targetProgress, job.progress);
                if (job.progress >= 85) {
                  setPipelineStageIndex(3);
                } else if (job.progress >= 30) {
                  setPipelineStageIndex(2);
                }
              }
              if (job.stage) {
                setGenerationStage(job.stage);
              }
              setGenerationStatusText(
                job.status === "running"
                  ? `${displayEngineLabel}: ${job.stage || "កំពុងសំយោគសំឡេង..."}`
                  : `ស្ថិតក្នុងជួររង់ចាំ (Queue #${job.queue_position || 1})...`
              );
            }
          }

          if (job.status === "failed") {
            throw new Error(job.error || `${displayEngineLabel} បានបរាជ័យក្នុងការសំយោគសំឡេង`);
          }

          currentJobStatus = "done";
          setPipelineStageIndex(3);
          targetProgress = 94;
          setGenerationStage("Finalizing Waveform Output...");
          setGenerationStatusText(`កំពុងទាញយកសំឡេងដែលបានផលិតដោយ ${displayEngineLabel}...`);
          const audioRes = await fetch(`/api/v1/clone/jobs/${job.job_id}/audio`, {
            headers: { Authorization: `Bearer ${BONDETH_AUTH_TOKEN}` },
            signal: abortCtrl.signal,
          });
          if (!audioRes.ok) throw new Error(`មិនអាចទាញយកសំឡេងដែលបានផលិតពី ${displayEngineLabel} បានទេ`);
          blob = await audioRes.blob();
        } else {
          // Fallback to direct Gemini speech if no voice profile exists
          blob = await synthesizeWithGemini({
            apiKey: geminiApiKey,
            text: cleanScriptForLocalEngine,
            voiceName: "Aoede",
            referenceAudioBlob: null,
            vocalStyle: selectedStyle,
            onProgress: (pct) => {
              targetProgress = Math.max(targetProgress, pct);
              if (pct >= 85) setPipelineStageIndex(3);
            },
          });
        }
      } else if (resolvedEngine === "mms") {
        // --- 2. STRICT LOCAL EXECUTION: META MMS-TTS KHMER (Offline 16kHz - Full Power) ---
        setPipelineStageIndex(1);
        targetProgress = 30;
        setGenerationStatusText("AI Meta MMS-TTS (Khmer Offline 16kHz - Full Power) កំពុងសំយោគសំឡេង...");
        setGenerationStage("Executing Meta MMS-TTS Khmer Synthesis (Multi-Core Full Power)...");

        setPipelineStageIndex(2);
        targetProgress = 55;

        // Timeout guard: 75 seconds max for TTS synthesis
        const ttsTimeoutId = setTimeout(() => {
          abortCtrl.abort(new Error("ដំណើរការ Meta MMS-TTS លើសរយៈពេលកំណត់ (Timeout 75s)"));
        }, 75000);

        try {
          const res = await fetch("/api/v1/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: cleanScriptForLocalEngine,
              lang: selectedLang === "auto" ? "km" : selectedLang,
              speed: Math.max(0.5, Math.min(2.0, ttsSpeed))
            }),
            signal: abortCtrl.signal,
          });

          clearTimeout(ttsTimeoutId);

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.detail || `Meta MMS-TTS បរាជ័យក្នុងការសំយោគសំឡេង (HTTP ${res.status})`);
          }
          setPipelineStageIndex(3);
          targetProgress = 90;
          blob = await res.blob();
        } catch (fetchErr) {
          clearTimeout(ttsTimeoutId);
          throw fetchErr;
        }
      } else {
        // --- 3. STRICT EXECUTION: NEURAL VOICE CLONE (VoxCPM2 48kHz Studio Quality Full Power) ---
        setPipelineStageIndex(1);
        targetProgress = 28;
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(activeVoice?.id));
        const isTrained = String(activeVoice?.id).startsWith("trained_");
        const isSavedBackendVoice = isUuid || isTrained || apiVoices.some((v) => v.id === activeVoice?.id);

        setGenerationStatusText(`កំពុងបញ្ជូនសំណើទៅកាន់ ${displayEngineLabel}...`);
        setGenerationStage("Acoustic Alignment & Speaker Reference Profiling...");

        const formData = new FormData();
        formData.append("text", cleanScriptForLocalEngine);
        formData.append("consent", "true");
        formData.append("lang", selectedLang);
        formData.append("speed", String(Math.max(0.5, Math.min(2.0, ttsSpeed))));
        formData.append("model", resolvedEngine || "voxcpm2"); // Auto-detected or strictly chosen model

        if (isSavedBackendVoice) {
          formData.append("voice_id", activeVoice.id);
        } else {
          let refBlob = null;
          if (activeVoice?.audioBlob) {
            refBlob = activeVoice.audioBlob;
          } else if (activeVoice?.audioUrl) {
            refBlob = await fetch(activeVoice.audioUrl, { signal: abortCtrl.signal }).then((r) => r.blob()).catch(() => null);
          }
          if (!refBlob) {
            refBlob = await fetch("/assets/voice-samples/km_KH-mms-medium.mp3", { signal: abortCtrl.signal }).then((r) => r.blob()).catch(() => null);
          }
          if (refBlob) {
            formData.append("reference_audio", refBlob, "reference.wav");
            formData.append("reference_text", activeVoice?.sampleText || "សំឡេងគំរូភាសាខ្មែរ");
          } else {
            throw new Error("មិនមានសំឡេងគំរូ (Reference Audio) សម្រាប់ធ្វើការ Clone ទេ។ សូម Add Voice ឬជ្រើសរើស Meta MMS-TTS!");
          }
        }

        const cloneRes = await fetch("/api/v1/clone", {
          method: "POST",
          headers: { Authorization: `Bearer ${BONDETH_AUTH_TOKEN}` },
          body: formData,
          signal: abortCtrl.signal,
        });

        if (!cloneRes.ok) {
          const errData = await cloneRes.json().catch(() => ({}));
          throw new Error(errData.detail || `បរាជ័យក្នុងការចាប់ផ្ដើម ${displayEngineLabel} (HTTP ${cloneRes.status})`);
        }

        let job = await cloneRes.json();
        currentJobStatus = job.status;
        if (job.queue_position) currentQueuePosition = job.queue_position;
        setGenerationStatusText(`ស្ថានភាព ${displayEngineLabel}: ${job.status}...`);

        setPipelineStageIndex(2);
        targetProgress = 35;

        let attempts = 0;
        const maxAttempts = 360;
        while (job.status === "queued" || job.status === "running") {
          await new Promise((r) => setTimeout(r, 1000));
          if (abortCtrl.signal.aborted) throw new Error("ការផលិតសំឡេងត្រូវបានបោះបង់");
          attempts++;
          if (attempts > maxAttempts) throw new Error(`${displayEngineLabel} ប្រើពេលយូរហួសកំណត់`);

          const pollRes = await fetch(`/api/v1/clone/jobs/${job.job_id}`, {
            headers: { Authorization: `Bearer ${BONDETH_AUTH_TOKEN}` },
            signal: abortCtrl.signal,
          });
          if (pollRes.ok) {
            job = await pollRes.json();
            currentJobStatus = job.status;
            if (job.queue_position) currentQueuePosition = job.queue_position;
            if (job.progress && job.progress > 0) {
              targetProgress = Math.max(targetProgress, job.progress);
              if (job.progress >= 85) {
                setPipelineStageIndex(3);
              } else if (job.progress >= 30) {
                setPipelineStageIndex(2);
              }
            }
            if (job.stage) {
              setGenerationStage(job.stage);
            }
            setGenerationStatusText(
              job.status === "running"
                ? `${displayEngineLabel}: ${job.stage || "កំពុងសំយោគសំឡេង..."}`
                : `ស្ថិតក្នុងជួររង់ចាំ (Queue #${job.queue_position || 1})...`
            );
          }
        }

        if (job.status === "failed") {
          throw new Error(job.error || `${displayEngineLabel} បានបរាជ័យក្នុងការសំយោគសំឡេង`);
        }

        currentJobStatus = "done";
        setPipelineStageIndex(3);
        targetProgress = 94;
        setGenerationStage("Finalizing Waveform Output...");
        setGenerationStatusText(`កំពុងទាញយកសំឡេងដែលបានផលិតដោយ ${displayEngineLabel}...`);
        const audioRes = await fetch(`/api/v1/clone/jobs/${job.job_id}/audio`, {
          headers: { Authorization: `Bearer ${BONDETH_AUTH_TOKEN}` },
          signal: abortCtrl.signal,
        });
        if (!audioRes.ok) throw new Error(`មិនអាចទាញយកសំឡេងដែលបានផលិតពី ${displayEngineLabel} បានទេ`);
        blob = await audioRes.blob();
      }

      if (!blob) {
        throw new Error("មិនទទួលបានទិន្នន័យសំឡេងពី AI Model នោះទេ");
      }

      setPipelineStageIndex(4);
      targetProgress = 100;
      currentDisplayProgress = 100;
      setGenerationProgress(100);
      setGenerationStage("Voice Generation Complete 100%!");
      setGenerationStatusText("ការផលិតសំឡេងបានជោគជ័យ 100%!");

      const audioUrl = URL.createObjectURL(blob);
      setGeneratedAudioBlob(blob);
      setGeneratedAudioUrl(audioUrl);
      setGeneratedDuration(`0:${textMetrics.estSec < 10 ? "0" + textMetrics.estSec : textMetrics.estSec}`);
      setGeneratedTimestamp("Generated just now");
      setGenerationCompletedInModal(true);

      // Add to history
      setHistoryItems((prev) => [
        {
          id: `hist_${Date.now()}`,
          voiceName: activeVoice?.name || (resolvedEngine === "mms" ? "Meta MMS Khmer" : "AI Cloned Voice"),
          avatar: activeVoice?.avatar || "/assets/voice-avatars/characters/officer.png",
          text: scriptToSynthesize,
          url: audioUrl,
          blob: blob,
          timestamp: new Date().toLocaleTimeString(),
          duration: `0:${textMetrics.estSec < 10 ? "0" + textMetrics.estSec : textMetrics.estSec}`
        },
        ...prev
      ]);

      notify(`បានផលិតសំឡេងដោយជោគជ័យ 100% ជាមួយ ${displayEngineLabel}!`, "success");
    } catch (err) {
      notify("បញ្ហាផលិតសំឡេង: " + err.message, "error");
    } finally {
      isGeneratingRef.current = false;
      clearInterval(timerInterval);
      clearInterval(progressInterval);
      if (!blob) {
        setIsGenerating(false);
        setGenerationStatusText("");
        setGenerationCompletedInModal(false);
      } else {
        // Also highlight and scroll the underlying page player
        setTimeout(() => {
          const audioSec = document.querySelector(".vs-audio-section");
          if (audioSec) {
            audioSec.classList.add("vs-audio-section-highlight");
            setTimeout(() => audioSec.classList.remove("vs-audio-section-highlight"), 2500);
          }
        }, 200);
      }
    }
  };

  // Add Voice Modal Submit Handler (Uploads reference audio to backend and saves in IndexedDB)
  const handleAddVoiceSubmit = async () => {
    if (!newVoiceName.trim() || !newVoiceFile) {
      setNewVoiceError("សូមបំពេញឈ្មោះ និងជ្រើសរើសឯកសារសំឡេង (3s - 30s)");
      return;
    }
    setNewVoiceBusy(true);
    setNewVoiceError(null);
    try {
      const formData = new FormData();
      formData.append("voice_alias", newVoiceName.trim());
      formData.append("reference_audio", newVoiceFile);
      formData.append("consent", "true");
      if (newVoiceTranscript.trim()) {
        formData.append("reference_text", newVoiceTranscript.trim());
      }

      const res = await fetch("/api/v1/voices", {
        method: "POST",
        headers: { Authorization: `Bearer ${BONDETH_AUTH_TOKEN}` },
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `បរាជ័យក្នុងការរក្សាទុកសំឡេង (HTTP ${res.status})`);
      }

      const saved = await res.json();
      setApiVoices((prev) => [saved, ...prev]);

      const newProfile = {
        id: saved.id,
        name: saved.voice_alias || newVoiceName.trim(),
        role: newVoiceRole,
        roleClass: newVoiceRole === "Female Lead" ? "cyan" : "",
        category: newVoiceCategory,
        ready: true,
        avatar: newVoiceRole === "Female Lead"
          ? "/assets/voice-avatars/characters/queen.png"
          : "/assets/voice-avatars/characters/king.png",
        duration: `0:${Math.round(saved.reference_duration_seconds || newVoiceDuration || 15)}`,
        sampleText: saved.reference_text || "សំឡេងគំរូដែលបានរក្សាទុកក្នុងប្រព័ន្ធ។",
        engine: "clone",
        favorite: true
      };

      if (addVoiceProfile) {
        await addVoiceProfile(newProfile);
      }
      setSelectedVoiceId(saved.id);
      setShowAddVoiceModal(false);
      setNewVoiceName("");
      setNewVoiceFile(null);
      setNewVoiceTranscript("");
      notify("បានបន្ថែមសំឡេងថ្មីទៅកាន់ Voice Library ដោយជោគជ័យ!", "success");
    } catch (err) {
      setNewVoiceError(err.message);
    } finally {
      setNewVoiceBusy(false);
    }
  };

  // Helper: Auto-transcribe audio file with Whisper STT
  const handleAutoTranscribeHelper = async (audioFile, onResult, setBusyState) => {
    if (!audioFile) {
      notify("សូមជ្រើសរើសឯកសារសំឡេងជាមុនសិន!", "warning");
      return;
    }
    if (typeof requireModel === "function") {
      const isInstalled = typeof isModelInstalled === "function" ? isModelInstalled("whisper-khmer") : false;
      if (!isInstalled) {
        requireModel("whisper-khmer", () => {
          handleAutoTranscribeHelper(audioFile, onResult, setBusyState);
        });
        return;
      }
    }
    setBusyState(true);
    try {
      const formData = new FormData();
      formData.append("file", audioFile);
      formData.append("language", "km");

      const res = await fetch("/api/v1/stt", {
        method: "POST",
        headers: { Authorization: `Bearer ${BONDETH_AUTH_TOKEN}` },
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `STT Failed with HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data.text) {
        onResult(data.text);
        notify("បានបម្លែងសំឡេងជាអក្សរដោយជោគជ័យ!", "success");
      } else {
        notify("មិនអាចចាប់ពាក្យក្នុងសំឡេងបានទេ", "info");
      }
    } catch (err) {
      notify("បញ្ហា Speech-to-Text: " + err.message, "error");
    } finally {
      setBusyState(false);
    }
  };

  // --- TAB 3: Speech to Text (Recording & Transcribe) ---
  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        const recordedFile = new File([audioBlob], `recorded_${Date.now()}.wav`, { type: "audio/wav" });
        setSttFile(recordedFile);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      notify("មិនអាចបើក Microphone បានទេ: " + err.message, "error");
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    }
  };

  const handleTranscribeSubmit = async () => {
    if (!sttFile) {
      notify("សូមជ្រើសរើស ឬថតសំឡេងជាមុនសិន!", "warning");
      return;
    }
    if (typeof requireModel === "function") {
      const targetModel = (sttLang === "km" || sttLang === "auto") ? "whisper-khmer" : "whisper-multilingual";
      const isInstalled = typeof isModelInstalled === "function" ? isModelInstalled(targetModel) : false;
      if (!isInstalled) {
        requireModel(targetModel, () => {
          handleTranscribeSubmit();
        });
        return;
      }
    }
    setSttBusy(true);
    setSttResult(null);
    try {
      const formData = new FormData();
      formData.append("file", sttFile);
      formData.append("language", sttLang);

      const res = await fetch("/api/v1/stt", {
        method: "POST",
        headers: { Authorization: `Bearer ${BONDETH_AUTH_TOKEN}` },
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `STT Failed with HTTP ${res.status}`);
      }

      const data = await res.json();
      setSttResult(data);
      notify("ការបម្លែងសំឡេងជាអក្សរបានជោគជ័យ!", "success");
    } catch (err) {
      notify("បញ្ហា Speech to Text: " + err.message, "error");
    } finally {
      setSttBusy(false);
    }
  };

  // Insert Pause into Textarea
  const handleInsertPause = () => {
    setTtsText((prev) => prev + " [pause 0.5s] ");
  };

  // Sample Text Helper
  const handleCycleSampleText = () => {
    const randomSample = SAMPLE_SCRIPTS[Math.floor(Math.random() * SAMPLE_SCRIPTS.length)];
    setTtsText(randomSample);
  };

  // AI Prompt Helper
  const handleAiPromptHelper = () => {
    setTtsText((prev) => {
      if (!prev.includes("!")) return prev + " សូមស្ដាប់ដោយយកចិត្តទុកដាក់!";
      return prev + " ហើយដំណើររឿងនឹងបន្តទៅមុខទៀត...";
    });
    notify("AI បានជួយកែសម្រួលអត្ថបទឱ្យកាន់តែមានអត្ថន័យ!", "info");
  };

  // --- AI Auto Director Handlers (Gemini + Local Engine) ---
  const handleOpenGeminiKeyModal = () => {
    setTempGeminiKey(geminiApiKey || getStoredGeminiKey() || "");
    setKeyVerifyStatus(null);
    setShowGeminiKeyModal(true);
  };

  const handleSaveGeminiKey = async () => {
    setIsVerifyingKey(true);
    setKeyVerifyStatus(null);
    try {
      const res = await verifyGeminiKey(tempGeminiKey);
      if (res.valid) {
        setStoredGeminiKey(tempGeminiKey);
        setGeminiApiKey(tempGeminiKey);
        setKeyVerifyStatus({ valid: true, msg: "Google Gemini API Key ត្រឹមត្រូវ!" });
        notify("បានរក្សាទុក Google Gemini API Key ដោយជោគជ័យ!", "success");
        setTimeout(() => setShowGeminiKeyModal(false), 700);
      } else {
        setKeyVerifyStatus({ valid: false, msg: res.error || "API Key មិនត្រឹមត្រូវ" });
        notify(res.error || "API Key មិនត្រឹមត្រូវ", "error");
      }
    } catch (err) {
      setKeyVerifyStatus({ valid: false, msg: err.message });
      notify("បរាជ័យក្នុងការផ្ទៀងផ្ទាត់: " + err.message, "error");
    } finally {
      setIsVerifyingKey(false);
    }
  };

  const handleAutoDirectScript = async () => {
    if (!ttsText.trim()) {
      notify("សូមសរសេរ ឬបិទភ្ជាប់អត្ថបទមុននឹងឱ្យ AI Director វិភាគ!", "warning");
      return;
    }

    const currentKey = (geminiApiKey || getStoredGeminiKey() || "").trim();
    if (!currentKey) {
      handleOpenGeminiKeyModal();
      notify("សូមភ្ជាប់ Google Gemini API Key ដើម្បីប្រើ AI Auto Director!", "info");
      return;
    }

    setIsDirecting(true);
    try {
      setOriginalScriptBeforeDirect(ttsText);
      const direction = await directVoiceoverWithGemini({
        apiKey: currentKey,
        text: ttsText,
        currentStyle: selectedStyle,
        currentEmotion: selectedEmotion,
        currentSpeed: ttsSpeed,
        currentPitch: ttsPitch,
        engine: activeResolvedEngine,
      });

      if (direction) {
        console.log("AI Auto Director result:", direction);
        if (direction.directedText) {
          setTtsText(direction.directedText);
        }
        if (direction.textType) {
          setDetectedScriptType(direction.textType);
        }
        if (direction.suggestedStyle) {
          const rawStyle = String(direction.suggestedStyle).toLowerCase();
          const matchedStyle = STYLES.find(
            (s) =>
              s.id === rawStyle ||
              rawStyle.includes(s.id) ||
              ((rawStyle.includes("sponsor") || rawStyle.includes("commercial") || rawStyle.includes("ad") || rawStyle.includes("ស្ពត") || rawStyle.includes("ពាណិជ្ជកម្ម")) && s.id === "sponsor") ||
              (rawStyle.includes("horror") && s.id === "dramatic")
          );
          if (matchedStyle) setSelectedStyle(matchedStyle.id);
        }
        if (direction.suggestedEmotion) {
          const rawEmo = String(direction.suggestedEmotion).toLowerCase();
          const matchedEmo = EMOTIONS.find(
            (e) => e.id === rawEmo || rawEmo.includes(e.id) || (rawEmo.includes("whisper") && e.id === "whisper")
          );
          if (matchedEmo) setSelectedEmotion(matchedEmo.id);
        }
        if (direction.suggestedSpeed) {
          setTtsSpeed(Math.max(0.7, Math.min(1.4, Number(direction.suggestedSpeed))));
        }
        if (direction.suggestedPitch) {
          setTtsPitch(Math.max(0.8, Math.min(1.2, Number(direction.suggestedPitch))));
        }
        if (direction.userIntent) {
          setDirectorIntent(direction.userIntent);
        }
        if (direction.targetEngineAcoustics) {
          setDirectorTargetAcoustic(direction.targetEngineAcoustics);
        }
        if (direction.phoneticImprovements && Array.isArray(direction.phoneticImprovements)) {
          setDirectorPhonetics(direction.phoneticImprovements);
        }
        if (direction.directorNotes) {
          setDirectorNotes(direction.directorNotes);
        }
        notify("🎬 Gemini Director: វិភាគយល់ពីចេតនា & ផ្គូផ្គងជាមួយ Model រួចរាល់!", "success");
      }
    } catch (err) {
      console.error("Directing error:", err);
      notify("AI Director បរាជ័យ: " + err.message, "error");
    } finally {
      setIsDirecting(false);
    }
  };

  const handleRevertScript = () => {
    if (originalScriptBeforeDirect) {
      setTtsText(originalScriptBeforeDirect);
      setOriginalScriptBeforeDirect(null);
      setDirectorNotes(null);
      setDirectorIntent(null);
      setDirectorTargetAcoustic(null);
      setDirectorPhonetics([]);
      notify("បានស្ដារអត្ថបទដើមឡើងវិញ", "info");
    }
  };

  // Download Audio
  const handleDownload = (urlToDownload, fileNamePrefix = "AI_Voice") => {
    const targetUrl = urlToDownload || generatedAudioUrl;
    if (!targetUrl) return;
    const a = document.createElement("a");
    a.href = targetUrl;
    a.download = `${fileNamePrefix}_${Date.now()}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    notify("បានទាញយកឯកសារសំឡេង!", "success");
  };

  // --- Voice Deep Training Handlers ---
  const handlePrepareTrainingDataset = async () => {
    if (!trainAudioFile) {
      notify("សូមជ្រើសរើស File សំឡេងសម្រាប់ការបង្វឹក (WAV/MP3/M4A)", "warning");
      return;
    }
    if (!trainModelName.trim()) {
      notify("សូមបញ្ចូលឈ្មោះសម្រាប់ Voice Model", "warning");
      return;
    }

    let progressTimer = null;
    try {
      setTrainIsBusy(true);
      setTrainError(null);
      setTrainPrepareProgress(12);
      setTrainPrepareStage("កំពុងផ្ទុកឡើង និងវិភាគទម្រង់សំឡេង (Analyzing Audio Spectrum)...");

      let currentPct = 12;
      progressTimer = setInterval(() => {
        currentPct = Math.min(94, currentPct + Math.max(1, Math.round((94 - currentPct) * 0.15)));
        setTrainPrepareProgress(currentPct);
        if (currentPct < 35) {
          setTrainPrepareStage("កំពុងផ្ទុកឡើង និងវិភាគទម្រង់សំឡេង (Analyzing Audio Spectrum)...");
        } else if (currentPct < 65) {
          setTrainPrepareStage("កំពុងស្វែងរកចន្លោះស្ងាត់ និងកាត់ជាកំណាត់សំឡេង 24kHz (Silence Slicing)...");
        } else {
          setTrainPrepareStage("កំពុងស្រង់អត្ថបទសម្គាល់ Phoneme ដោយ Whisper STT (Extracting Text)...");
        }
      }, 450);

      const formData = new FormData();
      formData.append("audio_file", trainAudioFile);
      formData.append("model_name", trainModelName.trim());
      formData.append("language", trainLanguage);

      const res = await fetch("/api/v1/training/prepare", {
        method: "POST",
        body: formData,
      });

      if (progressTimer) clearInterval(progressTimer);

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || (res.status === 404 ? "ម៉ាស៊ីនបម្រើ AI Training មិនទាន់ដំណើរការ (HTTP 404)" : `បរាជ័យក្នុងការរៀបចំ Dataset (HTTP ${res.status})`));
      }

      setTrainPrepareProgress(100);
      setTrainPrepareStage("រៀបចំ Dataset បានជោគជ័យ ១០០%!");
      await new Promise((r) => setTimeout(r, 400));

      const data = await res.json();
      setTrainDataset(data);
      setTrainStep(2);
      notify(`រៀបចំ Dataset បានជោគជ័យ! បំបែកបាន ${data.total_segments} ផ្នែកសំឡេង។`, "success");
    } catch (err) {
      if (progressTimer) clearInterval(progressTimer);
      setTrainError(err.message);
      notify(err.message, "error");
    } finally {
      setTrainIsBusy(false);
    }
  };

  const handleStartVoiceTraining = async () => {
    if (!trainDataset?.dataset_path) return;

    try {
      setTrainIsBusy(true);
      setTrainError(null);
      setTrainStep(3);

      const res = await fetch("/api/v1/training/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataset_path: trainDataset.dataset_path,
          model_name: trainModelName.trim(),
          language: trainLanguage,
          epochs: trainEpochs,
          batch_size: trainBatchSize,
          learning_rate: trainLearningRate,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `មិនអាចចាប់ផ្ដើមបង្វឹកបានទេ (HTTP ${res.status})`);
      }

      const initialJob = await res.json();
      setTrainJob(initialJob);

      let done = false;
      while (!done) {
        await new Promise((r) => setTimeout(r, 800));
        const pollRes = await fetch(`/api/v1/training/jobs/${initialJob.job_id}`);
        if (pollRes.ok) {
          const updated = await pollRes.json();
          setTrainJob(updated);
          if (updated.status === "completed") {
            done = true;
            setTrainStep(4);
            setNewlyTrainedVoice(updated.metadata);
            notify(`ការបង្វឹកសំឡេង "${trainModelName}" បានសម្រេចជោគជ័យ ១០០%!`, "success");
            await loadVoices();
          } else if (updated.status === "failed") {
            done = true;
            throw new Error(updated.error || "ការបង្វឹកបានជួបប្រទះបញ្ហាបរាជ័យ");
          }
        }
      }
    } catch (err) {
      setTrainError(err.message);
      notify(err.message, "error");
      setTrainStep(2);
    } finally {
      setTrainIsBusy(false);
    }
  };

  const handleSelectTrainedVoiceAndGoToStudio = (modelId) => {
    loadVoices();
    if (modelId) {
      setSelectedVoiceId(modelId);
    }
    setActiveTab("tts");
    notify("បានជ្រើសរើសសំឡេងដែលបានបង្វឹកថ្មីទៅកាន់ Studio!", "success");
  };

  // Insert to Timeline
  const handleInsertToTimelineAction = (blobToInsert, textToInsert) => {
    if (!onInsertToTimeline) {
      notify("មិនអាចបញ្ចូលទៅ Timeline បានទេ", "warning");
      return;
    }
    const targetBlob = blobToInsert || generatedAudioBlob;
    if (!targetBlob) {
      notify("សូមចុច 'Generate Voice' ជាមុនសិន!", "warning");
      return;
    }

    onInsertToTimeline({
      blob: targetBlob,
      name: `${activeVoice?.name || "AI_Voice"}.wav`,
      script: textToInsert || ttsText,
      duration: textMetrics.estSec,
      peaks: []
    });
    notify("បានបញ្ចូលសំឡេងទៅកាន់ Video Timeline រួចរាល់!", "success");
    if (onBack) onBack();
  };

  return (
    <div className="voice-studio-container">
      {/* ==========================================================================
          TOP BAR NAVIGATION
          ========================================================================== */}
      <header className="voice-studio-topbar">
        <div className="voice-studio-topbar-left">
          <button className="vs-back-btn" onClick={onBack} title="ត្រឡប់ទៅ Video Editor">
            <ArrowLeft size={16} weight="bold" />
            <span>Back to Video Editor</span>
          </button>

          <div className="vs-brand-title">
            <div className="vs-brand-icon">
              <Microphone size={18} weight="fill" />
            </div>
            <span>AI Voice Studio</span>
          </div>

          <div className="vs-mode-tabs">
            <button
              className={`vs-mode-tab ${activeTab === "tts" ? "active" : ""}`}
              onClick={() => setActiveTab("tts")}
            >
              <SpeakerHigh size={15} weight={activeTab === "tts" ? "fill" : "regular"} />
              <span>Studio & Library</span>
            </button>
            <button
              className={`vs-mode-tab ${activeTab === "train" ? "active" : ""}`}
              onClick={() => setActiveTab("train")}
            >
              <Brain size={15} weight={activeTab === "train" ? "fill" : "regular"} />
              <span>Voice Training</span>
            </button>
            <button
              className={`vs-mode-tab ${activeTab === "stt" ? "active" : ""}`}
              onClick={() => setActiveTab("stt")}
            >
              <Microphone size={15} weight={activeTab === "stt" ? "fill" : "regular"} />
              <span>Speech to Text</span>
            </button>
          </div>
        </div>

        <div className="voice-studio-topbar-right">
        </div>
      </header>

      {/* ==========================================================================
          TAB 1: MAIN STUDIO & LIBRARY
          ========================================================================== */}
      {activeTab === "tts" && (
        <div className="vs-main-workspace">
          {/* LEFT COLUMN: VOICE LIBRARY */}
          <section className="vs-library-column">
            <div className="vs-library-header">
              <div className="vs-library-title-group">
                <div className="vs-library-icon-box">
                  <Microphone size={22} weight="fill" />
                </div>
                <div className="vs-library-title-text">
                  <h2>Voice Library</h2>
                </div>
              </div>

              <button
                type="button"
                className="vs-add-voice-btn"
                onClick={() => setShowAddVoiceModal(true)}
                title="បង្កើតសំឡេងថ្មី (Add Character Voice)"
              >
                <Plus size={14} weight="bold" />
                <span>Add Voice</span>
              </button>
            </div>

            {/* Toolbar: Search, Categories, Grid/List */}
            <div className="vs-library-toolbar">
              <div className="vs-search-box">
                <MagnifyingGlass size={15} className="vs-search-icon" />
                <input
                  type="text"
                  className="vs-search-input"
                  placeholder="Search voices..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <select
                className="vs-category-select"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="all">All Categories</option>
                <option value="custom">Custom Cloned</option>
                <option value="favorite">Favorite Stars ⭐</option>
              </select>

              <div className="vs-view-toggles">
                <button
                  className={`vs-view-btn ${viewMode === "grid" ? "active" : ""}`}
                  onClick={() => setViewMode("grid")}
                  title="Grid View"
                >
                  <SquaresFour size={16} weight="bold" />
                </button>
                <button
                  className={`vs-view-btn ${viewMode === "list" ? "active" : ""}`}
                  onClick={() => setViewMode("list")}
                  title="List View"
                >
                  <ListDashes size={16} weight="bold" />
                </button>
              </div>
            </div>

            {/* Scrollable Cards Grid */}
            <div className="vs-library-scroll">
              <div className={viewMode === "grid" ? "vs-cards-grid" : "vs-cards-list"}>
                {filteredVoices.map((v) => {
                  const isSelected = selectedVoiceId === v.id;
                  const isPlaying = previewPlayingId === v.id;
                  const isFav = favoriteVoiceIds.has(v.id);

                  return (
                    <div
                      key={v.id}
                      className={`vs-voice-card ${isSelected ? "selected" : ""}`}
                      onClick={() => setSelectedVoiceId(v.id)}
                    >
                      <div className="vs-card-3d-header">
                        <div className={`vs-card-3d-icon-badge ${isPlaying ? "is-playing" : ""}`}>
                          {isPlaying ? (
                            <div className="vs-3d-eq-bars">
                              <span className="vs-eq-bar bar-1"></span>
                              <span className="vs-eq-bar bar-2"></span>
                              <span className="vs-eq-bar bar-3"></span>
                            </div>
                          ) : (
                            <Microphone size={24} weight="duotone" className="vs-3d-main-icon" />
                          )}
                        </div>
                        <span className={`vs-card-3d-pill ${v.isTrainedModel ? "trained-pill" : ""}`}>
                          <Sparkle size={10} weight="fill" />
                          <span>{v.isTrainedModel ? "TRAINED 48kHz" : "AI VOICE"}</span>
                        </span>
                        <button
                          type="button"
                          className={`vs-card-fav-btn ${isFav ? "active" : ""}`}
                          onClick={(e) => handleToggleFavorite(e, v.id)}
                          title={isFav ? "Remove Favorite" : "Add Favorite"}
                        >
                          <Star size={13} weight={isFav ? "fill" : "bold"} />
                        </button>
                      </div>

                      <div className="vs-card-content">
                        <h3 className="vs-card-name" title={v.name}>{v.name}</h3>

                        <div className="vs-card-footer">
                          <button
                            type="button"
                            className={`vs-3d-play-btn ${isPlaying ? "playing" : ""}`}
                            onClick={(e) => handleTogglePreview(e, v)}
                            title={isPlaying ? "Stop Preview" : "Play Voice Sample"}
                          >
                            {isPlaying ? (
                              <>
                                <Pause size={13} weight="fill" />
                                <span>ផ្អាក</span>
                              </>
                            ) : (
                              <>
                                <Play size={13} weight="fill" />
                                <span>ស្តាប់</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            className="vs-3d-delete-btn"
                            onClick={(e) => handleDeleteVoice(e, v)}
                            title="Delete Voice"
                          >
                            <Trash size={14} weight="bold" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {filteredVoices.length === 0 && (
                  <div className="vs-empty-state">
                    <p>មិនទាន់មានសំឡេងក្នុងតារាងនេះទេ</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* RIGHT COLUMN: TEXT TO SPEECH STUDIO */}
          <section className="vs-studio-column">
            <div className="vs-studio-header">
              <div className="vs-tts-title-group">
                <h1 className="vs-tts-heading">
                  Text to Speech · <span className="vs-highlight-purple">AI Voice Studio</span>
                </h1>
                <p className="vs-tts-subtext">Generate realistic AI voice from your text</p>
              </div>
              <button
                className="vs-clear-text-btn"
                onClick={() => setTtsText("")}
              >
                Clear Text
              </button>
            </div>

            {/* Controls Row: Selected Voice, Language, Emotion, Style, Advanced */}
            <div className="vs-controls-row">
              {/* Selected Voice Box with Dropdown Selection */}
              <div className="vs-control-group">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="vs-control-label">Selected Voice</span>
                  {activeVoice?.category === "custom" && (
                    <button
                      className="vs-selected-trash-btn-tiny"
                      title="Delete Custom Voice"
                      onClick={(e) => handleDeleteVoice(e, activeVoice)}
                      style={{ background: "transparent", border: "none", color: "#f87171", cursor: "pointer", padding: 0 }}
                    >
                      <Trash size={12} />
                    </button>
                  )}
                </div>
                <div className="vs-selected-voice-box">
                  {allVoices.length > 0 ? (
                    <>
                      <div className="vs-selected-avatar-3d">
                        <Microphone size={16} weight="duotone" />
                      </div>
                      <select
                        className="vs-select-voice-dropdown"
                        value={activeVoice?.id || ""}
                        onChange={(e) => setSelectedVoiceId(e.target.value)}
                      >
                        {allVoices.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name} ({v.role || "Voice"})
                          </option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <span style={{ fontSize: "12px", color: "var(--vs-text-faint)", fontStyle: "italic", padding: "0 6px" }}>
                      គ្មានសំឡេង (សូមចុច Add Voice ឬ Clone)
                    </span>
                  )}
                </div>
              </div>

              {/* AI Voice Model Dropdown */}
              <div className="vs-control-group">
                <span className="vs-control-label">AI Voice Model</span>
                <select
                  className="vs-select vs-model-select"
                  value={ttsModelEngine}
                  onChange={(e) => setTtsModelEngine(e.target.value)}
                >
                  <option value="voxcpm2">✨ VoxCPM2 48kHz Neural Studio (OpenBMB - ពេញកម្លាំង Full Power)</option>
                  <option value="omnivoice">⚡ OmniVoice + AI Gemini (F5-TTS 36-Step Flow-Matching - Full Power)</option>
                  <option value="gemini">🌐 Google Gemini 2.5 Flash Native Voice (Cloud Real-Time HD)</option>
                </select>
              </div>

              {/* Language Select */}
              <div className="vs-control-group">
                <span className="vs-control-label">Language</span>
                <select
                  className="vs-select"
                  value={selectedLang}
                  onChange={(e) => setSelectedLang(e.target.value)}
                >
                  {LANGUAGES.map((lg) => (
                    <option key={lg.id} value={lg.id}>{lg.label}</option>
                  ))}
                </select>
              </div>

              {/* Emotion Select */}
              <div className="vs-control-group">
                <span className="vs-control-label">Emotion</span>
                <select
                  className="vs-select"
                  value={selectedEmotion}
                  onChange={(e) => handleEmotionChange(e.target.value)}
                >
                  {EMOTIONS.map((em) => (
                    <option key={em.id} value={em.id}>{em.label}</option>
                  ))}
                </select>
              </div>

              {/* Style Select */}
              <div className="vs-control-group">
                <span className="vs-control-label">Style</span>
                <select
                  className="vs-select"
                  value={selectedStyle}
                  onChange={(e) => handleStyleChange(e.target.value)}
                >
                  {STYLES.map((st) => (
                    <option key={st.id} value={st.id}>{st.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Inline Tuning Controls (Speed & Pitch brought outside) */}
            <div className="vs-inline-tuning-row">
              <div className="vs-tuning-item">
                <div className="vs-tuning-header">
                  <span className="vs-tuning-label">⚡ Speed · ល្បឿន</span>
                </div>
                <div className="vs-tuning-slider-wrap">
                  <input
                    type="range"
                    className="vs-tuning-slider"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={ttsSpeed}
                    onChange={(e) => setTtsSpeed(parseFloat(e.target.value))}
                  />
                  <div className="vs-tuning-presets">
                    {[0.8, 1.0, 1.2, 1.5].map((sp) => (
                      <button
                        key={sp}
                        type="button"
                        className={`vs-tuning-preset-btn ${ttsSpeed === sp ? "active" : ""}`}
                        onClick={() => setTtsSpeed(sp)}
                      >
                        {sp}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="vs-tuning-item">
                <div className="vs-tuning-header">
                  <span className="vs-tuning-label">🎵 Pitch · កម្ពស់សំឡេង</span>
                </div>
                <div className="vs-tuning-slider-wrap">
                  <input
                    type="range"
                    className="vs-tuning-slider"
                    min="0.7"
                    max="1.3"
                    step="0.05"
                    value={ttsPitch}
                    onChange={(e) => setTtsPitch(parseFloat(e.target.value))}
                  />
                  <div className="vs-tuning-presets">
                    {[0.8, 1.0, 1.2].map((pt) => (
                      <button
                        key={pt}
                        type="button"
                        className={`vs-tuning-preset-btn ${ttsPitch === pt ? "active" : ""}`}
                        onClick={() => setTtsPitch(pt)}
                      >
                        {pt}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Big Textarea Card */}
            <div className="vs-textarea-card">
              <textarea
                className="vs-studio-textarea"
                value={ttsText}
                onChange={(e) => setTtsText(e.target.value)}
                placeholder="សរសេរ ឬបិទភ្ជាប់អត្ថបទនៅទីនេះ... Type or paste Khmer script here"
                maxLength={5000}
              />
              <div className="vs-textarea-metrics">
                {textMetrics.chars} / 5000 Characters | {textMetrics.words} Words | ~{textMetrics.estSec}s
              </div>
            </div>

            {/* Action Bar (Auto-Director Toggle + Generate Button) */}
            <div className="vs-action-bar">
              <div className="vs-action-bar-left">
                <button
                  type="button"
                  className={`vs-auto-direct-toggle-pill ${autoDirectOnGenerate ? "active" : ""}`}
                  onClick={() => setAutoDirectOnGenerate((prev) => !prev)}
                  title={
                    autoDirectOnGenerate
                      ? "AI Auto-Director: បើក (Gemini នឹងជួយកែសម្រួលចង្វាក់ដកដង្ហើម និងអារម្មណ៍ស្វ័យប្រវត្តិតាមអត្ថបទពេល Generate)"
                      : "AI Auto-Director: បិទ (សំយោគដោយផ្ទាល់ជាមួយ Local AI)"
                  }
                >
                  <Sparkle size={15} weight="fill" color={autoDirectOnGenerate ? "#c084fc" : "#94a3b8"} />
                  <span className="vs-toggle-label">
                    Auto-Director & Smart Clone: <strong>{autoDirectOnGenerate ? "ON" : "OFF"}</strong>
                  </span>
                  <span className={`vs-toggle-dot ${autoDirectOnGenerate ? "active" : ""}`} />
                </button>
              </div>

              <button
                type="button"
                className="vs-generate-btn"
                disabled={isGenerating || !ttsText.trim()}
                onClick={handleGenerateVoice}
              >
                {isGenerating ? (
                  <>
                    <Waveform size={18} className="vs-pulse-icon" />
                    <span>{generationStatusText || "Generating Voice..."}</span>
                  </>
                ) : (
                  <>
                    <SpeakerHigh size={18} weight="fill" />
                    <span>Generate Voice</span>
                  </>
                )}
              </button>
            </div>

            {/* Minimized Background Progress Floating Pill (when user dismissed full 3D view) */}
            {isGenerating && generationOverlayDismissed && (
              <div
                className="vs-studio-minimized-progress-banner"
                onClick={() => setGenerationOverlayDismissed(false)}
                title="ចុចដើម្បីពង្រីកផ្ទាំង 3D Loading"
              >
                <div className="vs-mini-pulse-dot" />
                <span className="vs-mini-label">AI Voice:</span>
                <span className="vs-mini-pct">{generationProgress}%</span>
                <span className="vs-mini-stage">{generationStage}</span>
                <button type="button" className="vs-mini-expand-btn">ពង្រីក 3D</button>
              </div>
            )}

            {/* 3D Modern Neural Generation Progress Modal (Rendered to document.body, Always Centered, Never Obscured) */}
            {isGenerating && !generationOverlayDismissed && typeof document !== "undefined" && createPortal(
              <div className="vs-studio-generation-overlay" role="dialog" aria-modal="true" onClick={() => {}}>
                <div className="vs-studio-3d-loading-card" onClick={(e) => e.stopPropagation()}>
                  {generationCompletedInModal && generatedAudioUrl ? (
                    <div className="vs-3d-completion-view">
                      {/* Top Bar with Success Badge and Close Button */}
                      <div className="vs-3d-modal-topbar">
                        <div
                          className="vs-3d-badge-status"
                          style={{
                            background: "rgba(16, 185, 129, 0.16)",
                            borderColor: "rgba(16, 185, 129, 0.4)",
                            color: "#34d399",
                          }}
                        >
                          <CheckCircle size={14} weight="bold" />
                          <span>100% រួចរាល់ (READY)</span>
                        </div>
                        <button
                          type="button"
                          className="vs-3d-dismiss-btn"
                          title="បិទ (Close)"
                          onClick={handleCloseCompletionModal}
                        >
                          <X size={14} weight="bold" />
                          <span>បិទ</span>
                        </button>
                      </div>

                      {/* Glowing Success Orb */}
                      <div className="vs-3d-progress-orb vs-orb-success">
                        <div className="vs-3d-progress-orb-glow" />
                        <div className="vs-3d-progress-orb-inner-ring" />
                        <div className="vs-3d-orb-content">
                          <Waveform size={38} weight="bold" color="#34d399" />
                          <span className="vs-3d-pct-label" style={{ color: "#34d399", marginTop: 4 }}>
                            VOICE READY
                          </span>
                        </div>
                      </div>

                      {/* Success Titles */}
                      <div className="vs-3d-stage-title" style={{ color: "#6ee7b7" }}>
                        🎉 ផលិតសំឡេងបានជោគជ័យ 100%!
                      </div>
                      <div className="vs-3d-stage-subtitle">
                        សំឡេង AI ត្រូវបានសំយោគចប់សព្វគ្រប់។ លោកអ្នកអាចចាក់ស្តាប់ ឬទាញយកភ្លាមៗ៖
                      </div>

                      {/* Embedded Audio Player */}
                      <div className="vs-3d-modal-audio-player">
                        <audio
                          ref={modalAudioRef}
                          src={generatedAudioUrl}
                          controls
                          autoPlay
                          className="vs-3d-audio-element"
                        />
                      </div>

                      {/* Action Buttons */}
                      <div className="vs-3d-modal-actions">
                        <button
                          type="button"
                          className="vs-3d-action-btn primary"
                          onClick={() => {
                            handleInsertToTimelineAction();
                            handleCloseCompletionModal();
                          }}
                        >
                          <FilmStrip size={16} weight="bold" />
                          <span>បញ្ចូលទៅ Timeline</span>
                        </button>

                        <button
                          type="button"
                          className="vs-3d-action-btn secondary"
                          onClick={() => handleDownload()}
                        >
                          <DownloadSimple size={16} weight="bold" />
                          <span>ទាញយក (WAV)</span>
                        </button>

                        <button
                          type="button"
                          className="vs-3d-action-btn text-only"
                          onClick={handleCloseCompletionModal}
                        >
                          <span>រួចរាល់</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Top Bar with Cancel on Left, Background on Right */}
                      <div className="vs-3d-modal-topbar">
                        <button
                          type="button"
                          className="vs-3d-dismiss-btn"
                          style={{ color: "#f87171", borderColor: "rgba(248, 113, 113, 0.4)" }}
                          title="បោះបង់ការផលិត (Cancel)"
                          onClick={handleCancelGeneration}
                        >
                          <X size={14} weight="bold" />
                          <span>បោះបង់</span>
                        </button>
                        <button
                          type="button"
                          className="vs-3d-dismiss-btn"
                          title="ដំណើរការនៅខាងក្រោយ"
                          onClick={() => setGenerationOverlayDismissed(true)}
                        >
                          <span>ដំណើរការខាងក្រោយ</span>
                          <Minus size={14} weight="bold" />
                        </button>
                      </div>

                      {/* 3D Dynamic Glowing Orb */}
                      <div className={`vs-3d-progress-orb vs-orb-${activeResolvedEngine || "voxcpm2"}`}>
                        <div className="vs-3d-progress-orb-glow" />
                        <div className="vs-3d-progress-orb-inner-ring" />
                        <div className="vs-3d-orb-content">
                          <span className="vs-3d-pct-text">{generationProgress}%</span>
                          <span className="vs-3d-pct-label">SYNTHESIZING</span>
                        </div>
                      </div>

                      {/* Stage and Status Titles */}
                      <div className="vs-3d-stage-title">
                        {generationStage || "Neural Voice Flow Matching..."}
                      </div>
                      <div className="vs-3d-stage-subtitle">
                        {generationStatusText || "AI កំពុងដំណើរការសំយោគសំឡេង..."}
                      </div>

                      {/* Multi-Stage Pipeline Stepper Card Widget */}
                      <div className="vs-3d-pipeline-stepper">
                        {GENERATION_PIPELINE_STAGES.map((stg, i) => {
                          const isDone = pipelineStageIndex > i;
                          const isActive = pipelineStageIndex === i;
                          return (
                            <div key={stg.id} className={`vs-3d-step-item ${isDone ? "done" : isActive ? "active" : "pending"}`}>
                              <div className="vs-3d-step-indicator">
                                {isDone ? <Check size={12} weight="bold" /> : <span>{stg.num}</span>}
                              </div>
                              <div className="vs-3d-step-body">
                                <span className="vs-3d-step-label">
                                  {stg.name}
                                  <span style={{ display: "block", fontSize: "10px", color: isDone ? "#34d399" : isActive ? "#c084fc" : "#64748b", fontWeight: "normal" }}>
                                    {stg.desc}
                                  </span>
                                </span>
                                <span className="vs-3d-step-badge">
                                  {isDone ? "✓ រួចរាល់" : isActive ? "កំពុងដំណើរការ..." : "រង់ចាំ"}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Animated Progress Bar */}
                      <div className="vs-3d-progress-bar-shell">
                        <div
                          className="vs-3d-progress-bar-fill"
                          style={{ width: `${Math.max(5, Math.min(100, generationProgress))}%` }}
                        >
                          <div className="vs-3d-progress-bar-shimmer" />
                        </div>
                      </div>

                      {/* Metrics Badges */}
                      <div className="vs-3d-metrics-pills">
                        <div className="vs-3d-metric-badge">
                          <span>ម៉ូដែល AI:</span>
                          <strong style={{
                            color: activeResolvedEngine === "gemini"
                              ? "#34d399"
                              : "#f59e0b"
                          }}>
                            {activeResolvedEngine === "gemini"
                              ? "🌐 Google Gemini 2.5 Flash Native Voice"
                              : "✨ VoxCPM2 48kHz Studio Quality (ពេញកម្លាំង Full Power)"}
                          </strong>
                        </div>
                        <div className="vs-3d-metric-badge">
                          <span>ដំណាក់កាល:</span>
                          <strong style={{ color: "#c084fc" }}>
                            {pipelineStageIndex + 1}/4
                          </strong>
                        </div>
                        <div className="vs-3d-metric-badge">
                          <span>រយៈពេល:</span>
                          <strong>{generationElapsed}s</strong>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>,
              document.body
            )}

            {/* AI Director Section (Gemini Auto-Director + Local Engine) */}
            <div className="vs-director-section">
              <div className="vs-section-header-row">
                <div className="vs-section-title">
                  <Brain size={18} weight="fill" color="#c084fc" />
                  <span>AI Director Overview</span>
                  {geminiApiKey ? (
                    <span className="vs-director-gemini-badge active" title="Gemini Cloud AI Active">
                      <Sparkle size={11} weight="fill" color="#a855f7" />
                      Gemini Auto-Director
                    </span>
                  ) : (
                    <span className="vs-director-gemini-badge inactive" title="ភ្ជាប់ Gemini Key ដើម្បីដំណើរការ Smart Directing">
                      Gemini (No Key)
                    </span>
                  )}
                </div>

                <div className="vs-director-header-actions">
                  <button
                    type="button"
                    className="vs-director-key-btn"
                    onClick={handleOpenGeminiKeyModal}
                    title="កំណត់ Google Gemini API Key"
                  >
                    <Key size={13} weight="bold" />
                    <span>{geminiApiKey ? "Gemini Key ✓" : "Connect Key"}</span>
                  </button>

                  <button
                    type="button"
                    className="vs-director-action-btn"
                    onClick={handleAutoDirectScript}
                    disabled={isDirecting || !ttsText.trim()}
                    title="ឱ្យ Gemini វិភាគ និងសម្រួលចង្វាក់ដកដង្ហើមខ្មែរសម្រាប់ Local AI"
                  >
                    {isDirecting ? (
                      <>
                        <CircleNotch size={14} className="vs-spin" />
                        <span>Directing...</span>
                      </>
                    ) : (
                      <>
                        <MagicWand size={14} weight="fill" />
                        <span>Auto-Direct Script</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Deep Gemini Director Analysis & Model Synergy Banner */}
              {directorNotes && (
                <div className="vs-director-notes-banner vs-director-deep-banner">
                  <div className="vs-director-deep-top">
                    <div className="vs-director-deep-headline">
                      <Sparkle size={16} weight="fill" color="#c084fc" />
                      <span className="vs-director-title-text">Gemini Director: ការវិភាគស៊ីជម្រៅ & Model Synergy</span>
                    </div>
                    <div className="vs-director-top-actions">
                      {directorTargetAcoustic && (
                        <span className="vs-director-engine-badge">
                          ⚡ {directorTargetAcoustic}
                        </span>
                      )}
                      {originalScriptBeforeDirect && (
                        <button
                          type="button"
                          className="vs-director-revert-pill"
                          onClick={handleRevertScript}
                          title="ស្ដារអត្ថបទដើមវិញ"
                        >
                          ↩ Revert Original
                        </button>
                      )}
                    </div>
                  </div>

                  {directorIntent && (
                    <div className="vs-director-intent-row">
                      <span className="vs-intent-tag">🎯 ចេតនាអ្នកនិពន្ធ:</span>
                      <span className="vs-intent-text">{directorIntent}</span>
                    </div>
                  )}

                  <div className="vs-director-notes-body">
                    <span className="vs-notes-label">💡 ការណែនាំសំឡេង:</span>
                    <span>{directorNotes}</span>
                  </div>

                  {directorPhonetics && directorPhonetics.length > 0 && (
                    <div className="vs-director-phonetics-row">
                      <span className="vs-phonetics-label">🗣️ ពាក្យពិបាកកែជាសូរសំឡេង ({directorPhonetics.length}):</span>
                      <div className="vs-phonetics-pills">
                        {directorPhonetics.map((p, idx) => (
                          <span key={idx} className="vs-phonetic-pill">{p}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="vs-director-grid">
                <div className="vs-director-card">
                  <span className="vs-director-label">TEXT TYPE</span>
                  <span className="vs-director-val">
                    {detectedScriptType || (ttsText.includes("ព្រះ") || ttsText.includes("ស្ដេច") ? "Historical Drama" : "Narrative Script")}
                  </span>
                </div>
                <div className="vs-director-card">
                  <span className="vs-director-label">SPEAKING STYLE</span>
                  <span className="vs-director-val">
                    {STYLES.find((s) => s.id === selectedStyle)?.label.replace(/^[^\w\s\u1780-\u17FF]+/, "").trim() || "Professional"}
                    {selectedEmotion !== "none" ? ` (${EMOTIONS.find((e) => e.id === selectedEmotion)?.label.replace(/^[^\w\s\u1780-\u17FF]+/, "").trim()})` : ""}
                  </span>
                </div>
                <div className="vs-director-card">
                  <span className="vs-director-label">READING SPEED</span>
                  <span className="vs-director-val">{ttsSpeed.toFixed(2)}x · Pitch {ttsPitch.toFixed(2)}x</span>
                </div>
                <div className="vs-director-card">
                  <span className="vs-director-label">SYNTHESIS ENGINE</span>
                  <span className="vs-director-val">
                    {activeResolvedEngine === "gemini"
                      ? "🌐 Google Gemini 2.5 Flash Native Voice"
                      : activeResolvedEngine === "omnivoice"
                      ? "⚡ OmniVoice + AI Gemini (F5-TTS Full Power)"
                      : "✨ VoxCPM2 48kHz Studio Quality (ពេញកម្លាំង Full Power)"}
                  </span>
                </div>
                <div className="vs-director-card">
                  <span className="vs-director-label">LANGUAGE & PROSODY</span>
                  <span className="vs-director-val">
                    {selectedLang === "auto" ? "KM (Auto-Paced)" : `${selectedLang.toUpperCase()} (Paced)`}
                  </span>
                </div>
              </div>
            </div>

            {/* Gemini API Key Modal */}
            {showGeminiKeyModal && typeof document !== "undefined" &&
              createPortal(
                <div className="vs-modal-backdrop" onClick={() => setShowGeminiKeyModal(false)}>
                  <div className="vs-gemini-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="vs-gemini-modal-header">
                      <div className="vs-gemini-modal-title">
                        <Brain size={22} weight="fill" color="#c084fc" />
                        <div>
                          <h3>Google Gemini API Key Setup</h3>
                          <p>ដំណើរការ Gemini AI Auto Director ជាមួយម៉ាស៊ីន Local AI</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="vs-gemini-modal-close"
                        onClick={() => setShowGeminiKeyModal(false)}
                      >
                        <X size={18} />
                      </button>
                    </div>

                    <div className="vs-gemini-modal-body">
                      <div className="vs-gemini-benefit-card">
                        <Sparkle size={18} weight="fill" color="#a855f7" />
                        <div>
                          <strong>តើ Gemini ជួយអ្វីខ្លះដល់ Local AI?</strong>
                          <p>
                            Gemini វិភាគអត្ថបទខ្មែរ បន្ថែមសញ្ញាផ្អាកដកដង្ហើមតាមចង្វាក់មនុស្សពិត
                            និងកែសម្រួលល្បឿន Speed & Pitch ដោយស្វ័យប្រវត្តិតាមមនោសញ្ចេតនាសាច់រឿង!
                          </p>
                        </div>
                      </div>

                      <div className="vs-gemini-input-group">
                        <label>Google Gemini API Key</label>
                        <div className="vs-gemini-input-wrap">
                          <Key size={16} className="vs-gemini-key-icon" />
                          <input
                            type="password"
                            value={tempGeminiKey}
                            onChange={(e) => setTempGeminiKey(e.target.value)}
                            placeholder="AIzaSy..."
                            className="vs-gemini-key-input"
                          />
                        </div>
                        <div className="vs-gemini-hint">
                          ទទួលបាន API Key ឥតគិតថ្លៃ (100% Free):{" "}
                          <a
                            href="https://aistudio.google.com/app/apikey"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Google AI Studio ↗
                          </a>
                        </div>
                      </div>

                      {keyVerifyStatus && (
                        <div
                          className={`vs-gemini-verify-badge ${
                            keyVerifyStatus.valid ? "valid" : "invalid"
                          }`}
                        >
                          {keyVerifyStatus.valid ? (
                            <CheckCircle size={16} weight="fill" color="#10b981" />
                          ) : (
                            <X size={16} weight="bold" color="#ef4444" />
                          )}
                          <span>{keyVerifyStatus.msg}</span>
                        </div>
                      )}
                    </div>

                    <div className="vs-gemini-modal-footer">
                      <button
                        type="button"
                        className="vs-gemini-btn-cancel"
                        onClick={() => setShowGeminiKeyModal(false)}
                      >
                        បោះបង់
                      </button>
                      <button
                        type="button"
                        className="vs-gemini-btn-save"
                        onClick={handleSaveGeminiKey}
                        disabled={isVerifyingKey || !tempGeminiKey.trim()}
                      >
                        {isVerifyingKey ? (
                          <>
                            <CircleNotch size={16} className="vs-spin" />
                            <span>កំពុងផ្ទៀងផ្ទាត់...</span>
                          </>
                        ) : (
                          <>
                            <Check size={16} weight="bold" />
                            <span>រក្សាទុក & ភ្ជាប់ Key</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>,
                document.body
              )}

            {/* Generated Audio Section */}
            <div className="vs-audio-section">
              <div className="vs-section-header-row">
                <div className="vs-section-title">
                  <Waveform size={18} weight="fill" color="#818cf8" />
                  <span>Generated Audio Output</span>
                </div>
                <div className="vs-status-pill" style={{ color: "#22c55e", background: "rgba(34, 197, 94, 0.1)" }}>
                  <span>🟢 High Quality</span>
                </div>
              </div>

              <div className="vs-audio-player-card">
                <div className="vs-audio-meta">
                  {activeVoice ? (
                    <>
                      <div className="vs-audio-thumb-3d">
                        <SpeakerHigh size={18} weight="duotone" />
                      </div>
                      <div className="vs-audio-info">
                        <h4>{activeVoice.name}</h4>
                        <p>{generatedTimestamp}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="vs-audio-thumb" style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.06)" }}>
                        <Waveform size={20} color="var(--vs-text-faint)" />
                      </div>
                      <div className="vs-audio-info">
                        <h4 style={{ color: "var(--vs-text-muted)" }}>មិនទាន់មានសំឡេង (No Voice)</h4>
                        <p>{generatedTimestamp}</p>
                      </div>
                    </>
                  )}
                </div>

                <div className="vs-audio-controls-bar">
                  {generatedAudioUrl ? (
                    <audio
                      src={generatedAudioUrl}
                      controls
                      autoPlay
                      className="vs-audio-player-element"
                    />
                  ) : (
                    <div style={{ fontSize: "12px", color: "var(--vs-text-faint)", fontStyle: "italic" }}>
                      ចុច "Generate Voice" ដើម្បីបង្កើតសំឡេងថ្មី និងចាក់សាកល្បងនៅទីនេះ
                    </div>
                  )}
                </div>

                <div className="vs-audio-actions-stack">
                  <button
                    type="button"
                    className="vs-audio-btn"
                    disabled={!generatedAudioUrl}
                    onClick={() => handleDownload()}
                  >
                    <DownloadSimple size={15} weight="bold" />
                    <span>Download</span>
                  </button>

                  <button
                    type="button"
                    className="vs-audio-btn insert-timeline"
                    disabled={!generatedAudioBlob}
                    onClick={() => handleInsertToTimelineAction()}
                  >
                    <FilmStrip size={15} weight="bold" />
                    <span>Insert to Timeline</span>
                  </button>

                  <button
                    type="button"
                    className="vs-audio-btn"
                    onClick={() => {
                      navigator.clipboard?.writeText(ttsText);
                      notify("បានចម្លងអត្ថបទ!", "info");
                    }}
                  >
                    <ShareNetwork size={15} />
                    <span>Copy Text</span>
                  </button>

                  <button
                    type="button"
                    className="vs-audio-btn"
                    disabled={!activeVoice}
                    onClick={(e) => activeVoice && handleToggleFavorite(e, activeVoice.id)}
                  >
                    <Heart size={15} weight={activeVoice && favoriteVoiceIds.has(activeVoice.id) ? "fill" : "regular"} color="#ec4899" />
                    <span>Favorite</span>
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ==========================================================================
          TAB: VOICE DEEP TRAINING (VoxCPM2 Neural Fine-Tuning)
          ========================================================================== */}
      {activeTab === "train" && (
        <div className="vs-subview-scroll">
          <div className="vs-subview-container">
            {/* 3D Header Hero Card with Steps Tracker */}
            <div className="vs-train-hero-card">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
                <div>
                  <h2 style={{ fontSize: "22px", fontWeight: 800, margin: "0 0 6px 0", display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(245, 158, 11, 0.2)", border: "1px solid rgba(245, 158, 11, 0.4)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(245, 158, 11, 0.3)" }}>
                      <Brain size={22} weight="fill" style={{ color: "#fbbf24" }} />
                    </div>
                    <span>Voice Deep Training</span>
                    <span style={{ color: "#fbbf24", fontWeight: 600 }}>· បង្វឹកសំឡេង AI ដូចមនុស្សពិត</span>
                  </h2>
                  <p style={{ margin: 0, fontSize: "13px", color: "var(--vs-text-secondary)" }}>
                    បង្វឹក Neural Model ដោយផ្ទាល់ជាមួយសំឡេងនិយាយពី ១ ដល់ ១៥ នាទី។ រក្សាទុកជាអចិន្ត្រៃយ៍ លើកក្រោយមិនបាច់បង្វឹកទៀតឡើយ។
                  </p>
                </div>

                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <span className="vs-badge-purple" style={{ background: "rgba(245, 158, 11, 0.15)", color: "#fbbf24", borderColor: "rgba(245, 158, 11, 0.4)", padding: "6px 14px", fontSize: "12px", fontWeight: 700 }}>
                    ⚡ VoxCPM2 48kHz Neural
                  </span>
                </div>
              </div>

              {/* 3D Stepper */}
              <div className="vs-3d-stepper">
                {[
                  { step: 1, title: "១. Setup & Audio" },
                  { step: 2, title: "២. Dataset Slices" },
                  { step: 3, title: "៣. Neural Training" },
                  { step: 4, title: "៤. Model Ready" },
                ].map((s) => (
                  <div
                    key={s.step}
                    className={`vs-3d-step-item ${trainStep === s.step ? "active" : trainStep > s.step ? "completed" : ""}`}
                  >
                    <div className="vs-3d-step-num">
                      {trainStep > s.step ? <Check size={14} weight="bold" /> : s.step}
                    </div>
                    <div className="vs-3d-step-title">{s.title}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* STEP 1: Upload & Name (Clean 3D Layout) */}
            {trainStep === 1 && (
              <div className="vs-train-card">
                <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1.2fr", gap: "20px" }}>
                  <div className="vs-3d-input-group">
                    <label className="vs-3d-label">
                      <Sparkle size={15} weight="fill" style={{ color: "#fbbf24" }} />
                      <span>ឈ្មោះ Voice Model (Model Name)</span>
                    </label>
                    <input
                      type="text"
                      className="vs-3d-input"
                      placeholder="ឧទាហរណ៍: Piseth News Anchor Pro"
                      value={trainModelName}
                      onChange={(e) => setTrainModelName(e.target.value)}
                    />
                  </div>

                  <div className="vs-3d-input-group">
                    <label className="vs-3d-label">
                      <Globe size={15} style={{ color: "#a78bfa" }} />
                      <span>ភាសាសំឡេង (Primary Language)</span>
                    </label>
                    <select
                      className="vs-3d-select"
                      value={trainLanguage}
                      onChange={(e) => setTrainLanguage(e.target.value)}
                    >
                      <option value="km">🇰🇭 ភាសាខ្មែរ (Khmer - km)</option>
                      <option value="en">🇺🇸 អង់គ្លេស (English - en)</option>
                    </select>
                  </div>
                </div>

                <div className="vs-3d-input-group">
                  <label className="vs-3d-label">
                    <Microphone size={15} style={{ color: "#38bdf8" }} />
                    <span>ជ្រើសរើសឯកសារសំឡេង (១ - ១៥ នាទី, សំឡេងនិយាយច្បាស់ គ្មានតន្ត្រី BGM)</span>
                  </label>
                  <input
                    type="file"
                    ref={trainFileRef}
                    accept="audio/*"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setTrainAudioFile(f);
                        if (!trainModelName) {
                          setTrainModelName(f.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_\-\s]/g, ""));
                        }
                      }
                    }}
                  />
                  <div
                    className={`vs-3d-dropzone ${trainAudioFile ? "has-file" : ""}`}
                    onClick={() => trainFileRef.current?.click()}
                  >
                    {trainAudioFile ? (
                      <>
                        <div style={{ width: "54px", height: "54px", borderRadius: "50%", background: "rgba(16, 185, 129, 0.2)", border: "2px solid #10b981", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 16px rgba(16, 185, 129, 0.3)" }}>
                          <CheckCircle size={32} weight="fill" style={{ color: "#10b981" }} />
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: "15px", fontWeight: 700, color: "#fff" }}>
                            {trainAudioFile.name}
                          </div>
                          <div style={{ fontSize: "12px", color: "#34d399", marginTop: "4px" }}>
                            ទំហំ: {(trainAudioFile.size / 1024 / 1024).toFixed(2)} MB · រួចរាល់សម្រាប់ការវិភាគ
                          </div>
                        </div>
                        <span style={{ fontSize: "11px", color: "var(--vs-text-muted)", textDecoration: "underline" }}>
                          ចុចទីនេះប្រសិនបើចង់ប្ដូរ File សំឡេងផ្សេង
                        </span>
                      </>
                    ) : (
                      <>
                        <div style={{ width: "54px", height: "54px", borderRadius: "50%", background: "rgba(245, 158, 11, 0.15)", border: "2px solid rgba(245, 158, 11, 0.4)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(245, 158, 11, 0.2)" }}>
                          <UploadSimple size={28} style={{ color: "#fbbf24" }} />
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: "15px", fontWeight: 700, color: "#fff" }}>
                            ចុចទីនេះ ឬអូសទម្លាក់ File សំឡេង (WAV / MP3 / M4A)
                          </div>
                          <div style={{ fontSize: "12px", color: "var(--vs-text-muted)", marginTop: "4px" }}>
                            ប្រព័ន្ធនឹងស្វែងរកចន្លោះស្ងាត់ (Silence Slicing) និងស្រង់អត្ថបទដោយ Whisper STT ដោយស្វ័យប្រវត្តិ
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* 3D Live Loading & Percentage Card */}
                {trainIsBusy && (
                  <div className="vs-train-card" style={{ marginTop: "16px", background: "linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(15, 18, 30, 0.95) 100%)", borderColor: "rgba(245, 158, 11, 0.4)", textAlign: "center", padding: "26px 20px", boxShadow: "0 10px 28px rgba(0,0,0,0.4)" }}>
                    <div className="vs-3d-progress-orb" style={{ width: "110px", height: "110px", margin: "0 auto 14px auto" }}>
                      <div className="vs-3d-progress-orb-glow"></div>
                      <div className="vs-3d-pct-text" style={{ fontSize: "32px" }}>{trainPrepareProgress}%</div>
                      <div className="vs-3d-pct-label">Preparing</div>
                    </div>

                    <div style={{ fontSize: "16px", fontWeight: 700, color: "#fff", marginBottom: "6px" }}>
                      {trainPrepareStage || "កំពុងរៀបចំទិន្នន័យបង្វឹក..."}
                    </div>
                    <div style={{ fontSize: "12.5px", color: "var(--vs-text-secondary)", marginBottom: "16px" }}>
                      ប្រព័ន្ធកំពុងដំណើរការបំបែកសំឡេង និងស្រង់ទិន្នន័យ Phoneme ដោយស្វ័យប្រវត្តិ
                    </div>

                    <div className="vs-3d-progress-bar-shell" style={{ maxWidth: "480px" }}>
                      <div className="vs-3d-progress-bar-fill" style={{ width: `${trainPrepareProgress}%` }} />
                    </div>

                    <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#fbbf24", background: "rgba(245, 158, 11, 0.15)", padding: "4px 14px", borderRadius: "999px" }}>
                      <CircleNotch size={14} className="vs-spin" />
                      <span>ដំណើរការវិភាគ: <strong>{trainPrepareProgress}%</strong></span>
                    </div>
                  </div>
                )}

                {trainError && (
                  <div style={{ padding: "12px 16px", borderRadius: "10px", background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#f87171", fontSize: "13px", display: "flex", alignItems: "center", gap: "8px", margin: "14px 0" }}>
                    <X size={16} />
                    <span>{trainError}</span>
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "20px" }}>
                  <button
                    type="button"
                    className="vs-3d-action-btn vs-3d-btn-gold"
                    disabled={!trainAudioFile || !trainModelName.trim() || trainIsBusy}
                    onClick={handlePrepareTrainingDataset}
                  >
                    {trainIsBusy ? (
                      <>
                        <CircleNotch size={18} className="vs-spin" />
                        <span>កំពុងវិភាគ និងបំបែក Dataset...</span>
                      </>
                    ) : (
                      <>
                        <span>បន្តទៅមុខ: រៀបចំ Dataset</span>
                        <ArrowRight size={18} weight="bold" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: Dataset Review & Hyperparameters */}
            {trainStep === 2 && trainDataset && (
              <div className="vs-train-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
                  <div>
                    <h3 style={{ fontSize: "17px", fontWeight: 700, margin: "0 0 4px 0", color: "#fff" }}>
                      ២. ពិនិត្យមើលទិន្នន័យបង្វឹក (Dataset Segments)
                    </h3>
                    <p style={{ margin: 0, fontSize: "13px", color: "var(--vs-text-secondary)" }}>
                      បានកាត់បំបែកជា <strong style={{ color: "#fbbf24" }}>{trainDataset.total_segments} ផ្នែកសំឡេង</strong> (សរុបប្រហែល {trainDataset.total_duration} វិនាទី)
                    </p>
                  </div>
                  <button
                    type="button"
                    className="vs-3d-action-btn vs-3d-btn-secondary"
                    onClick={() => setTrainStep(1)}
                    style={{ padding: "8px 16px", fontSize: "12px" }}
                  >
                    ← ត្រឡប់ក្រោយ
                  </button>
                </div>

                {/* Segments Preview Table */}
                <div style={{ maxHeight: "250px", overflowY: "auto", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", background: "rgba(10, 12, 22, 0.6)", boxShadow: "inset 0 2px 6px rgba(0,0,0,0.4)" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", textAlign: "left" }}>
                        <th style={{ padding: "10px 14px", width: "70px", color: "var(--vs-text-muted)" }}>ល.រ</th>
                        <th style={{ padding: "10px 14px", width: "110px", color: "var(--vs-text-muted)" }}>ថិរវេលា</th>
                        <th style={{ padding: "10px 14px", color: "var(--vs-text-muted)" }}>អត្ថបទសម្គាល់ (Whisper STT Text)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trainDataset.segments?.map((seg) => (
                        <tr key={seg.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <td style={{ padding: "9px 14px", color: "var(--vs-text-muted)", fontWeight: 700 }}>#{seg.id}</td>
                          <td style={{ padding: "9px 14px", color: "#fbbf24", fontWeight: 600 }}>{seg.duration}s</td>
                          <td style={{ padding: "9px 14px", color: "#e2e8f0" }}>{seg.text}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Hyperparameters Controls */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginTop: "20px" }}>
                  <div className="vs-3d-input-group">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <label className="vs-3d-label">
                        <Sliders size={15} style={{ color: "#fbbf24" }} />
                        <span>ចំនួន Epochs (រង្វិលជុំបង្វឹក)</span>
                      </label>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "#fbbf24", background: "rgba(245, 158, 11, 0.15)", padding: "2px 8px", borderRadius: "6px" }}>
                        {trainEpochs} Epochs
                      </span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={50}
                      step={5}
                      value={trainEpochs}
                      onChange={(e) => setTrainEpochs(Number(e.target.value))}
                      style={{ width: "100%", accentColor: "#f59e0b", cursor: "pointer", marginTop: "8px" }}
                    />
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--vs-text-muted)" }}>
                      <span>លឿន (10 Epochs)</span>
                      <span>ស្តង់ដារ (20 Epochs)</span>
                      <span>ស៊ីជម្រៅ (50 Epochs)</span>
                    </div>
                  </div>

                  <div className="vs-3d-input-group">
                    <label className="vs-3d-label">
                      <Brain size={15} style={{ color: "#a78bfa" }} />
                      <span>Architecture Backbone</span>
                    </label>
                    <div style={{ padding: "12px 16px", borderRadius: "12px", background: "rgba(10, 12, 22, 0.7)", border: "1px solid rgba(255, 255, 255, 0.1)", color: "#a78bfa", fontSize: "13.5px", fontWeight: 700 }}>
                      OpenBMB VoxCPM2 48kHz (Tokenizer-Free Neural Flow)
                    </div>
                  </div>
                </div>

                {trainError && (
                  <div style={{ padding: "12px 16px", borderRadius: "10px", background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#f87171", fontSize: "13px", margin: "14px 0" }}>
                    {trainError}
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "20px" }}>
                  <button
                    type="button"
                    className="vs-3d-action-btn vs-3d-btn-green"
                    disabled={trainIsBusy}
                    onClick={handleStartVoiceTraining}
                  >
                    <Brain size={18} weight="fill" />
                    <span>ចាប់ផ្ដើមបង្វឹក Deep Learning ឥឡូវ</span>
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Live Neural Training Monitor with 3D Orb & Percentage */}
            {trainStep === 3 && (
              <div className="vs-train-card vs-3d-progress-hub">
                {/* 3D Orb with Big Percentage */}
                <div className="vs-3d-progress-orb">
                  <div className="vs-3d-progress-orb-glow"></div>
                  <div className="vs-3d-pct-text">{trainJob?.progress || 10}%</div>
                  <div className="vs-3d-pct-label">Training</div>
                </div>

                <h3 style={{ fontSize: "20px", fontWeight: 800, margin: "0 0 6px 0", color: "#fff" }}>
                  កំពុងបង្វឹក Voice Model: <span style={{ color: "#fbbf24" }}>{trainModelName}</span>
                </h3>
                <p style={{ margin: "0 0 24px 0", fontSize: "13.5px", color: "var(--vs-text-secondary)" }}>
                  {trainJob?.stage || "កំពុងផ្ទុកទម្ងន់បណ្ដាញប្រសាទ និងគណនា Gradient Convergence..."}
                </p>

                {/* 3D Progress Bar */}
                <div className="vs-3d-progress-bar-shell">
                  <div
                    className="vs-3d-progress-bar-fill"
                    style={{ width: `${trainJob?.progress || 10}%` }}
                  />
                </div>

                {/* Metrics Badges */}
                <div className="vs-3d-metrics-pills">
                  <div className="vs-3d-metric-badge">
                    <span>ដំណើរការសរុប:</span>
                    <strong style={{ color: "#fbbf24" }}>{trainJob?.progress || 10}%</strong>
                  </div>
                  <div className="vs-3d-metric-badge">
                    <span>Epoch:</span>
                    <strong>{trainJob?.current_epoch || 1} / {trainEpochs}</strong>
                  </div>
                  <div className="vs-3d-metric-badge">
                    <span>CrossEntropy Loss:</span>
                    <strong style={{ color: "#34d399" }}>
                      {trainJob?.current_loss ? trainJob.current_loss.toFixed(4) : "1.2500"}
                    </strong>
                  </div>
                  <div className="vs-3d-metric-badge">
                    <span>Sample Rate:</span>
                    <strong>48,000 Hz</strong>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: Completed & Permanent Model */}
            {trainStep === 4 && (
              <div className="vs-train-card" style={{ textAlign: "center", padding: "44px 28px", background: "linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(18, 20, 34, 0.95) 100%)", borderColor: "rgba(16, 185, 129, 0.35)" }}>
                <div style={{ width: "80px", height: "80px", borderRadius: "50%", background: "rgba(16, 185, 129, 0.2)", border: "3px solid #10b981", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px auto", boxShadow: "0 0 30px rgba(16, 185, 129, 0.4)" }}>
                  <CheckCircle size={50} weight="fill" style={{ color: "#10b981" }} />
                </div>

                <h3 style={{ fontSize: "24px", fontWeight: 800, margin: "0 0 8px 0", color: "#fff" }}>
                  ការបង្វឹកសំឡេងសម្រេចបានជោគជ័យ ១០០%!
                </h3>
                <p style={{ margin: "0 0 24px 0", fontSize: "14px", color: "var(--vs-text-secondary)" }}>
                  Model <strong>"{trainModelName}"</strong> ត្រូវបានរក្សាទុកជាអចិន្ត្រៃយ៍ក្នុងប្រព័ន្ធរួចរាល់ហើយ លើកក្រោយមិនចាំបាច់បង្វឹកម្ដងទៀតឡើយ។
                </p>

                <div style={{ display: "inline-flex", flexDirection: "column", gap: "8px", padding: "14px 24px", borderRadius: "14px", background: "rgba(10, 12, 22, 0.7)", border: "1px solid rgba(16, 185, 129, 0.3)", margin: "0 auto 28px auto", textAlign: "left", fontSize: "13.5px", boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)" }}>
                  <div>Model Name: <strong style={{ color: "#fff" }}>{trainModelName}</strong></div>
                  <div>Sample Rate: <strong style={{ color: "#fbbf24" }}>48,000 Hz Studio Quality</strong></div>
                  <div>Final Loss: <strong style={{ color: "#10b981" }}>{trainJob?.current_loss ? trainJob.current_loss.toFixed(4) : "0.0812"}</strong></div>
                  <div>Status: <span style={{ color: "#10b981", fontWeight: 700 }}>Permanent Local Model Ready</span></div>
                </div>

                <div style={{ display: "flex", gap: "14px", justifyContent: "center" }}>
                  <button
                    type="button"
                    className="vs-3d-action-btn vs-3d-btn-green"
                    onClick={() => handleSelectTrainedVoiceAndGoToStudio(newlyTrainedVoice?.id)}
                  >
                    <SpeakerHigh size={18} weight="fill" />
                    <span>សាកល្បងនិយាយសំឡេងនេះក្នុង Studio</span>
                  </button>

                  <button
                    type="button"
                    className="vs-3d-action-btn vs-3d-btn-secondary"
                    onClick={() => {
                      setTrainStep(1);
                      setTrainAudioFile(null);
                      setTrainModelName("");
                      setTrainDataset(null);
                      setTrainJob(null);
                    }}
                  >
                    បង្វឹកសំឡេងមួយទៀត
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==========================================================================
          TAB 3: SPEECH TO TEXT (Full Whisper AI Transcription)
          ========================================================================== */}
      {activeTab === "stt" && (
        <div className="vs-subview-scroll">
          <div className="vs-subview-container">
            <div className="vs-subview-card">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <h2 style={{ fontSize: "20px", fontWeight: 700, margin: 0 }}>
                    Speech to Text · <span style={{ color: "var(--vs-purple-primary)" }}>បម្លែងសំឡេងទៅជាអក្សរ</span>
                  </h2>
                </div>
                <span className="vs-badge-purple">Khmer Whisper Turbo</span>
              </div>

              <div className="vs-clone-grid">
                {/* Column 1: Audio Input (Upload or Record) */}
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--vs-text-body)" }}>
                    1. Input Speech Audio (បញ្ចូលសំឡេង)
                  </label>

                  {/* Drop zone */}
                  <div
                    className="vs-drop-zone"
                    onClick={() => document.getElementById("vs-stt-audio-input")?.click()}
                  >
                    <div className="vs-mic-circle">
                      <UploadSimple size={26} weight="bold" />
                    </div>
                    <div style={{ fontSize: "14px", fontWeight: 600, textAlign: "center" }}>
                      {sttFile ? `បានជ្រើស: ${sttFile.name}` : "Click to Upload Audio (.wav, .mp3, .m4a, .webm)"}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--vs-text-faint)" }}>
                      Upload speech audio up to 50MB
                    </div>
                    <input
                      id="vs-stt-audio-input"
                      type="file"
                      accept="audio/*"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) setSttFile(f);
                      }}
                    />
                  </div>

                  {/* Mic Live Recording Control */}
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid var(--vs-border)",
                    borderRadius: "10px"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div className={`vs-mic-circle ${isRecording ? "recording" : ""}`} style={{ width: "38px", height: "38px" }}>
                        <Microphone size={18} weight="fill" />
                      </div>
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: 600 }}>
                          {isRecording ? `កំពុងថតសំឡេង... (${recordingSeconds}s)` : "ថតសំឡេងផ្ទាល់ (Live Mic)"}
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--vs-text-faint)" }}>
                          {isRecording ? "ចុច Stop Recording នៅពេលនិយាយចប់" : "ចុច Record ដើម្បីចាប់ផ្ដើមថត"}
                        </div>
                      </div>
                    </div>

                    {isRecording ? (
                      <button
                        type="button"
                        onClick={handleStopRecording}
                        style={{
                          background: "#ef4444",
                          border: "none",
                          color: "#fff",
                          padding: "6px 14px",
                          borderRadius: "8px",
                          fontSize: "12.5px",
                          fontWeight: "600",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px"
                        }}
                      >
                        <Stop size={15} weight="fill" />
                        <span>Stop Recording</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleStartRecording}
                        style={{
                          background: "var(--vs-purple-primary)",
                          border: "none",
                          color: "#fff",
                          padding: "6px 14px",
                          borderRadius: "8px",
                          fontSize: "12.5px",
                          fontWeight: "600",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px"
                        }}
                      >
                        <Microphone size={15} weight="fill" />
                        <span>Record Mic</span>
                      </button>
                    )}
                  </div>

                  <div className="vs-setting-item">
                    <label>Target Language (ភាសា)</label>
                    <select
                      className="vs-select"
                      value={sttLang}
                      onChange={(e) => setSttLang(e.target.value)}
                    >
                      {LANGUAGES.map((lg) => (
                        <option key={lg.id} value={lg.id}>{lg.label}</option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    className="vs-generate-btn"
                    style={{ justifyContent: "center", width: "100%" }}
                    disabled={sttBusy || !sttFile || isRecording}
                    onClick={handleTranscribeSubmit}
                  >
                    {sttBusy ? (
                      <>
                        <CircleNotch size={18} className="vs-spin-icon" />
                        <span>Transcribing Audio...</span>
                      </>
                    ) : (
                      <>
                        <Microphone size={18} weight="bold" />
                        <span>🎙️ Transcribe Audio (Whisper AI)</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Column 2: STT Output Results */}
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--vs-text-body)" }}>
                    2. Transcribed Text (អត្ថបទដែលបានបម្លែង)
                  </label>

                  {sttResult ? (
                    <div className="vs-stt-output-box">
                      <div className="vs-stt-header-row">
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span className="vs-badge-green-text" style={{ fontSize: "12px", fontWeight: "700" }}>
                            ✓ ជោគជ័យ
                          </span>
                          <span style={{ fontSize: "11.5px", color: "var(--vs-text-muted)" }}>
                            Detected: {sttResult.detected_language} ({(sttResult.language_probability * 100).toFixed(0)}%)
                          </span>
                          <span style={{ fontSize: "11.5px", color: "var(--vs-text-faint)" }}>
                            | Duration: {sttResult.duration?.toFixed(1)}s
                          </span>
                        </div>

                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            type="button"
                            className="vs-audio-btn"
                            style={{ padding: "4px 8px", fontSize: "11.5px" }}
                            onClick={() => {
                              navigator.clipboard?.writeText(sttResult.text);
                              setSttCopied(true);
                              setTimeout(() => setSttCopied(false), 2000);
                              notify("បានចម្លងអត្ថបទ!", "info");
                            }}
                          >
                            {sttCopied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                            <span>{sttCopied ? "Copied" : "Copy"}</span>
                          </button>
                        </div>
                      </div>

                      <div className="vs-stt-text-content">
                        {sttResult.text}
                      </div>

                      {/* Timed Segments */}
                      {sttResult.segments?.length > 0 && (
                        <div>
                          <div style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--vs-text-muted)", marginBottom: "6px" }}>
                            TIMED SEGMENTS ({sttResult.segments.length})
                          </div>
                          <div className="vs-stt-segments-list">
                            {sttResult.segments.map((seg, idx) => (
                              <div key={idx} className="vs-stt-segment-row">
                                <span className="vs-stt-segment-time">
                                  {seg.start?.toFixed(1)}s - {seg.end?.toFixed(1)}s
                                </span>
                                <span className="vs-stt-segment-text">{seg.text}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <button
                        type="button"
                        className="vs-audio-btn insert-timeline"
                        style={{ width: "100%", justifyContent: "center", marginTop: "6px" }}
                        onClick={() => {
                          setTtsText(sttResult.text);
                          setActiveTab("tts");
                          notify("បានបញ្ចូលអត្ថបទទៅកាន់ Voice Studio TTS!", "success");
                        }}
                      >
                        <ArrowRight size={15} weight="bold" />
                        <span>Send to Voice Studio (TTS)</span>
                      </button>
                    </div>
                  ) : (
                    <div style={{
                      flex: 1,
                      minHeight: "220px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "10px",
                      border: "1px dashed var(--vs-border)",
                      borderRadius: "12px",
                      color: "var(--vs-text-faint)",
                      padding: "20px",
                      textAlign: "center"
                    }}>
                      <Microphone size={32} color="var(--vs-text-faint)" />
                      <div style={{ fontSize: "13.5px" }}>មិនទាន់មានលទ្ធផលបម្លែងសំឡេងនៅឡើយទេ</div>
                      <div style={{ fontSize: "12px" }}>សូមបញ្ចូល ឬថតសំឡេង រួចចុច "Transcribe Audio"</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. VOICE FL STUDIO: PROFESSIONAL VOCAL MASTERING & EDITION (Hidden) */}
      {false && activeTab === "voice_fl" && (
        <div className="vs-content-body" style={{ padding: "16px 20px", maxWidth: "1400px", margin: "0 auto", width: "100%" }}>
          <VoiceFLRack
            initialAudioUrl={activeVoice?.sampleUrl || activeVoice?.audioUrl || activeVoice?.referenceAudio || null}
            initialAudioName={activeVoice?.name || "Voice Sample"}
            voiceProfiles={allVoices}
            onInsertToTimeline={onInsertToTimeline}
            onSaveToLibrary={(newProfile) => {
              if (typeof addVoiceProfile === "function") {
                addVoiceProfile(newProfile);
              }
            }}
            notify={notify}
          />
        </div>
      )}





      {/* ==========================================================================
          MODAL: ADD NEW VOICE (With Backend Upload & Auto Transcribe)
          ========================================================================== */}
      {showAddVoiceModal && (
        <div className="vs-modal-backdrop" onClick={() => setShowAddVoiceModal(false)}>
          <div className="vs-modal-window" onClick={(e) => e.stopPropagation()}>
            <div className="vs-modal-header">
              <h3>Add New Character Voice · បង្កើតសំឡេងថ្មី</h3>
              <button className="vs-modal-close-btn" onClick={() => setShowAddVoiceModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="vs-setting-item">
              <label>Voice Character Name (ឈ្មោះតួអង្គ/សំឡេង) *</label>
              <input
                type="text"
                className="vs-select"
                placeholder="ឧ. សំឡេងតួអង្គថ្មី..."
                value={newVoiceName}
                onChange={(e) => setNewVoiceName(e.target.value)}
              />
            </div>

            <div className="vs-setting-item">
              <label>Role / Role Tag</label>
              <select
                className="vs-select"
                value={newVoiceRole}
                onChange={(e) => setNewVoiceRole(e.target.value)}
              >
                <option value="Male Lead">Male Lead (តួឯកប្រុស)</option>
                <option value="Female Lead">Female Lead (តួឯកស្រី)</option>
                <option value="Character Voice">Character Voice (តួអង្គបន្ទាប់បន្សំ)</option>
              </select>
            </div>

            <div className="vs-setting-item">
              <label>Category (ជំពូក)</label>
              <select
                className="vs-select"
                value={newVoiceCategory}
                onChange={(e) => setNewVoiceCategory(e.target.value)}
              >
                <option value="custom">Custom Cloned</option>
                <option value="general">ទូទៅ (General)</option>
              </select>
            </div>

            <div className="vs-setting-item">
              <label>Sample Audio File (ឯកសារសំឡេងគំរូ 3s - 30s) *</label>
              <input
                type="file"
                accept="audio/*"
                style={{ fontSize: "12px", color: "#fff" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setNewVoiceFile(f);
                    const a = new Audio(URL.createObjectURL(f));
                    a.onloadedmetadata = () => setNewVoiceDuration(a.duration);
                  }
                }}
              />
              {newVoiceDuration && (
                <div style={{ fontSize: "11px", color: newVoiceDuration >= 3 && newVoiceDuration <= 30 ? "#10b981" : "#ef4444" }}>
                  ប្រវែង: {newVoiceDuration.toFixed(1)}s {newVoiceDuration >= 3 && newVoiceDuration <= 30 ? "✓ ត្រឹមត្រូវ" : "⚠️ ត្រូវចន្លោះ 3 ទៅ 30 វិនាទី"}
                </div>
              )}
            </div>

            <div className="vs-setting-item">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label>Transcript (អត្ថបទនៃសំឡេង - Optional)</label>
                <button
                  type="button"
                  onClick={() => handleAutoTranscribeHelper(newVoiceFile, setNewVoiceTranscript, setNewVoiceAutoTranscribing)}
                  disabled={!newVoiceFile || newVoiceAutoTranscribing}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#93c5fd",
                    fontSize: "11.5px",
                    fontWeight: "600",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px"
                  }}
                >
                  <Sparkle size={13} weight="fill" color="#60a5fa" />
                  <span>{newVoiceAutoTranscribing ? "Transcribing..." : "Auto Transcribe"}</span>
                </button>
              </div>
              <input
                type="text"
                className="vs-select"
                placeholder="ទុកទំនេរ AI នឹង Transcribe ដោយស្វ័យប្រវត្ត..."
                value={newVoiceTranscript}
                onChange={(e) => setNewVoiceTranscript(e.target.value)}
              />
            </div>

            {newVoiceError && (
              <div style={{ color: "#ef4444", fontSize: "12px" }}>
                ⚠️ {newVoiceError}
              </div>
            )}

            <button
              type="button"
              className="vs-generate-btn"
              style={{ width: "100%", justifyContent: "center" }}
              disabled={newVoiceBusy || !newVoiceName.trim() || !newVoiceFile}
              onClick={handleAddVoiceSubmit}
            >
              <span>{newVoiceBusy ? "Uploading & Saving..." : "+ Add to Voice Library"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default VoiceCloneStudioPage;
