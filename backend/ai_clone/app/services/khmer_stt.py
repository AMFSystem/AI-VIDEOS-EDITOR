"""Khmer speech recognition with a Khmer fine-tuned Whisper, decoded via CTranslate2.

The fine-tune (whisper-turbo-khmer-v9) adds ~6k Khmer word pieces to the
vocabulary *after* Whisper's special tokens. faster-whisper treats every id
past <|endoftext|> as a control token and drops it, so this engine runs the
model through CTranslate2 directly and strips control tokens by name instead.

The model emits khmercut-style output: words separated by spaces and phrase
groups separated by ";". We turn that into normal Khmer text (no spaces
inside a phrase) plus a word-segmented version.
"""

import json
import os
import re
from dataclasses import dataclass
from pathlib import Path

import numpy as np

SAMPLE_RATE = 16_000
N_FRAMES = 3_000  # Whisper's fixed 30 s input window
MAX_CHUNK_S = 29.0

_SPECIAL_RE = re.compile(r"<\|.*\|>")
_KHMER_GAP_RE = re.compile(r"(?<=[ក-៿])\s+(?=[ក-៿])")

# Common Khmer connectors and conjunctions that naturally carry a leading space in text
_KHMER_CONNECTORS = {
    "និង", "ឬ", "ប៉ុន្តែ", "ហើយ", "ដែល", "ក្នុង", "លើ", "ពី", "នៅ",
    "ព្រោះ", "ដើម្បី", "គឺ", "ជា", "ដូច្នេះ", "ប្រសិនបើ", "ដូចជា"
}


@dataclass
class KhmerChunk:
    start: float
    end: float
    text: str  # natural Khmer: spaces only between phrases and around Latin words
    segmented: str  # every word separated by a space


def clean_khmer_output(raw: str) -> tuple[str, str]:
    """'សួស ; ស្តី ; ខ្ញុំ ; ឈ្មោះ' -> ('សួស្តី ខ្ញុំឈ្មោះ', 'សួស ស្តី ខ្ញុំ ឈ្មោះ')"""
    words = [w.strip() for w in raw.split(";") if w.strip()]
    if not words:
        return "", ""

    segmented = " ".join(words)
    res = ""
    for w in words:
        if not res:
            res = w
        elif w in _KHMER_CONNECTORS or len(res.split()[-1]) > 14:
            res += " " + w
        elif any(c.isascii() and c.isalnum() for c in w) or any(c.isascii() and c.isalnum() for c in res[-1]):
            res += " " + w
        else:
            res += w
    return res.strip(), segmented


def make_khmer_subtitles(words: list[str], start_s: float, end_s: float, max_words_per_sub: int = 5) -> list[KhmerChunk]:
    """Break a list of recognized words within a time span into natural subtitle cards."""
    if not words:
        return []

    total_dur = max(0.1, end_s - start_s)
    total_words = len(words)

    # Short spans (<= 3.5s) or few words (<= 5) stay as a single subtitle card
    if total_dur <= 3.5 or total_words <= 5:
        text, seg = clean_khmer_output(";".join(words))
        if text:
            return [KhmerChunk(start=round(start_s, 2), end=round(end_s, 2), text=text, segmented=seg)]
        return []

    # Target 3-5 words per subtitle card for optimal video reading
    target_size = min(max_words_per_sub, max(3, (total_words + 1) // max(2, int(total_dur / 2.5))))
    phrases = []
    current = []

    split_triggers = {"និង", "ឬ", "ប៉ុន្តែ", "ហើយ", "ដែល", "ព្រោះ", "ដើម្បី", "ដូច្នេះ", "។", "!", "?"}

    for i, w in enumerate(words):
        current.append(w)
        is_last = (i == total_words - 1)
        if is_last:
            phrases.append(current)
            current = []
        elif len(current) >= target_size:
            phrases.append(current)
            current = []
        elif len(current) >= 3 and i + 1 < total_words and words[i + 1] in split_triggers:
            phrases.append(current)
            current = []

    if current:
        if phrases:
            phrases[-1].extend(current)
        else:
            phrases.append(current)

    subtitles = []
    cur_start = start_s
    words_acc = 0
    for p in phrases:
        words_acc += len(p)
        cur_end = min(end_s, start_s + (words_acc / total_words) * total_dur)
        t, s = clean_khmer_output(";".join(p))
        if t:
            subtitles.append(KhmerChunk(
                start=round(cur_start, 2),
                end=round(cur_end, 2),
                text=t,
                segmented=s,
            ))
        cur_start = cur_end
    return subtitles


class KhmerWhisperEngine:
    def __init__(self, model_dir: Path, device: str, compute_type: str, beam_size: int, batch_size: int):
        import ctranslate2
        from faster_whisper.feature_extractor import FeatureExtractor
        from tokenizers import Tokenizer

        # Harness full CPU / Apple Silicon multi-core power
        num_cores = os.cpu_count() or 4
        intra_threads = min(8, max(2, num_cores - 2 if num_cores > 4 else num_cores))

        self._ct2 = ctranslate2
        self._model = ctranslate2.models.Whisper(
            str(model_dir),
            device=device,
            compute_type=compute_type,
            intra_threads=intra_threads,
            inter_threads=2,
        )
        self._features = FeatureExtractor(feature_size=self._model.n_mels)
        self._tokenizer = Tokenizer.from_file(str(model_dir / "tokenizer.json"))
        self._beam_size = max(1, min(beam_size, 3))  # beam_size 1-3 is optimal for turbo models
        self._batch_size = max(4, batch_size)

        vocab = json.loads((model_dir / "vocabulary.json").read_text())
        self._special_ids = {i for i, tok in enumerate(vocab) if _SPECIAL_RE.fullmatch(tok)}
        self._prompt = [vocab.index(t) for t in
                        ("<|startoftranscript|>", "<|km|>", "<|transcribe|>", "<|notimestamps|>")]

    def transcribe(self, audio: np.ndarray) -> list[KhmerChunk]:
        from faster_whisper.vad import VadOptions, get_speech_timestamps

        # Split on silence into <30 s pieces so long recordings fit Whisper's window.
        spans = get_speech_timestamps(
            audio, VadOptions(max_speech_duration_s=MAX_CHUNK_S, min_silence_duration_ms=400))

        # Robust VAD Fallback: If VAD detected no pauses (quiet audio or music), chunk by time
        if not spans:
            total_len = len(audio)
            chunk_samples = int(MAX_CHUNK_S * SAMPLE_RATE)
            spans = [
                {"start": i, "end": min(i + chunk_samples, total_len)}
                for i in range(0, total_len, chunk_samples)
            ]

        chunks: list[KhmerChunk] = []
        for i in range(0, len(spans), self._batch_size):
            batch = spans[i:i + self._batch_size]
            feats = np.stack([self._mel(audio[s["start"]:s["end"]]) for s in batch])
            results = self._model.generate(
                self._ct2.StorageView.from_array(feats),
                [self._prompt] * len(batch),
                beam_size=self._beam_size,
                max_length=448,
            )
            for span, res in zip(batch, results):
                ids = [t for t in res.sequences_ids[0] if t not in self._special_ids]
                raw_decoded = self._tokenizer.decode(ids)
                words = [w.strip() for w in raw_decoded.split(";") if w.strip()]
                start_s = span["start"] / SAMPLE_RATE
                end_s = span["end"] / SAMPLE_RATE

                subtitles = make_khmer_subtitles(words, start_s, end_s)
                chunks.extend(subtitles)

        return chunks

    def _mel(self, audio: np.ndarray) -> np.ndarray:
        mel = self._features(audio)[:, :N_FRAMES]
        if mel.shape[1] < N_FRAMES:
            mel = np.pad(mel, ((0, 0), (0, N_FRAMES - mel.shape[1])))
        return mel.astype(np.float32)

