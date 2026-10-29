"""Khmer speech recognition with a Khmer fine-tuned Whisper, decoded via CTranslate2.

The fine-tune (whisper-turbo-khmer-v9) adds ~6k Khmer word pieces to the
vocabulary *after* Whisper's special tokens. faster-whisper treats every id
past <|endoftext|> as a control token and drops it, so this engine runs the
model through CTranslate2 directly and strips control tokens by name instead.

The model emits khmercut-style output: words separated by spaces and phrase
groups separated by ";". We turn that into clean, natural Khmer subtitle cards
with optimal duration, word segmentation for sync, and natural pause spacing.
"""

import json
import os
import re
import unicodedata
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
    "ព្រោះ", "ដើម្បី", "គឺ", "ជា", "ដូច្នេះ", "ប្រសិនបើ", "ដូចជា",
    "ថា", "ក៏", "កាល", "ពេល", "លុះ", "ទើប", "ឯ"
}


@dataclass
class KhmerChunk:
    start: float
    end: float
    text: str  # natural Khmer: spaces only between phrases and around Latin words
    segmented: str  # every word separated by a space


def clean_khmer_output(raw: str) -> tuple[str, str]:
    """'ការ ដើម ឡើយ ; នៅ ភាគ ខាងកើត' -> ('ការដើមឡើយ នៅភាគខាងកើត', 'ការ ដើម ឡើយ នៅ ភាគ ខាងកើត')"""
    raw = unicodedata.normalize("NFC", raw).replace("\ufffd", "")
    groups = [g.strip() for g in raw.split(";") if g.strip()]
    if not groups:
        return "", ""

    # Filter out non-speech audio event annotations like [Music], (singing), etc.
    filtered_groups = []
    for g in groups:
        words = [w.strip() for w in g.split() if w.strip()]
        words = [w for w in words if not re.fullmatch(r"[\(\[\{].*?(?:music|singing|applause|cheering|sound|instrumental).*?[\)\]\}]", w, re.I)]
        # Deduplicate consecutive repetitive tokens (e.g. បាន បាន បាន)
        deduped = []
        prev_w = None
        rep_count = 0
        for w in words:
            if w == prev_w:
                rep_count += 1
                if rep_count < 2:
                    deduped.append(w)
            else:
                prev_w = w
                rep_count = 0
                deduped.append(w)
        if deduped:
            filtered_groups.append(" ".join(deduped))

    if not filtered_groups:
        return "", ""

    segmented = " ".join(filtered_groups)
    cleaned_phrases = [_KHMER_GAP_RE.sub("", g) for g in filtered_groups]
    res = " ".join(cleaned_phrases).strip()
    return res, segmented


def make_khmer_subtitles(words: list[str], start_s: float, end_s: float, max_words_per_sub: int = 5) -> list[KhmerChunk]:
    """Break a list of recognized words within a time span into natural subtitle cards."""
    if not words:
        return []
    raw_stream = ";".join(words)
    return make_khmer_subtitles_from_decoded(raw_stream, start_s, end_s, max_words_per_sub)


def make_khmer_subtitles_from_decoded(
    raw_decoded: str,
    start_s: float,
    end_s: float,
    max_words_per_sub: int = 5,
) -> list[KhmerChunk]:
    """Break raw decoded Khmer text stream into natural, readable subtitle cards."""
    cleaned = re.sub(r"[\(\[\{].*?(?:music|singing|applause|cheering|sound|instrumental).*?[\)\]\}]", "", raw_decoded, flags=re.I)
    cleaned = unicodedata.normalize("NFC", cleaned).replace("\ufffd", "").strip()
    if not cleaned:
        return []

    raw_groups = [g.strip() for g in cleaned.split(";") if g.strip()]
    if not raw_groups:
        return []

    tokens: list[tuple[str, bool]] = []
    for g_idx, group in enumerate(raw_groups):
        words = [w.strip() for w in group.split() if w.strip()]
        for w_idx, w in enumerate(words):
            is_phrase_end = (w_idx == len(words) - 1 and g_idx < len(raw_groups) - 1)
            tokens.append((w, is_phrase_end))

    # Deduplicate repetitive consecutive tokens (halting loops like បាន បាន បាន)
    deduped_tokens: list[tuple[str, bool]] = []
    prev_w = None
    rep_count = 0
    for w, is_end in tokens:
        if w == prev_w:
            rep_count += 1
            if rep_count < 2:  # allow natural double words (e.g. តិចៗ)
                deduped_tokens.append((w, is_end))
        else:
            prev_w = w
            rep_count = 0
            deduped_tokens.append((w, is_end))

    total_tokens = len(deduped_tokens)
    if total_tokens == 0:
        return []

    total_dur = max(0.1, end_s - start_s)

    # Short span (<= 3.0s) or few words (<= 4) stay as a single subtitle card
    if total_dur <= 3.0 or total_tokens <= 4:
        card_words = [t[0] for t in deduped_tokens]
        text, seg = clean_khmer_output(";".join(card_words))
        if text:
            return [KhmerChunk(start=round(start_s, 2), end=round(end_s, 2), text=text, segmented=seg)]
        return []

    # Dynamic target words per card: 3 to 6 words for optimal reading speed (~2.5s per card)
    target_words = min(max_words_per_sub, max(3, int(total_tokens / max(1, total_dur / 2.5))))
    cards: list[list[str]] = []
    cur_card: list[str] = []

    for i, (w, is_phrase_end) in enumerate(deduped_tokens):
        cur_card.append(w)
        is_last = (i == total_tokens - 1)
        next_w = deduped_tokens[i + 1][0] if not is_last else ""

        if is_last:
            cards.append(cur_card)
            cur_card = []
        elif is_phrase_end:
            cards.append(cur_card)
            cur_card = []
        elif len(cur_card) >= target_words:
            cards.append(cur_card)
            cur_card = []
        elif len(cur_card) >= 3 and next_w in _KHMER_CONNECTORS:
            cards.append(cur_card)
            cur_card = []

    if cur_card:
        if cards:
            cards[-1].extend(cur_card)
        else:
            cards.append(cur_card)

    # Merge very small trailing cards (<= 1 word) with previous card to prevent 0.4s flicker
    if len(cards) > 1 and len(cards[-1]) <= 1:
        tail = cards.pop()
        cards[-1].extend(tail)

    subtitles: list[KhmerChunk] = []
    cur_start = start_s
    words_acc = 0
    for card_words in cards:
        words_acc += len(card_words)
        cur_end = min(end_s, start_s + (words_acc / total_tokens) * total_dur)
        t, s = clean_khmer_output(";".join(card_words))
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

        total_len = len(audio)
        if total_len < SAMPLE_RATE * 0.2:
            return []

        # Tuned VAD: sensitive enough for singing over music, soft dialogue and normal speech
        try:
            spans = get_speech_timestamps(
                audio,
                VadOptions(
                    threshold=0.22,
                    min_speech_duration_ms=200,
                    min_silence_duration_ms=300,
                    speech_pad_ms=250,
                    max_speech_duration_s=25.0,
                ),
            )
        except Exception:
            spans = []

        total_speech_len = sum(s["end"] - s["start"] for s in spans) if spans else 0
        vad_coverage = total_speech_len / max(1, total_len)

        # Robust Music / Song / Low-VAD Fallback:
        # In songs or noisy dialogue with background music, VAD might detect very few chunks (< 35% coverage).
        # We divide audio into contiguous chunks (18s window, 1.5s step-back) so no singing/vocals are missed!
        if not spans or vad_coverage < 0.35:
            chunk_samples = int(18.0 * SAMPLE_RATE)
            step_samples = int(16.5 * SAMPLE_RATE)
            spans = []
            for i in range(0, total_len, step_samples):
                end = min(i + chunk_samples, total_len)
                if end - i > SAMPLE_RATE * 0.4:
                    spans.append({"start": i, "end": end})

        # Skip chunks that are pure silence (RMS < 0.003) to prevent silence hallucination
        active_spans = []
        for s in spans:
            clip = audio[s["start"]:s["end"]]
            if len(clip) > 0:
                rms = float(np.sqrt(np.mean(clip ** 2)))
                if rms >= 0.003:
                    active_spans.append(s)

        if not active_spans:
            return []

        chunks: list[KhmerChunk] = []
        for i in range(0, len(active_spans), self._batch_size):
            batch = active_spans[i:i + self._batch_size]
            feats = np.stack([self._mel(audio[s["start"]:s["end"]]) for s in batch])
            results = self._model.generate(
                self._ct2.StorageView.from_array(feats),
                [self._prompt] * len(batch),
                beam_size=self._beam_size,
                patience=1.0,
                suppress_blank=True,
                repetition_penalty=1.18,
                no_repeat_ngram_size=4,
                max_length=448,
            )
            for span, res in zip(batch, results):
                ids = [t for t in res.sequences_ids[0] if t not in self._special_ids]
                raw_decoded = self._tokenizer.decode(ids)
                start_s = span["start"] / SAMPLE_RATE
                end_s = span["end"] / SAMPLE_RATE

                subtitles = make_khmer_subtitles_from_decoded(raw_decoded, start_s, end_s)
                chunks.extend(subtitles)

        return chunks

    def _mel(self, audio: np.ndarray) -> np.ndarray:
        # Pre-process audio: remove DC offset and peak-normalize for clear vocal formants
        if len(audio) > 0:
            audio = audio - np.mean(audio)
            peak = float(np.max(np.abs(audio)))
            if peak > 1e-4:
                audio = (audio / peak) * 0.95
        mel = self._features(audio)[:, :N_FRAMES]
        if mel.shape[1] < N_FRAMES:
            mel = np.pad(mel, ((0, 0), (0, N_FRAMES - mel.shape[1])))
        return mel.astype(np.float32)

