import { state, elements } from './state.js';
import { blobToBase64, base64ToBlob, showToast } from './utils.js';
import { getAudioBlob, saveAudioBlob } from './db.js';
import { rebuildQueue } from './playlist.js';

export async function exportConfigToJson() {
  showToast("Preparando exportación con datos de audio...", "info");

  const preparePoolExport = async (pool) => {
    return Promise.all(pool.map(async (item) => {
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

      return {
        id: item.id,
        title: item.title,
        type: item.type,
        source: item.source,
        audioData: audioData,
        fileName: item.fileName || (item.source === 'local' ? item.title : null),
        ytId: item.ytId || null,
        duration: item.duration || null,
      };
    }));
  };

  const exportedMusic = await preparePoolExport(state.musicPool);
  const exportedAds = await preparePoolExport(state.jinglesPool);

  const data = {
    app: 'AudioMix',
    version: '3.0',
    exportDate: new Date().toISOString(),
    settings: {
      rotationRatio: state.rotationRatio,
      crossfadeDuration: state.crossfadeDuration,
      autoDj: state.autoDj,
      volume: state.volume,
      theme: state.theme,
    },
    musicPool: exportedMusic,
    adsPool: exportedAds
  };

  const jsonStr = JSON.stringify(data);
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
            result.push({
              id: id,
              title: item.title,
              type: type,
              source: 'youtube',
              ytId: item.ytId,
              duration: item.duration || null
            });
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
