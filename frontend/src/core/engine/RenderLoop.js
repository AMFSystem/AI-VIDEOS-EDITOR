// RAF based render loop synchronizing video frame presentation with audio clock
export class RenderLoop {
  constructor(onRender) {
    this.onRender = onRender;
    this.rafId = null;
    this.isRunning = false;
    this.lastTime = 0;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();

    const tick = (now) => {
      if (!this.isRunning) return;
      const deltaTime = (now - this.lastTime) / 1000;
      this.lastTime = now;

      if (this.onRender) {
        this.onRender(deltaTime, now);
      }

      this.rafId = requestAnimationFrame(tick);
    };

    this.rafId = requestAnimationFrame(tick);
  }

  stop() {
    this.isRunning = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}
