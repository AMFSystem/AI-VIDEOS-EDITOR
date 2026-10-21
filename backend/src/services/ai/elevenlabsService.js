import { logger } from "../../utils/logger.js";

export const elevenlabsService = {
  /**
   * Clone a voice using ElevenLabs Instant Voice Cloning API
   * @param {Object} params
   * @param {string} params.name - Voice profile name
   * @param {string} params.apiKey - ElevenLabs API key
   * @param {Buffer} params.audioBuffer - Audio samples buffer
   * @param {string} [params.mimeType="audio/wav"] - MIME type of the audio
   * @param {string} [params.description] - Voice description
   * @returns {Promise<{ voiceId: string, name: string }>}
   */
  async cloneVoice({ name, apiKey, audioBuffer, mimeType = "audio/wav", description = "Cloned from Timeline Studio" }) {
    if (!apiKey || !String(apiKey).trim()) {
      throw new Error("ElevenLabs API Key គឺចាំបាច់");
    }
    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error("ឯកសារសំឡេងគំរូមិនត្រឹមត្រូវ");
    }

    const trimmedKey = String(apiKey).trim();
    const formData = new FormData();
    formData.append("name", (name || "My Cloned Voice").trim());
    
    const audioBlob = new Blob([audioBuffer], { type: mimeType });
    formData.append("files", audioBlob, "sample_audio.wav");
    if (description) {
      formData.append("description", description);
    }

    logger.info(`[ElevenLabs] Sending voice clone request for: ${name}`);

    const res = await fetch("https://api.elevenlabs.io/v1/voices/add", {
      method: "POST",
      headers: {
        "xi-api-key": trimmedKey,
      },
      body: formData,
    });

    if (!res.ok) {
      const errText = await res.text();
      let errDetail = errText;
      try {
        const parsed = JSON.parse(errText);
        errDetail = parsed?.detail?.message || parsed?.detail || errText;
      } catch (_) {}
      logger.error(`[ElevenLabs] Voice clone failed: ${errDetail}`);
      throw new Error(`ElevenLabs Clone Failed: ${errDetail}`);
    }

    const data = await res.json();
    logger.info(`[ElevenLabs] Successfully created voice with ID: ${data.voice_id}`);

    return {
      voiceId: data.voice_id,
      name: name || "Cloned Voice",
    };
  },

  /**
   * Synthesize speech using a cloned or default voice on ElevenLabs
   * @param {Object} params
   * @param {string} params.text - Text to speak
   * @param {string} params.voiceId - ElevenLabs voice ID
   * @param {string} params.apiKey - ElevenLabs API key
   * @param {string} [params.modelId="eleven_multilingual_v2"] - Model ID
   * @param {Object} [params.voiceSettings] - Stability and similarity settings
   * @returns {Promise<Buffer>}
   */
  async synthesize({
    text,
    voiceId,
    apiKey,
    modelId = "eleven_multilingual_v2",
    voiceSettings = {},
  }) {
    if (!apiKey || !String(apiKey).trim()) {
      throw new Error("ElevenLabs API Key គឺចាំបាច់");
    }
    let targetVoiceId = String(voiceId || "").trim();
    if (!targetVoiceId || targetVoiceId.startsWith("gemini_") || targetVoiceId.length < 10) {
      targetVoiceId = "21m00Tcm4TlvDq8ikWAM"; // Default Rachel voice
    }
    if (!text || !String(text).trim()) {
      throw new Error("អត្ថបទត្រូវនិយាយគឺចាំបាច់");
    }

    const trimmedKey = String(apiKey).trim();
    const payload = {
      text: String(text).trim(),
      model_id: modelId,
      voice_settings: {
        stability: typeof voiceSettings.stability === "number" ? voiceSettings.stability : 0.5,
        similarity_boost: typeof voiceSettings.similarityBoost === "number" ? voiceSettings.similarityBoost : 0.85,
        style: typeof voiceSettings.style === "number" ? voiceSettings.style : 0.0,
        use_speaker_boost: voiceSettings.useSpeakerBoost !== false,
      },
    };

    logger.info(`[ElevenLabs] Synthesizing speech with voice ${targetVoiceId}, text length: ${payload.text.length}`);

    let res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(targetVoiceId)}`, {
      method: "POST",
      headers: {
        "xi-api-key": trimmedKey,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok && res.status === 404 && targetVoiceId !== "21m00Tcm4TlvDq8ikWAM") {
      logger.warn(`[ElevenLabs] Voice ${targetVoiceId} not found (404), retrying with default Rachel voice...`);
      res = await fetch("https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM", {
        method: "POST",
        headers: {
          "xi-api-key": trimmedKey,
          "Content-Type": "application/json",
          "Accept": "audio/mpeg",
        },
        body: JSON.stringify(payload),
      });
    }

    if (!res.ok) {
      const errText = await res.text();
      let errDetail = errText;
      try {
        const parsed = JSON.parse(errText);
        errDetail = parsed?.detail?.message || parsed?.detail || errText;
      } catch (_) {}
      logger.error(`[ElevenLabs] TTS failed: ${errDetail}`);
      throw new Error(`ElevenLabs TTS Failed: ${errDetail}`);
    }

    const arrayBuf = await res.arrayBuffer();
    return Buffer.from(arrayBuf);
  },

  /**
   * Verify an ElevenLabs API key and fetch user account info
   * @param {Object} params
   * @param {string} params.apiKey
   * @returns {Promise<Object>}
   */
  async verifyApiKey({ apiKey }) {
    if (!apiKey || !String(apiKey).trim()) {
      throw new Error("ElevenLabs API Key គឺចាំបាច់");
    }

    const trimmedKey = String(apiKey).trim();
    const res = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
      headers: {
        "xi-api-key": trimmedKey,
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`ElevenLabs API Key មិនត្រឹមត្រូវ: ${errText}`);
    }

    const data = await res.json();
    return {
      valid: true,
      tier: data.tier,
      characterCount: data.character_count,
      characterLimit: data.character_limit,
      canUseInstantVoiceCloning: data.can_use_instant_voice_cloning ?? true,
    };
  },
};
