export class AudioStemService {
  async separateStems(audioPath) {
    return {
      success: true,
      audioPath,
      stems: {
        vocals: null,
        instrumental: null,
      },
      note: "Audio Stem Separation service ready for Demucs / UVR bridge.",
    };
  }
}

export const audioStemService = new AudioStemService();
