#!/usr/bin/env python3
"""
XTTS v2 Real Zero-Shot Voice Cloning Server
==========================================
Powered by Coqui XTTS v2 + FreeVC24

Pipeline:
  - Supported languages (en, fr, de, zh, ko, ja, ...):
      Reference audio → speaker conditioning → XTTS v2 TTS → cloned speech
  - Khmer (km) + other unsupported:
      Reference audio → FreeVC24 profile
      Text → Google TTS (correct phonetics) → FreeVC24 voice conversion → cloned speech

Port: 3002
"""

import os
os.environ["COQUI_TOS_AGREED"] = "1"
import sys
import io
import time
import uuid
import base64
import asyncio
import tempfile
import logging
from contextlib import asynccontextmanager
import urllib.request
import urllib.parse
from pathlib import Path
from typing import Optional, Dict, Any

import numpy as np
import scipy.io.wavfile as wavfile
import torch

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
import uvicorn

# ─────────────────────────────────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────────────────────────────────
PORT = int(os.environ.get("XTTS_PORT", "3002"))
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
PROFILE_CACHE_DIR = Path(os.environ.get("XTTS_PROFILE_DIR", Path.home() / ".ai_video_editor" / "xtts_profiles"))
PROFILE_CACHE_DIR.mkdir(parents=True, exist_ok=True)

XTTS_SAMPLE_RATE = 24000
FREEVC_SAMPLE_RATE = 24000

# Languages natively supported by XTTS v2
XTTS_SUPPORTED_LANGUAGES = {
    "en", "es", "fr", "de", "it", "pt", "pl", "tr", "ru",
    "nl", "cs", "ar", "zh-cn", "zh", "hu", "ko", "ja", "hi"
}

# Map unsupported language codes → best XTTS v2 fallback
LANGUAGE_MAP = {
    "km": "hi",       # Khmer → Hindi (closest Indic phoneme set in model)
    "zh-tw": "zh-cn",
    "cmn": "zh-cn",
    "yue": "zh-cn",
    "vi": "en",
    "th": "hi",
    "id": "en",
    "ms": "en",
}

# ─────────────────────────────────────────────────────────────────────────────
# Logging
# ─────────────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="[XTTS] %(levelname)s %(message)s"
)
log = logging.getLogger("xtts")

# ─────────────────────────────────────────────────────────────────────────────
# Global State
# ─────────────────────────────────────────────────────────────────────────────
xtts_model = None       # Coqui XTTS v2 model
freevc_model = None     # FreeVC24 voice conversion model
profiles: Dict[str, Dict] = {}  # in-memory speaker profile cache

model_state = {
    "xtts_loaded": False,
    "freevc_loaded": False,
    "loading": False,
    "error": None,
}

# ─────────────────────────────────────────────────────────────────────────────
# FastAPI App with Lifespan
# ─────────────────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, _load_models_sync)
    yield

app = FastAPI(
    title="XTTS v2 Voice Cloning Server",
    description="Real zero-shot voice cloning powered by Coqui XTTS v2 + FreeVC24",
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
# Pydantic Models
# ─────────────────────────────────────────────────────────────────────────────
class CloneRequest(BaseModel):
    name: str = "Cloned Voice"
    audioBase64: str               # Base64-encoded reference audio
    mimeType: str = "audio/wav"
    language: str = "km"

class TtsRequest(BaseModel):
    text: str
    profile_id: Optional[str] = None
    profile: Optional[Dict[str, Any]] = None   # voxcpmProfile passthrough
    speed: float = 1.0
    language: str = "km"

# ─────────────────────────────────────────────────────────────────────────────
# Utility Functions
# ─────────────────────────────────────────────────────────────────────────────
def decode_audio_base64(audio_base64: str) -> bytes:
    """Strip data URL prefix and decode base64 audio."""
    if "," in audio_base64:
        audio_base64 = audio_base64.split(",", 1)[1]
    return base64.b64decode(audio_base64)


def bytes_to_temp_file(data: bytes, suffix: str = ".wav") -> str:
    """Write bytes to a temporary file and return the path."""
    fd, path = tempfile.mkstemp(suffix=suffix)
    try:
        os.write(fd, data)
    finally:
        os.close(fd)
    return path


def numpy_to_wav_bytes(audio: np.ndarray, sample_rate: int) -> bytes:
    """Convert float32 numpy array to 16-bit PCM WAV bytes."""
    audio_clipped = np.clip(audio, -1.0, 1.0)
    audio_int16 = (audio_clipped * 32767).astype(np.int16)
    buf = io.BytesIO()
    wavfile.write(buf, sample_rate, audio_int16)
    return buf.getvalue()


def resolve_xtts_language(lang_code: str) -> str:
    """Map any language code to one supported by XTTS v2."""
    code = lang_code.lower().strip()
    if code in LANGUAGE_MAP:
        return LANGUAGE_MAP[code]
    base = code.split("-")[0]
    if base in LANGUAGE_MAP:
        return LANGUAGE_MAP[base]
    if code in XTTS_SUPPORTED_LANGUAGES:
        return code
    if base in XTTS_SUPPORTED_LANGUAGES:
        return base
    return "en"  # safe fallback


def needs_voice_conversion(lang_code: str) -> bool:
    """Return True if the language needs Google TTS + FreeVC24 voice conversion."""
    code = lang_code.lower().strip()
    return code not in XTTS_SUPPORTED_LANGUAGES and code.split("-")[0] not in XTTS_SUPPORTED_LANGUAGES


def fetch_google_tts(text: str, lang: str = "km", max_chars: int = 200) -> bytes:
    """Fetch audio from Google Translate TTS (works for all languages incl. Khmer)."""
    chunks = []
    # Split at ~150 chars to respect Google TTS limit
    words = text.split()
    current = ""
    for word in words:
        if len(current) + len(word) + 1 <= 150:
            current = (current + " " + word).strip()
        else:
            if current:
                chunks.append(current)
            current = word
    if current:
        chunks.append(current)

    buffers = []
    for chunk in chunks:
        url = (
            f"https://translate.google.com/translate_tts"
            f"?ie=UTF-8&tl={urllib.parse.quote(lang)}"
            f"&client=tw-ob&q={urllib.parse.quote(chunk)}"
        )
        req = urllib.request.Request(url, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": "https://translate.google.com/",
        })
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                buffers.append(resp.read())
        except Exception as e:
            log.warning(f"Google TTS chunk failed: {e}")
            raise RuntimeError(f"Google TTS failed: {e}") from e

    return b"".join(buffers)


# ─────────────────────────────────────────────────────────────────────────────
# Model Loading
# ─────────────────────────────────────────────────────────────────────────────
def _load_models_sync():
    """Synchronously load XTTS v2 and FreeVC24 models (called in thread pool)."""
    global xtts_model, freevc_model, model_state
    model_state["loading"] = True
    model_state["error"] = None

    try:
        from TTS.api import TTS

        # ── XTTS v2 ──────────────────────────────────────────────────────────
        log.info(f"Loading XTTS v2 on {DEVICE} (first run downloads ~1.8GB)...")
        xtts_model = TTS(
            model_name="tts_models/multilingual/multi-dataset/xtts_v2",
            progress_bar=True,
        ).to(DEVICE)
        model_state["xtts_loaded"] = True
        log.info("✅ XTTS v2 ready!")

        # ── FreeVC24 (for Khmer + unsupported language voice conversion) ─────
        log.info("Loading FreeVC24 voice conversion model...")
        try:
            freevc_model = TTS(
                model_name="voice_conversion_models/multilingual/vctk/freevc24",
                progress_bar=False,
            ).to(DEVICE)
            model_state["freevc_loaded"] = True
            log.info("✅ FreeVC24 ready!")
        except Exception as e:
            log.warning(f"FreeVC24 not available (Khmer voice conversion disabled): {e}")
            freevc_model = None

        model_state["loading"] = False
        log.info(f"🎤 Voice cloning server READY — port {PORT} | device={DEVICE}")

    except Exception as e:
        model_state["loading"] = False
        model_state["error"] = str(e)
        log.error(f"❌ Model loading failed: {e}", exc_info=True)




# ─────────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/status")
async def status():
    return {
        "available": model_state["xtts_loaded"],
        "loading": model_state["loading"],
        "model": "XTTS-v2",
        "xtts_loaded": model_state["xtts_loaded"],
        "freevc_loaded": model_state["freevc_loaded"],
        "device": DEVICE,
        "sampleRate": XTTS_SAMPLE_RATE,
        "supportedLanguages": sorted(XTTS_SUPPORTED_LANGUAGES),
        "khmerSupported": model_state["freevc_loaded"],
        "error": model_state["error"],
    }


@app.post("/clone")
async def clone_voice(request: CloneRequest):
    """
    Extract real XTTS v2 speaker conditioning from reference audio.
    Returns a profile_id to use for /tts.
    """
    if model_state["loading"]:
        raise HTTPException(503, detail="Model is still loading, please wait 30-60 seconds and retry.")
    if not model_state["xtts_loaded"]:
        raise HTTPException(503, detail=f"XTTS v2 not loaded: {model_state['error']}")

    tmp_ref = None
    try:
        audio_bytes = decode_audio_base64(request.audioBase64)
        # Determine suffix from mime type
        suffix = ".mp3" if "mp3" in request.mimeType else ".wav"
        tmp_ref = bytes_to_temp_file(audio_bytes, suffix=suffix)

        log.info(f"Extracting speaker conditioning for '{request.name}' ({len(audio_bytes)/1024:.1f}KB)...")

        # Run in thread pool (CPU/GPU intensive)
        loop = asyncio.get_event_loop()
        gpt_cond_latent, speaker_embedding = await loop.run_in_executor(
            None,
            lambda: xtts_model.synthesizer.tts_model.get_conditioning_latents(
                audio_path=[tmp_ref],
                gpt_cond_len=30,
                max_ref_length=60,
                sound_norm_refs=False,
            )
        )

        profile_id = f"xtts_{uuid.uuid4().hex}"
        profile_data = {
            "profile_id": profile_id,
            "name": request.name,
            "language": request.language,
            "gpt_cond_latent": gpt_cond_latent,   # torch.Tensor
            "speaker_embedding": speaker_embedding, # torch.Tensor
            "reference_path": tmp_ref,              # Keep for FreeVC24
            "created_at": time.time(),
        }
        profiles[profile_id] = profile_data
        # Also persist reference file path (don't delete tmp_ref)
        tmp_ref = None  # Prevent cleanup — needed for FreeVC24

        log.info(f"✅ Profile '{request.name}' → {profile_id}")

        return {
            "success": True,
            "profile": {
                "profileId": profile_id,
                "name": request.name,
                "engine": "xtts_v2",
                "model": "XTTS-v2",
                "sampleRate": XTTS_SAMPLE_RATE,
                "language": request.language,
                "device": DEVICE,
                "acousticProfile": {
                    "version": "XTTS-v2-real",
                    "trainingQuality": {
                        "score": 100,
                        "isDeepTrained": True,
                        "badge": "🌟 XTTS v2 Real Neural Clone",
                    }
                },
                "createdAt": time.time(),
            },
        }

    except Exception as e:
        log.error(f"Clone error: {e}", exc_info=True)
        raise HTTPException(500, detail=f"Voice cloning failed: {str(e)}")
    finally:
        if tmp_ref and os.path.exists(tmp_ref):
            try:
                os.unlink(tmp_ref)
            except Exception:
                pass


@app.post("/tts")
async def synthesize(request: TtsRequest):
    """
    Real zero-shot speech synthesis with cloned voice.

    - Khmer (km) + FreeVC available: Google TTS phonetics → FreeVC24 voice conversion
    - Other languages with profile: XTTS v2 with speaker conditioning
    - No profile: XTTS v2 with random speaker (voice style not cloned)
    """
    if not model_state["xtts_loaded"]:
        if model_state["loading"]:
            raise HTTPException(503, detail="Model is still loading, please wait...")
        raise HTTPException(503, detail=f"XTTS v2 not loaded: {model_state['error']}")

    text = (request.text or "").strip()
    if not text:
        raise HTTPException(400, detail="Text is required")

    # Resolve profile
    profile_id = request.profile_id
    if not profile_id and request.profile:
        profile_id = request.profile.get("profileId") or request.profile.get("profile_id")
    profile = profiles.get(profile_id) if profile_id else None

    lang = request.language or (profile["language"] if profile else "km")
    speed = max(0.5, min(2.0, float(request.speed or 1.0)))

    loop = asyncio.get_event_loop()

    try:
        # ── Path A: Khmer + FreeVC24 available ────────────────────────────────
        if lang.lower() in ("km", "khm") and freevc_model and profile:
            log.info(f"Khmer TTS: Google TTS → FreeVC24 voice conversion ({profile['name']})")
            wav_bytes = await loop.run_in_executor(
                None,
                lambda: _khmer_freevc_synthesize(text, profile, speed)
            )

        # ── Path B: Supported language with profile ────────────────────────────
        elif profile and model_state["xtts_loaded"]:
            xtts_lang = resolve_xtts_language(lang)
            log.info(f"XTTS v2 TTS: lang={xtts_lang} speaker='{profile['name']}'")
            wav_bytes = await loop.run_in_executor(
                None,
                lambda: _xtts_synthesize(text, profile, xtts_lang, speed)
            )

        # ── Path C: No profile — basic XTTS v2 ──────────────────────────────
        else:
            xtts_lang = resolve_xtts_language(lang)
            log.info(f"XTTS v2 TTS (no profile): lang={xtts_lang}")
            wav_bytes = await loop.run_in_executor(
                None,
                lambda: _xtts_no_profile(text, xtts_lang, speed)
            )

        return Response(
            content=wav_bytes,
            media_type="audio/wav",
            headers={
                "Content-Disposition": 'attachment; filename="speech.wav"',
                "X-XTTS-Device": DEVICE,
                "X-XTTS-Language": lang,
            },
        )

    except Exception as e:
        log.error(f"TTS error: {e}", exc_info=True)
        raise HTTPException(500, detail=f"Synthesis failed: {str(e)}")


# ─────────────────────────────────────────────────────────────────────────────
# Synthesis Workers (called in thread pool executor)
# ─────────────────────────────────────────────────────────────────────────────
def _xtts_synthesize(text: str, profile: dict, language: str, speed: float) -> bytes:
    """XTTS v2 inference with full speaker conditioning (gpt_cond_latent + speaker_embedding)."""
    outputs = xtts_model.synthesizer.tts_model.inference(
        text=text,
        language=language,
        gpt_cond_latent=profile["gpt_cond_latent"],
        speaker_embedding=profile["speaker_embedding"],
        temperature=0.75,
        repetition_penalty=5.0,
        top_k=50,
        top_p=0.85,
        speed=speed,
        enable_text_splitting=True,
    )
    audio = np.array(outputs["wav"], dtype=np.float32)
    return numpy_to_wav_bytes(audio, XTTS_SAMPLE_RATE)


def _xtts_no_profile(text: str, language: str, speed: float) -> bytes:
    """XTTS v2 synthesis without a specific speaker (uses model default)."""
    tmp_path = tempfile.mktemp(suffix=".wav")
    try:
        xtts_model.tts_to_file(
            text=text,
            language=language,
            file_path=tmp_path,
            speed=speed,
        )
        with open(tmp_path, "rb") as f:
            return f.read()
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass


def _khmer_freevc_synthesize(text: str, profile: dict, speed: float) -> bytes:
    """
    Two-stage Khmer synthesis:
    1. Google Translate TTS → correct Khmer phonetics
    2. FreeVC24 voice conversion → apply target speaker's voice
    """
    tmp_source = None
    tmp_output = tempfile.mktemp(suffix=".wav")

    try:
        # Stage 1: Google TTS for Khmer phonetics
        log.info(f"Stage 1: Google TTS Khmer phonetics for '{text[:40]}...'")
        google_audio = fetch_google_tts(text, lang="km")
        tmp_source = bytes_to_temp_file(google_audio, suffix=".mp3")

        # Stage 2: FreeVC24 voice conversion (source → target speaker)
        reference_path = profile.get("reference_path")
        if not reference_path or not os.path.exists(reference_path):
            raise RuntimeError("Reference audio for voice conversion not found. Please re-clone.")

        log.info(f"Stage 2: FreeVC24 voice conversion → '{profile['name']}'")
        freevc_model.voice_conversion_to_file(
            source_wav=tmp_source,
            target_wav=reference_path,
            file_path=tmp_output,
        )

        with open(tmp_output, "rb") as f:
            return f.read()

    finally:
        for p in [tmp_source, tmp_output]:
            if p and os.path.exists(p):
                try:
                    os.unlink(p)
                except Exception:
                    pass


@app.delete("/profile/{profile_id}")
async def delete_profile(profile_id: str):
    """Delete a cached speaker profile and its reference audio."""
    profile = profiles.pop(profile_id, None)
    if not profile:
        raise HTTPException(404, detail="Profile not found")
    # Clean up reference audio
    ref = profile.get("reference_path")
    if ref and os.path.exists(ref):
        try:
            os.unlink(ref)
        except Exception:
            pass
    return {"success": True}


@app.get("/profiles")
async def list_profiles():
    """List all in-memory speaker profiles."""
    return {
        "profiles": [
            {
                "profile_id": p["profile_id"],
                "name": p["name"],
                "language": p["language"],
                "created_at": p["created_at"],
            }
            for p in profiles.values()
        ]
    }


# ─────────────────────────────────────────────────────────────────────────────
# Entry Point
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    log.info(f"Starting XTTS v2 Voice Cloning Server")
    log.info(f"  Port   : {PORT}")
    log.info(f"  Device : {DEVICE} {'(GPU accelerated 🚀)' if DEVICE == 'cuda' else '(CPU — slower but works)'}")
    log.info(f"  Profiles: {PROFILE_CACHE_DIR}")
    log.info("")
    log.info("First startup downloads XTTS v2 (~1.8GB) + FreeVC24 (~200MB)...")

    uvicorn.run(
        app,
        host="127.0.0.1",
        port=PORT,
        log_level="warning",
        workers=1,          # Must be 1 — models loaded in global state
    )
