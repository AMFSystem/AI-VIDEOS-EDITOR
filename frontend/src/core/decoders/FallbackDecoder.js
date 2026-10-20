// Fallback decoder using standard HTML5 <video> elements
export class FallbackDecoder {
  constructor(videoUrl) {
    this.video = document.createElement("video");
    this.video.src = videoUrl;
    this.video.crossOrigin = "anonymous";
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.preload = "auto";
  }

  async seek(timeSeconds) {
    return new Promise((resolve) => {
      const onSeeked = () => {
        this.video.removeEventListener("seeked", onSeeked);
        resolve(this.video);
      };
      this.video.addEventListener("seeked", onSeeked);
      this.video.currentTime = timeSeconds;
    });
  }

  destroy() {
    this.video.src = "";
    this.video.load();
  }
}
