// WebGL2 / 2D Canvas Compositor blending multiple video tracks, overlays, and effects
export class Compositor {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas?.getContext("2d");
  }

  setCanvas(canvas) {
    this.canvas = canvas;
    this.ctx = canvas?.getContext("2d");
  }

  clear(width = 1920, height = 1080, color = "#000000") {
    if (!this.ctx) return;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, width, height);
  }

  drawFrame(source, dx, dy, dWidth, dHeight, opacity = 1) {
    if (!this.ctx || !source) return;
    this.ctx.save();
    this.ctx.globalAlpha = opacity;
    try {
      this.ctx.drawImage(source, dx, dy, dWidth, dHeight);
    } catch {
      // Ignore frame draw errors on seek
    }
    this.ctx.restore();
  }
}
