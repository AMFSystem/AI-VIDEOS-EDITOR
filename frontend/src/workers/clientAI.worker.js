// In-browser lightweight WebGPU / ONNX AI worker
self.onmessage = async (e) => {
  const { type, payload } = e.data;
  self.postMessage({ type: `${type}_RESULT`, success: true });
};
