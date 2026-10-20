// Audio Effect DSP nodes (Equalizer, Compressor, Reverb)
export function createEqualizer(audioCtx) {
  const low = audioCtx.createBiquadFilter();
  low.type = "lowshelf";
  low.frequency.value = 320;

  const mid = audioCtx.createBiquadFilter();
  mid.type = "peaking";
  mid.frequency.value = 1000;
  mid.Q.value = 0.5;

  const high = audioCtx.createBiquadFilter();
  high.type = "highshelf";
  high.frequency.value = 3200;

  low.connect(mid);
  mid.connect(high);

  return { input: low, output: high, low, mid, high };
}

export function createCompressor(audioCtx) {
  const comp = audioCtx.createDynamicsCompressor();
  comp.threshold.setValueAtTime(-24, audioCtx.currentTime);
  comp.knee.setValueAtTime(30, audioCtx.currentTime);
  comp.ratio.setValueAtTime(12, audioCtx.currentTime);
  comp.attack.setValueAtTime(0.003, audioCtx.currentTime);
  comp.release.setValueAtTime(0.25, audioCtx.currentTime);
  return comp;
}
