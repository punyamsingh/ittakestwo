import * as CANNON from 'cannon-es';
import {
  TICK_RATE,
  GRAVITY,
  PLAYER_RADIUS,
  SPAWN_SPREAD,
  MOVE,
  CHAIN,
  BRACE,
  PAD_POWER,
  RESPAWN_DELAY,
  GEM_RADIUS,
  PLATE_RADIUS,
  CRUMBLE,
  SWEEPER,
  METEOR,
} from '../shared/constants.js';
import { Warden } from './boss.js';

export const DT = 1 / TICK_RATE;
const R = PLAYER_RADIUS;
const round3 = (v) => Math.round(v * 1000) / 1000;
const vec = (v) => [round3(v.x), round3(v.y), round3(v.z)];
const smooth = (x) => x * x * (3 - 2 * x);
const ZERO = new CANNON.Vec3();
const SPINNER_HUB = { radius: 0.7, height: 1.1 };

function shapeFor(p) {
  if (p.kind === 'disc') {
    return { shape: new CANNON.Cylinder(p.radius, p.radius, p.height, 32), center: new CANNON.Vec3(p.pos[0], p.pos[1] - p.height / 2, p.pos[2]) };
  }
  const [w, h, d] = p.size;
  return { shape: new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2)), center: new CANNON.Vec3(p.pos[0], p.pos[1] - h / 2, p.pos[2]) };
}

/**
 * One attempt at a level. `players` are the room's player records; this class
 * owns their physics bodies while the level runs.
 */
export class LevelSim {
  constructor(def, players, { emit, random = Math.random, clock = () => performance.now() }) {
    this.def = def;
    this.players = players;
    this.random = random;
    this.clock = clock;
    this.emit = (event, payload = {}) => emit(event, { ...payload, now: clock() });

    this.t = 0;
    this.falls = 0;
    this.done = false;
    this.respawnAt = null;
    this.checkpoint = -1;

    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -GRAVITY, 0) });
    this.world.defaultContactMaterial.friction = 0;
    this.world.defaultContactMaterial.restitution = 0;

    this.movers = [];
    this.crumbles = [];
    for (const p of def.platforms) this.addPlatform(p);

    this.spinners = (def.spinners ?? []).map((s) => {
      this.addStaticCylinder(SPINNER_HUB.radius, SPINNER_HUB.height, s.pos);
      return { ...s, angle: 0 };
    });
    this.plates = (def.plates ?? []).map((p) => ({ ...p, active: false }));
    this.pads = (def.pads ?? []).map((p) => ({ ...p }));
    this.wind = (def.wind ?? []).map((w) => ({ ...w, state: 0 }));
    this.zones = (def.meteorZones ?? []).map((z) => ({ ...z, next: 0 }));
    this.meteors = [];
    this.meteorSeq = 0;
    this.gems = (def.gems ?? []).map((pos) => ({ pos, taken: false }));
    this.hintsShown = new Set();
    this.boss = def.boss === 'warden' ? new Warden(this) : null;

    for (const p of players) {
      // Guardians don't collide with each other (the chain already binds them), so
      // they can't shove each other off ledges or block a climb.
      p.body = new CANNON.Body({ mass: 1, shape: new CANNON.Sphere(R), fixedRotation: true, linearDamping: 0.05, collisionFilterGroup: 2, collisionFilterMask: 1 });
      this.world.addBody(p.body);
    }
    this.placePlayers(def.spawn);
  }

  // ---------- construction ----------

  addPlatform(p) {
    const { shape, center } = shapeFor(p);
    const body = new CANNON.Body({ mass: 0, shape, position: center });
    if (p.move) {
      body.type = CANNON.Body.KINEMATIC;
      this.movers.push({ def: p, body, from: center.clone(), progress: 0 });
    }
    this.world.addBody(body);
    if (p.crumble) this.crumbles.push({ def: p, body, state: 0, timer: 0 });
    return body;
  }

  addStaticCylinder(radius, height, [x, y, z]) {
    const body = new CANNON.Body({ mass: 0, shape: new CANNON.Cylinder(radius, radius, height, 24), position: new CANNON.Vec3(x, y + height / 2, z) });
    this.world.addBody(body);
    return body;
  }

  spawnPoint() {
    return this.checkpoint >= 0 ? this.def.checkpoints[this.checkpoint].pos : this.def.spawn;
  }

  placePlayers([x, y, z]) {
    for (const p of this.players) {
      p.body.position.set(x + (p.index === 0 ? -SPAWN_SPREAD : SPAWN_SPREAD), y + R + 0.3, z);
      p.body.velocity.set(0, 0, 0);
      p.alive = true;
      p.grounded = false;
      p.groundBody = null;
      p.braced = false;
      p.input = { x: 0, z: 0, brace: false };
      p.jumpAt = -Infinity;
      p.lastGroundedAt = -Infinity;
      p.stunUntil = -Infinity;
      p.hitCooldownUntil = -Infinity;
      p.lastHit = null;
    }
  }

  // ---------- helpers shared with the boss ----------

  feet(p) {
    return p.body.position.y - R;
  }

  knock(p, dirX, dirZ, speed, lift, kind) {
    const len = Math.hypot(dirX, dirZ) || 1;
    const v = p.body.velocity;
    v.x = (dirX / len) * speed;
    v.z = (dirZ / len) * speed;
    v.y = lift;
    p.grounded = false;
    p.braced = false;
    p.lastGroundedAt = -Infinity;
    p.stunUntil = this.t + MOVE.stunTime;
    p.lastHit = { kind, at: this.t };
    this.emit('hit', { index: p.index, kind, pos: vec(p.body.position) });
  }

  sweepArm({ cx, cz, floorY, angle, length, hubR, speed }) {
    const ax = Math.cos(angle);
    const az = Math.sin(angle);
    for (const p of this.players) {
      if (!p.alive || this.t < p.hitCooldownUntil) continue;
      const { x, z } = p.body.position;
      const above = this.feet(p) - floorY;
      if (above > SWEEPER.top || above < -0.6) continue;
      const dx = x - cx;
      const dz = z - cz;
      const along = dx * ax + dz * az;
      if (along < hubR - 0.2 || along > length + R * 0.5) continue;
      if (Math.abs(-dx * az + dz * ax) > SWEEPER.halfWidth + R) continue;
      p.hitCooldownUntil = this.t + SWEEPER.cooldown;
      const k = SWEEPER.knockbackBase + along * speed * SWEEPER.knockbackScale;
      this.knock(p, ax - az * SWEEPER.tangential, az + ax * SWEEPER.tangential, k, SWEEPER.lift, 'sweeper');
    }
  }

  spawnMeteorAt(x, z, groundY) {
    this.meteors.push({ id: ++this.meteorSeq, x, z, gy: groundY, y: groundY + METEOR.spawnHeight, age: 0 });
  }

  // ---------- simulation ----------

  tick(dt = DT) {
    if (this.done) return;
    this.t += dt;

    this.updateMovers(dt);
    this.updateCrumbles(dt);
    this.applyControls();
    this.applyChain();
    this.applyWind();
    for (const s of this.spinners) {
      s.angle += s.speed * dt;
      for (let i = 0; i < (s.arms ?? 1); i++) {
        this.sweepArm({ cx: s.pos[0], cz: s.pos[2], floorY: s.pos[1], angle: s.angle + (i * Math.PI * 2) / (s.arms ?? 1), length: s.length, hubR: SPINNER_HUB.radius, speed: s.speed });
      }
    }
    this.updateMeteors(dt);
    this.boss?.tick(dt);

    const vyBefore = this.players.map((p) => p.body.velocity.y);
    this.world.step(dt);
    this.updateGrounded(vyBefore);
    this.updatePads();
    this.updatePlates();
    this.updatePickups();
    this.updateFalls();
    this.updateGoal();
  }

  updateMovers(dt) {
    for (const m of this.movers) {
      const mv = m.def.move;
      let u;
      if (mv.plates) {
        const on = mv.any ? mv.plates.some((id) => this.plate(id)?.active) : mv.plates.every((id) => this.plate(id)?.active);
        const step = dt / (mv.duration ?? 1);
        m.progress = Math.max(0, Math.min(1, m.progress + (on ? step : -step)));
        u = smooth(m.progress);
      } else {
        const s = (this.t / mv.period + (mv.phase ?? 0)) % 1;
        const tri = s < 0.5 ? s * 2 : 2 - s * 2;
        const pause = 0.12;
        u = smooth(Math.max(0, Math.min(1, (tri - pause) / (1 - 2 * pause))));
      }
      const [ox, oy, oz] = mv.offset;
      const tx = m.from.x + ox * u;
      const ty = m.from.y + oy * u;
      const tz = m.from.z + oz * u;
      const b = m.body.position;
      m.body.velocity.set((tx - b.x) / dt, (ty - b.y) / dt, (tz - b.z) / dt);
    }
  }

  updateCrumbles(dt) {
    this.crumbles.forEach((c, index) => {
      if (c.state === 0) {
        if (this.players.some((p) => p.alive && p.groundBody === c.body)) {
          c.state = 1;
          c.timer = CRUMBLE.delay;
          this.emit('crumble', { index, state: 1 });
        }
      } else {
        c.timer -= dt;
        if (c.timer > 0) return;
        if (c.state === 1) {
          c.state = 2;
          c.timer = CRUMBLE.respawn;
          this.world.removeBody(c.body);
          this.emit('crumble', { index, state: 2 });
        } else {
          this.restoreCrumble(c);
        }
      }
    });
  }

  restoreCrumble(c) {
    if (c.state === 2) this.world.addBody(c.body);
    c.state = 0;
    c.timer = 0;
  }

  applyControls() {
    for (const p of this.players) {
      if (!p.alive) continue;
      const body = p.body;
      const v = body.velocity;
      const gv = p.groundBody?.type === CANNON.Body.KINEMATIC ? p.groundBody.velocity : ZERO;
      const stunned = this.t < p.stunUntil;

      p.braced = p.input.brace && p.grounded && !stunned;
      if (p.braced) {
        v.x = gv.x;
        v.z = gv.z;
        continue;
      }

      let { x, z } = p.input;
      const len = Math.hypot(x, z);
      if (len > 1) {
        x /= len;
        z /= len;
      }
      const onMover = p.grounded && gv !== ZERO;
      let fx = 0;
      let fz = 0;
      if (len > 0.05) {
        const accel = (p.grounded ? MOVE.groundAccel : MOVE.airAccel) * (stunned ? 0.15 : 1);
        fx = (x * MOVE.maxSpeed + gv.x - v.x) * accel;
        fz = (z * MOVE.maxSpeed + gv.z - v.z) * accel;
      } else if (onMover && !stunned) {
        // Riders stick to the platform instead of sliding off when it slows.
        v.x = gv.x;
        v.z = gv.z;
      } else if (p.grounded && !stunned) {
        fx = (gv.x - v.x) * MOVE.brake;
        fz = (gv.z - v.z) * MOVE.brake;
      }
      const mag = Math.hypot(fx, fz);
      if (mag > MOVE.maxForce) {
        fx *= MOVE.maxForce / mag;
        fz *= MOVE.maxForce / mag;
      }
      body.applyForce(new CANNON.Vec3(fx, 0, fz));

      const buffered = this.t - p.jumpAt <= MOVE.jumpBuffer;
      const coyote = this.t - p.lastGroundedAt <= MOVE.coyoteTime;
      if (buffered && !coyote) this.tryClimb(p);
      else if (buffered && coyote) {
        v.y = MOVE.jumpSpeed + Math.max(0, gv.y);
        p.jumpAt = -Infinity;
        p.lastGroundedAt = -Infinity;
        p.grounded = false;
        this.emit('jump', { index: p.index });
      }
    }
  }

  applyChain() {
    const [a, b] = this.players;
    if (!a?.body || !b?.body) return;
    const delta = b.body.position.vsub(a.body.position);
    const dist = delta.length();
    if (dist < 1e-4) return;
    const dir = delta.scale(1 / dist);

    if (dist > CHAIN.length) {
      const separating = b.body.velocity.vsub(a.body.velocity).dot(dir);
      const mag = Math.min((dist - CHAIN.length) * CHAIN.stiffness + Math.max(0, separating) * 4, CHAIN.maxForce);
      if (!a.braced) a.body.applyForce(dir.scale(mag));
      if (!b.braced) b.body.applyForce(dir.scale(-mag));
    }
  }

  partnerOf(p) {
    return this.players.find((o) => o !== p);
  }

  // Dangling below a braced partner, a jump pulls you up the chain toward them.
  tryClimb(p) {
    const anchor = this.partnerOf(p);
    if (!anchor?.braced || p.grounded || this.t - (p.lastClimbAt ?? -Infinity) < BRACE.climbCooldown) return false;
    const toAnchor = anchor.body.position.vsub(p.body.position);
    const dist = toAnchor.length();
    // Only a partner hanging below their anchor can climb toward it.
    if (dist < BRACE.climbMinDistance || toAnchor.y < 0.2) return false;
    const v = p.body.velocity;
    if (toAnchor.y < 1.3) {
      // Near the lip: mantle over toward the anchor.
      const flat = Math.hypot(toAnchor.x, toAnchor.z) || 1;
      v.x = (toAnchor.x / flat) * BRACE.climbPull;
      v.z = (toAnchor.z / flat) * BRACE.climbPull;
    } else {
      // Far below: climb straight up so the ledge underside doesn't block you.
      v.x *= 0.5;
      v.z *= 0.5;
    }
    v.y = BRACE.climbUp;
    p.lastClimbAt = this.t;
    p.jumpAt = -Infinity;
    this.emit('climb', { index: p.index });
    return true;
  }

  windState(w) {
    const cycle = w.on + w.off;
    const local = (((this.t + (w.offset ?? 0)) % cycle) + cycle) % cycle;
    if (local < w.on) return 2;
    if (local > cycle - 0.9) return 1;
    return 0;
  }

  applyWind() {
    for (const w of this.wind) {
      w.state = this.windState(w);
      if (w.state !== 2) continue;
      for (const p of this.players) {
        if (!p.alive || p.braced) continue;
        const { x, y, z } = p.body.position;
        if (x < w.min[0] || x > w.max[0] || y < w.min[1] || y > w.max[1] || z < w.min[2] || z > w.max[2]) continue;
        p.body.applyForce(new CANNON.Vec3(w.force[0], w.force[1], w.force[2]));
      }
    }
  }

  zoneContains(zone, x, z, margin = 0) {
    const [cx, , cz] = zone.center;
    if (zone.size) return Math.abs(x - cx) <= zone.size[0] / 2 + margin && Math.abs(z - cz) <= zone.size[1] / 2 + margin;
    return Math.hypot(x - cx, z - cz) <= zone.radius + margin;
  }

  updateMeteors(dt) {
    for (const zone of this.zones) {
      const near = this.players.filter(
        (p) => p.alive && this.zoneContains(zone, p.body.position.x, p.body.position.z, 4) && Math.abs(p.body.position.y - zone.center[1]) < 5
      );
      if (!near.length) {
        zone.next = Math.max(zone.next, this.t + 0.6);
        continue;
      }
      if (this.t < zone.next) continue;
      zone.next = this.t + zone.interval;
      const [cx, cy, cz] = zone.center;
      let x;
      let z;
      const inside = near.filter((p) => this.zoneContains(zone, p.body.position.x, p.body.position.z));
      if (inside.length && this.random() < 0.5) {
        const p = inside[Math.floor(this.random() * inside.length)].body.position;
        x = p.x + (this.random() - 0.5) * 2.4;
        z = p.z + (this.random() - 0.5) * 2.4;
      } else if (zone.size) {
        x = cx + (this.random() - 0.5) * zone.size[0];
        z = cz + (this.random() - 0.5) * zone.size[1];
      } else {
        const a = this.random() * Math.PI * 2;
        const r = Math.sqrt(this.random()) * zone.radius;
        x = cx + Math.cos(a) * r;
        z = cz + Math.sin(a) * r;
      }
      if (zone.size) {
        x = Math.max(cx - zone.size[0] / 2, Math.min(cx + zone.size[0] / 2, x));
        z = Math.max(cz - zone.size[1] / 2, Math.min(cz + zone.size[1] / 2, z));
      } else {
        const d = Math.hypot(x - cx, z - cz);
        if (d > zone.radius) {
          x = cx + ((x - cx) * zone.radius) / d;
          z = cz + ((z - cz) * zone.radius) / d;
        }
      }
      this.spawnMeteorAt(x, z, cy);
    }

    const landed = [];
    for (const m of this.meteors) {
      m.age += dt;
      const k = Math.min(1, m.age / METEOR.fallTime);
      m.y = m.gy + METEOR.radius + METEOR.spawnHeight * (1 - k * k);
      if (k >= 1) landed.push(m);
    }
    for (const m of landed) this.detonate(m);
    if (landed.length) this.meteors = this.meteors.filter((m) => !landed.includes(m));
  }

  detonate(m) {
    this.emit('impact', { pos: [round3(m.x), m.gy, round3(m.z)] });
    for (const p of this.players) {
      if (!p.alive) continue;
      const above = this.feet(p) - m.gy;
      if (above > 1.5 || above < -1) continue;
      const dx = p.body.position.x - m.x;
      const dz = p.body.position.z - m.z;
      const d = Math.hypot(dx, dz);
      if (d > METEOR.blastRadius) continue;
      const ang = d > 0.01 ? Math.atan2(dz, dx) : this.random() * Math.PI * 2;
      this.knock(p, Math.cos(ang), Math.sin(ang), METEOR.knockback * (0.6 + 0.4 * (1 - d / METEOR.blastRadius)), METEOR.lift, 'meteor');
    }
  }

  updateGrounded(vyBefore) {
    this.players.forEach((p, i) => {
      let ground = null;
      for (const c of this.world.contacts) {
        if (c.bi === p.body && c.ni.y < -0.5) ground = c.bj;
        else if (c.bj === p.body && c.ni.y > 0.5) ground = c.bi;
        if (ground) break;
      }
      if (ground) {
        if (!p.grounded && vyBefore[i] < -4 && p.alive) this.emit('land', { index: p.index, speed: round3(-vyBefore[i]) });
        p.lastGroundedAt = this.t;
      }
      p.grounded = !!ground;
      p.groundBody = ground;
    });
  }

  updatePads() {
    this.pads.forEach((pad, padIndex) => {
      for (const p of this.players) {
        if (!p.alive || !p.grounded) continue;
        const { x, z } = p.body.position;
        if (Math.hypot(x - pad.pos[0], z - pad.pos[2]) > 0.95 || Math.abs(this.feet(p) - pad.pos[1]) > 0.3) continue;
        p.body.velocity.y = pad.power ?? PAD_POWER;
        p.grounded = false;
        p.lastGroundedAt = -Infinity;
        this.emit('pad', { index: p.index, pad: padIndex, pos: pad.pos });
      }
    });
  }

  plate(id) {
    return this.plates.find((p) => p.id === id);
  }

  updatePlates() {
    for (const plate of this.plates) {
      const [px, py, pz] = plate.pos;
      const active = this.players.some(
        (p) => p.alive && Math.hypot(p.body.position.x - px, p.body.position.z - pz) < PLATE_RADIUS && Math.abs(this.feet(p) - py) < 0.35
      );
      if (active !== plate.active) this.emit('plate', { id: plate.id, active });
      plate.active = active;
    }
  }

  updatePickups() {
    for (const p of this.players) {
      if (!p.alive) continue;
      const { x, y, z } = p.body.position;
      this.gems.forEach((g, i) => {
        if (g.taken) return;
        if (Math.hypot(x - g.pos[0], y - g.pos[1], z - g.pos[2]) > GEM_RADIUS + R * 0.5) return;
        g.taken = true;
        this.emit('gem', { index: i, by: p.index, pos: g.pos });
      });
      (this.def.checkpoints ?? []).forEach((c, i) => {
        if (i <= this.checkpoint) return;
        if (Math.hypot(x - c.pos[0], z - c.pos[2]) > 2.2 || Math.abs(y - R - c.pos[1]) > 1.5) return;
        this.checkpoint = i;
        this.emit('checkpoint', { index: i, pos: c.pos });
      });
      (this.def.hints ?? []).forEach((h, i) => {
        if (this.hintsShown.has(i)) return;
        if (Math.hypot(x - h.pos[0], z - h.pos[2]) > h.radius || Math.abs(y - R - h.pos[1]) > 2) return;
        this.hintsShown.add(i);
        this.emit('hint', { index: i });
      });
    }
  }

  updateFalls() {
    for (const p of this.players) {
      if (!p.alive || p.body.position.y >= this.def.killY) continue;
      p.alive = false;
      if (this.respawnAt === null) {
        this.falls++;
        this.respawnAt = this.t + RESPAWN_DELAY;
      }
      this.emit('fell', { index: p.index });
    }
    if (this.respawnAt !== null && this.t >= this.respawnAt) {
      this.respawnAt = null;
      this.placePlayers(this.spawnPoint());
      for (const c of this.crumbles) this.restoreCrumble(c);
      this.meteors = [];
      this.emit('respawn', { checkpoint: this.checkpoint });
    }
  }

  updateGoal() {
    if (this.boss) {
      if (this.boss.defeatedAt !== null && this.t - this.boss.defeatedAt > 2.5) this.finish();
      return;
    }
    const g = this.def.goal;
    if (!g || this.respawnAt !== null) return;
    const inside = this.players.every(
      (p) => p.alive && Math.hypot(p.body.position.x - g.pos[0], p.body.position.z - g.pos[2]) < (g.radius ?? 2.5) && Math.abs(this.feet(p) - g.pos[1]) < 2
    );
    if (inside) this.finish();
  }

  finish() {
    this.done = true;
    this.stats = {
      time: round3(this.t),
      gems: this.gems.filter((g) => g.taken).length,
      totalGems: this.gems.length,
      falls: this.falls,
    };
  }

  state() {
    return {
      t: round3(this.t),
      players: this.players.map((p) => ({ index: p.index, alive: p.alive, braced: !!p.braced, pos: vec(p.body.position) })),
      movers: this.movers.map((m) => vec(m.body.position)),
      crumbles: this.crumbles.map((c) => c.state),
      plates: this.plates.map((p) => p.active),
      wind: this.wind.map((w) => w.state),
      spinners: this.spinners.map((s) => round3(s.angle)),
      meteors: this.meteors.map((m) => ({ id: m.id, pos: [round3(m.x), round3(m.y), round3(m.z)], k: round3(Math.min(1, m.age / METEOR.fallTime)), gy: m.gy })),
      gems: this.gems.map((g) => g.taken),
      checkpoint: this.checkpoint,
      boss: this.boss?.state() ?? null,
    };
  }
}
