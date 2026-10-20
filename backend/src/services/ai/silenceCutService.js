export class SilenceCutService {
  async detectSilence(audioPath, thresholdDb = -35, minDurationSec = 0.5) {
    return {
      audioPath,
      thresholdDb,
      minDurationSec,
      silentIntervals: [],
      note: "Silence detection service ready.",
    };
  }
}

export const silenceCutService = new SilenceCutService();
