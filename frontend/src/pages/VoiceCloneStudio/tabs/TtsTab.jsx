import React, { useState, useRef, useMemo } from "react";
import {
  Sparkle,
  Gear,
  Trash,
  CaretDown,
  Pause,
  Play,
  FileText,
  Brain,
  SpeakerHigh,
  DownloadSimple,
  ShareNetwork,
  Heart,
  Plus,
} from "@phosphor-icons/react";

function formatAudioTime(seconds) {
  if (!seconds || !Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

const SAMPLE_TEXT_OPTIONS = [
  "នៅពេលយប់ជ្រៅ ខណៈកូនសិស្សទាំងអស់បានដេកលក់អស់ ព្រះសង្ឃអង្គនោះបានឮសំឡេងចម្លែកមួយ។ ពេលនោះគាត់បានក្រោកឡើង ហើយដើរទៅមើល... ស្រាប់តែឃើញស្រមោលខ្មៅមួយកំពុងឈរនៅមាត់ទ្វារ! សំឡេងដកដង្ហើមធំៗ ធ្វើឲ្យលោកព្រឺសម្បុរខ្ញាកៗ។",
  "សម័យនោះ នគរមានភាពសុខក្សេមក្សាន្ត ប្រជារាស្ត្ររស់នៅដោយសេចក្តីសុខសាន្ត ក្រោមម្លប់ព្រះបារមីនៃព្រះមហាក្សត្រដ៏មានមហិទ្ធិឫទ្ធិ។ មេទ័ព និងកងទ័ពក្លាហានការពារទឹកដីយ៉ាងរឹងមាំ!",
  "សួស្តីបងប្អូនទាំងអស់គ្នា! នេះគឺជាការសាកល្បងសំឡេងក្លូនរបស់ខ្ញុំ ដំណើរការយ៉ាងរលូន និងពិរោះរណ្តំ។",
  "សូមជួយចុចគាំទ្រ ចុចចែករំលែក និងតាមដានដើម្បីទទួលបានវីដេអូថ្មីៗរាល់ថ្ងៃ!",
];

export function TtsTab({
  activeProfile,
  setActiveTab,
  ttsText,
  setTtsText,
  isGeminiValid,
  geminiKey,
  onOpenGeminiKeyModal,
  setShowScriptModal,
  notify,
  ttsSpeed = 1.0,
  setTtsSpeed,
  ttsVolume = 1.0,
  setTtsVolume,
  isGenerating,
  genPhase,
  genProgress,
  handleGenerateSpeech,
  // Player props
  generatedBlob,
  generatedDuration = 0,
  currentTime = 0,
  isPlaying,
  togglePlayAudio,
  handleSeek,
  handleInsert,
  handleDownloadFile,
}) {
  const [emotion, setEmotion] = useState("none");
  const [speakingStyle, setSpeakingStyle] = useState("professional");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sampleIndex, setSampleIndex] = useState(0);
  const [isAudioFavorite, setIsAudioFavorite] = useState(false);
  const textareaRef = useRef(null);

  // Word count and estimated duration
  const wordCount = useMemo(() => {
    if (!ttsText.trim()) return 0;
    return ttsText.trim().split(/\s+/).length;
  }, [ttsText]);

  const estimatedDuration = useMemo(() => {
    const chars = ttsText.trim().length;
    if (!chars) return 0;
    const speed = ttsSpeed || 1.0;
    return Math.max(1, Math.round(chars / 14 / speed));
  }, [ttsText, ttsSpeed]);

  // Detected text type for AI Director
  const detectedTextType = useMemo(() => {
    const t = ttsText;
    if (t.includes("ស្ដេច") || t.includes("ព្រះអង្គ") || t.includes("មេទ័ព") || t.includes("នគរ")) {
      return "Drama / រឿងបុរាណ";
    }
    if (t.includes("និទាន") || t.includes("រឿង") || t.includes("កាលពីព្រេងនាយ")) {
      return "Narrative / និទានរឿង";
    }
    if (t.includes("ព័ត៌មាន") || t.includes("ផ្សាយ") || t.includes("ព្រឹត្តិការណ៍")) {
      return "Broadcast / ព័ត៌មាន";
    }
    if (t.includes("សួស្តី") || t.includes("បងប្អូន") || t.includes("វីដេអូ")) {
      return "Conversational / សន្ទនា";
    }
    return "Narrative / និទានរឿង";
  }, [ttsText]);

  // Insert Pause button
  const handleInsertPause = () => {
    const el = textareaRef.current;
    const pauseTag = " [pause 0.5s] ";
    if (!el) {
      setTtsText((prev) => prev + pauseTag);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const text = ttsText;
    const newText = text.substring(0, start) + pauseTag + text.substring(end);
    setTtsText(newText);
    setTimeout(() => {
      el.selectionStart = el.selectionEnd = start + pauseTag.length;
      el.focus();
    }, 0);
  };

  // Cycle sample text
  const handleNextSampleText = () => {
    const nextIdx = (sampleIndex + 1) % SAMPLE_TEXT_OPTIONS.length;
    setSampleIndex(nextIdx);
    setTtsText(SAMPLE_TEXT_OPTIONS[nextIdx]);
  };

  const currentDuration = generatedDuration > 0 ? generatedDuration : 9;
  const displayCurrentTime = currentTime || 0;

  return (
    <div className="voice-tab-content tts-tab-studio-view">
      {/* 1. Header: Sparkle + Title + Subtitle + Clear Text Button */}
      <div className="tts-studio-top-bar">
        <div className="tts-studio-title-block">
          <div className="tts-studio-heading-row">
            <Sparkle size={20} weight="fill" color="#c084fc" />
            <h1 className="tts-studio-title">Text To Speech</h1>
          </div>
          <p className="tts-studio-subtitle">Generate realistic AI voice from your text</p>
        </div>

        <button
          className="tts-btn-clear-text"
          type="button"
          onClick={() => setTtsText("")}
          title="លុបអត្ថបទទាំងអស់"
        >
          Clear Text
        </button>
      </div>

      {/* 2. Controls Row: Selected Voice | Emotion | Style | Advanced */}
      <div className="tts-selectors-grid">
        {/* Selected Voice */}
        <div className="tts-selector-col">
          <label className="tts-selector-label">Selected Voice</label>
          <div className="tts-selected-voice-pill">
            {activeProfile?.imageUrl || activeProfile?.avatarUrl ? (
              <img
                src={activeProfile.imageUrl || activeProfile.avatarUrl}
                alt={activeProfile.name || "Voice"}
                className="tts-voice-pill-thumb"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <div className="tts-voice-pill-disc">
                {activeProfile?.name ? activeProfile.name.charAt(0).toUpperCase() : "សំ"}
              </div>
            )}
            <span
              className="tts-voice-pill-name"
              title={activeProfile?.name || "មិនទាន់ជ្រើសរើសសំឡេង"}
            >
              {activeProfile ? activeProfile.name : "មិនទាន់ជ្រើសរើសសំឡេង"}
            </span>
            <CaretDown size={13} weight="bold" className="tts-voice-pill-chevron" />
            {activeProfile && (
              <button
                type="button"
                className="tts-voice-pill-del"
                title="ប្តូរ ឬក្លូនសំឡេងថ្មី"
                onClick={() => setActiveTab("clone")}
              >
                <Trash size={13} weight="bold" />
              </button>
            )}
          </div>
        </div>

        {/* Emotion Dropdown */}
        <div className="tts-selector-col">
          <label className="tts-selector-label">Emotion</label>
          <div className="tts-select-wrapper">
            <select
              className="tts-custom-select"
              value={emotion}
              onChange={(e) => setEmotion(e.target.value)}
            >
              <option value="none">😐 None</option>
              <option value="happy">😊 Happy (សប្បាយ)</option>
              <option value="sad">😢 Sad (កម្សត់)</option>
              <option value="angry">😡 Angry (ខឹង)</option>
              <option value="dramatic">😲 Dramatic (ភ្ញាក់ផ្អើល)</option>
              <option value="calm">😌 Calm (ស្ងប់ស្ងាត់)</option>
              <option value="royal">👑 Royal (រាជសព្ទ)</option>
            </select>
            <CaretDown size={13} weight="bold" className="tts-select-chevron" />
          </div>
        </div>

        {/* Style Dropdown */}
        <div className="tts-selector-col">
          <label className="tts-selector-label">Style</label>
          <div className="tts-select-wrapper">
            <select
              className="tts-custom-select"
              value={speakingStyle}
              onChange={(e) => setSpeakingStyle(e.target.value)}
            >
              <option value="professional">🎙️ Professional</option>
              <option value="storytelling">📖 Storytelling (និទានរឿង)</option>
              <option value="drama">🎭 Drama (ល្ខោន-ភាពយន្ត)</option>
              <option value="conversational">🗣️ Conversational (សន្ទនា)</option>
              <option value="broadcast">📢 News Broadcast (ព័ត៌មាន)</option>
            </select>
            <CaretDown size={13} weight="bold" className="tts-select-chevron" />
          </div>
        </div>

        {/* Advanced Button */}
        <div className="tts-selector-col">
          <label className="tts-selector-label">Advanced</label>
          <button
            type="button"
            className={`tts-advanced-btn ${showAdvanced ? "is-active" : ""}`}
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <Gear size={15} weight="bold" />
            <span>Advanced Settings</span>
          </button>
        </div>
      </div>

      {/* Advanced Settings Drawer (Speed, Volume, Engine) */}
      {showAdvanced && (
        <div className="tts-advanced-drawer">
          <div className="tts-advanced-item">
            <div className="tts-advanced-item-header">
              <span>ល្បឿននិយាយ (Speed)</span>
              <span className="tts-advanced-val">{ttsSpeed.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="1.8"
              step="0.05"
              value={ttsSpeed}
              onChange={(e) => setTtsSpeed?.(parseFloat(e.target.value))}
            />
          </div>

          <div className="tts-advanced-item">
            <div className="tts-advanced-item-header">
              <span>កម្រិតសំឡេង (Volume)</span>
              <span className="tts-advanced-val">{Math.round(ttsVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="1.5"
              step="0.05"
              value={ttsVolume}
              onChange={(e) => setTtsVolume?.(parseFloat(e.target.value))}
            />
          </div>

          <div className="tts-advanced-item engine-badge-item">
            <div className="tts-advanced-item-header">
              <span>Voice Engine</span>
              <span className="tts-advanced-val">
                {activeProfile?.engine === "gemini"
                  ? "Google Gemini 2.5 Flash"
                  : activeProfile?.engine === "f5tts"
                  ? "F5-TTS Diffusion"
                  : activeProfile?.engine === "voxcpm2"
                  ? "VoxCPM2 48kHz"
                  : activeProfile?.engine === "elevenlabs"
                  ? "ElevenLabs Neural"
                  : "OpenVoice v2"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Big Textarea Card */}
      <div className="tts-editor-card">
        <textarea
          ref={textareaRef}
          className="tts-studio-textarea"
          rows={6}
          placeholder="វាយបញ្ចូលអត្ថបទជាភាសាខ្មែរនៅទីនេះ..."
          value={ttsText}
          onChange={(e) => setTtsText(e.target.value)}
        />

        {/* Counter inside / below editor */}
        <div className="tts-editor-stats-bar">
          <span>
            {ttsText.length} / 5000 Characters | {wordCount} Words | ~{estimatedDuration}s
          </span>
        </div>
      </div>

      {/* 4. Action Buttons Toolbar */}
      <div className="tts-action-toolbar">
        <div className="tts-action-group-left">
          <button
            type="button"
            className="tts-toolbar-btn"
            onClick={() => {
              if (!isGeminiValid && !geminiKey) {
                onOpenGeminiKeyModal?.();
                notify?.("សូមភ្ជាប់ Google Gemini API Key ដើម្បីប្រើមុខងារសរសេរអត្ថបទ AI");
                return;
              }
              setShowScriptModal?.(true);
            }}
            title="ប្រើ Gemini AI ជួយបង្កើត ឬកែលម្អអត្ថបទ"
          >
            <Sparkle size={14} weight="fill" color="#c084fc" />
            <span>AI Prompt Helper</span>
          </button>

          <button
            type="button"
            className="tts-toolbar-btn"
            onClick={handleInsertPause}
            title="បន្ថែមរយៈពេលឈប់ផ្អាក 0.5 វិនាទី"
          >
            <Pause size={14} weight="bold" />
            <span>Insert Pause</span>
          </button>

          <button
            type="button"
            className="tts-toolbar-btn"
            onClick={handleNextSampleText}
            title="ប្តូរអត្ថបទគំរូ"
          >
            <FileText size={14} />
            <span>Sample Text</span>
          </button>
        </div>

        <button
          type="button"
          className="tts-btn-generate-voice"
          disabled={isGenerating || !ttsText.trim()}
          onClick={handleGenerateSpeech}
        >
          {isGenerating ? (
            <>
              <Sparkle size={16} className="animate-spin" />
              <span>Generating Voice...</span>
            </>
          ) : (
            <span>Generate Voice</span>
          )}
        </button>
      </div>

      {/* Progress status while generating */}
      {isGenerating && (
        <div className="tts-progress-box">
          <div className="tts-progress-status-row">
            <span>{genPhase || "កំពុងបង្កើតសំឡេង..."}</span>
            <span>{genProgress || 25}%</span>
          </div>
          <div className="tts-progress-track">
            <div className="tts-progress-fill" style={{ width: `${genProgress || 25}%` }} />
          </div>
        </div>
      )}

      {/* 5. 🧠 AI Director Section */}
      <div className="tts-director-card">
        <div className="tts-director-header">
          <div className="tts-director-title-group">
            <Brain size={18} weight="fill" color="#c084fc" />
            <span className="tts-director-title">AI Director</span>
          </div>
          <span className="tts-pill-ready">Ready</span>
        </div>

        <div className="tts-director-grid">
          <div className="tts-director-tile">
            <span className="tts-director-tile-label">TEXT TYPE</span>
            <span className="tts-director-tile-val">{detectedTextType}</span>
          </div>

          <div className="tts-director-tile">
            <span className="tts-director-tile-label">SPEAKING STYLE</span>
            <span className="tts-director-tile-val">
              {speakingStyle === "professional"
                ? "Professional"
                : speakingStyle === "storytelling"
                ? "Storytelling"
                : speakingStyle === "drama"
                ? "Drama"
                : speakingStyle === "broadcast"
                ? "Broadcast"
                : "Conversational"}
            </span>
          </div>

          <div className="tts-director-tile">
            <span className="tts-director-tile-label">READING SPEED</span>
            <span className="tts-director-tile-val">
              {ttsSpeed === 1.0 ? "1.00x Normal" : `${ttsSpeed.toFixed(2)}x`}
            </span>
          </div>

          <div className="tts-director-tile">
            <span className="tts-director-tile-label">PAUSE STRATEGY</span>
            <span className="tts-director-tile-val">Smart Punctuation</span>
          </div>

          <div className="tts-director-tile">
            <span className="tts-director-tile-label">GENERATION MODE</span>
            <span className="tts-director-tile-val">
              {activeProfile?.engine === "f5tts" ? "F5 Flow Diffusion" : "Neural HD"}
            </span>
          </div>
        </div>
      </div>

      {/* 6. 🎵 Generated Audio Section - ONLY show when audio is generated */}
      {generatedBlob && (
        <div className="tts-generated-audio-section">
          <div className="tts-audio-section-header">
            <div className="tts-audio-section-title-group">
              <SpeakerHigh size={18} weight="fill" color="#38bdf8" />
              <span className="tts-audio-section-title">Generated Audio</span>
            </div>
            <span className="tts-pill-quality">🟢 High Quality</span>
          </div>

          <div className="tts-audio-player-card">
            {/* Avatar of voice */}
            {activeProfile?.imageUrl || activeProfile?.avatarUrl ? (
              <img
                src={activeProfile.imageUrl || activeProfile.avatarUrl}
                alt={activeProfile.name || "Voice"}
                className="tts-player-avatar"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <div className="tts-player-avatar-placeholder">
                <SpeakerHigh size={20} color="#c084fc" />
              </div>
            )}

            {/* Center Info & Player */}
            <div className="tts-player-center">
              <div className="tts-player-title-row">
                <span className="tts-player-voice-name">
                  {activeProfile ? activeProfile.name : "សំឡេងបានបង្កើតរួចរាល់"}
                </span>
                <span className="tts-player-generated-time">
                  Generated just now
                </span>
              </div>

              {/* Audio Scrubber & Controls */}
              <div className="tts-player-scrub-bar">
                <button
                  type="button"
                  className="tts-player-play-btn"
                  onClick={togglePlayAudio}
                  title={isPlaying ? "ផ្អាក" : "ចាក់ស្តាប់"}
                >
                  {isPlaying ? <Pause size={14} weight="fill" /> : <Play size={14} weight="fill" />}
                </button>

                <span className="tts-player-time-display">
                  {formatAudioTime(displayCurrentTime)} / {formatAudioTime(generatedDuration)}
                </span>

                <input
                  className="tts-player-scrubber-input"
                  type="range"
                  min="0"
                  max={generatedDuration || 1}
                  step="0.05"
                  value={displayCurrentTime}
                  onChange={handleSeek}
                />

                <div className="tts-player-volume-icon">
                  <SpeakerHigh size={16} color="#94a3b8" />
                </div>
              </div>
            </div>

            {/* Right Action Buttons */}
            <div className="tts-player-actions-col">
              <button
                type="button"
                className="tts-player-action-btn"
                onClick={handleDownloadFile}
                title="ទាញយកឯកសារសំឡេង"
              >
                <DownloadSimple size={14} weight="bold" />
                <span>Download Audio</span>
              </button>

              <button
                type="button"
                className="tts-player-action-btn"
                onClick={() => handleInsert?.(true)}
                title="បញ្ចូលទៅក្នុង Timeline វីដេអូ"
              >
                <ShareNetwork size={14} weight="bold" />
                <span>Share</span>
              </button>

              <button
                type="button"
                className={`tts-player-action-btn ${isAudioFavorite ? "is-fav" : ""}`}
                onClick={() => setIsAudioFavorite(!isAudioFavorite)}
                title="រក្សាទុកក្នុងបញ្ជីពេញចិត្ត"
              >
                <Heart
                  size={14}
                  weight={isAudioFavorite ? "fill" : "bold"}
                  color={isAudioFavorite ? "#f43f5e" : "inherit"}
                />
                <span>Favorite</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TtsTab;
