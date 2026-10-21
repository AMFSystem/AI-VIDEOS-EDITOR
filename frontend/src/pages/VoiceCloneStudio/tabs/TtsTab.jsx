import React from "react";
import {
  Waveform,
  Sparkle,
  Lightning,
  Plus,
} from "@phosphor-icons/react";
import { TtsOutputPlayer } from "../components/TtsOutputPlayer.jsx";

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
  ttsSpeed,
  setTtsSpeed,
  ttsVolume,
  setTtsVolume,
  isGenerating,
  genPhase,
  genProgress,
  handleGenerateSpeech,
  // Player props
  generatedBlob,
  generatedDuration,
  currentTime,
  isPlaying,
  togglePlayAudio,
  handleSeek,
  handleInsert,
  handleDownloadFile,
}) {
  return (
    <div className="voice-tab-content">
      {/* Active Voice Banner */}
      <div className="tts-active-voice-banner">
        <div className="tts-voice-lead">
          <div className="voice-avatar-disc is-active" style={{ width: 44, height: 44 }}>
            {activeProfile?.name ? activeProfile.name.charAt(0).toUpperCase() : "សំ"}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span className="tts-voice-title">
                {activeProfile ? activeProfile.name : "មិនទាន់បានជ្រើសរើសសំឡេងក្លូន"}
              </span>
              {activeProfile?.engine === "voxcpm2" ? (
                <span className="voxcpm-tag">🌟 VoxCPM2 48kHz Neural Diffusion</span>
              ) : activeProfile?.elevenlabsVoiceId || activeProfile?.engine === "elevenlabs" ? (
                <span className="elevenlabs-tag">ElevenLabs Neural 100%</span>
              ) : activeProfile?.engine === "gemini" ? (
                <span
                  style={{
                    background: "rgba(56, 189, 248, 0.15)",
                    color: "#38bdf8",
                    border: "1px solid rgba(56, 189, 248, 0.35)",
                    padding: "3px 10px",
                    borderRadius: "12px",
                    fontSize: "11px",
                    fontWeight: 600,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  🌟 Gemini 2.5 Human Inflection 95%
                </span>
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
                  : activeProfile.engine === "gemini"
                  ? `ម៉ូដែល Google Gemini 2.5 Studio (ធួន & តុងសំឡេងមនុស្សពិត ៩៥%+) · ភាសា៖ ${
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
                  onOpenGeminiKeyModal();
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

      {/* Output Audio Player */}
      <TtsOutputPlayer
        generatedBlob={generatedBlob}
        generatedDuration={generatedDuration}
        currentTime={currentTime}
        isPlaying={isPlaying}
        togglePlayAudio={togglePlayAudio}
        handleSeek={handleSeek}
        handleInsert={handleInsert}
        handleDownloadFile={handleDownloadFile}
      />
    </div>
  );
}

export default TtsTab;
