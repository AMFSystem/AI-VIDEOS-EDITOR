import { useState, useEffect, useCallback, useRef } from "react";
import { DEFAULT_MODELS } from "../components/AIModelsManagerModal.jsx";

const getBackendBase = () =>
  (window.desktopAPI?.getBackendUrl && window.desktopAPI.getBackendUrl()) || "http://127.0.0.1:3001";

const resolveApiUrl = (endpoint) => {
  const clean = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  if (typeof window !== "undefined" && window.location.protocol === "file:") {
    const base = getBackendBase();
    return `${base}${clean}`;
  }
  return clean;
};

export function useAIModelGuard({ notify = console.log } = {}) {
  const [installedMap, setInstalledMap] = useState({});
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
        const map = {};
        json.models?.forEach((m) => {
          if (m.installed) {
            map[m.id] = true;
          }
        });
        setInstalledMap(map);
        return map;
      }
    } catch (err) {
      console.warn("useAIModelGuard: Could not fetch models status:", err);
    }
    return {};
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const isModelInstalled = useCallback(
    (modelId) => {
      return Boolean(installedMap[modelId]);
    },
    [installedMap]
  );

  /**
   * Guards an action requiring a local AI model.
   * If the model is already installed in the local computer, immediately executes `onProceed()`.
   * If the model is not installed yet, pops up the AIModelGuideModal to guide the user and download it!
   */
  const requireModel = useCallback(
    async (modelId, onProceed, customInfo = null) => {
      // 1. Check current memory map
      if (installedMap[modelId]) {
        if (typeof onProceed === "function") onProceed();
        return true;
      }

      // 2. Fetch fresh status from backend in case it was just installed
      const freshMap = await refreshStatus();
      if (freshMap[modelId]) {
        if (typeof onProceed === "function") onProceed();
        return true;
      }

      // 3. Not installed -> Pop up guidance modal
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
          // Refresh state and run callback
          refreshStatus().then(() => {
            if (typeof onProceed === "function") onProceed();
          });
        },
      });

      return false;
    },
    [installedMap, refreshStatus]
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
