import * as THREE from 'three';
import { PLAYER_RADIUS, SPAWN_SPREAD, METEOR, CHARACTERS, avatarFor } from '@shared/constants.js';
import { LEVELS, levelById, levelIndex } from '@shared/levels.js';
import { STORY, SPEAKERS } from '@shared/story.js';
import { connect, SnapshotBuffer, TimedEvents } from './net.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createUI } from './ui.js';
import { createRenderer, createComposer } from './render/renderer.js';
import { buildEnvironment } from './render/environment.js';
import { CREATURES, buildCreature, animateCreature, disposeCreature, attachShadow, setTag, flashHit, landed, hop } from './render/creatures.js';
import { createChain } from './render/chain.js';
import { createEffects } from './render/effects.js';
import { createMeteors } from './render/meteors.js';
import { createCameraRig } from './render/camera.js';
import { createPortraits } from './render/portraits.js';
import { createLevelView } from './render/level.js';
import { createBossView } from './render/boss.js';

// ---------- rendering ----------

// The in-world name tags draw with the display font, so fetch it up front.
document.fonts?.load('800 52px "Baloo 2"');

const renderer = createRenderer(document.getElementById('stage'));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 1200);
const post = createComposer(renderer, scene, camera);
const world = buildEnvironment(scene);
const chain = createChain(scene);
const effects = createEffects(scene, camera, renderer);
const meteors = createMeteors(scene, effects);
const cam = createCameraRig(camera);

window.addEventListener('resize', () => {
  post.resize();
  effects.resize();
});

// ---------- systems ----------

const audio = createAudio();
const portraits = createPortraits();
const socket = connect();
const snapshots = new SnapshotBuffer(100);
const events = new TimedEvents(snapshots);

function stored(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
function store(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable; progress just won't persist
  }
}

const progress = stored('itt:progress', { unlocked: 0, gems: {} });
progress.gems ??= {};

const session = {
  phase: 'menu', // menu | lobby | story | level | complete | chapter | notice
  code: null,
  hostId: null,
  players: [],
  levelIndex: 0,
  unlocked: 0,
  everConnected: false,
};

const me = () => session.players.find((p) => p.id === socket.id) ?? null;
const mate = () => session.players.find((p) => p.id !== socket.id) ?? null;
const myIndex = () => me()?.index ?? -1;
const isHost = () => session.hostId === socket.id;

// ---------- creatures ----------

const creatures = [null, null];
const motion = [0, 1].map(() => ({ prev: new THREE.Vector3(), vel: new THREE.Vector3(), has: false, alive: true, grounded: true, braced: false }));
const braceRings = [0, 1].map(() => {
  const m = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 0.78, 40),
    new THREE.MeshBasicMaterial({ color: '#ff7aa2', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 4;
  scene.add(m);
  return m;
});

function syncCreature(player) {
  const cur = creatures[player.index];
  if (cur && cur.type === player.avatar.type && cur.color === player.avatar.color) return { entry: cur, changed: false };
  if (cur) disposeCreature(cur);
  const entry = buildCreature(player.avatar);
  attachShadow(entry, scene);
  scene.add(entry.root);
  creatures[player.index] = entry;
  setTag(entry, player.id === socket.id ? 'YOU' : null, player.avatar.color);
  return { entry, changed: true };
}

function removeCreature(index) {
  if (!creatures[index]) return;
  disposeCreature(creatures[index]);
  creatures[index] = null;
}

function clearCreatures() {
  removeCreature(0);
  removeCreature(1);
  chain.hide();
}

function placeCreature(entry, index, [x, y, z], spread = SPAWN_SPREAD) {
  entry.root.position.set(x + (index === 0 ? -spread : spread), y, z);
  entry.rig.rotation.set(0, 0, 0);
  entry.anim.hit = 0;
  motion[index].has = false;
  motion[index].vel.set(0, 0, 0);
}

// ---------- level scene ----------

let levelDef = null;
let levelView = null;
let bossView = null;

function loadLevel(def) {
  if (levelDef?.id === def.id && levelView) return;
  unloadLevel();
  levelDef = def;
  levelView = createLevelView(scene, def);
  bossView = def.boss ? createBossView(scene) : null;
  world.setPlaza(!!def.boss, { hub: false });
}

function unloadLevel() {
  levelView?.dispose();
  bossView?.dispose();
  levelView = null;
  bossView = null;
  levelDef = null;
  meteors.clear();
  effects.clear();
  chain.hide();
}

function showPlaza() {
  unloadLevel();
  world.setPlaza(true, { hub: true });
}

// ---------- story ----------

function speakerInfo(who) {
  if (CREATURES[who]) {
    const p = session.players.find((pl) => pl.avatar.type === who);
    if (!p) return { name: CREATURES[who].label, color: CHARACTERS[who].color, image: portraits.get(avatarFor(who)) };
    const label = CREATURES[p.avatar.type].label;
    return { name: p.id === socket.id ? `${label} (you)` : label, color: p.avatar.color, image: portraits.get(p.avatar) };
  }
  return SPEAKERS[who] ?? SPEAKERS.narrator;
}

function runStory(def, part) {
  const index = levelIndex(def.id);
  return ui.playStory({
    kicker: part === 'before' ? (def.boss ? 'Chapter one · Final battle' : `Chapter one · Level ${index + 1}`) : null,
    title: part === 'before' ? def.name : null,
    tagline: def.tagline,
    lines: STORY[def.id]?.[part] ?? [],
    speaker: speakerInfo,
  });
}

function stageAtSpawn(def) {
  for (const p of session.players) {
    const { entry } = syncCreature(p);
    placeCreature(entry, p.index, def.spawn);
  }
}

// ---------- UI ----------

const ui = createUI({
  portraits,
  audio,
  on: {
    create: () => socket.emit('create-room', { progress: progress.unlocked }),
    join: (code) => socket.emit('join-room', { code }),
    leave: leaveRoom,
    start: () => socket.emit('start-level'),
    selectLevel: (index) => socket.emit('select-level', { index }),
    next: () => socket.emit('next-level'),
    replay: () => socket.emit('restart-level'),
    toMap: () => socket.emit('to-map'),
    backToLobby: enterLobby,
    togglePause: () => setPaused(!paused),
    pickCreature: (type) => pickAvatar({ type }),
  },
});

function pickAvatar(change) {
  const self = me();
  if (!self) return;
  self.avatar = { ...self.avatar, ...change };
  store('itt:avatar', self.avatar);
  socket.emit('set-avatar', self.avatar);
  refreshLobby();
}

// ---------- pause ----------

let paused = false;
function setPaused(on) {
  paused = on && session.phase === 'level';
  ui.setPause(paused, { isHost: isHost() });
  input.setEnabled(session.phase === 'level' && !paused);
  if (paused) socket.emit('input', { x: 0, z: 0, jump: false, brace: false });
}
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && session.phase === 'level' && ui.current === 'hud') setPaused(!paused);
});
// Leaving the level for any reason closes the pause menu.
function syncPauseUi() {
  ui.setPauseAvailable(session.phase === 'level');
  if (paused && session.phase !== 'level') setPaused(false);
}

// ---------- flow ----------

const LOBBY_SPOTS = [
  [-1.35, 2.2],
  [1.35, 2.2],
];

function enterLobby() {
  session.phase = 'lobby';
  input.setEnabled(false);
  showPlaza();
  cam.setMode('lobby');
  refreshLobby();
  for (const p of session.players) {
    const entry = creatures[p.index];
    if (entry) placeCreature(entry, p.index, [LOBBY_SPOTS[p.index][0], 0, LOBBY_SPOTS[p.index][1]], 0);
  }
  ui.show('lobby');
}

function refreshLobby() {
  ui.renderLobby({ code: session.code, me: me(), mate: mate(), isHost: isHost(), levelIndex: session.levelIndex, unlocked: session.unlocked, progress });
  if (session.phase !== 'lobby') return;
  const present = new Set(session.players.map((p) => p.index));
  for (const i of [0, 1]) if (!present.has(i)) removeCreature(i);
  for (const p of session.players) {
    const { entry, changed } = syncCreature(p);
    if (changed) {
      placeCreature(entry, p.index, [LOBBY_SPOTS[p.index][0], 0, LOBBY_SPOTS[p.index][1]], 0);
      hop(entry);
      effects.sparkle([entry.root.position.x, 0.6, entry.root.position.z], p.avatar.color, 16);
    }
  }
}

function resetToMenu() {
  session.phase = 'menu';
  session.code = null;
  session.players = [];
  session.hostId = null;
  input.setEnabled(false);
  clearCreatures();
  showPlaza();
  cam.setMode('orbit');
  ui.clearJoin();
  ui.show('menu');
}

function leaveRoom() {
  socket.emit('leave-room');
  resetToMenu();
}

function beginLevel(def, players) {
  session.phase = 'level';
  session.players = players;
  session.levelIndex = levelIndex(def.id);
  loadLevel(def);
  snapshots.reset();
  events.clear();
  effects.clear();
  meteors.clear();
  stageAtSpawn(def);
  ui.fade(false);
  ui.startLevel({
    def,
    index: session.levelIndex,
    players: players.map((p) => ({ index: p.index, type: p.avatar.type, color: p.avatar.color, me: p.id === socket.id, image: portraits.get(p.avatar) })),
  });
  setPaused(false);
  cam.setMode(def.camera === 'arena' ? 'arena' : 'level');
  cam.snap();
}

function saveProgress(def, stats, unlocked) {
  progress.unlocked = Math.max(progress.unlocked ?? 0, unlocked);
  progress.gems[def.id] = Math.max(progress.gems[def.id] ?? 0, stats.gems);
  store('itt:progress', progress);
}

async function completeLevel({ levelId, stats, unlocked, hasNext }) {
  const def = levelById(levelId);
  session.phase = 'complete';
  session.unlocked = unlocked;
  input.setEnabled(false);
  saveProgress(def, stats, unlocked);
  audio.victory();
  await new Promise((r) => setTimeout(r, 900));
  if (session.phase !== 'complete') return;
  await runStory(def, 'after');
  if (session.phase !== 'complete') return;
  if (hasNext) {
    ui.showComplete({ def, index: levelIndex(levelId), stats, isHost: isHost(), hasNext });
  } else {
    session.phase = 'chapter';
    const total = LEVELS.reduce((n, l) => n + (l.gems?.length ?? 0), 0);
    const got = LEVELS.reduce((n, l) => n + (progress.gems[l.id] ?? 0), 0);
    ui.showChapter({ gems: got, total, isHost: isHost() });
  }
}

// ---------- networking ----------

socket.on('connect', () => {
  const wasInRoom = session.phase !== 'menu';
  session.everConnected = true;
  ui.setConnected(true, true);
  if (wasInRoom) {
    resetToMenu();
    ui.toast('Reconnected — your old room was closed.');
  }
});

socket.on('disconnect', () => {
  ui.setConnected(false, session.everConnected);
  if (session.phase !== 'menu') {
    input.setEnabled(false);
    session.phase = 'notice';
    ui.showNotice({ title: 'Connection lost', text: 'We lost the server. Hang tight — you can start a new room once it reconnects.', canReturn: false });
  }
});

socket.on('connect_error', () => ui.setConnected(false, session.everConnected));

function joinedRoom(code, { host = false } = {}) {
  session.code = code;
  session.players = [];
  // The host gets their usual doll; a joining player takes whichever is free.
  const pref = host ? stored('itt:avatar', null) : null;
  if (pref) socket.emit('set-avatar', { type: pref.type });
  enterLobby();
}

socket.on('room-created', ({ code }) => joinedRoom(code, { host: true }));
socket.on('room-joined', ({ code }) => {
  audio.join();
  joinedRoom(code);
});
socket.on('join-error', ({ message }) => ui.joinError(message));

socket.on('lobby-update', ({ players, hostId, levelIndex: li, unlocked }) => {
  const hadMate = !!mate();
  session.players = players;
  session.hostId = hostId;
  session.levelIndex = li;
  session.unlocked = unlocked;
  if (session.phase === 'lobby') {
    if (!hadMate && mate()) {
      audio.join();
      ui.toast('Your partner joined!');
    }
    refreshLobby();
  }
});

socket.on('story', async ({ levelId }) => {
  const def = levelById(levelId);
  session.phase = 'story';
  session.levelIndex = levelIndex(levelId);
  input.setEnabled(false);
  loadLevel(def);
  stageAtSpawn(def);
  cam.setMode(def.camera === 'arena' ? 'arena' : 'level');
  cam.snap();
  await runStory(def, 'before');
  if (session.phase !== 'story') return;
  socket.emit('story-done');
  ui.storyWaiting(true);
});

socket.on('level-start', ({ levelId, players }) => beginLevel(levelById(levelId), players));
socket.on('state', (state) => snapshots.push(state));
socket.on('level-complete', completeLevel);
socket.on('to-map', enterLobby);
for (const type of ['jump', 'land', 'hit', 'impact', 'fell', 'respawn', 'gem', 'checkpoint', 'hint', 'pad', 'plate', 'crumble', 'climb', 'slam', 'strike', 'boss-attack', 'runes', 'boss-defeated']) {
  socket.on(type, (payload) => events.push(type, payload));
}

socket.on('opponent-left', () => {
  if (session.phase === 'lobby') {
    ui.toast('Your partner left the room.');
    return;
  }
  if (session.phase === 'menu') return;
  input.setEnabled(false);
  session.phase = 'notice';
  ui.showNotice({
    title: 'Your partner left',
    text: 'The red thread went slack. Keep the room open for someone new, or head back to the menu.',
    canReturn: true,
  });
});

// ---------- input ----------

const input = createInput({
  onJump: () => {
    const i = myIndex();
    if (session.phase === 'level' && i >= 0 && motion[i].grounded && motion[i].alive && !motion[i].braced) audio.jump();
  },
});

let lastSent = { x: 0, z: 0, brace: false };
let lastSentAt = 0;
setInterval(() => {
  if (session.phase !== 'level' || paused) return;
  const cmd = input.read();
  const now = performance.now();
  const changed = cmd.x !== lastSent.x || cmd.z !== lastSent.z || cmd.brace !== lastSent.brace;
  if (changed || cmd.jump || now - lastSentAt > 250) {
    socket.emit('input', cmd);
    lastSent = cmd;
    lastSentAt = now;
  }
}, 1000 / 30);

// ---------- level events (in sync with the interpolated view) ----------

let respawning = false;

function feetOf(index) {
  const e = creatures[index];
  return e ? [e.root.position.x, e.root.position.y, e.root.position.z] : [0, 0, 0];
}

function handleEvent(type, e) {
  const entry = creatures[e.index];
  const mine = e.index === myIndex();
  switch (type) {
    case 'jump':
      if (entry) effects.landPuff(feetOf(e.index), 0.35);
      if (!mine) audio.jump();
      break;
    case 'land':
      if (entry) {
        landed(entry, e.speed);
        effects.landPuff(feetOf(e.index), Math.min(1.6, e.speed / 8));
      }
      audio.land(e.speed);
      break;
    case 'hit':
      if (entry) flashHit(entry);
      effects.hitBurst(e.pos, e.kind === 'sweeper' ? '#ff3b6b' : '#ff8a3c');
      audio.hit();
      cam.addTrauma(mine ? 0.55 : 0.3);
      if (mine) post.grade.uHit.value = 1;
      break;
    case 'impact': {
      effects.impact(e.pos, e.pos[1]);
      const self = creatures[myIndex()];
      const d = self ? Math.hypot(self.root.position.x - e.pos[0], self.root.position.z - e.pos[2]) : 8;
      audio.impact(d);
      cam.addTrauma(THREE.MathUtils.clamp(0.6 - d * 0.05, 0.1, 0.6));
      break;
    }
    case 'fell':
      audio.fell();
      if (!respawning) {
        respawning = true;
        setTimeout(() => ui.fade(true), 550);
      }
      break;
    case 'respawn':
      respawning = false;
      motion.forEach((m) => (m.has = false));
      cam.snap();
      setTimeout(() => ui.fade(false), 80);
      audio.respawn();
      if (levelDef) ui.showHint(e.checkpoint >= 0 ? 'Back to the checkpoint — the thread holds.' : 'Back to the start — try again!', 2500);
      break;
    case 'gem':
      effects.sparkle(e.pos, '#ff6f91', 26);
      effects.hitBurst(e.pos, '#e8334f');
      audio.gem();
      break;
    case 'checkpoint':
      audio.checkpoint();
      ui.banner('Checkpoint');
      effects.sparkle([e.pos[0] + 2.4, e.pos[1] + 2.6, e.pos[2]], '#f6c94a', 30);
      break;
    case 'hint': {
      const hint = levelDef?.hints?.[e.index];
      if (hint) ui.showHint(hint.text);
      break;
    }
    case 'pad':
      audio.pad();
      effects.sparkle([e.pos[0], e.pos[1] + 0.4, e.pos[2]], '#ffd36b', 18);
      levelView?.padKick((levelDef.pads ?? []).findIndex((p) => p.pos[0] === e.pos[0] && p.pos[2] === e.pos[2]));
      break;
    case 'plate':
      audio.plate(e.active);
      if (e.active) audio.rumble();
      break;
    case 'crumble':
      if (e.state === 2) {
        const c = levelDef?.platforms.filter((p) => p.crumble)[e.index];
        if (c) effects.landPuff(c.pos, 1.4);
        audio.crumble();
      } else {
        audio.plate(false);
      }
      break;
    case 'climb':
      audio.climb();
      if (entry) effects.sparkle([entry.root.position.x, entry.root.position.y + 0.6, entry.root.position.z], '#d8314a', 8);
      break;
    case 'slam':
      audio.slam();
      cam.addTrauma(0.45);
      effects.landPuff([0, 0, 0], 2);
      break;
    case 'boss-attack':
      audio.roar();
      break;
    case 'runes':
      audio.select();
      break;
    case 'strike':
      bossView?.strike();
      audio.strike();
      cam.addTrauma(0.85);
      effects.hitBurst([0, 6, 0], '#fff3b0');
      ui.banner(e.hp > 0 ? 'Direct hit!' : 'The Toolbox is down!');
      break;
    case 'boss-defeated':
      audio.roar();
      cam.addTrauma(0.6);
      break;
  }
}

meteors.onSpawn((m) => audio.meteorFall(METEOR.fallTime * (1 - m.k)));

// ---------- frame loop ----------

const clock = new THREE.Clock();
const focus = new THREE.Vector3();
const feet = new THREE.Vector3();
const inst = new THREE.Vector3();
const anchorA = new THREE.Vector3();
const anchorB = new THREE.Vector3();
const lobbyPanel = document.querySelector('.panel--lobby');
const mapPanel = document.querySelector('.panel--map');
const menuCol = document.querySelector('.menu-col');
let lastWind = [];
let wasBraced = false;

function updateLobby(dt, t) {
  for (const p of session.players) {
    const entry = creatures[p.index];
    if (entry) animateCreature(entry, dt, t, { vel: null, grounded: true, alive: true, faceCamera: true, floorY: 0 });
  }
  if (creatures[0] && creatures[1]) {
    anchorA.copy(creatures[0].root.position).setY(0.55);
    anchorB.copy(creatures[1].root.position).setY(0.55);
    chain.update(anchorA, anchorB, t, () => 0);
  } else {
    chain.hide();
  }
  // Frame the creatures in the gap between the two panels on wide layouts.
  const left = lobbyPanel.getBoundingClientRect();
  const right = mapPanel.getBoundingClientRect();
  const wide = window.innerWidth >= 900;
  return { insetLeft: wide ? left.right - (window.innerWidth - right.left) : 0 };
}

function updateLevel(dt, t) {
  const live = session.phase === 'level' || session.phase === 'complete' || session.phase === 'chapter' || session.phase === 'notice';
  const view = live ? snapshots.sample() : null;
  events.drain(handleEvent);
  levelView.update(view, dt, t);

  if (!view) {
    // Story staging: the dolls idle at the spawn, facing the camera.
    for (const p of session.players) {
      const entry = creatures[p.index];
      if (!entry) continue;
      const pos = entry.root.position;
      animateCreature(entry, dt, t, { vel: null, grounded: true, alive: true, faceCamera: true, floorY: levelView.groundAt(pos.x, pos.y + 0.3, pos.z) });
    }
    if (creatures[0] && creatures[1]) {
      anchorA.copy(creatures[0].root.position).add({ x: 0, y: 0.55, z: 0 });
      anchorB.copy(creatures[1].root.position).add({ x: 0, y: 0.55, z: 0 });
      chain.update(anchorA, anchorB, t, levelView.groundAt);
    }
    focus.set(...levelDef.spawn);
    return { focus, spread: 2.4 };
  }

  let alive = 0;
  focus.set(0, 0, 0);
  let danger = 0;
  for (const p of view.players) {
    const entry = creatures[p.index];
    if (!entry) continue;
    const m = motion[p.index];
    feet.set(p.pos[0], p.pos[1] - PLAYER_RADIUS, p.pos[2]);
    if (m.has && dt > 0) {
      inst.subVectors(feet, m.prev).divideScalar(dt);
      m.vel.lerp(inst, 1 - Math.exp(-dt * 18));
    }
    m.prev.copy(feet);
    m.has = true;
    m.alive = p.alive;
    m.braced = p.braced;
    const floorY = levelView.groundAt(feet.x, feet.y + 0.3, feet.z);
    m.grounded = floorY !== null && feet.y - floorY < 0.1 && Math.abs(m.vel.y) < 1.5;
    entry.root.position.copy(feet);
    animateCreature(entry, dt, t, { vel: m.vel, grounded: m.grounded, alive: p.alive, faceCamera: false, floorY });

    ui.setPlayerState(p.index, { braced: p.braced, alive: p.alive });
    const ring = braceRings[p.index];
    ring.visible = p.braced && p.alive;
    if (ring.visible) {
      ring.position.set(feet.x, feet.y + 0.04, feet.z);
      ring.material.opacity = 0.7 + Math.sin(t * 10) * 0.2;
      ring.scale.setScalar(1 + Math.sin(t * 6) * 0.06);
    }
    if (p.index === myIndex()) {
      if (p.braced && !wasBraced) audio.brace();
      wasBraced = p.braced;
      ui.setBrace(p.braced);
      if (p.alive && floorY === null) danger = 0.7;
    }
    if (p.alive) {
      focus.add(feet);
      alive++;
    }
  }
  if (alive) focus.divideScalar(alive);
  else focus.set(...levelDef.spawn);

  const [pa, pb] = [view.players.find((p) => p.index === 0), view.players.find((p) => p.index === 1)];
  if (pa && pb) {
    anchorA.set(pa.pos[0], pa.pos[1] - 0.05, pa.pos[2]);
    anchorB.set(pb.pos[0], pb.pos[1] - 0.05, pb.pos[2]);
    chain.update(anchorA, anchorB, t, levelView.groundAt);
  }

  meteors.sync(view.meteors, dt, t);
  bossView?.update(view.boss, dt, t, view.players.filter((p) => p.alive).map((p) => ({ x: p.pos[0], z: p.pos[2] })));

  if (session.phase === 'level') {
    ui.setTime(view.t);
    ui.setGems(view.gems);
    if (view.boss) ui.setBoss(view.boss.hp, view.boss.maxHp);
  }

  // Gust audio when a wind zone near us starts blowing.
  view.wind.forEach((s, i) => {
    if (s === 2 && lastWind[i] !== 2) {
      const w = levelDef.wind[i];
      const near = Math.abs(focus.z - (w.min[2] + w.max[2]) / 2) < 14;
      if (near) audio.gust();
    }
  });
  lastWind = view.wind;

  post.grade.uDanger.value += (danger - post.grade.uDanger.value) * (1 - Math.exp(-dt * 5));
  const spread = pa && pb ? Math.hypot(pa.pos[0] - pb.pos[0], pa.pos[2] - pb.pos[2]) : 0;
  return { focus, spread };
}

function frame() {
  requestAnimationFrame(frame);
  const rawDt = clock.getDelta();
  const dt = Math.min(rawDt, 0.05);
  const t = clock.elapsedTime;
  if (!document.hidden && post.adapt(rawDt)) effects.resize();

  world.update(dt, t);
  ui.tickStory(rawDt);
  syncPauseUi();

  let camInput = {};
  if (session.phase === 'lobby') camInput = updateLobby(dt, t);
  // On the main menu, swing the scene into the space right of the menu column.
  else if (ui.current === 'menu' && window.innerWidth >= 900) camInput = { insetLeft: menuCol.getBoundingClientRect().right };
  else if (levelView) camInput = updateLevel(dt, t);
  else {
    for (const r of braceRings) r.visible = false;
  }
  effects.update(dt);

  post.grade.uTime.value = t;
  post.grade.uHit.value = Math.max(0, post.grade.uHit.value - dt * 2.2);
  if (!levelView) post.grade.uDanger.value = 0;
  cam.update(dt, t, camInput);
  world.setFocus(camInput.focus ?? focus.set(0, 0, 0));
  post.composer.render();
}

ui.setConnected(false, false);
frame();

// Dev-only handle for automated playtesting.
if (import.meta.env.DEV) window.__itt = { session, snapshots, scene, ui, views: () => ({ levelView, bossView }) };
