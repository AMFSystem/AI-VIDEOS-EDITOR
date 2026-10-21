import React from "react";
import { Sparkle, X } from "@phosphor-icons/react";

export function GeminiScriptModal({
  showScriptModal,
  setShowScriptModal,
  scriptTopic,
  setScriptTopic,
  scriptTone,
  setScriptTone,
  isGeneratingScript,
  handleGenerateScriptWithGemini,
}) {
  if (!showScriptModal) return null;

  return (
    <div className="gemini-script-modal-backdrop" onClick={() => setShowScriptModal(false)}>
      <div className="gemini-script-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="elevenlabs-modal-header">
          <div className="elevenlabs-modal-title">
            <Sparkle size={20} weight="fill" color="#38bdf8" />
            <span>Gemini AI សរសេរអត្ថបទវីដេអូ</span>
          </div>
          <button
            className="elevenlabs-modal-close"
            type="button"
            onClick={() => setShowScriptModal(false)}
          >
            <X size={18} />
          </button>
        </div>

        <div className="elevenlabs-modal-body">
          <p style={{ fontSize: "13px", color: "#94a3b8", margin: 0, lineHeight: 1.6 }}>
            ជ្រើសរើសប្រធានបទគំរូ ឬវាយបញ្ចូលគំនិតរបស់អ្នក ដើម្បីឱ្យ Google Gemini សរសេរអត្ថបទនិយាយជាភាសាខ្មែរយ៉ាងពិរោះ និងទាក់ទាញ៖
          </p>

          {/* Preset Topic Buttons */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button
              className="gemini-script-preset-btn"
              type="button"
              onClick={() => setScriptTopic("រឿងនិទានខ្លីអំពីការតស៊ូ និងជោគជ័យ")}
            >
              📖 និទានរឿងខ្លី
            </button>
            <button
              className="gemini-script-preset-btn"
              type="button"
              onClick={() => setScriptTopic("ផ្សាយពាណិជ្ជកម្មលក់ផលិតផលអនឡាញទាក់ទាញ")}
            >
              🛍️ ផ្សាយពាណិជ្ជកម្ម
            </button>
            <button
              className="gemini-script-preset-btn"
              type="button"
              onClick={() => setScriptTopic("ចំណេះដឹងទូទៅ និងបច្ចេកវិទ្យាគួរឱ្យចាប់អារម្មណ៍")}
            >
              💡 ចំណេះដឹងបច្ចេកវិទ្យា
            </button>
            <button
              className="gemini-script-preset-btn"
              type="button"
              onClick={() => setScriptTopic("ពាក្យពេចន៍ស្វាគមន៍បើកឆាកវីដេអូ YouTube / TikTok")}
            >
              🎬 បើកឆាកវីដេអូ
            </button>
          </div>

          {/* Custom Topic Input */}
          <div className="elevenlabs-key-input-row">
            <label style={{ fontSize: "12.5px", fontWeight: 600, color: "#cbd5e1" }}>
              ប្រធានបទ ឬគំនិតដែលចង់សរសេរ៖
            </label>
            <textarea
              className="tts-textarea"
              rows={3}
              placeholder="ឧទាហរណ៍៖ សរសេរការរៀបរាប់អំពីដំណើរដើរលេងកម្សាន្តនៅតំបន់ភ្នំគូលែន..."
              value={scriptTopic}
              onChange={(e) => setScriptTopic(e.target.value)}
            />
          </div>

          {/* Tone Selection */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <label style={{ fontSize: "12.5px", fontWeight: 600, color: "#94a3b8" }}>
              ទឹកដមសម្លេង៖
            </label>
            <select
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                background: "rgba(15, 23, 42, 0.9)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                color: "#f1f5f9",
                fontSize: "12.5px",
                outline: "none",
              }}
              value={scriptTone}
              onChange={(e) => setScriptTone(e.target.value)}
            >
              <option value="ធម្មជាតិ និងរួសរាយ">ធម្មជាតិ និងរួសរាយ</option>
              <option value="រស់រវើក និងទាក់ទាញ">រស់រវើក និងទាក់ទាញ</option>
              <option value="ម៉ឺងម៉ាត់ និងវិជ្ជាជីវៈ">ម៉ឺងម៉ាត់ និងវិជ្ជាជីវៈ</option>
              <option value="កំប្លែង និងសប្បាយ">កំប្លែង និងសប្បាយ</option>
            </select>
          </div>
        </div>

        <div className="elevenlabs-modal-footer">
          <button
            className="elevenlabs-modal-btn-cancel"
            type="button"
            onClick={() => setShowScriptModal(false)}
          >
            បោះបង់
          </button>

          <button
            className="gemini-modal-btn-save"
            type="button"
            disabled={isGeneratingScript || !scriptTopic.trim()}
            onClick={() => handleGenerateScriptWithGemini()}
          >
            {isGeneratingScript ? (
              <>
                <Sparkle size={15} className="animate-spin" />
                <span>Gemini កំពុងសរសេរ...</span>
              </>
            ) : (
              <>
                <Sparkle size={15} weight="fill" />
                <span>បង្កើតអត្ថបទឥឡូវនេះ</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default GeminiScriptModal;
