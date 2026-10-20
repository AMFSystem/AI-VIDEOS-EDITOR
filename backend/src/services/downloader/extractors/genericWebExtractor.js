import { logger } from "../../../utils/logger.js";

export class GenericWebExtractor {
  static async extractMedia(url) {
    const cleanUrl = url.trim();
    const u = new URL(cleanUrl);

    // If it's already a direct video/stream URL (.m3u8, .mp4, etc.)
    if (/\.(m3u8|mp4|webm|mov|mkv)(\?.*)?$/i.test(cleanUrl)) {
      return {
        title: cleanUrl.split("/").pop().split("?")[0] || "Stream Media",
        thumbnail: null,
        platform: u.hostname,
        streamUrl: cleanUrl,
        referer: cleanUrl,
      };
    }

    try {
      const res = await fetch(cleanUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        redirect: "follow",
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch web page: HTTP ${res.status}`);
      }

      const html = await res.text();

      // 1. Extract Title
      let title = u.hostname;
      const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
                       html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
      const htmlTitle = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (ogTitle && ogTitle[1]) {
        title = ogTitle[1].trim();
      } else if (htmlTitle && htmlTitle[1]) {
        title = htmlTitle[1].trim();
      }

      // 2. Extract Thumbnail
      let thumbnail = null;
      const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
                       html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
      if (ogImage && ogImage[1]) {
        thumbnail = ogImage[1].startsWith("http") ? ogImage[1] : new URL(ogImage[1], cleanUrl).href;
      }

      // 3. Search for video stream (.m3u8 or .mp4)
      let streamUrl = null;

      // Look for HLS .m3u8 streams first (high quality adaptive streams)
      const m3u8Match = html.match(/(https?:\\?\/\\?\/[^"'`\s<>]+\.m3u8[^"'`\s<>]*)/i);
      if (m3u8Match) {
        streamUrl = m3u8Match[1].replace(/\\/g, "");
      }

      // Look for <video> or <source> src
      if (!streamUrl) {
        const videoSrcMatch = html.match(/<video[^>]+src=["']([^"']+)["']/i) ||
                              html.match(/<source[^>]+src=["']([^"']+)["'][^>]+type=["']video/i) ||
                              html.match(/<source[^>]+src=["']([^"']+)["']/i);
        if (videoSrcMatch) {
          const rawSrc = videoSrcMatch[1];
          streamUrl = rawSrc.startsWith("http") ? rawSrc : new URL(rawSrc, cleanUrl).href;
        }
      }

      // Look for direct MP4 links
      if (!streamUrl) {
        const mp4Match = html.match(/(https?:\\?\/\\?\/[^"'`\s<>]+\.mp4[^"'`\s<>]*)/i);
        if (mp4Match) {
          streamUrl = mp4Match[1].replace(/\\/g, "");
        }
      }

      if (!streamUrl) {
        return null; // Could not auto-detect stream
      }

      return {
        title,
        thumbnail,
        platform: u.hostname,
        streamUrl,
        referer: cleanUrl,
      };
    } catch (err) {
      logger.warn(`Generic web extraction failed for ${cleanUrl}:`, err.message);
      return null;
    }
  }
}
