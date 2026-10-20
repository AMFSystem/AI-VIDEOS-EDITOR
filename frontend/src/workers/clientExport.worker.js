// Client-side quick MP4 muxer / export worker
self.onmessage = async (e) => {
  const { type, settings } = e.data;
  self.postMessage({ type: "EXPORT_PROGRESS", percent: 100 });
};
