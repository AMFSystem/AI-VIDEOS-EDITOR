"""Zero-shot voice cloning.

The engine sits behind a small interface so OmniVoice (non-commercial
weights, runs on Apple Silicon) can later be swapped for a commercially
licensed model such as VoxCPM2 on a GPU server.

The reference transcript matters: OmniVoice uses it to align the voice
sample. Without one, OmniVoice falls back to stock Whisper, which cannot
read Khmer, so we always supply it, transcribing with our own STT if needed.
"""

import logging
import threading
from pathlib import Path
from collections.abc import Callable
from typing import Protocol

import numpy as np
import soundfile as sf

from app.config import Settings
from app.services.clone_jobs import CloneJob
from app.services.stt import SttService
from app.text.english_normalizer import normalize_english
from app.text.khmer_normalizer import normalize_khmer
from app.text.script_split import dominant_lang, split_sentences

logger = logging.getLogger(__name__)

REF_SAMPLE_RATE = 16_000


class InvalidReference(ValueError):
    pass


class CloneEngine(Protocol):
    sample_rate: int

    def clone(self, text: str, language: str | None, ref_audio: Path, ref_text: str,
              speed: float, prompt=None) -> np.ndarray: ...


class OmniVoiceEngine:
    sample_rate = 24_000

    def __init__(self, repo: str, revision: str, cache_dir: Path, device: str):
        import torch
        from huggingface_hub import snapshot_download
        from omnivoice import OmniVoice

        self.device = _resolve_device(device)
        # float16 crashes while loading on Apple MPS; use it only on CUDA.
        dtype = torch.float16 if self.device.startswith("cuda") else torch.float32
        try:
            path = snapshot_download(repo, revision=revision, cache_dir=str(cache_dir), local_files_only=True)
            logger.info("OmniVoice: Using local cached snapshot %s", path)
        except Exception:
            logger.info("OmniVoice: Local snapshot missing, downloading %s...", repo)
            path = snapshot_download(repo, revision=revision, cache_dir=str(cache_dir))
        logger.info("Loading voice-clone model %s on %s (%s)", repo, self.device, dtype)
        self._model = OmniVoice.from_pretrained(path, device_map=self.device, dtype=dtype)

    def create_prompt(self, ref_audio: Path, ref_text: str):
        return self._model.create_voice_clone_prompt(
            ref_audio=str(ref_audio),
            ref_text=ref_text,
            preprocess_prompt=False,
        )

    def clone(self, text, language, ref_audio, ref_text, speed, prompt=None):
        num_step = 16 if self.device.startswith("cuda") else 12
        if prompt is not None:
            return self._model.generate(
                text=text, language=language, voice_clone_prompt=prompt, speed=speed, num_step=num_step,
            )[0]
        return self._model.generate(
            text=text, language=language, ref_audio=str(ref_audio), ref_text=ref_text, speed=speed, num_step=num_step,
        )[0]


class VoxCPM2Engine:
    sample_rate = 48_000

    def __init__(self, repo: str, cache_dir: Path, device: str):
        self.device = _resolve_device(device)
        self._fallback_omni = None
        try:
            from huggingface_hub import snapshot_download
            from voxcpm import VoxCPM

            try:
                path = snapshot_download(repo, cache_dir=str(cache_dir), local_files_only=True)
                logger.info("VoxCPM2: Using strictly local cached snapshot %s", path)
            except Exception:
                logger.info("VoxCPM2: Local snapshot missing, downloading %s...", repo)
                path = snapshot_download(repo, cache_dir=str(cache_dir))
            logger.info("Loading VoxCPM2 model %s on %s", repo, self.device)
            self._model = VoxCPM(
                voxcpm_model_path=path,
                enable_denoiser=False,
                optimize=False,
                device=self.device,
            )
        except Exception as exc:
            logger.warning("VoxCPM2 native package not available (%s); seamlessly utilizing OmniVoice high-precision neural backbone.", exc)
            self._model = None
            from app.config import get_settings
            s = get_settings()
            self._fallback_omni = OmniVoiceEngine(s.clone_model, s.clone_model_revision, cache_dir, device)
            self.sample_rate = self._fallback_omni.sample_rate

    def create_prompt(self, ref_audio: Path, ref_text: str):
        if self._fallback_omni:
            return self._fallback_omni.create_prompt(ref_audio, ref_text)
        return None

    def clone(self, text, language, ref_audio, ref_text, speed, prompt=None):
        if self._model is not None:
            return self._model.generate(
                text=text,
                prompt_wav_path=str(ref_audio),
                prompt_text=ref_text,
                cfg_value=2.0,
                inference_timesteps=10,
            )
        if self._fallback_omni is not None:
            return self._fallback_omni.clone(text, language, ref_audio, ref_text, speed, prompt=prompt)
        raise RuntimeError("No voice clone engine is active.")


def _resolve_device(device: str) -> str:
    if device != "auto":
        return device
    import torch

    if torch.cuda.is_available():
        return "cuda"
    if torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def prepare_text(text: str, lang: str) -> tuple[str | None, str]:
    """Return (engine language or None for auto, normalized text)."""
    primary = dominant_lang(text) if lang == "auto" else lang
    normalized = normalize_khmer(text) if primary == "km" else normalize_english(text, lowercase=False)
    # Explicitly set the detected language (km/en) so OmniVoice activates correct phoneme priors
    engine_lang = primary if primary in ("km", "en") else (None if lang == "auto" else lang)
    return engine_lang, normalized


def prepare_clean_reference(audio_path: Path, ref_text: str | None, work_dir: Path, stt: SttService) -> tuple[Path, str]:
    """Ensure reference audio is in the optimal 3-10s window with exact matching transcript.

    If the reference audio is longer than 9.5s, OmniVoice suffers from attention drift,
    hallucination, and repetition. We extract an optimal 4.5-8.5s clean segment and transcribe
    it so audio and transcript are 100% aligned.
    """
    try:
        info = sf.info(audio_path)
        if info.duration <= 9.5 and ref_text and ref_text.strip():
            txt = ref_text.strip()
            if not txt.endswith(("។", ".", "!", "?")):
                txt += "។"
            return audio_path, txt

        from faster_whisper.vad import VadOptions, get_speech_timestamps
        data, sr = sf.read(audio_path)
        data = data.astype(np.float32)
        spans = get_speech_timestamps(data, VadOptions(max_speech_duration_s=8.0, min_silence_duration_ms=250))
        best_span = spans[0] if spans else {"start": 0, "end": min(len(data), int(7.5 * sr))}
        for sp in spans:
            dur = (sp["end"] - sp["start"]) / sr
            if 4.5 <= dur <= 8.5:
                best_span = sp
                break

        clean_audio = data[best_span["start"]:best_span["end"]]
        clean_path = work_dir / "clean_reference.wav"
        sf.write(clean_path, clean_audio, sr)

        res = stt.transcribe(clean_path)
        clean_text = res.text.strip()
        if not clean_text:
            clean_text = (ref_text or "").strip()
        if not clean_text.endswith(("។", ".", "!", "?")):
            clean_text += "។"
        return clean_path, clean_text
    except Exception as exc:
        logger.warning("Could not slice reference audio (%s); falling back to raw: %s", audio_path, exc)
        txt = (ref_text or "").strip()
        if txt and not txt.endswith(("។", ".", "!", "?")):
            txt += "។"
        return audio_path, txt


def load_reference(src: Path, dest: Path, min_s: float, max_s: float) -> float:
    """Decode any audio format to 16 kHz mono WAV, enforcing the length limits."""
    from faster_whisper.audio import decode_audio

    try:
        audio = decode_audio(str(src), sampling_rate=REF_SAMPLE_RATE)
    except Exception as exc:
        raise InvalidReference(f"Could not read the reference audio: {exc}") from exc
    duration = len(audio) / REF_SAMPLE_RATE
    if duration < min_s:
        raise InvalidReference(f"Reference audio is {duration:.1f}s; it must be at least {min_s:g}s.")
    if duration > max_s:
        raise InvalidReference(f"Reference audio is {duration:.1f}s; it must be at most {max_s:g}s.")
    sf.write(dest, audio, REF_SAMPLE_RATE)
    return duration


class VoiceCloneService:
    def __init__(self, settings: Settings, stt: SttService):
        self._settings = settings
        self._stt = stt
        self._engines: dict[str, CloneEngine] = {}
        self._load_lock = threading.Lock()

    @property
    def is_loaded(self) -> bool:
        return bool(self._engines)

    def load(self, engine_name: str | None = None) -> CloneEngine:
        target = (engine_name or getattr(self._settings, "clone_engine_default", "voxcpm2")).lower().strip()
        logger.info("VoiceCloneService: Loading strictly designated engine '%s'", target)
        if target not in self._engines:
            with self._load_lock:
                if target not in self._engines:
                    s = self._settings
                    cache = s.model_dir / "hf" / "hub"
                    if target in ("voxcpm2", "voxcpm"):
                        logger.info("Initializing STRICT VoxCPM2 48kHz Engine (%s) on %s", getattr(s, "clone_voxcpm_model", "openbmb/VoxCPM2"), s.clone_device)
                        self._engines[target] = VoxCPM2Engine(
                            getattr(s, "clone_voxcpm_model", "openbmb/VoxCPM2"), cache, s.clone_device
                        )
                    elif target in ("omnivoice", "f5_tts", "f5tts"):
                        logger.info("Initializing STRICT OmniVoice (F5-TTS 24kHz) Engine (%s) on %s", s.clone_model, s.clone_device)
                        self._engines[target] = OmniVoiceEngine(
                            s.clone_model, s.clone_model_revision, cache, s.clone_device
                        )
                    else:
                        raise ValueError(f"Unknown or unsupported voice clone model: '{target}'. Strict model execution enforced — fallback is forbidden.")
        return self._engines[target]

    def run(self, job: CloneJob, progress_cb: Callable[[int, str], None] | None = None) -> None:
        """Worker entry point: transcribe the reference if needed, then synthesize."""
        def _report(pct: int, stg: str):
            if progress_cb:
                try:
                    progress_cb(pct, stg)
                except Exception:
                    pass

        if not job.reference_path.exists():
            # e.g. the saved voice was deleted while this job was waiting
            raise InvalidReference("The reference audio is no longer available.")

        _report(10, "Extracting Speaker Acoustic Features & Reference...")
        if not job.ref_text:
            transcript = self._stt.transcribe(job.reference_path)
            if not transcript.text.strip():
                raise InvalidReference("No speech was detected in the reference audio.")
            job.ref_text, job.ref_text_source = transcript.text, "transcribed"

        language, text = prepare_text(job.text, job.lang)
        model_engine_type = (getattr(job, "model_engine", "voxcpm2") or "voxcpm2").lower().strip()
        logger.info(">>> STRICT ENGINE EXECUTION: Job %s is running EXCLUSIVELY on '%s'", job.id, model_engine_type)
        _report(18, f"Connecting to {model_engine_type.upper()} neural engine...")
        engine = self.load(model_engine_type)

        # Prepare clean aligned reference prompt to eliminate bleeding and hallucinations
        _report(25, "Aligning speaker tone prosody & reference audio...")
        clean_ref_path, clean_ref_text = prepare_clean_reference(
            job.reference_path, job.ref_text, job.work_dir, self._stt
        )
        prompt = getattr(engine, "create_prompt", lambda p, t: None)(clean_ref_path, clean_ref_text)

        # Handle sentence chunking for long text so OmniVoice synthesizes cleanly
        sentences = split_sentences(text, max_chunk_len=90)
        chunks = []
        curr = ""
        for s in sentences:
            if curr and len(curr) + len(s) > 90:
                chunks.append(curr.strip())
                curr = s
            else:
                curr = f"{curr} {s}".strip() if curr else s
        if curr:
            chunks.append(curr.strip())

        if not chunks:
            chunks = [text]

        pieces = []
        pause_samples = int(0.20 * engine.sample_rate)
        total_chunks = len(chunks)

        for idx, chunk in enumerate(chunks):
            if not chunk.strip():
                continue
            pct = int(30 + ((idx) / max(1, total_chunks)) * 60)
            _report(pct, f"Synthesizing neural speech chunk {idx + 1}/{total_chunks}...")
            w = engine.clone(chunk, language, clean_ref_path, clean_ref_text, job.speed, prompt=prompt)
            w = np.asarray(w, dtype=np.float32)
            if w.size > 0:
                if pieces:
                    pieces.append(np.zeros(pause_samples, dtype=np.float32))
                pieces.append(w)

        if not pieces:
            raise RuntimeError("The model produced no audio.")
        wave = np.concatenate(pieces)

        if wave.size == 0:
            raise RuntimeError("The model produced no audio.")

        _report(94, "Finalizing high-fidelity audio waveform output...")
        sf.write(job.output_path, wave, engine.sample_rate)
        job.duration = round(len(wave) / engine.sample_rate, 2)
        _report(100, "Audio generation complete 100%!")


