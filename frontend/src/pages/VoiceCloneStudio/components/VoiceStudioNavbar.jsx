import React from "react";
import { ArrowLeft, Sparkle, Key } from "@phosphor-icons/react";

export function VoiceStudioNavbar({
  onBack,
  activeProfile,
  isKeyValid,
  isGeminiValid,
  onOpenKeyModal,
  onOpenGeminiKeyModal,
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
        {/* API Key Button */}
        <button
          className={`elevenlabs-nav-btn ${isKeyValid || isGeminiValid ? "is-active" : ""}`}
          type="button"
          onClick={onOpenKeyModal || onOpenGeminiKeyModal}
          title="កំណត់ API Key"
        >
          <Key size={15} weight={isKeyValid || isGeminiValid ? "fill" : "bold"} />
          <span>API Key</span>
        </button>
      </div>
    </header>
  );
}

export default VoiceStudioNavbar;
