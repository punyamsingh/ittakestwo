import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { levelTextures, runeTexture, textures } from './textures.js';

function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

let mats = null;
function materials() {
  if (mats) return mats;
  const tex = levelTextures();
  mats = {
    // Paint tins (round "stone" platforms) and the wood under everything else.
    tin: new THREE.MeshStandardMaterial({ color: '#b9b4ab', roughness: 0.35, metalness: 0.6 }),
    tinLabel: new THREE.MeshStandardMaterial({ color: '#3f7fd8', roughness: 0.7 }),
    woodDark: new THREE.MeshStandardMaterial({ color: '#6e4426', roughness: 0.85 }),
    bench: new THREE.MeshStandardMaterial({ color: '#9a6538', roughness: 0.8 }),
    pages: new THREE.MeshStandardMaterial({ color: '#f1e4c8', roughness: 0.9 }),
    shelf: new THREE.MeshStandardMaterial({ color: '#d2a774', roughness: 0.75 }),
    metal: new THREE.MeshStandardMaterial({ color: '#7d8590', roughness: 0.35, metalness: 0.65 }),
    gold: new THREE.MeshStandardMaterial({ color: '#e8c060', roughness: 0.35, metalness: 0.8 }),
    trim: new THREE.MeshStandardMaterial({ color: '#2d2a26', roughness: 0.6 }),
    hazard: new THREE.MeshStandardMaterial({ color: '#f2c94c', emissive: '#f2a93c', emissiveIntensity: 0.35, roughness: 0.6 }),
    cardboardBody: new THREE.MeshStandardMaterial({ color: '#b5864f', roughness: 0.95 }),
    grassTop: tex.grass,
    tinTop: tex.sand,
    bookTop: tex.book,
    marbleTop: tex.marble,
    crumbleTop: tex.crumble,
  };
  for (const m of Object.values(mats)) if (m.isMaterial) m.userData.shared = true;
  return mats;
}

const BOOK_COLORS = ['#c8323c', '#2f6a8f', '#3f7a4a', '#7a3f8f', '#d98a2b'];
const TIN_COLORS = ['#3f7fd8', '#e0563f', '#f2c94c', '#4f9e3f', '#d9578f'];

function topMaterial(map, w, d, scale = 2) {
  const t = map.clone();
  t.needsUpdate = true;
  t.repeat.set(Math.max(1, w / scale), Math.max(1, d / scale));
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 });
}

// Workbenches, shelves and crates stand on long legs down to the shed floor.
function tableLegs(width, depth, material) {
  const g = new THREE.Group();
  const len = 34;
  const geo = new THREE.BoxGeometry(0.45, len, 0.45);
  const ix = width / 2 - 0.5;
  const iz = depth / 2 - 0.5;
  for (const [x, z] of [[ix, iz], [-ix, iz], [ix, -iz], [-ix, -iz]]) {
    const leg = new THREE.Mesh(geo, material);
    leg.position.set(x, -len / 2, z);
    g.add(leg);
  }
  // A cross-brace a little way down, like a real bench.
  const brace = new THREE.Mesh(new THREE.BoxGeometry(width - 1, 0.3, 0.25), material);
  brace.position.set(0, -3.2, iz);
  const brace2 = brace.clone();
  brace2.position.z = -iz;
  g.add(brace, brace2);
  return g;
}

/**
 * Builds a platform with its top surface at local y = 0.
 * Returns { group, solid } — `solid` is the mesh used for ground raycasts.
 */
export function buildPlatform(def, { plateColor } = {}) {
  const M = materials();
  const group = new THREE.Group();
  const seed = hash(def.pos[0] * 13 + def.pos[2] * 7) * 1000;
  const isDisc = def.kind === 'disc';
  const w = isDisc ? def.radius * 2 : def.size[0];
  const d = isDisc ? def.radius * 2 : def.size[2];
  const h = isDisc ? def.height : def.size[1];

  const bodyGeo = isDisc ? new THREE.CylinderGeometry(def.radius, def.radius * 0.9, h, 11) : new RoundedBoxGeometry(w, h, d, 2, Math.min(0.28, w / 4, h / 4, d / 4));
  let capThick = 0;
  const capGeo = (thick, grow = 0.12) => {
    capThick = thick;
    return isDisc ? new THREE.CylinderGeometry(def.radius + grow / 2, def.radius + grow / 2, thick, 40) : new RoundedBoxGeometry(w + grow, thick, d + grow, 2, Math.min(0.1, thick / 2));
  };

  let bodyMat = M.bench;
  let top = null;
  switch (def.style) {
    case 'grass':
      // A workbench top.
      bodyMat = M.bench;
      top = new THREE.Mesh(capGeo(0.3), topMaterial(M.grassTop, w, d, 3));
      break;
    case 'stone':
      if (isDisc) {
        // A paint tin: metal lid on a labelled can.
        bodyMat = M.tin;
        top = new THREE.Mesh(capGeo(0.16, 0.1), topMaterial(M.tinTop, w, d, w));
      } else {
        // A stack of old hardcover books.
        bodyMat = M.pages;
        const cover = topMaterial(M.bookTop, w, d, Math.max(w, d));
        cover.color.set(BOOK_COLORS[Math.floor(seed) % BOOK_COLORS.length]);
        top = new THREE.Mesh(capGeo(0.24, 0.22), cover);
      }
      break;
    case 'ruin':
      // A pale pine shelf or ruler.
      bodyMat = M.shelf;
      top = new THREE.Mesh(capGeo(0.18, 0.06), topMaterial(M.marbleTop, w, d, 2.5));
      break;
    case 'crumble':
      bodyMat = M.cardboardBody;
      top = new THREE.Mesh(capGeo(0.14, 0.04), topMaterial(M.crumbleTop, w, d, 3));
      break;
    case 'metal':
    case 'gate':
      bodyMat = M.metal;
      break;
    case 'arena':
      bodyMat = null;
      break;
  }

  const body = new THREE.Mesh(bodyGeo, bodyMat ?? M.metal);
  body.position.y = -h / 2;
  body.castShadow = def.style !== 'arena';
  body.receiveShadow = true;
  body.visible = def.style !== 'arena';
  group.add(body);

  if (top) {
    // (RoundedBoxGeometry reports unit parameters, so track the thickness ourselves.)
    top.position.y = -capThick / 2 + 0.03;
    top.receiveShadow = true;
    group.add(top);
  }

  if (def.style === 'stone' && isDisc) {
    // The tin's paper label.
    const label = new THREE.Mesh(
      new THREE.CylinderGeometry(def.radius * 0.955 + 0.02, def.radius * 0.92 + 0.02, h * 0.55, 40, 1, true),
      M.tinLabel.clone()
    );
    label.material.userData = {};
    label.material.color.set(TIN_COLORS[Math.floor(seed) % TIN_COLORS.length]);
    label.position.y = -h / 2;
    group.add(label);
  }
  if (def.style === 'stone' && !isDisc) {
    // Each book in the stack gets its own coloured cover band.
    const books = Math.max(1, Math.round(h / 0.9));
    for (let i = 1; i < books; i++) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, 0.12, d + 0.12), M.trim.clone());
      band.material.userData = {};
      band.material.color.set(BOOK_COLORS[(Math.floor(seed) + i) % BOOK_COLORS.length]);
      band.position.set((hash(seed + i) - 0.5) * 0.3, -(i * h) / books, (hash(seed - i) - 0.5) * 0.3);
      group.add(band);
    }
  }

  if (def.style === 'metal') {
    // A steel tray with yellow hazard edging.
    const strip = (sx, sz, x, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.07, sz), M.hazard);
      m.position.set(x, 0.01, z);
      group.add(m);
    };
    strip(w - 0.2, 0.12, 0, d / 2 - 0.12);
    strip(w - 0.2, 0.12, 0, -d / 2 + 0.12);
    strip(0.12, d - 0.2, w / 2 - 0.12, 0);
    strip(0.12, d - 0.2, -w / 2 + 0.12, 0);
    if (plateColor) {
      const rune = new THREE.Mesh(
        new THREE.PlaneGeometry(Math.min(w, d) * 0.7, Math.min(w, d) * 0.7),
        new THREE.MeshBasicMaterial({ map: runeTexture(plateColor), transparent: true, opacity: 0.85, depthWrite: false })
      );
      rune.rotation.x = -Math.PI / 2;
      rune.position.y = 0.02;
      group.add(rune);
      group.userData.rune = rune;
    }
  }

  if (def.style === 'gate') {
    for (let i = -2; i <= 2; i++) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, h * 0.9, 10), M.shelf);
      bar.position.set((i * w) / 5.5, -h / 2, 0);
      group.add(bar);
    }
    const glyph = new THREE.Mesh(
      new THREE.CircleGeometry(Math.min(w, h) * 0.3, 32),
      new THREE.MeshStandardMaterial({ color: plateColor ?? '#ff5d6c', emissive: plateColor ?? '#ff5d6c', emissiveIntensity: 2.2 })
    );
    glyph.position.set(0, -h / 2, d / 2 + 0.06);
    group.add(glyph);
  }

  const standing = ['grass', 'stone', 'ruin'].includes(def.style) && !isDisc && h >= 2.4 && !def.move && !def.wall;
  if (standing) {
    const legs = tableLegs(w, d, def.style === 'stone' ? M.woodDark : M.bench);
    legs.position.y = -h;
    group.add(legs);
  }
  if (isDisc && def.style === 'stone' && !def.move) {
    // Paint tins sit on a tall stack of crates down to the floor.
    const post = new THREE.Mesh(new THREE.CylinderGeometry(def.radius * 0.75, def.radius * 0.75, 34, 16), M.woodDark);
    post.position.y = -h - 17;
    group.add(post);
  }

  group.position.set(...def.pos);
  return { group, solid: body, height: h };
}

// ---------- props ----------

const propMat = {};
function pm(key, make) {
  if (!propMat[key]) {
    propMat[key] = make();
    propMat[key].userData.shared = true;
  }
  return propMat[key];
}

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...extra });

function shadowed(...meshes) {
  for (const m of meshes) m.castShadow = true;
  return meshes;
}

// Household odds and ends at doll scale.
export function buildDecor({ kind, pos, scale = 1, rotY }) {
  const g = new THREE.Group();
  const seed = hash(pos[0] * 3 + pos[2] * 11);
  switch (kind) {
    case 'plant': {
      // One of Cody's seedlings in a terracotta pot.
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.36, 0.7, 16), pm('terracotta', () => std('#c8653a', { roughness: 0.9 })));
      pot.position.y = 0.35;
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.16, 16), pm('terracotta', () => std('#c8653a')));
      rim.position.y = 0.72;
      const soil = new THREE.Mesh(new THREE.CircleGeometry(0.48, 16), pm('soil', () => std('#4a2f1e', { roughness: 1 })));
      soil.rotation.x = -Math.PI / 2;
      soil.position.y = 0.79;
      g.add(...shadowed(pot, rim), soil);
      const leaf = pm('leaf', () => std('#5aa04a', { roughness: 0.8, side: THREE.DoubleSide }));
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1, 6), leaf);
      stem.position.y = 1.25;
      g.add(stem);
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.quadraticCurveTo(0.3, 0.25, 0, 0.75);
      shape.quadraticCurveTo(-0.3, 0.25, 0, 0);
      const leafGeo = new THREE.ShapeGeometry(shape, 8);
      for (let i = 0; i < 5; i++) {
        const l = new THREE.Mesh(leafGeo, leaf);
        l.position.y = 0.95 + i * 0.16;
        l.rotation.set(0.9, (i / 5) * Math.PI * 2 + seed * 3, 0);
        l.castShadow = true;
        g.add(l);
      }
      break;
    }
    case 'nut': {
      // A giant hex nut lying on its side.
      const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.42, 6), pm('steel', () => std('#9aa1a8', { metalness: 0.75, roughness: 0.35 })));
      nut.position.y = 0.21;
      const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.44, 16), pm('steelDark', () => std('#3a3d42', { metalness: 0.6, roughness: 0.5 })));
      hole.position.y = 0.21;
      g.add(...shadowed(nut), hole);
      break;
    }
    case 'jar': {
      // A glass jar of buttons.
      const glass = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.42, 1.1, 20),
        pm('glass', () => new THREE.MeshPhysicalMaterial({ color: '#dff1ff', roughness: 0.05, transmission: 0.6, transparent: true, opacity: 0.45, depthWrite: false }))
      );
      glass.position.y = 0.55;
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.14, 20), pm('lidRed', () => std('#c8323c', { metalness: 0.3 })));
      lid.position.y = 1.16;
      g.add(lid);
      const colors = ['#3f7fd8', '#f2c94c', '#d9578f', '#4f9e3f', '#e0563f'];
      for (let i = 0; i < 9; i++) {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.05, 12), pm(`button${i % 5}`, () => std(colors[i % 5], { roughness: 0.4 })));
        b.position.set((hash(seed + i) - 0.5) * 0.5, 0.1 + i * 0.07, (hash(seed - i) - 0.5) * 0.5);
        b.rotation.set(hash(i + seed) * 1.2, 0, hash(i * 3) * 1.2);
        g.add(b);
      }
      g.add(glass);
      break;
    }
    case 'candle': {
      // A stubby candle in a saucer, lit.
      const saucer = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.32, 0.1, 18), pm('enamel', () => std('#f3ede2', { roughness: 0.3 })));
      saucer.position.y = 0.05;
      const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.9, 14), pm('wax', () => std('#fbe9c8', { roughness: 0.6 })));
      wax.position.y = 0.55;
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), pm('flame', () => std('#fff1b0', { emissive: '#ffb347', emissiveIntensity: 3 })));
      flame.scale.y = 1.8;
      flame.position.y = 1.12;
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures().glow, color: '#ffb35c', transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
      halo.position.y = 1.12;
      halo.scale.setScalar(1.3);
      g.add(...shadowed(saucer, wax), flame, halo);
      break;
    }
    case 'spool': {
      // A wooden cotton reel wound with coloured thread.
      const wood = pm('spoolWood', () => std('#d9b07a'));
      const threads = ['#d8314a', '#3f7fd8', '#f2c94c', '#4f9e3f'];
      const thread = pm(`thread${Math.floor(seed * 4)}`, () => std(threads[Math.floor(seed * 4)], { roughness: 0.95 }));
      const bottom = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.16, 20), wood);
      bottom.position.y = 0.08;
      const top = bottom.clone();
      top.position.y = 1.32;
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 1.1, 20), thread);
      core.position.y = 0.7;
      g.add(...shadowed(bottom, top, core));
      break;
    }
    case 'pennant': {
      // Rose's drawing pinned to a pencil.
      const pencil = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3, 6), pm('pencil', () => std('#f2c94c')));
      pencil.position.y = 1.5;
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 6), pm('pencilTip', () => std('#e8c49a')));
      tip.position.y = 3.1;
      const cloth = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1.9, 1, 8),
        pm('bannerCloth', () => new THREE.MeshStandardMaterial({ map: levelTextures().banner, side: THREE.DoubleSide, transparent: true, alphaTest: 0.5, roughness: 0.9 }))
      );
      cloth.position.set(0.55, 1.95, 0);
      g.add(...shadowed(pencil), tip, cloth);
      g.userData.cloth = cloth;
      break;
    }
    case 'blocks': {
      // Rose's old wooden alphabet blocks.
      const colors = ['#c8323c', '#3f7fd8', '#f2c94c'];
      [
        [0, 0.4, 0, 0.8],
        [0.85, 0.4, 0.1, 0.8],
        [0.4, 1.2, 0.05, 0.8],
      ].forEach(([x, y, z, sz], i) => {
        const b = new THREE.Mesh(new RoundedBoxGeometry(sz, sz, sz, 2, 0.06), pm(`block${i}`, () => std(colors[i], { roughness: 0.55 })));
        b.position.set(x - 0.4, y, z);
        b.rotation.y = (hash(seed + i) - 0.5) * 0.5;
        b.castShadow = true;
        g.add(b);
      });
      break;
    }
    case 'pencils': {
      // An archway of two giant pencils and a ruler across the top.
      const body = pm('pencil', () => std('#f2c94c'));
      [-2.4, 2.4].forEach((x) => {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 4.6, 6), body);
        p.position.set(x, 2.3, 0);
        p.castShadow = true;
        const eraser = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.4, 12), pm('eraser', () => std('#ef8fae')));
        eraser.position.set(x, 4.8, 0);
        g.add(p, eraser);
      });
      const ruler = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.35, 1.1), pm('ruler', () => std('#e6c79a')));
      ruler.position.y = 5.15;
      ruler.castShadow = true;
      const heart = new THREE.Mesh(heartGeometry(0.6, 0.2), pm('heartRed', () => std('#d8314a', { emissive: '#d8314a', emissiveIntensity: 0.6 })));
      heart.position.y = 6.2;
      g.add(ruler, heart);
      break;
    }
  }
  g.position.set(...pos);
  g.scale.setScalar(scale);
  g.rotation.y = rotY ?? (kind === 'pennant' || kind === 'pencils' || kind === 'blocks' ? 0 : seed * Math.PI * 2);
  return g;
}

// A puffy extruded heart, centred on its own origin.
export function heartGeometry(size = 0.4, depth = 0.18) {
  const s = new THREE.Shape();
  s.moveTo(0, -size);
  s.bezierCurveTo(-size * 1.6, -size * 0.1, -size * 0.8, size * 1.1, 0, size * 0.45);
  s.bezierCurveTo(size * 0.8, size * 1.1, size * 1.6, -size * 0.1, 0, -size);
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: depth * 0.5, bevelSize: size * 0.18, bevelSegments: 4, curveSegments: 16 });
  geo.center();
  return geo;
}
