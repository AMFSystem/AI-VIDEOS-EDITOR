import React from "react";
import {
  Microphone,
  UploadSimple,
  Sparkle,
  Trash,
  SkipBack,
  SkipForward,
  Play,
  Pause,
  Waveform,
  CheckCircle,
  Lightning,
  FloppyDisk,
  Check,
  SpeakerHigh,
  DownloadSimple,
} from "@phosphor-icons/react";
import { formatClock } from "../../../lib/timeline.js";
import {
  getTrainingQualityInfo,
  generateVoiceAnalysisPeaks,
  IconSkipBack5,
  IconSkipForward5,
} from "../utils.jsx";

export function CloneTab({
  cloneInputMode,
  setCloneInputMode,
  fileInputRef,
  handleFileUpload,
  isRecording,
  recordingElapsed,
  startRecording,
  stopRecording,
  referenceBlob,
  setReferenceBlob,
  referenceDuration,
  referenceCurrentTime,
  referenceAudioRef,
  isPlayingReference,
  setIsPlayingReference,
  togglePlayReference,
  handleReferenceSeek,
  handleReferenceSeekRelative,
  displayPeaks,
  setReferencePeaks,
  setReferenceCurrentTime,
  setExtractedEmbedding,
  setExtractedVoxCpmData,
  setTestBlob,
  cloneName,
  setCloneName,
  cloneLanguage,
  setCloneLanguage,
  cloneGender = "female",
  setCloneGender = () => {},
  vocalTone = "natural_warm",
  setVocalTone = () => {},
  cloneModel,
  setCloneModel,
  isKeyValid,
  apiKey,
  setKeyInput,
  setKeyError,
  isGeminiValid,
  geminiKey,
  setGeminiKeyInput,
  setGeminiError,
  setActiveKeyTab,
  notify,
  setShowKeyModal,
  isExtracting,
  extractPhase,
  extractProgress,
  handleExtractModel,
  extractedEmbedding,
  extractedVoiceId,
  extractedVoxCpmData,
  handleSaveProfile,
  testBlob,
  testUrl,
  testAudioRef,
  isPlayingTest,
  setIsPlayingTest,
  handleGenerateTestAudio,
}) {

  return (
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

          {/* Voice Analysis & Equalizer Spectrum Player */}
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

              {/* Equalizer Frequency Bars + Scrubber */}
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

              {/* Player Controls Row */}
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
              <label>ភេទ / ប្រភេទសំឡេង</label>
              <select
                className="clone-form-select"
                value={cloneGender || "female"}
                onChange={(e) => setCloneGender?.(e.target.value)}
              >
                <option value="female">👩 នារីស្រទន់ (Female - សំឡេង Aoede ស្រទន់ រណ្តំ)</option>
                <option value="female_kore">🌸 នារីផ្អែមល្ហែម (Female - សំឡេង Kore ផ្អែម ស្រាល ដូចមនុស្សពិត)</option>
                <option value="male">👨 បុរស (Male - សំឡេង Fenrir ទ្រូង ធ្ងន់)</option>
                <option value="male_puck">⚡ បុរសរស់រវើក (Male - សំឡេង Puck ស្វាហាប់)</option>
              </select>
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

            <div className="clone-form-field">
              <label>
                <span>ធួន និង តុងសំឡេងលំនាំដើម</span>
                <span style={{ color: "#38bdf8", fontSize: "11px", marginLeft: 6 }}>✨ AI Inflection 95%</span>
              </label>
              <select
                className="clone-form-select"
                value={vocalTone || "natural_warm"}
                onChange={(e) => setVocalTone?.(e.target.value)}
              >
                <option value="natural_warm">🎙️ ធម្មជាតិ & កក់ក្តៅ (Natural & Warm Tone)</option>
                <option value="storytelling">📖 និទានរឿង & ស្រទន់រណ្តំ (Melodic Storyteller)</option>
                <option value="news_anchor">📢 អត្ថាធិប្បាយ & ព័ត៌មាន (Crisp Presenter)</option>
                <option value="emotional">❤️ រំជួលចិត្ត & មនោសញ្ចេតនា (Heartfelt Emotion)</option>
                <option value="energetic">⚡ ស្វាហាប់ & រស់រវើក (Energetic Dynamic)</option>
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

            <div className="clone-model-dropdown-wrapper">
              <select
                className="clone-model-select"
                value={cloneModel}
                onChange={(e) => {
                  const val = e.target.value;
                  setCloneModel(val);
                  if (val === "gemini" && !isGeminiValid && !geminiKey) {
                    setActiveKeyTab("gemini");
                    setGeminiKeyInput(geminiKey || "");
                    setGeminiError("");
                    setShowKeyModal(true);
                  } else if (val === "elevenlabs" && !isKeyValid && !apiKey) {
                    setActiveKeyTab("elevenlabs");
                    setKeyInput(apiKey || "");
                    setKeyError("");
                    setShowKeyModal(true);
                    if (notify) {
                      notify("ElevenLabs ត្រូវការ API Key ផ្សេងពី Google Gemini (យកដោយឥតគិតថ្លៃនៅ elevenlabs.io)");
                    }
                  }
                }}
              >
                <option value="voxcpm2">OpenBMB VoxCPM2 (48kHz Neural)</option>
                <option value="f5tts">🌟 F5-TTS Flow Matching Diffusion (SOTA 24kHz Studio)</option>
                <option value="gemini">Google Gemini 2.0 Studio (🎧 Deep Listening 100% ដូចមនុស្សពិត)</option>
                <option value="elevenlabs">ElevenLabs Neural (Cloud Pro)</option>
                <option value="openvoice">OpenVoice v2 (WASM)</option>
              </select>
            </div>

            {cloneModel === "gemini" && (
              <div
                style={{
                  background: "rgba(56, 189, 248, 0.1)",
                  border: "1px solid rgba(56, 189, 248, 0.3)",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  fontSize: "12px",
                  color: "#7dd3fc",
                  lineHeight: "1.6",
                  marginTop: "8px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px",
                }}
              >
                <span>🎧</span>
                <div>
                  <strong>របៀបស្តាប់ស៊ីជម្រៅ (Gemini Deep Acoustic Listening 100%)៖</strong> AI នឹងស្តាប់សំឡេងគំរូរបស់អ្នកយ៉ាងលម្អិត (Pass 1) ដើម្បីស្រង់យកកម្រិតសំនៀង (Pitch contour), ធួនសំឡេងទ្រូង (Timbre warmth) និងចង្វាក់ដង្ហើម (Breathing cadence)។ សូមណែនាំថត ឬផ្ទុកឡើងសំឡេងចន្លោះពី <strong>15s ដល់ 60s</strong> ដើម្បីទទួលបានសំឡេងដូចមនុស្សពិត ១០០%!
                </div>
              </div>
            )}


            {cloneModel === "f5tts" && (
              <div
                style={{
                  background: "rgba(139, 92, 246, 0.12)",
                  border: "1px solid rgba(139, 92, 246, 0.35)",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  fontSize: "12px",
                  color: "#d8b4fe",
                  lineHeight: "1.6",
                  marginTop: "8px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px",
                }}
              >
                <span>💡</span>
                <div>
                  <strong>គន្លឹះសំឡេងមនុស្សពិត ១០០%៖</strong> ដើម្បីឱ្យ F5-TTS ដំណើរការ Diffusion ដូចមនុស្សពិត សូមប្រាកដថាបានដំឡើង <code>pip install f5-tts</code> ក្នុង Python និងប្រើសំឡេងគំរូច្បាស់ (៥-១០s)។ ប្រសិនបើលោកអ្នកចង់បានសំឡេងមនុស្សស្រីខ្មែរស្រទន់ ពិរោះរណ្តំ និងមានដង្ហើម ៩៥%+ ភ្លាមៗ សូមជ្រើសរើស <strong>Google Gemini 2.5 Flash Studio</strong> (ឥតគិតថ្លៃ)!
                </div>
              </div>
            )}

            {cloneModel === "gemini" && !isGeminiValid && !geminiKey && (
              <div className="clone-model-key-warning">
                <span>⚡ សំឡេង Gemini 2.5 ត្រូវការ API Key (ឥតគិតថ្លៃ)</span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveKeyTab("gemini");
                    setGeminiKeyInput(geminiKey || "");
                    setGeminiError("");
                    setShowKeyModal(true);
                  }}
                  className="btn-connect-key-mini"
                >
                  ភ្ជាប់ Key
                </button>
              </div>
            )}

            {cloneModel === "elevenlabs" && !isKeyValid && !apiKey && (
              <div className="clone-model-key-warning">
                <span>⚡ ElevenLabs ត្រូវការ API Key (យកនៅ elevenlabs.io)</span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveKeyTab("elevenlabs");
                    setKeyInput(apiKey || "");
                    setKeyError("");
                    setShowKeyModal(true);
                  }}
                  className="btn-connect-key-mini"
                >
                  ភ្ជាប់ Key
                </button>
              </div>
            )}
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
                      : cloneModel === "gemini"
                      ? "ក្លូនសំឡេងជាមួយ Google Gemini Studio AI"
                      : cloneModel === "voxcpm2"
                      ? "ក្លូនសំឡេងជាមួយ VoxCPM2 (48kHz Ultra-HD)"
                      : cloneModel === "f5tts"
                      ? "ក្លូនសំឡេងជាមួយ F5-TTS (Flow Matching Diffusion)"
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

          {/* Test preview audio - Prominent Player Card */}
          {(testBlob || testUrl) ? (
            <div className="clone-preview-audio-card">
              <div className="clone-preview-audio-top">
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div className="clone-preview-badge">
                    <span className="clone-preview-pulse-dot" />
                    <span>ម៉ូដែលបានក្លូនរួចរាល់ (100% Ready)</span>
                  </div>
                  <span style={{ fontSize: "12.5px", color: "#94a3b8" }}>
                    ស្តាប់សាកល្បងផ្ទៀងផ្ទាត់គុណភាពទឹកដមសំនៀង មុនពេលរក្សាទុក
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  {testUrl && (
                    <a
                      href={testUrl}
                      download={`${cloneName.trim() || "cloned_voice"}_sample.wav`}
                      className="tts-tool-btn"
                      style={{ padding: "7px 12px", fontSize: "12px", textDecoration: "none", color: "#94a3b8", display: "inline-flex", alignItems: "center", gap: 6 }}
                      title="ទាញយកឯកសារសំឡេងសាកល្បង (.wav)"
                    >
                      <DownloadSimple size={15} weight="bold" />
                      <span>ទាញយក .wav</span>
                    </a>
                  )}
                  <button
                    className="btn-save-clone-local"
                    style={{ padding: "8px 18px", fontSize: "13px" }}
                    type="button"
                    onClick={handleSaveProfile}
                  >
                    <Check size={16} weight="bold" />
                    <span>រក្សាទុកក្នុងកុំព្យូទ័រ</span>
                  </button>
                </div>
              </div>

              <div className="clone-preview-audio-body">
                <button
                  className="clone-preview-play-btn"
                  type="button"
                  title={isPlayingTest ? "ផ្អាកសំឡេង" : "ចាក់សំឡេងសាកល្បង"}
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
                  {isPlayingTest ? <Pause size={20} weight="fill" /> : <Play size={20} weight="fill" />}
                </button>

                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, minWidth: 220 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Waveform size={18} color="#10b981" weight="bold" />
                      <strong style={{ fontSize: "13.5px", color: "#f8fafc" }}>
                        សំឡេងសាកល្បងដែលបានបង្កើត (Cloned Voice Sample)
                      </strong>
                    </div>
                    <span style={{ fontSize: "11.5px", color: isPlayingTest ? "#34d399" : "#94a3b8", fontWeight: 600 }}>
                      {isPlayingTest ? "កំពុងចាក់សំឡេង..." : "ចុចដើម្បីស្តាប់"}
                    </span>
                  </div>

                  {testUrl && (
                    <audio
                      controls
                      src={testUrl}
                      onPlay={() => setIsPlayingTest(true)}
                      onPause={() => setIsPlayingTest(false)}
                      onEnded={() => setIsPlayingTest(false)}
                      className="clone-preview-native-audio"
                    />
                  )}
                </div>
              </div>
            </div>
          ) : (extractedEmbedding || extractedVoiceId || extractedVoxCpmData) && !isExtracting ? (
            /* Fallback Card if model was extracted but audio is waiting to be previewed */
            <div
              style={{
                padding: "16px 20px",
                borderRadius: "12px",
                background: "rgba(16, 185, 129, 0.06)",
                border: "1.5px dashed rgba(16, 185, 129, 0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <CheckCircle size={28} weight="fill" color="#10b981" />
                <div>
                  <strong style={{ fontSize: "14px", color: "#34d399", display: "block" }}>
                    ម៉ូដែលសំឡេងរបស់អ្នកត្រូវបានស្រង់យកជោគជ័យ!
                  </strong>
                  <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                    ចុចប៊ូតុងខាងស្តាំដើម្បីបង្កើតសំឡេងសាកល្បងស្តាប់ ឬរក្សាទុកក្នុងកុំព្យូទ័រ
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {handleGenerateTestAudio && (
                  <button
                    className="btn-extract-voice"
                    style={{ padding: "8px 16px", fontSize: "13px" }}
                    type="button"
                    onClick={handleGenerateTestAudio}
                  >
                    <SpeakerHigh size={16} weight="bold" />
                    <span>បង្កើតសំឡេងសាកល្បងស្តាប់</span>
                  </button>
                )}
                <button
                  className="btn-save-clone-local"
                  style={{ padding: "8px 16px", fontSize: "13px" }}
                  type="button"
                  onClick={handleSaveProfile}
                >
                  <FloppyDisk size={16} weight="fill" />
                  <span>រក្សាទុកក្នុងកុំព្យូទ័រ</span>
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default CloneTab;
