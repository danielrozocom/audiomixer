// Main Orchestrator Module (ES Module Entry Point)
const V = '?v=4.0';
import { state, elements } from './js/state.js?v=4.0';
import { getAudioDuration, showToast, escapeHtml, formatTime } from './js/utils.js?v=4.0';
import { initTheme } from './js/theme.js?v=4.0';
import { saveAudioBlob, clearStoredAudios } from './js/db.js?v=4.0';
import { triggerTransitionBridge } from './js/chime.js?v=4.0';
import { parseYouTubeInput, fetchPlaylistItems, fetchDurations, getYouTubeApiKey, setYouTubeApiKey } from './js/youtube.js?v=4.0';
import { setupDragItem, rebuildQueue, renderAllLists, updateCycleProgress } from './js/playlist.js?v=4.0';
import { togglePlayPause, playNext, playPrev, playIndex, handleTrackEnd, updateProgress, getActiveLocalPlayer, ytPlayer, setIsSeeking } from './js/player.js?v=4.0';
import { exportConfigToJson, importConfigFromJson } from './js/storage.js?v=4.0';

// Local Audio Uploader (Music)
elements.musicFileInput.addEventListener('change', async (e) => {
  const files = Array.from(e.target.files);
  if (files.length === 0) return;

  for (const file of files) {
    const id = 'loc_' + Math.random().toString(36).substr(2, 9);
    const url = URL.createObjectURL(file);
    const duration = await getAudioDuration(file);
    const name = file.name.replace(/\.[^/.]+$/, "");

    await saveAudioBlob(id, file, { title: name, type: 'music', duration: duration });

    state.musicPool.push({
      id: id,
      title: name,
      fileName: file.name,
      type: 'music',
      source: 'local',
      url: url,
      blob: file,
      duration: duration
    });
  }

  showToast(`Se cargaron ${files.length} pista(s) de música`, 'success');
  rebuildQueue();
  e.target.value = '';
});

// Local Audio Uploader (Ads / Jingles)
elements.jinglesFileInput.addEventListener('change', async (e) => {
  const files = Array.from(e.target.files);
  if (files.length === 0) return;

  for (const file of files) {
    const id = 'loc_' + Math.random().toString(36).substr(2, 9);
    const url = URL.createObjectURL(file);
    const duration = await getAudioDuration(file);
    const name = file.name.replace(/\.[^/.]+$/, "");

    await saveAudioBlob(id, file, { title: name, type: 'jingle', duration: duration });

    state.jinglesPool.push({
      id: id,
      title: name,
      fileName: file.name,
      type: 'jingle',
      source: 'local',
      url: url,
      blob: file,
      duration: duration
    });
  }

  showToast(`Se cargaron ${files.length} anuncio(s) publicitario(s)`, 'success');
  rebuildQueue();
  e.target.value = '';
});

// YouTube Importer
elements.importYtBtn.addEventListener('click', async () => {
  const input = elements.ytUrlInput.value.trim();
  const category = elements.ytCategorySelect.value;
  
  if (!input) {
    showToast("Por favor ingresa una URL de Video, Playlist o IDs de YouTube", "warning");
    return;
  }

  const parsedItems = parseYouTubeInput(input);
  if (parsedItems.length === 0) {
    showToast("No se reconocieron URLs o IDs válidos de YouTube", "error");
    return;
  }

  elements.importYtBtn.disabled = true;
  elements.importYtBtnText.textContent = "Procesando...";

  let addedCount = 0;

  try {
    for (const item of parsedItems) {
      if (item.type === 'video') {
        let title = `YouTube Audio [${item.id}]`;
        const ytUrl = `https://www.youtube.com/watch?v=${item.id}`;
        
        // Intentar obtener el título real mediante oEmbed
        try {
          const oembedUrls = [
            `https://noembed.com/embed?url=${encodeURIComponent(ytUrl)}`,
            `https://www.youtube.com/oembed?url=${encodeURIComponent(ytUrl)}&format=json`
          ];
          for (const endpoint of oembedUrls) {
            try {
              const res = await fetch(endpoint);
              if (res.ok) {
                const d = await res.json();
                if (d && d.title) {
                  title = d.title;
                  break;
                }
              }
            } catch (_) {}
          }
        } catch (e) {}

        let duration = null;
        try {
          const d = await fetchDurations([item.id]);
          duration = d[item.id] || null;
        } catch (_) {}

        const track = {
          id: 'yt_' + Math.random().toString(36).substr(2, 9),
          title: title,
          type: category,
          source: 'youtube',
          ytId: item.id,
          url: ytUrl,
          duration: duration
        };

        if (category === 'music') {
          state.musicPool.push(track);
        } else {
          state.jinglesPool.push(track);
        }
        addedCount++;

      } else if (item.type === 'playlist') {
        showToast("Extrayendo elementos de la Playlist de YouTube...", "info");
        const videos = await fetchPlaylistItems(item.id);

        if (!videos || videos.length === 0) {
          showToast(`No se encontraron videos en la playlist [${item.id}]`, "warning");
          continue;
        }

        videos.forEach(v => {
          const track = {
            id: 'yt_' + Math.random().toString(36).substr(2, 9),
            title: v.title,
            type: category,
            source: 'youtube',
            ytId: v.id,
            url: v.isPlaylistContainer ? `https://www.youtube.com/playlist?list=${item.id}` : `https://www.youtube.com/watch?v=${v.id}`,
            isPlaylist: v.isPlaylistContainer || false,
            playlistId: item.id,
            duration: v.duration
          };

          if (category === 'music') {
            state.musicPool.push(track);
          } else {
            state.jinglesPool.push(track);
          }
          addedCount++;
        });
      }
    }
  } catch (err) {
    console.error("Error durante la importación de YouTube:", err);
    showToast("Ocurrió un error al procesar la lista: " + (err.message || err), "error");
  } finally {
    elements.importYtBtn.disabled = false;
    elements.importYtBtnText.textContent = "Importar Playlist / Video";
  }

  if (addedCount > 0) {
    elements.ytUrlInput.value = '';
    rebuildQueue();
    // Cambiar a la pestaña correspondiente para que el usuario vea inmediatamente sus pistas
    if (category === 'music' && typeof switchTab === 'function') {
      switchTab('music');
    } else if (category === 'jingle' && typeof switchTab === 'function') {
      switchTab('jingles');
    }
    showToast(`¡Se agregaron ${addedCount} pista(s) desde YouTube a ${category === 'music' ? 'Música' : 'Anuncios'} y a la Cola!`, "success");
  } else {
    showToast("No se pudo agregar ninguna pista. Revisa la URL o ID ingresado.", "warning");
  }
});

// Refresh YouTube Playlists
const refreshPlaylistsBtn = document.getElementById('refreshPlaylistsBtn');
if (refreshPlaylistsBtn) {
  refreshPlaylistsBtn.addEventListener('click', async () => {
    const playlistItems = [];
    state.musicPool.forEach((item, idx) => {
      if (item.isPlaylist && item.playlistId) {
        playlistItems.push({ item, pool: 'music', index: idx });
      }
    });
    state.jinglesPool.forEach((item, idx) => {
      if (item.isPlaylist && item.playlistId) {
        playlistItems.push({ item, pool: 'jingle', index: idx });
      }
    });

    if (playlistItems.length === 0) {
      showToast("No hay playlists de YouTube para actualizar", "warning");
      return;
    }

    refreshPlaylistsBtn.disabled = true;
    const originalText = refreshPlaylistsBtn.innerHTML;
    refreshPlaylistsBtn.innerHTML = '<i data-lucide="refresh-cw" class="w-4 h-4 animate-spin"></i><span>Actualizando...</span>';

    let updatedCount = 0;
    const seenPlaylists = new Set();

    try {
      for (const { item, pool } of playlistItems) {
        if (seenPlaylists.has(item.playlistId)) continue;
        seenPlaylists.add(item.playlistId);

        showToast(`Actualizando playlist: ${item.playlistId}...`, "info");
        const videos = await fetchPlaylistItems(item.playlistId);

        if (!videos || videos.length === 0) continue;

        const pool = pool === 'music' ? state.musicPool : state.jinglesPool;
        const freshIds = new Set(videos.map(v => v.id));

        for (let i = pool.length - 1; i >= 0; i--) {
          const t = pool[i];
          if (t.isPlaylist && t.playlistId === item.playlistId && t.ytId && !freshIds.has(t.ytId)) {
            pool.splice(i, 1);
          }
        }

        for (const v of videos) {
          if (!v.isPlaylistContainer) continue;
          const existing = pool.find(t => t.isPlaylist && t.playlistId === item.playlistId);
          if (!existing) {
            pool.push({
              id: 'yt_' + Math.random().toString(36).substr(2, 9),
              title: v.title,
              type: pool === state.musicPool ? 'music' : 'jingle',
              source: 'youtube',
              ytId: v.id,
              url: `https://www.youtube.com/playlist?list=${item.playlistId}`,
              isPlaylist: true,
              playlistId: item.playlistId,
              duration: v.duration || null
            });
            updatedCount++;
          }
        }
        updatedCount++;
      }

      if (updatedCount > 0) {
        rebuildQueue();
        showToast(`¡Se actualizaron ${updatedCount} playlist(s) de YouTube!`, "success");
      } else {
        showToast("Las playlists ya estaban al día", "info");
      }
    } catch (err) {
      console.error("Error actualizando playlists:", err);
      showToast("Ocurrió un error al actualizar las playlists", "error");
    } finally {
      refreshPlaylistsBtn.disabled = false;
      refreshPlaylistsBtn.innerHTML = originalText;
      if (window.lucide) lucide.createIcons();
    }
  });
}

// Clear All
elements.clearAllBtn.addEventListener('click', async () => {
  if (confirm("¿Estás seguro de vaciar todas las listas y la cola de reproducción?")) {
    elements.deckA.pause();
    elements.deckB.pause();
    elements.youtubePlayerWrapper.innerHTML = '';
    elements.youtubePlayerWrapper.classList.add('hidden');
    state.musicPool = [];
    state.jinglesPool = [];
    state.queue = [];
    state.currentIndex = -1;
    await clearStoredAudios();
    renderAllLists();
    showToast("Se limpiaron todas las fuentes y la memoria local", "info");
  }
});

// Shuffle Music
elements.shuffleMusicBtn.addEventListener('click', () => {
  if (state.musicPool.length < 2) {
    showToast("Carga al menos 2 canciones para mezclar", "warning");
    return;
  }
  for (let i = state.musicPool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [state.musicPool[i], state.musicPool[j]] = [state.musicPool[j], state.musicPool[i]];
  }
  showToast("Canciones reordenadas aleatoriamente", "success");
  rebuildQueue();
});

// Rotation Ratio Slider Listener
elements.rotationRatio.addEventListener('input', (e) => {
  const val = parseInt(e.target.value, 10);
  state.rotationRatio = val;
  elements.rotationValueDisplay.textContent = `${val} ${val === 1 ? 'canción' : 'canciones'}`;
  elements.ratioSummary.textContent = `Ratio: ${val}:1`;
  rebuildQueue();
  showToast(`Rotación actualizada: 1 anuncio cada ${val} canciones`, 'info');
});

// Preview Radio Chime Button
if (elements.previewChimeBtn) {
  elements.previewChimeBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    showToast("Reproduciendo sonido de campana radial...", "info");
    await triggerTransitionBridge(true);
  });
}

// Tabs Switcher
function switchTab(tab) {
  state.activeTab = tab;
  
  const activeClass = 'px-3 py-1.5 rounded-md font-medium bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm transition';
  const inactiveClass = 'px-3 py-1.5 rounded-md font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition';

  elements.tabQueue.className = tab === 'queue' ? activeClass : inactiveClass;
  elements.tabMusic.className = tab === 'music' ? activeClass : inactiveClass;
  elements.tabJingles.className = tab === 'jingles' ? activeClass : inactiveClass;

  elements.viewQueue.classList.toggle('hidden', tab !== 'queue');
  elements.viewMusic.classList.toggle('hidden', tab !== 'music');
  elements.viewJingles.classList.toggle('hidden', tab !== 'jingles');
}

elements.tabQueue.addEventListener('click', () => switchTab('queue'));
elements.tabMusic.addEventListener('click', () => switchTab('music'));
elements.tabJingles.addEventListener('click', () => switchTab('jingles'));

// Controls bindings
elements.playPauseBtn.addEventListener('click', togglePlayPause);
elements.nextBtn.addEventListener('click', () => playNext(false));
elements.prevBtn.addEventListener('click', playPrev);

if (elements.autoPlayToggle) {
  elements.autoPlayToggle.addEventListener('click', () => {
    state.autoDj = !state.autoDj;
    if (state.autoDj) {
      showToast("Reproducción en bucle continuo activada", "info");
    } else {
      showToast("Bucle desactivado", "info");
    }
  });
}

// Scrubbing (Seek bar / Adelantar y retrasar música)
elements.trackProgress.addEventListener('mousedown', () => { setIsSeeking(true); });
elements.trackProgress.addEventListener('touchstart', () => { setIsSeeking(true); });

elements.trackProgress.addEventListener('input', (e) => {
  setIsSeeking(true);
  const pct = parseFloat(e.target.value) / 100;
  if (state.activeSourceType === 'local') {
    const p = getActiveLocalPlayer();
    if (p && p.duration) {
      p.currentTime = pct * p.duration;
      elements.currentTime.textContent = formatTime(p.currentTime);
    }
  } else if (state.activeSourceType === 'youtube' && ytPlayer && ytPlayer.getDuration && ytPlayer.seekTo) {
    try {
      const dur = ytPlayer.getDuration();
      if (dur > 0) {
        const targetTime = pct * dur;
        ytPlayer.seekTo(targetTime, true);
        elements.currentTime.textContent = formatTime(targetTime);
      }
    } catch (err) {
      console.warn("YouTube seek error:", err);
    }
  }
});

elements.trackProgress.addEventListener('change', (e) => {
  const pct = parseFloat(e.target.value) / 100;
  if (state.activeSourceType === 'local') {
    const p = getActiveLocalPlayer();
    if (p && p.duration) {
      p.currentTime = pct * p.duration;
    }
  } else if (state.activeSourceType === 'youtube' && ytPlayer && ytPlayer.getDuration && ytPlayer.seekTo) {
    try {
      const dur = ytPlayer.getDuration();
      if (dur > 0) {
        ytPlayer.seekTo(pct * dur, true);
      }
    } catch (err) {}
  }
  setIsSeeking(false);
});

elements.trackProgress.addEventListener('mouseup', () => { setIsSeeking(false); });
elements.trackProgress.addEventListener('touchend', () => { setIsSeeking(false); });

// Bind Local Deck Listeners
[elements.deckA, elements.deckB].forEach(deck => {
  deck.addEventListener('ended', handleTrackEnd);
  deck.addEventListener('timeupdate', () => {
    if (deck === getActiveLocalPlayer() && state.activeSourceType === 'local') {
      updateProgress();
    }
  });
  deck.addEventListener('loadedmetadata', () => {
    if (deck === getActiveLocalPlayer() && state.activeSourceType === 'local') {
      elements.totalDuration.textContent = typeof formatTime === 'function' ? formatTime(deck.duration) : '--:--';
    }
  });
});

// Attach JSON Import/Export listeners
document.getElementById('exportJsonBtn').addEventListener('click', exportConfigToJson);
const importInput = document.getElementById('importJsonInput');
document.getElementById('importJsonBtn').addEventListener('click', () => importInput.click());
importInput.addEventListener('change', (e) => {
  if (e.target.files && e.target.files[0]) {
    importConfigFromJson(e.target.files[0]);
    e.target.value = '';
  }
});

// Keyboard Shortcuts
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  if (e.code === 'Space') {
    e.preventDefault();
    togglePlayPause();
  } else if (e.code === 'ArrowRight' && e.ctrlKey) {
    playNext(false);
  } else if (e.code === 'ArrowLeft' && e.ctrlKey) {
    playPrev();
  }
});

// Initialize YouTube auto-sync preference
const autoSyncEl = document.getElementById('autoSyncPlaylists');
if (autoSyncEl) {
  autoSyncEl.checked = localStorage.getItem('audiomix_autosync') === '1';
}

// Initialize Theme
initTheme();

// Initialize Lucide Icons & clean initial UI
if (window.lucide) lucide.createIcons();
renderAllLists();
