import { state, elements } from './state.js?v=4.3';
import { blobToBase64, base64ToBlob, showToast } from './utils.js?v=4.3';
import { getAudioBlob, saveAudioBlob } from './db.js?v=4.3';
import { rebuildQueue } from './playlist.js?v=4.3';
import { fetchPlaylistItems } from './youtube.js?v=4.3';

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
    const playlistVideos = {}; // mapa playlistId → [{ ytId, title, duration }] para referencia

    for (const item of pool) {
      if (item.source === 'youtube') {
        if (item.playlistId) {
          // Pista que pertenece a una playlist (individual o contenedor)
          // Exportar SIEMPRE como video individual con su ytId real
          // (NO como _playlistRef contenedor)

          if (item.ytId && item.ytId !== item.playlistId) {
            // Video individual con ytId válido — exportar SIN playlistId en el objeto
            // El vínculo a la playlist va SOLO en la sección separada "playlists"
            const entry = {
              id: item.id,
              title: item.title,
              type: item.type,
              source: 'youtube',
              ytId: item.ytId,
              url: item.url || `https://www.youtube.com/watch?v=${item.ytId}`,
              // ← NO playlistId aquí: va aparte en la sección "playlists"
            };
            if (item.duration) entry.duration = item.duration;
            result.push(entry);

            // Registrar en la sección "playlists" SEPARADA del JSON
            if (!playlistVideos[item.playlistId]) playlistVideos[item.playlistId] = [];
            const alreadyIn = playlistVideos[item.playlistId].some(v => v.ytId === item.ytId);
            if (!alreadyIn) {
              const vidEntry = { ytId: item.ytId, title: item.title };
              if (item.duration) vidEntry.duration = item.duration;
              playlistVideos[item.playlistId].push(vidEntry);
            }
          }
          // Si el ytId === playlistId (era un contenedor), omitirlo —
          // sus pistas individuales ya se expandieron en el pool

        } else {
          // Video individual sin playlist — exportar normal
          const ytUrl = item.url || `https://www.youtube.com/watch?v=${item.ytId}`;
          const entry = {
            id: item.id,
            title: item.title,
            type: item.type,
            source: item.source,
          };
          if (item.ytId) entry.ytId = item.ytId;
          if (ytUrl) entry.url = ytUrl;
          if (item.duration) entry.duration = item.duration;
          result.push(entry);
        }

      } else {
        // Audio local
        let audioData = null;
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
            console.warn('Could not encode audio to base64', e);
          }
        }

        const entry = {
          id: item.id,
          title: item.title,
          type: item.type,
          source: item.source,
        };
        if (audioData) entry.audioData = audioData;
        if (item.fileName) entry.fileName = item.fileName;
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
              // ─── PLAYLIST: expandir en pistas individuales SIEMPRE ───────────────────
              // NUNCA agregar el contenedor de playlist — causa doble reproducción porque
              // YouTube gestiona la playlist internamente (loadPlaylist) sin respetar
              // nuestra cola de rotación.

              // Paso 1: buscar videos ya embebidos en el JSON (sección "playlists")
              let playlistVideos = (imported.playlists && imported.playlists[item.playlistId]) || [];

              // Paso 2: si no hay videos en el JSON (_playlistRef o sección vacía),
              // SIEMPRE intentar obtenerlos de la API / fallbacks de YouTube
              if (playlistVideos.length === 0) {
                try {
                  showToast(`Expandiendo playlist ${item.playlistId} en pistas individuales...`, 'info');
                  const freshVideos = await fetchPlaylistItems(item.playlistId);
                  if (freshVideos && freshVideos.length > 0) {
                    playlistVideos = freshVideos
                      .filter(v => !v.isPlaylistContainer)
                      .map(v => ({ ytId: v.id, title: v.title, duration: v.duration || null }));
                  }
                } catch (syncErr) {
                  console.warn('No se pudo expandir playlist:', syncErr);
                }
              } else if (autoSync) {
                // Si ya hay videos pero autoSync activo → refrescar de todas formas
                try {
                  const freshVideos = await fetchPlaylistItems(item.playlistId);
                  if (freshVideos && freshVideos.length > 0) {
                    playlistVideos = freshVideos
                      .filter(v => !v.isPlaylistContainer)
                      .map(v => ({ ytId: v.id, title: v.title, duration: v.duration || null }));
                  }
                } catch (syncErr) {
                  console.warn('No se pudo sincronizar playlist:', syncErr);
                }
              }

              if (playlistVideos.length === 0) {
                // Sin videos accesibles: omitir y avisar
                showToast(
                  `⚠️ Playlist [${item.playlistId}] sin videos accesibles — importa sus videos individualmente`,
                  'warning'
                );
                continue;
              }

              // Agregar SOLO pistas individuales — sin campos de playlist en el objeto
              let addedCount = 0;
              playlistVideos.forEach(v => {
                if (!v.ytId) return;
                result.push({
                  id: 'yt_' + Math.random().toString(36).substr(2, 9),
                  title: v.title || `YouTube Audio [${v.ytId}]`,
                  type: type,
                  source: 'youtube',
                  ytId: v.ytId,
                  url: `https://www.youtube.com/watch?v=${v.ytId}`,
                  // ← Sin isPlaylist ni playlistId: son pistas normales individuales
                  duration: v.duration || null
                });
                addedCount++;
              });

              if (addedCount > 0) {
                showToast(`✅ ${addedCount} pistas expandidas de playlist ${item.playlistId}`, 'success');
              }

            } else {
              // ─── Video individual de YouTube ──────────────────────────────────────────
              const ytId = item.ytId || (item.url ? (item.url.match(/[?&]v=([^&#]+)/) || [])[1] : null);
              const ytUrl = item.url || (ytId ? `https://www.youtube.com/watch?v=${ytId}` : null);
              if (ytId) {
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
            }

          } else {
            // ─── Audio local ──────────────────────────────────────────────────────────
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


      const newMusic = await processItems(imported.musicPool || [], 'music');
      const adsArray = imported.adsPool || imported.jinglesPool || [];
      const newAds = await processItems(adsArray, 'jingle');

      state.musicPool = newMusic;
      state.jinglesPool = newAds;

      state.currentIndex = -1;
      rebuildQueue();
      
      // Contar pistas locales pendientes (sin audio embebido)
      const pendingLocal = [...newMusic, ...newAds].filter(t => t.isPendingLocal).length;
      const totalImported = newMusic.length + newAds.length;

      if (pendingLocal > 0) {
        showToast(`¡JSON importado! (${newMusic.length} música, ${newAds.length} anuncios) — ⚠️ ${pendingLocal} pista(s) local(es) pendiente(s): recarga sus archivos de audio`, "warning");
      } else {
        showToast(`¡JSON importado correctamente! (${newMusic.length} música, ${newAds.length} anuncios)`, "success");
      }

    } catch(err) {
      console.error("JSON Import error:", err);
      showToast("Error al importar: archivo JSON inválido o dañado — " + (err.message || err), "error");
    }
  };
  reader.readAsText(file);
}
