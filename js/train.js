// Between stations: the two of them on a train bench, the city sliding by outside.
// Outside layers scroll smoothly; everyone inside moves at 12fps.
import * as THREE from 'three';
import { paperMat, glowMat, canvasTexture, radialTexture, JP_FONT, makeRng } from './paper.js';
import { buildHuman, poseHuman, buildShiba, poseShiba, Puppet, STEP } from './characters.js';

const SEAT_Y = 0.5;

function skylineTexture(seed, { far, sea, hue }) {
  const rnd = makeRng(seed);
  return canvasTexture(1024, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    if (sea && far) {
      g.fillStyle = '#163a5e';
      g.fillRect(0, h * 0.78, w, h * 0.22);
      for (let i = 0; i < 60; i++) {
        g.fillStyle = `rgba(255,220,150,${0.2 + rnd() * 0.4})`;
        g.fillRect(rnd() * w, h * 0.8 + rnd() * h * 0.18, 6 + rnd() * 20, 2);
      }
    }
    let x = 0;
    while (x < w) {
      const bw = far ? 20 + rnd() * 50 : 40 + rnd() * 90;
      const bh = far ? 40 + rnd() * 120 : 60 + rnd() * 150;
      const base = sea && far ? h * 0.8 : h;
      g.fillStyle = far ? `hsl(${hue},30%,${14 + rnd() * 6}%)` : `hsl(${hue + 10},22%,${22 + rnd() * 10}%)`;
      g.fillRect(x, base - bh, bw, bh);
      const cols = Math.floor(bw / (far ? 7 : 12)), rows = Math.floor(bh / (far ? 9 : 14));
      for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
        if (rnd() > (far ? 0.3 : 0.45)) continue;
        g.fillStyle = rnd() < 0.8 ? '#ffd89a' : '#bfe3ff';
        g.fillRect(x + 3 + c * (far ? 7 : 12), base - bh + 4 + r * (far ? 9 : 14), far ? 3 : 6, far ? 4 : 7);
      }
      if (!far && rnd() < 0.25) {
        g.fillStyle = ['#ff4f8b', '#4fd6ff', '#ffb347'][Math.floor(rnd() * 3)];
        g.fillRect(x + bw * 0.3, base - bh - 18, bw * 0.4, 14);
      }
      x += bw + (far ? 2 : 6 + rnd() * 20);
    }
  }, { repeat: true });
}

function polesTexture() {
  return canvasTexture(512, 256, (g) => {
    g.clearRect(0, 0, 512, 256);
    g.fillStyle = '#0d0f1a';
    g.fillRect(40, 0, 14, 256);
    g.fillRect(300, 0, 10, 256);
    g.fillRect(0, 30, 512, 3);
    g.fillRect(0, 44, 512, 2);
  }, { repeat: true });
}

function spriteText(text, color, size = 64) {
  const tex = canvasTexture(128, 128, (g) => {
    g.font = `900 ${size}px ${JP_FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 8;
    g.strokeStyle = '#1d1b26';
    g.strokeText(text, 64, 64);
    g.fillStyle = color;
    g.fillText(text, 64, 64);
  });
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
}

export class TrainRide {
  constructor(people) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0e1226);
    this.camera = new THREE.PerspectiveCamera(46, 1, 0.1, 100);
    this.people = people;
    this.t = 0;
    this.duration = 9;
    this.build();
  }

  build() {
    const s = this.scene;
    s.add(new THREE.HemisphereLight(0xfff1dc, 0x4a3a50, 1.6));
    const top = new THREE.DirectionalLight(0xfff4e0, 1.0);
    top.position.set(0.5, 4, 3);
    s.add(top);
    this.phoneLight = new THREE.PointLight(0x9fd0ff, 0, 1.4);
    s.add(this.phoneLight);

    this.car = new THREE.Group();
    s.add(this.car);
    const add = (geo, mat, x, y, z, parent = this.car) => { const m = new THREE.Mesh(geo, typeof mat === 'number' ? paperMat(mat) : mat); m.position.set(x, y, z); parent.add(m); return m; };

    add(new THREE.BoxGeometry(30, 0.1, 30), 0x8a8478, 0, -0.05, 14);
    add(new THREE.BoxGeometry(30, 0.1, 30), 0xece6da, 0, 3.05, 14);
    for (const x of [-3.6, -1.2, 1.2, 3.6]) add(new THREE.BoxGeometry(1.4, 0.04, 0.18), glowMat(0xfff6e0, 1.5), x, 2.99, 0.2);
    add(new THREE.BoxGeometry(5.2, 0.14, 0.72), 0x3d6a58, 0, 0.44, -0.2);
    add(new THREE.BoxGeometry(5.0, 0.36, 0.5), 0x1e2024, 0, 0.19, -0.32);
    add(new THREE.BoxGeometry(5.2, 0.03, 0.02), 0x9aa0a8, 0, 0.36, 0.15);
    add(new THREE.BoxGeometry(5.2, 0.5, 0.14), 0x3d6a58, 0, 0.75, -0.52);
    add(new THREE.BoxGeometry(5.4, 0.08, 0.75), 0xb8b2a6, 0, 0.06, -0.2);
    for (const x of [-2.75, 2.75]) add(new THREE.BoxGeometry(0.08, 1.0, 0.75), 0xc9c3b6, x, 0.5, -0.2);
    const rail = add(new THREE.CylinderGeometry(0.025, 0.025, 11, 6), 0xc0c4cc, 0, 2.55, 0.35);
    rail.rotation.z = Math.PI / 2;
    this.straps = [];
    for (let i = 0; i < 8; i++) {
      const g = new THREE.Group();
      g.position.set(-3.5 + i, 2.55, 0.35);
      add(new THREE.BoxGeometry(0.03, 0.3, 0.01), 0xeeeeee, 0, -0.15, 0, g);
      add(new THREE.TorusGeometry(0.07, 0.015, 4, 10), 0xf2f2f2, 0, -0.36, 0, g);
      this.car.add(g);
      this.straps.push(g);
    }
    for (const x of [-4.6, 4.6]) {
      add(new THREE.BoxGeometry(1.3, 2.4, 0.06), 0xbfc4cc, x, 1.2, -0.6);
      add(new THREE.BoxGeometry(0.5, 1.1, 0.02), glowMat(0x1a2440, 1), x - 0.33, 1.5, -0.56);
      add(new THREE.BoxGeometry(0.5, 1.1, 0.02), glowMat(0x1a2440, 1), x + 0.33, 1.5, -0.56);
    }
    this.ads = [];
    for (const x of [-2.6, 0, 2.6]) {
      const m = add(new THREE.PlaneGeometry(1.5, 0.38), new THREE.MeshBasicMaterial({ color: 0xffffff }), x, 2.42, -0.58);
      this.ads.push(m);
    }

    this.walls = {};
    for (const kind of ['rect', 'round']) {
      const shape = new THREE.Shape();
      shape.moveTo(-6, 0); shape.lineTo(6, 0); shape.lineTo(6, 3); shape.lineTo(-6, 3); shape.lineTo(-6, 0);
      const holes = kind === 'rect' ? [[-2.1, 1.65], [0, 1.65], [2.1, 1.65]] : [[-1.8, 1.65], [0, 1.65], [1.8, 1.65]];
      for (const [hx, hy] of holes) {
        const h = new THREE.Path();
        if (kind === 'rect') {
          const w = 0.95, hh = 0.55, r = 0.12;
          h.moveTo(hx - w + r, hy - hh);
          h.lineTo(hx + w - r, hy - hh); h.quadraticCurveTo(hx + w, hy - hh, hx + w, hy - hh + r);
          h.lineTo(hx + w, hy + hh - r); h.quadraticCurveTo(hx + w, hy + hh, hx + w - r, hy + hh);
          h.lineTo(hx - w + r, hy + hh); h.quadraticCurveTo(hx - w, hy + hh, hx - w, hy + hh - r);
          h.lineTo(hx - w, hy - hh + r); h.quadraticCurveTo(hx - w, hy - hh, hx - w + r, hy - hh);
        } else {
          h.absarc(hx, hy, 0.6, 0, Math.PI * 2, true);
        }
        shape.holes.push(h);
      }
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: false, curveSegments: 16 });
      const wall = new THREE.Mesh(geo, paperMat(kind === 'rect' ? 0xe6e1d6 : 0xd9ecf2));
      wall.position.set(0, 0, -0.68);
      wall.visible = false;
      this.car.add(wall);
      this.walls[kind] = wall;
    }

    this.layers = [];
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), new THREE.MeshBasicMaterial({ map: canvasTexture(64, 256, (g) => {
      const gr = g.createLinearGradient(0, 0, 0, 256);
      gr.addColorStop(0, '#070a1c'); gr.addColorStop(0.6, '#1c2350'); gr.addColorStop(1, '#4a3a6a');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 256);
      for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(Math.random() * 64, Math.random() * 140, 1, 1); }
    }) }));
    sky.position.set(0, 4, -22);
    s.add(sky);
    const moon = new THREE.Mesh(new THREE.CircleGeometry(0.9, 20), glowMat(0xfff4d8, 1.4));
    moon.position.set(5, 7, -21);
    s.add(moon);

    const mkLayer = (z, y, w, h, speed, tex) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
      m.position.set(0, y, z);
      tex.repeat.set(w / (h * 4), 1);
      s.add(m);
      this.layers.push({ m, tex, speed });
      return m;
    };
    this.texSets = {
      city: [skylineTexture(3, { far: true, hue: 230 }), skylineTexture(7, { far: false, hue: 228 })],
      sea: [skylineTexture(11, { far: true, sea: true, hue: 215 }), skylineTexture(13, { far: false, hue: 220 })],
    };
    mkLayer(-14, 1.5, 44, 11, 0.012, this.texSets.city[0]);
    mkLayer(-6, 0.2, 26, 6.5, 0.05, this.texSets.city[1]);
    const poles = polesTexture();
    mkLayer(-1.5, 1.6, 9, 4, 0.5, poles);

    this.her = new Puppet(buildHuman(this.people.player, 'her'), poseHuman);
    this.him = new Puppet(buildHuman(this.people.companion, 'him'), poseHuman);
    this.dog = new Puppet(buildShiba(), poseShiba);
    for (const pp of [this.her, this.him, this.dog]) s.add(pp.vis);
    this.her.rig.shadow.visible = false;
    this.him.rig.shadow.visible = false;

    this.bowl = new THREE.Group();
    add(new THREE.CylinderGeometry(0.13, 0.1, 0.07, 10), 0xd04a3a, 0, 0.035, 0, this.bowl);
    add(new THREE.CylinderGeometry(0.11, 0.11, 0.02, 10), 0x9a6a3a, 0, 0.07, 0, this.bowl);
    s.add(this.bowl);
    this.poop = new THREE.Group();
    for (const [r, y] of [[0.07, 0.04], [0.055, 0.09], [0.035, 0.13]]) add(new THREE.SphereGeometry(r, 7, 5), 0x6b4226, 0, y, 0, this.poop);
    s.add(this.poop);

    this.fx = [];
    this.fxTex = {
      z: () => spriteText('Z', '#cfe3ff', 70),
      heart: () => spriteText('♥', '#ff6b8a', 80),
      haha: () => spriteText('笑', '#ffe27a', 64),
      stink: () => spriteText('~', '#b8d68a', 90),
    };
  }

  resize(aspect) {
    this.camera.aspect = aspect;
    const wantW = 2.3, wantH = 2.5;
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const d = Math.max(wantH / (2 * tan), wantW / (2 * tan * aspect));
    this.camDist = d;
    this.camera.updateProjectionMatrix();
  }

  start(ride, ads) {
    this.ride = ride;
    this.t = 0;
    this.fxTimer = 0;
    this.walls.rect.visible = ride.windows !== 'round';
    this.walls.round.visible = ride.windows === 'round';
    const set = ride.sea ? this.texSets.sea : this.texSets.city;
    this.layers[0].tex.image = set[0].image; this.layers[0].tex.needsUpdate = true;
    this.layers[1].tex.image = set[1].image; this.layers[1].tex.needsUpdate = true;
    this.ads.forEach((m, i) => {
      if (m.material.map) m.material.map.dispose();
      m.material.map = ads[i % ads.length];
      m.material.needsUpdate = true;
    });
    for (const f of this.fx) { this.scene.remove(f.s); f.s.material.map.dispose(); f.s.material.dispose(); }
    this.fx = [];
    this.her.place(-0.33, -0.2, 0);
    this.him.place(0.42, -0.2, 0);
    this.her.pos.y = SEAT_Y - 0.73;
    this.him.pos.y = SEAT_Y - 0.73 * this.him.rig.height;
    this.dog.place(0.25, 0.75, 0.6);
    this.bowl.visible = ride.shiba === 'eat';
    this.bowl.position.set(0.3, 0, 1.08);
    this.poop.visible = false;
    this.poopAt = 2.6;
  }

  spawnFx(kind, pos) {
    const s = this.fxTex[kind]();
    s.position.copy(pos);
    s.scale.setScalar(0.22);
    this.scene.add(s);
    this.fx.push({ s, life: 0, max: 1.8, vx: (Math.random() - 0.5) * 0.1 });
  }

  update(dt) {
    this.t += dt;
    const t = this.t;
    for (const l of this.layers) l.tex.offset.x += l.speed * dt * 6;
    this.car.rotation.z = Math.sin(t * 1.3) * 0.004;
    const sway = Math.sin(t * 1.7) * 0.07 + Math.sin(t * 0.6) * 0.05;
    this.straps.forEach((g, i) => { g.rotation.z = sway + Math.sin(t * 2.3 + i) * 0.02; });
    // Three-quarter view so laps and leaning heads read clearly.
    const cd = this.camDist;
    this.camera.position.set(cd * 0.32 + Math.sin(t * 0.3) * 0.06, 2.35 + Math.sin(t * 2.1) * 0.01, cd * 0.95);
    this.camera.lookAt(0.05, 0.9, 0.1);

    const r = this.ride, her = this.her.p, him = this.him.p;
    for (const p of [her, him]) {
      Object.assign(p, { sit: true, walk: 0, photo: false, hold: null, armsTo: null, phone: false, laugh: 0, sleep: false, headTilt: 0, headTurn: 0, headNod: 0, torsoTilt: 0, lean: 0 });
    }
    this.phoneLight.intensity = 0;
    const herHead = new THREE.Vector3(-0.33, 1.42, 0);
    const himHead = new THREE.Vector3(0.42, 1.6, 0);
    this.fxTimer -= dt;
    const fx = (k, p) => { if (this.fxTimer <= 0) { this.spawnFx(k, p); this.fxTimer = 0.9; } };
    const phoneAt = new THREE.Vector3(-0.16, 0.82, 0.36);

    switch (r.couple) {
      case 'reels': {
        her.armsTo = phoneAt; her.phone = true;
        her.headNod = 0.45; her.headTilt = -0.12;
        him.headNod = 0.4; him.headTilt = 0.35; him.torsoTilt = 0.12;
        const laugh = Math.sin(t * 1.1) > 0.75 ? 1 : 0;
        her.laugh = laugh; him.laugh = laugh;
        if (laugh) fx('haha', herHead.clone().add(new THREE.Vector3(0.3, 0.4, 0)));
        this.phoneLight.position.copy(phoneAt).add(new THREE.Vector3(0, 0.25, 0.1));
        this.phoneLight.intensity = 1.2;
        break;
      }
      case 'hands': {
        const mid = new THREE.Vector3(0.05, 0.62, 0.15);
        her.hold = { side: 1, target: mid };
        him.hold = { side: 0, target: mid };
        const look = Math.sin(t * 0.7) > 0.2;
        her.headTurn = look ? 0.55 : 0.05;
        him.headTurn = look ? -0.55 : 0;
        him.headNod = look ? 0.15 : 0;
        if (look) fx('heart', new THREE.Vector3(0.05, 1.95, 0));
        break;
      }
      case 'shoulder': {
        her.torsoTilt = -0.2; her.headTilt = -0.45; her.sleep = true;
        him.headTurn = -0.35; him.headNod = 0.25;
        her.hold = { side: 1, target: new THREE.Vector3(0.05, 0.62, 0.15) };
        him.hold = { side: 0, target: new THREE.Vector3(0.05, 0.62, 0.15) };
        fx('z', herHead.clone().add(new THREE.Vector3(-0.15, 0.35, 0)));
        break;
      }
      case 'sleepBoth': {
        her.torsoTilt = -0.2; her.headTilt = -0.45; her.sleep = true;
        him.torsoTilt = 0.08; him.headTilt = 0.42; him.headNod = 0.2; him.sleep = true;
        fx('z', (Math.floor(t) % 2 ? herHead : himHead).clone().add(new THREE.Vector3(0, 0.4, 0)));
        break;
      }
      case 'phoneShoulder': {
        her.armsTo = phoneAt; her.phone = true; her.headNod = 0.4;
        him.torsoTilt = 0.22; him.headTilt = 0.5; him.headNod = 0.15; him.sleep = true;
        this.phoneLight.position.copy(phoneAt).add(new THREE.Vector3(0, 0.25, 0.1));
        this.phoneLight.intensity = 1.2;
        fx('z', himHead.clone().add(new THREE.Vector3(0.2, 0.3, 0)));
        break;
      }
    }
    if (her.phone) {
      const k = Math.floor(t / 1.3);
      this.her.rig.phoneScreen.material.color.setHSL((k * 0.17) % 1, 0.6, 0.6).multiplyScalar(1.5);
    }

    const d = this.dog, dp = d.p;
    switch (r.shiba) {
      case 'sleep': dp.kind = 'sleep'; d.heading = 0.6; if (Math.floor(t * 2) % 3 === 0) fx('z', d.pos.clone().add(new THREE.Vector3(0.35, 0.35, 0.25))); break;
      case 'eat': dp.kind = 'eat'; d.heading = 0; break;
      case 'poop': {
        dp.kind = t > this.poopAt && t < this.poopAt + 2.2 ? 'poop' : t > this.poopAt + 2.2 ? 'sit' : 'idle';
        d.heading = 0.4;
        if (t > this.poopAt + 1.4 && !this.poop.visible) {
          this.poop.visible = true;
          this.poop.position.set(d.pos.x - 0.38, 0, d.pos.z + 0.05);
          this.poop.scale.setScalar(1.5);
        }
        if (this.poop.visible) {
          fx('stink', this.poop.position.clone().add(new THREE.Vector3(0, 0.3, 0)));
          him.headTurn = -0.2; him.headNod = 0.5;
          if (r.couple !== 'shoulder' && r.couple !== 'sleepBoth') { her.headNod = 0.5; her.headTurn = 0.2; }
        }
        break;
      }
      case 'zoomies': {
        const a = t * 3.2;
        d.pos.set(0.25 + Math.cos(a) * 0.4, 0, 0.85 + Math.sin(a) * 0.2);
        d.heading = -a;
        d.phase += dt * 22;
        dp.kind = 'run';
        break;
      }
      default: dp.kind = 'sit'; d.heading = Math.sin(t * 0.5) * 0.3;
    }

    for (const pp of [this.her, this.him, this.dog]) pp.update(dt);

    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      f.life += dt;
      if (Math.floor(f.life / STEP) !== Math.floor((f.life - dt) / STEP)) {
        f.s.position.y += 0.035;
        f.s.position.x += f.vx * 0.3;
        f.s.scale.setScalar(0.22 + f.life * 0.08);
        f.s.material.opacity = Math.max(0, 1 - f.life / f.max);
      }
      if (f.life > f.max) {
        this.scene.remove(f.s);
        f.s.material.map.dispose();
        f.s.material.dispose();
        this.fx.splice(i, 1);
      }
    }
    return this.t >= this.duration;
  }
}
