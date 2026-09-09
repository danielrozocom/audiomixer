// YouTube Parser & Playlist Extractor Helper Module

export function parseYouTubeInput(rawText) {
  if (!rawText) return [];
  const linesOrTokens = rawText.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
  const results = [];

  linesOrTokens.forEach(input => {
    const playlistMatch = input.match(/[?&]list=([a-zA-Z0-9_-]+)/i);
    if (playlistMatch && playlistMatch[1] && !playlistMatch[1].startsWith('LL') && !playlistMatch[1].startsWith('WL')) {
      results.push({ type: 'playlist', id: playlistMatch[1], raw: input });
      return;
    }

    if (/^(PL|UU|FL|RD|OLAK5uy_)[a-zA-Z0-9_-]{10,}$/i.test(input)) {
      results.push({ type: 'playlist', id: input, raw: input });
      return;
    }

    const videoRegExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const videoMatch = input.match(videoRegExp);
    if (videoMatch && videoMatch[2].length === 11) {
      results.push({ type: 'video', id: videoMatch[2], raw: input });
      return;
    }

    if (input.length === 11 && !input.includes('/') && !input.includes('.')) {
      results.push({ type: 'video', id: input, raw: input });
      return;
    }
  });

  return results;
}

export async function fetchPlaylistItems(playlistId) {
  const endpoints = [
    `https://pipedapi.kavin.rocks/playlists/${playlistId}`,
    `https://api.piped.privacydev.net/playlists/${playlistId}`,
    `https://piped-api.lunar.icu/playlists/${playlistId}`,
    `https://pipedapi.tokhmi.xyz/playlists/${playlistId}`,
    `https://invidious.nerdvpn.de/api/v1/playlists/${playlistId}`,
    `https://inv.tux.pizza/api/v1/playlists/${playlistId}`,
    `https://invidious.privacydev.net/api/v1/playlists/${playlistId}`,
    `https://invidious.flokinet.to/api/v1/playlists/${playlistId}`,
    `https://vid.puffyan.us/api/v1/playlists/${playlistId}`
  ];

  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        // Piped response format
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
        // Invidious response format
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

  // Fallback: Embed as direct YouTube Playlist Player container
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
