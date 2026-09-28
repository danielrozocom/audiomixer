import { state, elements } from './state.js?v=3.6';
import { blobToBase64, base64ToBlob, showToast } from './utils.js?v=3.6';
import { getAudioBlob, saveAudioBlob } from './db.js?v=3.6';
import { rebuildQueue } from './playlist.js?v=3.6';
import { fetchPlaylistItems } from './youtube.js?v=3.6';

function getAutoSyncPreference() {
  const el = document.getElementById('autoSyncPlaylists');
  const sync = el ? el.checked : false;
  localStorage.setItem('audiomix_autosync', sync ? '1' : '0');
  return sync;
}

export async function exportConfigToJson() {
  showToast("Preparando exportación con datos de audio...", "info");

  const linkPlaylists = getAutoSyncPreference();

  const preparePoolExport = async (pool) => {
    const result = [];
    const playlistVideos = {};

    for (const item of pool) {
      if (linkPlaylists && item.source === 'youtube' && item.isPlaylist && item.playlistId) {
        if (!playlistVideos[item.playlistId]) {
          const plEntry = {
            id: item.id,
            title: item.title,
            type: item.type,
            source: 'youtube',
            isPlaylist: true,
            playlistId: item.playlistId,
            _playlistRef: true
          };
          if (item.duration) plEntry.duration = item.duration;
          result.push(plEntry);
          playlistVideos[item.playlistId] = [];
        }
        if (item.ytId && item.ytId !== item.playlistId) {
          const vidEntry = {
            ytId: item.ytId,
            title: item.title
          };
          if (item.duration) vidEntry.duration = item.duration;
          playlistVideos[item.playlistId].push(vidEntry);
        }
      } else {
        let audioData = null;
        if (item.source === 'local') {
          let blob = item.blob;
          if (!blob && item.id) {
            const stored = await getAudioBlob(item.id);
            if (stored && stored.blob) blob = stored.blob;
          }
          if (!blob && item.url && item.url.startsWith('blob:')) {
            try {
              const res = await fetch(item.url);
              blob = await res.blob();
            } catch(e){}
          }
          if (blob) {
            try {
              audioData = await blobToBase64(blob);
            } catch (e) {
              console.warn("Could not encode audio to base64", e);
            }
          }
        }

        const ytUrl = item.source === 'youtube' 
          ? (item.url || `https://www.youtube.com/watch?v=${item.ytId}`)
          : null;

        const entry = {
          id: item.id,
          title: item.title,
          type: item.type,
          source: item.source,
        };
        if (audioData) entry.audioData = audioData;
        if (item.fileName) entry.fileName = item.fileName;
        if (item.ytId) entry.ytId = item.ytId;
        if (ytUrl) entry.url = ytUrl;
        if (item.duration) entry.duration = item.duration;
        result.push(entry);
      }
    }

    return { items: result, playlists: playlistVideos };
  };

  const musicExport = await preparePoolExport(state.musicPool);
  const adsExport = await preparePoolExport(state.jinglesPool);

  const allPlaylists = {};
  Object.assign(allPlaylists, musicExport.playlists);
  Object.keys(adsExport.playlists).forEach(pid => {
    if (!allPlaylists[pid]) allPlaylists[pid] = [];
    allPlaylists[pid] = allPlaylists[pid].concat(adsExport.playlists[pid]);
  });

  const hasPlaylists = Object.keys(allPlaylists).length > 0;

  const data = {
    app: 'AudioMix',
    version: '3.1',
    exportDate: new Date().toISOString(),
    settings: {
      rotationRatio: state.rotationRatio,
      crossfadeDuration: state.crossfadeDuration,
      autoDj: state.autoDj,
      volume: state.volume,
    },
    musicPool: musicExport.items,
    adsPool: adsExport.items
  };

  if (hasPlaylists) {
    data.playlists = allPlaylists;
  }

  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = months[now.getMonth()];
  const year = now.getFullYear();
  const fileName = `AudioMix_${day}_${month}_${year}.json`;

  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast(`¡Exportado como "${fileName}"!`, "success");
}

export async function importConfigFromJson(file) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      if (!imported || (!imported.musicPool && !imported.adsPool && !imported.jinglesPool)) {
        showToast("El archivo JSON no tiene un formato válido", "error");
        return;
      }

      const autoSync = getAutoSyncPreference();

      if (imported.settings) {
        if (typeof imported.settings.rotationRatio === 'number') {
          state.rotationRatio = imported.settings.rotationRatio;
          if (elements.rotationRatio) elements.rotationRatio.value = state.rotationRatio;
          if (elements.rotationValueDisplay) elements.rotationValueDisplay.textContent = `${state.rotationRatio} canciones`;
          if (elements.ratioSummary) elements.ratioSummary.textContent = `Ratio: ${state.rotationRatio}:1`;
        }
      }

      const processItems = async (items, type) => {
        if (!Array.isArray(items)) return [];
        const result = [];
        for (const item of items) {
          const id = item.id || (item.source === 'local' ? 'loc_' : 'yt_') + Math.random().toString(36).substr(2, 9);

          if (item.source === 'youtube') {
            if (item.isPlaylist && item.playlistId) {
              result.push({
                id: id,
                title: item.title,
                type: type,
                source: 'youtube',
                ytId: item.playlistId,
                url: `https://www.youtube.com/playlist?list=${item.playlistId}`,
                isPlaylist: true,
                playlistId: item.playlistId,
                duration: null
              });

              let playlistVideos = (imported.playlists && imported.playlists[item.playlistId]) || [];

              if (autoSync) {
                try {
                  showToast(`Sincronizando playlist ${item.playlistId}...`, "info");
                  const freshVideos = await fetchPlaylistItems(item.playlistId);
                  if (freshVideos && freshVideos.length > 0) {
                    playlistVideos = freshVideos
                      .filter(v => !v.isPlaylistContainer)
                      .map(v => ({ ytId: v.id, title: v.title, duration: v.duration || null }));
                  }
                } catch (syncErr) {
                  console.warn("No se pudo sincronizar playlist:", syncErr);
                }
              }

              playlistVideos.forEach(v => {
                result.push({
                  id: 'yt_' + Math.random().toString(36).substr(2, 9),
                  title: v.title || `YouTube Audio [${v.ytId}]`,
                  type: type,
                  source: 'youtube',
                  ytId: v.ytId,
                  url: `https://www.youtube.com/watch?v=${v.ytId}`,
                  isPlaylist: true,
                  playlistId: item.playlistId,
                  duration: v.duration || null
                });
              });
            } else {
              const ytId = item.ytId || (item.url ? (item.url.match(/[?&]v=([^&#]+)/) || [])[1] : null);
              const ytUrl = item.url || (ytId ? `https://www.youtube.com/watch?v=${ytId}` : null);
              result.push({
                id: id,
                title: item.title,
                type: type,
                source: 'youtube',
                ytId: ytId,
                url: ytUrl,
                duration: item.duration || null
              });
            }
          } else {
            let blob = null;
            let url = null;

            if (item.audioData) {
              blob = base64ToBlob(item.audioData);
              if (blob) {
                url = URL.createObjectURL(blob);
                await saveAudioBlob(id, blob, { title: item.title, type: type, duration: item.duration });
              }
            } else {
              const stored = await getAudioBlob(id);
              if (stored && stored.blob) {
                blob = stored.blob;
                url = URL.createObjectURL(blob);
              }
            }

            result.push({
              id: id,
              title: item.title || item.fileName || (type === 'music' ? 'Pista Local' : 'Anuncio Local'),
              fileName: item.fileName || item.title,
              type: type,
              source: 'local',
              url: url,
              blob: blob,
              isPendingLocal: !url,
              duration: item.duration || null
            });
          }
        }
        return result;
      };

      const newMusic = await processItems(imported.musicPool, 'music');
      const adsArray = imported.adsPool || imported.jinglesPool;
      const newAds = await processItems(adsArray, 'jingle');

      state.musicPool = newMusic;
      state.jinglesPool = newAds;

      state.currentIndex = -1;
      rebuildQueue();
      
      showToast(`¡JSON importado sin duplicados! (${newMusic.length} música, ${newAds.length} anuncios)`, "success");

    } catch(err) {
      console.error("JSON Import error:", err);
      showToast("Error al importar: archivo JSON inválido o dañado", "error");
    }
  };
  reader.readAsText(file);
}
