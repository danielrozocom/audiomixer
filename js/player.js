import { state, elements } from './state.js';
import { formatTime, showToast } from './utils.js';
import { triggerTransitionBridge } from './chime.js';
import { renderAllLists, updateCycleProgress } from './playlist.js';

export let ytPlayer = null;
export let ytReady = false;
let progressTimer = null;
let visualizerTimer = null;

window.onYouTubeIframeAPIReady = function() {
  ytReady = true;
};

export function getActiveLocalPlayer() {
  return state.activeDeck === 'A' ? elements.deckA : elements.deckB;
}
export function getInactiveLocalPlayer() {
  return state.activeDeck === 'A' ? elements.deckB : elements.deckA;
}

export function setPlayingUI(playing) {
  state.isPlaying = playing;
  const currentTrack = state.currentIndex >= 0 && state.queue[state.currentIndex] ? state.queue[state.currentIndex] : null;
  const isJingle = currentTrack && currentTrack.type === 'jingle';

  // Dynamic Theme Colors for Buttons and Accents
  if (isJingle) {
    elements.playPauseBtn.className = 'p-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-lg shadow-amber-500/30 transition-all transform active:scale-95 flex items-center justify-center';
    if (elements.dynamicModePill) {
      elements.dynamicModePill.className = 'text-xs font-mono px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center gap-1.5 transition-colors';
      elements.dynamicModeDot.className = 'w-2 h-2 rounded-full bg-amber-500 animate-pulse';
      elements.dynamicModeText.textContent = 'Modo Anuncio / Spot';
    }
  } else {
    elements.playPauseBtn.className = 'p-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all transform active:scale-95 flex items-center justify-center';
    if (elements.dynamicModePill) {
      elements.dynamicModePill.className = 'text-xs font-mono px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 transition-colors';
      elements.dynamicModeDot.className = 'w-2 h-2 rounded-full bg-indigo-500 animate-pulse';
      elements.dynamicModeText.textContent = 'Modo Música';
    }
  }
  
  if (playing) {
    elements.playPauseBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 fill-current ${isJingle ? 'text-zinc-950' : 'text-white'}" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="6" y="4" width="4" height="16"></rect>
        <rect x="14" y="4" width="4" height="16"></rect>
      </svg>
    `;
    if (elements.engineStatus) {
      elements.engineStatus.textContent = isJingle ? 'Anuncio al Aire' : 'Transmitiendo';
      elements.engineStatus.className = isJingle ? 'text-amber-500 dark:text-amber-400 font-mono font-medium' : 'text-emerald-500 dark:text-emerald-400 font-mono font-medium';
    }
    if (elements.enginePulseDot) {
      elements.enginePulseDot.className = `inline-block w-2 h-2 rounded-full ${isJingle ? 'bg-amber-500' : 'bg-emerald-500'} animate-pulse`;
    }
  } else {
    elements.playPauseBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 fill-current ${isJingle ? 'text-zinc-950' : 'text-white'}" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="5 3 19 12 5 21 5 3"></polygon>
      </svg>
    `;
    if (elements.engineStatus) {
      elements.engineStatus.textContent = 'Pausado';
      elements.engineStatus.className = 'text-zinc-500 dark:text-zinc-400 font-mono font-medium';
    }
    if (elements.enginePulseDot) {
      elements.enginePulseDot.className = 'inline-block w-2 h-2 rounded-full bg-zinc-400';
    }
    stopVisualizer();
  }
}

export function togglePlayPause() {
  if (state.queue.length === 0) {
    showToast("Carga canciones o anuncios para comenzar la emisión", "warning");
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

export function playNext(useCrossfade = false) {
  if (state.queue.length === 0) return;
  let nextIdx = state.currentIndex + 1;
  if (nextIdx >= state.queue.length) {
    if (state.autoDj) {
      nextIdx = 0;
      showToast("Reiniciando ciclo de reproducción en bucle", "info");
    } else {
      setPlayingUI(false);
      showToast("Fin de la lista de reproducción", "info");
      return;
    }
  }
  playIndex(nextIdx, useCrossfade);
}

export function playPrev() {
  if (state.queue.length === 0) return;
  let prevIdx = state.currentIndex - 1;
  if (prevIdx < 0) prevIdx = state.queue.length - 1;
  playIndex(prevIdx, false);
}

export async function handleTrackEnd() {
  if (!state.autoDj || state.queue.length === 0) {
    setPlayingUI(false);
    return;
  }

  let nextIdx = state.currentIndex + 1;
  if (nextIdx >= state.queue.length) {
    nextIdx = 0;
    showToast("Reiniciando ciclo de reproducción en bucle", "info");
  }

  const nextTrack = state.queue[nextIdx];
  const isJingleNext = nextTrack && nextTrack.type === 'jingle';

  // Chime triggers strictly before ads/commercials
  if (isJingleNext) {
    state.isCrossfading = true;
    await triggerTransitionBridge(true);
    state.isCrossfading = false;
  }
  playIndex(nextIdx, false);
}

export function playIndex(index, isCrossfadeTransition = false) {
  if (index < 0 || index >= state.queue.length) return;
  state.currentIndex = index;
  const track = state.queue[index];

  // Update Track Info UI
  elements.currentTrackTitle.textContent = track.title;
  elements.currentTrackArtist.textContent = track.type === 'jingle' ? 'Anuncio publicitario / Spot' : 'Pista Musical';
  
  const isJingle = track.type === 'jingle';
  elements.playingBadge.className = `inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
    isJingle ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30' : 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30'
  }`;
  elements.playingBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full ${isJingle ? 'bg-amber-500' : 'bg-indigo-500'} animate-ping"></span> ${isJingle ? 'ANUNCIO AL AIRE' : 'EN VIVO'}`;
  
  elements.sourceBadge.textContent = track.source === 'youtube' ? 'YouTube Audio' : 'Audio Local (Deck ' + (state.activeDeck === 'A' ? (isCrossfadeTransition ? 'B' : 'A') : (isCrossfadeTransition ? 'A' : 'B')) + ')';
  
  // Ambient Dynamic Glow & Card Theme
  if (elements.playerGlow) {
    elements.playerGlow.className = `absolute -top-16 -left-16 w-56 h-56 rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
      isJingle ? 'bg-amber-500/25' : 'bg-indigo-600/20'
    }`;
  }
  if (elements.playerSection) {
    elements.playerSection.style.borderColor = isJingle ? 'rgba(245, 158, 11, 0.4)' : '';
  }

  // Local Deck Playback
  if (track.source === 'local') {
    state.activeSourceType = 'local';
    elements.youtubePlayerWrapper.classList.add('hidden');
    if (ytPlayer && ytPlayer.pauseVideo) {
      try { ytPlayer.pauseVideo(); } catch(e){}
    }

    if (!track.url) {
      showToast(`Pista local "${track.title}" pendiente. Carga el archivo en el panel izquierdo.`, "warning");
      setPlayingUI(false);
      return;
    }

    const currentPlayer = getActiveLocalPlayer();
    const otherPlayer = getInactiveLocalPlayer();
    otherPlayer.pause();

    currentPlayer.src = track.url;
    currentPlayer.volume = state.isMuted ? 0 : 1.0;
    currentPlayer.play().then(() => {
      setPlayingUI(true);
      startVisualizer();
    }).catch(err => {
      console.error("Local play error:", err);
      showToast("Error reproduciendo audio local", "error");
    });

  // YouTube Audio Playback
  } else if (track.source === 'youtube') {
    state.activeSourceType = 'youtube';
    elements.deckA.pause();
    elements.deckB.pause();

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
        ytPlayer = new YT.Player('ytPlayerDiv', {
          height: '100%',
          width: '100%',
          videoId: track.isPlaylist ? undefined : track.ytId,
          playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            listType: track.isPlaylist ? 'playlist' : undefined,
            list: track.isPlaylist ? track.playlistId : undefined,
          },
          events: {
            onReady: (event) => {
              ytReady = true;
              event.target.setVolume(state.isMuted ? 0 : 100);
              event.target.playVideo();
            },
            onStateChange: (event) => {
              if (event.data === YT.PlayerState.PLAYING) {
                setPlayingUI(true);
                startVisualizer();
              } else if (event.data === YT.PlayerState.PAUSED) {
                setPlayingUI(false);
              } else if (event.data === YT.PlayerState.ENDED) {
                handleTrackEnd();
              }
            },
            onError: (err) => {
              console.warn("YouTube player error:", err);
            }
          }
        });
      } else {
        ytPlayer.setVolume(state.isMuted ? 0 : 100);
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
}

window.playIndex = playIndex;

export function startVisualizer() {
  if (visualizerTimer) clearInterval(visualizerTimer);
  const currentTrack = state.currentIndex >= 0 && state.queue[state.currentIndex] ? state.queue[state.currentIndex] : null;
  const isJingle = currentTrack && currentTrack.type === 'jingle';

  visualizerTimer = setInterval(() => {
    elements.visualizerBars.forEach(bar => {
      const h = Math.floor(Math.random() * 16) + 4;
      bar.style.height = `${h}px`;
      bar.className = `bar w-1 rounded-full transition-all ${
        isJingle ? 'bg-amber-500 shadow-sm shadow-amber-500/50' : 'bg-indigo-500 shadow-sm shadow-indigo-500/50'
      }`;
    });
  }, 90);
}

export function stopVisualizer() {
  if (visualizerTimer) clearInterval(visualizerTimer);
  elements.visualizerBars.forEach(bar => {
    bar.style.height = '4px';
    bar.className = 'bar w-1 rounded-full bg-zinc-400 dark:bg-zinc-600 transition-all';
  });
}

export let isSeeking = false;
export function setIsSeeking(val) { isSeeking = val; }

export function startProgressTracking() {
  if (progressTimer) clearInterval(progressTimer);
  progressTimer = setInterval(() => {
    if (state.activeSourceType === 'youtube' && ytPlayer && ytPlayer.getCurrentTime && ytPlayer.getDuration) {
      try {
        const cur = ytPlayer.getCurrentTime() || 0;
        const dur = ytPlayer.getDuration() || 1;
        if (dur > 0) {
          elements.currentTime.textContent = formatTime(cur);
          elements.totalDuration.textContent = formatTime(dur);
          if (!isSeeking) {
            elements.trackProgress.value = (cur / dur) * 100;
          }
        }
      } catch(e){}
    }
  }, 350);
}

export function updateProgress() {
  if (state.activeSourceType === 'local') {
    const p = getActiveLocalPlayer();
    const cur = p.currentTime || 0;
    const dur = p.duration || 1;
    elements.currentTime.textContent = formatTime(cur);
    elements.totalDuration.textContent = formatTime(dur);
    if (!isSeeking) {
      elements.trackProgress.value = (cur / dur) * 100;
    }
  }
}
