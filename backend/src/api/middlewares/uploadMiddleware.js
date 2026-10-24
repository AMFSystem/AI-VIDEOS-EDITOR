import fs from "node:fs";
import path from "node:path";
import { fileManager } from "../../services/storage/fileManager.js";

export function handleRawStreamUpload(req, res, next) {
  // Streaming upload handler without heavy external dependencies
  const rawHeader = req.headers["x-filename"];
  let filename = `upload_${Date.now()}.mp4`;
  if (rawHeader) {
    try {
      filename = decodeURIComponent(rawHeader);
    } catch {
      filename = rawHeader;
    }
  }
  // Sanitize filename for safe filesystem & ffmpeg compatibility
  const safeBaseName = path.basename(filename).replace(/[^\w.\-\s]/g, "_").trim() || `media_${Date.now()}.mp4`;
  const finalFilename = `${Date.now()}_${safeBaseName}`;
  const targetPath = fileManager.getFilePath("uploads", finalFilename);
  const writeStream = fs.createWriteStream(targetPath);

  req.pipe(writeStream);

  writeStream.on("finish", () => {
    req.uploadedFile = {
      filename: finalFilename,
      originalName: filename,
      filePath: targetPath,
      size: writeStream.bytesWritten,
    };
    next();
  });

  writeStream.on("error", (err) => {
    res.status(500).json({ error: `Upload stream failed: ${err.message}` });
  });
}
