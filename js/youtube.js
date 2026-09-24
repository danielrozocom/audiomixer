// YouTube Parser & Playlist Extractor Helper Module

export function parseYouTubeInput(rawText) {
  if (!rawText) return [];
  const linesOrTokens = rawText.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
  const results = [];

  linesOrTokens.forEach(input => {
    // Detectar parámetro list= en cualquier URL (ej: youtube.com/playlist?list=PL...&si=...)
    const playlistMatch = input.match(/[?&]list=([a-zA-Z0-9_-]+)/i);
    if (playlistMatch && playlistMatch[1] && !playlistMatch[1].startsWith('LL') && !playlistMatch[1].startsWith('WL')) {
      results.push({ type: 'playlist', id: playlistMatch[1], raw: input });
      return;
    }

    // Detectar si pasaron directamente el ID de la playlist
    if (/^(PL|UU|FL|RD|OLAK5uy_)[a-zA-Z0-9_-]{5,}$/i.test(input)) {
      results.push({ type: 'playlist', id: input, raw: input });
      return;
    }

    // Detectar video individual por URL
    const videoRegExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
    const videoMatch = input.match(videoRegExp);
    if (videoMatch && videoMatch[1]) {
      results.push({ type: 'video', id: videoMatch[1], raw: input });
      return;
    }

    // Detectar video por ID directo de 11 caracteres
    if (input.length === 11 && !input.includes('/') && !input.includes('.') && !input.includes('?') && !input.includes('&')) {
      results.push({ type: 'video', id: input, raw: input });
      return;
    }
  });

  return results;
}

export async function fetchPlaylistItems(playlistId) {
  const endpoints = [
    `https://inv.nadeko.net/api/v1/playlists/${playlistId}`,
    `https://invidious.nerdvpn.de/api/v1/playlists/${playlistId}`,
    `https://invidious.drgns.space/api/v1/playlists/${playlistId}`,
    `https://pipedapi.kavin.rocks/playlists/${playlistId}`,
    `https://pipedapi.tokhmi.xyz/playlists/${playlistId}`,
    `https://api.allorigins.win/get?url=${encodeURIComponent(`https://inv.nadeko.net/api/v1/playlists/${playlistId}`)}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(`https://inv.nadeko.net/api/v1/playlists/${playlistId}`)}`
  ];

  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        let data = await res.json();
        // Si viene envuelto por el proxy de AllOrigins
        if (data && data.contents && typeof data.contents === 'string') {
          try {
            data = JSON.parse(data.contents);
          } catch (_) {}
        }
        
        // Formato Piped
        if (data && Array.isArray(data.relatedStreams) && data.relatedStreams.length > 0) {
          const mapped = data.relatedStreams.map(v => {
            let vId = v.url ? v.url.replace('/watch?v=', '').split('&')[0] : v.id;
            return {
              id: vId,
              title: v.title || `YouTube Audio [${vId}]`,
              duration: v.duration || null
            };
          }).filter(v => v.id && v.id.length === 11);
          if (mapped.length > 0) return mapped;
        }
        // Formato Invidious
        if (data && Array.isArray(data.videos) && data.videos.length > 0) {
          const mapped = data.videos.map(v => ({
            id: v.videoId,
            title: v.title || `YouTube Audio [${v.videoId}]`,
            duration: v.lengthSeconds || null
          })).filter(v => v.id && v.id.length === 11);
          if (mapped.length > 0) return mapped;
        }
      }
    } catch(e) {}
  }

  // Fallback 2: Scraping directo de YouTube Web vía CORS Proxy
  const corsProxies = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://www.youtube.com/playlist?list=${playlistId}`)}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(`https://www.youtube.com/playlist?list=${playlistId}`)}`,
    `https://corsproxy.io/?${encodeURIComponent(`https://www.youtube.com/playlist?list=${playlistId}`)}`
  ];

  for (const proxyUrl of corsProxies) {
    try {
      const res = await fetch(proxyUrl);
      if (res.ok) {
        const html = await res.text();
        const jsonMatch = html.match(/var ytInitialData = ({.*?});<\/script>/s) || html.match(/window\["ytInitialData"\] = ({.*?});<\/script>/s);
        if (jsonMatch) {
          const ytData = JSON.parse(jsonMatch[1]);
          const tabs = ytData.contents?.twoColumnBrowseResultsRenderer?.tabs;
          const tab = tabs?.find(t => t.tabRenderer?.content?.sectionListRenderer);
          const contents = tab?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents?.[0]?.playlistVideoListRenderer?.contents;
          if (Array.isArray(contents) && contents.length > 0) {
            const items = [];
            contents.forEach(c => {
              const v = c.playlistVideoRenderer;
              if (v && v.videoId) {
                items.push({
                  id: v.videoId,
                  title: v.title?.runs?.[0]?.text || v.title?.simpleText || `YouTube Audio [${v.videoId}]`,
                  duration: v.lengthSeconds ? parseInt(v.lengthSeconds) : null
                });
              }
            });
            if (items.length > 0) return items;
          }
        }
      }
    } catch (_) {}
  }

  // Fallback 3: Si todo falla, incrustar la playlist completa
  let playlistTitle = `Playlist de YouTube [${playlistId.substring(0, 14)}...]`;
  try {
    const oEmbedRes = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/playlist?list=${playlistId}`);
    if (oEmbedRes.ok) {
      const d = await oEmbedRes.json();
      if (d.title) playlistTitle = d.title;
    }
  } catch(e){}

  return [{
    id: playlistId,
    isPlaylistContainer: true,
    title: playlistTitle,
    duration: null
  }];
}
