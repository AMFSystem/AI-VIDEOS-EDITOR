import os
import sys
import json
import time
import re
import shutil
import base64
import threading
import subprocess
from pathlib import Path
from typing import List, Dict, Any, Optional
import numpy as np
import soundfile as sf
import scipy.signal

# ─────────────────────────────────────────────────────────────────────────────
# Directories & Constants
# ─────────────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = BASE_DIR / "models"
LORA_DIR = MODELS_DIR / "lora"
LORA_DIR.mkdir(parents=True, exist_ok=True)

WORKDIR_ROOT = BASE_DIR / "training_workdir"
WORKDIR_ROOT.mkdir(parents=True, exist_ok=True)

TARGET_SR = 16000

# Standard Khmer Training Prompts for Studio Recording
DEFAULT_KHMER_PROMPTS = [
    {
        "id": "prompt_1",
        "category": "សួស្តី & ស្វាគមន៍ (Greeting)",
        "text": "សួស្តីបងប្អូនទាំងអស់គ្នា សូមស្វាគមន៍មកកាន់កម្មវិធីរបស់យើងខ្ញុំនៅថ្ងៃនេះ។"
    },
    {
        "id": "prompt_2",
        "category": "វប្បធម៌ & ទេសចរណ៍ (Culture)",
        "text": "ប្រទេសកម្ពុជាសម្បូរទៅដោយសម្បត្តិវប្បធម៌ប្រវត្តិសាស្ត្រ និងរមណីយដ្ឋានធម្មជាតិស្រស់ស្អាតជាច្រើន។"
    },
    {
        "id": "prompt_3",
        "category": "បច្ចេកវិទ្យា & អនាគត (Tech)",
        "text": "បច្ចេកវិទ្យាបញ្ញាសិប្បនិម្មិតកំពុងជួយសម្រួលដល់ការងារប្រចាំថ្ងៃរបស់មនុស្សយ៉ាងឆាប់រហ័ស។"
    },
    {
        "id": "prompt_4",
        "category": "សំណួរ & សន្ទនា (Question)",
        "text": "តើអ្នកទាំងអស់គ្នាមានចំណាប់អារម្មណ៍យ៉ាងណាដែរចំពោះព័ត៌មានទាន់ហេតុការណ៍នៅព្រឹកនេះ?"
    },
    {
        "id": "prompt_5",
        "category": "ការថ្លែងអំណរគុណ (Gratitude)",
        "text": "សូមអរគុណយ៉ាងជ្រាលជ្រៅសម្រាប់ការចំណាយពេលវេលាដ៏មានតម្លៃតាមដានទស្សនារបស់លោកអ្នក។"
    },
    {
        "id": "prompt_6",
        "category": "ការលើកទឹកចិត្ត (Inspiration)",
        "text": "ភាពជោគជ័យមិនមែនកើតឡើងដោយចៃដន្យនោះទេ ប៉ុន្តែជាលទ្ធផលនៃការខិតខំប្រឹងប្រែងជារៀងរាល់ថ្ងៃ។"
    },
    {
        "id": "prompt_7",
        "category": "ការអានព័ត៌មាន (News)",
        "text": "ថ្ងៃនេះអាកាសធាតុមានភាពអំណោយផលល្អ ដោយមានពន្លឺថ្ងៃស្រទន់និងខ្យល់ត្រជាក់បក់រំភើយ។"
    },
    {
        "id": "prompt_8",
        "category": "ការលាគ្នា (Closing)",
        "text": "សូមជូនពរឱ្យលោកអ្នកនិងក្រុមគ្រួសារជួបតែសេចក្តីសុខ សុភមង្គល និងសុខភាពល្អគ្រប់ពេលវេលា។"
    }
]

# ─────────────────────────────────────────────────────────────────────────────
# Audio Helpers
# ─────────────────────────────────────────────────────────────────────────────
def resample_to_16k_mono(audio_bytes: bytes) -> np.ndarray:
    """Decode audio bytes (WAV/MP3/OGG/WebM/M4A/AAC) and convert to 16kHz mono float32."""
    import io
    # 1. Try direct soundfile decode
    try:
        bio = io.BytesIO(audio_bytes)
        data, sr = sf.read(bio)
        if data.ndim > 1:
            data = np.mean(data, axis=1)
        if sr != TARGET_SR:
            gcd = np.gcd(sr, TARGET_SR)
            up = TARGET_SR // gcd
            down = sr // gcd
            data = scipy.signal.resample_poly(data, up, down)
        max_val = np.max(np.abs(data))
        if max_val > 1e-5:
            data = (data / max_val) * 0.95
        return data.astype(np.float32)
    except Exception as sf_err:
        # 2. Universal fallback: decode WebM, Opus, M4A, AAC via ffmpeg
        ffmpeg_bin = shutil.which("ffmpeg") or "/opt/homebrew/bin/ffmpeg"
        if os.path.exists(ffmpeg_bin):
            try:
                cmd = [
                    ffmpeg_bin,
                    "-nostdin",
                    "-hide_banner",
                    "-loglevel", "error",
                    "-i", "pipe:0",
                    "-vn",
                    "-ar", "16000",
                    "-ac", "1",
                    "-f", "wav",
                    "pipe:1",
                ]
                proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                wav_out, _ = proc.communicate(input=audio_bytes)
                if proc.returncode == 0 and len(wav_out) > 44:
                    bio = io.BytesIO(wav_out)
                    data, _ = sf.read(bio)
                    if data.ndim > 1:
                        data = np.mean(data, axis=1)
                    max_val = np.max(np.abs(data))
                    if max_val > 1e-5:
                        data = (data / max_val) * 0.95
                    return data.astype(np.float32)
            except Exception as ffmpeg_err:
                pass
        raise RuntimeError(f"មិនអាចឌីកូដសំឡេង (Decode Audio Error): {sf_err}")

# ─────────────────────────────────────────────────────────────────────────────
# Training Manager Class
# ─────────────────────────────────────────────────────────────────────────────
class LoRATrainingManager:
    def __init__(self):
        self._lock = threading.Lock()
        self._process: Optional[subprocess.Popen] = None
        self._monitor_thread: Optional[threading.Thread] = None
        
        self.state: Dict[str, Any] = {
            "status": "idle",  # "idle" | "preparing" | "training" | "completed" | "error" | "cancelled"
            "model_name": "",
            "step": 0,
            "total_steps": 300,
            "loss": None,
            "eta_seconds": None,
            "elapsed_seconds": 0,
            "progress": 0.0,
            "logs": [],
            "error": None,
            "output_file": None,
            "dataset_size": 0,
            "start_time": None,
            "device": "mps" if sys.platform == "darwin" else "cuda",
        }

    def get_status(self) -> Dict[str, Any]:
        with self._lock:
            s = dict(self.state)
            if s["status"] == "training" and s["start_time"]:
                s["elapsed_seconds"] = int(time.time() - s["start_time"])
            return s

    def get_prompts(self) -> List[Dict[str, str]]:
        return DEFAULT_KHMER_PROMPTS

    def stop_training(self) -> Dict[str, Any]:
        with self._lock:
            if self._process and self._process.poll() is None:
                self._append_log("🛑 User requested training cancellation...")
                try:
                    self._process.terminate()
                    time.sleep(1.0)
                    if self._process.poll() is None:
                        self._process.kill()
                except Exception as e:
                    self._append_log(f"⚠️ Process termination note: {e}")
                self.state["status"] = "cancelled"
                self.state["error"] = "ការបង្វឹកត្រូវបានបញ្ឈប់ដោយអ្នកប្រើប្រាស់"
                return {"success": True, "message": "Training stopped"}
            return {"success": False, "message": "No active training process"}

    def _append_log(self, line: str):
        with self._lock:
            clean = line.strip()
            if clean:
                self.state["logs"].append(clean)
                if len(self.state["logs"]) > 250:
                    self.state["logs"] = self.state["logs"][-250:]

    def start_training(
        self,
        model_name: str,
        samples: List[Dict[str, str]],
        steps: int = 300,
        learning_rate: float = 0.0001,
        on_unload_model=None,
        on_reload_model=None,
    ) -> Dict[str, Any]:
        with self._lock:
            if self._process and self._process.poll() is None:
                self._append_log("🛑 បញ្ឈប់ដំណើរការបង្វឹកចាស់ដោយស្វ័យប្រវត្តិដើម្បីចាប់ផ្តើមវគ្គថ្មី...")
                try:
                    self._process.terminate()
                    time.sleep(1.0)
                    if self._process.poll() is None:
                        self._process.kill()
                except Exception as e:
                    pass
                self._process = None
            
            clean_name = re.sub(r"[^a-zA-Z0-9_\u1780-\u17FF]", "_", model_name.strip())
            if not clean_name:
                clean_name = f"khmer_lora_{int(time.time())}"
            
            steps = max(10, min(2000, int(steps)))

            self.state.update({
                "status": "preparing",
                "model_name": clean_name,
                "step": 0,
                "total_steps": steps,
                "loss": None,
                "eta_seconds": None,
                "elapsed_seconds": 0,
                "progress": 0.0,
                "logs": [f"🚀 Initializing LoRA training pipeline for: {clean_name}"],
                "error": None,
                "output_file": None,
                "dataset_size": len(samples),
                "start_time": time.time(),
            })

        # Run preparation and training in background thread
        thread = threading.Thread(
            target=self._run_training_pipeline,
            args=(clean_name, samples, steps, learning_rate, on_unload_model, on_reload_model),
            daemon=True
        )
        self._monitor_thread = thread
        thread.start()

        return {"success": True, "model_name": clean_name, "total_steps": steps}

    def _run_training_pipeline(
        self,
        model_name: str,
        samples: List[Dict[str, str]],
        steps: int,
        learning_rate: float,
        on_unload_model,
        on_reload_model,
    ):
        run_dir = WORKDIR_ROOT / f"run_{model_name}_{int(time.time())}"
        wavs_dir = run_dir / "wavs"
        checkpoints_dir = run_dir / "checkpoints"
        logs_dir = run_dir / "logs"

        wavs_dir.mkdir(parents=True, exist_ok=True)
        checkpoints_dir.mkdir(parents=True, exist_ok=True)
        logs_dir.mkdir(parents=True, exist_ok=True)

        try:
            self._append_log(f"📁 Workspace initialized at: {run_dir}")
            self._append_log(f"🎙️ Processing {len(samples)} voice recordings into 16kHz Mono WAV...")

            manifest_rows = []
            for idx, item in enumerate(samples, 1):
                raw_b64 = item.get("audioBase64", "")
                if "," in raw_b64:
                    raw_b64 = raw_b64.split(",", 1)[1]
                
                audio_bytes = base64.b64decode(raw_b64)
                wav_data = resample_to_16k_mono(audio_bytes)
                
                clip_path = wavs_dir / f"clip_{idx:04d}.wav"
                sf.write(str(clip_path), wav_data, TARGET_SR, subtype="PCM_16")

                text = item.get("text", "").strip() or f"សំឡេងនិយាយគំរូទី {idx}"
                manifest_rows.append({
                    "audio": str(clip_path.resolve()),
                    "text": text,
                    "duration": round(len(wav_data) / TARGET_SR, 2)
                })

            manifest_path = run_dir / "train.jsonl"
            with open(manifest_path, "w", encoding="utf-8") as f:
                for row in manifest_rows:
                    f.write(json.dumps(row, ensure_ascii=False) + "\n")

            self._append_log(f"✅ Generated dataset manifest with {len(manifest_rows)} audio clips: {manifest_path}")

            # 2. Free RAM/VRAM before training
            if on_unload_model:
                self._append_log("🧹 Unloading inference model to maximize RAM/MPS memory for training...")
                try:
                    on_unload_model()
                except Exception as unload_err:
                    self._append_log(f"⚠️ Unload note: {unload_err}")

            # 3. Write Training YAML Config (Tuned for Fast & Realistic Mac MPS/CPU Voice Adaptation)
            import yaml
            train_config = {
                "pretrained_path": "openbmb/VoxCPM2",
                "train_manifest": str(manifest_path.resolve()),
                "sample_rate": 16000,
                "batch_size": 1,
                "grad_accum_steps": 1,  # 1 step = 1 audio sample for instant step updates without freezing
                "num_workers": 1,
                "num_iters": steps,
                "max_steps": steps,
                "save_path": str(checkpoints_dir.resolve()),
                "save_interval": steps,
                "log_interval": 1,
                "learning_rate": learning_rate,
                "weight_decay": 0.01,
                "warmup_steps": min(10, max(2, steps // 10)),
                "max_grad_norm": 1.0,
                "tensorboard": str(logs_dir.resolve()),
                "lambdas": {"loss/diff": 1.0, "loss/stop": 1.0},
                "lora": {
                    "enable_lm": False,  # Audio DiT generates acoustic timbre & pitch; disabling 2B LM makes training 4x faster!
                    "enable_dit": True,
                    "enable_proj": False,
                    "r": 16,
                    "alpha": 16,
                    "dropout": 0.0,
                }
            }

            config_path = run_dir / "train_config.yaml"
            with open(config_path, "w", encoding="utf-8") as f:
                yaml.dump(train_config, f)

            self._append_log(f"📄 Training configuration generated: {config_path}")

            # 4. Launch Subprocess
            train_script = BASE_DIR / "train_voxcpm_finetune.py"
            cmd = [
                sys.executable,
                str(train_script),
                "--config_path",
                str(config_path)
            ]

            self._append_log(f"🔥 Launching VoxCPM2 LoRA Fine-Tuner: {' '.join(cmd[-2:])}")
            with self._lock:
                self.state["status"] = "training"
                self.state["start_time"] = time.time()

            self._process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                cwd=str(BASE_DIR)
            )

            # 5. Monitor Output & Parse Progress
            step_pattern = re.compile(r"step\s+(\d+)", re.IGNORECASE)
            loss_pattern = re.compile(r"loss[/\w]*[:=]\s*([\d\.]+)", re.IGNORECASE)

            step_times = []
            last_step = 0

            for line in iter(self._process.stdout.readline, ""):
                line_str = line.strip()
                if not line_str:
                    continue

                self._append_log(line_str)

                # Parse Step
                step_match = step_pattern.search(line_str)
                if step_match:
                    current_step = int(step_match.group(1))
                    now = time.time()
                    
                    if current_step > last_step:
                        step_times.append((current_step, now))
                        if len(step_times) > 15:
                            step_times = step_times[-15:]
                        
                        # Calculate ETA
                        if len(step_times) >= 2:
                            steps_done = step_times[-1][0] - step_times[0][0]
                            time_taken = step_times[-1][1] - step_times[0][1]
                            if steps_done > 0 and time_taken > 0:
                                rate = steps_done / time_taken
                                remaining_steps = max(0, steps - current_step)
                                eta = int(remaining_steps / rate)
                            else:
                                eta = None
                        else:
                            eta = None

                        last_step = current_step

                    loss_val = None
                    loss_match = loss_pattern.search(line_str)
                    if loss_match:
                        try:
                            loss_val = round(float(loss_match.group(1)), 4)
                        except:
                            pass

                    with self._lock:
                        self.state["step"] = current_step
                        self.state["progress"] = min(99.0, round((current_step / steps) * 100, 1))
                        if loss_val is not None:
                            self.state["loss"] = loss_val
                        if eta is not None:
                            self.state["eta_seconds"] = eta

            self._process.wait()
            return_code = self._process.returncode

            if return_code != 0:
                raise RuntimeError(f"Training script exited with code {return_code}. Check logs above for details.")

            # 6. Locate Output safetensors
            self._append_log("🎯 Searching for generated LoRA weights...")
            found_safetensors = list(checkpoints_dir.rglob("*.safetensors")) + list(checkpoints_dir.rglob("*.ckpt"))
            
            if not found_safetensors:
                raise FileNotFoundError(f"No checkpoint file found in {checkpoints_dir}")

            src_file = found_safetensors[0]
            dest_file = LORA_DIR / f"{model_name}.safetensors"
            shutil.copy2(src_file, dest_file)
            file_size_mb = round(dest_file.stat().st_size / (1024 * 1024), 2)

            self._append_log(f"🎉 SUCCESS! LoRA model saved to: {dest_file.name} ({file_size_mb} MB)")

            # 7. Reload Model & Activate New LoRA
            if on_reload_model:
                self._append_log("🔄 Reloading VoxCPM2 inference engine with your new LoRA voice...")
                try:
                    on_reload_model(dest_file.name)
                except Exception as reload_err:
                    self._append_log(f"⚠️ Reload note: {reload_err}")

            with self._lock:
                self.state.update({
                    "status": "completed",
                    "step": steps,
                    "progress": 100.0,
                    "eta_seconds": 0,
                    "output_file": dest_file.name,
                })
                self._append_log(f"✨ Voice model '{model_name}' is now active and ready for TTS synthesis!")

        except Exception as e:
            self._append_log(f"❌ Error during training: {e}")
            with self._lock:
                self.state["status"] = "error"
                self.state["error"] = str(e)
            # Ensure model gets reloaded even on failure
            if on_reload_model:
                try:
                    on_reload_model()
                except:
                    pass
        finally:
            self._process = None

# Global instance
training_manager = LoRATrainingManager()
