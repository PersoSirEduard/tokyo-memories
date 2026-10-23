// Landmarks are built facing +z (toward the photo spot) around a local origin.
// Each returns { group, colliders (local), spotDist, focusY, lightColor, update? }.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { paperMat, glowMat, plateTexture, canvasTexture, radialTexture, JP_FONT } from './paper.js';
import { buildShiba, poseShiba } from './characters.js';

function add(parent, geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, typeof mat === 'number' ? paperMat(mat) : mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

function beam(a, b, t) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const g = new THREE.BoxGeometry(t, t, dir.length());
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.normalize()));
  const mid = a.clone().add(b).multiplyScalar(0.5);
  g.translate(mid.x, mid.y, mid.z);
  return g;
}

function plate(parent, lines, w, h, x, y, z, opts) {
  const tex = plateTexture(lines, opts);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.35 }));
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

export function tree(parent, x, z, s = 1, color = 0x3f6b4f) {
  add(parent, new THREE.CylinderGeometry(0.08 * s, 0.11 * s, 1.0 * s, 5), 0x5a4232, x, 0.5 * s, z);
  const c = add(parent, new THREE.IcosahedronGeometry(0.75 * s, 0), color, x, 1.45 * s, z);
  c.rotation.set(Math.random(), Math.random(), 0);
  const c2 = add(parent, new THREE.IcosahedronGeometry(0.5 * s, 0), color + 0x081008, x + 0.25 * s, 1.95 * s, z - 0.1 * s);
  c2.rotation.set(Math.random(), Math.random(), 0);
}

function chochin(parent, x, y, z, r = 0.22, color = 0xd8322a, text) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const pts = [];
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * Math.PI;
    pts.push(new THREE.Vector2(Math.sin(a) * r * 0.95 + 0.001, -Math.cos(a) * r * 1.35));
  }
  let mat;
  if (text) {
    const tex = canvasTexture(256, 128, (c) => {
      c.fillStyle = '#d8322a'; c.fillRect(0, 0, 256, 128);
      c.fillStyle = '#1c0d0a'; c.font = `900 52px ${JP_FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(text, 64, 64); c.fillText(text, 192, 64);
    });
    mat = new THREE.MeshLambertMaterial({ map: tex, emissive: 0xff5533, emissiveMap: tex, emissiveIntensity: 0.9 });
  } else {
    mat = glowMat(color, 1.25);
  }
  add(g, new THREE.LatheGeometry(pts, 10), mat);
  add(g, new THREE.CylinderGeometry(r * 0.55, r * 0.55, r * 0.18, 10), 0x1a1414, 0, r * 1.35, 0);
  add(g, new THREE.CylinderGeometry(r * 0.55, r * 0.55, r * 0.18, 10), 0x1a1414, 0, -r * 1.35, 0);
  parent.add(g);
  return g;
}
export { chochin };

// ---------------------------------------------------------------- Shibuya
function hachiko() {
  const g = new THREE.Group();
  add(g, new THREE.BoxGeometry(1.4, 1.0, 1.9), 0x8d8a86, 0, 0.5, 0);
  add(g, new THREE.BoxGeometry(1.6, 0.12, 2.1), 0x77746f, 0, 1.06, 0);
  add(g, new THREE.BoxGeometry(1.7, 0.15, 2.2), 0x77746f, 0, 0.075, 0);
  const statue = buildShiba({ statue: true });
  poseShiba(statue, { kind: 'sit', t: 0 });
  statue.root.scale.setScalar(2.3);
  statue.root.position.set(0, 1.12, 0.1);
  g.add(statue.root);
  plate(g, [{ text: '忠犬ハチ公', size: 64 }], 0.9, 0.24, 0, 0.62, 0.955, { w: 384, h: 96, bg: '#4c4a45', fg: '#e9e3d4' });
  // Low planters around the plaza
  for (const [x, z, w, d] of [[-4.5, -5.6, 4, 1.2], [4.5, -5.6, 4, 1.2], [-5.6, 1, 1.2, 5]]) {
    add(g, new THREE.BoxGeometry(w, 0.45, d), 0x6f6b66, x, 0.22, z);
    add(g, new THREE.BoxGeometry(w - 0.3, 0.5, d - 0.3), 0x3e6a48, x, 0.6, z);
  }
  return {
    group: g,
    colliders: [{ type: 'rect', x0: -0.95, x1: 0.95, z0: -1.2, z1: 1.2 }],
    spotDist: 4.2, focusY: 1.7, lightColor: 0xffd7a0,
  };
}

// ---------------------------------------------------------------- teamLab Borderless
function teamlab() {
  const g = new THREE.Group();
  add(g, new THREE.BoxGeometry(10, 4.6, 6), 0x1b1c26, 0, 2.3, -2.6);
  add(g, new THREE.BoxGeometry(10.4, 0.25, 6.4), 0x2a2b36, 0, 4.7, -2.6);
  const flow = new THREE.ShaderMaterial({
    uniforms: { t: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec2 vUv; uniform float t;
      void main(){
        vec2 p = vUv * vec2(6.0, 3.0);
        float a = sin(p.x * 1.3 + t * 0.8) + sin(p.y * 2.1 - t * 0.6) + sin((p.x + p.y) * 0.9 + t);
        vec3 col = 0.55 + 0.45 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + a * 0.22 + t * 0.04));
        float petals = smoothstep(0.92, 1.0, sin(p.x * 9.0 + t * 1.7) * sin(p.y * 11.0 - t * 1.3));
        gl_FragColor = vec4(col * 1.35 + petals * 1.2, 1.0);
      }`,
  });
  add(g, new THREE.PlaneGeometry(6, 3.2), flow, 0, 1.75, 0.41);
  plate(g, [{ text: 'teamLab Borderless', size: 54, font: '"Zen Maru Gothic", sans-serif' }], 4.2, 0.6, 0, 3.85, 0.42, { w: 512, h: 72, bg: '#1b1c26', fg: '#f3f1ff' });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(9, 6), new THREE.MeshBasicMaterial({ map: radialTexture(), color: 0x8f7bff, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(0, 0.03, 2.2);
  g.add(glow);

  const lamps = [];
  const stem = new THREE.CylinderGeometry(0.012, 0.012, 1, 3);
  const bulb = new THREE.IcosahedronGeometry(0.24, 1);
  for (let i = 0; i < 22; i++) {
    let x, z;
    do { x = (Math.random() - 0.5) * 12; z = 1.2 + Math.random() * 5.2; } while (Math.hypot(x, z - 5.5) < 1.9);
    const h = 1.2 + Math.random() * 1.6;
    add(g, stem, 0x111111, x, h / 2, z).scale.y = h;
    const m = new THREE.MeshBasicMaterial({ color: 0xffffff });
    add(g, bulb, m, x, h, z);
    lamps.push({ m, d: Math.hypot(x, z - 5.5) });
  }
  const col = new THREE.Color();
  return {
    group: g,
    colliders: [{ type: 'rect', x0: -5.1, x1: 5.1, z0: -5.7, z1: 0.5 }],
    spotDist: 5.5, focusY: 2.2, lightColor: 0xb59cff,
    update(t) {
      flow.uniforms.t.value = t;
      for (const l of lamps) {
        col.setHSL((t * 0.06 + l.d * 0.05) % 1, 0.85, 0.6);
        l.m.color.copy(col).multiplyScalar(1.7 + Math.sin(t * 2 - l.d) * 0.4);
      }
    },
  };
}

// ---------------------------------------------------------------- Tokyo Tower
function tokyoTower() {
  const g = new THREE.Group();
  const orange = [], white = [];
  const H = 20, levels = 10;
  const half = (y) => 0.5 + 2.9 * Math.pow(1 - y / H, 1.7);
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (let L = 0; L < levels; L++) {
    const y0 = (L / levels) * H, y1 = ((L + 1) / levels) * H;
    const h0 = half(y0), h1 = half(y1);
    const bucket = L % 3 === 2 ? white : orange;
    for (let c = 0; c < 4; c++) {
      const [ax, az] = corners[c], [bx, bz] = corners[(c + 1) % 4];
      const p0 = new THREE.Vector3(ax * h0, y0, az * h0), p1 = new THREE.Vector3(ax * h1, y1, az * h1);
      const q0 = new THREE.Vector3(bx * h0, y0, bz * h0), q1 = new THREE.Vector3(bx * h1, y1, bz * h1);
      bucket.push(beam(p0, p1, 0.22 - L * 0.012));
      bucket.push(beam(p1, q1, 0.1));
      bucket.push(beam(p0, q1, 0.06));
      bucket.push(beam(q0, p1, 0.06));
    }
  }
  const towerOrange = new THREE.MeshLambertMaterial({ color: 0xff5a1f, emissive: 0xff4a10, emissiveIntensity: 0.85, map: paperMat(0xffffff).map });
  const towerWhite = new THREE.MeshLambertMaterial({ color: 0xfff3e6, emissive: 0xffc890, emissiveIntensity: 0.7, map: paperMat(0xffffff).map });
  g.add(new THREE.Mesh(mergeGeometries(orange), towerOrange));
  g.add(new THREE.Mesh(mergeGeometries(white), towerWhite));
  const deck = (y, s, h) => {
    add(g, new THREE.BoxGeometry(s, h, s), towerWhite, 0, y, 0);
    add(g, new THREE.BoxGeometry(s + 0.05, h * 0.35, s + 0.05), glowMat(0xfff0c8, 1.3), 0, y, 0);
  };
  deck(8.6, 3.0, 1.1);
  deck(15.2, 1.6, 0.7);
  for (let i = 0; i < 6; i++) {
    add(g, new THREE.CylinderGeometry(0.16 - i * 0.022, 0.2 - i * 0.022, 1.2, 6), i % 2 ? towerWhite : towerOrange, 0, H + 0.6 + i * 1.2, 0);
  }
  add(g, new THREE.SphereGeometry(0.12, 6, 4), glowMat(0xff3030, 2.2), 0, H + 7.4, 0);
  add(g, new THREE.BoxGeometry(9, 1.8, 7), 0xe9e1d5, 0, 0.9, 0);
  plate(g, [{ text: 'TOKYO TOWER', size: 56 }], 3.6, 0.5, 0, 1.25, 3.52, { w: 512, h: 72, bg: '#e9e1d5', fg: '#c8401a' });
  return {
    group: g,
    colliders: [{ type: 'rect', x0: -4.6, x1: 4.6, z0: -3.6, z1: 3.6 }],
    spotDist: 7.0, focusY: 9, lightColor: 0xff8a40,
  };
}

// ---------------------------------------------------------------- DisneySea (AquaSphere)
function aquasphere() {
  const g = new THREE.Group();
  add(g, new THREE.CylinderGeometry(3.1, 3.3, 0.55, 18), 0xcfc4b2, 0, 0.27, 0);
  const water = new THREE.MeshLambertMaterial({ color: 0x3f8fc2, emissive: 0x1a5b8a, emissiveIntensity: 0.6, map: paperMat(0xffffff).map });
  add(g, new THREE.CylinderGeometry(2.8, 2.8, 0.1, 18), water, 0, 0.52, 0);
  add(g, new THREE.CylinderGeometry(0.5, 0.7, 1.4, 8), 0xbfb39f, 0, 1.2, 0);
  const globe = new THREE.Group();
  globe.position.y = 2.8;
  g.add(globe);
  add(globe, new THREE.IcosahedronGeometry(1.6, 2), new THREE.MeshLambertMaterial({ color: 0x8fc7e8, emissive: 0x2a6f9a, emissiveIntensity: 0.6, flatShading: true }));
  const lines = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.SphereGeometry(1.66, 14, 9)), new THREE.LineBasicMaterial({ color: new THREE.Color(0xffd27a).multiplyScalar(1.6) }));
  globe.add(lines);
  const ring = add(globe, new THREE.TorusGeometry(1.95, 0.05, 4, 32), glowMat(0xffd27a, 1.5));
  ring.rotation.x = Math.PI / 2 + 0.4;
  plate(g, [{ text: 'Tokyo DisneySea', size: 52, font: 'Caveat, cursive', weight: 700 }], 2.4, 0.42, 0, 0.3, 3.24, { w: 512, h: 90, bg: '#cfc4b2', fg: '#1f4c78' });
  const jets = [];
  const jetMat = new THREE.MeshBasicMaterial({ color: 0xcfefff, transparent: true, opacity: 0.55, depthWrite: false });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const m = add(g, new THREE.ConeGeometry(0.08, 1, 5), jetMat, Math.cos(a) * 2.3, 1.0, Math.sin(a) * 2.3);
    jets.push(m);
  }
  return {
    group: g,
    colliders: [{ type: 'circle', x: 0, z: 0, r: 3.3 }],
    spotDist: 5.4, focusY: 2.6, lightColor: 0x9fd8ff,
    update(t) {
      globe.rotation.y = t * 0.25;
      jets.forEach((j, i) => { j.scale.y = 0.8 + Math.sin(t * 3 + i) * 0.3; j.position.y = 0.55 + j.scale.y * 0.5; });
    },
  };
}

// ---------------------------------------------------------------- Nihombashi food stalls
function foodStalls() {
  const g = new THREE.Group();
  const stalls = [
    { x: 0, z: -1.8, r: 0, name: 'らーめん', noren: 0x22305a },
    { x: -3.1, z: 0.2, r: Math.PI / 2.6, name: 'おでん', noren: 0x6a2a2a },
    { x: 3.1, z: 0.2, r: -Math.PI / 2.6, name: 'やきとり', noren: 0x2a4a3a },
  ];
  const steam = [];
  const steamMat = new THREE.MeshBasicMaterial({ map: radialTexture(), color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false });
  const colliders = [];
  for (const s of stalls) {
    const st = new THREE.Group();
    st.position.set(s.x, 0, s.z);
    st.rotation.y = s.r;
    g.add(st);
    add(st, new THREE.BoxGeometry(2.3, 1.0, 1.1), 0x8a5a3a, 0, 0.5, 0);
    add(st, new THREE.BoxGeometry(2.5, 0.08, 1.3), 0xb07c52, 0, 1.04, 0.05);
    for (const x of [-1.1, 1.1]) add(st, new THREE.BoxGeometry(0.08, 1.4, 0.08), 0x5a3a26, x, 1.75, -0.4);
    const roof = add(st, new THREE.BoxGeometry(2.7, 0.08, 1.7), 0x3b2a22, 0, 2.5, 0.1);
    roof.rotation.x = 0.18;
    const tex = canvasTexture(256, 96, (c) => {
      c.fillStyle = '#' + s.noren.toString(16).padStart(6, '0'); c.fillRect(0, 0, 256, 96);
      c.fillStyle = 'rgba(0,0,0,0.35)';
      for (let i = 1; i < 4; i++) c.fillRect(i * 64 - 1, 0, 2, 96);
      c.fillStyle = '#f4efe4'; c.font = `900 40px ${JP_FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(s.name, 128, 46);
    });
    add(st, new THREE.PlaneGeometry(2.3, 0.6), new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide }), 0, 2.1, 0.62);
    for (const x of [-1.25, 1.25]) chochin(st, x, 1.85, 0.75, 0.2);
    for (const x of [-0.6, 0.6]) add(st, new THREE.CylinderGeometry(0.17, 0.17, 0.5, 8), 0x7a4a2a, x, 0.25, 1.0);
    add(st, new THREE.CylinderGeometry(0.22, 0.2, 0.25, 8), 0xd0d0d0, 0.4, 1.2, 0);
    for (let i = 0; i < 3; i++) {
      const sm = add(st, new THREE.PlaneGeometry(0.6, 0.6), steamMat, 0.4, 1.4, 0);
      steam.push({ m: sm, o: Math.random() * 3 });
    }
    const c = Math.cos(s.r), sn = Math.sin(s.r);
    const hw = Math.abs(1.25 * c) + Math.abs(0.75 * sn), hd = Math.abs(1.25 * sn) + Math.abs(0.75 * c);
    colliders.push({ type: 'rect', x0: s.x - hw, x1: s.x + hw, z0: s.z - hd, z1: s.z + hd });
  }
  // Nihonbashi bridge lamp post
  const lp = new THREE.Group();
  lp.position.set(-4.6, 0, -4.6);
  g.add(lp);
  add(lp, new THREE.BoxGeometry(1.2, 1.2, 1.2), 0x9a948a, 0, 0.6, 0);
  add(lp, new THREE.CylinderGeometry(0.16, 0.24, 3.2, 8), 0x3d4a3a, 0, 2.8, 0);
  for (const [x, z] of [[0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]]) {
    add(lp, new THREE.BoxGeometry(Math.abs(x) + 0.06, 0.06, Math.abs(z) + 0.06), 0x3d4a3a, x / 2, 4.0, z / 2);
    add(lp, new THREE.SphereGeometry(0.22, 8, 6), glowMat(0xfff0c8, 1.6), x, 4.2, z);
  }
  add(lp, new THREE.SphereGeometry(0.26, 8, 6), glowMat(0xfff0c8, 1.6), 0, 4.65, 0);
  colliders.push({ type: 'rect', x0: -5.3, x1: -3.9, z0: -5.3, z1: -3.9 });
  plate(g, [{ text: '日本橋', size: 70 }, { text: 'NIHONBASHI', size: 22 }], 1.4, 0.55, -4.6, 0.75, -3.99, { w: 256, h: 100, bg: '#9a948a', fg: '#2a2620' });
  return {
    group: g, colliders,
    spotDist: 3.6, focusY: 1.4, lightColor: 0xffa860,
    update(t) {
      for (const s of steam) {
        const k = ((t * 0.5 + s.o) % 1.5) / 1.5;
        s.m.position.y = 1.35 + k * 1.1;
        s.m.scale.setScalar(0.5 + k);
        s.m.material.opacity = 0.35;
      }
    },
  };
}

// ---------------------------------------------------------------- Asakusa / Sensō-ji
function sensoji() {
  const g = new THREE.Group();
  const red = 0xc0302a, roofC = 0x33343d;
  const gate = new THREE.Group();
  gate.position.z = 2.2;
  g.add(gate);
  add(gate, new THREE.BoxGeometry(6.6, 0.2, 2.8), 0x8a8478, 0, 0.1, 0);
  for (const x of [-2.4, -1.25, 1.25, 2.4]) for (const z of [-0.9, 0.9]) add(gate, new THREE.BoxGeometry(0.32, 4, 0.32), red, x, 2.0, z);
  add(gate, new THREE.BoxGeometry(5.6, 0.35, 2.2), red, 0, 3.9, 0);
  add(gate, new THREE.BoxGeometry(7.2, 0.25, 3.6), roofC, 0, 4.2, 0);
  const roof = add(gate, new THREE.ConeGeometry(3.2, 1.6, 4), roofC, 0, 5.1, 0);
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1.55, 1, 0.75);
  chochin(gate, 0, 2.35, 0, 0.62, red, '雷門');
  // Guardian niches
  for (const x of [-3.1, 3.1]) add(gate, new THREE.BoxGeometry(1.0, 3.4, 2.0), 0x9e2a24, x, 1.9, 0);
  // Nakamise stalls behind the gate
  const stallMat = [0xe8dcc4, 0xd9c8a8];
  for (let i = 0; i < 3; i++) {
    for (const x of [-2.3, 2.3]) {
      const z = -0.6 - i * 1.6;
      add(g, new THREE.BoxGeometry(1.4, 1.8, 1.4), stallMat[i % 2], x, 0.9, z);
      add(g, new THREE.BoxGeometry(1.7, 0.15, 1.7), roofC, x, 1.9, z);
      add(g, new THREE.PlaneGeometry(1.1, 0.7), glowMat(0xffd8a0, 1.2), x - Math.sign(x) * 0.71, 0.9, z).rotation.y = -Math.sign(x) * Math.PI / 2;
    }
  }
  // Five-storey pagoda
  const pg = new THREE.Group();
  pg.position.set(4.3, 0, -4.2);
  g.add(pg);
  for (let i = 0; i < 5; i++) {
    const s = 2.2 - i * 0.28, y = 0.6 + i * 1.5;
    add(pg, new THREE.BoxGeometry(s * 0.6, 1.1, s * 0.6), red, 0, y + 0.55, 0);
    const r = add(pg, new THREE.ConeGeometry(s * 0.85, 0.5, 4), roofC, 0, y + 1.3, 0);
    r.rotation.y = Math.PI / 4;
  }
  add(pg, new THREE.CylinderGeometry(0.05, 0.08, 2, 5), 0xc9a64a, 0, 9.4, 0);
  // Incense burner with smoke
  add(g, new THREE.CylinderGeometry(0.5, 0.6, 0.9, 8), 0x3a3a34, -3.2, 0.45, -3.4);
  const smokeMat = new THREE.MeshBasicMaterial({ map: radialTexture(), color: 0xddddee, transparent: true, opacity: 0.25, depthWrite: false });
  const smoke = [];
  for (let i = 0; i < 4; i++) smoke.push({ m: add(g, new THREE.PlaneGeometry(1, 1), smokeMat, -3.2, 1, -3.4), o: i * 0.5 });
  // Main hall roof hint at the back
  add(g, new THREE.BoxGeometry(7, 2.4, 1.6), red, -0.6, 1.2, -6.1);
  const hall = add(g, new THREE.ConeGeometry(4.4, 1.6, 4), roofC, -0.6, 3.2, -6.1);
  hall.rotation.y = Math.PI / 4;
  hall.scale.set(1.2, 1, 0.45);
  const colliders = [
    { type: 'rect', x0: -3.6, x1: -2.1, z0: 1.2, z1: 3.2 },
    { type: 'rect', x0: 2.1, x1: 3.6, z0: 1.2, z1: 3.2 },
    { type: 'rect', x0: -3.1, x1: -1.5, z0: -4.5, z1: 0.2 },
    { type: 'rect', x0: 1.5, x1: 3.1, z0: -4.5, z1: 0.2 },
    { type: 'rect', x0: 3.3, x1: 5.3, z0: -5.2, z1: -3.2 },
    { type: 'circle', x: -3.2, z: -3.4, r: 0.7 },
    { type: 'rect', x0: -4.2, x1: 3.0, z0: -7, z1: -5.2 },
  ];
  return {
    group: g, colliders,
    spotDist: 6.4, focusY: 2.6, lightColor: 0xff9a6a,
    update(t) {
      for (const s of smoke) {
        const k = ((t * 0.3 + s.o) % 2) / 2;
        s.m.position.set(-3.2 + Math.sin(t + s.o * 3) * 0.2, 1.1 + k * 2.2, -3.4);
        s.m.scale.setScalar(0.4 + k * 1.2);
      }
    },
  };
}

export function buildLandmark(kind) {
  switch (kind) {
    case 'hachiko': return hachiko();
    case 'teamlab': return teamlab();
    case 'tokyotower': return tokyoTower();
    case 'aquasphere': return aquasphere();
    case 'foodstalls': return foodStalls();
    case 'sensoji': return sensoji();
    default: throw new Error(`Unknown landmark ${kind}`);
  }
}

// Little two-storey house, front door on +z.
export function buildHome() {
  const g = new THREE.Group();
  add(g, new THREE.BoxGeometry(5, 2.6, 4.4), 0xefe6d6, 0, 1.3, 0);
  add(g, new THREE.BoxGeometry(5.6, 0.18, 5.0), 0x3a3a42, 0, 2.68, 0);
  add(g, new THREE.BoxGeometry(4.3, 2.0, 3.6), 0xe6dcc9, 0, 3.75, -0.2);
  const roof = add(g, new THREE.ConeGeometry(3.6, 1.5, 4), 0x3a3a42, 0, 5.5, -0.2);
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1, 1, 0.85);
  const shoji = canvasTexture(128, 192, (c) => {
    c.fillStyle = '#ffe2b0'; c.fillRect(0, 0, 128, 192);
    c.strokeStyle = '#6b4a2e'; c.lineWidth = 5;
    c.strokeRect(2, 2, 124, 188);
    for (let i = 1; i < 3; i++) { c.beginPath(); c.moveTo(i * 42.6, 0); c.lineTo(i * 42.6, 192); c.stroke(); }
    for (let i = 1; i < 5; i++) { c.beginPath(); c.moveTo(0, i * 38); c.lineTo(128, i * 38); c.stroke(); }
  });
  const shojiMat = new THREE.MeshBasicMaterial({ map: shoji, color: new THREE.Color(1.5, 1.4, 1.2) });
  add(g, new THREE.PlaneGeometry(1.4, 2.0), shojiMat, 0, 1.0, 2.21);
  for (const x of [-1.7, 1.7]) add(g, new THREE.PlaneGeometry(0.9, 0.8), shojiMat, x, 1.5, 2.21);
  add(g, new THREE.PlaneGeometry(1.2, 0.6), shojiMat, 0, 3.9, 1.61);
  add(g, new THREE.BoxGeometry(1.8, 0.08, 0.8), 0x3a3a42, 0, 2.15, 2.5);
  chochin(g, 1.05, 1.7, 2.4, 0.16, 0xffb060);
  for (const x of [-1.4, 1.6]) {
    add(g, new THREE.CylinderGeometry(0.2, 0.16, 0.35, 7), 0x8a5a3a, x, 0.17, 2.6);
    add(g, new THREE.IcosahedronGeometry(0.3, 0), 0x4b7a50, x, 0.5, 2.6);
  }
  plate(g, [{ text: 'ただいま', size: 52 }], 0.8, 0.22, -0.95, 1.6, 2.22, { w: 256, h: 70, bg: '#6b4a2e', fg: '#ffe9c4' });
  return { group: g };
}
