// Procedural sound effects: every sound is synthesized, so there are no assets to load.

const STORAGE_KEY = 'itt:muted';

function loadMuted() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function saveMuted(muted) {
  try {
    localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
  } catch {
    // storage unavailable (private mode); the setting just won't persist
  }
}

export function createAudio() {
  let ctx = null;
  let master = null;
  let noiseBuffer = null;
  let ambientGain = null;
  let muted = loadMuted();

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.7;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    master.connect(comp).connect(ctx.destination);

    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    startAmbient();
    return ctx;
  }

  function startAmbient() {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.09;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 220;
    lfo.connect(lfoGain).connect(lp.frequency);
    ambientGain = ctx.createGain();
    ambientGain.gain.value = 0.05;
    src.connect(lp).connect(ambientGain).connect(master);
    src.start();
    lfo.start();
  }

  function unlock() {
    const c = ensure();
    if (c?.state === 'suspended') c.resume();
  }
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);

  function tone({ type = 'sine', freq, to = freq, dur = 0.2, gain = 0.2, attack = 0.005, delay = 0 }) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noise({ dur = 0.2, gain = 0.2, filter = 'lowpass', freq = 1000, to = freq, q = 1, attack = 0.005, delay = 0 }) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t0);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t0, Math.random() * 1.5);
    src.stop(t0 + dur + 0.05);
  }

  return {
    get muted() {
      return muted;
    },
    setMuted(next) {
      muted = next;
      saveMuted(muted);
      if (master) master.gain.setTargetAtTime(muted ? 0 : 0.7, ctx.currentTime, 0.05);
    },
    click() {
      tone({ type: 'triangle', freq: 620, to: 900, dur: 0.07, gain: 0.12 });
    },
    select() {
      tone({ type: 'triangle', freq: 520, to: 780, dur: 0.1, gain: 0.14 });
      tone({ type: 'sine', freq: 1040, to: 1300, dur: 0.12, gain: 0.07, delay: 0.05 });
    },
    error() {
      tone({ type: 'square', freq: 220, to: 160, dur: 0.18, gain: 0.08 });
    },
    join() {
      tone({ type: 'sine', freq: 660, dur: 0.18, gain: 0.16 });
      tone({ type: 'sine', freq: 990, dur: 0.3, gain: 0.14, delay: 0.1 });
    },
    jump() {
      tone({ type: 'triangle', freq: 280, to: 640, dur: 0.16, gain: 0.18 });
      noise({ dur: 0.08, gain: 0.05, filter: 'highpass', freq: 2000 });
    },
    land(speed = 6) {
      const v = Math.min(1, speed / 12);
      noise({ dur: 0.14, gain: 0.08 + v * 0.18, freq: 500, to: 90 });
      tone({ freq: 110, to: 55, dur: 0.12, gain: 0.08 + v * 0.12 });
    },
    hit() {
      noise({ dur: 0.28, gain: 0.35, filter: 'bandpass', freq: 1500, to: 280, q: 0.8 });
      tone({ type: 'square', freq: 190, to: 60, dur: 0.22, gain: 0.12 });
      tone({ type: 'sine', freq: 900, to: 1400, dur: 0.12, gain: 0.08, delay: 0.03 });
    },
    impact(distance = 5) {
      const v = Math.max(0.35, 1 - distance / 20);
      noise({ dur: 0.7, gain: 0.55 * v, freq: 1600, to: 50 });
      tone({ freq: 80, to: 28, dur: 0.6, gain: 0.5 * v });
    },
    meteorFall(duration) {
      tone({ type: 'sine', freq: 1900, to: 520, dur: duration, gain: 0.035, attack: 0.3 });
    },
    gem() {
      [1175, 1568, 2093].forEach((f, i) => tone({ type: 'sine', freq: f, dur: 0.22, gain: 0.1, delay: i * 0.06 }));
    },
    checkpoint() {
      [523, 784, 1047].forEach((f, i) => tone({ type: 'triangle', freq: f, dur: 0.3, gain: 0.12, delay: i * 0.08 }));
      noise({ dur: 0.5, gain: 0.05, filter: 'highpass', freq: 3000, attack: 0.1 });
    },
    pad() {
      tone({ type: 'sine', freq: 180, to: 900, dur: 0.3, gain: 0.22 });
      noise({ dur: 0.2, gain: 0.08, filter: 'bandpass', freq: 800, to: 3000 });
    },
    plate(on) {
      tone({ type: 'square', freq: on ? 330 : 220, to: on ? 440 : 165, dur: 0.1, gain: 0.07 });
      noise({ dur: 0.08, gain: 0.08, freq: 600 });
    },
    rumble() {
      noise({ dur: 0.6, gain: 0.12, freq: 180, to: 90, attack: 0.1 });
    },
    crumble() {
      noise({ dur: 0.45, gain: 0.2, filter: 'bandpass', freq: 900, to: 200, q: 0.7 });
      tone({ freq: 90, to: 45, dur: 0.3, gain: 0.1 });
    },
    gust() {
      noise({ dur: 1.6, gain: 0.14, filter: 'bandpass', freq: 400, to: 1200, q: 0.9, attack: 0.4 });
    },
    climb() {
      tone({ type: 'triangle', freq: 330, to: 520, dur: 0.12, gain: 0.12 });
      noise({ dur: 0.1, gain: 0.07, filter: 'highpass', freq: 2500 });
    },
    brace() {
      tone({ freq: 140, to: 90, dur: 0.12, gain: 0.12 });
    },
    slam() {
      noise({ dur: 0.8, gain: 0.5, freq: 900, to: 40 });
      tone({ freq: 60, to: 25, dur: 0.7, gain: 0.45 });
    },
    roar() {
      tone({ type: 'sawtooth', freq: 110, to: 70, dur: 0.9, gain: 0.08, attack: 0.1 });
      noise({ dur: 0.9, gain: 0.1, filter: 'bandpass', freq: 300, to: 150, q: 2, attack: 0.1 });
    },
    strike() {
      noise({ dur: 1.2, gain: 0.6, freq: 6000, to: 80, attack: 0.002 });
      tone({ type: 'square', freq: 1600, to: 60, dur: 0.5, gain: 0.12 });
    },
    victory() {
      [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ type: 'triangle', freq: f, dur: 0.4, gain: 0.13, delay: i * 0.11 }));
      tone({ type: 'sine', freq: 262, dur: 1.2, gain: 0.1, delay: 0.1 });
    },
    blip() {
      tone({ type: 'square', freq: 700 + Math.random() * 120, dur: 0.03, gain: 0.025 });
    },
    respawn() {
      tone({ type: 'sine', freq: 300, to: 900, dur: 0.35, gain: 0.12 });
    },
    fell() {
      tone({ type: 'sine', freq: 900, to: 110, dur: 0.9, gain: 0.16 });
    },
  };
}
