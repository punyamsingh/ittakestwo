import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CREATURE_TYPES } from '@shared/constants.js';
import { textures, labelTexture } from './textures.js';

export const CREATURES = {
  dragon: { label: 'Dragon', blurb: 'Fiery & flappy' },
  golem: { label: 'Golem', blurb: 'Solid as a rock' },
  slime: { label: 'Slime', blurb: 'Bouncy & gooey' },
  robot: { label: 'Robot', blurb: 'Hover-powered' },
  cat: { label: 'Persian', blurb: 'Big, fluffy & unbothered' },
};

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

function dragon(pal, mats) {
  const skin = mats(new THREE.MeshStandardMaterial({ color: pal.base, roughness: 0.5 }));
  const belly = mats(new THREE.MeshStandardMaterial({ color: pal.pale, roughness: 0.6 }));
  const dark = mats(new THREE.MeshStandardMaterial({ color: pal.dark, roughness: 0.5 }));
  const horn = mats(new THREE.MeshStandardMaterial({ color: '#fff0d8', roughness: 0.4 }));
  const wingMat = mats(new THREE.MeshStandardMaterial({ color: pal.light, roughness: 0.55, side: THREE.DoubleSide }));

  const g = new THREE.Group();
  const body = mesh(new THREE.SphereGeometry(0.48, 28, 20), skin, 0, 0.5, 0);
  body.scale.set(1, 0.92, 1.02);
  const tummy = mesh(new THREE.SphereGeometry(0.36, 24, 16), belly, 0, 0.44, 0.24);
  tummy.scale.set(0.95, 0.9, 0.6);
  g.add(body, tummy);

  const head = new THREE.Group();
  head.position.set(0, 1.0, 0.06);
  const skull = mesh(new THREE.SphereGeometry(0.4, 28, 20), skin);
  skull.scale.set(1.05, 0.95, 1);
  const snout = mesh(new THREE.SphereGeometry(0.22, 20, 14), skin, 0, -0.13, 0.27);
  snout.scale.set(0.95, 0.66, 1.05);
  const nostrils = [0.065, -0.065].map((x) => {
    const n = mesh(new THREE.SphereGeometry(0.018, 8, 6), dark, x, -0.08, 0.5);
    n.scale.set(1.4, 0.7, 0.6);
    return n;
  });
  const eyes = makeEyes(0.125, 0.165);
  eyes.position.set(0, 0.08, 0.27);
  const horns = [1, -1].map((s) => {
    const h = mesh(new THREE.ConeGeometry(0.07, 0.28, 10), horn, s * 0.21, 0.32, -0.1);
    h.rotation.set(-0.55, 0, -s * 0.28);
    return h;
  });
  head.add(skull, snout, ...nostrils, eyes, ...horns, blush(0.27, -0.07, 0.24), blush(-0.27, -0.07, 0.24));
  g.add(head);

  const spikes = [
    [0, 0.93, -0.28],
    [0, 0.76, -0.43],
    [0, 0.55, -0.5],
  ].map(([x, y, z], i) => {
    const s = mesh(new THREE.ConeGeometry(0.075 - i * 0.012, 0.18, 8), dark, x, y, z);
    s.rotation.x = -0.7;
    return s;
  });
  g.add(...spikes);

  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0);
  wingShape.quadraticCurveTo(0.28, 0.46, 0.78, 0.52);
  wingShape.quadraticCurveTo(0.64, 0.3, 0.72, 0.14);
  wingShape.quadraticCurveTo(0.52, 0.12, 0.54, -0.04);
  wingShape.quadraticCurveTo(0.3, -0.02, 0, 0);
  const wingGeo = new THREE.ShapeGeometry(wingShape, 10);
  const wings = [1, -1].map((s) => {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.28, 0.74, -0.22);
    pivot.rotation.y = s * 0.55;
    pivot.scale.x = s;
    pivot.add(mesh(wingGeo, wingMat));
    g.add(pivot);
    return pivot;
  });

  const tail = new THREE.Group();
  tail.position.set(0, 0.34, -0.38);
  [
    [0.19, 0, 0, -0.08],
    [0.14, 0, 0.05, -0.32],
    [0.1, 0, 0.14, -0.52],
  ].forEach(([r, x, y, z]) => tail.add(mesh(new THREE.SphereGeometry(r, 14, 10), skin, x, y, z)));
  const spade = mesh(new THREE.ConeGeometry(0.12, 0.22, 4), dark, 0, 0.24, -0.66);
  spade.rotation.x = -1.1;
  spade.scale.z = 0.35;
  tail.add(spade);
  g.add(tail);

  [1, -1].forEach((s) => {
    const foot = mesh(new THREE.SphereGeometry(0.15, 14, 10), dark, s * 0.22, 0.07, 0.1);
    foot.scale.set(1, 0.55, 1.3);
    g.add(foot, mesh(new THREE.SphereGeometry(0.11, 12, 10), skin, s * 0.36, 0.52, 0.24));
  });

  return { group: g, height: 1.45, parts: { head, eyes, wings, tail } };
}

function golem(pal, mats) {
  const stoneColor = new THREE.Color('#8b8594').lerp(pal.base, 0.5);
  const stone = mats(new THREE.MeshStandardMaterial({ color: stoneColor, roughness: 0.9, flatShading: true }));
  const stoneDark = mats(new THREE.MeshStandardMaterial({ color: stoneColor.clone().lerp(BLACK, 0.25), roughness: 0.95, flatShading: true }));
  const rune = mats(new THREE.MeshStandardMaterial({ color: pal.pale, emissive: pal.glow, emissiveIntensity: 2.4, roughness: 0.4 }));
  const moss = mats(new THREE.MeshStandardMaterial({ color: '#6aa35a', roughness: 1, flatShading: true }));

  const g = new THREE.Group();
  const body = mesh(new THREE.DodecahedronGeometry(0.55, 0), stone, 0, 0.64, 0);
  body.scale.set(1.05, 0.95, 0.9);
  const chest = mesh(new THREE.TorusGeometry(0.13, 0.035, 6, 20), rune, 0, 0.72, 0.46);
  const gem = mesh(new THREE.OctahedronGeometry(0.07, 0), rune, 0, 0.72, 0.47);
  g.add(body, chest, gem);

  const head = new THREE.Group();
  head.position.set(0, 1.2, 0.04);
  const skull = mesh(new THREE.DodecahedronGeometry(0.3, 0), stone);
  skull.scale.set(1.05, 0.85, 0.95);
  const brow = mesh(new RoundedBoxGeometry(0.4, 0.08, 0.12, 2, 0.03), stoneDark, 0, 0.08, 0.2);
  const eyes = new THREE.Group();
  [1, -1].forEach((s) => eyes.add(mesh(new RoundedBoxGeometry(0.11, 0.05, 0.05, 2, 0.02), rune, s * 0.11, 0.01, 0.26)));
  const tuft = mesh(new THREE.IcosahedronGeometry(0.14, 0), moss, 0.06, 0.24, -0.02);
  tuft.scale.set(1.2, 0.5, 1);
  head.add(skull, brow, eyes, tuft);
  g.add(head);

  const arms = [1, -1].map((s) => {
    const arm = new THREE.Group();
    arm.position.set(s * 0.56, 0.92, 0);
    arm.add(mesh(new THREE.DodecahedronGeometry(0.19, 0), stoneDark));
    const upper = mesh(new THREE.CapsuleGeometry(0.1, 0.24, 4, 8), stone, s * 0.06, -0.26, 0.04);
    const fist = mesh(new THREE.DodecahedronGeometry(0.22, 0), stone, s * 0.1, -0.5, 0.08);
    arm.add(upper, fist);
    g.add(arm);
    return arm;
  });

  [1, -1].forEach((s) => g.add(mesh(new RoundedBoxGeometry(0.26, 0.24, 0.3, 2, 0.06), stoneDark, s * 0.24, 0.12, 0)));

  const orbit = new THREE.Group();
  orbit.position.y = 0.95;
  const stones = [0, 1, 2].map((i) => {
    const s = mesh(new THREE.DodecahedronGeometry(0.085, 0), rune);
    s.userData.phase = (i / 3) * Math.PI * 2;
    orbit.add(s);
    return s;
  });
  g.add(orbit);

  return { group: g, height: 1.55, parts: { head, eyes, arms, orbit, stones, rune } };
}

function slime(pal, mats) {
  const jelly = mats(
    new THREE.MeshPhysicalMaterial({
      color: pal.base,
      roughness: 0.15,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      sheen: 0.6,
      sheenColor: pal.pale,
      emissive: pal.base,
      emissiveIntensity: 0.18,
      transparent: true,
      opacity: 0.9,
    })
  );
  const core = mats(new THREE.MeshStandardMaterial({ color: pal.pale, emissive: pal.glow, emissiveIntensity: 2.2 }));
  const mouthMat = mats(new THREE.MeshStandardMaterial({ color: '#2a1030', roughness: 0.4 }));

  const geo = new THREE.SphereGeometry(0.6, 36, 26);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y < 0) p.setY(i, y * 0.42);
  }
  geo.computeVertexNormals();

  const g = new THREE.Group();
  const bodyPivot = new THREE.Group();
  const body = mesh(geo, jelly, 0, 0.252, 0);
  body.scale.set(1, 0.95, 1);
  body.renderOrder = 1;
  const curl = mesh(new THREE.ConeGeometry(0.11, 0.3, 14), jelly, 0.02, 0.9, -0.06);
  curl.rotation.set(-0.35, 0, -0.2);
  const heart = mesh(new THREE.IcosahedronGeometry(0.14, 1), core, 0, 0.36, -0.05);
  const eyes = makeEyes(0.13, 0.18, 0.12);
  eyes.position.set(0, 0.52, 0.47);
  const mouth = mesh(new THREE.TorusGeometry(0.07, 0.02, 8, 16, Math.PI), mouthMat, 0, 0.36, 0.555);
  mouth.rotation.z = Math.PI;
  bodyPivot.add(body, curl, heart, eyes, mouth, blush(0.3, 0.4, 0.46, 0.07), blush(-0.3, 0.4, 0.46, 0.07));
  g.add(bodyPivot);

  return { group: g, height: 1.15, parts: { bodyPivot, eyes, heart, curl } };
}

function robot(pal, mats) {
  const shell = mats(new THREE.MeshStandardMaterial({ color: pal.base, roughness: 0.3, metalness: 0.45 }));
  const trim = mats(new THREE.MeshStandardMaterial({ color: '#e9e4f2', roughness: 0.35, metalness: 0.3 }));
  const screen = mats(new THREE.MeshStandardMaterial({ color: '#141022', roughness: 0.18, metalness: 0.2 }));
  const glow = mats(new THREE.MeshStandardMaterial({ color: '#d9fbff', emissive: '#4fdcff', emissiveIntensity: 2.8 }));
  const accent = mats(new THREE.MeshStandardMaterial({ color: pal.pale, emissive: pal.glow, emissiveIntensity: 2.2 }));

  const g = new THREE.Group();
  const hover = new THREE.Group();
  g.add(hover);

  const thruster = mesh(new THREE.TorusGeometry(0.26, 0.05, 10, 32), accent, 0, 0.16, 0);
  thruster.rotation.x = Math.PI / 2;
  const flame = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: textures().glow, color: pal.glow, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  flame.position.y = 0.06;
  flame.scale.set(0.7, 0.35, 1);
  hover.add(thruster, flame);

  hover.add(mesh(new RoundedBoxGeometry(0.74, 0.56, 0.56, 3, 0.15), shell, 0, 0.56, 0));
  hover.add(mesh(new RoundedBoxGeometry(0.42, 0.26, 0.04, 2, 0.04), screen, 0, 0.56, 0.285));
  ['#ff5d6c', '#ffc94d', '#6be39a'].forEach((c, i) => {
    const m = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 2 });
    mats(m);
    hover.add(mesh(new THREE.SphereGeometry(0.035, 10, 8), m, (i - 1) * 0.11, 0.56, 0.31));
  });
  hover.add(mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.12, 12), trim, 0, 0.88, 0));

  const head = new THREE.Group();
  head.position.y = 1.16;
  head.add(mesh(new RoundedBoxGeometry(0.68, 0.5, 0.52, 3, 0.15), shell));
  head.add(mesh(new RoundedBoxGeometry(0.52, 0.32, 0.04, 2, 0.07), screen, 0, 0, 0.26));
  const eyes = new THREE.Group();
  [1, -1].forEach((s) => eyes.add(mesh(new RoundedBoxGeometry(0.1, 0.15, 0.03, 2, 0.045), glow, s * 0.12, 0.01, 0.285)));
  head.add(eyes);
  [1, -1].forEach((s) => {
    const ear = mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.1, 14), trim, s * 0.37, 0, 0);
    ear.rotation.z = Math.PI / 2;
    head.add(ear, mesh(new THREE.SphereGeometry(0.04, 8, 6), accent, s * 0.43, 0, 0));
  });
  head.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.26, 6), trim, 0, 0.37, 0));
  const antenna = mesh(new THREE.SphereGeometry(0.065, 12, 10), accent, 0, 0.52, 0);
  head.add(antenna);
  hover.add(head);

  const arms = [1, -1].map((s) => {
    const arm = new THREE.Group();
    arm.position.set(s * 0.42, 0.72, 0);
    const limb = mesh(new THREE.CapsuleGeometry(0.06, 0.2, 4, 8), trim, s * 0.04, -0.14, 0);
    const hand = mesh(new THREE.SphereGeometry(0.09, 12, 10), shell, s * 0.07, -0.3, 0.02);
    arm.add(limb, hand);
    arm.rotation.z = s * 0.25;
    hover.add(arm);
    return arm;
  });

  return { group: g, height: 1.8, parts: { hover, head, eyes, antenna, arms, flame, thruster } };
}

// Sphere with a tufted surface, so fur reads as fur rather than plastic.
function fluffGeo(r, amp = 0.06, freq = 9, seed = 0) {
  const src = new THREE.SphereGeometry(r, 40, 30);
  src.deleteAttribute('uv');
  src.deleteAttribute('normal');
  const geo = mergeVertices(src);
  src.dispose();
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const f =
      Math.sin(v.x * freq + seed) * Math.sin(v.y * freq * 0.9 - seed * 0.7) * Math.sin(v.z * freq * 1.1 + seed * 1.3) +
      0.5 * Math.sin(v.x * freq * 2.1 - v.z * freq * 1.7 + seed);
    v.multiplyScalar(r * (1 + amp * f));
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

function cat(pal, mats) {
  const furColor = pal.base.clone().lerp(new THREE.Color('#fff4e8'), 0.22);
  const furMat = (color) =>
    mats(new THREE.MeshPhysicalMaterial({ color, roughness: 0.9, sheen: 1, sheenRoughness: 0.55, sheenColor: new THREE.Color('#ffffff') }));
  const fur = furMat(furColor);
  const cream = furMat(pal.pale);
  const deep = furMat(furColor.clone().lerp(BLACK, 0.18));
  const pink = mats(new THREE.MeshStandardMaterial({ color: '#ff9fb4', roughness: 0.5 }));
  const nose = mats(new THREE.MeshStandardMaterial({ color: '#f07a94', roughness: 0.3 }));
  const mouthMat = mats(new THREE.MeshStandardMaterial({ color: '#3a1a2a', roughness: 0.5 }));
  const whisker = mats(new THREE.MeshStandardMaterial({ color: '#fffaf2', roughness: 0.4 }));

  const g = new THREE.Group();

  // The belly: very wide, very round, very proud of itself.
  const belly = new THREE.Group();
  belly.position.y = 0.5;
  const body = mesh(fluffGeo(0.56, 0.045, 8, 1), fur);
  body.scale.set(1.22, 0.9, 1.1);
  const tummy = mesh(fluffGeo(0.4, 0.05, 10, 2), cream, 0, -0.06, 0.3);
  tummy.scale.set(1.05, 0.95, 0.62);
  // Fur clumps break up the silhouette so the outline reads as floof.
  const clumps = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    if (Math.cos(a) > 0.55) continue; // keep the tummy smooth and clean
    const y = i % 2 ? 0.14 : -0.1;
    // Sit each clump on the belly's surface, mostly sunk in, so only its edge breaks the outline.
    const d = new THREE.Vector3(Math.sin(a) * 0.68, y, Math.cos(a) * 0.62);
    d.multiplyScalar(0.84 / Math.hypot(d.x / 0.68, d.y / 0.5, d.z / 0.62));
    const c = mesh(fluffGeo(0.17, 0.07, 7, i * 1.7), fur, d.x, d.y, d.z);
    c.scale.set(1, 0.8, 1);
    clumps.push(c);
  }
  belly.add(body, tummy, ...clumps);
  g.add(belly);

  // Lion's-mane ruff around the neck, the Persian signature.
  const ruff = mesh(fluffGeo(0.4, 0.09, 11, 3), cream, 0, 0.84, 0.02);
  ruff.scale.set(1.28, 0.5, 1.05);
  g.add(ruff);

  const head = new THREE.Group();
  head.position.set(0, 1.2, 0.12);
  const skull = mesh(fluffGeo(0.44, 0.05, 9, 4), fur);
  skull.scale.set(1.18, 0.92, 0.92);
  const cheeks = [1, -1].map((s) => {
    const c = mesh(fluffGeo(0.19, 0.07, 8, 5 + s), cream, s * 0.32, -0.16, 0.1);
    c.scale.set(1, 0.85, 0.9);
    return c;
  });

  // Flat face: big eyes set wide, a tiny nose pushed right up between them.
  const eyes = makeEyes(0.145, 0.185, 0.22);
  eyes.position.set(0, 0.05, 0.32);
  const lidGeo = new THREE.SphereGeometry(0.156, 18, 8, 0, Math.PI * 2, 0, Math.PI * 0.4);
  for (const eye of eyes.children) {
    const lid = mesh(lidGeo, fur);
    lid.rotation.x = -0.12; // lids resting on top: a content, sleepy-sweet look
    eye.add(lid);
  }
  const noseMesh = mesh(new THREE.SphereGeometry(0.045, 12, 8), nose, 0, -0.07, 0.42);
  noseMesh.scale.set(1.3, 0.75, 0.6);
  const pads = [1, -1].map((s) => {
    const m = mesh(new THREE.SphereGeometry(0.08, 14, 10), cream, s * 0.066, -0.15, 0.37);
    m.scale.set(1, 0.8, 0.7);
    return m;
  });
  const mouth = mesh(new THREE.TorusGeometry(0.03, 0.009, 6, 12, Math.PI), mouthMat, 0, -0.19, 0.415);
  mouth.rotation.z = Math.PI;
  const whiskerGeo = new THREE.CylinderGeometry(0.005, 0.003, 0.34, 4);
  whiskerGeo.rotateZ(Math.PI / 2);
  whiskerGeo.translate(0.17, 0, 0);
  const whiskers = [];
  [1, -1].forEach((s) => {
    [0.14, 0, -0.14].forEach((tilt, i) => {
      const w = mesh(whiskerGeo, whisker, s * 0.1, -0.14 - i * 0.024, 0.4);
      w.scale.x = s;
      w.rotation.set(0, s * 0.35, s * tilt);
      whiskers.push(w);
    });
  });

  // Small, low-set ears tipped forward, with fluffy pink insides.
  const ears = [1, -1].map((s) => {
    const ear = new THREE.Group();
    ear.position.set(s * 0.29, 0.28, 0.0);
    ear.rotation.set(0.3, 0, -s * 0.6);
    const outer = mesh(new THREE.ConeGeometry(0.13, 0.24, 12), fur, 0, 0.08, 0);
    const inner = mesh(new THREE.ConeGeometry(0.08, 0.16, 10), pink, 0, 0.06, 0.045);
    const tuft = mesh(fluffGeo(0.05, 0.2, 14, s), cream, 0, 0.02, 0.075);
    ear.add(outer, inner, tuft);
    ear.userData.baseZ = ear.rotation.z;
    return ear;
  });
  const crown = [
    [0, 0.4, 0.04, 0.09],
    [0.08, 0.37, 0.0, 0.07],
    [-0.08, 0.37, 0.0, 0.07],
  ].map(([x, y, z, r], i) => mesh(fluffGeo(r, 0.16, 12, i + 9), fur, x, y, z));
  head.add(skull, ...cheeks, ...crown, eyes, noseMesh, ...pads, mouth, ...whiskers, ...ears, blush(0.27, -0.1, 0.33, 0.075), blush(-0.27, -0.1, 0.33, 0.075));
  g.add(head);

  // Stubby paws peeking out from under all that floof.
  const paws = [
    [0.24, 0.34],
    [-0.24, 0.34],
    [0.38, -0.22],
    [-0.38, -0.22],
  ].map(([x, z]) => {
    const p = mesh(fluffGeo(0.12, 0.06, 12, x + z), cream, x, 0.07, z);
    p.scale.set(1, 0.6, 1.25);
    g.add(p);
    return p;
  });

  // Plume tail: a chain of fluff that sweeps back and curls up.
  const tail = new THREE.Group();
  tail.position.set(0, 0.32, -0.55);
  [
    [0.15, 0, 0, 0],
    [0.17, 0, 0.1, -0.2],
    [0.17, 0, 0.3, -0.3],
    [0.14, 0, 0.5, -0.28],
    [0.1, 0, 0.64, -0.18],
  ].forEach(([r, x, y, z], i) => tail.add(mesh(fluffGeo(r, 0.08, 8, i * 2.3), i === 4 ? cream : deep, x, y, z)));
  g.add(tail);

  return { group: g, height: 1.65, parts: { head, eyes, belly, ruff, ears, tail, paws } };
}

const BUILDERS = { dragon, golem, slime, robot, cat };

// ---------- entry + animation ----------

export function buildCreature(avatar) {
  const type = CREATURE_TYPES.includes(avatar?.type) ? avatar.type : 'dragon';
  const pal = palette(avatar?.color || '#ff5d5d');
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

  const air = grounded ? 0 : 1;
  if (type === 'dragon') {
    const flap = Math.sin(t * (air ? 18 : 6) + entry.seed) * (air ? 0.7 : 0.25);
    parts.wings[0].rotation.z = 0.25 + flap;
    parts.wings[1].rotation.z = 0.25 + flap;
    parts.tail.rotation.y = Math.sin(t * 3 + entry.seed) * 0.4 + Math.sin(anim.walk) * 0.2;
    parts.head.rotation.x = Math.sin(t * 1.7 + entry.seed) * 0.05 - move * 0.08;
  } else if (type === 'golem') {
    parts.orbit.rotation.y = t * 1.4;
    parts.stones.forEach((s) => {
      const a = s.userData.phase;
      s.position.set(Math.cos(a) * 0.82, Math.sin(t * 2.4 + a * 2) * 0.12, Math.sin(a) * 0.82);
      s.rotation.x += dt * 2;
    });
    parts.rune.emissiveIntensity = 2.4 + Math.sin(t * 3.5) * 0.6 + anim.flash * 1.4;
    parts.arms[0].rotation.x = Math.sin(anim.walk) * 0.5 * move + Math.sin(t * 1.5) * 0.05;
    parts.arms[1].rotation.x = -Math.sin(anim.walk) * 0.5 * move + Math.sin(t * 1.5 + 1) * 0.05;
    parts.head.rotation.y = Math.sin(t * 0.7 + entry.seed) * 0.15;
  } else if (type === 'slime') {
    const wob = Math.sin(t * 3.2 + entry.seed) * 0.05 + Math.sin(anim.walk * 2) * 0.06 * move;
    parts.bodyPivot.scale.set(1 - wob * 0.5, 1 + wob, 1 - wob * 0.5);
    parts.heart.rotation.y += dt * 1.5;
    parts.heart.position.y = 0.36 + Math.sin(t * 2.6) * 0.03;
    parts.curl.rotation.z = -0.2 + Math.sin(t * 4 + entry.seed) * 0.15;
  } else if (type === 'robot') {
    parts.hover.position.y = 0.08 + Math.sin(t * 3 + entry.seed) * 0.05;
    parts.head.rotation.y = Math.sin(t * 1.1 + entry.seed) * 0.18;
    parts.antenna.position.y = 0.52 + Math.sin(t * 6) * 0.015;
    parts.flame.scale.set(0.7 + Math.sin(t * 30) * 0.06, 0.35 + air * 0.3, 1);
    parts.thruster.rotation.z += dt * 3;
    parts.arms[0].rotation.x = Math.sin(anim.walk) * 0.6 * move;
    parts.arms[1].rotation.x = -Math.sin(anim.walk) * 0.6 * move;
  } else if (type === 'cat') {
    // Belly jiggle lags behind the body: a ripple on landing and a waddle when walking.
    anim.jiggle = (anim.jiggle ?? 0) + dt;
    const jig = Math.sin(anim.jiggle * 16) * anim.land * 0.12 + Math.sin(anim.walk * 2) * 0.035 * move + Math.sin(t * 2.3 + entry.seed) * 0.012;
    parts.belly.scale.set(1 + jig, 1 - jig * 0.8, 1 + jig);
    parts.ruff.position.y = 0.84 - jig * 0.25;
    parts.tail.rotation.y = Math.sin(t * 1.6 + entry.seed) * 0.45 + Math.sin(anim.walk) * 0.2;
    parts.tail.rotation.x = air * -0.35 + Math.sin(t * 1.1 + entry.seed) * 0.06;
    parts.head.rotation.z = Math.sin(t * 0.9 + entry.seed) * 0.06 + Math.sin(anim.walk) * 0.05 * move;
    parts.head.rotation.x = -move * 0.06;
    parts.paws.forEach((p, i) => {
      p.position.y = 0.07 + Math.max(0, Math.sin(anim.walk + (i % 3 === 0 ? 0 : Math.PI))) * 0.06 * move;
    });
    // The occasional ear flick.
    anim.flickAt = (anim.flickAt ?? 1 + Math.random() * 3) - dt;
    if (anim.flickAt <= 0) {
      anim.flick = 1;
      anim.flickEar = Math.random() < 0.5 ? 0 : 1;
      anim.flickAt = 2.5 + Math.random() * 4;
    }
    anim.flick = Math.max(0, (anim.flick ?? 0) - dt * 5);
    parts.ears.forEach((ear, i) => {
      const f = i === anim.flickEar ? Math.sin(anim.flick * Math.PI) * 0.45 : 0;
      ear.rotation.z = ear.userData.baseZ + (i === 0 ? -f : f);
    });
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
