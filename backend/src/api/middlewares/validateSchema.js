import { validateTimelinePayload } from "../validators/timeline.schema.js";

export function validateTimelineMiddleware(req, res, next) {
  const check = validateTimelinePayload(req.body);
  if (!check.valid) {
    return res.status(400).json({ error: check.error });
  }
  next();
}
