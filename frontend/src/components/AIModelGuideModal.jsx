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
    description: "ម៉ូដែល AI សម្រាប់ដំណើរការលើកុំព្យូទ័រផ្ទាល់",
    sizeFormatted: "500 MB"
  };

  // Check if model is already downloaded
  const checkStatus = async () => {
    if (!modelId) return;
    try {
      const res = await fetch(resolveApiUrl("/api/ai/models"));
      if (res.ok) {
        const json = await res.json();
        const found = json.models?.find((m) => m.id === modelId);
        if (found?.installed) {
          setIsInstalled(true);
          setProgressPercent(100);
          setDownloading(false);
        } else if (found?.downloading) {
          setDownloading(true);
          setProgressPercent(found.progress || 0);
          startListening(modelId);
        } else {
          setIsInstalled(false);
        }
      }
    } catch (err) {
      console.warn("Could not check model status:", err);
    }
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

  const renderCategoryIcon = (category) => {
    switch (category) {
      case "stt":
        return <Microphone size={24} weight="duotone" color="#60a5fa" />;
      case "tts":
        return <SpeakerHigh size={24} weight="duotone" color="#34d399" />;
      case "clone":
        return <Sparkle size={24} weight="duotone" color="#f472b6" />;
      case "audio":
        return <Waveform size={24} weight="duotone" color="#fbbf24" />;
      case "vision":
        return <FilmStrip size={24} weight="duotone" color="#a78bfa" />;
      default:
        return <Cpu size={24} weight="duotone" color="#38bdf8" />;
    }
  };

  return (
    <div className="model-guide-overlay" onClick={onClose}>
      <div className="model-guide-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="model-guide-header">
          <div className="model-guide-badge">
            <WarningCircle size={15} weight="fill" color="#f59e0b" />
            <span>តម្រូវការ AI Model ក្នុងកុំព្យូទ័រ (Local AI Required)</span>
          </div>
          <button className="model-guide-close-btn" onClick={onClose} title="បិទ">
            <X size={18} weight="bold" />
          </button>
        </div>

        {/* Body Content */}
        <div className="model-guide-body">
          <h2 className="model-guide-title">
            ការណែនាំដំឡើង AI Model ក្នុងម៉ាស៊ីន
          </h2>
          <p className="model-guide-lead">
            មុខងារនេះដំណើរការដោយប្រើប្រាស់ <strong>AI Model ក្នុងកុំព្យូទ័រផ្ទាល់</strong> ដើម្បីទទួលបានល្បឿនលឿន ភាពត្រឹមត្រូវខ្ពស់ និងដំណើរការ <strong>Offline ១០០%</strong> ដោយឥតគិតថ្លៃ។
          </p>

          {/* Model Card */}
          <div className="model-guide-card">
            <div className="model-guide-card-icon">
              {renderCategoryIcon(model.category)}
            </div>
            <div className="model-guide-card-info">
              <div className="model-guide-card-header">
                <span className="model-guide-card-name">{model.name}</span>
                <span className="model-guide-card-pill">{model.badge || "Local AI"}</span>
              </div>
              <p className="model-guide-card-desc">{model.description}</p>
              <div className="model-guide-card-meta">
                <span className="meta-item">
                  <HardDrives size={13} weight="bold" />
                  ទំហំ File: <strong>{model.sizeFormatted || "មិនកំណត់"}</strong>
                </span>
                <span className="meta-item">
                  <Lightning size={13} weight="fill" color="#fbbf24" />
                  ទាញយកតែម្ដងគត់ (Download Once)
                </span>
              </div>
            </div>
          </div>

          {/* Download Progress Bar (When downloading or installed) */}
          {(downloading || isInstalled) && (
            <div className="model-guide-progress-box">
              <div className="progress-info-row">
                <span className="progress-status-label">
                  {isInstalled ? (
                    <span className="text-ready">
                      <CheckCircle size={16} weight="fill" color="#10b981" />
                      ទាញយករួចរាល់ ១០០% (Ready to Use)
                    </span>
                  ) : (
                    <span className="text-downloading">
                      <CircleNotch size={16} weight="bold" className="spin-icon" color="#60a5fa" />
                      កំពុងទាញយកចូលក្នុងកុំព្យូទ័រ...
                    </span>
                  )}
                </span>
                <span className="progress-percent-label">{progressPercent}%</span>
              </div>
              <div className="model-guide-progress-track">
                <div
                  className={`model-guide-progress-fill ${isInstalled ? "is-complete" : ""}`}
                  style={{ width: `${Math.max(progressPercent, 4)}%` }}
                />
              </div>
            </div>
          )}

          {/* Download Error Alert */}
          {downloadError && (
            <div className="model-guide-error-alert">
              <WarningCircle size={16} weight="fill" color="#ef4444" />
              <span>{downloadError}</span>
            </div>
          )}

          {/* Notice Banner */}
          <div className="model-guide-tip-banner">
            <Sparkle size={16} weight="fill" color="#60a5fa" />
            <div>
              <strong>ចំណាំ៖</strong> នៅពេលទាញយកចប់ ១០០% ឯកសារ AI Model នឹងត្រូវបានរក្សាទុកក្នុង SSD/Hard Drive របស់អ្នកជារៀងរហូត។ លោកអ្នកអាចកាត់ត និងប្រើ AI នេះបានដោយមិនចាំបាច់មាន Internet ឡើយ។
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="model-guide-footer">
          {isInstalled ? (
            <button
              className="model-guide-btn-primary is-ready"
              onClick={() => {
                onClose();
                if (typeof onProceed === "function") onProceed();
              }}
            >
              <CheckCircle size={18} weight="bold" />
              <span>ចាប់ផ្ដើមប្រើប្រាស់មុខងារនេះភ្លាម (Start Using Now)</span>
            </button>
          ) : downloading ? (
            <button className="model-guide-btn-primary is-downloading" disabled>
              <CircleNotch size={18} weight="bold" className="spin-icon" />
              <span>កំពុងទាញយក ({progressPercent}%) ...</span>
            </button>
          ) : (
            <button className="model-guide-btn-primary" onClick={handleStartDownload}>
              <DownloadSimple size={18} weight="bold" />
              <span>ទាញយក Model ឥឡូវនេះ ({model.sizeFormatted || "Free"})</span>
            </button>
          )}

          <div className="model-guide-footer-secondary">
            {typeof onOpenFullHub === "function" && (
              <button
                className="model-guide-btn-secondary"
                onClick={() => {
                  onClose();
                  onOpenFullHub();
                }}
              >
                <Sliders size={15} weight="bold" />
                <span>មើលផ្ទាំងគ្រប់គ្រង Models ទាំងអស់</span>
              </button>
            )}
            <button className="model-guide-btn-ghost" onClick={onClose}>
              ទុកពេលក្រោយ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AIModelGuideModal;
