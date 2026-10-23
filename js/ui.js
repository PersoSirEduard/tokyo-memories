// DOM overlay: HUD, joystick, polaroid printer, station boards, album and ending.
import { sfx } from './audio.js';
import { startLantern } from './lantern.js';

const $ = (s) => document.querySelector(s);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export const input = { x: 0, y: 0, mag: 0, keys: new Set() };

export function initInput() {
  const touch = $('#touch'), stick = $('#joystick'), knob = stick.querySelector('.knob');
  let id = null, ox = 0, oy = 0;
  const R = 52;
  touch.addEventListener('pointerdown', (e) => {
    if (id !== null) return;
    id = e.pointerId;
    ox = e.clientX; oy = e.clientY;
    stick.style.left = ox + 'px';
    stick.style.top = oy + 'px';
    stick.classList.add('on');
    knob.style.transform = '';
    touch.setPointerCapture(id);
  });
  touch.addEventListener('pointermove', (e) => {
    if (e.pointerId !== id) return;
    let dx = e.clientX - ox, dy = e.clientY - oy;
    const d = Math.hypot(dx, dy);
    if (d > R) { dx *= R / d; dy *= R / d; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    input.x = dx / R;
    input.y = -dy / R;
    input.mag = Math.min(1, d / R);
  });
  const end = (e) => {
    if (e.pointerId !== id) return;
    id = null;
    input.x = input.y = input.mag = 0;
    stick.classList.remove('on');
  };
  touch.addEventListener('pointerup', end);
  touch.addEventListener('pointercancel', end);
  addEventListener('keydown', (e) => input.keys.add(e.key.toLowerCase()));
  addEventListener('keyup', (e) => input.keys.delete(e.key.toLowerCase()));
  addEventListener('blur', () => input.keys.clear());
}

export function readInput() {
  const k = input.keys;
  let x = 0, y = 0;
  if (k.has('a') || k.has('arrowleft')) x -= 1;
  if (k.has('d') || k.has('arrowright')) x += 1;
  if (k.has('w') || k.has('arrowup')) y += 1;
  if (k.has('s') || k.has('arrowdown')) y -= 1;
  if (x || y) {
    const l = Math.hypot(x, y);
    return { x: x / l, y: y / l, mag: k.has('shift') ? 1 : 0.6 };
  }
  return { x: input.mag ? input.x / input.mag : 0, y: input.mag ? input.y / input.mag : 0, mag: input.mag };
}

export function resetInput() {
  input.x = input.y = input.mag = 0;
  $('#joystick').classList.remove('on');
}

export function showHud(on) { $('#hud').classList.toggle('hidden', !on); $('#mute-btn').classList.toggle('hidden', !on); }

export function setStation(stop) {
  document.documentElement.style.setProperty('--line', stop.station.color);
  $('#station-card .badge span').textContent = stop.station.badge;
  $('#station-card .jp').textContent = stop.station.short ?? stop.station.jp;
  $('#station-card .en').textContent = `${stop.station.en} · ${stop.station.line}`;
}

let lastObjective = '';
export function setObjective(text) {
  if (text === lastObjective) return;
  lastObjective = text;
  const el = $('#objective');
  el.textContent = text;
  el.classList.remove('pop');
  void el.offsetWidth;
  el.classList.add('pop');
}

export function setAlbumCount(n, total) {
  const b = $('#album-btn');
  b.querySelector('.count').textContent = `${n}/${total}`;
  b.classList.remove('bump');
  void b.offsetWidth;
  b.classList.add('bump');
}

export function showShutter(on, onPress) {
  const b = $('#shutter-btn');
  b.classList.toggle('hidden', !on);
  b.onclick = on ? (e) => { e.stopPropagation(); onPress(); } : null;
}

export function bubble(text, x, y) {
  const el = document.createElement('div');
  el.className = 'bubble';
  el.textContent = text;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  $('#bubbles').appendChild(el);
  setTimeout(() => el.remove(), 800);
}

export function guideArrow(show, x, y, angle) {
  const a = $('#guide-arrow');
  a.classList.toggle('hidden', !show);
  if (!show) return;
  a.style.left = x + 'px';
  a.style.top = y + 'px';
  a.style.setProperty('--a', `${angle}rad`);
}

export async function nameboard(stop, prev, next) {
  const nb = $('#nameboard');
  const jp = stop.station.short ?? stop.station.jp;
  nb.querySelector('.jp').textContent = jp;
  nb.querySelector('.jp').classList.toggle('long', jp.length > 5);
  nb.querySelector('.en').textContent = stop.station.en;
  nb.querySelector('.prev').textContent = prev ? `← ${prev.station.en}` : '';
  nb.querySelector('.code').textContent = stop.station.badge;
  nb.querySelector('.next').textContent = next ? `${next.station.en} →` : 'home →';
  nb.classList.remove('hidden');
  const board = nb.querySelector('.board');
  board.style.animation = 'none';
  void board.offsetWidth;
  board.style.animation = '';
  await wait(2800);
  nb.classList.add('hidden');
}

export function fade(on) {
  $('#fade').classList.toggle('on', on);
  return wait(650);
}

// viewfinder -> flash -> instax prints -> photo develops -> keep
export async function photoSequence(stop) {
  const layer = $('#photo-layer'), vf = $('#viewfinder'), flash = $('#flash');
  const stage = $('#print-stage'), pol = $('#polaroid'), keep = $('#keep-btn');
  layer.classList.remove('hidden', 'dim');
  stage.classList.add('hidden');
  stage.classList.remove('out');
  pol.className = '';
  pol.style.transform = '';
  keep.classList.add('hidden');
  pol.querySelector('img').src = stop.photoSrc;
  const cap = pol.querySelector('.caption');
  cap.textContent = '';
  pol.querySelector('.meta').textContent = `${stop.station.short ?? stop.station.jp} · ${stop.day ?? ''}`;

  vf.classList.add('on');
  await wait(1100);
  sfx.shutter();
  flash.classList.remove('go');
  void flash.offsetWidth;
  flash.classList.add('go');
  await wait(180);
  vf.classList.remove('on');
  layer.classList.add('dim');
  stage.classList.remove('hidden');
  await wait(450);
  sfx.print();
  pol.classList.add('printing');
  await wait(1600);
  stage.classList.add('out');
  pol.classList.remove('printing');
  pol.classList.add('lifted');
  await wait(300);
  pol.classList.add('develop');
  await wait(900);
  for (const ch of stop.caption) {
    cap.textContent += ch;
    if (ch !== ' ') await wait(45);
  }
  await wait(400);
  keep.classList.remove('hidden');
  await new Promise((r) => { keep.onclick = (e) => { e.stopPropagation(); r(); }; });
  sfx.pop();
  keep.classList.add('hidden');
  const target = $('#album-btn').getBoundingClientRect();
  const rect = pol.getBoundingClientRect();
  const dx = target.left + target.width / 2 - (rect.left + rect.width / 2);
  const dy = target.top + target.height / 2 - (rect.top + rect.height / 2);
  pol.style.transform = `translate(${dx}px, ${dy}px) rotate(20deg) scale(.1)`;
  pol.classList.add('fly');
  layer.classList.remove('dim');
  await wait(700);
  layer.classList.add('hidden');
}

export function showTrainPanel(next) {
  const p = $('#train-panel'), a = p.querySelector('.a');
  p.classList.remove('hidden');
  const lines = [`次は　${next.station.short ?? next.station.jp}`, `Next  ${next.station.en}  ${next.station.badge}`];
  let i = 0;
  a.textContent = lines[0];
  clearInterval(showTrainPanel.timer);
  showTrainPanel.timer = setInterval(() => { i = (i + 1) % lines.length; a.textContent = lines[i]; }, 2000);
}
export function hideTrainPanel() {
  clearInterval(showTrainPanel.timer);
  $('#train-panel').classList.add('hidden');
}

export function showSkip(on, cb) {
  const b = $('#skip-btn');
  b.classList.toggle('hidden', !on);
  b.onclick = on ? (e) => { e.stopPropagation(); cb(); } : null;
}

function miniPolaroid(stop) {
  const d = document.createElement('div');
  d.className = 'mini-polaroid';
  const img = document.createElement('img');
  img.src = stop.photoSrc;
  const c = document.createElement('div');
  c.textContent = stop.caption;
  d.append(img, c);
  return d;
}

export function initAlbum(getCollected) {
  const album = $('#album');
  $('#album-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    const grid = album.querySelector('.grid');
    grid.replaceChildren(...getCollected().map(miniPolaroid));
    album.classList.remove('hidden');
  });
  album.addEventListener('click', () => album.classList.add('hidden'));
}

export function showIntro(title, ready, onStart) {
  $('#t-jp').textContent = title.jp;
  $('#t-en').textContent = title.en;
  startLantern($('#intro'));
  const btn = $('#start-btn');
  btn.disabled = true;
  ready.then(() => {
    btn.disabled = false;
    $('#intro .loading').textContent = '';
  });
  btn.onclick = () => {
    $('#intro').classList.add('hidden');
    onStart();
  };
}

export function showEnding(collected, ending) {
  const el = $('#ending'), wall = el.querySelector('.wall');
  el.classList.remove('hidden');
  el.querySelector('.jp').textContent = ending.jp;
  el.querySelector('.en').textContent = ending.en;
  el.querySelector('.note').textContent = ending.note;
  wall.replaceChildren();
  const spots = [[6, 6], [52, 4], [28, 22], [2, 38], [56, 30], [30, 48]];
  collected.forEach((stop, i) => {
    const p = miniPolaroid(stop);
    const [x, y] = spots[i % spots.length];
    p.style.left = x + '%';
    p.style.top = `calc(${y}% + env(safe-area-inset-top, 0px))`;
    p.style.setProperty('--r', `${(i % 2 ? 1 : -1) * (3 + ((i * 37) % 8))}deg`);
    p.style.animationDelay = `${0.5 + i * 0.6}s`;
    wall.appendChild(p);
  });
  $('#replay-btn').onclick = () => location.reload();
}

export function initMute(toggle) {
  const b = $('#mute-btn');
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    b.classList.toggle('off', toggle());
  });
}

// Placeholder polaroid art when a photo file is missing.
export function placeholderPhoto(stop) {
  const c = document.createElement('canvas');
  c.width = c.height = 600;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 600);
  gr.addColorStop(0, '#141a3a');
  gr.addColorStop(1, stop.station.color);
  g.fillStyle = gr;
  g.fillRect(0, 0, 600, 600);
  for (let i = 0; i < 70; i++) {
    g.fillStyle = `rgba(255,240,200,${Math.random() * 0.6})`;
    g.fillRect(Math.random() * 600, Math.random() * 380, 2, 2);
  }
  let x = 0;
  while (x < 600) {
    const w = 40 + Math.random() * 70, h = 120 + Math.random() * 220;
    g.fillStyle = 'rgba(10,10,24,.75)';
    g.fillRect(x, 600 - h, w, h);
    for (let wy = 600 - h + 10; wy < 590; wy += 18) for (let wx = x + 8; wx < x + w - 8; wx += 14) {
      if (Math.random() < 0.4) { g.fillStyle = '#ffd89a'; g.fillRect(wx, wy, 6, 9); }
    }
    x += w + 4;
  }
  g.fillStyle = '#fff8ea';
  g.textAlign = 'center';
  g.font = '900 120px "Zen Maru Gothic", sans-serif';
  g.fillText(stop.station.short ?? stop.station.jp, 300, 250);
  g.font = '700 46px Caveat, cursive';
  g.fillText('your photo here', 300, 320);
  return c.toDataURL('image/jpeg', 0.85);
}

export function loadPhotos(stops) {
  return Promise.all(stops.map((stop) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { stop.photoSrc = stop.photo; resolve(); };
    img.onerror = () => { stop.photoSrc = placeholderPhoto(stop); resolve(); };
    img.src = stop.photo;
  })));
}

export function adTextures(THREE, stop) {
  const ads = [
    ['東京', '#d9475a', 'Tokyo memories'],
    [stop.station.short ?? stop.station.jp, stop.station.color, stop.station.en],
    ['♥', '#2f4b7a', 'next stop: us'],
  ];
  return ads.map(([big, col, small]) => {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#fbf7ee';
    g.fillRect(0, 0, 256, 64);
    g.fillStyle = col;
    g.fillRect(0, 0, 10, 64);
    g.fillStyle = '#1d1b26';
    g.font = '900 32px "Zen Maru Gothic", sans-serif';
    g.textBaseline = 'middle';
    g.fillText(big, 22, 34);
    g.font = '700 22px Caveat, cursive';
    g.fillStyle = col;
    g.textAlign = 'right';
    g.fillText(small, 246, 36);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}
