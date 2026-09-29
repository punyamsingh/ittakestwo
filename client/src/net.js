import { io } from 'socket.io-client';

// VITE_SERVER_URL points a separately hosted client (e.g. on Vercel) at the game
// server; unset, the client talks to its own origin (dev proxy / single-server mode).
const SERVER_URL = import.meta.env.VITE_SERVER_URL || undefined;

export function connect() {
  return io(SERVER_URL, { transports: ['websocket', 'polling'] });
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerp3(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

// Server state arrives at 30Hz. Rendering ~100ms in the past and interpolating
// between the two surrounding snapshots gives smooth motion at any frame rate.
export class SnapshotBuffer {
  constructor(delayMs = 100) {
    this.delay = delayMs;
    this.snaps = [];
    this.offset = null;
  }

  reset() {
    this.snaps = [];
  }

  push(state) {
    const estimate = state.now - performance.now();
    if (this.offset === null || estimate > this.offset) this.offset = estimate;
    else this.offset += (estimate - this.offset) * 0.02;
    this.snaps.push(state);
    if (this.snaps.length > 90) this.snaps.shift();
  }

  renderTime() {
    return performance.now() + (this.offset ?? 0) - this.delay;
  }

  latest() {
    return this.snaps.at(-1) ?? null;
  }

  sample() {
    const s = this.snaps;
    if (!s.length) return null;
    const rt = this.renderTime();
    if (rt <= s[0].now) return s[0];
    for (let i = s.length - 1; i >= 0; i--) {
      if (s[i].now <= rt) {
        const a = s[i];
        const b = s[i + 1];
        if (!b) return a;
        return blend(a, b, (rt - a.now) / (b.now - a.now));
      }
    }
    return s[0];
  }
}

function blend(a, b, t) {
  if (a.levelId !== b.levelId) return b;
  return {
    ...b,
    now: lerp(a.now, b.now, t),
    t: lerp(a.t, b.t, t),
    players: b.players.map((pb) => {
      const pa = a.players.find((p) => p.index === pb.index) ?? pb;
      // Don't smear a respawn teleport across the level.
      const jump = Math.abs(pa.pos[0] - pb.pos[0]) + Math.abs(pa.pos[2] - pb.pos[2]) > 4;
      return { ...pb, pos: jump ? pb.pos : lerp3(pa.pos, pb.pos, t) };
    }),
    movers: b.movers.map((mb, i) => (a.movers[i] ? lerp3(a.movers[i], mb, t) : mb)),
    spinners: b.spinners.map((sb, i) => lerp(a.spinners[i] ?? sb, sb, t)),
    meteors: b.meteors.map((mb) => {
      const ma = a.meteors.find((m) => m.id === mb.id);
      return ma ? { ...mb, pos: lerp3(ma.pos, mb.pos, t), k: lerp(ma.k, mb.k, t) } : mb;
    }),
    boss:
      a.boss && b.boss
        ? {
            ...b.boss,
            angle: lerp(a.boss.angle, b.boss.angle, t),
            windup: lerp(a.boss.windup, b.boss.windup, t),
            rings: b.boss.rings.map((r, i) => (a.boss.rings[i] !== undefined ? lerp(a.boss.rings[i], r, t) : r)),
          }
        : b.boss,
  };
}

// Server events carry a server timestamp; hold them until the interpolated view
// reaches that moment so effects line up with what's on screen.
export class TimedEvents {
  constructor(buffer) {
    this.buffer = buffer;
    this.queue = [];
  }

  push(type, payload) {
    this.queue.push({ type, payload });
  }

  clear() {
    this.queue = [];
  }

  drain(handle) {
    const rt = this.buffer.renderTime();
    let i = 0;
    while (i < this.queue.length) {
      const e = this.queue[i];
      if (e.payload.now <= rt || this.buffer.offset === null) {
        this.queue.splice(i, 1);
        handle(e.type, e.payload);
      } else {
        i++;
      }
    }
  }
}
