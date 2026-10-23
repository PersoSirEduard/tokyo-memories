// Character preview: one puppet on a paper turntable, with buttons for every pose the
// game uses. The page sets <body data-who="her|him">.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PEOPLE } from './config.js';
import { buildHuman, poseHuman, Puppet } from './characters.js';
import { paperMat } from './paper.js';

const who = document.body.dataset.who;
const colors = who === 'him' ? PEOPLE.companion : PEOPLE.player;

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a2040);
const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 50);
scene.add(new THREE.HemisphereLight(0xc8d0ff, 0x3a3048, 1.7));
const key = new THREE.DirectionalLight(0xfff1dc, 1.6);
key.position.set(2, 4, 3);
scene.add(key);

const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.15, 0.08, 24), paperMat(0xe9e2d3));
disc.position.y = -0.04;
scene.add(disc);

const puppet = new Puppet(buildHuman(colors, who), poseHuman);
scene.add(puppet.vis);
const h = puppet.rig.height;

const bench = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 0.6), paperMat(0x3d6a58));
bench.position.set(0, 0.25, -0.12);
scene.add(bench);
const holdMarker = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff6b8a }));
scene.add(holdMarker);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.8 * h, 0);
controls.enableDamping = true;
controls.minDistance = 1.2;
controls.maxDistance = 6;
camera.position.set(1.4, 1.3 * h, 3.0);

const SEAT = 0.5 - 0.73 * h;
const POSES = {
  idle: () => ({}),
  walk: (t) => ({ walk: 0.6, speed: 3 }),
  run: (t) => ({ walk: 1, run: true, speed: 5.4 }),
  photo: () => ({ photo: true }),
  'hold hand': () => ({ hold: true }),
  pulled: () => ({ hold: true, walk: 0.6, speed: 3, lean: who === 'him' ? -0.2 : 0.08, pulled: true }),
  sit: () => ({ sit: true }),
  reels: (t) => ({ sit: true, phone: true, headNod: 0.45, laugh: Math.sin(t * 1.1) > 0.75 ? 1 : 0 }),
  'sleep on shoulder': () => ({ sit: true, sleep: true, torsoTilt: who === 'him' ? 0.2 : -0.2, headTilt: who === 'him' ? 0.45 : -0.45 }),
  laugh: () => ({ laugh: 1 }),
};
let current = 'idle', stopMotion = true;

const bar = document.getElementById('poses');
for (const name of Object.keys(POSES)) {
  const b = document.createElement('button');
  b.textContent = name;
  b.onclick = () => { current = name; for (const x of bar.children) x.classList.toggle('on', x === b); };
  if (name === current) b.classList.add('on');
  bar.appendChild(b);
}
document.getElementById('stop').onchange = (e) => { stopMotion = e.target.checked; };
document.getElementById('wire').onchange = (e) => {
  puppet.vis.traverse((o) => { if (o.isMesh && o.material) o.material.wireframe = e.target.checked; });
};
document.getElementById('spin').onchange = (e) => { controls.autoRotate = e.target.checked; };
controls.autoRotateSpeed = 2;

function resize() {
  const w = innerWidth, hh = innerHeight;
  renderer.setSize(w, hh, false);
  camera.aspect = w / hh;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

const _side = new THREE.Vector3();
const clock = new THREE.Clock();
function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  const def = POSES[current](puppet.t);
  const p = puppet.p;
  Object.assign(p, { walk: 0, run: false, photo: false, sit: false, hold: null, armsTo: null, phone: false, laugh: 0, sleep: false, headTilt: 0, headTurn: 0, headNod: 0, torsoTilt: 0, lean: 0 }, def);
  delete p.speed; delete p.pulled;
  puppet.phase += (def.speed || 0) * dt * (def.run ? 2.2 : 2.6);
  puppet.pos.y = def.sit ? SEAT : 0;
  bench.visible = !!def.sit;
  disc.visible = !def.sit;

  if (def.phone) p.armsTo = new THREE.Vector3(0, 0.83 * h - 0.05, 0.34);
  // Hand-hold target: where the partner's hand would be (her partner on her +x side, his on -x).
  holdMarker.visible = !!def.hold;
  if (def.hold) {
    const side = who === 'him' ? -1 : 1;
    _side.set(side * 0.45, 0.82, def.pulled ? (who === 'him' ? 0.35 : -0.35) : 0);
    holdMarker.position.copy(_side);
    p.hold = { side: who === 'him' ? 0 : 1, target: _side.clone() };
  }

  if (stopMotion) puppet.update(dt);
  else { puppet.t += dt; puppet.flush(); }
  controls.update();
  renderer.render(scene, camera);
}
tick();
window.__pv = { camera, puppet, controls };
