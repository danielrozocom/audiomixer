// Main Orchestrator Module (ES Module Entry Point)
import { state, elements } from './js/state.js';
import { getAudioDuration, showToast } from './js/utils.js';
import { initTheme } from './js/theme.js';
import { saveAudioBlob, clearStoredAudios } from './js/db.js';
import { triggerTransitionBridge } from './js/chime.js';
import { parseYouTubeInput, fetchPlaylistItems } from './js/youtube.js';
import { setupDragItem, rebuildQueue, renderAllLists, updateCycleProgress } from './js/playlist.js';
import { togglePlayPause, playNext, playPrev, playIndex, handleTrackEnd, updateProgress, getActiveLocalPlayer } from './js/player.js';
import { exportConfigToJson, importConfigFromJson } from './js/storage.js';

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

  for (const item of parsedItems) {
    if (item.type === 'video') {
      let title = `YouTube Audio [${item.id}]`;
      try {
        const oEmbedRes = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${item.id}`);
        if (oEmbedRes.ok) {
          const d = await oEmbedRes.json();
          if (d.title) title = d.title;
        }
      } catch(e){}

      const track = {
        id: 'yt_' + Math.random().toString(36).substr(2, 9),
        title: title,
        type: category,
        source: 'youtube',
        ytId: item.id,
        duration: null
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

      videos.forEach(v => {
        const track = {
          id: 'yt_' + Math.random().toString(36).substr(2, 9),
          title: v.title,
          type: category,
          source: 'youtube',
          ytId: v.id,
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

  elements.importYtBtn.disabled = false;
  elements.importYtBtnText.textContent = "Importar Playlist / Video";
  elements.ytUrlInput.value = '';
  rebuildQueue();

  showToast(`¡Se importaron ${addedCount} elemento(s) desde YouTube a ${category === 'music' ? 'Música' : 'Anuncios'}!`, "success");
});

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

// Scrubbing (Seek bar)
elements.trackProgress.addEventListener('input', (e) => {
  const pct = parseFloat(e.target.value) / 100;
  if (state.activeSourceType === 'local') {
    const p = getActiveLocalPlayer();
    if (p.duration) p.currentTime = pct * p.duration;
  }
});

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
      elements.totalDuration.textContent = formatTime(deck.duration);
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

// Initialize Theme
initTheme();

// Initialize Lucide Icons & clean initial UI
if (window.lucide) lucide.createIcons();
renderAllLists();
