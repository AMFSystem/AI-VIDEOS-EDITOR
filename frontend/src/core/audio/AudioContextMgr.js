// Web Audio API context manager for master timeline audio graph
export class AudioContextManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
  }

  ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  setMasterVolume(val) {
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(val, this.ctx.currentTime);
    }
  }
}

export const audioContextManager = new AudioContextManager();
