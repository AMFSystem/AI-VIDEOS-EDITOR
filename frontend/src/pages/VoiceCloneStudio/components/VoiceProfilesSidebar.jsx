import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  MicrophoneStage,
  Microphone,
  Plus,
  Play,
  Pause,
  Star,
  SquaresFour,
  ListDashes,
  MagnifyingGlass,
  DownloadSimple,
  Trash,
  UploadSimple,
} from "@phosphor-icons/react";

export function VoiceProfilesSidebar({
  profiles = [],
  selectedProfileId,
  selectProfile,
  handleExportProfile,
  handleDeleteProfile,
  setActiveTab,
  handleImportProfileFile,
  notify,
  showLibraryMobile = false,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [viewMode, setViewMode] = useState("grid"); // 'grid' | 'list'
  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = localStorage.getItem("voice_library_favorites");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

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

  const toggleFavorite = (id, e) => {
    e?.stopPropagation();
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      try {
        localStorage.setItem("voice_library_favorites", JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

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

    // Find audio source: sampleUrl / previewUrl or testBlob / referenceBlob
    let audioUrl = p.previewUrl || p.sampleUrl || null;
    const audioBlob = p.testBlob || p.referenceBlob;

    if (!audioUrl) {
      if (audioBlob instanceof Blob) {
        audioUrl = URL.createObjectURL(audioBlob);
      } else if (p.testBase64 || p.referenceBase64) {
        audioUrl = p.testBase64 || p.referenceBase64;
        if (!audioUrl.startsWith("data:")) {
          audioUrl = `data:audio/wav;base64,${audioUrl}`;
        }
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
        if (audioBlob instanceof Blob && !p.previewUrl) {
          try {
            URL.revokeObjectURL(audioUrl);
          } catch {}
        }
      };

      audio.onerror = () => {
        setPlayingProfileId(null);
        audioRef.current = null;
        notify?.("មិនអាចចាក់សំឡេងគំរូនេះបានទេ");
      };

      audio.play().catch((err) => {
        console.warn("Could not play voice preview:", err);
        setPlayingProfileId(null);
        audioRef.current = null;
      });
    } catch (err) {
      console.warn("Audio playback initialization error:", err);
      setPlayingProfileId(null);
    }
  };

  // Filter profiles based on search and category
  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) => {
      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        p.name?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q) ||
        p.role?.toLowerCase().includes(q);

      if (!matchSearch) return false;

      if (selectedCategory === "all") return true;
      if (selectedCategory === "male") {
        return (
          p.gender === "male" ||
          p.category?.toLowerCase().includes("male")
        );
      }
      if (selectedCategory === "female") {
        return p.gender === "female" || p.category?.toLowerCase().includes("female");
      }
      if (selectedCategory === "character") {
        return (
          p.category?.toLowerCase().includes("character") ||
          p.role?.toLowerCase().includes("character")
        );
      }
      return true;
    });
  }, [profiles, searchQuery, selectedCategory]);

  return (
    <aside className={`voice-studio-sidebar voice-library-panel ${showLibraryMobile ? "is-visible-mobile" : ""}`}>
      {/* Voice Library Header */}
      <div className="voice-library-header">
        <div className="voice-library-brand">
          <div className="voice-library-icon-badge">
            <MicrophoneStage size={20} weight="fill" color="#ffffff" />
          </div>
          <div className="voice-library-titles">
            <h2 className="voice-library-title">Voice Library</h2>
          </div>
        </div>

        <button
          className="voice-btn-add-new"
          type="button"
          onClick={() => setActiveTab("clone")}
          title="បង្កើតសំឡេងក្លូនថ្មី"
        >
          <Plus size={14} weight="bold" />
          <span>+ Add New Voice</span>
        </button>
      </div>

      {/* Search & Filter Controls */}
      <div className="voice-library-controls-bar">
        <div className="voice-library-search">
          <MagnifyingGlass size={15} className="voice-search-icon" />
          <input
            className="voice-library-search-input"
            type="text"
            placeholder="Search voices..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <select
          className="voice-category-select"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          <option value="all">All Categories</option>
          <option value="male">Male Voice</option>
          <option value="female">Female Voice</option>
          <option value="character">Character Voice</option>
        </select>

        <div className="voice-view-toggles">
          <button
            type="button"
            className={`voice-view-btn ${viewMode === "grid" ? "is-active" : ""}`}
            onClick={() => setViewMode("grid")}
            title="Grid View"
          >
            <SquaresFour size={16} weight="bold" />
          </button>
          <button
            type="button"
            className={`voice-view-btn ${viewMode === "list" ? "is-active" : ""}`}
            onClick={() => setViewMode("list")}
            title="List View"
          >
            <ListDashes size={16} weight="bold" />
          </button>
        </div>
      </div>

      {/* Voice Cards Container */}
      <div className="voice-library-scroll-area">
        {filteredProfiles.length === 0 ? (
          <div className="voice-empty-state">
            <Microphone size={36} color="#64748b" />
            <strong>រកមិនឃើញសំឡេងទេ</strong>
            <p style={{ fontSize: "12px", color: "#64748b", margin: "4px 0 0" }}>
              សូមសាកល្បងស្វែងរកពាក្យផ្សេង ឬចុច "+ Add New Voice" ដើម្បីក្លូនសំឡេងថ្មី
            </p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="voice-cards-grid-layout">
            {filteredProfiles.map((p) => {
              const isActive = p.id === selectedProfileId;
              const isPlayingThis = playingProfileId === p.id;
              const isFav = favorites.has(p.id);

              return (
                <div
                  key={p.id}
                  className={`voice-grid-card ${isActive ? "is-active" : ""}`}
                  onClick={() => selectProfile(p.id)}
                >
                  {/* Card Thumbnail */}
                  <div className="voice-grid-thumb-container">
                    {p.imageUrl || p.avatarUrl ? (
                      <img
                        src={p.imageUrl || p.avatarUrl}
                        alt={p.name}
                        className="voice-grid-thumb-img"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="voice-grid-thumb-fallback">
                        <MicrophoneStage size={32} weight="duotone" color="#818cf8" />
                        <span className="voice-grid-thumb-initials">
                          {p.name ? p.name.charAt(0).toUpperCase() : "V"}
                        </span>
                      </div>
                    )}
                    <div className="voice-grid-thumb-overlay" />

                    {/* Favorite Star Button */}
                    <button
                      type="button"
                      className={`voice-star-btn ${isFav ? "is-fav" : ""}`}
                      onClick={(e) => toggleFavorite(p.id, e)}
                      title={isFav ? "ដកចេញពីសំឡេងពេញចិត្ត" : "ដាក់ជាសំឡេងពេញចិត្ត"}
                    >
                      <Star
                        size={13}
                        weight={isFav ? "fill" : "bold"}
                        color={isFav ? "#fbbf24" : "rgba(255, 255, 255, 0.75)"}
                      />
                    </button>
                  </div>

                  {/* Card Body */}
                  <div className="voice-grid-card-body">
                    <div className="voice-grid-card-title" title={p.name}>
                      {p.name}
                    </div>

                    <div className="voice-grid-tags-row">
                      <span className="voice-pill-tag">
                        {p.category || (p.gender === "female" ? "Female Lead" : "Male Lead")}
                      </span>
                      <span className="voice-pill-status">✓ Ready</span>
                    </div>

                    {/* Preview Bar */}
                    <div className="voice-grid-preview-bar">
                      <button
                        type="button"
                        className={`voice-card-preview-btn ${isPlayingThis ? "is-playing" : ""}`}
                        onClick={(e) => handleTogglePlayProfile(p, e)}
                        title={isPlayingThis ? "ផ្អាក" : "ចាក់ស្តាប់គំរូ"}
                      >
                        <span className="voice-preview-play-icon">
                          {isPlayingThis ? (
                            <Pause size={10} weight="fill" />
                          ) : (
                            <Play size={10} weight="fill" />
                          )}
                        </span>
                        <span>Preview</span>
                      </button>

                      <span className="voice-card-duration">
                        {p.duration || "0:25"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="voice-profiles-list-layout">
            {filteredProfiles.map((p) => {
              const isActive = p.id === selectedProfileId;
              const isPlayingThis = playingProfileId === p.id;
              const isFav = favorites.has(p.id);

              return (
                <div
                  key={p.id}
                  className={`voice-list-row-item ${isActive ? "is-active" : ""}`}
                  onClick={() => selectProfile(p.id)}
                >
                  {p.imageUrl || p.avatarUrl ? (
                    <img
                      src={p.imageUrl || p.avatarUrl}
                      alt={p.name}
                      className="voice-list-row-thumb"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="voice-list-row-thumb voice-thumb-initials-disc">
                      {p.name ? p.name.charAt(0).toUpperCase() : "V"}
                    </div>
                  )}
                  <div className="voice-list-row-info">
                    <div className="voice-list-row-name">{p.name}</div>
                    <div className="voice-list-row-sub">
                      <span>{p.category || "Character Voice"}</span>
                      <span style={{ color: "#10b981" }}>✓ Ready</span>
                    </div>
                  </div>

                  <div className="voice-list-row-actions">
                    <button
                      type="button"
                      className={`voice-card-btn btn-play ${isPlayingThis ? "is-playing" : ""}`}
                      onClick={(e) => handleTogglePlayProfile(p, e)}
                      title={isPlayingThis ? "ផ្អាក" : "ចាក់ស្តាប់"}
                    >
                      {isPlayingThis ? <Pause size={14} weight="fill" /> : <Play size={14} weight="fill" />}
                    </button>
                    <button
                      type="button"
                      className={`voice-card-btn ${isFav ? "is-fav" : ""}`}
                      onClick={(e) => toggleFavorite(p.id, e)}
                    >
                      <Star size={14} weight={isFav ? "fill" : "regular"} color={isFav ? "#fbbf24" : "#94a3b8"} />
                    </button>
                    {!p.isPreset && handleDeleteProfile && (
                      <button
                        type="button"
                        className="voice-card-btn btn-del"
                        onClick={(e) => handleDeleteProfile(p.id, e)}
                        title="លុបសំឡេងនេះ"
                      >
                        <Trash size={14} weight="bold" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Optional Import Footer */}
      <div className="voice-library-footer">
        <label
          className="voice-import-label"
          title="នាំចូលកញ្ចប់សំឡេង (.json)"
        >
          <UploadSimple size={13} weight="bold" />
          <span>នាំចូលសំឡេង (.json)</span>
          <input
            type="file"
            accept=".json,.voiceprofile.json"
            hidden
            onChange={handleImportProfileFile}
          />
        </label>
      </div>
    </aside>
  );
}

export default VoiceProfilesSidebar;
