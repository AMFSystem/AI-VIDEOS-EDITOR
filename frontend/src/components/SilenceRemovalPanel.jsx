import { CheckCircle, CircleNotch, Play, Scissors, Sparkle } from "@phosphor-icons/react";
import "./SilenceRemovalPanel.css";

const time = (seconds) => `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(2).padStart(5, "0")}`;

export function SilenceRemovalPanel({ tool }) {
  const { segment, supported, locked, settings, draft, stale, job, error } = tool;
  const selected = draft?.candidates.filter((cut) => cut.enabled) || [];
  const savings = selected.reduce((sum, cut) => sum + cut.end - cut.start, 0);
  const setup = ["pauseDownloading", "pauseStarting"].includes(job.phase);

  return (
    <section className="autocut-panel" aria-label="Auto Cut">
      {/* 1. Target Clip Card */}
      <div className={`autocut-clip-card ${segment?.type === "video" ? "has-clip" : "no-clip"}`}>
        <div className="autocut-clip-left">
          <span className="autocut-clip-icon">🎬</span>
          <div className="autocut-clip-details">
            <strong title={segment?.name || "No video selected"}>
              {segment?.name ? segment.name : "មិនទាន់ជ្រើសរើស Clip"}
            </strong>
            <small>
              {segment?.type === "video"
                ? "បានជ្រើសរើស Clip សម្រាប់ Auto Cut"
                : "សូមចុចលើ Clip វីដេអូនៅលើ Timeline"}
            </small>
          </div>
        </div>
        {segment?.type === "video" && supported ? (
          <CheckCircle size={17} weight="fill" color="#2ed573" />
        ) : null}
      </div>

      {segment?.preparing ? (
        <div className="autocut-status-msg is-info">កំពុងរៀបចំមេឌា...</div>
      ) : segment?.type === "video" && !supported ? (
        <div className="autocut-status-msg is-warning">មិនទាន់គាំទ្រ Clip ដែលមាន Effect ស្មុគស្មាញនៅឡើយទេ</div>
      ) : null}

      {locked ? (
        <div className="autocut-status-msg is-warning">Track ត្រូវបានចាក់សោ (សូមដោះសោជាមុនសិន)</div>
      ) : null}

      {/* 2. Settings Parameters Card */}
      <div className="autocut-card">
        {/* Min pause slider */}
        <div className="autocut-setting-row">
          <div className="autocut-setting-header">
            <span>កាត់ស្ងាត់ចាប់ពី (Min Pause)</span>
            <output className="autocut-pill-val">{settings.minimum.toFixed(2)}s</output>
          </div>
          <input
            type="range"
            min={0.3}
            max={3.0}
            step={0.1}
            value={settings.minimum}
            disabled={job.running}
            onChange={(e) => tool.updateSettings({ minimum: Number(e.target.value) })}
          />
        </div>

        {/* Padding keep slider */}
        <div className="autocut-setting-row">
          <div className="autocut-setting-header">
            <span>រក្សាគម្លាតដង្ហើម (Padding)</span>
            <output className="autocut-pill-val">{settings.keep.toFixed(2)}s</output>
          </div>
          <input
            type="range"
            min={0.1}
            max={1.0}
            step={0.05}
            value={settings.keep}
            disabled={job.running}
            onChange={(e) => tool.updateSettings({ keep: Number(e.target.value) })}
          />
        </div>

        {/* Ripple editing switch */}
        <label className="autocut-toggle-row">
          <div className="autocut-toggle-text">
            <span>រុញវីដេអូភ្ជិតគ្នា (Ripple Cut)</span>
            <small>កាត់ចន្លោះស្ងាត់ និងទាញវីដេអូភ្ជាប់គ្នាស្វ័យប្រវត្តិ</small>
          </div>
          <input
            type="checkbox"
            checked={tool.rippleEditing}
            onChange={(e) => tool.setRippleEditing(e.target.checked)}
          />
        </label>
      </div>

      {/* 3. Action Button (Analyze / Cancel) */}
      <button
        type="button"
        className={`autocut-cta-btn ${job.running ? "is-running" : ""}`}
        disabled={!job.running && (!supported || locked)}
        onClick={job.running ? tool.cancel : tool.run}
      >
        {job.running ? (
          <>
            <CircleNotch size={17} className="autocut-spin" />
            <span>កំពុងស្វែងរក... {!setup ? `${Math.round(job.progress * 100)}%` : ""}</span>
          </>
        ) : (
          <>
            <Sparkle size={17} weight="fill" />
            <span>ស្វែងរកចន្លោះស្ងាត់ (Analyze)</span>
          </>
        )}
      </button>

      {/* Progress Bar when running */}
      {job.running ? (
        <div className="autocut-progress-wrap">
          <div
            className="autocut-progress-bar"
            style={{ width: `${Math.round(job.progress * 100)}%` }}
          />
        </div>
      ) : null}

      {stale ? (
        <div className="autocut-status-msg is-warning">Clip បានផ្លាស់ប្តូរ សូមចុចវិភាគម្តងទៀត</div>
      ) : null}

      {error ? (
        <div className="autocut-status-msg is-error">ការវិភាគបរាជ័យ សូមសាកល្បងម្តងទៀត</div>
      ) : null}

      {/* 4. Results & Apply Review Card */}
      {draft && !stale ? (
        <div className="autocut-review-card">
          {draft.candidates.length ? (
            <>
              <div className="autocut-review-header">
                <strong>រកឃើញ {selected.length} កន្លែងស្ងាត់</strong>
                <span className="autocut-savings-badge">ចំណេញ -{savings.toFixed(2)}s</span>
              </div>

              <div className="autocut-ranges-list">
                {draft.candidates.map((cut) => (
                  <div className="autocut-range-row" key={cut.id}>
                    <label className="autocut-range-label">
                      <input
                        type="checkbox"
                        checked={cut.enabled}
                        onChange={() => tool.toggle(cut.id)}
                      />
                      <span className="autocut-time-range">
                        {time(draft.start + cut.start)} → {time(draft.start + cut.end)}
                      </span>
                      <span className="autocut-time-diff">
                        −{(cut.end - cut.start).toFixed(2)}s
                      </span>
                    </label>
                    <button
                      type="button"
                      className="autocut-preview-play-btn"
                      onClick={() => tool.preview(cut)}
                      title="Play Preview"
                    >
                      <Play size={12} weight="fill" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="autocut-apply-btn"
                disabled={!selected.length || locked}
                onClick={tool.apply}
              >
                <Scissors size={17} weight="fill" />
                <span>អនុវត្តការកាត់ ({selected.length} កន្លែង)</span>
              </button>
            </>
          ) : (
            <div className="autocut-empty-results">
              <span>✨ គ្មានចន្លោះស្ងាត់វែងៗត្រូវកាត់ទេ (សំឡេងនិយាយជាប់គ្នាល្អ)</span>
            </div>
          )}
        </div>
      ) : null}

      <div className="autocut-footer-tag">
        <span>⚡ Silero VAD Local AI · ដំណើរការក្នុង Browser រក្សាឯកសារដើម 100%</span>
      </div>
    </section>
  );
}
