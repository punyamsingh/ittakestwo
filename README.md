# It Takes Two - Online

### [▶ Play now — ittakestwo-online.vercel.app](https://ittakestwo-online.vercel.app)

Grab a friend. You'll need each other.

Cody and May are one bad week away from divorce. Then their daughter Rose makes a wish on Dr. Hakim's Book of Love, and they wake up as dolls — May carved from wood, Cody shaped from clay — tied together by Rose's red thread. To get back to her, they'll have to cross the family shed at doll scale. Together, whether they like it or not.

It's a fan-made, two-player online co-op platformer that runs in your browser. No download, no account. One of you makes a room, the other types in the 4-letter code, and you're in.

## Chapter 1 — The Shed

| # | Level | What's waiting for you |
|---|---|---|
| 1 | Wake-Up Call | Springs, soggy cardboard, and learning to move as one |
| 2 | The Workbench | Moving trays, twin button gates, and a climb up the thread |
| 3 | Through the Draft | A cracked window trying to blow you both away |
| 4 | Loose Screws | Falling bolts and spinning saw arms |
| 5 | The Fuse Box | Everything at once |
| 6 | The Toolbox | A boss that only goes down if you hit both power buttons at the same time |

Every level has a story scene before and after, checkpoints so a slip doesn't cost you everything, and three hidden hearts for the ones who go looking.

## How to play

One of you is May, the other is Cody. The thread between you only stretches so far, and almost nothing in the shed can be done alone.

- **Move:** WASD / arrow keys / gamepad stick
- **Jump:** Space / gamepad A
- **Brace:** hold Shift or E / gamepad B or RB — dig in so nothing can drag you or blow you away
- **Climb:** dangling below a braced partner? Press Jump to climb the thread
- **Pause:** Esc
- **Menus:** arrow keys / W S to move, Enter to select, Esc to go back

Gamepads work. Voice chat helps. Blaming your partner does not.

## Contributing

This is a passion project. If you've played it, loved it, and have an idea that would make the shed a better place — a level, a mechanic, a fix, art, sound — you're welcome here. Open an issue first and tell us what you want to build and why; drive-by PRs without that conversation probably won't be merged.

<details>
<summary>Running it locally</summary>

Requires Node 22+.

```bash
npm run setup   # installs root, server and client dependencies
npm run dev     # server on :3001, client on :5173
npm test        # level data, co-op mechanics, the boss, and the socket protocol
```

Open `http://localhost:5173` in two browser windows to play against yourself.

Production build — one Node process serves the game and the socket server:

```bash
npm run build
npm start       # http://localhost:3001 (PORT to override)
```

</details>

<details>
<summary>How it's built</summary>

three.js for rendering, cannon-es for physics, Socket.IO for netcode, Vite for the client.

```
shared/
  constants.js          gameplay tuning (movement, thread, brace, hazards, boss), the two dolls
  levels.js             all level data — platforms, movers, plates, wind, spinners, falling bolts, hearts, checkpoints
  story.js              dialogue for every level
server/
  level.js              authoritative level simulation (cannon-es)
  boss.js               the Toolbox's attack cycle and power-button mechanic
  room.js               lobby, level select, story sync, level lifecycle, unlocks
  app.js                express + socket.io wiring and input validation
  test/                 node:test suites
client/
  src/main.js           session flow, socket events, frame loop
  src/ui.js             title screen, keyboard-driven menus, lobby + chapter map, cutscenes, co-op HUD, results, pause
  src/net.js            snapshot interpolation and time-synced event playback
  src/audio.js          procedural WebAudio sound effects
  src/render/           renderer, environment, levels, Cody & May, the thread, boss, effects, camera
deploy/                 VM install and update scripts
```

**Adding a level.** Levels are plain data in `shared/levels.js`; the server builds physics and the client builds visuals from the same definition. Positions are the top-centre of each surface, and levels run toward −z. `npm test` checks that spawns, checkpoints, plates and goals sit on solid ground and that the main route never needs a jump longer than ~3 units (tag a platform with `via` when a pad, lift, mover or climb gets you there instead).

**Netcode.** The server simulates at 30Hz and broadcasts snapshots stamped with server time. The client renders ~100ms in the past and interpolates, so motion stays smooth at any frame rate; one-off events (jumps, hits, heart pickups) play when the interpolated view reaches them.

**Deploying.** Rooms live in memory, so run a single instance. `render.yaml` is a Render blueprint, `deploy/setup.sh` sets up an Ubuntu VM with Caddy and HTTPS, and `vercel.json` hosts just the client — point it at a game server with `VITE_SERVER_URL`.

</details>

---

*An unofficial fan project. Not affiliated with Hazelight Studios or Electronic Arts.*
