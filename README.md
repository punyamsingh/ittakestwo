# It Takes Two - Online

A two-player online co-op adventure inspired by *It Takes Two*. Cody and May, on the brink of divorce, wake up as dolls — May carved from wood, Cody shaped from clay — after their daughter Rose wishes on Dr. Hakim's Book of Love. Tied together by Rose's red thread, they have to cross the family shed, at doll scale, to get back to her: a story campaign of hand-built platforming levels and a boss fight.

**Chapter 1 — The Shed**

| # | Level | What it asks of you |
|---|---|---|
| 1 | Wake-Up Call | Moving together, bracing, springs, soggy cardboard |
| 2 | The Workbench | Moving trays, twin button gates, lift + thread climb |
| 3 | Through the Draft | Brace against the draft from a cracked window; climb up the thread |
| 4 | Loose Screws | Falling bolts and spinning saw arms |
| 5 | The Fuse Box | Everything at once |
| 6 | The Toolbox | Boss: stand on both power buttons together to zap it |

Each level has three hidden hearts, checkpoints, and a story scene before and after. One player is May and the other is Cody — pick your partner's doll in the lobby and you swap.

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
- **Jump:** Space / gamepad A — while dangling below a braced partner, Jump climbs the thread
- **Brace:** hold Shift or E / gamepad B or RB — you can't be dragged or blown away, so your partner can hang off the thread
- **Pause:** Esc
- **Menus:** arrow keys / W S to move, Enter to select, Esc to go back

## Project layout

```
shared/
  constants.js          gameplay tuning (movement, thread, brace, hazards, boss), the two dolls
  levels.js             all level data — platforms, movers, plates, wind, spinners, meteors, gems, checkpoints
  story.js              dialogue for every level
server/
  level.js              authoritative level simulation (cannon-es)
  boss.js               the Toolbox's attack cycle and power-button mechanic
  room.js               lobby, level select, story sync, level lifecycle, unlocks
  app.js                express + socket.io wiring and input validation
  test/                 node:test suites
client/
  src/main.js           session flow, socket events, frame loop
  src/ui.js             title screen, keyboard-driven menus, lobby + chapter map,
                        cutscenes, co-op HUD, results, pause
  src/net.js            snapshot interpolation and time-synced event playback
  src/audio.js          procedural WebAudio sound effects
  src/render/           renderer + post, sky/environment, level & platform builders,
                        Cody & May, the red thread, the shed, spinners, boss, falling bolts, effects, camera
```

### Adding a level

Levels are plain data in `shared/levels.js`; the server builds physics and the client builds visuals from the same definition. Positions are top-centre of each surface; levels run toward −z. `npm test` checks that spawns, checkpoints, plates and goals sit on solid ground and that the main route never needs a jump longer than ~3 units (tag a platform with `via` when a mechanic — pad, lift, mover, climb — gets you there instead).

### Netcode

The server simulates at 30Hz and broadcasts snapshots stamped with server time. The client renders ~100ms in the past and interpolates, so motion is smooth at any frame rate; one-off events (jumps, hits, impacts, heart pickups) play when the interpolated view reaches them.
