import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { HorizontalTiltShiftShader } from 'three/addons/shaders/HorizontalTiltShiftShader.js';
import { VerticalTiltShiftShader } from 'three/addons/shaders/VerticalTiltShiftShader.js';

import { TITLE, PEOPLE, STOPS, TRAIN_RIDES, ENDING } from './config.js';
import { buildHuman, poseHuman, buildShiba, poseShiba, Puppet, turnToward } from './characters.js';
import { buildStage } from './world.js';
import { CompanionAI, ShibaAI } from './npc.js';
import { TrainRide } from './train.js';
import { radialTexture } from './paper.js';
import { applyCutawayTree, updateCutaway } from './cutaway.js';
import { initAudio, sfx, startMusic, musicVolume, setMuted, isMuted } from './audio.js';
import * as ui from './ui.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- renderer + post
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
const DPR = Math.min(window.devicePixelRatio || 1, 1.75);
renderer.setPixelRatio(DPR);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const NIGHT = 0x141a36;
scene.background = new THREE.Color(NIGHT);
scene.fog = new THREE.Fog(NIGHT, 40, 92);
const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 260);

scene.add(new THREE.HemisphereLight(0x96a0e0, 0x2e2640, 1.6));
const coupleLight = new THREE.PointLight(0xffdcb8, 22, 10, 1.4);
scene.add(coupleLight);
const moon = new THREE.DirectionalLight(0xb8c4ff, 1.0);
moon.position.set(-20, 40, 12);
scene.add(moon);
const lmLight = new THREE.PointLight(0xffd7a0, 45, 26, 1.6);
scene.add(lmLight);
const flashLight = new THREE.PointLight(0xffffff, 0, 7, 2);
scene.add(flashLight);
const flashSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture(), color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
flashSprite.scale.setScalar(1.6);
scene.add(flashSprite);

const GradeShader = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, res: { value: new THREE.Vector2(1, 1) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time; uniform vec2 res; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb = mix(vec3(l), c.rgb, 1.22);
      vec2 px = floor(vUv * res / 2.0);
      c.rgb += (hash(px + floor(time * 12.0)) - 0.5) * 0.035;
      c.rgb *= 0.965 + 0.035 * hash(floor(vUv * res / 5.0));
      vec2 d = vUv - 0.5;
      c.rgb *= 1.0 - dot(d, d) * 0.85;
      gl_FragColor = c;
    }`,
};

const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: renderer.capabilities.isWebGL2 ? 4 : 0 });
const composer = new EffectComposer(renderer, rt);
const renderPass = new RenderPass(scene, camera);
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.5, 0.85);
const hTilt = new ShaderPass(HorizontalTiltShiftShader);
const vTilt = new ShaderPass(VerticalTiltShiftShader);
const grade = new ShaderPass(GradeShader);
composer.addPass(renderPass);
composer.addPass(bloom);
composer.addPass(hTilt);
composer.addPass(vTilt);
composer.addPass(grade);
composer.addPass(new OutputPass());

// ---------------------------------------------------------------- actors
const her = new Puppet(buildHuman(PEOPLE.player, 'her'), poseHuman);
const him = new Puppet(buildHuman(PEOPLE.companion, 'him'), poseHuman);
const dog = new Puppet(buildShiba(), poseShiba);
dog.rig.root.scale.setScalar(1.15);
scene.add(her.vis, him.vis, dog.vis);
const train = new TrainRide(PEOPLE);

let stage = null;
const companion = new CompanionAI(him, her, {
  flash: (who) => doFlash(who),
  resolve: (p, r) => stage.resolve(p, r),
});
const shiba = new ShibaAI(dog, { bark: (d) => doBark(d) });

const state = { mode: 'loading', stop: 0, phase: 'toSpot', collected: [], t: 0, herSpeed: 0, photoPose: false, photoFlash: false };
const camRig = { mode: 'follow', pos: new THREE.Vector3(), look: new THREE.Vector3(), dist: 38, orbit: 0 };
// Fixed camera, nearly square to the street grid, so pushing up always walks up the
// screen. Buildings in the way get a see-through hole instead (see cutaway.js).
const PITCH = 1.02, YAW = 0.12;
const RIGHT = new THREE.Vector3(Math.cos(YAW), 0, -Math.sin(YAW));
const UP = new THREE.Vector3(-Math.sin(YAW), 0, -Math.cos(YAW));

function camOffset(yaw = YAW) {
  return new THREE.Vector3(Math.sin(yaw) * Math.cos(PITCH), Math.sin(PITCH), Math.cos(yaw) * Math.cos(PITCH)).multiplyScalar(camRig.dist);
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  composer.setPixelRatio(DPR);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  camRig.dist = Math.min(40, Math.max(11 / (2 * tan), 7.2 / (2 * tan * camera.aspect)));
  hTilt.uniforms.h.value = 4.5 / w;
  vTilt.uniforms.v.value = 4.5 / h;
  hTilt.uniforms.r.value = vTilt.uniforms.r.value = 0.5;
  grade.uniforms.res.value.set(w * DPR, h * DPR);
  train.resize(w / h);
}
addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------- stage flow
const sideOf = (h) => new THREE.Vector3(-Math.cos(h), 0, Math.sin(h));

function shibaGoalNear(point, dir) {
  const side = new THREE.Vector3(-dir.z, 0, dir.x);
  const g = point.clone().addScaledVector(side, 1.4);
  stage.resolve(g, 0.4);
  return g;
}

function loadStage(i) {
  if (stage) {
    scene.remove(stage.group);
    stage.dispose();
  }
  const stop = STOPS[i];
  const final = i === STOPS.length - 1;
  stage = buildStage(stop, i, final);
  applyCutawayTree(stage.group);
  scene.add(stage.group);
  state.stop = i;
  state.phase = 'toSpot';

  const out = stage.spawn.clone().sub(stage.stationPos).setY(0).normalize();
  const h = Math.atan2(out.x, out.z);
  // Face down the street she spawns on, toward the landmark side.
  const along = new THREE.Vector3(-out.z, 0, out.x);
  if (along.dot(stage.spot.clone().sub(stage.spawn)) < 0) along.negate();
  her.place(stage.spawn.x, stage.spawn.z, Math.atan2(along.x, along.z));
  const side = sideOf(h);
  him.pos.copy(stage.spawn).addScaledVector(side, 0.65);
  him.heading = h;
  him.flush();
  dog.place(stage.spawn.x + out.x * 1.6 - side.x, stage.spawn.z + out.z * 1.6 - side.z, h);
  companion.reset();
  companion.side = 1;
  sendShiba(stage.spot, stage.spotDir);

  lmLight.position.copy(stage.plazaC).addScaledVector(stage.spotDir, 3).setY(6);
  lmLight.color.set(stage.lightColor);
  ui.setStation(stop);
  refreshMarkers();
  updateObjective(false);
  camRig.pos.copy(her.pos).add(camOffset());
  camRig.look.copy(her.pos);
}

function sendShiba(point, dir) {
  const goal = shibaGoalNear(point, dir);
  shiba.setPath(stage.findPath(dog.pos, goal), goal);
}

function refreshMarkers() {
  const m = stage.markers;
  m.spot.group.visible = state.phase === 'toSpot';
  m.station.group.visible = state.phase === 'toStation';
  m.home.group.visible = state.phase === 'toHome';
}

function updateObjective(nearSpot) {
  const stop = STOPS[state.stop];
  if (state.phase === 'toSpot') ui.setObjective(nearSpot ? 'Tap the camera to take a picture' : `Follow the shiba to ${stop.spotName}`);
  else if (state.phase === 'toStation') ui.setObjective(`Back to ${stop.station.en} Station`);
  else if (state.phase === 'toHome') ui.setObjective('Walk home together');
}

async function takePhoto() {
  if (state.mode !== 'explore') return;
  state.mode = 'photo';
  ui.showShutter(false);
  ui.resetInput();
  const stop = STOPS[state.stop];
  const toL = stage.focus.clone().sub(her.pos).setY(0);
  her.heading = Math.atan2(toL.x, toL.z);
  state.photoPose = true;
  stage.markers.spot.group.visible = false;
  camRig.mode = 'photo';
  await wait(700);
  state.photoFlash = true;
  await ui.photoSequence(stop);
  state.photoPose = false;
  state.photoFlash = false;
  camRig.mode = 'follow';
  state.collected.push(stop);
  ui.setAlbumCount(state.collected.length, STOPS.length);
  if (state.stop === STOPS.length - 1) {
    state.phase = 'toHome';
    const dir = stage.homeDoor.clone().sub(stage.spot).setY(0).normalize();
    sendShiba(stage.homeDoor, dir);
  } else {
    state.phase = 'toStation';
    const dir = stage.spawn.clone().sub(stage.stationPos).setY(0).normalize();
    sendShiba(stage.spawn, dir);
  }
  refreshMarkers();
  updateObjective(false);
  state.mode = 'explore';
}

let trainEnding = false;
async function enterStation() {
  state.mode = 'transition';
  ui.showShutter(false);
  ui.resetInput();
  sfx.chime();
  await ui.fade(true);
  const from = state.stop, to = from + 1;
  const ride = { ...TRAIN_RIDES[from % TRAIN_RIDES.length], ...(STOPS[from].train ?? STOPS[to].train) };
  train.start(ride, ui.adTextures(THREE, STOPS[to]));
  state.mode = 'train';
  trainEnding = false;
  ui.showHud(false);
  ui.showTrainPanel(STOPS[to]);
  sfx.trainStart();
  musicVolume(0.08);
  setTimeout(() => { if (state.mode === 'train') ui.showSkip(true, finishTrain); }, 2200);
  await ui.fade(false);
}

async function finishTrain() {
  if (trainEnding) return;
  trainEnding = true;
  ui.showSkip(false);
  await ui.fade(true);
  sfx.trainStop();
  ui.hideTrainPanel();
  musicVolume(0.18);
  const next = state.stop + 1;
  loadStage(next);
  state.mode = 'explore';
  ui.showHud(true);
  await ui.fade(false);
  sfx.chime();
  ui.nameboard(STOPS[next], STOPS[next - 1], STOPS[next + 1]);
}

async function reachHome() {
  state.mode = 'ending';
  ui.resetInput();
  ui.showShutter(false);
  sfx.door();
  await wait(500);
  await ui.fade(true);
  ui.showHud(false);
  ui.showEnding(state.collected, ENDING);
  state.mode = 'done';
  await ui.fade(false);
}

function doFlash(who) {
  who.rig.flashPoint.getWorldPosition(flashLight.position);
  flashSprite.position.copy(flashLight.position);
  flashLight.intensity = 40;
  flashSprite.material.opacity = 1;
  const d = who.pos.distanceTo(camRig.look);
  sfx.flash(Math.max(0.15, 1 - d / 15));
}

const _p = new THREE.Vector3();
function screenOf(pos, y = 0) {
  _p.copy(pos).setY(y).project(camera);
  return { x: (_p.x + 1) / 2 * window.innerWidth, y: (1 - _p.y) / 2 * window.innerHeight, behind: _p.z > 1 };
}

function doBark(d) {
  const dist = d.pos.distanceTo(her.pos);
  sfx.bark(Math.max(0.3, 1 - dist / 20));
  const s = screenOf(d.pos, 1.0);
  if (!s.behind) ui.bubble('ワン!', s.x, s.y);
}

// ---------------------------------------------------------------- per-frame
const _dir = new THREE.Vector3();
const _look = new THREE.Vector3();
const _buf = new THREE.Vector2();
const _cutTarget = new THREE.Vector3();

function updateWorld(dt) {
  const exploring = state.mode === 'explore';
  const inp = exploring ? ui.readInput() : { x: 0, y: 0, mag: 0 };
  _dir.set(0, 0, 0).addScaledVector(RIGHT, inp.x).addScaledVector(UP, inp.y);
  let speed = 0;
  if (inp.mag > 0.12 && _dir.lengthSq() > 0) {
    _dir.normalize();
    speed = inp.mag > 0.78 ? 5.4 : 1.6 + inp.mag * 2.2;
  }
  const prev = her.pos.clone();
  her.pos.addScaledVector(_dir, speed * dt);
  stage.resolve(her.pos, 0.3);
  const actual = prev.distanceTo(her.pos) / Math.max(dt, 1e-4);
  state.herSpeed += (actual - state.herSpeed) * Math.min(1, dt * 12);
  if (speed > 0) her.heading = turnToward(her.heading, Math.atan2(_dir.x, _dir.z), dt * 12);
  const hp = her.p;
  hp.walk = Math.min(1, state.herSpeed / 3);
  hp.run = state.herSpeed > 4.2;
  hp.photo = state.photoPose;
  hp.lean = companion.holding && state.herSpeed > 0.5 ? 0.08 : 0;
  her.phase += state.herSpeed * dt * (hp.run ? 2.2 : 2.6);

  const cmode = state.mode === 'photo' ? 'photo' : state.mode === 'intro' ? 'idle' : 'walk';
  companion.update(dt, { herSpeed: state.herSpeed, mode: cmode, photoFlash: state.photoFlash });
  shiba.update(dt, her, !exploring);
  her.update(dt);
  him.update(dt);
  dog.update(dt);
  stage.update(state.t, dt);

  coupleLight.position.copy(her.pos).add(him.pos).multiplyScalar(0.5).setY(3.2);
  flashLight.intensity *= Math.exp(-dt * 16);
  flashSprite.material.opacity *= Math.exp(-dt * 14);

  if (exploring) {
    if (state.phase === 'toSpot') {
      const near = her.pos.distanceTo(stage.spot) < 1.7;
      ui.showShutter(near, takePhoto);
      updateObjective(near);
    } else if (state.phase === 'toStation' && her.pos.distanceTo(stage.spawn) < 1.6) {
      enterStation();
    } else if (state.phase === 'toHome' && her.pos.distanceTo(stage.homeDoor) < 1.8) {
      reachHome();
    }
    const s = screenOf(dog.pos, 0.5);
    const w = window.innerWidth, h = window.innerHeight, m = 34;
    const off = s.behind || s.x < m || s.x > w - m || s.y < 120 || s.y > h - 90;
    if (off) {
      const cx = w / 2, cy = h / 2;
      let dx = s.x - cx, dy = s.y - cy;
      if (s.behind) { dx = -dx; dy = -dy; }
      const k = Math.min((w / 2 - m) / Math.abs(dx || 1e-3), (h / 2 - 110) / Math.abs(dy || 1e-3));
      ui.guideArrow(true, cx + dx * k, cy + dy * k, Math.atan2(dy, dx));
    } else ui.guideArrow(false);
  } else ui.guideArrow(false);

  // camera
  let wantPos, wantLook, rate = 3.2;
  if (camRig.mode === 'photo') {
    const toL = stage.focus.clone().sub(her.pos).setY(0).normalize();
    const side = new THREE.Vector3(-toL.z, 0, toL.x);
    wantPos = her.pos.clone().addScaledVector(toL, -6.5).addScaledVector(side, 2.2).setY(stage.focus.y > 4 ? 1.3 : 3.0);
    wantLook = her.pos.clone().setY(1).lerp(stage.focus, 0.7);
    rate = 2.5;
  } else if (state.mode === 'intro') {
    camRig.orbit += dt * 0.12;
    wantLook = her.pos.clone().setY(0.8);
    wantPos = wantLook.clone().add(camOffset(YAW + Math.sin(camRig.orbit) * 0.6).multiplyScalar(0.45));
    rate = 1.5;
  } else {
    wantLook = her.pos.clone().addScaledVector(_dir, speed * 0.25);
    if (state.phase === 'toSpot') {
      const d = her.pos.distanceTo(stage.plazaC);
      if (d < 16) wantLook.lerp(stage.plazaC, 0.4 * (1 - Math.max(0, d - 8) / 8));
    }
    wantPos = wantLook.clone().add(camOffset());
  }
  const k = 1 - Math.exp(-dt * rate);
  camRig.pos.lerp(wantPos, k);
  camRig.look.lerp(wantLook, k);
  const wantFov = camRig.mode === 'photo' ? (stage.focus.y > 4 ? 62 : 44) : 30;
  if (Math.abs(camera.fov - wantFov) > 0.05) {
    camera.fov += (wantFov - camera.fov) * k;
    camera.updateProjectionMatrix();
  }
  camera.position.copy(camRig.pos);
  camera.lookAt(camRig.look);
  camera.updateMatrixWorld();
  renderer.getDrawingBufferSize(_buf);
  _cutTarget.copy(her.pos).setY(0.9);
  updateCutaway(camera, _cutTarget, _buf.x, _buf.y);
  stage.updateFade(_cutTarget, camera.position, dt);
  const blur = camRig.mode === 'photo' ? 2 : 4.5;
  hTilt.uniforms.h.value = blur / window.innerWidth;
  vTilt.uniforms.v.value = blur / window.innerHeight;
}

const clock = new THREE.Clock();
function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  state.t += dt;
  grade.uniforms.time.value = state.t;
  // The start screen is a full-screen lantern, so skip the 3D city until play starts.
  if (state.mode === 'done' || state.mode === 'loading' || state.mode === 'intro') return;
  if (state.mode === 'train') {
    renderPass.scene = train.scene;
    renderPass.camera = train.camera;
    if (train.update(dt)) finishTrain();
  } else {
    renderPass.scene = scene;
    renderPass.camera = camera;
    updateWorld(dt);
  }
  composer.render();
}

// ---------------------------------------------------------------- boot
const JP_CHARS = '渋谷神谷町赤羽橋浅草日本橋東京ディズニーシー・ステーションラーメンカラオケ居酒屋寿司喫茶焼鳥バー本屋ホテル酒場うどん珈琲ゲーム薬忠犬ハチ公雷門らーめんおでんやきとりただいま次は笑はじめるワン';
const fontsReady = Promise.race([
  Promise.all([
    document.fonts.load('900 40px "Zen Maru Gothic"', JP_CHARS),
    document.fonts.load('700 40px "Zen Maru Gothic"', 'ABC'),
    document.fonts.load('700 30px Caveat', 'abc'),
  ]),
  wait(3000),
]).catch(() => {});
const photosReady = ui.loadPhotos(STOPS);

ui.initInput();
ui.initAlbum(() => state.collected);
ui.initMute(() => { setMuted(!isMuted()); return isMuted(); });
ui.setAlbumCount(0, STOPS.length);

const worldReady = fontsReady.then(() => {
  loadStage(0);
  state.mode = 'intro';
  camRig.pos.copy(her.pos).add(camOffset().multiplyScalar(0.45));
});
tick();

ui.showIntro(TITLE, Promise.all([worldReady, photosReady]), () => {
  initAudio();
  startMusic();
  state.mode = 'explore';
  ui.showHud(true);
  ui.setAlbumCount(state.collected.length, STOPS.length);
  ui.nameboard(STOPS[state.stop], STOPS[state.stop - 1], STOPS[state.stop + 1]);
  sfx.chime();
});

// Jump links for testing: #photo0..#photo5 drops her on a photo spot, #metro1..#metro5
// plays a train ride (metro1 = Shibuya → Kamiyachō), #stop0..#stop5 starts at a station.
// Works on load and while playing (just edit the URL hash).
let audioArmed = false;
function armAudioOnTap() {
  if (audioArmed) return;
  audioArmed = true;
  addEventListener('pointerdown', () => { initAudio(); startMusic(); }, { once: true });
}

function jumpTo(hash) {
  const m = /^#(photo|metro|stop)(\d+)$/.exec(hash);
  if (!m) return;
  const kind = m[1], last = STOPS.length - 1;
  document.getElementById('intro').classList.add('hidden');
  document.getElementById('ending').classList.add('hidden');
  ui.hideTrainPanel();
  ui.showSkip(false);
  ui.showShutter(false);
  sfx.trainStop();
  ui.fade(false);
  camRig.mode = 'follow';
  state.photoPose = false;
  armAudioOnTap();

  if (kind === 'metro') {
    const ride = Math.min(last, Math.max(1, Number(m[2])));
    state.collected = STOPS.slice(0, ride);
    loadStage(ride - 1);
    state.phase = 'toStation';
    state.mode = 'explore';
    enterStation();
  } else {
    const n = Math.min(last, Math.max(0, Number(m[2])));
    state.collected = STOPS.slice(0, n);
    loadStage(n);
    if (kind === 'photo') {
      const s = stage.spot;
      const toL = stage.focus.clone().sub(s).setY(0);
      her.place(s.x, s.z, Math.atan2(toL.x, toL.z));
      him.pos.copy(s).addScaledVector(sideOf(her.heading), 0.65);
      him.flush();
      const goal = shibaGoalNear(s, stage.spotDir);
      dog.place(goal.x, goal.z, her.heading);
      shiba.setPath([], goal);
      camRig.pos.copy(her.pos).add(camOffset());
      camRig.look.copy(her.pos);
    }
    state.mode = 'explore';
    ui.showHud(true);
  }
  ui.setAlbumCount(state.collected.length, STOPS.length);
}

// Old query-style links still work: ?stop=3 and ?train=2 (0-based ride).
const params = new URLSearchParams(location.search);
if (!location.hash && params.has('stop')) location.hash = `#stop${params.get('stop')}`;
if (!location.hash && params.has('train')) location.hash = `#metro${Number(params.get('train')) + 1}`;
worldReady.then(() => {
  if (location.hash) jumpTo(location.hash);
  addEventListener('hashchange', () => jumpTo(location.hash));
});
window.__game = { state, her, him, dog, train, get stage() { return stage; }, takePhoto, enterStation, loadStage, jumpTo };
