import React, { useState, useRef, useEffect } from "react";
import {
  FloppyDisk,
  DownloadSimple,
  Trash,
  Plus,
  UploadSimple,
  Play,
  Pause,
  SpeakerHigh,
} from "@phosphor-icons/react";

export function VoiceProfilesSidebar({
  profiles,
  filteredProfiles,
  selectedProfileId,
  searchQuery,
  setSearchQuery,
  selectProfile,
  handleExportProfile,
  handleDeleteProfile,
  setActiveTab,
  handleImportProfileFile,
  notify,
}) {
  const [playingProfileId, setPlayingProfileId] = useState(null);
  const audioRef = useRef(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handleTogglePlayProfile = (p, e) => {
    e?.stopPropagation();

    // If already playing this profile, pause it
    if (playingProfileId === p.id) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlayingProfileId(null);
      return;
    }

    // Stop any previously playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    // Find audio source: testBlob (cloned speech test) or referenceBlob (training sample)
    const audioBlob = p.testBlob || p.referenceBlob;
    let audioUrl = null;

    if (audioBlob instanceof Blob) {
      audioUrl = URL.createObjectURL(audioBlob);
    } else if (p.testBase64 || p.referenceBase64) {
      audioUrl = p.testBase64 || p.referenceBase64;
      if (!audioUrl.startsWith("data:")) {
        audioUrl = `data:audio/wav;base64,${audioUrl}`;
      }
    }

    if (!audioUrl) {
      notify?.("មិនមានឯកសារសំឡេងគំរូសម្រាប់ចាក់ស្តាប់ទេ");
      return;
    }

    try {
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      setPlayingProfileId(p.id);

      audio.onended = () => {
        setPlayingProfileId(null);
        audioRef.current = null;
        if (audioBlob instanceof Blob) {
          try {
            URL.revokeObjectURL(audioUrl);
          } catch {}
        }
      };

      audio.onerror = () => {
        setPlayingProfileId(null);
        audioRef.current = null;
        if (audioBlob instanceof Blob) {
          try {
            URL.revokeObjectURL(audioUrl);
          } catch {}
        }
        notify?.("មិនអាចចាក់សំឡេងគំរូនេះបានទេ");
      };

      audio.play().catch((err) => {
        console.warn("Could not play voice profile preview:", err);
        setPlayingProfileId(null);
        audioRef.current = null;
      });
    } catch (err) {
      console.warn("Audio playback initialization error:", err);
      setPlayingProfileId(null);
    }
  };

  return (
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
            const isPlayingThis = playingProfileId === p.id;
            return (
              <div
                key={p.id}
                className={`voice-profile-card ${isActive ? "is-active" : ""}`}
                onClick={() => selectProfile(p.id)}
              >
                <div
                  className={`voice-avatar-disc ${isActive ? "is-active" : ""} ${
                    isPlayingThis ? "is-playing" : ""
                  }`}
                  title={isPlayingThis ? "ចុចដើម្បីផ្អាក" : "ចុចដើម្បីស្តាប់សំឡេងគំរូ"}
                  onClick={(e) => handleTogglePlayProfile(p, e)}
                  style={{ cursor: "pointer" }}
                >
                  {isPlayingThis ? (
                    <SpeakerHigh size={18} weight="fill" color="#38bdf8" />
                  ) : p.name ? (
                    p.name.charAt(0).toUpperCase()
                  ) : (
                    "សំ"
                  )}
                </div>
                <div className="voice-profile-info">
                  <div className="voice-profile-name" title={p.name}>
                    {p.name}
                  </div>
                </div>
                <div className="voice-profile-actions">
                  <button
                    className={`voice-card-btn btn-play ${isPlayingThis ? "is-playing" : ""}`}
                    type="button"
                    title={isPlayingThis ? "ផ្អាកសំឡេង" : "ចាក់ស្តាប់សំឡេងគំរូ"}
                    onClick={(e) => handleTogglePlayProfile(p, e)}
                  >
                    {isPlayingThis ? (
                      <Pause size={15} weight="fill" />
                    ) : (
                      <Play size={15} weight="fill" style={{ marginLeft: 1 }} />
                    )}
                  </button>
                  <button
                    className="voice-card-btn btn-export"
                    type="button"
                    title="ទាញយក / នាំចេញឯកសារសំឡេង"
                    onClick={(e) => handleExportProfile(p, e)}
                  >
                    <DownloadSimple size={15} weight="bold" />
                  </button>
                  <button
                    className="voice-card-btn btn-del"
                    type="button"
                    title="លុបសំឡេងនេះ"
                    onClick={(e) => handleDeleteProfile(p.id, e)}
                  >
                    <Trash size={15} weight="bold" />
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
  );
}

export default VoiceProfilesSidebar;
