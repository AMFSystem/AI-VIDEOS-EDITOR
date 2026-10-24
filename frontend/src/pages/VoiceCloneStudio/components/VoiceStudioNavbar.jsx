import React from "react";
import {
  ArrowLeft,
  Sparkle,
  Key,
  SpeakerHigh,
  MicrophoneStage,
  SidebarSimple,
} from "@phosphor-icons/react";

export function VoiceStudioNavbar({
  onBack,
  activeTab = "tts",
  setActiveTab,
  isKeyValid,
  isGeminiValid,
  onOpenKeyModal,
  onOpenGeminiKeyModal,
  showLibraryMobile,
  setShowLibraryMobile,
}) {
  return (
    <header className="voice-studio-navbar">
      <div className="voice-studio-nav-left">
        <button
          className="voice-studio-back-btn"
          type="button"
          onClick={onBack}
          title="ត្រឡប់ទៅកាន់ផ្ទាំងកាត់តវីដេអូវិញ"
        >
          <ArrowLeft size={16} weight="bold" />
          <span>ត្រឡប់</span>
        </button>

        <div className="voice-studio-nav-divider" />

        <div className="voice-studio-brand">
          <div className="voice-studio-brand-icon">
            <Sparkle size={17} weight="fill" color="#ffffff" />
          </div>
          <span className="voice-studio-title">AI Voice Studio</span>
        </div>

        {/* Mobile Library Toggle */}
        <button
          type="button"
          className={`voice-mobile-sidebar-toggle ${showLibraryMobile ? "is-active" : ""}`}
          onClick={() => setShowLibraryMobile?.((prev) => !prev)}
          title="Toggle Voice Library"
        >
          <SidebarSimple size={16} weight="bold" />
          <span>Library</span>
        </button>
      </div>

      {/* Center Studio Navigation Tabs */}
      <nav className="voice-navbar-tabs-center">
        <button
          type="button"
          className={`voice-nav-tab-item ${activeTab === "tts" ? "is-active" : ""}`}
          onClick={() => setActiveTab?.("tts")}
        >
          <SpeakerHigh size={15} weight="bold" />
          <span>១. Text To Speech</span>
        </button>

        <button
          type="button"
          className={`voice-nav-tab-item ${activeTab === "clone" ? "is-active" : ""}`}
          onClick={() => setActiveTab?.("clone")}
        >
          <MicrophoneStage size={15} weight="bold" />
          <span>២. ក្លូនសំឡេងថ្មី</span>
        </button>

        <button
          type="button"
          className={`voice-nav-tab-item ${activeTab === "train" ? "is-active" : ""}`}
          onClick={() => setActiveTab?.("train")}
        >
          <Sparkle size={15} weight={activeTab === "train" ? "fill" : "bold"} color="#c084fc" />
          <span>៣. AI Training</span>
        </button>
      </nav>

      {/* Right Action Buttons */}
      <div className="voice-studio-nav-right">
        {/* API Key Button */}
        <button
          className={`elevenlabs-nav-btn ${isKeyValid || isGeminiValid ? "is-active" : ""}`}
          type="button"
          onClick={onOpenKeyModal || onOpenGeminiKeyModal}
          title="កំណត់ API Key"
        >
          <Key size={14} weight={isKeyValid || isGeminiValid ? "fill" : "bold"} />
          <span>API Key</span>
        </button>
      </div>
    </header>
  );
}

export default VoiceStudioNavbar;
