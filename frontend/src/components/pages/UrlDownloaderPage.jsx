import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  DownloadSimple,
  Globe,
  LinkSimple,
  MagnifyingGlass,
  CheckCircle,
  X,
  CircleNotch,
  FilmStrip,
  ArrowLeft,
  ClipboardText,
  PlayCircle,
  Clock,
  User,
  MusicNotes,
  ShieldCheck,
  Check,
  SquaresFour,
  ArrowsDownUp,
  WarningCircle,
  Square,
  CheckSquare,
} from "@phosphor-icons/react";
import { downloaderService } from "../../services/downloaderService.js";
import { socketService } from "../../services/socketService.js";
import { formatSecondsToTimecode } from "../../hooks/useTimecodeFormat.js";
import "./UrlDownloaderPage.css";

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
  msg = msg.replace(/^API .* failed \(\d+\):\s*/i, "").trim();

  if (/command failed|unsupported url|is not a valid url/i.test(msg)) {
    if (/unsupported url|not supported/i.test(msg)) {
      return "តំណភ្ជាប់នេះមិនទាន់ត្រូវបានគាំទ្រសម្រាប់ការស្រង់យកដោយផ្ទាល់នៅឡើយទេ / This link is currently not supported for direct extraction.";
    }
    msg = msg
      .replace(/^Command failed:\s*["'][^"']+["']\s*--[^\n]*\n?/is, "")
      .replace(/^Command failed:\s*\\?/i, "")
      .replace(/^ERROR:\s*/im, "")
      .trim();
  }

  return msg || "ការត្រួតពិនិត្យតំណភ្ជាប់បានបរាជ័យ (Failed to inspect link)";
}

const COPY = {
  km: {
    backToEditor: "ត្រឡប់ទៅកម្មវិធីកាត់ត",
    breadcrumbEditor: "កម្មវិធីកាត់ត",
    breadcrumbDownloader: "ទាញយកមេឌៀពីគេហទំព័រ",
    serverReady: "ម៉ាស៊ីនបម្រើ៖ ភ្ជាប់រួចរាល់",
    pageTitle: "ទាញយកវីដេអូ និងសំឡេងពីគេហទំព័រ",
    pageSubtitle: "ទាញយកវីដេអូ ឬសំឡេងកម្រិតច្បាស់ខ្ពស់ពី YouTube, TikTok, KissKH, Hongguo (红果短剧), Facebook និងគេហទំព័រជាច្រើនទៀតដោយផ្ទាល់",
    urlInputLabel: "បញ្ចូលតំណភ្ជាប់វីដេអូ ឬគេហទំព័រ",
    urlPlaceholder: "បិទភ្ជាប់តំណភ្ជាប់វីដេអូ ឬរឿងភាគទីនេះ (ឧទាហរណ៍៖ https://...)",
    pasteBtn: "បិទភ្ជាប់",
    clearBtn: "លុប",
    inspectBtn: "ពិនិត្យតំណភ្ជាប់",
    checkingBtn: "កំពុងពិនិត្យ...",
    inspectingMsg: "កំពុងត្រួតពិនិត្យតំណភ្ជាប់...",
    supportedPlatformsLabel: "គេហទំព័រ និងបណ្ដាញសង្គមដែលគាំទ្រ",
    videoFoundHeader: "ព័ត៌មានមេឌៀដែលបានរកឃើញ",
    tabSingleVideo: "វីដេអូទោល / ភាគនេះ",
    tabSeriesProfile: "កម្រងភាគ / Profile ទាំងមូល",
    durationLabel: "រយៈពេល",
    uploaderLabel: "អ្នកផ្សាយ",
    qualityLabel: "ជ្រើសរើសកម្រិតគុណភាពវីដេអូ",
    audioOnlyTitle: "ទាញយកតែសំឡេង (MP3)",
    audioOnlyHint: "ស្រង់យកតែសំឡេងសុទ្ធជាទម្រង់ MP3 សម្រាប់ដាក់ក្នុងបន្ទាត់តន្ត្រី ឬសំឡេង",
    downloadAndImportBtn: "ទាញយក និងដាក់ចូលគម្រោង",
    downloadingBtn: "កំពុងទាញយក...",
    downloadingMsg: "កំពុងទាញយកឯកសារ...",
    importingMsg: "កំពុងនាំចូលទៅក្នុងគម្រោងកាត់ត...",
    speedLabel: "ល្បឿន៖",
    sizeLabel: "ទំហំសរុប៖",
    downloadCompleteTitle: "ការទាញយកបានជោគជ័យ!",
    downloadCompleteDesc: "ឯកសារត្រូវបានបញ្ចូលទៅក្នុងបន្ទាត់ពេលវេលា និងប្រអប់ផ្ទុកមេឌៀរួចរាល់ហើយ។",
    returnToEditorNow: "ត្រឡប់ទៅកាត់តវីដេអូឥឡូវនេះ",
    downloadAnother: "ទាញយកវីដេអូផ្សេងទៀត",
    platformKisskh: "KissKH (រឿងភាគ និងគំនូរជីវចល)",
    platformHongguo: "Hongguo (រឿងភាគខ្លី 红果短剧)",
    platformDirect: "តំណភ្ជាប់ផ្ទាល់ (MP4 / M3U8)",
    formatBest: "គុណភាពខ្ពស់បំផុត (ច្បាស់បំផុត - គុណភាពដើម)",
    format1080p: "កម្រិតច្បាស់ខ្ពស់ 1080p (Full HD)",
    format720p: "កម្រិតច្បាស់ 720p (HD)",
    format480p: "កម្រិតមធ្យម 480p (SD)",
    format360p: "កម្រិតទាប 360p",
    formatAudioOnly: "ឯកសារសំឡេងតែប៉ុណ្ណោះ (MP3)",
    connectionConnecting: "កំពុងភ្ជាប់...",
    processingStatus: "កំពុងដំណើរការ...",
    seriesTitleLabel: "កម្រងភាគ / ស៊េរី",
    totalEpisodesLabel: "សរុប",
    episodesUnit: "ភាគ",
    searchEpisodePlaceholder: "ស្វែងរកភាគ (ឧ. ២២០, 15)...",
    selectAll: "ជ្រើសរើសទាំងអស់",
    deselectAll: "ដោះការជ្រើសរើស",
    selectedCountText: "បានជ្រើសរើស {count} ភាគ",
    downloadSelectedBtn: "ទាញយក {count} ភាគដែលបានជ្រើសរើស",
    downloadSingleEpBtn: "ទាញយកភាគនេះ",
    filterRangeAll: "ទាំងអស់",
    sortAscending: "ភាគ ១ ទៅបញ្ចប់",
    sortDescending: "ភាគចុងក្រោយមុន",
    batchProgressLabel: "កំពុងដំណើរការទាញយកជាកម្រង",
    batchProgressItem: "ភាគ {current} ក្នុងចំណោម {total} ភាគ",
    cancelBatchBtn: "បញ្ឈប់ការទាញយក",
    statusQueued: "រង់ចាំក្នុងជួរ",
    statusDownloading: "កំពុងទាញយក",
    statusCompleted: "បាននាំចូលរួចរាល់",
    statusFailed: "បរាជ័យ",
    batchDoneTitle: "បានទាញយកជាកម្រងរួចរាល់!",
    batchDoneDesc: "បានទាញយក និងនាំចូលចំនួន {count} ភាគទៅក្នុងគម្រោងកាត់តរួចរាល់ហើយ។",
    noEpisodesFound: "មិនមានភាគត្រូវនឹងការស្វែងរករបស់អ្នកឡើយ",
    episodeLabel: "ភាគ",
    currentPlayingBadge: "ភាគកំពុងមើល",
    batchOptionsLabel: "ជម្រើសទាញយកជាកម្រង",
  },
  en: {
    backToEditor: "Back to Video Editor",
    breadcrumbEditor: "Editor",
    breadcrumbDownloader: "Web Media Downloader",
    serverReady: "Server Connected",
    pageTitle: "Universal Web Media Downloader",
    pageSubtitle: "Download high-definition video or audio directly from YouTube, TikTok, KissKH, Hongguo, Facebook, and more",
    urlInputLabel: "Enter Video or Website URL",
    urlPlaceholder: "Paste video or series link here (e.g. https://...)",
    pasteBtn: "Paste",
    clearBtn: "Clear",
    inspectBtn: "Inspect Link",
    checkingBtn: "Inspecting...",
    inspectingMsg: "Inspecting media URL...",
    supportedPlatformsLabel: "Supported Platforms",
    videoFoundHeader: "Detected Media Information",
    tabSingleVideo: "Single Video / Current Episode",
    tabSeriesProfile: "Entire Series / Profile",
    durationLabel: "Duration",
    uploaderLabel: "Uploader",
    qualityLabel: "Select Video Quality",
    audioOnlyTitle: "Audio Only (MP3)",
    audioOnlyHint: "Extract high-quality audio track directly into timeline",
    downloadAndImportBtn: "Download & Import into Project",
    downloadingBtn: "Downloading...",
    downloadingMsg: "Downloading media file...",
    importingMsg: "Importing to editor...",
    speedLabel: "Speed:",
    sizeLabel: "Total Size:",
    downloadCompleteTitle: "Download Completed Successfully!",
    downloadCompleteDesc: "The media file has been added to your timeline and media bin.",
    returnToEditorNow: "Return to Video Editor",
    downloadAnother: "Download Another Media",
    platformKisskh: "KissKH (Drama & Anime)",
    platformHongguo: "Hongguo (Short Drama 红果短剧)",
    platformDirect: "Direct Link (MP4 / M3U8)",
    formatBest: "Best Available (Highest Quality)",
    format1080p: "1080p Full HD",
    format720p: "720p HD",
    format480p: "480p SD",
    format360p: "360p Standard",
    formatAudioOnly: "Audio Only (MP3)",
    connectionConnecting: "Connecting...",
    processingStatus: "Processing...",
    seriesTitleLabel: "Series / Playlist",
    totalEpisodesLabel: "Total",
    episodesUnit: "Episodes",
    searchEpisodePlaceholder: "Search episode (e.g. 220, 15)...",
    selectAll: "Select All",
    deselectAll: "Deselect All",
    selectedCountText: "Selected {count} episodes",
    downloadSelectedBtn: "Download {count} Selected Episodes",
    downloadSingleEpBtn: "Download this episode",
    filterRangeAll: "All",
    sortAscending: "Oldest First (1 to End)",
    sortDescending: "Newest First (Latest)",
    batchProgressLabel: "Batch Downloading in Progress",
    batchProgressItem: "Episode {current} of {total}",
    cancelBatchBtn: "Cancel Batch",
    statusQueued: "Queued",
    statusDownloading: "Downloading",
    statusCompleted: "Imported to Project",
    statusFailed: "Failed",
    batchDoneTitle: "Batch Download Completed!",
    batchDoneDesc: "Successfully downloaded and imported {count} episodes into your project.",
    noEpisodesFound: "No episodes matched your search",
    episodeLabel: "Ep",
    currentPlayingBadge: "Current Episode",
    batchOptionsLabel: "Batch Download Options",
  },
};

/**
 * Lazy Thumbnail with Skeleton Shimmer Placeholder & Proxy Fallback
 */
function LazyThumbnail({
  src,
  alt = "",
  className = "",
  badge = null,
  aspectRatio = "16 / 9",
  fallbackText = "",
  fallbackIcon = null,
}) {
  const [status, setStatus] = useState("loading"); // "loading" | "loaded" | "error"
  const [attempt, setAttempt] = useState(0); // 0 = safe proxy, 1 = direct src, 2 = error

  // Compute safe initial url through proxy to ensure CORP compliance in require-corp mode
  const safeInitialUrl = useMemo(() => {
    if (!src) return "";
    return downloaderService.getImageProxyUrl(src);
  }, [src]);

  const [currentSrc, setCurrentSrc] = useState(safeInitialUrl);

  useEffect(() => {
    if (!src) {
      setCurrentSrc("");
      setStatus("error");
      setAttempt(2);
      return;
    }
    const safe = downloaderService.getImageProxyUrl(src);
    setCurrentSrc(safe);
    setStatus("loading");
    setAttempt(0);
  }, [src]);

  const handleLoad = () => {
    setStatus("loaded");
  };

  const handleError = () => {
    // If the proxy attempt failed, fallback to direct src
    if (attempt === 0 && src && currentSrc !== src) {
      setAttempt(1);
      setCurrentSrc(src);
      setStatus("loading");
    } else {
      setAttempt(2);
      setStatus("error");
    }
  };

  return (
    <div className={`url-page-lazy-thumb ${className}`} style={{ aspectRatio }}>
      {/* Animated Shimmer Skeleton while loading */}
      {status === "loading" && (
        <div className="url-page-thumb-skeleton">
          <div className="url-page-thumb-shimmer" />
        </div>
      )}

      {/* Real Image with Lazy Loading & CORS */}
      {currentSrc && status !== "error" && (
        <img
          src={currentSrc}
          alt={alt}
          className={`url-page-thumb-img ${status === "loaded" ? "is-loaded" : ""}`}
          loading="lazy"
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
          onLoad={handleLoad}
          onError={handleError}
        />
      )}

      {/* Fallback Placeholder */}
      {status === "error" && (
        <div className="url-page-thumb-fallback">
          {fallbackIcon || <FilmStrip size={32} weight="duotone" className="url-page-fallback-icon" />}
          {fallbackText && <span className="url-page-fallback-text">{fallbackText}</span>}
        </div>
      )}

      {/* Optional Badge Overlay */}
      {badge && <div className="url-page-thumb-badge-overlay">{badge}</div>}
    </div>
  );
}

export function UrlDownloaderPage({ onBack, onMediaDownloaded, language = "km", notify }) {
  // Always default to Khmer ('km') unless explicitly changed by user
  const [uiLang, setUiLang] = useState("km");
  const isKhmer = uiLang === "km";
  const c = isKhmer ? COPY.km : COPY.en;

  const [url, setUrl] = useState("");
  const [isFetchingInfo, setIsFetchingInfo] = useState(false);
  const [mediaInfo, setMediaInfo] = useState(null);
  const [selectedFormat, setSelectedFormat] = useState("best");
  const [isAudioOnly, setIsAudioOnly] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState(null);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [lastDownloadedName, setLastDownloadedName] = useState("");

  // Series / Profile Batch Mode States
  const [activeTab, setActiveTab] = useState("single"); // "single" | "series"
  const [selectedEpisodeIds, setSelectedEpisodeIds] = useState(new Set());
  const [episodeSearch, setEpisodeSearch] = useState("");
  const [sortOrder, setSortOrder] = useState("desc"); // "desc" (e.g. 220 -> 1) or "asc"
  const [rangeFilter, setRangeFilter] = useState("all");
  const [isBatchDownloading, setIsBatchDownloading] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, percent: 0, speed: "" });
  const [episodeStatuses, setEpisodeStatuses] = useState({}); // { [epId]: 'idle' | 'queued' | 'downloading' | 'completed' | 'failed' }
  const [batchCompletedCount, setBatchCompletedCount] = useState(0);

  const cancelBatchRef = useRef(false);
  const hasCompletedRef = useRef(false);

  useEffect(() => {
    socketService.connect();
    const unsubProgress = socketService.on("downloader:progress", (data) => {
      setDownloadProgress(data);
      if (data?.percent !== undefined) {
        setBatchProgress((prev) => ({
          ...prev,
          percent: data.percent,
          speed: data.speed || prev.speed,
        }));
      }
    });

    const unsubComplete = socketService.on("downloader:complete", async (data) => {
      // If we are doing single download
      if (!cancelBatchRef.current && !isBatchDownloading) {
        await handleComplete(data, { closePage: false });
      }
    });

    const unsubError = socketService.on("downloader:error", (data) => {
      if (!isBatchDownloading) {
        setIsDownloading(false);
        setStatusMessage("");
        setError(cleanErrorMessage(data.error || "Download failed"));
      }
    });

    return () => {
      unsubProgress();
      unsubComplete();
      unsubError();
    };
  }, [isBatchDownloading]);

  const runInspect = async (targetUrl) => {
    const clean = (targetUrl || url).trim();
    if (!clean) return;
    setIsFetchingInfo(true);
    setError(null);
    setMediaInfo(null);
    setDownloadSuccess(false);
    setSelectedEpisodeIds(new Set());
    setEpisodeStatuses({});
    setStatusMessage(c.inspectingMsg);

    try {
      const info = await downloaderService.fetchMediaInfo(clean);
      setMediaInfo(info);
      if (info.formats && info.formats.length > 0) {
        setSelectedFormat(info.formats[0].formatId);
      }
      // If the media has multiple episodes, select the current episode by default
      if (info.episodes && info.episodes.length > 0) {
        const currentId = info.currentEpisode
          ? info.episodes.find((ep) => ep.number === info.currentEpisode)?.id
          : info.episodes[0].id;
        if (currentId) {
          setSelectedEpisodeIds(new Set([currentId]));
        }
      }
      setStatusMessage("");
    } catch (err) {
      setError(cleanErrorMessage(err));
      setStatusMessage("");
    } finally {
      setIsFetchingInfo(false);
    }
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

  const handleComplete = async (fileData, options = {}) => {
    if (hasCompletedRef.current) return;
    hasCompletedRef.current = true;
    setIsDownloading(false);
    setStatusMessage(c.importingMsg);

    try {
      let fileObject = fileData;
      if (!(fileObject instanceof File)) {
        fileObject = await downloaderService.fetchDownloadedFileObject(fileData);
      }
      setLastDownloadedName(fileObject.name || "Media");
      setDownloadSuccess(true);
      if (onMediaDownloaded) {
        await onMediaDownloaded(fileObject, { closePage: options.closePage || false });
      }
      if (notify) {
        notify(`${c.downloadCompleteTitle}: ${fileObject.name}`);
      }
    } catch (err) {
      setError(cleanErrorMessage(err));
    } finally {
      setStatusMessage("");
    }
  };

  // Single video download
  const handleStartDownload = async (customUrl = null, customTitle = null) => {
    const targetUrl = (customUrl || url).trim();
    if (!targetUrl) return;

    setIsDownloading(true);
    setError(null);
    setDownloadSuccess(false);
    hasCompletedRef.current = false;
    setDownloadProgress({ percent: 0, speed: c.connectionConnecting });
    setStatusMessage(c.downloadingMsg);

    try {
      const result = await downloaderService.startDownload(targetUrl, selectedFormat, isAudioOnly);
      if (result.success && result.file) {
        if (customTitle && result.file) {
          result.file.title = customTitle;
        }
        await handleComplete(result.file, { closePage: false });
      }
    } catch (err) {
      setIsDownloading(false);
      setStatusMessage("");
      setError(cleanErrorMessage(err));
    }
  };

  // Batch download of selected episodes (Series / Profile mode)
  const handleStartBatchDownload = async () => {
    if (!mediaInfo?.episodes || selectedEpisodeIds.size === 0) return;

    const episodesToDownload = mediaInfo.episodes.filter((ep) =>
      selectedEpisodeIds.has(ep.id)
    );
    if (episodesToDownload.length === 0) return;

    setIsBatchDownloading(true);
    cancelBatchRef.current = false;
    setError(null);
    setDownloadSuccess(false);
    setBatchCompletedCount(0);

    // Initialize all selected statuses to queued
    const initialStatuses = {};
    for (const ep of episodesToDownload) {
      initialStatuses[ep.id] = "queued";
    }
    setEpisodeStatuses((prev) => ({ ...prev, ...initialStatuses }));

    let completed = 0;

    for (let i = 0; i < episodesToDownload.length; i++) {
      if (cancelBatchRef.current) break;

      const ep = episodesToDownload[i];
      setBatchProgress({
        current: i + 1,
        total: episodesToDownload.length,
        percent: 0,
        speed: c.connectionConnecting,
      });

      setEpisodeStatuses((prev) => ({ ...prev, [ep.id]: "downloading" }));

      try {
        const result = await downloaderService.startDownload(ep.url, selectedFormat, isAudioOnly);
        if (result.success && result.file) {
          const fileObject = await downloaderService.fetchDownloadedFileObject(result.file);
          if (onMediaDownloaded) {
            await onMediaDownloaded(fileObject, { closePage: false });
          }
          setEpisodeStatuses((prev) => ({ ...prev, [ep.id]: "completed" }));
          completed += 1;
          setBatchCompletedCount(completed);
        } else {
          setEpisodeStatuses((prev) => ({ ...prev, [ep.id]: "failed" }));
        }
      } catch (err) {
        console.error(`Failed downloading episode ${ep.number}:`, err);
        setEpisodeStatuses((prev) => ({ ...prev, [ep.id]: "failed" }));
      }
    }

    setIsBatchDownloading(false);

    if (completed > 0) {
      setDownloadSuccess(true);
      setLastDownloadedName(`${mediaInfo.dramaTitle || mediaInfo.title} (${completed} ${c.episodesUnit})`);
      if (notify) {
        notify(
          isKhmer
            ? `បានទាញយក ${completed} ភាគដោយជោគជ័យ!`
            : `Successfully downloaded ${completed} episodes!`
        );
      }
    }
  };

  const handleCancelBatch = () => {
    cancelBatchRef.current = true;
    setIsBatchDownloading(false);
  };

  // Toggle single episode selection in batch mode
  const toggleEpisodeSelection = (epId) => {
    setSelectedEpisodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(epId)) {
        next.delete(epId);
      } else {
        next.add(epId);
      }
      return next;
    });
  };

  // Filter and sort episodes for Series view
  const processedEpisodes = useMemo(() => {
    if (!mediaInfo?.episodes) return [];
    let list = [...mediaInfo.episodes];

    // Search query
    if (episodeSearch.trim()) {
      const q = episodeSearch.trim().toLowerCase();
      list = list.filter(
        (ep) =>
          String(ep.number).includes(q) ||
          String(ep.title).toLowerCase().includes(q)
      );
    }

    // Range filtering
    if (rangeFilter !== "all") {
      const [start, end] = rangeFilter.split("-").map(Number);
      if (!Number.isNaN(start) && !Number.isNaN(end)) {
        list = list.filter((ep) => ep.number >= start && ep.number <= end);
      }
    }

    // Sort order
    list.sort((a, b) => {
      const numA = Number(a.number) || 0;
      const numB = Number(b.number) || 0;
      return sortOrder === "asc" ? numA - numB : numB - numA;
    });

    return list;
  }, [mediaInfo?.episodes, episodeSearch, rangeFilter, sortOrder]);

  // Generate range filter chunks if episode count > 20
  const rangeChunks = useMemo(() => {
    if (!mediaInfo?.episodes || mediaInfo.episodes.length <= 20) return [];
    const maxNum = Math.max(...mediaInfo.episodes.map((e) => Number(e.number) || 0));
    const chunks = [];
    const chunkSize = maxNum > 100 ? 50 : 20;
    for (let start = 1; start <= maxNum; start += chunkSize) {
      const end = Math.min(start + chunkSize - 1, maxNum);
      chunks.push({
        id: `${start}-${end}`,
        label: isKhmer ? `ភាគ ${start}-${end}` : `Ep ${start}-${end}`,
      });
    }
    return chunks;
  }, [mediaInfo?.episodes, isKhmer]);

  const selectAllFiltered = () => {
    const allFilteredIds = new Set(processedEpisodes.map((ep) => ep.id));
    setSelectedEpisodeIds((prev) => new Set([...prev, ...allFilteredIds]));
  };

  const deselectAllFiltered = () => {
    const filteredIdSet = new Set(processedEpisodes.map((ep) => ep.id));
    setSelectedEpisodeIds((prev) => {
      const next = new Set(prev);
      for (const id of filteredIdSet) {
        next.delete(id);
      }
      return next;
    });
  };

  const formatResolutionText = (fmt) => {
    if (!fmt) return "";
    const raw = String(fmt.resolution || fmt.label || "").toLowerCase();
    const ext = fmt.ext ? fmt.ext.toUpperCase() : "MP4";

    if (isKhmer) {
      if (raw.includes("2160") || raw.includes("4k")) {
        return `កម្រិតច្បាស់ខ្លាំង 4K Ultra HD (${ext})`;
      }
      if (raw.includes("1440") || raw.includes("2k")) {
        return `កម្រិតច្បាស់ខ្ពស់ 2K Quad HD (${ext})`;
      }
      if (raw.includes("1080")) {
        return `កម្រិតច្បាស់ខ្ពស់ 1080p Full HD (${ext})`;
      }
      if (raw.includes("720")) {
        return `កម្រិតច្បាស់ 720p HD (${ext})`;
      }
      if (raw.includes("480")) {
        return `កម្រិតមធ្យម 480p SD (${ext})`;
      }
      if (raw.includes("360")) {
        return `កម្រិតទាប 360p (${ext})`;
      }
      if (raw.includes("audio") || raw.includes("mp3")) {
        return `ឯកសារសំឡេងតែប៉ុណ្ណោះ (MP3)`;
      }
      return `${c.formatBest} (${ext})`;
    }

    if (raw.includes("2160") || raw.includes("4k")) return `4K Ultra HD (${ext})`;
    if (raw.includes("1080")) return `1080p Full HD (${ext})`;
    if (raw.includes("720")) return `720p HD (${ext})`;
    if (raw.includes("480")) return `480p SD (${ext})`;
    if (raw.includes("audio")) return `Audio Only (${ext})`;
    return `${fmt.label || fmt.resolution || "Best Available"} (${ext})`;
  };

  const getPlatformLabel = (rawPlatform) => {
    const p = String(rawPlatform || "").toLowerCase();
    if (p.includes("kisskh")) return c.platformKisskh;
    if (p.includes("hongguo") || p.includes("红果")) return c.platformHongguo;
    if (p.includes("direct") || p.includes("m3u8")) return c.platformDirect;
    if (p.includes("youtube")) return "YouTube";
    if (p.includes("tiktok")) return "TikTok";
    if (p.includes("facebook")) return "Facebook";
    if (p.includes("instagram")) return "Instagram";
    if (p.includes("twitter") || p.includes("x")) return "X";
    if (p.includes("vimeo")) return "Vimeo";
    if (p.includes("bilibili")) return "Bilibili";
    return rawPlatform || "Web";
  };

  const supportedPlatforms = [
    { name: "YouTube", tag: "youtube" },
    { name: "TikTok", tag: "tiktok" },
    { name: isKhmer ? "KissKH (រឿងភាគ និងគំនូរជីវចល)" : "KissKH (Drama & Anime)", tag: "kisskh" },
    { name: isKhmer ? "Hongguo (រឿងភាគខ្លី 红果短剧)" : "Hongguo (Short Drama 红果短剧)", tag: "hongguo" },
    { name: "Facebook", tag: "facebook" },
    { name: "Instagram", tag: "instagram" },
    { name: "X", tag: "twitter" },
    { name: "Vimeo", tag: "vimeo" },
    { name: "Bilibili", tag: "bilibili" },
    { name: isKhmer ? "តំណភ្ជាប់ផ្ទាល់ (MP4 / M3U8)" : "Direct MP4 / M3U8", tag: "direct" },
  ];

  const hasEpisodes = Boolean(mediaInfo?.episodes && mediaInfo.episodes.length > 0);

  return (
    <div className="url-page-wrapper">
      {/* Top Navigation Bar */}
      <header className="url-page-navbar">
        <div className="url-page-nav-left">
          <button
            type="button"
            className="url-page-back-btn"
            onClick={onBack}
            disabled={isDownloading || isBatchDownloading}
            title={c.backToEditor}
          >
            <ArrowLeft size={17} weight="bold" />
            <span>{c.backToEditor}</span>
          </button>
          <div className="url-page-nav-divider" />
          <nav className="url-page-breadcrumbs" aria-label="Breadcrumb">
            <span>{c.breadcrumbEditor}</span>
            <span className="url-page-breadcrumb-separator">/</span>
            <strong className="url-page-breadcrumb-current">{c.breadcrumbDownloader}</strong>
          </nav>
        </div>

        <div className="url-page-nav-right">
          <button
            type="button"
            className="url-page-lang-btn"
            onClick={() => setUiLang((l) => (l === "km" ? "en" : "km"))}
            title={isKhmer ? "ប្តូរទៅភាសាអង់គ្លេស / Switch to English" : "ប្តូរទៅភាសាខ្មែរ / Switch to Khmer"}
          >
            <span>{isKhmer ? "🇰🇭 ភាសាខ្មែរ" : "🇺🇸 English"}</span>
          </button>
          <div className="url-page-server-pill">
            <span className="url-page-server-dot" />
            <span>{c.serverReady}</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="url-page-container">
        {/* Hero Title Section */}
        <div className="url-page-hero">
          <div className="url-page-hero-icon-wrap">
            <Globe size={32} weight="duotone" className="url-page-hero-icon" />
          </div>
          <h1 className="url-page-title">{c.pageTitle}</h1>
          <p className="url-page-subtitle">{c.pageSubtitle}</p>
        </div>

        {/* Input & Search Card */}
        <section className="url-page-card url-page-search-card">
          <label className="url-page-field-label" htmlFor="media-url-input">
            {c.urlInputLabel}
          </label>
          <div className="url-page-input-wrapper">
            <div className="url-page-input-icon">
              <LinkSimple size={18} />
            </div>
            <input
              id="media-url-input"
              type="url"
              className="url-page-input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={c.urlPlaceholder}
              disabled={isDownloading || isBatchDownloading || isFetchingInfo}
              onKeyDown={(e) => {
                if (e.key === "Enter" && url.trim() && !isFetchingInfo && !isDownloading && !isBatchDownloading) {
                  e.preventDefault();
                  void runInspect();
                }
              }}
            />
            {url && (
              <button
                type="button"
                className="url-page-clear-btn"
                onClick={() => {
                  setUrl("");
                  setMediaInfo(null);
                  setError(null);
                  setDownloadSuccess(false);
                  setSelectedEpisodeIds(new Set());
                }}
                disabled={isDownloading || isBatchDownloading || isFetchingInfo}
                title={c.clearBtn}
              >
                <X size={15} />
              </button>
            )}
            <button
              type="button"
              className="url-page-btn-paste"
              onClick={handlePaste}
              disabled={isDownloading || isBatchDownloading || isFetchingInfo}
            >
              <ClipboardText size={15} />
              <span>{c.pasteBtn}</span>
            </button>
            <button
              type="button"
              className="url-page-btn-inspect"
              onClick={() => runInspect()}
              disabled={!url.trim() || isFetchingInfo || isDownloading || isBatchDownloading}
            >
              {isFetchingInfo ? (
                <>
                  <CircleNotch className="is-spinning" size={16} />
                  <span>{c.checkingBtn}</span>
                </>
              ) : (
                <>
                  <MagnifyingGlass size={16} weight="bold" />
                  <span>{c.inspectBtn}</span>
                </>
              )}
            </button>
          </div>

          {/* Supported Platforms Pills */}
          <div className="url-page-platforms-row">
            <span className="url-page-platforms-label">{c.supportedPlatformsLabel}:</span>
            <div className="url-page-platforms-list">
              {supportedPlatforms.map((p) => (
                <span key={p.tag} className="url-page-platform-pill">
                  {p.name}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Error Alert */}
        {error && (
          <div className="url-page-alert-error" role="alert">
            <div className="url-page-alert-error-icon">⚠️</div>
            <div className="url-page-alert-error-text">{error}</div>
          </div>
        )}

        {/* Download Success Card */}
        {downloadSuccess && (
          <section className="url-page-card url-page-success-card">
            <div className="url-page-success-header">
              <div className="url-page-success-icon-wrap">
                <CheckCircle size={36} weight="fill" />
              </div>
              <div>
                <h3 className="url-page-success-title">{c.downloadCompleteTitle}</h3>
                <p className="url-page-success-desc">
                  {c.downloadCompleteDesc}
                  {lastDownloadedName ? ` (${lastDownloadedName})` : ""}
                </p>
              </div>
            </div>
            <div className="url-page-success-actions">
              <button
                type="button"
                className="url-page-btn-action-primary"
                onClick={onBack}
              >
                <ArrowLeft size={16} weight="bold" />
                <span>{c.returnToEditorNow}</span>
              </button>
              <button
                type="button"
                className="url-page-btn-action-secondary"
                onClick={() => {
                  setDownloadSuccess(false);
                  setUrl("");
                  setMediaInfo(null);
                  setSelectedEpisodeIds(new Set());
                }}
              >
                <span>{c.downloadAnother}</span>
              </button>
            </div>
          </section>
        )}

        {/* Media Info Result Card */}
        {mediaInfo && !downloadSuccess && (
          <section className="url-page-card url-page-result-card">
            {/* Header: Title & Platform Badge */}
            <div className="url-page-result-header">
              <div className="url-page-result-header-left">
                <h2 className="url-page-result-title">{c.videoFoundHeader}</h2>
                {mediaInfo.dramaTitle && (
                  <span className="url-page-series-subtitle">{mediaInfo.dramaTitle}</span>
                )}
              </div>
              <span className="url-page-platform-badge">
                {getPlatformLabel(mediaInfo.platform)}
              </span>
            </div>

            {/* Mode Tabs: Single Video vs Series / Profile */}
            <div className="url-page-mode-tabs">
              <button
                type="button"
                className={`url-page-tab-btn ${activeTab === "single" ? "is-active" : ""}`}
                onClick={() => setActiveTab("single")}
              >
                <FilmStrip size={17} weight={activeTab === "single" ? "fill" : "regular"} />
                <span>{c.tabSingleVideo}</span>
                {mediaInfo.currentEpisode && (
                  <span className="url-page-tab-badge">
                    {c.episodeLabel} {mediaInfo.currentEpisode}
                  </span>
                )}
              </button>

              {hasEpisodes && (
                <button
                  type="button"
                  className={`url-page-tab-btn ${activeTab === "series" ? "is-active" : ""}`}
                  onClick={() => setActiveTab("series")}
                >
                  <SquaresFour size={17} weight={activeTab === "series" ? "fill" : "regular"} />
                  <span>{c.tabSeriesProfile}</span>
                  <span className="url-page-tab-badge url-page-tab-badge-accent">
                    {mediaInfo.episodes.length} {c.episodesUnit}
                  </span>
                </button>
              )}
            </div>

            {/* TAB 1: SINGLE VIDEO DOWNLOAD */}
            {activeTab === "single" && (
              <div className="url-page-media-grid">
                {/* Lazy Thumbnail with Shimmer Skeleton */}
                <div className="url-page-thumb-container">
                  <LazyThumbnail
                    src={mediaInfo.thumbnail}
                    alt={mediaInfo.title}
                    aspectRatio="16 / 9"
                    fallbackText={mediaInfo.title}
                    badge={
                      mediaInfo.duration ? (
                        <div className="url-page-duration-badge">
                          <Clock size={12} />
                          <span>{formatSecondsToTimecode(mediaInfo.duration)}</span>
                        </div>
                      ) : mediaInfo.currentEpisode ? (
                        <div className="url-page-duration-badge">
                          <span>
                            {c.episodeLabel} {mediaInfo.currentEpisode}
                          </span>
                        </div>
                      ) : null
                    }
                  />
                </div>

                {/* Meta and Single Options */}
                <div className="url-page-media-details">
                  <h3 className="url-page-media-title" title={mediaInfo.title}>
                    {mediaInfo.title}
                  </h3>

                  <div className="url-page-media-meta-tags">
                    {mediaInfo.uploader && (
                      <span className="url-page-meta-tag">
                        <User size={13} />
                        <span>{mediaInfo.uploader}</span>
                      </span>
                    )}
                    {mediaInfo.duration ? (
                      <span className="url-page-meta-tag">
                        <Clock size={13} />
                        <span>{c.durationLabel}៖ {formatSecondsToTimecode(mediaInfo.duration)}</span>
                      </span>
                    ) : null}
                    {hasEpisodes && (
                      <span className="url-page-meta-tag">
                        <SquaresFour size={13} />
                        <span>
                          {c.totalEpisodesLabel}៖ {mediaInfo.episodes.length} {c.episodesUnit}
                        </span>
                      </span>
                    )}
                  </div>

                  {/* Quality & Audio Only Configuration */}
                  <div className="url-page-controls-group">
                    <div className="url-page-select-wrapper">
                      <label className="url-page-field-label" htmlFor="quality-select">
                        {c.qualityLabel}
                      </label>
                      <select
                        id="quality-select"
                        className="url-page-select"
                        value={selectedFormat}
                        onChange={(e) => {
                          setSelectedFormat(e.target.value);
                          setIsAudioOnly(e.target.value.includes("bestaudio"));
                        }}
                        disabled={isDownloading}
                      >
                        {mediaInfo.formats?.map((fmt) => (
                          <option key={fmt.formatId} value={fmt.formatId}>
                            {formatResolutionText(fmt)}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Audio only toggle option */}
                    <label className="url-page-toggle-option">
                      <input
                        type="checkbox"
                        checked={isAudioOnly}
                        onChange={(e) => {
                          setIsAudioOnly(e.target.checked);
                          if (e.target.checked) {
                            setSelectedFormat("bestaudio");
                          } else if (mediaInfo.formats?.[0]?.formatId) {
                            setSelectedFormat(mediaInfo.formats[0].formatId);
                          }
                        }}
                        disabled={isDownloading}
                      />
                      <div className="url-page-toggle-text">
                        <div className="url-page-toggle-title">
                          <MusicNotes size={15} />
                          <span>{c.audioOnlyTitle}</span>
                        </div>
                        <small className="url-page-toggle-desc">{c.audioOnlyHint}</small>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: SERIES / PROFILE BATCH DOWNLOAD */}
            {activeTab === "series" && hasEpisodes && (
              <div className="url-page-series-container">
                {/* Global Batch Quality & Audio Settings Bar */}
                <div className="url-page-series-config-bar">
                  <div className="url-page-series-config-item">
                    <label className="url-page-field-label" htmlFor="batch-quality-select">
                      {c.qualityLabel}
                    </label>
                    <select
                      id="batch-quality-select"
                      className="url-page-select url-page-select-compact"
                      value={selectedFormat}
                      onChange={(e) => {
                        setSelectedFormat(e.target.value);
                        setIsAudioOnly(e.target.value.includes("bestaudio"));
                      }}
                      disabled={isBatchDownloading}
                    >
                      {mediaInfo.formats?.map((fmt) => (
                        <option key={fmt.formatId} value={fmt.formatId}>
                          {formatResolutionText(fmt)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <label className="url-page-toggle-option url-page-toggle-option-compact">
                    <input
                      type="checkbox"
                      checked={isAudioOnly}
                      onChange={(e) => {
                        setIsAudioOnly(e.target.checked);
                        if (e.target.checked) {
                          setSelectedFormat("bestaudio");
                        } else if (mediaInfo.formats?.[0]?.formatId) {
                          setSelectedFormat(mediaInfo.formats[0].formatId);
                        }
                      }}
                      disabled={isBatchDownloading}
                    />
                    <div className="url-page-toggle-text">
                      <div className="url-page-toggle-title">
                        <MusicNotes size={14} />
                        <span>{c.audioOnlyTitle}</span>
                      </div>
                    </div>
                  </label>
                </div>

                {/* Active Batch Download Progress Box */}
                {isBatchDownloading && (
                  <div className="url-page-batch-progress-box">
                    <div className="url-page-batch-progress-top">
                      <div className="url-page-batch-progress-status">
                        <CircleNotch size={18} className="is-spinning" />
                        <div>
                          <strong>{c.batchProgressLabel}</strong>
                          <p>
                            {c.batchProgressItem
                              .replace("{current}", batchProgress.current)
                              .replace("{total}", batchProgress.total)}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="url-page-btn-cancel-batch"
                        onClick={handleCancelBatch}
                      >
                        {c.cancelBatchBtn}
                      </button>
                    </div>

                    <div className="url-page-progress-track">
                      <div
                        className="url-page-progress-bar"
                        style={{
                          width: `${
                            batchProgress.total > 0
                              ? ((batchProgress.current - 1 + (batchProgress.percent || 0) / 100) /
                                  batchProgress.total) *
                                100
                              : 10
                          }%`,
                        }}
                      />
                    </div>

                    <div className="url-page-progress-metrics">
                      <span>{c.speedLabel} {batchProgress.speed || c.connectionConnecting}</span>
                      <span>
                        {batchProgress.total > 0
                          ? `${Math.round(
                              ((batchProgress.current - 1 + (batchProgress.percent || 0) / 100) /
                                batchProgress.total) *
                                100
                            )}%`
                          : "0%"}
                      </span>
                    </div>
                  </div>
                )}

                {/* Filter & Selection Bar */}
                <div className="url-page-series-toolbar">
                  {/* Search and Sort */}
                  <div className="url-page-series-search-wrap">
                    <MagnifyingGlass size={15} className="url-page-series-search-icon" />
                    <input
                      type="text"
                      className="url-page-series-search-input"
                      placeholder={c.searchEpisodePlaceholder}
                      value={episodeSearch}
                      onChange={(e) => setEpisodeSearch(e.target.value)}
                    />
                    {episodeSearch && (
                      <button
                        type="button"
                        className="url-page-series-search-clear"
                        onClick={() => setEpisodeSearch("")}
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  {/* Range Chunks Filters */}
                  {rangeChunks.length > 0 && (
                    <div className="url-page-range-filters">
                      <button
                        type="button"
                        className={`url-page-range-chip ${rangeFilter === "all" ? "is-active" : ""}`}
                        onClick={() => setRangeFilter("all")}
                      >
                        {c.filterRangeAll}
                      </button>
                      {rangeChunks.map((chunk) => (
                        <button
                          key={chunk.id}
                          type="button"
                          className={`url-page-range-chip ${rangeFilter === chunk.id ? "is-active" : ""}`}
                          onClick={() => setRangeFilter(chunk.id)}
                        >
                          {chunk.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Sort Order Toggle */}
                  <button
                    type="button"
                    className="url-page-btn-sort"
                    onClick={() => setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"))}
                    title={sortOrder === "desc" ? c.sortDescending : c.sortAscending}
                  >
                    <ArrowsDownUp size={15} />
                    <span>{sortOrder === "desc" ? c.sortDescending : c.sortAscending}</span>
                  </button>
                </div>

                {/* Bulk Selection Actions Row */}
                <div className="url-page-bulk-actions-row">
                  <div className="url-page-bulk-selection-controls">
                    <button
                      type="button"
                      className="url-page-btn-select-all"
                      onClick={selectAllFiltered}
                      disabled={isBatchDownloading}
                    >
                      <CheckSquare size={16} weight="bold" />
                      <span>{c.selectAll}</span>
                    </button>
                    <button
                      type="button"
                      className="url-page-btn-deselect-all"
                      onClick={deselectAllFiltered}
                      disabled={isBatchDownloading || selectedEpisodeIds.size === 0}
                    >
                      <Square size={16} />
                      <span>{c.deselectAll}</span>
                    </button>
                    <span className="url-page-selected-count-badge">
                      {c.selectedCountText.replace("{count}", selectedEpisodeIds.size)}
                    </span>
                  </div>

                  <button
                    type="button"
                    className="url-page-btn-download-selected"
                    onClick={handleStartBatchDownload}
                    disabled={isBatchDownloading || selectedEpisodeIds.size === 0}
                  >
                    {isBatchDownloading ? (
                      <>
                        <CircleNotch size={16} className="is-spinning" />
                        <span>{c.downloadingBtn}</span>
                      </>
                    ) : (
                      <>
                        <DownloadSimple size={16} weight="bold" />
                        <span>
                          {c.downloadSelectedBtn.replace("{count}", selectedEpisodeIds.size)}
                        </span>
                      </>
                    )}
                  </button>
                </div>

                {/* Episode Cards Grid with Lazy Loading */}
                {processedEpisodes.length > 0 ? (
                  <div className="url-page-episodes-grid">
                    {processedEpisodes.map((ep) => {
                      const isSelected = selectedEpisodeIds.has(ep.id);
                      const epStatus = episodeStatuses[ep.id] || "idle";
                      const isCurrent = ep.number === mediaInfo.currentEpisode;

                      return (
                        <div
                          key={ep.id}
                          className={`url-page-episode-card ${isSelected ? "is-selected" : ""} ${
                            epStatus !== "idle" ? `is-status-${epStatus}` : ""
                          }`}
                          onClick={() => {
                            if (!isBatchDownloading) {
                              toggleEpisodeSelection(ep.id);
                            }
                          }}
                        >
                          {/* Thumbnail with Shimmer Placeholder */}
                          <div className="url-page-ep-thumb-wrap">
                            <LazyThumbnail
                              src={ep.thumbnail || mediaInfo.thumbnail}
                              alt={ep.title}
                              aspectRatio="16 / 9"
                              fallbackText={`${c.episodeLabel} ${ep.number}`}
                            />

                            {/* Floating Episode Number Badge on Thumbnail */}
                            <div className="url-page-ep-card-badge">
                              <span className="url-page-ep-card-badge-label">{c.episodeLabel}</span>
                              <span className="url-page-ep-card-badge-num">{ep.number}</span>
                            </div>

                            {/* Checkbox Overlay */}
                            <div
                              className={`url-page-ep-checkbox ${isSelected ? "is-checked" : ""}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!isBatchDownloading) {
                                  toggleEpisodeSelection(ep.id);
                                }
                              }}
                            >
                              {isSelected ? <Check size={13} weight="bold" /> : null}
                            </div>

                            {/* Current Playing Indicator */}
                            {isCurrent && (
                              <div className="url-page-ep-current-pill">
                                {c.currentPlayingBadge}
                              </div>
                            )}
                          </div>

                          {/* Episode Info & Action */}
                          <div className="url-page-ep-info">
                            <div className="url-page-ep-title-row">
                              <h4 className="url-page-ep-title">
                                {c.episodeLabel} {ep.number}
                              </h4>

                              {/* Status Badge */}
                              {epStatus === "downloading" && (
                                <span className="url-page-ep-status-badge is-downloading">
                                  <CircleNotch size={11} className="is-spinning" />
                                  <span>{c.statusDownloading}</span>
                                </span>
                              )}
                              {epStatus === "completed" && (
                                <span className="url-page-ep-status-badge is-completed">
                                  <Check size={11} weight="bold" />
                                  <span>{c.statusCompleted}</span>
                                </span>
                              )}
                              {epStatus === "queued" && (
                                <span className="url-page-ep-status-badge is-queued">
                                  <span>{c.statusQueued}</span>
                                </span>
                              )}
                              {epStatus === "failed" && (
                                <span className="url-page-ep-status-badge is-failed">
                                  <WarningCircle size={11} />
                                  <span>{c.statusFailed}</span>
                                </span>
                              )}
                            </div>

                            <button
                              type="button"
                              className="url-page-ep-quick-download"
                              disabled={isBatchDownloading || isDownloading || epStatus === "downloading"}
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleStartDownload(
                                  ep.url,
                                  `${mediaInfo.dramaTitle || mediaInfo.title} - ${c.episodeLabel} ${ep.number}`
                                );
                              }}
                              title={c.downloadSingleEpBtn}
                            >
                              <DownloadSimple size={13} weight="bold" />
                              <span>{c.downloadSingleEpBtn}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="url-page-episodes-empty">
                    <FilmStrip size={36} className="url-page-empty-icon" />
                    <p>{c.noEpisodesFound}</p>
                  </div>
                )}
              </div>
            )}

            {/* Single Download Progress Bar (When downloading single video) */}
            {isDownloading && (
              <div className="url-page-progress-section">
                <div className="url-page-progress-info">
                  <span className="url-page-progress-status">
                    <CircleNotch size={14} className="is-spinning" />
                    <span>{statusMessage || c.downloadingMsg}</span>
                  </span>
                  <span className="url-page-progress-percent">
                    {downloadProgress?.percent ? `${downloadProgress.percent.toFixed(1)}%` : c.processingStatus}
                  </span>
                </div>
                <div className="url-page-progress-track">
                  <div
                    className="url-page-progress-bar"
                    style={{ width: `${downloadProgress?.percent || 15}%` }}
                  />
                </div>
                {downloadProgress?.speed && (
                  <div className="url-page-progress-metrics">
                    <span>{c.speedLabel} {downloadProgress.speed}</span>
                    {downloadProgress.totalSize && (
                      <span>{c.sizeLabel} {downloadProgress.totalSize}</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Bottom Actions Bar (Single Video mode) */}
            {activeTab === "single" && (
              <div className="url-page-actions-bar">
                <button
                  type="button"
                  className="url-page-btn-cancel"
                  onClick={onBack}
                  disabled={isDownloading}
                >
                  {c.backToEditor}
                </button>

                <button
                  type="button"
                  className="url-page-btn-download"
                  onClick={() => handleStartDownload()}
                  disabled={!url.trim() || isDownloading || isFetchingInfo}
                >
                  {isDownloading ? (
                    <>
                      <CircleNotch className="is-spinning" size={17} />
                      <span>{c.downloadingBtn}</span>
                    </>
                  ) : (
                    <>
                      <DownloadSimple size={18} weight="bold" />
                      <span>{c.downloadAndImportBtn}</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
