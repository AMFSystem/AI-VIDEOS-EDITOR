import { logger } from "../../../utils/logger.js";

// Bundled pure JS algorithm from KissKH common.js (AES-like client fingerprint token generator)
function createBundledKkeyGenerator(origin = "https://kisskh.do") {
  const windowMock = {
    navigator: {
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      platform: "Win32",
      appCodeName: "Mozilla",
      appName: "Netscape",
    },
    document: {
      URL: `${origin}/`,
      referrer: `${origin}/`,
    },
  };

  const code = `
function _0x3a8d(_0x526f3f,_0x5658cb){const _0x54b945=_0x54b9();return _0x3a8d=function(_0x3a8df2,_0x3afa42){_0x3a8df2=_0x3a8df2-0x10a;let _0x2ea32b=_0x54b945[_0x3a8df2];return _0x2ea32b;},_0x3a8d(_0x526f3f,_0x5658cb);}
function _0x54b9(){const _0x1d5de3=['join','1766601DKvkfN','39aXORCP','toUpperCase','87280owbbkp','6AzawBg','fromCharCode','toString','splice','mg3c3b04ba','substr','9634ttJadP','length','referrer','499416bEetdB','platform','appCodeName','navigator','359664FzBQCJ','12yJxJzi','userAgent','1065160icGOUk','toLowerCase','document','push','charCodeAt','undefined','178276lBUtOp'];_0x54b9=function(){return _0x1d5de3;};return _0x54b9();}
(function(_0x2a0650,_0x28a91e){const _0xd45308=_0x3a8d,_0x4955cd=_0x2a0650();while(!![]){try{const _0x2eca83=parseInt(_0xd45308(0x10a))/0x1*(parseInt(_0xd45308(0x113))/0x2)+-parseInt(_0xd45308(0x10d))/0x3*(parseInt(_0xd45308(0x116))/0x4)+-parseInt(_0xd45308(0x10c))/0x5*(-parseInt(_0xd45308(0x11b))/0x6)+parseInt(_0xd45308(0x123))/0x7+parseInt(_0xd45308(0x11a))/0x8+parseInt(_0xd45308(0x125))/0x9+-parseInt(_0xd45308(0x11d))/0xa;if(_0x2eca83===_0x28a91e)break;else _0x4955cd['push'](_0x4955cd['shift']());}catch(_0x1d75b5){_0x4955cd['push'](_0x4955cd['shift']());}}}(_0x54b9,0x20892));
var _0x54b991=(function(){function _0x1b25b9(_0x3378d3){const _0xb4c3=_0x3a8d,_0x186fc8=_0x3378d3[_0xb4c3(0x114)],_0x5ac8cf=[];for(let _0x2ccc5f=0x0;_0x2ccc5f<_0x186fc8;_0x2ccc5f++)_0x5ac8cf[_0x2ccc5f>>>0x2]|=(0xff&_0x3378d3[_0xb4c3(0x121)](_0x2ccc5f))<<0x18-_0x2ccc5f%0x4*0x8;return[_0x5ac8cf,_0x186fc8];}function _0x1c779c(_0x3ff981,_0x459037){const _0x32cb7c=_0x3a8d,_0x220b47=[];for(let _0x44ccb3=0x0;_0x44ccb3<_0x459037;_0x44ccb3++){_0x220b47[_0x32cb7c(0x120)]((_0x3ff981[_0x44ccb3>>>0x2]>>>0x18-_0x44ccb3%0x4*0x8&0xff)[_0x32cb7c(0x10f)](0x10)['padStart'](0x2,'0'));}return _0x220b47[_0x32cb7c(0x124)]('');}function _0x12af79(_0x4dcec4){const _0x3c28b6=_0x3a8d;return(_0x4dcec4||'')[_0x3c28b6(0x112)](0x0,0x30);}function _0x70dbf4(_0x524c4a){const _0x1d3496=_0x3a8d;let _0x109c6f=0x0;const _0x5ebb16=_0x524c4a[_0x1d3496(0x114)];for(let _0x419dc5=0x0;_0x419dc5<_0x5ebb16;_0x419dc5++)_0x109c6f=(_0x109c6f<<0x5)-_0x109c6f+_0x524c4a[_0x1d3496(0x121)](_0x419dc5);return _0x109c6f;}function _0x29e11d(_0x4440b3){const _0x25677b=_0x3a8d,_0x384f5f=0x10-_0x4440b3[_0x25677b(0x114)]%0x10;for(let _0x120ea8=0x0;_0x120ea8<_0x384f5f;++_0x120ea8)_0x4440b3+=String[_0x25677b(0x10e)](_0x384f5f);return _0x4440b3;}function _0xaf4f42(_0x1493a6){const _0x3815a4=_0x3a8d,_0x5c4ece=_0x1493a6[_0x3815a4(0x114)];for(let _0x3835b2=0x0;_0x3835b2<_0x5c4ece;_0x3835b2+=0x4)_0x3505d7(_0x1493a6,_0x3835b2);}const _0x6b7b62=[[0x4f6bdaa3,-0x61d07350,0x7f5e722d,-0x61210cec,0x536620a8,-0x32b653e8,-0x4de821cb,0x2cc92d21,-0x73412227,0x41f771c1,-0xc1f500c,-0x20d67d2b,0x2dadde47,0x6c5aaf86,-0x6045ff8e,0x409382a7,-0x6417db2,-0x6a1bd238,0xa5e2dba,0x4acdaf1d,0x54c72698,-0x3edcf4b0,-0x3482d916,-0x7e4f7609,-0x6c9fb16c,0x524345c4,-0x66c19cd2,0x188eead9,-0x351884c7,-0x675bc103,0x19a5dd3,0x1914b70a,-0x4fb1e313,0x28ea2210,0x29707fc3,0x3064c8c9,-0x17593e17,-0x3fb31c07,-0x16c363c6,-0x26a7ab0d,-0x4b793324,0x74ca2f25,-0x62094ce1,0x44aee7ec]];(function(){const _0x52fed1=_0x3a8d;var _0x43be17=[],_0x42a74d=[],_0xb4bd43=[],_0x25f5e6=[],_0x5d5f77=[],_0x2de806=[];for(let _0x21abca=0x0;_0x21abca<0x100;_0x21abca++)_0x2de806[_0x21abca]=_0x21abca<0x80?_0x21abca<<0x1:_0x21abca<<0x1^0x11b;var _0x2119ec=0x0,_0x1a0508=0x0;for(let _0x11eabb=0x0;_0x11eabb<0x100;_0x11eabb++){var _0x5034cc=_0x1a0508^_0x1a0508<<0x1^_0x1a0508<<0x2^_0x1a0508<<0x3^_0x1a0508<<0x4;_0x5034cc=_0x5034cc>>>0x8^0xff&_0x5034cc^0x63,_0x43be17[_0x2119ec]=_0x5034cc;var _0x580af8=_0x2de806[_0x2119ec],_0x354320=_0x2de806[_0x2de806[_0x580af8]],_0x410b1f=0x101*_0x2de806[_0x5034cc]^0x1010100*_0x5034cc;_0x42a74d[_0x2119ec]=_0x410b1f<<0x18|_0x410b1f>>>0x8,_0xb4bd43[_0x2119ec]=_0x410b1f<<0x10|_0x410b1f>>>0x10,_0x25f5e6[_0x2119ec]=_0x410b1f<<0x8|_0x410b1f>>>0x18,_0x5d5f77[_0x2119ec]=_0x410b1f,_0x2119ec?(_0x2119ec=_0x580af8^_0x2de806[_0x2de806[_0x2de806[_0x354320^_0x580af8]]],_0x1a0508^=_0x2de806[_0x2de806[_0x1a0508]]):_0x2119ec=_0x1a0508=0x1;}_0x6b7b62['push'](_0x42a74d),_0x6b7b62[_0x52fed1(0x120)](_0xb4bd43),_0x6b7b62[_0x52fed1(0x120)](_0x25f5e6),_0x6b7b62['push'](_0x5d5f77),_0x6b7b62[_0x52fed1(0x120)](_0x43be17);}());function _0x3505d7(_0x13a508,_0x5baaa1){const [_0x458390,_0x32aa26,_0x53dadc,_0x4810d1,_0x3c0f1b,_0x128bff]=_0x6b7b62;let _0x21ba3f;_0x5baaa1===0x0?_0x21ba3f=[0x1504af3,0x56e619cf,0x2e42bba6,-0x73c08f07]:_0x21ba3f=_0x13a508['slice'](_0x5baaa1-0x4,_0x5baaa1);for(let _0x5b9637=0x0;_0x5b9637<0x4;_0x5b9637++)_0x13a508[_0x5baaa1+_0x5b9637]^=_0x21ba3f[_0x5b9637];for(var _0x116405=0xa,_0x4d3231=_0x13a508[_0x5baaa1]^_0x458390[0x0],_0x1f3a4f=_0x13a508[_0x5baaa1+0x1]^_0x458390[0x1],_0x598b52=_0x13a508[_0x5baaa1+0x2]^_0x458390[0x2],_0x2265d4=_0x13a508[_0x5baaa1+0x3]^_0x458390[0x3],_0xcb5ec5=0x4,_0x5e2dc7=0x1;_0x5e2dc7<_0x116405;_0x5e2dc7++){var _0x34de78=_0x32aa26[_0x4d3231>>>0x18]^_0x53dadc[_0x1f3a4f>>>0x10&0xff]^_0x4810d1[_0x598b52>>>0x8&0xff]^_0x3c0f1b[0xff&_0x2265d4]^_0x458390[_0xcb5ec5++],_0x42d7a0=_0x32aa26[_0x1f3a4f>>>0x18]^_0x53dadc[_0x598b52>>>0x10&0xff]^_0x4810d1[_0x2265d4>>>0x8&0xff]^_0x3c0f1b[0xff&_0x4d3231]^_0x458390[_0xcb5ec5++],_0x4a8c71=_0x32aa26[_0x598b52>>>0x18]^_0x53dadc[_0x2265d4>>>0x10&0xff]^_0x4810d1[_0x4d3231>>>0x8&0xff]^_0x3c0f1b[0xff&_0x1f3a4f]^_0x458390[_0xcb5ec5++];_0x2265d4=_0x32aa26[_0x2265d4>>>0x18]^_0x53dadc[_0x4d3231>>>0x10&0xff]^_0x4810d1[_0x1f3a4f>>>0x8&0xff]^_0x3c0f1b[0xff&_0x598b52]^_0x458390[_0xcb5ec5++],_0x4d3231=_0x34de78,_0x1f3a4f=_0x42d7a0,_0x598b52=_0x4a8c71;}_0x34de78=(_0x128bff[_0x4d3231>>>0x18]<<0x18|_0x128bff[_0x1f3a4f>>>0x10&0xff]<<0x10|_0x128bff[_0x598b52>>>0x8&0xff]<<0x8|_0x128bff[0xff&_0x2265d4])^_0x458390[_0xcb5ec5++],_0x42d7a0=(_0x128bff[_0x1f3a4f>>>0x18]<<0x18|_0x128bff[_0x598b52>>>0x10&0xff]<<0x10|_0x128bff[_0x2265d4>>>0x8&0xff]<<0x8|_0x128bff[0xff&_0x4d3231])^_0x458390[_0xcb5ec5++],_0x4a8c71=(_0x128bff[_0x598b52>>>0x18]<<0x18|_0x128bff[_0x2265d4>>>0x10&0xff]<<0x10|_0x128bff[_0x4d3231>>>0x8&0xff]<<0x8|_0x128bff[0xff&_0x1f3a4f])^_0x458390[_0xcb5ec5++],_0x2265d4=(_0x128bff[_0x2265d4>>>0x18]<<0x18|_0x128bff[_0x4d3231>>>0x10&0xff]<<0x10|_0x128bff[_0x1f3a4f>>>0x8&0xff]<<0x8|_0x128bff[0xff&_0x598b52])^_0x458390[_0xcb5ec5++],_0x13a508[_0x5baaa1]=_0x34de78,_0x13a508[_0x5baaa1+0x1]=_0x42d7a0,_0x13a508[_0x5baaa1+0x2]=_0x4a8c71,_0x13a508[_0x5baaa1+0x3]=_0x2265d4;}
return function(_0x3be93d,_0x3e48ea,_0xbf2c16,_0x576527,_0x454b79,_0x361753,_0x3cdffa,_0x2fa7de,_0xdaf7bd,_0x59e242,_0x5674ce){const _0x5acc2f=_0x3a8d;if(typeof _0x361753===_0x5acc2f(0x122))_0x361753=window[_0x5acc2f(0x11f)]['URL'];if(typeof _0x3cdffa===_0x5acc2f(0x122))_0x3cdffa=window[_0x5acc2f(0x119)][_0x5acc2f(0x11c)];if(typeof _0x2fa7de===_0x5acc2f(0x122))_0x2fa7de=window[_0x5acc2f(0x11f)][_0x5acc2f(0x115)];if(typeof _0xdaf7bd===_0x5acc2f(0x122))_0xdaf7bd=window[_0x5acc2f(0x119)][_0x5acc2f(0x118)];if(typeof _0x59e242===_0x5acc2f(0x122))_0x59e242=window[_0x5acc2f(0x119)]['appName'];if(typeof _0x5674ce===_0x5acc2f(0x122))_0x5674ce=window[_0x5acc2f(0x119)][_0x5acc2f(0x117)];const _0x5989e7=['',_0x3be93d,_0x3e48ea,_0x5acc2f(0x111),_0xbf2c16,_0x576527,_0x454b79,_0x12af79(_0x361753),_0x12af79(_0x3cdffa[_0x5acc2f(0x11e)]()),_0x12af79(_0x2fa7de),_0xdaf7bd,_0x59e242,_0x5674ce,'00',''];_0x5989e7[_0x5acc2f(0x110)](0x1,0x0,_0x70dbf4(_0x5989e7[_0x5acc2f(0x124)]('|')));const _0x278f64=_0x29e11d(_0x5989e7[_0x5acc2f(0x124)]('|')),[_0x3db385,_0x2f9d88]=_0x1b25b9(_0x278f64);return _0xaf4f42(_0x3db385),_0x1c779c(_0x3db385,_0x2f9d88)[_0x5acc2f(0x10b)]();};}());
return _0x54b991;
`;

  try {
    const fn = new Function("window", code);
    return fn(windowMock);
  } catch (err) {
    logger.error("Failed to compile kkey generator:", err);
    throw err;
  }
}

export class KisskhExtractor {
  static isMatch(url) {
    if (!url || typeof url !== "string") return false;
    return /kisskh\.(?:do|co|is|me|tv|ru|cc|site|net)/i.test(url);
  }

  static getOrigin(url) {
    try {
      const u = new URL(url);
      return u.origin;
    } catch {
      return "https://kisskh.do";
    }
  }

  static parseIds(url) {
    const parsed = new URL(url);
    let dramaId = parsed.searchParams.get("id");
    const epId = parsed.searchParams.get("ep");

    // Match Episode number from pathname e.g. /Drama/.../Episode-220
    const epMatch = parsed.pathname.match(/\/Episode-(\d+)/i);
    const epNumber = epMatch ? parseInt(epMatch[1], 10) : null;

    // Drama slug from pathname /Drama/{slug}/Episode-... or /Drama/{slug}
    const slugMatch = parsed.pathname.match(/\/Drama\/([^\/?#]+)/i);
    const dramaSlug = slugMatch ? slugMatch[1] : null;

    return { dramaId, epId, epNumber, dramaSlug };
  }

  static async resolveMedia(url) {
    const cleanUrl = url.trim();
    const origin = this.getOrigin(cleanUrl);
    let { dramaId, epId, epNumber, dramaSlug } = this.parseIds(cleanUrl);

    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Referer": `${origin}/`,
      "Accept": "application/json, text/plain, */*",
    };

    if (!dramaId && !epId && dramaSlug) {
      try {
        const query = dramaSlug.replace(/-/g, " ").replace(/\s*Season\s*[\d+]+/i, "").trim();
        const searchRes = await fetch(`${origin}/api/DramaList/Search?q=${encodeURIComponent(query)}`, { headers });
        if (searchRes.ok) {
          const list = await searchRes.json();
          if (Array.isArray(list) && list.length > 0) {
            dramaId = list[0].id;
          }
        }
      } catch (err) {
        logger.warn("Failed to search drama ID from slug:", err.message);
      }
    }

    if (!dramaId && !epId) {
      throw new Error("Could not find Drama ID (id=...) or Episode ID (ep=...) in the KissKH link.");
    }

    let dramaTitle = "Asian Drama";
    let thumbnail = null;
    let targetEpisodeId = epId;
    let episodeDisplay = epNumber ? `Episode ${epNumber}` : "Episode";
    let dramaEpisodes = [];
    let resolvedDramaId = dramaId;

    // Helper to fetch drama details
    const fetchDramaById = async (id) => {
      try {
        const res = await fetch(`${origin}/api/DramaList/Drama/${id}?isq=false`, { headers });
        if (res.ok) {
          const d = await res.json();
          if (d && (d.title || d.episodes)) return d;
        }
      } catch (err) {
        logger.warn(`Failed to fetch drama by ID ${id}:`, err.message);
      }
      return null;
    };

    let dramaData = dramaId ? await fetchDramaById(dramaId) : null;

    // If dramaData wasn't found (e.g. invalid ID or 400), search by slug or title
    if ((!dramaData || !dramaData.thumbnail) && dramaSlug) {
      try {
        const query = dramaSlug.replace(/-/g, " ").replace(/\s*Season\s*[\d+]+/i, "").trim();
        const searchRes = await fetch(`${origin}/api/DramaList/Search?q=${encodeURIComponent(query)}&type=0`, { headers });
        if (searchRes.ok) {
          const list = await searchRes.json();
          if (Array.isArray(list) && list.length > 0) {
            const cleanSlug = dramaSlug.toLowerCase().replace(/[^a-z0-9]/g, "");
            const bestMatch = list.find((item) => {
              const itemSlug = (item.title || "").toLowerCase().replace(/[^a-z0-9]/g, "");
              return itemSlug.includes(cleanSlug) || cleanSlug.includes(itemSlug);
            }) || list[0];

            if (bestMatch?.id) {
              resolvedDramaId = bestMatch.id;
              if (bestMatch.thumbnail) {
                thumbnail = bestMatch.thumbnail.includes("serveproxy.com/?url=")
                  ? decodeURIComponent(bestMatch.thumbnail.split("serveproxy.com/?url=")[1])
                  : bestMatch.thumbnail;
              }
              if (bestMatch.title) dramaTitle = bestMatch.title;
              const fetched = await fetchDramaById(bestMatch.id);
              if (fetched) dramaData = fetched;
            }
          }
        }
      } catch (err) {
        logger.warn("Failed to search drama by slug:", err.message);
      }
    }

    if (dramaData) {
      if (dramaData.title) dramaTitle = dramaData.title;
      if (dramaData.thumbnail) {
        thumbnail = dramaData.thumbnail.includes("serveproxy.com/?url=")
          ? decodeURIComponent(dramaData.thumbnail.split("serveproxy.com/?url=")[1])
          : dramaData.thumbnail;
      }
      if (Array.isArray(dramaData.episodes) && dramaData.episodes.length > 0) {
        dramaEpisodes = dramaData.episodes;
        if (!targetEpisodeId && epNumber) {
          const found = dramaData.episodes.find((ep) => ep.number === epNumber);
          if (found) targetEpisodeId = found.id;
        }
        if (!targetEpisodeId) {
          const defaultEp = dramaData.episodes[0];
          targetEpisodeId = defaultEp.id;
          episodeDisplay = `Episode ${defaultEp.number || 1}`;
        } else {
          const matched = dramaData.episodes.find((ep) => String(ep.id) === String(targetEpisodeId));
          if (matched?.number) {
            episodeDisplay = `Episode ${matched.number}`;
          }
        }
      }
    }

    if (!targetEpisodeId) {
      throw new Error("Unable to identify the episode to download. Please include 'ep=' in the URL.");
    }

    // 2. Generate kkey token
    logger.info(`Generating KissKH kkey for Episode ${targetEpisodeId}...`);
    const generator = createBundledKkeyGenerator(origin);
    const kkey = generator(
      targetEpisodeId,
      null,
      "2.8.10",
      "62f176f3bb1b5b8e70e39932ad34a0c7",
      4830201,
      "kisskh",
      "kisskh",
      "kisskh",
      "kisskh",
      "kisskh",
      "kisskh"
    );

    // 3. Fetch Stream URL
    const episodeApiUrl = `${origin}/api/DramaList/Episode/${targetEpisodeId}.png?err=false&ts=null&time=null&kkey=${encodeURIComponent(kkey)}`;
    const epRes = await fetch(episodeApiUrl, { headers });
    if (!epRes.ok) {
      throw new Error(`KissKH Episode API returned HTTP ${epRes.status}. The stream key might be rejected.`);
    }

    const epData = await epRes.json();
    const streamUrl = epData.Video || epData.Video_tmp || epData.ThirdParty;

    if (!streamUrl) {
      throw new Error("No video stream found for this episode on KissKH.");
    }

    const fullTitle = `${dramaTitle} - ${episodeDisplay}`;

    const episodesList = Array.isArray(dramaEpisodes) && dramaEpisodes.length > 0
      ? dramaEpisodes.map((ep) => ({
          id: ep.id,
          number: ep.number,
          title: `Episode ${ep.number}`,
          thumbnail: thumbnail,
          url: `${origin}/Drama/${dramaSlug || "drama"}/Episode-${ep.number}?id=${resolvedDramaId || dramaId}&ep=${ep.id}`,
        }))
      : [];

    return {
      title: fullTitle,
      dramaTitle,
      thumbnail,
      platform: "KissKH (Asian Drama & Anime)",
      streamUrl,
      referer: `${origin}/`,
      episodeId: targetEpisodeId,
      currentEpisode: epNumber || 1,
      totalEpisodes: episodesList.length,
      episodes: episodesList,
    };
  }
}
