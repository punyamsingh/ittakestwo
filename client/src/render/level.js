import * as THREE from 'three';
import { PLATE_RADIUS } from '@shared/constants.js';
import { buildPlatform, buildDecor } from './platforms.js';
import { createSpinner } from './spinner.js';
import { levelTextures, runeTexture, textures } from './textures.js';

const PLATE_COLORS = ['#b5c94a', '#f2c94c', '#5b8fe0', '#e0673d'];
const DOWN = new THREE.Vector3(0, -1, 0);

function additive(color, opacity = 1, map = textures().glow) {
  return new THREE.SpriteMaterial({ map, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });
}

function buildGem() {
  const g = new THREE.Group();
  const shard = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.32, 0),
    new THREE.MeshStandardMaterial({ color: '#c8d8ff', emissive: '#4066c6', emissiveIntensity: 2.6, roughness: 0.1, metalness: 0.2 })
  );
  shard.scale.y = 1.6;
  const inner = new THREE.Sprite(additive('#7fa2ff', 0.9));
  inner.scale.setScalar(1.4);
  g.add(shard, inner);
  return { group: g, shard };
}

function buildCheckpoint() {
  const g = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: '#8a7560', roughness: 0.8 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.3, 10), stone);
  base.position.y = 0.15;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.2, 8), stone);
  pole.position.y = 1.35;
  const flagMat = new THREE.MeshStandardMaterial({ color: '#6d5a48', side: THREE.DoubleSide, roughness: 0.9 });
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55, 6, 1), flagMat);
  flag.position.set(0.47, 2.15, 0);
  const crystalMat = new THREE.MeshStandardMaterial({ color: '#b8a690', emissive: '#000000', roughness: 0.3 });
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), crystalMat);
  crystal.position.y = 2.65;
  crystal.scale.y = 1.5;
  const halo = new THREE.Sprite(additive('#ffc25e', 0));
  halo.position.y = 2.65;
  halo.scale.setScalar(1.8);
  [base, pole].forEach((m) => (m.castShadow = true));
  g.add(base, pole, flag, crystal, halo);
  return { group: g, flag, flagMat, crystal, crystalMat, halo, lit: false };
}

function buildGoal() {
  const g = new THREE.Group();
  const circle = new THREE.Mesh(
    new THREE.CircleGeometry(2.3, 48),
    new THREE.MeshBasicMaterial({ map: runeTexture('#ffe3a0'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 })
  );
  circle.rotation.x = -Math.PI / 2;
  circle.position.y = 0.04;
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 128;
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, '#000000');
  grad.addColorStop(0.7, '#555555');
  grad.addColorStop(1, '#ffffff');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 4, 128);
  const beamMat = new THREE.MeshBasicMaterial({
    color: '#ffd98a',
    alphaMap: new THREE.CanvasTexture(c),
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.1, 14, 32, 1, true), beamMat);
  beam.position.y = 7;
  const motes = [];
  for (let i = 0; i < 8; i++) {
    const s = new THREE.Sprite(additive('#fff0b0', 0.9));
    s.scale.setScalar(0.35);
    s.userData.phase = (i / 8) * Math.PI * 2;
    g.add(s);
    motes.push(s);
  }
  g.add(circle, beam);
  return { group: g, circle, beam, motes };
}

function buildPlate(color) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(PLATE_RADIUS, PLATE_RADIUS + 0.08, 0.12, 32), new THREE.MeshStandardMaterial({ color: '#2d2638', roughness: 0.6, metalness: 0.3 }));
  base.position.y = 0.06;
  base.receiveShadow = true;
  const top = new THREE.Mesh(
    new THREE.CircleGeometry(PLATE_RADIUS * 0.92, 40),
    new THREE.MeshBasicMaterial({ map: runeTexture(color), transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  top.rotation.x = -Math.PI / 2;
  top.position.y = 0.125;
  const halo = new THREE.Sprite(additive(color, 0));
  halo.position.y = 0.5;
  halo.scale.setScalar(2.4);
  g.add(base, top, halo);
  return { group: g, top, halo, press: 0 };
}

function buildPad() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, 0.14, 32), new THREE.MeshStandardMaterial({ color: '#2d2638', metalness: 0.4, roughness: 0.4 }));
  base.position.y = 0.07;
  const top = new THREE.Mesh(
    new THREE.CircleGeometry(0.85, 32),
    new THREE.MeshBasicMaterial({ map: levelTextures().chevrons, color: '#a8c4ff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  top.rotation.x = -Math.PI / 2;
  top.position.y = 0.15;
  const halo = new THREE.Sprite(additive('#5b8fe0', 0.5));
  halo.position.y = 0.5;
  halo.scale.setScalar(2.2);
  g.add(base, top, halo);
  return { group: g, top, halo, kick: 0 };
}

function buildWind(zone) {
  const count = 46;
  const dir = new THREE.Vector3(zone.force[0], 0, zone.force[2]).normalize();
  const geo = new THREE.PlaneGeometry(1.6, 0.06);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color: '#fff4e4', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.frustumCulled = false;
  const min = new THREE.Vector3(...zone.min);
  const max = new THREE.Vector3(...zone.max);
  const size = max.clone().sub(min);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
  const parts = Array.from({ length: count }, (_, i) => ({
    p: new THREE.Vector3(min.x + Math.random() * size.x, min.y + 0.4 + Math.random() * Math.min(4, size.y - 0.4), min.z + Math.random() * size.z),
    speed: 14 + Math.random() * 10,
    len: 0.6 + Math.random() * 1.2,
    i,
  }));
  const m = new THREE.Matrix4();
  let level = 0;
  return {
    mesh,
    update(state, dt) {
      const target = state === 2 ? 0.55 : state === 1 ? 0.14 : 0;
      level += (target - level) * (1 - Math.exp(-dt * 6));
      mat.opacity = level;
      mesh.visible = level > 0.01;
      if (!mesh.visible) return;
      const pace = state === 2 ? 1 : 0.35;
      for (const s of parts) {
        s.p.addScaledVector(dir, s.speed * pace * dt);
        if (s.p.x < min.x || s.p.x > max.x || s.p.z < min.z || s.p.z > max.z) {
          // Re-enter on the upwind side.
          if (Math.abs(dir.x) > Math.abs(dir.z)) s.p.x = dir.x > 0 ? min.x : max.x;
          else s.p.z = dir.z > 0 ? min.z : max.z;
          s.p.y = min.y + 0.4 + Math.random() * Math.min(4, size.y - 0.4);
        }
        m.compose(s.p, q, new THREE.Vector3(s.len, 1, 1));
        mesh.setMatrixAt(s.i, m);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

export function createLevelView(scene, def) {
  const root = new THREE.Group();
  scene.add(root);
  const solids = [];

  // Colour-code each plate with the machinery it drives.
  const plateColor = new Map();
  let colorIndex = 0;
  for (const p of def.platforms) {
    if (!p.move?.plates) continue;
    const color = PLATE_COLORS[colorIndex++ % PLATE_COLORS.length];
    for (const id of p.move.plates) plateColor.set(id, color);
  }

  const movers = [];
  const crumbles = [];
  for (const p of def.platforms) {
    const color = p.move?.plates ? plateColor.get(p.move.plates[0]) : null;
    const built = buildPlatform(p, { plateColor: color });
    root.add(built.group);
    solids.push(built.solid);
    if (p.move) movers.push({ group: built.group, height: built.height });
    if (p.crumble) crumbles.push({ group: built.group, base: built.group.position.clone(), state: 0 });
  }

  const plates = (def.plates ?? []).map((p) => {
    const v = buildPlate(plateColor.get(p.id) ?? PLATE_COLORS[0]);
    v.group.position.set(...p.pos);
    root.add(v.group);
    return v;
  });
  const pads = (def.pads ?? []).map((p) => {
    const v = buildPad();
    v.group.position.set(...p.pos);
    root.add(v.group);
    return v;
  });
  const winds = (def.wind ?? []).map((w) => {
    const v = buildWind(w);
    root.add(v.mesh);
    return v;
  });
  const spinners = (def.spinners ?? []).map((s) => {
    const v = createSpinner(s);
    root.add(v.group);
    return v;
  });
  const gems = (def.gems ?? []).map((pos) => {
    const v = buildGem();
    v.group.position.set(...pos);
    v.base = pos[1];
    root.add(v.group);
    return v;
  });
  const checkpoints = (def.checkpoints ?? []).map((c) => {
    const v = buildCheckpoint();
    v.group.position.set(c.pos[0] + 2.4, c.pos[1], c.pos[2]);
    root.add(v.group);
    return v;
  });
  const goal = def.goal ? buildGoal() : null;
  if (goal) {
    goal.group.position.set(...def.goal.pos);
    root.add(goal.group);
  }
  const decor = (def.decor ?? []).map((d) => {
    const g = buildDecor(d);
    root.add(g);
    return g;
  });
  const cloths = decor.map((g) => g.userData.cloth).filter(Boolean);

  const ray = new THREE.Raycaster();
  ray.far = 14;
  const origin = new THREE.Vector3();
  let seenCheckpoint = -1;

  return {
    root,
    gemPos: (i) => def.gems[i],
    checkpointPos: (i) => def.checkpoints[i]?.pos,
    goalPos: () => def.goal?.pos,

    // Height of the surface under a point, for drop shadows and grounding.
    groundAt(x, y, z) {
      origin.set(x, y + 0.4, z);
      ray.set(origin, DOWN);
      const hit = ray.intersectObjects(solids, false)[0];
      return hit ? hit.point.y : null;
    },

    update(state, dt, t) {
      if (state) {
        state.movers?.forEach((pos, i) => {
          const m = movers[i];
          if (m) m.group.position.set(pos[0], pos[1] + m.height / 2, pos[2]);
        });
        state.crumbles?.forEach((s, i) => {
          const c = crumbles[i];
          if (!c) return;
          c.state = s;
          c.group.visible = s !== 2;
          const shake = s === 1 ? 0.06 : 0;
          c.group.position.set(c.base.x + (Math.random() - 0.5) * shake, c.base.y + (Math.random() - 0.5) * shake, c.base.z + (Math.random() - 0.5) * shake);
        });
        state.plates?.forEach((on, i) => {
          const p = plates[i];
          if (!p) return;
          p.press += ((on ? 1 : 0) - p.press) * (1 - Math.exp(-dt * 14));
          p.top.material.opacity = 0.45 + p.press * 0.55;
          p.top.position.y = 0.125 - p.press * 0.05;
          p.halo.material.opacity = p.press * 0.6;
        });
        state.wind?.forEach((s, i) => winds[i]?.update(s, dt));
        state.spinners?.forEach((a, i) => spinners[i]?.update(a, t));
        state.gems?.forEach((taken, i) => {
          if (gems[i]) gems[i].group.visible = !taken;
        });
        if (state.checkpoint !== seenCheckpoint) {
          seenCheckpoint = state.checkpoint;
          checkpoints.forEach((c, i) => (c.lit = i <= seenCheckpoint));
        }
      }

      for (const g of gems) {
        g.shard.rotation.y += dt * 1.8;
        g.group.position.y = g.base + Math.sin(t * 2.2 + g.base) * 0.15;
      }
      for (const c of checkpoints) {
        const k = c.lit ? 1 : 0;
        c.flagMat.color.set(c.lit ? '#ffc25e' : '#6d5a48');
        c.crystalMat.emissive.set(c.lit ? '#ff9d3c' : '#000000');
        c.crystalMat.emissiveIntensity = 2.6 * k;
        c.halo.material.opacity = 0.7 * k;
        c.crystal.rotation.y += dt * 1.5;
        c.flag.rotation.y = Math.sin(t * 2 + c.group.position.z) * 0.18;
      }
      for (const p of pads) {
        p.kick = Math.max(0, p.kick - dt * 3);
        p.top.position.y = 0.15 + Math.sin(t * 4) * 0.01;
        p.halo.material.opacity = 0.4 + Math.sin(t * 4) * 0.12 + p.kick * 0.5;
        p.halo.scale.setScalar(2.2 + p.kick * 1.5);
      }
      if (goal) {
        goal.circle.rotation.z = t * 0.3;
        goal.beam.material.opacity = 0.45 + Math.sin(t * 2.2) * 0.1;
        goal.motes.forEach((s) => {
          const a = s.userData.phase + t * 0.9;
          s.position.set(Math.cos(a) * 1.9, 0.6 + ((t * 0.8 + s.userData.phase) % 4), Math.sin(a) * 1.9);
        });
      }
      for (const c of cloths) c.rotation.y = Math.sin(t * 1.6 + c.parent.position.x) * 0.12;
    },

    padKick(i) {
      if (pads[i]) pads[i].kick = 1;
    },

    dispose() {
      scene.remove(root);
      root.traverse((o) => {
        if (o.isMesh || o.isSprite || o.isInstancedMesh) {
          o.geometry?.dispose();
          const m = o.material;
          if (m && !m.userData?.shared) m.dispose?.();
        }
      });
    },
  };
}
