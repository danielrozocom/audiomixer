// AudioMix PRO - Engine & Application Logic

// State Management
const state = {
  musicPool: [],      // Array of items: { id, title, type: 'music', source: 'local'|'youtube', url, ytId, duration }
  jinglesPool: [],    // Array of items: { id, title, type: 'jingle', source: 'local'|'youtube', url, ytId, duration }
  queue: [],          // Active combined queue
  currentIndex: -1,   // Current playing index in queue
  isPlaying: false,
  rotationRatio: 2,   // X music tracks per 1 jingle
  crossfadeDuration: 3.0, // Seconds of overlap crossfade
  isCrossfading: false,
  autoDj: true,
  volume: 0.8,
  isMuted: false,
  activeTab: 'queue',
  theme: 'dark',      // 'dark', 'light', or 'system'
  activeDeck: 'A',    // 'A' or 'B' for crossfading local audio
  draggedItemIndex: null,
  draggedItemType: null, // 'queue', 'music', or 'jingle'
};

// DOM Elements
const elements = {
  html: document.documentElement,
  themeLightBtn: document.getElementById('themeLightBtn'),
  themeDarkBtn: document.getElementById('themeDarkBtn'),
  themeSystemBtn: document.getElementById('themeSystemBtn'),

  musicFileInput: document.getElementById('musicFileInput'),
  jinglesFileInput: document.getElementById('jinglesFileInput'),
  ytUrlInput: document.getElementById('ytUrlInput'),
  ytCategorySelect: document.getElementById('ytCategorySelect'),
  importYtBtn: document.getElementById('importYtBtn'),
  importYtBtnText: document.getElementById('importYtBtnText'),
  loadDemoBtn: document.getElementById('loadDemoBtn'),
  clearAllBtn: document.getElementById('clearAllBtn'),
  
  rotationRatio: document.getElementById('rotationRatio'),
  rotationValueDisplay: document.getElementById('rotationValueDisplay'),
  crossfadeSlider: document.getElementById('crossfadeSlider'),
  crossfadeValueDisplay: document.getElementById('crossfadeValueDisplay'),
  ratioSummary: document.getElementById('ratioSummary'),
  cycleCounter: document.getElementById('cycleCounter'),
  cycleProgressBar: document.getElementById('cycleProgressBar'),
  nextScheduledTag: document.getElementById('nextScheduledTag'),
  
  musicFileCount: document.getElementById('musicFileCount'),
  jinglesFileCount: document.getElementById('jinglesFileCount'),
  totalQueueBadge: document.getElementById('totalQueueBadge'),
  totalMusicBadge: document.getElementById('totalMusicBadge'),
  totalJinglesBadge: document.getElementById('totalJinglesBadge'),
  
  playPauseBtn: document.getElementById('playPauseBtn'),
  playIcon: document.getElementById('playIcon'),
  pauseIcon: document.getElementById('pauseIcon'),
  prevBtn: document.getElementById('prevBtn'),
  nextBtn: document.getElementById('nextBtn'),
  autoPlayToggle: document.getElementById('autoPlayToggle'),
  shuffleMusicBtn: document.getElementById('shuffleMusicBtn'),
  
  trackProgress: document.getElementById('trackProgress'),
  currentTime: document.getElementById('currentTime'),
  totalDuration: document.getElementById('totalDuration'),
  volumeSlider: document.getElementById('volumeSlider'),
  volumePercent: document.getElementById('volumePercent'),
  muteBtn: document.getElementById('muteBtn'),
  volumeIcon: document.getElementById('volumeIcon'),
  
  currentTrackTitle: document.getElementById('currentTrackTitle'),
  currentTrackArtist: document.getElementById('currentTrackArtist'),
  playingBadge: document.getElementById('playingBadge'),
  sourceBadge: document.getElementById('sourceBadge'),
  playerGlow: document.getElementById('playerGlow'),
  engineStatus: document.getElementById('engineStatus'),
  enginePulseDot: document.getElementById('enginePulseDot'),
  visualizerBars: document.querySelectorAll('#visualizerContainer .bar'),
  
  tabQueue: document.getElementById('tabQueue'),
  tabMusic: document.getElementById('tabMusic'),
  tabJingles: document.getElementById('tabJingles'),
  viewQueue: document.getElementById('viewQueue'),
  viewMusic: document.getElementById('viewMusic'),
  viewJingles: document.getElementById('viewJingles'),
  queueList: document.getElementById('queueList'),
  musicList: document.getElementById('musicList'),
  jinglesList: document.getElementById('jinglesList'),
  queueEmptyState: document.getElementById('queueEmptyState'),
  musicEmptyState: document.getElementById('musicEmptyState'),
  jinglesEmptyState: document.getElementById('jinglesEmptyState'),
  
  deckA: document.getElementById('audioEngineA'),
  deckB: document.getElementById('audioEngineB'),
  youtubePlayerWrapper: document.getElementById('youtubePlayerWrapper'),
  toastContainer: document.getElementById('toastContainer'),
};

let progressTimer = null;
let visualizerTimer = null;
let crossfadeCheckTimer = null;

// Theme Management System
function applyTheme(theme) {
  state.theme = theme;
  localStorage.setItem('audiomix_theme', theme);

  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  
  if (isDark) {
    elements.html.classList.add('dark');
  } else {
    elements.html.classList.remove('dark');
  }

  // Update Button Styles
  const btnSelected = 'p-1.5 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm transition';
  const btnUnselected = 'p-1.5 rounded-md text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition';

  if (elements.themeLightBtn) elements.themeLightBtn.className = theme === 'light' ? btnSelected : btnUnselected;
  if (elements.themeDarkBtn) elements.themeDarkBtn.className = theme === 'dark' ? btnSelected : btnUnselected;
  if (elements.themeSystemBtn) elements.themeSystemBtn.className = theme === 'system' ? btnSelected : btnUnselected;
}

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (state.theme === 'system') applyTheme('system');
});

elements.themeLightBtn.addEventListener('click', () => applyTheme('light'));
elements.themeDarkBtn.addEventListener('click', () => applyTheme('dark'));
elements.themeSystemBtn.addEventListener('click', () => applyTheme('system'));

// Helper: Toast Notifications
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast-enter pointer-events-auto bg-white dark:bg-zinc-900 border ${
    type === 'success' ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-300' :
    type === 'warning' ? 'border-amber-500/40 text-amber-600 dark:text-amber-300' :
    type === 'error' ? 'border-red-500/40 text-red-600 dark:text-red-300' :
    'border-indigo-500/40 text-indigo-600 dark:text-indigo-300'
  } px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-medium`;

  const iconName = type === 'success' ? 'check-circle' :
                   type === 'warning' ? 'alert-triangle' :
                   type === 'error' ? 'alert-octagon' : 'info';

  toast.innerHTML = `
    <i data-lucide="${iconName}" class="w-4 h-4 flex-shrink-0"></i>
    <span class="text-zinc-800 dark:text-zinc-200 flex-1">${message}</span>
  `;
  elements.toastContainer.appendChild(toast);
  lucide.createIcons();

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px) scale(0.95)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

// Format Seconds to MM:SS
function formatTime(seconds) {
  if (isNaN(seconds) || seconds === Infinity || seconds === null) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// Return the active local audio player deck
function getActiveLocalPlayer() {
  return state.activeDeck === 'A' ? elements.deckA : elements.deckB;
}
function getInactiveLocalPlayer() {
  return state.activeDeck === 'A' ? elements.deckB : elements.deckA;
}

// Rebuild Interleaved Queue based on current ratio
function rebuildQueue() {
  if (state.musicPool.length === 0 && state.jinglesPool.length === 0) {
    state.queue = [];
    state.currentIndex = -1;
    renderAllLists();
    return;
  }

  const ratio = state.rotationRatio;
  const newQueue = [];
  let mIdx = 0;
  let jIdx = 0;

  const musicList = [...state.musicPool];
  const jinglesList = [...state.jinglesPool];

  if (musicList.length === 0) {
    newQueue.push(...jinglesList);
  } else if (jinglesList.length === 0) {
    newQueue.push(...musicList);
  } else {
    // Interleave music tracks with jingles: each track included exactly once
    while (mIdx < musicList.length) {
      for (let i = 0; i < ratio && mIdx < musicList.length; i++) {
        newQueue.push(musicList[mIdx]);
        mIdx++;
      }
      if (jinglesList.length > 0) {
        newQueue.push(jinglesList[jIdx % jinglesList.length]);
        jIdx++;
      }
    }
  }

  state.queue = newQueue;
  if (state.currentIndex >= state.queue.length) {
    state.currentIndex = 0;
  }
  renderAllLists();
  updateCycleProgress();
}

// ==========================================
// DRAG AND DROP HANDLERS (QUEUE & POOLS)
// ==========================================
function setupDragItem(el, index, listType) {
  el.setAttribute('draggable', 'true');
  el.classList.add('drag-item');

  el.addEventListener('dragstart', (e) => {
    state.draggedItemIndex = index;
    state.draggedItemType = listType;
    el.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index);
  });

  el.addEventListener('dragend', () => {
    el.classList.remove('dragging');
    document.querySelectorAll('.drag-over-top, .drag-over-bottom').forEach(item => {
      item.classList.remove('drag-over-top', 'drag-over-bottom');
    });
  });

  el.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const rect = el.getBoundingClientRect();
    const midPoint = rect.top + rect.height / 2;
    
    if (e.clientY < midPoint) {
      el.classList.add('drag-over-top');
      el.classList.remove('drag-over-bottom');
    } else {
      el.classList.add('drag-over-bottom');
      el.classList.remove('drag-over-top');
    }
  });

  el.addEventListener('dragleave', () => {
    el.classList.remove('drag-over-top', 'drag-over-bottom');
  });

  el.addEventListener('drop', (e) => {
    e.preventDefault();
    const rect = el.getBoundingClientRect();
    const midPoint = rect.top + rect.height / 2;
    const isBelow = e.clientY >= midPoint;

    el.classList.remove('drag-over-top', 'drag-over-bottom');
    const fromIndex = state.draggedItemIndex;
    let toIndex = index;

    if (fromIndex === null) return;

    // Calculate final insertion index taking above/below into account
    if (isBelow && fromIndex > index) {
      toIndex = index + 1;
    } else if (!isBelow && fromIndex < index) {
      toIndex = Math.max(0, index - 1);
    }

    if (fromIndex === toIndex) return;

    if (listType === 'queue' && state.draggedItemType === 'queue') {
      const [movedItem] = state.queue.splice(fromIndex, 1);
      state.queue.splice(toIndex, 0, movedItem);
      
      // Update currently playing item reference
      if (state.currentIndex === fromIndex) {
        state.currentIndex = toIndex;
      } else if (fromIndex < state.currentIndex && toIndex >= state.currentIndex) {
        state.currentIndex--;
      } else if (fromIndex > state.currentIndex && toIndex <= state.currentIndex) {
        state.currentIndex++;
      }
      renderAllLists();
      showToast(`Pista movida a la posición #${toIndex + 1}`, 'info');

    } else if (listType === 'music' && state.draggedItemType === 'music') {
      const [movedItem] = state.musicPool.splice(fromIndex, 1);
      state.musicPool.splice(toIndex, 0, movedItem);
      rebuildQueue();
      showToast("Canción reordenada en la lista de música", 'info');

    } else if (listType === 'jingles' && state.draggedItemType === 'jingles') {
      const [movedItem] = state.jinglesPool.splice(fromIndex, 1);
      state.jinglesPool.splice(toIndex, 0, movedItem);
      rebuildQueue();
      showToast("Anuncio reordenado en la lista de anuncios", 'info');
    }
  });
}

// Render Lists
function renderAllLists() {
  elements.musicFileCount.textContent = `${state.musicPool.length} archivos`;
  elements.jinglesFileCount.textContent = `${state.jinglesPool.length} archivos`;
  elements.totalMusicBadge.textContent = state.musicPool.length;
  elements.totalJinglesBadge.textContent = state.jinglesPool.length;
  elements.totalQueueBadge.textContent = state.queue.length;

  // Render Queue
  elements.queueList.innerHTML = '';
  if (state.queue.length === 0) {
    elements.queueEmptyState.classList.remove('hidden');
  } else {
    elements.queueEmptyState.classList.add('hidden');
    state.queue.forEach((item, index) => {
      const isCurrent = index === state.currentIndex;
      const isJingle = item.type === 'jingle';
      const el = document.createElement('div');
      el.className = `flex items-center justify-between p-2.5 rounded-lg border text-xs transition ${
        isCurrent
          ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-500/50 text-indigo-950 dark:text-indigo-100 shadow-sm'
          : 'bg-zinc-50 dark:bg-zinc-900/40 border-zinc-200 dark:border-dark-border hover:bg-zinc-100 dark:hover:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300'
      }`;
      
      el.innerHTML = `
        <div class="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer" onclick="playIndex(${index})">
          <span class="text-zinc-400 hover:text-zinc-600 p-0.5 cursor-grab">
            <i data-lucide="grip-vertical" class="w-3.5 h-3.5"></i>
          </span>
          <span class="font-mono text-[11px] w-5 text-zinc-400 font-semibold">${index + 1}</span>
          <span class="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium uppercase border ${
            isJingle
              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
              : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30'
          }">${isJingle ? 'Anuncio' : 'Música'}</span>
          <div class="truncate flex-1">
            <p class="font-medium truncate ${isCurrent ? 'text-indigo-600 dark:text-indigo-200 font-bold' : 'text-zinc-800 dark:text-zinc-200'}">${item.title}</p>
            <span class="text-[10px] text-zinc-400 capitalize">${item.source} ${item.duration ? '• ' + formatTime(item.duration) : ''}</span>
          </div>
        </div>
        <div class="flex items-center gap-2 pl-2">
          ${isCurrent && state.isPlaying ? '<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>' : ''}
          <button onclick="removeItemFromQueue(${index}, event)" class="text-zinc-400 hover:text-red-500 p-1">
            <i data-lucide="x" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      `;
      setupDragItem(el, index, 'queue');
      elements.queueList.appendChild(el);
    });
  }

  // Render Music Pool
  elements.musicList.innerHTML = '';
  if (state.musicPool.length === 0) {
    elements.musicEmptyState.classList.remove('hidden');
  } else {
    elements.musicEmptyState.classList.add('hidden');
    state.musicPool.forEach((item, index) => {
      const el = document.createElement('div');
      el.className = 'flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-dark-border text-xs';
      el.innerHTML = `
        <div class="flex items-center gap-2 truncate flex-1">
          <i data-lucide="grip-vertical" class="w-3.5 h-3.5 text-zinc-400"></i>
          <div class="truncate flex-1">
            <p class="font-medium text-zinc-800 dark:text-zinc-200 truncate">${item.title}</p>
            <span class="text-[10px] text-zinc-400 capitalize">${item.source}</span>
          </div>
        </div>
        <button onclick="removePoolItem('music', ${index})" class="text-zinc-400 hover:text-red-500 p-1">
          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
        </button>
      `;
      setupDragItem(el, index, 'music');
      elements.musicList.appendChild(el);
    });
  }

  // Render Ads Pool
  elements.jinglesList.innerHTML = '';
  if (state.jinglesPool.length === 0) {
    elements.jinglesEmptyState.classList.remove('hidden');
  } else {
    elements.jinglesEmptyState.classList.add('hidden');
    state.jinglesPool.forEach((item, index) => {
      const el = document.createElement('div');
      el.className = 'flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-dark-border text-xs';
      el.innerHTML = `
        <div class="flex items-center gap-2 truncate flex-1">
          <i data-lucide="grip-vertical" class="w-3.5 h-3.5 text-zinc-400"></i>
          <div class="truncate flex-1">
            <p class="font-medium text-amber-700 dark:text-amber-200 truncate">${item.title}</p>
            <span class="text-[10px] text-zinc-400 capitalize">${item.source}</span>
          </div>
        </div>
        <button onclick="removePoolItem('jingle', ${index})" class="text-zinc-400 hover:text-red-500 p-1">
          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
        </button>
      `;
      setupDragItem(el, index, 'jingles');
  elements.jinglesList.appendChild(el);
    });
  }

  lucide.createIcons();
}

// YouTube IFrame Player Instance & Ready state
let ytPlayer = null;
let ytReady = false;

window.onYouTubeIframeAPIReady = function() {
  ytReady = true;
};

// ==========================================
// PROFESSIONAL DUAL-DECK CROSSFADE ENGINE
// ==========================================
window.playIndex = function(index, isCrossfadeTransition = false) {
  if (index < 0 || index >= state.queue.length) return;
  state.currentIndex = index;
  const track = state.queue[index];

  // Update Track Info UI
  elements.currentTrackTitle.textContent = track.title;
  elements.currentTrackArtist.textContent = track.type === 'jingle' ? 'Anuncio publicitario / Spot' : 'Pista Musical';
  
  const isJingle = track.type === 'jingle';
  elements.playingBadge.className = `inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
    isJingle ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30' : 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30'
  }`;
  elements.playingBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full ${isJingle ? 'bg-amber-500' : 'bg-blue-500'} animate-ping"></span> ${isJingle ? 'ANUNCIO AL AIRE' : 'EN VIVO'}`;
  
  elements.sourceBadge.textContent = track.source === 'youtube' ? 'YouTube Audio' : 'Audio Local (Deck ' + (state.activeDeck === 'A' ? (isCrossfadeTransition ? 'B' : 'A') : (isCrossfadeTransition ? 'A' : 'B')) + ')';
  elements.playerGlow.className = `absolute -top-16 -left-16 w-48 h-48 rounded-full blur-3xl pointer-events-none transition-colors duration-500 ${
    isJingle ? 'bg-amber-500/20' : 'bg-indigo-600/20'
  }`;

  // Handle Engine Switch
  if (track.source === 'local') {
    state.activeSourceType = 'local';
    elements.youtubePlayerWrapper.classList.add('hidden');
    if (ytPlayer && ytPlayer.pauseVideo) {
      try { ytPlayer.pauseVideo(); } catch(e){}
    }

    if (!track.url) {
      showToast(`Pista local "${track.title}" pendiente. Carga el archivo desde el panel izquierdo para vincularla.`, "warning");
      setPlayingUI(false);
      return;
    }

    if (isCrossfadeTransition && state.crossfadeDuration > 0) {
      const outgoingPlayer = getActiveLocalPlayer();
      state.activeDeck = state.activeDeck === 'A' ? 'B' : 'A';
      const incomingPlayer = getActiveLocalPlayer();

      incomingPlayer.src = track.url;
      incomingPlayer.volume = 0;
      incomingPlayer.play().then(() => {
        setPlayingUI(true);
        startVisualizer();
        executeHarmonicCrossfade(outgoingPlayer, incomingPlayer, state.crossfadeDuration);
      }).catch(err => {
        console.error("Crossfade play error:", err);
        incomingPlayer.volume = state.isMuted ? 0 : state.volume;
      });

    } else {
      const currentPlayer = getActiveLocalPlayer();
      const otherPlayer = getInactiveLocalPlayer();
      otherPlayer.pause();

      currentPlayer.src = track.url;
      currentPlayer.volume = state.isMuted ? 0 : state.volume;
      currentPlayer.play().then(() => {
        setPlayingUI(true);
        startVisualizer();
      }).catch(err => {
        console.error("Local play error:", err);
        showToast("Error reproduciendo audio local", "error");
      });
    }

  } else if (track.source === 'youtube') {
    const previousSourceType = state.activeSourceType;
    state.activeSourceType = 'youtube';
    
    // If we are crossfading from local audio to YouTube
    if (isCrossfadeTransition && previousSourceType === 'local' && state.crossfadeDuration > 0) {
      const outgoingLocal = getActiveLocalPlayer();
      fadeOutLocalHarmonic(outgoingLocal, state.crossfadeDuration);
    } else {
      elements.deckA.pause();
      elements.deckB.pause();
    }

    elements.youtubePlayerWrapper.classList.remove('hidden');

    const ytExternalLink = document.getElementById('ytExternalLink');
    if (ytExternalLink) {
      ytExternalLink.classList.remove('hidden');
      ytExternalLink.href = track.isPlaylist && track.playlistId
        ? `https://www.youtube.com/playlist?list=${track.playlistId}`
        : `https://www.youtube.com/watch?v=${track.ytId}`;
    }

    const initOrLoadYt = () => {
      if (!ytPlayer || !ytPlayer.loadVideoById) {
        // Create YT Player
        ytPlayer = new YT.Player('ytPlayerDiv', {
          height: '100%',
          width: '100%',
          videoId: track.isPlaylist ? undefined : track.ytId,
          playerVars: {
            autoplay: 1,
            controls: 1,
            rel: 0,
            playsinline: 1,
            listType: track.isPlaylist ? 'playlist' : undefined,
            list: track.isPlaylist ? track.playlistId : undefined,
          },
          events: {
            onReady: (event) => {
              ytReady = true;
              const targetVol = state.isMuted ? 0 : state.volume * 100;
              if (isCrossfadeTransition && state.crossfadeDuration > 0) {
                fadeInYtHarmonic(event.target, targetVol, state.crossfadeDuration);
              } else {
                event.target.setVolume(targetVol);
              }
              event.target.playVideo();
            },
            onStateChange: (event) => {
              if (event.data === YT.PlayerState.PLAYING) {
                setPlayingUI(true);
                startVisualizer();
              } else if (event.data === YT.PlayerState.PAUSED) {
                setPlayingUI(false);
              } else if (event.data === YT.PlayerState.ENDED) {
                if (state.autoDj) playNext(false);
              }
            },
            onError: (err) => {
              console.warn("YouTube player error:", err);
            }
          }
        });
      } else {
        // Player already exists, load video with harmonic fade in
        const targetVol = state.isMuted ? 0 : state.volume * 100;
        if (isCrossfadeTransition && state.crossfadeDuration > 0) {
          fadeInYtHarmonic(ytPlayer, targetVol, state.crossfadeDuration);
        } else {
          ytPlayer.setVolume(targetVol);
        }

        if (track.isPlaylist && track.playlistId) {
          ytPlayer.loadPlaylist({ list: track.playlistId, listType: 'playlist' });
        } else {
          ytPlayer.loadVideoById(track.ytId);
        }
        ytPlayer.playVideo();
      }
    };

    if (window.YT && window.YT.Player) {
      initOrLoadYt();
    } else {
      setTimeout(initOrLoadYt, 300);
    }

    setPlayingUI(true);
    startVisualizer();
  }

  state.isCrossfading = false;
  updateCycleProgress();
  renderAllLists();
  startProgressTracking();
};

// ==========================================
// PROFESSIONAL S-CURVE (SMOOTHSTEP) HARMONIC CROSSFADE ENGINE
// 60FPS Continuous Audio Interpolation for Silky Smooth Radio Transitions
// ==========================================
function executeHarmonicCrossfade(outgoing, incoming, durationSec) {
  state.isCrossfading = true;
  const targetVolume = state.isMuted ? 0 : state.volume;
  
  // High frequency 20ms steps (~50-60 fps for audio volume interpolation)
  const intervalMs = 20;
  const totalSteps = Math.max(1, Math.round((durationSec * 1000) / intervalMs));
  let step = 0;

  incoming.volume = 0;

  const fadeTimer = setInterval(() => {
    step++;
    const t = Math.min(1, step / totalSteps);
    
    // Smoothstep S-Curve: 3t^2 - 2t^3 for organic radio DJ bridge
    const smoothT = t * t * (3 - 2 * t);
    
    // Equal power sinusoidal blended with smoothstep
    const inGain = Math.sin(smoothT * (Math.PI / 2));
    const outGain = Math.cos(smoothT * (Math.PI / 2));

    try {
      incoming.volume = Math.max(0, Math.min(1, targetVolume * inGain));
      outgoing.volume = Math.max(0, Math.min(1, targetVolume * outGain));
    } catch(e){}

    if (step >= totalSteps) {
      clearInterval(fadeTimer);
      try {
        outgoing.pause();
        outgoing.currentTime = 0;
        outgoing.volume = targetVolume;
        incoming.volume = targetVolume;
      } catch(e){}
      state.isCrossfading = false;
    }
  }, intervalMs);
}

// Harmonic Fade-Out for Local Audio Deck
function fadeOutLocalHarmonic(player, durationSec) {
  const initialVol = player.volume;
  const intervalMs = 20;
  const totalSteps = Math.max(1, Math.round((durationSec * 1000) / intervalMs));
  let step = 0;

  const fadeTimer = setInterval(() => {
    step++;
    const t = Math.min(1, step / totalSteps);
    const smoothT = t * t * (3 - 2 * t);
    const outGain = Math.cos(smoothT * (Math.PI / 2));
    
    try {
      player.volume = Math.max(0, initialVol * outGain);
    } catch(e){}

    if (step >= totalSteps) {
      clearInterval(fadeTimer);
      try {
        player.pause();
        player.currentTime = 0;
        player.volume = state.isMuted ? 0 : state.volume;
      } catch(e){}
    }
  }, intervalMs);
}

// Harmonic Fade-In for YouTube Player
function fadeInYtHarmonic(player, targetVol, durationSec) {
  if (!player || !player.setVolume) return;
  try { player.setVolume(0); } catch(e){}
  
  const intervalMs = 50;
  const totalSteps = Math.max(1, (durationSec * 1000) / intervalMs);
  let step = 0;

  const fadeTimer = setInterval(() => {
    step++;
    const progress = Math.min(1, step / totalSteps);
    const inGain = Math.sin(progress * (Math.PI / 2));
    const curVol = Math.round(targetVol * inGain);
    try {
      player.setVolume(curVol);
    } catch(e){}

    if (step >= totalSteps) {
      clearInterval(fadeTimer);
      try { player.setVolume(targetVol); } catch(e){}
    }
  }, intervalMs);
}

function setPlayingUI(playing) {
  state.isPlaying = playing;
  if (playing) {
    elements.playIcon.classList.add('hidden');
    elements.pauseIcon.classList.remove('hidden');
    if (elements.engineStatus) {
      elements.engineStatus.textContent = 'Transmitiendo';
      elements.engineStatus.className = 'text-emerald-500 dark:text-emerald-400 font-mono font-medium';
    }
    if (elements.enginePulseDot) {
      elements.enginePulseDot.className = 'inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse';
    }
  } else {
    elements.playIcon.classList.remove('hidden');
    elements.pauseIcon.classList.add('hidden');
    if (elements.engineStatus) {
      elements.engineStatus.textContent = 'Pausado';
      elements.engineStatus.className = 'text-amber-500 dark:text-amber-400 font-mono font-medium';
    }
    if (elements.enginePulseDot) {
      elements.enginePulseDot.className = 'inline-block w-2 h-2 rounded-full bg-amber-500';
    }
    stopVisualizer();
  }
}

function togglePlayPause() {
  if (state.queue.length === 0) {
    showToast("Carga pistas o pulsa 'Demo' para comenzar", "warning");
    return;
  }

  if (state.currentIndex === -1) {
    playIndex(0);
    return;
  }

  if (state.isPlaying) {
    if (state.activeSourceType === 'local') {
      getActiveLocalPlayer().pause();
    } else if (state.activeSourceType === 'youtube' && ytPlayer && ytPlayer.pauseVideo) {
      try { ytPlayer.pauseVideo(); } catch(e){}
    }
    setPlayingUI(false);
  } else {
    if (state.activeSourceType === 'local') {
      getActiveLocalPlayer().play();
    } else if (state.activeSourceType === 'youtube' && ytPlayer && ytPlayer.playVideo) {
      try { ytPlayer.playVideo(); } catch(e){}
    }
    setPlayingUI(true);
    startVisualizer();
  }
}

function playNext(useCrossfade = false) {
  if (state.queue.length === 0) return;
  let nextIdx = state.currentIndex + 1;
  if (nextIdx >= state.queue.length) {
    if (state.autoDj) {
      nextIdx = 0;
      showToast("Reiniciando ciclo de reproducción", "info");
    } else {
      setPlayingUI(false);
      showToast("Fin de la lista de reproducción", "info");
      return;
    }
  }
  playIndex(nextIdx, useCrossfade);
}

function playPrev() {
  if (state.queue.length === 0) return;
  let prevIdx = state.currentIndex - 1;
  if (prevIdx < 0) prevIdx = state.queue.length - 1;
  playIndex(prevIdx, false);
}

function handleTrackEnd() {
  if (state.autoDj) {
    playNext(false);
  } else {
    setPlayingUI(false);
  }
}

// Bind Local Deck Listeners
[elements.deckA, elements.deckB].forEach(deck => {
  deck.addEventListener('ended', handleTrackEnd);
  deck.addEventListener('timeupdate', () => {
    if (deck === getActiveLocalPlayer() && state.activeSourceType === 'local') {
      updateProgress();
      checkAutoCrossfade(deck);
    }
  });
  deck.addEventListener('loadedmetadata', () => {
    if (deck === getActiveLocalPlayer() && state.activeSourceType === 'local') {
      elements.totalDuration.textContent = formatTime(deck.duration);
    }
  });
});

// Check when current track is close to end to trigger crossfade transition
function checkAutoCrossfade(player) {
  if (!state.autoDj || state.isCrossfading || state.crossfadeDuration <= 0) return;
  if (!player.duration || player.duration < state.crossfadeDuration * 2) return;

  const timeLeft = player.duration - player.currentTime;
  if (timeLeft <= state.crossfadeDuration && timeLeft > 0.3) {
    playNext(true); // Trigger smooth crossfade transition!
  }
}

// Check auto-crossfade for YouTube
function checkYtCrossfade(currentTime, duration) {
  if (!state.autoDj || state.isCrossfading || state.crossfadeDuration <= 0) return;
  if (!duration || duration < state.crossfadeDuration * 2) return;

  const timeLeft = duration - currentTime;
  if (timeLeft <= state.crossfadeDuration && timeLeft > 0.4) {
    playNext(true);
  }
}

function startProgressTracking() {
  if (progressTimer) clearInterval(progressTimer);
  progressTimer = setInterval(() => {
    if (state.activeSourceType === 'youtube' && ytPlayer && ytPlayer.getCurrentTime && ytPlayer.getDuration) {
      try {
        const cur = ytPlayer.getCurrentTime() || 0;
        const dur = ytPlayer.getDuration() || 1;
        if (dur > 0) {
          elements.currentTime.textContent = formatTime(cur);
          elements.totalDuration.textContent = formatTime(dur);
          elements.trackProgress.value = (cur / dur) * 100;
          checkYtCrossfade(cur, dur);
        }
      } catch(e){}
    }
  }, 350);
}

function updateProgress() {
  if (state.activeSourceType === 'local') {
    const p = getActiveLocalPlayer();
    const cur = p.currentTime || 0;
    const dur = p.duration || 1;
    elements.currentTime.textContent = formatTime(cur);
    elements.totalDuration.textContent = formatTime(dur);
    elements.trackProgress.value = (cur / dur) * 100;
  }
}

// Scrubbing (Seek bar)
elements.trackProgress.addEventListener('input', (e) => {
  const pct = parseFloat(e.target.value) / 100;
  if (state.activeSourceType === 'local') {
    const p = getActiveLocalPlayer();
    if (p.duration) p.currentTime = pct * p.duration;
  } else if (state.activeSourceType === 'youtube' && ytPlayer && ytPlayer.seekTo && ytPlayer.getDuration) {
    try {
      const dur = ytPlayer.getDuration() || 0;
      ytPlayer.seekTo(pct * dur, true);
    } catch(e){}
  }
});

// Volume Slider & Mute
function setVolume(val) {
  state.volume = val;
  elements.volumePercent.textContent = `${Math.round(val * 100)}%`;
  if (state.activeSourceType === 'local') {
    if (!state.isCrossfading) {
      elements.deckA.volume = state.isMuted ? 0 : val;
      elements.deckB.volume = state.isMuted ? 0 : val;
    }
  } else if (state.activeSourceType === 'youtube' && ytPlayer && ytPlayer.setVolume) {
    try {
      ytPlayer.setVolume(state.isMuted ? 0 : val * 100);
    } catch(e){}
  }
}

elements.volumeSlider.addEventListener('input', (e) => {
  state.isMuted = false;
  setVolume(parseFloat(e.target.value));
});

elements.muteBtn.addEventListener('click', () => {
  state.isMuted = !state.isMuted;
  if (state.isMuted) {
    elements.volumeIcon.setAttribute('data-lucide', 'volume-x');
    setVolume(state.volume);
  } else {
    elements.volumeIcon.setAttribute('data-lucide', 'volume-2');
    setVolume(state.volume);
  }
  lucide.createIcons();
});

// Rotation / Cycle Indicator
function updateCycleProgress() {
  if (state.queue.length === 0 || state.currentIndex === -1) {
    elements.cycleCounter.textContent = `0 / ${state.rotationRatio} pistas`;
    elements.cycleProgressBar.style.width = '0%';
    elements.nextScheduledTag.innerHTML = `<i data-lucide="arrow-right-circle" class="w-3.5 h-3.5 text-zinc-400"></i> Próximo tipo en turno: <span class="text-blue-500 font-medium">Música</span>`;
    lucide.createIcons();
    return;
  }

  const nextTrack = state.queue[(state.currentIndex + 1) % state.queue.length];
  const isNextJingle = nextTrack && nextTrack.type === 'jingle';
  
  const stepInCycle = (state.currentIndex % (state.rotationRatio + 1)) + 1;
  const pct = Math.min(100, (stepInCycle / (state.rotationRatio + 1)) * 100);

  elements.cycleProgressBar.style.width = `${pct}%`;
  elements.cycleCounter.textContent = `Paso ${stepInCycle} de ${state.rotationRatio + 1}`;
  elements.nextScheduledTag.innerHTML = `
    <i data-lucide="arrow-right-circle" class="w-3.5 h-3.5 text-zinc-400"></i> Siguiente en turno: 
    <span class="${isNextJingle ? 'text-amber-500 font-bold' : 'text-blue-500 font-bold'}">${isNextJingle ? 'Anuncio Publicitario' : 'Canción Musical'}</span>
  `;
  lucide.createIcons();
}

// Visualizer effect simulation
function startVisualizer() {
  if (visualizerTimer) clearInterval(visualizerTimer);
  visualizerTimer = setInterval(() => {
    elements.visualizerBars.forEach(bar => {
      const h = Math.floor(Math.random() * 16) + 4;
      bar.style.height = `${h}px`;
    });
  }, 90);
}

function stopVisualizer() {
  if (visualizerTimer) clearInterval(visualizerTimer);
  elements.visualizerBars.forEach(bar => {
    bar.style.height = '4px';
  });
}

// ==========================================
// INDEXED-DB PERSISTENCE ENGINE
// ==========================================
const DB_NAME = 'AudioMixPRO_DB';
const DB_VERSION = 1;
const STORE_NAME = 'audio_files';

function openAudioDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

async function saveAudioBlob(id, blob, metadata = {}) {
  try {
    const db = await openAudioDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const record = {
        id,
        blob,
        title: metadata.title || '',
        fileName: metadata.fileName || '',
        type: metadata.type || 'music',
        updatedAt: Date.now()
      };
      store.put(record);
      tx.oncomplete = () => resolve(true);
      tx.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.warn("Error saving audio to IndexedDB:", err);
  }
}

async function getAudioBlob(id) {
  try {
    const db = await openAudioDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.warn("Error getting audio from IndexedDB:", err);
    return null;
  }
}

async function getAllStoredAudios() {
  try {
    const db = await openAudioDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.warn("Error getting all audios from IndexedDB:", err);
    return [];
  }
}

async function deleteStoredAudio(id) {
  try {
    const db = await openAudioDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.warn("Error deleting audio from IndexedDB:", err);
  }
}

async function clearStoredAudios() {
  try {
    const db = await openAudioDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      tx.oncomplete = () => resolve(true);
      tx.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.warn("Error clearing IndexedDB:", err);
  }
}

// Convert Blob/File to Base64 data URL
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Convert Base64 data URL to Blob
function base64ToBlob(base64Data, defaultType = 'audio/mpeg') {
  try {
    const parts = base64Data.split(';base64,');
    if (parts.length === 2) {
      const contentType = parts[0].replace('data:', '') || defaultType;
      const byteCharacters = atob(parts[1]);
      const byteArrays = [];
      for (let offset = 0; offset < byteCharacters.length; offset += 512) {
        const slice = byteCharacters.slice(offset, offset + 512);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
          byteNumbers[i] = slice.charCodeAt(i);
        }
        byteArrays.push(new Uint8Array(byteNumbers));
      }
      return new Blob(byteArrays, { type: contentType });
    }
  } catch(e) {
    console.warn("Error converting base64 to blob:", e);
  }
  return null;
}

// File Upload Handlers (URL.createObjectURL + IndexedDB)
elements.musicFileInput.addEventListener('change', async (e) => {
  const files = Array.from(e.target.files);
  if (files.length === 0) return;

  for (const file of files) {
    const url = URL.createObjectURL(file);
    const name = file.name.replace(/\.[^/.]+$/, "");
    const id = 'm_' + Math.random().toString(36).substr(2, 9);
    
    // Save to IndexedDB
    await saveAudioBlob(id, file, { title: name, fileName: file.name, type: 'music' });

    state.musicPool.push({
      id: id,
      title: name,
      fileName: file.name,
      type: 'music',
      source: 'local',
      url: url,
      blob: file,
      duration: null
    });
  }

  showToast(`Se cargaron y guardaron ${files.length} pista(s) de música`, 'success');
  rebuildQueue();
  e.target.value = '';
});

elements.jinglesFileInput.addEventListener('change', async (e) => {
  const files = Array.from(e.target.files);
  if (files.length === 0) return;

  for (const file of files) {
    const url = URL.createObjectURL(file);
    const name = file.name.replace(/\.[^/.]+$/, "");
    const id = 'j_' + Math.random().toString(36).substr(2, 9);
    
    // Save to IndexedDB
    await saveAudioBlob(id, file, { title: name, fileName: file.name, type: 'jingle' });

    state.jinglesPool.push({
      id: id,
      title: name,
      fileName: file.name,
      type: 'jingle',
      source: 'local',
      url: url,
      blob: file,
      duration: null
    });
  }

  showToast(`Se cargaron y guardaron ${files.length} anuncio(s) publicitario(s)`, 'success');
  rebuildQueue();
  e.target.value = '';
});

// YouTube Parser & Playlist Extractor helper
function parseYouTubeInput(rawText) {
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

async function fetchPlaylistItems(playlistId) {
  try {
    const endpoints = [
      `https://invidious.privacydev.net/api/v1/playlists/${playlistId}`,
      `https://inv.tux.pizza/api/v1/playlists/${playlistId}`,
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
          if (data && data.videos && data.videos.length > 0) {
            return data.videos.map(v => ({
              id: v.videoId,
              title: v.title || `YouTube Audio [${v.videoId}]`,
              duration: v.lengthSeconds || null
            }));
          }
        }
      } catch(e) {}
    }
  } catch(err) {
    console.warn("Direct playlist scrape fallback", err);
  }

  return [{
    id: playlistId,
    isPlaylistContainer: true,
    title: `YouTube Playlist [${playlistId.substring(0, 12)}...]`,
    duration: null
  }];
}

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
    setPlayingUI(false);
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

// Remove single item from queue
window.removeItemFromQueue = function(index, e) {
  if (e) e.stopPropagation();
  if (index === state.currentIndex) {
    playNext(false);
  }
  state.queue.splice(index, 1);
  if (state.currentIndex > index) state.currentIndex--;
  renderAllLists();
  updateCycleProgress();
};

// Remove item from pool
window.removePoolItem = async function(type, index) {
  if (type === 'music') {
    const [removed] = state.musicPool.splice(index, 1);
    if (removed && removed.id) await deleteStoredAudio(removed.id);
  } else {
    const [removed] = state.jinglesPool.splice(index, 1);
    if (removed && removed.id) await deleteStoredAudio(removed.id);
  }
  rebuildQueue();
};

// Rotation Ratio Slider Listener
elements.rotationRatio.addEventListener('input', (e) => {
  const val = parseInt(e.target.value, 10);
  state.rotationRatio = val;
  elements.rotationValueDisplay.textContent = `${val} ${val === 1 ? 'canción' : 'canciones'}`;
  elements.ratioSummary.textContent = `Ratio: ${val}:1`;
  rebuildQueue();
  showToast(`Rotación actualizada: 1 anuncio cada ${val} canciones`, 'info');
});

// Crossfade Slider Listener
elements.crossfadeSlider.addEventListener('input', (e) => {
  const val = parseFloat(e.target.value);
  state.crossfadeDuration = val;
  elements.crossfadeValueDisplay.textContent = `${val.toFixed(1)} seg`;
});

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

elements.autoPlayToggle.addEventListener('click', () => {
  state.autoDj = !state.autoDj;
  if (state.autoDj) {
    elements.autoPlayToggle.className = 'ml-2 text-xs px-2.5 py-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 flex items-center gap-1.5 transition';
    showToast("Modo Auto-DJ habilitado", "info");
  } else {
    elements.autoPlayToggle.className = 'ml-2 text-xs px-2.5 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 transition';
    showToast("Modo Auto-DJ deshabilitado (se detendrá al acabar)", "info");
  }
});

// ==========================================
// JSON EXPORT & IMPORT SYSTEM (WITH FULL AUDIO DATA)
// ==========================================
async function exportConfigToJson() {
  showToast("Preparando exportación con datos de audio...", "info");

  // Helper to convert pool item to export format with audioData if local
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
    app: 'AudioMix PRO',
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
  const a = document.createElement('a');
  const timestamp = new Date().toISOString().slice(0,10);
  a.href = url;
  a.download = `audiomix_completo_${timestamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast("¡Configuración y audios exportados exitosamente a JSON!", "success");
}

async function importConfigFromJson(file) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      showToast("Importando y procesando archivo...", "info");
      const imported = JSON.parse(e.target.result);
      if (!imported || (!imported.musicPool && !imported.adsPool && !imported.jinglesPool && !imported.settings)) {
        throw new Error("Estructura de archivo JSON no válida");
      }

      if (imported.settings) {
        if (imported.settings.rotationRatio) {
          state.rotationRatio = imported.settings.rotationRatio;
          elements.rotationRatio.value = state.rotationRatio;
          elements.rotationValueDisplay.textContent = `${state.rotationRatio} ${state.rotationRatio === 1 ? 'canción' : 'canciones'}`;
          elements.ratioSummary.textContent = `Ratio: ${state.rotationRatio}:1`;
        }
        if (imported.settings.crossfadeDuration !== undefined) {
          state.crossfadeDuration = imported.settings.crossfadeDuration;
          elements.crossfadeSlider.value = state.crossfadeDuration;
          elements.crossfadeValueDisplay.textContent = `${state.crossfadeDuration.toFixed(1)} seg`;
        }
        if (imported.settings.theme) {
          applyTheme(imported.settings.theme);
        }
      }

      let restoredLocalCount = 0;

      // Helper to process and restore items with strict deduplication
      const processItems = async (items, defaultType) => {
        if (!Array.isArray(items)) return [];
        const result = [];
        const seenYt = new Set();
        const seenTitles = new Set();

        for (const item of items) {
          const type = item.type || defaultType;
          if (item.source === 'youtube' && item.ytId) {
            if (seenYt.has(item.ytId)) continue; // Skip duplicate YouTube videos
            seenYt.add(item.ytId);

            result.push({
              id: item.id || ('yt_' + Math.random().toString(36).substr(2, 9)),
              title: item.title || `YouTube Audio [${item.ytId}]`,
              type: type,
              source: 'youtube',
              ytId: item.ytId,
              duration: item.duration || null
            });
          } else {
            // Local track
            const normalizedTitle = (item.title || item.fileName || '').trim().toLowerCase();
            if (normalizedTitle && seenTitles.has(normalizedTitle)) continue; // Skip duplicate local tracks
            if (normalizedTitle) seenTitles.add(normalizedTitle);

            const id = item.id || ((type === 'music' ? 'm_' : 'j_') + Math.random().toString(36).substr(2, 9));
            let blob = null;
            let url = null;

            if (item.audioData && item.audioData.startsWith('data:')) {
              blob = base64ToBlob(item.audioData);
            }

            // Check if already in IndexedDB if no embedded data
            if (!blob && item.id) {
              const stored = await getAudioBlob(item.id);
              if (stored && stored.blob) {
                blob = stored.blob;
              }
            }

            if (blob) {
              await saveAudioBlob(id, blob, {
                title: item.title || item.fileName || 'Pista Local',
                fileName: item.fileName || item.title || 'audio.mp3',
                type: type
              });
              url = URL.createObjectURL(blob);
              restoredLocalCount++;
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

      // Set pools cleanly with imported data (preventing duplicates)
      state.musicPool = newMusic;
      state.jinglesPool = newAds;

      // Rebuild queue from fresh imported pools
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

// Initialize Saved Theme or default
const savedTheme = localStorage.getItem('audiomix_theme') || 'dark';
applyTheme(savedTheme);

// Initialize Lucide Icons & clean initial UI (empty until JSON or files are loaded)
lucide.createIcons();
renderAllLists();



