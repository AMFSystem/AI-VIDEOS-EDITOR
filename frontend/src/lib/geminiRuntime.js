/**
 * Google Gemini Runtime for Frontend
 * Supports Gemini 2.0 Flash Audio TTS, AI Script Generation, and Key Management
 */

const STORAGE_KEY = "ai_video_editor_gemini_api_key";

/**
 * Get stored Google Gemini API key from local storage
 * @returns {string}
 */
export function getStoredGeminiKey() {
  try {
    return localStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
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
    } else {
      localStorage.setItem(STORAGE_KEY, key.trim());
    }
  } catch (err) {
    console.error("Failed to persist Gemini API key:", err);
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
  if (!apiKey || !apiKey.trim()) {
    return { valid: false, error: "សូមបញ្ចូល Google Gemini API Key" };
  }
  const cleanKey = apiKey.trim();

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
 * Synthesize speech using Gemini 2.0 Flash Native Audio
 * Dual-channel: tries backend proxy, falls back to direct browser fetch
 * @param {object} params
 * @param {string} params.apiKey
 * @param {string} params.text
 * @param {string} [params.voiceName] Aoede, Charon, Fenrir, Kore, Puck
 * @param {function} [params.onProgress]
 * @returns {Promise<Blob>}
 */
export async function synthesizeWithGemini({
  apiKey,
  text,
  voiceName = "Aoede",
  onProgress = () => {},
}) {
  if (!apiKey) throw new Error("Google Gemini API Key គឺចាំបាច់");
  if (!text || !text.trim()) throw new Error("សូមបញ្ចូលអត្ថបទសម្រាប់និយាយ");

  const cleanKey = apiKey.trim();
  onProgress(20);

  // Channel 1: Try backend proxy
  try {
    const res = await fetch("/api/ai/gemini/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: cleanKey,
        text: text.trim(),
        voiceName,
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

  // Channel 2: Direct browser fetch to Gemini 2.0 Flash
  onProgress(40);
  const directUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${cleanKey}`;
  const requestBody = {
    contents: [
      {
        parts: [
          {
            text: `Please read the following text aloud clearly, expressively, and naturally in Khmer without any extra introduction or explanation:\n\n${text.trim()}`,
          },
        ],
      },
    ],
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
    throw new Error(`Gemini Audio Generation បរាជ័យ៖ ${msg}`);
  }

  onProgress(75);
  const result = await directRes.json();
  const candidate = result.candidates?.[0];
  const audioPart = candidate?.content?.parts?.find((p) => p.inlineData);

  if (!audioPart || !audioPart.inlineData?.data) {
    throw new Error("Gemini មិនបានបញ្ជូនទិន្នន័យសំឡេងត្រឡប់មកវិញទេ");
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
  if (!apiKey) throw new Error("Google Gemini API Key គឺចាំបាច់");
  const cleanKey = apiKey.trim();

  // Channel 1: Try backend proxy
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

  // Channel 2: Direct browser fetch
  const directUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${cleanKey}`;
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

  const response = await fetch(directUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errJson = await response.json().catch(() => ({}));
    const msg = errJson?.error?.message || `HTTP ${response.status}`;
    throw new Error(`Gemini Script Generation បរាជ័យ៖ ${msg}`);
  }

  const result = await response.json();
  const textPart = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return textPart.trim();
}
