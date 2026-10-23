// Paper look: shared washi texture, cached flat-shaded materials and canvas-drawn textures.
import * as THREE from 'three';

export function makeRng(seed = 1) {
  let s = (Math.imul(seed, 2654435761) >>> 0) || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

export function canvasTexture(w, h, draw, { repeat = false, srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

function grain(g, w, h, amount) {
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
}

function fibers(g, w, h, count, alpha) {
  g.save();
  g.globalAlpha = alpha;
  g.strokeStyle = '#6f6455';
  for (let i = 0; i < count; i++) {
    const x = Math.random() * w, y = Math.random() * h;
    const a = Math.random() * Math.PI * 2, l = 4 + Math.random() * 16;
    g.lineWidth = 0.3 + Math.random() * 1.1;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a + 0.7) * l * 0.5, y + Math.sin(a + 0.7) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  g.restore();
}

let paperTex = null;
export function paperTexture() {
  if (paperTex) return paperTex;
  paperTex = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#f4f0e7';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 14; i++) {
      const x = Math.random() * w, y = Math.random() * h, r = 20 + Math.random() * 60;
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, 'rgba(120,105,85,0.06)');
      rg.addColorStop(1, 'rgba(120,105,85,0)');
      g.fillStyle = rg;
      g.fillRect(0, 0, w, h);
    }
    grain(g, w, h, 16);
    fibers(g, w, h, 240, 0.08);
  }, { repeat: true });
  paperTex.userData.shared = true;
  return paperTex;
}

const matCache = new Map();

// Flat-shaded paper material. Calls without opts are cached and shared across stages.
export function paperMat(color, opts) {
  if (!opts) {
    let m = matCache.get(color);
    if (!m) {
      m = new THREE.MeshLambertMaterial({ color, map: paperTexture(), flatShading: true });
      m.userData.shared = true;
      matCache.set(color, m);
    }
    return m;
  }
  return new THREE.MeshLambertMaterial({ color, map: paperTexture(), flatShading: true, ...opts });
}

// Unlit material pushed above 1.0 so the bloom pass picks it up.
export function glowMat(color, strength = 1.6) {
  const key = `glow${color}_${strength}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(strength) });
    m.userData.shared = true;
    matCache.set(key, m);
  }
  return m;
}

// Building facade: paper wall with an 8x8 window grid; emissive map holds the lit windows.
export function windowTextures(rnd, { cool = false, warm = false } = {}) {
  const S = 256, N = 8, cell = S / N;
  const lit = cool ? ['#cfe8ff', '#e8f4ff', '#ffe2b0', '#b9d7ff'] : warm ? ['#ffd58a', '#ffc070', '#ffe6b0'] : ['#ffd89a', '#ffe7b8', '#bfe3ff', '#ffc4a0', '#ffd89a'];
  const states = [];
  for (let col = 0; col < N; col++) {
    const colOff = rnd() < 0.15;
    for (let row = 0; row < N; row++) {
      states.push(!colOff && rnd() < (cool ? 0.55 : 0.42) ? lit[Math.floor(rnd() * lit.length)] : null);
    }
  }
  const map = canvasTexture(S, S, (g) => {
    g.fillStyle = '#f2ede3';
    g.fillRect(0, 0, S, S);
    grain(g, S, S, 14);
    for (let col = 0; col < N; col++) for (let row = 0; row < N; row++) {
      const x = col * cell + 7, y = row * cell + 7;
      g.fillStyle = cool ? '#38455e' : '#2c3045';
      g.fillRect(x, y, cell - 14, cell - 12);
    }
    fibers(g, S, S, 80, 0.06);
  }, { repeat: true });
  const emissiveMap = canvasTexture(S, S, (g) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, S, S);
    for (let col = 0; col < N; col++) for (let row = 0; row < N; row++) {
      const c = states[col * N + row];
      if (!c) continue;
      const x = col * cell + 7, y = row * cell + 7, w = cell - 14, h = cell - 12;
      g.fillStyle = c;
      const blind = rnd() < 0.3 ? rnd() * 0.6 : 0;
      g.fillRect(x, y + h * blind, w, h * (1 - blind));
      g.fillStyle = 'rgba(0,0,0,0.5)';
      g.fillRect(x + w / 2 - 1, y, 2, h);
    }
  }, { repeat: true });
  return { map, emissiveMap };
}

const JP_FONT = '"Zen Maru Gothic", "Hiragino Maru Gothic ProN", "Hiragino Sans", sans-serif';
export { JP_FONT };

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
export { roundRect };

// Vertical neon shop sign.
export function signTexture(text, fg = '#ff4f8b', bg = '#1a1430') {
  const chars = [...text];
  const w = 64, h = Math.max(160, chars.length * 58 + 30);
  return canvasTexture(w, h, (g) => {
    g.fillStyle = bg;
    roundRect(g, 3, 3, w - 6, h - 6, 10);
    g.fill();
    g.strokeStyle = fg;
    g.lineWidth = 4;
    g.shadowColor = fg;
    g.shadowBlur = 10;
    g.stroke();
    g.fillStyle = '#fff';
    g.font = `900 44px ${JP_FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const step = (h - 30) / chars.length;
    chars.forEach((ch, i) => g.fillText(ch, w / 2, 15 + step * (i + 0.5)));
  });
}

// Horizontal text plate (landmark signs, station name boards).
export function plateTexture(lines, { w = 512, h = 128, bg = '#f4efe4', fg = '#1d1b26', stripe = null, font = JP_FONT } = {}) {
  return canvasTexture(w, h, (g) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    if (stripe) {
      g.fillStyle = stripe;
      g.fillRect(0, h - h * 0.14, w, h * 0.14);
    }
    g.fillStyle = fg;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const n = lines.length;
    lines.forEach((l, i) => {
      const size = l.size ?? (i === 0 ? h * 0.42 : h * 0.2);
      g.font = `${l.weight ?? (i === 0 ? 900 : 700)} ${size}px ${l.font ?? font}`;
      const y = n === 1 ? h * 0.45 : (i === 0 ? h * 0.38 : h * 0.72);
      g.fillText(l.text ?? l, w / 2, y);
    });
  });
}

let radialTex = null;
export function radialTexture() {
  if (radialTex) return radialTex;
  radialTex = canvasTexture(128, 128, (g) => {
    const rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    rg.addColorStop(0, 'rgba(255,255,255,1)');
    rg.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, 128, 128);
  });
  radialTex.userData.shared = true;
  return radialTex;
}

// Frees GPU memory for everything under a group except shared caches.
export function disposeTree(root) {
  root.traverse((o) => {
    if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of mats) {
      if (m.userData.shared) continue;
      for (const k of ['map', 'emissiveMap']) if (m[k] && !m[k].userData.shared) m[k].dispose();
      if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u.value?.isTexture && !u.value.userData.shared) u.value.dispose();
      m.dispose();
    }
  });
}
