import EventEmitter from "node:events";

export class JobQueue extends EventEmitter {
  constructor(concurrency = 2) {
    super();
    this.concurrency = concurrency;
    this.queue = [];
    this.running = new Map();
  }

  addJob(jobId, taskFn) {
    this.queue.push({ jobId, taskFn });
    this.processNext();
  }

  async processNext() {
    if (this.running.size >= this.concurrency || this.queue.length === 0) {
      return;
    }

    const { jobId, taskFn } = this.queue.shift();
    this.running.set(jobId, Date.now());
    this.emit("job:start", jobId);

    try {
      const result = await taskFn();
      this.emit("job:complete", { jobId, result });
    } catch (err) {
      this.emit("job:error", { jobId, error: err.message });
    } finally {
      this.running.delete(jobId);
      this.processNext();
    }
  }

  getStatus() {
    return {
      pending: this.queue.length,
      active: this.running.size,
    };
  }
}

export const jobQueue = new JobQueue();
