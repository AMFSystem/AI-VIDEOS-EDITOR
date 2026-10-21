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
 * Synthesize speech using Gemini 2.0 / 2.5 Flash Audio Output
 * Supports Multimodal in-context audio reference cloning and Cambodian human inflection.
 * @param {object} params
 * @param {string} params.apiKey
 * @param {string} params.text
 * @param {string} [params.voiceName] Puck, Charon, Kore, Fenrir, Aoede
 * @param {Buffer|null} [params.audioBuffer] Reference audio buffer
 * @param {string|null} [params.audioBase64] Reference audio base64
 * @param {string} [params.mimeType] Reference audio mime type
 * @param {string} [params.vocalStyle] natural_warm, storytelling, news_anchor, emotional, energetic
 * @returns {Promise<{ buffer: Buffer, mimeType: string }>}
 */
export async function synthesizeGeminiSpeech({
  apiKey,
  text,
  voiceName = "Aoede",
  audioBuffer = null,
  audioBase64 = null,
  mimeType = "audio/wav",
  vocalStyle = "natural_warm",
}) {
  if (!apiKey) throw new Error("Google Gemini API Key គឺចាំបាច់");
  if (!text || !text.trim()) throw new Error("អត្ថបទសម្រាប់និយាយគឺចាំបាច់");

  const cleanKey = apiKey.trim();
  const allowedVoices = ["Aoede", "Charon", "Fenrir", "Kore", "Puck"];
  const chosenVoice = allowedVoices.includes(voiceName) ? voiceName : "Aoede";

  const rawBase64 = audioBase64
    ? audioBase64.replace(/^data:[^;]+;base64,/, "")
    : audioBuffer
    ? audioBuffer.toString("base64")
    : null;

  const candidateModels = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-preview-tts",
    "gemini-2.0-flash-exp",
    "gemini-2.0-flash",
  ];

  let lastError = null;

  for (const model of candidateModels) {
    // Attempt 1: Try with audio reference if present, else prompt only
    const attempts = rawBase64 ? [true, false] : [false];

    for (const withAudio of attempts) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`;
        const promptText = buildHumanVocalPrompt(text, vocalStyle, withAudio);

        const parts = [];
        if (withAudio && rawBase64) {
          parts.push({
            inlineData: {
              mimeType: mimeType || "audio/wav",
              data: rawBase64,
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
          lastError = new Error(`Gemini Audio Generation (${model}) បរាជ័យ: ${msg}`);
          // If this attempt was with audio, continue inner loop to retry without audio
          continue;
        }

        const result = await response.json();
        const candidate = result.candidates?.[0];
        const audioPart = candidate?.content?.parts?.find((p) => p.inlineData);

        if (!audioPart || !audioPart.inlineData?.data) {
          lastError = new Error(`Gemini (${model}) មិនបានបញ្ជូនទិន្នន័យសំឡេងត្រឡប់មកវិញទេ`);
          continue;
        }

        const rawBuffer = Buffer.from(audioPart.inlineData.data, "base64");
        const respMime = audioPart.inlineData.mimeType || "audio/pcm;rate=24000";

        // If Gemini returned raw PCM, wrap in standard WAV header for browser audio element playback
        if (respMime.includes("pcm") || respMime.includes("raw")) {
          const wavBuffer = pcmToWavBuffer(rawBuffer, 24000, 1);
          return { buffer: wavBuffer, mimeType: "audio/wav" };
        }

        return { buffer: rawBuffer, mimeType: respMime };
      } catch (err) {
        lastError = err;
      }
    }
  }

  throw lastError || new Error("Gemini Audio Generation បរាជ័យគ្រប់ម៉ូដែល");
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
  const candidateModels = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-2.0-flash"];

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

  let lastError = null;
  for (const model of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const msg = errJson?.error?.message || `HTTP ${response.status}`;
        lastError = new Error(`Gemini Script Generation (${model}) បរាជ័យ: ${msg}`);
        continue;
      }

      const result = await response.json();
      const textCandidate = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textCandidate) {
        lastError = new Error(`Gemini (${model}) មិនបានឆ្លើយតបអត្ថបទទេ`);
        continue;
      }

      return { script: textCandidate.trim() };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("Gemini Script Generation បរាជ័យ");
}
