/**
 * Google Gemini Runtime for Frontend
 * Supports Gemini 2.0 Flash Audio TTS, AI Script Generation, and Key Management
 */

const STORAGE_KEY = "ai_video_editor_gemini_api_key";
const MULTI_STORAGE_KEY = "ai_video_editor_gemini_api_keys";

/**
 * Get stored Google Gemini API key from local storage (primary key)
 * @returns {string}
 */
export function getStoredGeminiKey() {
  try {
    const multi = localStorage.getItem(MULTI_STORAGE_KEY);
    if (multi) {
      const parsed = JSON.parse(multi);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]) {
        return parsed[0].trim();
      }
    }
    return (
      localStorage.getItem(STORAGE_KEY) ||
      (typeof import.meta !== "undefined" &&
        (import.meta.env?.VITE_GEMINI_API_KEY || import.meta.env?.GEMINI_API_KEY)) ||
      ""
    );
  } catch {
    return "";
  }
}

/**
 * Get all stored Google Gemini API keys
 * @returns {string[]}
 */
export function getStoredGeminiKeys() {
  try {
    const multi = localStorage.getItem(MULTI_STORAGE_KEY);
    if (multi) {
      const parsed = JSON.parse(multi);
      if (Array.isArray(parsed)) {
        const clean = parsed.map((k) => (typeof k === "string" ? k.trim() : "")).filter(Boolean);
        if (clean.length > 0) return clean;
      }
    }
    const single = getStoredGeminiKey();
    return single ? [single] : [];
  } catch {
    return [];
  }
}

/**
 * Save or clear stored Google Gemini API key
 * @param {string} key
 */
export function setStoredGeminiKey(key) {
  try {
    if (!key) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(MULTI_STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, key.trim());
      const current = getStoredGeminiKeys();
      if (!current.includes(key.trim())) {
        current.unshift(key.trim());
      }
      localStorage.setItem(MULTI_STORAGE_KEY, JSON.stringify(current));
    }
  } catch (err) {
    console.error("Failed to persist Gemini API key:", err);
  }
}

/**
 * Save multiple Google Gemini API keys
 * @param {string[]} keys
 */
export function setStoredGeminiKeys(keys) {
  try {
    const clean = Array.isArray(keys)
      ? keys.map((k) => (typeof k === "string" ? k.trim() : "")).filter(Boolean)
      : [];
    localStorage.setItem(MULTI_STORAGE_KEY, JSON.stringify(clean));
    if (clean.length > 0) {
      localStorage.setItem(STORAGE_KEY, clean[0]);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (err) {
    console.error("Failed to persist Gemini API keys:", err);
  }
}

/**
 * Convert 16-bit raw PCM (e.g. 24000Hz mono from Gemini 2.0) to standard WAV Blob
 * @param {Uint8Array} pcmBytes
 * @param {number} sampleRate
 * @param {number} numChannels
 * @returns {Blob}
 */
export function pcmToWavBlob(pcmBytes, sampleRate = 24000, numChannels = 1) {
  const byteRate = sampleRate * numChannels * 2;
  const blockAlign = numChannels * 2;
  const buffer = new ArrayBuffer(44 + pcmBytes.length);
  const view = new DataView(buffer);

  // RIFF header
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + pcmBytes.length, true);
  view.setUint32(8, 0x57415645, false); // "WAVE"

  // "fmt " chunk
  view.setUint32(12, 0x666d7420, false);
  view.setUint32(16, 16, true); // 16 for PCM format
  view.setUint16(20, 1, true); // PCM format code
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // 16 bits per sample

  // "data" chunk
  view.setUint32(36, 0x64617461, false);
  view.setUint32(40, pcmBytes.length, true);

  new Uint8Array(buffer, 44).set(pcmBytes);
  return new Blob([buffer], { type: "audio/wav" });
}

/**
 * Verify Google Gemini API Key
 * Dual-channel: tries backend proxy first, falls back to direct Google API
 * @param {string} apiKey
 * @returns {Promise<{ valid: boolean, models?: string[], error?: string }>}
 */
export async function verifyGeminiKey(apiKey) {
  const cleanKey = (apiKey || "").trim();

  // If no direct key passed, check if backend server has configured GEMINI_API_KEY
  if (!cleanKey) {
    try {
      const statusRes = await fetch("/api/ai/gemini/status");
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        if (statusData.configured) {
          return {
            valid: true,
            serverConfigured: true,
            models: ["gemini-2.0-flash"],
            supportsAudio: true,
          };
        }
      }
    } catch {
      // Backend not accessible
    }
    return { valid: false, error: "សូមបញ្ចូល Google Gemini API Key" };
  }

  // Channel 1: Try local backend proxy
  try {
    const res = await fetch("/api/ai/gemini/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: cleanKey }),
    });
    if (res.ok) {
      const data = await res.json();
      return { valid: true, ...data };
    }
    const errData = await res.json().catch(() => ({}));
    if (errData?.error) {
      return { valid: false, error: errData.error };
    }
  } catch {
    // Backend proxy unavailable, fall back to direct browser fetch
  }

  // Channel 2: Direct Google Generative Language API
  try {
    const directUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`;
    const directRes = await fetch(directUrl, { method: "GET" });
    if (!directRes.ok) {
      const errJson = await directRes.json().catch(() => ({}));
      const msg = errJson?.error?.message || `HTTP ${directRes.status}`;
      return { valid: false, error: `Google Gemini Key មិនត្រឹមត្រូវ៖ ${msg}` };
    }
    const data = await directRes.json();
    const modelNames = (data.models || []).map((m) => m.name.replace("models/", ""));
    return {
      valid: true,
      models: modelNames,
      supportsAudio: modelNames.some((m) => m.includes("gemini-2.0")),
    };
  } catch (directErr) {
    return { valid: false, error: `មិនអាចភ្ជាប់ទៅ Google API៖ ${directErr.message}` };
  }
}

/**
 * Build an expressive prompt directing Gemini to emulate human vocal warmth,
 * natural Khmer inflection (តុងសំឡេង), breathing pauses, and acoustic timbre (ធួនសំឡេង).
 * @param {string} text
 * @param {string} [vocalStyle]
 * @param {boolean} [hasAudio]
 * @returns {string}
 */
export function buildHumanVocalPrompt(text, vocalStyle = "natural_warm", hasAudio = false) {
  let styleDetails = "";
  switch (vocalStyle) {
    case "storytelling":
      styleDetails = "ទឹកដមនិទានរឿង ស្រទន់ រណ្តំ (Captivating, melodious, and gentle Cambodian storyteller). Expressive melodic cadence with warm poetic intonation.";
      break;
    case "news_anchor":
      styleDetails = "ទឹកដមអត្ថាធិប្បាយ ព័ត៌មាន ច្បាស់ៗ ម៉ឺងម៉ាត់ (Authoritative, articulate broadcast narrator). Crisp diction, steady cadence, confident presentation.";
      break;
    case "emotional":
      styleDetails = "ទឹកដមរំជួលចិត្ត មានមនោសញ្ចេតនាជ្រាលជ្រៅ (Deeply emotional, heartfelt, and touching). Soft breathy resonance, delicate pauses, authentic feeling.";
      break;
    case "energetic":
      styleDetails = "ទឹកដមស្វាហាប់ រស់រវើក រួសរាយ (Dynamic, cheerful, and lively). Upbeat pacing, bright pitch variety, engaging energy.";
      break;
    case "natural_warm":
    default:
      styleDetails = "ទឹកដមធម្មជាតិ កក់ក្តៅ ស្និទ្ធស្នាល (Natural, warm conversational human speech). Relaxed cadence with authentic Khmer phrasing.";
      break;
  }

  const audioGuidance = hasAudio
    ? `Reference Audio Provided:
Listen to the speaker's audio clip attached:
1. Timbre & Resonance (ធួនសំឡេង): Emulate the speaker's vocal warmth, acoustic body, vocal tract resonance, and throat frequencies.
2. Pitch Inflection & Melodic Contour (តុងសំឡេង): Follow the natural human pitch rise and fall, question/statement intonation curves, and authentic Cambodian cadence.
3. Natural Breathing & Rhythm: Pause naturally with micro-breaths at phrase boundaries. Deliver speech that feels alive and indistinguishable from a real human.`
    : `Human Vocal Delivery Rules:
1. Natural Khmer Phonetics & Prosody (តុងសំឡេង): Follow authentic Khmer inflection with realistic pitch rises on emphasis and gentle drops at phrase endings.
2. Rich Timbre & Resonance (ធួនសំឡេង): Produce full-bodied human chest warmth and breath dynamics, completely avoiding robotic TTS flatness.
3. Rhythm & Cadence: Natural conversational pacing with subtle human micro-pauses at punctuation.`;

  return `You are a master Cambodian voice actor and native speaker reading Khmer with exceptional human realism.
Style: ${styleDetails}
${audioGuidance}

Speak the following text with this exact human vocal tone, inflection, and cadence in authentic Khmer (ភាសាខ្មែរ) without any introduction, greetings, or meta-comments:

${text.trim()}`;
}

/**
 * Synthesize speech using Gemini 2.0 / 2.5 Flash Native Audio
 * Dual-channel: tries backend proxy, falls back to direct browser fetch
 * Supports Multimodal in-context audio reference cloning and Cambodian human inflection.
 * @param {object} params
 * @param {string} params.apiKey
 * @param {string} params.text
 * @param {string} [params.voiceName] Aoede, Charon, Fenrir, Kore, Puck
 * @param {Blob|File} [params.referenceAudioBlob] Speaker reference audio blob
 * @param {string} [params.referenceAudioBase64] Speaker reference audio base64
 * @param {string} [params.referenceMimeType] Speaker reference mime type
 * @param {string} [params.vocalStyle] natural_warm, storytelling, news_anchor, emotional, energetic
 * @param {function} [params.onProgress]
 * @returns {Promise<Blob>}
 */
export async function synthesizeWithGemini({
  apiKey,
  text,
  voiceName = "Aoede",
  referenceAudioBlob = null,
  referenceAudioBase64 = null,
  referenceMimeType = "audio/wav",
  vocalStyle = "natural_warm",
  onProgress = () => {},
}) {
  if (!text || !text.trim()) throw new Error("សូមបញ្ចូលអត្ថបទសម្រាប់និយាយ");

  const cleanKey = (apiKey || "").trim();
  onProgress(15);

  let audioBase64 = referenceAudioBase64 || null;
  let audioMime = referenceMimeType || "audio/wav";

  // Convert reference audio to base64 if provided
  if (!audioBase64 && referenceAudioBlob) {
    try {
      const slice = referenceAudioBlob.size > 2 * 1024 * 1024
        ? referenceAudioBlob.slice(0, 2 * 1024 * 1024, referenceAudioBlob.type || "audio/wav")
        : referenceAudioBlob;
      audioMime = slice.type || "audio/wav";
      audioBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const res = reader.result;
          const b64 = typeof res === "string" ? res.split(",")[1] : "";
          resolve(b64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(slice);
      });
    } catch (b64Err) {
      console.warn("Could not encode reference audio for Gemini:", b64Err);
    }
  }

  // Channel 1: Try backend proxy (which may use server-configured GEMINI_API_KEY)
  try {
    const res = await fetch("/api/ai/gemini/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: cleanKey,
        text: text.trim(),
        voiceName,
        audioBase64,
        referenceMimeType: audioMime,
        vocalStyle,
      }),
    });

    if (res.ok) {
      onProgress(85);
      const blob = await res.blob();
      onProgress(100);
      return blob;
    }
  } catch {
    // Fall back to direct browser fetch
  }

  if (!cleanKey) {
    throw new Error("Google Gemini API Key គឺចាំបាច់ (សូមភ្ជាប់ Key នៅក្នុងស្ទូឌីយោ ឬក្នុង .env)");
  }

  // Channel 2: Direct browser fetch with model fallback
  onProgress(40);
  const candidateModels = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-preview-tts",
    "gemini-2.0-flash-exp",
    "gemini-2.0-flash",
  ];

  let lastDirectError = null;

  for (const model of candidateModels) {
    // Attempt with audio reference if present, then without audio reference on failure
    const attempts = audioBase64 ? [true, false] : [false];

    for (const withAudio of attempts) {
      try {
        const directUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`;
        const promptText = buildHumanVocalPrompt(text, vocalStyle, withAudio);

        const parts = [];
        if (withAudio && audioBase64) {
          parts.push({
            inlineData: {
              mimeType: audioMime,
              data: audioBase64,
            },
          });
        }
        parts.push({ text: promptText });

        const requestBody = {
          contents: [{ parts }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName,
                },
              },
            },
          },
        };

        const directRes = await fetch(directUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });

        if (!directRes.ok) {
          const errJson = await directRes.json().catch(() => ({}));
          const msg = errJson?.error?.message || `HTTP ${directRes.status}`;
          lastDirectError = new Error(`Gemini Audio (${model}) បរាជ័យ៖ ${msg}`);
          continue;
        }

        onProgress(75);
        const result = await directRes.json();
        const candidate = result.candidates?.[0];
        const audioPart = candidate?.content?.parts?.find((p) => p.inlineData);

        if (!audioPart || !audioPart.inlineData?.data) {
          lastDirectError = new Error(`Gemini (${model}) មិនបានបញ្ជូនទិន្នន័យសំឡេងត្រឡប់មកវិញទេ`);
          continue;
        }

        const base64Data = audioPart.inlineData.data;
        const binaryString = atob(base64Data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const mimeType = audioPart.inlineData.mimeType || "audio/pcm;rate=24000";

        onProgress(95);
        // Wrap raw PCM in standard WAV
        if (mimeType.includes("pcm") || mimeType.includes("raw")) {
          const wavBlob = pcmToWavBlob(bytes, 24000, 1);
          onProgress(100);
          return wavBlob;
        }

        const blob = new Blob([bytes], { type: mimeType });
        onProgress(100);
        return blob;
      } catch (err) {
        lastDirectError = err;
      }
    }
  }

  throw lastDirectError || new Error("Gemini Audio Generation បរាជ័យ");
}

/**
 * Generate video narration script or story with Gemini in Khmer
 * @param {object} params
 * @param {string} params.apiKey
 * @param {string} [params.prompt]
 * @param {string} [params.topic]
 * @param {string} [params.tone]
 * @returns {Promise<string>}
 */
export async function generateScriptWithGemini({
  apiKey,
  prompt = "",
  topic = "",
  tone = "ធម្មជាតិ",
}) {
  const cleanKey = (apiKey || "").trim();

  // Channel 1: Try backend proxy (which may use server-configured GEMINI_API_KEY)
  try {
    const res = await fetch("/api/ai/gemini/generate-script", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: cleanKey,
        prompt,
        topic,
        tone,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return data.script || "";
    }
  } catch {
    // Fall back to direct browser fetch
  }

  if (!cleanKey) {
    throw new Error("Google Gemini API Key គឺចាំបាច់ (សូមភ្ជាប់ Key នៅក្នុងស្ទូឌីយោ ឬក្នុង .env)");
  }

  // Channel 2: Direct browser fetch with candidate models
  const candidateTextModels = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-2.0-flash"];

  const systemInstruction = `You are an expert Cambodian video scriptwriter and voiceover storyteller.
Write natural, engaging, and expressive narration scripts in pure Khmer language (ភាសាខ្មែរ).
Rules:
1. Output ONLY the spoken narration text ready to be read aloud by Voice AI.
2. Do not include stage directions, speaker labels, brackets [like this], or meta commentary.
3. Use fluent, modern, polite Khmer vocabulary with natural pauses.
4. Tone requested: ${tone}.`;

  const userContent = prompt
    ? prompt
    : `សូមសរសេរអត្ថបទនិទាន ឬអត្ថាធិប្បាយវីដេអូខ្លីមួយ (ប្រហែល ៣ ទៅ ៥ ប្រយោគ) អំពី៖ ${topic} ក្នុងទឹកដមបែប ${tone}។`;

  const requestBody = {
    systemInstruction: {
      parts: [{ text: systemInstruction }],
    },
    contents: [
      {
        parts: [{ text: userContent }],
      },
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 600,
    },
  };

  let lastScriptError = null;

  for (const model of candidateTextModels) {
    try {
      const directUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`;
      const response = await fetch(directUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const msg = errJson?.error?.message || `HTTP ${response.status}`;
        lastScriptError = new Error(`Gemini Script (${model}) បរាជ័យ៖ ${msg}`);
        continue;
      }

      const result = await response.json();
      const textPart = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
      return textPart.trim();
    } catch (err) {
      lastScriptError = err;
    }
  }

  throw lastScriptError || new Error("Gemini Script Generation បរាជ័យ");
}
