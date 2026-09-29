import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as CANNON from 'cannon-es';
import { LevelSim } from '../level.js';
import { LEVELS, levelById } from '../../shared/levels.js';
import { PLAYER_RADIUS, CRUMBLE, RESPAWN_DELAY } from '../../shared/constants.js';

const mkPlayers = () => [0, 1].map((index) => ({ id: `p${index}`, index, avatar: {}, input: { x: 0, z: 0 } }));

function sim(id, opts = {}) {
  const events = [];
  const s = new LevelSim(levelById(id), mkPlayers(), { emit: (e, p) => events.push([e, p]), ...opts });
  const of = (name) => events.filter(([e]) => e === name).map(([, p]) => p);
  return { s, events, of, a: s.players[0], b: s.players[1] };
}

function run(s, seconds, each) {
  for (let i = 0; i < Math.round(seconds * 30) && !s.done; i++) {
    each?.(i);
    s.tick();
  }
}

// Place a player standing on a surface whose top is at y.
const put = (p, x, y, z) => {
  p.body.position.set(x, y + PLAYER_RADIUS, z);
  p.body.velocity.set(0, 0, 0);
};
const press = (s, p) => (p.jumpAt = s.t);

function groundAt(s, x, y, z) {
  const r = new CANNON.RaycastResult();
  s.world.raycastClosest(new CANNON.Vec3(x, y + 4, z), new CANNON.Vec3(x, y - 4, z), {}, r);
  return r.hasHit ? r.hitPointWorld.y : null;
}

function footprint(p) {
  const hw = p.kind === 'disc' ? p.radius : p.size[0] / 2;
  const hd = p.kind === 'disc' ? p.radius : p.size[2] / 2;
  return { minX: p.pos[0] - hw, maxX: p.pos[0] + hw, minZ: p.pos[2] - hd, maxZ: p.pos[2] + hd };
}

function gap(a, b) {
  const dx = Math.max(0, Math.max(a.minX, b.minX) - Math.min(a.maxX, b.maxX));
  const dz = Math.max(0, Math.max(a.minZ, b.minZ) - Math.min(a.maxZ, b.maxZ));
  return Math.hypot(dx, dz);
}

const moved = (p, k) => (k ? { ...p, pos: p.pos.map((v, i) => v + p.move.offset[i]) } : p);

describe('level data', () => {
  for (const def of LEVELS) {
    test(`${def.id}: spawn, checkpoints, goal, plates, pads and hints sit on solid ground`, () => {
      const { s } = sim(def.id);
      run(s, 1.5);
      assert.ok(
        s.players.every((p) => p.alive && p.grounded),
        'players land at the spawn'
      );
      const onGround = (label, [x, y, z]) => {
        const g = groundAt(s, x, y, z);
        assert.ok(g !== null && Math.abs(g - y) < 0.05, `${label} at ${[x, y, z]} (ground ${g})`);
      };
      (def.checkpoints ?? []).forEach((c, i) => {
        onGround(`checkpoint ${i}`, c.pos);
        onGround(`checkpoint ${i} left spawn`, [c.pos[0] - 1.2, c.pos[1], c.pos[2]]);
        onGround(`checkpoint ${i} right spawn`, [c.pos[0] + 1.2, c.pos[1], c.pos[2]]);
      });
      if (def.goal) onGround('goal', def.goal.pos);
      (def.plates ?? []).forEach((p) => onGround(`plate ${p.id}`, p.pos));
      (def.pads ?? []).forEach((p, i) => onGround(`pad ${i}`, p.pos));
      (def.hints ?? []).forEach((h, i) => onGround(`hint ${i}`, h.pos));
    });

    test(`${def.id}: the main route has no gap or climb bigger than a jump (unless via a mechanic)`, () => {
      const route = def.platforms.filter((p) => !p.side && !p.wall);
      for (let i = 1; i < route.length; i++) {
        const [a, b] = [route[i - 1], route[i]];
        if (b.via) continue;
        const aEnds = a.move ? [a, moved(a, 1)] : [a];
        const bEnds = b.move ? [b, moved(b, 1)] : [b];
        let best = Infinity;
        for (const x of aEnds) for (const y of bEnds) best = Math.min(best, gap(footprint(x), footprint(y)));
        const climb = Math.min(...bEnds.map((p) => p.pos[1])) - Math.max(...aEnds.map((p) => p.pos[1]));
        assert.ok(best <= 3.2, `${a.id} -> ${b.id}: gap ${best.toFixed(2)}`);
        assert.ok(climb <= 1.45, `${a.id} -> ${b.id}: climb ${climb.toFixed(2)}`);
      }
    });
  }

  test('level ids are unique and every mover plate exists', () => {
    assert.equal(new Set(LEVELS.map((l) => l.id)).size, LEVELS.length);
    for (const def of LEVELS) {
      const plates = new Set((def.plates ?? []).map((p) => p.id));
      for (const p of def.platforms) for (const id of p.move?.plates ?? []) assert.ok(plates.has(id), `${def.id}: plate ${id}`);
    }
  });
});

describe('co-op mechanics in real level layouts', () => {
  test('jump pad launches both guardians onto the ruins (Awakening)', () => {
    const { s, a, b, of } = sim('awakening');
    put(a, -0.6, 1.8, -31.5);
    put(b, 0.6, 1.8, -30);
    const up = new Set();
    run(s, 1.8, () => {
      for (const [p, x] of [
        [a, 0.2],
        [b, -0.2],
      ]) {
        const done = p.grounded && p.body.position.y > 5.4;
        if (done) up.add(p.index);
        p.input = done ? { x: 0, z: 0 } : { x, z: -1 };
      }
    });
    assert.equal(of('pad').length, 2);
    assert.equal(up.size, 2);
  });

  test('a braced guardian anchors a dangling partner, who can grab the cliff shard and climb back', () => {
    const { s, a, b, of } = sim('awakening');
    put(a, 3.5, 1.8, -31);
    put(b, 4.4, 1.8, -32);
    run(s, 3, (i) => {
      a.input = { x: 0, z: 0, brace: true };
      b.input = { x: i < 20 ? 1 : Math.floor(i / 12) % 2 ? 1 : -1, z: 0 };
    });
    assert.ok(of('gem').length >= 1, 'shard collected while dangling');
    assert.ok(Math.abs(a.body.position.x - 3.5) < 0.05, 'anchor did not budge');
    let back = false;
    run(s, 3, (i) => {
      a.input = { x: 0, z: 0, brace: true };
      b.input = { x: -1, z: 0 };
      if (i % 8 === 0) press(s, b);
      if (b.grounded && b.body.position.y > 2) back = true;
    });
    assert.ok(back, 'partner climbed back up the chain');
    assert.ok(of('climb').length > 0);
  });

  test('climbing the chain gets a partner up a wall too tall to jump (Windward Cliffs)', () => {
    const { s, a, b } = sim('windward-cliffs');
    put(a, 0, 2.8, -31.2);
    put(b, 0, 0, -29);
    run(s, 3, (i) => {
      a.input = { x: 0, z: 0, brace: true };
      const up = b.grounded && b.body.position.y > 3.3;
      b.input = { x: 0, z: up ? 0 : -1 };
      if (b.body.position.y < 3 && i % 12 === 0) press(s, b);
    });
    assert.ok(b.body.position.y > 3.3 && b.grounded, 'on top of the tier');
  });

  test('without bracing, a gust blows guardians off the bridge; braced, they hold', () => {
    for (const brace of [false, true]) {
      const { s, a, b } = sim('windward-cliffs');
      put(a, 0, 0, -10);
      put(b, 0, 0, -13);
      let fell = false;
      run(s, 2.2, () => {
        a.input = { x: 0, z: 0, brace };
        b.input = { x: 0, z: 0, brace };
        if (!a.alive || !b.alive) fell = true;
      });
      assert.equal(fell, !brace);
    }
  });

  test('a lift rises while its plate is held (Broken Bridge)', () => {
    const { s, a, b } = sim('broken-bridge');
    put(a, 0, 0, -57);
    put(b, 2.2, 0, -54);
    run(s, 2.5);
    assert.ok(Math.abs(a.body.position.y - (3.2 + PLAYER_RADIUS)) < 0.1);
    assert.ok(s.plate('lift').active);
  });

  test('twin plates: the gate opens while either plate is held', () => {
    const { s, a, b } = sim('broken-bridge');
    const door = s.movers.find((m) => m.def.id === 'g-door');
    const closedY = door.body.position.y;
    put(a, -1.4, 0, -47.8);
    put(b, -3, 0, -46);
    run(s, 1);
    assert.ok(door.body.position.y < closedY - 2, 'door lowered');
    put(a, -3, 0, -46.5);
    run(s, 1);
    assert.ok(Math.abs(door.body.position.y - closedY) < 0.05, 'door closed again');
  });

  test('riders stay on a moving ferry', () => {
    const { s, a, b } = sim('broken-bridge');
    put(a, 0, 0, -12);
    put(b, 0, 0, -12.8);
    run(s, 3);
    assert.ok(a.alive && b.alive);
    assert.ok(a.body.position.z < -16, `carried forward (z=${a.body.position.z.toFixed(2)})`);
  });

  test('crumbling stone falls after being stood on, then comes back', () => {
    const { s, a, b, of } = sim('awakening');
    put(a, 0, 5, -44.5);
    put(b, 0, 5, -40);
    run(s, CRUMBLE.delay + 0.3);
    assert.deepEqual(
      of('crumble').map((c) => c.state),
      [1, 2]
    );
    run(s, CRUMBLE.respawn + 0.2, () => put(b, 0, 5, -39));
    assert.equal(s.crumbles[0].state, 0);
  });

  test('falling respawns both guardians at the last checkpoint', () => {
    const { s, a, b, of } = sim('awakening');
    put(a, 0, 1.8, -28.2);
    put(b, 1, 1.8, -28.2);
    run(s, 0.2);
    assert.equal(s.checkpoint, 0);
    put(a, 30, -20, -28);
    run(s, RESPAWN_DELAY + 0.3);
    assert.equal(of('respawn').length, 1);
    assert.equal(s.falls, 1);
    assert.ok(s.players.every((p) => p.alive && Math.abs(p.body.position.z + 28.2) < 0.5));
  });

  test('reaching the goal together completes the level with stats', () => {
    const { s, a, b } = sim('awakening');
    put(a, -1, 5, -62.5);
    put(b, 1, 5, -62.5);
    run(s, 0.5);
    assert.equal(s.done, true);
    assert.deepEqual(Object.keys(s.stats).sort(), ['falls', 'gems', 'time', 'totalGems']);
    assert.equal(s.stats.totalGems, 3);
  });

  test('one guardian alone at the goal is not enough', () => {
    const { s, a, b } = sim('awakening');
    put(a, 0, 5, -62.5);
    put(b, 0, 5, -58);
    run(s, 0.5);
    assert.equal(s.done, false);
  });
});

describe('the Iron Warden', () => {
  test('standing on both runes at once strikes it; three strikes defeat it', () => {
    let seed = 5;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const { s, a, b, of } = sim('iron-warden', { random });
    const boss = s.boss;
    let guard = 0;
    while (!s.done && guard++ < 30 * 200) {
      if (boss.runes) {
        put(a, boss.runes[0].pos[0], 0, boss.runes[0].pos[2]);
        put(b, boss.runes[1].pos[0], 0, boss.runes[1].pos[2]);
      }
      s.tick();
    }
    assert.equal(of('strike').length, 3);
    assert.equal(of('boss-defeated').length, 1);
    assert.equal(s.done, true);
  });

  test('its attacks punish guardians who stand still', () => {
    const { s, of } = sim('iron-warden');
    run(s, 40);
    assert.ok(of('hit').length > 0);
    assert.ok(s.falls > 0);
  });
});
