# It Takes Two - Online

A two-player online co-op adventure. Two guardians, bound together by a cursed chain, climb the shattered World Spire to break it — through a story campaign of hand-built platforming levels and a boss fight.

**Chapter 1 — The Shattered Isles**

| # | Level | What it asks of you |
|---|---|---|
| 1 | Awakening | Moving together, bracing, jump pads, crumbling stone |
| 2 | The Broken Bridge | Moving ferries, twin pressure-plate gates, lift + chain climb |
| 3 | Windward Cliffs | Brace against gusts; climb cliffs up the chain |
| 4 | Stormfall Ascent | Meteor fields and spinning sweeper arms |
| 5 | The Spire Gate | Everything at once |
| 6 | The Iron Warden | Boss: stand on both runes together to call down lightning |

Each level has three hidden Heartstone shards, checkpoints, and a story scene before and after.

## Run it

```bash
npm run setup   # installs root, server and client dependencies
npm run dev     # server on :3001, client on :5173
```

Open `http://localhost:5173` in two browser windows (or share your LAN address with a friend). One player creates a room; the other joins with the 4-letter code. The host picks the level from the chapter map.

Production build — one Node process serves the game and the socket server:

```bash
npm run build
npm start       # http://localhost:3001 (PORT to override)
```

Tests: `npm test` — level data validation, co-op mechanics in real level layouts, the boss, and the socket protocol.

## Controls

- **Move:** WASD / arrows / gamepad stick
- **Jump:** Space / gamepad A — while dangling below a braced partner, Jump climbs the chain
- **Brace:** hold Shift or E / gamepad B or RB — you can't be dragged or blown away, so your partner can hang off the chain
- **Pause:** Esc

## Project layout

```
shared/
  constants.js          gameplay tuning (movement, chain, brace, hazards, boss)
  levels.js             all level data — platforms, movers, plates, wind, spinners, meteors, gems, checkpoints
  story.js              dialogue for every level
server/
  level.js              authoritative level simulation (cannon-es)
  boss.js               the Iron Warden's attack cycle and rune mechanic
  room.js               lobby, level select, story sync, level lifecycle, unlocks
  app.js                express + socket.io wiring and input validation
  test/                 node:test suites
client/
  src/main.js           session flow, socket events, frame loop
  src/ui.js             menu, lobby + chapter map, story dialogue, HUD, results, pause
  src/net.js            snapshot interpolation and time-synced event playback
  src/audio.js          procedural WebAudio sound effects
  src/render/           renderer + post, sky/environment, level & platform builders,
                        creatures, chain, spinners, boss, meteors, effects, camera
```

### Adding a level

Levels are plain data in `shared/levels.js`; the server builds physics and the client builds visuals from the same definition. Positions are top-centre of each surface; levels run toward −z. `npm test` checks that spawns, checkpoints, plates and goals sit on solid ground and that the main route never needs a jump longer than ~3 units (tag a platform with `via` when a mechanic — pad, lift, mover, climb — gets you there instead).

### Netcode

The server simulates at 30Hz and broadcasts snapshots stamped with server time. The client renders ~100ms in the past and interpolates, so motion is smooth at any frame rate; one-off events (jumps, hits, impacts, shard pickups) play when the interpolated view reaches them.
