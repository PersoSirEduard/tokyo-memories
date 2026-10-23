// Tiny synthesized sound kit: no audio files to load.
let ctx = null, master = null, musicGain = null, muted = false, noise = null, trainNodes = null, musicTimer = null;

export function initAudio() {
  if (ctx) { ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = 0.7;
  master.connect(ctx.destination);
  musicGain = ctx.createGain();
  musicGain.gain.value = 0.18;
  const delay = ctx.createDelay();
  delay.delayTime.value = 0.33;
  const fb = ctx.createGain();
  fb.gain.value = 0.3;
  musicGain.connect(master);
  musicGain.connect(delay);
  delay.connect(fb);
  fb.connect(delay);
  delay.connect(master);
  const len = ctx.sampleRate * 2;
  noise = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
}

export function setMuted(m) {
  muted = m;
  if (master) master.gain.setTargetAtTime(m ? 0 : 0.7, ctx.currentTime, 0.05);
}
export const isMuted = () => muted;

function tone(freq, start, dur, { type = 'sine', vol = 0.3, dest = master, attack = 0.005 } = {}) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(vol, start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g);
  g.connect(dest);
  o.start(start);
  o.stop(start + dur + 0.05);
  return o;
}
function burst(start, dur, { freq = 2000, q = 1, vol = 0.4, type = 'bandpass' } = {}) {
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noise;
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  g.gain.setValueAtTime(vol, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  s.connect(f); f.connect(g); g.connect(master);
  s.start(start, Math.random());
  s.stop(start + dur + 0.05);
}

export const sfx = {
  shutter() {
    if (!ctx) return;
    const t = ctx.currentTime;
    burst(t, 0.05, { freq: 3500, q: 2, vol: 0.6 });
    burst(t + 0.09, 0.07, { freq: 2200, q: 2, vol: 0.5 });
    tone(1800, t, 0.04, { type: 'square', vol: 0.05 });
  },
  print() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.value = 95;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.06, t + 0.05);
    g.gain.setValueAtTime(0.06, t + 1.3);
    g.gain.linearRampToValueAtTime(0, t + 1.45);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 600;
    o.connect(f); f.connect(g); g.connect(master);
    o.start(t); o.stop(t + 1.5);
    for (let i = 0; i < 14; i++) burst(t + i * 0.1, 0.03, { freq: 1200, q: 4, vol: 0.12 });
  },
  chime() {
    if (!ctx) return;
    const t = ctx.currentTime;
    [659.25, 523.25, 587.33, 392, 392, 587.33, 659.25, 523.25].forEach((f, i) => tone(f, t + i * 0.28, 0.9, { type: 'sine', vol: 0.16 }));
  },
  bark(vol = 1) {
    if (!ctx) return;
    const t = ctx.currentTime;
    for (const k of [0, 0.16]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'square';
      o.frequency.setValueAtTime(720, t + k);
      o.frequency.exponentialRampToValueAtTime(380, t + k + 0.09);
      g.gain.setValueAtTime(0.0001, t + k);
      g.gain.exponentialRampToValueAtTime(0.1 * vol, t + k + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + k + 0.1);
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 900;
      o.connect(f); f.connect(g); g.connect(master);
      o.start(t + k); o.stop(t + k + 0.12);
    }
  },
  flash(vol = 0.5) {
    if (!ctx) return;
    const t = ctx.currentTime;
    burst(t, 0.04, { freq: 4000, q: 3, vol: 0.3 * vol });
    tone(2600, t, 0.12, { type: 'sine', vol: 0.05 * vol });
  },
  pop() {
    if (!ctx) return;
    const t = ctx.currentTime;
    tone(880, t, 0.12, { type: 'triangle', vol: 0.15 });
    tone(1320, t + 0.06, 0.14, { type: 'triangle', vol: 0.12 });
  },
  door() {
    if (!ctx) return;
    const t = ctx.currentTime;
    burst(t, 0.4, { freq: 500, q: 0.7, vol: 0.2, type: 'lowpass' });
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, t + 0.3 + i * 0.16, 1.4, { type: 'triangle', vol: 0.12 }));
  },
  trainStart() {
    if (!ctx || trainNodes) return;
    const t = ctx.currentTime;
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise;
    s.loop = true;
    f.type = 'lowpass';
    f.frequency.value = 260;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.22, t + 1.2);
    s.connect(f); f.connect(g); g.connect(master);
    s.start();
    const clack = setInterval(() => {
      const n = ctx.currentTime;
      burst(n, 0.06, { freq: 180, q: 3, vol: 0.25 });
      burst(n + 0.12, 0.06, { freq: 200, q: 3, vol: 0.2 });
    }, 1100);
    trainNodes = { s, g, clack };
  },
  trainStop() {
    if (!trainNodes) return;
    const { s, g, clack } = trainNodes;
    clearInterval(clack);
    g.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
    s.stop(ctx.currentTime + 1.5);
    trainNodes = null;
  },
};

// Gentle music-box loop in a pentatonic scale.
export function startMusic() {
  if (!ctx || musicTimer) return;
  const scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51];
  const chords = [[0, 2, 4], [1, 3, 5], [2, 4, 6], [0, 3, 5]];
  let step = 0, next = ctx.currentTime + 0.2;
  const beat = 0.42;
  musicTimer = setInterval(() => {
    while (next < ctx.currentTime + 0.5) {
      const chord = chords[Math.floor(step / 8) % chords.length];
      const pattern = [0, 1, 2, 1, 2, 0, 1, 2];
      const idx = chord[pattern[step % 8]] + (step % 16 > 11 ? 1 : 0);
      if (step % 8 !== 5) tone(scale[idx % scale.length], next, 1.6, { type: 'triangle', vol: 0.22, dest: musicGain });
      if (step % 8 === 0) tone(scale[chord[0]] / 2, next, 2.8, { type: 'sine', vol: 0.18, dest: musicGain });
      next += beat;
      step++;
    }
  }, 120);
}
export function musicVolume(v) {
  if (musicGain) musicGain.gain.setTargetAtTime(v, ctx.currentTime, 0.4);
}
