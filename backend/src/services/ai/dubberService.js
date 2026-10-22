  /**
 * AI Story & Movie Dubber Service
 * Handles:
 * 1. Story / Dialogue Translation into natural Khmer storytelling narration
 * 2. Audio/Video dialogue transcription + translation
 * 3. Synthesis coordination using Cloned Voices (Gemini, VoxCPM2, ElevenLabs)
 */

import { synthesizeGeminiSpeech, pcmToWavBuffer } from "./geminiService.js";
import { voxcpmService } from "./voxcpmService.js";
import { elevenlabsService } from "./elevenlabsService.js";

/**
 * Robust JSON parser that handles markdown code fences, trailing commas, and wrapping text
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
 * Checks if a string contains Khmer characters (Unicode \u1780-\u17ff)
 */
function containsKhmer(str) {
  return /[\u1780-\u17ff]/.test(str || "");
}

/**
 * Translate text using Google Translate API (Free, high accuracy, standard Google Translation)
 * @param {object} params
 * @param {string} params.text
 * @param {string} [params.sourceLang="auto"]
 * @param {string} [params.targetLang="km"]
 * @returns {Promise<{ translatedText: string, segments: Array<{ index: number, text: string }>, detectedLanguage: string, model: string }>}
 */
export async function translateWithGoogle({ text, sourceLang = "auto", targetLang = "km" }) {
  if (!text || !text.trim()) {
    return { translatedText: "", segments: [], detectedLanguage: sourceLang, model: "google-translate" };
  }

  const sl = sourceLang === "auto" ? "auto" : sourceLang;
  const tl = targetLang || "km";

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
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error(`Google Translate returned HTTP ${response.status}`);
  }

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

/**
 * Translate Story / Movie Dialogue into natural Khmer narration script
 * @param {object} params
 * @param {string} params.text
 * @param {string} [params.sourceLang="auto"]
 * @param {string} [params.targetLang="km"]
 * @param {string} [params.style="cinematic_story"]
 * @param {string} params.apiKey
 * @param {string} [params.model="gemini-2.0-flash"]
 * @returns {Promise<{ translatedText: string, segments?: Array<{ index: number, text: string }>, model: string }>}
 */
export async function translateStoryScript({
  text,
  sourceLang = "auto",
  targetLang = "km",
  style = "cinematic_story",
  apiKey,
  model = "gemini-2.0-flash",
}) {
  if (!text || !text.trim()) {
    throw new Error("សូមបញ្ចូលអត្ថបទ ឬសាច់រឿងដែលត្រូវបកប្រែ");
  }

  // If user selected Google Translate or has no API key, use official Google Translate!
  if (model === "google-translate" || !apiKey || !apiKey.trim()) {
    return await translateWithGoogle({ text, sourceLang, targetLang });
  }

  const cleanKey = apiKey.trim();

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
  const targetLangFull = tlNames[targetLang] || targetLang;

  const isTargetKhmer = targetLang === "km";
  const khmerRules = isTargetKhmer
    ? `\nSPECIAL KHMER DUBBING & ORTHOGRAPHY RULES:
- Translate into natural Cambodian cinematic dubbing style (ភាសាបញ្ចូលសំឡេងរឿងកុនរស់រវើក និងពីរោះ មិនបកប្រែពាក្យមួយៗតាមរបៀបម៉ាស៊ីន)។
- Khmer words MUST be written together without inserting spaces between every word (ភាសាខ្មែរមិនដកឃ្លារវាងពាក្យឡើយ)។
- Only insert a space between clauses, phrases, or distinct thoughts (ដកឃ្លាតែពេលចប់ឃ្លា ឬរបះ)។
- End complete thoughts or sentences with the Khmer full-stop '។' (សញ្ញាខណ្ឌ)។
- Preserve line breaks exactly so each input line corresponds to one output line.`
    : "";

  const systemInstruction = `You are a professional movie subtitle translator and video dubber.
Your ONLY task is to translate the given text into ${targetLangFull}.

CRITICAL RULES:
1. Output ONLY the translated text in ${targetLangFull}. Do NOT include original text or explanations.
2. Do NOT mix languages. Do NOT leave foreign words untranslated unless they are proper names.
3. Keep the exact same number of lines/paragraphs as the input text.
4. Style: ${chosenStylePrompt}${khmerRules}
5. Do NOT add meta commentary or markdown codeblocks.`;

  // Case A: OpenAI API (sk-...)
  if (cleanKey.startsWith("sk-") && !cleanKey.startsWith("sk-ant-") && (model === "openai-gpt4o" || model.startsWith("gpt-"))) {
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cleanKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: `Translate this text to ${targetLangFull}:\n\n${text.trim()}` },
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
      console.warn("[Dubber OpenAI Translation] error:", err.message);
    }
  }

  // Case B: DeepSeek API
  if (model === "deepseek-v3" || cleanKey.startsWith("sk-") && model.includes("deepseek")) {
    try {
      const response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cleanKey}`,
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: `Translate this text to ${targetLangFull}:\n\n${text.trim()}` },
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
      console.warn("[Dubber DeepSeek Translation] error:", err.message);
    }
  }

  // Case C: Google Gemini (Default & Most Capable for Khmer)
  const candidateModels = Array.from(new Set([
    model && model.startsWith("gemini-") && !model.includes("2.5") ? model : "gemini-2.0-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
  ])).filter((m) => m && m.startsWith("gemini-") && !m.includes("2.5"));

  const userPrompt = `Translate the following dialogue/script to ${targetLangFull}.
Source Language: ${sourceLang}
Output ONLY the ${targetLangFull} translation:

"""
${text.trim()}
"""`;

  const requestBody = {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents: [{ parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 8192,
    },
  };

  let lastError = null;
  for (const m of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${cleanKey}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const msg = errJson?.error?.message || `HTTP ${response.status}`;
        console.error(`[Dubber Translation] Model ${m} failed (HTTP ${response.status}):`, msg);
        lastError = new Error(`Dubber Translation (${m}): ${msg}`);
        continue;
      }

      const result = await response.json();
      const translated = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!translated) {
        lastError = new Error(`Gemini (${m}) returned empty translation`);
        continue;
      }

      const cleanTranslated = translated.trim();
      const rawLines = cleanTranslated.split(/\n+/).map((l) => l.trim()).filter(Boolean);
      const segments = rawLines.map((line, idx) => ({ index: idx + 1, text: line }));

      return {
        translatedText: cleanTranslated,
        segments,
        model: m,
      };
    } catch (err) {
      lastError = err;
    }
  }

  // Graceful fallback to Google Translate if all Gemini candidates fail
  try {
    console.warn("[Dubber Translation] Gemini failed, falling back to Google Translate...");
    return await translateWithGoogle({ text, sourceLang, targetLang });
  } catch (gErr) {
    throw lastError || gErr || new Error("ការបកប្រែសាច់រឿងបរាជ័យគ្រប់ម៉ូដែល");
  }
}

/**
 * Transcribe Audio directly from Video, then Translate to Khmer Subtitles & Script
 * @param {object} params
 * @param {string} params.audioBase64
 * @param {string} [params.mimeType="audio/wav"]
 * @param {string} [params.sourceLang="auto"]
 * @param {string} [params.targetLang="km"]
 * @param {string} [params.style="cinematic_story"]
 * @param {string} params.apiKey
 * @param {string} [params.model="gemini-2.0-flash"]
 * @returns {Promise<{ originalTranscript: string, detectedLanguage: string, translatedKhmerText: string, subtitles: Array<{ start: number, end: number, original: string, khmer: string }> }>}
 */
export async function transcribeAndTranslateVideoAudio({
  audioBase64,
  mimeType = "audio/wav",
  sourceLang = "auto",
  targetLang = "km",
  style = "cinematic_story",
  apiKey,
  model = "gemini-2.0-flash",
}) {
  if (!audioBase64) {
    throw new Error("ត្រូវការទិន្នន័យសំឡេង (audio data) ពីវីដេអូ");
  }
  if (!apiKey || !apiKey.trim()) {
    throw new Error("API Key គឺចាំបាច់");
  }

  const cleanKey = apiKey.trim();
  const tlNames = {
    km: "Khmer (ភាសាខ្មែរ)", en: "English", zh: "Chinese (中文)", th: "Thai (ภาษาไทย)",
    ko: "Korean (한국어)", ja: "Japanese (日本語)", vi: "Vietnamese (Tiếng Việt)",
    fr: "French (Français)", es: "Spanish (Español)", de: "German (Deutsch)",
    pt: "Portuguese (Português)", ru: "Russian (русский)", ar: "Arabic (عربي)",
    hi: "Hindi (हिन्दी)", id: "Indonesian (Bahasa Indonesia)", ms: "Malay (Bahasa Melayu)",
    tl: "Filipino (Tagalog)", my: "Burmese (မြန်မာဘာသာ)", lo: "Lao (ລາវ)",
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

  // Gemini candidate models (prioritize real, active models)
  const candidateModels = Array.from(new Set([
    model && model.startsWith("gemini-") && !model.includes("2.5") ? model : "gemini-2.0-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
  ])).filter((m) => m && m.startsWith("gemini-") && !m.includes("2.5"));

  const requestBody = {
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: mimeType || "audio/wav",
              data: audioBase64,
            },
          },
          { text: prompt },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.3,
      responseMimeType: "application/json",
      maxOutputTokens: 8192,
    },
  };

  let lastError = null;
  for (const m of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${cleanKey}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const msg = errJson?.error?.message || `HTTP ${response.status}`;
        console.error(`[Dubber Audio Transcribe] Model ${m} failed (HTTP ${response.status}):`, msg);
        lastError = new Error(`Gemini Audio Dubber (${m}): ${msg}`);
        continue;
      }

      const resData = await response.json();
      const rawText = resData.candidates?.[0]?.content?.parts?.[0]?.text;
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

      // Dual-pass verification: Check if Khmer translation is actually present and no Chinese left
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
        console.log("[Dubber] Audio returned un-translated Khmer, executing explicit Khmer translation pass...");
        try {
          const tr = await translateStoryScript({
            text: parsed.originalTranscript,
            sourceLang: parsed.detectedLanguage || sourceLang,
            targetLang: "km",
            style,
            apiKey: cleanKey,
            model: m,
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
          console.warn("[Dubber] Dual-pass translation pass error:", trErr);
        }
      }

      return parsed;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("ការស្រង់ Transcript និងបកប្រែវីដេអូបរាជ័យ");
}

/**
 * Synthesize Dubbing Speech using the specified Cloned Voice
 * @param {object} params
 * @param {string} params.text
 * @param {object} params.profile - Cloned voice profile
 * @param {number} [params.speed=1.0]
 * @param {string} [params.geminiKey]
 * @param {string} [params.elevenLabsKey]
 * @returns {Promise<{ audioBuffer: Buffer, mimeType: string }>}
 */
export async function synthesizeDubbingSpeech({
  text,
  profile,
  speed = 1.0,
  geminiKey,
  elevenLabsKey,
}) {
  if (!text || !text.trim()) {
    throw new Error("សូមបញ្ចូលអត្ថបទដែលត្រូវបញ្ចូលសំឡេង");
  }

  const cleanText = text.trim();
  const engine = profile?.engine || "gemini";

  // Case 1: Gemini Cloned Profile
  if (engine === "gemini" || profile?.geminiVoiceName) {
    if (!geminiKey) throw new Error("Google Gemini API Key គឺចាំបាច់");
    const voiceName = (
      profile?.geminiVoiceName ||
      (profile?.gender === "male" ? "Fenrir" : "Aoede")
    ).replace("gemini_", "");

    const res = await synthesizeGeminiSpeech({
      apiKey: geminiKey,
      text: cleanText,
      voiceName,
      vocalStyle: profile?.vocalTone || "storytelling",
    });

    return { audioBuffer: res.buffer, mimeType: res.mimeType || "audio/wav" };
  }

  // Case 2: VoxCPM2 Offline 48kHz
  if (engine === "voxcpm2" || profile?.model?.includes("VoxCPM")) {
    const wavBuffer = await voxcpmService.synthesizeSpeech({
      text: cleanText,
      profile,
      speed,
      language: profile.language || "km",
    });
    return { audioBuffer: wavBuffer, mimeType: "audio/wav" };
  }

  // Case 3: ElevenLabs
  if (engine === "elevenlabs" && profile?.elevenlabsVoiceId) {
    if (!elevenLabsKey) throw new Error("ElevenLabs API Key គឺចាំបាច់");
    const audioBuffer = await elevenlabsService.synthesize({
      apiKey: elevenLabsKey,
      voiceId: profile.elevenlabsVoiceId,
      text: cleanText,
      modelId: "eleven_multilingual_v2",
    });
    return { audioBuffer, mimeType: "audio/mpeg" };
  }

  throw new Error(`ម៉ូដែលសំឡេង "${engine}" មិនត្រូវបានគាំទ្រ`);
}
