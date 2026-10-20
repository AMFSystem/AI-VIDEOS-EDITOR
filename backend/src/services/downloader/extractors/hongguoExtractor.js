import { logger } from "../../../utils/logger.js";

export class HongguoExtractor {
  static isMatch(url) {
    if (!url || typeof url !== "string") return false;
    return /hongguoduanju\.com/i.test(url);
  }

  static parseUrl(url) {
    try {
      const parsed = new URL(url);
      const seriesIdFromParam = parsed.searchParams.get("series_id");
      const vidFromParam = parsed.searchParams.get("vid") || parsed.searchParams.get("item_id");

      // Check /player/:series_id/:vid or /player/:series_id
      const playerMatch = parsed.pathname.match(/\/player\/(\d+)(?:\/(\d+))?/i);
      const detailMatch = parsed.pathname.match(/\/detail\/(\d+)/i);

      const seriesId = seriesIdFromParam || (playerMatch ? playerMatch[1] : null) || (detailMatch ? detailMatch[1] : null);
      const vid = vidFromParam || (playerMatch && playerMatch[2] ? playerMatch[2] : null);

      return { seriesId, vid };
    } catch {
      return { seriesId: null, vid: null };
    }
  }

  static async resolveMedia(url) {
    const cleanUrl = url.trim();
    const { seriesId, vid } = this.parseUrl(cleanUrl);

    if (!seriesId && !vid) {
      throw new Error("Could not find a valid Series ID or Episode ID in the Hongguo link.");
    }

    const headers = {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Referer": "https://hongguoduanju.com/",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    };

    // 1. Fetch series detail page or player page to extract router data
    // detail page has the full vid_list
    const detailUrl = seriesId
      ? `https://hongguoduanju.com/detail?series_id=${seriesId}`
      : cleanUrl;

    logger.info(`Fetching Hongguo detail data from ${detailUrl}`);
    const res = await fetch(detailUrl, { headers });
    if (!res.ok) {
      throw new Error(`Hongguo responded with HTTP status ${res.status}`);
    }

    const html = await res.text();

    // Extract _ROUTER_DATA
    let routerData = null;
    const match = html.match(/_ROUTER_DATA\s*=\s*(\{[\s\S]*?\n\s*\});/) || html.match(/_ROUTER_DATA\s*=\s*(\{[\s\S]*?\});/);
    if (match) {
      try {
        routerData = JSON.parse(match[1]);
      } catch (e) {
        logger.warn("Failed to parse Hongguo _ROUTER_DATA JSON:", e.message);
      }
    }

    if (!routerData) {
      throw new Error("Could not extract series metadata from Hongguo page.");
    }

    const loaderData = routerData.loaderData || {};
    const detailPage = loaderData.detail_page || {};
    const seriesDetail = detailPage.seriesDetail || loaderData["player_(series_id)/(vid)/page"]?.seriesDetail || {};

    const seriesName = seriesDetail.series_name || "Hongguo Short Drama";
    const seriesCover = seriesDetail.series_cover || null;
    const seriesIntro = seriesDetail.series_intro || "";
    const totalCount = seriesDetail.episode_cnt || seriesDetail.series_episode_info?.episode_cnt || 0;
    const vidList = Array.isArray(seriesDetail.vid_list) ? seriesDetail.vid_list : [];

    // Determine current episode
    let currentEpisodeNumber = 1;
    let targetVid = vid;

    if (vid && vidList.length > 0) {
      const idx = vidList.findIndex((id) => String(id) === String(vid));
      if (idx !== -1) {
        currentEpisodeNumber = idx + 1;
        targetVid = vidList[idx];
      }
    } else if (vidList.length > 0) {
      targetVid = vidList[0];
      currentEpisodeNumber = 1;
    }

    if (!targetVid) {
      throw new Error("Could not resolve episode video stream ID from Hongguo series.");
    }

    // Direct 360p stream URL
    const streamUrl = `https://hongguoduanju.com/video/public/${targetVid}/360p.mp4`;
    const fullTitle = `${seriesName} - Episode ${currentEpisodeNumber}`;

    // Build episodes list for batch download / selector
    const episodesList = vidList.map((epVid, index) => {
      const epNum = index + 1;
      return {
        id: epVid,
        number: epNum,
        title: `Episode ${epNum}`,
        thumbnail: seriesCover,
        url: `https://hongguoduanju.com/player/${seriesId || seriesDetail.series_id}/${epVid}`,
      };
    });

    return {
      title: fullTitle,
      dramaTitle: seriesName,
      thumbnail: seriesCover,
      description: seriesIntro,
      platform: "Hongguo (红果短剧)",
      streamUrl,
      referer: `https://hongguoduanju.com/player/${seriesId || seriesDetail.series_id}/${targetVid}`,
      episodeId: targetVid,
      currentEpisode: currentEpisodeNumber,
      totalEpisodes: episodesList.length || totalCount,
      episodes: episodesList,
    };
  }
}
