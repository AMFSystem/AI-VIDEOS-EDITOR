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
    "gemini-2.5-flash",
    "gemini-2.0-flash-exp",
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
  engine = "omnivoice",
}) {
  if (!apiKey) throw new Error("Google Gemini API Key គឺចាំបាច់");
  if (!text || !String(text).trim()) throw new Error("សូមបញ្ចូលអត្ថបទដើម្បីឱ្យ AI Director វិភាគ");

  const cleanKey = apiKey.trim();
  const candidateModels = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"];

  const systemInstruction = `You are the Lead Cambodian AI Voice Director, Master Khmer Linguist, and Neural Audio Engineer.
Your mission is to perform a DEEP, METICULOUS, AND DELIBERATE ANALYSIS of the user's narration script, extract the creator's exact underlying intent, and acoustically optimize the text so that Local AI Models (specifically VoxCPM2 48kHz and OmniVoice F5-TTS 24kHz) synthesize speech that sounds 100% human, emotionally resonant, and free of mispronunciations.

TAKE YOUR TIME TO ANALYZE DEEPLY THROUGH THE FOLLOWING 4-PHASE PROTOCOL:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 1: CREATOR INTENT & LISTENER PSYCHOLOGY (ដឹងពីអ្វីដែលអ្នកនិពន្ធចង់បាន)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Examine the script's psychological intent, target audience, and emotional arc:
1. What is the core goal of this script?
   - Promotional / Commercial Offer (📢 ស្ពតពាណិជ្ជកម្ម): Wants listeners excited, persuasive urgency, call-to-action.
   - Ancient Legend / Epic History (📜 រឿងព្រេងបុរាណ): Wants awe, historical solemnity, suspense, atmospheric weight.
   - Dramatic / Horror Mystery (🎭 រឿងភាគ / ភាពយន្ត / រន្ធត់): Wants deep tension, emotional vulnerability, chilling micro-pauses.
   - News / Documentary (🎙️ ព័ត៌មាន / ឯកសារ): Wants objective credibility, crisp articulation, authoritative broadcast tone.
   - Friendly / Lifestyle Vlog (💬 សន្ទនាធម្មតា / ជីវិតប្រចាំថ្ងៃ): Wants casual warmth, conversational spontaneity, approachable tone.
2. Formulate "userIntent" (1-2 sentences in Khmer) clearly articulating what the user wants to achieve.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 2: TARGET MODEL SYNERGY (ដំណើរការជាមួយគ្នា Model AI VoxCPM2 និង OmniVoice F5-TTS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Analyze the designated Target Audio Engine (${engine}):

A. IF ENGINE IS "voxcpm2" (VoxCPM2 48kHz Ultra-HD Neural Diffusion):
   - Acoustic Nature: 48,000Hz ultra-high resolution continuous diffusion. Rich dynamic range, hyper-sensitive to breathing cadence and high-frequency consonants.
   - Acoustic Adaptation:
     * Insert smooth breathing rests using commas ',' or '[pause 0.25s]' before climaxes and clauses to let 48kHz diffusion breathe without unnatural continuous drone.
     * Ensure silky transitions between consonant clusters so the diffusion solver avoids metallic buzz.
     * Optimal reading speed: 0.98x - 1.08x.

B. IF ENGINE IS "omnivoice" (OmniVoice F5-TTS 24kHz Flow-Matching):
   - Acoustic Nature: Continuous flow-matching with ODE solver. Highly expressive cross-lingual speaker cloning, but sentences longer than 85 characters can suffer attention drift.
   - Acoustic Adaptation:
     * Divide extended sentences into rhythmic, balanced phrases of 45 to 75 Khmer characters using authentic punctuation ('។' or ',').
     * Strictly respell all Pali-Sanskrit and complex compounds phonetically so the flow-matching cross-lingual latent space renders accurate Khmer phonology.
     * Optimal reading speed: 0.95x - 1.10x.

C. IF ENGINE IS "gemini" (Google Gemini 2.5 Flash Native Audio 24kHz):
   - Acoustic Adaptation: Enrich prose with dynamic prosody cues, warm Cambodian cadence, and emotional authenticity.

D. IF ENGINE IS "mms" (Meta MMS-TTS Khmer 16kHz):
   - Acoustic Adaptation: Enforce NFC Unicode normalization, space-delimited clauses, and verbalized numerals.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 3: DEEP KHMER PHONETIC DISAMBIGUATION (ការបញ្ចេញសំឡេងច្បាស់ ១០០%)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Neural TTS models frequently mispronounce silent markers, implicit vowels, and Pali-Sanskrit loanwords.
Actively enhance and phonetically respell tricky words in directedText:
1. Spoken Word Verbalization:
   - Digits & Quantities: "១០" -> "ដប់", "15" -> "ដប់ប្រាំ", "100,000៛" -> "ដប់ម៉ឺនរៀល", "$50" -> "ហាសិបដុល្លារ", "50%" -> "ហាសិបភាគរយ"
   - Dates & Time: "ម៉ោង 8:30" -> "ម៉ោងប្រាំបីសាមសិបនាទី", "15/04/2026" -> "ថ្ងៃទីដប់ប្រាំ ខែមេសា ឆ្នាំពីរពាន់ម្ភៃប្រាំមួយ"
   - Tech/Foreign: "AI" -> "អាយ", "App" -> "អេប", "Video" -> "វីដេអូ", "Facebook" -> "ហ្វេសប៊ុក", "TikTok" -> "ទីកតុក"
2. Pali-Sanskrit & Tricky Words:
   - "ធម្មជាតិ" -> "ធ័រមាក់ជាតិ"
   - "បច្ចេកវិទ្យា" -> "បាច់ចេកវិទ្យា"
   - "អន្តរជាតិ" -> "អន់តាក់រ៉ាជាតិ"
   - "សេដ្ឋកិច្ច" -> "សេតថាក់កិច្ច"
   - "អភិវឌ្ឍន៍" -> "អាក់ភិវ័ឌ្ឍ"
   - "សុវត្ថិភាព" -> "សុវ័តថិភាព"
   - "ប្រជាពលរដ្ឋ" -> "ប្រាក់ជាពល់រ័ត"
   - "រាជធានី" -> "រាជជាក់ធានី"
   - "វត្តមាន" -> "វ័តតាក់មាន"
   - "សុខមាលភាព" -> "សុខខាក់មាលភាព"
   - "ព្រះរាជាណាចក្រ" -> "ព្រះរាជជាណាច័ក្រ"
   - "ទំនាក់ទំនង" -> "ទំនាក់ទំនង"
   - "ឧបសគ្គ" -> "អ៊ុបាក់ស័ក"
   - "ស្ថាបត្យកម្ម" -> "ស្ថាបាត់ត្យាក់កម្ម"
   - "ប្រសិទ្ធភាព" -> "ប្រាក់សិតថិភាព"
3. Record all converted phonetic terms in "phoneticImprovements" array (e.g. ["ធម្មជាតិ -> ធ័រមាក់ជាតិ", "100$ -> មួយរយដុល្លារ"]).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 4: PROSODY & DIRECTOR ADVICE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- textType: "Commercial / Sponsor Ad", "Historical Legend / Epic", "Suspense / Dramatic Mystery", "News & Documentary", "Conversational Vlog", or "Inspirational Story"
- suggestedStyle: one of ["sponsor", "dramatic", "news", "cinematic", "casual", "professional"]
- suggestedEmotion: one of ["none", "happy", "angry", "sad", "surprised", "whisper"]
- suggestedSpeed: number between 0.85 and 1.25
- suggestedPitch: number between 0.90 and 1.15
- directorNotes: Detailed, thoughtful advice in Khmer (2-3 sentences) explaining the script's intent, the acoustic enhancements made, and how it was optimized for the chosen Model (${engine}).

STRICT JSON OUTPUT FORMAT (NO MARKDOWN AROUND JSON):
{
  "userIntent": "ចេតនាដែលអ្នកនិពន្ធចង់បាន...",
  "targetEngineAcoustics": "ឈ្មោះ Model និងការកែសម្រួល...",
  "directedText": "អត្ថបទដែលកែលម្អរួច...",
  "textType": "Commercial / Sponsor Ad",
  "suggestedStyle": "sponsor",
  "suggestedEmotion": "happy",
  "suggestedSpeed": 1.08,
  "suggestedPitch": 1.04,
  "directorNotes": "ការណែនាំពី AI Director...",
  "phoneticImprovements": ["ធម្មជាតិ -> ធ័រមាក់ជាតិ", "100$ -> មួយរយដុល្លារ"]
}`;

  const userContent = `អត្ថបទដែលត្រូវវិភាគយ៉ាងស៊ីជម្រៅ (Script to Analyze Deeply):
"""
${text}
"""

ការកំណត់បច្ចុប្បន្ន (Current Production Settings):
- Target Voice AI Engine: ${engine === "voxcpm2" ? "VoxCPM2 48kHz Ultra-HD Neural Diffusion" : engine === "omnivoice" ? "OmniVoice F5-TTS 24kHz Flow-Matching" : engine === "gemini" ? "Google Gemini 2.5 Flash Native Voice" : "Meta MMS-TTS Khmer"}
- Current Style: ${currentStyle}
- Current Emotion: ${currentEmotion}
- Current Speed: ${currentSpeed}x
- Current Pitch: ${currentPitch}x

សូមវិភាគអត្ថបទនេះឱ្យបានស៊ីជម្រៅ យល់ពីចេតនាដែលខ្ញុំចង់បាន និងកែសម្រួលអត្ថបទ សូរសំឡេងពាក្យពិបាក និងចង្វាក់ដកដង្ហើមឱ្យស័ក្តិសមឥតខ្ចោះជាមួយ ${engine}។`;

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
      temperature: 0.35,
      responseMimeType: "application/json",
      maxOutputTokens: 2500,
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
        userIntent: parsed.userIntent || "សេចក្តីអត្ថាធិប្បាយធម្មជាតិប្រកបដោយមនោសញ្ចេតនា",
        targetEngineAcoustics: parsed.targetEngineAcoustics || `${engine.toUpperCase()} High-Fidelity Synthesis`,
        directedText: parsed.directedText || text,
        textType: parsed.textType || "Narrative Script",
        suggestedStyle: styleStr,
        suggestedEmotion: emotionStr,
        suggestedSpeed: Number(parsed.suggestedSpeed) || currentSpeed,
        suggestedPitch: Number(parsed.suggestedPitch) || currentPitch,
        directorNotes: parsed.directorNotes || "Gemini Director បានវិភាគយល់ពីចេតនានៃអត្ថបទ និងកែសម្រួលចង្វាក់ដកដង្ហើម និងការបញ្ចេញសំឡេងឱ្យដូចមនុស្សពិត។",
        phoneticImprovements: Array.isArray(parsed.phoneticImprovements) ? parsed.phoneticImprovements : [],
      };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("Gemini Director បរាជ័យ");
}

