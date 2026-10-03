import { TICK_RATE, DEFAULT_AVATARS, avatarFor, otherCharacter } from '../shared/constants.js';
import { LEVELS } from '../shared/levels.js';
import { LevelSim, DT } from './level.js';

const STORY_TIMEOUT_MS = 120000;

export class Room {
  constructor(code, io, { random = Math.random, clock = () => performance.now() } = {}) {
    this.code = code;
    this.io = io;
    this.random = random;
    this.clock = clock;
    this.players = [];
    this.hostId = null;
    this.phase = 'lobby'; // lobby | story | playing | complete
    this.levelIndex = 0;
    this.unlocked = 0;
    this.sim = null;
    this.interval = null;
    this.storyReady = new Set();
    this.storyTimer = null;
  }

  emit(event, payload) {
    this.io.to(this.code).emit(event, payload);
  }

  get level() {
    return LEVELS[this.levelIndex];
  }

  getPlayer(id) {
    return this.players.find((p) => p.id === id);
  }

  publicPlayers() {
    return this.players.map((p) => ({ id: p.id, index: p.index, avatar: p.avatar }));
  }

  lobbyState() {
    return { players: this.publicPlayers(), hostId: this.hostId, levelIndex: this.levelIndex, unlocked: this.unlocked, phase: this.phase };
  }

  canChangeAvatar() {
    return this.phase === 'lobby' || this.phase === 'complete';
  }

  addPlayer(socket) {
    const index = this.players.some((p) => p.index === 0) ? 1 : 0;
    // May and Cody: a newcomer gets whichever doll is still free.
    const taken = this.players[0]?.avatar.type;
    const avatar = taken ? avatarFor(otherCharacter(taken)) : { ...DEFAULT_AVATARS[index] };
    const player = { id: socket.id, index, avatar, input: { x: 0, z: 0, brace: false }, jumpAt: -Infinity, body: null };
    this.players.push(player);
    this.players.sort((a, b) => a.index - b.index);
    if (!this.hostId) this.hostId = socket.id;
    return player;
  }

  removePlayer(id) {
    this.players = this.players.filter((p) => p.id !== id);
    if (this.hostId === id) this.hostId = this.players[0]?.id ?? null;
    if (this.players.length < 2) this.stopGame();
  }

  // Picking the doll your partner has swaps you both.
  setCharacter(id, type) {
    const player = this.getPlayer(id);
    if (!player || !this.canChangeAvatar() || player.avatar.type === type) return false;
    player.avatar = avatarFor(type);
    for (const p of this.players) if (p !== player && p.avatar.type === type) p.avatar = avatarFor(otherCharacter(type));
    return true;
  }

  setUnlocked(n) {
    const v = Number.isInteger(n) ? n : 0;
    this.unlocked = Math.max(0, Math.min(LEVELS.length - 1, v));
    this.levelIndex = Math.min(this.levelIndex, this.unlocked);
  }

  selectLevel(index) {
    if (this.phase !== 'lobby' && this.phase !== 'complete') return false;
    if (!Number.isInteger(index) || index < 0 || index > this.unlocked) return false;
    this.levelIndex = index;
    return true;
  }

  setInput(id, input) {
    const p = this.getPlayer(id);
    if (!p || this.phase !== 'playing') return;
    const axis = (v) => (Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0);
    p.input = { x: axis(input?.x), z: axis(input?.z), brace: input?.brace === true };
    if (input?.jump === true) p.jumpAt = this.sim?.t ?? 0;
  }

  // ---------- flow ----------

  startStory(index = this.levelIndex) {
    if (this.players.length < 2 || (this.phase !== 'lobby' && this.phase !== 'complete')) return false;
    if (index < 0 || index > this.unlocked) return false;
    this.clearLoop();
    this.sim = null;
    this.levelIndex = index;
    this.phase = 'story';
    this.storyReady.clear();
    this.emit('story', { levelId: this.level.id, levelIndex: index });
    this.storyTimer = setTimeout(() => this.beginLevel(), STORY_TIMEOUT_MS);
    return true;
  }

  storyDone(id) {
    if (this.phase !== 'story' || !this.getPlayer(id)) return;
    this.storyReady.add(id);
    if (this.players.every((p) => this.storyReady.has(p.id))) this.beginLevel();
    else this.emit('story-waiting', { ready: [...this.storyReady] });
  }

  beginLevel() {
    if (this.players.length < 2) return;
    this.clearLoop();
    this.phase = 'playing';
    this.sim = new LevelSim(this.level, this.players, { emit: (e, p) => this.emit(e, p), random: this.random, clock: this.clock });
    this.emit('level-start', { levelId: this.level.id, levelIndex: this.levelIndex, players: this.publicPlayers() });
    this.broadcastState();
    this.interval = setInterval(() => this.tick(), 1000 / TICK_RATE);
  }

  restartLevel() {
    if (this.phase !== 'playing' && this.phase !== 'complete') return false;
    this.beginLevel();
    return true;
  }

  tick() {
    if (!this.sim || this.phase !== 'playing') return;
    this.sim.tick(DT);
    if (this.sim.done) this.complete();
    else this.broadcastState();
  }

  complete() {
    this.clearLoop();
    this.phase = 'complete';
    const hasNext = this.levelIndex < LEVELS.length - 1;
    if (hasNext) this.unlocked = Math.max(this.unlocked, this.levelIndex + 1);
    this.emit('level-complete', { levelId: this.level.id, levelIndex: this.levelIndex, stats: this.sim.stats, unlocked: this.unlocked, hasNext });
  }

  nextLevel() {
    if (this.phase !== 'complete' || this.levelIndex >= LEVELS.length - 1) return false;
    return this.startStory(this.levelIndex + 1);
  }

  toMap() {
    this.stopGame();
  }

  clearLoop() {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
    if (this.storyTimer) clearTimeout(this.storyTimer);
    this.storyTimer = null;
  }

  stopGame() {
    this.clearLoop();
    this.sim = null;
    for (const p of this.players) p.body = null;
    this.phase = 'lobby';
  }

  destroy() {
    this.stopGame();
  }

  broadcastState() {
    this.emit('state', { now: this.clock(), levelId: this.level.id, ...this.sim.state() });
  }
}
