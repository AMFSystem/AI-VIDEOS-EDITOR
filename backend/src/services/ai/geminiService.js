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
 * @param {string} [vocalPersona] Deep acoustic profile from auditioning pass
 * @returns {string}
 */
export function buildHumanVocalPrompt(
  text,
  vocalStyle = "natural_warm",
  hasAudio = false,
  vocalPersona = ""
) {
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

  const personaSection = vocalPersona
    ? `\n[DEEP LISTENING ACOUSTIC VOCAL PERSONA]:
The speaker's voice has been auditioned and analyzed with deep listening:
${vocalPersona.trim()}
Strictly match this speaker's timbre, pitch melody, breathing cadence, and vocal texture.\n`
    : "";

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
${personaSection}${audioGuidance}

Speak the following text with this exact human vocal tone, inflection, and cadence in authentic Khmer (ភាសាខ្មែរ) without any introduction, greetings, or meta-comments:

${text.trim()}`;
}

/**
 * Deep Acoustic Auditioning:
 * Gemini listens deeply to the speaker's audio recording (15s to 60s+)
 * and extracts a rich, detailed Vocal Persona directive.
 * @param {object} params
 * @param {string} params.apiKey
 * @param {Buffer|null} [params.audioBuffer]
 * @param {string|null} [params.audioBase64]
 * @param {string} [params.mimeType="audio/wav"]
 * @param {string} [params.language="km"]
 * @returns {Promise<string>}
 */
export async function analyzeGeminiVocalPersona({
  apiKey,
  audioBuffer = null,
  audioBase64 = null,
  mimeType = "audio/wav",
  language = "km",
}) {
  if (!apiKey) throw new Error("Google Gemini API Key គឺចាំបាច់");
  const rawBase64 = audioBase64
    ? audioBase64.replace(/^data:[^;]+;base64,/, "")
    : audioBuffer
    ? audioBuffer.toString("base64")
    : null;
  if (!rawBase64) throw new Error("ទិន្នន័យសំឡេងគឺចាំបាច់សម្រាប់ការវិភាគ");

  const cleanKey = apiKey.trim();
  const auditionPrompt = `You are an expert audio acoustic engineer and vocal casting director.
Listen carefully to the entire audio recording attached. This speaker's voice will be cloned for human-sounding Khmer text-to-speech.

Analyze the speaker deeply across all acoustic dimensions:
1. Gender and estimated vocal age (e.g. young woman, mature man).
2. Fundamental pitch (F0 range, average pitch, melodic pitch inflection curves when emphasizing words).
3. Timbre & resonance (chest resonance warmth, throat frequencies, vocal tract formant characteristics, brightness vs softness, airiness/breathiness).
4. Cadence & Rhythm (speaking speed, pauses, micro-breath intake frequency between phrases, natural Cambodian speech flow).
5. Emotional undertone & personality (warm, friendly, confident, soothing, engaging).

Provide a concise, highly specific 3 to 5 sentence Voice Profile Directive. Format it as direct instructions to an audio generator to reproduce this exact voice identically. Do not include markdown headers or meta-text.`;

  const candidateModels = ["gemini-2.0-flash", "gemini-1.5-flash"];
  let lastError = null;

  for (const model of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType: mimeType || "audio/wav",
                    data: rawBase64,
                  },
                },
                { text: auditionPrompt },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1024,
          },
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        lastError = new Error(errJson?.error?.message || `HTTP ${response.status}`);
        continue;
      }

      const result = await response.json();
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text && text.trim()) {
        return text.trim();
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("មិនអាចវិភាគសំឡេងតាម Gemini បានទេ");
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
 * @param {string} [params.vocalPersona] Deep acoustic persona
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
  vocalPersona = "",
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
    "gemini-2.0-flash",
    "gemini-2.0-flash-exp",
    "gemini-1.5-flash",
  ];

  let lastError = null;

  for (const model of candidateModels) {
    // Attempt 1: Try with audio reference if present, else prompt only
    const attempts = rawBase64 ? [true, false] : [false];

    for (const withAudio of attempts) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`;
        const promptText = buildHumanVocalPrompt(text, vocalStyle, withAudio, vocalPersona);

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

/**
 * Auto-Direct Khmer Script for Voice Synthesis & Cloning with Google Gemini
 * @param {object} params
 * @param {string} params.apiKey
 * @param {string} params.text
 * @param {string} [params.currentStyle]
 * @param {string} [params.currentEmotion]
 * @param {number} [params.currentSpeed]
 * @param {number} [params.currentPitch]
 * @param {string} [params.engine]
 * @returns {Promise<{
 *   directedText: string,
 *   textType: string,
 *   suggestedStyle: string,
 *   suggestedEmotion: string,
 *   suggestedSpeed: number,
 *   suggestedPitch: number,
 *   directorNotes: string
 * }>}
 */
export async function directGeminiVoiceoverScript({
  apiKey,
  text,
  currentStyle = "professional",
  currentEmotion = "none",
  currentSpeed = 1.0,
  currentPitch = 1.0,
  engine = "mms",
}) {
  if (!apiKey) throw new Error("Google Gemini API Key គឺចាំបាច់");
  if (!text || !String(text).trim()) throw new Error("សូមបញ្ចូលអត្ថបទដើម្បីឱ្យ AI Director វិភាគ");

  const cleanKey = apiKey.trim();
  const candidateModels = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-pro"];

  const systemInstruction = `You are an elite Cambodian AI Voice Director, Khmer Linguist, and Commercial Audio Engineer.
Your task is to analyze, rewrite, and direct Khmer text for neural Text-to-Speech (TTS) and Voice Cloning engines (such as VoxCPM2 48kHz, OmniVoice F5-TTS, and Meta MMS) to make the synthesized speech sound 100% natural, human-like, and accurately tailored to the chosen Style and Emotion.

CRITICAL INSTRUCTIONS FOR directedText:
1. YOU MUST ACTIVELY ENHANCE THE SCRIPT FOR SPOKEN VOICE:
   - Convert all numerals, prices, percentages, dates, and phone numbers into full spoken Khmer words:
     * "ម៉ោង ២" -> "ម៉ោងពីរ"
     * "១០" / "10" -> "ដប់"
     * "$50" / "50$" -> "ហាសិបដុល្លារ"
     * "100,000៛" -> "ដប់ម៉ឺនរៀល"
     * "50%" -> "ហាសិបភាគរយ"
     * "012 345 678" -> "សូន្យ ដប់ពីរ បីរយសែសិបប្រាំ ប្រាំមួយរយកៅសិបប្រាំបី"
   - Insert expressive breathing pauses using natural commas, full stops, or '[pause 0.3s]', '[pause 0.4s]', or '[pause 0.5s]' before dramatic transitions or key reveals.
   - Refine sentence flow so the local voice model sounds like an authentic human with no awkward tongue-twisters.
   - DO NOT return the script verbatim unchanged. Every script MUST have audible vocal improvements.

2. STYLE & EMOTION DELIVERY RULES:
   - "sponsor" (📢 ស្ពតពាណិជ្ជកម្ម / Commercial Sponsor Ad):
     * Vibe: Energetic, enthusiastic, persuasive, punchy!
     * Delivery: Insert micro-pauses before brand names, product features, and call-to-actions. Use exclamation marks '!' for excitement on offers/benefits.
     * Suggested Speed: 1.08 - 1.15. Suggested Pitch: 1.04 - 1.08. Emotion: "happy" or "none".
   - "dramatic" (🎭 រឿងភាគ/បុរាណ / Mystery):
     * Vibe: Emotionally intense, measured, solemn, suspenseful.
     * Suggested Speed: 0.90 - 0.95. Suggested Pitch: 0.93 - 0.98.
   - "news" (🎙️ ព័ត៌មាន / អត្ថាធិប្បាយ):
     * Vibe: Articulate, authoritative, objective, crisp broadcast tone.
     * Suggested Speed: 1.02 - 1.06. Suggested Pitch: 1.00.
   - "cinematic" (🎬 ភាពយន្ត / Epic Movie Trailer):
     * Vibe: Grand, deep resonance, dramatic gravitas.
     * Suggested Speed: 0.88 - 0.94. Suggested Pitch: 0.92 - 0.96.
   - "casual" (💬 សន្ទនាធម្មតា / Daily Vlog):
     * Vibe: Friendly, approachable, natural everyday conversational flow.
     * Suggested Speed: 1.00. Suggested Pitch: 1.00.
   - "professional" (👔 ផ្លូវការ / Corporate / Narration):
     * Vibe: Polished, clear, respectful.
     * Suggested Speed: 1.00. Suggested Pitch: 1.00.

3. AUTO-DETECTION & USER STYLE ALIGNMENT:
   - If the user explicitly selected a Style (e.g. currentStyle is "sponsor", "dramatic", "news", etc.), HONOR that choice and direct the vocal cadence specifically to excel in that requested style!
   - If currentStyle is "professional" or general, but the text contains promotional/commercial cues (e.g. "បញ្ចុះតម្លៃ", "ប្រូម៉ូសិន", "ទិញឥឡូវនេះ", "ទាក់ទង", "រង្វាន់", "$", "%", "ហាង"), auto-detect textType as "Commercial / Sponsor Ad" and set suggestedStyle to "sponsor".
   - textType: e.g. "Commercial / Sponsor Ad", "Suspense / Horror Mystery", "Historical Drama", "News & Documentary", "Storytelling / Legend", "Conversational Dialogue"
   - suggestedStyle: one of ["professional", "sponsor", "dramatic", "news", "cinematic", "casual"] (lowercase)
   - suggestedEmotion: one of ["none", "happy", "angry", "sad", "surprised", "whisper"] (lowercase)
   - suggestedSpeed: number between 0.85 and 1.25
   - suggestedPitch: number between 0.90 and 1.15
   - directorNotes: A concise 1-2 sentence advice in Khmer explaining exactly what was improved for the voice artist.

Respond in STRICT JSON format:
{
  "directedText": "...",
  "textType": "...",
  "suggestedStyle": "...",
  "suggestedEmotion": "...",
  "suggestedSpeed": 1.10,
  "suggestedPitch": 1.05,
  "directorNotes": "..."
}`;

  const userContent = `អត្ថបទបច្ចុប្បន្ន (Current Script):
${text}

ការកំណត់បច្ចុប្បន្ន (Current Settings):
- Style: ${currentStyle}
- Emotion: ${currentEmotion}
- Speed: ${currentSpeed}x
- Pitch: ${currentPitch}x
- Target Audio Engine: ${engine}

សូមជួយ Direct និងកែលម្អអត្ថបទនេះឱ្យមានចង្វាក់និយាយដូចមនុស្សពិតៗ (បម្លែងលេខជាពាក្យ និងដាក់ pause សមស្រប) និងកំណត់ Settings ដ៏ល្អបំផុតជាទម្រង់ JSON។`;

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
      temperature: 0.3,
      responseMimeType: "application/json",
      maxOutputTokens: 1500,
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
        lastError = new Error(`Gemini Director (${model}) បរាជ័យ: ${msg}`);
        continue;
      }

      const result = await response.json();
      const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        lastError = new Error(`Gemini (${model}) មិនបានឆ្លើយតបអត្ថបទទេ`);
        continue;
      }

      // Parse JSON safely with fallback
      let parsed = null;
      try {
        const cleanJsonStr = rawText
          .replace(/```json\s*/gi, "")
          .replace(/```\s*$/gi, "")
          .trim();
        parsed = JSON.parse(cleanJsonStr);
      } catch {
        const match = rawText.match(/\{[\s\S]*\}/);
        if (match) {
          try {
            parsed = JSON.parse(match[0]);
          } catch {}
        }
      }

      if (!parsed || typeof parsed !== "object") {
        lastError = new Error(`Gemini (${model}) ឆ្លើយតបទិន្នន័យមិនអាចបំប្លែងជា JSON បាន`);
        continue;
      }

      const styleStr = String(parsed.suggestedStyle || currentStyle).toLowerCase().trim();
      const emotionStr = String(parsed.suggestedEmotion || currentEmotion).toLowerCase().trim();

      return {
        directedText: parsed.directedText || text,
        textType: parsed.textType || "Narrative Script",
        suggestedStyle: styleStr,
        suggestedEmotion: emotionStr,
        suggestedSpeed: Number(parsed.suggestedSpeed) || currentSpeed,
        suggestedPitch: Number(parsed.suggestedPitch) || currentPitch,
        directorNotes: parsed.directorNotes || "Gemini បានកែលម្អចង្វាក់ដកដង្ហើម និងការបញ្ចេញសំឡេងឱ្យដូចមនុស្សពិត។",
      };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("Gemini Director បរាជ័យ");
}

