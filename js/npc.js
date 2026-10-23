// The companion (taller, glasses, backpack) and the shiba guide.
import * as THREE from 'three';
import { turnToward } from './characters.js';

const rand = (a, b) => a + Math.random() * (b - a);
const _a = new THREE.Vector3(), _b = new THREE.Vector3();

function sideVec(heading) { return new THREE.Vector3(-Math.cos(heading), 0, Math.sin(heading)); }
function fwdVec(heading) { return new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading)); }

// Index of the arm (0 = local -x, 1 = local +x) on the side facing `other`.
export function innerArm(me, other) {
  _a.subVectors(other.pos, me.pos);
  return _a.dot(sideVec(me.heading)) > 0 ? 0 : 1;
}

export class CompanionAI {
  constructor(puppet, player, hooks) {
    this.c = puppet;
    this.player = player;
    this.hooks = hooks; // { flash(pos), resolve(p, r) }
    this.reset();
  }
  reset() {
    this.state = 'follow';
    this.timer = rand(5, 8);
    this.trail = [];
    this.sample = 0;
    this.side = 1;
    this.speed = 0;
  }
  get holding() { return this.state === 'hold'; }

  trailPoint(back) {
    let d = 0;
    for (let i = this.trail.length - 1; i > 0; i--) {
      d += this.trail[i].distanceTo(this.trail[i - 1]);
      if (d >= back) return this.trail[i - 1];
    }
    return this.trail[0] ?? this.player.pos;
  }
  holdPoint(moving) {
    const h = this.player.heading;
    return this.player.pos.clone()
      .addScaledVector(sideVec(h), this.side * 0.62)
      .addScaledVector(fwdVec(h), moving ? -0.38 : 0);
  }

  update(dt, { herSpeed, mode, photoFlash }) {
    const me = this.c, her = this.player;
    if (mode !== 'photo') this.flashedHer = false;
    this.sample -= dt;
    if (this.sample <= 0) {
      this.sample = 0.08;
      const last = this.trail[this.trail.length - 1];
      if (!last || last.distanceTo(her.pos) > 0.15) {
        this.trail.push(her.pos.clone());
        if (this.trail.length > 90) this.trail.shift();
      }
    }
    const moving = herSpeed > 0.4;
    const dist = me.pos.distanceTo(her.pos);
    let target = null, maxSpeed = Math.max(herSpeed * 1.15, 2.6), face = null;
    const p = me.p;
    p.photo = false; p.lean = 0; p.hold = null;

    if (dist > 16) {
      const tp = this.trailPoint(2);
      me.pos.set(tp.x, 0, tp.z);
      this.state = 'follow';
    }

    if (mode === 'photo') {
      this.state = 'follow';
      // Photographing her while she photographs the landmark.
      target = her.pos.clone().addScaledVector(sideVec(her.heading), -this.side * 1.4).addScaledVector(fwdVec(her.heading), 0.6);
      face = her.pos;
      p.photo = me.pos.distanceTo(target) < 0.4;
      if (p.photo && !this.flashedHer && photoFlash) { this.flashedHer = true; this.hooks.flash(me); }
    } else if (mode === 'idle') {
      target = this.holdPoint(false);
      face = null;
    } else {
      switch (this.state) {
        case 'follow': {
          target = moving ? this.trailPoint(1.3) : her.pos.clone().addScaledVector(sideVec(her.heading), this.side * 0.9).addScaledVector(fwdVec(her.heading), -0.5);
          this.timer -= dt;
          if (this.timer <= 0) {
            if (moving && Math.random() < 0.4) {
              this.state = 'photo';
              this.timer = 1.7;
              this.flashed = false;
              this.photoHeading = me.heading + rand(-2.2, 2.2);
            } else {
              this.state = 'catchup';
              this.side = innerArm(her, me) === 0 ? 1 : -1;
            }
          }
          break;
        }
        case 'photo': {
          maxSpeed = 0;
          face = null;
          me.heading = turnToward(me.heading, this.photoHeading, dt * 8);
          p.photo = this.timer < 1.4 && this.timer > 0.25;
          this.timer -= dt;
          if (!this.flashed && this.timer < 0.8) {
            this.flashed = true;
            this.hooks.flash(me);
          }
          if (this.timer <= 0 || dist > 10) {
            this.state = 'catchup';
            this.side = innerArm(her, me) === 0 ? 1 : -1;
          }
          break;
        }
        case 'catchup': {
          target = this.holdPoint(moving);
          maxSpeed = 6.8;
          if (me.pos.distanceTo(target) < 0.5) {
            this.state = 'hold';
            this.timer = rand(4, 9);
          }
          break;
        }
        case 'hold': {
          const hp = this.holdPoint(moving);
          if (me.pos.distanceTo(hp) > 1.6) { this.state = 'catchup'; break; }
          const prev = me.pos.clone();
          me.pos.lerp(hp, 1 - Math.exp(-dt * 14));
          this.hooks.resolve(me.pos, 0.28);
          this.speed = prev.distanceTo(me.pos) / Math.max(dt, 1e-4);
          me.heading = turnToward(me.heading, her.heading, dt * 10);
          p.lean = moving ? -0.2 : 0;
          this.timer -= dt;
          if (this.timer <= 0) {
            this.state = 'follow';
            this.timer = rand(6, 11);
          }
          break;
        }
      }
    }

    if (this.state !== 'hold' || mode === 'photo' || mode === 'idle') {
      if (target && maxSpeed > 0) {
        _b.subVectors(target, me.pos).setY(0);
        const d = _b.length();
        const sp = Math.min(maxSpeed, d * 3.2);
        if (d > 0.05) {
          const step = Math.min(d, sp * dt);
          me.pos.addScaledVector(_b.normalize(), step);
          this.hooks.resolve(me.pos, 0.28);
          this.speed = step / Math.max(dt, 1e-4);
          if (sp > 0.3) me.heading = turnToward(me.heading, Math.atan2(_b.x, _b.z), dt * 10);
        } else this.speed = 0;
      } else if (maxSpeed === 0) this.speed = 0;
      if (face && this.speed < 0.3) {
        _b.subVectors(face, me.pos);
        me.heading = turnToward(me.heading, Math.atan2(_b.x, _b.z), dt * 6);
      } else if (!face && this.speed < 0.3 && dist < 2 && this.state !== 'photo') {
        me.heading = turnToward(me.heading, her.heading, dt * 4);
      }
    }

    const sp = this.speed;
    p.walk = Math.min(1, sp / 3);
    p.run = sp > 4.2;
    me.phase += sp * dt * (p.run ? 2.2 : 2.6);

    const holding = (this.state === 'hold' && mode !== 'photo') || mode === 'idle';
    if (holding) {
      const mid = _a.addVectors(me.pos, her.pos).multiplyScalar(0.5).setY(0.82).clone();
      p.hold = { side: innerArm(me, her), target: mid };
      her.p.hold = { side: innerArm(her, me), target: mid };
    } else {
      her.p.hold = null;
    }
  }
}

export class ShibaAI {
  constructor(puppet, hooks) {
    this.d = puppet;
    this.hooks = hooks; // { bark(puppet), resolve }
    this.path = [];
    this.idx = 0;
    this.arrived = true;
    this.wait = 0;
    this.barkT = 0;
  }
  setPath(path, goal) {
    this.path = path;
    this.idx = 0;
    this.goal = goal.clone();
    this.arrived = path.length === 0;
    this.wait = 0;
  }
  update(dt, player, frozen) {
    const d = this.d, p = d.p;
    const dist = d.pos.distanceTo(player.pos);
    let speed = 0;
    this.barkT = Math.max(0, this.barkT - dt);
    if (!frozen && !this.arrived && this.idx < this.path.length) {
      if (dist > 7.5) {
        this.wait += dt;
        _b.subVectors(player.pos, d.pos);
        d.heading = turnToward(d.heading, Math.atan2(_b.x, _b.z), dt * 6);
        if (this.wait > 2.4) { this.wait = 0; this.barkT = 0.7; this.hooks.bark(d); }
      } else {
        this.wait = 0;
        speed = dist < 2.2 ? 5.2 : dist < 5 ? 3.4 : 2.2;
        const wp = this.path[this.idx];
        _b.subVectors(wp, d.pos).setY(0);
        const len = _b.length();
        if (len < 0.35) {
          this.idx++;
          if (this.idx >= this.path.length) this.arrived = true;
        } else {
          d.pos.addScaledVector(_b.normalize(), Math.min(len, speed * dt));
          d.heading = turnToward(d.heading, Math.atan2(_b.x, _b.z), dt * 9);
        }
      }
    } else {
      _b.subVectors(player.pos, d.pos);
      if (dist > 0.5) d.heading = turnToward(d.heading, Math.atan2(_b.x, _b.z), dt * 4);
    }
    d.phase += speed * dt * 4.5;
    p.phase = d.phase;
    if (this.barkT > 0) p.kind = 'bark';
    else if (speed > 4) p.kind = 'run';
    else if (speed > 0) p.kind = 'walk';
    else if (this.arrived) p.kind = 'sit';
    else p.kind = 'idle';
  }
}
