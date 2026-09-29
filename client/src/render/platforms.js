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
    rock: new THREE.MeshStandardMaterial({ color: '#7a506a', roughness: 0.95, flatShading: true }),
    rockDark: new THREE.MeshStandardMaterial({ color: '#4f3252', roughness: 1, flatShading: true }),
    dirt: new THREE.MeshStandardMaterial({ color: '#8a5c48', roughness: 0.95 }),
    sandBody: new THREE.MeshStandardMaterial({ color: '#b98a62', roughness: 0.9 }),
    marbleBody: new THREE.MeshStandardMaterial({ color: '#a998b8', roughness: 0.8 }),
    metal: new THREE.MeshStandardMaterial({ color: '#39334f', roughness: 0.35, metalness: 0.6 }),
    gold: new THREE.MeshStandardMaterial({ color: '#ffcf7a', emissive: '#ff9d3c', emissiveIntensity: 0.8, metalness: 0.7, roughness: 0.3 }),
    trim: new THREE.MeshStandardMaterial({ color: '#fff0c8', emissive: '#ffb347', emissiveIntensity: 2.2, roughness: 0.4 }),
    crumbleBody: new THREE.MeshStandardMaterial({ color: '#a8744f', roughness: 0.95 }),
    grassTop: tex.grass,
    sandTop: tex.sand,
    marbleTop: tex.marble,
    crumbleTop: tex.crumble,
  };
  for (const m of Object.values(mats)) if (m.isMaterial) m.userData.shared = true;
  return mats;
}

function topMaterial(map, w, d, scale = 2) {
  const t = map.clone();
  t.needsUpdate = true;
  t.repeat.set(Math.max(1, w / scale), Math.max(1, d / scale));
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 });
}

// Inverted rocky spire under a floating island.
function islandRoot(width, depth, seed) {
  const radius = Math.min(width, depth) * 0.48;
  const height = Math.max(2.5, (width + depth) * 0.32);
  const geo = new THREE.ConeGeometry(radius, height, 7, 3);
  geo.rotateX(Math.PI);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const k = 1 + (hash(Math.round(x * 10) + Math.round(z * 10) * 7 + Math.round(y * 10) * 13 + seed) - 0.5) * 0.35;
    p.setXYZ(i, x * k, y, z * k);
  }
  geo.scale(width / Math.min(width, depth), 1, depth / Math.min(width, depth));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, materials().rock);
  m.position.y = -height / 2;
  return m;
}

function grassTufts(group, w, d, seed, top = 0) {
  const geo = new THREE.ConeGeometry(0.06, 0.32, 4);
  const mat = new THREE.MeshStandardMaterial({ color: '#7fc25e', roughness: 1 });
  const count = Math.round((w * d) / 3);
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    const x = (hash(seed + i * 3.1) - 0.5) * (w - 0.6);
    const z = (hash(seed + i * 7.7) - 0.5) * (d - 0.6);
    const s = 0.7 + hash(seed + i) * 0.8;
    m.makeScale(s, s, s).setPosition(x, top + 0.12 * s + 0.02, z);
    mesh.setMatrixAt(i, m);
  }
  group.add(mesh);
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

  let bodyMat = M.sandBody;
  let top = null;
  switch (def.style) {
    case 'grass':
      bodyMat = M.dirt;
      top = new THREE.Mesh(capGeo(0.3), topMaterial(M.grassTop, w, d, 3));
      break;
    case 'stone':
      bodyMat = M.sandBody;
      top = new THREE.Mesh(capGeo(0.22, 0.08), topMaterial(M.sandTop, w, d, 2));
      break;
    case 'ruin':
      bodyMat = M.marbleBody;
      top = new THREE.Mesh(capGeo(0.22, 0.08), topMaterial(M.marbleTop, w, d, 2.5));
      break;
    case 'crumble':
      bodyMat = M.crumbleBody;
      top = new THREE.Mesh(capGeo(0.2, 0.04), topMaterial(M.crumbleTop, w, d, 3));
      break;
    case 'metal':
    case 'gate':
      bodyMat = M.metal;
      break;
    case 'arena':
      bodyMat = null;
      break;
  }

  // Stone pillars read as faceted rock rather than smooth (barrel-like) cylinders.
  if (isDisc && def.style === 'stone') bodyMat = M.rock;
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

  if (def.style === 'ruin' && !isDisc) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(w + 0.14, 0.08, d + 0.14), M.gold);
    band.position.y = -0.26;
    group.add(band);
  }

  if (def.style === 'metal') {
    // Glowing edge strips and an anti-grav glow underneath.
    const strip = (sx, sz, x, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.07, sz), M.trim);
      m.position.set(x, 0.01, z);
      group.add(m);
    };
    strip(w - 0.2, 0.1, 0, d / 2 - 0.12);
    strip(w - 0.2, 0.1, 0, -d / 2 + 0.12);
    strip(0.1, d - 0.2, w / 2 - 0.12, 0);
    strip(0.1, d - 0.2, -w / 2 + 0.12, 0);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures().glow, color: '#ffb35c', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.position.y = -h - 0.25;
    glow.scale.set(w * 0.9, 0.9, 1);
    group.add(glow);
    if (plateColor) {
      const rune = new THREE.Mesh(
        new THREE.PlaneGeometry(Math.min(w, d) * 0.7, Math.min(w, d) * 0.7),
        new THREE.MeshBasicMaterial({ map: runeTexture(plateColor), transparent: true, opacity: 0.8, depthWrite: false })
      );
      rune.rotation.x = -Math.PI / 2;
      rune.position.y = 0.02;
      group.add(rune);
      group.userData.rune = rune;
    }
  }

  if (def.style === 'gate') {
    for (let i = -2; i <= 2; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.16, h * 0.9, d + 0.1), M.gold);
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

  const isIsland = ['grass', 'stone', 'ruin'].includes(def.style) && h >= 2.4 && !def.move && !def.wall;
  if (isIsland) {
    const root = islandRoot(w * 0.95, d * 0.95, seed);
    root.position.y -= h - 0.2;
    group.add(root);
  }
  if (def.style === 'grass' && !def.move) grassTufts(group, w, d, seed, 0.02);

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

export function buildDecor({ kind, pos, scale = 1, rotY }) {
  const g = new THREE.Group();
  const seed = hash(pos[0] * 3 + pos[2] * 11);
  const marble = pm('marble', () => new THREE.MeshStandardMaterial({ color: '#e8dff0', roughness: 0.7 }));
  const gold = materials().gold;
  switch (kind) {
    case 'tree': {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 1.4, 7), pm('trunk', () => new THREE.MeshStandardMaterial({ color: '#6b4632', roughness: 1 })));
      trunk.position.y = 0.7;
      g.add(trunk);
      const leaf = seed > 0.5 ? pm('leafPink', () => new THREE.MeshStandardMaterial({ color: '#ff9fbf', roughness: 0.9, flatShading: true })) : pm('leafGreen', () => new THREE.MeshStandardMaterial({ color: '#7fc86a', roughness: 0.9, flatShading: true }));
      [
        [0, 1.9, 0, 0.95],
        [0.45, 1.6, 0.2, 0.6],
        [-0.4, 1.7, -0.2, 0.65],
      ].forEach(([x, y, z, r]) => {
        const c = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), leaf);
        c.position.set(x, y, z);
        c.castShadow = true;
        g.add(c);
      });
      break;
    }
    case 'rock': {
      const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 0), materials().rockDark);
      r.scale.set(1.2, 0.7, 1);
      r.position.y = 0.25;
      r.rotation.y = seed * 6;
      r.castShadow = true;
      g.add(r);
      break;
    }
    case 'crystal': {
      const m = pm('crystal', () => new THREE.MeshStandardMaterial({ color: '#9ff2ff', emissive: '#35c8ff', emissiveIntensity: 2.2, roughness: 0.15 }));
      for (let i = 0; i < 3; i++) {
        const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), m);
        c.scale.set(0.8, 1.8 + i * 0.4, 0.8);
        c.position.set((i - 1) * 0.28, 0.5 + i * 0.1, (i % 2) * 0.2);
        c.rotation.z = (i - 1) * 0.3;
        g.add(c);
      }
      break;
    }
    case 'lantern': {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.6, 6), pm('iron', () => new THREE.MeshStandardMaterial({ color: '#3b2b40', roughness: 0.6, metalness: 0.4 })));
      post.position.y = 0.8;
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.36, 8), pm('lamp', () => new THREE.MeshStandardMaterial({ color: '#ffd29a', emissive: '#ff9a3c', emissiveIntensity: 2.6 })));
      lamp.position.y = 1.75;
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures().glow, color: '#ff9d52', transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }));
      halo.position.y = 1.75;
      halo.scale.setScalar(1.6);
      g.add(post, lamp, halo);
      break;
    }
    case 'ruin': {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 1.9, 12), marble);
      col.position.y = 0.95;
      col.castShadow = true;
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.35, 12), marble);
      cap.position.set(0.05, 2.0, 0);
      cap.rotation.z = 0.35;
      const chunk = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.7, 12), marble);
      chunk.rotation.z = Math.PI / 2;
      chunk.position.set(0.8, 0.32, 0.4);
      chunk.castShadow = true;
      g.add(col, cap, chunk);
      break;
    }
    case 'banner': {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3, 6), gold);
      pole.position.y = 1.5;
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.1, 6), gold);
      bar.rotation.z = Math.PI / 2;
      bar.position.set(0, 2.85, 0.05);
      const cloth = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1.9, 1, 8),
        pm('bannerCloth', () => new THREE.MeshStandardMaterial({ map: levelTextures().banner, side: THREE.DoubleSide, transparent: true, alphaTest: 0.5, roughness: 0.9 }))
      );
      cloth.position.set(0, 1.85, 0.08);
      cloth.userData.wave = true;
      g.add(pole, bar, cloth);
      g.userData.cloth = cloth;
      break;
    }
    case 'statue': {
      const plinth = new THREE.Mesh(new RoundedBoxGeometry(1.1, 0.6, 1.1, 2, 0.08), marble);
      plinth.position.y = 0.3;
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), marble);
      body.position.y = 1.05;
      body.scale.set(1, 1.1, 0.9);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), marble);
      head.position.y = 1.72;
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.25, 6), gold);
      horn.position.set(0.14, 2.02, 0);
      const horn2 = horn.clone();
      horn2.position.x = -0.14;
      const link = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.05, 8, 16), gold);
      link.position.set(0.45, 0.95, 0.2);
      [plinth, body, head].forEach((m) => (m.castShadow = true));
      g.add(plinth, body, head, horn, horn2, link);
      break;
    }
    case 'arch': {
      [-2.4, 2.4].forEach((x) => {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 4.6, 12), marble);
        p.position.set(x, 2.3, 0);
        p.castShadow = true;
        g.add(p);
      });
      const arc = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.38, 10, 32, Math.PI), marble);
      arc.position.y = 4.5;
      const stone = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), pm('crystal', () => new THREE.MeshStandardMaterial({ color: '#9ff2ff', emissive: '#35c8ff', emissiveIntensity: 2.2 })));
      stone.position.y = 6.9;
      stone.scale.y = 1.5;
      g.add(arc, stone);
      break;
    }
  }
  g.position.set(...pos);
  g.scale.setScalar(scale);
  g.rotation.y = rotY ?? (kind === 'banner' || kind === 'arch' || kind === 'statue' ? 0 : seed * Math.PI * 2);
  return g;
}
