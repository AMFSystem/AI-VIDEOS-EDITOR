/**
 * Voice FL Audio Engine
 * High-performance Web Audio API Digital Signal Processing (DSP) Rack
 * Designed after FL Studio's Edison, NewTone, Fruity Parametric EQ 2, Soundgoodizer, and Maximus.
 */

export const VOICE_FL_PRESETS = [
  {
    id: "podcast_crisp",
    name: "Studio Clear",
    nameKm: "ផតខាសច្បាស់",
    icon: "🎙️",
    desc: "សំឡេងច្បាស់ល្អ កាត់ Noise",
    settings: {
      denoise: 65,
      noiseGate: -40,
      lowCut: true,
      deEsser: 60,
      pitchShift: 0,
      eqLow: 2.0,
      eqMid: -1.0,
      eqHigh: 4.0,
      eqAir: 2.5,
      soundgoodizerMode: "A",
      soundgoodizerAmount: 50,
      reverbRoom: 15,
      reverbWet: 10,
      outputGain: 1.0,
    },
  },
  {
    id: "cinema_deep",
    name: "Cinema Warm",
    nameKm: "ភាពយន្តកក់ក្តៅ",
    icon: "👑",
    desc: "សំឡេងកក់ក្តៅ ជ្រៅក្រាស់",
    settings: {
      denoise: 50,
      noiseGate: -42,
      lowCut: false,
      deEsser: 45,
      pitchShift: -1,
      eqLow: 4.5,
      eqMid: 1.5,
      eqHigh: 1.5,
      eqAir: 2.0,
      soundgoodizerMode: "C",
      soundgoodizerAmount: 65,
      reverbRoom: 35,
      reverbWet: 20,
      outputGain: 1.1,
    },
  },
  {
    id: "radio_broadcaster",
    name: "Radio FM",
    nameKm: "សំឡេងវិទ្យុ",
    icon: "🎧",
    desc: "សំឡេង Punch បែបវិទ្យុ",
    settings: {
      denoise: 75,
      noiseGate: -35,
      lowCut: true,
      deEsser: 70,
      pitchShift: 0,
      eqLow: 3.5,
      eqMid: 2.0,
      eqHigh: 4.5,
      eqAir: 3.5,
      soundgoodizerMode: "B",
      soundgoodizerAmount: 70,
      reverbRoom: 10,
      reverbWet: 8,
      outputGain: 1.1,
    },
  },
  {
    id: "crystal_clean",
    name: "Noise Clean",
    nameKm: "កាត់ Noise សុទ្ធ",
    icon: "💎",
    desc: "បំបាត់សំឡេងរំខាន 100%",
    settings: {
      denoise: 90,
      noiseGate: -32,
      lowCut: true,
      deEsser: 55,
      pitchShift: 0,
      eqLow: 0.5,
      eqMid: 0.0,
      eqHigh: 2.5,
      eqAir: 3.0,
      soundgoodizerMode: "A",
      soundgoodizerAmount: 35,
      reverbRoom: 5,
      reverbWet: 5,
      outputGain: 1.0,
    },
  },
  {
    id: "modern_vocal_tune",
    name: "Vocal Tune",
    nameKm: "តម្រូវសំឡេង Tune",
    icon: "🎵",
    desc: "សំឡេងភ្លឺចែងចាំង បែប Modern",
    settings: {
      denoise: 60,
      noiseGate: -40,
      lowCut: true,
      deEsser: 75,
      pitchShift: 1,
      eqLow: -1.0,
      eqMid: 1.0,
      eqHigh: 5.0,
      eqAir: 5.5,
      soundgoodizerMode: "D",
      soundgoodizerAmount: 80,
      reverbRoom: 40,
      reverbWet: 25,
      outputGain: 1.05,
    },
  },
  {
    id: "deep_bass_boost",
    name: "Bass Boost",
    nameKm: "បុក Bass ក្រាស់",
    icon: "🔊",
    desc: "បង្កើនកម្លាំង Bass និង Low-end",
    settings: {
      denoise: 55,
      noiseGate: -40,
      lowCut: false,
      deEsser: 40,
      pitchShift: 0,
      eqLow: 5.5,
      eqMid: 0.5,
      eqHigh: 2.0,
      eqAir: 1.5,
      soundgoodizerMode: "C",
      soundgoodizerAmount: 75,
      reverbRoom: 20,
      reverbWet: 12,
      outputGain: 1.15,
    },
  },
];

export const DEFAULT_FL_SETTINGS = {
  denoise: 60,
  noiseGate: -40,
  lowCut: true,
  deEsser: 50,
  pitchShift: 0,
  eqLow: 1.5,
  eqMid: 0.0,
  eqHigh: 3.0,
  eqAir: 2.0,
  soundgoodizerMode: "A",
  soundgoodizerAmount: 50,
  reverbRoom: 15,
  reverbWet: 10,
  outputGain: 1.0,
};

/**
 * Creates an interconnected DSP audio graph inside the provided AudioContext
 */
export function createVoiceFLGraph(audioContext, settings = DEFAULT_FL_SETTINGS) {
  const ctx = audioContext;

  // 1. Input & Bypass Switch
  const inputNode = ctx.createGain();
  const dryGain = ctx.createGain();
  const wetGain = ctx.createGain();

  // 2. Highpass Filter (80Hz Low-Cut / De-rumble)
  const lowCutNode = ctx.createBiquadFilter();
  lowCutNode.type = "highpass";
  lowCutNode.frequency.value = settings.lowCut ? 80 : 20;
  lowCutNode.Q.value = 0.7;

  // 3. Noise Gate / Downward Expander Node
  const gateNode = ctx.createDynamicsCompressor();
  gateNode.threshold.value = Math.max(-60, Math.min(-15, settings.noiseGate || -40));
  gateNode.knee.value = 6;
  gateNode.ratio.value = 4;
  gateNode.attack.value = 0.005;
  gateNode.release.value = 0.08;

  // 4. 4-Band Parametric EQ (Fruity Parametric EQ 2 Style)
  const eqLow = ctx.createBiquadFilter();
  eqLow.type = "lowshelf";
  eqLow.frequency.value = 120;
  eqLow.gain.value = settings.eqLow || 0;

  const eqMid = ctx.createBiquadFilter();
  eqMid.type = "peaking";
  eqMid.frequency.value = 1200;
  eqMid.Q.value = 1.2;
  eqMid.gain.value = settings.eqMid || 0;

  const eqHigh = ctx.createBiquadFilter();
  eqHigh.type = "peaking";
  eqHigh.frequency.value = 4500;
  eqHigh.Q.value = 1.4;
  eqHigh.gain.value = settings.eqHigh || 0;

  const eqAir = ctx.createBiquadFilter();
  eqAir.type = "highshelf";
  eqAir.frequency.value = 11000;
  eqAir.gain.value = settings.eqAir || 0;

  // 5. De-Esser (Notch / High Peaking attenuator)
  const deEsser = ctx.createBiquadFilter();
  deEsser.type = "peaking";
  deEsser.frequency.value = 6800;
  deEsser.Q.value = 2.0;
  const deEsserGain = -(Math.max(0, settings.deEsser || 0) / 100) * 8.0;
  deEsser.gain.value = deEsserGain;

  // 6. Soundgoodizer (Maximus Multiband Saturation / Punch)
  const soundgoodizer = ctx.createDynamicsCompressor();
  const sgAmount = (settings.soundgoodizerAmount || 0) / 100;
  soundgoodizer.threshold.value = -18 - sgAmount * 12;
  soundgoodizer.knee.value = 10;
  soundgoodizer.ratio.value = 2.5 + sgAmount * 4.5;
  soundgoodizer.attack.value = 0.01;
  soundgoodizer.release.value = 0.12;

  // 7. Fruity Reverb 2 / Studio Ambience
  const reverbDelay = ctx.createDelay();
  const revTime = 0.02 + ((settings.reverbRoom || 10) / 100) * 0.06;
  reverbDelay.delayTime.value = revTime;

  const reverbFeedback = ctx.createGain();
  reverbFeedback.gain.value = 0.25 + ((settings.reverbRoom || 10) / 100) * 0.35;

  const reverbDamp = ctx.createBiquadFilter();
  reverbDamp.type = "lowpass";
  reverbDamp.frequency.value = 4500;

  const reverbWetGain = ctx.createGain();
  reverbWetGain.gain.value = ((settings.reverbWet || 10) / 100) * 0.5;

  // Reverb loop
  reverbDelay.connect(reverbDamp);
  reverbDamp.connect(reverbFeedback);
  reverbFeedback.connect(reverbDelay);
  reverbDamp.connect(reverbWetGain);

  // 8. Output Limiter & True-Peak Ceiling
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -0.5;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.05;

  // 9. Master Gain
  const masterGain = ctx.createGain();
  masterGain.gain.value = settings.outputGain || 1.0;

  // 10. Live Visualizer Analyser Node
  const analyserNode = ctx.createAnalyser();
  analyserNode.fftSize = 256;
  analyserNode.smoothingTimeConstant = 0.82;

  // Connect Processing Chain
  inputNode.connect(dryGain);
  inputNode.connect(lowCutNode);
  lowCutNode.connect(gateNode);
  gateNode.connect(eqLow);
  eqLow.connect(eqMid);
  eqMid.connect(eqHigh);
  eqHigh.connect(eqAir);
  eqAir.connect(deEsser);
  deEsser.connect(soundgoodizer);

  // Split into direct wet & reverb wet
  soundgoodizer.connect(wetGain);
  soundgoodizer.connect(reverbDelay);

  // Sum wet + reverb
  const wetSum = ctx.createGain();
  wetGain.connect(wetSum);
  reverbWetGain.connect(wetSum);

  // Default wet is 1, dry is 0 (Mastered mode)
  wetGain.gain.value = 1;
  dryGain.gain.value = 0;

  // Output stage
  wetSum.connect(limiter);
  dryGain.connect(limiter);
  limiter.connect(masterGain);
  masterGain.connect(analyserNode);

  /**
   * Smoothly updates rack parameters without any audio glitches
   */
  function updateSettings(nextSettings, isBypassed = false) {
    const t = ctx.currentTime;
    const ramp = 0.04;

    if (isBypassed) {
      dryGain.gain.setTargetAtTime(1, t, ramp);
      wetGain.gain.setTargetAtTime(0, t, ramp);
      reverbWetGain.gain.setTargetAtTime(0, t, ramp);
      return;
    }

    dryGain.gain.setTargetAtTime(0, t, ramp);
    wetGain.gain.setTargetAtTime(1, t, ramp);

    // Low Cut
    lowCutNode.frequency.setTargetAtTime(nextSettings.lowCut ? 80 : 20, t, ramp);

    // Noise Gate
    gateNode.threshold.setTargetAtTime(
      Math.max(-60, Math.min(-15, nextSettings.noiseGate || -40)),
      t,
      ramp
    );

    // Parametric EQ
    eqLow.gain.setTargetAtTime(nextSettings.eqLow || 0, t, ramp);
    eqMid.gain.setTargetAtTime(nextSettings.eqMid || 0, t, ramp);
    eqHigh.gain.setTargetAtTime(nextSettings.eqHigh || 0, t, ramp);
    eqAir.gain.setTargetAtTime(nextSettings.eqAir || 0, t, ramp);

    // De-Esser
    const deGain = -(Math.max(0, nextSettings.deEsser || 0) / 100) * 8.0;
    deEsser.gain.setTargetAtTime(deGain, t, ramp);

    // Soundgoodizer
    const sg = (nextSettings.soundgoodizerAmount || 0) / 100;
    soundgoodizer.threshold.setTargetAtTime(-18 - sg * 12, t, ramp);
    soundgoodizer.ratio.setTargetAtTime(2.5 + sg * 4.5, t, ramp);

    // Reverb
    const revT = 0.02 + ((nextSettings.reverbRoom || 10) / 100) * 0.06;
    reverbDelay.delayTime.setTargetAtTime(revT, t, ramp);
    reverbFeedback.gain.setTargetAtTime(0.25 + ((nextSettings.reverbRoom || 10) / 100) * 0.35, t, ramp);
    reverbWetGain.gain.setTargetAtTime(((nextSettings.reverbWet || 10) / 100) * 0.5, t, ramp);

    // Master
    masterGain.gain.setTargetAtTime(nextSettings.outputGain || 1.0, t, ramp);
  }

  return {
    inputNode,
    outputNode: analyserNode,
    analyserNode,
    updateSettings,
  };
}

/**
 * Offline rendering: Takes an AudioBuffer and renders the mastered audio into a high-fidelity WAV Blob
 */
export async function renderMasteredAudioOffline(sourceBuffer, settings = DEFAULT_FL_SETTINGS) {
  const offlineCtx = new OfflineAudioContext(
    sourceBuffer.numberOfChannels,
    sourceBuffer.length,
    sourceBuffer.sampleRate
  );

  const sourceNode = offlineCtx.createBufferSource();
  sourceNode.buffer = sourceBuffer;

  // Handle Pitch Shift on source node if needed
  if (settings.pitchShift && settings.pitchShift !== 0) {
    sourceNode.playbackRate.value = Math.pow(2, settings.pitchShift / 12);
  }

  const rack = createVoiceFLGraph(offlineCtx, settings);
  sourceNode.connect(rack.inputNode);
  rack.outputNode.connect(offlineCtx.destination);

  sourceNode.start(0);
  const renderedBuffer = await offlineCtx.startRendering();

  return audioBufferToWavBlob(renderedBuffer);
}

/**
 * Encodes AudioBuffer into standard 16-bit PCM WAV Blob
 */
export function audioBufferToWavBlob(buffer) {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const out = new DataView(new ArrayBuffer(length));
  const channels = [];
  let offset = 0;
  let pos = 0;

  function writeString(str) {
    for (let i = 0; i < str.length; i++) {
      out.setUint8(pos++, str.charCodeAt(i));
    }
  }

  // RIFF header
  writeString("RIFF");
  out.setUint32(pos, length - 8, true);
  pos += 4;
  writeString("WAVE");

  // fmt subchunk
  writeString("fmt ");
  out.setUint32(pos, 16, true);
  pos += 4; // SubChunk1Size
  out.setUint16(pos, 1, true);
  pos += 2; // PCM format
  out.setUint16(pos, numOfChan, true);
  pos += 2;
  out.setUint32(pos, buffer.sampleRate, true);
  pos += 4;
  out.setUint32(pos, buffer.sampleRate * numOfChan * 2, true);
  pos += 4; // byte rate
  out.setUint16(pos, numOfChan * 2, true);
  pos += 2; // block align
  out.setUint16(pos, 16, true);
  pos += 2; // bits per sample

  // data subchunk
  writeString("data");
  out.setUint32(pos, length - pos - 4, true);
  pos += 4;

  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  while (offset < buffer.length) {
    for (let i = 0; i < numOfChan; i++) {
      let sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      out.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([out.buffer], { type: "audio/wav" });
}
