// One stage = a 3x3 grid of city blocks at night, a station entrance, a landmark plaza
// and (on the last stop) home. Also owns collisions and grid pathfinding for the shiba.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { paperMat, glowMat, paperTexture, windowTextures, signTexture, plateTexture, canvasTexture, radialTexture, makeRng, disposeTree, roundRect, JP_FONT } from './paper.js';
import { buildLandmark, buildHome, tree, chochin } from './landmarks.js';
import { STEP } from './characters.js';
import { applyBuildingFade } from './cutaway.js';

export const BLOCKS = [-22, 0, 22];
const HALF = 7;
export const BOUND = 36;
const FACES = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
const SIGN_WORDS = ['ラーメン', 'カラオケ', '居酒屋', '寿司', '喫茶', '焼鳥', 'バー', '本屋', 'ホテル', '酒場', 'うどん', '珈琲', 'ゲーム', '薬'];
const NEON = ['#ff4f8b', '#4fd6ff', '#ffb347', '#b78cff', '#6dff9e', '#ff6a4f'];

function boxWithUV(w, h, d, span, ou = 0, ov = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const face = Math.floor(i / 4);
    let u = uv.getX(i), v = uv.getY(i);
    if (face === 2 || face === 3) { u = 0.004; v = 0.004; }
    else if (face < 2) { u = u * d / span + ou; v = v * h / span + ov; }
    else { u = u * w / span + ou; v = v * h / span + ov; }
    uv.setXY(i, u, v);
  }
  return g;
}
function flatUV(g) {
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.004, 0.004);
  return g;
}
const _c = new THREE.Color();
function paint(g, color) {
  _c.set(color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = _c.r; arr[i * 3 + 1] = _c.g; arr[i * 3 + 2] = _c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

// Every vertex carries its building's index so the shader can look up how faded that
// building is (buildings between the camera and the player fade out).
function tag(g, b) {
  const n = g.attributes.position.count;
  g.setAttribute('aId', new THREE.BufferAttribute(new Float32Array(n).fill(b.id), 1));
  return g;
}
function tagLines(lines, list) {
  const pos = lines.attributes.position, n = pos.count;
  const ids = new Float32Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const b = list.find((q) => Math.abs(x - q.x) <= q.w / 2 + 0.25 && Math.abs(z - q.z) <= q.d / 2 + 0.25 && y <= q.h + 1.6);
    if (b) ids[i] = b.id;
  }
  lines.setAttribute('aId', new THREE.BufferAttribute(ids, 1));
  return lines;
}

function rotXZ(x, z, r) {
  const c = Math.cos(r), s = Math.sin(r);
  return [x * c + z * s, -x * s + z * c];
}

export function buildStage(stop, index, isFinal) {
  const rnd = makeRng(index * 977 + 13);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const theme = stop.city;
  const group = new THREE.Group();
  const colliders = [];
  const updaters = [];
  const buildings = [];
  const avoid = [];
  const keep = [];

  const blockC = (bi, bj) => new THREE.Vector3(BLOCKS[bi], 0, BLOCKS[bj]);
  const v3 = (n) => new THREE.Vector3(n[0], 0, n[1]);

  // ---- key locations
  const [sbi, sbj, sface] = stop.layout.station;
  const sc = blockC(sbi, sbj), sn = v3(FACES[sface]);
  const stationPos = sc.clone().addScaledVector(sn, HALF - 1.7);
  const spawn = sc.clone().addScaledVector(sn, HALF + 2.2);
  const stationRot = Math.atan2(sn.x, sn.z);
  avoid.push({ x: stationPos.x, z: stationPos.z, r: 2.6 });
  keep.push(spawn);

  const [pbi, pbj] = stop.layout.plaza;
  const plazaC = blockC(pbi, pbj);
  const toSt = spawn.clone().sub(plazaC);
  const spotDir = Math.abs(toSt.x) > Math.abs(toSt.z) ? new THREE.Vector3(Math.sign(toSt.x), 0, 0) : new THREE.Vector3(0, 0, Math.sign(toSt.z));
  const lm = buildLandmark(stop.landmark);
  const lmRot = Math.atan2(spotDir.x, spotDir.z);
  lm.group.position.copy(plazaC);
  lm.group.rotation.y = lmRot;
  group.add(lm.group);
  for (const c of lm.colliders) addLocalCollider(c, plazaC, lmRot);
  const spot = plazaC.clone().addScaledVector(spotDir, lm.spotDist);
  const focus = plazaC.clone().setY(lm.focusY);
  if (lm.update) updaters.push(lm.update);
  keep.push(spot);

  let homeDoor = null, homeBlock = null;
  if (isFinal && stop.layout.home) {
    const [hbi, hbj, hface] = stop.layout.home;
    const hc = blockC(hbi, hbj), hn = v3(FACES[hface]);
    const h = buildHome();
    const hp = hc.clone().addScaledVector(hn, HALF - 2.6);
    h.group.position.copy(hp);
    h.group.rotation.y = Math.atan2(hn.x, hn.z);
    group.add(h.group);
    homeDoor = hc.clone().addScaledVector(hn, HALF + 1.8);
    avoid.push({ x: hp.x, z: hp.z, r: 3.6 });
    keep.push(homeDoor);
    homeBlock = [hbi, hbj];
  }

  function addLocalCollider(c, origin, rot) {
    if (c.type === 'circle') {
      const [x, z] = rotXZ(c.x, c.z, rot);
      colliders.push({ type: 'circle', x: origin.x + x, z: origin.z + z, r: c.r });
    } else {
      const a = rotXZ(c.x0, c.z0, rot), b = rotXZ(c.x1, c.z1, rot);
      colliders.push({ type: 'rect', x0: origin.x + Math.min(a[0], b[0]), x1: origin.x + Math.max(a[0], b[0]), z0: origin.z + Math.min(a[1], b[1]), z1: origin.z + Math.max(a[1], b[1]) });
    }
  }
  const nearKeep = (x, z, r) => keep.some((k) => Math.hypot(k.x - x, k.z - z) < r) || avoid.some((a) => Math.hypot(a.x - x, a.z - z) < a.r + r * 0.5);

  // ---- ground, sidewalks, road markings
  const gt = paperTexture().clone();
  gt.repeat.set(36, 36);
  gt.needsUpdate = true;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshLambertMaterial({ color: theme.warm ? 0x6b5a50 : 0x33354a, map: gt }));
  ground.rotation.x = -Math.PI / 2;
  group.add(ground);

  const walkGeos = [], plazaGeos = [], markGeos = [];
  const plane = (w, d, x, z, y = 0.01, rot = 0) => {
    const g = new THREE.PlaneGeometry(w, d);
    g.rotateX(-Math.PI / 2);
    if (rot) g.rotateY(rot);
    g.translate(x, y, z);
    return g;
  };
  for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++) {
    walkGeos.push(plane(16, 16, BLOCKS[i], BLOCKS[k], 0.012));
    if (i === pbi && k === pbj) plazaGeos.push(plane(14, 14, BLOCKS[i], BLOCKS[k], 0.02));
  }
  plazaGeos.push(plane(4.6, 4.6, stationPos.x, stationPos.z, 0.022));
  group.add(new THREE.Mesh(mergeGeometries(walkGeos), paperMat(theme.warm ? 0xa08c7c : 0x5a5d70)));
  group.add(new THREE.Mesh(mergeGeometries(plazaGeos), paperMat(theme.warm ? 0xcbb79f : 0x77778a)));

  const inner = [-11, 11];
  for (const ix of inner) for (const iz of inner) {
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const cx = ix + dx * 4.1, cz = iz + dz * 4.1;
      for (let s = -2.5; s <= 2.5; s += 0.9) {
        markGeos.push(dx ? plane(1.5, 0.45, cx, cz + s, 0.025) : plane(0.45, 1.5, cx + s, cz, 0.025));
      }
    }
  }
  if (theme.scramble) {
    for (const r of [Math.PI / 4, -Math.PI / 4]) for (let s = -3.2; s <= 3.2; s += 0.9) {
      const [ox, oz] = rotXZ(s, 0, r);
      markGeos.push(plane(0.45, 1.3, 11 + ox, 11 + oz, 0.026, r));
    }
  }
  for (const line of [-11, 11, -33, 33]) {
    for (let t = -33; t <= 33; t += 2.2) {
      if (inner.concat([-33, 33]).some((i) => Math.abs(t - i) < 4.6)) continue;
      markGeos.push(plane(0.15, 1.0, line, t, 0.024));
      markGeos.push(plane(1.0, 0.15, t, line, 0.024));
    }
  }
  group.add(new THREE.Mesh(mergeGeometries(markGeos), paperMat(0xd9d4c6)));

  // ---- buildings
  const splits = (a, b, n) => {
    const cuts = [a];
    for (let i = 1; i < n; i++) cuts.push(a + ((b - a) * i) / n + (rnd() - 0.5) * 2);
    cuts.push(b);
    return cuts;
  };
  const [h0, h1] = theme.heights;
  function fillBlock(cx, cz) {
    const xs = splits(cx - HALF, cx + HALF, 2 + (rnd() < 0.5 ? 1 : 0));
    const zs = splits(cz - HALF, cz + HALF, 2 + (rnd() < 0.5 ? 1 : 0));
    for (let i = 0; i < xs.length - 1; i++) for (let k = 0; k < zs.length - 1; k++) {
      const x0 = xs[i] + 0.2, x1 = xs[i + 1] - 0.2, z0 = zs[k] + 0.2, z1 = zs[k + 1] - 0.2;
      const bx = (x0 + x1) / 2, bz = (z0 + z1) / 2;
      if (avoid.some((a) => Math.max(Math.abs(bx - a.x) - (x1 - x0) / 2, Math.abs(bz - a.z) - (z1 - z0) / 2) < a.r)) continue;
      buildings.push({ x: bx, z: bz, w: x1 - x0, d: z1 - z0, h: h0 + (h1 - h0) * Math.pow(rnd(), 1.3), color: pick(theme.palette), roof: theme.roofs ? pick(theme.roofs) : null, tex: rnd() < 0.5 ? 0 : 1 });
    }
    colliders.push({ type: 'rect', x0: cx - HALF, x1: cx + HALF, z0: cz - HALF, z1: cz + HALF });
  }
  const buildingBlocks = [];
  for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++) {
    if (i === pbi && k === pbj) continue;
    if (theme.lagoon && i === 1 && k === 1) continue;
    fillBlock(BLOCKS[i], BLOCKS[k]);
    buildingBlocks.push([i, k]);
  }
  // Backdrop ring outside the playable area
  for (let x = -76; x <= 76; x += 9) for (let z = -76; z <= 76; z += 9) {
    if (Math.max(Math.abs(x), Math.abs(z)) < 40) continue;
    if (theme.lagoon && z < -45) continue;
    const w = 5 + rnd() * 2.5, d = 5 + rnd() * 2.5;
    buildings.push({ x: x + (rnd() - 0.5), z: z + (rnd() - 0.5), w, d, h: (h0 + (h1 - h0) * rnd()) * 1.25, color: pick(theme.palette), roof: theme.roofs ? pick(theme.roofs) : null, tex: rnd() < 0.5 ? 0 : 1 });
  }
  if (theme.mori) buildings.push({ x: plazaC.x + 2, z: -52, w: 12, d: 12, h: 64, color: '#c9d2dc', tex: 0 });

  const texSets = [windowTextures(rnd, theme), windowTextures(rnd, theme)];
  buildings.forEach((b, i) => { b.id = i; b.fade = 0; });
  const fadeData = new Uint8Array(buildings.length * 4);
  const fadeTex = new THREE.DataTexture(fadeData, buildings.length, 1);
  fadeTex.needsUpdate = true;
  const fade = { tex: { value: fadeTex }, width: { value: buildings.length } };
  const geoSets = [[], []], listSets = [[], []];
  for (const b of buildings) {
    listSets[b.tex].push(b);
    const g = boxWithUV(b.w, b.h, b.d, 12, Math.floor(rnd() * 8) / 8, Math.floor(rnd() * 8) / 8);
    g.translate(b.x, b.h / 2, b.z);
    geoSets[b.tex].push(tag(paint(g, b.color), b));
    if (b.roof) {
      const r = flatUV(new THREE.BoxGeometry(b.w + 0.4, 0.35, b.d + 0.4));
      r.translate(b.x, b.h + 0.17, b.z);
      geoSets[b.tex].push(tag(paint(r, b.roof), b));
    } else {
      const n = b.h > 5 ? Math.floor(rnd() * 3) : 0;
      for (let i = 0; i < n; i++) {
        const pw = 0.5 + rnd() * 0.9, ph = 0.35 + rnd() * 0.7, pd = 0.5 + rnd() * 0.9;
        const p = flatUV(new THREE.BoxGeometry(pw, ph, pd));
        p.translate(b.x + (rnd() - 0.5) * (b.w - pw), b.h + ph / 2, b.z + (rnd() - 0.5) * (b.d - pd));
        geoSets[b.tex].push(tag(paint(p, '#8d8f99'), b));
      }
    }
  }
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x0c0e1c, transparent: true, opacity: 0.55 });
  applyBuildingFade(edgeMat, fade);
  geoSets.forEach((list, i) => {
    if (!list.length) return;
    const geo = mergeGeometries(list);
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, map: texSets[i].map, emissive: 0xffffff, emissiveMap: texSets[i].emissiveMap, emissiveIntensity: 1.15 });
    applyBuildingFade(mat, fade);
    group.add(new THREE.Mesh(geo, mat));
    group.add(new THREE.LineSegments(tagLines(new THREE.EdgesGeometry(geo, 30), listSets[i]), edgeMat));
  });

  // ---- station entrance
  group.add(buildStation(stop.station, stationPos, stationRot));

  // ---- neon signs
  const signCache = new Map();
  const flicker = [];
  for (const [i, k] of buildingBlocks) {
    const cx = BLOCKS[i], cz = BLOCKS[k];
    for (const f of Object.values(FACES)) {
      const n = v3(f), tg = new THREE.Vector3(-n.z, 0, n.x);
      for (let s = 0; s < 2; s++) {
        if (rnd() > theme.neon) continue;
        const t = (rnd() - 0.5) * 10;
        const base = new THREE.Vector3(cx, 0, cz).addScaledVector(n, HALF).addScaledVector(tg, t);
        if (nearKeep(base.x, base.z, 3)) continue;
        const word = pick(SIGN_WORDS), col = pick(NEON);
        const key = word + col;
        if (!signCache.has(key)) signCache.set(key, new THREE.MeshBasicMaterial({ map: signTexture(word, col), color: new THREE.Color(1.5, 1.5, 1.5), side: THREE.DoubleSide }));
        const mat = signCache.get(key);
        const sh = 0.55 * [...word].length + 0.4;
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.62, sh), mat);
        m.position.copy(base).addScaledVector(n, 0.12).setY(2.6 + rnd() * 3.2);
        m.rotation.y = Math.atan2(tg.x, tg.z);
        group.add(m);
        if (rnd() < 0.2) flicker.push(m);
      }
    }
  }
  if (flicker.length) {
    updaters.push((t) => { for (const [i, m] of flicker.entries()) m.visible = Math.sin(t * 13 + i * 7) + Math.sin(t * 3.1 + i) > -1.6; });
  }

  // ---- giant screens around the scramble
  if (theme.screens) {
    const screens = [[1, 1, 's', 3], [2, 1, 's', -3], [1, 2, 'e', -3]];
    for (const [i, k, f, t] of screens) {
      if (!buildingBlocks.some(([a, b]) => a === i && b === k)) continue;
      const n = v3(FACES[f]), tg = new THREE.Vector3(-n.z, 0, n.x);
      const c = document.createElement('canvas');
      c.width = 192; c.height = 112;
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.45), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.4, 1.4, 1.4) }));
      m.position.set(BLOCKS[i], 6.5 + rnd() * 2, BLOCKS[k]).addScaledVector(n, HALF - 0.05).addScaledVector(tg, t);
      m.rotation.y = Math.atan2(n.x, n.z);
      group.add(m);
      const words = ['SHIBUYA', '渋谷', 'TOKYO', '♥', 'ハチ公'];
      let last = -1;
      const seed = rnd() * 10;
      updaters.push((time) => {
        const frame = Math.floor(time * 1.5 + seed);
        if (frame === last) return;
        last = frame;
        const g = c.getContext('2d');
        const hue = (frame * 47 + seed * 30) % 360;
        const gr = g.createLinearGradient(0, 0, 192, 112);
        gr.addColorStop(0, `hsl(${hue},80%,55%)`);
        gr.addColorStop(1, `hsl(${(hue + 80) % 360},80%,35%)`);
        g.fillStyle = gr;
        g.fillRect(0, 0, 192, 112);
        g.fillStyle = '#fff';
        g.font = `900 34px ${JP_FONT}`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(words[frame % words.length], 96, 58);
        tex.needsUpdate = true;
      });
    }
  }

  // ---- street lamps with fake light pools
  const poleGeos = [], bulbGeos = [], poolGeos = [];
  const allBlocks = [];
  for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++) allBlocks.push([i, k]);
  for (const [i, k] of allBlocks) {
    for (const f of Object.values(FACES)) {
      const n = v3(f), tg = new THREE.Vector3(-n.z, 0, n.x);
      for (const t of [-5, 1.5]) {
        const p = new THREE.Vector3(BLOCKS[i], 0, BLOCKS[k]).addScaledVector(n, HALF + 0.65).addScaledVector(tg, t);
        if (nearKeep(p.x, p.z, 2.2)) continue;
        const pole = new THREE.CylinderGeometry(0.045, 0.06, 3.2, 5);
        pole.translate(p.x, 1.6, p.z);
        poleGeos.push(flatUV(pole));
        const bulb = new THREE.SphereGeometry(0.17, 6, 4);
        bulb.translate(p.x, 3.25, p.z);
        bulbGeos.push(bulb);
        poolGeos.push(plane(4.2, 4.2, p.x, p.z, 0.03));
        colliders.push({ type: 'circle', x: p.x, z: p.z, r: 0.15 });
      }
    }
  }
  const lampColor = theme.cool ? 0xe8f0ff : 0xffd9a0;
  group.add(new THREE.Mesh(mergeGeometries(poleGeos), paperMat(0x2a2b34)));
  group.add(new THREE.Mesh(mergeGeometries(bulbGeos), glowMat(lampColor, 2.2)));
  group.add(new THREE.Mesh(mergeGeometries(poolGeos), new THREE.MeshBasicMaterial({ map: radialTexture(), color: new THREE.Color(lampColor).multiplyScalar(0.3), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));

  // ---- utility poles and sagging wires
  if (theme.wires) {
    const wire = [];
    const poles = [];
    const runs = [
      (t) => new THREE.Vector3(14.7, 0, t),
      (t) => new THREE.Vector3(t, 0, -14.7),
    ];
    for (const run of runs) {
      let prev = null;
      for (const t of [-27.5, -16.5, -5.5, 5.5, 16.5, 27.5]) {
        const p = run(t);
        if (nearKeep(p.x, p.z, 2.4) || (Math.abs(p.x - plazaC.x) < 8 && Math.abs(p.z - plazaC.z) < 8)) { prev = null; continue; }
        const pole = new THREE.CylinderGeometry(0.07, 0.1, 6.2, 5);
        pole.translate(p.x, 3.1, p.z);
        poles.push(flatUV(pole));
        const bar = new THREE.BoxGeometry(1.2, 0.08, 0.08);
        if (Math.abs(p.x - 14.7) < 0.01) bar.rotateY(Math.PI / 2);
        bar.translate(p.x, 5.7, p.z);
        poles.push(flatUV(bar));
        colliders.push({ type: 'circle', x: p.x, z: p.z, r: 0.18 });
        if (prev) {
          for (const off of [-0.5, 0, 0.5]) {
            const o = Math.abs(p.x - 14.7) < 0.01 ? new THREE.Vector3(off, 0, 0) : new THREE.Vector3(0, 0, off);
            const a = prev.clone().add(o).setY(5.75), b = p.clone().add(o).setY(5.75);
            for (let s = 0; s < 8; s++) {
              const t0 = s / 8, t1 = (s + 1) / 8;
              const q0 = a.clone().lerp(b, t0); q0.y -= Math.sin(t0 * Math.PI) * 0.6;
              const q1 = a.clone().lerp(b, t1); q1.y -= Math.sin(t1 * Math.PI) * 0.6;
              wire.push(q0, q1);
            }
          }
        }
        prev = p;
      }
    }
    if (poles.length) group.add(new THREE.Mesh(mergeGeometries(poles), paperMat(0x4a4744)));
    if (wire.length) group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(wire), new THREE.LineBasicMaterial({ color: 0x0b0b12 })));
  }

  // ---- vending machines
  const vendTex = canvasTexture(64, 128, (g) => {
    g.fillStyle = '#f4f8ff'; g.fillRect(0, 0, 64, 128);
    const cols = ['#e8413a', '#3a8ee8', '#f2b233', '#3ac27a', '#9a5ae8'];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      g.fillStyle = cols[(r * 3 + c) % cols.length];
      g.fillRect(6 + c * 14, 10 + r * 20, 9, 15);
    }
    g.fillStyle = '#20232e'; g.fillRect(8, 98, 48, 18);
  });
  const vendMat = new THREE.MeshBasicMaterial({ map: vendTex, color: new THREE.Color(1.25, 1.25, 1.25) });
  let vends = 0;
  for (const [i, k] of buildingBlocks) {
    if (vends >= 6) break;
    const f = pick(Object.values(FACES)), n = v3(f), tg = new THREE.Vector3(-n.z, 0, n.x);
    const p = new THREE.Vector3(BLOCKS[i], 0, BLOCKS[k]).addScaledVector(n, HALF - 0.1).addScaledVector(tg, (rnd() - 0.5) * 8);
    if (nearKeep(p.x, p.z, 3)) continue;
    const vg = new THREE.Group();
    vg.position.copy(p);
    vg.rotation.y = Math.atan2(n.x, n.z);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.55, 0.6), paperMat(pick([0xe8413a, 0x2f6fd0, 0xf2f2f2])));
    body.position.set(0, 0.78, 0.3);
    vg.add(body);
    const front = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 1.3), vendMat);
    front.position.set(0, 0.82, 0.61);
    vg.add(front);
    group.add(vg);
    vends++;
  }

  // ---- red lantern strings
  if (theme.lanterns) {
    const lanternGeos = [];
    const lg = new THREE.SphereGeometry(0.16, 6, 5);
    lg.scale(1, 1.3, 1);
    for (const [i, k] of buildingBlocks) for (const f of Object.values(FACES)) {
      if (rnd() > 0.45) continue;
      const n = v3(f), tg = new THREE.Vector3(-n.z, 0, n.x);
      for (let t = -6; t <= 6; t += 1.2) {
        const p = new THREE.Vector3(BLOCKS[i], 0, BLOCKS[k]).addScaledVector(n, HALF + 0.15).addScaledVector(tg, t);
        if (nearKeep(p.x, p.z, 2.5)) continue;
        lanternGeos.push(lg.clone().translate(p.x, 2.7 - Math.sin(((t + 6) / 12) * Math.PI * 3) * 0.08, p.z));
      }
    }
    if (lanternGeos.length) group.add(new THREE.Mesh(mergeGeometries(lanternGeos), glowMat(0xff4530, 1.5)));
  }

  // ---- plaza trees
  for (const [x, z] of [[5.7, 5.7], [-5.7, 5.7], [5.7, -5.7], [-5.7, -5.7]]) {
    const p = plazaC.clone().add(new THREE.Vector3(x, 0, z));
    if (nearKeep(p.x, p.z, 2.5) || colliders.some((c) => c.type === 'rect' && p.x > c.x0 - 0.6 && p.x < c.x1 + 0.6 && p.z > c.z0 - 0.6 && p.z < c.z1 + 0.6)) continue;
    tree(group, p.x, p.z, 1.1, theme.cool ? 0x3c6a62 : 0x3f6b4f);
    colliders.push({ type: 'circle', x: p.x, z: p.z, r: 0.45 });
  }

  // ---- theme set pieces
  if (theme.lagoon) {
    const water = new THREE.Mesh(new THREE.PlaneGeometry(13, 13), new THREE.MeshLambertMaterial({ color: 0x2f7fb8, emissive: 0x153f66, map: gt }));
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, 0.04, 0);
    group.add(water);
    const rim = [];
    for (const [w, d, x, z] of [[14, 0.5, 0, 6.75], [14, 0.5, 0, -6.75], [0.5, 14, 6.75, 0], [0.5, 14, -6.75, 0]]) {
      const g = new THREE.BoxGeometry(w, 0.4, d);
      g.translate(x, 0.2, z);
      rim.push(g);
    }
    group.add(new THREE.Mesh(mergeGeometries(rim), paperMat(0xd8ccb8)));
    colliders.push({ type: 'rect', x0: -HALF, x1: HALF, z0: -HALF, z1: HALF });
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1, 0.35, 2.4), paperMat(0x7a4a2e));
    hull.position.y = 0.2;
    boat.add(hull);
    chochin(boat, 0, 0.9, 0.9, 0.12, 0xffc070);
    group.add(boat);
    updaters.push((t) => { boat.position.set(Math.cos(t * 0.2) * 3.5, 0, Math.sin(t * 0.2) * 3.5); boat.rotation.y = -t * 0.2; });
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(200, 60), new THREE.MeshLambertMaterial({ color: 0x1d4f7a, emissive: 0x0c2a48, map: gt }));
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(0, 0.03, -75);
    group.add(sea);
  }
  if (theme.volcano) {
    const v = new THREE.Group();
    v.position.set(-30, 0, -78);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(26, 30, 9, 1, true), new THREE.MeshLambertMaterial({ color: 0x8a4a3a, map: paperTexture(), flatShading: true, fog: false }));
    cone.position.y = 15;
    v.add(cone);
    const crater = new THREE.Mesh(new THREE.CylinderGeometry(4, 5, 1, 9), glowMat(0xff7a2a, 1.6));
    crater.position.y = 26.5;
    v.add(crater);
    const smokeMat = new THREE.MeshBasicMaterial({ map: radialTexture(), color: 0x887a8a, transparent: true, opacity: 0.35, depthWrite: false, fog: false });
    const puffs = [];
    for (let i = 0; i < 5; i++) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), smokeMat);
      v.add(p);
      puffs.push({ p, o: i / 5 });
    }
    group.add(v);
    updaters.push((t) => {
      for (const { p, o } of puffs) {
        const k = (t * 0.06 + o) % 1;
        p.position.set(Math.sin(k * 4) * 3, 28 + k * 14, 0);
        p.scale.setScalar(5 + k * 14);
      }
    });
  }
  if (theme.skytree) {
    const st = new THREE.Group();
    st.position.set(30, 0, -95);
    const mat = new THREE.MeshLambertMaterial({ color: 0xdfe6f2, emissive: 0x6f7fd8, emissiveIntensity: 0.6, fog: false, flatShading: true });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 3.2, 62, 6), mat);
    shaft.position.y = 31;
    st.add(shaft);
    for (const [y, r] of [[40, 3.2], [50, 2.2]]) {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1.6, 10), glowMat(0x9ab8ff, 1.6));
      ring.position.y = y;
      ring.material = ring.material.clone();
      ring.material.fog = false;
      st.add(ring);
    }
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.6, 14, 5), mat);
    spire.position.y = 69;
    st.add(spire);
    group.add(st);
  }
  if (theme.expressway) {
    const deck = [];
    const d = new THREE.BoxGeometry(160, 0.8, 5);
    d.translate(0, 7, -40);
    deck.push(flatUV(d));
    for (let x = -70; x <= 70; x += 10) {
      const p = new THREE.BoxGeometry(1, 7, 1);
      p.translate(x, 3.5, -40);
      deck.push(flatUV(p));
    }
    group.add(new THREE.Mesh(mergeGeometries(deck), paperMat(0x6c6d78)));
  }

  // ---- ambient pedestrians on sidewalks (stop-motion too)
  const walkers = [];
  const walkerCols = [0xd9c6a5, 0x7a8fb0, 0xc77a7a, 0x8fb08a, 0xe0e0e0, 0x3a3a48, 0xb59ad0];
  for (let n = 0; n < 12; n++) {
    const fig = new THREE.Group();
    const col = pick(walkerCols);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.18, 0.6, 6), paperMat(col));
    body.position.y = 0.85;
    fig.add(body);
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 0), paperMat(0xe8c8ac));
    head.position.y = 1.3;
    fig.add(head);
    const legs = [];
    for (const s of [-1, 1]) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.55, 0.09), paperMat(0x2e2e38));
      l.geometry.translate(0, -0.275, 0);
      l.position.set(s * 0.07, 0.56, 0);
      fig.add(l);
      legs.push(l);
    }
    if (rnd() < 0.35) {
      const umb = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.25, 8), paperMat(pick([0xffffff, 0xd9475a, 0x2f4b7a])));
      umb.position.y = 1.75;
      fig.add(umb);
    }
    const vertical = rnd() < 0.5;
    const line = pick([-11, 11]) + pick([-3.6, 3.6]);
    const w = { fig, legs, vertical, line, t: (rnd() - 0.5) * 64, dir: rnd() < 0.5 ? 1 : -1, speed: 0.9 + rnd() * 0.7, acc: 0, phase: 0 };
    group.add(fig);
    walkers.push(w);
  }
  updaters.push((t, dt) => {
    for (const w of walkers) {
      w.t += w.dir * w.speed * dt;
      if (Math.abs(w.t) > 34) w.dir *= -1;
      w.phase += dt * 7;
      w.acc += dt;
      if (w.acc < STEP) continue;
      w.acc = 0;
      if (w.vertical) { w.fig.position.set(w.line, 0, w.t); w.fig.rotation.y = w.dir > 0 ? 0 : Math.PI; }
      else { w.fig.position.set(w.t, 0, w.line); w.fig.rotation.y = w.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
      w.legs[0].rotation.x = Math.sin(w.phase) * 0.5;
      w.legs[1].rotation.x = -Math.sin(w.phase) * 0.5;
    }
  });

  // ---- markers for goals
  const markers = {
    spot: makeMarker('camera', '#ffd36a'),
    station: makeMarker('train', stop.station.color),
    home: makeMarker('home', '#ffb27a'),
  };
  markers.spot.group.position.copy(spot);
  markers.station.group.position.copy(spawn);
  if (homeDoor) markers.home.group.position.copy(homeDoor);
  for (const m of Object.values(markers)) { m.group.visible = false; group.add(m.group); updaters.push(m.update); }

  // ---- collisions and pathfinding
  function blocked(x, z, r) {
    if (Math.abs(x) > BOUND - r || Math.abs(z) > BOUND - r) return true;
    for (const c of colliders) {
      if (c.type === 'rect') {
        if (x > c.x0 - r && x < c.x1 + r && z > c.z0 - r && z < c.z1 + r) return true;
      } else if ((x - c.x) ** 2 + (z - c.z) ** 2 < (c.r + r) ** 2) return true;
    }
    return false;
  }
  const N = 76, O = -38;
  const grid = new Uint8Array(N * N);
  for (let gz = 0; gz < N; gz++) for (let gx = 0; gx < N; gx++) grid[gz * N + gx] = blocked(O + gx + 0.5, O + gz + 0.5, 0.6) ? 1 : 0;
  const cellOf = (p) => [Math.min(N - 1, Math.max(0, Math.floor(p.x - O))), Math.min(N - 1, Math.max(0, Math.floor(p.z - O)))];
  const free = (gx, gz) => gx >= 0 && gz >= 0 && gx < N && gz < N && !grid[gz * N + gx];
  function nearestFree([gx, gz]) {
    if (free(gx, gz)) return [gx, gz];
    for (let r = 1; r < 8; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (free(gx + dx, gz + dz)) return [gx + dx, gz + dz];
    return [gx, gz];
  }
  function los(a, b) {
    const d = a.distanceTo(b), n = Math.ceil(d / 0.4);
    for (let i = 1; i < n; i++) {
      const x = a.x + ((b.x - a.x) * i) / n, z = a.z + ((b.z - a.z) * i) / n;
      if (!free(Math.floor(x - O), Math.floor(z - O))) return false;
    }
    return true;
  }
  function findPath(from, to) {
    const [sx, sz] = nearestFree(cellOf(from)), [tx, tz] = nearestFree(cellOf(to));
    const start = sz * N + sx, goal = tz * N + tx;
    const g = new Float32Array(N * N).fill(Infinity);
    const came = new Int32Array(N * N).fill(-1);
    const closed = new Uint8Array(N * N);
    const open = [start];
    const f = new Float32Array(N * N).fill(Infinity);
    g[start] = 0;
    f[start] = Math.hypot(tx - sx, tz - sz);
    while (open.length) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (f[open[i]] < f[open[bi]]) bi = i;
      const cur = open[bi];
      open[bi] = open[open.length - 1];
      open.pop();
      if (cur === goal) break;
      if (closed[cur]) continue;
      closed[cur] = 1;
      const cx = cur % N, cz = (cur / N) | 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const nx = cx + dx, nz = cz + dz;
        if (!free(nx, nz)) continue;
        if (dx && dz && (!free(cx + dx, cz) || !free(cx, cz + dz))) continue;
        const ni = nz * N + nx;
        const ng = g[cur] + (dx && dz ? 1.414 : 1);
        if (ng < g[ni]) {
          g[ni] = ng;
          came[ni] = cur;
          f[ni] = ng + Math.hypot(tx - nx, tz - nz);
          open.push(ni);
        }
      }
    }
    const cells = [];
    for (let c = goal; c !== -1; c = came[c]) { cells.push(c); if (c === start) break; }
    cells.reverse();
    const pts = cells.map((c) => new THREE.Vector3(O + (c % N) + 0.5, 0, O + ((c / N) | 0) + 0.5));
    pts.push(to.clone().setY(0));
    const out = [from.clone().setY(0)];
    let i = 0;
    while (i < pts.length - 1) {
      let j = pts.length - 1;
      while (j > i + 1 && !los(out[out.length - 1], pts[j])) j--;
      out.push(pts[j]);
      i = j;
    }
    out.shift();
    return out;
  }

  function resolve(p, r) {
    for (const c of colliders) {
      if (c.type === 'rect') {
        const cx = Math.min(Math.max(p.x, c.x0), c.x1), cz = Math.min(Math.max(p.z, c.z0), c.z1);
        const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          p.x = cx + (dx / d) * r;
          p.z = cz + (dz / d) * r;
        } else {
          const l = p.x - c.x0, rr = c.x1 - p.x, t = p.z - c.z0, b = c.z1 - p.z, m = Math.min(l, rr, t, b);
          if (m === l) p.x = c.x0 - r; else if (m === rr) p.x = c.x1 + r; else if (m === t) p.z = c.z0 - r; else p.z = c.z1 + r;
        }
      } else {
        const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), min = c.r + r;
        if (d < min && d > 1e-6) { p.x = c.x + (dx / d) * min; p.z = c.z + (dz / d) * min; }
      }
    }
    p.x = Math.min(Math.max(p.x, -BOUND + r), BOUND - r);
    p.z = Math.min(Math.max(p.z, -BOUND + r), BOUND - r);
  }

  return {
    group, colliders, spawn, stationPos, stationRot, spot, spotDir, focus, plazaC, homeDoor, markers,
    lightColor: lm.lightColor,
    resolve, findPath,
    update(t, dt) { for (const u of updaters) u(t, dt); },
    // Eases each building's fade toward 1 while it blocks the line from the player
    // (at chest height) up to the camera, and back to 0 once it doesn't.
    updateFade(player, cam, dt) {
      const px = player.x, pz = player.z, py = player.y;
      let dx = cam.x - px, dz = cam.z - pz;
      if (Math.abs(dx) < 1e-4) dx = 1e-4;
      if (Math.abs(dz) < 1e-4) dz = 1e-4;
      const kIn = 1 - Math.exp(-dt * 5), kOut = 1 - Math.exp(-dt * 3);
      let dirty = false;
      for (const b of buildings) {
        const tx1 = (b.x - b.w / 2 - 0.6 - px) / dx, tx2 = (b.x + b.w / 2 + 0.6 - px) / dx;
        const tz1 = (b.z - b.d / 2 - 0.6 - pz) / dz, tz2 = (b.z + b.d / 2 + 0.6 - pz) / dz;
        const tmin = Math.max(Math.min(tx1, tx2), Math.min(tz1, tz2), 0);
        const tmax = Math.min(Math.max(tx1, tx2), Math.max(tz1, tz2), 1);
        const blocks = tmin <= tmax && b.h + 1.2 > py + (cam.y - py) * tmin - 0.3;
        const target = blocks ? 1 : 0;
        if (Math.abs(b.fade - target) < 0.004) { if (b.fade !== target) { b.fade = target; dirty = true; } }
        else { b.fade += (target - b.fade) * (blocks ? kIn : kOut); dirty = true; }
        fadeData[b.id * 4] = Math.round(b.fade * 255);
      }
      if (dirty) fadeTex.needsUpdate = true;
    },
    dispose() { disposeTree(group); },
  };
}

function buildStation(st, pos, rot) {
  const g = new THREE.Group();
  g.position.copy(pos);
  g.rotation.y = rot;
  const cream = 0xe9e3d6;
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, typeof mat === 'number' ? paperMat(mat) : mat); m.position.set(x, y, z); g.add(m); return m; };
  add(new THREE.BoxGeometry(2.2, 0.06, 2.8), glowMat(0x2a2030, 1), 0, 0.03, 0);
  for (let i = 0; i < 5; i++) add(new THREE.BoxGeometry(2.1, 0.05, 0.3), 0x6c6a72, 0, 0.06, 0.9 - i * 0.45);
  for (const x of [-1.2, 1.2]) add(new THREE.BoxGeometry(0.16, 1.0, 3.0), cream, x, 0.5, 0);
  add(new THREE.BoxGeometry(2.6, 0.9, 0.16), cream, 0, 0.45, -1.45);
  for (const x of [-1.2, 1.2]) add(new THREE.BoxGeometry(0.1, 1.6, 0.1), 0x8a8f99, x, 1.8, 1.3);
  add(new THREE.BoxGeometry(2.9, 0.14, 3.2), 0xdad6ce, 0, 2.6, 0);
  const color = st.color;
  const board = plateTexture([{ text: st.short ?? st.jp, size: (st.short ?? st.jp).length > 4 ? 46 : 62 }, { text: st.en, size: 26 }], { w: 512, h: 128, stripe: color });
  add(new THREE.PlaneGeometry(2.8, 0.7), new THREE.MeshBasicMaterial({ map: board, color: new THREE.Color(1.3, 1.3, 1.3) }), 0, 2.2, 1.61);
  const badge = canvasTexture(128, 128, (c) => {
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(64, 64, 60, 0, Math.PI * 2); c.fill();
    c.strokeStyle = color; c.lineWidth = 16; c.beginPath(); c.arc(64, 64, 50, 0, Math.PI * 2); c.stroke();
    c.fillStyle = '#1d1b26'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const letters = st.badge.replace(/\d+/, ''), num = st.badge.replace(/\D+/, '');
    if (num) {
      c.font = '900 36px sans-serif'; c.fillText(letters, 64, 46);
      c.font = '900 36px sans-serif'; c.fillText(num, 64, 84);
    } else {
      c.font = '900 30px sans-serif'; c.fillText(letters, 64, 64);
    }
  });
  const pole = add(new THREE.CylinderGeometry(0.06, 0.06, 3.2, 6), 0x3a3c46, 1.7, 1.6, 1.5);
  pole.userData.k = 1;
  const badgeMat = new THREE.MeshBasicMaterial({ map: badge, color: new THREE.Color(1.35, 1.35, 1.35), side: THREE.DoubleSide });
  add(new THREE.CircleGeometry(0.42, 20), badgeMat, 1.7, 3.4, 1.5);
  const glow = add(new THREE.PlaneGeometry(3.5, 3.5), new THREE.MeshBasicMaterial({ map: radialTexture(), color: new THREE.Color(color).multiplyScalar(0.5), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), 0, 0.04, 1.9);
  glow.rotation.x = -Math.PI / 2;
  return g;
}

function makeMarker(icon, color) {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.38, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.6), transparent: true, opacity: 0.85, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.05;
  group.add(ring);
  const disc = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.MeshBasicMaterial({ map: radialTexture(), color: new THREE.Color(color).multiplyScalar(0.5), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.045;
  group.add(disc);
  const tex = canvasTexture(128, 128, (c) => {
    c.fillStyle = '#fffaf0';
    roundRect(c, 8, 8, 112, 112, 26);
    c.fill();
    c.strokeStyle = color;
    c.lineWidth = 8;
    c.stroke();
    c.fillStyle = '#2a2633';
    c.strokeStyle = '#2a2633';
    c.lineWidth = 7;
    if (icon === 'camera') {
      roundRect(c, 26, 44, 76, 50, 10); c.fill();
      c.fillRect(48, 34, 30, 14);
      c.fillStyle = '#fffaf0'; c.beginPath(); c.arc(64, 69, 16, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#2a2633'; c.beginPath(); c.arc(64, 69, 9, 0, Math.PI * 2); c.fill();
    } else if (icon === 'train') {
      roundRect(c, 34, 26, 60, 64, 14); c.fill();
      c.fillStyle = '#fffaf0'; c.fillRect(42, 36, 44, 22);
      c.beginPath(); c.arc(48, 76, 5, 0, 7); c.arc(80, 76, 5, 0, 7); c.fill();
      c.beginPath(); c.moveTo(42, 104); c.lineTo(52, 90); c.moveTo(86, 104); c.lineTo(76, 90); c.stroke();
    } else {
      c.beginPath(); c.moveTo(64, 26); c.lineTo(102, 62); c.lineTo(26, 62); c.closePath(); c.fill();
      c.fillRect(36, 60, 56, 40);
      c.fillStyle = '#ffd08a'; c.fillRect(56, 74, 16, 26);
    }
  });
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  sprite.scale.setScalar(1.1);
  sprite.position.y = 2.9;
  sprite.renderOrder = 10;
  group.add(sprite);
  return {
    group,
    update(t) {
      if (!group.visible) return;
      sprite.position.y = 2.9 + Math.round(Math.sin(t * 3) * 3) * 0.05;
      ring.scale.setScalar(1 + Math.sin(t * 4) * 0.06);
    },
  };
}
