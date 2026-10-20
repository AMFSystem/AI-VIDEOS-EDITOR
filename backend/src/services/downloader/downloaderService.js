import { exec, spawn } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import { fileManager } from "../storage/fileManager.js";
import { logger } from "../../utils/logger.js";
import { KisskhExtractor } from "./extractors/kisskhExtractor.js";
import { GenericWebExtractor } from "./extractors/genericWebExtractor.js";

const execAsync = promisify(exec);

export class DownloaderService {
  constructor() {
    this.binaryPath = this.resolveBinary();
    this.isAvailable = null;
  }

  resolveBinary() {
    const candidates = [
      process.env.YT_DLP_PATH,
      "/opt/homebrew/bin/yt-dlp",
      "/usr/local/bin/yt-dlp",
      "yt-dlp",
    ].filter(Boolean);
    for (const p of candidates) {
      try {
        if (p.includes("/") && fsSync.existsSync(p)) {
          return p;
        }
      } catch {}
    }
    return "yt-dlp";
  }

  getEnv() {
    return {
      ...process.env,
      PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH || ""}`,
    };
  }

  async checkAvailability() {
    try {
      const binary = this.resolveBinary();
      const { stdout } = await execAsync(`"${binary}" --version`, { env: this.getEnv() });
      this.isAvailable = true;
      this.binaryPath = binary;
      return { available: true, version: stdout.trim(), binary };
    } catch {
      this.isAvailable = false;
      return {
        available: false,
        note: "yt-dlp is not installed or not in PATH. Direct file downloads still supported.",
      };
    }
  }

  async getMediaInfo(url) {
    if (!url || typeof url !== "string") {
      throw new Error("Invalid URL provided");
    }

    const cleanUrl = url.trim();

    // 1. KissKH Specialized Extractor (Asian Drama & Anime)
    if (KisskhExtractor.isMatch(cleanUrl)) {
      logger.info(`Extracting media info using KisskhExtractor for ${cleanUrl}`);
      const kisskhInfo = await KisskhExtractor.resolveMedia(cleanUrl);
      const formats = [
        { formatId: "best", label: "Best Available (Highest Quality)", ext: "mp4" },
        { formatId: "bestvideo[height<=1080]+bestaudio/best[height<=1080]", label: "1080p Full HD", ext: "mp4" },
        { formatId: "bestvideo[height<=720]+bestaudio/best[height<=720]", label: "720p HD", ext: "mp4" },
        { formatId: "bestvideo[height<=480]+bestaudio/best[height<=480]", label: "480p SD", ext: "mp4" },
        { formatId: "bestaudio/best", label: "Audio Only (MP3)", ext: "mp3" },
      ];

      return {
        isDirectMedia: false,
        title: kisskhInfo.title,
        thumbnail: kisskhInfo.thumbnail,
        duration: null,
        platform: kisskhInfo.platform,
        formats,
        streamUrl: kisskhInfo.streamUrl,
        referer: kisskhInfo.referer,
      };
    }

    // 2. Direct Video / Audio Link Detection (.mp4, .mov, .webm, .mkv, .mp3, etc.)
    const isDirectMedia = /\.(mp4|mov|webm|mkv|mp3|wav|m4a)(\?.*)?$/i.test(cleanUrl);
    if (isDirectMedia) {
      const filename = path.basename(new URL(cleanUrl).pathname) || "online_video.mp4";
      return {
        isDirectMedia: true,
        title: filename,
        thumbnail: null,
        duration: null,
        platform: "Direct Media Link",
        formats: [
          { formatId: "direct", resolution: "Original Quality", ext: "mp4" },
        ],
      };
    }

    // 3. Direct HLS Stream (.m3u8)
    if (/\.m3u8(\?.*)?$/i.test(cleanUrl)) {
      return {
        isDirectMedia: false,
        title: cleanUrl.split("/").pop().split("?")[0] || "HLS Stream",
        thumbnail: null,
        duration: null,
        platform: "HLS Stream (.m3u8)",
        formats: [
          { formatId: "best", label: "Best Available Stream", ext: "mp4" },
          { formatId: "bestaudio/best", label: "Audio Only (MP3)", ext: "mp3" },
        ],
      };
    }

    // 4. Standard Platform Detection for yt-dlp
    let platform = "Web Video";
    if (cleanUrl.includes("youtube.com") || cleanUrl.includes("youtu.be")) platform = "YouTube";
    else if (cleanUrl.includes("tiktok.com")) platform = "TikTok";
    else if (cleanUrl.includes("facebook.com") || cleanUrl.includes("fb.watch")) platform = "Facebook";
    else if (cleanUrl.includes("instagram.com")) platform = "Instagram";
    else if (cleanUrl.includes("twitter.com") || cleanUrl.includes("x.com")) platform = "X / Twitter";
    else if (cleanUrl.includes("vimeo.com")) platform = "Vimeo";
    else if (cleanUrl.includes("bilibili.com")) platform = "Bilibili";

    try {
      const binary = this.resolveBinary();
      const cmd = `"${binary}" --dump-single-json --no-warnings --no-playlist "${cleanUrl}"`;
      const { stdout } = await execAsync(cmd, { maxBuffer: 10 * 1024 * 1024, env: this.getEnv() });
      const info = JSON.parse(stdout);

      const formats = [
        { formatId: "bestvideo+bestaudio/best", label: "Best Available (Highest Quality)", ext: "mp4" },
        { formatId: "bestvideo[height<=1080]+bestaudio/best[height<=1080]", label: "1080p Full HD", ext: "mp4" },
        { formatId: "bestvideo[height<=720]+bestaudio/best[height<=720]", label: "720p HD", ext: "mp4" },
        { formatId: "bestvideo[height<=480]+bestaudio/best[height<=480]", label: "480p SD", ext: "mp4" },
        { formatId: "bestaudio/best", label: "Audio Only (MP3/M4A)", ext: "mp3" },
      ];

      return {
        isDirectMedia: false,
        title: info.title || "Untitled Video",
        thumbnail: info.thumbnail || null,
        duration: info.duration || 0,
        uploader: info.uploader || info.channel || platform,
        platform,
        formats,
      };
    } catch (err) {
      // 5. Fallback: Generic Web Extractor (look for embedded m3u8 or video elements)
      logger.info(`yt-dlp direct failed for ${cleanUrl}, trying GenericWebExtractor...`);
      const generic = await GenericWebExtractor.extractMedia(cleanUrl);
      if (generic && generic.streamUrl) {
        return {
          isDirectMedia: false,
          title: generic.title,
          thumbnail: generic.thumbnail,
          duration: null,
          platform: `${generic.platform} (Web Video)`,
          formats: [
            { formatId: "best", label: "Best Available Stream", ext: "mp4" },
            { formatId: "bestaudio/best", label: "Audio Only (MP3)", ext: "mp3" },
          ],
          streamUrl: generic.streamUrl,
          referer: generic.referer,
        };
      }

      throw err;
    }
  }

  async downloadMedia(url, options = {}, onProgress) {
    const { format = "bestvideo+bestaudio/best", isAudioOnly = false } = options;
    const cleanUrl = url.trim();
    const timestamp = Date.now();
    const isDirect = /\.(mp4|mov|webm|mkv|mp3|wav|m4a)(\?.*)?$/i.test(cleanUrl);

    if (isDirect) {
      // Direct stream download
      const ext = isAudioOnly ? "mp3" : "mp4";
      const filename = `download_${timestamp}.${ext}`;
      const outputPath = fileManager.getFilePath("uploads", filename);

      const res = await fetch(cleanUrl);
      if (!res.ok) throw new Error(`Direct download failed: HTTP ${res.status}`);
      const arrayBuffer = await res.arrayBuffer();
      await fs.writeFile(outputPath, Buffer.from(arrayBuffer));

      return {
        success: true,
        id: filename,
        filename,
        filePath: outputPath,
        url: `/storage/uploads/${filename}`,
        size: arrayBuffer.byteLength,
      };
    }

    // Resolve target download URL and any required Referer headers
    let targetDownloadUrl = cleanUrl;
    let extraHeaders = [];

    if (KisskhExtractor.isMatch(cleanUrl)) {
      logger.info(`Resolving KissKH media stream for download: ${cleanUrl}`);
      const kisskhInfo = await KisskhExtractor.resolveMedia(cleanUrl);
      targetDownloadUrl = kisskhInfo.streamUrl;
      extraHeaders = ["--add-header", `Referer: ${kisskhInfo.referer}`];
    } else if (!/\.m3u8(\?.*)?$/i.test(cleanUrl)) {
      // Check if it's a generic web page that needs extraction
      const generic = await GenericWebExtractor.extractMedia(cleanUrl);
      if (generic && generic.streamUrl) {
        targetDownloadUrl = generic.streamUrl;
        if (generic.referer) {
          extraHeaders = ["--add-header", `Referer: ${generic.referer}`];
        }
      }
    }

    // Format selection
    let chosenFormat = format;
    if (chosenFormat === "direct") chosenFormat = "best";
    if (targetDownloadUrl.includes(".m3u8") && (chosenFormat.includes("+") || chosenFormat.includes("bestvideo"))) {
      // For HLS m3u8 playlists, yt-dlp prefers standard quality filter
      chosenFormat = isAudioOnly ? "bestaudio/best" : "best";
    }

    const outputTemplate = path.join(fileManager.dirs.uploads, `download_${timestamp}.%(ext)s`);
    const args = [
      "--no-playlist",
      "--no-warnings",
      "--newline",
      ...extraHeaders,
      "-f", chosenFormat,
      "--merge-output-format", "mp4",
      "-o", outputTemplate,
      targetDownloadUrl,
    ];

    if (isAudioOnly) {
      args.push("-x", "--audio-format", "mp3");
    }

    return new Promise((resolve, reject) => {
      const binary = this.resolveBinary();
      logger.info(`Spawning ${binary} with args: ${args.join(" ")}`);
      const proc = spawn(binary, args, { env: this.getEnv() });
      let stderrOutput = "";
      let finalFilename = `download_${timestamp}.mp4`;

      proc.stdout.on("data", (chunk) => {
        const text = chunk.toString();
        // Parse yt-dlp percentage
        const match = text.match(/\[download\]\s+([\d.]+)%\s+of\s+~?([\w.]+)\s+at\s+([\w./]+)/);
        if (match && onProgress) {
          onProgress({
            percent: parseFloat(match[1]),
            totalSize: match[2],
            speed: match[3],
          });
        }
        // Capture destination filename
        const destMatch = text.match(/Destination:\s+(.+)/);
        if (destMatch) {
          finalFilename = path.basename(destMatch[1].trim());
        }
      });

      proc.stderr.on("data", (chunk) => {
        stderrOutput += chunk.toString();
      });

      proc.on("close", async (code) => {
        if (code === 0) {
          // Look for created file
          const files = await fileManager.listFiles("uploads");
          const created = files.find((f) => f.includes(`download_${timestamp}`));
          const resultFilename = created || finalFilename;
          const resultPath = fileManager.getFilePath("uploads", resultFilename);

          resolve({
            success: true,
            id: resultFilename,
            filename: resultFilename,
            filePath: resultPath,
            url: `/storage/uploads/${resultFilename}`,
          });
        } else {
          reject(new Error(`yt-dlp download failed with code ${code}: ${stderrOutput}`));
        }
      });

      proc.on("error", (err) => {
        reject(new Error(`Failed to start yt-dlp: ${err.message}`));
      });
    });
  }
}

export const downloaderService = new DownloaderService();
