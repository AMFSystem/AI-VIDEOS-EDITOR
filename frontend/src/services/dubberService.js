/**
 * Dubber Service (Frontend)
 * Coordinates Story & Movie Translation and Voice Dubbing with Cloned Voices
 */

import { apiRequest } from "./apiClient.js";
import { getStoredGeminiKey } from "../lib/geminiRuntime.js";
import { synthesizeWithGemini } from "../lib/geminiRuntime.js";
import { synthesizeWithVoxCpm } from "../lib/voxcpmRuntime.js";
import { synthesizeWithElevenLabs, getStoredElevenLabsKey } from "../lib/elevenlabsRuntime.js";
import { synthesizeBaseVoice } from "../lib/baseVoiceSynthesis.js";
import { convertVoiceBlob } from "../lib/openVoiceRuntime.js";
import { VOICES } from "../config/editor.js";
import { transcribeAudioToCaptionSegments } from "../lib/asr.js";
import { extractAudioFromVideo } from "../lib/media.js";

/**
 * Robust JSON parser handling markdown backticks, trailing commas, and wrapping text
 */
function extractJsonFromText(rawText) {
  if (!rawText) return null;
  const cleaned = rawText.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch (e1) {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (e2) {
        try {
          const repaired = match[0].replace(/,\s*([\}\]])/g, "$1");
          return JSON.parse(repaired);
        } catch {}
      }
    }
  }
  return null;
}

/**
 * Checks if string contains Khmer characters (Unicode \u1780-\u17ff)
 */
function containsKhmer(str) {
  return /[\u1780-\u17ff]/.test(str || "");
}

/**
 * Fast, non-blocking Base64 converter for Audio Blobs
 */
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = reader.result;
      if (typeof res === "string") {
        const base64 = res.includes(",") ? res.split(",")[1] : res;
        resolve(base64);
      } else {
        reject(new Error("Failed to convert blob to base64"));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Encode Float32Array PCM samples to 16kHz 16-bit Mono WAV Blob
 * Creates an ultra-compact ~1.9 MB/minute file that uploads and processes in seconds!
 */
function encodeWav16kMono(samples) {
  const sampleRate = 16000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // Write ASCII string helper
  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // Subchunk1Size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  // Convert float (-1.0 .. 1.0) to 16-bit int
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([buffer], { type: "audio/wav" });
}

/**
 * Extract audio from video optimized for ASR & AI Dubbing (16kHz Mono WAV)
 * Super fast using Web Audio API; falls back to ffmpeg if needed.
 */
export async function extractOptimizedAudioForDubbing(fileOrBlob) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (AudioContextClass) {
    try {
      const audioCtx = new AudioContextClass({ sampleRate: 16000 });
      try {
        const arrayBuf = await fileOrBlob.arrayBuffer();
        const decoded = await audioCtx.decodeAudioData(arrayBuf.slice(0));
        const numChannels = decoded.numberOfChannels;
        const length = decoded.length;

        // Downmix to mono
        const mono = new Float32Array(length);
        if (numChannels === 1) {
          mono.set(decoded.getChannelData(0));
        } else {
          const left = decoded.getChannelData(0);
          const right = decoded.getChannelData(1);
          for (let i = 0; i < length; i++) {
            mono[i] = (left[i] + right[i]) * 0.5;
          }
        }

        const wavBlob = encodeWav16kMono(mono);
        return wavBlob;
      } finally {
        await audioCtx.close().catch(() => {});
      }
    } catch (e) {
      console.warn("Web Audio direct decode failed, falling back to ffmpeg:", e);
    }
  }

  // Fallback: ffmpeg extraction
  return await extractAudioFromVideo(fileOrBlob, fileOrBlob.name || "input.mp4");
}

export const dubberService = {
  /**
   * Fast audio extraction helper
   */
  extractOptimizedAudio: extractOptimizedAudioForDubbing,

  /**
   * Translate text using Google Translate API (Free, high accuracy, standard Google Translation)
   * @param {object} params
   * @param {string} params.text
   * @param {string} [params.sourceLang="auto"]
   * @param {string} [params.targetLang="km"]
   * @returns {Promise<{ translatedText: string, segments: Array<{ index: number, text: string }>, detectedLanguage: string, model: string }>}
   */
  async translateWithGoogle({ text, sourceLang = "auto", targetLang = "km" }) {
    if (!text || !text.trim()) {
      return { translatedText: "", segments: [], detectedLanguage: sourceLang, model: "google-translate" };
    }

    const sl = sourceLang === "auto" ? "auto" : sourceLang;
    const tl = targetLang || "km";

    // 1. Try Backend Google Translate Proxy first
    try {
      const res = await apiRequest("/api/dubber/google-translate", {
        method: "POST",
        body: JSON.stringify({ text, sourceLang: sl, targetLang: tl }),
      });
      if (res && res.translatedText) {
        return res;
      }
    } catch (backendErr) {
      console.warn("Backend Google Translate unavailable, trying client-side fetch:", backendErr);
    }

    // 2. Direct Client-side fetch to Google Translate API
    try {
      const url = "https://translate.googleapis.com/translate_a/single";
      const params = new URLSearchParams({
        client: "gtx",
        sl,
        tl,
        dt: "t",
        q: text.trim(),
      });

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
        },
        body: params.toString(),
      });

      if (response.ok) {
        const data = await response.json();
        const rawSegments = data?.[0] || [];
        const translatedText = rawSegments.map((item) => (item && item[0] ? item[0] : "")).join("");
        const detectedLanguage = data?.[2] || sl;
        const rawLines = translatedText.split(/\n+/).map((l) => l.trim()).filter(Boolean);
        const segments = rawLines.map((line, idx) => ({ index: idx + 1, text: line }));

        return {
          translatedText,
          detectedLanguage,
          segments,
          model: "google-translate",
        };
      }
    } catch (clientErr) {
      console.error("Client Google Translate fetch error:", clientErr);
    }

    throw new Error("ការបកប្រែតាម Google Translation មិនជោគជ័យ សូមពិនិត្យមើលអ៊ីនធឺណិត");
  },

  /**
   * Translate Story or Movie Dialogue into expressive Khmer narration text
   * @param {object} params
   * @param {string} params.text
   * @param {string} [params.sourceLang="auto"]
   * @param {string} [params.targetLang="km"]
   * @param {string} [params.style="cinematic_story"]
   * @param {string} [params.apiKey]
   * @param {string} [params.model="gemini-2.0-flash"]
   * @returns {Promise<{ translatedText: string, segments: Array<{ index: number, text: string }>, model: string }>}
   */
  async translateStory({
    text,
    sourceLang = "auto",
    targetLang = "km",
    style = "cinematic_story",
    apiKey = "",
    model = "gemini-2.0-flash",
  }) {
    // If Google Translate model or no API key, use official Google Translate directly!
    if (model === "google-translate" || style === "google_standard" || (!apiKey && !getStoredGeminiKey())) {
      return await dubberService.translateWithGoogle({ text, sourceLang, targetLang });
    }

    const key = apiKey || getStoredGeminiKey();

    // 1. Attempt backend translation first
    try {
      const res = await apiRequest("/api/dubber/translate", {
        method: "POST",
        body: JSON.stringify({
          text,
          sourceLang,
          targetLang,
          style,
          apiKey: key,
          model,
        }),
      });
      if (res && res.translatedText) {
        return res;
      }
    } catch (backendErr) {
      console.warn("Backend dubber translation unavailable, trying client-side fallback:", backendErr);
    }

    // 2. Direct Client-side Translation Fallback
    const stylePrompts = {
      cinematic_story: "អ្នកបញ្ចូលសំឡេង និងនិទានរឿងភាពយន្ត (Cinematic Movie Dubbing & Storytelling): ប្រើប្រាស់ពាក្យពេចន៍ទាក់ទាញ អណ្តែតអណ្តូង សមស្របនឹងការបញ្ចូលសំឡេងរឿងកុន ឬរឿងនិទានប្រលោមលោក។ ប្រើពាក្យសន្ទនារស់រវើក មិនរឹងកន្ត្រាក់ មិនបកប្រែពាក្យមួយៗតាមរបៀបម៉ាស៊ីនឡើយ។",
      dialogue: "សន្ទនាតួអង្គជាក់ស្តែង (Natural Character Dialogue): រក្សាទម្រង់នៃការសន្ទនារវាងតួអង្គ មានអារម្មណ៍រស់រវើក ធម្មជាតិ ដូចមនុស្សពិតកំពុងជជែកគ្នាក្នុងជីវិតជាក់ស្តែង។ ប្រើសព្វនាម (ខ្ញុំ, ឯង, បង, អូន, លោក...) ឱ្យត្រូវនឹងបរិបទ។",
      documentary: "អត្ថាធិប្បាយឯកសារ និងព័ត៌មាន (Documentary & Educational Narration): ប្រើប្រាស់ពាក្យពេចន៍ច្បាស់ៗ ផ្លូវការ សុភាពរាបសារ និងគួរឱ្យទុកចិត្ត។",
      dramatic: "មនោសញ្ចេតនា និងរំជួលចិត្ត (Emotional & Dramatic): ប្រើប្រាស់ពាក្យពេចន៍បង្ហាញពីមនោសញ្ចេតនាក្តុកក្តួល កម្សត់ ឬរំភើបយ៉ាងស៊ីជម្រៅ ឱ្យស្របតាមអារម្មណ៍តួអង្គក្នុងរឿង។",
    };

    const chosenStylePrompt = stylePrompts[style] || stylePrompts.cinematic_story;

    const tlNames = {
      km: "Khmer (ភាសាខ្មែរ)", en: "English", zh: "Chinese (中文)", th: "Thai (ภาษาไทย)",
      ko: "Korean (한국어)", ja: "Japanese (日本語)", vi: "Vietnamese (Tiếng Việt)",
      fr: "French (Français)", es: "Spanish (Español)", de: "German (Deutsch)",
      pt: "Portuguese (Português)", ru: "Russian (русский)", ar: "Arabic (عربي)",
      hi: "Hindi (हिन्दी)", id: "Indonesian (Bahasa Indonesia)", ms: "Malay (Bahasa Melayu)",
      tl: "Filipino (Tagalog)", my: "Burmese (မြန်មាဘာသာ)", lo: "Lao (ລາវ)",
    };
    const targetLangFullName = tlNames[targetLang] || targetLang;

    const isTargetKhmer = targetLang === "km";
    const khmerRules = isTargetKhmer
      ? `\nSPECIAL KHMER DUBBING & ORTHOGRAPHY RULES:
- Translate into natural Cambodian cinematic dubbing style (ភាសាបញ្ចូលសំឡេងរឿងកុនរស់រវើក មិនរឹងកន្ត្រាក់ មិនបកប្រែពាក្យមួយៗដូចម៉ាស៊ីន)។
- Khmer words MUST be written together without inserting spaces between every word (ភាសាខ្មែរមិនដកឃ្លារវាងពាក្យឡើយ)។
- Only insert a space between clauses, phrases, or distinct thoughts (ដកឃ្លាតែពេលចប់ឃ្លា ឬរបះ)។
- End complete thoughts or sentences with the Khmer full-stop '។' (សញ្ញាខណ្ឌ)។
- Preserve line breaks exactly so each input line corresponds to one output line.`
      : "";

    const systemInstruction = `You are a professional movie subtitle translator and video dubber.
Your ONLY task is to translate the given text into ${targetLangFullName}.

CRITICAL RULES:
1. Output ONLY the translated text in ${targetLangFullName}. Do NOT include original text or explanations.
2. Do NOT mix languages. Do NOT leave foreign words untranslated unless they are proper names.
3. Keep the exact same number of lines/paragraphs as the input text.
4. Style: ${chosenStylePrompt}${khmerRules}
5. Do NOT add meta commentary or markdown codeblocks.`;

    // Case A: OpenAI API (sk-...)
    if (key.startsWith("sk-") && !key.startsWith("sk-ant-") && (model === "openai-gpt4o" || model.startsWith("gpt-"))) {
      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: systemInstruction },
              { role: "user", content: `Translate this text to ${targetLangFullName}:\n\n${text.trim()}` },
            ],
            temperature: 0.3,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const translated = data?.choices?.[0]?.message?.content?.trim();
          if (translated) {
            const rawLines = translated.split(/\n+/).map((l) => l.trim()).filter(Boolean);
            const segments = rawLines.map((line, idx) => ({ index: idx + 1, text: line }));
            return { translatedText: translated, segments, model: "gpt-4o" };
          }
        }
      } catch (err) {
        console.warn("Client OpenAI translation error:", err);
      }
    }

    // Case B: DeepSeek API
    if (model === "deepseek-v3" || (key.startsWith("sk-") && model.includes("deepseek"))) {
      try {
        const response = await fetch("https://api.deepseek.com/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: [
              { role: "system", content: systemInstruction },
              { role: "user", content: `Translate this text to ${targetLangFullName}:\n\n${text.trim()}` },
            ],
            temperature: 0.3,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const translated = data?.choices?.[0]?.message?.content?.trim();
          if (translated) {
            const rawLines = translated.split(/\n+/).map((l) => l.trim()).filter(Boolean);
            const segments = rawLines.map((line, idx) => ({ index: idx + 1, text: line }));
            return { translatedText: translated, segments, model: "deepseek-chat" };
          }
        }
      } catch (err) {
        console.warn("Client DeepSeek translation error:", err);
      }
    }

    // Case C: Google Gemini (Default & Most Capable for Khmer)
    const candidateModels = Array.from(new Set([
      model && model.startsWith("gemini-") && !model.includes("2.5") ? model : "gemini-2.0-flash",
      "gemini-2.0-flash",
      "gemini-1.5-flash",
      "gemini-1.5-pro",
    ])).filter((m) => m && m.startsWith("gemini-") && !m.includes("2.5"));

    let lastError = null;
    for (const m of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`;
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemInstruction }] },
            contents: [{ parts: [{ text: `Translate the following to ${targetLangFullName}. Output ONLY ${targetLangFullName}:\n\n"""\n${text}\n"""` }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 8192 },
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          lastError = new Error(errData?.error?.message || `HTTP ${response.status}`);
          continue;
        }

        const data = await response.json();
        const translated = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!translated) continue;

        const cleanTranslated = translated.trim();
        const segments = cleanTranslated
          .split(/\n+/)
          .map((l) => l.trim())
          .filter(Boolean)
          .map((line, idx) => ({ index: idx + 1, text: line }));

        return {
          translatedText: cleanTranslated,
          segments,
          model: m,
        };
      } catch (err) {
        lastError = err;
      }
    }

    // Graceful fallback to Google Translate if Gemini fails
    try {
      console.warn("Gemini client translation failed, falling back to Google Translate...");
      return await dubberService.translateWithGoogle({ text, sourceLang, targetLang });
    } catch (gErr) {
      throw lastError || gErr || new Error("ការបកប្រែសាច់រឿងបរាជ័យគ្រប់ម៉ូដែល");
    }
  },

  /**
   * Translate existing Timeline Caption Segments with 1:1 Index Matching
   * Batches in chunks of 30 items for high stability with 100+ lines!
   * Preserves exact timestamps for each subtitle!
   */
  async translateCaptionSegments({
    segments = [],
    sourceLang = "auto",
    targetLang = "km",
    style = "cinematic_story",
    apiKey = "",
    model = "gemini-2.5-flash",
    onProgress = () => {},
  }) {
    if (!segments || segments.length === 0) return segments;

    const BATCH_SIZE = 30;
    const totalBatches = Math.ceil(segments.length / BATCH_SIZE);
    const updatedSegments = [...segments];

    for (let b = 0; b < totalBatches; b++) {
      const startIndex = b * BATCH_SIZE;
      const batch = segments.slice(startIndex, startIndex + BATCH_SIZE);

      onProgress?.({
        progress: Math.round(((b + 1) / totalBatches) * 100),
        phase: `កំពុងបកប្រែ Subtitles ឃ្លាទី ${startIndex + 1} ដល់ ${Math.min(startIndex + BATCH_SIZE, segments.length)} (${b + 1}/${totalBatches})...`,
      });

      const numberedText = batch
        .map((seg, idx) => `[${startIndex + idx + 1}] ${(seg.text || "").replace(/\n/g, " ").trim()}`)
        .join("\n");

      const promptText = `You are a professional movie subtitle translator into Khmer (ភាសាខ្មែរ).
Translate the following numbered subtitle lines from their original language into natural, cinematic Khmer (ភាសាខ្មែរ).

CRITICAL STRICT RULES:
1. Every single line MUST be translated into natural KHMER (ភាសាខ្មែរ).
2. DO NOT leave ANY Chinese, English, or foreign characters (绝对不允许保留任何中文字符). All text MUST be in Khmer script (អក្សរខ្មែរ).
3. Keep the EXACT same line numbers [${startIndex + 1}], [${startIndex + 2}]... at the beginning of each translated line.
4. Khmer orthography: write words together without spaces between individual words. End sentences with '។'.
5. Output ONLY the numbered translated lines. No other text or explanations.

Subtitle Lines:
${numberedText}`;

      try {
        const res = await dubberService.translateStory({
          text: promptText,
          sourceLang,
          targetLang,
          style,
          apiKey,
          model,
        });

        if (res?.translatedText) {
          const lines = res.translatedText.split(/\n+/);
          for (const line of lines) {
            const match = line.match(/^\[(\d+)\]\s*(.*)$/);
            if (match) {
              const num = parseInt(match[1], 10);
              const transText = match[2]?.trim();
              const targetIdx = num - 1;
              if (targetIdx >= startIndex && targetIdx < startIndex + batch.length && transText) {
                updatedSegments[targetIdx] = {
                  ...updatedSegments[targetIdx],
                  text: transText,
                };
              }
            }
          }
        }
      } catch (batchErr) {
        console.warn(`Translation batch ${b + 1} error:`, batchErr);
        if (totalBatches === 1) throw batchErr;
      }
    }

    return updatedSegments;
  },

  /**
   * Transcribe Video Audio directly and Translate to Khmer Subtitles & Script
   */
  async transcribeAndTranslateMedia({
    audioBlob,
    sourceLang = "auto",
    targetLang = "km",
    style = "cinematic_story",
    engine = "gemini-2.0-flash",
    apiKey = "",
    onProgress,
  }) {
    // 1. If Local Computer Engine or Google Translate is selected:
    if (engine === "local-whisper" || engine === "local-offline" || engine === "google-translate") {
      onProgress?.({ progress: 10, phase: "កំពុងស្រង់ Transcript លើកុំព្យូទ័រ (Local Whisper)..." });
      const asrResult = await transcribeAudioToCaptionSegments(audioBlob, {
        preferredLanguage: sourceLang !== "auto" ? sourceLang : "en",
        onProgress: (p) => onProgress?.({ progress: p.progress || 30, phase: p.phase }),
      });

      const asrSegments = asrResult.segments || [];
      const rawTranscript = asrResult.text || asrSegments.map((s) => s.text).join(" ");
      let subtitles = [];
      let translatedText = rawTranscript;
      let translationSucceeded = false;
      let translationError = null;

      // Translate to Khmer/Target Language
      if (asrSegments.length > 0) {
        const transEngine = engine === "google-translate" ? "google-translate" : (apiKey ? engine : "google-translate");
        onProgress?.({
          progress: 80,
          phase: transEngine === "google-translate"
            ? "កំពុងបកប្រែ Subtitles តាម Google Translation ត្រឹមត្រូវ 100%..."
            : "កំពុងបកប្រែ Subtitles តាម AI...",
        });

        try {
          const translatedSegs = await dubberService.translateCaptionSegments({
            segments: asrSegments,
            sourceLang,
            targetLang,
            style,
            apiKey,
            model: transEngine,
            onProgress,
          });

          if (translatedSegs && translatedSegs.length > 0) {
            subtitles = translatedSegs.map((seg, i) => ({
              start: seg.start,
              end: seg.end,
              original: asrSegments[i]?.text || seg.text,
              khmer: seg.text,
            }));
            translatedText = translatedSegs.map((s) => s.text).join("\n");
            translationSucceeded = true;
          }
        } catch (trErr) {
          console.warn("Translation after local Whisper error, falling back to Google Translate:", trErr);
          try {
            const fallbackSegs = await dubberService.translateCaptionSegments({
              segments: asrSegments,
              sourceLang,
              targetLang,
              style: "google_standard",
              model: "google-translate",
              onProgress,
            });
            if (fallbackSegs && fallbackSegs.length > 0) {
              subtitles = fallbackSegs.map((seg, i) => ({
                start: seg.start,
                end: seg.end,
                original: asrSegments[i]?.text || seg.text,
                khmer: seg.text,
              }));
              translatedText = fallbackSegs.map((s) => s.text).join("\n");
              translationSucceeded = true;
            }
          } catch (fbErr) {
            translationError = fbErr?.message || String(fbErr);
          }
        }
      }

      if (!translationSucceeded) {
        subtitles = asrSegments.map((seg) => ({
          start: seg.start,
          end: seg.end,
          original: seg.text,
          khmer: seg.text,
        }));
      }

      return {
        originalTranscript: rawTranscript,
        detectedLanguage: asrResult.language || sourceLang || "auto",
        translatedKhmerText: translatedText,
        translationSucceeded,
        translationError,
        subtitles,
      };
    }

    // 2. Cloud AI Engines with API Key
    const key = apiKey || getStoredGeminiKey();
    if (!key && engine !== "google-translate") {
      throw new Error(`សូមភ្ជាប់ API Key សម្រាប់ ${engine} ដើម្បីដំណើរការបកប្រែ`);
    }

    // If audio is large (>15MB), directly use Local Whisper for ASR to avoid Gemini 20MB inlineData overflow!
    if (audioBlob.size > 15 * 1024 * 1024) {
      onProgress?.({ progress: 15, phase: "វីដេអូធំ: កំពុងស្រង់សំឡេងតាម Local Whisper ល្បឿនលឿន..." });
      const asrResult = await transcribeAudioToCaptionSegments(audioBlob, {
        preferredLanguage: sourceLang !== "auto" ? sourceLang : "en",
        onProgress: (p) => onProgress?.({ progress: p.progress || 35, phase: p.phase }),
      });

      const asrSegments = asrResult.segments || [];
      const rawTranscript = asrResult.text || asrSegments.map((s) => s.text).join(" ");
      onProgress?.({ progress: 75, phase: "កំពុងបកប្រែសាច់រឿងទៅជាភាសាខ្មែរ..." });

      const translatedSegs = await dubberService.translateCaptionSegments({
        segments: asrSegments,
        sourceLang,
        targetLang,
        style,
        apiKey: key,
        model: engine,
        onProgress,
      });

      const subtitles = translatedSegs.map((seg, i) => ({
        start: seg.start,
        end: seg.end,
        original: asrSegments[i]?.text || seg.text,
        khmer: seg.text,
      }));
      const translatedKhmerText = translatedSegs.map((s) => s.text).join("\n");

      return {
        originalTranscript: rawTranscript,
        detectedLanguage: asrResult.language || sourceLang || "auto",
        translatedKhmerText,
        subtitles,
      };
    }

    // Convert audio blob to base64
    onProgress?.({ progress: 15, phase: "កំពុងរៀបចំទិន្នន័យសំឡេង (Optimizing Audio)..." });
    const audioBase64 = await blobToBase64(audioBlob);
    const mimeType = audioBlob.type || "audio/wav";

    // Attempt backend first
    try {
      onProgress?.({ progress: 35, phase: "កំពុងស្រង់ Transcript & បកប្រែតាម Server AI..." });
      const res = await apiRequest("/api/dubber/transcribe-translate", {
        method: "POST",
        body: JSON.stringify({
          audioBase64,
          mimeType,
          sourceLang,
          targetLang,
          style,
          apiKey: key,
          model: engine,
        }),
      });
      if (res && (res.translatedKhmerText || res.subtitles)) {
        return res;
      }
    } catch (backendErr) {
      console.warn("Backend transcribe-translate failed, falling back to direct Client Gemini:", backendErr);
    }

    // Client Gemini direct fallback
    onProgress?.({ progress: 50, phase: "កំពុងដំណើរការ Gemini 2.0 Flash Multimodal Audio..." });
    const tlNames = {
      km: "Khmer (ភាសាខ្មែរ)", en: "English", zh: "Chinese (中文)", th: "Thai (ภาษาไทย)",
      ko: "Korean (한국어)", ja: "Japanese (日本語)", vi: "Vietnamese (Tiếng Việt)",
      fr: "French (Français)", es: "Spanish (Español)", de: "German (Deutsch)",
      pt: "Portuguese (Português)", ru: "Russian (русский)", ar: "Arabic (عربي)",
      hi: "Hindi (हिन्दी)", id: "Indonesian (Bahasa Indonesia)", ms: "Malay (Bahasa Melayu)",
      tl: "Filipino (Tagalog)", my: "Burmese (မြန်មាဘာသာ)", lo: "Lao (ລາវ)",
    };
    const targetLangFull = tlNames[targetLang] || targetLang;

    const styleGuides = {
      cinematic_story: "អ្នកបញ្ចូលសំឡេងរឿងកុន & សម្រាយរឿង (Cinematic Movie Dubbing & Storytelling): ប្រើពាក្យពេចន៍ទាក់ទាញ អណ្តែតអណ្តូង សន្ទនារស់រវើក មិនរឹងកន្ត្រាក់។",
      dialogue: "សន្ទនាតួអង្គរស់រវើក (Natural Character Dialogue): ភាសាសន្ទនាធម្មជាតិរវាងមនុស្សពិត ប្រើសព្វនាម (ខ្ញុំ, ឯង, បង, អូន, លោក...) ត្រូវតាមតួអង្គ។",
      documentary: "អត្ថាធិប្បាយឯកសារ & ព័ត៌មាន (Documentary Narration): ច្បាស់ៗ ផ្លូវការ សុភាពរាបសារ។",
      dramatic: "មនោសញ្ចេតនា & រំជួលចិត្ត (Emotional & Dramatic): បង្ហាញអារម្មណ៍ក្តុកក្តួល កម្សត់ ឬរំភើបយ៉ាងស៊ីជម្រៅ។",
    };
    const chosenStyle = styleGuides[style] || styleGuides.cinematic_story;

    const prompt = `You are an expert cinematic movie subtitle translator and video dubber (អ្នកជំនាញបកប្រែ Subtitles និងបញ្ចូលសំឡេងរឿងជាភាសាខ្មែរ).
Carefully listen to this video/movie audio.

Task:
1. Transcribe the spoken dialogue/narrative from the audio in its original spoken language (originalTranscript).
2. Translate the transcript into natural, expressive, and fluent ${targetLangFull} movie dubbing and subtitle style.

CRITICAL FOR ${targetLangFull.toUpperCase()}:
- Style: ${chosenStyle}
${targetLang === "km" ? `- Khmer orthography: Do NOT insert spaces between every word. Khmer words must be written together; only insert spaces between clauses/phrases. End sentences with '។'.
- The "khmer" property of each subtitle item MUST be translated into natural Khmer (ភាសាខ្មែរ). NEVER leave it in the original language!` : `- The "khmer" field MUST contain the translated text in ${targetLangFull}.`}

3. Return ONLY a valid JSON object matching this schema:
{
  "originalTranscript": "The full original transcript in the spoken language",
  "detectedLanguage": "The detected language name (e.g. Chinese, English, Thai, Korean...)",
  "translatedKhmerText": "The complete translated script in ${targetLangFull}",
  "subtitles": [
    {
      "start": 0.0,
      "end": 3.0,
      "original": "Original spoken dialogue line",
      "khmer": "Translated line in ${targetLangFull}"
    }
  ]
}
Return pure JSON without markdown backticks or commentary.`;

    const candidateModels = Array.from(new Set([
      engine && engine.startsWith("gemini-") && !engine.includes("2.5") ? engine : "gemini-2.0-flash",
      "gemini-2.0-flash",
      "gemini-1.5-flash",
      "gemini-1.5-pro",
    ])).filter((m) => m && m.startsWith("gemini-") && !m.includes("2.5"));

    for (const model of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { inlineData: { mimeType, data: audioBase64 } },
                  { text: prompt },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.3,
              responseMimeType: "application/json",
              maxOutputTokens: 8192,
            },
          }),
        });

        if (!response.ok) continue;
        const data = await response.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) continue;

        let parsed = extractJsonFromText(rawText);
        if (!parsed) {
          parsed = {
            originalTranscript: rawText,
            detectedLanguage: sourceLang || "auto",
            translatedKhmerText: rawText,
            subtitles: [],
          };
        }

        // Dual-pass verification: Check if Khmer translation is present and no Chinese left
        const hasChinese = /[\u4e00-\u9fa5]/.test(parsed.translatedKhmerText || "") ||
          (parsed.subtitles?.length > 0 && parsed.subtitles.some((s) => /[\u4e00-\u9fa5]/.test(s.khmer || "")));

        const needsKhmerHealing =
          targetLang === "km" &&
          (
            hasChinese ||
            !containsKhmer(parsed.translatedKhmerText) ||
            (parsed.subtitles?.length > 0 && !parsed.subtitles.some((s) => containsKhmer(s.khmer))) ||
            (parsed.originalTranscript && parsed.translatedKhmerText.trim() === parsed.originalTranscript.trim())
          );

        if (needsKhmerHealing && parsed.originalTranscript) {
          onProgress?.({ progress: 85, phase: "កំពុងផ្ទៀងផ្ទាត់ និងបកប្រែជាភាសាខ្មែរឱ្យកាន់តែរលូន..." });
          try {
            const tr = await dubberService.translateStory({
              text: parsed.originalTranscript,
              sourceLang: parsed.detectedLanguage || sourceLang,
              targetLang: "km",
              style,
              apiKey: key,
              model,
            });

            if (tr?.translatedText && containsKhmer(tr.translatedText)) {
              parsed.translatedKhmerText = tr.translatedText;
              const lines = tr.translatedText.split(/\n+/).map((l) => l.trim()).filter(Boolean);

              if (Array.isArray(parsed.subtitles) && parsed.subtitles.length > 0) {
                parsed.subtitles = parsed.subtitles.map((seg, i) => {
                  const lineIdx = lines.length > 1
                    ? Math.floor((i / parsed.subtitles.length) * lines.length)
                    : 0;
                  return {
                    ...seg,
                    khmer: lines[lineIdx] || lines[lines.length - 1] || seg.khmer,
                  };
                });
              }
            }
          } catch (trErr) {
            console.warn("Client safeguard translation pass error:", trErr);
          }
        }

        return parsed;
      } catch (err) {
        console.warn(`Client Gemini audio transcribe error (${model}):`, err);
      }
    }

    // Automatic reliable fallback: if Gemini Multimodal Audio fails or times out, transcribe via Local Whisper and translate!
    console.warn("Gemini multimodal audio failed, falling back to Local Whisper + Google Translation...");
    onProgress?.({ progress: 40, phase: "ប្តូរមកស្រង់ Transcript តាម Local Whisper លើកុំព្យូទ័រ..." });
    const asrResult = await transcribeAudioToCaptionSegments(audioBlob, {
      preferredLanguage: sourceLang !== "auto" ? sourceLang : "en",
      onProgress: (p) => onProgress?.({ progress: p.progress || 50, phase: p.phase }),
    });

    const asrSegments = asrResult.segments || [];
    const rawTranscript = asrResult.text || asrSegments.map((s) => s.text).join(" ");
    onProgress?.({ progress: 80, phase: "កំពុងបកប្រែ Subtitles ទៅជាភាសាខ្មែរ..." });

    const translatedSegs = await dubberService.translateCaptionSegments({
      segments: asrSegments,
      sourceLang,
      targetLang,
      style,
      apiKey: key,
      model: "google-translate",
      onProgress,
    });

    const subtitles = translatedSegs.map((seg, i) => ({
      start: seg.start,
      end: seg.end,
      original: asrSegments[i]?.text || seg.text,
      khmer: seg.text,
    }));
    const translatedKhmerText = translatedSegs.map((s) => s.text).join("\n");

    return {
      originalTranscript: rawTranscript,
      detectedLanguage: asrResult.language || sourceLang || "auto",
      translatedKhmerText,
      subtitles,
    };
  },

  /**
   * Synthesize dubbed voiceover using the user's selected Cloned Voice Profile
   * @param {object} params
   * @param {string} params.text
   * @param {object} params.profile - Active cloned voice profile
   * @param {number} [params.speed=1.0]
   * @param {number} [params.volume=1.0]
   * @param {function} [params.onProgress]
   * @param {function} [params.onPhase]
   * @returns {Promise<Blob>}
   */
  async synthesizeDubbedVoice({
    text,
    profile,
    speed = 1.0,
    volume = 1.0,
    onProgress = () => {},
    onPhase = () => {},
  }) {
    if (!text || !text.trim()) {
      throw new Error("សូមបញ្ចូលអត្ថបទដែលត្រូវបញ្ចូលសំឡេង");
    }
    if (!profile) {
      throw new Error("សូមជ្រើសរើសសំឡេងក្លូនរបស់អ្នកជាមុនសិន");
    }

    const cleanText = text.trim();
    const gemKey = getStoredGeminiKey();
    const elKey = getStoredElevenLabsKey();
    let finalBlob;

    // Engine 1: Google Gemini 2.0 / 2.5 Cloned Voice
    if (profile.engine === "gemini" || profile.geminiVoiceName) {
      onPhase(`កំពុងសំយោគសំឡេងក្លូន Studio តាម Google Gemini (${profile.name})...`);
      onProgress(20);

      const voiceName = (
        profile.geminiVoiceName ||
        (profile.gender === "male" ? "Fenrir" : "Aoede")
      ).replace("gemini_", "");

      let geminiBase;
      try {
        geminiBase = await synthesizeWithGemini({
          apiKey: gemKey,
          text: cleanText,
          voiceName,
          referenceAudioBlob: profile.referenceBlob,
          vocalStyle: profile.vocalTone || "storytelling",
          onProgress: (p) => onProgress(20 + Math.round(p * 0.55)),
        });
      } catch (gemErr) {
        console.warn("Gemini dubbing fallback to base voice:", gemErr);
        const baseVoice = VOICES.find((v) => v.id === "km_female_sophea") || VOICES[0];
        const res = await synthesizeBaseVoice({
          voice: baseVoice,
          text: cleanText,
          speed,
          onProgress: (p) => onProgress(20 + Math.round(p * 0.55)),
        });
        geminiBase = res.blob;
      }

      if (profile.embedding) {
        onPhase(`កំពុងបម្លែងទឹកដមទៅជា "${profile.name}"...`);
        onProgress(80);
        try {
          finalBlob = await convertVoiceBlob(geminiBase, profile.embedding, { seed: 2026 });
        } catch {
          finalBlob = geminiBase;
        }
      } else {
        finalBlob = geminiBase;
      }
    }
    // Engine 2: VoxCPM2 Offline 48kHz
    else if (profile.engine === "voxcpm2" || profile.model?.includes("VoxCPM")) {
      onPhase(`កំពុងសំយោគសំឡេង 48kHz ដោយ VoxCPM2 (${profile.name})...`);
      onProgress(20);
      try {
        finalBlob = await synthesizeWithVoxCpm({
          text: cleanText,
          profile,
          speed,
          language: profile.language || "km",
          onProgress: (p) => onProgress(20 + Math.round(p * 0.7)),
        });
      } catch (voxErr) {
        console.warn("VoxCPM dubbing fallback:", voxErr);
        const baseVoice = VOICES.find((v) => v.id === "km_female_sophea") || VOICES[0];
        const res = await synthesizeBaseVoice({ voice: baseVoice, text: cleanText, speed });
        finalBlob = res.blob;
      }
    }
    // Engine 3: ElevenLabs
    else if (profile.engine === "elevenlabs" && profile.elevenlabsVoiceId && elKey) {
      onPhase(`កំពុងសំយោគសំឡេងមនុស្សពិត ១០០% តាមរយៈ ElevenLabs (${profile.name})...`);
      onProgress(25);
      finalBlob = await synthesizeWithElevenLabs({
        apiKey: elKey,
        voiceId: profile.elevenlabsVoiceId,
        text: cleanText,
        speed,
        modelId: "eleven_multilingual_v2",
        onProgress: (p) => onProgress(25 + Math.round(p * 0.65)),
      });
    }
    // Engine 4: OpenVoice / Local Timbre Embedding
    else {
      onPhase("កំពុងសំយោគសំឡេងមូលដ្ឋានជាភាសាខ្មែរ...");
      onProgress(15);
      const baseVoice = VOICES.find((v) => v.id === "km_female_sophea") || VOICES[0];
      const { blob: baseBlob } = await synthesizeBaseVoice({
        voice: baseVoice,
        text: cleanText,
        speed,
        onProgress: (p) => onProgress(15 + Math.round(p * 0.45)),
      });

      finalBlob = baseBlob;
      if (profile.embedding) {
        onPhase(`កំពុងបម្លែងទៅជាសំឡេងក្លូន "${profile.name}"...`);
        onProgress(65);
        try {
          finalBlob = await convertVoiceBlob(baseBlob, profile.embedding, { seed: 2026 });
        } catch (e) {
          console.warn("convertVoiceBlob failed:", e);
        }
      }
    }

    onProgress(100);
    onPhase("រួចរាល់!");
    return finalBlob;
  },
};
