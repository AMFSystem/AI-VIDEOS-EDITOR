// High-performance hardware video frame decoder using WebCodecs VideoDecoder API
export class WebCodecsDecoder {
  constructor(codec = "avc1.640028") {
    this.codec = codec;
    this.decoder = null;
    this.isSupported = typeof window !== "undefined" && "VideoDecoder" in window;
  }

  init(onFrame, onError) {
    if (!this.isSupported) {
      throw new Error("WebCodecs VideoDecoder is not supported in this browser.");
    }

    this.decoder = new VideoDecoder({
      output: (videoFrame) => {
        if (onFrame) onFrame(videoFrame);
        else videoFrame.close();
      },
      error: (err) => {
        if (onError) onError(err);
      },
    });

    this.decoder.configure({
      codec: this.codec,
      optimizeForLatency: true,
    });
  }

  close() {
    if (this.decoder && this.decoder.state !== "closed") {
      this.decoder.close();
      this.decoder = null;
    }
  }
}
