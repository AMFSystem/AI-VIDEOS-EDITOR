/**
 * F5-TTS Flow Matching Diffusion Voice Cloner & TTS Runtime
 * ==========================================================
 * GitHub: https://github.com/SWivid/F5-TTS
 *
 * Pipeline:
 *   1. Check backend F5-TTS microservice status (port 3003 via backend /api/ai/f5tts)
 *   2. Zero-shot voice cloning from 3-15s audio reference clip
 *   3. Non-autoregressive DiT inference with Euler ODE solver
 *   4. Graceful browser/backend fallback if local model is offline
 */

const BACKEND_BASE = "http://127.0.0.1:3001/api/ai/f5tts";
export const F5TTS_VERSION = "F5-TTS-Flow-Matching-24kHz";
export const F5TTS_SAMPLE_RATE = 24000;

async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Check F5-TTS service status
 */
export async function checkF5TtsStatus() {
  try {
    const res = await fetch(`${BACKEND_BASE}/status`, {
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {}
  return {
    available: false,
    installed: false,
    loaded: false,
    hint: "F5-TTS server is offline. Run 'python backend/python/f5tts_server.py' to launch.",
  };
}

/**
 * Register reference voice sample for F5-TTS Zero-Shot Cloning
 */
export async function extractF5TtsProfile(
  audioBlob,
  { name = "F5-TTS Voice", language = "km", refText = "", onProgress = () => {} } = {}
) {
  onProgress({ phase: "កំពុងវិភាគទម្រង់រលកសំឡេង...", progress: 20 });
  const audioBase64 = await blobToBase64(audioBlob);

  onProgress({ phase: "កំពុងចុះឈ្មោះ Reference Audio ទៅ F5-TTS Server...", progress: 50 });

  try {
    const res = await fetch(`${BACKEND_BASE}/clone`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        audioBase64,
        mimeType: audioBlob.type || "audio/wav",
        refText,
        language,
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (res.ok) {
      const data = await res.json();
      onProgress({ phase: "ស្រង់យកម៉ូដែល F5-TTS បានជោគជ័យ!", progress: 100 });
      return data.profile;
    }
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `F5-TTS clone error (${res.status})`);
  } catch (err) {
    console.error("[F5-TTS] Registration error:", err.message);
    throw new Error(err.message || "មិនអាចភ្ជាប់ទៅកាន់ F5-TTS Server បានទេ។ សូមដំណើរការ: python backend/python/f5tts_server.py");
  }
}

/**
 * Synthesize speech using F5-TTS Flow Matching Diffusion
 */
export async function synthesizeWithF5Tts({
  text,
  profile,
  speed = 1.0,
  language = "km",
  nfeStep = 32,
  cfgStrength = 2.0,
  onProgress = () => {},
}) {
  onProgress(15);

  let res;
  try {
    res = await fetch(`${BACKEND_BASE}/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        profile,
        speed,
        language: language || profile?.language || "km",
        nfeStep,
        cfgStrength,
      }),
      signal: AbortSignal.timeout(180000), // 3 min timeout for diffusion ODE steps
    });
  } catch (err) {
    throw new Error(`មិនអាចភ្ជាប់ទៅ F5-TTS Server បានទេ (${err.message})។ សូមប្រាកដថាបានបើក: python backend/python/f5tts_server.py`);
  }

  if (res.ok) {
    onProgress(90);
    const blob = await res.blob();
    onProgress(100);
    return blob;
  }

  const errData = await res.json().catch(() => ({}));
  throw new Error(errData.error || `F5-TTS Server error (${res.status})។ សូមពិនិត្យមើល Python Server :3003`);
}

