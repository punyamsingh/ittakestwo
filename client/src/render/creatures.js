import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CHARACTERS, CHARACTER_TYPES } from '@shared/constants.js';
import { textures, labelTexture } from './textures.js';

export const CREATURES = Object.fromEntries(Object.entries(CHARACTERS).map(([type, c]) => [type, { label: c.name, blurb: c.blurb }]));

const WHITE = new THREE.Color('#ffffff');
const BLACK = new THREE.Color('#000000');

const SHARED = {
  eyeWhite: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.25 }),
  pupil: new THREE.MeshStandardMaterial({ color: '#1a1024', roughness: 0.15 }),
  shine: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
  blush: new THREE.MeshBasicMaterial({ color: '#ff8fae', transparent: true, opacity: 0.55, depthWrite: false }),
};

function palette(hex) {
  const base = new THREE.Color(hex);
  return {
    base,
    light: base.clone().lerp(WHITE, 0.4),
    pale: base.clone().lerp(WHITE, 0.7),
    dark: base.clone().lerp(BLACK, 0.35),
    glow: base.clone().offsetHSL(0, 0.1, 0.12),
  };
}

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

function makeEye(size) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.SphereGeometry(size, 18, 14), SHARED.eyeWhite));
  // Flattened pupil sitting on the eyeball's surface (inside it, it's invisible).
  const pupil = mesh(new THREE.SphereGeometry(size * 0.62, 16, 12), SHARED.pupil, 0, -size * 0.04, size * 0.66);
  pupil.scale.z = 0.62;
  g.add(pupil);
  g.add(mesh(new THREE.SphereGeometry(size * 0.2, 8, 6), SHARED.shine, size * 0.24, size * 0.24, size * 1.02));
  return g;
}

function makeEyes(size, spacing, toe = 0.18) {
  const g = new THREE.Group();
  const l = makeEye(size);
  const r = makeEye(size);
  l.position.x = spacing;
  r.position.x = -spacing;
  l.rotation.y = toe;
  r.rotation.y = -toe;
  g.add(l, r);
  return g;
}

function blush(x, y, z, size = 0.08) {
  const m = mesh(new THREE.SphereGeometry(size, 10, 8), SHARED.blush, x, y, z);
  m.scale.set(1, 0.55, 0.3);
  return m;
}

// ---------- models (feet at y = 0, facing +z) ----------

// Sphere with a gently lumpy surface, so clay reads as hand-pressed clay.
function lumpGeo(r, amp = 0.04, freq = 6, seed = 0) {
  const src = new THREE.SphereGeometry(r, 32, 24);
  src.deleteAttribute('uv');
  src.deleteAttribute('normal');
  const geo = mergeVertices(src);
  src.dispose();
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const f = Math.sin(v.x * freq + seed) * Math.sin(v.y * freq * 0.8 - seed) * Math.sin(v.z * freq * 1.2 + seed * 0.5);
    v.multiplyScalar(r * (1 + amp * f));
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

// Wood grain baked into a small canvas, shared by every May.
let grainTex = null;
function woodGrain() {
  if (grainTex) return grainTex;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 22; i++) {
    ctx.strokeStyle = `rgba(120, 70, 30, ${0.06 + Math.random() * 0.1})`;
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath();
    const x = Math.random() * 64;
    ctx.moveTo(x, 0);
    for (let y = 0; y <= 256; y += 16) ctx.lineTo(x + Math.sin(y * 0.05 + i) * 3, y);
    ctx.stroke();
  }
  grainTex = new THREE.CanvasTexture(c);
  grainTex.colorSpace = THREE.SRGBColorSpace;
  grainTex.wrapS = grainTex.wrapT = THREE.RepeatWrapping;
  return grainTex;
}

function mouthMesh(mat, r = 0.05) {
  const m = mesh(new THREE.TorusGeometry(r, r * 0.28, 6, 14, Math.PI), mat);
  m.rotation.z = Math.PI;
  return m;
}

// May: a carved, varnished wooden doll — peg body, ball joints, dark hair in a
// bun, and her blue work overalls.
function may(pal, mats) {
  const wood = mats(new THREE.MeshPhysicalMaterial({ color: '#e2b07a', map: woodGrain(), roughness: 0.45, clearcoat: 0.6, clearcoatRoughness: 0.35 }));
  const woodDark = mats(new THREE.MeshStandardMaterial({ color: '#b07a48', map: woodGrain(), roughness: 0.5 }));
  const cloth = mats(new THREE.MeshStandardMaterial({ color: pal.base, roughness: 0.75 }));
  const clothDark = mats(new THREE.MeshStandardMaterial({ color: pal.dark, roughness: 0.8 }));
  const hair = mats(new THREE.MeshStandardMaterial({ color: '#2a1d1a', roughness: 0.55 }));
  const shirt = mats(new THREE.MeshStandardMaterial({ color: '#f3e6cf', roughness: 0.8 }));
  const lip = mats(new THREE.MeshStandardMaterial({ color: '#6a2a20', roughness: 0.5 }));
  const button = mats(new THREE.MeshStandardMaterial({ color: '#f2c94c', roughness: 0.3, metalness: 0.4 }));

  const g = new THREE.Group();

  // Legs: wooden pegs with rounded feet.
  const legs = [1, -1].map((s) => {
    const leg = new THREE.Group();
    leg.position.set(s * 0.15, 0.42, 0);
    leg.add(mesh(new THREE.CylinderGeometry(0.085, 0.075, 0.32, 14), cloth, 0, -0.14, 0));
    const foot = mesh(new THREE.SphereGeometry(0.11, 14, 10), woodDark, 0, -0.35, 0.04);
    foot.scale.set(1, 0.6, 1.35);
    leg.add(foot);
    g.add(leg);
    return leg;
  });

  // Torso: overalls over a cream shirt.
  const torso = mesh(new THREE.CylinderGeometry(0.25, 0.28, 0.5, 24), cloth, 0, 0.66, 0);
  const bib = mesh(new RoundedBoxGeometry(0.3, 0.2, 0.06, 2, 0.03), cloth, 0, 0.92, 0.2);
  const chest = mesh(new THREE.CylinderGeometry(0.22, 0.25, 0.22, 24), shirt, 0, 0.98, 0);
  const pocket = mesh(new RoundedBoxGeometry(0.14, 0.1, 0.02, 2, 0.01), clothDark, 0, 0.62, 0.27);
  const buttons = [1, -1].map((s) => mesh(new THREE.SphereGeometry(0.025, 8, 6), button, s * 0.12, 1.0, 0.21));
  const neck = mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.1, 12), wood, 0, 1.12, 0);
  g.add(torso, bib, chest, pocket, ...buttons, neck);

  // Arms: peg arms with a visible ball joint at the shoulder and a round hand.
  const arms = [1, -1].map((s) => {
    const arm = new THREE.Group();
    arm.position.set(s * 0.29, 1.02, 0);
    arm.add(mesh(new THREE.SphereGeometry(0.075, 12, 10), woodDark));
    const sleeve = mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.32, 12), wood, s * 0.03, -0.2, 0);
    sleeve.rotation.z = s * 0.12;
    arm.add(sleeve, mesh(new THREE.SphereGeometry(0.07, 12, 10), wood, s * 0.06, -0.39, 0.02));
    g.add(arm);
    return arm;
  });

  // Head: a smooth wooden ball with painted features.
  const head = new THREE.Group();
  head.position.set(0, 1.42, 0.02);
  const skull = mesh(new THREE.SphereGeometry(0.31, 28, 22), wood);
  skull.scale.set(1, 1.05, 0.98);
  const eyes = makeEyes(0.075, 0.11, 0.15);
  eyes.position.set(0, 0.03, 0.26);
  const brows = [1, -1].map((s) => {
    const b = mesh(new RoundedBoxGeometry(0.09, 0.018, 0.02, 1, 0.008), hair, s * 0.11, 0.14, 0.28);
    b.rotation.z = s * -0.12;
    return b;
  });
  const mouth = mouthMesh(lip, 0.045);
  mouth.position.set(0, -0.12, 0.29);
  // Hair: a cap over the crown, a fringe, and a high bun.
  const cap = mesh(new THREE.SphereGeometry(0.33, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.52), hair, 0, 0.02, -0.02);
  cap.rotation.x = -0.35;
  const fringe = mesh(new THREE.SphereGeometry(0.2, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.35), hair, 0.08, 0.15, 0.13);
  fringe.rotation.set(0.9, 0, -0.5);
  const bun = mesh(new THREE.SphereGeometry(0.14, 16, 12), hair, 0, 0.3, -0.16);
  const band = mesh(new THREE.TorusGeometry(0.08, 0.025, 8, 18), clothDark, 0, 0.24, -0.12);
  band.rotation.x = 0.9;
  head.add(skull, eyes, ...brows, mouth, cap, fringe, bun, band, blush(0.18, -0.06, 0.25, 0.05), blush(-0.18, -0.06, 0.25, 0.05));
  g.add(head);

  return { group: g, height: 1.78, parts: { head, eyes, arms, legs } };
}

// Cody: a squishy, hand-pressed clay doll — round and a little lumpy, in a
// green knit jumper, brown trousers and a tuft of brown hair.
function cody(pal, mats) {
  const clay = mats(new THREE.MeshStandardMaterial({ color: '#e0a77c', roughness: 0.9 }));
  const knit = mats(new THREE.MeshStandardMaterial({ color: pal.base, roughness: 0.95 }));
  const knitDark = mats(new THREE.MeshStandardMaterial({ color: pal.dark, roughness: 0.95 }));
  const trousers = mats(new THREE.MeshStandardMaterial({ color: '#7a5236', roughness: 0.9 }));
  const shoe = mats(new THREE.MeshStandardMaterial({ color: '#4a3324', roughness: 0.85 }));
  const hair = mats(new THREE.MeshStandardMaterial({ color: '#6b4428', roughness: 0.9 }));
  const nose = mats(new THREE.MeshStandardMaterial({ color: '#d58f66', roughness: 0.9 }));
  const lip = mats(new THREE.MeshStandardMaterial({ color: '#7a3a28', roughness: 0.6 }));

  const g = new THREE.Group();

  const legs = [1, -1].map((s) => {
    const leg = new THREE.Group();
    leg.position.set(s * 0.17, 0.36, 0);
    leg.add(mesh(new THREE.CapsuleGeometry(0.1, 0.12, 4, 10), trousers, 0, -0.12, 0));
    const foot = mesh(lumpGeo(0.13, 0.05, 7, s), shoe, 0, -0.29, 0.05);
    foot.scale.set(1, 0.6, 1.3);
    leg.add(foot);
    g.add(leg);
    return leg;
  });

  // Chubby body: a lumpy clay ball in a knit jumper with a ribbed hem.
  const body = mesh(lumpGeo(0.42, 0.035, 5, 2), knit, 0, 0.7, 0);
  body.scale.set(1.05, 0.95, 0.95);
  const hem = mesh(new THREE.TorusGeometry(0.36, 0.06, 8, 28), knitDark, 0, 0.42, 0);
  hem.rotation.x = Math.PI / 2;
  const collar = mesh(new THREE.TorusGeometry(0.15, 0.05, 8, 20), knitDark, 0, 1.06, 0.02);
  collar.rotation.x = Math.PI / 2;
  // A leaf stitched on the chest, for the gardener.
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, -0.06);
  leafShape.quadraticCurveTo(0.06, 0, 0, 0.07);
  leafShape.quadraticCurveTo(-0.06, 0, 0, -0.06);
  const leaf = mesh(new THREE.ShapeGeometry(leafShape, 6), mats(new THREE.MeshStandardMaterial({ color: '#f3e6cf', roughness: 0.9, side: THREE.DoubleSide })), 0.15, 0.82, 0.39);
  leaf.rotation.set(-0.2, 0.35, -0.4);
  g.add(body, hem, collar, leaf);

  const arms = [1, -1].map((s) => {
    const arm = new THREE.Group();
    arm.position.set(s * 0.4, 0.9, 0);
    const sleeve = mesh(new THREE.CapsuleGeometry(0.09, 0.2, 4, 10), knit, s * 0.05, -0.15, 0);
    sleeve.rotation.z = s * 0.3;
    arm.add(sleeve, mesh(lumpGeo(0.085, 0.08, 8, s * 3), clay, s * 0.11, -0.33, 0.02));
    g.add(arm);
    return arm;
  });

  const head = new THREE.Group();
  head.position.set(0, 1.32, 0.03);
  const skull = mesh(lumpGeo(0.32, 0.03, 6, 5), clay);
  skull.scale.set(1.05, 0.98, 1);
  const eyes = makeEyes(0.08, 0.12, 0.15);
  eyes.position.set(0, 0.04, 0.27);
  const noseMesh = mesh(lumpGeo(0.07, 0.1, 9, 1), nose, 0, -0.04, 0.33);
  noseMesh.scale.set(1, 0.85, 0.9);
  const mouth = mouthMesh(lip, 0.05);
  mouth.position.set(0, -0.14, 0.29);
  const ears = [1, -1].map((s) => {
    const e = mesh(lumpGeo(0.07, 0.1, 9, s), clay, s * 0.32, 0, 0);
    e.scale.set(0.5, 1, 0.8);
    return e;
  });
  // Messy tufted hair, pinched up from the same clay.
  const tufts = [
    [0, 0.27, -0.02, 0.17],
    [0.14, 0.24, 0.04, 0.12],
    [-0.14, 0.23, 0.02, 0.13],
    [0.06, 0.22, 0.17, 0.1],
    [-0.08, 0.21, 0.16, 0.1],
    [0, 0.14, -0.2, 0.17],
  ].map(([x, y, z, r], i) => mesh(lumpGeo(r, 0.12, 10, i * 1.7), hair, x, y, z));
  head.add(skull, eyes, noseMesh, mouth, ...ears, ...tufts, blush(0.19, -0.08, 0.25, 0.055), blush(-0.19, -0.08, 0.25, 0.055));
  g.add(head);

  return { group: g, height: 1.7, parts: { head, eyes, arms, legs, body } };
}

const BUILDERS = { may, cody };

// ---------- entry + animation ----------

export function buildCreature(avatar) {
  const type = CHARACTER_TYPES.includes(avatar?.type) ? avatar.type : 'may';
  const pal = palette(CHARACTERS[type].color);
  const owned = [];
  const mats = (m) => {
    owned.push({ mat: m, emissive: m.emissive?.clone() ?? null, intensity: m.emissiveIntensity ?? 0 });
    return m;
  };
  const model = BUILDERS[type](pal, mats);
  model.group.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = false;
    }
  });

  const root = new THREE.Group();
  const rig = new THREE.Group();
  rig.add(model.group);
  root.add(rig);

  return {
    type,
    color: avatar?.color,
    root,
    rig,
    height: model.height,
    parts: model.parts,
    owned,
    seed: Math.random() * 100,
    anim: { walk: 0, land: 0, hit: 0, blinkAt: 1 + Math.random() * 3, blink: 0, hop: 0, heading: 0, flash: 0 },
    tag: null,
    shadow: null,
  };
}

export function disposeCreature(entry) {
  entry.root.parent?.remove(entry.root);
  entry.shadow?.parent?.remove(entry.shadow);
  entry.root.traverse((o) => {
    if (o.isMesh || o.isSprite) o.geometry?.dispose?.();
  });
  for (const { mat } of entry.owned) mat.dispose();
  entry.tag?.material.map?.dispose();
  entry.tag?.material.dispose();
}

export function attachShadow(entry, scene) {
  const mat = new THREE.MeshBasicMaterial({ map: textures().blob, transparent: true, depthWrite: false, opacity: 0.5 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), mat);
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 1;
  scene.add(m);
  entry.shadow = m;
  entry.owned.push({ mat, emissive: null, intensity: 0 });
}

export function setTag(entry, text, color) {
  if (entry.tag) {
    entry.root.remove(entry.tag);
    entry.tag.material.map.dispose();
    entry.tag.material.dispose();
    entry.tag = null;
  }
  if (!text) return;
  const mat = new THREE.SpriteMaterial({ map: labelTexture(text, color), transparent: true, depthTest: false, depthWrite: false });
  const s = new THREE.Sprite(mat);
  s.scale.set(1.15, 0.5, 1);
  s.position.y = entry.height + 0.55;
  s.renderOrder = 20;
  entry.root.add(s);
  entry.tag = s;
}

export function flashHit(entry) {
  entry.anim.hit = 1;
  entry.anim.flash = 1;
}

export function landed(entry, speed) {
  entry.anim.land = Math.min(1, 0.4 + speed * 0.06);
}

export function hop(entry) {
  entry.anim.hop = 1;
}

const TAU = Math.PI * 2;
function wrapAngle(a) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

/**
 * state: { vel: Vector3, grounded, alive, faceCamera, floorY (surface below, or null) }
 */
export function animateCreature(entry, dt, t, state) {
  const { anim, rig, parts, type } = entry;
  const vx = state.vel?.x ?? 0;
  const vz = state.vel?.z ?? 0;
  const vy = state.vel?.y ?? 0;
  const speed = Math.hypot(vx, vz);
  const k = (rate) => 1 - Math.exp(-dt * rate);

  // Facing (shortest way round).
  let targetHeading = anim.heading;
  if (state.faceCamera) targetHeading = 0;
  else if (speed > 0.8 && state.alive) targetHeading = Math.atan2(vx, vz);
  anim.heading = wrapAngle(anim.heading + wrapAngle(targetHeading - anim.heading) * k(12));
  entry.root.rotation.y = anim.heading;

  // Timers.
  anim.land = Math.max(0, anim.land - dt * 4);
  anim.flash = Math.max(0, anim.flash - dt * 3);
  anim.hit = Math.max(0, anim.hit - dt * 1.8);
  anim.hop = Math.max(0, anim.hop - dt * 2.2);
  anim.blinkAt -= dt;
  if (anim.blinkAt <= 0) {
    anim.blink = 0.14;
    anim.blinkAt = 2 + Math.random() * 3.5;
  }
  anim.blink = Math.max(0, anim.blink - dt);

  const grounded = state.grounded;
  if (grounded) anim.walk += dt * speed * 2.3;
  const move = Math.min(1, speed / 5);

  // Squash & stretch: stretch with vertical speed, squash on landing, breathe at rest.
  const breathe = Math.sin(t * 2.3 + entry.seed) * 0.02;
  const stretch = grounded ? 0 : THREE.MathUtils.clamp(vy * 0.028, -0.14, 0.2);
  const squash = Math.sin(anim.land * Math.PI) * 0.28 * anim.land;
  const sy = 1 + breathe + stretch - squash;
  const sxz = 1 / Math.sqrt(Math.max(0.5, sy));
  rig.scale.set(sxz, sy, sxz);

  const hopY = Math.sin(anim.hop * Math.PI) * 0.45;
  const bob = grounded ? Math.abs(Math.sin(anim.walk)) * 0.09 * move : 0;
  rig.position.y = bob + hopY;
  rig.rotation.z = Math.sin(anim.walk) * 0.09 * move;
  rig.rotation.x = state.alive ? move * 0.14 : rig.rotation.x + dt * 7;
  // Dizzy spin after a hit.
  const spin = anim.hit > 0 ? (1 - Math.pow(anim.hit, 2)) * TAU : 0;
  rig.rotation.y = spin;

  // Eyes.
  const blinkScale = anim.blink > 0 ? 0.12 : 1;
  if (parts.eyes) parts.eyes.scale.y += (blinkScale - parts.eyes.scale.y) * k(40);

  // Hit flash on owned materials.
  if (anim.flash > 0 || entry.flashing) {
    const f = anim.flash;
    for (const o of entry.owned) {
      if (!o.emissive) continue;
      o.mat.emissive.copy(o.emissive).lerp(WHITE, f * 0.85);
      o.mat.emissiveIntensity = o.intensity + f * 1.4;
    }
    entry.flashing = f > 0;
  }

  // Doll limbs: arms and legs swing opposite each other; arms fling up in the air.
  const air = grounded ? 0 : 1;
  const swing = Math.sin(anim.walk) * 0.7 * move;
  parts.legs[0].rotation.x = swing * (1 - air) + air * -0.35;
  parts.legs[1].rotation.x = -swing * (1 - air) + air * 0.25;
  parts.arms.forEach((arm, i) => {
    const s = i === 0 ? 1 : -1;
    arm.rotation.x = (i === 0 ? -swing : swing) * 0.8 + Math.sin(t * 1.8 + entry.seed + i) * 0.04;
    arm.rotation.z += (s * (0.15 + air * 1.1) - arm.rotation.z) * k(10);
  });
  parts.head.rotation.z = Math.sin(t * 1.1 + entry.seed) * 0.04 + Math.sin(anim.walk) * 0.04 * move;
  parts.head.rotation.x = -move * 0.06;
  if (type === 'cody') {
    // Clay wobbles a beat behind the rest of him.
    anim.jiggle = (anim.jiggle ?? 0) + dt;
    const jig = Math.sin(anim.jiggle * 15) * anim.land * 0.1 + Math.sin(t * 2.3 + entry.seed) * 0.01;
    parts.body.scale.set(1.05 + jig, 0.95 - jig * 0.8, 0.95 + jig);
  }

  // Blob shadow: stays on the floor, shrinks and fades with height.
  if (entry.shadow) {
    const p = entry.root.position;
    const floor = state.floorY ?? 0;
    const h = p.y - floor;
    const visible = state.alive && state.floorY !== null && state.floorY !== undefined && h < 7;
    entry.shadow.visible = visible;
    if (visible) {
      entry.shadow.position.set(p.x, floor + 0.012, p.z);
      const s = THREE.MathUtils.clamp(1 - Math.max(0, h) * 0.12, 0.35, 1);
      entry.shadow.scale.setScalar(s);
      entry.shadow.material.opacity = 0.5 * s;
    }
  }
}
