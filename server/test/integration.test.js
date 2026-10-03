import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { io as ioClient } from 'socket.io-client';
import { createApp } from '../app.js';

const TEST_TIMEOUT = 12000;

// Records every event from the moment the socket is created, so a test can
// never miss an event that arrived before it started waiting for it.
class TestClient {
  constructor(socket) {
    this.socket = socket;
    this.queue = [];
    this.seen = [];
    this.waiters = [];
    socket.onAny((event, payload) => {
      this.seen.push({ event, payload });
      const i = this.waiters.findIndex((w) => w.event === event && w.predicate(payload));
      if (i !== -1) {
        const [w] = this.waiters.splice(i, 1);
        clearTimeout(w.timer);
        w.resolve(payload);
      } else {
        this.queue.push({ event, payload });
      }
    });
  }

  get id() {
    return this.socket.id;
  }

  emit(...args) {
    this.socket.emit(...args);
  }

  next(event, predicate = () => true, timeoutMs = 2000) {
    const i = this.queue.findIndex((e) => e.event === event && predicate(e.payload));
    if (i !== -1) return Promise.resolve(this.queue.splice(i, 1)[0].payload);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter((w) => w.timer !== timer);
        reject(new Error(`timed out waiting for '${event}'`));
      }, timeoutMs);
      this.waiters.push({ event, predicate, resolve, timer });
    });
  }

  allSeen(event) {
    return this.seen.filter((e) => e.event === event).map((e) => e.payload);
  }

  // Asserts no new `event` arrives during the next `ms` milliseconds.
  async expectNone(event, ms = 150) {
    const before = this.allSeen(event).length;
    await new Promise((r) => setTimeout(r, ms));
    assert.equal(this.allSeen(event).length, before, `unexpected '${event}' event`);
  }

  close() {
    for (const w of this.waiters) clearTimeout(w.timer);
    this.waiters = [];
    this.socket.close();
  }
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const socket = ioClient(url, { transports: ['websocket'], reconnection: false });
    const client = new TestClient(socket);
    socket.once('connect', () => resolve(client));
    socket.once('connect_error', reject);
  });
}

// Fresh server per test; server and sockets are always closed, even when an
// assertion throws, so a failure can't leave the process hanging.
function withServer(name, fn) {
  test(name, { timeout: TEST_TIMEOUT }, async () => {
    const { httpServer, rooms } = createApp();
    await new Promise((resolve) => httpServer.listen(0, resolve));
    const url = `http://localhost:${httpServer.address().port}`;
    const clients = [];
    const track = async () => {
      const c = await connect(url);
      clients.push(c);
      return c;
    };
    try {
      await fn({ rooms, connect: track });
    } finally {
      for (const c of clients) c.close();
      await new Promise((resolve) => httpServer.close(resolve));
    }
  });
}

async function setupRoom(connect, progress = 0) {
  const host = await connect();
  const guest = await connect();
  host.emit('create-room', { progress });
  const { code } = await host.next('room-created');
  guest.emit('join-room', { code });
  await guest.next('room-joined');
  await host.next('lobby-update', (l) => l.players.length === 2);
  return { host, guest, code };
}

describe('room lifecycle over the wire', () => {
  withServer('create, join, lobby-update broadcast to both players', async ({ connect }) => {
    const host = await connect();
    const guest = await connect();

    host.emit('create-room');
    const { code } = await host.next('room-created');
    assert.match(code, /^[A-Z0-9]{4}$/);

    guest.emit('join-room', { code });
    const { index } = await guest.next('room-joined');
    assert.equal(index, 1);

    const hostLobby = await host.next('lobby-update', (l) => l.players.length === 2);
    const guestLobby = await guest.next('lobby-update', (l) => l.players.length === 2);
    assert.equal(hostLobby.hostId, host.id);
    assert.deepEqual(guestLobby, hostLobby);
  });

  withServer('room codes are case-insensitive and whitespace-tolerant', async ({ connect }) => {
    const host = await connect();
    const guest = await connect();
    host.emit('create-room');
    const { code } = await host.next('room-created');
    guest.emit('join-room', { code: `  ${code.toLowerCase()} ` });
    const joined = await guest.next('room-joined');
    assert.equal(joined.code, code);
  });

  withServer('joining a full room is rejected', async ({ connect }) => {
    const { code } = await setupRoom(connect);
    const third = await connect();
    third.emit('join-room', { code });
    const err = await third.next('join-error');
    assert.match(err.message, /full/i);
  });

  withServer('joining a nonexistent code errors', async ({ connect }) => {
    const c = await connect();
    c.emit('join-room', { code: 'ZZZZ' });
    const err = await c.next('join-error');
    assert.match(err.message, /not found/i);
  });

  withServer('join-room with a missing payload code does not crash the server', async ({ connect }) => {
    const c = await connect();
    c.emit('join-room', {});
    const err = await c.next('join-error');
    assert.match(err.message, /not found/i);
  });

  withServer('set-avatar rejects unknown dolls and fixes colour to the doll', async ({ connect }) => {
    const host = await connect();
    host.emit('create-room');
    await host.next('room-created');
    host.emit('set-avatar', { type: 'dragon', color: 'not-a-color' });
    host.emit('set-avatar', { type: 'cody', color: '#00ff00' });
    await host.next('lobby-update', (l) => l.players[0].avatar.type === 'cody');
    const updates = host.allSeen('lobby-update');
    for (const l of updates.slice(0, -1)) assert.deepEqual(l.players[0].avatar, { type: 'may', color: '#3f7fd8' });
    assert.deepEqual(updates.at(-1).players[0].avatar, { type: 'cody', color: '#4f9e3f' });
  });

  withServer('a joining player gets the free doll, and picking the partner’s doll swaps', async ({ connect }) => {
    const host = await connect();
    host.emit('create-room');
    const { code } = await host.next('room-created');
    host.emit('set-avatar', { type: 'cody' });
    await host.next('lobby-update', (l) => l.players[0].avatar.type === 'cody');
    const guest = await connect();
    guest.emit('join-room', { code });
    const joined = await host.next('lobby-update', (l) => l.players.length === 2);
    assert.deepEqual(joined.players.map((p) => p.avatar.type), ['cody', 'may']);
    guest.emit('set-avatar', { type: 'cody' });
    const swapped = await host.next('lobby-update', (l) => l.players[1]?.avatar.type === 'cody');
    assert.deepEqual(swapped.players.map((p) => p.avatar.type), ['may', 'cody']);
  });

  withServer('set-avatar before joining any room is ignored', async ({ connect }) => {
    const c = await connect();
    c.emit('set-avatar', { type: 'cody' });
    await c.expectNone('lobby-update');
  });
});

// Host starts the selected level; both read the story; the level begins.
async function startLevel(host, guest) {
  host.emit('start-level');
  const story = await host.next('story');
  await guest.next('story');
  host.emit('story-done');
  guest.emit('story-done');
  const start = await host.next('level-start');
  await guest.next('level-start');
  return { story, start };
}

describe('campaign flow over the wire', () => {
  withServer('create-room progress unlocks levels, clamped to the chapter', async ({ connect }) => {
    const a = await connect();
    a.emit('create-room', { progress: 3 });
    const l = await a.next('lobby-update');
    assert.equal(l.unlocked, 3);
    assert.equal(l.levelIndex, 0);
    const b = await connect();
    b.emit('create-room', { progress: 999 });
    assert.equal((await b.next('lobby-update')).unlocked, 5);
    const c = await connect();
    c.emit('create-room', { progress: 'lots' });
    assert.equal((await c.next('lobby-update')).unlocked, 0);
  });

  withServer('only the host can select levels, and only unlocked ones', async ({ connect }) => {
    const { host, guest } = await setupRoom(connect, 2);
    guest.emit('select-level', { index: 1 });
    await host.expectNone('lobby-update', 150);
    host.emit('select-level', { index: 4 });
    await host.expectNone('lobby-update', 150);
    host.emit('select-level', { index: 2 });
    const l = await host.next('lobby-update', (x) => x.levelIndex === 2);
    assert.equal(l.levelIndex, 2);
  });

  withServer('start-level needs two players and the host', async ({ connect }) => {
    const solo = await connect();
    solo.emit('create-room');
    await solo.next('room-created');
    solo.emit('start-level');
    await solo.expectNone('story');

    const { host, guest } = await setupRoom(connect);
    guest.emit('start-level');
    await host.expectNone('story');
    host.emit('start-level');
    const story = await guest.next('story');
    assert.equal(story.levelId, 'awakening');
  });

  withServer('the level waits until both players finish the story', async ({ connect }) => {
    const { host, guest } = await setupRoom(connect);
    host.emit('start-level');
    await host.next('story');
    await guest.next('story');
    host.emit('story-done');
    await host.expectNone('level-start', 200);
    guest.emit('story-done');
    const start = await host.next('level-start');
    assert.equal(start.levelId, 'awakening');
    assert.equal(start.players.length, 2);
  });

  withServer('state broadcasts carry the level simulation to both players', async ({ connect }) => {
    const { host, guest } = await setupRoom(connect, 1);
    host.emit('select-level', { index: 1 });
    await host.next('lobby-update', (l) => l.levelIndex === 1);
    await startLevel(host, guest);
    for (const c of [host, guest]) {
      const s = await c.next('state');
      assert.equal(s.levelId, 'broken-bridge');
      assert.equal(s.players.length, 2);
      assert.ok(s.players.every((p) => p.pos.every(Number.isFinite) && p.alive));
      assert.equal(s.movers.length, 6);
      assert.equal(s.gems.length, 3);
      assert.equal(s.plates.length, 3);
    }
  });

  withServer('movement input moves that player', async ({ connect }) => {
    const { host, guest } = await setupRoom(connect);
    await startLevel(host, guest);
    const first = await host.next('state', (s) => s.t > 0.5);
    const x0 = first.players.find((p) => p.index === 0).pos[0];
    host.emit('input', { x: -1, z: 0 });
    const later = await host.next('state', (s) => s.t > first.t + 0.4);
    assert.ok(later.players.find((p) => p.index === 0).pos[0] < x0 - 0.5);
  });

  withServer('malformed payloads do not crash the server', async ({ connect }) => {
    const { host, guest } = await setupRoom(connect);
    await startLevel(host, guest);
    guest.emit('join-room');
    guest.emit('input');
    guest.emit('input', null);
    guest.emit('input', { x: 'NaN', z: {}, jump: 'yes', brace: 7 });
    guest.emit('set-avatar');
    guest.emit('select-level');
    guest.emit('select-level', { index: -3 });
    const s = await host.next('state', (x) => x.t > 0.5);
    assert.ok(s.players.every((p) => p.pos.every(Number.isFinite)));
    const late = await connect();
    late.emit('create-room');
    await late.next('room-created');
  });

  withServer('avatar changes are ignored while a level is running', async ({ connect }) => {
    const { host, guest } = await setupRoom(connect);
    await startLevel(host, guest);
    guest.emit('set-avatar', { type: 'may' });
    await host.expectNone('lobby-update', 200);
  });

  withServer('finishing a level unlocks the next; then next-level, replay and to-map work', async ({ rooms, connect }) => {
    const { host, guest, code } = await setupRoom(connect);
    await startLevel(host, guest);
    const room = rooms.get(code);
    const goal = room.level.goal.pos;
    for (const p of room.players) p.body.position.set(goal[0] + (p.index ? 1 : -1), goal[1] + 0.6, goal[2]);
    const done = await host.next('level-complete', undefined, 3000);
    assert.equal(done.levelId, 'awakening');
    assert.equal(done.unlocked, 1);
    assert.equal(done.hasNext, true);
    assert.equal(done.stats.totalGems, 3);
    await guest.next('level-complete');

    guest.emit('next-level');
    await host.expectNone('story', 150);

    guest.emit('restart-level');
    const restarted = await host.next('level-start');
    assert.equal(restarted.levelId, 'awakening');

    host.emit('to-map');
    await guest.next('to-map');
    const lobby = await guest.next('lobby-update', (l) => l.phase === 'lobby' && l.unlocked === 1);
    assert.equal(lobby.levelIndex, 0);

    host.emit('select-level', { index: 1 });
    await host.next('lobby-update', (l) => l.levelIndex === 1);
    host.emit('start-level');
    assert.equal((await guest.next('story')).levelId, 'broken-bridge');
  });

  withServer('leave-room keeps the socket connected and frees the slot', async ({ rooms, connect }) => {
    const { host, guest, code } = await setupRoom(connect);
    guest.emit('leave-room');
    await host.next('opponent-left');
    await host.next('lobby-update', (l) => l.players.length === 1);
    assert.equal(guest.socket.connected, true);
    const third = await connect();
    third.emit('join-room', { code });
    assert.equal((await third.next('room-joined')).index, 1);
    assert.equal(rooms.get(code).players.length, 2);
  });

  withServer('disconnect mid-level notifies the other player and returns the room to the lobby', async ({ rooms, connect }) => {
    const { host, guest, code } = await setupRoom(connect);
    await startLevel(host, guest);
    guest.close();
    await host.next('opponent-left');
    const lobby = await host.next('lobby-update', (l) => l.players.length === 1);
    assert.equal(lobby.hostId, host.id);
    assert.equal(rooms.get(code).phase, 'lobby');
    assert.equal(rooms.get(code).interval, null);
  });

  withServer('host leaving promotes the guest to host', async ({ connect }) => {
    const { host, guest } = await setupRoom(connect);
    const guestId = guest.id;
    host.close();
    await guest.next('opponent-left');
    const lobby = await guest.next('lobby-update', (l) => l.players.length === 1);
    assert.equal(lobby.hostId, guestId);
  });

  withServer('room is deleted once everyone leaves', async ({ rooms, connect }) => {
    const { host, guest, code } = await setupRoom(connect);
    guest.close();
    await host.next('opponent-left');
    host.close();
    const deadline = Date.now() + 1000;
    while (rooms.has(code) && Date.now() < deadline) await new Promise((r) => setTimeout(r, 10));
    assert.equal(rooms.has(code), false);
  });

  withServer('two rooms run independently', async ({ connect }) => {
    const a = await setupRoom(connect);
    const b = await setupRoom(connect);
    assert.notEqual(a.code, b.code);
    a.host.emit('start-level');
    await a.guest.next('story');
    await b.host.expectNone('story');
  });
});
