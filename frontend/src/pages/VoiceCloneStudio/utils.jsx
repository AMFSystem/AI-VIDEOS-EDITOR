import React from "react";

// Helper to convert Blob to Base64
export async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Helper to convert Base64 to Blob
export async function base64ToBlob(base64Data, contentType = "audio/wav") {
  const res = await fetch(base64Data);
  return res.blob();
}

// Custom Audio Control Icons (Skip 5 seconds backward/forward)
export function IconSkipBack5(props) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <text x="12" y="15.8" fontSize="8.5" fontWeight="bold" textAnchor="middle" fill="currentColor" stroke="none">5</text>
    </svg>
  );
}

export function IconSkipForward5(props) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <text x="12" y="15.8" fontSize="8.5" fontWeight="bold" textAnchor="middle" fill="currentColor" stroke="none">5</text>
    </svg>
  );
}

// Generate realistic acoustic voice spectrum peaks (118 frequency bands)
export function generateVoiceAnalysisPeaks(count = 118) {
  const peaks = [];
  for (let i = 0; i < count; i++) {
    const norm = i / count;
    // Formant simulation: primary resonance peak around 28%, secondary around 68%
    const f1 = Math.exp(-Math.pow((norm - 0.28) / 0.16, 2)) * 0.85;
    const f2 = Math.exp(-Math.pow((norm - 0.68) / 0.18, 2)) * 0.72;
    const base = 0.18 + Math.sin(norm * Math.PI * 6) * 0.08;
    const pseudoNoise = ((i * 37 + 13) % 23) / 120;
    const val = Math.max(0.12, Math.min(0.95, f1 + f2 + base + pseudoNoise));
    peaks.push(val);
  }
  return peaks;
}

// Helper to format current time string for default profile names
export function formatSavedTime() {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

// Helper to evaluate Voice Training Quality for AI Voice Learning (Target: 30s - 60s)
export function getTrainingQualityInfo(sec) {
  const s = Math.max(0, Number(sec) || 0);
  if (s <= 0) {
    return {
      tier: "empty",
      pct: 0,
      label: "រង់ចាំសំឡេង",
      badge: "មិនទាន់មានសំឡេង",
      color: "#64748b",
      description: "សូមថត ឬផ្ទុកឡើងសំឡេងចន្លោះពី ៣០ វិនាទី ដល់ ១ នាទី (30s - 60s) ដើម្បីឱ្យ AI ចងចាំបាន 100%",
      isDeep: false,
    };
  }
  if (s < 15) {
    const pct = Math.min(45, Math.round((s / 30) * 50));
    return {
      tier: "short",
      pct,
      label: `Basic (${pct}%)`,
      badge: "🟡 គំរូខ្លី",
      color: "#eab308",
      description: `ថតបាន ${s.toFixed(1)}s · ណែនាំឱ្យបន្តថតរហូតដល់ ៣០ វិនាទី ដើម្បីឱ្យ AI រៀនស៊ីជម្រៅ`,
      isDeep: false,
    };
  }
  if (s < 30) {
    const pct = Math.min(85, Math.round(50 + ((s - 15) / 15) * 35));
    return {
      tier: "good",
      pct,
      label: `Standard (${pct}%)`,
      badge: "🔵 ស្តង់ដារ",
      color: "#38bdf8",
      description: `ថតបាន ${s.toFixed(1)}s · ល្អបង្គួរ! បន្តថតដល់ ៣០ ទៅ ៦០ វិនាទី ដើម្បីទទួលបានកម្រិតចងចាំ 100%`,
      isDeep: false,
    };
  }
  // 30s to 60s+
  return {
    tier: "deep",
    pct: 100,
    label: "Deep Training 100%",
    badge: "🌟 Deep Training 100%",
    color: "#10b981",
    description: `រយៈពេល ${s.toFixed(1)}s · ល្អឥតខ្ចោះ! AI អាចស្រង់យក Vocal Formants និងចងចាំទឹកដមសំឡេងបាន 100% ដូចពិត`,
    isDeep: true,
  };
}
