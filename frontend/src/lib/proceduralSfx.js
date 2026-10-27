/**
 * Procedural Audio Synthesis for Sound & Voice Effects
 * Generates crisp, real Web Audio WAV blobs directly in-browser.
 */

function audioBufferToWav(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const numSamples = buffer.length * numChannels;
  const byteRate = (sampleRate * numChannels * bitDepth) / 8;
  const blockAlign = (numChannels * bitDepth) / 8;
  const dataSize = numSamples * (bitDepth / 8);
  const headerSize = 44;
  const totalSize = headerSize + dataSize;
  const arrayBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuffer);

  function writeString(offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  const channelData = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channelData.push(buffer.getChannelData(ch));
  }

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channelData[ch][i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

export async function generateProceduralSfx(type) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const sampleRate = ctx.sampleRate;

  let duration = 3;
  if (type === "cinematic-trailer") duration = 14;
  else if (type === "whoosh-boom") duration = 8;
  else if (type === "deep-boom") duration = 5;
  else if (type === "glitch-rise") duration = 4;
  else if (type === "bell-ding") duration = 2;
  else if (type === "camera-click") duration = 1.5;
  else if (type === "robot-voice") duration = 3.5;
  else if (type === "whoosh-fast") duration = 1.2;

  const offline = new OfflineAudioContext(2, Math.floor(sampleRate * duration), sampleRate);

  if (type === "whoosh-boom") {
    // 1. Whoosh sweep (0 to 1.5s)
    const noiseBuffer = offline.createBuffer(1, sampleRate * 2, sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseBuffer.length; i++) output[i] = Math.random() * 2 - 1;
    const noise = offline.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = offline.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(150, 0);
    filter.frequency.exponentialRampToValueAtTime(3200, 1.2);
    filter.frequency.exponentialRampToValueAtTime(200, 2.0);

    const noiseGain = offline.createGain();
    noiseGain.gain.setValueAtTime(0.01, 0);
    noiseGain.gain.linearRampToValueAtTime(0.85, 1.15);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, 2.2);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(offline.destination);
    noise.start(0);

    // 2. Heavy Sub Boom (impact at 1.15s, lingering decay to 8s)
    const osc = offline.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(110, 1.15);
    osc.frequency.exponentialRampToValueAtTime(28, 4.0);

    const boomGain = offline.createGain();
    boomGain.gain.setValueAtTime(0.001, 0);
    boomGain.gain.setValueAtTime(0.95, 1.15);
    boomGain.gain.exponentialRampToValueAtTime(0.0001, 7.8);

    osc.connect(boomGain);
    boomGain.connect(offline.destination);
    osc.start(1.15);
  } else if (type === "cinematic-trailer") {
    // Cinematic trailer drone chord + pulsing rhythm (14s)
    const freqs = [55, 110, 164.81, 220]; // A1, A2, E3, A3
    freqs.forEach((f, idx) => {
      const osc = offline.createOscillator();
      osc.type = idx % 2 === 0 ? "sawtooth" : "sine";
      osc.frequency.setValueAtTime(f, 0);
      osc.frequency.linearRampToValueAtTime(f * 1.05, 12);

      const fFilter = offline.createBiquadFilter();
      fFilter.type = "lowpass";
      fFilter.frequency.setValueAtTime(400, 0);
      fFilter.frequency.exponentialRampToValueAtTime(2400, 10);
      fFilter.frequency.exponentialRampToValueAtTime(200, 13.8);

      const gain = offline.createGain();
      gain.gain.setValueAtTime(0.001, 0);
      gain.gain.linearRampToValueAtTime(0.25 / freqs.length, 2.5);
      gain.gain.setValueAtTime(0.25 / freqs.length, 10);
      gain.gain.exponentialRampToValueAtTime(0.0001, 13.8);

      osc.connect(fFilter);
      fFilter.connect(gain);
      gain.connect(offline.destination);
      osc.start(0);
    });
  } else if (type === "deep-boom") {
    const osc = offline.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(130, 0);
    osc.frequency.exponentialRampToValueAtTime(25, 3.5);

    const gain = offline.createGain();
    gain.gain.setValueAtTime(1.0, 0);
    gain.gain.exponentialRampToValueAtTime(0.0001, 4.8);

    osc.connect(gain);
    gain.connect(offline.destination);
    osc.start(0);
  } else if (type === "bell-ding") {
    const osc = offline.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1320, 0); // E6

    const osc2 = offline.createOscillator();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(2640, 0);

    const gain = offline.createGain();
    gain.gain.setValueAtTime(0.8, 0);
    gain.gain.exponentialRampToValueAtTime(0.0001, 1.9);

    osc.connect(gain);
    osc2.connect(gain);
    gain.connect(offline.destination);
    osc.start(0);
    osc2.start(0);
  } else {
    // Default punchy whoosh
    const osc = offline.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(350, 0);
    osc.frequency.exponentialRampToValueAtTime(60, duration * 0.8);
    const gain = offline.createGain();
    gain.gain.setValueAtTime(0.7, 0);
    gain.gain.exponentialRampToValueAtTime(0.001, duration * 0.95);
    osc.connect(gain);
    gain.connect(offline.destination);
    osc.start(0);
  }

  const renderedBuffer = await offline.startRendering();
  const blob = audioBufferToWav(renderedBuffer);
  return { blob, duration };
}
