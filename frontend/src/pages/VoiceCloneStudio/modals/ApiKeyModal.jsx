import React, { useState, useEffect } from "react";
import {
  Key,
  X,
  Copy,
  Check,
  Eye,
  EyeSlash,
  Trash,
  Lightning,
  Plus,
  Sparkle,
} from "@phosphor-icons/react";
import {
  verifyGeminiKey,
  getStoredGeminiKeys,
  setStoredGeminiKeys,
} from "../../../lib/geminiRuntime.js";
import {
  verifyElevenLabsKey,
  getStoredElevenLabsKeys,
  setStoredElevenLabsKeys,
} from "../../../lib/elevenlabsRuntime.js";
import "../VoiceCloneStudioPage.css";

const DEFAULT_PROVIDERS = [
  {
    id: "gemini",
    name: "Google Gemini AI",
    avatar: "G",
    avatarBg: "#dbeafe",
    avatarColor: "#2563eb",
    placeholder: "AIzaSy... (Gemini API Key)",
    models: [
      "Gemini 2.5 Flash (Fast & Smart)",
      "Gemini 2.0 Flash (Audio & Multimodal)",
      "Gemini 2.0 Pro Experimental",
      "Gemini 1.5 Pro",
    ],
    defaultModel: "Gemini 2.5 Flash (Fast & Smart)",
    storageKey: "ai_video_editor_gemini_api_keys",
    modelStorageKey: "ai_video_editor_gemini_model",
  },
  {
    id: "elevenlabs",
    name: "ElevenLabs Neural AI",
    avatar: "EL",
    avatarBg: "#f3e8ff",
    avatarColor: "#9333ea",
    placeholder: "sk_... (ElevenLabs API Key)",
    models: [
      "Eleven Multilingual v2 (High Quality)",
      "Eleven Flash v2.5 (Fast)",
      "Eleven Turbo v2.5",
    ],
    defaultModel: "Eleven Multilingual v2 (High Quality)",
    storageKey: "timeline_studio_elevenlabs_keys",
    modelStorageKey: "timeline_studio_elevenlabs_model",
  },
  {
    id: "openai",
    name: "OpenAI GPT & Reasoning",
    avatar: "OA",
    avatarBg: "#dcfce7",
    avatarColor: "#16a34a",
    placeholder: "sk-proj-... (OpenAI API Key)",
    models: [
      "GPT-4o (Omni Flagship)",
      "GPT-4o-mini (Fast & Lightweight)",
      "o1-mini (Reasoning & Math)",
      "GPT-4-turbo",
    ],
    defaultModel: "GPT-4o (Omni Flagship)",
    storageKey: "ai_video_editor_openai_api_keys",
    modelStorageKey: "ai_video_editor_openai_model",
  },
  {
    id: "anthropic",
    name: "Anthropic Claude",
    avatar: "C",
    avatarBg: "#fef3c7",
    avatarColor: "#d97706",
    placeholder: "sk-ant-... (Anthropic API Key)",
    models: [
      "Claude 3.5 Sonnet v2",
      "Claude 3.5 Haiku",
      "Claude 3 Opus",
    ],
    defaultModel: "Claude 3.5 Sonnet v2",
    storageKey: "ai_video_editor_anthropic_api_keys",
    modelStorageKey: "ai_video_editor_anthropic_model",
  },
  {
    id: "deepseek",
    name: "DeepSeek AI (V3 & R1)",
    avatar: "DS",
    avatarBg: "#e0f2fe",
    avatarColor: "#0284c7",
    placeholder: "sk-... (DeepSeek API Key)",
    models: [
      "DeepSeek-V3 Chat (671B MoE)",
      "DeepSeek-R1 Reasoning (CoT)",
    ],
    defaultModel: "DeepSeek-V3 Chat (671B MoE)",
    storageKey: "ai_video_editor_deepseek_api_keys",
    modelStorageKey: "ai_video_editor_deepseek_model",
  },
];

export function ApiKeyModal({
  showKeyModal,
  setShowKeyModal,
  isOpen,
  onClose,
  onKeysUpdated,
  onSaved,
  notify = (msg) => console.log(msg),
}) {
  const isModalOpen = showKeyModal ?? isOpen ?? false;
  const handleClose = () => {
    if (setShowKeyModal) setShowKeyModal(false);
    if (onClose) onClose();
  };
  const [providerState, setProviderState] = useState({});
  const [copiedKeyId, setCopiedKeyId] = useState(null);

  // Initialize providers state from storage
  useEffect(() => {
    if (!isModalOpen) return;

    const initial = {};
    DEFAULT_PROVIDERS.forEach((p) => {
      let storedKeys = [];
      try {
        if (p.id === "gemini") {
          storedKeys = getStoredGeminiKeys();
        } else if (p.id === "elevenlabs") {
          storedKeys = getStoredElevenLabsKeys();
        } else {
          const raw = localStorage.getItem(p.storageKey);
          if (raw) storedKeys = JSON.parse(raw);
        }
      } catch {
        storedKeys = [];
      }

      if (!Array.isArray(storedKeys) || storedKeys.length === 0) {
        storedKeys = [""];
      }

      const storedModel =
        localStorage.getItem(p.modelStorageKey) || p.defaultModel;

      initial[p.id] = {
        selectedModel: storedModel,
        keys: storedKeys.map((k, idx) => ({
          id: `${p.id}-${idx}-${Date.now()}`,
          value: k || "",
          isMasked: true,
          testStatus: k ? "idle" : null, // 'idle' | 'testing' | 'success' | 'error'
          testMessage: "",
        })),
      };
    });

    setProviderState(initial);
  }, [showKeyModal]);

  if (!showKeyModal) return null;

  // Add key row
  const handleAddKey = (providerId) => {
    setProviderState((prev) => {
      const current = prev[providerId] || { keys: [], selectedModel: "" };
      return {
        ...prev,
        [providerId]: {
          ...current,
          keys: [
            ...current.keys,
            {
              id: `${providerId}-${Date.now()}-${Math.random()}`,
              value: "",
              isMasked: true,
              testStatus: null,
              testMessage: "",
            },
          ],
        },
      };
    });
  };

  // Change key value
  const handleKeyChange = (providerId, keyId, newValue) => {
    setProviderState((prev) => {
      const current = prev[providerId];
      if (!current) return prev;
      return {
        ...prev,
        [providerId]: {
          ...current,
          keys: current.keys.map((k) =>
            k.id === keyId ? { ...k, value: newValue, testStatus: null, testMessage: "" } : k
          ),
        },
      };
    });
  };

  // Toggle mask
  const handleToggleMask = (providerId, keyId) => {
    setProviderState((prev) => {
      const current = prev[providerId];
      if (!current) return prev;
      return {
        ...prev,
        [providerId]: {
          ...current,
          keys: current.keys.map((k) =>
            k.id === keyId ? { ...k, isMasked: !k.isMasked } : k
          ),
        },
      };
    });
  };

  // Delete key row
  const handleDeleteKey = (providerId, keyId) => {
    setProviderState((prev) => {
      const current = prev[providerId];
      if (!current) return prev;
      let updated = current.keys.filter((k) => k.id !== keyId);
      if (updated.length === 0) {
        updated = [
          {
            id: `${providerId}-${Date.now()}`,
            value: "",
            isMasked: true,
            testStatus: null,
            testMessage: "",
          },
        ];
      }
      return {
        ...prev,
        [providerId]: {
          ...current,
          keys: updated,
        },
      };
    });
  };

  // Copy key
  const handleCopyKey = async (keyId, value) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKeyId(keyId);
      setTimeout(() => setCopiedKeyId(null), 1500);
    } catch {
      // Ignore clipboard fail
    }
  };

  // Test individual key
  const handleTestKey = async (providerId, keyId, keyValue) => {
    const cleanKey = (keyValue || "").trim();
    if (!cleanKey) {
      setProviderState((prev) => {
        const cur = prev[providerId];
        return {
          ...prev,
          [providerId]: {
            ...cur,
            keys: cur.keys.map((k) =>
              k.id === keyId
                ? { ...k, testStatus: "error", testMessage: "សូមបញ្ចូល Key" }
                : k
            ),
          },
        };
      });
      return;
    }

    // Set testing state
    setProviderState((prev) => {
      const cur = prev[providerId];
      return {
        ...prev,
        [providerId]: {
          ...cur,
          keys: cur.keys.map((k) =>
            k.id === keyId
              ? { ...k, testStatus: "testing", testMessage: "កំពុងតេស្ត..." }
              : k
          ),
        },
      };
    });

    try {
      if (providerId === "gemini") {
        const res = await verifyGeminiKey(cleanKey);
        if (res.valid) {
          setProviderState((prev) => {
            const cur = prev[providerId];
            return {
              ...prev,
              [providerId]: {
                ...cur,
                keys: cur.keys.map((k) =>
                  k.id === keyId
                    ? { ...k, testStatus: "success", testMessage: "✓ សកម្ម (Quota OK)" }
                    : k
                ),
              },
            };
          });
        } else {
          throw new Error(res.error || "Key មិនត្រឹមត្រូវ");
        }
      } else if (providerId === "elevenlabs") {
        const res = await verifyElevenLabsKey(cleanKey);
        if (res.valid) {
          setProviderState((prev) => {
            const cur = prev[providerId];
            return {
              ...prev,
              [providerId]: {
                ...cur,
                keys: cur.keys.map((k) =>
                  k.id === keyId
                    ? { ...k, testStatus: "success", testMessage: `✓ សកម្ម (${res.tier || "Active"})` }
                    : k
                ),
              },
            };
          });
        } else {
          throw new Error(res.error || "Key មិនត្រឹមត្រូវ");
        }
      } else if (providerId === "openai") {
        const testRes = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${cleanKey}` },
        });
        if (testRes.ok) {
          setProviderState((prev) => {
            const cur = prev[providerId];
            return {
              ...prev,
              [providerId]: {
                ...cur,
                keys: cur.keys.map((k) =>
                  k.id === keyId
                    ? { ...k, testStatus: "success", testMessage: "✓ សកម្ម (Connected)" }
                    : k
                ),
              },
            };
          });
        } else {
          const err = await testRes.json().catch(() => ({}));
          throw new Error(err?.error?.message || `HTTP ${testRes.status}`);
        }
      } else if (providerId === "anthropic") {
        // Simple format validation / healthcheck
        if (cleanKey.startsWith("sk-ant-")) {
          setProviderState((prev) => {
            const cur = prev[providerId];
            return {
              ...prev,
              [providerId]: {
                ...cur,
                keys: cur.keys.map((k) =>
                  k.id === keyId
                    ? { ...k, testStatus: "success", testMessage: "✓ ទម្រង់ត្រឹមត្រូវ" }
                    : k
                ),
              },
            };
          });
        } else {
          throw new Error("ទម្រង់ Key ត្រូវផ្តើមដោយ sk-ant-");
        }
      } else if (providerId === "deepseek") {
        const testRes = await fetch("https://api.deepseek.com/models", {
          headers: { Authorization: `Bearer ${cleanKey}` },
        });
        if (testRes.ok) {
          setProviderState((prev) => {
            const cur = prev[providerId];
            return {
              ...prev,
              [providerId]: {
                ...cur,
                keys: cur.keys.map((k) =>
                  k.id === keyId
                    ? { ...k, testStatus: "success", testMessage: "✓ សកម្ម (Connected)" }
                    : k
                ),
              },
            };
          });
        } else {
          throw new Error(`HTTP ${testRes.status}`);
        }
      }
    } catch (err) {
      setProviderState((prev) => {
        const cur = prev[providerId];
        return {
          ...prev,
          [providerId]: {
            ...cur,
            keys: cur.keys.map((k) =>
              k.id === keyId
                ? { ...k, testStatus: "error", testMessage: err.message || "Key មិនត្រឹមត្រូវ" }
                : k
            ),
          },
        };
      });
    }
  };

  // Change model
  const handleModelChange = (providerId, modelName) => {
    setProviderState((prev) => {
      const cur = prev[providerId] || {};
      return {
        ...prev,
        [providerId]: {
          ...cur,
          selectedModel: modelName,
        },
      };
    });
  };

  // Save all keys and close
  const handleSaveAll = () => {
    DEFAULT_PROVIDERS.forEach((p) => {
      const cur = providerState[p.id];
      if (!cur) return;

      const cleanKeys = cur.keys
        .map((k) => (k.value || "").trim())
        .filter(Boolean);

      // Persist model
      if (cur.selectedModel) {
        localStorage.setItem(p.modelStorageKey, cur.selectedModel);
      }

      // Persist keys
      if (p.id === "gemini") {
        setStoredGeminiKeys(cleanKeys);
      } else if (p.id === "elevenlabs") {
        setStoredElevenLabsKeys(cleanKeys);
      } else {
        localStorage.setItem(p.storageKey, JSON.stringify(cleanKeys));
      }
    });

    onKeysUpdated?.();
    onSaved?.();
    handleClose();
    notify?.("បានរក្សាទុក API Keys ទាំងអស់ដោយជោគជ័យ!");
  };

  if (!isModalOpen) return null;

  return (
    <div className="elevenlabs-modal-backdrop" onClick={handleClose}>
      <div
        className="api-multi-modal-box"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="api-multi-modal-header">
          <div className="api-multi-modal-title">
            <Key size={20} weight="fill" color="#2563eb" />
            <span>កំណត់ API Keys (Multi-Key Management)</span>
          </div>
          <button
            className="api-multi-modal-close"
            type="button"
            onClick={handleClose}
            title="បិទ"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body: Providers list */}
        <div className="api-multi-modal-body">
          {DEFAULT_PROVIDERS.map((provider) => {
            const curState = providerState[provider.id] || {
              keys: [{ id: "temp", value: "", isMasked: true }],
              selectedModel: provider.defaultModel,
            };

            const validCount = curState.keys.filter((k) => (k.value || "").trim()).length;
            const hasKey = validCount > 0;

            return (
              <div key={provider.id} className="api-provider-card">
                {/* Provider Header */}
                <div className="api-provider-header">
                  <div className="api-provider-info">
                    <div
                      className="api-provider-avatar"
                      style={{
                        background: provider.avatarBg,
                        color: provider.avatarColor,
                      }}
                    >
                      {provider.avatar}
                    </div>
                    <span className="api-provider-name">{provider.name}</span>
                    <span
                      className={`api-provider-status-badge ${
                        hasKey ? "active" : "no-key"
                      }`}
                    >
                      {hasKey
                        ? validCount > 1
                          ? `Active (${validCount} Keys)`
                          : "Active"
                        : "No Key"}
                    </span>
                  </div>

                  <div className="api-provider-controls">
                    <select
                      className="api-provider-model-select"
                      value={curState.selectedModel || provider.defaultModel}
                      onChange={(e) => handleModelChange(provider.id, e.target.value)}
                    >
                      {provider.models.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      className="api-provider-add-key-btn"
                      onClick={() => handleAddKey(provider.id)}
                    >
                      <Plus size={14} weight="bold" />
                      <span>Add Key</span>
                    </button>
                  </div>
                </div>

                {/* Keys List */}
                <div className="api-keys-list">
                  {curState.keys.map((kItem) => {
                    return (
                      <div key={kItem.id} className="api-key-row-wrap">
                        <div className="api-key-row">
                          <div className="api-key-input-box">
                            <input
                              type={kItem.isMasked ? "password" : "text"}
                              className="api-key-input"
                              placeholder={provider.placeholder}
                              value={kItem.value}
                              onChange={(e) =>
                                handleKeyChange(provider.id, kItem.id, e.target.value)
                              }
                            />
                            <div className="api-key-input-actions">
                              <button
                                type="button"
                                className="api-key-action-icon-btn"
                                onClick={() => handleCopyKey(kItem.id, kItem.value)}
                                title="ចម្លង Key"
                              >
                                {copiedKeyId === kItem.id ? (
                                  <Check size={14} weight="bold" color="#16a34a" />
                                ) : (
                                  <Copy size={14} />
                                )}
                              </button>

                              <button
                                type="button"
                                className="api-key-action-icon-btn"
                                onClick={() => handleToggleMask(provider.id, kItem.id)}
                                title={kItem.isMasked ? "បង្ហាញ Key" : "លាក់ Key"}
                              >
                                {kItem.isMasked ? (
                                  <Eye size={14} />
                                ) : (
                                  <EyeSlash size={14} />
                                )}
                              </button>
                            </div>
                          </div>

                          <button
                            type="button"
                            className="api-key-test-btn"
                            disabled={kItem.testStatus === "testing" || !kItem.value.trim()}
                            onClick={() =>
                              handleTestKey(provider.id, kItem.id, kItem.value)
                            }
                          >
                            <Lightning size={14} weight="fill" />
                            <span>
                              {kItem.testStatus === "testing" ? "Testing..." : "Test"}
                            </span>
                          </button>

                          {curState.keys.length > 1 && (
                            <button
                              type="button"
                              className="api-key-delete-btn"
                              onClick={() => handleDeleteKey(provider.id, kItem.id)}
                              title="លុប Key នេះ"
                            >
                              <Trash size={16} />
                            </button>
                          )}
                        </div>

                        {/* Status message below row if tested */}
                        {kItem.testMessage && (
                          <div
                            className={`api-key-status-text ${
                              kItem.testStatus === "success" ? "success" : "error"
                            }`}
                            style={{ marginLeft: 6, marginTop: 4 }}
                          >
                            {kItem.testMessage}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="api-multi-modal-footer">
          <button
            type="button"
            className="api-multi-modal-btn-cancel"
            onClick={handleClose}
          >
            បោះបង់
          </button>
          <button
            type="button"
            className="api-multi-modal-btn-save"
            onClick={handleSaveAll}
          >
            រក្សាទុក
          </button>
        </div>
      </div>
    </div>
  );
}

export default ApiKeyModal;
