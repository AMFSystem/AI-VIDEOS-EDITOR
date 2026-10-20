/**
 * Google Gemini Service
 * Handles API key verification, Gemini 2.0 Flash Audio TTS, and AI Script Generation
 */

/**
 * Convert raw 16-bit PCM (e.g. 24000Hz mono from Gemini) into a standard WAV Buffer
 * @param {Buffer} pcmBuffer
 * @param {number} sampleRate
 * @param {number} numChannels
 * @returns {Buffer}
 */
export function pcmToWavBuffer(pcmBuffer, sampleRate = 24000, numChannels = 1) {
  const byteRate = sampleRate * numChannels * 2;
  const blockAlign = numChannels * 2;
  const wavHeader = Buffer.alloc(44);

  // RIFF chunk descriptor
  wavHeader.write("RIFF", 0);
  wavHeader.writeUInt32LE(36 + pcmBuffer.length, 4);
  wavHeader.write("WAVE", 8);

  // "fmt " sub-chunk
  wavHeader.write("fmt ", 12);
  wavHeader.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  wavHeader.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
  wavHeader.writeUInt16LE(numChannels, 22);
  wavHeader.writeUInt32LE(sampleRate, 24);
  wavHeader.writeUInt32LE(byteRate, 28);
  wavHeader.writeUInt16LE(blockAlign, 32);
  wavHeader.writeUInt16LE(16, 34); // BitsPerSample

  // "data" sub-chunk
  wavHeader.write("data", 36);
  wavHeader.writeUInt32LE(pcmBuffer.length, 40);

  return Buffer.concat([wavHeader, pcmBuffer]);
}

/**
 * Verify Google Gemini API Key
 * @param {string} apiKey
 * @returns {Promise<{ valid: boolean, models?: string[], error?: string }>}
 */
export async function verifyGeminiApiKey(apiKey) {
  if (!apiKey || typeof apiKey !== "string") {
    return { valid: false, error: "API Key មិនអាចទទេបានទេ" };
  }

  const cleanKey = apiKey.trim();
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      const msg = errJson?.error?.message || `HTTP ${response.status} ${response.statusText}`;
      return { valid: false, error: `Google Gemini API Key មិនត្រឹមត្រូវ: ${msg}` };
    }

    const data = await response.json();
    const modelNames = (data.models || []).map((m) => m.name.replace("models/", ""));
    return {
      valid: true,
      models: modelNames,
      supportsAudio: modelNames.some((m) => m.includes("gemini-2.0")),
    };
  } catch (err) {
    return { valid: false, error: `មិនអាចភ្ជាប់ទៅកាន់ Google API: ${err.message}` };
  }
}

/**
 * Synthesize speech using Gemini 2.0 Flash Audio Output
 * @param {object} params
 * @param {string} params.apiKey
 * @param {string} params.text
 * @param {string} [params.voiceName] Puck, Charon, Kore, Fenrir, Aoede
 * @returns {Promise<{ buffer: Buffer, mimeType: string }>}
 */
export async function synthesizeGeminiSpeech({ apiKey, text, voiceName = "Aoede" }) {
  if (!apiKey) throw new Error("Google Gemini API Key គឺចាំបាច់");
  if (!text || !text.trim()) throw new Error("អត្ថបទសម្រាប់និយាយគឺចាំបាច់");

  const cleanKey = apiKey.trim();
  const allowedVoices = ["Aoede", "Charon", "Fenrir", "Kore", "Puck"];
  const chosenVoice = allowedVoices.includes(voiceName) ? voiceName : "Aoede";

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${cleanKey}`;

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
            voiceName: chosenVoice,
          },
        },
      },
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errJson = await response.json().catch(() => ({}));
    const msg = errJson?.error?.message || `HTTP ${response.status}`;
    throw new Error(`Gemini Audio Generation បរាជ័យ: ${msg}`);
  }

  const result = await response.json();
  const candidate = result.candidates?.[0];
  const audioPart = candidate?.content?.parts?.find((p) => p.inlineData);

  if (!audioPart || !audioPart.inlineData?.data) {
    throw new Error("Gemini មិនបានបញ្ជូនទិន្នន័យសំឡេងត្រឡប់មកវិញទេ");
  }

  const rawBuffer = Buffer.from(audioPart.inlineData.data, "base64");
  const mimeType = audioPart.inlineData.mimeType || "audio/pcm;rate=24000";

  // If Gemini returned raw PCM, wrap in standard WAV header for browser audio element playback
  if (mimeType.includes("pcm") || mimeType.includes("raw")) {
    const wavBuffer = pcmToWavBuffer(rawBuffer, 24000, 1);
    return { buffer: wavBuffer, mimeType: "audio/wav" };
  }

  return { buffer: rawBuffer, mimeType };
}

/**
 * Generate Video Script or Story using Google Gemini
 * @param {object} params
 * @param {string} params.apiKey
 * @param {string} params.prompt
 * @param {string} [params.topic]
 * @param {string} [params.tone]
 * @returns {Promise<{ script: string }>}
 */
export async function generateGeminiScript({ apiKey, prompt, topic = "", tone = "ធម្មជាតិ" }) {
  if (!apiKey) throw new Error("Google Gemini API Key គឺចាំបាច់");
  if (!prompt && !topic) throw new Error("សូមបញ្ចូលប្រធានបទ ឬសំណើអត្ថបទ");

  const cleanKey = apiKey.trim();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${cleanKey}`;

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

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errJson = await response.json().catch(() => ({}));
    const msg = errJson?.error?.message || `HTTP ${response.status}`;
    throw new Error(`Gemini Script Generation បរាជ័យ: ${msg}`);
  }

  const result = await response.json();
  const textPart = result.candidates?.[0]?.content?.parts?.[0]?.text || "";

  return { script: textPart.trim() };
}
