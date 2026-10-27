import { useState, useMemo } from "react";
import {
  MagnifyingGlass,
  Plus,
  Sparkle,
  TextT,
  Check,
  Flame,
  Lightning,
} from "@phosphor-icons/react";
import {
  TEXT_TEMPLATES,
  TEXT_EFFECT_STYLES,
  TEXT_ANIMATIONS,
  KHMER_FONTS,
  LATIN_TRENDING_FONTS,
} from "../config/textTemplates.js";
import { ensureCaptionFontLoaded } from "../lib/captionFonts.js";
import "./TextStudioPanel.css";

export function TextStudioPanel({
  captionSegments = [],
  setCaptionSegments = () => {},
  commitCaptionSegments = null,
  selectedSegmentId = "",
  setSelectedSegmentId = () => {},
  currentTime = 0,
  captionStyle = {},
  setCaptionStyle = () => {},
  captionSize = 18,
  setCaptionSize = () => {},
  notify = () => {},
  t = (k) => k,
  uiLanguage = "km",
}) {
  const [activeTab, setActiveTab] = useState("styles"); // 'styles' | 'animations' | 'templates' | 'fonts'
  const [searchQuery, setSearchQuery] = useState("");

  // Find currently selected caption/text segment
  const selectedTextSegment = useMemo(() => {
    return captionSegments.find((seg) => seg.id === selectedSegmentId) || null;
  }, [captionSegments, selectedSegmentId]);

  const activeOverrides = selectedTextSegment?.styleOverrides || {};
  const currentFontId = activeOverrides.fontId || captionStyle?.fontId || "kantumruy-pro";
  const currentAnimation = activeOverrides.animation || captionStyle?.animation || "none";

  // Filter animations
  const filteredAnimations = useMemo(() => {
    if (!searchQuery.trim()) return TEXT_ANIMATIONS;
    const q = searchQuery.toLowerCase().trim();
    return TEXT_ANIMATIONS.filter(
      (a) => a.name.toLowerCase().includes(q) || (a.nameKm && a.nameKm.toLowerCase().includes(q))
    );
  }, [searchQuery]);

  // Filter templates
  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) return TEXT_TEMPLATES;
    const q = searchQuery.toLowerCase().trim();
    return TEXT_TEMPLATES.filter((tpl) => {
      return (
        tpl.title.toLowerCase().includes(q) ||
        (tpl.titleKm && tpl.titleKm.toLowerCase().includes(q))
      );
    });
  }, [searchQuery]);

  // Filter fonts
  const filteredKhmerFonts = useMemo(() => {
    if (!searchQuery.trim()) return KHMER_FONTS;
    return KHMER_FONTS.filter((f) =>
      f.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
    );
  }, [searchQuery]);

  const filteredLatinFonts = useMemo(() => {
    if (!searchQuery.trim()) return LATIN_TRENDING_FONTS;
    return LATIN_TRENDING_FONTS.filter((f) =>
      f.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
    );
  }, [searchQuery]);

  // Helper to commit changes to segments
  const applySegmentsChange = (nextSegments, msg = "អត្ថបទត្រូវបានធ្វើបច្ចុប្បន្នភាព", nextSelectedId = null) => {
    if (typeof commitCaptionSegments === "function") {
      const idx = nextSelectedId
        ? nextSegments.findIndex((s) => s.id === nextSelectedId)
        : 0;
      commitCaptionSegments(nextSegments, msg, Math.max(0, idx));
    } else {
      setCaptionSegments(nextSegments);
    }
    if (nextSelectedId) {
      setSelectedSegmentId(nextSelectedId);
    }
  };

  // Add Default Text at Current Time
  const handleAddDefaultText = () => {
    const newId = `text-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const start = Math.max(0, Number(currentTime) || 0);
    const end = start + 3.0;

    const newSegment = {
      id: newId,
      text: uiLanguage === "km" ? "បញ្ចូលអត្ថបទរបស់អ្នកនៅទីនេះ" : "Add your text here",
      start,
      end,
      placement: { x: 50, y: 50 },
      styleOverrides: {
        fontId: "kantumruy-pro",
        textColor: "#ffffff",
        textStrokeColor: "#05080d",
        textStrokeWidth: 2,
        backgroundColor: "#000000",
        backgroundOpacity: 0.5,
        borderColor: "#ffffff",
        borderWidth: 0,
        radius: 8,
        paddingX: 20,
        paddingY: 8,
        shadowOpacity: 0.8,
        effect: "normal",
      },
    };

    const nextSegments = [...captionSegments, newSegment].sort((a, b) => a.start - b.start);
    applySegmentsChange(nextSegments, "✨ បានបន្ថែម Text ថ្មី!", newId);
    notify("✨ បានបន្ថែម Text ថ្មីលើ Timeline!");
  };

  // Apply or Add a Text Template
  const handleSelectTemplate = (template) => {
    ensureCaptionFontLoaded(template.fontId, template.titleKm || template.title).catch(() => {});

    if (selectedTextSegment) {
      // Apply template style to currently selected text clip
      const nextSegments = captionSegments.map((seg) => {
        if (seg.id === selectedSegmentId) {
          return {
            ...seg,
            placement: template.placement || seg.placement,
            styleOverrides: {
              ...(seg.styleOverrides || {}),
              ...template.style,
              fontId: template.fontId,
            },
          };
        }
        return seg;
      });
      applySegmentsChange(nextSegments, `🎨 បានអនុវត្ត Template «${template.title}»!`, selectedSegmentId);
      notify(`🎨 បានអនុវត្ត Template «${template.title}» លើ Text!`);
    } else {
      // Add as new text clip at currentTime
      const newId = `text-tpl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const start = Math.max(0, Number(currentTime) || 0);
      const end = start + (template.duration || 3.5);

      const newSegment = {
        id: newId,
        text: uiLanguage === "km" && template.titleKm ? template.titleKm : template.title,
        start,
        end,
        placement: template.placement || { x: 50, y: 50 },
        styleOverrides: {
          ...template.style,
          fontId: template.fontId,
        },
      };

      const nextSegments = [...captionSegments, newSegment].sort((a, b) => a.start - b.start);
      applySegmentsChange(nextSegments, `✨ បានបន្ថែម Template «${template.title}»!`, newId);
      notify(`✨ បានបន្ថែម Template «${template.title}» លើ Timeline!`);
    }
  };

  // Apply or Add a Text Effect Style
  const handleSelectStyle = (effectStyle) => {
    if (selectedTextSegment) {
      const nextSegments = captionSegments.map((seg) => {
        if (seg.id === selectedSegmentId) {
          return {
            ...seg,
            styleOverrides: {
              ...(seg.styleOverrides || {}),
              ...effectStyle.style,
            },
          };
        }
        return seg;
      });
      applySegmentsChange(nextSegments, `✨ បានអនុវត្ត Style «${effectStyle.name}»!`, selectedSegmentId);
      notify(`✨ បានអនុវត្ត Style «${effectStyle.name}»!`);
    } else {
      // Create new text with this style
      const newId = `text-style-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const start = Math.max(0, Number(currentTime) || 0);
      const end = start + 3.0;

      const newSegment = {
        id: newId,
        text: effectStyle.sample || "STYLE TEXT",
        start,
        end,
        placement: { x: 50, y: 50 },
        styleOverrides: {
          ...effectStyle.style,
          fontId: "koulen",
        },
      };

      const nextSegments = [...captionSegments, newSegment].sort((a, b) => a.start - b.start);
      applySegmentsChange(nextSegments, `✨ បានបន្ថែម Style «${effectStyle.name}»!`, newId);
      notify(`✨ បានបន្ថែម «${effectStyle.name}» លើ Timeline!`);
    }
  };

  // Apply Font to selected text or global
  const handleSelectFont = (fontObj) => {
    ensureCaptionFontLoaded(fontObj.id, fontObj.sample).catch(() => {});

    if (selectedTextSegment) {
      const nextSegments = captionSegments.map((seg) => {
        if (seg.id === selectedSegmentId) {
          return {
            ...seg,
            styleOverrides: {
              ...(seg.styleOverrides || {}),
              fontId: fontObj.id,
            },
          };
        }
        return seg;
      });
      applySegmentsChange(nextSegments, `🔤 បានប្តូរ Font ទៅជា «${fontObj.name}»!`, selectedSegmentId);
      notify(`🔤 បានប្តូរ Font ទៅជា «${fontObj.name}»!`);
    } else {
      setCaptionStyle((prev) => ({ ...prev, fontId: fontObj.id }));
      notify(`🔤 បានកំណត់ Font លំនាំដើម: ${fontObj.name}`);
    }
  };

  // Apply or Add a Text Animation
  const handleSelectAnimation = (animObj) => {
    if (selectedTextSegment) {
      const nextSegments = captionSegments.map((seg) => {
        if (seg.id === selectedSegmentId) {
          return {
            ...seg,
            styleOverrides: {
              ...(seg.styleOverrides || {}),
              animation: animObj.id,
            },
          };
        }
        return seg;
      });
      applySegmentsChange(nextSegments, `⚡ បានអនុវត្តចលនា «${animObj.name}»!`, selectedSegmentId);
      notify(`⚡ បានអនុវត្តចលនា «${animObj.name}» លើ Text!`);
    } else {
      setCaptionStyle((prev) => ({ ...prev, animation: animObj.id }));
      notify(`⚡ បានកំណត់ចលនាអក្សរ: ${animObj.name}`);
    }
  };

  return (
    <section className="text-studio-panel" aria-label="Text Studio">
      {/* 1. Header */}
      <div className="text-studio-header">
        <div className="text-studio-header-title">
          <div className="text-studio-icon-badge">
            <TextT size={18} weight="bold" />
          </div>
          <div>
            <h2 className="text-studio-title">Text Studio</h2>
          </div>
        </div>

        <button
          type="button"
          className="text-studio-add-btn"
          onClick={handleAddDefaultText}
          title="Add new text clip at playhead"
        >
          <Plus size={14} weight="bold" />
          <span>Add Text</span>
        </button>
      </div>


      {/* 3. Main Navigation Tabs */}
      <div className="text-studio-tabs">
        <button
          type="button"
          className={`text-tab-btn ${activeTab === "styles" ? "is-active" : ""}`}
          onClick={() => setActiveTab("styles")}
        >
          <Flame size={13} weight="bold" />
          <span>Styles</span>
        </button>
        <button
          type="button"
          className={`text-tab-btn ${activeTab === "animations" ? "is-active" : ""}`}
          onClick={() => setActiveTab("animations")}
        >
          <Lightning size={13} weight="bold" />
          <span>Animation</span>
        </button>
        <button
          type="button"
          className={`text-tab-btn ${activeTab === "templates" ? "is-active" : ""}`}
          onClick={() => setActiveTab("templates")}
        >
          <Sparkle size={13} weight="bold" />
          <span>Templates</span>
        </button>
        <button
          type="button"
          className={`text-tab-btn ${activeTab === "fonts" ? "is-active" : ""}`}
          onClick={() => setActiveTab("fonts")}
        >
          <TextT size={13} weight="bold" />
          <span>Fonts</span>
        </button>
      </div>

      {/* 4. Search Bar */}
      <div className="text-studio-search-bar">
        <MagnifyingGlass size={13} className="text-search-icon" />
        <input
          type="text"
          className="text-search-input"
          placeholder={
            activeTab === "fonts"
              ? "ស្វែងរកពុម្ពអក្សរ Font..."
              : activeTab === "styles"
              ? "ស្វែងរក Style ម៉ូដអក្សរ..."
              : "ស្វែងរក Template អក្សរ..."
          }
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery ? (
          <button
            type="button"
            className="text-search-clear"
            onClick={() => setSearchQuery("")}
          >
            ×
          </button>
        ) : null}
      </div>

      {/* 5. TAB CONTENT: TEMPLATES */}
      {activeTab === "templates" && (
        <div className="text-tab-pane">
          {/* Templates Grid */}
          <div className="text-templates-grid">
            {filteredTemplates.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                className={`text-template-card ${tpl.previewClass}`}
                onClick={() => handleSelectTemplate(tpl)}
              >
                <div className="text-template-preview-box">
                  <span
                    className="text-template-live-title"
                    style={{
                      color: tpl.style.textColor,
                      WebkitTextStroke: `${tpl.style.textStrokeWidth * 0.7}px ${tpl.style.textStrokeColor}`,
                      backgroundColor:
                        tpl.style.backgroundOpacity > 0 ? tpl.style.backgroundColor : "transparent",
                      border: tpl.style.borderWidth
                        ? `${tpl.style.borderWidth}px solid ${tpl.style.borderColor}`
                        : "none",
                      borderRadius: `${tpl.style.radius * 0.6}px`,
                      textShadow:
                        tpl.style.effect === "neon"
                          ? `0 0 10px ${tpl.style.borderColor || tpl.style.textColor}`
                          : "0 2px 5px rgba(0,0,0,0.8)",
                    }}
                  >
                    {uiLanguage === "km" && tpl.titleKm ? tpl.titleKm : tpl.title}
                  </span>
                </div>
                <div className="text-template-meta">
                  <span className="text-template-label">
                    {uiLanguage === "km" && tpl.titleKm ? tpl.titleKm : tpl.title}
                  </span>
                  <span className="text-template-badge">
                    {tpl.category.toUpperCase()}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 6. TAB CONTENT: STYLES (TEXT EFFECTS) */}
      {activeTab === "styles" && (
        <div className="text-tab-pane">
          <div className="text-styles-grid">
            {TEXT_EFFECT_STYLES.map((eff) => (
              <button
                key={eff.id}
                type="button"
                className={`text-style-card ${eff.previewClass || ""}`}
                onClick={() => handleSelectStyle(eff)}
                title={eff.nameKm || eff.name}
              >
                <span className="text-style-art">{eff.sample || "ART"}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 6b. TAB CONTENT: ANIMATIONS */}
      {activeTab === "animations" && (
        <div className="text-tab-pane">
          <div className="text-animations-grid">
            {filteredAnimations.map((anim) => {
              const isSelected = currentAnimation === anim.id;
              return (
                <button
                  key={anim.id}
                  type="button"
                  className={`text-anim-card ${isSelected ? "is-selected" : ""}`}
                  onClick={() => handleSelectAnimation(anim)}
                  title={anim.nameKm || anim.name}
                >
                  <div className={`text-anim-preview-box ${anim.previewClass || ""}`}>
                    <span className="text-anim-icon">{anim.icon}</span>
                    <span className="text-anim-sample-text">TEXT</span>
                  </div>
                  <div className="text-anim-meta">
                    <span className="text-anim-name">{uiLanguage === "km" ? anim.nameKm : anim.name}</span>
                    {isSelected && (
                      <span className="text-anim-check">
                        <Check size={12} weight="bold" />
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 7. TAB CONTENT: FONTS */}
      {activeTab === "fonts" && (
        <div className="text-tab-pane">
          {/* Khmer Fonts Section */}
          <div className="text-font-section-head">
            <span className="text-font-flag">🇰🇭</span>
            <strong>Khmer Fonts (ពុម្ពអក្សរខ្មែរ)</strong>
          </div>
          <div className="text-fonts-list">
            {filteredKhmerFonts.map((fontItem) => {
              const isSelected = currentFontId === fontItem.id;
              return (
                <button
                  key={fontItem.id}
                  type="button"
                  className={`text-font-item ${isSelected ? "is-selected" : ""}`}
                  onClick={() => handleSelectFont(fontItem)}
                >
                  <div className="text-font-left">
                    <span className="text-font-name">{fontItem.name}</span>
                    <span
                      className="text-font-sample"
                      style={{ fontFamily: fontItem.family }}
                    >
                      {fontItem.sample}
                    </span>
                  </div>
                  {isSelected ? (
                    <span className="text-font-check">
                      <Check size={14} weight="bold" />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {/* Latin / English Trending Fonts Section */}
          <div className="text-font-section-head" style={{ marginTop: 14 }}>
            <span className="text-font-flag">🌐</span>
            <strong>Trending Fonts (អន្តរជាតិ)</strong>
          </div>
          <div className="text-fonts-list">
            {filteredLatinFonts.map((fontItem) => {
              const isSelected = currentFontId === fontItem.id;
              return (
                <button
                  key={fontItem.id}
                  type="button"
                  className={`text-font-item ${isSelected ? "is-selected" : ""}`}
                  onClick={() => handleSelectFont(fontItem)}
                >
                  <div className="text-font-left">
                    <span className="text-font-name">{fontItem.name}</span>
                    <span
                      className="text-font-sample"
                      style={{ fontFamily: fontItem.family }}
                    >
                      {fontItem.sample}
                    </span>
                  </div>
                  {isSelected ? (
                    <span className="text-font-check">
                      <Check size={14} weight="bold" />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
