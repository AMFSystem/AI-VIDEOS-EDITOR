import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Cpu,
  Sparkle,
  DownloadSimple,
  CheckCircle,
  CircleNotch,
  WarningCircle,
  Lightning,
  HardDrives,
  Microphone,
  SpeakerHigh,
  FilmStrip,
  Waveform,
  Sliders
} from "@phosphor-icons/react";
import { DEFAULT_MODELS } from "./AIModelsManagerModal.jsx";
import "./AIModelGuideModal.css";

const getBackendBase = () =>
  (window.desktopAPI?.getBackendUrl && window.desktopAPI.getBackendUrl()) || "http://127.0.0.1:3001";

const resolveApiUrl = (endpoint) => {
  const clean = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  if (typeof window !== "undefined" && window.location.protocol === "file:") {
    const base = getBackendBase();
    return `${base}${clean}`;
  }
  return clean;
};

export function AIModelGuideModal({
  isOpen,
  modelId,
  modelInfo: customModelInfo,
  onClose,
  onProceed,
  onOpenFullHub,
  notify = console.log
}) {
  const [downloading, setDownloading] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [isInstalled, setIsInstalled] = useState(false);
  const [downloadError, setDownloadError] = useState(null);
  const eventSourceRef = useRef(null);

  // Find model definition
  const model = customModelInfo || DEFAULT_MODELS.find((m) => m.id === modelId) || {
    id: modelId,
    name: "AI Local Model",
    category: "general",
    badge: "Local AI",
    description: "ម៉ូដែលដំណើរការ Offline ក្នុងកុំព្យូទ័រ",
    sizeFormatted: "Free Download"
  };

  // Check if model is already downloaded
  // CRITICAL: If the model is ALREADY installed, NEVER keep the popup open! Immediately proceed and close!
  const checkStatus = async () => {
    if (!modelId) return false;
    try {
      const res = await fetch(resolveApiUrl("/api/ai/models"));
      if (res.ok) {
        const json = await res.json();
        const found = json.models?.find((m) => m.id === modelId);
        if (found?.installed) {
          setIsInstalled(true);
          setProgressPercent(100);
          setDownloading(false);
          // If already downloaded, immediately proceed and close modal
          if (typeof onProceed === "function") {
            onProceed();
          }
          onClose();
          return true;
        } else if (found?.downloading) {
          setDownloading(true);
          setProgressPercent(found.progress || 0);
          startListening(modelId);
          return false;
        } else {
          setIsInstalled(false);
          return false;
        }
      }
    } catch (err) {
      console.warn("Could not check model status:", err);
    }
    return false;
  };

  const startListening = (mId) => {
    if (eventSourceRef.current) return;
    try {
      const progressUrl = resolveApiUrl(`/api/ai/models/progress/${mId}`);
      const es = new EventSource(progressUrl, { withCredentials: true });
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const state = JSON.parse(event.data);
          setProgressPercent(state.percent || 0);
          if (state.status === "ready") {
            setIsInstalled(true);
            setDownloading(false);
            setProgressPercent(100);
            es.close();
            eventSourceRef.current = null;
            notify(`ម៉ូដែល ${model.name} បានទាញយករួចរាល់ ១០០%!`, "success");
            // Auto proceed on download complete
            setTimeout(() => {
              if (typeof onProceed === "function") onProceed();
              onClose();
            }, 600);
          } else if (state.status === "error") {
            setDownloading(false);
            setDownloadError(state.error || "បរាជ័យក្នុងការទាញយក");
            es.close();
            eventSourceRef.current = null;
          }
        } catch {}
      };

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;
      };
    } catch {}
  };

  useEffect(() => {
    if (isOpen && modelId) {
      setDownloadError(null);
      checkStatus();
    }
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [isOpen, modelId]);

  // Polling fallback during download
  useEffect(() => {
    if (!downloading || !isOpen || !modelId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(resolveApiUrl("/api/ai/models"));
        if (!res.ok) return;
        const json = await res.json();
        const found = json.models?.find((m) => m.id === modelId);
        if (found?.installed) {
          setIsInstalled(true);
          setDownloading(false);
          setProgressPercent(100);
          notify(`ម៉ូដែល ${model.name} បានទាញយករួចរាល់ ១០០%!`, "success");
          setTimeout(() => {
            if (typeof onProceed === "function") onProceed();
            onClose();
          }, 600);
        } else if (found?.downloading || found?.progress > 0) {
          setProgressPercent(found.progress || 0);
        }
      } catch {}
    }, 2000);

    return () => clearInterval(interval);
  }, [downloading, isOpen, modelId]);

  const handleStartDownload = async () => {
    setDownloading(true);
    setDownloadError(null);
    setProgressPercent(2);
    startListening(modelId);

    try {
      const res = await fetch(resolveApiUrl(`/api/ai/models/download/${modelId}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }
      notify(`កំពុងចាប់ផ្ដើមទាញយកម៉ូដែល ${model.name}...`, "info");
    } catch (err) {
      setDownloading(false);
      setDownloadError(err.message);
      notify(`ទាញយកមិនបានសម្រេច: ${err.message}`, "error");
    }
  };

  if (!isOpen) return null;

  const render3DIcon = (category) => {
    switch (category) {
      case "stt":
        return <Microphone size={32} weight="duotone" className="icon-3d-glow text-sky-400" />;
      case "tts":
        return <SpeakerHigh size={32} weight="duotone" className="icon-3d-glow text-emerald-400" />;
      case "clone":
        return <Sparkle size={32} weight="duotone" className="icon-3d-glow text-purple-400" />;
      case "audio":
        return <Waveform size={32} weight="duotone" className="icon-3d-glow text-amber-400" />;
      case "vision":
        return <FilmStrip size={32} weight="duotone" className="icon-3d-glow text-indigo-400" />;
      default:
        return <Cpu size={32} weight="duotone" className="icon-3d-glow text-cyan-400" />;
    }
  };

  return (
    <div className="model-guide-overlay" onClick={onClose}>
      <div className="model-guide-modal-3d" onClick={(e) => e.stopPropagation()}>
        {/* Top Specular Edge Highlight */}
        <div className="modal-top-highlight" />

        {/* Header */}
        <div className="model-guide-header-3d">
          <div className="model-guide-badge-3d">
            <Lightning size={14} weight="fill" />
            <span>ទាមទារ Local AI</span>
          </div>
          <button className="model-guide-close-btn-3d" onClick={onClose} title="បិទ">
            <X size={17} weight="bold" />
          </button>
        </div>

        {/* Body Content */}
        <div className="model-guide-body-3d">
          {/* 3D Floating Icon & Titles */}
          <div className="model-guide-hero-3d">
            <div className="icon-3d-container">
              <div className="icon-3d-badge">
                {render3DIcon(model.category)}
              </div>
            </div>
            <div className="hero-text-block">
              <h2 className="model-guide-title-3d">
                ដំឡើង {model.name}
              </h2>
              <p className="model-guide-subtitle-3d">
                ទាមទារ AI Model ក្នុងកុំព្យូទ័រ ដើម្បីដំណើរការ Offline
              </p>
            </div>
          </div>

          {/* 3D Model Info Card */}
          <div className="model-card-3d">
            <div className="model-card-3d-top">
              <span className="model-name-label">{model.name}</span>
              <span className="model-pill-3d">{model.badge || "Local AI"}</span>
            </div>

            <p className="model-desc-short">
              {model.description?.length > 80
                ? model.description.slice(0, 78) + "..."
                : model.description || "ម៉ូដែលដំណើរការលើកុំព្យូទ័រផ្ទាល់"}
            </p>

            <div className="model-card-meta-row">
              <div className="meta-badge-3d">
                <HardDrives size={13} weight="bold" />
                <span>{model.sizeFormatted || "Free"}</span>
              </div>
              <div className="meta-badge-3d">
                <Lightning size={13} weight="fill" className="text-amber-400" />
                <span>ទាញយកតែម្ដងគត់</span>
              </div>
            </div>
          </div>

          {/* Download Progress Bar (When downloading or installed) */}
          {(downloading || isInstalled) && (
            <div className="progress-box-3d">
              <div className="progress-info-row">
                <span className="progress-status-label">
                  {isInstalled ? (
                    <span className="text-ready-3d">
                      <CheckCircle size={15} weight="fill" />
                      ទាញយករួចរាល់ ១០០%
                    </span>
                  ) : (
                    <span className="text-downloading-3d">
                      <CircleNotch size={15} weight="bold" className="spin-icon" />
                      កំពុងទាញយក...
                    </span>
                  )}
                </span>
                <span className="progress-percent-label">{progressPercent}%</span>
              </div>
              <div className="progress-track-3d">
                <div
                  className={`progress-fill-3d ${isInstalled ? "is-complete" : ""}`}
                  style={{ width: `${Math.max(progressPercent, 5)}%` }}
                />
              </div>
            </div>
          )}

          {/* Error Alert */}
          {downloadError && (
            <div className="error-alert-3d">
              <WarningCircle size={15} weight="fill" />
              <span>{downloadError}</span>
            </div>
          )}

          {/* Short Note */}
          <div className="tip-note-3d">
            <Sparkle size={14} weight="fill" className="text-indigo-400" />
            <span>ទាញយកម្តង ប្រើប្រាស់រហូត មិនបាច់ប្រើ Internet</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="model-guide-footer-3d">
          {isInstalled ? (
            <button
              className="btn-3d-primary is-ready"
              onClick={() => {
                onClose();
                if (typeof onProceed === "function") onProceed();
              }}
            >
              <CheckCircle size={18} weight="bold" />
              <span>ចាប់ផ្ដើមប្រើប្រាស់ភ្លាម</span>
            </button>
          ) : downloading ? (
            <button className="btn-3d-primary is-downloading" disabled>
              <CircleNotch size={18} weight="bold" className="spin-icon" />
              <span>កំពុងទាញយក ({progressPercent}%) ...</span>
            </button>
          ) : (
            <button className="btn-3d-primary" onClick={handleStartDownload}>
              <DownloadSimple size={18} weight="bold" />
              <span>ទាញយក Model ({model.sizeFormatted || "Free"})</span>
            </button>
          )}

          <div className="footer-links-3d">
            {typeof onOpenFullHub === "function" && (
              <button
                className="btn-3d-secondary"
                onClick={() => {
                  onClose();
                  onOpenFullHub();
                }}
              >
                <Sliders size={14} weight="bold" />
                <span>ផ្ទាំងគ្រប់គ្រង Models</span>
              </button>
            )}
            <button className="btn-3d-ghost" onClick={onClose}>
              ទុកពេលក្រោយ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AIModelGuideModal;
