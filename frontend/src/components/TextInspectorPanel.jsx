import { useState, useMemo } from "react";
import {
  TextT,
  Trash,
  Copy,
  Plus,
  Sparkle,
  TextAlignLeft,
  TextAlignCenter,
  TextAlignRight,
  ArrowsInLineVertical,
  ArrowsInLineHorizontal,
  SlidersHorizontal,
  Palette,
  Check,
} from "@phosphor-icons/react";
import { KHMER_FONTS, LATIN_TRENDING_FONTS } from "../config/textTemplates.js";
import { ensureCaptionFontLoaded } from "../lib/captionFonts.js";
import "./TextInspectorPanel.css";

const COLOR_SWATCHES = [
  "#ffffff",
  "#ffd700",
  "#00ffff",
  "#ff007f",
  "#ff4757",
  "#2ecc71",
  "#ffa502",
  "#9b59b6",
  "#1e90ff",
  "#000000",
];

export function TextInspectorPanel({
  selectedCaptionSegment = null,
  selectedSegmentId = "",
  setSelectedSegmentId = () => {},
  captionSegments = [],
  setCaptionSegments = () => {},
  commitCaptionSegments = null,
  captionStyle = {},
  setCaptionStyle = () => {},
  captionSize = 18,
  setCaptionSize = () => {},
  currentTime = 0,
  deleteCaptionSegment = null,
  notify = () => {},
  t = (k) => k,
  uiLanguage = "km",
}) {
  const [activeTab, setActiveTab] = useState("text"); // 'text' | 'style' | 'position'

  // The segment we are currently editing
  const segment = useMemo(() => {
    return (
      captionSegments.find((seg) => seg.id === selectedSegmentId) ||
      selectedCaptionSegment ||
      null
    );
  }, [captionSegments, selectedSegmentId, selectedCaptionSegment]);

  // Combined fonts
  const allFonts = useMemo(() => {
    return [...KHMER_FONTS, ...LATIN_TRENDING_FONTS];
  }, []);

  // Helper to commit changes
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

  // Update text content
  const handleTextChange = (newText) => {
    if (!segment) return;
    const nextSegments = captionSegments.map((seg) =>
      seg.id === segment.id ? { ...seg, text: newText } : seg
    );
    applySegmentsChange(nextSegments, "កែសម្រួលអត្ថបទ", segment.id);
  };

  // Quick Case transform
  const handleCaseTransform = (mode) => {
    if (!segment || !segment.text) return;
    let nextText = segment.text;
    if (mode === "upper") nextText = segment.text.toUpperCase();
    if (mode === "lower") nextText = segment.text.toLowerCase();
    if (mode === "title") {
      nextText = segment.text.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
    }
    handleTextChange(nextText);
  };

  // Update specific style override
  const handleStyleChange = (key, val) => {
    if (!segment) return;
    const nextSegments = captionSegments.map((seg) => {
      if (seg.id === segment.id) {
        return {
          ...seg,
          styleOverrides: {
            ...(seg.styleOverrides || {}),
            [key]: val,
          },
        };
      }
      return seg;
    });
    applySegmentsChange(nextSegments, `កែប្រែ ${key}`, segment.id);
  };

  // Change font family
  const handleFontChange = (fontId) => {
    if (!segment) return;
    ensureCaptionFontLoaded(fontId, segment.text).catch(() => {});
    handleStyleChange("fontId", fontId);
  };

  // Change placement
  const handlePlacementChange = (patch) => {
    if (!segment) return;
    const currentPlacement = segment.placement || { x: 50, y: 50 };
    const nextPlacement = { ...currentPlacement, ...patch };
    const nextSegments = captionSegments.map((seg) =>
      seg.id === segment.id ? { ...seg, placement: nextPlacement } : seg
    );
    applySegmentsChange(nextSegments, "កែប្រែទីតាំងអក្សរ", segment.id);
  };

  // Quick position (top, center, bottom)
  const handleQuickPos = (pos) => {
    const yMap = { top: 18, middle: 50, bottom: 80 };
    handlePlacementChange({ x: 50, y: yMap[pos] || 50 });
    notify(`📍 ទីតាំង: ${pos.toUpperCase()}`);
  };

  // Duplicate
  const handleDuplicate = () => {
    if (!segment) return;
    const newId = `text-copy-${Date.now()}`;
    const duration = Math.max(1, (segment.end || 0) - (segment.start || 0));
    const newStart = (segment.end || 0) + 0.1;
    const newEnd = newStart + duration;

    const copy = {
      ...segment,
      id: newId,
      start: newStart,
      end: newEnd,
    };
    const nextSegments = [...captionSegments, copy].sort((a, b) => a.start - b.start);
    applySegmentsChange(nextSegments, "ចម្លង Text", newId);
    notify("⎘ បានចម្លង Text ជោគជ័យ!");
  };

  // Delete
  const handleDelete = () => {
    if (!segment) return;
    if (typeof deleteCaptionSegment === "function") {
      deleteCaptionSegment(segment.id);
    } else {
      const nextSegments = captionSegments.filter((seg) => seg.id !== segment.id);
      applySegmentsChange(nextSegments, "លុប Text", null);
    }
    notify("🗑️ បានលុប Text ចេញ!");
  };

  // Add a new text if none selected
  const handleAddNewText = () => {
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

  // Values resolved from segment.styleOverrides or fallback to captionStyle
  const overrides = segment?.styleOverrides || {};
  const currentText = segment?.text || "";
  const currentFontId = overrides.fontId || captionStyle.fontId || "kantumruy-pro";
  const currentFontSize = overrides.captionSize || segment?.captionSize || captionSize || 18;
  const currentTextColor = overrides.textColor || captionStyle.textColor || "#ffffff";
  const currentStrokeColor = overrides.textStrokeColor || captionStyle.textStrokeColor || "#000000";
  const currentStrokeWidth = overrides.textStrokeWidth ?? captionStyle.textStrokeWidth ?? 1.5;
  const currentBgColor = overrides.backgroundColor || captionStyle.backgroundColor || "#000000";
  const currentBgOpacity = Math.round((overrides.backgroundOpacity ?? captionStyle.backgroundOpacity ?? 0) * 100);
  const currentEffect = overrides.effect || captionStyle.effect || "normal";
  const currentRadius = overrides.radius ?? captionStyle.radius ?? 8;
  const currentShadow = Math.round((overrides.shadowOpacity ?? captionStyle.shadowOpacity ?? 0.8) * 100);
  const currentPlacement = segment?.placement || { x: 50, y: 50 };

  // If no text clip is selected
  if (!segment) {
    return (
      <div className="text-inspector-empty">
        <div className="text-inspector-empty-icon">
          <TextT size={36} weight="duotone" />
        </div>
        <h3 className="text-inspector-empty-title">
          {uiLanguage === "km" ? "មិនទាន់មាន Text ត្រូវបានជ្រើសរើស" : "No Text Selected"}
        </h3>
        <p className="text-inspector-empty-desc">
          {uiLanguage === "km"
            ? "ជ្រើសរើស Template ឬ Font ពី CARD ខាងឆ្វេង ឬចុចប៊ូតុងខាងក្រោមដើម្បីបង្កើត Text ថ្មី"
            : "Choose a Template from the left card or click below to add new text"}
        </p>
        <button
          type="button"
          className="text-inspector-add-btn"
          onClick={handleAddNewText}
        >
          <Plus size={16} weight="bold" />
          <span>{uiLanguage === "km" ? "➕ បន្ថែម Text ឥឡូវនេះ" : "Add Text Now"}</span>
        </button>

        {captionSegments.length > 0 ? (
          <div className="text-inspector-existing-list">
            <h4>{uiLanguage === "km" ? "ឃ្លីប Text លើ Timeline:" : "Text Clips on Timeline:"}</h4>
            <div className="text-existing-items">
              {captionSegments.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  className="text-existing-item"
                  onClick={() => setSelectedSegmentId(item.id)}
                >
                  <span className="text-existing-num">#{idx + 1}</span>
                  <span className="text-existing-snippet">{item.text || "(ទទេ)"}</span>
                  <small>{(item.end - item.start).toFixed(1)}s</small>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="text-inspector-panel">
      {/* 1. Header with Timing & Actions */}
      <div className="text-inspector-top-bar">
        <div className="text-inspector-meta">
          <span className="text-timing-badge">
            {segment.start.toFixed(1)}s – {segment.end.toFixed(1)}s
          </span>
          <span className="text-duration-badge">
            {(segment.end - segment.start).toFixed(1)}s
          </span>
        </div>
        <div className="text-inspector-top-actions">
          <button
            type="button"
            className="text-btn-icon"
            onClick={handleDuplicate}
            title="Duplicate Text"
          >
            <Copy size={13} />
          </button>
          <button
            type="button"
            className="text-btn-icon is-danger"
            onClick={handleDelete}
            title="Delete Text"
          >
            <Trash size={13} />
          </button>
        </div>
      </div>

      {/* 2. Text Input Card */}
      <div className="text-input-box">
        <textarea
          className="text-main-textarea"
          rows={3}
          value={currentText}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder="បញ្ចូលអត្ថបទរបស់អ្នកនៅទីនេះ..."
        />
        <div className="text-case-row">
          <button
            type="button"
            className="text-case-btn"
            onClick={() => handleCaseTransform("upper")}
            title="UPPERCASE"
          >
            AA
          </button>
          <button
            type="button"
            className="text-case-btn"
            onClick={() => handleCaseTransform("lower")}
            title="lowercase"
          >
            aa
          </button>
          <button
            type="button"
            className="text-case-btn"
            onClick={() => handleCaseTransform("title")}
            title="Title Case"
          >
            Aa
          </button>
        </div>
      </div>

      {/* 3. Sub Tabs (Text, Style, Position) */}
      <div className="text-subtabs">
        <button
          type="button"
          className={`text-subtab-btn ${activeTab === "text" ? "is-active" : ""}`}
          onClick={() => setActiveTab("text")}
        >
          <TextT size={13} weight="bold" />
          <span>Font & Size</span>
        </button>
        <button
          type="button"
          className={`text-subtab-btn ${activeTab === "style" ? "is-active" : ""}`}
          onClick={() => setActiveTab("style")}
        >
          <Palette size={13} weight="bold" />
          <span>Color & Effects</span>
        </button>
        <button
          type="button"
          className={`text-subtab-btn ${activeTab === "position" ? "is-active" : ""}`}
          onClick={() => setActiveTab("position")}
        >
          <SlidersHorizontal size={13} weight="bold" />
          <span>Position</span>
        </button>
      </div>

      {/* 4. Tab 1: Font & Size */}
      {activeTab === "text" && (
        <div className="text-section-body">
          {/* Font Picker */}
          <div className="text-form-row">
            <label className="text-form-label">Font Family (ពុម្ពអក្សរ)</label>
            <select
              className="text-font-select"
              value={currentFontId}
              onChange={(e) => handleFontChange(e.target.value)}
            >
              <optgroup label="🇰🇭 Khmer Fonts (ពុម្ពអក្សរខ្មែរ)">
                {KHMER_FONTS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="🌐 Trending Latin Fonts">
                {LATIN_TRENDING_FONTS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Font Size Slider */}
          <div className="text-form-row">
            <div className="text-form-label-row">
              <span className="text-form-label">Font Size (ទំហំ)</span>
              <strong>{currentFontSize}px</strong>
            </div>
            <input
              type="range"
              min="12"
              max="52"
              step="1"
              className="text-slider"
              value={currentFontSize}
              onChange={(e) => {
                const sz = Number(e.target.value);
                handleStyleChange("captionSize", sz);
                setCaptionSize(sz);
              }}
            />
          </div>

          {/* Alignment */}
          <div className="text-form-row">
            <span className="text-form-label">Alignment (តម្រឹម)</span>
            <div className="text-align-group">
              <button
                type="button"
                className={`text-align-btn ${overrides.textAlign === "left" ? "is-active" : ""}`}
                onClick={() => handleStyleChange("textAlign", "left")}
              >
                <TextAlignLeft size={15} />
              </button>
              <button
                type="button"
                className={`text-align-btn ${!overrides.textAlign || overrides.textAlign === "center" ? "is-active" : ""}`}
                onClick={() => handleStyleChange("textAlign", "center")}
              >
                <TextAlignCenter size={15} />
              </button>
              <button
                type="button"
                className={`text-align-btn ${overrides.textAlign === "right" ? "is-active" : ""}`}
                onClick={() => handleStyleChange("textAlign", "right")}
              >
                <TextAlignRight size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Tab 2: Color & Effects */}
      {activeTab === "style" && (
        <div className="text-section-body">
          {/* Text Color */}
          <div className="text-form-row">
            <div className="text-form-label-row">
              <span className="text-form-label">Text Color (ពណ៌អក្សរ)</span>
              <div className="text-color-preview-wrap">
                <input
                  type="color"
                  className="text-color-input"
                  value={currentTextColor}
                  onChange={(e) => handleStyleChange("textColor", e.target.value)}
                />
                <code>{currentTextColor.toUpperCase()}</code>
              </div>
            </div>
            <div className="text-swatches-grid">
              {COLOR_SWATCHES.map((col) => (
                <button
                  key={col}
                  type="button"
                  className={`text-swatch-circle ${currentTextColor === col ? "is-active" : ""}`}
                  style={{ backgroundColor: col }}
                  onClick={() => handleStyleChange("textColor", col)}
                />
              ))}
            </div>
          </div>

          {/* Stroke / Outline */}
          <div className="text-form-row">
            <div className="text-form-label-row">
              <span className="text-form-label">Outline / Stroke (បន្ទាត់គែម)</span>
              <div className="text-color-preview-wrap">
                <input
                  type="color"
                  className="text-color-input"
                  value={currentStrokeColor}
                  onChange={(e) => handleStyleChange("textStrokeColor", e.target.value)}
                />
                <small>{currentStrokeWidth}px</small>
              </div>
            </div>
            <input
              type="range"
              min="0"
              max="6"
              step="0.5"
              className="text-slider"
              value={currentStrokeWidth}
              onChange={(e) => handleStyleChange("textStrokeWidth", Number(e.target.value))}
            />
          </div>

          {/* Background Highlight Box */}
          <div className="text-form-row">
            <div className="text-form-label-row">
              <span className="text-form-label">Background (ប្រអប់ផ្ទៃក្រោយ)</span>
              <div className="text-color-preview-wrap">
                <input
                  type="color"
                  className="text-color-input"
                  value={currentBgColor}
                  onChange={(e) => handleStyleChange("backgroundColor", e.target.value)}
                />
                <small>{currentBgOpacity}%</small>
              </div>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              className="text-slider"
              value={currentBgOpacity}
              onChange={(e) => handleStyleChange("backgroundOpacity", Number(e.target.value) / 100)}
            />
          </div>

          {/* Neon Glow Toggle */}
          <div className="text-form-row">
            <div className="text-form-label-row">
              <span className="text-form-label">Neon Glow Effect (ពន្លឺចែងចាំង)</span>
              <button
                type="button"
                className={`text-neon-badge-toggle ${currentEffect === "neon" ? "is-active" : ""}`}
                onClick={() => handleStyleChange("effect", currentEffect === "neon" ? "normal" : "neon")}
              >
                <Sparkle size={13} weight="bold" />
                <span>{currentEffect === "neon" ? "NEON ON" : "NORMAL"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Tab 3: Position */}
      {activeTab === "position" && (
        <div className="text-section-body">
          {/* Quick Presets */}
          <div className="text-form-row">
            <span className="text-form-label">Quick Placement (ទីតាំងរហ័ស)</span>
            <div className="text-quick-pos-row">
              <button
                type="button"
                className={`text-qpos-btn ${currentPlacement.y < 35 ? "is-active" : ""}`}
                onClick={() => handleQuickPos("top")}
              >
                Top (លើ)
              </button>
              <button
                type="button"
                className={`text-qpos-btn ${currentPlacement.y >= 35 && currentPlacement.y <= 65 ? "is-active" : ""}`}
                onClick={() => handleQuickPos("middle")}
              >
                Center (កណ្តាល)
              </button>
              <button
                type="button"
                className={`text-qpos-btn ${currentPlacement.y > 65 ? "is-active" : ""}`}
                onClick={() => handleQuickPos("bottom")}
              >
                Bottom (ក្រោម)
              </button>
            </div>
          </div>

          {/* X Position Slider */}
          <div className="text-form-row">
            <div className="text-form-label-row">
              <span className="text-form-label">Horizontal X (ផ្ដេក)</span>
              <strong>{Math.round(currentPlacement.x)}%</strong>
            </div>
            <input
              type="range"
              min="10"
              max="90"
              step="1"
              className="text-slider"
              value={currentPlacement.x}
              onChange={(e) => handlePlacementChange({ x: Number(e.target.value) })}
            />
          </div>

          {/* Y Position Slider */}
          <div className="text-form-row">
            <div className="text-form-label-row">
              <span className="text-form-label">Vertical Y (បញ្ឈរ)</span>
              <strong>{Math.round(currentPlacement.y)}%</strong>
            </div>
            <input
              type="range"
              min="10"
              max="90"
              step="1"
              className="text-slider"
              value={currentPlacement.y}
              onChange={(e) => handlePlacementChange({ y: Number(e.target.value) })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
