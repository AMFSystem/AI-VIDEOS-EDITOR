import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";

export const trainingEvents = new EventEmitter();

class VoiceTrainingManager {
  constructor() {
    this.modelsDir = path.join(process.cwd(), "models", "custom_trained_voices");
    this.datasetsDir = path.join(process.cwd(), "data", "training_datasets");
    this.ensureDirs();
    this.activeJobs = new Map(); // jobId -> { status, progress, logs, ... }
  }

  ensureDirs() {
    if (!fs.existsSync(this.modelsDir)) fs.mkdirSync(this.modelsDir, { recursive: true });
    if (!fs.existsSync(this.datasetsDir)) fs.mkdirSync(this.datasetsDir, { recursive: true });
  }

  getPythonBin() {
    const venvPython = path.join(process.cwd(), "backend", "python", ".venv", "bin", "python");
    const aiClonePython = path.join(process.cwd(), "backend", "ai_clone", ".venv", "bin", "python");
    if (fs.existsSync(venvPython)) return venvPython;
    if (fs.existsSync(aiClonePython)) return aiClonePython;
    return "python3";
  }

  // 1. Prepare Dataset from uploaded Audio
  async prepareDataset({ audioPath, modelName, language = "km" }) {
    const slug = modelName.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 30) || "custom_voice";
    const datasetId = `${slug}_${Date.now().toString(36)}`;
    const outputDir = path.join(this.datasetsDir, datasetId);

    const scriptPath = path.join(process.cwd(), "backend", "python", "voice_trainer.py");
    const pyBin = this.getPythonBin();

    return new Promise((resolve, reject) => {
      const proc = spawn(pyBin, [
        scriptPath,
        "prepare",
        "--audio", audioPath,
        "--out-dir", outputDir,
        "--name", modelName,
        "--lang", language
      ]);

      let lastSummary = null;
      let errOutput = "";

      proc.stdout.on("data", (chunk) => {
        const lines = chunk.toString().split("\n");
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (data.type === "prepared") lastSummary = data;
          } catch {}
        }
      });

      proc.stderr.on("data", (chunk) => {
        errOutput += chunk.toString();
      });

      proc.on("close", (code) => {
        if (code === 0 && lastSummary) {
          resolve({
            datasetId,
            datasetDir: outputDir,
            ...lastSummary
          });
        } else {
          reject(new Error(errOutput || `Dataset preparation failed with exit code ${code}`));
        }
      });
    });
  }

  // 2. Start Deep Model Training
  startTraining({ datasetId, modelName, epochs = 100, batchSize = 4, learningRate = 0.0002, engine = "voxcpm2" }) {
    const slug = modelName.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 30) || "custom_voice";
    const modelId = `model_${slug}_${Date.now().toString(36)}`;
    const datasetDir = path.join(this.datasetsDir, datasetId);

    if (!fs.existsSync(datasetDir)) {
      throw new Error(`Dataset not found: ${datasetId}`);
    }

    const scriptPath = path.join(process.cwd(), "backend", "python", "voice_trainer.py");
    const pyBin = this.getPythonBin();

    const job = {
      jobId: modelId,
      modelId,
      modelName,
      engine,
      totalEpochs: epochs,
      currentEpoch: 0,
      progressPercent: 0,
      currentLoss: 2.5,
      melLoss: 1.6,
      etaSeconds: 0,
      elapsedSeconds: 0,
      status: "training",
      startedAt: new Date().toISOString(),
      logs: []
    };

    this.activeJobs.set(modelId, job);

    const proc = spawn(pyBin, [
      scriptPath,
      "train",
      "--dataset-dir", datasetDir,
      "--out-models-dir", this.modelsDir,
      "--model-id", modelId,
      "--name", modelName,
      "--epochs", String(epochs),
      "--batch-size", String(batchSize),
      "--lr", String(learningRate),
      "--engine", engine
    ]);

    proc.stdout.on("data", (chunk) => {
      const lines = chunk.toString().split("\n");
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line);
          if (data.type === "training_progress") {
            job.currentEpoch = data.epoch;
            job.progressPercent = data.progress_percent;
            job.currentLoss = data.loss;
            job.melLoss = data.mel_loss;
            job.etaSeconds = data.eta_seconds;
            job.elapsedSeconds = data.elapsed_seconds;
            job.step = data.step;
            job.totalSteps = data.total_steps;
            trainingEvents.emit(`progress:${modelId}`, job);
          } else if (data.type === "training_completed") {
            job.status = "completed";
            job.progressPercent = 100;
            job.outputDir = data.output_dir;
            job.completedAt = new Date().toISOString();
            trainingEvents.emit(`progress:${modelId}`, job);
          }
        } catch {
          job.logs.push(line.trim());
          if (job.logs.length > 200) job.logs.shift();
        }
      }
    });

    proc.stderr.on("data", (chunk) => {
      const text = chunk.toString().trim();
      if (text) {
        job.logs.push(`[stderr] ${text}`);
        if (job.logs.length > 200) job.logs.shift();
      }
    });

    proc.on("close", (code) => {
      if (code !== 0 && job.status === "training") {
        job.status = "failed";
        job.error = `Training process terminated with exit code ${code}`;
        trainingEvents.emit(`progress:${modelId}`, job);
      }
    });

    job._proc = proc;
    return job;
  }

  getJobStatus(jobId) {
    const job = this.activeJobs.get(jobId);
    if (!job) return null;
    const { _proc, ...safeJob } = job;
    return safeJob;
  }

  cancelTraining(jobId) {
    const job = this.activeJobs.get(jobId);
    if (job && job._proc) {
      job._proc.kill("SIGTERM");
      job.status = "cancelled";
      return true;
    }
    return false;
  }

  // 3. List all permanently trained custom models
  listTrainedModels() {
    this.ensureDirs();
    const items = [];
    try {
      const dirs = fs.readdirSync(this.modelsDir, { withFileTypes: true });
      for (const d of dirs) {
        if (!d.isDirectory()) continue;
        const configPath = path.join(this.modelsDir, d.name, "config.json");
        if (fs.existsSync(configPath)) {
          try {
            const data = JSON.parse(fs.readFileSync(configPath, "utf-8"));
            items.push(data);
          } catch {}
        }
      }
    } catch (err) {
      console.warn("Failed to list custom models:", err);
    }
    return items;
  }
}

export const voiceTrainingManager = new VoiceTrainingManager();

