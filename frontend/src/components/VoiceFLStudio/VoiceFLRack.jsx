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
} from "@phosphor-icons/react";
import {
  VOICE_FL_PRESETS,
  DEFAULT_FL_SETTINGS,
  createVoiceFLGraph,
  renderMasteredAudioOffline,
} from "../../lib/voiceFLAudioEngine.js";
import "./VoiceFLRack.css";

export function VoiceFLRack({
  initialAudioUrl = null,
  initialAudioName = "Audio Clip",
  voiceProfiles = [],
  onInsertToTimeline = null,
  onSaveToLibrary = null,
  notify = console.log,
}) {
  // Preset & Active Settings
  const [activePresetId, setActivePresetId] = useState("podcast_crisp");
  const [settings, setSettings] = useState(DEFAULT_FL_SETTINGS);
  const [isBypassed, setIsBypassed] = useState(false); // A/B Testing
  const [activeCardTab, setActiveCardTab] = useState("all"); // "all" | "card1" | "card2"

  // Audio Playback & Web Audio State
  const [audioUrl, setAudioUrl] = useState(initialAudioUrl);
  const [audioName, setAudioName] = useState(initialAudioName);
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

  // Update Settings helper
  const handleSettingChange = (key, value) => {
    setSettings((prev) => {
      const updated = { ...prev, [key]: value };
      if (rackRef.current) {
        rackRef.current.updateSettings(updated, isBypassed);
      }
      return updated;
    });
  };

  // Switch Presets
  const handleSelectPreset = (preset) => {
    setActivePresetId(preset.id);
    setSettings(preset.settings);
    if (rackRef.current) {
      rackRef.current.updateSettings(preset.settings, isBypassed);
    }
    notify(`🎛️ បានអនុវត្ត Preset: ${preset.nameKm || preset.name}`);
  };

  // Toggle A/B Bypass
  const handleToggleBypass = () => {
    setIsBypassed((prev) => {
      const next = !prev;
      if (rackRef.current) {
        rackRef.current.updateSettings(settings, next);
      }
      notify(next ? "🔇 Bypass FL Master (ស្តាប់សំឡេងដើម Raw)" : "✨ បើកដំណើរការ Voice FL Master");
      return next;
    });
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
      if (!analyser || !isPlaying) {
        // Draw static center line
        ctx.strokeStyle = "rgba(0, 229, 255, 0.25)";
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
        return;
      }

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteFrequencyData(dataArray);

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
  }, [isPlaying]);

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

  // Insert to Timeline
  const handleInsertToTimelineAction = async () => {
    if (typeof onInsertToTimeline !== "function") {
      notify("⚠️ Timeline មិនទាន់ត្រៀមរួចរាល់ទេ");
      return;
    }
    const res = await handleRenderMastered();
    if (!res) return;

    onInsertToTimeline({
      audioUrl: res.url,
      name: `${audioName} [FL Master]`,
      duration: duration || 3.0,
    });
    notify("🎬 បានបញ្ចូលសំឡេងទៅកាន់ Timeline!");
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

      {/* Responsive Segmented Mode Nav: View All, Card 1, or Card 2 */}
      <div className="vfl-card-segmented-nav">
        <button
          type="button"
          className={`vfl-nav-tab ${activeCardTab === "all" ? "active" : ""}`}
          onClick={() => setActiveCardTab("all")}
          title="បង្ហាញផ្ទាំងទាំងពីរ"
        >
          <span>👀 ទាំងអស់</span>
        </button>
        <button
          type="button"
          className={`vfl-nav-tab ${activeCardTab === "card1" ? "active" : ""}`}
          onClick={() => setActiveCardTab("card1")}
          title="Card 1: Presets & Audio"
        >
          <span>🎛️ Presets & Audio</span>
        </button>
        <button
          type="button"
          className={`vfl-nav-tab ${activeCardTab === "card2" ? "active" : ""}`}
          onClick={() => setActiveCardTab("card2")}
          title="Card 2: Vocal FX Rack"
        >
          <span>⚡ Vocal FX Rack</span>
        </button>
      </div>

      {/* =========================================================================
          CARD 1: MASTER CONTROLLER, AUDIO INPUT, PRESETS & SPECTRUM MONITOR
          ========================================================================= */}
      {(activeCardTab === "all" || activeCardTab === "card1") && (
        <div className="vfl-card vfl-card-master">
          {/* Header Row: Brand Badge + Bypass A/B Toggle */}
          <div className="vfl-card-header">
            <div className="vfl-brand-badge">
              <div className="vfl-logo-glow">🎛️</div>
              <div className="vfl-brand-text">
                <h3>Voice FL Studio</h3>
                <span>Vocal DSP Studio</span>
              </div>
            </div>

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

          {/* Audio Input, Transport & Player Bar */}
          <div className="vfl-audio-transport-section">
            <div className="vfl-source-info-row">
              <div className="vfl-source-meta">
                <Waveform size={18} className="vfl-wave-icon" />
                <div className="vfl-source-text">
                  <span className="vfl-source-title">{audioName || "No Audio Loaded"}</span>
                  <small>
                    {duration > 0
                      ? `${currentTime.toFixed(1)}s / ${duration.toFixed(1)}s`
                      : "ថត ឬបញ្ចូលសំឡេង"}
                  </small>
                </div>
              </div>

              <div className="vfl-transport-inline">
                <button
                  type="button"
                  className="vfl-transport-play-btn"
                  onClick={handleTogglePlay}
                  disabled={!audioUrl}
                  title={isPlaying ? "Pause" : "Play with Live FL Master"}
                >
                  {isPlaying ? <Pause size={16} weight="fill" /> : <Play size={16} weight="fill" />}
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
                  onClick={() => {
                    if (audioElementRef.current) {
                      audioElementRef.current.currentTime = 0;
                      setCurrentTime(0);
                    }
                  }}
                  title="Rewind"
                  disabled={!audioUrl}
                >
                  <ArrowCounterClockwise size={14} />
                </button>
              </div>
            </div>

            {/* Input Action Pills: Upload, Record, Library */}
            <div className="vfl-input-actions-grid">
              <label className="vfl-action-chip" title="Upload local audio file">
                <UploadSimple size={13} weight="bold" />
                <span>Upload</span>
                <input type="file" accept="audio/*" onChange={handleFileUpload} hidden />
              </label>

              {isRecording ? (
                <button
                  type="button"
                  className="vfl-action-chip is-recording"
                  onClick={handleStopRecord}
                  title="Stop recording"
                >
                  <Stop size={13} weight="fill" />
                  <span>{recordDuration}s Stop</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="vfl-action-chip"
                  onClick={handleStartRecord}
                  title="Record from microphone"
                >
                  <Microphone size={13} weight="bold" />
                  <span>Record</span>
                </button>
              )}

              {voiceProfiles?.length > 0 && (
                <button
                  type="button"
                  className="vfl-action-chip"
                  onClick={() => setShowVoiceSelect((prev) => !prev)}
                  title="Select a cloned/trained voice from Library"
                >
                  <SpeakerHigh size={13} weight="bold" />
                  <span>Voices ({voiceProfiles.length})</span>
                </button>
              )}
            </div>
          </div>

          {/* Presets Grid: 2 Columns, No Overflow, Beautiful Khmer & English Titles */}
          <div className="vfl-presets-section">
            <div className="vfl-section-label">
              <span>🎛️ FL Vocal Presets</span>
              <small>{VOICE_FL_PRESETS.length} ម៉ូដ</small>
            </div>

            <div className="vfl-presets-grid-2col">
              {VOICE_FL_PRESETS.map((preset) => {
                const isActive = activePresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    className={`vfl-preset-card-item ${isActive ? "is-active" : ""}`}
                    onClick={() => handleSelectPreset(preset)}
                    title={preset.desc}
                  >
                    <div className="vfl-preset-top">
                      <span className="vfl-preset-emoji">{preset.icon}</span>
                      <strong className="vfl-preset-title-en">{preset.name}</strong>
                    </div>
                    <span className="vfl-preset-title-km">{preset.nameKm || preset.name}</span>
                  </button>
                );
              })}
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
        </div>
      )}

      {/* =========================================================================
          CARD 2: VOCAL FX HARDWARE RACK & MASTER EXPORT
          ========================================================================= */}
      {(activeCardTab === "all" || activeCardTab === "card2") && (
        <div className="vfl-card vfl-card-fx-rack">
          <div className="vfl-card-header">
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

          {/* Master Export Actions */}
          <div className="vfl-master-actions-card">
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

            {onInsertToTimeline && (
              <button
                type="button"
                className="vfl-export-btn is-timeline"
                onClick={handleInsertToTimelineAction}
                disabled={!audioUrl || isProcessing}
                title="Insert Mastered Audio into Timeline"
              >
                <FilmStrip size={15} weight="bold" />
                <span>To Timeline</span>
              </button>
            )}
          </div>
        </div>
      )}

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
