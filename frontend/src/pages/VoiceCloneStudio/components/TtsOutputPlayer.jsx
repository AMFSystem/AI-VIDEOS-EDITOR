import React from "react";
import { CheckCircle, Play, Pause, Plus, FloppyDisk, DownloadSimple } from "@phosphor-icons/react";
import { formatTime } from "../../../lib/timeline.js";

export function TtsOutputPlayer({
  generatedBlob,
  generatedDuration,
  currentTime,
  isPlaying,
  togglePlayAudio,
  handleSeek,
  handleInsert,
  handleDownloadFile,
}) {
  if (!generatedBlob) return null;

  return (
    <div className="tts-output-card">
      <div className="tts-output-header">
        <div className="tts-output-title">
          <CheckCircle size={18} weight="fill" color="#10b981" />
          <span>សំឡេងបានបង្កើតរួចរាល់ · {formatTime(generatedDuration)}</span>
        </div>
        <span style={{ fontSize: "12px", color: "#64748b" }}>
          គុណភាពច្បាស់កម្រិតខ្ពស់
        </span>
      </div>

      {/* Audio Controls */}
      <div className="tts-player-controls">
        <button
          className="tts-play-btn"
          type="button"
          onClick={togglePlayAudio}
          title={isPlaying ? "ផ្អាក" : "ចាក់ស្តាប់"}
        >
          {isPlaying ? (
            <Pause size={20} weight="fill" />
          ) : (
            <Play size={20} weight="fill" style={{ marginLeft: 2 }} />
          )}
        </button>

        <div className="tts-timeline-scrubber">
          <input
            className="tts-scrubber-slider"
            type="range"
            min="0"
            max={generatedDuration || 1}
            step="0.05"
            value={currentTime}
            onChange={handleSeek}
          />
          <div className="tts-time-labels">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(generatedDuration)}</span>
          </div>
        </div>
      </div>

      {/* Timeline Insert Actions */}
      <div className="tts-timeline-actions-bar">
        <button
          className="tts-btn-insert-timeline"
          type="button"
          onClick={() => handleInsert(true)}
        >
          <Plus size={18} weight="bold" />
          <span>បញ្ចូលទៅក្នុង Timeline</span>
        </button>

        <button
          className="tts-btn-insert-assets"
          type="button"
          title="រក្សាទុកក្នុង Media Bin ដោយមិនទាន់បិទទំព័រនេះ"
          onClick={() => handleInsert(false)}
        >
          <FloppyDisk size={16} />
          <span>ដាក់ក្នុង Media Bin</span>
        </button>

        <button
          className="tts-btn-download-audio"
          type="button"
          title="ទាញយកឯកសារសំឡេង"
          onClick={handleDownloadFile}
        >
          <DownloadSimple size={16} />
          <span>ទាញយកសំឡេង</span>
        </button>
      </div>
    </div>
  );
}

export default TtsOutputPlayer;
