import fs from "node:fs";
import path from "node:path";
import { fileManager } from "../../services/storage/fileManager.js";

export function handleRawStreamUpload(req, res, next) {
  // Streaming upload handler without heavy external dependencies
  const filename = req.headers["x-filename"] || `upload_${Date.now()}.mp4`;
  const targetPath = fileManager.getFilePath("uploads", filename);
  const writeStream = fs.createWriteStream(targetPath);

  req.pipe(writeStream);

  writeStream.on("finish", () => {
    req.uploadedFile = {
      filename,
      filePath: targetPath,
      size: writeStream.bytesWritten,
    };
    next();
  });

  writeStream.on("error", (err) => {
    res.status(500).json({ error: `Upload stream failed: ${err.message}` });
  });
}
