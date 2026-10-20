import { config } from "../../config/index.js";

export class ExternalAIBridge {
  constructor() {
    this.comfyUiUrl = config.comfyUiUrl;
    this.openAiApiKey = config.openAiApiKey;
  }

  async checkComfyUiStatus() {
    try {
      const res = await fetch(`${this.comfyUiUrl}/system_stats`, { signal: AbortSignal.timeout(2000) });
      return { available: res.ok, status: res.status };
    } catch {
      return { available: false, error: "ComfyUI server not reachable at " + this.comfyUiUrl };
    }
  }
}

export const externalAIBridge = new ExternalAIBridge();
