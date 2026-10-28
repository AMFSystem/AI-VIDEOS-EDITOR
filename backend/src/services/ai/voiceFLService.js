import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { config } from "../../config/index.js";
import { fileManager } from "../storage/fileManager.js";
import { logger } from "../../utils/logger.js";

/**
 * VoiceFLService
 * Professional FL Studio-grade Voice Mastering & Audio Edition Engine.
 * Implements Edison De-Noise, NewTone Pitch Tuning, 4-Band Parametric EQ,
 * Soundgoodizer Saturation/Compression, De-Esser, Studio Reverb, and True-Peak Limiter.
 */
export class VoiceFLService {
  constructor() {
    this.presets = {
      original_raw_voice: {
        id: "original_raw_voice",
        name: "Original Voice",
        nameKm: "សំឡេងដើម (Raw)",
        denoise: 0,
        noiseGate: -60,
        lowCut: false,
        deEsser: 0,
        pitchShift: 0,
        eqLow: 0,
        eqMid: 0,
        eqHigh: 0,
        eqAir: 0,
        soundgoodizerMode: "A",
        soundgoodizerAmount: 0,
        reverbRoom: 0,
        reverbWet: 0,
        outputGain: 1.0,
      },
      podcast_studio_master: {
        id: "podcast_studio_master",
        name: "Studio Podcast 100%",
        nameKm: "ផតខាស ស្ទូឌីយោ 100%",
        denoise: 75,
        noiseGate: -42,
        lowCut: true,
        deEsser: 65,
        pitchShift: 0,
        eqLow: 3.5,
        eqMid: 0.5,
        eqHigh: 3.2,
        eqAir: 3.8,
        soundgoodizerMode: "A",
        soundgoodizerAmount: 62,
        reverbRoom: 8,
        reverbWet: 6,
        outputGain: 1.15,
      },
      podcast_shure_sm7b: {
        id: "podcast_shure_sm7b",
        name: "Shure SM7B Broadcast",
        nameKm: "សំឡេង Shure SM7B វិទ្យុ",
        denoise: 80,
        noiseGate: -40,
        lowCut: true,
        deEsser: 70,
        pitchShift: 0,
        eqLow: 4.5,
        eqMid: -0.5,
        eqHigh: 3.8,
        eqAir: 4.2,
        soundgoodizerMode: "B",
        soundgoodizerAmount: 68,
        reverbRoom: 6,
        reverbWet: 5,
        outputGain: 1.2,
      },
      podcast_intimate_story: {
        id: "podcast_intimate_story",
        name: "Storyteller Intimate",
        nameKm: "និទានរឿង កក់ក្ដៅ",
        denoise: 68,
        noiseGate: -44,
        lowCut: true,
        deEsser: 60,
        pitchShift: 0,
        eqLow: 3.8,
        eqMid: 1.0,
        eqHigh: 2.2,
        eqAir: 3.0,
        soundgoodizerMode: "C",
        soundgoodizerAmount: 58,
        reverbRoom: 14,
        reverbWet: 10,
        outputGain: 1.1,
      },
      podcast_crisp: {
        id: "podcast_crisp",
        name: "Podcast Studio Clear",
        nameKm: "សំឡេងផតខាស ច្បាស់បែប Studio",
        denoise: 65,
        noiseGate: -38,
        lowCut: true,
        deEsser: 60,
        pitchShift: 0,
        eqLow: 1.5,
        eqMid: -1.0,
        eqHigh: 3.5,
        eqAir: 2.0,
        soundgoodizerMode: "A",
        soundgoodizerAmount: 45,
        reverbRoom: 12,
        reverbWet: 8,
        outputGain: 1.0,
      },
      cinema_deep: {
        id: "cinema_deep",
        name: "Cinematic Warm Voice",
        nameKm: "សំឡេងភាពយន្ត បុរាណ ជ្រៅក្រាស់",
        denoise: 50,
        noiseGate: -42,
        lowCut: false,
        deEsser: 45,
        pitchShift: -1,
        eqLow: 4.0,
        eqMid: 1.5,
        eqHigh: 1.0,
        eqAir: 1.5,
        soundgoodizerMode: "C",
        soundgoodizerAmount: 60,
        reverbRoom: 35,
        reverbWet: 20,
        outputGain: 1.2,
      },
      radio_broadcaster: {
        id: "radio_broadcaster",
        name: "FM Radio Broadcaster",
        nameKm: "សំឡេងវិទ្យុ FM Professional",
        denoise: 75,
        noiseGate: -35,
        lowCut: true,
        deEsser: 70,
        pitchShift: 0,
        eqLow: 3.0,
        eqMid: 2.0,
        eqHigh: 4.0,
        eqAir: 3.0,
        soundgoodizerMode: "B",
        soundgoodizerAmount: 70,
        reverbRoom: 10,
        reverbWet: 8,
        outputGain: 1.1,
      },
      crystal_clean: {
        id: "crystal_clean",
        name: "Edison Crystal Clean",
        nameKm: "កាត់ Noise 100% សំឡេងថ្លាដូចកញ្ចក់",
        denoise: 90,
        noiseGate: -32,
        lowCut: true,
        deEsser: 50,
        pitchShift: 0,
        eqLow: 0,
        eqMid: 0,
        eqHigh: 2.0,
        eqAir: 3.0,
        soundgoodizerMode: "A",
        soundgoodizerAmount: 30,
        reverbRoom: 5,
        reverbWet: 5,
        outputGain: 1.0,
      },
      modern_vocal_tune: {
        id: "modern_vocal_tune",
        name: "Modern Tuned Vocal",
        nameKm: "Vocal Auto-Tune បែបទំនើប",
        denoise: 60,
        noiseGate: -40,
        lowCut: true,
        deEsser: 75,
        pitchShift: 1,
        eqLow: -1.0,
        eqMid: 0.5,
        eqHigh: 4.5,
        eqAir: 5.0,
        soundgoodizerMode: "D",
        soundgoodizerAmount: 75,
        reverbRoom: 40,
        reverbWet: 25,
        outputGain: 1.05,
      },
    };
  }

  getPresets() {
    return Object.values(this.presets);
  }

  /**
   * Builds an FFmpeg complex audio filter chain matching the requested FL Studio rack parameters
   */
  buildFilterChain(options = {}) {
    const filters = [];

    // 1. 80Hz Low-Cut (Highpass) to eliminate low mic rumble / wind / AC hum
    if (options.lowCut) {
      filters.push("highpass=f=80");
    }

    // 2. Noise Gate (FL Studio Edison Gate)
    if (options.noiseGate && Number(options.noiseGate) < -10) {
      const thresh = Math.max(-60, Math.min(-15, Number(options.noiseGate)));
      filters.push(`agate=threshold=${thresh}dB:ratio=3:attack=10:release=80`);
    }

    // 3. FFT Denoise (Edison Spectral Denoise)
    const denoiseVal = Number(options.denoise ?? 0);
    if (denoiseVal > 5) {
      const nr = Math.min(30, Math.max(5, (denoiseVal / 100) * 28)).toFixed(1);
      const nf = Math.min(-15, -45 + (denoiseVal / 100) * 20).toFixed(1);
      filters.push(`afftdn=nr=${nr}:nf=${nf}:tn=1`);
    }

    // 4. Pitch Tuning / Shift (Semitones or Cents)
    const pitchShift = Number(options.pitchShift ?? 0);
    if (pitchShift !== 0 && Math.abs(pitchShift) <= 12) {
      // ratio: 2^(semitones / 12)
      const ratio = Math.pow(2, pitchShift / 12);
      const targetRate = Math.round(44100 * ratio);
      const tempoCompensation = (1 / ratio).toFixed(4);
      filters.push(`asetrate=${targetRate},aresample=44100,atempo=${tempoCompensation}`);
    }

    // 5. 4-Band Parametric EQ (FL Studio Fruity Parametric EQ 2 style)
    const eqLow = Number(options.eqLow ?? 0);
    const eqMid = Number(options.eqMid ?? 0);
    const eqHigh = Number(options.eqHigh ?? 0);
    const eqAir = Number(options.eqAir ?? 0);

    if (Math.abs(eqLow) > 0.2) {
      filters.push(`equalizer=f=120:width_type=o:width=1.2:g=${eqLow.toFixed(1)}`);
    }
    if (Math.abs(eqMid) > 0.2) {
      filters.push(`equalizer=f=1200:width_type=o:width=1.5:g=${eqMid.toFixed(1)}`);
    }
    if (Math.abs(eqHigh) > 0.2) {
      filters.push(`equalizer=f=4200:width_type=o:width=1.4:g=${eqHigh.toFixed(1)}`);
    }
    if (Math.abs(eqAir) > 0.2) {
      filters.push(`equalizer=f=11000:width_type=o:width=1.0:g=${eqAir.toFixed(1)}`);
    }

    // 6. De-Esser (Harsh S and T frequency tamer)
    const deEsser = Number(options.deEsser ?? 0);
    if (deEsser > 10) {
      const intensity = (deEsser / 100).toFixed(2);
      filters.push(`deesser=i=${intensity}:f=0.5:m=0.5`);
    }

    // 7. Soundgoodizer / Multiband Saturation & Punch (Maximus Engine)
    const sgAmount = Number(options.soundgoodizerAmount ?? 0);
    if (sgAmount > 5) {
      const factor = sgAmount / 100;
      const mode = (options.soundgoodizerMode || "A").toUpperCase();
      // Apply specialized compand curves for modes A, B, C, D
      if (mode === "A") {
        // Mode A: Vocal presence & punch
        filters.push(`compand=attacks=0.01:decays=0.08:points=-70/-70|-35/-20|-15/-8|0/0:gain=${(factor * 2).toFixed(1)}`);
      } else if (mode === "B") {
        // Mode B: Warm bass & chest warmth
        filters.push(`compand=attacks=0.02:decays=0.12:points=-65/-65|-30/-16|-12/-6|0/0:gain=${(factor * 2.5).toFixed(1)}`);
      } else if (mode === "C") {
        // Mode C: Deep cinematic loudness
        filters.push(`compand=attacks=0.03:decays=0.15:points=-60/-60|-25/-12|-8/-4|0/0:gain=${(factor * 3).toFixed(1)}`);
      } else {
        // Mode D: Air & aggressive compression
        filters.push(`compand=attacks=0.005:decays=0.05:points=-80/-80|-40/-22|-18/-9|0/0:gain=${(factor * 2).toFixed(1)}`);
      }
    }

    // 8. Fruity Reverb 2 / Studio Ambience
    const revRoom = Number(options.reverbRoom ?? 0);
    const revWet = Number(options.reverbWet ?? 0);
    if (revWet > 5) {
      const inGain = 0.88;
      const outGain = (1 - (revWet / 200)).toFixed(2);
      const delay = Math.round(20 + (revRoom / 100) * 50);
      const decay = (0.15 + (revRoom / 100) * 0.35).toFixed(2);
      filters.push(`aecho=${inGain}:${outGain}:${delay}:${decay}`);
    }

    // 9. Output Gain & True-Peak Limiter (Zero Distortion)
    const outputGain = Number(options.outputGain ?? 1.0);
    if (Math.abs(outputGain - 1.0) > 0.05) {
      filters.push(`volume=${outputGain.toFixed(2)}`);
    }
    // True-Peak Brickwall Limiter at -0.3dB
    filters.push("alimiter=limit=-0.3dB:attack=5:release=50:asc=1");

    return filters.join(",");
  }

  /**
   * Process an audio file with Voice FL mastering parameters
   */
  async processAudio(inputPath, options = {}) {
    if (!inputPath || !fsSync.existsSync(inputPath)) {
      throw new Error(`Input audio file not found: ${inputPath}`);
    }

    const filterString = this.buildFilterChain(options);
    const ext = path.extname(inputPath) || ".wav";
    const filename = `voice_fl_${Date.now()}_${path.basename(inputPath, ext)}.wav`;
    const outputPath = fileManager.getFilePath("temp", filename);

    return new Promise((resolve, reject) => {
      const args = [
        "-y",
        "-i", inputPath,
        "-af", filterString,
        "-c:a", "pcm_s16le",
        "-ar", "44100",
        outputPath
      ];

      logger.info(`[VoiceFLService] Processing with filters: ${filterString}`);
      const proc = spawn(config.ffmpegPath, args);
      let stderr = "";

      proc.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      proc.on("close", (code) => {
        if (code === 0 && fsSync.existsSync(outputPath)) {
          const stats = fsSync.statSync(outputPath);
          resolve({
            success: true,
            originalPath: inputPath,
            masteredAudioPath: outputPath,
            filename,
            fileSize: stats.size,
            filterChain: filterString,
            settings: options,
          });
        } else {
          logger.error(`[VoiceFLService] FFmpeg failed with code ${code}: ${stderr}`);
          reject(new Error(`Voice FL processing failed: ${stderr.slice(-300)}`));
        }
      });

      proc.on("error", (err) => {
        logger.error(`[VoiceFLService] Spawn error: ${err.message}`);
        reject(err);
      });
    });
  }
}

export const voiceFLService = new VoiceFLService();
