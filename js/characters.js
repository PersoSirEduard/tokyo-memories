// Papercraft puppets. Logic moves them every frame, but what you see only updates
// at 12fps (Puppet.flush), which gives the stop-motion look against the smooth world.
import * as THREE from 'three';
import { paperMat, radialTexture } from './paper.js';

export const STEP = 1 / 12;
const DOWN = new THREE.Vector3(0, -1, 0);
const _v = new THREE.Vector3(), _side = new THREE.Vector3(), _grip = new THREE.Vector3();

const geoCache = new Map();
function cached(key, make) {
  let g = geoCache.get(key);
  if (!g) { g = make(); g.userData.shared = true; geoCache.set(key, g); }
  return g;
}
const box = (w, h, d) => cached(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));

function part(parent, geo, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, typeof color === 'number' ? paperMat(color) : color);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}
function joint(parent, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

let shadowMat = null;
function blobShadow(parent, r) {
  shadowMat ??= new THREE.MeshBasicMaterial({ map: radialTexture(), color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false });
  shadowMat.userData.shared = true;
  const m = new THREE.Mesh(cached('shadow', () => new THREE.PlaneGeometry(1, 1)), shadowMat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.02;
  m.scale.setScalar(r * 2);
  m.renderOrder = -1;
  parent.add(m);
  return m;
}

function miniCamera(parent, color, y, z, big) {
  const g = joint(parent, 0, y, z);
  part(g, box(big ? 0.17 : 0.15, big ? 0.11 : 0.12, big ? 0.09 : 0.07), color);
  const lens = part(g, cached('lens', () => new THREE.CylinderGeometry(0.035, 0.04, 0.06, 8)), big ? 0x2b2b2e : 0xf5f1e8, 0, -0.005, 0.055);
  lens.rotation.x = Math.PI / 2;
  if (!big) part(g, box(0.035, 0.025, 0.01), 0xffffff, 0.045, 0.035, 0.036);
  return g;
}

// type: 'her' | 'him'
export function buildHuman(c, type = 'her') {
  const root = new THREE.Group();
  const height = type === 'him' ? (c.height ?? 1.16) : 1;
  const body = joint(root);
  body.scale.setScalar(height);
  const j = { root, body, height, type };
  j.shadow = blobShadow(root, 0.34 * height);

  j.hips = joint(body, 0, 0.73, 0);
  j.thigh = []; j.knee = [];
  const legC = type === 'her' ? (c.legs ?? c.bottom) : c.bottom;
  for (const s of [-1, 1]) {
    const th = joint(j.hips, s * 0.085, 0, 0);
    part(th, box(0.115, 0.37, 0.115), legC, 0, -0.18, 0);
    const kn = joint(th, 0, -0.36, 0);
    part(kn, box(0.1, 0.34, 0.1), legC, 0, -0.17, 0);
    part(kn, box(0.13, 0.075, 0.21), c.shoes, 0, -0.34, 0.04);
    j.thigh.push(th); j.knee.push(kn);
  }

  j.torso = joint(j.hips);
  let topY;
  if (type === 'her') {
    // Black midi skirt (pivot at the waist so it can shorten when she sits).
    j.skirt = part(j.torso, cached('skirt', () => new THREE.CylinderGeometry(0.15, 0.23, 0.56, 8).translate(0, -0.28, 0)), c.bottom, 0, 0.1, 0);
    // Seated version: drapes over the lap and hangs a little past the knees.
    j.skirtSit = joint(j.hips);
    part(j.skirtSit, box(0.34, 0.15, 0.5), c.bottom, 0, 0.015, 0.12);
    part(j.skirtSit, box(0.34, 0.2, 0.05), c.bottom, 0, -0.08, 0.38);
    j.skirtSit.visible = false;
    // Cropped tee: a sliver of midriff between skirt and top.
    part(j.torso, cached('midriff', () => new THREE.CylinderGeometry(0.128, 0.142, 0.06, 7)), c.skin, 0, 0.12, 0);
    part(j.torso, cached('herTorso', () => new THREE.CylinderGeometry(0.128, 0.138, 0.3, 7)), c.top, 0, 0.29, 0);
    const collar = part(j.torso, cached('collar', () => new THREE.TorusGeometry(0.055, 0.012, 4, 10)), c.trim ?? 0x1a1a1e, 0, 0.44, 0);
    collar.rotation.x = Math.PI / 2;
    topY = 0.44;
  } else {
    part(j.torso, box(0.3, 0.16, 0.19), c.bottom, 0, 0, 0);
    part(j.torso, cached('himTorso', () => new THREE.CylinderGeometry(0.165, 0.15, 0.42, 6)), c.top, 0, 0.27, 0);
    topY = 0.48;
  }
  part(j.torso, box(0.07, 0.07, 0.07), c.skin, 0, topY + 0.02, 0);

  j.head = joint(j.torso, 0, topY + 0.05, 0);
  part(j.head, cached('head', () => new THREE.IcosahedronGeometry(0.165, 1)), c.skin, 0, 0.13, 0);
  j.eyes = [];
  for (const s of [-1, 1]) j.eyes.push(part(j.head, box(0.032, 0.045, 0.02), 0x1b1512, s * 0.062, 0.12, 0.158));
  const cap = part(j.head, cached('cap', () => new THREE.SphereGeometry(0.183, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.55)), c.hair, 0, 0.14, -0.012);
  cap.rotation.x = -0.32;
  if (type === 'her') {
    // Long straight hair down her back, long side pieces over the shoulders, wispy curtain bangs.
    // Back hair and the front pieces hang from pivots so they can swing and trail.
    j.hairBack = joint(j.head, 0, 0.2, -0.12);
    part(j.hairBack, box(0.33, 0.62, 0.08), c.hair, 0, -0.32, 0);
    j.hairFront = [];
    for (const s of [-1, 1]) {
      part(j.head, box(0.06, 0.5, 0.1), c.hair, s * 0.16, -0.07, -0.01);
      const f = joint(j.head, s * 0.165, -0.15, 0.06);
      part(f, box(0.07, 0.3, 0.06), c.hair, 0, -0.18, 0.01);
      j.hairFront.push(f);
      const bang = part(j.head, box(0.15, 0.07, 0.05), c.hair, s * 0.075, 0.235, 0.13);
      bang.rotation.set(0.35, 0, s * -0.35);
      const lock = part(j.head, box(0.045, 0.2, 0.04), c.hair, s * 0.135, 0.12, 0.13);
      lock.rotation.z = s * 0.12;
    }
    const blush = cached('blush', () => new THREE.CircleGeometry(0.026, 6));
    for (const s of [-1, 1]) {
      const b = part(j.head, blush, 0xf2a0a8, s * 0.095, 0.075, 0.147);
      b.rotation.y = s * 0.5;
    }
  } else {
    // Wavy, voluminous hair: tufts on top and a swept fringe.
    const tuft = cached('tuft', () => new THREE.IcosahedronGeometry(0.075, 0));
    for (const [x, y, z, sc] of [[-0.09, 0.29, 0.04, 1], [0.03, 0.31, 0.07, 1.15], [0.11, 0.28, 0.0, 0.95], [-0.02, 0.3, -0.07, 1.1], [0.1, 0.24, 0.1, 0.8], [-0.12, 0.22, 0.09, 0.75]]) {
      const t = part(j.head, tuft, c.hair, x, y, z);
      t.scale.set(sc * 1.1, sc * 0.75, sc);
      t.rotation.set(x * 9, y * 7, z * 5);
    }
    const fringe = part(j.head, box(0.26, 0.06, 0.06), c.hair, 0.02, 0.255, 0.12);
    fringe.rotation.set(0.3, 0, -0.12);
    const ring = cached('glassRing', () => new THREE.TorusGeometry(0.046, 0.008, 4, 12));
    for (const s of [-1, 1]) {
      part(j.head, ring, c.glasses, s * 0.066, 0.12, 0.172);
      part(j.head, box(0.012, 0.012, 0.16), c.glasses, s * 0.118, 0.125, 0.09);
    }
    part(j.head, box(0.04, 0.012, 0.012), c.glasses, 0, 0.127, 0.174);
  }

  const shY = topY - 0.06;
  j.shoulder = []; j.elbow = []; j.hand = [];
  for (const s of [-1, 1]) {
    const sh = joint(j.torso, s * (type === 'her' ? 0.165 : 0.2), shY, 0);
    part(sh, box(0.085, type === 'her' ? 0.17 : 0.2, 0.085), c.top, 0, type === 'her' ? -0.075 : -0.09, 0);
    part(sh, box(0.075, 0.1, 0.075), c.skin, 0, type === 'her' ? -0.2 : -0.21, 0);
    if (type === 'her') for (const dz of [-0.016, 0.016]) part(sh, box(0.012, 0.17, 0.011), c.trim ?? 0x1a1a1e, s * 0.044, -0.075, dz);
    const el = joint(sh, 0, -0.25, 0);
    part(el, box(0.072, 0.22, 0.072), c.skin, 0, -0.11, 0);
    part(el, box(0.075, 0.075, 0.075), c.skin, 0, -0.245, 0);
    j.shoulder.push(sh); j.elbow.push(el); j.hand.push(joint(el, 0, -0.25, 0));
  }

  if (type === 'him') {
    part(j.torso, box(0.33, 0.38, 0.17), c.backpack, 0, 0.27, -0.2);
    part(j.torso, box(0.25, 0.14, 0.05), c.backpack, 0, 0.17, -0.3);
    for (const s of [-1, 1]) part(j.torso, box(0.045, 0.38, 0.02), c.backpack, s * 0.09, 0.28, 0.155);
  }
  // Her instant camera hangs at her hip (strap across), clear of her swinging arms.
  j.chestCam = type === 'her' ? miniCamera(j.torso, c.camera, 0.12, 0.07, false) : miniCamera(j.torso, c.camera, 0.24, 0.19, true);
  if (type === 'her') { j.chestCam.position.x = 0.2; j.chestCam.rotation.y = 0.9; }
  j.faceCam = miniCamera(j.head, c.camera, 0.12, 0.25, type === 'him');
  j.faceCam.visible = false;
  j.flashPoint = joint(j.faceCam, 0, 0.08, 0.05);

  // Optional held phone for the train scenes.
  j.phone = joint(j.hand[1], 0, -0.02, 0.03);
  part(j.phone, box(0.08, 0.15, 0.015), 0xf3dfe2);
  for (const [x, y] of [[-0.02, 0.03], [0.018, -0.01], [-0.012, -0.045]]) part(j.phone, cached('cherry', () => new THREE.SphereGeometry(0.011, 6, 4)), 0xd8202c, x, y, -0.009);
  j.phoneScreen = new THREE.Mesh(cached('phoneScreen', () => new THREE.PlaneGeometry(0.068, 0.13)), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  j.phoneScreen.position.z = 0.009;
  j.phone.add(j.phoneScreen);
  j.phone.visible = false;
  return j;
}

// Two-bone IK: places the hand on `target` with the elbow bent naturally, pointing down
// and out to the side (never across the body).
const UPPER = 0.25, FORE = 0.25;
const _q = new THREE.Quaternion(), _axis = new THREE.Vector3();
function aimArm(j, i, target) {
  const sh = j.shoulder[i];
  sh.parent.updateWorldMatrix(true, false);
  _v.copy(target);
  sh.parent.worldToLocal(_v);
  _v.sub(sh.position);
  const d = Math.min(UPPER + FORE - 0.001, Math.max(0.06, _v.length()));
  _v.normalize();
  const bend = Math.PI - Math.acos((UPPER * UPPER + FORE * FORE - d * d) / (2 * UPPER * FORE));
  const lift = Math.acos(Math.min(1, (UPPER * UPPER + d * d - FORE * FORE) / (2 * UPPER * d)));
  sh.quaternion.setFromUnitVectors(DOWN, _v);
  // Spin the arm about its own axis so the bend plane drops the elbow down and outward.
  const out = i ? 1 : -1;
  _axis.set(out * 0.35, -1.0, -0.15).normalize();
  const elbowDir = _axis.clone().applyQuaternion(sh.quaternion.clone().invert());
  elbowDir.y = 0;
  if (elbowDir.lengthSq() > 1e-6) {
    // Local -z is where the elbow goes after rotateX(+lift); turn it toward elbowDir.
    const twist = Math.atan2(-elbowDir.x, -elbowDir.z);
    sh.quaternion.multiply(_q.setFromAxisAngle(DOWN, -twist));
  }
  sh.rotateX(lift);
  j.elbow[i].rotation.set(-bend, 0, 0);
}

// p: { walk, phase, run, t, photo, sit, lean, torsoTilt, headTilt, headTurn, headNod,
//      hold: { side, target }, armsTo, laugh, phone, sleep }
export function poseHuman(j, p) {
  const s = Math.sin(p.phase || 0), c = Math.cos(p.phase || 0);
  const walk = p.walk || 0;
  // Midi skirt: shorter strides, more heel kick, so legs stay mostly under the skirt.
  const her = j.type === 'her';
  const amp = (p.run ? 0.85 : 0.5) * walk * (her ? 0.62 : 1);
  const kick = her ? 2.2 : 1.4;

  j.body.position.y = 0;
  if (j.skirt) { j.skirt.visible = !p.sit; j.skirtSit.visible = !!p.sit; }
  if (p.sit) {
    for (let i = 0; i < 2; i++) {
      j.thigh[i].rotation.set(-1.5, 0, (i ? 1 : -1) * 0.05);
      j.knee[i].rotation.set(1.45 + Math.sin(p.t * 1.3 + i) * 0.04, 0, 0);
    }
  } else {
    j.thigh[0].rotation.set(s * amp, 0, 0);
    j.thigh[1].rotation.set(-s * amp, 0, 0);
    j.knee[0].rotation.set(Math.max(0, -c) * amp * kick, 0, 0);
    j.knee[1].rotation.set(Math.max(0, c) * amp * kick, 0, 0);
    j.body.position.y = Math.abs(c) * 0.035 * walk * (p.run ? 1.7 : 1);
  }

  j.torso.rotation.set((p.run ? (her ? 0.1 : 0.18) : 0.04) * walk + (p.lean || 0), 0, p.torsoTilt || 0);
  if (j.skirt) {
    // Skirt swishes with the stride and flares a little to wrap the moving legs.
    j.skirt.rotation.set(-s * amp * 0.35, 0, Math.sin((p.phase || 0) * 0.5) * 0.04 * walk);
    j.skirt.scale.set(1 + amp * 0.25, 1 - amp * 0.08, 1 + Math.abs(s) * amp * 0.9);
  }
  if (j.hairBack) {
    // Hang with gravity against the head's tilt, trail behind when moving, bounce per step.
    const lean = j.torso.rotation.x + (p.headNod || 0);
    j.hairBack.rotation.set(-lean * 0.8 + walk * (p.run ? 0.38 : 0.12) + Math.abs(c) * 0.1 * walk, 0, -(p.torsoTilt || 0) * 0.6 - (p.headTilt || 0) * 0.6);
    j.hairFront.forEach((f, i) => f.rotation.set(-lean * 0.7 + walk * (p.run ? 0.3 : 0.08) + Math.sin((p.phase || 0) + i) * 0.08 * walk, 0, (i ? 1 : -1) * 0.05 * walk));
  }
  j.torso.scale.y = 1 + Math.sin(p.t * 2.2) * 0.012;
  j.head.rotation.set(p.headNod || 0, p.headTurn || 0, p.headTilt || 0);
  if (p.laugh) {
    j.torso.rotation.x += Math.sin(p.t * 40) * 0.04 * p.laugh - 0.05 * p.laugh;
    j.head.rotation.x -= 0.18 * p.laugh;
  }
  const eyeScale = p.sleep ? 0.18 : (Math.sin(p.t * 0.9 + j.height * 7) > 0.985 ? 0.2 : 1);
  for (const e of j.eyes) e.scale.y = eyeScale;

  for (let i = 0; i < 2; i++) {
    const out = i ? 1 : -1;
    if (p.sit) {
      j.shoulder[i].rotation.set(-0.45, 0, out * 0.12);
      j.elbow[i].rotation.set(-0.7, 0, 0);
    } else {
      j.shoulder[i].rotation.set(-out * s * amp * (her ? 1.3 : 0.9), 0, out * (0.08 + (p.run ? 0.18 : 0) * walk));
      j.elbow[i].rotation.set(-0.25 - (p.run ? 0.9 : 0.2) * walk, 0, 0);
    }
  }
  if (p.photo) {
    for (let i = 0; i < 2; i++) {
      j.shoulder[i].rotation.set(-1.25, 0, (i ? -1 : 1) * 0.45);
      j.elbow[i].rotation.set(-1.3, 0, 0);
    }
  }
  if (p.armsTo) {
    // Each hand grips its own side of the phone.
    _side.setFromMatrixColumn(j.root.matrixWorld, 0).normalize();
    for (let i = 0; i < 2; i++) aimArm(j, i, _grip.copy(p.armsTo).addScaledVector(_side, i ? 0.065 : -0.065));
  }
  if (p.hold && p.hold.target) aimArm(j, p.hold.side, p.hold.target);

  j.faceCam.visible = !!p.photo;
  j.chestCam.visible = !p.photo;
  j.phone.visible = !!p.phone;
}

export function buildShiba({ statue = false } = {}) {
  const orange = statue ? 0x6e7d63 : 0xd98a3d;
  const cream = statue ? 0x7d8b70 : 0xf7ead6;
  const dark = statue ? 0x55604c : 0x241a15;
  const root = new THREE.Group();
  const j = { root, statue };
  if (!statue) blobShadow(root, 0.32);
  j.body = joint(root, 0, 0.3, 0);
  part(j.body, box(0.24, 0.22, 0.46), orange);
  part(j.body, box(0.2, 0.06, 0.38), cream, 0, -0.1, 0);
  part(j.body, box(0.18, 0.16, 0.06), cream, 0, -0.01, 0.22);

  j.head = joint(j.body, 0, 0.12, 0.24);
  part(j.head, box(0.25, 0.21, 0.21), orange, 0, 0.06, 0.04);
  part(j.head, box(0.13, 0.09, 0.11), cream, 0, 0.0, 0.17);
  for (const s of [-1, 1]) part(j.head, box(0.07, 0.07, 0.05), cream, s * 0.085, 0.0, 0.135);
  part(j.head, box(0.05, 0.035, 0.03), dark, 0, 0.04, 0.225);
  j.eyes = [];
  for (const s of [-1, 1]) j.eyes.push(part(j.head, box(0.03, 0.035, 0.02), dark, s * 0.06, 0.09, 0.148));
  const ear = cached('ear', () => new THREE.ConeGeometry(0.055, 0.11, 4));
  for (const s of [-1, 1]) {
    const e = part(j.head, ear, orange, s * 0.078, 0.2, 0.02);
    e.rotation.y = Math.PI / 4;
    e.rotation.z = -s * 0.15;
  }
  j.tongue = part(j.head, box(0.04, 0.012, 0.05), 0xe8707c, 0, -0.04, 0.21);
  j.tongue.visible = false;

  j.legs = [];
  for (const [x, z] of [[-0.075, 0.15], [0.075, 0.15], [-0.075, -0.15], [0.075, -0.15]]) {
    const l = joint(j.body, x, -0.08, z);
    part(l, box(0.07, 0.22, 0.07), orange, 0, -0.1, 0);
    part(l, box(0.075, 0.05, 0.085), cream, 0, -0.2, 0.01);
    j.legs.push(l);
  }
  j.tail = joint(j.body, 0, 0.11, -0.22);
  const t = part(j.tail, cached('tail', () => new THREE.TorusGeometry(0.07, 0.03, 5, 8, Math.PI * 1.6)), orange, 0, 0.07, 0);
  t.rotation.y = Math.PI / 2;
  return j;
}

// kind: walk | run | idle | sit | sleep | eat | poop | bark
export function poseShiba(j, p) {
  const t = p.t || 0;
  const k = p.kind || 'idle';
  j.body.position.set(0, 0.3, 0);
  j.body.rotation.set(0, 0, 0);
  j.head.rotation.set(0, 0, 0);
  j.tail.rotation.set(0, 0, Math.sin(t * 14) * 0.35);
  j.tongue.visible = false;
  for (const e of j.eyes) e.scale.y = 1;
  for (const l of j.legs) l.rotation.set(0, 0, 0);

  if (k === 'walk' || k === 'run') {
    const amp = k === 'run' ? 0.85 : 0.55;
    const s = Math.sin(p.phase || 0);
    j.legs[0].rotation.x = s * amp; j.legs[3].rotation.x = s * amp;
    j.legs[1].rotation.x = -s * amp; j.legs[2].rotation.x = -s * amp;
    j.body.position.y = 0.3 + Math.abs(Math.cos(p.phase || 0)) * (k === 'run' ? 0.05 : 0.025);
    j.head.rotation.x = Math.sin((p.phase || 0) * 2) * 0.05;
    j.tongue.visible = k === 'run';
  } else if (k === 'sit') {
    j.body.rotation.x = -0.5;
    j.body.position.y = 0.27;
    j.legs[2].rotation.x = -1.0; j.legs[3].rotation.x = -1.0;
    j.legs[0].rotation.x = 0.5; j.legs[1].rotation.x = 0.5;
    j.head.rotation.x = 0.45 + Math.sin(t * 1.5) * 0.04;
    j.head.rotation.z = Math.sin(t * 0.7) * 0.12;
    j.tongue.visible = !j.statue && Math.sin(t * 0.5) > 0;
    if (j.statue) j.tail.rotation.z = 0;
  } else if (k === 'sleep') {
    j.body.position.y = 0.13 + Math.sin(t * 2) * 0.008;
    j.legs[0].rotation.x = -1.45; j.legs[1].rotation.x = -1.45;
    j.legs[2].rotation.x = 1.45; j.legs[3].rotation.x = 1.45;
    j.head.rotation.set(0.35, 0.5, 0.3);
    j.tail.rotation.set(0, 0.6, 0.8);
    for (const e of j.eyes) e.scale.y = 0.15;
  } else if (k === 'eat') {
    j.head.rotation.x = 0.85 + Math.abs(Math.sin(t * 9)) * 0.2;
    j.body.rotation.x = 0.08;
  } else if (k === 'poop') {
    j.body.rotation.x = -0.35;
    j.body.position.y = 0.22;
    j.legs[2].rotation.x = -0.75; j.legs[3].rotation.x = -0.75;
    j.legs[0].rotation.x = 0.3; j.legs[1].rotation.x = 0.3;
    j.head.rotation.x = 0.3;
    j.tail.rotation.set(-0.6, 0, Math.sin(t * 3) * 0.1);
    for (const e of j.eyes) e.scale.y = 0.35;
  } else if (k === 'bark') {
    const b = Math.abs(Math.sin(t * 12));
    j.head.rotation.x = -0.35 * b;
    j.body.position.y = 0.3 + b * 0.04;
    j.tongue.visible = true;
  } else {
    j.head.rotation.z = Math.sin(t * 0.8) * 0.15;
    j.head.rotation.x = Math.sin(t * 0.5) * 0.08;
  }
}

export class Puppet {
  constructor(rig, poseFn) {
    this.rig = rig;
    this.poseFn = poseFn;
    this.vis = rig.root;
    this.pos = new THREE.Vector3();
    this.heading = 0;
    this.phase = 0;
    this.t = Math.random() * 10;
    this.acc = STEP;
    this.p = { walk: 0, t: 0 };
    this.jitter = 0.04;
  }
  place(x, z, heading = this.heading) {
    this.pos.set(x, this.pos.y, z);
    this.heading = heading;
    this.flush();
  }
  update(dt) {
    this.t += dt;
    this.acc += dt;
    if (this.acc < STEP) return false;
    this.acc = Math.min(this.acc - STEP, STEP);
    this.flush();
    return true;
  }
  flush() {
    this.vis.position.copy(this.pos);
    this.vis.rotation.y = this.heading + (Math.random() - 0.5) * this.jitter;
    this.p.t = this.t;
    this.p.phase = this.phase;
    this.vis.updateMatrixWorld(true);
    this.poseFn(this.rig, this.p);
  }
}

export function turnToward(current, target, rate) {
  let d = target - current;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return current + d * Math.min(1, rate);
}
