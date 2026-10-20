import React, { useState, useEffect, useRef } from "react";
import {
  DownloadSimple,
  Globe,
  LinkSimple,
  MagnifyingGlass,
  CheckCircle,
  X,
  CircleNotch,
  FilmStrip,
} from "@phosphor-icons/react";
import { downloaderService } from "../../services/downloaderService.js";
import { socketService } from "../../services/socketService.js";
import { formatSecondsToTimecode } from "../../hooks/useTimecodeFormat.js";

function cleanErrorMessage(err) {
  if (!err) return "";
  let msg = typeof err === "string" ? err : err.message || String(err);
  try {
    const jsonMatch = msg.match(/\{.*"error":\s*"([^"]+)".*\}/s);
    if (jsonMatch) {
      msg = jsonMatch[1].replace(/\\n/g, "\n");
    }
  } catch (_err) {
    // Ignore JSON parsing errors
  }
  return msg.replace(/^API .* failed \(\d+\):\s*/i, "").trim();
}

export function UrlDownloaderModal({ isOpen = false, onClose, onMediaDownloaded, t }) {
  const [url, setUrl] = useState("");
  const [isFetchingInfo, setIsFetchingInfo] = useState(false);
  const [mediaInfo, setMediaInfo] = useState(null);
  const [selectedFormat, setSelectedFormat] = useState("best");
  const [isAudioOnly, setIsAudioOnly] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState(null);
  const [thumbFailed, setThumbFailed] = useState(false);

  const hasCompletedRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      setUrl("");
      setMediaInfo(null);
      setError(null);
      setThumbFailed(false);
      setDownloadProgress(null);
      setIsDownloading(false);
      setStatusMessage("");
      hasCompletedRef.current = false;
      return;
    }

    socketService.connect();
    const unsubProgress = socketService.on("downloader:progress", (data) => {
      setDownloadProgress(data);
    });
    const unsubComplete = socketService.on("downloader:complete", async (data) => {
      await handleComplete(data);
    });
    const unsubError = socketService.on("downloader:error", (data) => {
      setIsDownloading(false);
      setStatusMessage("");
      setError(cleanErrorMessage(data.error || "Download failed"));
    });

    return () => {
      unsubProgress();
      unsubComplete();
      unsubError();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const runInspect = async (targetUrl) => {
    const clean = (targetUrl || url).trim();
    if (!clean) return;
    setIsFetchingInfo(true);
    setError(null);
    setMediaInfo(null);
    setStatusMessage(t ? t("inspectingUrl", "កំពុងត្រួតពិនិត្យ URL...") : "Inspecting URL...");

    try {
      const info = await downloaderService.fetchMediaInfo(clean);
      setMediaInfo(info);
      setThumbFailed(false);
      if (info.formats && info.formats.length > 0) {
        setSelectedFormat(info.formats[0].formatId);
      }
      setStatusMessage("");
    } catch (err) {
      setError(cleanErrorMessage(err));
      setStatusMessage("");
    } finally {
      setIsFetchingInfo(false);
    }
  };

  const handleFetchInfo = () => {
    runInspect(url);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        const clean = text.trim();
        setUrl(clean);
        if (/^https?:\/\//i.test(clean)) {
          void runInspect(clean);
        }
      }
    } catch {
      // Clipboard access denied
    }
  };

  const handleComplete = async (fileData) => {
    if (hasCompletedRef.current) return;
    hasCompletedRef.current = true;
    setIsDownloading(false);
    setStatusMessage(t ? t("importingMedia", "កំពុងនាំចូលទៅក្នុងគម្រោង...") : "Importing to editor...");

    try {
      let fileObject = fileData;
      if (!(fileObject instanceof File)) {
        fileObject = await downloaderService.fetchDownloadedFileObject(fileData);
      }
      if (onMediaDownloaded) {
        await onMediaDownloaded(fileObject);
      }
      onClose();
    } catch (err) {
      setError(`Import failed: ${cleanErrorMessage(err)}`);
    } finally {
      setStatusMessage("");
    }
  };

  const handleStartDownload = async () => {
    if (!url.trim()) return;
    setIsDownloading(true);
    setError(null);
    hasCompletedRef.current = false;
    setDownloadProgress({ percent: 0, speed: "Connecting..." });
    setStatusMessage(t ? t("downloadingMedia", "កំពុងទាញយកឯកសារ...") : "Downloading media...");

    try {
      const result = await downloaderService.startDownload(url.trim(), selectedFormat, isAudioOnly);
      if (result.success && result.file) {
        await handleComplete(result.file);
      }
    } catch (err) {
      setIsDownloading(false);
      setStatusMessage("");
      setError(cleanErrorMessage(err));
    }
  };

  return (
    <div className="url-downloader-backdrop" onClick={(e) => { if (e.target === e.currentTarget && !isDownloading) onClose(); }}>
      <div className="url-downloader-card" role="dialog" aria-modal="true">
        {/* Header */}
        <div className="url-downloader-header">
          <div className="url-downloader-title-group">
            <span style={{ fontSize: "20px" }}>📥</span>
            <div>
              <h2>{t ? t("urlDownloaderTitle", "ទាញយកវីដេអូ / សំឡេងពី Website") : "Universal Web Media Downloader"}</h2>
              <p>{t ? t("urlDownloaderDesc", "ទាញយកពី YouTube, TikTok, KissKH, Facebook, IG, X, Vimeo និងតំណភ្ជាប់ផ្ទាល់") : "Download high-quality video/audio via web URL directly into editor"}</p>
            </div>
          </div>
          <button
            type="button"
            className="url-downloader-close-btn"
            onClick={onClose}
            disabled={isDownloading}
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Badges of supported platforms */}
        <div className="url-downloader-badges">
          {["YouTube", "TikTok", "KissKH (Drama/Anime)", "Facebook", "Instagram", "X (Twitter)", "Vimeo", "Bilibili", "Direct MP4/M3U8"].map((tag) => (
            <span key={tag} className="url-downloader-badge">
              {tag}
            </span>
          ))}
        </div>

        {/* URL Input */}
        <div className="url-downloader-input-group">
          <label className="url-downloader-label">
            {t ? t("videoUrlLabel", "តំណភ្ជាប់ URL (Link)") : "Web URL"}
          </label>
          <div className="url-downloader-input-row">
            <input
              type="url"
              className="url-downloader-input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://kisskh.do/... ឬ YouTube, TikTok, FB, IG, etc."
              disabled={isDownloading || isFetchingInfo}
              onKeyDown={(e) => {
                if (e.key === "Enter" && url.trim() && !isFetchingInfo && !isDownloading) {
                  e.preventDefault();
                  handleFetchInfo();
                }
              }}
            />
            <button
              type="button"
              className="url-downloader-btn-paste"
              onClick={handlePaste}
              disabled={isDownloading}
              title="Paste from clipboard"
            >
              {t ? t("paste", "Paste") : "Paste"}
            </button>
            <button
              type="button"
              className="url-downloader-btn-inspect"
              onClick={handleFetchInfo}
              disabled={!url.trim() || isFetchingInfo || isDownloading}
            >
              {isFetchingInfo ? (
                <>
                  <CircleNotch className="is-spinning" size={14} />
                  <span>{t ? t("checking", "កំពុងឆែក...") : "Checking"}</span>
                </>
              ) : (
                <>
                  <MagnifyingGlass size={14} weight="bold" />
                  <span>{t ? t("inspect", "ពិនិត្យ URL") : "Inspect"}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="url-downloader-alert-error">
            ⚠️ {error}
          </div>
        )}

        {/* Media Preview Card */}
        {mediaInfo && (
          <div className="url-downloader-preview-card">
            <div className="url-downloader-thumb-row">
              {mediaInfo.thumbnail && !thumbFailed ? (
                <img
                  src={mediaInfo.thumbnail}
                  alt={mediaInfo.title}
                  className="url-downloader-thumb"
                  referrerPolicy="no-referrer"
                  crossOrigin="anonymous"
                  onError={() => setThumbFailed(true)}
                />
              ) : (
                <div className="url-downloader-thumb-placeholder">
                  <FilmStrip size={28} />
                </div>
              )}
              <div className="url-downloader-meta">
                <div className="url-downloader-media-title" title={mediaInfo.title}>
                  {mediaInfo.title}
                </div>
                <div className="url-downloader-meta-tags">
                  <span className="url-downloader-badge" style={{ color: "#30f0db", background: "rgba(48, 240, 219, 0.12)" }}>
                    {mediaInfo.platform}
                  </span>
                  {mediaInfo.duration ? <span>⏱ {formatSecondsToTimecode(mediaInfo.duration)}</span> : null}
                  {mediaInfo.uploader && <span style={{ maxWidth: "140px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>👤 {mediaInfo.uploader}</span>}
                </div>
              </div>
            </div>

            {/* Quality selection */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              <label className="url-downloader-label" style={{ fontSize: "10px" }}>
                {t ? t("selectQuality", "ជ្រើសរើសកម្រិតគុណភាព (Quality)") : "Select Quality"}
              </label>
              <select
                className="url-downloader-select"
                value={selectedFormat}
                onChange={(e) => {
                  setSelectedFormat(e.target.value);
                  setIsAudioOnly(e.target.value.includes("bestaudio"));
                }}
                disabled={isDownloading}
              >
                {mediaInfo.formats?.map((fmt) => (
                  <option key={fmt.formatId} value={fmt.formatId}>
                    {fmt.label || fmt.resolution} ({fmt.ext?.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Progress bar */}
        {isDownloading && (
          <div className="url-downloader-progress">
            <div className="url-downloader-progress-info">
              <span>{statusMessage || (t ? t("downloading", "កំពុងទាញយក...") : "Downloading...")}</span>
              <span>{downloadProgress?.percent ? `${downloadProgress.percent.toFixed(1)}%` : "Processing"}</span>
            </div>
            <div className="url-downloader-progress-bar-bg">
              <div
                className="url-downloader-progress-bar-fill"
                style={{ width: `${downloadProgress?.percent || 15}%` }}
              />
            </div>
            {downloadProgress?.speed && (
              <div className="url-downloader-progress-stats">
                <span>Speed: {downloadProgress.speed}</span>
                {downloadProgress.totalSize && <span>Total: {downloadProgress.totalSize}</span>}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="url-downloader-footer">
          <span className="url-downloader-footer-hint">
            {statusMessage && !isDownloading ? statusMessage : (t ? t("autoImportHint", "ឯកសារនឹងត្រូវបញ្ចូលទៅក្នុង Timeline & Media ដោយស្វ័យប្រវត្តិ") : "Saved & imported directly into timeline")}
          </span>
          <div className="url-downloader-footer-actions">
            <button
              type="button"
              className="url-downloader-btn-cancel"
              onClick={onClose}
              disabled={isDownloading}
            >
              {t ? t("cancel", "Cancel") : "Cancel"}
            </button>
            <button
              type="button"
              className="url-downloader-btn-submit"
              onClick={handleStartDownload}
              disabled={!url.trim() || isDownloading || isFetchingInfo}
            >
              {isDownloading ? (
                <>
                  <CircleNotch className="is-spinning" size={14} />
                  <span>{t ? t("downloading", "កំពុងទាញយក...") : "Downloading..."}</span>
                </>
              ) : (
                <>
                  <DownloadSimple size={15} weight="bold" />
                  <span>{t ? t("downloadAndImport", "ទាញយក & ដាក់ចូលគម្រោង") : "Download & Import"}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
