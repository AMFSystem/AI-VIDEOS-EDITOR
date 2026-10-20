export function validateTimelinePayload(payload) {
  if (!payload || typeof payload !== "object") {
    return { valid: false, error: "Invalid timeline payload: must be an object" };
  }
  if (payload.clips && !Array.isArray(payload.clips)) {
    return { valid: false, error: "clips must be an array" };
  }
  if (payload.tracks && !Array.isArray(payload.tracks)) {
    return { valid: false, error: "tracks must be an array" };
  }
  return { valid: true };
}
