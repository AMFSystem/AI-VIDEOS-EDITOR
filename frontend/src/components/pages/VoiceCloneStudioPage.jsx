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
import { synthesizeBaseVoice } from "../../lib/baseVoiceSynthesis.js";
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
  const [activeTab, setActiveTab] = useState("tts"); // 'tts' | 'clone' | 'guide'

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
    "សួស្តីបងប្អូនទាំងអស់គ្នា! នេះគឺជាការសាកល្បងសំឡេង Clone របស់ខ្ញុំ ដំណើរការយ៉ាងរលូន និងពិរោះ។"
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

  // File Reference
  const fileInputRef = useRef(null);
  const [referenceBlob, setReferenceBlob] = useState(null);
  const [referenceUrl, setReferenceUrl] = useState("");
  const [referenceDuration, setReferenceDuration] = useState(0);
  const [isPlayingReference, setIsPlayingReference] = useState(false);
  const referenceAudioRef = useRef(null);

  // Extraction & Test
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
        notify("ឧបករណ៍ថតសំឡេងមិនត្រូវបានគាំទ្រលើកម្មវិធីរុករកនេះទេ / Microphone unsupported");
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
          if (referenceUrl) URL.revokeObjectURL(referenceUrl);
          setReferenceUrl(URL.createObjectURL(blob));
          if (!cloneName) setCloneName(`សំឡេងរបស់ខ្ញុំ ${formatSavedTime()}`);
          notify("បានថតសំឡេងគំរូរួចរាល់! សូមចុចស្រង់យកម៉ូដែលសំឡេង");
        }
      };

      recorder.start(250);
      setIsRecording(true);
      setRecordingElapsed(0);
      const startTime = performance.now();
      recordingTimerRef.current = setInterval(() => {
        setRecordingElapsed((performance.now() - startTime) / 1000);
      }, 200);
    } catch (err) {
      console.error(err);
      notify(`Microphone error: ${err.message}`);
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
      if (referenceUrl) URL.revokeObjectURL(referenceUrl);
      setReferenceUrl(URL.createObjectURL(file));
      if (!cloneName) setCloneName(file.name.replace(/\.[^.]+$/, ""));
      notify(`បានផ្ទុកឡើងឯកសារ: ${file.name} (${formatTime(decoded.duration)})`);
    } catch (err) {
      console.error(err);
      notify(`Error reading audio file: ${err.message}`);
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
    setExtractPhase("កំពុងរៀបចំ និងឌីកូដសំឡេង (Decoding audio)...");

    try {
      // 1. Extract speaker embedding
      const embedding = await extractVoiceEmbedding(referenceBlob, (evt) => {
        if (evt.phase) setExtractPhase(evt.phase);
        if (Number.isFinite(evt.progress)) {
          setExtractProgress(Math.min(60, Math.round(evt.progress * 0.6)));
        }
      });
      setExtractedEmbedding(embedding);
      setExtractProgress(65);
      setExtractPhase("កំពុងបង្កើតសំឡេងសាកល្បង (Generating test clone)...");

      // 2. Synthesize test sentence with base voice
      const baseVoice = VOICES.find((v) => v.id === baseVoiceId) || defaultBaseVoice;
      const testSentence =
        cloneLanguage === "km"
          ? "សួស្តី នេះគឺជាការសាកល្បងសំឡេងក្លូនជាភាសាខ្មែរ។"
          : "Hello, this is a test of your newly cloned voice.";

      const { blob: baseBlob } = await synthesizeBaseVoice({
        voice: baseVoice,
        text: testSentence,
        speed: 1,
        notify,
        t,
        onProgress: (p) => setExtractProgress(65 + Math.round(p * 0.15)),
      });

      // 3. Convert with extracted embedding
      setExtractPhase("កំពុងបម្លែង音色 (Applying Tone Color Transfer)...");
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
      setExtractPhase("ការស្រង់យកម៉ូដែលបានជោគជ័យ 100%!");
      notify("ស្រង់យកម៉ូដែលសំឡេងបានជោគជ័យ! អ្នកអាចសាកល្បងស្តាប់ ឬរក្សាទុកបាន។");
    } catch (err) {
      console.error("Extraction error:", err);
      notify(`Model extraction failed: ${err.message}`);
    } finally {
      setIsExtracting(false);
    }
  };

  // -------------------------------------------------------------------------
  // Save Cloned Profile to Local Storage (IndexedDB)
  // -------------------------------------------------------------------------
  const handleSaveProfile = async () => {
    if (!extractedEmbedding) {
      notify("សូមស្រង់យកម៉ូដែលសំឡេងជាមុនសិន");
      return;
    }
    const finalName = cloneName.trim() || `Cloned Voice ${formatSavedTime()}`;
    const now = new Date().toISOString();
    const newProfile = {
      id: crypto.randomUUID(),
      name: finalName,
      language: cloneLanguage,
      gender: cloneGender,
      sourceKind: cloneInputMode === "record" ? "recording" : "upload",
      referenceBlob,
      testBlob,
      embedding: Float32Array.from(extractedEmbedding),
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

      notify(`បានរក្សាទុក "${finalName}" ក្នុងកុំព្យូទ័ររបស់អ្នកដោយជោគជ័យ!`);
      // Reset clone form and switch to TTS
      setReferenceBlob(null);
      setExtractedEmbedding(null);
      setTestBlob(null);
      setCloneName("");
      setActiveTab("tts");
    } catch (err) {
      console.error(err);
      notify(`Save error: ${err.message}`);
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
      notify(`Delete error: ${err.message}`);
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
      notify(`បាននាំចេញកញ្ចប់ម៉ូដែល: ${profile.name}`);
    } catch (err) {
      console.error(err);
      notify(`Export failed: ${err.message}`);
    }
  };

  const handleImportProfileFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.name || !data.embedding) {
        throw new Error("ទម្រង់ឯកសារមិនត្រឹមត្រូវ / Invalid voice profile JSON");
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
        embedding: Float32Array.from(data.embedding),
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
      notify(`Import error: ${err.message}`);
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
    setGenPhase("កំពុងរៀបចំម៉ូដែលសំឡេង (Preparing model)...");

    try {
      const baseVoice = VOICES.find((v) => v.id === baseVoiceId) || defaultBaseVoice;

      // 1. Synthesize base phonetics
      setGenPhase(
        baseVoice.language === "ភាសាខ្មែរ"
          ? "កំពុងសំយោគសំឡេងមូលដ្ឋានជាភាសាខ្មែរ (Google AI Sophea)..."
          : "កំពុងសំយោគសំឡេងមូលដ្ឋាន (Synthesizing phonetics)..."
      );
      const { blob: baseBlob } = await synthesizeBaseVoice({
        voice: baseVoice,
        text: cleanText,
        speed: ttsSpeed,
        notify,
        t,
        onProgress: (p) => setGenProgress(8 + Math.round(p * 0.45)),
      });

      let finalBlob = baseBlob;

      // 2. Apply Voice Clone embedding if available
      if (activeProfile?.embedding) {
        setGenProgress(58);
        setGenPhase(`កំពុងបម្លែងទៅជាសំឡេង Clone "${activeProfile.name}" (OpenVoice v2)...`);
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

      // 3. Apply volume output gain
      if (ttsVolume !== 1) {
        finalBlob = await applyVoiceOutputGain(finalBlob, ttsVolume);
      }

      // 4. Decode waveform for visualizer & timeline
      setGenProgress(95);
      setGenPhase("កំពុងបង្កើត Waveform និងរួចរាល់...");
      const decoded = await decodeWaveform(finalBlob);

      setGeneratedBlob(finalBlob);
      setGeneratedDuration(decoded.duration);
      setGeneratedPeaks(decoded.peaks);

      if (generatedUrl) URL.revokeObjectURL(generatedUrl);
      const newUrl = URL.createObjectURL(finalBlob);
      setGeneratedUrl(newUrl);

      setGenProgress(100);
      setGenPhase("បង្កើតសំឡេងបានជោគជ័យ!");
      notify(`បង្កើតសំឡេងបានជោគជ័យ! រយៈពេល: ${formatTime(decoded.duration)}`);
    } catch (err) {
      console.error("TTS generation error:", err);
      notify(`Speech synthesis failed: ${err.message}`);
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
    const voiceLabel = activeProfile?.name || "Cloned Voice";
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
    a.download = `${activeProfile?.name || "voice_clone"}_${Date.now()}.wav`;
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
          onEnded={() => setIsPlayingReference(false)}
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
            title="ត្រឡប់ទៅកម្មវិធីកាត់ត (Back to Editor)"
          >
            <ArrowLeft size={16} weight="bold" />
            <span>ត្រឡប់ទៅកាត់ត (Editor)</span>
          </button>
          <div className="voice-studio-nav-divider" />
          <div className="voice-studio-brand">
            <div className="voice-studio-brand-icon">
              <Sparkle size={18} weight="fill" />
            </div>
            <span className="voice-studio-title">AI Voice Clone Studio</span>
            <span className="voice-studio-badge">Local-First AI</span>
          </div>
        </div>

        <div className="voice-studio-nav-right">
          <div className="voice-studio-stat-pill">
            <span className="voice-studio-stat-dot" />
            <span>ម៉ូដែលក្នុងកុំព្យូទ័រ: {profiles.length} សំឡេង</span>
          </div>
          {activeProfile && (
            <div
              className="voice-studio-stat-pill"
              style={{ borderColor: "rgba(56, 189, 248, 0.4)", color: "#38bdf8" }}
            >
              <User size={13} weight="bold" />
              <span>សកម្ម: {activeProfile.name}</span>
            </div>
          )}
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
                <span>សំឡេងក្នុងកុំព្យូទ័រ</span>
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
                <p style={{ fontSize: "12px", margin: 0 }}>
                  ចុចប៊ូតុង "Clone សំឡេងថ្មី" ដើម្បីបង្កើតសំឡេងផ្ទាល់ខ្លួន
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
                      {p.name ? p.name.charAt(0).toUpperCase() : "V"}
                    </div>
                    <div className="voice-profile-info">
                      <div className="voice-profile-name" title={p.name}>
                        {p.name}
                      </div>
                      <div className="voice-profile-meta">
                        <span className="voice-profile-tag">
                          {p.language === "km" ? "ភាសាខ្មែរ" : "English"}
                        </span>
                        <span style={{ fontSize: "10.5px" }}>
                          {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "Local"}
                        </span>
                      </div>
                    </div>
                    <div className="voice-profile-actions">
                      <button
                        className="voice-card-btn btn-export"
                        type="button"
                        title="នាំចេញកញ្ចប់ Backup"
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
              <span>Clone សំឡេងថ្មី (+ New Clone)</span>
            </button>
            <div className="voice-btn-secondary-row">
              <label
                className="voice-btn-secondary"
                style={{ cursor: "pointer", margin: 0 }}
                title="នាំចូលកញ្ចប់សំឡេង .voiceprofile.json"
              >
                <UploadSimple size={14} />
                <span>នាំចូល (Import)</span>
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
              <span>1. Text to Speech (បញ្ចេញសំឡេង)</span>
            </button>
            <button
              className={`voice-tab-button ${activeTab === "clone" ? "is-active" : ""}`}
              type="button"
              onClick={() => setActiveTab("clone")}
            >
              <MicrophoneStage size={17} weight="bold" />
              <span>2. Clone សំឡេងថ្មី (Clone New Voice)</span>
            </button>
            <button
              className={`voice-tab-button ${activeTab === "guide" ? "is-active" : ""}`}
              type="button"
              onClick={() => setActiveTab("guide")}
            >
              <span>3. ការណែនាំ & បច្ចេកវិទ្យា (Guide)</span>
            </button>
          </div>

          {/* TAB 1: TEXT TO SPEECH (TTS) */}
          {activeTab === "tts" && (
            <div className="voice-tab-content">
              {/* Active Voice Banner */}
              <div className="tts-active-voice-banner">
                <div className="tts-voice-lead">
                  <div className="voice-avatar-disc is-active" style={{ width: 44, height: 44 }}>
                    {activeProfile?.name ? activeProfile.name.charAt(0).toUpperCase() : "AI"}
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="tts-voice-title">
                        {activeProfile ? activeProfile.name : "មិនទាន់បានជ្រើសរើសសំឡេង Clone"}
                      </span>
                      <span className="tts-voice-badge">
                        {activeProfile ? "Local Cloned Voice" : "Base Engine"}
                      </span>
                    </div>
                    <span className="tts-voice-sub">
                      {activeProfile
                        ? `សំឡេងនេះត្រូវបានរក្សាទុកក្នុងកុំព្យូទ័ររបស់អ្នក · ភាសា: ${
                            activeProfile.language === "km" ? "ខ្មែរ" : "English"
                          }`
                        : "ជ្រើសរើសសំឡេងពីបញ្ជីខាងឆ្វេង ឬចុច Clone សំឡេងថ្មី"}
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
                  <span>Clone សំឡេងមួយទៀត</span>
                </button>
              </div>

              {/* Text Input Card */}
              <div className="tts-input-card">
                <div className="tts-input-header">
                  <label className="tts-input-label">
                    <Waveform size={17} color="#38bdf8" />
                    <span>បញ្ចូលអត្ថបទដែលត្រូវនិយាយ (Script)</span>
                  </label>
                  <span className="tts-char-count">{ttsText.length} តួអក្សរ</span>
                </div>

                <textarea
                  className="tts-textarea"
                  rows={4}
                  placeholder="វាយបញ្ចូលអត្ថបទជាភាសាខ្មែរ ឬអង់គ្លេសនៅទីនេះ..."
                  value={ttsText}
                  onChange={(e) => setTtsText(e.target.value)}
                />

                {/* Quick Templates */}
                <div className="tts-templates-row">
                  <span className="tts-template-label">គំរូអត្ថបទរហ័ស:</span>
                  <button
                    className="tts-template-chip"
                    type="button"
                    onClick={() =>
                      setTtsText("សួស្តីបងប្អូនទាំងអស់គ្នា! សូមស្វាគមន៍មកកាន់វីដេអូថ្មីរបស់យើងខ្ញុំ។")
                    }
                  >
                    👋 ស្វាគមន៍ (Greeting)
                  </button>
                  <button
                    className="tts-template-chip"
                    type="button"
                    onClick={() =>
                      setTtsText("សូមជួយចុច Like, Share និង Subscribe ដើម្បីទទួលបានចំណេះដឹងថ្មីៗ!")
                    }
                  >
                    ⭐ Like & Subscribe
                  </button>
                  <button
                    className="tts-template-chip"
                    type="button"
                    onClick={() =>
                      setTtsText("រឿងនិទាននេះនិយាយអំពីការតស៊ូព្យាយាម និងភាពជោគជ័យដ៏អស្ចារ្យ។")
                    }
                  >
                    📖 និទានរឿង (Story)
                  </button>
                </div>
              </div>

              {/* Voice Controls Grid */}
              <div className="tts-controls-grid">
                <div className="tts-control-item">
                  <label>
                    <span>ម៉ាស៊ីនមូលដ្ឋាន (Base Engine)</span>
                  </label>
                  <select value={baseVoiceId} onChange={(e) => setBaseVoiceId(e.target.value)}>
                    <option value="km_KH-mms-medium">🇰🇭 Google Khmer AI (Sophea)</option>
                    <option value="af_heart">🇺🇸 Kokoro English (Heart)</option>
                    <option value="am_fenrir">🇺🇸 Kokoro English (Fenrir)</option>
                    <option value="zh_f_qinglan">🇨🇳 Hojo Chinese (Qinglan)</option>
                  </select>
                </div>

                <div className="tts-control-item">
                  <label>
                    <span>ល្បឿននិយាយ (Speed)</span>
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
                    <span>កម្រិតសម្លេង (Volume)</span>
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
                    <span>បង្កើតសំឡេងជាមួយ Voice Clone (Generate Speech)</span>
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
                      <span>សំឡេងបានបង្កើតរួចរាល់ ({formatTime(generatedDuration)})</span>
                    </div>
                    <span style={{ fontSize: "12px", color: "#64748b" }}>
                      WAV 22kHz · Stereo
                    </span>
                  </div>

                  {/* Audio Controls */}
                  <div className="tts-player-controls">
                    <button
                      className="tts-play-btn"
                      type="button"
                      onClick={togglePlayAudio}
                      title={isPlaying ? "ផ្អាក (Pause)" : "ចាក់ស្តាប់ (Play)"}
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
                      <span>បញ្ចូលទៅកាន់ Timeline & បើកកាត់ត (Insert & Go to Editor)</span>
                    </button>

                    <button
                      className="tts-btn-insert-assets"
                      type="button"
                      title="រក្សាទុកក្នុង Media Bin ដោយមិនបិទទំព័រនេះ"
                      onClick={() => handleInsert(false)}
                    >
                      <FloppyDisk size={16} />
                      <span>ដាក់ក្នុង Media Bin</span>
                    </button>

                    <button
                      className="tts-btn-download-audio"
                      type="button"
                      title="ទាញយកឯកសារជា WAV"
                      onClick={handleDownloadFile}
                    >
                      <DownloadSimple size={16} />
                      <span>ទាញយក WAV</span>
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
                    <span className="clone-step-num">1</span>
                    <span>ជ្រើសរើសប្រភពសំឡេងគំរូ (Sample Audio Reference)</span>
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
                      <span className="clone-choice-title">ថតសំឡេងផ្ទាល់ (Record Mic)</span>
                      <span className="clone-choice-desc">
                        ថតសំឡេងនិយាយរបស់អ្នកផ្ទាល់តាមរយៈ Microphone ចន្លោះពី 5 ទៅ 30 វិនាទី
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
                      <span className="clone-choice-title">ផ្ទុកឡើងឯកសារ (Upload Audio)</span>
                      <span className="clone-choice-desc">
                        ជ្រើសរើសឯកសារសំឡេងច្បាស់ល្អ (.mp3, .wav, .m4a) ពីកុំព្យូទ័ររបស់អ្នក
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
                      <span style={{ fontSize: "12.5px", color: isRecording ? "#ef4444" : "#94a3b8" }}>
                        {isRecording
                          ? "កំពុងថតសំឡេង... សូមនិយាយឱ្យច្បាស់ និងកុំឱ្យមានសម្លេងរំខាន"
                          : "ចុចប៊ូតុងខាងក្រោមដើម្បីចាប់ផ្តើមថត (5 ទៅ 30 វិនាទី)"}
                      </span>
                      <div className="live-recorder-btns-row">
                        {!isRecording ? (
                          <button
                            className="btn-extract-voice"
                            type="button"
                            onClick={startRecording}
                            style={{ padding: "10px 22px" }}
                          >
                            <Microphone size={18} weight="fill" />
                            <span>ចាប់ផ្តើមថត (Start Recording)</span>
                          </button>
                        ) : (
                          <button
                            className="btn-stop-recording"
                            type="button"
                            onClick={stopRecording}
                          >
                            <Pause size={18} weight="fill" />
                            <span>បញ្ឈប់ការថត (Stop & Save Sample)</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Reference Audio Preview */}
                  {referenceBlob && (
                    <div
                      style={{
                        padding: "12px 16px",
                        borderRadius: "10px",
                        background: "rgba(56, 189, 248, 0.08)",
                        border: "1px solid rgba(56, 189, 248, 0.25)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <button
                          className="voice-card-btn btn-play"
                          type="button"
                          onClick={() => {
                            if (!referenceAudioRef.current) return;
                            if (isPlayingReference) {
                              referenceAudioRef.current.pause();
                              setIsPlayingReference(false);
                            } else {
                              referenceAudioRef.current.play();
                              setIsPlayingReference(true);
                            }
                          }}
                        >
                          {isPlayingReference ? <Pause size={14} /> : <Play size={14} />}
                        </button>
                        <div>
                          <strong style={{ fontSize: "13.5px", color: "#f8fafc" }}>
                            សំឡេងគំរូបានជ្រើសរើស ({formatTime(referenceDuration)})
                          </strong>
                          <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                            ត្រៀមខ្លួនសម្រាប់ស្រង់យក Voice Timbre
                          </div>
                        </div>
                      </div>

                      <button
                        className="voice-card-btn btn-del"
                        type="button"
                        onClick={() => {
                          setReferenceBlob(null);
                          setExtractedEmbedding(null);
                          setTestBlob(null);
                        }}
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Step 2: Profile Details */}
                <div className="clone-section-step">
                  <div className="clone-step-title">
                    <span className="clone-step-num">2</span>
                    <span>កំណត់ព័ត៌មានសំឡេង (Profile Details)</span>
                  </div>

                  <div className="clone-form-grid">
                    <div className="clone-form-field">
                      <label>ឈ្មោះសំឡេង (Voice Name)</label>
                      <input
                        className="clone-form-input"
                        type="text"
                        placeholder="ឧទាហរណ៍៖ សំឡេងកញ្ញា សុភា, សំឡេងរបស់ខ្ញុំ..."
                        value={cloneName}
                        onChange={(e) => setCloneName(e.target.value)}
                      />
                    </div>

                    <div className="clone-form-field">
                      <label>ភាសាគោលដៅ (Target Language)</label>
                      <select
                        className="clone-form-select"
                        value={cloneLanguage}
                        onChange={(e) => setCloneLanguage(e.target.value)}
                      >
                        <option value="km">ភាសាខ្មែរ (Khmer)</option>
                        <option value="en">English (អង់គ្លេស)</option>
                        <option value="zh">中文 (Chinese)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Step 3: Extract & Test */}
                <div className="clone-section-step">
                  <div className="clone-step-title">
                    <span className="clone-step-num">3</span>
                    <span>ស្រង់យកម៉ូដែល & រក្សាទុកក្នុងកុំព្យូទ័រ (Train & Save)</span>
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
                            {extractedEmbedding
                              ? "ស្រង់យកម៉ូដែលម្តងទៀត (Re-extract)"
                              : "ស្រង់យកម៉ូដែលសំឡេង (Extract Voice Model)"}
                          </span>
                        </>
                      )}
                    </button>

                    {extractedEmbedding && (
                      <button
                        className="btn-save-clone-local"
                        type="button"
                        onClick={handleSaveProfile}
                      >
                        <FloppyDisk size={18} weight="fill" />
                        <span>រក្សាទុកក្នុងកុំព្យូទ័រ (Save to Local Storage)</span>
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
                            សាកល្បងស្តាប់សំឡេង Clone (Test Sample)
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
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: GUIDE & TECH INFO */}
          {activeTab === "guide" && (
            <div className="voice-tab-content">
              <div className="guide-card">
                <h3 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 10px 0" }}>
                  💡 គន្លឹះដើម្បី Clone សំឡេងបានដូចមនុស្ស 100% និងច្បាស់ល្អ
                </h3>

                <div className="guide-step-row">
                  <div className="guide-icon-badge">1</div>
                  <div className="guide-text">
                    <h4>ថតក្នុងបន្ទប់ស្ងប់ស្ងាត់ (Quiet Environment)</h4>
                    <p>
                      សូមថតសំឡេងនៅក្នុងបន្ទប់ដែលគ្មានសម្លេងរំខាន គ្មានកង្ហារ ឬម៉ាស៊ីនត្រជាក់បន្លឺខ្លាំង
                      និងគ្មានសម្លេងអេកូ (Echo)។
                    </p>
                  </div>
                </div>

                <div className="guide-step-row">
                  <div className="guide-icon-badge">2</div>
                  <div className="guide-text">
                    <h4>រយៈពេលសមស្របចន្លោះពី 10 ទៅ 30 វិនាទី</h4>
                    <p>
                      មិនចាំបាច់ថតយូរពេកទេ ចន្លោះពី 10 ទៅ 25 វិនាទីគឺគ្រប់គ្រាន់ឱ្យ AI ស្រង់យក
                      Tone Color (Timbre) របស់សំឡេងអ្នកបានយ៉ាងច្បាស់។
                    </p>
                  </div>
                </div>

                <div className="guide-step-row">
                  <div className="guide-icon-badge">3</div>
                  <div className="guide-text">
                    <h4>រក្សាទុកក្នុង Local Computer 100% (Offline & Privacy)</h4>
                    <p>
                      រាល់ម៉ូដែល និងសំឡេងដែលអ្នក Clone ត្រូវបានរក្សាទុកដោយផ្ទាល់ក្នុង Browser
                      IndexedDB លើកុំព្យូទ័ររបស់អ្នក មិនមានការ Upload ទៅ Server ក្រៅឡើយ
                      អ្នកអាចប្រើប្រាស់បានជារៀងរហូត។
                    </p>
                  </div>
                </div>

                <div className="guide-step-row">
                  <div className="guide-icon-badge">4</div>
                  <div className="guide-text">
                    <h4>ការទាញបញ្ចូលទៅកាន់ Timeline</h4>
                    <p>
                      បន្ទាប់ពីអ្នកវាយអត្ថបទ និងចុច "បង្កើតសំឡេង" រួច អ្នកគ្រាន់តែចុចប៊ូតុង "បញ្ចូលទៅកាន់
                      Timeline" នោះសំឡេងនឹងលោតចូលទៅក្នុងបន្ទាត់សំឡេង (Audio Track)
                      នៃគម្រោងវីដេអូរបស់អ្នកដោយស្វ័យប្រវត្តិ!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default VoiceCloneStudioPage;
