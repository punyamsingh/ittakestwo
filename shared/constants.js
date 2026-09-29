// Gameplay tuning shared by the authoritative server and the client renderer.

export const TICK_RATE = 30;
export const GRAVITY = 20;

export const PLAYER_RADIUS = 0.6;
// Players stand this far either side of a spawn / checkpoint point.
export const SPAWN_SPREAD = 1.2;

export const MOVE = {
  maxSpeed: 6.5,
  groundAccel: 38,
  airAccel: 14,
  brake: 14,
  maxForce: 70,
  jumpSpeed: 8.5,
  coyoteTime: 0.1,
  jumpBuffer: 0.15,
  stunTime: 0.55,
};

export const CHAIN = {
  length: 5,
  stiffness: 45,
  maxForce: 200,
};

// Holding brace plants a grounded player: they can't be dragged, shoved or
// blown away, so their partner can hang off the chain — and climb it by jumping.
export const BRACE = {
  climbMinDistance: 0.8,
  climbUp: 7.5,
  climbPull: 4.5,
  climbCooldown: 0.3,
};

export const PAD_POWER = 13;
export const RESPAWN_DELAY = 1.1;
export const GEM_RADIUS = 1.0;
export const PLATE_RADIUS = 1.0;
export const CRUMBLE = { delay: 0.7, respawn: 5 };

export const SWEEPER = {
  top: 1.0,
  halfWidth: 0.25,
  knockbackBase: 6,
  knockbackScale: 0.8,
  tangential: 0.5,
  lift: 4,
  cooldown: 0.6,
};

export const METEOR = {
  radius: 0.55,
  spawnHeight: 16,
  fallTime: 1.5,
  blastRadius: 2.0,
  knockback: 12,
  lift: 6,
};

export const BOSS = {
  hp: 3,
  hubRadius: 2.3,
  hubHeight: 3,
  armReach: 11,
  runeGap: 4.2,
  runeHold: 0.8,
  stun: 3.5,
  ringSpeed: 7,
  ringWidth: 0.6,
};

export const CREATURE_TYPES = ['dragon', 'golem', 'slime', 'robot', 'cat'];
export const COLOR_SWATCHES = ['#ff5d5d', '#5da9ff', '#6be39a', '#ffc94d', '#b98bff', '#ff8fd0'];
export const DEFAULT_AVATARS = [
  { type: 'dragon', color: '#ff5d5d' },
  { type: 'golem', color: '#5da9ff' },
];

export function isValidAvatarType(type) {
  return CREATURE_TYPES.includes(type);
}

export function isValidColor(color) {
  return typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color);
}
