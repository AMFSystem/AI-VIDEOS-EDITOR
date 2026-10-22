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

function normalizeAsrText(text, language) {
  const normalized = normalizeAsrWhitespace(text, language);
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
  const expectedLanguage = language || getPreferredWhisperLanguage(preferredLanguage);
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

export async function transcribeAudioToCaptionSegments(blob, options = {}) {
  if (transcriptionActive) throw Object.assign(new Error("EDITOR_BUSY"), { code: "EDITOR_BUSY" });
  transcriptionActive = true;
  try {
    return await runTranscription(blob, options);
  } finally {
    transcriptionActive = false;
  }
}
