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
        // Broadcast Radio Double Chime (2 Campanadas dobles de radio broadcast claras y brillantes)
        const sequence = [
          // Campanada 1 (Ding)
          { freq: 1174.66, time: now + 0.00, dur: 0.85, vol: 0.90 }, // D6
          { freq: 1760.00, time: now + 0.18, dur: 1.10, vol: 0.95 }, // A6
          
          // Campanada 2 (Ding-Dong de confirmación publicitaria)
          { freq: 1318.51, time: now + 0.75, dur: 0.85, vol: 0.95 }, // E6
          { freq: 2093.00, time: now + 0.95, dur: 1.40, vol: 1.00 }  // C7
        ];

        sequence.forEach(item => {
          // Fundamental pure bell tone
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

          // Harmonic chime overtone (metálico brillante)
          const harmOsc = ctx.createOscillator();
          const harmGain = ctx.createGain();
          harmOsc.type = 'sine';
          harmOsc.frequency.setValueAtTime(item.freq * 2.76, item.time);
          harmGain.gain.setValueAtTime(0.0001, item.time);
          harmGain.gain.exponentialRampToValueAtTime(item.vol * 0.30, item.time + 0.015);
          harmGain.gain.exponentialRampToValueAtTime(0.0001, item.time + (item.dur * 0.6));
          harmOsc.connect(harmGain);
          harmGain.connect(masterGain);
          harmOsc.start(item.time);
          harmOsc.stop(item.time + (item.dur * 0.6) + 0.05);
        });

        setTimeout(resolve, 2100);

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

// Play Transition Cortinilla (Custom uploaded jingle or Automatic Radio Chime)
export async function triggerTransitionBridge(isJingleNext = false) {
  if (state.customTransitionUrl) {
    return new Promise((resolve) => {
      const bridgeAudio = new Audio(state.customTransitionUrl);
      bridgeAudio.volume = state.isMuted ? 0.7 : Math.max(0.3, state.volume);
      bridgeAudio.onended = () => resolve();
      bridgeAudio.onerror = () => {
        playRadioChime(state.volume, isJingleNext).then(resolve);
      };
      bridgeAudio.play().catch(() => {
        playRadioChime(state.volume, isJingleNext).then(resolve);
      });
      setTimeout(resolve, 4000);
    });
  }

  // Play the signature broadcast radio chime
  await playRadioChime(state.volume, isJingleNext);
}
