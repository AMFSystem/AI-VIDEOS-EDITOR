import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Play,
  Pause,
  ArrowCounterClockwise,
  UploadSimple,
  DownloadSimple,
  Microphone,
  SpeakerHigh,
  Waveform,
  Sliders,
  CheckCircle,
  Lightning,
  Sparkle,
  FilmStrip,
  ArrowsClockwise,
  Stop,
  Eye,
  EyeSlash,
  CaretDown,
  Plus,
  Trash,
  FloppyDisk,
  Check,
  X,
} from "@phosphor-icons/react";
import {
  VOICE_FL_PRESETS,
  DEFAULT_FL_SETTINGS,
  ORIGINAL_RAW_SETTINGS,
  createVoiceFLGraph,
  renderMasteredAudioOffline,
} from "../../lib/voiceFLAudioEngine.js";
import { analyzeAudioUrl } from "../../lib/aiAudioAnalysis.js";
import "./VoiceFLRack.css";

export function VoiceFLRack({
  initialAudioUrl = null,
  initialAudioName = "Audio Clip",
  activeTimelineSegment = null,
  timelineCurrentTime = null,
  timelineIsPlaying = false,
  onTimelineTogglePlay = null,
  onTimelineSeek = null,
  initialSettings = null,
  initialBypassed = false,
  onLiveSettingsChange = null,
  onUpdateTimelineSegment = null,
  onRestoreOriginal = null,
  voiceProfiles = [],
  onInsertToTimeline = null,
  onSaveToLibrary = null,
  notify = console.log,
}) {
  // Preset & Active Settings
  const [activePresetId, setActivePresetId] = useState("podcast_studio_master");
  const [settings, setSettings] = useState(() => initialSettings || DEFAULT_FL_SETTINGS);
  const [isBypassed, setIsBypassed] = useState(() => Boolean(initialBypassed)); // A/B Testing
  const [isPresetDropdownOpen, setIsPresetDropdownOpen] = useState(false);
  const presetDropdownRef = useRef(null);
  const liveTimerRef = useRef(null);
  const savedMasterSettingsRef = useRef(null);

  // Custom Presets Management (Persistent in localStorage)
  const [customPresets, setCustomPresets] = useState(() => {
    try {
      const saved = localStorage.getItem("vfl_custom_presets_v1");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const saveCustomPresets = (nextPresets) => {
    setCustomPresets(nextPresets);
    try {
      localStorage.setItem("vfl_custom_presets_v1", JSON.stringify(nextPresets));
    } catch (e) {
      console.warn("Failed to persist custom presets:", e);
    }
  };

  const allPresets = useMemo(() => {
    return [...customPresets, ...VOICE_FL_PRESETS];
  }, [customPresets]);

  const activePreset = useMemo(
    () => allPresets.find((p) => p.id === activePresetId) || allPresets[0] || VOICE_FL_PRESETS[0],
    [allPresets, activePresetId]
  );

  const isSettingsModified = useMemo(() => {
    if (!activePreset?.settings) return false;
    return Object.keys(activePreset.settings).some((key) => {
      return activePreset.settings[key] !== settings[key];
    });
  }, [activePreset, settings]);

  // AI Audio Analysis State
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const [aiReport, setAiReport] = useState(null);
  const [showAiModal, setShowAiModal] = useState(false);

  // Custom Preset Creation State
  const [isCreatingPreset, setIsCreatingPreset] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (presetDropdownRef.current && !presetDropdownRef.current.contains(e.target)) {
        setIsPresetDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Audio Playback & Web Audio State
  const [audioUrl, setAudioUrl] = useState(initialAudioUrl);
  const [audioName, setAudioName] = useState(initialAudioName);

  // Sync when timeline selection changes
  useEffect(() => {
    if (initialAudioUrl) {
      setAudioUrl(initialAudioUrl);
      if (initialAudioName) setAudioName(initialAudioName);
    }
  }, [initialAudioUrl, initialAudioName]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLooping, setIsLooping] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);

  // Source selection modal/dropdown
  const [showVoiceSelect, setShowVoiceSelect] = useState(false);

  // Timeline Clip & Synced Playback Timing
  const clipStart = Number(activeTimelineSegment?.start) || 0;
  const clipDuration = Number(activeTimelineSegment?.duration) || Number(duration) || 0;
  const hasTimelineSegment = Boolean(activeTimelineSegment);

  const isInside = hasTimelineSegment && typeof timelineCurrentTime === "number"
    ? (timelineCurrentTime >= (clipStart - 0.04) && timelineCurrentTime <= (clipStart + clipDuration + 0.05))
    : false;

  let currentClipTime = currentTime;
  let isEffectivePlaying = isPlaying;

  if (hasTimelineSegment && typeof timelineCurrentTime === "number") {
    currentClipTime = isInside
      ? Math.max(0, Math.min(clipDuration, timelineCurrentTime - clipStart))
      : (timelineCurrentTime < clipStart ? 0 : clipDuration);
    isEffectivePlaying = Boolean(timelineIsPlaying && isInside);
  }

  // Audio Context & Graph References
  const audioContextRef = useRef(null);
  const audioElementRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const rackRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordChunksRef = useRef([]);
  const recordTimerRef = useRef(null);

  // Initialize or update active audio context
  const getOrCreateAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioCtx();
    }
    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  // Sync settings whenever active clip changes
  useEffect(() => {
    if (activeTimelineSegment?.flSettings) {
      setSettings(activeTimelineSegment.flSettings);
    } else if (activeTimelineSegment?.isFlBypassed || activeTimelineSegment?.flSettings === null) {
      setSettings(ORIGINAL_RAW_SETTINGS);
      setActivePresetId("original_raw_voice");
    } else if (initialSettings) {
      setSettings(initialSettings);
    }
    if (activeTimelineSegment?.isFlBypassed !== undefined) {
      setIsBypassed(Boolean(activeTimelineSegment.isFlBypassed));
    }
  }, [activeTimelineSegment?.id, activeTimelineSegment?.flSettings, activeTimelineSegment?.isFlBypassed, initialSettings]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (liveTimerRef.current) clearTimeout(liveTimerRef.current);
    };
  }, []);

  const emitLiveChange = useCallback((nextSettings, nextBypassed) => {
    if (typeof onLiveSettingsChange !== "function") return;
    if (liveTimerRef.current) clearTimeout(liveTimerRef.current);
    liveTimerRef.current = setTimeout(() => {
      onLiveSettingsChange(nextSettings, nextBypassed);
    }, 25);
  }, [onLiveSettingsChange]);

  const emitImmediateLiveChange = useCallback((nextSettings, nextBypassed) => {
    if (typeof onLiveSettingsChange !== "function") return;
    if (liveTimerRef.current) clearTimeout(liveTimerRef.current);
    onLiveSettingsChange(nextSettings, nextBypassed);
  }, [onLiveSettingsChange]);

  // Update Settings helper with live Timeline sync
  const handleSettingChange = (key, value) => {
    setSettings((prev) => {
      const updated = { ...prev, [key]: value };
      if (rackRef.current) {
        rackRef.current.updateSettings(updated, isBypassed);
      }
      emitLiveChange(updated, isBypassed);
      return updated;
    });
  };

  // Switch Presets with immediate Timeline sync
  const handleSelectPreset = (preset) => {
    setActivePresetId(preset.id);
    setSettings(preset.settings);
    const isOriginal = preset.id === "original_raw_voice";
    const nextBypass = isOriginal;
    setIsBypassed(nextBypass);
    if (rackRef.current) {
      rackRef.current.updateSettings(preset.settings, nextBypass);
      if (typeof rackRef.current.setBypassed === "function") {
        rackRef.current.setBypassed(nextBypass);
      }
    }
    emitImmediateLiveChange(preset.settings, nextBypass);
    if (isOriginal && typeof onRestoreOriginal === "function") {
      onRestoreOriginal();
    }
    setIsPresetDropdownOpen(false);
    notify(isOriginal ? "📻 បានប្តូរទៅសំឡេងដើម Original Voice 100%" : `🎛️ បានអនុវត្ត Preset: ${preset.nameKm || preset.name}`);
  };

  // AI Audio Analysis & Auto-Master Action
  const handleRunAiAnalysis = async () => {
    if (!audioUrl) {
      notify("⚠️ សូមជ្រើសរើសសំឡេង ឬ Clip នៅលើ Timeline ជាមុនសិន");
      return;
    }
    setIsAiAnalyzing(true);
    notify("🤖 AI កំពុងវិភាគប្រេកង់ និង acoustic សំឡេង...");
    try {
      const ctx = getOrCreateAudioContext();
      const report = await analyzeAudioUrl(audioUrl, ctx);

      // Apply generated settings live immediately
      setSettings(report.generatedSettings);
      if (rackRef.current) {
        rackRef.current.updateSettings(report.generatedSettings, isBypassed);
      }
      emitImmediateLiveChange(report.generatedSettings, isBypassed);

      // Save as AI Podcast Master in custom presets
      const aiPresetId = "ai_podcast_master";
      const aiPreset = {
        id: aiPresetId,
        name: "AI Studio Podcast",
        nameKm: "ផតខាស វិភាគដោយ AI",
        icon: "🤖",
        desc: "Preset វិភាគដោយ AI ពិសេសសម្រាប់ Voice នេះ (កែសម្រួលបន្ថែមបាន)",
        settings: { ...report.generatedSettings },
        isCustom: true,
        isAiGenerated: true,
      };

      const next = [aiPreset, ...customPresets.filter((p) => p.id !== aiPresetId)];
      saveCustomPresets(next);
      setActivePresetId(aiPresetId);

      setAiReport(report);
      setShowAiModal(true);
      notify("✨ AI បានវិភាគ និង Master សំឡេងទៅជា Studio Podcast 100% រួចរាល់!");
    } catch (err) {
      console.error("AI Analysis failed:", err);
      notify("⚠️ មិនអាចវិភាគសំឡេងបានទេ: " + (err.message || "Error"));
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  const handleSaveAsCustomPreset = () => {
    const trimmed = newPresetName.trim();
    if (!trimmed) {
      notify("⚠️ សូមបញ្ចូលឈ្មោះ Preset");
      return;
    }
    const id = `custom_${Date.now()}`;
    const newPreset = {
      id,
      name: trimmed,
      nameKm: trimmed,
      icon: "⭐",
      desc: "Preset កែសម្រួលផ្ទាល់ខ្លួន",
      settings: { ...settings },
      isCustom: true,
    };
    const next = [newPreset, ...customPresets];
    saveCustomPresets(next);
    setActivePresetId(id);
    setIsCreatingPreset(false);
    setNewPresetName("");
    notify(`💾 បានរក្សាទុក Preset ផ្ទាល់ខ្លួន: ${trimmed}`);
  };

  const handleUpdateCurrentCustomPreset = () => {
    if (!activePreset?.isCustom) return;
    const updated = customPresets.map((p) =>
      p.id === activePreset.id ? { ...p, settings: { ...settings } } : p
    );
    saveCustomPresets(updated);
    notify(`💾 បាន Update ការកែប្រែទៅលើ Preset: ${activePreset.name}`);
  };

  const handleDeleteCustomPreset = (id, e) => {
    if (e) e.stopPropagation();
    const target = customPresets.find((p) => p.id === id);
    const filtered = customPresets.filter((p) => p.id !== id);
    saveCustomPresets(filtered);
    if (activePresetId === id) {
      setActivePresetId(VOICE_FL_PRESETS[0].id);
      setSettings(VOICE_FL_PRESETS[0].settings);
      if (rackRef.current) rackRef.current.updateSettings(VOICE_FL_PRESETS[0].settings, isBypassed);
      emitImmediateLiveChange(VOICE_FL_PRESETS[0].settings, isBypassed);
    }
    notify(`🗑️ បានលុប Preset "${target?.name || "Custom"}"`);
  };

  // Dedicated Original Voice Activation & Reversion (100% Real Time)
  const handleActivateOriginalVoice = () => {
    if (!isBypassed) {
      // Remember current master settings so user can switch back seamlessly
      savedMasterSettingsRef.current = { ...settings };

      // Revert settings to clean 0dB raw values
      const rawSettings = { ...ORIGINAL_RAW_SETTINGS };
      setSettings(rawSettings);
      setActivePresetId("original_raw_voice");
      setIsBypassed(true);

      // Realtime audio graph bypass
      if (rackRef.current) {
        rackRef.current.updateSettings(rawSettings, true);
        if (typeof rackRef.current.setBypassed === "function") {
          rackRef.current.setBypassed(true);
        }
      }

      // Realtime timeline synchronization
      emitImmediateLiveChange(rawSettings, true);

      // If active timeline segment was previously modified/baked, revert to pristine original source clip
      if (typeof onRestoreOriginal === "function") {
        onRestoreOriginal();
      }

      notify("📻 បានត្រឡប់មកសំឡេងដើម Original Voice 100% (គ្មាន Effects)");
    } else {
      // Toggle back to FL Mastered mode
      const restoredSettings = savedMasterSettingsRef.current || DEFAULT_FL_SETTINGS;
      setSettings(restoredSettings);
      setActivePresetId("podcast_studio_master");
      setIsBypassed(false);

      if (rackRef.current) {
        rackRef.current.updateSettings(restoredSettings, false);
        if (typeof rackRef.current.setBypassed === "function") {
          rackRef.current.setBypassed(false);
        }
      }

      emitImmediateLiveChange(restoredSettings, false);
      notify("✨ បានបើកដំណើរការ Voice FL Studio Master ឡើងវិញ");
    }
  };

  // Toggle A/B Bypass with immediate Timeline sync
  const handleToggleBypass = () => {
    handleActivateOriginalVoice();
  };

  // Setup Web Audio Node graph with Audio element
  useEffect(() => {
    if (!audioUrl) return;

    const ctx = getOrCreateAudioContext();
    const audioEl = audioElementRef.current;
    if (!audioEl) return;

    // Disconnect old source node if present
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect();
      } catch (_) {}
    }

    try {
      const source = ctx.createMediaElementSource(audioEl);
      sourceNodeRef.current = source;

      const rack = createVoiceFLGraph(ctx, settings);
      rackRef.current = rack;

      source.connect(rack.inputNode);
      rack.outputNode.connect(ctx.destination);
    } catch (err) {
      // Audio element may already be connected
      console.warn("[VoiceFLRack] Audio source connection notice:", err);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [audioUrl, getOrCreateAudioContext]);

  // Live Spectrum Visualizer loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      // Background Grid (FL Studio Edison style)
      ctx.fillStyle = "#0c0f14";
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 30) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      const analyser = rackRef.current?.analyserNode;
      const isAnyPlaying = isPlaying || isEffectivePlaying;
      if (!isAnyPlaying) {
        // Draw static center line
        ctx.strokeStyle = "rgba(0, 229, 255, 0.25)";
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
        return;
      }

      const bufferLength = analyser?.frequencyBinCount || 64;
      const dataArray = new Uint8Array(bufferLength);
      if (analyser) analyser.getByteFrequencyData(dataArray);

      // If playing via Timeline WebAudio, generate lively responsive EQ harmonics if analyser has no local data
      const hasRealAudio = dataArray.some((val) => val > 0);
      if (!hasRealAudio && isEffectivePlaying) {
        const timeNow = performance.now() / 250;
        const lowGain = (settings?.eqLow || 0) + 12;
        const midGain = (settings?.eqMid || 0) + 12;
        const highGain = (settings?.eqHigh || 0) + 12;
        for (let i = 0; i < bufferLength; i++) {
          const normIdx = i / bufferLength;
          const weight = normIdx < 0.33 ? (lowGain / 24) : (normIdx < 0.66 ? (midGain / 24) : (highGain / 24));
          const wave = Math.sin(timeNow + i * 0.35) * 0.45 + Math.cos(timeNow * 1.6 + i * 0.2) * 0.3 + 0.45;
          dataArray[i] = Math.max(15, Math.min(235, Math.floor(wave * 180 * Math.max(0.4, weight))));
        }
      }

      // Draw FL Studio Fruity Parametric EQ 2 glowing spectrum curve
      const gradient = ctx.createLinearGradient(0, height, 0, 0);
      gradient.addColorStop(0, "rgba(255, 112, 67, 0.1)");
      gradient.addColorStop(0.5, "rgba(0, 229, 255, 0.3)");
      gradient.addColorStop(1, "rgba(118, 255, 3, 0.6)");

      ctx.beginPath();
      ctx.moveTo(0, height);

      const sliceWidth = (width * 1.0) / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 255.0;
        const y = height - v * (height * 0.92);

        if (i === 0) {
          ctx.lineTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }

      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();

      // Top glowing stroke
      ctx.strokeStyle = "#00e5ff";
      ctx.lineWidth = 1.8;
      ctx.shadowColor = "#00e5ff";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 255.0;
        const y = height - v * (height * 0.92);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.stroke();
      ctx.shadowBlur = 0; // reset
    };

    draw();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, isEffectivePlaying, settings]);

  // Handle Play/Pause
  const handleTogglePlay = async () => {
    const audioEl = audioElementRef.current;
    if (!audioEl) return;

    getOrCreateAudioContext();

    if (isPlaying) {
      audioEl.pause();
      setIsPlaying(false);
    } else {
      try {
        await audioEl.play();
        setIsPlaying(true);
      } catch (err) {
        console.warn("Playback blocked or failed:", err);
      }
    }
  };

  // Upload custom audio file
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    setAudioName(file.name.replace(/\.[^/.]+$/, ""));
    setIsPlaying(false);
    notify(`📁 បានបញ្ចូលសំឡេង: ${file.name}`);
  };

  // Pick voice from Voice Studio Library
  const handleSelectFromLibrary = (profile) => {
    if (!profile) return;
    const sample = profile.sampleUrl || profile.audioUrl || profile.referenceAudio;
    if (sample) {
      setAudioUrl(sample);
      setAudioName(profile.name || "Library Voice");
      setShowVoiceSelect(false);
      setIsPlaying(false);
      notify(`🎙️ បានជ្រើសរើសសំឡេងពី Library: ${profile.name}`);
    } else {
      notify("⚠️ សំឡេងនេះមិនមាន Audio Sample សម្រាប់ចាក់តេស្តទេ");
    }
  };

  // Live Voice Recording (Edison mic record)
  const handleStartRecord = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      recordChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordChunksRef.current, { type: "audio/wav" });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setAudioName(`Live Record ${new Date().toLocaleTimeString()}`);
        setIsRecording(false);
        setIsPlaying(false);
        stream.getTracks().forEach((track) => track.stop());
        notify("🎙️ បានថតសំឡេងរួចរាល់! អាចកែច្នៃជាមួយ FL Master បានហើយ");
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordDuration(0);

      recordTimerRef.current = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      notify("⚠️ មិនអាចបើក Microphone បានទេ: " + err.message);
    }
  };

  const handleStopRecord = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    }
  };

  // Render & Export Mastered Audio
  const handleRenderMastered = async () => {
    if (!audioUrl) {
      notify("⚠️ សូមបញ្ចូលសំឡេងជាមុនសិន");
      return;
    }

    setIsProcessing(true);
    notify("⏳ កំពុង Master សំឡេងជាមួយ Voice FL Engine...");

    try {
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const ctx = getOrCreateAudioContext();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      // Render high-fidelity 48kHz WAV
      const masteredBlob = await renderMasteredAudioOffline(audioBuffer, settings);
      const masteredUrl = URL.createObjectURL(masteredBlob);

      setIsProcessing(false);
      notify("✨ បាន Master សំឡេងដោយជោគជ័យ! សំឡេងច្បាស់ល្អ 100%");
      return { blob: masteredBlob, url: masteredUrl };
    } catch (err) {
      setIsProcessing(false);
      notify("⚠️ បរាជ័យក្នុងការ Master: " + err.message);
      return null;
    }
  };

  // Download Action
  const handleDownload = async () => {
    const res = await handleRenderMastered();
    if (!res) return;

    const a = document.createElement("a");
    a.href = res.url;
    a.download = `${audioName}_VoiceFL_Mastered.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    notify("💾 បានទាញយក Audio Mastered រួចរាល់!");
  };

  // Apply Mastered FL directly to Timeline Segment or Insert as New Clip
  const handleApplyToTimelineAction = async () => {
    const res = await handleRenderMastered();
    if (!res) return;

    if (typeof onUpdateTimelineSegment === "function") {
      onUpdateTimelineSegment({
        blob: res.blob,
        url: res.url,
        name: `${audioName} [FL Master]`,
        settings,
      });
      notify("⚡ បាន Update សំឡេង Master ទៅកាន់ Timeline ដោយជោគជ័យ!");
      return;
    }

    if (typeof onInsertToTimeline === "function") {
      onInsertToTimeline({
        audioUrl: res.url,
        name: `${audioName} [FL Master]`,
        duration: duration || 3.0,
      });
      notify("🎬 បានបញ្ចូលសំឡេងទៅកាន់ Timeline!");
      return;
    }

    notify("⚠️ Timeline មិនទាន់ត្រៀមរួចរាល់ទេ");
  };

  // Auto-loop when timeline reaches end of segment if looping enabled
  useEffect(() => {
    if (!isLooping || !timelineIsPlaying || !hasTimelineSegment || typeof onTimelineSeek !== "function") return;
    if (timelineCurrentTime >= (clipStart + clipDuration - 0.05)) {
      onTimelineSeek(clipStart);
    }
  }, [isLooping, timelineIsPlaying, hasTimelineSegment, timelineCurrentTime, clipStart, clipDuration, onTimelineSeek]);

  const handleSyncedPlayToggle = () => {
    if (hasTimelineSegment && typeof onTimelineTogglePlay === "function") {
      if (!timelineIsPlaying) {
        if (typeof onTimelineSeek === "function") {
          if (timelineCurrentTime < clipStart || timelineCurrentTime >= (clipStart + clipDuration - 0.05)) {
            onTimelineSeek(clipStart);
          }
        }
        onTimelineTogglePlay();
      } else {
        if (!isInside && typeof onTimelineSeek === "function") {
          onTimelineSeek(clipStart);
        } else {
          onTimelineTogglePlay();
        }
      }
      return;
    }
    handleTogglePlay();
  };

  const handleSyncedRewind = () => {
    if (hasTimelineSegment && typeof onTimelineSeek === "function") {
      onTimelineSeek(clipStart);
      return;
    }
    if (audioElementRef.current) {
      audioElementRef.current.currentTime = 0;
      setCurrentTime(0);
    }
  };

  return (
    <div className="voice-fl-rack-container">
      {/* Hidden HTML5 Audio Element for Playback */}
      {audioUrl && (
        <audio
          ref={audioElementRef}
          src={audioUrl}
          loop={isLooping}
          onTimeUpdate={() => setCurrentTime(audioElementRef.current?.currentTime || 0)}
          onLoadedMetadata={() => setDuration(audioElementRef.current?.duration || 0)}
          onEnded={() => {
            if (!isLooping) setIsPlaying(false);
          }}
        />
      )}

      {/* Unified Single Hardware Card */}
      <div className="vfl-card vfl-card-unified">
        {/* Header Row: Brand Badge + Original Voice & Bypass A/B Toggle */}
        <div className="vfl-card-header">
            <div className="vfl-brand-badge">
              <div className="vfl-logo-glow">🎛️</div>
              <div className="vfl-brand-text">
                <h3>Voice FL Studio</h3>
                <span>Vocal DSP Studio</span>
              </div>
            </div>

            <div className="vfl-header-actions">
              <button
                type="button"
                className={`vfl-header-original-btn ${isBypassed ? "is-active" : ""}`}
                onClick={handleActivateOriginalVoice}
                title={isBypassed ? "បិទសំឡេងដើម (ត្រឡប់មក FL Mastered)" : "ស្តាប់សំឡេងដើម Original Voice (Raw 100% គ្មាន Effects)"}
              >
                <span className={`vfl-header-led ${isBypassed ? "is-active" : ""}`} />
                <span>{isBypassed ? "📻 សំឡេងដើម (Raw Active)" : "📻 Original Voice"}</span>
              </button>

              <button
                type="button"
                className={`vfl-bypass-toggle ${isBypassed ? "is-bypassed" : ""}`}
                onClick={handleToggleBypass}
                title="A/B Compare: Turn FL processing ON/OFF"
              >
                {isBypassed ? <EyeSlash size={14} weight="bold" /> : <Eye size={14} weight="bold" />}
                <span>{isBypassed ? "BYPASS" : "MASTER ON"}</span>
              </button>
            </div>
          </div>

          {/* Timeline Synchronized Audio Player Bar */}
          <div className="vfl-audio-transport-section">
            <div className="vfl-source-info-row">
              <div className="vfl-source-meta">
                <Waveform
                  size={18}
                  weight={isEffectivePlaying ? "fill" : "regular"}
                  className={`vfl-wave-icon ${isEffectivePlaying ? "is-playing" : ""}`}
                />
                <div className="vfl-source-text">
                  <span className="vfl-source-title">{audioName || "Timeline Voice"}</span>
                  <small>
                    {clipDuration > 0
                      ? `${currentClipTime.toFixed(1)}s / ${clipDuration.toFixed(1)}s ${isEffectivePlaying ? (isBypassed ? "• Playing Original Raw Voice" : "• Playing Live FL Master") : (isBypassed ? "• Original Raw Voice" : "• Timeline Audio Clip")}`
                      : (isBypassed ? "• Original Raw Voice" : "• Timeline Audio Clip")}
                  </small>
                </div>
              </div>

              <div className="vfl-transport-inline">
                <button
                  type="button"
                  className={`vfl-transport-play-btn ${isEffectivePlaying ? "is-active-playing" : ""}`}
                  onClick={handleSyncedPlayToggle}
                  title={isEffectivePlaying ? "Pause Timeline Voice" : "Play Timeline Voice with FL Master"}
                >
                  {isEffectivePlaying ? <Pause size={16} weight="fill" /> : <Play size={16} weight="fill" />}
                </button>
                <button
                  type="button"
                  className={`vfl-transport-sub-btn ${isLooping ? "is-looping" : ""}`}
                  onClick={() => setIsLooping((prev) => !prev)}
                  title="Loop playback"
                >
                  <ArrowsClockwise size={14} />
                </button>
                <button
                  type="button"
                  className="vfl-transport-sub-btn"
                  onClick={handleSyncedRewind}
                  title="Rewind to start of clip"
                >
                  <ArrowCounterClockwise size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* FL Vocal Presets Dropdown & AI Studio Podcast Analysis */}
          <div className="vfl-presets-section" ref={presetDropdownRef}>
            <div className="vfl-presets-header-row">
              <div className="vfl-section-label">
                <span>🎛️ FL Vocal Presets</span>
                <small>{allPresets.length} ម៉ូដ</small>
              </div>

              <div className="vfl-presets-quick-actions">
                <button
                  type="button"
                  className={`vfl-ai-analyze-btn ${isAiAnalyzing ? "is-analyzing" : ""}`}
                  onClick={handleRunAiAnalysis}
                  disabled={isAiAnalyzing || !audioUrl}
                  title="AI វិភាគសំឡេង និង Master ស្វ័យប្រវត្តិកម្រិត Studio Podcast 100%"
                >
                  <Sparkle size={13} weight="fill" />
                  <span>{isAiAnalyzing ? "AI វិភាគ..." : "✨ AI Analysis"}</span>
                </button>

                <button
                  type="button"
                  className="vfl-new-preset-btn"
                  onClick={() => setIsCreatingPreset((v) => !v)}
                  title="បង្កើត Preset ថ្មីពីកម្រិតបច្ចុប្បន្ន"
                >
                  <Plus size={12} weight="bold" />
                  <span>+ Preset</span>
                </button>
              </div>
            </div>

            {/* Inline Preset Creator */}
            {isCreatingPreset && (
              <div className="vfl-preset-create-inline">
                <input
                  type="text"
                  placeholder="ឈ្មោះ Preset ថ្មី (ឧ. My Podcast Studio)..."
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveAsCustomPreset()}
                  className="vfl-preset-create-input"
                  autoFocus
                />
                <button
                  type="button"
                  className="vfl-preset-create-save-btn"
                  onClick={handleSaveAsCustomPreset}
                >
                  រក្សាទុក
                </button>
                <button
                  type="button"
                  className="vfl-preset-create-cancel-btn"
                  onClick={() => setIsCreatingPreset(false)}
                >
                  បោះបង់
                </button>
              </div>
            )}

            {/* Custom Preset Modified Alert Bar */}
            {isSettingsModified && (
              <div className="vfl-preset-modified-bar">
                <span>
                  {activePreset?.isCustom ? (
                    <>⭐ Preset <strong>{activePreset.name}</strong> បានកែសម្រួល</>
                  ) : (
                    <>🎛️ បានកែប្រែពី <strong>{activePreset.name}</strong></>
                  )}
                </span>
                <div className="vfl-preset-modified-actions">
                  {activePreset?.isCustom ? (
                    <button
                      type="button"
                      className="vfl-preset-update-btn"
                      onClick={handleUpdateCurrentCustomPreset}
                      title="Update settings into this custom preset"
                    >
                      <FloppyDisk size={12} weight="fill" />
                      <span>Update</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="vfl-preset-update-btn"
                      onClick={() => {
                        setNewPresetName(`${activePreset.name} (Custom)`);
                        setIsCreatingPreset(true);
                      }}
                      title="Save as a new custom preset"
                    >
                      <Plus size={12} weight="bold" />
                      <span>រក្សាទុកជា Preset</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* AI Diagnosis Report Card */}
            {showAiModal && aiReport && (
              <div className="vfl-ai-report-card">
                <div className="vfl-ai-report-header">
                  <div className="vfl-ai-report-title">
                    <Sparkle size={15} weight="fill" />
                    <span>AI Studio Podcast Doctor (100% Master)</span>
                  </div>
                  <button
                    type="button"
                    className="vfl-ai-report-close"
                    onClick={() => setShowAiModal(false)}
                    title="Close report"
                  >
                    ×
                  </button>
                </div>

                <div className="vfl-ai-diagnosis-grid">
                  {aiReport.diagnosis.map((d, idx) => (
                    <div key={idx} className="vfl-ai-diag-item">
                      <div className="vfl-ai-diag-item-head">
                        <span>{d.icon}</span>
                        <span>{d.label}</span>
                      </div>
                      <span className="vfl-ai-diag-item-val">{d.value}</span>
                    </div>
                  ))}
                </div>

                <div className="vfl-ai-summary-text">
                  {aiReport.summaryKm}
                </div>
              </div>
            )}

            {/* Presets Dropdown Container */}
            <div className="vfl-preset-dropdown-container">
              <button
                type="button"
                className={`vfl-preset-dropdown-trigger ${isPresetDropdownOpen ? "is-open" : ""}`}
                onClick={() => setIsPresetDropdownOpen((v) => !v)}
                title="ជ្រើសរើស FL Vocal Preset (Dropdown)"
              >
                <div className="vfl-preset-dropdown-current">
                  <span className="vfl-preset-dropdown-emoji">{activePreset?.icon || "🎛️"}</span>
                  <div className="vfl-preset-dropdown-meta">
                    <strong className="vfl-preset-dropdown-title-en">{activePreset?.name || "Select Preset"}</strong>
                    <span className="vfl-preset-dropdown-title-km">{activePreset?.nameKm || ""}</span>
                  </div>
                </div>
                <div className="vfl-preset-dropdown-action">
                  <span className="vfl-preset-badge-tag">{activePreset?.isCustom ? "CUSTOM" : "ACTIVE"}</span>
                  <CaretDown size={14} weight="bold" className={`vfl-dropdown-caret ${isPresetDropdownOpen ? "is-rotated" : ""}`} />
                </div>
              </button>

              {isPresetDropdownOpen && (
                <div className="vfl-preset-dropdown-menu">
                  {customPresets.length > 0 && (
                    <>
                      <div className="vfl-preset-group-header">🌟 PRESETS ផ្ទាល់ខ្លួន & AI ({customPresets.length})</div>
                      {customPresets.map((preset) => {
                        const isSelected = activePresetId === preset.id;
                        return (
                          <div
                            key={preset.id}
                            className={`vfl-preset-dropdown-item ${isSelected ? "is-selected" : ""}`}
                            onClick={() => {
                              handleSelectPreset(preset);
                              setIsPresetDropdownOpen(false);
                            }}
                            title={preset.desc}
                            role="button"
                            tabIndex={0}
                          >
                            <span className="vfl-preset-dropdown-item-icon">{preset.icon || "⭐"}</span>
                            <div className="vfl-preset-dropdown-item-text">
                              <span className="vfl-preset-dropdown-item-en">{preset.name}</span>
                              <span className="vfl-preset-dropdown-item-km">{preset.nameKm || "Preset ផ្ទាល់ខ្លួន"}</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              {isSelected && <span className="vfl-preset-dropdown-check">✓</span>}
                              <button
                                type="button"
                                className="vfl-preset-item-delete"
                                onClick={(e) => handleDeleteCustomPreset(preset.id, e)}
                                title="លុប Preset នេះ"
                              >
                                <Trash size={13} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}

                  <div className="vfl-preset-group-header">🎛️ STUDIO FACTORY PRESETS ({VOICE_FL_PRESETS.length})</div>
                  {VOICE_FL_PRESETS.map((preset) => {
                    const isSelected = activePresetId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        className={`vfl-preset-dropdown-item ${isSelected ? "is-selected" : ""}`}
                        onClick={() => {
                          handleSelectPreset(preset);
                          setIsPresetDropdownOpen(false);
                        }}
                        title={preset.desc}
                      >
                        <span className="vfl-preset-dropdown-item-icon">{preset.icon}</span>
                        <div className="vfl-preset-dropdown-item-text">
                          <span className="vfl-preset-dropdown-item-en">{preset.name}</span>
                          <span className="vfl-preset-dropdown-item-km">{preset.nameKm}</span>
                        </div>
                        {isSelected && <span className="vfl-preset-dropdown-check">✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Real-time Spectrum Visualizer Screen */}
          <div className="vfl-screen-chassis">
            <div className="vfl-screen-header">
              <div className="vfl-screen-title">
                <span className="vfl-led-dot active" />
                <span>EQ 2 & SPECTRUM</span>
              </div>
              <div className="vfl-screen-stats">
                <span>48 kHz</span>
                <span className="vfl-badge-hi">{settings.soundgoodizerMode} MODE</span>
              </div>
            </div>

            <div className="vfl-canvas-wrap">
              <canvas ref={canvasRef} width={640} height={90} className="vfl-spectrum-canvas" />
              <div className="vfl-freq-labels">
                <span>80Hz</span>
                <span>250Hz</span>
                <span>1kHz</span>
                <span>4kHz</span>
                <span>10kHz</span>
                <span>16kHz</span>
              </div>
            </div>
          </div>

          {/* Section Divider: Vocal FX Rack Hardware Edition */}
          <div className="vfl-rack-section-divider">
            <div className="vfl-card-title-group">
              <div className="vfl-rack-icon-badge">⚡</div>
              <div>
                <h3>Vocal FX Rack</h3>
                <span>Hardware Edition</span>
              </div>
            </div>
            <div className="vfl-rack-led active">RACK ACTIVE</div>
          </div>

          <div className="vfl-rack-strips-vertical">
            {/* Strip 1: Edison Denoise & Clean */}
            <div className="vfl-strip-card">
              <div className="vfl-strip-header">
                <div className="vfl-strip-num">01</div>
                <h4>Edison Denoise</h4>
              </div>

              <div className="vfl-knobs-group">
                <div className="vfl-knob-box">
                  <span className="vfl-knob-label">Noise Cut</span>
                  <div className="vfl-rotary-dial">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={settings.denoise}
                      onChange={(e) => handleSettingChange("denoise", Number(e.target.value))}
                      className="vfl-range-input accent-orange"
                    />
                  </div>
                  <strong className="vfl-val-badge">{settings.denoise}%</strong>
                </div>

                <div className="vfl-knob-box">
                  <span className="vfl-knob-label">Noise Gate</span>
                  <div className="vfl-rotary-dial">
                    <input
                      type="range"
                      min="-60"
                      max="-15"
                      step="1"
                      value={settings.noiseGate}
                      onChange={(e) => handleSettingChange("noiseGate", Number(e.target.value))}
                      className="vfl-range-input accent-orange"
                    />
                  </div>
                  <strong className="vfl-val-badge">{settings.noiseGate} dB</strong>
                </div>

                <div className="vfl-knob-box vfl-switch-box-inline">
                  <span className="vfl-knob-label">80Hz Low-Cut</span>
                  <button
                    type="button"
                    className={`vfl-3d-toggle-switch ${settings.lowCut ? "is-on" : ""}`}
                    onClick={() => handleSettingChange("lowCut", !settings.lowCut)}
                  >
                    <span>{settings.lowCut ? "ACTIVE" : "OFF"}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Strip 2: NewTone Vocal & Pitch Tune */}
            <div className="vfl-strip-card">
              <div className="vfl-strip-header">
                <div className="vfl-strip-num">02</div>
                <h4>NewTone Pitch</h4>
              </div>

              <div className="vfl-knobs-group">
                <div className="vfl-knob-box">
                  <span className="vfl-knob-label">Pitch Shift</span>
                  <div className="vfl-rotary-dial">
                    <input
                      type="range"
                      min="-6"
                      max="6"
                      step="1"
                      value={settings.pitchShift}
                      onChange={(e) => handleSettingChange("pitchShift", Number(e.target.value))}
                      className="vfl-range-input accent-cyan"
                    />
                  </div>
                  <strong className="vfl-val-badge">
                    {settings.pitchShift > 0 ? `+${settings.pitchShift}` : settings.pitchShift} semi
                  </strong>
                </div>

                <div className="vfl-knob-box">
                  <span className="vfl-knob-label">De-Esser (S/T)</span>
                  <div className="vfl-rotary-dial">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="2"
                      value={settings.deEsser}
                      onChange={(e) => handleSettingChange("deEsser", Number(e.target.value))}
                      className="vfl-range-input accent-cyan"
                    />
                  </div>
                  <strong className="vfl-val-badge">{settings.deEsser}%</strong>
                </div>

                <div className="vfl-knob-box">
                  <span className="vfl-knob-label">Vocal Warmth</span>
                  <select
                    className="vfl-select-inline"
                    value={settings.eqLow > 2 ? "deep" : settings.eqAir > 3 ? "air" : "natural"}
                    onChange={(e) => {
                      const m = e.target.value;
                      if (m === "deep") {
                        handleSettingChange("eqLow", 4.0);
                        handleSettingChange("eqAir", 1.0);
                      } else if (m === "air") {
                        handleSettingChange("eqLow", 0.5);
                        handleSettingChange("eqAir", 4.5);
                      } else {
                        handleSettingChange("eqLow", 1.5);
                        handleSettingChange("eqAir", 2.0);
                      }
                    }}
                  >
                    <option value="natural">Natural (តុល្យភាព)</option>
                    <option value="deep">Deep (ជ្រៅក្រាស់)</option>
                    <option value="air">Crisp (ភ្លឺថ្លា)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Strip 3: Parametric EQ 2 & Soundgoodizer */}
            <div className="vfl-strip-card highlight-sg">
              <div className="vfl-strip-header">
                <div className="vfl-strip-num">03</div>
                <h4>EQ & Soundgoodizer</h4>
              </div>

              <div className="vfl-knobs-group">
                <div className="vfl-eq-mini-group">
                  <div className="vfl-eq-mini-col">
                    <span className="vfl-eq-val">{settings.eqLow > 0 ? `+${settings.eqLow}` : settings.eqLow}</span>
                    <input
                      type="range"
                      min="-6"
                      max="6"
                      step="0.5"
                      value={settings.eqLow}
                      onChange={(e) => handleSettingChange("eqLow", Number(e.target.value))}
                      className="vfl-v-slider"
                    />
                    <span className="vfl-eq-label">Bass</span>
                  </div>
                  <div className="vfl-eq-mini-col">
                    <span className="vfl-eq-val">{settings.eqMid > 0 ? `+${settings.eqMid}` : settings.eqMid}</span>
                    <input
                      type="range"
                      min="-6"
                      max="6"
                      step="0.5"
                      value={settings.eqMid}
                      onChange={(e) => handleSettingChange("eqMid", Number(e.target.value))}
                      className="vfl-v-slider"
                    />
                    <span className="vfl-eq-label">Mid</span>
                  </div>
                  <div className="vfl-eq-mini-col">
                    <span className="vfl-eq-val">{settings.eqHigh > 0 ? `+${settings.eqHigh}` : settings.eqHigh}</span>
                    <input
                      type="range"
                      min="-6"
                      max="6"
                      step="0.5"
                      value={settings.eqHigh}
                      onChange={(e) => handleSettingChange("eqHigh", Number(e.target.value))}
                      className="vfl-v-slider"
                    />
                    <span className="vfl-eq-label">High</span>
                  </div>
                  <div className="vfl-eq-mini-col">
                    <span className="vfl-eq-val">{settings.eqAir > 0 ? `+${settings.eqAir}` : settings.eqAir}</span>
                    <input
                      type="range"
                      min="-6"
                      max="6"
                      step="0.5"
                      value={settings.eqAir}
                      onChange={(e) => handleSettingChange("eqAir", Number(e.target.value))}
                      className="vfl-v-slider"
                    />
                    <span className="vfl-eq-label">Air</span>
                  </div>
                </div>

                <div className="vfl-sg-main-box">
                  <div className="vfl-sg-title-row">
                    <span className="vfl-knob-label">Soundgoodizer Mode</span>
                    <strong className="vfl-val-badge fruit">{settings.soundgoodizerAmount}%</strong>
                  </div>
                  <div className="vfl-sg-modes-row">
                    {["A", "B", "C", "D"].map((m) => (
                      <button
                        key={m}
                        type="button"
                        className={`vfl-sg-mode-btn ${settings.soundgoodizerMode === m ? "is-active" : ""}`}
                        onClick={() => handleSettingChange("soundgoodizerMode", m)}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={settings.soundgoodizerAmount}
                    onChange={(e) => handleSettingChange("soundgoodizerAmount", Number(e.target.value))}
                    className="vfl-range-input accent-fruit"
                  />
                </div>
              </div>
            </div>

            {/* Strip 4: Reverb & Master Limiter */}
            <div className="vfl-strip-card">
              <div className="vfl-strip-header">
                <div className="vfl-strip-num">04</div>
                <h4>Master & Reverb</h4>
              </div>

              <div className="vfl-knobs-group">
                <div className="vfl-knob-box">
                  <span className="vfl-knob-label">Reverb</span>
                  <div className="vfl-rotary-dial">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="2"
                      value={settings.reverbWet}
                      onChange={(e) => handleSettingChange("reverbWet", Number(e.target.value))}
                      className="vfl-range-input accent-green"
                    />
                  </div>
                  <strong className="vfl-val-badge">{settings.reverbWet}%</strong>
                </div>

                <div className="vfl-knob-box">
                  <span className="vfl-knob-label">Output Gain</span>
                  <div className="vfl-rotary-dial">
                    <input
                      type="range"
                      min="0.5"
                      max="1.5"
                      step="0.05"
                      value={settings.outputGain}
                      onChange={(e) => handleSettingChange("outputGain", Number(e.target.value))}
                      className="vfl-range-input accent-green"
                    />
                  </div>
                  <strong className="vfl-val-badge">{(settings.outputGain * 100).toFixed(0)}%</strong>
                </div>

                <div className="vfl-knob-box vfl-limiter-box">
                  <span className="vfl-knob-label">Limiter (-0.3dB)</span>
                  <div className="vfl-limiter-badge">
                    <span className="vfl-limiter-led active" />
                    <span>Clean</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Master Export Actions with Bottom Original Voice Button */}
          <div className="vfl-master-actions-card">
            <button
              type="button"
              className={`vfl-export-btn is-original-btn ${isBypassed ? "is-active" : ""}`}
              onClick={handleActivateOriginalVoice}
              title={isBypassed ? "បិទសំឡេងដើម (ត្រឡប់មក FL Mastered វិញ)" : "ស្តាប់សំឡេងដើម Original Voice (Raw 100% គ្មាន Effects)"}
            >
              <span className={`vfl-btn-led ${isBypassed ? "is-active" : ""}`} />
              <SpeakerHigh size={15} weight={isBypassed ? "fill" : "bold"} />
              <span>{isBypassed ? "📻 សំឡេងដើម (Raw Active)" : "📻 Original Voice"}</span>
            </button>

            {(onUpdateTimelineSegment || onInsertToTimeline) && (
              <button
                type="button"
                className="vfl-export-btn is-timeline-primary"
                onClick={handleApplyToTimelineAction}
                disabled={!audioUrl || isProcessing}
                title="Update and apply FL master to Timeline"
              >
                <Lightning size={16} weight="fill" />
                <span>{isProcessing ? "កំពុង Master..." : "⚡ Update ទៅ Timeline ភ្លាមៗ"}</span>
              </button>
            )}

            <button
              type="button"
              className="vfl-export-btn is-download"
              onClick={handleDownload}
              disabled={!audioUrl || isProcessing}
              title="Download Mastered WAV file"
            >
              <DownloadSimple size={15} weight="bold" />
              <span>Download WAV</span>
            </button>
          </div>
        </div>

      {/* Voice Library Dropdown Modal */}
      {showVoiceSelect && voiceProfiles?.length > 0 && (
        <div className="vfl-voice-modal-backdrop" onClick={() => setShowVoiceSelect(false)}>
          <div className="vfl-voice-modal" onClick={(e) => e.stopPropagation()}>
            <div className="vfl-voice-modal-head">
              <h4>ជ្រើសរើសសំឡេងពី Voice Library</h4>
              <button type="button" onClick={() => setShowVoiceSelect(false)}>
                ×
              </button>
            </div>
            <div className="vfl-voice-modal-list">
              {voiceProfiles.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="vfl-voice-item"
                  onClick={() => handleSelectFromLibrary(p)}
                >
                  <span className="vfl-voice-avatar">🎙️</span>
                  <div className="vfl-voice-details">
                    <strong>{p.name}</strong>
                    <small>{p.role || "AI Voice Profile"}</small>
                  </div>
                  <span className="vfl-voice-choose">ជ្រើសរើស</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default VoiceFLRack;
