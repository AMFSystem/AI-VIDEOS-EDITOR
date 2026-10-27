import { useState } from "react";
import {
  ArrowsClockwise,
  ArrowsIn,
  ArrowsOut,
  Check,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  Sparkle,
  Trash,
  VideoCamera,
} from "@phosphor-icons/react";
import "./AutoZoomPanel.css";

const ZOOM_PRESETS = [
  {
    id: "slow-zoom-in",
    title: "Zoom In",
    icon: MagnifyingGlassPlus,
    generate: (duration, intensity = 1.25, direction = "center") => {
      const { x, y } = getDirectionOffsets(direction, intensity);
      return [
        { time: 0, scale: 1.0, x: 0, y: 0, rotation: 0, opacity: 1 },
        { time: duration, scale: intensity, x, y, rotation: 0, opacity: 1 },
      ];
    },
  },
  {
    id: "slow-zoom-out",
    title: "Zoom Out",
    icon: MagnifyingGlassMinus,
    generate: (duration, intensity = 1.25, direction = "center") => {
      const { x, y } = getDirectionOffsets(direction, intensity);
      return [
        { time: 0, scale: intensity, x, y, rotation: 0, opacity: 1 },
        { time: duration, scale: 1.0, x: 0, y: 0, rotation: 0, opacity: 1 },
      ];
    },
  },
  {
    id: "center-punch",
    title: "Punch Zoom",
    icon: ArrowsOut,
    generate: (duration, intensity = 1.35) => {
      const punchTime = Math.min(0.25, duration * 0.2);
      return [
        { time: 0, scale: 1.0, x: 0, y: 0, rotation: 0, opacity: 1 },
        { time: punchTime, scale: intensity, x: 0, y: 0, rotation: 0, opacity: 1 },
        { time: duration, scale: intensity * 1.02, x: 0, y: 0, rotation: 0, opacity: 1 },
      ];
    },
  },
  {
    id: "face-zoom",
    title: "Face Focus",
    icon: Sparkle,
    generate: (duration, intensity = 1.3) => [
      { time: 0, scale: 1.0, x: 0, y: 0, rotation: 0, opacity: 1 },
      { time: duration, scale: intensity, x: 0, y: -16, rotation: 0, opacity: 1 },
    ],
  },
  {
    id: "pan-left-zoom",
    title: "Pan Left",
    icon: ArrowsOut,
    generate: (duration, intensity = 1.2) => [
      { time: 0, scale: intensity, x: 10, y: 0, rotation: 0, opacity: 1 },
      { time: duration, scale: intensity, x: -14, y: 0, rotation: 0, opacity: 1 },
    ],
  },
  {
    id: "pan-right-zoom",
    title: "Pan Right",
    icon: ArrowsOut,
    generate: (duration, intensity = 1.2) => [
      { time: 0, scale: intensity, x: -10, y: 0, rotation: 0, opacity: 1 },
      { time: duration, scale: intensity, x: 14, y: 0, rotation: 0, opacity: 1 },
    ],
  },
  {
    id: "double-pulse",
    title: "Pulse",
    icon: ArrowsIn,
    generate: (duration, intensity = 1.25) => {
      const step = Math.min(0.22, duration / 5);
      return [
        { time: 0, scale: 1.0, x: 0, y: 0, rotation: 0, opacity: 1 },
        { time: step, scale: intensity, x: 0, y: 0, rotation: 0, opacity: 1 },
        { time: step * 2, scale: 1.06, x: 0, y: 0, rotation: 0, opacity: 1 },
        { time: step * 3, scale: intensity * 1.08, x: 0, y: 0, rotation: 0, opacity: 1 },
        { time: duration, scale: 1.12, x: 0, y: 0, rotation: 0, opacity: 1 },
      ];
    },
  },
  {
    id: "cinematic-drift",
    title: "Ken Burns",
    icon: VideoCamera,
    generate: (duration, intensity = 1.2) => [
      { time: 0, scale: 1.08, x: -8, y: -4, rotation: 0, opacity: 1 },
      { time: duration, scale: intensity, x: 8, y: 5, rotation: 0, opacity: 1 },
    ],
  },
];

function getDirectionOffsets(direction, intensity) {
  const delta = (intensity - 1.0) * 45;
  if (direction === "top") return { x: 0, y: -delta };
  if (direction === "bottom") return { x: 0, y: delta };
  if (direction === "left") return { x: -delta, y: 0 };
  if (direction === "right") return { x: delta, y: 0 };
  return { x: 0, y: 0 };
}

export function AutoZoomPanel({
  selectedVisualSegment,
  updateSelectedVisualEffects,
  visualSegments = [],
  setSelectedSegmentId,
  notify = () => {},
}) {
  const [activePresetId, setActivePresetId] = useState("slow-zoom-in");
  const [intensity, setIntensity] = useState(1.25);
  const [direction, setDirection] = useState("center");

  const hasSelectedClip = Boolean(selectedVisualSegment?.id);
  const clipDuration = Math.max(0.1, Number(selectedVisualSegment?.duration) || 2);
  const currentKeyframes = selectedVisualSegment?.keyframes || [];
  const hasZoomKeyframes = currentKeyframes.some(
    (kf) => (kf.scale && Math.abs(kf.scale - 1) > 0.01) || kf.x || kf.y
  );

  // Apply selected preset
  const handleApplyPreset = (preset) => {
    if (!hasSelectedClip) {
      notify("សូមជ្រើសរើស Clip លើ Timeline ជាមុន!");
      return;
    }

    const keyframes = preset.generate(clipDuration, intensity, direction);
    updateSelectedVisualEffects({ keyframes });
    setActivePresetId(preset.id);
    notify(`⚡ ${preset.title} បានអនុវត្ត!`);
  };

  // Apply to all clips on timeline
  const handleApplyToAll = () => {
    if (!visualSegments || !visualSegments.length) {
      notify("មិនមាន Clip លើ Timeline ទេ!");
      return;
    }

    const preset = ZOOM_PRESETS.find((p) => p.id === activePresetId) || ZOOM_PRESETS[0];
    updateSelectedVisualEffects({
      applyToAll: true,
      keyframesGenerator: (duration) => preset.generate(duration, intensity, direction),
    });
    notify(`⚡ ${preset.title} បានអនុវត្តលើគ្រប់ Clips!`);
  };

  // Reset/Remove zoom
  const handleResetZoom = () => {
    if (!hasSelectedClip) return;
    updateSelectedVisualEffects({ resetTransform: true });
    notify("✨ បានលុប Zoom ចេញវិញ!");
  };

  return (
    <section className="auto-zoom-panel" aria-label="Auto Zoom">
      {/* 1. Sleek Minimal Header */}
      <div className="auto-zoom-header">
        <h2 className="auto-zoom-title">Auto Zoom</h2>

        {hasSelectedClip && hasZoomKeyframes ? (
          <button
            type="button"
            className="auto-zoom-reset-btn"
            onClick={handleResetZoom}
            title="Reset Zoom"
          >
            <Trash size={11} weight="bold" />
            <span>Reset</span>
          </button>
        ) : null}
      </div>

      {/* 2. Compact Presets Grid (Subtle 3D) */}
      <div className="auto-zoom-grid">
        {ZOOM_PRESETS.map((preset) => {
          const Icon = preset.icon;
          const isActive = activePresetId === preset.id && hasZoomKeyframes;

          return (
            <button
              key={preset.id}
              type="button"
              className={`auto-zoom-card ${isActive ? "is-active" : ""}`}
              onClick={() => handleApplyPreset(preset)}
              title={preset.title}
            >
              <div className="auto-zoom-card-icon">
                <Icon size={19} weight={isActive ? "fill" : "duotone"} />
              </div>
              <span className="auto-zoom-card-name">{preset.title}</span>
              {isActive ? (
                <span className="auto-zoom-card-check">
                  <Check size={10} weight="bold" />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* 3. Sleek Subtle Adjustments */}
      <div className="auto-zoom-controls">
        <div className="auto-zoom-slider-row">
          <span className="auto-zoom-control-label">Scale</span>
          <input
            type="range"
            min="1.1"
            max="1.7"
            step="0.05"
            value={intensity}
            onChange={(e) => setIntensity(Number(e.target.value))}
            className="auto-zoom-range"
          />
          <span className="auto-zoom-control-val">{intensity.toFixed(2)}x</span>
        </div>

        <div className="auto-zoom-dir-row">
          {["center", "top", "left", "right", "bottom"].map((d) => (
            <button
              key={d}
              type="button"
              className={`auto-zoom-dir-pill ${direction === d ? "is-active" : ""}`}
              onClick={() => setDirection(d)}
            >
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Batch Action Button */}
      <div className="auto-zoom-footer">
        <button
          type="button"
          className="auto-zoom-apply-all-btn"
          onClick={handleApplyToAll}
        >
          <ArrowsClockwise size={13} weight="bold" />
          <span>Apply to All Clips</span>
        </button>
      </div>
    </section>
  );
}
