"""Speech-to-text service.

Two engines:
- English: stock faster-whisper (large-v3-turbo).
- Khmer: a Khmer fine-tuned Whisper decoded via CTranslate2 (see khmer_stt.py).
  Stock Whisper cannot transcribe Khmer; it mistakes it for Thai or Vietnamese.

Auto mode uses stock Whisper's language detection, which is reliable for
English but scatters low-confidence guesses across many languages for Khmer.
So audio counts as English only when that detection is confident; everything
else goes to the Khmer engine (which also handles English words inside Khmer).

Models load lazily (or at startup with preloading enabled). Inference is
blocking, so callers must run `transcribe` in a worker thread.
"""

import logging
import threading
from dataclasses import dataclass, field
from pathlib import Path

from app.config import Settings

logger = logging.getLogger(__name__)

SAMPLE_RATE = 16_000


@dataclass
class Segment:
    start: float
    end: float
    text: str


@dataclass
class Transcription:
    language: str
    language_probability: float
    duration: float
    text: str
    segmented_text: str
    segments: list[Segment] = field(default_factory=list)


class SttService:
    def __init__(self, settings: Settings):
        self._settings = settings
        self._whisper = None
        self._khmer = None
        self._load_lock = threading.Lock()
        self._slots = threading.Semaphore(settings.stt_max_concurrency)

    def loaded_engines(self) -> list[str]:
        return [name for name, eng in (("en", self._whisper), ("km", self._khmer)) if eng is not None]

    def load(self) -> None:
        self._load_whisper()
        self._load_khmer()

    def _load_whisper(self):
        if self._whisper is None:
            with self._load_lock:
                if self._whisper is None:
                    import os
                    from faster_whisper import WhisperModel

                    num_cores = os.cpu_count() or 4
                    cpu_threads = min(8, max(2, num_cores - 2 if num_cores > 4 else num_cores))

                    s = self._settings
                    logger.info("Loading STT model %s on %s (%s) with %d threads", s.stt_model, s.stt_device, s.stt_compute_type, cpu_threads)
                    download_root = str(s.model_dir / "whisper")
                    try:
                        self._whisper = WhisperModel(
                            s.stt_model,
                            device=s.stt_device,
                            compute_type=s.stt_compute_type,
                            download_root=download_root,
                            local_files_only=True,
                            cpu_threads=cpu_threads,
                            num_workers=2,
                        )
                        logger.info("Whisper STT: Loaded strictly from local offline cache")
                    except Exception:
                        logger.info("Whisper STT: Local model missing, downloading %s...", s.stt_model)
                        self._whisper = WhisperModel(
                            s.stt_model,
                            device=s.stt_device,
                            compute_type=s.stt_compute_type,
                            download_root=download_root,
                            cpu_threads=cpu_threads,
                            num_workers=2,
                        )
        return self._whisper

    def _load_khmer(self):
        if self._khmer is None:
            with self._load_lock:
                if self._khmer is None:
                    from huggingface_hub import snapshot_download

                    from app.services.khmer_stt import KhmerWhisperEngine

                    s = self._settings
                    logger.info("Loading Khmer STT model %s@%s", s.stt_km_model, s.stt_km_model_revision[:7])
                    try:
                        path = snapshot_download(
                            s.stt_km_model,
                            revision=s.stt_km_model_revision,
                            cache_dir=str(s.model_dir / "hf" / "hub"),
                            local_files_only=True,
                        )
                        logger.info("Khmer STT: Using strictly local cached snapshot %s", path)
                    except Exception:
                        logger.info("Khmer STT: Local snapshot missing, downloading %s...", s.stt_km_model)
                        path = snapshot_download(
                            s.stt_km_model,
                            revision=s.stt_km_model_revision,
                            cache_dir=str(s.model_dir / "hf" / "hub"),
                        )
                    self._khmer = KhmerWhisperEngine(
                        Path(path),
                        device=s.stt_device,
                        compute_type=s.stt_km_compute_type,
                        beam_size=s.stt_beam_size,
                        batch_size=s.stt_km_batch_size,
                    )
        return self._khmer

    def transcribe(self, audio_path: Path, language: str | None = None) -> Transcription:
        """Transcribe an audio file. `language=None` or `language='auto'` auto-detects language."""
        from faster_whisper.audio import decode_audio

        audio = decode_audio(str(audio_path), sampling_rate=SAMPLE_RATE)
        duration = round(len(audio) / SAMPLE_RATE, 2)

        with self._slots:
            if not language or language == "auto":
                target_lang, probability = self._detect(audio)
            else:
                target_lang = language.lower().strip()
                probability = 1.0

            if target_lang == "km":
                chunks = self._load_khmer().transcribe(audio)
                segments = [Segment(c.start, c.end, c.text) for c in chunks]
                text = " ".join(c.text for c in chunks)
                segmented = " ".join(c.segmented for c in chunks)
            else:
                segments = self._transcribe_whisper(audio, target_lang)
                text = " ".join(s.text for s in segments)
                segmented = text

        return Transcription(
            language=target_lang,
            language_probability=round(probability, 3),
            duration=duration,
            text=text,
            segmented_text=segmented,
            segments=segments,
        )

    def _detect(self, audio) -> tuple[str, float]:
        _, _, all_probs = self._load_whisper().detect_language(audio)
        p_en = dict(all_probs).get("en", 0.0)
        if p_en >= self._settings.stt_en_threshold:
            return "en", p_en
        return "km", 1.0 - p_en


    def _transcribe_whisper(self, audio, language: str = "en") -> list[Segment]:
        beam_size = max(1, min(self._settings.stt_beam_size, 3))
        segments_iter, _ = self._load_whisper().transcribe(
            audio,
            language=language if language != "auto" else None,
            beam_size=beam_size,
            vad_filter=True,  # skip silence: faster and fewer hallucinations
            word_timestamps=True,
        )
        # `segments_iter` is lazy; decoding actually happens while iterating.
        return [Segment(round(s.start, 2), round(s.end, 2), s.text.strip()) for s in segments_iter if s.text.strip()]

