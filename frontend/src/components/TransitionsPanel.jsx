import { useState, useMemo } from "react";
import {
  ArrowsClockwise,
  CaretLeft,
  CaretRight,
  Check,
  Intersect,
  MagnifyingGlass,
  Trash,
  X,
} from "@phosphor-icons/react";
import { TRANSITIONS, TRANSITION_CATEGORIES } from "../config/editor.js";
import "./TransitionsPanel.css";

export function TransitionsPanel({
  visualSegments = [],
  selectedTransitionIndex = 0,
  setSelectedTransitionIndex = () => {},
  updateTransitionAtIndex = () => {},
  applyTransitionToAll = () => {},
  notify = () => {},
  trOption = (n) => n,
}) {
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const totalCuts = Math.max(0, visualSegments.length - 1);
  const activeCutIndex = Math.min(
    Math.max(0, selectedTransitionIndex),
    Math.max(0, totalCuts - 1)
  );

  const currentSegment = visualSegments[activeCutIndex];
  const nextSegment = visualSegments[activeCutIndex + 1];
  const currentTransition = currentSegment?.transition || { id: "none", duration: 0.5 };

  // Allow transition duration up to 10.0s (or long durations for creative crossfades)
  const maxDuration = 10.0;
  const activeDuration = Math.max(0.1, Math.min(maxDuration, Number(currentTransition.duration) || 0.5));

  // Filter transitions by category & search
  const filteredTransitions = useMemo(() => {
    return TRANSITIONS.filter((item) => {
      const matchCat = activeCategory === "all" || item.category === activeCategory;
      const matchQuery =
        !searchQuery.trim() ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase().trim());
      return matchCat && matchQuery;
    });
  }, [activeCategory, searchQuery]);

  const handleSelectTransition = (option) => {
    if (totalCuts === 0) {
      notify("ត្រូវការ Video/Image Clip យ៉ាងតិច ២ លើ Timeline ដើម្បីប្រើ Transition!");
      return;
    }
    updateTransitionAtIndex(activeCutIndex, { id: option.id });
    notify(`⚡ ${option.name} បានអនុវត្តលើ Cut ${activeCutIndex + 1}!`);
  };

  const handleDurationChange = (val) => {
    updateTransitionAtIndex(activeCutIndex, { duration: Number(val) });
  };

  const handleApplyAll = () => {
    if (totalCuts === 0) {
      notify("មិនទាន់មាន Cut ចន្លោះ Clip លើ Timeline ទេ!");
      return;
    }
    applyTransitionToAll({
      id: currentTransition.id,
      duration: activeDuration,
    });
    notify(`⚡ បានអនុវត្ត «${currentTransition.id}» លើគ្រប់ ${totalCuts} Cuts ទាំងអស់!`);
  };

  const handleReset = () => {
    if (totalCuts === 0) return;
    updateTransitionAtIndex(activeCutIndex, { id: "none" });
    notify("✨ បានដក Transition ចេញវិញ!");
  };

  return (
    <section className="transitions-panel" aria-label="Transitions">
      {/* 1. Header */}
      <div className="transitions-header">
        <div className="transitions-header-left">
          <h2 className="transitions-title">Transitions</h2>
          {totalCuts > 0 ? (
            <span className="transitions-cut-badge">
              Cut {activeCutIndex + 1} / {totalCuts}
            </span>
          ) : null}
        </div>

        {currentTransition.id !== "none" ? (
          <button
            type="button"
            className="transitions-reset-btn"
            onClick={handleReset}
            title="Remove Transition"
          >
            <Trash size={11} weight="bold" />
            <span>Remove</span>
          </button>
        ) : null}
      </div>

      {/* 2. Cut Switcher if multiple cuts */}
      {totalCuts > 1 ? (
        <div className="transitions-cut-nav">
          <button
            type="button"
            className="transitions-cut-arrow"
            disabled={activeCutIndex === 0}
            onClick={() => setSelectedTransitionIndex(Math.max(0, activeCutIndex - 1))}
            title="Previous Cut"
          >
            <CaretLeft size={13} weight="bold" />
          </button>

          <div className="transitions-cut-chips">
            {Array.from({ length: totalCuts }).map((_, idx) => (
              <button
                key={`cut-${idx}`}
                type="button"
                className={`transitions-cut-chip ${idx === activeCutIndex ? "is-active" : ""}`}
                onClick={() => setSelectedTransitionIndex(idx)}
              >
                Cut {idx + 1}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="transitions-cut-arrow"
            disabled={activeCutIndex >= totalCuts - 1}
            onClick={() => setSelectedTransitionIndex(Math.min(totalCuts - 1, activeCutIndex + 1))}
            title="Next Cut"
          >
            <CaretRight size={13} weight="bold" />
          </button>
        </div>
      ) : null}

      {/* Notice if no clips on timeline */}
      {totalCuts === 0 ? (
        <div className="transitions-empty-tip">
          <Intersect size={22} weight="duotone" color="#38bdf8" />
          <span>សូមដាក់ Clip វីដេអូ ឬរូបភាពយ៉ាងតិច ២ លើ Timeline ដើម្បីប្រើ Transition</span>
        </div>
      ) : null}

      {/* 3. CapCut Style Category Tabs */}
      <div className="transitions-cat-row">
        {(TRANSITION_CATEGORIES || []).map((cat) => (
          <button
            key={cat.id}
            type="button"
            className={`transitions-cat-tab ${activeCategory === cat.id ? "is-active" : ""}`}
            onClick={() => setActiveCategory(cat.id)}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* 4. CapCut Real Animated Cards Grid */}
      <div className="transitions-grid">
        {filteredTransitions.map((option) => {
          const isSelected = currentTransition.id === option.id;

          return (
            <button
              key={option.id}
              type="button"
              className={`transitions-card-capcut ${isSelected ? "is-selected" : ""}`}
              onClick={() => handleSelectTransition(option)}
              title={option.name}
            >
              {/* CapCut Live Animated Thumbnail Screen */}
              <div className="capcut-thumb-screen">
                <div className="capcut-stage">
                  {/* Clip A (underneath) */}
                  <div className="capcut-clip-a">
                    <span className="clip-label">A</span>
                  </div>
                  {/* Clip B (animated transition on top) */}
                  <div className={`capcut-clip-b anim-${option.id}`}>
                    <span className="clip-label">B</span>
                    {option.id === "flash" ? <span className="capcut-fx-flash" /> : null}
                    {option.id === "flash-black" ? <span className="capcut-fx-flash-black" /> : null}
                    {option.id === "light-leak" ? <span className="capcut-fx-light-leak" /> : null}
                    {option.id === "glitch" ? <span className="capcut-fx-glitch" /> : null}
                  </div>
                </div>
              </div>

              {/* Title */}
              <span className="transitions-card-label">
                {trOption(option.name, option)}
              </span>

              {/* Active Checkmark */}
              {isSelected ? (
                <span className="transitions-card-check">
                  <Check size={10} weight="bold" />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* 5. Duration Control */}
      {totalCuts > 0 ? (
        <div className="transitions-duration-box">
          <div className="transitions-duration-label-row">
            <span>Duration</span>
            <div className="transitions-duration-val-wrap">
              <strong>{activeDuration.toFixed(1)}s</strong>
            </div>
          </div>
          <input
            type="range"
            min="0.1"
            max={maxDuration}
            step="0.1"
            value={activeDuration}
            disabled={currentTransition.id === "none"}
            onChange={(e) => handleDurationChange(Number(e.target.value))}
            className="transitions-slider"
          />
          {/* Quick Duration Presets */}
          <div className="transitions-duration-presets">
            {[0.3, 0.5, 0.8, 1.0, 1.5, 2.0, 3.0, 5.0].map((preset) => (
              <button
                key={preset}
                type="button"
                className={`transitions-preset-pill ${Math.abs(activeDuration - preset) < 0.05 ? "is-active" : ""}`}
                disabled={currentTransition.id === "none"}
                onClick={() => handleDurationChange(preset)}
              >
                {preset}s
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* 6. Apply to All Cuts Button */}
      {totalCuts > 0 ? (
        <div className="transitions-footer">
          <button
            type="button"
            className="transitions-apply-all-btn"
            onClick={handleApplyAll}
            disabled={currentTransition.id === "none"}
            title="Apply this transition to all cuts on the timeline"
          >
            <ArrowsClockwise size={13} weight="bold" />
            <span>Apply to All Transitions</span>
          </button>
        </div>
      ) : null}
    </section>
  );
}
