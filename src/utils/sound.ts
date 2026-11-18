let sharedAudioCtx: AudioContext | null = null;
let activeAlertNodes: Array<{ stop: () => void }> = [];

function getAudioContext(): AudioContext | null {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!sharedAudioCtx) {
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx.state === 'suspended') {
      void sharedAudioCtx.resume();
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

export function unlockAudioContext(): void {
  getAudioContext();
}

export function playClickSound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 700;
    gain.gain.value = 0.07;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    osc.stop(ctx.currentTime + 0.19);
  } catch {
    // Ignore audio errors
  }
}

export function stopIphoneNotification(): void {
  for (const node of activeAlertNodes) {
    try {
      node.stop();
    } catch {
      // Ignore already stopped
    }
  }
  activeAlertNodes = [];
}

/**
 * Plays a 3-second iPhone-style tri-tone / chime notification alert when Admin receives a UTR payment message.
 */
export function playIphoneNotification3Sec(): void {
  try {
    stopIphoneNotification();
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Bright iPhone-style chime melody repeated across 3.0 seconds
    // Notes: B5 (987.77), E6 (1318.51), F#6 (1479.98), B6 (1975.53)
    const pattern = [
      { offset: 0.0, freq: 987.77, dur: 0.18 },
      { offset: 0.16, freq: 1318.51, dur: 0.18 },
      { offset: 0.32, freq: 1479.98, dur: 0.28 },
      { offset: 0.62, freq: 1975.53, dur: 0.32 },

      { offset: 1.05, freq: 987.77, dur: 0.18 },
      { offset: 1.21, freq: 1318.51, dur: 0.18 },
      { offset: 1.37, freq: 1479.98, dur: 0.28 },
      { offset: 1.67, freq: 1975.53, dur: 0.32 },

      { offset: 2.1, freq: 987.77, dur: 0.18 },
      { offset: 2.26, freq: 1318.51, dur: 0.18 },
      { offset: 2.42, freq: 1479.98, dur: 0.26 },
      { offset: 2.68, freq: 1975.53, dur: 0.32 },
    ];

    for (const note of pattern) {
      const osc = ctx.createOscillator();
      const harmonic = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(note.freq, now + note.offset);

      harmonic.type = 'triangle';
      harmonic.frequency.setValueAtTime(note.freq * 2, now + note.offset);

      const hGain = ctx.createGain();
      hGain.gain.setValueAtTime(0.15, now + note.offset);

      gain.gain.setValueAtTime(0.0001, now + note.offset);
      gain.gain.linearRampToValueAtTime(0.22, now + note.offset + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + note.offset + note.dur);

      osc.connect(gain);
      harmonic.connect(hGain);
      hGain.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + note.offset);
      harmonic.start(now + note.offset);
      osc.stop(now + note.offset + note.dur + 0.02);
      harmonic.stop(now + note.offset + note.dur + 0.02);

      activeAlertNodes.push(osc, harmonic);
    }
  } catch {
    // Ignore audio restriction errors
  }
}
