import { useState, useEffect, useCallback, useRef } from "react";
import { DEFAULT_MODELS } from "../components/AIModelsManagerModal.jsx";

const getBackendBase = () =>
  (window.desktopAPI?.getBackendUrl && window.desktopAPI.getBackendUrl()) || "http://127.0.0.1:3001";

const resolveApiUrl = (endpoint) => {
  const clean = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  if (typeof window === "undefined") return clean;
  const isLocalDirect =
    window.location.origin === "http://127.0.0.1:3001" ||
    window.location.origin === "http://localhost:3001";
  if (!isLocalDirect) {
    const base = getBackendBase();
    return `${base}${clean}`;
  }
  return clean;
};

const LOCAL_STORAGE_KEY = "installed_ai_models";

function getCachedInstalledModels() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setCachedInstalledModels(map) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(map));
  } catch {}
}

export function useAIModelGuard({ notify = console.log } = {}) {
  const [installedMap, setInstalledMap] = useState(() => getCachedInstalledModels());
  const [guideModalConfig, setGuideModalConfig] = useState({
    isOpen: false,
    modelId: null,
    modelInfo: null,
    onProceed: null,
  });

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch(resolveApiUrl("/api/ai/models"));
      if (res.ok) {
        const json = await res.json();
        const map = { ...getCachedInstalledModels() };
        json.models?.forEach((m) => {
          if (m.installed) {
            map[m.id] = true;
          }
        });
        setInstalledMap(map);
        setCachedInstalledModels(map);
        return map;
      }
    } catch (err) {
      console.warn("useAIModelGuard: Could not fetch models status:", err);
    }
    return getCachedInstalledModels();
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const isModelInstalled = useCallback(
    (modelId) => {
      if (!modelId) return false;
      if (installedMap[modelId]) return true;
      const cached = getCachedInstalledModels();
      return Boolean(cached[modelId]);
    },
    [installedMap]
  );

  /**
   * Guards an action requiring a local AI model.
   * If the model is already installed in the local computer, immediately executes `onProceed()`.
   * Under NO CIRCUMSTANCES pops up the modal if the model is installed!
   */
  const requireModel = useCallback(
    async (modelId, onProceed, customInfo = null) => {
      if (!modelId) {
        if (typeof onProceed === "function") onProceed();
        return true;
      }

      // 1. Instant check in memory or persistent cache
      if (isModelInstalled(modelId)) {
        if (typeof onProceed === "function") onProceed();
        return true;
      }

      // 2. Fetch fresh status from backend to verify disk state
      const freshMap = await refreshStatus();
      if (freshMap[modelId]) {
        if (typeof onProceed === "function") onProceed();
        return true;
      }

      // 3. ONLY if confirmed NOT on disk -> Pop up guidance modal
      const modelDef =
        customInfo ||
        DEFAULT_MODELS.find((m) => m.id === modelId) || {
          id: modelId,
          name: modelId,
          badge: "Local AI",
          description: "មុខងារនេះត្រូវការ AI Model ក្នុងកុំព្យូទ័រជាមុនសិន",
          sizeFormatted: "Free Download",
        };

      setGuideModalConfig({
        isOpen: true,
        modelId,
        modelInfo: modelDef,
        onProceed: () => {
          refreshStatus().then(() => {
            if (typeof onProceed === "function") onProceed();
          });
        },
      });

      return false;
    },
    [isModelInstalled, refreshStatus]
  );

  const closeGuideModal = useCallback(() => {
    setGuideModalConfig((prev) => ({ ...prev, isOpen: false }));
    refreshStatus();
  }, [refreshStatus]);

  return {
    installedMap,
    isModelInstalled,
    requireModel,
    refreshStatus,
    guideModalConfig,
    closeGuideModal,
  };
}

export default useAIModelGuard;
