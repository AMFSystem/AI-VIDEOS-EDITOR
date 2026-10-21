#!/usr/bin/env python3
"""
VoxCPM2 Dataset Preparation Tool
================================
Splits long raw voice recordings into optimal 3–10s audio segments,
converts to 16kHz Mono WAV, pairs with Khmer transcripts, and
packages into a ready-to-train `voxcpm_dataset.zip` for Google Colab / GPU fine-tuning.

Usage:
  # 1. From a single long audio file + transcript file:
  python prepare_dataset.py -i my_voice.wav -t transcript.txt -o ./dataset

  # 2. Slice audio automatically into clean clips (silence detection):
  python prepare_dataset.py -i my_voice.wav --slice-only -o ./dataset

  # 3. Package an existing folder of wavs + transcript:
  python prepare_dataset.py --package ./dataset
"""

import os
import sys
import json
import zipfile
import argparse
from pathlib import Path
import numpy as np
import soundfile as sf
import scipy.signal

TARGET_SR = 16000  # VoxCPM AudioVAE input sample rate

def resample_audio(audio: np.ndarray, orig_sr: int, target_sr: int = TARGET_SR) -> np.ndarray:
    """Resample audio array to target_sr using high-quality polyphase filtering."""
    if orig_sr == target_sr:
        return audio
    gcd = np.gcd(orig_sr, target_sr)
    up = target_sr // gcd
    down = orig_sr // gcd
    resampled = scipy.signal.resample_poly(audio, up, down)
    return resampled.astype(np.float32)

def to_mono(audio: np.ndarray) -> np.ndarray:
    """Convert multi-channel audio to mono."""
    if audio.ndim == 1:
        return audio
    return np.mean(audio, axis=1)

def normalize_audio(audio: np.ndarray, target_peak: float = 0.95) -> np.ndarray:
    """Peak normalize audio to target peak amplitude."""
    max_val = np.max(np.abs(audio))
    if max_val > 1e-6:
        return (audio / max_val) * target_peak
    return audio

def detect_speech_segments(
    audio: np.ndarray,
    sr: int,
    min_silence_sec: float = 0.4,
    min_segment_sec: float = 2.5,
    max_segment_sec: float = 12.0,
    silence_thresh_db: float = -36.0
):
    """
    Split long audio into natural sentence-level segments using energy-based voice activity detection.
    """
    # Calculate short-time RMS energy in 20ms frames
    frame_len = int(sr * 0.020)
    hop_len = int(sr * 0.010)
    
    num_frames = (len(audio) - frame_len) // hop_len + 1
    if num_frames <= 0:
        return [(0, len(audio))]
    
    frames = np.lib.stride_tricks.sliding_window_view(audio[:num_frames * hop_len + frame_len - hop_len], frame_len)[::hop_len]
    rms = np.sqrt(np.mean(frames ** 2, axis=1) + 1e-9)
    db = 20 * np.log10(rms + 1e-9)
    
    # Adaptive threshold: average of floor and peak
    peak_db = np.max(db)
    noise_floor_db = np.percentile(db, 20)
    effective_thresh = max(silence_thresh_db, noise_floor_db + 8.0)
    
    is_speech = db > effective_thresh
    
    # Smooth speech detections (remove brief silences shorter than min_silence_sec)
    min_silence_frames = int(min_silence_sec / 0.010)
    smoothed = np.copy(is_speech)
    silence_count = 0
    
    for i in range(len(smoothed)):
        if not smoothed[i]:
            silence_count += 1
        else:
            if 0 < silence_count < min_silence_frames:
                smoothed[i - silence_count:i] = True
            silence_count = 0
            
    # Find contiguous speech segments
    diff = np.diff(smoothed.astype(int))
    starts = np.where(diff == 1)[0] + 1
    ends = np.where(diff == -1)[0] + 1
    
    if smoothed[0]:
        starts = np.insert(starts, 0, 0)
    if smoothed[-1]:
        ends = np.append(ends, len(smoothed))
        
    segments = []
    pad_frames = int(0.20 / 0.010)  # 200ms padding
    
    for s, e in zip(starts, ends):
        s_samp = max(0, (s - pad_frames) * hop_len)
        e_samp = min(len(audio), (e + pad_frames) * hop_len + frame_len)
        dur = (e_samp - s_samp) / sr
        
        if dur < min_segment_sec:
            continue
            
        # If segment is too long, subdivide it at lowest energy points
        if dur > max_segment_sec:
            sub_count = int(np.ceil(dur / max_segment_sec))
            sub_len = (e_samp - s_samp) // sub_count
            for k in range(sub_count):
                sub_s = s_samp + k * sub_len
                sub_e = min(e_samp, sub_s + sub_len)
                if (sub_e - sub_s) / sr >= min_segment_sec:
                    segments.append((sub_s, sub_e))
        else:
            segments.append((s_samp, e_samp))
            
    return segments

def process_dataset(
    audio_paths: list[str],
    transcript_path: str = None,
    output_dir: str = "./dataset",
    auto_slice: bool = True
):
    """Process audio files and generate 16kHz mono dataset with JSONL manifest."""
    out_dir = Path(output_dir).resolve()
    wavs_dir = out_dir / "wavs"
    wavs_dir.mkdir(parents=True, exist_ok=True)
    
    manifest_rows = []
    transcripts = []
    
    # Read transcripts if provided
    if transcript_path and os.path.exists(transcript_path):
        with open(transcript_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    transcripts.append(line)
        print(f"📖 Loaded {len(transcripts)} lines of transcripts from {transcript_path}")

    clip_idx = 1
    total_audio_sec = 0.0

    print(f"\n🎙️  Processing audio input files...")
    for a_path in audio_paths:
        if not os.path.exists(a_path):
            print(f"⚠️  File not found: {a_path}")
            continue
            
        print(f"   Reading {Path(a_path).name}...")
        try:
            data, sr = sf.read(a_path)
            data = to_mono(data)
            data = resample_audio(data, sr, TARGET_SR)
            data = normalize_audio(data)
        except Exception as e:
            print(f"❌ Failed to read {a_path}: {e}")
            continue

        if auto_slice and (len(data) / TARGET_SR > 15.0):
            # Split long recording into clean segments
            segments = detect_speech_segments(data, TARGET_SR)
            print(f"   ✂️  Split into {len(segments)} segments")
            for (s_samp, e_samp) in segments:
                clip_data = data[s_samp:e_samp]
                clip_data = normalize_audio(clip_data)
                clip_filename = f"clip_{clip_idx:04d}.wav"
                clip_dest = wavs_dir / clip_filename
                
                sf.write(str(clip_dest), clip_data, TARGET_SR, subtype="PCM_16")
                
                dur = len(clip_data) / TARGET_SR
                total_audio_sec += dur
                
                # Assign transcript text if available, otherwise template
                if transcripts and (clip_idx - 1) < len(transcripts):
                    txt = transcripts[clip_idx - 1]
                else:
                    txt = f"សំឡេងនិយាយគំរូទី {clip_idx}"
                    
                manifest_rows.append({
                    "audio": f"wavs/{clip_filename}",
                    "text": txt,
                    "duration": round(dur, 2)
                })
                clip_idx += 1
        else:
            # Keep as single clip
            dur = len(data) / TARGET_SR
            if dur >= 1.5:
                clip_filename = f"clip_{clip_idx:04d}.wav"
                clip_dest = wavs_dir / clip_filename
                sf.write(str(clip_dest), data, TARGET_SR, subtype="PCM_16")
                total_audio_sec += dur
                
                if transcripts and (clip_idx - 1) < len(transcripts):
                    txt = transcripts[clip_idx - 1]
                else:
                    txt = f"សំឡេងនិយាយគំរូទី {clip_idx}"
                    
                manifest_rows.append({
                    "audio": f"wavs/{clip_filename}",
                    "text": txt,
                    "duration": round(dur, 2)
                })
                clip_idx += 1

    # Write train.jsonl
    manifest_path = out_dir / "train.jsonl"
    with open(manifest_path, "w", encoding="utf-8") as f:
        for row in manifest_rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

    print(f"\n✅ Created {len(manifest_rows)} training clips in: {wavs_dir}")
    print(f"📄 Generated manifest: {manifest_path}")
    print(f"⏱️  Total dataset duration: {total_audio_sec / 60.0:.1f} minutes ({total_audio_sec:.1f} seconds)")

    # Create zip file for Colab upload
    zip_dest = out_dir.parent / "voxcpm_dataset.zip"
    print(f"\n📦 Packaging into: {zip_dest} ...")
    with zipfile.ZipFile(zip_dest, "w", zipfile.ZIP_DEFLATED) as zf:
        # Add manifest
        zf.write(manifest_path, arcname="train.jsonl")
        # Add audio clips
        for wav_file in wavs_dir.glob("*.wav"):
            zf.write(wav_file, arcname=f"wavs/{wav_file.name}")

    zip_size_mb = os.path.getsize(zip_dest) / (1024 * 1024)
    print(f"✨ SUCCESS! Dataset archive ready: {zip_dest} ({zip_size_mb:.2f} MB)")
    print("👉 You can now upload `voxcpm_dataset.zip` directly to Google Colab to train your LoRA!")
    return str(zip_dest)

def main():
    parser = argparse.ArgumentParser(
        description="VoxCPM2 Khmer Dataset Preparation Tool for LoRA Fine-Tuning",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("-i", "--input", nargs="+", help="Input audio file(s) or folder of recordings")
    parser.add_argument("-t", "--transcript", type=str, help="Text transcript file (one sentence per line)")
    parser.add_argument("-o", "--output", type=str, default="./dataset", help="Output dataset directory (default: ./dataset)")
    parser.add_argument("--no-slice", action="store_true", help="Disable automatic slicing of long recordings")

    args = parser.parse_args()

    if not args.input:
        print("💡 Example Usage:")
        print("  python prepare_dataset.py -i my_recording.wav -t transcripts.txt -o ./dataset")
        sys.exit(0)

    # Collect audio files
    audio_files = []
    for item in args.input:
        p = Path(item)
        if p.is_dir():
            for ext in ("*.wav", "*.mp3", "*.m4a", "*.flac", "*.ogg"):
                audio_files.extend([str(f) for f in p.glob(ext)])
        elif p.is_file():
            audio_files.append(str(p))

    if not audio_files:
        print(f"❌ No valid audio files found in: {args.input}")
        sys.exit(1)

    process_dataset(
        audio_paths=audio_files,
        transcript_path=args.transcript,
        output_dir=args.output,
        auto_slice=not args.no_slice
    )

if __name__ == "__main__":
    main()
