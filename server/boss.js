import { BOSS, PLAYER_RADIUS } from '../shared/constants.js';

const round3 = (v) => Math.round(v * 1000) / 1000;
const ARM_OFFSETS = [0, Math.PI, Math.PI / 2];
const ARENA_RADIUS = 12;

// Per phase (1..3): sweep speed, number of arms, slam rings, meteors per rain.
const TUNING = [
  { sweep: 0.9, arms: 1, rings: 1, rain: 5 },
  { sweep: 1.2, arms: 2, rings: 2, rain: 8 },
  { sweep: 1.5, arms: 3, rings: 3, rain: 11 },
];
const CYCLE = ['sweep', 'slam', 'rain'];

export class Warden {
  constructor(sim) {
    this.sim = sim;
    this.hp = BOSS.hp;
    this.attack = 'idle';
    this.attackT = 0;
    this.cycleIndex = 0;
    this.angle = 0;
    this.rings = [];
    this.slamsLeft = 0;
    this.rainLeft = 0;
    this.windup = 0;
    this.runes = null;
    this.runeAt = 5;
    this.runeHold = 0;
    this.stunUntil = -Infinity;
    this.defeatedAt = null;
    sim.addStaticCylinder(BOSS.hubRadius, BOSS.hubHeight, [0, 0, 0]);
  }

  get phase() {
    return BOSS.hp - this.hp + 1;
  }

  get tuning() {
    return TUNING[Math.min(TUNING.length, this.phase) - 1];
  }

  tick(dt) {
    if (this.defeatedAt !== null) return;
    const s = this.sim;
    this.updateRings(dt);
    this.updateRunes(dt);
    if (this.defeatedAt !== null || s.t < this.stunUntil) return;

    this.attackT += dt;
    const tune = this.tuning;
    switch (this.attack) {
      case 'idle':
        if (this.attackT > 1.4) this.begin(CYCLE[this.cycleIndex++ % CYCLE.length]);
        break;
      case 'sweep':
        this.angle += tune.sweep * dt;
        for (let i = 0; i < tune.arms; i++) {
          s.sweepArm({ cx: 0, cz: 0, floorY: 0, angle: this.angle + ARM_OFFSETS[i], length: BOSS.armReach, hubR: BOSS.hubRadius, speed: tune.sweep });
        }
        if (this.attackT > 7) this.begin('idle');
        break;
      case 'slam':
        this.windup = Math.min(1, this.attackT / 1.1);
        if (this.attackT >= 1.1) {
          this.rings.push({ r: BOSS.hubRadius, hit: new Set() });
          s.emit('slam', {});
          this.slamsLeft--;
          this.attackT = this.slamsLeft > 0 ? 0.3 : 0;
          if (this.slamsLeft <= 0) this.begin('recover');
        }
        break;
      case 'recover':
        this.windup = 0;
        if (this.attackT > 1.8 && !this.rings.length) this.begin('idle');
        break;
      case 'rain':
        if (this.rainLeft > 0 && this.attackT > 0.4) {
          this.attackT = 0;
          this.rainLeft--;
          const living = s.players.filter((p) => p.alive);
          const target = living.length ? living[Math.floor(s.random() * living.length)] : null;
          let x;
          let z;
          if (target && s.random() < 0.6) {
            x = target.body.position.x + (s.random() - 0.5) * 3;
            z = target.body.position.z + (s.random() - 0.5) * 3;
          } else {
            const a = s.random() * Math.PI * 2;
            const r = BOSS.hubRadius + 1 + s.random() * (ARENA_RADIUS - BOSS.hubRadius - 2);
            x = Math.cos(a) * r;
            z = Math.sin(a) * r;
          }
          const d = Math.hypot(x, z);
          if (d > ARENA_RADIUS - 0.8) {
            x *= (ARENA_RADIUS - 0.8) / d;
            z *= (ARENA_RADIUS - 0.8) / d;
          }
          s.spawnMeteorAt(x, z, 0);
        }
        if (this.rainLeft <= 0 && this.attackT > 1.6) this.begin('idle');
        break;
    }
  }

  begin(attack) {
    this.attack = attack;
    this.attackT = 0;
    if (attack === 'slam') this.slamsLeft = this.tuning.rings;
    if (attack === 'rain') this.rainLeft = this.tuning.rain;
    if (attack !== 'idle' && attack !== 'recover') this.sim.emit('boss-attack', { attack });
  }

  updateRings(dt) {
    const s = this.sim;
    for (const ring of this.rings) {
      ring.r += BOSS.ringSpeed * dt;
      for (const p of s.players) {
        if (!p.alive || ring.hit.has(p.index)) continue;
        if (s.feet(p) > 0.45) continue;
        const { x, z } = p.body.position;
        const d = Math.hypot(x, z);
        if (Math.abs(d - ring.r) > BOSS.ringWidth + PLAYER_RADIUS * 0.5) continue;
        ring.hit.add(p.index);
        s.knock(p, x / (d || 1), z / (d || 1), 9, 5, 'shockwave');
      }
    }
    this.rings = this.rings.filter((r) => r.r < ARENA_RADIUS + 1.5);
  }

  placeRunes() {
    const a = this.sim.random() * Math.PI * 2;
    const r = 7;
    const half = Math.asin(BOSS.runeGap / 2 / r);
    this.runes = [a - half, a + half].map((ang) => ({ pos: [round3(Math.cos(ang) * r), 0, round3(Math.sin(ang) * r)], lit: false }));
    this.runeHold = 0;
    this.sim.emit('runes', { runes: this.runes.map((x) => x.pos) });
  }

  updateRunes(dt) {
    const s = this.sim;
    if (!this.runes) {
      if (s.t >= this.runeAt) this.placeRunes();
      return;
    }
    for (const rune of this.runes) {
      rune.lit = s.players.some(
        (p) => p.alive && s.feet(p) < 0.4 && Math.hypot(p.body.position.x - rune.pos[0], p.body.position.z - rune.pos[2]) < 1.1
      );
    }
    this.runeHold = this.runes.every((r) => r.lit) ? this.runeHold + dt : 0;
    if (this.runeHold >= BOSS.runeHold) this.strike();
  }

  strike() {
    const s = this.sim;
    this.hp--;
    this.runes = null;
    this.runeAt = s.t + BOSS.stun + 7;
    this.rings = [];
    this.attack = 'idle';
    this.attackT = 0;
    this.windup = 0;
    s.meteors = [];
    s.emit('strike', { hp: this.hp });
    if (this.hp <= 0) {
      this.defeatedAt = s.t;
      s.emit('boss-defeated', {});
    } else {
      this.stunUntil = s.t + BOSS.stun;
    }
  }

  state() {
    return {
      hp: this.hp,
      maxHp: BOSS.hp,
      attack: this.attack,
      windup: round3(this.windup),
      angle: round3(this.angle),
      arms: this.attack === 'sweep' ? this.tuning.arms : 0,
      rings: this.rings.map((r) => round3(r.r)),
      runes: this.runes?.map((r) => ({ pos: r.pos, lit: r.lit })) ?? null,
      runeHold: round3(this.runeHold / BOSS.runeHold),
      stunned: this.sim.t < this.stunUntil,
      defeated: this.defeatedAt !== null,
    };
  }
}
