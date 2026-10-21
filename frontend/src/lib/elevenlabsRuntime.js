// Helper to convert Blob to Base64
async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

const STORAGE_KEY = "timeline_studio_elevenlabs_key";
const MULTI_STORAGE_KEY = "timeline_studio_elevenlabs_keys";

export function getStoredElevenLabsKey() {
  try {
    const multi = localStorage.getItem(MULTI_STORAGE_KEY);
    if (multi) {
      const parsed = JSON.parse(multi);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]) {
        return parsed[0].trim();
      }
    }
    return localStorage.getItem(STORAGE_KEY) || "";
  } catch (_) {
    return "";
  }
}

export function getStoredElevenLabsKeys() {
  try {
    const multi = localStorage.getItem(MULTI_STORAGE_KEY);
    if (multi) {
      const parsed = JSON.parse(multi);
      if (Array.isArray(parsed)) {
        const clean = parsed.map((k) => (typeof k === "string" ? k.trim() : "")).filter(Boolean);
        if (clean.length > 0) return clean;
      }
    }
    const single = getStoredElevenLabsKey();
    return single ? [single] : [];
  } catch (_) {
    return [];
  }
}

export function setStoredElevenLabsKey(key) {
  try {
    if (key && String(key).trim()) {
      localStorage.setItem(STORAGE_KEY, String(key).trim());
      const current = getStoredElevenLabsKeys();
      if (!current.includes(String(key).trim())) {
        current.unshift(String(key).trim());
      }
      localStorage.setItem(MULTI_STORAGE_KEY, JSON.stringify(current));
    } else {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(MULTI_STORAGE_KEY);
    }
  } catch (_) {}
}

export function setStoredElevenLabsKeys(keys) {
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
  } catch (_) {}
}

/**
 * Verify an ElevenLabs API Key
 */
export async function verifyElevenLabsKey(apiKey) {
  const cleanKey = String(apiKey || "").trim();
  if (!cleanKey) throw new Error("សូមបញ្ចូល ElevenLabs API Key");

  // Try backend first
  try {
    const res = await fetch("/api/ai/elevenlabs/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: cleanKey }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (_) {}

  // Direct client fallback
  const direct = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
    headers: { "xi-api-key": cleanKey },
  });
  if (!direct.ok) {
    const errText = await direct.text();
    throw new Error(`API Key មិនត្រឹមត្រូវ៖ ${errText}`);
  }
  const data = await direct.json();
  return {
    valid: true,
    tier: data.tier,
    characterCount: data.character_count,
    characterLimit: data.character_limit,
  };
}

/**
 * Clone a voice using ElevenLabs Instant Voice Cloning
 */
export async function cloneVoiceWithElevenLabs({
  name,
  apiKey,
  audioBlob,
  description = "Cloned via Timeline Studio",
}) {
  const cleanKey = String(apiKey || "").trim();
  if (!cleanKey) throw new Error("សូមបញ្ចូល ElevenLabs API Key");
  if (!audioBlob) throw new Error("សូមថត ឬផ្ទុកឡើងសំឡេងគំរូជាមុនសិន");

  // Convert audio blob to base64
  const audioBase64 = await blobToBase64(audioBlob);

  // 1. Try Backend Proxy
  try {
    const res = await fetch("/api/ai/elevenlabs/clone-voice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name || "Cloned Voice",
        apiKey: cleanKey,
        audioBase64,
        mimeType: audioBlob.type || "audio/wav",
        description,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      return {
        voiceId: data.voiceId,
        name: data.name,
      };
    }
    const errData = await res.json().catch(() => ({}));
    if (errData?.error) throw new Error(errData.error);
  } catch (err) {
    console.warn("Backend clone proxy failed, trying browser direct:", err);
  }

  // 2. Direct browser fallback
  const formData = new FormData();
  formData.append("name", name || "Cloned Voice");
  formData.append("files", audioBlob, "sample.wav");
  if (description) formData.append("description", description);

  const directRes = await fetch("https://api.elevenlabs.io/v1/voices/add", {
    method: "POST",
    headers: { "xi-api-key": cleanKey },
    body: formData,
  });

  if (!directRes.ok) {
    const errText = await directRes.text();
    let detail = errText;
    try {
      const parsed = JSON.parse(errText);
      detail = parsed?.detail?.message || parsed?.detail || errText;
    } catch (_) {}
    throw new Error(`ElevenLabs Clone បរាជ័យ៖ ${detail}`);
  }

  const directData = await directRes.json();
  return {
    voiceId: directData.voice_id,
    name,
  };
}

/**
 * Generate Speech using ElevenLabs Text-to-Speech
 */
export async function synthesizeWithElevenLabs({
  text,
  voiceId,
  apiKey,
  modelId = "eleven_multilingual_v2",
  voiceSettings = {},
  onProgress,
}) {
  const cleanKey = String(apiKey || "").trim();
  if (!cleanKey) throw new Error("សូមបញ្ចូល ElevenLabs API Key");
  if (!text || !text.trim()) throw new Error("សូមបញ្ចូលអត្ថបទដែលត្រូវនិយាយ");

  let safeVoiceId = String(voiceId || "").trim();
  if (!safeVoiceId || safeVoiceId.startsWith("gemini_") || safeVoiceId.length < 10) {
    safeVoiceId = "21m00Tcm4TlvDq8ikWAM"; // Rachel - ElevenLabs Multilingual v2 Default
  }

  onProgress?.(20);

  // 1. Try Backend Proxy
  try {
    const res = await fetch("/api/ai/elevenlabs/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: text.trim(),
        voiceId: safeVoiceId,
        apiKey: cleanKey,
        modelId,
        voiceSettings,
      }),
    });
    if (res.ok) {
      onProgress?.(85);
      const blob = await res.blob();
      onProgress?.(100);
      return blob;
    }
  } catch (err) {
    console.warn("Backend ElevenLabs TTS failed, trying browser direct:", err);
  }

  // 2. Direct browser fallback
  onProgress?.(40);
  const payload = {
    text: text.trim(),
    model_id: modelId,
    voice_settings: {
      stability: typeof voiceSettings.stability === "number" ? voiceSettings.stability : 0.5,
      similarity_boost: typeof voiceSettings.similarityBoost === "number" ? voiceSettings.similarityBoost : 0.85,
      style: typeof voiceSettings.style === "number" ? voiceSettings.style : 0.0,
      use_speaker_boost: voiceSettings.useSpeakerBoost !== false,
    },
  };

  let directRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(safeVoiceId)}`, {
    method: "POST",
    headers: {
      "xi-api-key": cleanKey,
      "Content-Type": "application/json",
      "Accept": "audio/mpeg",
    },
    body: JSON.stringify(payload),
  });

  // If safeVoiceId returned 404 on ElevenLabs, retry once with standard Rachel voice ID
  if (!directRes.ok && directRes.status === 404 && safeVoiceId !== "21m00Tcm4TlvDq8ikWAM") {
    console.warn(`ElevenLabs voice "${safeVoiceId}" not found (404), retrying with Rachel default...`);
    directRes = await fetch("https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM", {
      method: "POST",
      headers: {
        "xi-api-key": cleanKey,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
      },
      body: JSON.stringify(payload),
    });
  }

  if (!directRes.ok) {
    const errText = await directRes.text();
    let detail = errText;
    try {
      const parsed = JSON.parse(errText);
      detail = parsed?.detail?.message || parsed?.detail || errText;
    } catch (_) {}
    throw new Error(`ElevenLabs TTS បរាជ័យ៖ ${detail}`);
  }

  onProgress?.(90);
  const blob = await directRes.blob();
  onProgress?.(100);
  return blob;
}
