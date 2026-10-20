// Frame Scheduler determining which clips and frames must be composited at current playhead position
export class FrameScheduler {
  constructor(tracks = []) {
    this.tracks = tracks;
  }

  setTracks(tracks) {
    this.tracks = tracks;
  }

  getActiveClipsAtTime(timeSeconds) {
    const active = [];
    for (const track of this.tracks) {
      if (track.muted || track.hidden) continue;
      for (const clip of track.clips || []) {
        if (timeSeconds >= clip.startTime && timeSeconds < clip.startTime + clip.duration) {
          active.push({
            trackId: track.id,
            clip,
            internalTime: timeSeconds - clip.startTime + (clip.trimIn || 0),
          });
        }
      }
    }
    return active;
  }
}
