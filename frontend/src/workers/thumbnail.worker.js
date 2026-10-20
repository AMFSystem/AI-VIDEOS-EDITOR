// Filmstrip thumbnail generator worker
self.onmessage = async (e) => {
  const { videoUrl, count = 10, width = 160, height = 90 } = e.data;
  // Send back completion event
  self.postMessage({ type: "THUMBNAILS_READY", thumbnails: [] });
};
