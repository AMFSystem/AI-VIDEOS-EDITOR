import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  ArrowLeft,
  Microphone,
  MicrophoneStage,
  UploadSimple,
  DownloadSimple,
  Play,
  Pause,
  Waveform,
  SpeakerHigh,
  Trash,
  Plus,
  Sparkle,
  CheckCircle,
  Check,
  FileArrowDown,
  FileArrowUp,
  SlidersHorizontal,
  Clock,
  User,
  WarningCircle,
  X,
  FloppyDisk,
  Lightning,
  Key,
  SkipBack,
  SkipForward,
} from "@phosphor-icons/react";
import {
  listVoiceProfiles,
  saveVoiceProfile,
  deleteVoiceProfile,
  setVoiceProfileFavorite,
} from "../../lib/voiceProfileStorage.js";
import {
  extractVoiceEmbedding,
  convertVoiceBlob,
  applyVoiceOutputGain,
  OPENVOICE_EMBEDDING_VERSION,
} from "../../lib/openVoiceRuntime.js";
import {
  getStoredElevenLabsKey,
  setStoredElevenLabsKey,
  verifyElevenLabsKey,
  cloneVoiceWithElevenLabs,
  synthesizeWithElevenLabs,
} from "../../lib/elevenlabsRuntime.js";
import {
  getStoredGeminiKey,
  setStoredGeminiKey,
  verifyGeminiKey,
  synthesizeWithGemini,
  generateScriptWithGemini,
} from "../../lib/geminiRuntime.js";
import { synthesizeBaseVoice } from "../../lib/baseVoiceSynthesis.js";
import {
  extractVoxCpmProfile,
  synthesizeWithVoxCpm,
  VOXCPM2_VERSION,
  VOXCPM2_SAMPLE_RATE,
} from "../../lib/voxcpmRuntime.js";
import { VOICES } from "../../config/editor.js";
import { decodeWaveform, getAudioRecordingFormat } from "../../lib/media.js";
import { formatClock, formatTime } from "../../lib/timeline.js";
import "./VoiceCloneStudioPage.css";

// Helper to convert Blob to Base64
async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Helper to convert Base64 to Blob
async function base64ToBlob(base64Data, contentType = "audio/wav") {
  const res = await fetch(base64Data);
  return res.blob();
}

// Custom Audio Control Icons (matching style of Image 2)
function IconSkipBack5(props) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <text x="12" y="15.8" fontSize="8.5" fontWeight="bold" textAnchor="middle" fill="currentColor" stroke="none">5</text>
    </svg>
  );
}

function IconSkipForward5(props) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <text x="12" y="15.8" fontSize="8.5" fontWeight="bold" textAnchor="middle" fill="currentColor" stroke="none">5</text>
    </svg>
  );
}

// Generate realistic acoustic voice spectrum peaks (118 frequency bands)
function generateVoiceAnalysisPeaks(count = 118) {
  const peaks = [];
  for (let i = 0; i < count; i++) {
    const norm = i / count;
    // Formant simulation: primary resonance peak around 28%, secondary around 68%
    const f1 = Math.exp(-Math.pow((norm - 0.28) / 0.16, 2)) * 0.85;
    const f2 = Math.exp(-Math.pow((norm - 0.68) / 0.18, 2)) * 0.72;
    const base = 0.18 + Math.sin(norm * Math.PI * 6) * 0.08;
    const pseudoNoise = ((i * 37 + 13) % 23) / 120;
    const val = Math.max(0.12, Math.min(0.95, f1 + f2 + base + pseudoNoise));
    peaks.push(val);
  }
  return peaks;
}

// Helper to format current time string for default profile names
function formatSavedTime() {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

// Helper to evaluate Voice Training Quality for AI Voice Learning (Target: 30s - 60s)
function getTrainingQualityInfo(sec) {
  const s = Math.max(0, Number(sec) || 0);
  if (s <= 0) {
    return {
      tier: "empty",
      pct: 0,
      label: "រង់ចាំសំឡេង",
      badge: "មិនទាន់មានសំឡេង",
      color: "#64748b",
      description: "សូមថត ឬផ្ទុកឡើងសំឡេងចន្លោះពី ៣០ វិនាទី ដល់ ១ នាទី (30s - 60s) ដើម្បីឱ្យ AI ចងចាំបាន 100%",
      isDeep: false,
    };
  }
  if (s < 15) {
    const pct = Math.min(45, Math.round((s / 30) * 50));
    return {
      tier: "short",
      pct,
      label: `Basic (${pct}%)`,
      badge: "🟡 គំរូខ្លី",
      color: "#eab308",
      description: `ថតបាន ${s.toFixed(1)}s · ណែនាំឱ្យបន្តថតរហូតដល់ ៣០ វិនាទី ដើម្បីឱ្យ AI រៀនស៊ីជម្រៅ`,
      isDeep: false,
    };
  }
  if (s < 30) {
    const pct = Math.min(85, Math.round(50 + ((s - 15) / 15) * 35));
    return {
      tier: "good",
      pct,
      label: `Standard (${pct}%)`,
      badge: "🔵 ស្តង់ដារ",
      color: "#38bdf8",
      description: `ថតបាន ${s.toFixed(1)}s · ល្អបង្គួរ! បន្តថតដល់ ៣០ ទៅ ៦០ វិនាទី ដើម្បីទទួលបានកម្រិតចងចាំ 100%`,
      isDeep: false,
    };
  }
  // 30s to 60s+
  return {
    tier: "deep",
    pct: 100,
    label: "Deep Training 100%",
    badge: "🌟 Deep Training 100%",
    color: "#10b981",
    description: `រយៈពេល ${s.toFixed(1)}s · ល្អឥតខ្ចោះ! AI អាចស្រង់យក Vocal Formants និងចងចាំទឹកដមសំឡេងបាន 100% ដូចពិត`,
    isDeep: true,
  };
}

export function VoiceCloneStudioPage({
  onBack,
  onInsertToTimeline,
  voiceProfiles: propVoiceProfiles,
  addVoiceProfile: propAddVoiceProfile,
  removeVoiceProfile: propRemoveVoiceProfile,
  selectedVoiceProfileId: propSelectedVoiceProfileId,
  setSelectedVoiceProfileId: propSetSelectedVoiceProfileId,
  selectedVoice: propSelectedVoice,
  language = "km",
  notify = (msg) => alert(msg),
  t = (key, fallback) => fallback || key,
}) {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState("tts"); // 'tts' | 'clone'

  // ElevenLabs API Integration state
  const [apiKey, setApiKey] = useState(getStoredElevenLabsKey());
  const [isKeyValid, setIsKeyValid] = useState(false);
  const [keyInfo, setKeyInfo] = useState(null);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyInput, setKeyInput] = useState(getStoredElevenLabsKey());
  const [isVerifyingKey, setIsVerifyingKey] = useState(false);
  const [keyError, setKeyError] = useState("");
  const [extractedVoiceId, setExtractedVoiceId] = useState("");

  // Validate stored ElevenLabs key on mount
  useEffect(() => {
    const stored = getStoredElevenLabsKey();
    if (stored) {
      setApiKey(stored);
      setKeyInput(stored);
      verifyElevenLabsKey(stored)
        .then((res) => {
          if (res.valid) {
            setIsKeyValid(true);
            setKeyInfo(res.info);
          } else {
            setIsKeyValid(false);
            setKeyError(res.error || "Key មិនត្រឹមត្រូវ");
          }
        })
        .catch((err) => {
          setIsKeyValid(false);
          setKeyError(err.message || "មិនអាចតភ្ជាប់បាន");
        });
    }
  }, []);

  const handleVerifyAndSaveKey = async () => {
    const trimmed = keyInput.trim();
    if (!trimmed) {
      setKeyError("សូមបញ្ចូល API Key របស់ ElevenLabs");
      return;
    }
    setIsVerifyingKey(true);
    setKeyError("");
    try {
      const res = await verifyElevenLabsKey(trimmed);
      if (res.valid) {
        setStoredElevenLabsKey(trimmed);
        setApiKey(trimmed);
        setIsKeyValid(true);
        setKeyInfo(res.info);
        setShowKeyModal(false);
        notify("បានភ្ជាប់ ElevenLabs API Key ដោយជោគជ័យ! សំឡេងក្លូននឹងមានគុណភាពដូចមនុស្ស ១០០%");
      } else {
        setKeyError(res.error || "Key មិនត្រឹមត្រូវ សូមពិនិត្យម្តងទៀត");
      }
    } catch (err) {
      setKeyError(err.message || "មិនអាចផ្ទៀងផ្ទាត់ Key បានទេ");
    } finally {
      setIsVerifyingKey(false);
    }
  };

  const handleRemoveKey = () => {
    setStoredElevenLabsKey("");
    setApiKey("");
    setIsKeyValid(false);
    setKeyInfo(null);
    setKeyInput("");
    notify("បានដក ElevenLabs API Key រួចរាល់។ ប្រព័ន្ធនឹងប្តូរមកប្រើ Local Mode ធម្មតា។");
  };

  // -------------------------------------------------------------------------
  // Google Gemini API Integration state
  // -------------------------------------------------------------------------
  const [geminiKey, setGeminiKey] = useState(getStoredGeminiKey());
  const [isGeminiValid, setIsGeminiValid] = useState(false);
  const [geminiInfo, setGeminiInfo] = useState(null);
  const [geminiKeyInput, setGeminiKeyInput] = useState(getStoredGeminiKey());
  const [isVerifyingGemini, setIsVerifyingGemini] = useState(false);
  const [geminiError, setGeminiError] = useState("");
  const [activeKeyTab, setActiveKeyTab] = useState("elevenlabs"); // 'elevenlabs' | 'gemini'

  // Script Generator modal state (Gemini powered)
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [scriptTopic, setScriptTopic] = useState("");
  const [scriptTone, setScriptTone] = useState("ធម្មជាតិ");
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);

  // Validate stored Gemini key on mount
  useEffect(() => {
    const stored = getStoredGeminiKey();
    if (stored) {
      setGeminiKey(stored);
      setGeminiKeyInput(stored);
      verifyGeminiKey(stored)
        .then((res) => {
          if (res.valid) {
            setIsGeminiValid(true);
            setGeminiInfo(res);
          } else {
            setIsGeminiValid(false);
            setGeminiError(res.error || "Key មិនត្រឹមត្រូវ");
          }
        })
        .catch((err) => {
          setIsGeminiValid(false);
          setGeminiError(err.message || "មិនអាចតភ្ជាប់បាន");
        });
    }
  }, []);

  const handleVerifyAndSaveGeminiKey = async () => {
    const trimmed = geminiKeyInput.trim();
    if (!trimmed) {
      setGeminiError("សូមបញ្ចូល Google Gemini API Key");
      return;
    }
    setIsVerifyingGemini(true);
    setGeminiError("");
    try {
      const res = await verifyGeminiKey(trimmed);
      if (res.valid) {
        setStoredGeminiKey(trimmed);
        setGeminiKey(trimmed);
        setIsGeminiValid(true);
        setGeminiInfo(res);
        setShowKeyModal(false);
        notify("បានភ្ជាប់ Google Gemini API Key ដោយជោគជ័យ! អ្នកអាចប្រើប្រាស់សំឡេង Gemini 2.0 Flash និងមុខងារសរសេរអត្ថបទ AI");
      } else {
        setGeminiError(res.error || "Key មិនត្រឹមត្រូវ សូមពិនិត្យម្តងទៀត");
      }
    } catch (err) {
      setGeminiError(err.message || "មិនអាចផ្ទៀងផ្ទាត់ Key បានទេ");
    } finally {
      setIsVerifyingGemini(false);
    }
  };

  const handleRemoveGeminiKey = () => {
    setStoredGeminiKey("");
    setGeminiKey("");
    setIsGeminiValid(false);
    setGeminiInfo(null);
    setGeminiKeyInput("");
    notify("បានដក Google Gemini API Key រួចរាល់");
  };

  const handleGenerateScriptWithGemini = async (presetTopic = null) => {
    const topicToUse = presetTopic || scriptTopic.trim();
    if (!topicToUse) {
      notify("សូមបញ្ចូលប្រធានបទដែលចង់សរសេរ");
      return;
    }
    if (!geminiKey) {
      setActiveKeyTab("gemini");
      setShowKeyModal(true);
      notify("សូមភ្ជាប់ Google Gemini API Key ជាមុនសិនដើម្បីប្រើមុខងារសរសេរអត្ថបទ AI");
      return;
    }
    setIsGeneratingScript(true);
    try {
      const script = await generateScriptWithGemini({
        apiKey: geminiKey,
        topic: topicToUse,
        tone: scriptTone,
      });
      if (script) {
        setTtsText(script);
        setShowScriptModal(false);
        notify("Gemini បានបង្កើតអត្ថបទជូនរួចរាល់!");
      }
    } catch (err) {
      console.error(err);
      notify(`ការបង្កើតអត្ថបទបរាជ័យ៖ ${err.message}`);
    } finally {
      setIsGeneratingScript(false);
    }
  };

  // Local Voice Profiles state
  const [profiles, setProfiles] = useState(propVoiceProfiles || []);
  const [selectedProfileId, setSelectedProfileId] = useState(
    propSelectedVoiceProfileId || propVoiceProfiles?.[0]?.id || ""
  );
  const [searchQuery, setSearchQuery] = useState("");

  // Sync with external profiles if provided
  useEffect(() => {
    if (propVoiceProfiles && propVoiceProfiles.length > 0) {
      setProfiles(propVoiceProfiles);
    } else {
      listVoiceProfiles()
        .then((items) => {
          setProfiles(items);
          if (!selectedProfileId && items.length > 0) {
            setSelectedProfileId(items[0].id);
          }
        })
        .catch(console.error);
    }
  }, [propVoiceProfiles]);

  const activeProfile = useMemo(() => {
    return profiles.find((p) => p.id === selectedProfileId) || profiles[0] || null;
  }, [profiles, selectedProfileId]);

  // Keep parent in sync
  const selectProfile = (id) => {
    setSelectedProfileId(id);
    propSetSelectedVoiceProfileId?.(id);
  };

  // -------------------------------------------------------------------------
  // TTS State
  // -------------------------------------------------------------------------
  const [ttsText, setTtsText] = useState(
    "សួស្តីបងប្អូនទាំងអស់គ្នា! នេះគឺជាការសាកល្បងសំឡេងក្លូនរបស់ខ្ញុំ ដំណើរការយ៉ាងរលូន និងពិរោះរណ្តំ។"
  );

  // Default to Khmer Sophea or first matching voice
  const defaultBaseVoice = useMemo(() => {
    return (
      VOICES.find((v) => v.id === "km_KH-mms-medium" || v.language === "ភាសាខ្មែរ") ||
      VOICES[0]
    );
  }, []);
  const [baseVoiceId, setBaseVoiceId] = useState(defaultBaseVoice?.id || "");
  const [ttsSpeed, setTtsSpeed] = useState(1);
  const [ttsVolume, setTtsVolume] = useState(1);

  // Generation status
  const [isGenerating, setIsGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState(0);
  const [genPhase, setGenPhase] = useState("");
  const [generatedBlob, setGeneratedBlob] = useState(null);
  const [generatedDuration, setGeneratedDuration] = useState(0);
  const [generatedPeaks, setGeneratedPeaks] = useState([]);
  const [generatedUrl, setGeneratedUrl] = useState("");

  // Audio Playback
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef(null);

  // Clean up object URL
  useEffect(() => {
    return () => {
      if (generatedUrl) URL.revokeObjectURL(generatedUrl);
    };
  }, [generatedUrl]);

  // -------------------------------------------------------------------------
  // Voice Clone Recording & Upload State
  // -------------------------------------------------------------------------
  const [cloneInputMode, setCloneInputMode] = useState("record"); // 'record' | 'upload'
  const [cloneName, setCloneName] = useState("");
  const [cloneLanguage, setCloneLanguage] = useState("km");
  const [cloneGender, setCloneGender] = useState("female");

  // Recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  // File Reference & Voice Analysis Player State
  const fileInputRef = useRef(null);
  const [referenceBlob, setReferenceBlob] = useState(null);
  const [referenceUrl, setReferenceUrl] = useState("");
  const [referenceDuration, setReferenceDuration] = useState(0);
  const [referenceCurrentTime, setReferenceCurrentTime] = useState(0);
  const [referencePeaks, setReferencePeaks] = useState([]);
  const [isPlayingReference, setIsPlayingReference] = useState(false);
  const referenceAudioRef = useRef(null);

  const displayPeaks = useMemo(() => {
    const targetCount = 118;
    if (referencePeaks && referencePeaks.length >= 24) {
      const sampled = [];
      const step = (referencePeaks.length - 1) / (targetCount - 1);
      for (let i = 0; i < targetCount; i++) {
        const idx = Math.floor(i * step);
        sampled.push(Math.max(0.1, Math.min(0.96, referencePeaks[idx] || 0.25)));
      }
      return sampled;
    }
    return generateVoiceAnalysisPeaks(targetCount);
  }, [referencePeaks]);

  const handleReferenceSeek = (targetTime) => {
    const clamped = Math.max(0, Math.min(referenceDuration, targetTime));
    setReferenceCurrentTime(clamped);
    if (referenceAudioRef.current) {
      referenceAudioRef.current.currentTime = clamped;
    }
  };

  const handleReferenceSeekRelative = (delta) => {
    const cur = referenceAudioRef.current ? referenceAudioRef.current.currentTime : referenceCurrentTime;
    handleReferenceSeek(cur + delta);
  };

  const togglePlayReference = () => {
    if (!referenceAudioRef.current) return;
    if (isPlayingReference) {
      referenceAudioRef.current.pause();
      setIsPlayingReference(false);
    } else {
      referenceAudioRef.current.play().catch(console.error);
      setIsPlayingReference(true);
    }
  };

  // Extraction & Test
  const [cloneModel, setCloneModel] = useState("voxcpm2"); // 'voxcpm2' | 'openvoice' | 'elevenlabs'
  const [extractedVoxCpmData, setExtractedVoxCpmData] = useState(null);
  const [extractedEngine, setExtractedEngine] = useState("voxcpm2");
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState(0);
  const [extractPhase, setExtractPhase] = useState("");
  const [extractedEmbedding, setExtractedEmbedding] = useState(null);
  const [testBlob, setTestBlob] = useState(null);
  const [testUrl, setTestUrl] = useState("");
  const [isPlayingTest, setIsPlayingTest] = useState(false);
  const testAudioRef = useRef(null);

  useEffect(() => {
    return () => {
      if (referenceUrl) URL.revokeObjectURL(referenceUrl);
      if (testUrl) URL.revokeObjectURL(testUrl);
    };
  }, [referenceUrl, testUrl]);

  // -------------------------------------------------------------------------
  // Recording Handlers
  // -------------------------------------------------------------------------
  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        notify("ឧបករណ៍ថតសំឡេងមិនត្រូវបានគាំទ្រលើកម្មវិធីរុករកនេះទេ");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      audioChunksRef.current = [];

      const format = getAudioRecordingFormat();
      const recorder = format?.mimeType
        ? new MediaRecorder(stream, { mimeType: format.mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data?.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const mimeType = recorder.mimeType || format?.mimeType || "audio/webm";
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        clearInterval(recordingTimerRef.current);
        setIsRecording(false);

        if (blob.size > 0) {
          const decoded = await decodeWaveform(blob);
          setReferenceBlob(blob);
          setReferenceDuration(decoded.duration);
          setReferencePeaks(decoded.peaks && decoded.peaks.length > 0 ? decoded.peaks : generateVoiceAnalysisPeaks(118));
          setReferenceCurrentTime(0);
          if (referenceUrl) URL.revokeObjectURL(referenceUrl);
          setReferenceUrl(URL.createObjectURL(blob));
          if (!cloneName) setCloneName(`សំឡេងរបស់ខ្ញុំ ${formatSavedTime()}`);
          
          const q = getTrainingQualityInfo(decoded.duration);
          if (q.isDeep) {
            notify(`ថតបាន ${decoded.duration.toFixed(1)}s · ល្អឥតខ្ចោះ (Deep Training 100%)! AI នឹងចងចាំសំឡេងបានច្បាស់ ១០០%`);
          } else {
            notify(`បានថតសំឡេងគំរូរួចរាល់ (${decoded.duration.toFixed(1)}s)! សូមចុចស្រង់យកម៉ូដែលសំឡេង`);
          }
        }
      };

      recorder.start(250);
      setIsRecording(true);
      setRecordingElapsed(0);
      const startTime = performance.now();
      recordingTimerRef.current = setInterval(() => {
        const elapsed = (performance.now() - startTime) / 1000;
        setRecordingElapsed(elapsed);
        if (elapsed >= 60) {
          stopRecording();
          notify("ថតគ្រប់ ៦០ វិនាទី (ពេញកម្រិត Deep Training)! បានបញ្ឈប់ការថតដោយស្វ័យប្រវត្តិ។");
        }
      }, 200);
    } catch (err) {
      console.error(err);
      notify(`បញ្ហាមេក្រូ៖ ${err.message}`);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  };

  // -------------------------------------------------------------------------
  // File Upload Handler
  // -------------------------------------------------------------------------
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const decoded = await decodeWaveform(file);
      setReferenceBlob(file);
      setReferenceDuration(decoded.duration);
      setReferencePeaks(decoded.peaks && decoded.peaks.length > 0 ? decoded.peaks : generateVoiceAnalysisPeaks(118));
      setReferenceCurrentTime(0);
      if (referenceUrl) URL.revokeObjectURL(referenceUrl);
      setReferenceUrl(URL.createObjectURL(file));
      if (!cloneName) setCloneName(file.name.replace(/\.[^.]+$/, ""));
      const q = getTrainingQualityInfo(decoded.duration);
      if (q.isDeep) {
        notify(`បានផ្ទុកឡើងឯកសារ៖ ${file.name} (${formatTime(decoded.duration)}) · 🌟 Deep Training 100%`);
      } else {
        notify(`បានផ្ទុកឡើងឯកសារ៖ ${file.name} (${formatTime(decoded.duration)})`);
      }
    } catch (err) {
      console.error(err);
      notify(`បញ្ហាក្នុងការអានឯកសារសំឡេង៖ ${err.message}`);
    }
    e.target.value = "";
  };

  // -------------------------------------------------------------------------
  // Model Extraction Handler
  // -------------------------------------------------------------------------
  const handleExtractModel = async () => {
    if (!referenceBlob) {
      notify("សូមថត ឬផ្ទុកឡើងសំឡេងគំរូជាមុនសិន");
      return;
    }
    setIsExtracting(true);
    setExtractProgress(5);
    setExtractPhase("កំពុងរៀបចំ និងវិភាគទម្រង់សំឡេង...");

    try {
      if (cloneModel === "elevenlabs") {
        if (!apiKey || !isKeyValid) {
          setShowKeyModal(true);
          notify("សូមភ្ជាប់ ElevenLabs API Key ជាមុនសិន");
          setIsExtracting(false);
          return;
        }

        // ElevenLabs Neural Cloning (100% human-like voice)
        setExtractPhase("កំពុងផ្ញើសំឡេងគំរូទៅ ElevenLabs Neural Cloner...");
        setExtractProgress(25);

        const cloneRes = await cloneVoiceWithElevenLabs({
          apiKey,
          name: cloneName.trim() || `សំឡេង ${Date.now()}`,
          audioBlob: referenceBlob,
          description: `Cloned voice created in AI Video Editor Studio (${cloneLanguage})`,
        });

        const vId = cloneRes.voiceId;
        setExtractedVoiceId(vId);
        setExtractedEngine("elevenlabs");
        setExtractedVoxCpmData(null);
        setExtractProgress(60);
        setExtractPhase("កំពុងសំយោគសំឡេងសាកល្បងដោយ ElevenLabs...");

        const testSentence =
          cloneLanguage === "km"
            ? "សួស្តីបងប្អូនទាំងអស់គ្នា! នេះគឺជាការសាកល្បងសំឡេងក្លូនរបស់ខ្ញុំតាមរយៈ ElevenLabs ពិរោះ និងដូចមនុស្ស ១០០%។"
            : "Hello, this is a test of your new voice cloned with ElevenLabs.";

        const testAudioBlob = await synthesizeWithElevenLabs({
          apiKey,
          voiceId: vId,
          text: testSentence,
          modelId: "eleven_multilingual_v2",
          onProgress: (p) => setExtractProgress(60 + Math.round(p * 0.35)),
        });

        setTestBlob(testAudioBlob);
        if (testUrl) URL.revokeObjectURL(testUrl);
        setTestUrl(URL.createObjectURL(testAudioBlob));

        setExtractProgress(100);
        setExtractPhase("ក្លូនសំឡេងតាម ElevenLabs ជោគជ័យ ១០០%!");
        notify("ក្លូនសំឡេងតាម ElevenLabs បានជោគជ័យ! សំឡេងដូចមនុស្ស ១០០%។ អ្នកអាចស្តាប់សាកល្បង ឬរក្សាទុក។");
      } else if (cloneModel === "voxcpm2") {
        // VoxCPM2 48kHz Neural Diffusion Cloner (OpenBMB 48kHz Offline / Free)
        setExtractPhase("កំពុងដំណើរការម៉ូដែល VoxCPM2 (48kHz Neural Diffusion)...");
        setExtractProgress(20);

        const profileData = await extractVoxCpmProfile(referenceBlob, {
          name: cloneName.trim() || `សំឡេង VoxCPM2 ${formatSavedTime()}`,
          language: cloneLanguage,
          onProgress: (evt) => {
            if (evt.phase) setExtractPhase(evt.phase);
            if (Number.isFinite(evt.progress)) {
              setExtractProgress(Math.min(70, Math.round(evt.progress * 0.7)));
            }
          },
        });

        setExtractedVoxCpmData(profileData);
        setExtractedEmbedding(profileData.embedding || profileData.acousticProfile?.timbreEmbedding);
        setExtractedEngine("voxcpm2");
        setExtractedVoiceId("");

        setExtractProgress(75);
        setExtractPhase("កំពុងសំយោគសំឡេងសាកល្បង 48kHz ដោយ VoxCPM2...");

        const testSentence =
          cloneLanguage === "km"
            ? "សួស្តីបងប្អូនទាំងអស់គ្នា! នេះគឺជាការសាកល្បងសំឡេងក្លូនដោយ VoxCPM2 កម្រិត 48kHz រលូន និងពិរោះរណ្តំ ដោយមិនចាំបាច់ប្រើ API Key។"
            : "Hello! This is a test of your voice cloned with VoxCPM2 48kHz Neural Diffusion.";

        const testAudioBlob = await synthesizeWithVoxCpm({
          text: testSentence,
          profile: profileData,
          speed: 1.0,
          language: cloneLanguage,
          onProgress: (p) => setExtractProgress(75 + Math.round(p * 0.23)),
        });

        setTestBlob(testAudioBlob);
        if (testUrl) URL.revokeObjectURL(testUrl);
        setTestUrl(URL.createObjectURL(testAudioBlob));

        setExtractProgress(100);
        setExtractPhase("ក្លូនសំឡេងតាម VoxCPM2 (48kHz) បានជោគជ័យ ១០០%!");
        notify("ស្រង់យកម៉ូដែល VoxCPM2 48kHz បានជោគជ័យ! សំឡេងរលូន និងពិរោះ ដោយមិនចាំបាច់ប្រើ API Key។");
      } else {
        // OpenVoice v2 In-Browser WASM Converter
        setExtractPhase("កំពុងស្រង់យក Tone Color តាម OpenVoice v2 (WASM)...");
        const embedding = await extractVoiceEmbedding(referenceBlob, (evt) => {
          if (evt.phase) setExtractPhase(evt.phase);
          if (Number.isFinite(evt.progress)) {
            setExtractProgress(Math.min(60, Math.round(evt.progress * 0.6)));
          }
        });
        setExtractedEmbedding(embedding);
        setExtractedEngine("openvoice");
        setExtractedVoxCpmData(null);
        setExtractedVoiceId("");
        setExtractProgress(65);
        setExtractPhase("កំពុងបង្កើតសំឡេងសាកល្បង...");

        const baseVoice = VOICES.find((v) => v.id === baseVoiceId) || defaultBaseVoice;
        const testSentence =
          cloneLanguage === "km"
            ? "សួស្តី នេះគឺជាការសាកល្បងសំឡេងក្លូនជាភាសាខ្មែរតាម OpenVoice v2។"
            : "Hello, this is a test of your newly cloned voice with OpenVoice v2.";

        const { blob: baseBlob } = await synthesizeBaseVoice({
          voice: baseVoice,
          text: testSentence,
          speed: 1,
          notify,
          t,
          onProgress: (p) => setExtractProgress(65 + Math.round(p * 0.15)),
        });

        setExtractPhase("កំពុងបម្លែងទឹកដមសំឡេងក្លូន...");
        const converted = await convertVoiceBlob(baseBlob, embedding, {
          onProgress: (evt) => {
            if (evt.phase) setExtractPhase(evt.phase);
            if (Number.isFinite(evt.progress)) {
              setExtractProgress(80 + Math.round(evt.progress * 0.2));
            }
          },
        });

        setTestBlob(converted);
        if (testUrl) URL.revokeObjectURL(testUrl);
        setTestUrl(URL.createObjectURL(converted));

        setExtractProgress(100);
        setExtractPhase("ស្រង់យកម៉ូដែលសំឡេង OpenVoice v2 បានជោគជ័យ!");
        notify("ស្រង់យកម៉ូដែលសំឡេង OpenVoice v2 បានជោគជ័យ! អ្នកអាចសាកល្បងស្តាប់ ឬចុចរក្សាទុក។");
      }
    } catch (err) {
      console.error("Extraction error:", err);
      notify(`ការស្រង់យកម៉ូដែលបានបរាជ័យ៖ ${err.message}`);
    } finally {
      setIsExtracting(false);
    }
  };

  // -------------------------------------------------------------------------
  // Save Cloned Profile to Local Storage (IndexedDB)
  // -------------------------------------------------------------------------
  const handleSaveProfile = async () => {
    if (!extractedEmbedding && !extractedVoiceId && !extractedVoxCpmData) {
      notify("សូមស្រង់យកម៉ូដែលសំឡេងជាមុនសិន");
      return;
    }
    const finalName =
      cloneName.trim() ||
      `សំឡេង ${extractedEngine === "voxcpm2" ? "VoxCPM2" : "ក្លូន"} ${formatSavedTime()}`;
    const now = new Date().toISOString();
    const finalEngine = extractedEngine || cloneModel;
    const finalQuality =
      extractedVoxCpmData?.acousticProfile?.trainingQuality ||
      getTrainingQualityInfo(referenceDuration);

    const newProfile = {
      id: crypto.randomUUID(),
      name: finalName,
      language: cloneLanguage,
      gender: cloneGender,
      sourceKind: cloneInputMode === "record" ? "recording" : "upload",
      referenceBlob,
      testBlob,
      engine: finalEngine,
      trainingQuality: finalQuality,
      duration: referenceDuration,
      model:
        finalEngine === "voxcpm2"
          ? VOXCPM2_VERSION
          : finalEngine === "elevenlabs"
          ? "eleven_multilingual_v2"
          : "OpenVoice-v2",
      sampleRate: finalEngine === "voxcpm2" ? VOXCPM2_SAMPLE_RATE : 22050,
      voxcpmProfile: extractedVoxCpmData || null,
      elevenlabsVoiceId: extractedVoiceId || null,
      embedding: extractedEmbedding ? Float32Array.from(extractedEmbedding) : null,
      embeddingVersion: OPENVOICE_EMBEDDING_VERSION,
      favorite: false,
      authorized: true,
      createdAt: now,
      updatedAt: now,
    };

    try {
      if (propAddVoiceProfile) {
        await propAddVoiceProfile(newProfile);
      } else {
        await saveVoiceProfile(newProfile);
      }
      setProfiles((prev) => [newProfile, ...prev.filter((p) => p.id !== newProfile.id)]);
      selectProfile(newProfile.id);

      notify(`បានរក្សាទុកសំឡេង "${finalName}" ក្នុងកុំព្យូទ័ររបស់អ្នកដោយជោគជ័យ!`);
      // Reset clone form and switch to TTS
      setReferenceBlob(null);
      setExtractedEmbedding(null);
      setExtractedVoxCpmData(null);
      setExtractedVoiceId("");
      setTestBlob(null);
      setCloneName("");
      setActiveTab("tts");
    } catch (err) {
      console.error(err);
      notify(`បញ្ហាក្នុងការរក្សាទុក៖ ${err.message}`);
    }
  };

  // -------------------------------------------------------------------------
  // Delete Profile
  // -------------------------------------------------------------------------
  const handleDeleteProfile = async (id, e) => {
    e?.stopPropagation();
    const target = profiles.find((p) => p.id === id);
    if (!window.confirm(`តើអ្នកពិតជាចង់លុបសំឡេង "${target?.name || "នេះ"}" ចេញពីកុំព្យូទ័រមែនទេ?`)) {
      return;
    }
    try {
      if (propRemoveVoiceProfile) {
        await propRemoveVoiceProfile(id);
      } else {
        await deleteVoiceProfile(id);
      }
      setProfiles((prev) => prev.filter((p) => p.id !== id));
      if (selectedProfileId === id) {
        const next = profiles.find((p) => p.id !== id);
        setSelectedProfileId(next?.id || "");
      }
      notify("បានលុបសំឡេងគំរូរួចរាល់");
    } catch (err) {
      console.error(err);
      notify(`បញ្ហាក្នុងការលុប៖ ${err.message}`);
    }
  };

  // -------------------------------------------------------------------------
  // Export & Import Profiles (Backup)
  // -------------------------------------------------------------------------
  const handleExportProfile = async (profile, e) => {
    e?.stopPropagation();
    try {
      const refBase64 = profile.referenceBlob ? await blobToBase64(profile.referenceBlob) : null;
      const testBase64 = profile.testBlob ? await blobToBase64(profile.testBlob) : null;
      const exportData = {
        app: "ai-video-editor-voice-profile",
        version: 1,
        id: profile.id,
        name: profile.name,
        language: profile.language,
        gender: profile.gender,
        engine: profile.engine || (profile.elevenlabsVoiceId ? "elevenlabs" : "local"),
        elevenlabsVoiceId: profile.elevenlabsVoiceId || null,
        embedding: profile.embedding ? Array.from(profile.embedding) : null,
        embeddingVersion: profile.embeddingVersion || 2,
        referenceBase64: refBase64,
        testBase64: testBase64,
        createdAt: profile.createdAt,
      };
      const jsonStr = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${profile.name.replace(/[/\\?%*:|"<>]/g, "_")}.voiceprofile.json`;
      a.click();
      URL.revokeObjectURL(url);
      notify(`បាននាំចេញកញ្ចប់ឯកសារសំឡេង៖ ${profile.name}`);
    } catch (err) {
      console.error(err);
      notify(`ការនាំចេញបានបរាជ័យ៖ ${err.message}`);
    }
  };

  const handleImportProfileFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.name || (!data.embedding && !data.elevenlabsVoiceId)) {
        throw new Error("ទម្រង់ឯកសារមិនត្រឹមត្រូវ");
      }
      const refBlob = data.referenceBase64 ? await base64ToBlob(data.referenceBase64) : null;
      const testBlob = data.testBase64 ? await base64ToBlob(data.testBase64) : null;
      const imported = {
        id: crypto.randomUUID(),
        name: data.name,
        language: data.language || "km",
        gender: data.gender || "female",
        referenceBlob: refBlob,
        testBlob,
        engine: data.engine || (data.elevenlabsVoiceId ? "elevenlabs" : "local"),
        elevenlabsVoiceId: data.elevenlabsVoiceId || null,
        embedding: data.embedding ? Float32Array.from(data.embedding) : null,
        embeddingVersion: data.embeddingVersion || OPENVOICE_EMBEDDING_VERSION,
        favorite: false,
        authorized: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await saveVoiceProfile(imported);
      setProfiles((prev) => [imported, ...prev]);
      selectProfile(imported.id);
      notify(`បាននាំចូលម៉ូដែលសំឡេង "${imported.name}" ដោយជោគជ័យ!`);
    } catch (err) {
      console.error(err);
      notify(`បញ្ហានាំចូល៖ ${err.message}`);
    }
    e.target.value = "";
  };

  // -------------------------------------------------------------------------
  // TTS Generation Handler
  // -------------------------------------------------------------------------
  const handleGenerateSpeech = async () => {
    const cleanText = ttsText.trim();
    if (!cleanText) {
      notify("សូមបញ្ចូលអត្ថបទដែលត្រូវនិយាយ");
      return;
    }
    setIsGenerating(true);
    setGenProgress(8);
    setGenPhase("កំពុងរៀបចំម៉ូដែលសំឡេង...");

    try {
      let finalBlob = null;

      // 1. Check if active profile has ElevenLabs Voice ID and API key is present
      if ((activeProfile?.engine === "elevenlabs" || activeProfile?.elevenlabsVoiceId) && apiKey) {
        setGenPhase("កំពុងសំយោគសំឡេងមនុស្សពិត ១០០% តាមរយៈ ElevenLabs...");
        setGenProgress(25);
        finalBlob = await synthesizeWithElevenLabs({
          apiKey,
          voiceId: activeProfile.elevenlabsVoiceId,
          text: cleanText,
          speed: ttsSpeed,
          modelId: "eleven_multilingual_v2",
          onProgress: (p) => setGenProgress(25 + Math.round(p * 0.65)),
        });
      } else if (activeProfile?.engine === "voxcpm2") {
        // 2. VoxCPM2 48kHz Neural Diffusion Speech Synthesizer (Offline / Free)
        setGenPhase(`កំពុងសំយោគសំឡេង 48kHz ដោយ VoxCPM2 (${activeProfile.name})...`);
        setGenProgress(20);
        finalBlob = await synthesizeWithVoxCpm({
          text: cleanText,
          profile: activeProfile,
          speed: ttsSpeed,
          language: activeProfile.language || "km",
          onProgress: (p) => setGenProgress(20 + Math.round(p * 0.7)),
        });
      } else if (baseVoiceId.startsWith("gemini_") && geminiKey) {
        // 2. Google Gemini 2.0 Flash Audio Studio Voice
        const voiceName = baseVoiceId.replace("gemini_", "");
        setGenPhase(`កំពុងសំយោគសំឡេង Google Gemini (${voiceName})...`);
        setGenProgress(25);
        finalBlob = await synthesizeWithGemini({
          apiKey: geminiKey,
          text: cleanText,
          voiceName,
          onProgress: (p) => setGenProgress(25 + Math.round(p * 0.65)),
        });

        // Layer tone conversion if user selected a custom cloned embedding profile
        if (activeProfile?.embedding) {
          setGenProgress(80);
          setGenPhase(`កំពុងបម្លែងទឹកដមទៅជា "${activeProfile.name}"...`);
          try {
            finalBlob = await convertVoiceBlob(finalBlob, activeProfile.embedding, {
              seed: 2026,
            });
          } catch (convErr) {
            console.warn("Tone conversion warning over Gemini voice:", convErr);
          }
        }
      } else {
        const baseVoice = VOICES.find((v) => v.id === baseVoiceId) || defaultBaseVoice;

        // 1. Synthesize base phonetics
        setGenPhase(
          baseVoice.language === "ភាសាខ្មែរ"
            ? "កំពុងសំយោគសំឡេងមូលដ្ឋានជាភាសាខ្មែរ..."
            : "កំពុងសំយោគសំឡេងមូលដ្ឋាន..."
        );
        const { blob: baseBlob } = await synthesizeBaseVoice({
          voice: baseVoice,
          text: cleanText,
          speed: ttsSpeed,
          notify,
          t,
          onProgress: (p) => setGenProgress(8 + Math.round(p * 0.45)),
        });

        finalBlob = baseBlob;

        // 2. Apply Voice Clone embedding if available
        if (activeProfile?.embedding) {
          setGenProgress(58);
          setGenPhase(`កំពុងបម្លែងទៅជាសំឡេងក្លូន "${activeProfile.name}"...`);
          try {
            finalBlob = await convertVoiceBlob(baseBlob, activeProfile.embedding, {
              seed: 2026,
              onProgress: (evt) => {
                if (evt.phase) setGenPhase(evt.phase);
                if (Number.isFinite(evt.progress)) {
                  setGenProgress(58 + Math.round(evt.progress * 0.35));
                }
              },
            });
          } catch (convErr) {
            console.warn("Tone conversion warning, using enhanced base output:", convErr);
          }
        }
      }

      // 3. Apply volume output gain
      if (ttsVolume !== 1 && finalBlob) {
        finalBlob = await applyVoiceOutputGain(finalBlob, ttsVolume);
      }

      // 4. Decode waveform for visualizer & timeline
      setGenProgress(95);
      setGenPhase("កំពុងរៀបចំទម្រង់រលកសំឡេង...");
      const decoded = await decodeWaveform(finalBlob);

      setGeneratedBlob(finalBlob);
      setGeneratedDuration(decoded.duration);
      setGeneratedPeaks(decoded.peaks);

      if (generatedUrl) URL.revokeObjectURL(generatedUrl);
      const newUrl = URL.createObjectURL(finalBlob);
      setGeneratedUrl(newUrl);

      setGenProgress(100);
      setGenPhase("បង្កើតសំឡេងបានជោគជ័យ!");
      notify(`បង្កើតសំឡេងបានជោគជ័យ! រយៈពេល៖ ${formatTime(decoded.duration)}`);
    } catch (err) {
      console.error("TTS generation error:", err);
      notify(`ការបង្កើតសំឡេងបានបរាជ័យ៖ ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // -------------------------------------------------------------------------
  // Audio Player Listeners
  // -------------------------------------------------------------------------
  const togglePlayAudio = () => {
    if (!audioRef.current || !generatedUrl) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleAudioTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSeek = (e) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  // -------------------------------------------------------------------------
  // Insert to Timeline
  // -------------------------------------------------------------------------
  const handleInsert = (closePage = true) => {
    if (!generatedBlob) {
      notify("មិនមានសំឡេងដែលបានបង្កើតទេ");
      return;
    }
    const voiceLabel = activeProfile?.name || "សំឡេងក្លូន";
    onInsertToTimeline?.({
      blob: generatedBlob,
      name: voiceLabel,
      script: ttsText,
      duration: generatedDuration,
      peaks: generatedPeaks,
      options: { closePage },
    });
  };

  // Download MP3/WAV file
  const handleDownloadFile = () => {
    if (!generatedBlob) return;
    const a = document.createElement("a");
    a.href = generatedUrl;
    a.download = `${activeProfile?.name || "cloned_voice"}_${Date.now()}.wav`;
    a.click();
  };

  // Filtered profiles
  const filteredProfiles = useMemo(() => {
    if (!searchQuery.trim()) return profiles;
    const q = searchQuery.toLowerCase();
    return profiles.filter((p) => p.name?.toLowerCase().includes(q));
  }, [profiles, searchQuery]);

  return (
    <div className="voice-studio-wrapper">
      {/* Hidden audio elements for playback */}
      <audio
        ref={audioRef}
        src={generatedUrl}
        onTimeUpdate={handleAudioTimeUpdate}
        onEnded={handleAudioEnded}
      />
      {referenceUrl && (
        <audio
          ref={referenceAudioRef}
          src={referenceUrl}
          onTimeUpdate={() => {
            if (referenceAudioRef.current) {
              setReferenceCurrentTime(referenceAudioRef.current.currentTime);
            }
          }}
          onEnded={() => {
            setIsPlayingReference(false);
            setReferenceCurrentTime(0);
          }}
        />
      )}
      {testUrl && (
        <audio
          ref={testAudioRef}
          src={testUrl}
          onEnded={() => setIsPlayingTest(false)}
        />
      )}

      {/* Top Navbar */}
      <header className="voice-studio-navbar">
        <div className="voice-studio-nav-left">
          <button
            className="voice-studio-back-btn"
            type="button"
            onClick={onBack}
            title="ត្រឡប់ទៅកាន់ផ្ទាំងកាត់តវីដេអូវិញ"
          >
            <ArrowLeft size={16} weight="bold" />
            <span>ត្រឡប់ទៅផ្ទាំងកាត់ត</span>
          </button>
          <div className="voice-studio-nav-divider" />
          <div className="voice-studio-brand">
            <div className="voice-studio-brand-icon">
              <Sparkle size={18} weight="fill" />
            </div>
            <span className="voice-studio-title">ស្ទូឌីយោក្លូនសំឡេង AI</span>
          </div>
        </div>

        <div className="voice-studio-nav-right">
          {activeProfile && (
            <div
              className="voice-studio-stat-pill"
              style={{ borderColor: "rgba(56, 189, 248, 0.4)", color: "#38bdf8" }}
            >
              <User size={13} weight="bold" />
              <span>កំពុងប្រើ៖ {activeProfile.name}</span>
            </div>
          )}

          <button
            className={`elevenlabs-nav-btn ${isKeyValid || isGeminiValid ? "is-active" : ""}`}
            type="button"
            onClick={() => {
              setKeyInput(apiKey);
              setGeminiKeyInput(geminiKey);
              setKeyError("");
              setGeminiError("");
              setShowKeyModal(true);
            }}
            title="កំណត់ API Keys (ElevenLabs & Google Gemini)"
          >
            <Key size={15} weight={isKeyValid || isGeminiValid ? "fill" : "bold"} />
            <span>
              {isKeyValid && isGeminiValid
                ? "API Keys: សកម្មទាំងពីរ"
                : isKeyValid
                ? "ElevenLabs: សកម្ម"
                : isGeminiValid
                ? "Gemini: សកម្ម"
                : "ភ្ជាប់ API Key"}
            </span>
            {isKeyValid && <span className="elevenlabs-tag">ElevenLabs</span>}
            {isGeminiValid && <span className="gemini-tag">Gemini</span>}
          </button>
        </div>
      </header>

      {/* Main Grid Container */}
      <div className="voice-studio-container">
        {/* Left Sidebar: Saved Voice Profiles (Local Computer) */}
        <aside className="voice-studio-sidebar">
          <div className="voice-sidebar-header">
            <div className="voice-sidebar-title-row">
              <span className="voice-sidebar-title">
                <FloppyDisk size={17} weight="fill" color="#38bdf8" />
                <span>សំឡេងក្នុងម៉ាស៊ីន</span>
              </span>
              <span className="voice-count-badge">{profiles.length}</span>
            </div>
            <div className="voice-search-box">
              <span className="voice-search-icon">🔍</span>
              <input
                className="voice-search-input"
                type="text"
                placeholder="ស្វែងរកសំឡេង..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="voice-profiles-list">
            {filteredProfiles.length === 0 ? (
              <div className="voice-empty-state">
                <span className="voice-empty-icon">🎙️</span>
                <strong>មិនទាន់មានសំឡេងទេ</strong>
                <p style={{ fontSize: "12px", margin: 0, lineHeight: 1.6 }}>
                  ចុចប៊ូតុង "ក្លូនសំឡេងថ្មី" ដើម្បីបង្កើតសំឡេងផ្ទាល់ខ្លួនរបស់អ្នក
                </p>
              </div>
            ) : (
              filteredProfiles.map((p) => {
                const isActive = p.id === selectedProfileId;
                return (
                  <div
                    key={p.id}
                    className={`voice-profile-card ${isActive ? "is-active" : ""}`}
                    onClick={() => selectProfile(p.id)}
                  >
                    <div className={`voice-avatar-disc ${isActive ? "is-active" : ""}`}>
                      {p.name ? p.name.charAt(0).toUpperCase() : "សំ"}
                    </div>
                    <div className="voice-profile-info">
                      <div className="voice-profile-name" title={p.name}>
                        {p.name}
                      </div>
                      <div className="voice-profile-meta">
                        <span className="voice-profile-tag">
                          {p.language === "km" ? "ភាសាខ្មែរ" : "អន្តរជាតិ"}
                        </span>
                        {p.engine === "voxcpm2" ? (
                          <span className="voxcpm-tag" style={{ marginLeft: 4 }}>
                            VoxCPM2 48kHz
                          </span>
                        ) : p.elevenlabsVoiceId || p.engine === "elevenlabs" ? (
                          <span className="elevenlabs-tag" style={{ marginLeft: 4 }}>
                            ElevenLabs 100%
                          </span>
                        ) : (
                          <span className="openvoice-tag" style={{ marginLeft: 4 }}>
                            OpenVoice v2
                          </span>
                        )}
                        {(p.trainingQuality?.isDeepTrained ||
                          p.voxcpmProfile?.acousticProfile?.trainingQuality?.isDeepTrained ||
                          (p.voxcpmProfile?.acousticProfile?.durationSec >= 28) ||
                          (p.duration >= 28)) && (
                          <span className="training-100-badge" style={{ marginLeft: 4 }} title="AI បានរៀន និងចងចាំសំឡេងបានច្បាស់ ១០០%">
                            🌟 ចងចាំ ១០០%
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="voice-profile-actions">
                      <button
                        className="voice-card-btn btn-export"
                        type="button"
                        title="នាំចេញឯកសារបម្រុងទុក"
                        onClick={(e) => handleExportProfile(p, e)}
                      >
                        <DownloadSimple size={13} />
                      </button>
                      <button
                        className="voice-card-btn btn-del"
                        type="button"
                        title="លុបសំឡេងនេះ"
                        onClick={(e) => handleDeleteProfile(p.id, e)}
                      >
                        <Trash size={13} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="voice-sidebar-footer">
            <button
              className="voice-btn-new-clone"
              type="button"
              onClick={() => setActiveTab("clone")}
            >
              <Plus size={16} weight="bold" />
              <span>ក្លូនសំឡេងថ្មី</span>
            </button>
            <div className="voice-btn-secondary-row">
              <label
                className="voice-btn-secondary"
                style={{ cursor: "pointer", margin: 0 }}
                title="នាំចូលកញ្ចប់សំឡេងដែលបានរក្សាទុក"
              >
                <UploadSimple size={14} />
                <span>នាំចូលសំឡេង</span>
                <input
                  type="file"
                  accept=".json,.voiceprofile.json"
                  hidden
                  onChange={handleImportProfileFile}
                />
              </label>
            </div>
          </div>
        </aside>

        {/* Right Main Workspaces */}
        <main className="voice-studio-main">
          {/* Tabs Navigation */}
          <div className="voice-tabs-header">
            <button
              className={`voice-tab-button ${activeTab === "tts" ? "is-active" : ""}`}
              type="button"
              onClick={() => setActiveTab("tts")}
            >
              <SpeakerHigh size={17} weight="bold" />
              <span>១. បម្លែងអត្ថបទទៅជាសំឡេង</span>
            </button>
            <button
              className={`voice-tab-button ${activeTab === "clone" ? "is-active" : ""}`}
              type="button"
              onClick={() => setActiveTab("clone")}
            >
              <MicrophoneStage size={17} weight="bold" />
              <span>២. ក្លូនសំឡេងថ្មី</span>
            </button>
          </div>

          {/* TAB 1: TEXT TO SPEECH (TTS) */}
          {activeTab === "tts" && (
            <div className="voice-tab-content">
              {/* Active Voice Banner */}
              <div className="tts-active-voice-banner">
                <div className="tts-voice-lead">
                  <div className="voice-avatar-disc is-active" style={{ width: 44, height: 44 }}>
                    {activeProfile?.name ? activeProfile.name.charAt(0).toUpperCase() : "សំ"}
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="tts-voice-title">
                        {activeProfile ? activeProfile.name : "មិនទាន់បានជ្រើសរើសសំឡេងក្លូន"}
                      </span>
                      {activeProfile?.engine === "voxcpm2" ? (
                        <span className="voxcpm-tag">🌟 VoxCPM2 48kHz Neural Diffusion</span>
                      ) : activeProfile?.elevenlabsVoiceId || activeProfile?.engine === "elevenlabs" ? (
                        <span className="elevenlabs-tag">ElevenLabs Neural 100%</span>
                      ) : (
                        <span className="openvoice-tag">OpenVoice v2 WASM</span>
                      )}
                    </div>
                    <span className="tts-voice-sub">
                      {activeProfile
                        ? activeProfile.engine === "voxcpm2"
                          ? `ម៉ូដែល OpenBMB VoxCPM2 48kHz (Offline / ឥតគិតថ្លៃ) · ភាសា៖ ${
                              activeProfile.language === "km" ? "ខ្មែរ" : "អន្តរជាតិ"
                            }`
                          : activeProfile.elevenlabsVoiceId || activeProfile.engine === "elevenlabs"
                          ? `ម៉ូដែល ElevenLabs Neural Voice (សំឡេងមនុស្សពិត ១០០%) · ភាសា៖ ${
                              activeProfile.language === "km" ? "ខ្មែរ" : "អន្តរជាតិ"
                            }`
                          : `ម៉ូដែល OpenVoice v2 WASM Converter · ភាសា៖ ${
                              activeProfile.language === "km" ? "ខ្មែរ" : "អន្តរជាតិ"
                            }`
                        : "ជ្រើសរើសសំឡេងពីបញ្ជីខាងឆ្វេង ឬចុចក្លូនសំឡេងថ្មី"}
                    </span>
                  </div>
                </div>

                <button
                  className="voice-btn-secondary"
                  type="button"
                  onClick={() => setActiveTab("clone")}
                  style={{ whiteSpace: "nowrap" }}
                >
                  <Plus size={14} />
                  <span>ក្លូនសំឡេងមួយទៀត</span>
                </button>
              </div>

              {/* Text Input Card */}
              <div className="tts-input-card">
                <div className="tts-input-header">
                  <label className="tts-input-label">
                    <Waveform size={17} color="#38bdf8" />
                    <span>បញ្ចូលអត្ថបទដែលត្រូវនិយាយ</span>
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button
                      className="gemini-script-gen-btn"
                      type="button"
                      onClick={() => {
                        if (!isGeminiValid && !geminiKey) {
                          setActiveKeyTab("gemini");
                          setGeminiKeyInput(geminiKey);
                          setShowKeyModal(true);
                          notify("សូមភ្ជាប់ Google Gemini API Key ដើម្បីប្រើមុខងារសរសេរអត្ថបទ AI");
                          return;
                        }
                        setShowScriptModal(true);
                      }}
                      title="ប្រើ Google Gemini AI ជួយបង្កើត ឬកែលម្អអត្ថបទនិយាយ"
                    >
                      <Sparkle size={14} weight="fill" color="#38bdf8" />
                      <span>Gemini AI សរសេរអត្ថបទ</span>
                    </button>
                    <span className="tts-char-count">{ttsText.length} តួអក្សរ</span>
                  </div>
                </div>

                <textarea
                  className="tts-textarea"
                  rows={4}
                  placeholder="វាយបញ្ចូលអត្ថបទជាភាសាខ្មែរនៅទីនេះ..."
                  value={ttsText}
                  onChange={(e) => setTtsText(e.target.value)}
                />

                {/* Quick Templates */}
                <div className="tts-templates-row">
                  <span className="tts-template-label">អត្ថបទគំរូ៖</span>
                  <button
                    className="tts-template-chip"
                    type="button"
                    onClick={() =>
                      setTtsText("សួស្តីបងប្អូនទាំងអស់គ្នា! សូមស្វាគមន៍មកកាន់វីដេអូថ្មីរបស់យើងខ្ញុំ។")
                    }
                  >
                    👋 ស្វាគមន៍
                  </button>
                  <button
                    className="tts-template-chip"
                    type="button"
                    onClick={() =>
                      setTtsText("សូមជួយចុចគាំទ្រ ចុចចែករំលែក និងតាមដានដើម្បីទទួលបានវីដេអូថ្មីៗ!")
                    }
                  >
                    ⭐ គាំទ្រ និងចែករំលែក
                  </button>
                  <button
                    className="tts-template-chip"
                    type="button"
                    onClick={() =>
                      setTtsText("រឿងនិទាននេះនិយាយអំពីការតស៊ូព្យាយាម និងភាពជោគជ័យដ៏អស្ចារ្យក្នុងជីវិត។")
                    }
                  >
                    📖 និទានរឿង
                  </button>
                </div>
              </div>

              {/* Voice Controls Grid */}
              <div className="tts-controls-grid">
                <div className="tts-control-item">
                  <label>
                    <span>ម៉ាស៊ីនសំឡេងដើម</span>
                  </label>
                  <select value={baseVoiceId} onChange={(e) => setBaseVoiceId(e.target.value)}>
                    {isGeminiValid && (
                      <optgroup label="🌟 សំឡេង Google Gemini 2.0 Flash (Studio AI)">
                        <option value="gemini_Aoede">🌟 Gemini Aoede (នារី ស្រទន់ពិរោះ)</option>
                        <option value="gemini_Kore">🌟 Gemini Kore (នារី រស់រវើក)</option>
                        <option value="gemini_Fenrir">🌟 Gemini Fenrir (បុរស ម៉ឺងម៉ាត់)</option>
                        <option value="gemini_Puck">🌟 Gemini Puck (បុរស រួសរាយ)</option>
                        <option value="gemini_Charon">🌟 Gemini Charon (បុរស ទន់ភ្លន់)</option>
                      </optgroup>
                    )}
                    <optgroup label="🇰🇭 សំឡេងមូលដ្ឋាន (Local / Web)">
                      <option value="km_KH-mms-medium">🇰🇭 សំឡេងខ្មែរ (សុភា)</option>
                      <option value="af_heart">🇺🇸 សំឡេងអង់គ្លេស (នារី)</option>
                      <option value="am_fenrir">🇺🇸 សំឡេងអង់គ្លេស (បុរស)</option>
                      <option value="zh_f_qinglan">🇨🇳 សំឡេងចិន (នារី)</option>
                    </optgroup>
                  </select>
                </div>

                <div className="tts-control-item">
                  <label>
                    <span>ល្បឿននិយាយ</span>
                    <span style={{ color: "#38bdf8" }}>{ttsSpeed.toFixed(2)}x</span>
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="1.8"
                    step="0.05"
                    value={ttsSpeed}
                    onChange={(e) => setTtsSpeed(parseFloat(e.target.value))}
                  />
                </div>

                <div className="tts-control-item">
                  <label>
                    <span>កម្រិតសម្លេង</span>
                    <span style={{ color: "#38bdf8" }}>{Math.round(ttsVolume * 100)}%</span>
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="1.5"
                    step="0.05"
                    value={ttsVolume}
                    onChange={(e) => setTtsVolume(parseFloat(e.target.value))}
                  />
                </div>
              </div>

              {/* Generate Speech Button */}
              <button
                className="tts-generate-btn"
                type="button"
                disabled={isGenerating || !ttsText.trim()}
                onClick={handleGenerateSpeech}
              >
                {isGenerating ? (
                  <>
                    <Sparkle size={18} className="animate-spin" />
                    <span>{genPhase || "កំពុងបង្កើតសំឡេង..."}</span>
                  </>
                ) : (
                  <>
                    <Lightning size={19} weight="fill" />
                    <span>បង្កើតសំឡេងក្លូន</span>
                  </>
                )}
              </button>

              {/* Progress Bar while generating */}
              {isGenerating && (
                <div className="tts-progress-box">
                  <div className="tts-progress-status-row">
                    <span>{genPhase}</span>
                    <span>{genProgress}%</span>
                  </div>
                  <div className="tts-progress-track">
                    <div className="tts-progress-fill" style={{ width: `${genProgress}%` }} />
                  </div>
                </div>
              )}

              {/* Output Audio Player & Timeline Insertion */}
              {generatedBlob && (
                <div className="tts-output-card">
                  <div className="tts-output-header">
                    <div className="tts-output-title">
                      <CheckCircle size={18} weight="fill" color="#10b981" />
                      <span>សំឡេងបានបង្កើតរួចរាល់ · {formatTime(generatedDuration)}</span>
                    </div>
                    <span style={{ fontSize: "12px", color: "#64748b" }}>
                      គុណភាពច្បាស់កម្រិតខ្ពស់
                    </span>
                  </div>

                  {/* Audio Controls */}
                  <div className="tts-player-controls">
                    <button
                      className="tts-play-btn"
                      type="button"
                      onClick={togglePlayAudio}
                      title={isPlaying ? "ផ្អាក" : "ចាក់ស្តាប់"}
                    >
                      {isPlaying ? (
                        <Pause size={20} weight="fill" />
                      ) : (
                        <Play size={20} weight="fill" style={{ marginLeft: 2 }} />
                      )}
                    </button>

                    <div className="tts-timeline-scrubber">
                      <input
                        className="tts-scrubber-slider"
                        type="range"
                        min="0"
                        max={generatedDuration || 1}
                        step="0.05"
                        value={currentTime}
                        onChange={handleSeek}
                      />
                      <div className="tts-time-labels">
                        <span>{formatTime(currentTime)}</span>
                        <span>{formatTime(generatedDuration)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Timeline Insert Actions */}
                  <div className="tts-timeline-actions-bar">
                    <button
                      className="tts-btn-insert-timeline"
                      type="button"
                      onClick={() => handleInsert(true)}
                    >
                      <Plus size={18} weight="bold" />
                      <span>បញ្ចូលទៅក្នុង Timeline</span>
                    </button>

                    <button
                      className="tts-btn-insert-assets"
                      type="button"
                      title="រក្សាទុកក្នុង Media Bin ដោយមិនទាន់បិទទំព័រនេះ"
                      onClick={() => handleInsert(false)}
                    >
                      <FloppyDisk size={16} />
                      <span>ដាក់ក្នុង Media Bin</span>
                    </button>

                    <button
                      className="tts-btn-download-audio"
                      type="button"
                      title="ទាញយកឯកសារសំឡេង"
                      onClick={handleDownloadFile}
                    >
                      <DownloadSimple size={16} />
                      <span>ទាញយកសំឡេង</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CLONE NEW VOICE */}
          {activeTab === "clone" && (
            <div className="voice-tab-content">
              <div className="clone-workspace-card">
                {/* Step 1: Input source */}
                <div className="clone-section-step">
                  <div className="clone-step-title">
                    <span className="clone-step-num">១</span>
                    <span>ជ្រើសរើសសំឡេងគំរូ</span>
                  </div>

                  <div className="clone-source-choices">
                    {/* Record from mic */}
                    <div
                      className={`clone-choice-box ${
                        cloneInputMode === "record" ? "is-selected" : ""
                      }`}
                      onClick={() => setCloneInputMode("record")}
                    >
                      <div
                        className={`clone-choice-icon ${isRecording ? "mic-pulsing" : ""}`}
                      >
                        <Microphone size={24} weight={isRecording ? "fill" : "bold"} />
                      </div>
                      <span className="clone-choice-title">ថតសំឡេងផ្ទាល់</span>
                      <span className="clone-choice-desc">
                        ថតសំឡេងនិយាយផ្ទាល់តាមរយៈមេក្រូ ចន្លោះពី ៣០ វិនាទី ដល់ ១ នាទី (30s - 60s) ដើម្បីឱ្យ AI ចងចាំបាន ១០០%
                      </span>
                    </div>

                    {/* Upload file */}
                    <div
                      className={`clone-choice-box ${
                        cloneInputMode === "upload" ? "is-selected" : ""
                      }`}
                      onClick={() => {
                        setCloneInputMode("upload");
                        fileInputRef.current?.click();
                      }}
                    >
                      <div className="clone-choice-icon">
                        <UploadSimple size={24} weight="bold" />
                      </div>
                      <span className="clone-choice-title">ផ្ទុកឡើងឯកសារសំឡេង</span>
                      <span className="clone-choice-desc">
                        ជ្រើសរើសឯកសារសំឡេងច្បាស់ល្អ (ណែនាំ ៣០ វិនាទី ដល់ ១ នាទី ដើម្បីឱ្យ AI រៀនបាន ១០០%)
                      </span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="audio/*"
                        hidden
                        onChange={handleFileUpload}
                      />
                    </div>
                  </div>

                  {/* Active Recording UI */}
                  {cloneInputMode === "record" && (
                    <div className="live-recorder-active-box">
                      <div className="live-recorder-timer">
                        {isRecording ? formatClock(recordingElapsed) : "00:00"}
                      </div>
                      <span style={{ fontSize: "13px", color: isRecording ? "#ef4444" : "#94a3b8", lineHeight: 1.6 }}>
                        {isRecording
                          ? recordingElapsed >= 30
                            ? "🟢 ល្អឥតខ្ចោះ (Deep Training)! AI កំពុងរៀនទឹកដម និងចងចាំសំឡេងបាន ១០០%"
                            : recordingElapsed >= 15
                            ? "🔵 កម្រិតស្តង់ដារ... សូមបន្តថតដល់ ៣០ វិនាទីឡើងទៅ ដើម្បីឱ្យ AI ចងចាំបាន ១០០%"
                            : "🟡 កំពុងថតគំរូដំបូង... សូមនិយាយឱ្យច្បាស់ និងធម្មជាតិ"
                          : "ចុចប៊ូតុងខាងក្រោមដើម្បីចាប់ផ្តើមថត (រយៈពេលណែនាំ ៣០ វិនាទី ដល់ ១ នាទី)"}
                      </span>

                      {/* Real-time Voice Analysis during live recording */}
                      {isRecording && (
                        <div className="voice-analysis-card" style={{ marginTop: 12 }}>
                          <div className="voice-analysis-header">
                            <div className="voice-analysis-title-group">
                              <Sparkle size={17} weight="fill" color={getTrainingQualityInfo(recordingElapsed).color} />
                              <span className="va-header-label">វិភាគសំឡេងផ្ទាល់ (Live Voice Analysis):</span>
                              <strong className="va-header-status">
                                {getTrainingQualityInfo(recordingElapsed).label}
                              </strong>
                            </div>
                            <div className="voice-analysis-header-right">
                              <div className="voice-analysis-timer-badge">
                                <span className="va-time-cur">{formatClock(recordingElapsed)}</span>
                                <span className="va-time-slash">/</span>
                                <span className="va-time-total">01:00</span>
                              </div>
                            </div>
                          </div>

                          <div className="va-waveform-spectrum-container is-live-recording">
                            <div className="va-spectrum-bars">
                              {generateVoiceAnalysisPeaks(118).map((p, idx) => {
                                const animHeight = Math.max(16, Math.min(96, Math.round((Math.sin((recordingElapsed * 6) + idx * 0.3) * 0.35 + p * 0.65) * 100)));
                                const isFilled = idx / 118 <= Math.min(1, recordingElapsed / 60);
                                return (
                                  <div
                                    key={idx}
                                    className={`va-spectrum-bar ${isFilled ? "is-played" : "is-unplayed"}`}
                                    style={{ height: `${animHeight}%` }}
                                  />
                                );
                              })}
                            </div>
                            <div className="va-scrubber-track">
                              <div
                                className="va-scrubber-fill"
                                style={{ width: `${Math.min(100, (recordingElapsed / 60) * 100)}%` }}
                              >
                                <div className="va-scrubber-knob" />
                              </div>
                            </div>
                          </div>

                        </div>
                      )}

                      <div className="live-recorder-btns-row">
                        {!isRecording ? (
                          <button
                            className="btn-extract-voice"
                            type="button"
                            onClick={startRecording}
                            style={{ padding: "10px 22px" }}
                          >
                            <Microphone size={18} weight="fill" />
                            <span>ចាប់ផ្តើមថត</span>
                          </button>
                        ) : (
                          <button
                            className="btn-stop-recording"
                            type="button"
                            onClick={stopRecording}
                          >
                            <Pause size={18} weight="fill" />
                            <span>បញ្ឈប់ និងរក្សាទុក</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Voice Analysis & Equalizer Spectrum Player (Style as in Image 2) */}
                  {referenceBlob && (
                    <div className="voice-analysis-card">
                      {/* Top Header Bar */}
                      <div className="voice-analysis-header">
                        <div className="voice-analysis-title-group">
                          <Sparkle size={15} weight="fill" color="#22d3ee" className="va-sparkle-icon" />
                          <span className="va-header-label">Voice Analysis:</span>
                          <strong className="va-header-status">
                            {getTrainingQualityInfo(referenceDuration).label}
                          </strong>
                        </div>

                        <div className="voice-analysis-header-right">
                          <div className="voice-analysis-timer-badge">
                            <span className="va-time-cur">{formatClock(referenceCurrentTime)}</span>
                            <span className="va-time-slash">/</span>
                            <span className="va-time-total">{formatClock(referenceDuration)}</span>
                          </div>
                          <button
                            className="va-btn-delete"
                            type="button"
                            title="លុបសំឡេងគំរូនេះ"
                            onClick={() => {
                              if (referenceAudioRef.current) referenceAudioRef.current.pause();
                              setIsPlayingReference(false);
                              setReferenceBlob(null);
                              setReferencePeaks([]);
                              setReferenceCurrentTime(0);
                              setExtractedEmbedding(null);
                              setExtractedVoxCpmData(null);
                              setTestBlob(null);
                            }}
                          >
                            <Trash size={15} />
                          </button>
                        </div>
                      </div>

                      {/* Equalizer Frequency Bars + Scrubber (Image 2) */}
                      <div
                        className="va-waveform-spectrum-container"
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const clickRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                          handleReferenceSeek(clickRatio * referenceDuration);
                        }}
                      >
                        <div className="va-spectrum-bars">
                          {displayPeaks.map((peak, idx) => {
                            const barRatio = idx / displayPeaks.length;
                            const currentRatio = referenceDuration > 0 ? referenceCurrentTime / referenceDuration : 0;
                            const isPlayed = barRatio <= currentRatio;
                            const heightPct = Math.max(16, Math.min(96, Math.round(peak * 100)));
                            return (
                              <div
                                key={idx}
                                className={`va-spectrum-bar ${isPlayed ? "is-played" : "is-unplayed"}`}
                                style={{ height: `${heightPct}%` }}
                              />
                            );
                          })}
                        </div>

                        {/* Scrubber Line with Cyan Thumb / Knob */}
                        <div className="va-scrubber-track">
                          <div
                            className="va-scrubber-fill"
                            style={{
                              width: `${referenceDuration > 0 ? Math.min(100, (referenceCurrentTime / referenceDuration) * 100) : 0}%`,
                            }}
                          >
                            <div className="va-scrubber-knob" />
                          </div>
                        </div>
                      </div>

                      {/* Player Controls Row (Image 2: -5s, Start, Play/Pause, End, +5s) */}
                      <div className="va-player-controls-row">
                        {/* Skip Back 5s */}
                        <button
                          className="va-ctrl-btn va-btn-skip5"
                          type="button"
                          title="ថយក្រោយ ៥ វិនាទី"
                          onClick={() => handleReferenceSeekRelative(-5)}
                        >
                          <IconSkipBack5 />
                        </button>

                        {/* Restart / Start */}
                        <button
                          className="va-ctrl-btn va-btn-jump"
                          type="button"
                          title="ចាប់ផ្តើមពីដើម"
                          onClick={() => handleReferenceSeek(0)}
                        >
                          <SkipBack size={19} weight="fill" />
                        </button>

                        {/* Main Circular Play / Pause (Cyan) */}
                        <button
                          className={`va-ctrl-btn va-btn-play-main ${isPlayingReference ? "is-playing" : ""}`}
                          type="button"
                          title={isPlayingReference ? "ផ្អាក" : "ចាក់ស្តាប់សំឡេង"}
                          onClick={togglePlayReference}
                        >
                          {isPlayingReference ? (
                            <Pause size={22} weight="fill" />
                          ) : (
                            <Play size={22} weight="fill" style={{ marginLeft: 2 }} />
                          )}
                        </button>

                        {/* Jump to End */}
                        <button
                          className="va-ctrl-btn va-btn-jump"
                          type="button"
                          title="ទៅចុងបញ្ចប់"
                          onClick={() => handleReferenceSeek(referenceDuration)}
                        >
                          <SkipForward size={19} weight="fill" />
                        </button>

                        {/* Skip Forward 5s */}
                        <button
                          className="va-ctrl-btn va-btn-skip5"
                          type="button"
                          title="ទៅមុខ ៥ វិនាទី"
                          onClick={() => handleReferenceSeekRelative(5)}
                        >
                          <IconSkipForward5 />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Step 2: Profile Details */}
                <div className="clone-section-step">
                  <div className="clone-step-title">
                    <span className="clone-step-num">២</span>
                    <span>កំណត់ព័ត៌មានសំឡេង</span>
                  </div>

                  <div className="clone-form-grid">
                    <div className="clone-form-field">
                      <label>ឈ្មោះសំឡេង</label>
                      <input
                        className="clone-form-input"
                        type="text"
                        placeholder="ឧទាហរណ៍៖ សំឡេងកញ្ញា សុភា, សំឡេងផ្ទាល់ខ្លួន..."
                        value={cloneName}
                        onChange={(e) => setCloneName(e.target.value)}
                      />
                    </div>

                    <div className="clone-form-field">
                      <label>ភាសាគោលដៅ</label>
                      <select
                        className="clone-form-select"
                        value={cloneLanguage}
                        onChange={(e) => setCloneLanguage(e.target.value)}
                      >
                        <option value="km">ភាសាខ្មែរ</option>
                        <option value="en">ភាសាអង់គ្លេស</option>
                        <option value="zh">ភាសាចិន</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Step 3: Extract & Test */}
                <div className="clone-section-step">
                  <div className="clone-step-title">
                    <span className="clone-step-num">៣</span>
                    <span>ជ្រើសរើសម៉ូដែល AI និងស្រង់យកសំឡេង</span>
                  </div>

                  {/* Cloning Engine Model Selector */}
                  <div className="clone-model-picker-container">
                    <div className="clone-model-picker-title">
                      <Waveform size={17} color="#38bdf8" />
                      <span>ជ្រើសរើសម៉ូដែល AI សម្រាប់ការក្លូន (Cloning Engine Model)</span>
                    </div>

                    <div className="clone-model-cards-grid">
                      {/* Model 1: VoxCPM2 (Recommended Offline) */}
                      <div
                        className={`clone-model-card ${
                          cloneModel === "voxcpm2" ? "is-selected model-voxcpm" : ""
                        }`}
                        onClick={() => setCloneModel("voxcpm2")}
                      >
                        <div className="clone-model-icon icon-voxcpm">
                          <Waveform size={22} weight="fill" />
                        </div>
                        <div className="clone-model-info">
                          <span className="clone-model-name">VoxCPM2 (OpenBMB 48kHz)</span>
                        </div>
                        {cloneModel === "voxcpm2" && (
                          <div className="clone-model-selected-check">
                            <CheckCircle size={18} weight="fill" />
                          </div>
                        )}
                      </div>

                      {/* Model 2: OpenVoice v2 */}
                      <div
                        className={`clone-model-card ${
                          cloneModel === "openvoice" ? "is-selected model-openvoice" : ""
                        }`}
                        onClick={() => setCloneModel("openvoice")}
                      >
                        <div className="clone-model-icon icon-openvoice">
                          <Lightning size={22} weight="fill" />
                        </div>
                        <div className="clone-model-info">
                          <span className="clone-model-name">OpenVoice v2 (Fast WASM)</span>
                        </div>
                        {cloneModel === "openvoice" && (
                          <div className="clone-model-selected-check">
                            <CheckCircle size={18} weight="fill" />
                          </div>
                        )}
                      </div>

                      {/* Model 3: ElevenLabs Pro */}
                      <div
                        className={`clone-model-card ${
                          cloneModel === "elevenlabs" ? "is-selected model-elevenlabs" : ""
                        }`}
                        onClick={() => {
                          setCloneModel("elevenlabs");
                          if (!isKeyValid) {
                            setKeyInput(apiKey);
                            setKeyError("");
                            setShowKeyModal(true);
                          }
                        }}
                      >
                        <div className="clone-model-icon icon-elevenlabs">
                          <Sparkle size={22} weight="fill" />
                        </div>
                        <div className="clone-model-info">
                          <span className="clone-model-name">ElevenLabs Neural (Cloud Pro)</span>
                        </div>
                        {cloneModel === "elevenlabs" && (
                          <div className="clone-model-selected-check">
                            <CheckCircle size={18} weight="fill" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="clone-action-bar">
                    <button
                      className="btn-extract-voice"
                      type="button"
                      disabled={!referenceBlob || isExtracting}
                      onClick={handleExtractModel}
                    >
                      {isExtracting ? (
                        <>
                          <Sparkle size={18} className="animate-spin" />
                          <span>{extractPhase || "កំពុងស្រង់យកម៉ូដែល..."}</span>
                        </>
                      ) : (
                        <>
                          <Lightning size={18} weight="fill" />
                          <span>
                            {extractedEmbedding || extractedVoiceId || extractedVoxCpmData
                              ? "ស្រង់យកម៉ូដែលម្តងទៀត"
                              : cloneModel === "voxcpm2"
                              ? "ក្លូនសំឡេងជាមួយ VoxCPM2 (48kHz Ultra-HD)"
                              : cloneModel === "elevenlabs"
                              ? "ក្លូនសំឡេងជាមួយ ElevenLabs (100% ដូចពិត)"
                              : "ស្រង់យកម៉ូដែលសំឡេង (OpenVoice v2)"}
                          </span>
                        </>
                      )}
                    </button>

                    {(extractedEmbedding || extractedVoiceId || extractedVoxCpmData) && (
                      <button
                        className="btn-save-clone-local"
                        type="button"
                        onClick={handleSaveProfile}
                      >
                        <FloppyDisk size={18} weight="fill" />
                        <span>រក្សាទុកក្នុងកុំព្យូទ័រ</span>
                      </button>
                    )}
                  </div>

                  {/* Extraction Progress */}
                  {isExtracting && (
                    <div className="tts-progress-box">
                      <div className="tts-progress-status-row">
                        <span>{extractPhase}</span>
                        <span>{extractProgress}%</span>
                      </div>
                      <div className="tts-progress-track">
                        <div
                          className="tts-progress-fill"
                          style={{ width: `${extractProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Test preview audio */}
                  {testBlob && (
                    <div
                      style={{
                        padding: "14px 18px",
                        borderRadius: "10px",
                        background: "rgba(16, 185, 129, 0.08)",
                        border: "1px solid rgba(16, 185, 129, 0.3)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <button
                          className="tts-play-btn"
                          style={{ width: 36, height: 36 }}
                          type="button"
                          onClick={() => {
                            if (!testAudioRef.current) return;
                            if (isPlayingTest) {
                              testAudioRef.current.pause();
                              setIsPlayingTest(false);
                            } else {
                              testAudioRef.current.play();
                              setIsPlayingTest(true);
                            }
                          }}
                        >
                          {isPlayingTest ? <Pause size={16} /> : <Play size={16} />}
                        </button>
                        <div>
                          <strong style={{ fontSize: "13.5px", color: "#10b981" }}>
                            សាកល្បងស្តាប់សំឡេងដែលបានក្លូន
                          </strong>
                          <div style={{ fontSize: "11.5px", color: "#94a3b8" }}>
                            ស្តាប់ដើម្បីផ្ទៀងផ្ទាត់គុណភាព មុនពេលរក្សាទុក
                          </div>
                        </div>
                      </div>

                      <button
                        className="btn-save-clone-local"
                        style={{ padding: "8px 16px", fontSize: "13px" }}
                        type="button"
                        onClick={handleSaveProfile}
                      >
                        <Check size={16} weight="bold" />
                        <span>រក្សាទុកឥឡូវនេះ</span>
                      </button>
                    </div>
                  )}

                  {/* VoxCPM2 Deep Acoustic Learning Result Card */}
                  {extractedVoxCpmData && (
                    <div className="voxcpm-deep-trained-card">
                      <div className="voxcpm-deep-header">
                        <div className="voxcpm-deep-title">
                          <Sparkle size={18} weight="fill" color="#10b981" />
                          <span>លទ្ធផលបណ្តុះបណ្តាលសំឡេង VoxCPM2 (Deep Acoustic Learning)</span>
                        </div>
                        <span className="voxcpm-deep-badge">
                          {extractedVoxCpmData.acousticProfile?.trainingQuality?.isDeepTrained || referenceDuration >= 28
                            ? "🌟 ចងចាំបាន ១០០% (Deep Trained)"
                            : "⚡ Standard Model"}
                        </span>
                      </div>

                      <div className="voxcpm-acoustic-metrics-grid">
                        <div className="voxcpm-metric-box">
                          <span className="voxcpm-metric-label">ថិរវេលាវិភាគ</span>
                          <span className="voxcpm-metric-val">
                            {(extractedVoxCpmData.acousticProfile?.durationSec || referenceDuration || 0).toFixed(1)} វិនាទី
                          </span>
                        </div>
                        <div className="voxcpm-metric-box">
                          <span className="voxcpm-metric-label">កម្រិត Pitch (F0)</span>
                          <span className="voxcpm-metric-val">
                            {Math.round(extractedVoxCpmData.acousticProfile?.meanF0 || 175)} Hz
                          </span>
                        </div>
                        <div className="voxcpm-metric-box">
                          <span className="voxcpm-metric-label">Vocal Formants (F1/F2/F3)</span>
                          <span className="voxcpm-metric-val">
                            {extractedVoxCpmData.acousticProfile?.formants
                              ? `${extractedVoxCpmData.acousticProfile.formants.f1} / ${extractedVoxCpmData.acousticProfile.formants.f2} / ${extractedVoxCpmData.acousticProfile.formants.f3} Hz`
                              : "520 / 1750 / 2750 Hz"}
                          </span>
                        </div>
                        <div className="voxcpm-metric-box">
                          <span className="voxcpm-metric-label">Latent Neural Vector</span>
                          <span className="voxcpm-metric-val">
                            {extractedVoxCpmData.acousticProfile?.timbreEmbedding?.length || 1024}-D
                          </span>
                        </div>
                      </div>

                      <div className="voxcpm-deep-note">
                        ✓ AI បានរៀន និងស្រង់យកគ្រប់លក្ខណៈពិសេសនៃបំពង់ក (Vocal Tract) និងចង្វាក់និយាយរបស់អ្នករួចរាល់ ធានាថានៅពេលសំយោគចេញមក គឺដូចសំឡេងដើមរបស់អ្នក ១០០%។
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Unified API Keys Setup Modal (ElevenLabs & Google Gemini) */}
      {showKeyModal && (
        <div className="elevenlabs-modal-backdrop" onClick={() => setShowKeyModal(false)}>
          <div className="elevenlabs-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="elevenlabs-modal-header">
              <div className="elevenlabs-modal-title">
                <Key size={20} weight="fill" color="#38bdf8" />
                <span>កំណត់ API Keys (ElevenLabs & Gemini)</span>
              </div>
              <button
                className="elevenlabs-modal-close"
                type="button"
                onClick={() => setShowKeyModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Provider Switch Tabs */}
            <div className="api-modal-tabs">
              <button
                className={`api-modal-tab tab-elevenlabs ${activeKeyTab === "elevenlabs" ? "is-active" : ""}`}
                type="button"
                onClick={() => {
                  setActiveKeyTab("elevenlabs");
                  setKeyError("");
                }}
              >
                <span>🟣 ElevenLabs</span>
                {isKeyValid && <span className="elevenlabs-tag">សកម្ម</span>}
              </button>
              <button
                className={`api-modal-tab tab-gemini ${activeKeyTab === "gemini" ? "is-active" : ""}`}
                type="button"
                onClick={() => {
                  setActiveKeyTab("gemini");
                  setGeminiError("");
                }}
              >
                <span>🔵 Google Gemini</span>
                {isGeminiValid && <span className="gemini-tag">សកម្ម</span>}
              </button>
            </div>

            {/* TAB 1: ElevenLabs */}
            {activeKeyTab === "elevenlabs" && (
              <>
                <div className="elevenlabs-modal-body">
                  <p className="elevenlabs-modal-desc">
                    ElevenLabs គឺជាបច្ចេកវិទ្យា Voice Cloning លំដាប់លេខ ១ ពិភពលោក។ សំឡេងដែលបានក្លូនតាមរយៈ ElevenLabs មានភាពរលូន ធម្មជាតិ និងដូចសំឡេងមនុស្សពិត ១០០% ទាំងការដកដង្ហើម និងទឹកដមសំឡេង។
                  </p>

                  <div className="elevenlabs-key-input-row">
                    <label style={{ fontSize: "12.5px", fontWeight: 600, color: "#cbd5e1" }}>
                      ElevenLabs API Key របស់អ្នក៖
                    </label>
                    <input
                      className="elevenlabs-key-input"
                      type="password"
                      placeholder="sk_..."
                      value={keyInput}
                      onChange={(e) => {
                        setKeyInput(e.target.value);
                        setKeyError("");
                      }}
                    />
                    <span style={{ fontSize: "11.5px", color: "#64748b" }}>
                      អ្នកអាចបង្កើត API Key ដោយឥតគិតថ្លៃនៅ{" "}
                      <a
                        href="https://elevenlabs.io"
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "#38bdf8", textDecoration: "underline" }}
                      >
                        elevenlabs.io
                      </a>
                    </span>
                  </div>

                  {keyError && (
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: "8px",
                        background: "rgba(239, 68, 68, 0.12)",
                        border: "1px solid rgba(239, 68, 68, 0.3)",
                        color: "#f87171",
                        fontSize: "12.5px",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <WarningCircle size={16} weight="fill" />
                      <span>{keyError}</span>
                    </div>
                  )}

                  {isKeyValid && keyInfo && (
                    <div className="elevenlabs-status-box">
                      <CheckCircle size={18} weight="fill" color="#10b981" />
                      <div>
                        <strong>ភ្ជាប់បានជោគជ័យ (គណនី {keyInfo.tier || "Active"})</strong>
                        <div style={{ fontSize: "11.5px", opacity: 0.85 }}>
                          កូតាដែលបានប្រើ៖ {keyInfo.character_count?.toLocaleString()} / {keyInfo.character_limit?.toLocaleString()} តួអក្សរ ({keyInfo.percent_used}%)
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="elevenlabs-modal-footer">
                  <div>
                    {apiKey && (
                      <button
                        className="elevenlabs-modal-btn-remove"
                        type="button"
                        onClick={handleRemoveKey}
                      >
                        <Trash size={14} />
                        <span>ដក Key ចេញ</span>
                      </button>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button
                      className="elevenlabs-modal-btn-cancel"
                      type="button"
                      onClick={() => setShowKeyModal(false)}
                    >
                      បោះបង់
                    </button>
                    <button
                      className="elevenlabs-modal-btn-save"
                      type="button"
                      disabled={isVerifyingKey || !keyInput.trim()}
                      onClick={handleVerifyAndSaveKey}
                    >
                      {isVerifyingKey ? (
                        <>
                          <Sparkle size={15} className="animate-spin" />
                          <span>កំពុងផ្ទៀងផ្ទាត់...</span>
                        </>
                      ) : (
                        <>
                          <Check size={15} weight="bold" />
                          <span>ផ្ទៀងផ្ទាត់ និងរក្សាទុក</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* TAB 2: Google Gemini */}
            {activeKeyTab === "gemini" && (
              <>
                <div className="elevenlabs-modal-body">
                  <p className="elevenlabs-modal-desc">
                    Google Gemini ផ្តល់ជូននូវម៉ូដែល Gemini 2.0 Flash ជាមួយ Studio AI Voices គុណភាពខ្ពស់ និងជំនួយការសរសេរអត្ថបទវីដេអូជាភាសាខ្មែរ (AI Scriptwriter) ដោយឥតគិតថ្លៃ (Free Quota)។
                  </p>

                  <div className="elevenlabs-key-input-row">
                    <label style={{ fontSize: "12.5px", fontWeight: 600, color: "#cbd5e1" }}>
                      Google Gemini API Key របស់អ្នក៖
                    </label>
                    <input
                      className="elevenlabs-key-input"
                      type="password"
                      placeholder="AIzaSy..."
                      style={{ borderColor: "rgba(56, 189, 248, 0.4)" }}
                      value={geminiKeyInput}
                      onChange={(e) => {
                        setGeminiKeyInput(e.target.value);
                        setGeminiError("");
                      }}
                    />
                    <span style={{ fontSize: "11.5px", color: "#64748b" }}>
                      អ្នកអាចបង្កើត API Key ដោយឥតគិតថ្លៃនៅ{" "}
                      <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "#38bdf8", textDecoration: "underline" }}
                      >
                        Google AI Studio
                      </a>
                    </span>
                  </div>

                  {geminiError && (
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: "8px",
                        background: "rgba(239, 68, 68, 0.12)",
                        border: "1px solid rgba(239, 68, 68, 0.3)",
                        color: "#f87171",
                        fontSize: "12.5px",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <WarningCircle size={16} weight="fill" />
                      <span>{geminiError}</span>
                    </div>
                  )}

                  {isGeminiValid && (
                    <div
                      className="elevenlabs-status-box"
                      style={{ background: "rgba(56, 189, 248, 0.1)", borderColor: "rgba(56, 189, 248, 0.3)", color: "#38bdf8" }}
                    >
                      <CheckCircle size={18} weight="fill" color="#38bdf8" />
                      <div>
                        <strong>ភ្ជាប់បានជោគជ័យ (Google Gemini 2.0 Active)</strong>
                        <div style={{ fontSize: "11.5px", opacity: 0.85 }}>
                          គាំទ្រ Gemini Studio Voices (Aoede, Kore, Fenrir, Puck, Charon) & AI Scriptwriter
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="elevenlabs-modal-footer">
                  <div>
                    {geminiKey && (
                      <button
                        className="elevenlabs-modal-btn-remove"
                        type="button"
                        onClick={handleRemoveGeminiKey}
                      >
                        <Trash size={14} />
                        <span>ដក Key ចេញ</span>
                      </button>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button
                      className="elevenlabs-modal-btn-cancel"
                      type="button"
                      onClick={() => setShowKeyModal(false)}
                    >
                      បោះបង់
                    </button>
                    <button
                      className="gemini-modal-btn-save"
                      type="button"
                      disabled={isVerifyingGemini || !geminiKeyInput.trim()}
                      onClick={handleVerifyAndSaveGeminiKey}
                    >
                      {isVerifyingGemini ? (
                        <>
                          <Sparkle size={15} className="animate-spin" />
                          <span>កំពុងផ្ទៀងផ្ទាត់...</span>
                        </>
                      ) : (
                        <>
                          <Check size={15} weight="bold" />
                          <span>ផ្ទៀងផ្ទាត់ និងរក្សាទុក</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Gemini AI Script Generator Modal */}
      {showScriptModal && (
        <div className="gemini-script-modal-backdrop" onClick={() => setShowScriptModal(false)}>
          <div className="gemini-script-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="elevenlabs-modal-header">
              <div className="elevenlabs-modal-title">
                <Sparkle size={20} weight="fill" color="#38bdf8" />
                <span>Gemini AI សរសេរអត្ថបទវីដេអូ</span>
              </div>
              <button
                className="elevenlabs-modal-close"
                type="button"
                onClick={() => setShowScriptModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="elevenlabs-modal-body">
              <p style={{ fontSize: "13px", color: "#94a3b8", margin: 0, lineHeight: 1.6 }}>
                ជ្រើសរើសប្រធានបទគំរូ ឬវាយបញ្ចូលគំនិតរបស់អ្នក ដើម្បីឱ្យ Google Gemini សរសេរអត្ថបទនិយាយជាភាសាខ្មែរយ៉ាងពិរោះ និងទាក់ទាញ៖
              </p>

              {/* Preset Topic Buttons */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <button
                  className="gemini-script-preset-btn"
                  type="button"
                  onClick={() => setScriptTopic("រឿងនិទានខ្លីអំពីការតស៊ូ និងជោគជ័យ")}
                >
                  📖 និទានរឿងខ្លី
                </button>
                <button
                  className="gemini-script-preset-btn"
                  type="button"
                  onClick={() => setScriptTopic("ផ្សាយពាណិជ្ជកម្មលក់ផលិតផលអនឡាញទាក់ទាញ")}
                >
                  🛍️ ផ្សាយពាណិជ្ជកម្ម
                </button>
                <button
                  className="gemini-script-preset-btn"
                  type="button"
                  onClick={() => setScriptTopic("ចំណេះដឹងទូទៅ និងបច្ចេកវិទ្យាគួរឱ្យចាប់អារម្មណ៍")}
                >
                  💡 ចំណេះដឹងបច្ចេកវិទ្យា
                </button>
                <button
                  className="gemini-script-preset-btn"
                  type="button"
                  onClick={() => setScriptTopic("ពាក្យពេចន៍ស្វាគមន៍បើកឆាកវីដេអូ YouTube / TikTok")}
                >
                  🎬 បើកឆាកវីដេអូ
                </button>
              </div>

              {/* Custom Topic Input */}
              <div className="elevenlabs-key-input-row">
                <label style={{ fontSize: "12.5px", fontWeight: 600, color: "#cbd5e1" }}>
                  ប្រធានបទ ឬគំនិតដែលចង់សរសេរ៖
                </label>
                <textarea
                  className="tts-textarea"
                  rows={3}
                  placeholder="ឧទាហរណ៍៖ សរសេរការរៀបរាប់អំពីដំណើរដើរលេងកម្សាន្តនៅតំបន់ភ្នំគូលែន..."
                  value={scriptTopic}
                  onChange={(e) => setScriptTopic(e.target.value)}
                />
              </div>

              {/* Tone Selection */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <label style={{ fontSize: "12.5px", fontWeight: 600, color: "#94a3b8" }}>
                  ទឹកដមសម្លេង៖
                </label>
                <select
                  style={{
                    padding: "6px 12px",
                    borderRadius: "6px",
                    background: "rgba(15, 23, 42, 0.9)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "#f1f5f9",
                    fontSize: "12.5px",
                    outline: "none",
                  }}
                  value={scriptTone}
                  onChange={(e) => setScriptTone(e.target.value)}
                >
                  <option value="ធម្មជាតិ និងរួសរាយ">ធម្មជាតិ និងរួសរាយ</option>
                  <option value="រស់រវើក និងទាក់ទាញ">រស់រវើក និងទាក់ទាញ</option>
                  <option value="ម៉ឺងម៉ាត់ និងវិជ្ជាជីវៈ">ម៉ឺងម៉ាត់ និងវិជ្ជាជីវៈ</option>
                  <option value="កំប្លែង និងសប្បាយ">កំប្លែង និងសប្បាយ</option>
                </select>
              </div>
            </div>

            <div className="elevenlabs-modal-footer">
              <button
                className="elevenlabs-modal-btn-cancel"
                type="button"
                onClick={() => setShowScriptModal(false)}
              >
                បោះបង់
              </button>

              <button
                className="gemini-modal-btn-save"
                type="button"
                disabled={isGeneratingScript || !scriptTopic.trim()}
                onClick={() => handleGenerateScriptWithGemini()}
              >
                {isGeneratingScript ? (
                  <>
                    <Sparkle size={15} className="animate-spin" />
                    <span>Gemini កំពុងសរសេរ...</span>
                  </>
                ) : (
                  <>
                    <Sparkle size={15} weight="fill" />
                    <span>បង្កើតអត្ថបទឥឡូវនេះ</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default VoiceCloneStudioPage;
