// Chapter 1 level data, shared by the server (physics) and the client (visuals).
//
// Conventions:
// - Levels progress toward -z (away from the camera) and upward.
// - `pos` for platforms is the centre of the TOP surface.
// - Jump: ~1.8 up, ~5 across on the flat. Normal gaps are kept <= 3, step-ups <= 1.4;
//   anything bigger goes through a pad, lift, mover or brace-and-climb (see `via`).
// - `side: true` marks optional detours (gems) and `wall: true` blocking geometry;
//   both are skipped by the route lint in the tests.

const box = (id, pos, size, style = 'grass', extra = {}) => ({ id, kind: 'box', pos, size, style, ...extra });
const disc = (id, pos, radius, style = 'stone', extra = {}) => ({ id, kind: 'disc', pos, radius, height: 2.5, style, ...extra });

// A wall across the level at depth z, with a plate-driven door in the middle.
function twinPlateGate(prefix, z, y, halfWidth, plateA, plateB) {
  const wallH = 2.6;
  const doorW = 3;
  const sideW = halfWidth - doorW / 2;
  return {
    platforms: [
      box(`${prefix}-wl`, [-(doorW / 2 + sideW / 2), y + wallH, z], [sideW, wallH, 0.8], 'ruin', { wall: true }),
      box(`${prefix}-wr`, [doorW / 2 + sideW / 2, y + wallH, z], [sideW, wallH, 0.8], 'ruin', { wall: true }),
      box(`${prefix}-door`, [0, y + wallH, z], [doorW, wallH, 0.6], 'gate', {
        wall: true,
        move: { offset: [0, -wallH - 0.1, 0], plates: [`${prefix}-a`, `${prefix}-b`], any: true, duration: 0.5 },
      }),
    ],
    plates: [
      { id: `${prefix}-a`, pos: plateA },
      { id: `${prefix}-b`, pos: plateB },
    ],
  };
}

const L1 = {
  id: 'awakening',
  name: 'Wake-Up Call',
  tagline: 'Two dolls wake up on a dusty shed shelf.',
  spawn: [0, 0, 3],
  killY: -10,
  platforms: [
    box('start', [0, 0, 0], [11, 3, 11]),
    box('step', [0, 1, -9.5], [7, 3, 5]),
    disc('s1', [-1.5, 1, -15.5], 1.4),
    disc('gem-rock', [4.4, 1, -15.5], 1.2, 'stone', { side: true }),
    disc('s2', [1.5, 1.4, -19.5], 1.4),
    disc('s3', [-1, 1.8, -23.5], 1.4),
    box('camp', [0, 1.8, -30], [10, 6, 8]),
    box('ruins', [0, 5, -38.5], [8, 2.5, 5], 'ruin', { via: 'pad' }),
    box('c1', [0, 5, -44.5], [3, 0.8, 3], 'crumble', { crumble: true }),
    box('c2', [0, 5.4, -49], [3, 0.8, 3], 'crumble', { crumble: true }),
    box('c3', [0, 5, -53.5], [3, 0.8, 3], 'crumble', { crumble: true }),
    box('goal', [0, 5, -61], [10, 3, 9]),
  ],
  pads: [{ pos: [0, 1.8, -32.8] }],
  gems: [
    [4.4, 2.3, -15.5],
    [7.2, -1.6, -31],
    [0, 7, -49],
  ],
  checkpoints: [{ pos: [0, 1.8, -28.2] }],
  goal: { pos: [0, 5, -62.5] },
  hints: [
    { pos: [0, 0, 2], radius: 4, text: '[W][A][S][D] to move  ·  [Space] to jump' },
    { pos: [0, 1, -9.5], radius: 3, text: 'Rose’s red thread ties you together — you can never stray far apart. Move together!' },
    { pos: [0, 1.8, -28.5], radius: 3.5, text: 'Hold [Shift] to BRACE and anchor the thread. Dangling off an edge? Press [Space] to climb back up!' },
    { pos: [0, 1.8, -32.8], radius: 2, text: 'Springs launch you up. Take it together!' },
    { pos: [0, 5, -40.2], radius: 2.5, text: 'Soggy cardboard gives way underfoot — keep moving!' },
  ],
  decor: [
    { kind: 'plant', pos: [-4, 0, 3.5], scale: 1.2 },
    { kind: 'plant', pos: [4.2, 0, -3.5] },
    { kind: 'nut', pos: [3.8, 0, 3] },
    { kind: 'spool', pos: [-3.8, 0, -3.8] },
    { kind: 'jar', pos: [3.6, 1.8, -33] },
    { kind: 'candle', pos: [-4, 1.8, -27] },
    { kind: 'spool', pos: [-3, 5, -37.5], scale: 0.8 },
    { kind: 'pennant', pos: [-3.5, 5, -60] },
    { kind: 'pennant', pos: [3.5, 5, -60] },
    { kind: 'plant', pos: [-3.8, 5, -64], scale: 1.1 },
  ],
};

const L2gate = twinPlateGate('g', -50, 0, 6, [-1.4, 0, -47.8], [1.4, 0, -52.2]);
const L2 = {
  id: 'broken-bridge',
  name: 'The Workbench',
  tagline: 'Cody’s old projects still have a few moves left in them.',
  spawn: [0, 0, 3],
  killY: -12,
  platforms: [
    box('start', [0, 0, 0], [10, 3, 10]),
    box('stub-a', [0, 0, -7], [4, 1.2, 4], 'ruin'),
    box('ferry', [0, 0, -12], [4, 0.6, 4], 'metal', { via: 'mover', move: { offset: [0, 0, -14], period: 7 } }),
    box('stub-b', [0, 0, -31], [4, 1.2, 4], 'ruin'),
    box('isle-b', [0, 0, -38], [10, 3, 9]),
    box('raft', [7, 0, -38], [3.5, 0.5, 3.5], 'metal', { side: true, move: { offset: [7, 0, 0], period: 6 } }),
    box('isle-c', [0, 0, -49.5], [12, 3, 11], 'stone'),
    ...L2gate.platforms,
    box('lift', [0, 0, -57], [3, 0.5, 3], 'metal', { via: 'lift', move: { offset: [0, 3.2, 0], plates: ['lift'], duration: 1.4 } }),
    box('ledge', [0, 3.2, -62], [10, 3, 7], 'ruin', { via: 'lift' }),
    box('pillar', [-4, 4.4, -63.5], [1.4, 1.2, 1.4], 'ruin', { side: true }),
    box('zig', [-3, 3.2, -69.5], [3, 0.5, 3], 'metal', { move: { offset: [6, 0, 0], period: 4 } }),
    box('zag', [3, 3.2, -75], [3, 0.5, 3], 'metal', { move: { offset: [-6, 0, 0], period: 4 } }),
    box('goal', [0, 3.2, -83], [10, 3, 9]),
  ],
  plates: [...L2gate.plates, { id: 'lift', pos: [2.2, 0, -54] }],
  gems: [
    [14, 1.2, -38],
    [-4, 5.4, -63.5],
    [-4.6, 4.4, -75],
  ],
  checkpoints: [{ pos: [0, 0, -36] }, { pos: [0, 3.2, -61] }],
  goal: { pos: [0, 3.2, -84.5] },
  hints: [
    { pos: [0, 0, -3], radius: 3.5, text: 'Moving platforms carry you — time your jump and ride it together.' },
    { pos: [0, 0, -46.5], radius: 3.5, text: 'Buttons open gates. One holds while the other slips through — then swap sides!' },
    { pos: [0, 0, -54.5], radius: 3, text: 'One rides the lift, one holds the button. Up top: BRACE with [Shift] — your partner jumps and climbs the thread.' },
  ],
  decor: [
    { kind: 'plant', pos: [-3.8, 0, 3] },
    { kind: 'spool', pos: [3.5, 0, 3.5] },
    { kind: 'candle', pos: [-1.6, 0, -8.6] },
    { kind: 'candle', pos: [1.6, 0, -29.4] },
    { kind: 'plant', pos: [-3.8, 0, -40.5], scale: 1.2 },
    { kind: 'nut', pos: [3.5, 0, -35] },
    { kind: 'pennant', pos: [-5, 0, -45.5] },
    { kind: 'pennant', pos: [5, 0, -45.5] },
    { kind: 'jar', pos: [4, 3.2, -64.5] },
    { kind: 'plant', pos: [-3.6, 3.2, -86] },
    { kind: 'blocks', pos: [3.6, 3.2, -86] },
  ],
};

const L3 = {
  id: 'windward-cliffs',
  name: 'Through the Draft',
  tagline: 'A broken window, a howling draft, and a very long way down.',
  spawn: [0, 0, 3],
  killY: -10,
  platforms: [
    box('start', [0, 0, 0], [10, 3, 10]),
    box('bridge', [0, 0, -12], [1.8, 1, 14], 'ruin'),
    box('isle-b', [0, 0, -25.25], [9, 3, 10.5]),
    box('step-1', [3, 1.4, -29.6], [1.6, 1.4, 1.6], 'crumble', { crumble: true }),
    box('tier-1', [0, 2.8, -33], [9, 3, 5], 'ruin', { via: 'climb' }),
    box('step-2', [-3, 4.2, -34.7], [1.6, 1.4, 1.6], 'crumble', { crumble: true }),
    box('tier-2', [0, 5.6, -40], [9, 3, 5], 'ruin', { via: 'climb' }),
    box('c1', [0, 5.6, -46], [3, 0.8, 3], 'crumble', { crumble: true }),
    box('c2', [0, 5.6, -50], [3, 0.8, 3], 'crumble', { crumble: true }),
    box('c3', [0, 5.6, -54], [3, 0.8, 3], 'crumble', { crumble: true }),
    box('isle-d', [0, 5.6, -62], [10, 3, 9]),
    box('perch', [-7, 5.6, -62], [1.6, 1, 1.6], 'ruin', { side: true }),
    box('bridge-2', [0, 5.6, -72], [2.2, 1, 10], 'ruin'),
    box('goal', [0, 5.6, -82], [10, 3, 8]),
  ],
  wind: [
    { min: [-7, -3, -19], max: [7, 6, -5], force: [55, 0, 0], on: 1.8, off: 2.6 },
    { min: [-8, 2, -57], max: [8, 11, -44], force: [-50, 0, 0], on: 1.5, off: 3, offset: 1 },
    { min: [-8, 2, -77.5], max: [8, 12, -66.5], force: [60, 0, 0], on: 2, off: 2.2, offset: 0.5 },
  ],
  gems: [
    [2.4, -0.8, -12],
    [0, 7.6, -50],
    [-7, 7, -62],
  ],
  checkpoints: [{ pos: [0, 0, -22.5] }, { pos: [0, 5.6, -39.5] }, { pos: [0, 5.6, -61] }],
  goal: { pos: [0, 5.6, -83] },
  hints: [
    { pos: [0, 0, -3.5], radius: 3.5, text: 'Drafts sweep the ruler. When the wind picks up — BRACE with [Shift]!' },
    { pos: [0, 0, -28], radius: 3.5, text: 'Too tall to jump? One gets up and BRACES at the edge — the other jumps, then presses [Space] again to climb the thread.' },
  ],
  decor: [
    { kind: 'plant', pos: [-3.5, 0, 3.5], scale: 1.1 },
    { kind: 'nut', pos: [3.6, 0, 2.5] },
    { kind: 'jar', pos: [3.3, 0, -21.5] },
    { kind: 'spool', pos: [-3.4, 2.8, -31.5] },
    { kind: 'candle', pos: [3.3, 5.6, -38.5] },
    { kind: 'plant', pos: [3.8, 5.6, -64.5] },
    { kind: 'pennant', pos: [-3.6, 5.6, -80] },
    { kind: 'pennant', pos: [3.6, 5.6, -80] },
  ],
};

const L4 = {
  id: 'stormfall-ascent',
  name: 'Loose Screws',
  tagline: 'The shelves above have had enough of holding things up.',
  spawn: [0, 0, 3],
  killY: -10,
  platforms: [
    box('start', [0, 0, 0], [11, 3, 11]),
    box('field', [0, 0, -15], [12, 3, 14], 'stone'),
    box('camp', [0, 1, -28], [9, 3, 7]),
    disc('ring-1', [0, 1, -41], 7, 'stone'),
    disc('ring-2', [0, 2.2, -56], 6, 'stone'),
    box('camp-2', [0, 2.2, -66], [9, 3, 6]),
    box('ferry', [0, 2.2, -73], [3.5, 0.6, 3.5], 'metal', { via: 'mover', move: { offset: [0, 0, -8], period: 5 } }),
    disc('gem-rock', [5.2, 2.2, -77], 1.2, 'stone', { side: true }),
    box('goal', [0, 2.2, -88], [10, 3, 9]),
  ],
  spinners: [
    { pos: [0, 1, -41], length: 6.5, speed: 1.1, arms: 1 },
    { pos: [0, 2.2, -56], length: 5.5, speed: 0.9, arms: 2 },
  ],
  meteorZones: [
    { center: [0, 0, -15], radius: 5.5, interval: 1.4 },
    { center: [0, 2.2, -77], size: [3.5, 9], interval: 2 },
  ],
  gems: [
    [5, 1.2, -19.5],
    [0, 4.8, -56],
    [5.2, 3.4, -77],
  ],
  checkpoints: [{ pos: [0, 1, -27] }, { pos: [0, 2.2, -65] }],
  goal: { pos: [0, 2.2, -89.5] },
  hints: [
    { pos: [0, 0, -9.5], radius: 3.5, text: 'Falling bolts! Yellow rings mark where they’ll land — get clear, or be in the air when they hit.' },
    { pos: [0, 1, -34.5], radius: 3, text: 'Jump the spinning saw arm. The red glow shows where it’s heading next.' },
  ],
  decor: [
    { kind: 'plant', pos: [-4, 0, 3.5] },
    { kind: 'nut', pos: [4, 0, 3.5], scale: 1.2 },
    { kind: 'candle', pos: [-3.5, 1, -25.5] },
    { kind: 'candle', pos: [3.5, 1, -25.5] },
    { kind: 'jar', pos: [-3.6, 2.2, -64] },
    { kind: 'blocks', pos: [-3.6, 2.2, -91] },
    { kind: 'blocks', pos: [3.6, 2.2, -91] },
  ],
};

const L5gate = twinPlateGate('g', -26, 0, 6, [-1.3, 0, -23.6], [1.3, 0, -28.2]);
const L5 = {
  id: 'spire-gate',
  name: 'The Fuse Box',
  tagline: 'Everything they have learned, all at once.',
  spawn: [0, 0, 3],
  killY: -10,
  platforms: [
    box('start', [0, 0, 0], [10, 3, 10], 'ruin'),
    disc('hop', [0, 0, -6.5], 1.1, 'stone'),
    disc('ring', [0, 0, -13.5], 5.8, 'stone'),
    box('isle-b', [0, 0, -26], [12, 3, 8], 'stone'),
    ...L5gate.platforms,
    box('ferry', [0, 0, -33], [3.5, 0.6, 3.5], 'metal', { via: 'mover', move: { offset: [0, 0, -10], period: 6 } }),
    box('isle-c', [0, 0, -50], [9, 3, 8], 'ruin'),
    box('lift', [0, 0, -55.8], [3, 0.5, 3], 'metal', { via: 'lift', move: { offset: [0, 3.6, 0], plates: ['lift'], duration: 1.4 } }),
    box('tier-d', [0, 3.6, -61], [9, 3, 7], 'ruin', { via: 'lift' }),
    box('pillar', [-3.5, 4.8, -63], [1.2, 1.2, 1.2], 'ruin', { side: true }),
    box('c1', [0, 3.6, -68], [3, 0.8, 3], 'crumble', { crumble: true }),
    box('c2', [0, 3.6, -72.5], [3, 0.8, 3], 'crumble', { crumble: true }),
    box('c3', [0, 3.6, -77], [3, 0.8, 3], 'crumble', { crumble: true }),
    box('gate-isle', [0, 3.6, -86], [12, 3, 10], 'ruin'),
  ],
  plates: [...L5gate.plates, { id: 'lift', pos: [2.2, 0, -52.8] }],
  spinners: [{ pos: [0, 0, -13.5], length: 5.3, speed: 1.0, arms: 1 }],
  wind: [{ min: [-10, -2, -46], max: [10, 8, -31], force: [45, 0, 0], on: 1.6, off: 2.6 }],
  meteorZones: [{ center: [0, 3.6, -72.5], size: [3, 11], interval: 1.8 }],
  gems: [
    [3.6, 1.6, -39],
    [-3.5, 5.8, -63],
    [0, 5.6, -72.5],
  ],
  checkpoints: [{ pos: [0, 0, -28.8] }, { pos: [0, 0, -49] }, { pos: [0, 3.6, -60] }],
  goal: { pos: [0, 3.6, -88] },
  hints: [{ pos: [0, 0, 2.5], radius: 3, text: 'The Fuse Box. Everything you’ve learned — together.' }],
  decor: [
    { kind: 'blocks', pos: [-3.6, 0, 3.6] },
    { kind: 'blocks', pos: [3.6, 0, 3.6] },
    { kind: 'candle', pos: [-4.5, 0, -48] },
    { kind: 'jar', pos: [3.5, 3.6, -58.5] },
    { kind: 'pencils', pos: [0, 3.6, -89.5] },
    { kind: 'pennant', pos: [-4.5, 3.6, -83] },
    { kind: 'pennant', pos: [4.5, 3.6, -83] },
  ],
};

const L6 = {
  id: 'iron-warden',
  name: 'The Toolbox',
  tagline: 'Cody’s toolbox remembers every time he forgot it in the rain.',
  boss: 'warden',
  camera: 'arena',
  spawn: [0, 0, 8.5],
  killY: -8,
  platforms: [disc('arena', [0, 0, 0], 12, 'arena', { height: 1 })],
  checkpoints: [],
  gems: [],
  goal: null,
  hints: [{ pos: [0, 0, 8.5], radius: 3, text: 'Stand on BOTH power buttons at once to zap the Toolbox!' }],
  decor: [],
};

export const CHAPTER = {
  id: 1,
  name: 'The Shed',
  levels: [L1, L2, L3, L4, L5, L6],
};

export const LEVELS = CHAPTER.levels;

export function levelById(id) {
  return LEVELS.find((l) => l.id === id) ?? null;
}

export function levelIndex(id) {
  return LEVELS.findIndex((l) => l.id === id);
}
