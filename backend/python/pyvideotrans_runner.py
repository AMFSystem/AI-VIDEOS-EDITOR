#!/usr/bin/env python3
"""
PyVideoTrans Dedicated Native Pipeline Runner
Executes 100% official pyvideotrans engine (TransCreate / TaskCfgVTT)
without modifying any code inside backend/python/pyvideotrans.
Emits real-time JSON events to stdout for DubberPanel.
"""

import sys
import os

# Ensure Homebrew dynamic libraries (librubberband, etc.) are found on macOS
if sys.platform == "darwin":
    for lib_dir in ["/opt/homebrew/lib", "/usr/local/lib"]:
        if os.path.exists(lib_dir):
            curr_dyld = os.environ.get("DYLD_FALLBACK_LIBRARY_PATH", "")
            if lib_dir not in curr_dyld:
                os.environ["DYLD_FALLBACK_LIBRARY_PATH"] = f"{lib_dir}:{curr_dyld}".strip(":")

import json
import argparse
import traceback
from dataclasses import asdict
from pathlib import Path

# Add pyvideotrans repository to Python path
CURRENT_DIR = Path(__file__).resolve().parent
PYVIDEOTRANS_DIR = CURRENT_DIR / "pyvideotrans"
if str(PYVIDEOTRANS_DIR) not in sys.path:
    sys.path.insert(0, str(PYVIDEOTRANS_DIR))

# Ensure winform is mocked for headless CLI execution before loading videotrans
import videotrans
videotrans.winform = None

# Initialize pyvideotrans configuration
from videotrans.configure import config
config.init_run()

from videotrans.configure.config import app_cfg, tr
app_cfg.exec_mode = "cli"
app_cfg.exit_soft = False

from videotrans.task.trans_create import TransCreate
from videotrans.task.taskcfg import TaskCfgVTT
from videotrans.util import tools


def emit(data: dict):
    """Emit JSON event to stdout for backend/frontend streaming."""
    print(f"__PYVT_EVENT__{json.dumps(data, ensure_ascii=False)}", flush=True)


class StreamTransCreate(TransCreate):
    """Custom TransCreate that emits structured JSON events on signals."""

    def signal(self, text="", precent=-1, error=None, type=""):
        if error:
            emit({"type": "error", "error": str(error)})
            return
        if text:
            clean_text = str(text).strip()
            if clean_text and clean_text != "forbid":
                emit({"type": "log", "message": clean_text, "precent": self.precent})
        if precent >= 0:
            emit({"type": "progress", "progress": precent})


def run_pipeline(cfg_dict: dict):
    try:
        emit({"type": "stage", "stage": 1, "total_stages": 9, "title": "Preprocessing..."})
        
        # Ensure output and cache directories
        target_dir = cfg_dict.get("target_dir")
        if not target_dir:
            file_name = Path(cfg_dict["name"]).stem
            target_dir = str(CURRENT_DIR / "output" / f"{file_name}_out")
            cfg_dict["target_dir"] = target_dir
        Path(target_dir).mkdir(parents=True, exist_ok=True)

        # Get file metadata
        file_obj = tools.format_video(Path(cfg_dict["name"]).absolute().as_posix())
        file_dict = asdict(file_obj)
        for k, v in file_dict.items():
            if k == "target_dir" and cfg_dict.get("target_dir"):
                continue
            if k not in cfg_dict or cfg_dict[k] is None:
                cfg_dict[k] = v

        # Set official pyvideotrans cache folder
        cache_folder = f"{config.TEMP_DIR}/{file_obj.uuid}"
        cfg_dict["cache_folder"] = cache_folder
        Path(cache_folder).mkdir(parents=True, exist_ok=True)

        app_cfg.exit_soft = False
        app_cfg.exec_mode = "cli"

        # Safeguard: CUDA is strictly for NVIDIA GPUs on Linux/Windows.
        # On macOS (Darwin) or systems without a functional NVIDIA CUDA GPU, force is_cuda = False
        # so faster-whisper runs on high-performance native CPU (ARM64 NEON).
        import platform
        import dataclasses
        if platform.system() == "Darwin":
            cfg_dict["is_cuda"] = False
        elif cfg_dict.get("is_cuda"):
            try:
                import torch
                if not torch.cuda.is_available():
                    cfg_dict["is_cuda"] = False
            except Exception:
                cfg_dict["is_cuda"] = False

        try:
            from videotrans.util.gpus import getset_gpu
            getset_gpu()
        except Exception:
            pass

        # Normalize Khmer Voice Roles for Edge-TTS
        # Official Edge-TTS for Khmer (km) supports:
        # - Female: "Sreymom(Female/KH)" (km-KH-SreymomNeural)
        # - Male: "Piseth(Male/KH)" (km-KH-PisethNeural)
        target_lang = str(cfg_dict.get("target_language_code") or "").lower()
        requested_voice = str(cfg_dict.get("voice_role") or "").strip()
        if target_lang in ("km", "khmer") or "KH" in requested_voice:
            if any(f in requested_voice for f in ["Sophea", "Bopha", "Female"]):
                cfg_dict["voice_role"] = "Sreymom(Female/KH)"
            else:
                cfg_dict["voice_role"] = "Piseth(Male/KH)"

        # Strictly filter cfg_dict to only keys defined in TaskCfgVTT dataclass
        valid_fields = {f.name for f in dataclasses.fields(TaskCfgVTT)}
        sanitized_cfg = {k: v for k, v in cfg_dict.items() if k in valid_fields}

        vtt_cfg = TaskCfgVTT(**sanitized_cfg)
        trk = StreamTransCreate(cfg=vtt_cfg)

        emit({"type": "stage", "stage": 1, "total_stages": 9, "title": "Preparation completed"})
        trk.prepare()

        emit({"type": "stage", "stage": 2, "total_stages": 9, "title": f"Speech Recognition (Faster-Whisper: {vtt_cfg.model_name})..."})
        trk.recogn()

        emit({"type": "stage", "stage": 3, "total_stages": 9, "title": "Speaker Diarization..."})
        trk.diariz()

        emit({"type": "stage", "stage": 4, "total_stages": 9, "title": f"Subtitle Translation ({vtt_cfg.target_language_code})..."})
        trk.trans()

        emit({"type": "stage", "stage": 5, "total_stages": 9, "title": f"Dubbing Generation ({vtt_cfg.voice_role})..."})
        trk.dubbing()

        emit({"type": "stage", "stage": 6, "total_stages": 9, "title": "Audio-Video Alignment (atempo)..."})
        trk.align()

        emit({"type": "stage", "stage": 7, "total_stages": 9, "title": "Second-pass Recognition..."})
        trk.recogn2pass()

        emit({"type": "stage", "stage": 8, "total_stages": 9, "title": "Final Assembly..."})
        trk.assembling()

        trk.task_done()
        emit({"type": "stage", "stage": 9, "total_stages": 9, "title": "Finished successfully!"})

        # Locate produced files
        target_lang = vtt_cfg.target_language_code
        source_lang = vtt_cfg.source_language_code
        out_path = Path(target_dir)

        # Search for generated mp4, audio, and srt
        target_mp4 = trk.cfg.targetdir_mp4 if hasattr(trk.cfg, 'targetdir_mp4') and Path(str(trk.cfg.targetdir_mp4)).exists() else None
        if not target_mp4:
            mp4s = list(out_path.glob("*.mp4"))
            target_mp4 = str(mp4s[0]) if mp4s else None

        target_sub = trk.cfg.target_sub if hasattr(trk.cfg, 'target_sub') and Path(str(trk.cfg.target_sub)).exists() else None
        if not target_sub:
            srts = list(out_path.glob(f"*{target_lang}*.srt")) or list(out_path.glob("*.srt"))
            target_sub = str(srts[0]) if srts else None

        target_audio = trk.cfg.target_wav_output if hasattr(trk.cfg, 'target_wav_output') and Path(str(trk.cfg.target_wav_output)).exists() else None
        if not target_audio:
            audios = list(out_path.glob(f"*{target_lang}*.m4a")) or list(out_path.glob(f"*{target_lang}*.wav"))
            target_audio = str(audios[0]) if audios else None

        source_sub = trk.cfg.source_sub if hasattr(trk.cfg, 'source_sub') and Path(str(trk.cfg.source_sub)).exists() else None
        source_audio = trk.cfg.source_wav_output if hasattr(trk.cfg, 'source_wav_output') and Path(str(trk.cfg.source_wav_output)).exists() else None

        # Read subtitles if available
        subtitles_data = []
        if target_sub and Path(target_sub).exists():
            from videotrans.util.help_srt import get_subtitle_from_srt
            raw_subs = get_subtitle_from_srt(target_sub)
            for s in raw_subs:
                subtitles_data.append({
                    "start": s.get("start_time", 0) / 1000.0 if "start_time" in s else s.get("start", 0),
                    "end": s.get("end_time", 0) / 1000.0 if "end_time" in s else s.get("end", 0),
                    "text": s.get("text", ""),
                    "khmer": s.get("text", "") if target_lang == "km" else "",
                })

        emit({
            "type": "done",
            "target_dir": target_dir,
            "target_mp4": target_mp4,
            "target_sub": target_sub,
            "target_audio": target_audio,
            "source_sub": source_sub,
            "source_audio": source_audio,
            "subtitles": subtitles_data,
        })

    except Exception as e:
        traceback.print_exc()
        emit({"type": "error", "error": str(e)})
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="PyVideoTrans Headless Runner")
    parser.add_argument("--config", help="Path to JSON configuration file")
    args = parser.parse_args()

    if args.config and Path(args.config).exists():
        cfg_dict = json.loads(Path(args.config).read_text(encoding="utf-8"))
    else:
        # Read from stdin
        cfg_dict = json.loads(sys.stdin.read())

    run_pipeline(cfg_dict)


if __name__ == "__main__":
    main()
