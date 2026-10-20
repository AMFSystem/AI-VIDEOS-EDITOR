// Audio peak waveform extractor worker
self.onmessage = async (e) => {
  const { channelData, samples = 100 } = e.data;
  if (!channelData) {
    self.postMessage({ type: "WAVEFORM_READY", peaks: [] });
    return;
  }
  const blockSize = Math.floor(channelData.length / samples);
  const peaks = [];
  for (let i = 0; i < samples; i++) {
    let max = 0;
    for (let j = 0; j < blockSize; j++) {
      const val = Math.abs(channelData[i * blockSize + j] || 0);
      if (val > max) max = val;
    }
    peaks.push(max);
  }
  self.postMessage({ type: "WAVEFORM_READY", peaks });
};
