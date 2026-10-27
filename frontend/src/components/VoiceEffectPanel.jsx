import { useState, useRef, useEffect, useMemo } from "react";
import {
  Check,
  MagnifyingGlass,
  MusicNote,
  Pause,
  PencilSimple,
  Play,
  Plus,
  PlusCircle,
  Trash,
  Waveform,
  X,
} from "@phosphor-icons/react";
import "./VoiceEffectPanel.css";

// Real audio files from user's Downloads folder
const REAL_DOWNLOADED_EFFECTS = [
  {
    id: "cinematic-trailer",
    name: "cinematic-trailer-music-intense-synth-strings-impacts-gfx-sounds-1-00-13.mp3",
    displayName: "Cinematic Trailer Synth",
    category: "cinematic",
    durationText: "00:14",
    durationSec: 13.8,
    theme: "theme-pink",
    src: "/assets/voice-effects/cinematic-trailer-music-intense-synth-strings-impacts-gfx-sounds-1-00-13.mp3",
    isMusic: true,
  },
  {
    id: "whoosh-boom",
    name: "whoosh-boom-dramatic-powerful-jam-fx-cinematic-whoosh-boom-1-0m08s.mp3",
    displayName: "Whoosh Boom FX",
    category: "whoosh",
    durationText: "00:08",
    durationSec: 8.2,
    theme: "theme-gray",
    src: "/assets/voice-effects/whoosh-boom-dramatic-powerful-jam-fx-cinematic-whoosh-boom-1-0m08s.mp3",
  },
  {
    id: "luminewave-end",
    name: "luminewave-i-know-this-is-the-end-short-version-621150.mp3",
    displayName: "Luminewave End Short",
    category: "cinematic",
    durationText: "00:13",
    durationSec: 13.2,
    theme: "theme-cyan",
    src: "/assets/voice-effects/luminewave-i-know-this-is-the-end-short-version-621150.mp3",
    isMusic: true,
  },
];

const LOCAL_STORAGE_KEY = "ai_video_editor_custom_voice_effects_v1";
const TITLE_STORAGE_KEY = "ai_video_editor_effect_title_overrides_v1";

function loadSavedCustomEffects() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistCustomEffects(items) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    console.warn("Could not save to localStorage", err);
  }
}

function loadTitleOverrides() {
  try {
    const raw = localStorage.getItem(TITLE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveTitleOverrides(overrides) {
  try {
    localStorage.setItem(TITLE_STORAGE_KEY, JSON.stringify(overrides));
  } catch (err) {
    console.warn("Could not save title overrides", err);
  }
}

export function VoiceEffectPanel({
  replaceAudio,
  applyAssetToTrack,
  currentTime = 0,
  notify = () => {},
  selectedAudioSegment,
  updateAudioSegment,
}) {
  const [customEffects, setCustomEffects] = useState(() => loadSavedCustomEffects());
  const [titleOverrides, setTitleOverrides] = useState(() => loadTitleOverrides());
  const [playingId, setPlayingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState("");

  const fileInputRef = useRef(null);
  const audioPlayerRef = useRef(new Audio());
  const editInputRef = useRef(null);

  useEffect(() => {
    const player = audioPlayerRef.current;
    const handleEnded = () => setPlayingId(null);
    player.addEventListener("ended", handleEnded);
    return () => {
      player.pause();
      player.removeEventListener("ended", handleEnded);
    };
  }, []);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  // Format seconds to mm:ss
  const formatSec = (seconds) => {
    const s = Math.round(seconds || 0);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${String(m).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
  };

  // Handle files selected from computer
  const handleFilesAdded = async (files) => {
    if (!files || !files.length) return;
    const audioFiles = Array.from(files).filter(
      (f) => f.type.startsWith("audio/") || /\.(mp3|wav|m4a|aac|ogg)$/i.test(f.name)
    );

    if (!audioFiles.length) {
      notify("សូមជ្រើសរើសឯកសារសំឡេង (MP3, WAV, M4A)!");
      return;
    }

    const newItems = await Promise.all(
      audioFiles.map(async (file) => {
        const url = URL.createObjectURL(file);
        let durationSec = 8;
        try {
          const tempAudio = new Audio(url);
          await new Promise((res) => {
            tempAudio.onloadedmetadata = () => {
              durationSec = tempAudio.duration || 8;
              res();
            };
            tempAudio.onerror = () => res();
            setTimeout(res, 800);
          });
        } catch {
          // ignore fallback
        }

        const baseName = file.name.replace(/\.[^/.]+$/, "");
        return {
          id: `custom-${crypto.randomUUID()}`,
          name: file.name,
          displayName: baseName.length > 22 ? `${baseName.slice(0, 15)}...${baseName.slice(-5)}` : baseName,
          category: "custom",
          durationText: formatSec(durationSec),
          durationSec,
          file,
          url,
          theme: Math.random() > 0.5 ? "theme-pink" : "theme-gray",
          isCustom: true,
        };
      })
    );

    setCustomEffects((prev) => {
      const updated = [...newItems, ...prev];
      const meta = updated.map((item) => ({
        id: item.id,
        name: item.name,
        displayName: item.displayName,
        category: "custom",
        durationText: item.durationText,
        durationSec: item.durationSec,
        theme: item.theme,
        isCustom: true,
      }));
      persistCustomEffects(meta);
      return updated;
    });

    notify(`⚡ បានបន្ថែម ${audioFiles.length} Voice Effect ក្នុង Local Computer!`);
  };

  const removeCustomEffect = (id) => {
    setCustomEffects((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      persistCustomEffects(updated.map((item) => ({ ...item, file: undefined, url: undefined })));
      return updated;
    });
    // also clean up any title overrides
    setTitleOverrides((prev) => {
      const next = { ...prev };
      delete next[id];
      saveTitleOverrides(next);
      return next;
    });
    notify("បានលុប Voice Effect ចេញពីបញ្ជី");
  };

  // Title Editing handlers
  const handleStartEdit = (e, effect) => {
    e.stopPropagation();
    const currentTitle = titleOverrides[effect.id] || effect.displayName || effect.name;
    setEditingId(effect.id);
    setEditingText(currentTitle);
  };

  const handleSaveEdit = (e, effectId) => {
    e?.stopPropagation();
    const trimmed = editingText.trim();
    if (trimmed) {
      const updated = { ...titleOverrides, [effectId]: trimmed };
      setTitleOverrides(updated);
      saveTitleOverrides(updated);
      notify("✅ បានកែប្រែឈ្មោះ (Title) រួចរាល់!");
    }
    setEditingId(null);
  };

  const handleCancelEdit = (e) => {
    e?.stopPropagation();
    setEditingId(null);
  };

  // Playback preview
  const togglePlay = async (effect) => {
    const player = audioPlayerRef.current;
    if (playingId === effect.id) {
      player.pause();
      setPlayingId(null);
      return;
    }

    player.pause();
    setPlayingId(effect.id);

    try {
      const audioSrc = effect.url || effect.src;
      if (audioSrc) {
        player.src = audioSrc;
        await player.play();
      } else if (effect.file) {
        const url = URL.createObjectURL(effect.file);
        effect.url = url;
        player.src = url;
        await player.play();
      }
    } catch (e) {
      console.warn("Audio play error", e);
      setPlayingId(null);
    }
  };

  // Add to timeline
  const handleAddToTimeline = async (effect) => {
    try {
      let blob = effect.file;
      let duration = effect.durationSec || 8;

      if (!blob && effect.src) {
        notify("កំពុងទាញយកសំឡេង Effect...");
        const response = await fetch(effect.src);
        blob = await response.blob();
      }

      if (!blob) {
        notify("មិនអាចទាញយកទិន្នន័យសំឡេងបានទេ");
        return;
      }

      const activeName = titleOverrides[effect.id] || effect.displayName || effect.name;

      if (replaceAudio) {
        replaceAudio(blob, duration, [], "បានបញ្ចូល Voice Effect ទៅ Timeline", {
          name: activeName,
          start: currentTime,
          sourceKind: "sound-effect",
        });
        notify(`⚡ បានបញ្ចូល «${activeName}» ទៅលើ Timeline!`);
      } else if (applyAssetToTrack) {
        applyAssetToTrack(
          {
            type: "audio",
            kind: effect.isMusic ? "music" : "audio",
            name: activeName,
            blob,
            duration,
          },
          effect.isMusic ? "music" : "audio"
        );
        notify(`⚡ បានបញ្ចូល «${activeName}» ទៅលើ Timeline!`);
      }
    } catch (err) {
      console.error(err);
      notify("មានបញ្ហាក្នុងការបញ្ចូលសំឡេងទៅ Timeline");
    }
  };

  // Combined effects list
  const allItems = useMemo(
    () => [...customEffects, ...REAL_DOWNLOADED_EFFECTS],
    [customEffects]
  );

  // Filtered by Search
  const displayItems = useMemo(() => {
    if (!searchQuery.trim()) return allItems;
    const q = searchQuery.toLowerCase().trim();
    return allItems.filter((effect) => {
      const title = titleOverrides[effect.id] || effect.displayName || effect.name;
      return (
        title.toLowerCase().includes(q) ||
        (effect.name && effect.name.toLowerCase().includes(q))
      );
    });
  }, [allItems, searchQuery, titleOverrides]);

  return (
    <section className="voice-effect-panel" aria-label="Voice Effect Studio">
      {/* 1. Header with [➕ Add Voice Effect] Button */}
      <div className="voice-effect-header">
        <div>
          <h2 className="voice-effect-main-title">
            Voice & Sound Effects
          </h2>
          <small className="voice-effect-sub-title">
            Local Computer ({allItems.length} Effects)
          </small>
        </div>

        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: "none" }}
          multiple
          accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg"
          onChange={(e) => handleFilesAdded(e.target.files)}
        />

        {/* Primary 3D Action Button: Add Voice Effect */}
        <button
          type="button"
          className="voice-effect-add-main-btn"
          onClick={() => fileInputRef.current?.click()}
          title="បន្ថែម Voice Effect ពីកុំព្យូទ័ររក្សាទុកប្រើលើកក្រោយ"
        >
          <PlusCircle size={15} weight="bold" />
          <span>បន្ថែម Voice Effect</span>
        </button>
      </div>

      {/* 2. 3D Search Bar */}
      <div className="voice-effect-search-box">
        <MagnifyingGlass size={15} weight="bold" className="voice-effect-search-icon" />
        <input
          type="text"
          className="voice-effect-search-input"
          placeholder="ស្វែងរកសំឡេង Effect..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery ? (
          <button
            type="button"
            className="voice-effect-search-clear"
            onClick={() => setSearchQuery("")}
            title="លុបការស្វែងរក"
          >
            <X size={12} weight="bold" />
          </button>
        ) : null}
      </div>

      {/* 3. Compact 3D Cards Grid */}
      <div className="voice-effect-grid">
        {displayItems.length ? (
          displayItems.map((effect) => {
            const isPlaying = playingId === effect.id;
            const currentTitle = titleOverrides[effect.id] || effect.displayName || effect.name;
            const isEditing = editingId === effect.id;

            return (
              <div
                key={effect.id}
                className={`voice-effect-card-3d ${isPlaying ? "is-playing" : ""}`}
              >
                {/* 3D Visual Box with Play Overlay */}
                <div
                  className={`voice-effect-thumb-3d ${effect.theme || "theme-pink"}`}
                  onClick={() => togglePlay(effect)}
                  title="ចុចដើម្បីស្ដាប់សាកល្បង"
                >
                  {effect.theme === "theme-pink" ? (
                    <Waveform size={26} weight="fill" />
                  ) : (
                    <MusicNote size={26} weight="fill" />
                  )}

                  <div className="voice-effect-play-overlay">
                    <button
                      type="button"
                      className="voice-effect-play-btn"
                      aria-label={isPlaying ? "Pause" : "Play"}
                    >
                      {isPlaying ? (
                        <Pause size={14} weight="fill" />
                      ) : (
                        <Play size={14} weight="fill" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Editable Title Row */}
                {isEditing ? (
                  <div className="voice-effect-edit-row" onClick={(e) => e.stopPropagation()}>
                    <input
                      ref={editInputRef}
                      type="text"
                      className="voice-effect-edit-input"
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveEdit(e, effect.id);
                        if (e.key === "Escape") handleCancelEdit(e);
                      }}
                    />
                    <div className="voice-effect-edit-buttons">
                      <button
                        type="button"
                        className="voice-effect-btn-save"
                        onClick={(e) => handleSaveEdit(e, effect.id)}
                        title="រក្សាទុក"
                      >
                        <Check size={11} weight="bold" />
                      </button>
                      <button
                        type="button"
                        className="voice-effect-btn-cancel"
                        onClick={handleCancelEdit}
                        title="បោះបង់"
                      >
                        <X size={11} weight="bold" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="voice-effect-title-wrap">
                    <span className="voice-effect-name-3d" title={currentTitle}>
                      {currentTitle}
                    </span>
                    <button
                      type="button"
                      className="voice-effect-edit-trigger"
                      onClick={(e) => handleStartEdit(e, effect)}
                      title="កែប្រែឈ្មោះ (Edit Title)"
                    >
                      <PencilSimple size={11} weight="bold" />
                    </button>
                  </div>
                )}

                {/* Duration Badge */}
                <span className="voice-effect-duration-3d">
                  {effect.durationText || "00:08"}
                </span>

                {/* Bottom Action Buttons (3D Compact) */}
                <div className="voice-effect-actions-row">
                  <button
                    type="button"
                    className="voice-effect-add-btn-3d"
                    onClick={() => handleAddToTimeline(effect)}
                    title="ដាក់សំឡេង Effect នេះលើ Timeline"
                  >
                    <Plus size={11} weight="bold" />
                    <span>+ Timeline</span>
                  </button>

                  {effect.isCustom ? (
                    <button
                      type="button"
                      className="voice-effect-del-btn-3d"
                      onClick={() => removeCustomEffect(effect.id)}
                      title="លុបពីបញ្ជី"
                    >
                      <Trash size={11} weight="bold" />
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })
        ) : (
          <div className="voice-effect-empty">
            <span>{searchQuery ? `រកមិនឃើញ «${searchQuery}» ទេ` : "មិនទាន់មានសំឡេង Effect ក្នុងផ្នែកនេះទេ"}</span>
          </div>
        )}
      </div>
    </section>
  );
}
