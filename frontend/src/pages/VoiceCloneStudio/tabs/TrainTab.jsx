import React, { useState, useEffect, useRef } from "react";
import {
  Microphone,
  Play,
  Pause,
  UploadSimple,
  Sparkle,
  Trash,
  Lightning,
  CheckCircle,
  Cpu,
  Stop,
  ArrowsClockwise,
  Waveform,
  Warning,
  Check,
  SpeakerHigh,
  CircleNotch,
} from "@phosphor-icons/react";
import {
  getVoxCpmTrainingPrompts,
  startVoxCpmTraining,
  getVoxCpmTrainingStatus,
  stopVoxCpmTraining,
  synthesizeWithVoxCpm,
} from "../../../lib/voxcpmRuntime.js";

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function formatDuration(sec) {
  if (!sec || isNaN(sec)) return "00:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Convert slice of decoded AudioBuffer into clean 16kHz mono WAV Blob
function audioBufferToWavBlob(buffer, startSec, endSec) {
  const startSample = Math.max(0, Math.floor(startSec * buffer.sampleRate));
  const endSample = Math.min(buffer.length, Math.floor(endSec * buffer.sampleRate));
  const numSamples = endSample - startSample;
  if (numSamples <= 0) return null;

  const numChannels = 1;
  const sampleRate = buffer.sampleRate;
  const bitsPerSample = 16;
  const blockAlign = numChannels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const bufferLength = 44 + dataSize;
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);

  function writeString(offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  const left = buffer.getChannelData(0);
  const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : null;

  let offset = 44;
  for (let i = startSample; i < endSample; i++) {
    let sample = right ? (left[i] + right[i]) * 0.5 : left[i];
    sample = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
    offset += 2;
  }

  return new Blob([view], { type: "audio/wav" });
}

// Automatically split a long voice recording into speech segments
async function splitAudioFileIntoSegments(file, targetCount = 8) {
  const arrayBuffer = await file.arrayBuffer();
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const audioCtx = new AudioContextClass();
  const decoded = await audioCtx.decodeAudioData(arrayBuffer);

  const totalDuration = decoded.duration;
  const channelData = decoded.getChannelData(0);
  const sampleRate = decoded.sampleRate;

  // If very short (< 10 seconds), return single segment
  if (totalDuration < 10) {
    const wavBlob = audioBufferToWavBlob(decoded, 0, totalDuration);
    return [{ blob: wavBlob, duration: totalDuration }];
  }

  // Calculate count: aim for 6 to 15 seconds per segment, up to targetCount
  let count = Math.min(targetCount, Math.max(3, Math.floor(totalDuration / 9)));
  const nominalDuration = totalDuration / count;

  const segments = [];
  let currentStart = 0;

  for (let i = 0; i < count; i++) {
    if (i === count - 1) {
      const endSec = totalDuration;
      const wavBlob = audioBufferToWavBlob(decoded, currentStart, endSec);
      if (wavBlob) {
        segments.push({ blob: wavBlob, duration: endSec - currentStart });
      }
      break;
    }

    const idealEnd = currentStart + nominalDuration;
    const searchStartSample = Math.max(0, Math.floor((idealEnd - 1.2) * sampleRate));
    const searchEndSample = Math.min(channelData.length, Math.floor((idealEnd + 1.2) * sampleRate));

    let minEnergy = Infinity;
    let bestSplitSample = Math.floor(idealEnd * sampleRate);
    const windowSize = Math.floor(sampleRate * 0.04); // 40ms window

    for (let s = searchStartSample; s < searchEndSample - windowSize; s += windowSize) {
      let energy = 0;
      for (let j = 0; j < windowSize; j += 4) {
        energy += Math.abs(channelData[s + j]);
      }
      if (energy < minEnergy) {
        minEnergy = energy;
        bestSplitSample = s + Math.floor(windowSize / 2);
      }
    }

    const splitSec = bestSplitSample / sampleRate;
    const wavBlob = audioBufferToWavBlob(decoded, currentStart, splitSec);
    if (wavBlob) {
      segments.push({ blob: wavBlob, duration: splitSec - currentStart });
    }
    currentStart = splitSec;
  }

  try {
    audioCtx.close();
  } catch {}

  return segments;
}

export function TrainTab({
  activeProfile,
  onModelTrained,
  notify = (msg) => alert(msg),
  setActiveTab,
}) {
  // Prompts & Samples State
  const [prompts, setPrompts] = useState([]);
  const [samples, setSamples] = useState([]); // Array of { id, text, audioBlob, duration, audioUrl }
  const [recordingId, setRecordingId] = useState(null);
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordTimerRef = useRef(null);
  const [isSplittingAudio, setIsSplittingAudio] = useState(false);

  // Audio Playback
  const [playingId, setPlayingId] = useState(null);
  const audioPlayerRef = useRef(null);

  // Training Configuration
  const [modelName, setModelName] = useState(
    activeProfile ? `${activeProfile.name.toLowerCase().replace(/\s+/g, "_")}_lora` : "khmer_voice_lora"
  );
  const [selectedSteps, setSelectedSteps] = useState(300);
  const [learningRate, setLearningRate] = useState(0.0001);

  // Live Training State
  const [trainingStatus, setTrainingStatus] = useState({
    status: "idle",
    step: 0,
    total_steps: 300,
    progress: 0,
    loss: null,
    eta_seconds: null,
    elapsed_seconds: 0,
    logs: [],
    error: null,
    output_file: null,
    device: "mps",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLogs, setShowLogs] = useState(true);
  const logsContainerRef = useRef(null);

  // Test Synthesis for Trained Voice
  const [testText, setTestText] = useState("សួស្តីបងប្អូនទាំងអស់គ្នា នេះជាសំឡេងដែលបាន Train រួចរាល់ដោយជោគជ័យ។");
  const [isSynthesizingTest, setIsSynthesizingTest] = useState(false);
  const [testAudioUrl, setTestAudioUrl] = useState(null);

  // 1. Fetch prompts on mount & poll initial status
  useEffect(() => {
    getVoxCpmTrainingPrompts()
      .then((data) => {
        if (data?.prompts && data.prompts.length > 0) {
          setPrompts(data.prompts);
          // Initialize empty samples structure
          setSamples(
            data.prompts.map((p) => ({
              id: p.id,
              category: p.category,
              text: p.text,
              audioBlob: null,
              duration: 0,
              audioUrl: null,
            }))
          );
        }
      })
      .catch((err) => console.warn("Failed to load prompts:", err));

    // Check if training is already active
    getVoxCpmTrainingStatus()
      .then((st) => {
        if (st && st.status) setTrainingStatus(st);
      })
      .catch(() => {});
  }, []);

  // 2. Poll Training Status while active
  useEffect(() => {
    let interval = null;
    const isRunning =
      trainingStatus.status === "preparing" || trainingStatus.status === "training";

    if (isRunning) {
      interval = setInterval(async () => {
        try {
          const st = await getVoxCpmTrainingStatus();
          setTrainingStatus(st);
          if (st.status === "completed" && onModelTrained) {
            onModelTrained(st.output_file || modelName);
          }
        } catch (e) {
          console.warn("Poll status error:", e);
        }
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [trainingStatus.status, modelName, onModelTrained]);

  // Auto-scroll logs
  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [trainingStatus.logs]);

  // 3. Audio Recording Methods
  const startRecording = async (sampleId) => {
    try {
      if (playingId) {
        if (audioPlayerRef.current) audioPlayerRef.current.pause();
        setPlayingId(null);
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 48000,
          echoCancellation: true,
          noiseSuppression: false,
        },
      });

      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType });
        const url = URL.createObjectURL(blob);
        const duration = recordingElapsed;

        setSamples((prev) =>
          prev.map((s) =>
            s.id === sampleId ? { ...s, audioBlob: blob, audioUrl: url, duration } : s
          )
        );

        stream.getTracks().forEach((t) => t.stop());
        setRecordingId(null);
        setRecordingElapsed(0);
        if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      };

      recorder.start(100);
      mediaRecorderRef.current = recorder;
      setRecordingId(sampleId);
      setRecordingElapsed(0);

      recordTimerRef.current = setInterval(() => {
        setRecordingElapsed((prev) => prev + 0.1);
      }, 100);
    } catch (err) {
      notify(`មិនអាចបើក Microphone បានទេ: ${err.message}`);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  };

  const handleFileUpload = (sampleId, e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const audio = new Audio(url);
    audio.onloadedmetadata = () => {
      setSamples((prev) =>
        prev.map((s) =>
          s.id === sampleId
            ? { ...s, audioBlob: file, audioUrl: url, duration: audio.duration }
            : s
        )
      );
    };
  };

  // Handle uploading a single long audio file and auto-splitting into segments
  const handleLongAudioUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsSplittingAudio(true);
    try {
      const segments = await splitAudioFileIntoSegments(file, samples.length || 8);
      if (!segments || segments.length === 0) {
        throw new Error("មិនអាចវិភាគឯកសារសំឡេងនេះបានទេ");
      }

      setSamples((prev) =>
        prev.map((s, idx) => {
          if (idx < segments.length) {
            const seg = segments[idx];
            const url = URL.createObjectURL(seg.blob);
            return {
              ...s,
              audioBlob: seg.blob,
              audioUrl: url,
              duration: seg.duration,
            };
          }
          return s;
        })
      );

      notify(`🎉 បានកាត់បំបែកឯកសារសំឡេងជា ${segments.length} សំណាកដោយស្វ័យប្រវត្តិរួចរាល់!`);
    } catch (err) {
      console.error("Split audio error:", err);
      notify(`ការបំបែកសំឡេងមិនជោគជ័យ: ${err.message}`);
    } finally {
      setIsSplittingAudio(false);
      e.target.value = "";
    }
  };

  // Allow custom editing of the prompt text
  const handleTextChange = (sampleId, newText) => {
    setSamples((prev) =>
      prev.map((s) => (s.id === sampleId ? { ...s, text: newText } : s))
    );
  };

  // Clear all recorded samples to start fresh
  const handleClearAllSamples = () => {
    if (!confirm("តើអ្នកប្រាកដថាចង់សម្អាតសំណាកសំឡេងទាំងអស់ឡើងវិញទេ?")) return;
    setSamples((prev) =>
      prev.map((s) => ({
        ...s,
        audioBlob: null,
        audioUrl: null,
        duration: 0,
      }))
    );
  };

  const removeSampleAudio = (sampleId) => {
    setSamples((prev) =>
      prev.map((s) =>
        s.id === sampleId ? { ...s, audioBlob: null, audioUrl: null, duration: 0 } : s
      )
    );
  };

  const togglePlayAudio = (sampleId, url) => {
    if (playingId === sampleId) {
      if (audioPlayerRef.current) audioPlayerRef.current.pause();
      setPlayingId(null);
    } else {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.src = url;
        audioPlayerRef.current.play();
        setPlayingId(sampleId);
      }
    }
  };

  // 4. Start Training Process
  const handleStartTraining = async () => {
    const readySamples = samples.filter((s) => s.audioBlob);
    if (readySamples.length === 0) {
      notify("សូមថត ឬបញ្ចូលសំឡេងយ៉ាងហោចណាស់ ១ ឃ្លាជាមុនសិន!");
      return;
    }

    if (!modelName.trim()) {
      notify("សូមបញ្ចូលឈ្មោះម៉ូដែលសំឡេង!");
      return;
    }

    setIsSubmitting(true);
    try {
      const payloadSamples = await Promise.all(
        readySamples.map(async (s) => ({
          text: s.text,
          audioBase64: await blobToBase64(s.audioBlob),
        }))
      );

      const res = await startVoxCpmTraining({
        modelName: modelName.trim(),
        samples: payloadSamples,
        steps: selectedSteps,
        learningRate,
      });

      setTrainingStatus({
        status: "training",
        step: 0,
        total_steps: selectedSteps,
        progress: 0,
        loss: null,
        eta_seconds: null,
        elapsed_seconds: 0,
        logs: ["🚀 កំពុងរៀបចំ និងចាប់ផ្តើមដំណើរការបង្វឹក LoRA..."],
        error: null,
        output_file: null,
        device: "mps",
      });

      notify("🎯 ចាប់ផ្តើមបង្វឹកសំឡេង LoRA ដោយជោគជ័យ! លោកអ្នកអាចតាមដាន Progress នៅលើផ្ទាំងនេះផ្ទាល់។");
    } catch (err) {
      notify(`បរាជ័យក្នុងការចាប់ផ្តើម: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStopTraining = async () => {
    if (!window.confirm("តើអ្នកពិតជាចង់បញ្ឈប់ការបង្វឹកនេះមែនទេ?")) return;
    try {
      await stopVoxCpmTraining();
      const st = await getVoxCpmTrainingStatus();
      setTrainingStatus(st);
      notify("ការបង្វឹកត្រូវបានបញ្ឈប់");
    } catch (err) {
      notify(`មិនអាចបញ្ឈប់បានទេ: ${err.message}`);
    }
  };

  // 5. Test Synthesis with Newly Trained LoRA
  const handleTestTrainedVoice = async () => {
    if (!testText.trim()) return;
    setIsSynthesizingTest(true);
    setTestAudioUrl(null);
    try {
      const targetLora = trainingStatus.output_file || `${modelName}.safetensors`;
      const blob = await synthesizeWithVoxCpm({
        text: testText,
        loraModel: targetLora,
        language: "km",
      });
      const url = URL.createObjectURL(blob);
      setTestAudioUrl(url);
      const audio = new Audio(url);
      audio.play();
    } catch (err) {
      notify(`ការសាកល្បងសំឡេងបរាជ័យ: ${err.message}`);
    } finally {
      setIsSynthesizingTest(false);
    }
  };

  const recordedCount = samples.filter((s) => s.audioBlob).length;
  const isTrainingActive =
    trainingStatus.status === "preparing" || trainingStatus.status === "training";
  const isTrainingCompleted = trainingStatus.status === "completed";

  return (
    <div className="lora-train-studio-container">
      <audio
        ref={audioPlayerRef}
        onEnded={() => setPlayingId(null)}
        style={{ display: "none" }}
      />


      {/* SECTION 1: LIVE TRAINING MONITOR (When Active or Completed) */}
      {(isTrainingActive || isTrainingCompleted || trainingStatus.status === "error") && (
        <div className={`lora-monitor-card ${trainingStatus.status}`}>
          <div className="lora-monitor-header">
            <div className="lora-monitor-title-group">
              <span className={`lora-status-dot ${trainingStatus.status}`} />
              <h3 className="lora-monitor-title">
                {trainingStatus.status === "training" && "⚡ កំពុងបង្វឹកសំឡេង (Training in Progress)..."}
                {trainingStatus.status === "preparing" && "⏳ កំពុងរៀបចំទិន្នន័យ & បង្កើត Manifest..."}
                {trainingStatus.status === "completed" && "🎉 បានបង្វឹកជោគជ័យ ១០០% (LoRA Active)!"}
                {trainingStatus.status === "error" && "⚠️ មានបញ្ហាក្នុងពេលបង្វឹក (Training Failed)"}
              </h3>
            </div>
            {isTrainingActive && (
              <button
                type="button"
                className="lora-stop-btn"
                onClick={handleStopTraining}
                title="បញ្ឈប់ការបង្វឹក"
              >
                <Stop size={15} weight="fill" />
                <span>បញ្ឈប់ការបង្វឹក (Stop)</span>
              </button>
            )}
          </div>

          {/* Progress Bar & Key Stats */}
          <div className="lora-progress-section">
            <div className="lora-progress-meta">
              <span className="lora-progress-percent">
                {trainingStatus.progress?.toFixed(1) || 0}%
              </span>
              <span className="lora-step-counter">
                Step <strong>{trainingStatus.step}</strong> / {trainingStatus.total_steps}
              </span>
            </div>
            <div className="lora-progress-track">
              <div
                className="lora-progress-fill"
                style={{ width: `${trainingStatus.progress || 0}%` }}
              />
            </div>
          </div>

          {/* Metric Cards Grid */}
          <div className="lora-metrics-grid">
            <div className="lora-metric-card">
              <span className="lora-metric-label">Loss (កម្រិតលម្អៀង)</span>
              <span className="lora-metric-val">
                {trainingStatus.loss !== null ? trainingStatus.loss.toFixed(4) : "--"}
              </span>
            </div>
            <div className="lora-metric-card">
              <span className="lora-metric-label">ពេលវេលានៅសល់ (ETA)</span>
              <span className="lora-metric-val">
                {trainingStatus.eta_seconds !== null
                  ? `${Math.ceil(trainingStatus.eta_seconds / 60)} នាទី`
                  : isTrainingActive
                  ? "កំពុងគណនា..."
                  : "--"}
              </span>
            </div>
            <div className="lora-metric-card">
              <span className="lora-metric-label">រយៈពេល Train សរុប</span>
              <span className="lora-metric-val">
                {formatDuration(trainingStatus.elapsed_seconds)}
              </span>
            </div>
          </div>

          {/* Test Synthesizer on Success */}
          {isTrainingCompleted && (
            <div className="lora-success-test-box">
              <div className="lora-success-badge">
                <CheckCircle size={18} weight="fill" color="#10b981" />
                <span>ម៉ូដែលត្រូវបាន Activate ដោយស្វ័យប្រវត្តិ! សាកល្បងស្តាប់សំឡេងថ្មី៖</span>
              </div>
              <div className="lora-test-input-row">
                <input
                  type="text"
                  className="lora-test-input"
                  value={testText}
                  onChange={(e) => setTestText(e.target.value)}
                  placeholder="វាយអត្ថបទដើម្បីស្តាប់សំឡេង..."
                />
                <button
                  type="button"
                  className="lora-test-speak-btn"
                  onClick={handleTestTrainedVoice}
                  disabled={isSynthesizingTest}
                >
                  <SpeakerHigh size={17} weight="bold" />
                  <span>{isSynthesizingTest ? "កំពុងបម្លែង..." : "ស្តាប់សំឡេងថ្មី"}</span>
                </button>
              </div>
              {testAudioUrl && (
                <div className="lora-test-audio-player">
                  <audio controls src={testAudioUrl} autoPlay />
                </div>
              )}
              <div className="lora-success-actions">
                <button
                  type="button"
                  className="lora-switch-tts-btn"
                  onClick={() => setActiveTab && setActiveTab("tts")}
                >
                  <span>👉 ទៅកាន់ផ្ទាំង Text-to-Speech ដើម្បីបង្កើតសំឡេងពេញលេញ</span>
                </button>
              </div>
            </div>
          )}

          {/* Error Message */}
          {trainingStatus.error && (
            <div className="lora-error-banner">
              <Warning size={18} weight="fill" />
              <span>{trainingStatus.error}</span>
            </div>
          )}

          {/* Real-time Logs Console */}
          <div className="lora-logs-wrapper">
            <div className="lora-logs-header">
              <span>Terminal Output (កំណត់ហេតុដំណើរការ)</span>
              <button
                type="button"
                className="lora-toggle-logs-btn"
                onClick={() => setShowLogs(!showLogs)}
              >
                {showLogs ? "លាក់" : "បង្ហាញ"}
              </button>
            </div>
            {showLogs && (
              <div className="lora-logs-console" ref={logsContainerRef}>
                {trainingStatus.logs && trainingStatus.logs.length > 0 ? (
                  trainingStatus.logs.map((logLine, idx) => (
                    <div key={idx} className="lora-log-row">
                      {logLine}
                    </div>
                  ))
                ) : (
                  <div className="lora-log-row text-muted">រង់ចាំ logs...</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 2: DATASET PREPARATION & PROMPTS CARDS */}
      <div className="lora-section-card">
        <div className="lora-section-header">
          <div className="lora-step-bubble">១</div>
          <div>
            <h3 className="lora-section-title">រៀបចំសំណាកសំឡេង (Record or Upload Audio)</h3>
            <p className="lora-section-desc">
              សូមអានប្រយោគខាងក្រោមម្តងមួយៗឱ្យច្បាស់ និងធម្មជាតិ។ កាន់តែច្រើន សំឡេងកាន់តែដូចពិត
              (យ៉ាងហោចណាស់ <strong>៣ ទៅ ៨ សំណាក</strong>)។
            </p>
          </div>
          <div className="lora-sample-counter-pill">
            <Waveform size={15} weight="bold" />
            <span>បានថត <strong>{recordedCount}</strong> / {samples.length}</span>
          </div>
        </div>

        {/* Toolbar: Single Long Audio Upload & Clear */}
        <div className="lora-dataset-toolbar">
          <div className="lora-toolbar-left">
            <label className={`lora-batch-upload-btn ${isSplittingAudio ? "is-loading" : ""}`}>
              {isSplittingAudio ? (
                <>
                  <CircleNotch size={17} weight="bold" className="spin-anim" />
                  <span>កំពុងវិភាគ និងកាត់បំបែកសំឡេង...</span>
                </>
              ) : (
                <>
                  <Sparkle size={17} weight="fill" color="#38bdf8" />
                  <span>Upload សំឡេងវែងតែមួយ (Auto-Split ៣០វិ - ៣នាទី)</span>
                </>
              )}
              <input
                type="file"
                accept="audio/*"
                style={{ display: "none" }}
                onChange={handleLongAudioUpload}
                disabled={isSplittingAudio || isTrainingActive}
              />
            </label>
          </div>

          {recordedCount > 0 && (
            <button
              type="button"
              className="lora-clear-all-btn"
              onClick={handleClearAllSamples}
              disabled={isTrainingActive}
            >
              សម្អាតទាំងអស់
            </button>
          )}
        </div>

        {/* Prompts Recording Grid */}
        <div className="lora-prompts-grid">
          {samples.map((item, index) => {
            const isThisRecording = recordingId === item.id;
            const hasAudio = !!item.audioBlob;
            const isThisPlaying = playingId === item.id;

            return (
              <div
                key={item.id}
                className={`lora-prompt-card ${hasAudio ? "is-recorded" : ""} ${
                  isThisRecording ? "is-recording" : ""
                }`}
              >
                <div className="lora-prompt-top">
                  <span className="lora-prompt-cat">{item.category || `សំណាកទី ${index + 1}`}</span>
                  {hasAudio && (
                    <span className="lora-prompt-done-badge">
                      <Check size={12} weight="bold" />
                      <span>{formatDuration(item.duration)}</span>
                    </span>
                  )}
                </div>

                {/* Editable Textarea */}
                <textarea
                  className="lora-prompt-textarea"
                  value={item.text}
                  onChange={(e) => handleTextChange(item.id, e.target.value)}
                  placeholder="វាយបញ្ចូលអត្ថបទ ឬពាក្យដែលអ្នកបាននិយាយ..."
                  rows={3}
                  disabled={isTrainingActive}
                  title="ចុចដើម្បីកែប្រែអត្ថបទ"
                />

                <div className="lora-prompt-actions">
                  {/* Record Button */}
                  {isThisRecording ? (
                    <button
                      type="button"
                      className="lora-record-btn active"
                      onClick={stopRecording}
                    >
                      <Stop size={16} weight="fill" />
                      <span>បញ្ឈប់ ({formatDuration(recordingElapsed)})</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={`lora-record-btn ${hasAudio ? "secondary" : "primary"}`}
                      onClick={() => startRecording(item.id)}
                      disabled={isTrainingActive || recordingId !== null}
                    >
                      <Microphone size={16} weight="bold" />
                      <span>{hasAudio ? "ថតឡើងវិញ" : "ចុចដើម្បីអាន & ថត"}</span>
                    </button>
                  )}

                  {/* Play audio button if recorded */}
                  {hasAudio && !isThisRecording && (
                    <button
                      type="button"
                      className="lora-icon-action-btn"
                      onClick={() => togglePlayAudio(item.id, item.audioUrl)}
                      title={isThisPlaying ? "ផ្អាក" : "ស្តាប់ឡើងវិញ"}
                    >
                      {isThisPlaying ? (
                        <Pause size={15} weight="fill" />
                      ) : (
                        <Play size={15} weight="fill" />
                      )}
                    </button>
                  )}

                  {/* Upload file fallback */}
                  <label
                    className="lora-icon-action-btn file-upload-label"
                    title="Upload File សំឡេង"
                  >
                    <UploadSimple size={15} weight="bold" />
                    <input
                      type="file"
                      accept="audio/*"
                      style={{ display: "none" }}
                      onChange={(e) => handleFileUpload(item.id, e)}
                      disabled={isTrainingActive || isThisRecording}
                    />
                  </label>

                  {/* Delete Audio */}
                  {hasAudio && !isThisRecording && (
                    <button
                      type="button"
                      className="lora-icon-action-btn delete"
                      onClick={() => removeSampleAudio(item.id)}
                      title="លុបសំឡេងនេះ"
                      disabled={isTrainingActive}
                    >
                      <Trash size={14} weight="bold" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 3: TRAINING CONFIGURATION & LAUNCH */}
      <div className="lora-section-card">
        <div className="lora-section-header">
          <div className="lora-step-bubble">២</div>
          <div>
            <h3 className="lora-section-title">កំណត់ការបង្វឹក (Training Configuration)</h3>
          </div>
        </div>

        <div className="lora-config-body">
          {/* Model Name */}
          <div className="lora-input-group">
            <label className="lora-input-label">
              ឈ្មោះម៉ូដែលសំឡេង (Model Name):
            </label>
            <input
              type="text"
              className="lora-text-input"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="e.g. somnang_khmer_v1"
              disabled={isTrainingActive}
            />
          </div>

          {/* Steps Dropdown Selector */}
          <div className="lora-input-group">
            <label className="lora-input-label">ជ្រើសរើសកម្រិតបង្វឹក (Training Intensity):</label>
            <div className="clone-model-dropdown-wrapper">
              <select
                className="clone-model-select"
                value={selectedSteps}
                onChange={(e) => setSelectedSteps(Number(e.target.value))}
                disabled={isTrainingActive}
              >
                <option value={100}>100 Steps - តេស្តសាកល្បងរហ័ស</option>
                <option value={300}>300 Steps - ណែនាំ (Recommended)</option>
                <option value={500}>500 Steps - គុណភាពខ្ពស់ Studio Pro</option>
              </select>
            </div>
          </div>

          {/* Launch CTA Button */}
          <div className="lora-cta-container">
            <button
              type="button"
              className="lora-start-training-cta"
              onClick={handleStartTraining}
              disabled={isTrainingActive || isSubmitting || recordedCount === 0}
            >
              {isTrainingActive ? (
                <>
                  <ArrowsClockwise size={20} className="spin-anim" />
                  <span>ដំណើរការបង្វឹកកំពុងរត់...</span>
                </>
              ) : (
                <>
                  <Sparkle size={20} weight="fill" />
                  <span>
                    {recordedCount === 0
                      ? "សូមថតសំឡេងជាមុនសិន"
                      : `ចាប់ផ្តើមបង្វឹកសំឡេងផ្ទាល់ខ្លួន (${recordedCount} សំណាក)`}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
