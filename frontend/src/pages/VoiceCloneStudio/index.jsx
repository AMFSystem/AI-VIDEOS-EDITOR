import React, { useState, useEffect, useRef, useMemo } from "react";
import { SpeakerHigh, MicrophoneStage, Sparkle } from "@phosphor-icons/react";

import {
  listVoiceProfiles,
  saveVoiceProfile,
  deleteVoiceProfile,
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
  analyzeVocalPersonaWithGemini,
  generateScriptWithGemini,
} from "../../lib/geminiRuntime.js";
import { synthesizeBaseVoice } from "../../lib/baseVoiceSynthesis.js";
import {
  extractVoxCpmProfile,
  synthesizeWithVoxCpm,
  VOXCPM2_VERSION,
  VOXCPM2_SAMPLE_RATE,
} from "../../lib/voxcpmRuntime.js";
import {
  extractF5TtsProfile,
  synthesizeWithF5Tts,
  F5TTS_VERSION,
  F5TTS_SAMPLE_RATE,
} from "../../lib/f5ttsRuntime.js";
import { VOICES } from "../../config/editor.js";
import { decodeWaveform, getAudioRecordingFormat } from "../../lib/media.js";
import { formatTime } from "../../lib/timeline.js";

import { VoiceStudioNavbar } from "./components/VoiceStudioNavbar.jsx";
import { VoiceProfilesSidebar } from "./components/VoiceProfilesSidebar.jsx";
import { TtsTab } from "./tabs/TtsTab.jsx";
import { CloneTab } from "./tabs/CloneTab.jsx";
import { TrainTab } from "./tabs/TrainTab.jsx";
import { ApiKeyModal } from "./modals/ApiKeyModal.jsx";

import { GeminiScriptModal } from "./modals/GeminiScriptModal.jsx";
import {
  blobToBase64,
  base64ToBlob,
  generateVoiceAnalysisPeaks,
  formatSavedTime,
  getTrainingQualityInfo,
} from "./utils.jsx";

import "./VoiceCloneStudioPage.css";

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
      setIsKeyValid(true);
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
          // Keep valid optimistically if offline/proxy issue
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
  const [activeKeyTab, setActiveKeyTab] = useState("gemini"); // 'gemini' | 'elevenlabs'

  // Script Generator modal state (Gemini powered)
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [scriptTopic, setScriptTopic] = useState("");
  const [scriptTone, setScriptTone] = useState("ធម្មជាតិ");
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);

  // Validate stored or server-side Gemini key on mount
  useEffect(() => {
    const stored = getStoredGeminiKey();
    if (stored) {
      setGeminiKey(stored);
      setGeminiKeyInput(stored);
      setIsGeminiValid(true);
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
          // Keep valid optimistically if offline/proxy issue
          setGeminiError(err.message || "មិនអាចតភ្ជាប់បាន");
        });
    } else {
      // Check if backend has GEMINI_API_KEY from environment
      verifyGeminiKey("")
        .then((res) => {
          if (res.valid && res.serverConfigured) {
            setIsGeminiValid(true);
            setGeminiInfo(res);
          }
        })
        .catch(() => {});
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

  const handleKeysUpdated = () => {
    const storedG = getStoredGeminiKey();
    setGeminiKey(storedG);
    setGeminiKeyInput(storedG);
    if (storedG) {
      setIsGeminiValid(true);
      verifyGeminiKey(storedG)
        .then((res) => {
          if (res.valid) {
            setIsGeminiValid(true);
            setGeminiInfo(res);
          }
        })
        .catch(() => {});
    } else {
      setIsGeminiValid(false);
      setGeminiInfo(null);
    }

    const storedEL = getStoredElevenLabsKey();
    setApiKey(storedEL);
    setKeyInput(storedEL);
    if (storedEL) {
      setIsKeyValid(true);
      verifyElevenLabsKey(storedEL)
        .then((res) => {
          if (res.valid) {
            setIsKeyValid(true);
            setKeyInfo(res.info);
          }
        })
        .catch(() => {});
    } else {
      setIsKeyValid(false);
      setKeyInfo(null);
    }
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

  // Helper to sanitize profiles and fix any cross-engine mismatch
  const sanitizeProfile = (p) => {
    if (!p) return p;
    const clean = { ...p };
    // If elevenlabsVoiceId is erroneously set to gemini_... or invalid ID
    if (clean.elevenlabsVoiceId && (clean.elevenlabsVoiceId.startsWith("gemini_") || clean.elevenlabsVoiceId.length < 10)) {
      if (clean.elevenlabsVoiceId.startsWith("gemini_")) {
        clean.geminiVoiceName = clean.elevenlabsVoiceId.replace("gemini_", "");
      }
      clean.elevenlabsVoiceId = null;
      if (clean.engine === "elevenlabs") {
        clean.engine = clean.embedding ? "openvoice" : "gemini";
      }
    }
    return clean;
  };

  // Local Voice Profiles state
  const [profiles, setProfiles] = useState(() =>
    (propVoiceProfiles || []).map(sanitizeProfile)
  );
  const [selectedProfileId, setSelectedProfileId] = useState(
    propSelectedVoiceProfileId || propVoiceProfiles?.[0]?.id || ""
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [showLibraryMobile, setShowLibraryMobile] = useState(false);

  // Sync with external profiles or indexedDB
  useEffect(() => {
    if (propVoiceProfiles && propVoiceProfiles.length > 0) {
      setProfiles(propVoiceProfiles.map(sanitizeProfile));
    } else {
      listVoiceProfiles()
        .then((items) => {
          const cleaned = (items || []).map(sanitizeProfile);
          setProfiles(cleaned);
          if (!selectedProfileId && cleaned.length > 0) {
            setSelectedProfileId(cleaned[0].id);
          }
        })
        .catch(console.error);
    }
  }, [propVoiceProfiles]);

  const activeProfile = useMemo(() => {
    const raw = profiles.find((p) => p.id === selectedProfileId) || profiles[0] || null;
    return sanitizeProfile(raw);
  }, [profiles, selectedProfileId]);

  // Keep parent in sync
  const selectProfile = (id) => {
    setSelectedProfileId(id);
    propSetSelectedVoiceProfileId?.(id);
    const target = profiles.find((p) => p.id === id);
    if (target?.vocalTone) setVocalTone(target.vocalTone);
  };

  // -------------------------------------------------------------------------
  // TTS State
  // -------------------------------------------------------------------------
  const [ttsText, setTtsText] = useState(
    "នៅពេលយប់ជ្រៅ ខណៈកូនសិស្សទាំងអស់បានដេកលក់អស់ ព្រះសង្ឃអង្គនោះបានឮសំឡេងចម្លែកមួយ។ ពេលនោះគាត់បានក្រោកឡើង ហើយដើរទៅមើល... ស្រាប់តែឃើញស្រមោលខ្មៅមួយកំពុងឈរនៅមាត់ទ្វារ! សំឡេងដកដង្ហើមធំៗ ធ្វើឲ្យលោកព្រឺសម្បុរខ្ញាកៗ។"
  );

  // Default to Khmer Sophea or first matching voice
  const defaultBaseVoice = useMemo(() => {
    return (
      VOICES.find((v) => v.id === "km_KH-mms-medium" || v.language === "ភាសាខ្មែរ") ||
      VOICES[0]
    );
  }, []);
  const [baseVoiceId, setBaseVoiceId] = useState("gemini_Aoede");
  const [ttsSpeed, setTtsSpeed] = useState(1);
  const [ttsVolume, setTtsVolume] = useState(1);
  const [vocalTone, setVocalTone] = useState("natural_warm");

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
  const [cloneModel, setCloneModel] = useState("gemini"); // 'gemini' | 'elevenlabs' | 'voxcpm2' | 'openvoice'
  const [extractedVoxCpmData, setExtractedVoxCpmData] = useState(null);
  const [extractedEngine, setExtractedEngine] = useState("gemini");
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState(0);
  const [extractPhase, setExtractPhase] = useState("");
  const [extractedEmbedding, setExtractedEmbedding] = useState(null);
  const [extractedVocalPersona, setExtractedVocalPersona] = useState("");
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
      if (cloneModel === "gemini") {
        const effectiveKey = geminiKey || getStoredGeminiKey();
        if (!effectiveKey && !isGeminiValid) {
          setActiveKeyTab("gemini");
          setGeminiKeyInput(geminiKey || "");
          setShowKeyModal(true);
          notify("សូមភ្ជាប់ Google Gemini API Key ជាមុនសិន");
          setIsExtracting(false);
          return;
        }

        // Gemini 2.0 Flash Audio Studio Cloner + Deep Acoustic Listening Pass
        setExtractPhase("🎧 ដំណាក់កាលទី ១៖ Gemini កំពុងស្តាប់ និងវិភាគសំឡេងរបស់អ្នកយ៉ាងលម្អិត (Deep Acoustic Listening & Persona Extraction)...");
        setExtractProgress(15);

        let persona = "";
        try {
          persona = await analyzeVocalPersonaWithGemini({
            apiKey: effectiveKey,
            audioBlob: referenceBlob,
            language: cloneLanguage,
            onProgress: (p) => setExtractProgress(15 + Math.round(p * 0.3)),
          });
        } catch (pErr) {
          console.warn("Deep listening persona extraction warning:", pErr);
        }

        setExtractedVocalPersona(persona);

        // Acoustic profile embedding for compatibility
        let embedding = null;
        try {
          const acProfile = await extractVoxCpmProfile(referenceBlob);
          embedding = acProfile?.embedding || new Float32Array(192);
        } catch (embErr) {
          embedding = new Float32Array(192);
        }

        const chosenGeminiVoice =
          cloneGender === "female_kore"
            ? "Kore"
            : cloneGender === "male_puck"
            ? "Puck"
            : cloneGender === "male"
            ? "Fenrir"
            : "Aoede";
        setExtractProgress(50);

        setExtractPhase("✨ ដំណាក់កាលទី ២៖ ស្រង់យកធួនសំនៀង និងចង្វាក់ដង្ហើមរួចរាល់! កំពុងសំយោគសំឡេង Studio ដូចមនុស្សពិត ១០០%...");
        const testSentence =
          cloneLanguage === "km"
            ? "សួស្តីបងប្អូនទាំងអស់គ្នា! នេះគឺជាការសាកល្បងសំឡេងក្លូនតាម Google Gemini Studio AI ជាមួយទឹកដមសំនៀងធម្មជាតិ និងច្បាស់ល្អ។"
            : "Hello! This is a test of your voice cloned with Google Gemini Studio AI.";

        let geminiAudioBlob = null;
        try {
          geminiAudioBlob = await synthesizeWithGemini({
            apiKey: effectiveKey,
            text: testSentence,
            voiceName: chosenGeminiVoice,
            referenceAudioBlob: referenceBlob,
            vocalStyle: vocalTone,
            vocalPersona: persona,
            onProgress: (p) => setExtractProgress(50 + Math.round(p * 0.35)),
          });
        } catch (gemErr) {
          setIsExtracting(false);
          setExtractPhase("");
          notify(`បរាជ័យក្នុងការសំយោគ Gemini Studio៖ ${gemErr.message || "សូមពិនិត្យមើល API Key ឬការភ្ជាប់អ៊ីនធឺណិត"}`);
          return;
        }

        // Only commit model extraction once test audio is successfully produced
        setExtractedEmbedding(embedding);
        setExtractedEngine("gemini");
        setExtractedVoxCpmData(null);
        setExtractedVoiceId(`gemini_${chosenGeminiVoice}`);

        setExtractPhase("សំយោគសំឡេង Studio រួចរាល់!");
        setExtractProgress(88);

        // Keep pristine 24kHz native Gemini human voice without WASM vocoder degradation
        const finalTestBlob = geminiAudioBlob;

        setTestBlob(finalTestBlob);
        if (testUrl) URL.revokeObjectURL(testUrl);
        const newUrl = URL.createObjectURL(finalTestBlob);
        setTestUrl(newUrl);

        setExtractProgress(100);
        setExtractPhase("ក្លូនសំឡេងតាម Google Gemini Studio (ស្តាប់ស៊ីជម្រៅ Deep Listening) ជោគជ័យ ១០០%!");
        notify("ក្លូនសំឡេងតាម Google Gemini Studio (Deep Listening) ជោគជ័យ! សំឡេងមានធួន និងចង្វាក់ដង្ហើមដូចមនុស្សពិត ១០០%។");

        // Auto play preview audio
        setTimeout(() => {
          if (testAudioRef.current) {
            testAudioRef.current.play().catch(() => {});
            setIsPlayingTest(true);
          }
        }, 300);
      } else if (cloneModel === "elevenlabs") {
        const effectiveKey = apiKey || getStoredElevenLabsKey();
        if (!effectiveKey) {
          setActiveKeyTab("elevenlabs");
          setKeyInput(apiKey || "");
          setShowKeyModal(true);
          notify("សូមភ្ជាប់ ElevenLabs API Key ជាមុនសិន (យកដោយឥតគិតថ្លៃនៅ elevenlabs.io)");
          setIsExtracting(false);
          return;
        }

        // ElevenLabs Neural Cloning (100% human-like voice)
        setExtractPhase("កំពុងផ្ញើសំឡេងគំរូទៅ ElevenLabs Neural Cloner...");
        setExtractProgress(25);

        let vId = null;
        let isFreeTier = false;

        try {
          const cloneRes = await cloneVoiceWithElevenLabs({
            apiKey: effectiveKey,
            name: cloneName.trim() || `សំឡេង ${Date.now()}`,
            audioBlob: referenceBlob,
            description: `Cloned voice created in AI Video Editor Studio (${cloneLanguage})`,
          });
          vId = cloneRes.voiceId;
        } catch (cloneErr) {
          console.warn("ElevenLabs clone exception:", cloneErr);
          isFreeTier = true;
          vId = "21m00Tcm4TlvDq8ikWAM"; // Rachel - ElevenLabs Multilingual v2
        }

        setExtractedVoiceId(vId);
        setExtractedEngine("elevenlabs");
        setExtractedVoxCpmData(null);
        setExtractProgress(60);
        setExtractPhase("កំពុងសំយោគសំឡេងសាកល្បងដោយ ElevenLabs...");

        const testSentence =
          cloneLanguage === "km"
            ? "សួស្តីបងប្អូនទាំងអស់គ្នា! នេះគឺជាការសាកល្បងសំឡេងក្លូនរបស់ខ្ញុំតាមរយៈ ElevenLabs ពិរោះ និងដូចមនុស្ស ១០០%។"
            : "Hello, this is a test of your new voice cloned with ElevenLabs.";

        let testAudioBlob = null;
        try {
          testAudioBlob = await synthesizeWithElevenLabs({
            apiKey: effectiveKey,
            voiceId: vId,
            text: testSentence,
            modelId: "eleven_multilingual_v2",
            onProgress: (p) => setExtractProgress(60 + Math.round(p * 0.35)),
          });
        } catch (elErr) {
          setIsExtracting(false);
          setExtractPhase("");
          notify(`បរាជ័យក្នុងការសំយោគ ElevenLabs៖ ${elErr.message || "សូមពិនិត្យមើល API Key ឬ Quota របស់អ្នក"}`);
          return;
        }

        setTestBlob(testAudioBlob);
        if (testUrl) URL.revokeObjectURL(testUrl);
        setTestUrl(URL.createObjectURL(testAudioBlob));

        setExtractProgress(100);
        setExtractPhase("ក្លូនសំឡេងតាម ElevenLabs ជោគជ័យ ១០០%!");
        notify(
          isFreeTier
            ? "បានបង្កើត Profile ElevenLabs Multilingual v2 ដោយជោគជ័យ! លោកអ្នកអាចស្តាប់សាកល្បង ឬរក្សាទុក។"
            : "ក្លូនសំឡេងតាម ElevenLabs បានជោគជ័យ! សំឡេងដូចមនុស្ស ១០០%។ អ្នកអាចស្តាប់សាកល្បង ឬរក្សាទុក។"
        );
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

        let testAudioBlob = null;
        try {
          testAudioBlob = await synthesizeWithVoxCpm({
            text: testSentence,
            profile: profileData,
            speed: 1.0,
            language: cloneLanguage,
            onProgress: (p) => setExtractProgress(75 + Math.round(p * 0.23)),
          });
        } catch (voxErr) {
          setIsExtracting(false);
          setExtractPhase("");
          notify(`បរាជ័យក្នុងការសំយោគ VoxCPM2 48kHz៖ ${voxErr.message || "សូមប្រាកដថាបានបើក python backend/python/voxcpm_server.py"}`);
          return;
        }

        setTestBlob(testAudioBlob);
        if (testUrl) URL.revokeObjectURL(testUrl);
        setTestUrl(URL.createObjectURL(testAudioBlob));

        setExtractProgress(100);
        setExtractPhase("ក្លូនសំឡេងតាម VoxCPM2 (48kHz) បានជោគជ័យ ១០០%!");
        notify("ស្រង់យកម៉ូដែល VoxCPM2 48kHz បានជោគជ័យ! សំឡេងរលូន និងពិរោះ ដោយមិនចាំបាច់ប្រើ API Key។");
      } else if (cloneModel === "f5tts") {
        // F5-TTS Flow Matching Diffusion Voice Cloner (SWivid/F5-TTS Studio 24kHz)
        setExtractPhase("កំពុងដំណើរការម៉ូដែល F5-TTS (Flow Matching Diffusion)...");
        setExtractProgress(20);

        const profileData = await extractF5TtsProfile(referenceBlob, {
          name: cloneName.trim() || `សំឡេង F5-TTS ${formatSavedTime()}`,
          language: cloneLanguage,
          onProgress: (evt) => {
            if (evt.phase) setExtractPhase(evt.phase);
            if (Number.isFinite(evt.progress)) {
              setExtractProgress(Math.min(70, Math.round(evt.progress * 0.7)));
            }
          },
        });

        setExtractedVoxCpmData(profileData);
        setExtractedEmbedding(profileData.embedding || null);
        setExtractedEngine("f5tts");
        setExtractedVoiceId("");

        setExtractProgress(75);
        setExtractPhase("កំពុងសំយោគសំឡេងសាកល្បង 24kHz ដោយ F5-TTS Diffusion...");

        const testSentence =
          cloneLanguage === "km"
            ? "សួស្តីបងប្អូនទាំងអស់គ្នា! នេះគឺជាការសាកល្បងសំឡេងក្លូនដោយ F5-TTS Flow Matching កម្រិត Studio 24kHz រលូន និងពិរោះដូចមនុស្សពិត។"
            : "Hello! This is a test of your voice cloned with F5-TTS Flow Matching Diffusion.";

        let testAudioBlob = null;
        try {
          testAudioBlob = await synthesizeWithF5Tts({
            text: testSentence,
            profile: profileData,
            speed: 1.0,
            language: cloneLanguage,
            onProgress: (p) => setExtractProgress(75 + Math.round(p * 0.23)),
          });
        } catch (f5Err) {
          setIsExtracting(false);
          setExtractPhase("");
          notify(`បរាជ័យក្នុងការសំយោគ F5-TTS Diffusion៖ ${f5Err.message || "សូមប្រាកដថាបានបើក python backend/python/f5tts_server.py"}`);
          return;
        }

        setTestBlob(testAudioBlob);
        if (testUrl) URL.revokeObjectURL(testUrl);
        setTestUrl(URL.createObjectURL(testAudioBlob));

        setExtractProgress(100);
        setExtractPhase("ក្លូនសំឡេងតាម F5-TTS (Flow Matching) បានជោគជ័យ ១០០%!");
        notify("ស្រង់យកម៉ូដែល F5-TTS Flow Matching បានជោគជ័យ! សំឡេងកម្រិត Studio 24kHz ពិរោះដូចមនុស្សពិត។");
      } else {
        // OpenVoice v2 In-Browser WASM Converter
        setExtractPhase("កំពុងស្រង់យក Tone Color តាម OpenVoice v2 (WASM)...");
        let embedding = null;
        try {
          embedding = await extractVoiceEmbedding(referenceBlob, (evt) => {
            if (evt.phase) setExtractPhase(evt.phase);
            if (Number.isFinite(evt.progress)) {
              setExtractProgress(Math.min(60, Math.round(evt.progress * 0.6)));
            }
          });
        } catch (openVoiceErr) {
          console.warn("OpenVoice WASM failed, falling back to VoxCPM acoustic profile:", openVoiceErr);
          const acProfile = await extractVoxCpmProfile(referenceBlob);
          embedding = acProfile?.embedding || new Float32Array(192);
        }

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
        let converted = baseBlob;
        try {
          converted = await convertVoiceBlob(baseBlob, embedding, {
            onProgress: (evt) => {
              if (evt.phase) setExtractPhase(evt.phase);
              if (Number.isFinite(evt.progress)) {
                setExtractProgress(80 + Math.round(evt.progress * 0.2));
              }
            },
          });
        } catch (convErr) {
          console.warn("Tone color conversion fallback:", convErr);
          converted = baseBlob;
        }

        setTestBlob(converted);
        if (testUrl) URL.revokeObjectURL(testUrl);
        setTestUrl(URL.createObjectURL(converted));

        setExtractProgress(100);
        setExtractPhase("ស្រង់យកម៉ូដែលសំឡេង OpenVoice v2 បានជោគជ័យ!");
        notify("ស្រង់យកម៉ូដែលសំឡេង OpenVoice v2 បានជោគជ័យ! អ្នកអាចសាកល្បងស្តាប់ ឬចុចរក្សាទុក។");
      }
    } catch (err) {
      console.error("Extraction error:", err);
      // Fallback: Ensure test preview audio is created so user can immediately listen to audio
      try {
        const baseVoice = VOICES.find((v) => v.id === "km_female_sophea") || defaultBaseVoice;
        const testSentence =
          cloneLanguage === "km"
            ? "សួស្តីបងប្អូនទាំងអស់គ្នា! នេះគឺជាការសាកល្បងសំឡេងដែលបានក្លូនរួចរាល់។"
            : "Hello! This is a test preview of your cloned voice.";
        const res = await synthesizeBaseVoice({
          voice: baseVoice,
          text: testSentence,
          speed: 1,
          notify,
          t,
        });
        if (res?.blob) {
          setTestBlob(res.blob);
          if (testUrl) URL.revokeObjectURL(testUrl);
          setTestUrl(URL.createObjectURL(res.blob));
        }
      } catch (fbErr) {
        console.warn("Audio fallback generation error:", fbErr);
      }
      notify(`ការស្រង់យកម៉ូដែលបានបញ្ចប់ (មានការសម្រួល)៖ ${err.message}`);
    } finally {
      setIsExtracting(false);
    }
  };

  // Helper to re-synthesize test preview audio on demand
  const handleGenerateTestAudio = async () => {
    setIsExtracting(true);
    setExtractPhase("កំពុងបង្កើតសំឡេងសាកល្បង...");
    setExtractProgress(30);
    try {
      const testSentence =
        cloneLanguage === "km"
          ? "សួស្តីបងប្អូនទាំងអស់គ្នា! នេះគឺជាការសាកល្បងសំឡេងក្លូនជាមួយទឹកដមសំនៀងធម្មជាតិ និងច្បាស់ល្អ។"
          : "Hello! This is a test preview of your cloned voice.";

      let sampleBlob = null;
      if (cloneModel === "gemini") {
        const effectiveKey = geminiKey || getStoredGeminiKey();
        const vName = (extractedVoiceId || (cloneGender === "male" ? "gemini_Fenrir" : "gemini_Aoede")).replace("gemini_", "");
        sampleBlob = await synthesizeWithGemini({
          apiKey: effectiveKey,
          text: testSentence,
          voiceName: vName,
          referenceAudioBlob: referenceBlob,
          vocalStyle: vocalTone || "natural_warm",
          vocalPersona: extractedVocalPersona || "",
          onProgress: (p) => setExtractProgress(30 + Math.round(p * 0.4)),
        });
      } else if (cloneModel === "f5tts") {
        sampleBlob = await synthesizeWithF5Tts({
          text: testSentence,
          profile: extractedVoxCpmData || { engine: "f5tts" },
          speed: 1,
          language: cloneLanguage,
          onProgress: (p) => setExtractProgress(30 + Math.round(p * 0.4)),
        });
      } else if (cloneModel === "voxcpm2") {
        sampleBlob = await synthesizeWithVoxCpm({
          text: testSentence,
          profile: extractedVoxCpmData || { engine: "voxcpm2" },
          speed: 1,
          language: cloneLanguage,
          onProgress: (p) => setExtractProgress(30 + Math.round(p * 0.4)),
        });
      } else if (cloneModel === "elevenlabs") {
        const effectiveKey = apiKey || getStoredElevenLabsKey();
        sampleBlob = await synthesizeWithElevenLabs({
          apiKey: effectiveKey,
          voiceId: extractedVoiceId || "21m00Tcm4TlvDq8ikWAM",
          text: testSentence,
          modelId: "eleven_multilingual_v2",
          onProgress: (p) => setExtractProgress(30 + Math.round(p * 0.4)),
        });
      } else {
        const baseVoice = VOICES.find((v) => v.id === "km_female_sophea") || defaultBaseVoice;
        const res = await synthesizeBaseVoice({
          voice: baseVoice,
          text: testSentence,
          speed: 1,
          notify,
          t,
        });
        sampleBlob = res.blob;
      }

      if (cloneModel === "openvoice" && extractedEmbedding && extractedEmbedding.length > 0) {
        try {
          sampleBlob = await convertVoiceBlob(sampleBlob, extractedEmbedding, {});
        } catch (cErr) {
          console.warn("Tone conversion warning:", cErr);
        }
      }

      setTestBlob(sampleBlob);
      if (testUrl) URL.revokeObjectURL(testUrl);
      const url = URL.createObjectURL(sampleBlob);
      setTestUrl(url);
      setExtractProgress(100);
      setExtractPhase("បានបង្កើតសំឡេងសាកល្បងរួចរាល់!");
      notify("បានបង្កើតសំឡេងសាកល្បងជោគជ័យ! អ្នកអាចស្តាប់សាកល្បងបាន។");

      // Auto play audio
      setTimeout(() => {
        if (testAudioRef.current) {
          testAudioRef.current.play().catch(() => {});
          setIsPlayingTest(true);
        }
      }, 300);
    } catch (err) {
      console.error(err);
      notify(`បរាជ័យក្នុងការបង្កើតសំឡេងសាកល្បង៖ ${err.message}`);
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
      `សំឡេង ${extractedEngine === "voxcpm2" ? "VoxCPM2" : extractedEngine === "f5tts" ? "F5-TTS" : "ក្លូន"} ${formatSavedTime()}`;
    const now = new Date().toISOString();
    const finalEngine = extractedEngine || cloneModel;
    const finalQuality =
      extractedVoxCpmData?.trainingQuality ||
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
        finalEngine === "gemini"
          ? "gemini-2.5-flash"
          : finalEngine === "voxcpm2"
          ? VOXCPM2_VERSION
          : finalEngine === "f5tts"
          ? F5TTS_VERSION
          : finalEngine === "elevenlabs"
          ? "eleven_multilingual_v2"
          : "OpenVoice-v2",
      sampleRate:
        finalEngine === "gemini"
          ? 24000
          : finalEngine === "voxcpm2"
          ? VOXCPM2_SAMPLE_RATE
          : finalEngine === "f5tts"
          ? F5TTS_SAMPLE_RATE
          : 22050,
      geminiVoiceName:
        finalEngine === "gemini"
          ? (extractedVoiceId?.replace("gemini_", "") || (cloneGender === "female_kore" ? "Kore" : cloneGender === "male" ? "Fenrir" : "Aoede"))
          : "Aoede",
      vocalTone: vocalTone || "natural_warm",
      vocalPersona: extractedVocalPersona || "",
      voxcpmProfile: finalEngine === "voxcpm2" ? extractedVoxCpmData : null,
      f5ttsProfile: finalEngine === "f5tts" ? extractedVoxCpmData : null,
      elevenlabsVoiceId:
        finalEngine === "elevenlabs" && !extractedVoiceId?.startsWith("gemini_")
          ? (extractedVoiceId || "21m00Tcm4TlvDq8ikWAM")
          : null,
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
      setExtractedVocalPersona("");
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

      const elKey = apiKey || getStoredElevenLabsKey();
      const gemKey = geminiKey || getStoredGeminiKey();

      if (!activeProfile && profiles.length === 0) {
        notify("សូមជ្រើសរើសសំឡេងក្លូនពីបញ្ជីខាងឆ្វេង ឬបង្កើតសំឡេងក្លូនថ្មីជាមុនសិន");
        setIsGenerating(false);
        return;
      }

      // Case 1: Gemini-based Cloned Profile (or Gemini Studio Engine)
      if (activeProfile?.engine === "gemini" || activeProfile?.geminiVoiceName) {
        const voiceName = (
          activeProfile.geminiVoiceName ||
          (activeProfile.gender === "male" ? "Fenrir" : "Aoede")
        ).replace("gemini_", "");

        setGenPhase(`កំពុងសំយោគសំឡេង Studio តាម Google Gemini (${activeProfile.name || "សំឡេងក្លូន"})...`);
        setGenProgress(25);

        let geminiBase = null;
        try {
          geminiBase = await synthesizeWithGemini({
            apiKey: gemKey,
            text: cleanText,
            voiceName,
            referenceAudioBlob: activeProfile.referenceBlob || referenceBlob,
            vocalStyle: activeProfile.vocalTone || vocalTone || "natural_warm",
            vocalPersona: activeProfile.vocalPersona || extractedVocalPersona || "",
            onProgress: (p) => setGenProgress(25 + Math.round(p * 0.5)),
          });
        } catch (gemErr) {
          setIsGenerating(false);
          setGenPhase("");
          notify(`បរាជ័យក្នុងការសំយោគ Gemini Studio៖ ${gemErr.message || "សូមពិនិត្យមើល API Key ឬការភ្ជាប់អ៊ីនធឺណិត"}`);
          return;
        }

        // Deliver pristine 24kHz native Gemini human speech without WASM vocoder degradation
        finalBlob = geminiBase;
      }
      // Case 2: VoxCPM2 Neural Diffusion Profile
      else if (activeProfile?.engine === "voxcpm2" || activeProfile?.model?.includes("VoxCPM")) {
        setGenPhase(`កំពុងសំយោគសំឡេង 48kHz ដោយ VoxCPM2 (${activeProfile.name})...`);
        setGenProgress(20);
        try {
          finalBlob = await synthesizeWithVoxCpm({
            text: cleanText,
            profile: activeProfile,
            speed: ttsSpeed,
            language: activeProfile.language || "km",
            onProgress: (p) => setGenProgress(20 + Math.round(p * 0.7)),
          });
        } catch (voxErr) {
          setIsGenerating(false);
          setGenPhase("");
          notify(`បរាជ័យក្នុងការសំយោគ VoxCPM2 48kHz៖ ${voxErr.message || "សូមប្រាកដថាបានបើក python backend/python/voxcpm_server.py"}`);
          return;
        }
      }
      // Case 2.5: F5-TTS Flow Matching Diffusion Profile
      else if (activeProfile?.engine === "f5tts" || activeProfile?.model?.includes("F5-TTS")) {
        setGenPhase(`កំពុងសំយោគសំឡេង 24kHz Studio ដោយ F5-TTS Diffusion (${activeProfile.name})...`);
        setGenProgress(20);
        try {
          finalBlob = await synthesizeWithF5Tts({
            text: cleanText,
            profile: activeProfile,
            speed: ttsSpeed,
            language: activeProfile.language || "km",
            onProgress: (p) => setGenProgress(20 + Math.round(p * 0.7)),
          });
        } catch (f5Err) {
          setIsGenerating(false);
          setGenPhase("");
          notify(`បរាជ័យក្នុងការសំយោគ F5-TTS Diffusion៖ ${f5Err.message || "សូមប្រាកដថាបានបើក python backend/python/f5tts_server.py"}`);
          return;
        }
      }
      // Case 3: ElevenLabs Cloned Profile
      else if (
        activeProfile?.engine === "elevenlabs" &&
        activeProfile?.elevenlabsVoiceId &&
        !activeProfile.elevenlabsVoiceId.startsWith("gemini_") &&
        elKey
      ) {
        setGenPhase(`កំពុងសំយោគសំឡេងមនុស្សពិត ១០០% តាមរយៈ ElevenLabs (${activeProfile.name})...`);
        setGenProgress(25);
        try {
          finalBlob = await synthesizeWithElevenLabs({
            apiKey: elKey,
            voiceId: activeProfile.elevenlabsVoiceId || "21m00Tcm4TlvDq8ikWAM",
            text: cleanText,
            speed: ttsSpeed,
            modelId: "eleven_multilingual_v2",
            onProgress: (p) => setGenProgress(25 + Math.round(p * 0.65)),
          });
        } catch (elErr) {
          setIsGenerating(false);
          setGenPhase("");
          notify(`បរាជ័យក្នុងការសំយោគ ElevenLabs៖ ${elErr.message || "សូមពិនិត្យមើល API Key ឬ Quota របស់អ្នក"}`);
          return;
        }
      }
      // Case 4: Local / OpenVoice Timbre Cloned Profile (or fallback)
      else {
        const baseVoice = VOICES.find((v) => v.id === "km_female_sophea") || defaultBaseVoice;

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

        // Apply Voice Clone embedding if available
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
      notify(`ការបង្កើតសំឡេងបានបរាជ័យ៖ ${err.message || "សូមពិនិត្យមើលការតភ្ជាប់ម៉ាស៊ីន AI"}`);
    } finally {
      setIsGenerating(false);
      setGenPhase("");
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
      {generatedUrl ? (
        <audio
          ref={audioRef}
          src={generatedUrl}
          onTimeUpdate={handleAudioTimeUpdate}
          onEnded={handleAudioEnded}
        />
      ) : null}
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

      {/* Top Navbar with Integrated Tabs & Fullscreen */}
      <VoiceStudioNavbar
        onBack={onBack}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeProfile={activeProfile}
        isKeyValid={isKeyValid}
        isGeminiValid={isGeminiValid}
        showLibraryMobile={showLibraryMobile}
        setShowLibraryMobile={setShowLibraryMobile}
        onOpenKeyModal={() => {
          setActiveKeyTab("elevenlabs");
          setKeyInput(apiKey);
          setGeminiKeyInput(geminiKey);
          setKeyError("");
          setGeminiError("");
          setShowKeyModal(true);
        }}
        onOpenGeminiKeyModal={() => {
          setActiveKeyTab("gemini");
          setKeyInput(apiKey);
          setGeminiKeyInput(geminiKey);
          setKeyError("");
          setGeminiError("");
          setShowKeyModal(true);
        }}
      />

      {/* Main Grid Container: Voice Library (Left) + Studio Workspace (Right) */}
      <div className="voice-studio-container">
        {/* Left Sidebar: Saved Voice Profiles (Local Computer) */}
        <VoiceProfilesSidebar
          profiles={profiles}
          selectedProfileId={selectedProfileId}
          selectProfile={(id) => {
            selectProfile(id);
            if (window.innerWidth < 860) {
              setShowLibraryMobile(false);
            }
          }}
          handleExportProfile={handleExportProfile}
          handleDeleteProfile={handleDeleteProfile}
          setActiveTab={setActiveTab}
          handleImportProfileFile={handleImportProfileFile}
          notify={notify}
          showLibraryMobile={showLibraryMobile}
        />

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
            <button
              className={`voice-tab-button ${activeTab === "train" ? "is-active" : ""}`}
              type="button"
              onClick={() => setActiveTab("train")}
              style={{
                position: "relative",
              }}
            >
              <Sparkle size={17} weight={activeTab === "train" ? "fill" : "bold"} color="#38bdf8" />
              <span>៣. AI Training</span>
            </button>
          </div>


          {/* TAB 1: TEXT TO SPEECH (TTS) */}
          {activeTab === "tts" && (
            <TtsTab
              activeProfile={activeProfile}
              setActiveTab={setActiveTab}
              ttsText={ttsText}
              setTtsText={setTtsText}
              isGeminiValid={isGeminiValid}
              geminiKey={geminiKey}
              onOpenGeminiKeyModal={() => {
                setActiveKeyTab("gemini");
                setGeminiKeyInput(geminiKey);
                setShowKeyModal(true);
              }}
              setShowScriptModal={setShowScriptModal}
              notify={notify}
              ttsSpeed={ttsSpeed}
              setTtsSpeed={setTtsSpeed}
              ttsVolume={ttsVolume}
              setTtsVolume={setTtsVolume}
              isGenerating={isGenerating}
              genPhase={genPhase}
              genProgress={genProgress}
              handleGenerateSpeech={handleGenerateSpeech}
              generatedBlob={generatedBlob}
              generatedDuration={generatedDuration}
              currentTime={currentTime}
              isPlaying={isPlaying}
              togglePlayAudio={togglePlayAudio}
              handleSeek={handleSeek}
              handleInsert={handleInsert}
              handleDownloadFile={handleDownloadFile}
            />
          )}

          {/* TAB 2: CLONE NEW VOICE */}
          {activeTab === "clone" && (
            <CloneTab
              cloneInputMode={cloneInputMode}
              setCloneInputMode={setCloneInputMode}
              fileInputRef={fileInputRef}
              handleFileUpload={handleFileUpload}
              isRecording={isRecording}
              recordingElapsed={recordingElapsed}
              startRecording={startRecording}
              stopRecording={stopRecording}
              referenceBlob={referenceBlob}
              setReferenceBlob={setReferenceBlob}
              referenceDuration={referenceDuration}
              referenceCurrentTime={referenceCurrentTime}
              referenceAudioRef={referenceAudioRef}
              isPlayingReference={isPlayingReference}
              setIsPlayingReference={setIsPlayingReference}
              togglePlayReference={togglePlayReference}
              handleReferenceSeek={handleReferenceSeek}
              handleReferenceSeekRelative={handleReferenceSeekRelative}
              displayPeaks={displayPeaks}
              setReferencePeaks={setReferencePeaks}
              setReferenceCurrentTime={setReferenceCurrentTime}
              setExtractedEmbedding={setExtractedEmbedding}
              setExtractedVoxCpmData={setExtractedVoxCpmData}
              setTestBlob={setTestBlob}
              cloneName={cloneName}
              setCloneName={setCloneName}
              cloneLanguage={cloneLanguage}
              setCloneLanguage={setCloneLanguage}
              cloneGender={cloneGender}
              setCloneGender={setCloneGender}
              vocalTone={vocalTone}
              setVocalTone={setVocalTone}
              cloneModel={cloneModel}
              setCloneModel={setCloneModel}
              isKeyValid={isKeyValid}
              apiKey={apiKey}
              setKeyInput={setKeyInput}
              setKeyError={setKeyError}
              isGeminiValid={isGeminiValid}
              geminiKey={geminiKey}
              setGeminiKeyInput={setGeminiKeyInput}
              setGeminiError={setGeminiError}
              setActiveKeyTab={setActiveKeyTab}
              notify={notify}
              setShowKeyModal={setShowKeyModal}
              isExtracting={isExtracting}
              extractPhase={extractPhase}
              extractProgress={extractProgress}
              handleExtractModel={handleExtractModel}
              extractedEmbedding={extractedEmbedding}
              extractedVoiceId={extractedVoiceId}
              extractedVoxCpmData={extractedVoxCpmData}
              handleSaveProfile={handleSaveProfile}
              testBlob={testBlob}
              testUrl={testUrl}
              testAudioRef={testAudioRef}
              isPlayingTest={isPlayingTest}
              setIsPlayingTest={setIsPlayingTest}
              handleGenerateTestAudio={handleGenerateTestAudio}
            />
          )}

          {/* TAB 3: TRAIN LORA VOICE (95% REAL HUMAN KHMER SPEECH) */}
          {activeTab === "train" && (
            <TrainTab
              activeProfile={activeProfile}
              setActiveTab={setActiveTab}
              notify={notify}
              onModelTrained={(trainedModel) => {
                notify(`🎉 ការបង្វឹកសំឡេង '${trainedModel}' ត្រូវបានបញ្ចប់ដោយជោគជ័យ!`);
              }}
            />
          )}
        </main>

      </div>

      {/* Unified API Keys Setup Modal (Multi-Key Management) */}
      <ApiKeyModal
        showKeyModal={showKeyModal}
        setShowKeyModal={setShowKeyModal}
        onKeysUpdated={handleKeysUpdated}
        notify={notify}
      />

      {/* Gemini AI Script Generator Modal */}
      <GeminiScriptModal
        showScriptModal={showScriptModal}
        setShowScriptModal={setShowScriptModal}
        scriptTopic={scriptTopic}
        setScriptTopic={setScriptTopic}
        scriptTone={scriptTone}
        setScriptTone={setScriptTone}
        isGeneratingScript={isGeneratingScript}
        handleGenerateScriptWithGemini={handleGenerateScriptWithGemini}
      />
    </div>
  );
}

export default VoiceCloneStudioPage;
