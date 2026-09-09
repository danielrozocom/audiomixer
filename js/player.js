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
  
  if (playing) {
    elements.playPauseBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 fill-current text-white" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="6" y="4" width="4" height="16"></rect>
        <rect x="14" y="4" width="4" height="16"></rect>
      </svg>
    `;
    if (elements.engineStatus) {
      elements.engineStatus.textContent = 'Transmitiendo';
      elements.engineStatus.className = 'text-emerald-500 dark:text-emerald-400 font-mono font-medium';
    }
    if (elements.enginePulseDot) {
      elements.enginePulseDot.className = 'inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse';
    }
  } else {
    elements.playPauseBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 fill-current text-white" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="5 3 19 12 5 21 5 3"></polygon>
      </svg>
    `;
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
    isJingle ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30' : 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30'
  }`;
  elements.playingBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full ${isJingle ? 'bg-amber-500' : 'bg-blue-500'} animate-ping"></span> ${isJingle ? 'ANUNCIO AL AIRE' : 'EN VIVO'}`;
  
  elements.sourceBadge.textContent = track.source === 'youtube' ? 'YouTube Audio' : 'Audio Local (Deck ' + (state.activeDeck === 'A' ? (isCrossfadeTransition ? 'B' : 'A') : (isCrossfadeTransition ? 'A' : 'B')) + ')';
  elements.playerGlow.className = `absolute -top-16 -left-16 w-48 h-48 rounded-full blur-3xl pointer-events-none transition-colors duration-500 ${
    isJingle ? 'bg-amber-500/20' : 'bg-indigo-600/20'
  }`;

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
            controls: 1,
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
  visualizerTimer = setInterval(() => {
    elements.visualizerBars.forEach(bar => {
      const h = Math.floor(Math.random() * 16) + 4;
      bar.style.height = `${h}px`;
    });
  }, 90);
}

export function stopVisualizer() {
  if (visualizerTimer) clearInterval(visualizerTimer);
  elements.visualizerBars.forEach(bar => {
    bar.style.height = '4px';
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
