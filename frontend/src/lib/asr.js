import { AUTOMATIC_CAPTION_MODEL_ID, AUTOMATIC_CAPTION_MODEL_LABEL, AUTOMATIC_CAPTION_MODEL_REVISION } from "../config/models.js";
import { makeId } from "./timeline.js";
import { captionSegmentsFromWords } from "./captionSegmentation.js";

const ASR_SAMPLE_RATE = 16000;
const LANGUAGE_DETECTION_SECONDS = 20;
const CHINESE_VISIBLE_CHAR_THRESHOLD = 8;
const CJK_PATTERN = /[\u3400-\u9fff]/;

const CHINESE_ASR_CONTEXT_REPLACEMENTS = [
  [/侯[父付负](?=主[母姆幕]|夫人|公子|小姐|世子|嫡|庶|门|中|里|内|上下)/g, "侯府"],
  [/候府(?=主[母姆幕]|夫人|公子|小姐|世子|嫡|庶|门|中|里|内|上下)/g, "侯府"],
  [/(侯府)主[姆幕](?=$|[，。！？!?、\s])/g, "$1主母"],
];

const UI_LANGUAGE_TO_WHISPER_LANGUAGE = {
  zh: "zh",
  en: "en",
  ja: "ja",
  ko: "ko",
  es: "es",
  fr: "fr",
  de: "de",
  pt: "pt",
  km: "km",
  vi: "vi",
  it: "it",
  id: "id",
  ru: "ru",
};

const WHISPER_LANGUAGE_NAMES = {
  zh: "ចិន (Chinese)",
  en: "English",
  ja: "Japanese",
  ko: "Korean",
  es: "Spanish",
  fr: "French",
  de: "German",
  pt: "Portuguese",
  km: "ខ្មែរ (Khmer)",
  vi: "Vietnamese",
  it: "Italian",
  id: "Indonesian",
  ru: "Russian",
};

let transcriberState = null;
let asrWorker = null;
let shouldSkipAsrWorker = false;
let transcriptionActive = false;
const workerRequests = new Map();
const throwIfAborted = (signal) => {
  if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
};

function getAudioContext(sampleRate = ASR_SAMPLE_RATE) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error("Browser មិនគាំទ្រ AudioContext សម្រាប់ស្រង់សំឡេងទេ។");
  }

  return new AudioContextClass({ sampleRate });
}

function downmixToMono(decoded) {
  if (decoded.numberOfChannels <= 1) {
    return new Float32Array(decoded.getChannelData(0));
  }

  const left = decoded.getChannelData(0);
  const right = decoded.getChannelData(1);
  const mono = new Float32Array(decoded.length);
  const scale = Math.SQRT2 / 2;
  for (let index = 0; index < decoded.length; index += 1) {
    mono[index] = (left[index] + right[index]) * scale;
  }
  return mono;
}

async function decodeAudioForAsr(blob) {
  const audioContext = getAudioContext();
  try {
    const buffer = await blob.arrayBuffer();
    const decoded = await audioContext.decodeAudioData(buffer.slice(0));
    return {
      audio: downmixToMono(decoded),
      duration: decoded.duration,
    };
  } finally {
    await audioContext.close().catch(() => {});
  }
}

function normalizeAsrWhitespace(text, language) {
  const normalized = String(text ?? "").replace(/\s+/g, " ").trim();
  if (language !== "zh") {
    return normalized;
  }

  return normalized.replace(/([\u3400-\u9fff])\s+([\u3400-\u9fff])/g, "$1$2");
}

function normalizeChineseAsrText(text) {
  if (!CJK_PATTERN.test(text)) {
    return text;
  }

  return CHINESE_ASR_CONTEXT_REPLACEMENTS.reduce(
    (currentText, [pattern, replacement]) => currentText.replace(pattern, replacement),
    text,
  );
}

function stripAudioEventAnnotations(text) {
  return String(text ?? "")
    .replace(/[\(\[\{].*?(?:music|singing|applause|cheering|sound|instrumental).*?[\)\]\}]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeAsrText(text, language) {
  const stripped = stripAudioEventAnnotations(text);
  const normalized = normalizeAsrWhitespace(stripped, language);
  return language === "zh" ? normalizeChineseAsrText(normalized) : normalized;
}

function normalizeTokenId(value) {
  if (typeof value === "bigint") {
    return Number(value);
  }
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
}

function getGeneratedTokenIds(output) {
  const tensorLike = output?.sequences ?? output;
  const rawTokens =
    tensorLike?.[0] && typeof tensorLike[0].tolist === "function"
      ? tensorLike[0].tolist()
      : typeof tensorLike?.tolist === "function"
        ? tensorLike.tolist()
        : tensorLike;
  const firstSequence = Array.isArray(rawTokens?.[0]) ? rawTokens[0] : rawTokens;
  return Array.isArray(firstSequence)
    ? firstSequence.map(normalizeTokenId).filter((token) => token !== null)
    : [];
}

function getWhisperLanguageIdMap(transcriber) {
  const langToId = transcriber?.model?.generation_config?.lang_to_id;
  if (!langToId) {
    return new Map();
  }

  return new Map(
    Object.entries(langToId)
      .map(([token, id]) => {
        const language = normalizeWhisperLanguageToken(token);
        return [normalizeTokenId(id), language];
      })
      .filter(([id, language]) => id !== null && language),
  );
}

function normalizeWhisperLanguageToken(token) {
  const normalized = String(token ?? "").match(/^<\|?([a-z_]+)\|?>$/i)?.[1];
  return normalized || String(token ?? "").replace(/[<|>]/g, "");
}

function getPreferredWhisperLanguage(preferredLanguage) {
  return UI_LANGUAGE_TO_WHISPER_LANGUAGE[preferredLanguage] ?? "en";
}

function getLanguageDetectionSample(audio) {
  const sampleLength = Math.min(audio.length, ASR_SAMPLE_RATE * LANGUAGE_DETECTION_SECONDS);
  return audio.subarray(0, sampleLength);
}

function isMultilingualWhisper(transcriber) {
  return Boolean(transcriber?.model?.generation_config?.is_multilingual);
}

function createModelLoadProgressCallback(onProgress) {
  const progressByFile = new Map();
  let reportedProgress = 8;

  return (event) => {
    const rawProgress = Number(event?.progress);
    if (!Number.isFinite(rawProgress)) {
      return;
    }

    const fileKey = event.file ?? event.name ?? event.url ?? "__model__";
    progressByFile.set(fileKey, Math.max(0, Math.min(100, rawProgress)));
    const totalProgress = Array.from(progressByFile.values()).reduce((sum, value) => sum + value, 0);
    const averageProgress = totalProgress / progressByFile.size;
    const nextProgress = Math.min(70, Math.max(8, Math.round(8 + averageProgress * 0.62)));
    if (nextProgress <= reportedProgress) {
      return;
    }

    reportedProgress = nextProgress;
    onProgress?.({
      progress: nextProgress,
      phase: `កំពុងទាញយក ឬដំណើរការ ${AUTOMATIC_CAPTION_MODEL_LABEL} ONNX (CPU Local)...`,
    });
  };
}

async function detectWhisperLanguage(transcriber, audio, preferredLanguage, onProgress) {
  const generationConfig = transcriber?.model?.generation_config;
  const fallbackLanguage = getPreferredWhisperLanguage(preferredLanguage);
  if (preferredLanguage && preferredLanguage !== "auto") {
    return { language: fallbackLanguage, detected: false };
  }
  if (!isMultilingualWhisper(transcriber)) {
    return { language: "en", detected: false };
  }

  const languageIdMap = getWhisperLanguageIdMap(transcriber);
  if (!languageIdMap.size) {
    return { language: fallbackLanguage, detected: false };
  }

  const decoderStartTokenId = normalizeTokenId(generationConfig.decoder_start_token_id);
  if (decoderStartTokenId === null) {
    return { language: fallbackLanguage, detected: false };
  }

  try {
    onProgress?.({ progress: 70, phase: "កំពុងវិភាគរកភាសាសំឡេង (Language Detection)..." });
    const sample = getLanguageDetectionSample(audio);
    const features = await transcriber.processor(sample);
    const output = await transcriber.model.generate({
      inputs: features.input_features,
      decoder_input_ids: [decoderStartTokenId],
      max_new_tokens: 1,
      return_timestamps: false,
    });
    const tokenIds = getGeneratedTokenIds(output);
    const languageTokenId = tokenIds.find((token) => token !== decoderStartTokenId && languageIdMap.has(token));
    const language = languageTokenId === undefined ? null : languageIdMap.get(languageTokenId);

    return {
      language: language || fallbackLanguage,
      detected: Boolean(language),
    };
  } catch (error) {
    console.warn("Whisper language detection failed, falling back to preferred language.", error);
    return { language: fallbackLanguage, detected: false };
  }
}

async function getTranscriber(onProgress) {
  if (!transcriberState || transcriberState.modelId !== AUTOMATIC_CAPTION_MODEL_ID) {
    const modelId = AUTOMATIC_CAPTION_MODEL_ID;
    transcriberState = {
      modelId,
      promise: (async () => {
        const { env, pipeline } = await import("@huggingface/transformers");
        env.useBrowserCache = false;
        const reportModelLoadProgress = createModelLoadProgressCallback(onProgress);
        return pipeline("automatic-speech-recognition", modelId, {
          dtype: "q8",
          revision: AUTOMATIC_CAPTION_MODEL_REVISION,
          device: "wasm",
          progress_callback: reportModelLoadProgress,
        });
      })(),
    };
  }

  try {
    return await transcriberState.promise;
  } catch (error) {
    transcriberState = null;
    throw error;
  }
}

function rejectWorkerRequests(error) {
  workerRequests.forEach((request) => {
    request.reject(error);
  });
  workerRequests.clear();
}

function getAsrWorker() {
  if (typeof Worker === "undefined") {
    return null;
  }

  if (asrWorker) {
    return asrWorker;
  }

  asrWorker = new Worker(new URL("../workers/asr.worker.js", import.meta.url), {
    type: "module",
  });

  asrWorker.addEventListener("message", (event) => {
    const message = event.data;
    const request = workerRequests.get(message?.requestId);
    if (!request) {
      return;
    }

    if (message.type === "progress") {
      request.onProgress?.({
        progress: message.progress,
        phase: message.phase,
      });
      return;
    }

    workerRequests.delete(message.requestId);
    if (message.type === "result") {
      request.resolve({
        output: message.output,
        language: message.language,
        languageDetected: Boolean(message.languageDetected),
        modelId: message.modelId,
      });
      return;
    }

    if (message.type === "error") {
      request.reject(new Error(message.error || "ការស្រង់ Subtitles ដោយស្វ័យប្រវត្តិបរាជ័យ"));
    }
  });

  asrWorker.addEventListener("error", (event) => {
    const error = new Error(event.message || "ASR Worker ដំណើរការមិនជោគជ័យ");
    asrWorker?.terminate();
    asrWorker = null;
    rejectWorkerRequests(error);
  });

  return asrWorker;
}

function transcribeAudioInWorker(audio, { onProgress, preferredLanguage, signal, requireWorker = false }) {
  throwIfAborted(signal);
  if (shouldSkipAsrWorker && !requireWorker) {
    return Promise.reject(new Error("បានផ្អាកដំណើរការ ASR Worker ក្នុងជុំនេះ"));
  }

  const worker = getAsrWorker();
  if (!worker) {
    return Promise.reject(new Error("Browser មិនគាំទ្រ Worker សម្រាប់ ASR ទេ។"));
  }

  const requestId = makeId("asr");
  const transferableAudio = audio.slice();
  return new Promise((resolve, reject) => {
    const abort = () => {
      // A terminating cancellation must never fall through to main-thread ASR.
      const error = new DOMException("Cancelled", "AbortError");
      asrWorker?.terminate();
      asrWorker = null;
      rejectWorkerRequests(error);
    };
    const cleanup = () => signal?.removeEventListener("abort", abort);
    workerRequests.set(requestId, {
      resolve: (value) => { cleanup(); resolve(value); },
      reject: (error) => { cleanup(); reject(error); },
      onProgress,
    });
    signal?.addEventListener("abort", abort, { once: true });

    worker.postMessage(
      {
        type: "transcribe",
        requestId,
        modelId: AUTOMATIC_CAPTION_MODEL_ID,
        audioBuffer: transferableAudio.buffer,
        preferredLanguage,
      },
      [transferableAudio.buffer],
    );
  });
}

async function transcribeAudioOnMainThread(audio, { onProgress, preferredLanguage }) {
  const transcriber = await getTranscriber(onProgress);
  const languageResult = await detectWhisperLanguage(transcriber, audio, preferredLanguage, onProgress);
  const languageLabel = WHISPER_LANGUAGE_NAMES[languageResult.language] ?? languageResult.language.toUpperCase();
  onProgress?.({
    progress: 74,
    phase: `${languageResult.detected ? "បានរកឃើញភាសា" : "តាមភាសា"} ${languageLabel} — កំពុងស្រង់ Subtitles...`,
  });
  const transcriptionOptions = {
    chunk_length_s: 30,
    max_new_tokens: 224,
    no_repeat_ngram_size: 3,
    repetition_penalty: 1.15,
    stride_length_s: 5,
    return_timestamps: "word",
  };
  if (isMultilingualWhisper(transcriber)) {
    transcriptionOptions.language = languageResult.language;
    transcriptionOptions.task = "transcribe";
  }
  const output = await transcriber(audio, transcriptionOptions);

  return {
    output,
    language: languageResult.language,
    languageDetected: languageResult.detected,
    modelId: AUTOMATIC_CAPTION_MODEL_ID,
    source: "main",
  };
}

function getTranscriptText(output) {
  const chunkText = Array.isArray(output?.chunks)
    ? output.chunks.map((chunk) => chunk?.text ?? "").join("")
    : "";
  return String(chunkText || output?.text || "").replace(/\s+/g, "");
}

function countPattern(text, pattern) {
  return text.match(pattern)?.length ?? 0;
}

function isSuspiciousChineseTranscript(output) {
  const text = getTranscriptText(output);
  const visibleCount = countPattern(text, /[^\s]/g);
  if (visibleCount < CHINESE_VISIBLE_CHAR_THRESHOLD) {
    return false;
  }

  const cjkCount = countPattern(text, /[\u3400-\u9fff]/g);
  const latinCount = countPattern(text, /[A-Za-zÀ-ÖØ-öø-ÿ]/g);
  const latinRatio = latinCount / visibleCount;
  const cjkRatio = cjkCount / visibleCount;
  const hasLongLatinRun = /[A-Za-zÀ-ÖØ-öø-ÿ]{12,}/.test(text);

  return cjkCount === 0 || (latinRatio > 0.45 && cjkRatio < 0.2) || hasLongLatinRun;
}

function isSuspiciousTranscript(output, language, preferredLanguage) {
  const text = getTranscriptText(output) || "";
  if (/singing in foreign language|\[music\]|\(music\)|\(upbeat music\)/i.test(text)) return true;
  const expectedLanguage = language || getPreferredWhisperLanguage(preferredLanguage);
  if (expectedLanguage === "km" && !/[\u1780-\u17ff]/.test(text) && text.trim().length > 0) return true;
  return expectedLanguage === "zh" && isSuspiciousChineseTranscript(output);
}

function resetAsrWorker() {
  asrWorker?.terminate();
  asrWorker = null;
  workerRequests.clear();
}

async function runTranscription(
  blob,
  { onProgress, preferredLanguage = "en", timelineOffset = 0, grouping = "phrases", signal, requireWorker = false } = {},
) {
  throwIfAborted(signal);
  onProgress?.({ progress: 5, phase: "កំពុងឌិកូដសំឡេង (Decoding Audio)..." });
  const { audio, duration } = await decodeAudioForAsr(blob);
  throwIfAborted(signal);
  if (!audio.length || !duration) {
    throw new Error("មិនមានសំឡេងដែលអាចស្រង់ Transcript បានទេ។");
  }

  let result;
  try {
    result = await transcribeAudioInWorker(audio, { onProgress, preferredLanguage, signal, requireWorker });
    result.source = "worker";
  } catch (error) {
    throwIfAborted(signal);
    if (error?.name === "AbortError" || requireWorker) throw error;
    console.warn("ASR worker failed, falling back to main thread.", error);
    onProgress?.({ progress: 8, phase: "កំពុងដំណើរការលើ Main Thread..." });
    result = await transcribeAudioOnMainThread(audio, { onProgress, preferredLanguage });
  }
  throwIfAborted(signal);

  if (result.source === "worker" && isSuspiciousTranscript(result.output, result.language, preferredLanguage)) {
    // Agent jobs require a cancellable Worker. Preserve the normal UI fallback,
    // but never start uncancellable inference after a reviewed Worker-only plan.
    if (requireWorker) throw new Error("ASR_UNRELIABLE_TRANSCRIPT");
    console.warn("ASR worker returned a suspicious transcript, retrying on the WASM main thread.", result.output);
    shouldSkipAsrWorker = true;
    resetAsrWorker();
    onProgress?.({ progress: 78, phase: "កំពុងប្តូរទៅ WASM CPU ស្ថិរភាពឡើងវិញ..." });
    result = await transcribeAudioOnMainThread(audio, { onProgress, preferredLanguage });
  }
  throwIfAborted(signal);

  if (isSuspiciousTranscript(result.output, result.language, preferredLanguage)) {
    throw new Error("ការស្រង់សំឡេងមិនទាន់ច្បាស់លាស់ សូមសាកល្បងម្តងទៀត។");
  }

  let segments = [];
  try {
    segments = captionSegmentsFromWords(result.output?.chunks, duration, {
      timelineOffset,
      grouping,
      normalizeText: (text) => normalizeAsrText(text, result.language),
    });
  } catch (timingErr) {
    console.warn("Word-level timing unavailable, using sentence/phrase chunking fallback:", timingErr);
    const rawText = getTranscriptText(result.output) || "";
    if (rawText.trim()) {
      const phrases = rawText
        .split(/(?<=[.!?。！？\n])\s+/)
        .map((p) => normalizeAsrText(p, result.language).trim())
        .filter(Boolean);
      const count = Math.max(1, phrases.length);
      const pieceDuration = duration / count;
      segments = phrases.map((text, idx) => ({
        id: makeId("caption"),
        text,
        start: Number((timelineOffset + idx * pieceDuration).toFixed(2)),
        end: Number((timelineOffset + (idx + 1) * pieceDuration).toFixed(2)),
      }));
    }
  }

  if (!segments.length) {
    throw new Error("មិនមាន Subtitles ត្រូវបានស្រង់ឃើញទេ។");
  }

  onProgress?.({ progress: 96, phase: "កំពុងបញ្ចូល Subtitles ទៅក្នុង Timeline..." });
  return {
    segments,
    text: segments.map((segment) => segment.text).join("\n"),
    duration,
    language: result.language,
    languageDetected: result.languageDetected,
  };
}

async function prepareAudioBlobForStt(blob) {
  try {
    const { audio, duration } = await decodeAudioForAsr(blob);
    if (!audio?.length || !duration) return blob;
    const pcmBytes = new Int16Array(audio.length);
    for (let i = 0; i < audio.length; i++) {
      const s = Math.max(-1, Math.min(1, audio[i]));
      pcmBytes[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    const numChannels = 1;
    const sampleRate = 16000;
    const byteRate = sampleRate * numChannels * 2;
    const blockAlign = numChannels * 2;
    const buffer = new ArrayBuffer(44 + pcmBytes.byteLength);
    const view = new DataView(buffer);

    view.setUint32(0, 0x52494646, false); // "RIFF"
    view.setUint32(4, 36 + pcmBytes.byteLength, true);
    view.setUint32(8, 0x57415645, false); // "WAVE"
    view.setUint32(12, 0x666d7420, false); // "fmt "
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);
    view.setUint32(36, 0x64617461, false); // "data"
    view.setUint32(40, pcmBytes.byteLength, true);

    new Uint8Array(buffer, 44).set(new Uint8Array(pcmBytes.buffer));
    return new Blob([buffer], { type: "audio/wav" });
  } catch (err) {
    console.warn("Audio pre-encoding for STT fallback to original blob:", err);
    return blob;
  }
}

async function tryLocalAiBackendStt(blob, { preferredLanguage = "auto", timelineOffset = 0, onProgress, signal } = {}) {
  throwIfAborted(signal);
  onProgress?.({ progress: 10, phase: "កំពុងរៀបចំ និងបង្ហាប់សំឡេងសម្រាប់ AI Analysis..." });
  const uploadBlob = await prepareAudioBlobForStt(blob);
  throwIfAborted(signal);

  onProgress?.({ progress: 18, phase: "កំពុងភ្ជាប់ទៅកាន់ Local AI STT Service..." });
  const formData = new FormData();
  formData.append("file", uploadBlob, "timeline_audio.wav");
  formData.append("language", preferredLanguage || "auto");

  const isKhmer = preferredLanguage === "km" || preferredLanguage === "auto";
  const modelName = isKhmer ? "Khmer Turbo STT (AI Local)" : `Whisper (${preferredLanguage.toUpperCase()})`;

  onProgress?.({ progress: 28, phase: `កំពុងដំណើរការ ${modelName}...` });

  // Dynamic smooth progress ticker to avoid getting stuck visually at 28%
  let currentProgress = 28;
  const progressPhases = [
    { at: 35, text: `កំពុងដំណើរការ ${modelName}...` },
    { at: 48, text: "AI កំពុងវិភាគរលកសំឡេង និងស្រង់ពាក្យសម្ដី..." },
    { at: 64, text: "កំពុងបំប្លែងសំឡេងជាអក្សរ និងពិនិត្យវេយ្យាករណ៍..." },
    { at: 78, text: "កំពុងរៀបចំចង្វាក់ Subtitle Segments និង Timestamps..." },
    { at: 88, text: "កំពុងបញ្ចប់ការស្រង់ Subtitles ដោយជោគជ័យ..." },
  ];

  const progressInterval = setInterval(() => {
    if (currentProgress < 90) {
      currentProgress += 1.5;
      const rounded = Math.round(currentProgress);
      const phaseObj = [...progressPhases].reverse().find((p) => rounded >= p.at) || progressPhases[0];
      onProgress?.({ progress: rounded, phase: phaseObj.text });
    }
  }, 350);

  let response;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000); // 180s safe timeout
    const onAbort = () => controller.abort();
    if (signal) {
      signal.addEventListener("abort", onAbort, { once: true });
    }

    try {
      response = await fetch("/api/v1/stt", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
      if (signal) {
        signal.removeEventListener("abort", onAbort);
      }
    }
  } finally {
    clearInterval(progressInterval);
  }

  if (!response.ok) {
    throw new Error(`Local AI STT response status: ${response.status}`);
  }

  const data = await response.json();
  let rawSegments = Array.isArray(data.segments) ? data.segments : [];

  // Fallback splitting if empty segments or just 1 very long segment
  if (rawSegments.length === 0 && data.text?.trim()) {
    const text = data.text.trim();
    // Split on punctuation or spaces
    const phrases = text
      .split(/(?<=[.!?。！？\n])\s+|(?<=[,，;；])\s+/)
      .map((p) => p.trim())
      .filter(Boolean);
    const dur = data.duration || 5;
    const piece = dur / Math.max(1, phrases.length);
    rawSegments = phrases.map((t, idx) => ({
      start: idx * piece,
      end: (idx + 1) * piece,
      text: t,
    }));
  }

  // If a single long segment exists, split into smaller subtitle cards
  if (rawSegments.length === 1 && rawSegments[0].end - rawSegments[0].start > 4.5) {
    const s = rawSegments[0];
    const words = (s.text || "").split(/\s+/).filter(Boolean);
    if (words.length > 5) {
      const chunkSize = 4;
      const numChunks = Math.ceil(words.length / chunkSize);
      const chunkDur = (s.end - s.start) / numChunks;
      const newSegments = [];
      for (let i = 0; i < words.length; i += chunkSize) {
        const slice = words.slice(i, i + chunkSize);
        const idx = i / chunkSize;
        newSegments.push({
          start: s.start + idx * chunkDur,
          end: Math.min(s.end, s.start + (idx + 1) * chunkDur),
          text: slice.join(" "),
        });
      }
      rawSegments = newSegments;
    }
  }

  if (rawSegments.length === 0) {
    throw new Error("Local AI STT returned empty transcription");
  }

  onProgress?.({ progress: 95, phase: "កំពុងបញ្ចូល Subtitles ទៅក្នុង Timeline..." });
  const isAudioTag = (t) => /^[\(\[\{].*?(?:music|singing|applause|cheering|sound).*?[\)\]\}]$/i.test(String(t).trim());
  const segments = rawSegments
    .filter((s) => !isAudioTag(s.text || ""))
    .map((s) => ({
      id: makeId("caption"),
      start: Number((timelineOffset + (s.start || 0)).toFixed(2)),
      end: Number((timelineOffset + (s.end || (s.start + 2))).toFixed(2)),
      text: normalizeAsrText(s.text?.trim() || "", data.detected_language || preferredLanguage),
    })).filter((s) => s.text);

  return {
    segments,
    text: segments.map((s) => s.text).join("\n"),
    duration: data.duration || 0,
    language: data.detected_language || preferredLanguage,
    languageDetected: Boolean(data.detected_language),
    model: isKhmer ? "Khmer Turbo STT (Local AI)" : "Local AI Whisper",
  };
}

export async function transcribeAudioToCaptionSegments(blob, options = {}) {
  if (transcriptionActive) throw Object.assign(new Error("EDITOR_BUSY"), { code: "EDITOR_BUSY" });
  transcriptionActive = true;
  try {
    try {
      return await tryLocalAiBackendStt(blob, options);
    } catch (backendError) {
      if (options.signal?.aborted) throw backendError;
      console.warn("Local AI backend STT unavailable, using in-browser Whisper fallback:", backendError);
      options.onProgress?.({ progress: 10, phase: "Local AI មិនទាន់ឆ្លើយតប — ប្តូរទៅកាន់ In-Browser Local Whisper..." });
      return await runTranscription(blob, options);
    }
  } finally {
    transcriptionActive = false;
  }
}

