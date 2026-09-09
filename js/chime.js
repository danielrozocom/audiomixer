import { state, elements } from './state.js';

let sharedAudioCtx = null;
export function getSharedAudioContext() {
  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      sharedAudioCtx = new AudioContextClass();
    }
  }
  if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

// Unlock audio context on any user interaction with page
['click', 'touchstart', 'keydown'].forEach(evt => {
  document.addEventListener(evt, () => {
    try {
      const ctx = getSharedAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    } catch(e){}
  }, { passive: true, once: false });
});

export function playRadioChime(volume = 1.0, isJingleNext = false) {
  return new Promise((resolve) => {
    try {
      const ctx = getSharedAudioContext();
      if (!ctx) { resolve(); return; }

      // Make sure context is running
      if (ctx.state === 'suspended') {
        ctx.resume().then(() => doChime(ctx, resolve)).catch(() => {
          doChime(ctx, resolve);
        });
      } else {
        doChime(ctx, resolve);
      }
    } catch(e) {
      console.warn("Chime synth error", e);
      resolve();
    }
  });

  function doChime(ctx, resolve) {
    try {
      const masterGain = ctx.createGain();
      const currentVol = state.isMuted ? 0.6 : (state.volume || 1.0);
      const safeVol = Math.max(0.4, Math.min(1.0, currentVol));
      masterGain.gain.setValueAtTime(safeVol, ctx.currentTime);
      masterGain.connect(ctx.destination);

      const now = ctx.currentTime;

      if (isJingleNext) {
        // Classic Broadcast Radio Chime Melody repeated 2 times
        const sequence = [
          // Ráfaga 1 (Primera vez)
          { freq: 1046.50, time: now + 0.00, dur: 0.55, vol: 0.85 }, // C6
          { freq: 1318.51, time: now + 0.12, dur: 0.55, vol: 0.85 }, // E6
          { freq: 1567.98, time: now + 0.24, dur: 0.60, vol: 0.90 }, // G6
          { freq: 2093.00, time: now + 0.40, dur: 0.80, vol: 0.95 }, // C7
          
          // Ráfaga 2 (Segunda vez con resolución resonante)
          { freq: 1046.50, time: now + 0.80, dur: 0.55, vol: 0.85 }, // C6
          { freq: 1318.51, time: now + 0.92, dur: 0.55, vol: 0.90 }, // E6
          { freq: 1567.98, time: now + 1.04, dur: 0.65, vol: 0.95 }, // G6
          { freq: 2093.00, time: now + 1.20, dur: 1.30, vol: 1.00 }  // C7 final
        ];

        sequence.forEach(item => {
          // Fundamental sine wave
          const osc = ctx.createOscillator();
          const noteGain = ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(item.freq, item.time);

          noteGain.gain.setValueAtTime(0.0001, item.time);
          noteGain.gain.exponentialRampToValueAtTime(item.vol, item.time + 0.02);
          noteGain.gain.exponentialRampToValueAtTime(0.0001, item.time + item.dur);

          osc.connect(noteGain);
          noteGain.connect(masterGain);

          osc.start(item.time);
          osc.stop(item.time + item.dur + 0.05);

          // Harmonic overtone for realistic metal bell shimmer
          const harmOsc = ctx.createOscillator();
          const harmGain = ctx.createGain();
          harmOsc.type = 'sine';
          harmOsc.frequency.setValueAtTime(item.freq * 2.76, item.time);
          harmGain.gain.setValueAtTime(0.0001, item.time);
          harmGain.gain.exponentialRampToValueAtTime(item.vol * 0.25, item.time + 0.015);
          harmGain.gain.exponentialRampToValueAtTime(0.0001, item.time + (item.dur * 0.5));
          harmOsc.connect(harmGain);
          harmGain.connect(masterGain);
          harmOsc.start(item.time);
          harmOsc.stop(item.time + (item.dur * 0.5) + 0.05);
        });

        setTimeout(resolve, 2400);

      } else {
        // Regular song-to-song transition
        resolve();
      }
    } catch(e) {
      console.warn("Chime execution error", e);
      resolve();
    }
  }
}

export const DEFAULT_CHIME_YT_ID = 'SbI3YqGSNPc';
export let ytChimePlayer = null;

export function playYouTubeChime(videoId = DEFAULT_CHIME_YT_ID) {
  return new Promise((resolve) => {
    try {
      if (!window.YT || !window.YT.Player) {
        playRadioChime(state.volume, true).then(resolve);
        return;
      }

      let isResolved = false;
      let checkInterval = null;
      let safetyTimer = null;

      const finishChime = () => {
        if (isResolved) return;
        isResolved = true;
        if (checkInterval) clearInterval(checkInterval);
        if (safetyTimer) clearTimeout(safetyTimer);
        resolve();
      };

      const onEnded = () => {
        finishChime();
      };

      const startMonitoring = () => {
        if (checkInterval) clearInterval(checkInterval);
        checkInterval = setInterval(() => {
          if (ytChimePlayer && ytChimePlayer.getCurrentTime && ytChimePlayer.getDuration) {
            try {
              const cur = ytChimePlayer.getCurrentTime() || 0;
              const dur = ytChimePlayer.getDuration() || 0;
              // If video actually reached the end
              if (dur > 0 && cur >= dur - 0.15) {
                onEnded();
              }
            } catch(e){}
          }
        }, 150);
      };

      if (!ytChimePlayer || !ytChimePlayer.loadVideoById) {
        ytChimePlayer = new YT.Player('ytChimeDiv', {
          height: '100%',
          width: '100%',
          videoId: videoId,
          playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
          },
          events: {
            onReady: (event) => {
              event.target.setVolume(state.isMuted ? 0 : 100);
              event.target.playVideo();
              startMonitoring();
            },
            onStateChange: (event) => {
              if (event.data === YT.PlayerState.PLAYING) {
                const dur = event.target.getDuration() || 6;
                // Dynamically set safety timeout according to actual video length
                if (safetyTimer) clearTimeout(safetyTimer);
                safetyTimer = setTimeout(() => {
                  finishChime();
                }, (dur + 1.5) * 1000);
                startMonitoring();
              } else if (event.data === YT.PlayerState.ENDED) {
                onEnded();
              }
            },
            onError: () => {
              finishChime();
              playRadioChime(state.volume, true);
            }
          }
        });
      } else {
        ytChimePlayer.setVolume(state.isMuted ? 0 : 100);
        ytChimePlayer.loadVideoById(videoId);
        ytChimePlayer.playVideo();
        startMonitoring();
      }

    } catch (e) {
      console.warn("YouTube chime playback error:", e);
      playRadioChime(state.volume, true).then(resolve);
    }
  });
}

// Play Transition Cortinilla (YouTube Chime SbI3YqGSNPc, Custom uploaded jingle or Automatic Radio Chime)
export async function triggerTransitionBridge(isJingleNext = false) {
  if (state.customTransitionUrl) {
    return new Promise((resolve) => {
      const bridgeAudio = new Audio(state.customTransitionUrl);
      bridgeAudio.volume = state.isMuted ? 0.7 : Math.max(0.3, state.volume);
      bridgeAudio.onended = () => resolve();
      bridgeAudio.onerror = () => {
        playYouTubeChime(DEFAULT_CHIME_YT_ID).then(resolve);
      };
      bridgeAudio.play().catch(() => {
        playYouTubeChime(DEFAULT_CHIME_YT_ID).then(resolve);
      });
      setTimeout(resolve, 4000);
    });
  }

  // Play the signature broadcast radio chime from YouTube SbI3YqGSNPc
  if (isJingleNext) {
    await playYouTubeChime(DEFAULT_CHIME_YT_ID);
  } else {
    await playRadioChime(state.volume, false);
  }
}
