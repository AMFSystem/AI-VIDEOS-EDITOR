import {
  ArrowsHorizontal,
  Check,
  Crop,
  Scan,
  SpinnerGap,
  Trash,
  X,
} from "@phosphor-icons/react";

import { RATIO_OPTIONS } from "../config/editor.js";

const MOTIONS = [
  ["locked", "Steady", "Minimal movement"],
  ["smooth", "Smooth", "Follow subject naturally"],
  ["responsive", "Responsive", "Fast motion tracking"],
];

function formatSmartFramePhase(phase) {
  if (!phase) return "";
  return String(phase)
    .replace(/稀疏检测/g, "Sparse detection")
    .replace(/使用\s*(YOLOS(?:\s*tiny)?)\s*识别主体/gi, "Detecting subject with $1")
    .replace(/识别主体/g, "Detecting subject")
    .replace(/光流跟踪/g, "Optical flow tracking")
    .replace(/主体丢失/g, "Subject lost")
    .replace(/准备当前片段/g, "Preparing current clip")
    .replace(/准备主体检测模型/g, "Preparing subject detection model")
    .replace(/当前图片构图轨迹已生成/g, "Framing path generated for image")
    .replace(/构图预览已生成/g, "Framing preview generated")
    .replace(/已取消/g, "Canceled")
    .replace(/已就绪/g, "Ready");
}

export function SmartFramePanel({ t, smartFrame }) {
  const segment = smartFrame?.segment;
  const job = smartFrame?.job || {};
  const stats = smartFrame?.draft?.stats || smartFrame?.applied?.stats || null;
  const presentation = smartFrame?.draft?.presentation || smartFrame?.applied?.presentation || "crop";
  const canAnalyze = Boolean(segment && ["image", "video"].includes(segment.type));
  return (
    <div className="smart-frame-panel">
      <section className="smart-frame-intro">
        <span className="smart-frame-intro-icon"><Crop size={22} weight="duotone" /></span>
        <div>
          <strong>{t("smartFrameCurrentClip", "Smart Reframe Current Clip")}</strong>
          <p>{t("smartFrameCurrentClipHint", "Detects subject, tracks motion with optical flow, and creates smooth reframing paths.")}</p>
          <small className="smart-frame-acceleration">{t("smartFrameGpuPreferred", "WebGPU Preferred · WASM Fallback")}</small>
        </div>
      </section>

      {!canAnalyze ? (
        <div className="smart-frame-empty">
          <Scan size={26} weight="duotone" />
          <strong>{t("smartFrameSelectClip", "Select an image or video clip first")}</strong>
          <span>{t("smartFrameSelectClipHint", "Smart Frame only modifies the currently selected visual clip.")}</span>
        </div>
      ) : (
        <>
          <div className="smart-frame-section-heading">
            <strong>{t("smartFrameTargetRatio", "Target Aspect Ratio")}</strong>
            <span>{t("smartFrameCurrentClipLabel", "Current Clip")}</span>
          </div>
          <div className="smart-frame-ratios" role="radiogroup" aria-label={t("smartFrameTargetRatio", "Target Aspect Ratio")}>
            {RATIO_OPTIONS.map((option) => (
              <button
                className={smartFrame.targetRatioId === option.id ? "is-active" : ""}
                type="button"
                role="radio"
                aria-checked={smartFrame.targetRatioId === option.id}
                key={option.id}
                disabled={job.running}
                onClick={() => smartFrame.setTargetRatioId(option.id)}
              >
                <i style={{ aspectRatio: `${option.width}/${option.height}` }} />
                <strong>{option.label}</strong>
              </button>
            ))}
          </div>

          <div className="smart-frame-section-heading">
            <strong>{t("smartFrameMotion", "Camera Tracking")}</strong>
            <span>{t("smartFrameMotionHint", "Recalculate path without re-downloading model")}</span>
          </div>
          <div className="smart-frame-motion-options">
            {MOTIONS.map(([id, label, hint]) => (
              <button
                className={smartFrame.settings.motion === id ? "is-active" : ""}
                type="button"
                key={id}
                disabled={job.running}
                onClick={() => smartFrame.setSettings({ motion: id })}
              >
                <strong>{t(`smartFrameMotion_${id}`, label)}</strong>
                <span>{t(`smartFrameMotionHint_${id}`, hint)}</span>
              </button>
            ))}
          </div>

          <label className="smart-frame-padding">
            <span><strong>{t("smartFramePadding", "Subject Padding")}</strong><em>{Math.round(smartFrame.settings.padding * 100)}%</em></span>
            <input
              type="range"
              min="0.06"
              max="0.32"
              step="0.01"
              value={smartFrame.settings.padding}
              disabled={job.running}
              onChange={(event) => smartFrame.setSettings({ padding: Number(event.target.value) })}
            />
          </label>

          <button className="panel-primary smart-frame-analyze" type="button" onClick={smartFrame.analyze}>
            {job.running ? <SpinnerGap className="is-spinning" size={18} /> : <Scan size={18} weight="bold" />}
            {job.running
              ? t("smartFrameCancelAnalysis", "Cancel Analysis")
              : smartFrame.draft
                ? t("smartFrameAnalyzeAgain", "Re-analyze Current Clip")
                : t("smartFrameAnalyzeClip", "Analyze & Generate Reframe")}
          </button>

          {job.stage !== "idle" ? (
            <div className={`smart-frame-progress is-${job.stage}`} role="status" aria-live="polite">
              <div>
                <span>{job.stage === "setup" ? t("smartFrameModelSetup", "Model Setup") : t("smartFrameClipAnalysis", "Clip Analysis")}</span>
                <strong>{Math.round(job.progress || 0)}%</strong>
              </div>
              <i><b style={{ width: `${Math.max(0, Math.min(100, job.progress || 0))}%` }} /></i>
              <p>{formatSmartFramePhase(job.phase)}</p>
            </div>
          ) : null}

          {smartFrame.draft || smartFrame.applied ? (
            <>
              <div className="smart-frame-compare" role="group" aria-label={t("smartFrameCompare", "Compare View")}>
                <button type="button" className={smartFrame.compareMode === "original" ? "is-active" : ""} onClick={() => smartFrame.setCompareMode("original")}>
                  {t("smartFrameBefore", "Original")}
                </button>
                <button type="button" className={smartFrame.compareMode === "after" ? "is-active" : ""} onClick={() => smartFrame.setCompareMode("after")}>
                  {t("smartFrameAfter", "Reframed")}
                </button>
              </div>
              {stats ? (
                <>
                  <div className="smart-frame-stats">
                    <span><strong>{stats.anchorCount || 0}</strong> {t("smartFrameAnchors", "Anchors")}</span>
                    <span><strong>{stats.flowCount || 0}</strong> {t("smartFrameFlowFrames", "Flow Frames")}</span>
                    <span><strong>{smartFrame.draft?.cropKeyframes?.length || smartFrame.applied?.cropKeyframes?.length || 0}</strong> {t("smartFramePathPoints", "Keyframes")}</span>
                  </div>
                  <p className={`smart-frame-runtime is-${stats.runtimeBackend || "unknown"}`}>
                    {stats.runtimeBackend === "webgpu"
                      ? `${t("smartFrameWebGpuRuntime", "WebGPU Subject Detection · WASM Optical Flow")}${stats.analysisMs ? ` · ${(stats.analysisMs / 1000).toFixed(1)}s` : ""}`
                      : stats.runtimeBackend === "wasm"
                        ? `${t("smartFrameWasmRuntime", "WASM Compatibility Mode")}${stats.analysisMs ? ` · ${(stats.analysisMs / 1000).toFixed(1)}s` : ""}`
                        : t("smartFrameLegacyRuntime", "Legacy Analysis · Re-analyze to enable WebGPU")}
                  </p>
                </>
              ) : null}
              {presentation === "safe-contain" ? (
                <p className="smart-frame-safe-contain">
                  {t("smartFrameSafeContain", "Current aspect ratio requires safe contain stage framing to preserve subject framing; other ratios track subject independently.")}
                </p>
              ) : null}
              <div className="smart-frame-actions">
                <button type="button" className="panel-secondary" onClick={smartFrame.cancel} disabled={job.running}>
                  <X size={16} />{t("cancel", "Cancel")}
                </button>
                <button type="button" className="panel-primary" onClick={smartFrame.apply} disabled={job.running || !smartFrame.dirty}>
                  <Check size={16} weight="bold" />{t("apply", "Apply")}
                </button>
              </div>
              {smartFrame.applied && !smartFrame.dirty ? (
                <button className="smart-frame-remove" type="button" onClick={smartFrame.remove}>
                  <Trash size={15} />{t("smartFrameRemove", "Remove Smart Frame from Current Clip")}
                </button>
              ) : null}
            </>
          ) : null}
        </>
      )}
      <p className="smart-frame-local-note">
        <ArrowsHorizontal size={15} />
        {t("smartFrameLocalNote", "Media stays local in browser; preview, project restore and export share the same crop path.")}
      </p>
    </div>
  );
}
