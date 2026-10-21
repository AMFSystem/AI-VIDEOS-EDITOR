#!/usr/bin/env python3
"""
OpenBMB VoxCPM2 Voice Generation & Cloning Script
================================================
ដំណើរការដោយប្រើប្រាស់បរិស្ថាន Python ក្នុងគម្រោង៖
    backend/python/.venv/bin/python backend/python/test_voxcpm.py

ឬ Activate venv ជាមុន៖
    source backend/python/.venv/bin/activate
    python backend/python/test_voxcpm.py
"""

import os
import sys
import torch
import soundfile as sf
from voxcpm import VoxCPM

def main():
    print("=" * 60)
    print("🚀 កំពុងរៀបចំដំណើរការ OpenBMB VoxCPM2 (Voice Design & Cloning)")
    print("=" * 60)

    # 1. ស្វែងរក Device ដែលល្អបំផុត (MPS លើ Mac Apple Silicon / CUDA / CPU)
    if torch.backends.mps.is_available():
        device = "mps"
    elif torch.cuda.is_available():
        device = "cuda"
    else:
        device = "cpu"
    print(f"⚡ ដំណើរការលើ Device: {device.upper()}")

    # 2. កំណត់ទីតាំង Model (ប្រើ Local Folder បើមាន ឬ Auto Download ពី Hugging Face)
    local_model_path = "./pretrained_models/VoxCPM2"
    if os.path.exists(local_model_path) and os.path.isdir(local_model_path):
        model_source = local_model_path
        print(f"📂 រកឃើញម៉ូដែលក្នុង Folder ផ្ទាល់ខ្លួន៖ {local_model_path}")
    else:
        model_source = "openbmb/VoxCPM2"
        print(f"🌐 ប្រើប្រាស់ម៉ូដែល៖ {model_source} (ទាញយកពី Hugging Face Cache ស្វ័យប្រវត្តិ)")

    print("⏳ កំពុងផ្ទុកម៉ូដែល VoxCPM2 (សូមរង់ចាំបន្តិច)...")
    # optimize=False ជួយការពារបញ្ហា torch.compile លើ Apple Silicon MPS
    model = VoxCPM.from_pretrained(
        model_source,
        load_denoiser=False,
        optimize=False,
        device=device
    )
    
    sample_rate = getattr(model, "sample_rate", getattr(getattr(model, "tts_model", None), "sample_rate", 44100))
    print(f"✅ ម៉ូដែល VoxCPM2 បានផ្ទុករួចរាល់ជោគជ័យ! (Sample Rate: {sample_rate} Hz)\n")

    # 3. បំប្លែងអត្ថបទជាសំឡេងធម្មតា (Standard TTS)
    output_path = "output.wav"
    print(f"🎙️ [1/2] កំពុងបង្កើតសំឡេងធម្មតា -> {output_path}...")
    wav = model.generate(
        text="VoxCPM2 brings multilingual support, creative voice design, and controllable voice cloning.",
    )
    sf.write(output_path, wav, sample_rate)
    print(f"   🎉 រួចរាល់៖ {output_path}")

    # 4. Voice Design៖ បង្កើតសំឡេងថ្មីពីការពិពណ៌នា (Prompt ក្នុងវង់ក្រចកពីមុខអត្ថបទ)
    design_path = "design.wav"
    print(f"✨ [2/2] កំពុងបង្កើត Voice Design តាមការពិពណ៌នា -> {design_path}...")
    wav_design = model.generate(
        text="(A young woman, gentle and sweet voice)Hello, welcome to VoxCPM2!",
    )
    sf.write(design_path, wav_design, sample_rate)
    print(f"   🎉 រួចរាល់៖ {design_path}")

    print("\n" + "=" * 60)
    print("🏆 បង្កើតឯកសារសំឡេងទាំងពីរជោគជ័យ 100%!")
    print(f"   1. {output_path}")
    print(f"   2. {design_path}")
    print("=" * 60)

if __name__ == "__main__":
    main()

