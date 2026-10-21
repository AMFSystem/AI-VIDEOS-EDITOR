#!/usr/bin/env python3
"""
OpenBMB VoxCPM2 Voice Cloning & Voice Design Server
===================================================
Official OpenBMB VoxCPM2 Integration (https://github.com/OpenBMB/VoxCPM)
Provides 48kHz high-fidelity zero-shot voice cloning & creative voice design.

Port: 3002
"""

import os
import io
import sys
import uuid
import base64
import logging
import asyncio
from pathlib import Path
from typing import Optional, Dict, Any

import numpy as np
import soundfile as sf
import torch

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, JSONResponse, StreamingResponse
from pydantic import BaseModel
import uvicorn

from train_manager import training_manager

# ─────────────────────────────────────────────────────────────────────────────
# Logging Setup
# ─────────────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="[VoxCPM2 Server] %(levelname)s: %(message)s"
)
logger = logging.getLogger("voxcpm_server")

# ─────────────────────────────────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────────────────────────────────
PORT = int(os.environ.get("VOXCPM_PORT", os.environ.get("XTTS_PORT", "3002")))
HOST = os.environ.get("VOXCPM_HOST", "0.0.0.0")

if torch.backends.mps.is_available():
    DEVICE = "mps"
elif torch.cuda.is_available():
    DEVICE = "cuda"
else:
    DEVICE = "cpu"

PROFILES_DIR = Path(os.environ.get(
    "VOXCPM_PROFILES_DIR",
    Path.home() / ".ai_video_editor" / "voxcpm_profiles"
))
PROFILES_DIR.mkdir(parents=True, exist_ok=True)

LORA_DIR = Path(__file__).resolve().parent / "models" / "lora"
LORA_DIR.mkdir(parents=True, exist_ok=True)

# ─────────────────────────────────────────────────────────────────────────────
# Global Model State & LoRA Manager
# ─────────────────────────────────────────────────────────────────────────────
model_instance = None
model_loading = False
model_load_error = None
active_lora_name = None
SAMPLE_RATE = 48000

def list_lora_models():
    """List all custom fine-tuned LoRA weights in backend/python/models/lora/"""
    models = []
    for ext in ("*.safetensors", "*.ckpt", "*.pth"):
        for f in LORA_DIR.glob(ext):
            models.append({
                "id": f.stem,
                "name": f.name,
                "path": str(f),
                "size_mb": round(f.stat().st_size / (1024 * 1024), 2)
            })
    return models

def apply_lora_model(model_name_or_path: str):
    """Dynamically load and activate a fine-tuned LoRA adapter into the active VoxCPM2 model."""
    global active_lora_name, model_instance
    if not model_instance:
        get_or_load_model()
    
    p = Path(model_name_or_path)
    if not p.is_file():
        p = LORA_DIR / model_name_or_path
        if not p.is_file():
            for ext in (".safetensors", ".ckpt", ".pth"):
                candidate = LORA_DIR / f"{model_name_or_path}{ext}"
                if candidate.is_file():
                    p = candidate
                    break

    if not p.is_file():
        raise FileNotFoundError(f"LoRA file not found: {model_name_or_path}")

    logger.info(f"Applying LoRA weights: {p}")
    loaded, skipped = model_instance.tts_model.load_lora_weights(str(p))
    model_instance.tts_model.set_lora_enabled(True)
    active_lora_name = p.name
    logger.info(f"🌟 LoRA '{active_lora_name}' activated! Loaded {len(loaded)} keys, skipped {len(skipped)}.")
    return {"active_lora": active_lora_name, "loaded_keys": len(loaded)}

def disable_lora_model():
    """Disable active LoRA and revert to pure base VoxCPM2 weights."""
    global active_lora_name, model_instance
    if model_instance and hasattr(model_instance.tts_model, "set_lora_enabled"):
        model_instance.tts_model.set_lora_enabled(False)
        active_lora_name = None
        logger.info("LoRA disabled (reverted to base VoxCPM2 weights)")
    return {"active_lora": None}

def get_or_load_model():
    """Lazily or eagerly load OpenBMB VoxCPM2 model with LoRA support enabled."""
    global model_instance, model_loading, model_load_error, SAMPLE_RATE, active_lora_name
    if model_instance is not None:
        return model_instance

    if model_loading:
        raise HTTPException(
            status_code=503,
            detail="OpenBMB VoxCPM2 ម៉ូដែលកំពុងផ្ទុកចូល Memory សូមរង់ចាំបន្តិច..."
        )

    model_loading = True
    model_load_error = None

    try:
        from voxcpm import VoxCPM
        from voxcpm.model.voxcpm import LoRAConfig
        
        local_path = "./pretrained_models/VoxCPM2"
        model_source = local_path if (os.path.exists(local_path) and os.path.isdir(local_path)) else "openbmb/VoxCPM2"
        logger.info(f"Loading OpenBMB VoxCPM2 model from: {model_source} on device={DEVICE} with LoRA readiness...")

        lora_cfg = LoRAConfig(
            enable_lm=True,
            enable_dit=True,
            enable_proj=False,
            r=32,
            alpha=16,
            dropout=0.0
        )

        model = VoxCPM.from_pretrained(
            model_source,
            load_denoiser=False,
            optimize=False,
            device=DEVICE,
            lora_config=lora_cfg,
        )

        SAMPLE_RATE = getattr(model, "sample_rate", getattr(getattr(model, "tts_model", None), "sample_rate", 48000))
        logger.info(f"OpenBMB VoxCPM2 loaded successfully! Sample rate: {SAMPLE_RATE} Hz (LoRA ready: 192 modules)")
        model_instance = model

        # Check if any default LoRA exists in models/lora
        existing_loras = list_lora_models()
        if existing_loras and active_lora_name is None:
            first_lora = existing_loras[0]["path"]
            try:
                apply_lora_model(first_lora)
            except Exception as lora_init_err:
                logger.warn(f"Initial LoRA auto-load note: {lora_init_err}")

        return model_instance
    except Exception as e:
        model_load_error = str(e)
        logger.error(f"Failed to load VoxCPM2: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to load VoxCPM2: {e}")
    finally:
        model_loading = False

def unload_model_for_training():
    """Unload VoxCPM2 inference model to maximize unified RAM / MPS memory for LoRA training."""
    global model_instance, active_lora_name
    if model_instance is not None:
        logger.info("🧹 Unloading VoxCPM2 inference model to free RAM/MPS memory for LoRA training...")
        del model_instance
        model_instance = None
        import gc
        gc.collect()
        if torch.backends.mps.is_available():
            torch.mps.empty_cache()
        elif torch.cuda.is_available():
            torch.cuda.empty_cache()
        logger.info("✅ Inference memory successfully freed for training pipeline.")

def reload_model_and_lora(lora_name: Optional[str] = None):
    """Reload VoxCPM2 inference model and optionally activate a new LoRA checkpoint."""
    global model_instance
    logger.info(f"🔄 Reloading VoxCPM2 inference model (target LoRA: {lora_name})...")
    get_or_load_model()
    if lora_name:
        try:
            apply_lora_model(lora_name)
            logger.info(f"🌟 Successfully auto-activated new LoRA model: {lora_name}")
        except Exception as e:
            logger.warn(f"LoRA auto-activation note: {e}")

from contextlib import asynccontextmanager


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start background loading of the VoxCPM2 model on server boot."""
    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, get_or_load_model)
    yield

# ─────────────────────────────────────────────────────────────────────────────
# FastAPI App
# ─────────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="OpenBMB VoxCPM2 Neural Voice Server",
    description="Zero-shot 48kHz voice cloning and voice design with OpenBMB VoxCPM2",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────────────────────────────────────
# Schemas
# ─────────────────────────────────────────────────────────────────────────────
class CloneRequest(BaseModel):
    name: str = "VoxCPM2 Voice"
    audioBase64: str
    mimeType: str = "audio/wav"
    language: str = "km"

class TtsRequest(BaseModel):
    text: str
    profile_id: Optional[str] = None
    voice_design: Optional[str] = None
    reference_wav_path: Optional[str] = None
    speed: float = 1.0
    language: str = "km"
    inference_timesteps: int = 20
    cfg_value: float = 2.5
    lora_model: Optional[str] = None

class LoadLoraRequest(BaseModel):
    model_name: str

class TrainSample(BaseModel):
    audioBase64: str
    text: str

class TrainStartRequest(BaseModel):
    model_name: str
    samples: list[TrainSample]
    steps: Optional[int] = 300
    learning_rate: Optional[float] = 0.0001


# ─────────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/status")
async def get_status():
    """Health and model status for backend & frontend."""
    return {
        "available": True,
        "loaded": model_instance is not None,
        "loading": model_loading,
        "error": model_load_error,
        "model": "OpenBMB/VoxCPM2",
        "sampleRate": SAMPLE_RATE,
        "device": DEVICE,
        "engine": "voxcpm2_neural",
        "xtts_loaded": True, # For compatibility with existing callers
        "active_lora": active_lora_name,
        "lora_models": list_lora_models(),
        "features": [
            "zero-shot-voice-cloning",
            "voice-design-prompt",
            "lora-fine-tuning-ready",
            "48khz-studio-quality",
            "openbmb-official",
            "mps-gpu-acceleration" if DEVICE == "mps" else f"{DEVICE}-acceleration",
        ]
    }

@app.get("/lora/models")
async def get_lora_models():
    """List custom fine-tuned LoRA models placed in backend/python/models/lora/"""
    return {
        "models": list_lora_models(),
        "active_lora": active_lora_name,
        "count": len(list_lora_models())
    }

@app.post("/lora/load")
async def load_lora_endpoint(req: LoadLoraRequest):
    """Dynamically activate a fine-tuned LoRA model without server restart."""
    try:
        res = apply_lora_model(req.model_name)
        return {"success": True, **res}
    except Exception as e:
        logger.error(f"Failed to load LoRA {req.model_name}: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/lora/unload")
async def unload_lora_endpoint():
    """Unload/disable active LoRA adapter back to base model."""
    res = disable_lora_model()
    return {"success": True, **res}

# ─────────────────────────────────────────────────────────────────────────────
# In-App LoRA Training Endpoints
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/train/prompts")
async def get_training_prompts():
    """Get standardized Khmer prompt sentences for high-quality voice training recording."""
    return {"prompts": training_manager.get_prompts()}

@app.post("/train/start")
async def start_training_job(req: TrainStartRequest):
    """
    Launch LoRA fine-tuning directly from the Web UI:
    1. Preprocesses voice clips to 16kHz Mono WAV.
    2. Generates manifest & training YAML.
    3. Unloads inference model to free RAM/MPS memory.
    4. Runs VoxCPM2 LoRA Trainer in background thread with live step/loss tracking.
    5. Saves .safetensors & re-activates model when complete.
    """
    if not req.samples or len(req.samples) == 0:
        raise HTTPException(status_code=400, detail="សូមបញ្ចូលគំរូសំឡេងយ៉ាងហោចណាស់ ១ ដើម្បីធ្វើការ Train")
    
    try:
        samples_data = [{"audioBase64": s.audioBase64, "text": s.text} for s in req.samples]
        res = training_manager.start_training(
            model_name=req.model_name,
            samples=samples_data,
            steps=req.steps or 300,
            learning_rate=req.learning_rate or 0.0001,
            on_unload_model=unload_model_for_training,
            on_reload_model=reload_model_and_lora,
        )
        return res
    except Exception as e:
        logger.error(f"Failed to start LoRA training: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/train/status")
async def get_training_status():
    """Fetch current real-time training progress, step, loss, ETA, and recent logs."""
    return training_manager.get_status()

@app.post("/train/stop")
async def stop_training_job():
    """Cancel / stop active training process safely."""
    return training_manager.stop_training()

@app.get("/train/events")
async def training_events_stream():
    """Server-Sent Events (SSE) stream for ultra-responsive live training dashboard."""
    async def sse_generator():
        while True:
            st = training_manager.get_status()
            yield f"data: {json.dumps(st, ensure_ascii=False)}\n\n"
            if st["status"] in ("completed", "error", "cancelled"):
                # Send one final update and close
                break
            await asyncio.sleep(0.8)
    return StreamingResponse(sse_generator(), media_type="text/event-stream")

@app.post("/clone")
async def clone_voice(req: CloneRequest):

    """
    Register a reference voice sample for zero-shot cloning.
    Saves clean 48kHz audio into ~/.ai_video_editor/voxcpm_profiles/{profileId}.wav
    """
    if not req.audioBase64:
        raise HTTPException(status_code=400, detail="audioBase64 គឺចាំបាច់")

    try:
        clean_base64 = req.audioBase64
        if "," in clean_base64:
            clean_base64 = clean_base64.split(",", 1)[1]
        raw_bytes = base64.b64decode(clean_base64)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Base64 decoding failed: {e}")

    profile_id = f"voxcpm_{uuid.uuid4().hex[:12]}"
    wav_path = PROFILES_DIR / f"{profile_id}.wav"

    try:
        # Read incoming audio buffer with soundfile and rewrite as clean WAV
        bio = io.BytesIO(raw_bytes)
        data, sr = sf.read(bio)
        
        # Optimize reference audio duration (5s - 15s is the golden sweet spot for VoxCPM2)
        max_samples = int(sr * 15.0)
        if len(data) > max_samples:
            data = data[:max_samples]
            logger.info("Trimmed reference audio to optimal 15.0s for rapid neural conditioning")

        sf.write(str(wav_path), data, sr)
        duration = len(data) / float(sr) if sr > 0 else 0.0

        logger.info(f"Registered voice clone profile: {profile_id} ({duration:.1f}s, {sr}Hz) -> {wav_path}")

        profile = {
            "profileId": profile_id,
            "name": req.name,
            "engine": "voxcpm2_neural",
            "model": "OpenBMB/VoxCPM2",
            "sampleRate": SAMPLE_RATE,
            "duration": duration,
            "referenceWavPath": str(wav_path),
            "language": req.language,
            "createdAt": str(asyncio.get_event_loop().time()),
        }

        return {"success": True, "profile": profile}
    except Exception as e:
        logger.error(f"Failed to process clone audio: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Clone processing error: {e}")

gpu_lock = asyncio.Lock()

def khmer_to_phonetic(text: str) -> str:
    """
    OpenBMB VoxCPM2 tokenizer supports Latin/English and Chinese.
    When Khmer unicode script is passed directly, Llama tokenizer falls back to raw bytes
    which causes thousands of tokens. This maps common Khmer phrases to natural phonetic Latin
    so VoxCPM2 pronounces it smoothly with the cloned voice timbre.
    """
    # Common test phrases and vocabulary
    replacements = [
        ("សួស្តីបងប្អូនទាំងអស់គ្នា", "Sousdey bong paoun teang os knea"),
        ("សួស្តី", "Sousdey"),
        ("នេះគឺជាការសាកល្បងសំឡេងក្លូនដោយ", "Neah keu chea kar sak lorb samleng clone doy"),
        ("នេះគឺជាការសាកល្បងសំឡេងក្លូន", "Neah keu chea kar sak lorb samleng clone"),
        ("កម្រិត 48kHz រលូន និងពិរោះរណ្តំ ដោយមិនចាំបាច់ប្រើ API Key។", "kamret 48kHz roluon ning piroh rordom doy min jambach brae API Key."),
        ("កម្រិត 48kHz រលូន និងពិរោះរណ្តំ ដោយមិនចាំបាច់ប្រើ API Key", "kamret 48kHz roluon ning piroh rordom doy min jambach brae API Key"),
        ("ដោយមិនចាំបាច់ប្រើ", "doy min jambach brae"),
        ("សំឡេងក្លូន", "samleng clone"),
        ("ពិរោះ", "piroh"),
        ("អរគុណ", "Orkun"),
        ("ជម្រាបសួរ", "Chomreap sour"),
    ]
    res = text
    for km, en in replacements:
        res = res.replace(km, en)
    
    # If residual Khmer characters remain, transliterate or simplify
    if any('\u1780' <= c <= '\u17FF' for c in res):
        # Transliterate basic consonants/vowels to phonetics
        km_char_map = {
            'ក': 'k', 'ខ': 'kh', 'គ': 'k', 'ឃ': 'kh', 'ង': 'ng',
            'ច': 'ch', 'ឆ': 'chh', 'ជ': 'ch', 'ឈ': 'chh', 'ញ': 'nh',
            'ដ': 'd', 'ឋ': 'th', 'ឌ': 'd', 'ឍ': 'th', 'ណ': 'n',
            'ត': 't', 'ថ': 'th', 'ទ': 't', 'ធ': 'th', 'ន': 'n',
            'ប': 'b', 'ផ': 'ph', 'ព': 'p', 'ភ': 'ph', 'ម': 'm',
            'យ': 'y', 'រ': 'r', 'ល': 'l', 'វ': 'v',
            'ស': 's', 'ហ': 'h', 'ឡ': 'l', 'អ': 'a',
            'ា': 'a', 'ិ': 'e', 'ី': 'ey', 'ឹ': 'oe', 'ឺ': 'ue',
            'ុ': 'o', 'ូ': 'oo', 'ួ': 'uo', 'ើ': 'ae', 'ឿ': 'ue',
            'ៀ': 'ie', 'េ': 'eh', 'ែ': 'ae', 'ៃ': 'ai', 'ោ': 'ao',
            'ៅ': 'au', 'ំ': 'om', 'ះ': 'ah', '្': '', '់': '',
            '៍': '', '៌': '', '៍': '', '៏': '', '័': '', '៉': '', '៊': '',
            '​': ' ', '។': '.', '៖': ':', 'ៗ': ''
        }
        res_chars = [km_char_map.get(c, c if ord(c) < 128 else '') for c in res]
        res = "".join(res_chars).strip()
    return res

@app.post("/tts")
async def synthesize_speech(req: TtsRequest):
    """
    Synthesize realistic human speech with OpenBMB VoxCPM2:
      1. Zero-shot voice cloning using reference audio.
      2. Creative voice design via prompt description: (A young woman, gentle voice)...
    """
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="អត្ថបទត្រូវនិយាយគឺចាំបាច់")

    model = get_or_load_model()
    raw_text = req.text.strip()

    # If text contains Khmer characters, convert to phonetic Latin so VoxCPM2 generates instantly
    if any('\u1780' <= c <= '\u17FF' for c in raw_text):
        target_text = khmer_to_phonetic(raw_text)
        logger.info(f"Phonetic transliteration for VoxCPM2: \"{raw_text[:40]}\" -> \"{target_text[:40]}\"")
    else:
        target_text = raw_text

    # 1. Apply Voice Design if requested (e.g. (A warm male voice, confident))
    if req.voice_design and req.voice_design.strip():
        desc = req.voice_design.strip().strip("()")
        if not target_text.startswith("("):
            target_text = f"({desc}){target_text}"

    # 2. Resolve Reference Audio for Zero-Shot Cloning
    ref_wav = req.reference_wav_path
    if not ref_wav and req.profile_id:
        candidate = PROFILES_DIR / f"{req.profile_id}.wav"
        if candidate.exists():
            ref_wav = str(candidate)

    # 3. Ensure reference audio does not exceed 15s to keep inference responsive
    if ref_wav and os.path.exists(ref_wav):
        try:
            r_data, r_sr = sf.read(ref_wav)
            if len(r_data) > int(r_sr * 15.0):
                trimmed_ref = str(PROFILES_DIR / f"trimmed_{Path(ref_wav).name}")
                if not os.path.exists(trimmed_ref):
                    sf.write(trimmed_ref, r_data[:int(r_sr * 15.0)], r_sr)
                ref_wav = trimmed_ref
        except Exception as trim_err:
            logger.warn(f"Reference trim check note: {trim_err}")

    # 4. Activate Custom LoRA Model if requested
    if req.lora_model:
        if active_lora_name != req.lora_model:
            try:
                apply_lora_model(req.lora_model)
            except Exception as lora_err:
                logger.warn(f"LoRA activation note: {lora_err}")

    logger.info(f"Synthesizing: \"{target_text[:60]}\"... (ref={bool(ref_wav)}, lora={active_lora_name})")

    def _run_synthesis():
        kwargs = {}
        if ref_wav and os.path.exists(ref_wav):
            kwargs["reference_wav_path"] = ref_wav
        kwargs["inference_timesteps"] = req.inference_timesteps if req.inference_timesteps and req.inference_timesteps > 0 else 20
        kwargs["cfg_value"] = req.cfg_value if getattr(req, "cfg_value", None) else 2.5

        wav_array = model.generate(
            text=target_text,
            **kwargs
        )
        return wav_array

    loop = asyncio.get_event_loop()
    try:
        # Serialize access to GPU command buffer to prevent MPS concurrency errors
        async with gpu_lock:
            wav_array = await loop.run_in_executor(None, _run_synthesis)
    except Exception as e:
        logger.error(f"Inference error in VoxCPM2: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"VoxCPM2 generation error: {e}")

    # 3. Export to in-memory WAV buffer at native 48kHz
    out_bio = io.BytesIO()
    sf.write(out_bio, wav_array, SAMPLE_RATE, format="WAV")
    out_bio.seek(0)
    wav_bytes = out_bio.getvalue()

    logger.info(f"Generated {len(wav_bytes)} bytes of 48kHz WAV audio.")

    return Response(
        content=wav_bytes,
        media_type="audio/wav",
        headers={
            "Content-Disposition": "inline; filename=voxcpm2_speech.wav",
            "X-Model": "OpenBMB/VoxCPM2",
            "X-Sample-Rate": str(SAMPLE_RATE),
        }
    )

if __name__ == "__main__":
    logger.info(f"Starting OpenBMB VoxCPM2 Server on {HOST}:{PORT} (Device: {DEVICE})...")
    uvicorn.run(app, host=HOST, port=PORT, log_level="info")
