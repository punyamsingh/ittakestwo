import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { BOSS } from '@shared/constants.js';
import { createArm } from './spinner.js';
import { runeTexture, textures } from './textures.js';
import { heartGeometry } from './platforms.js';

const ARM_OFFSETS = [0, Math.PI, Math.PI / 2];

function additiveSprite(color, opacity, scale) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures().glow, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(scale);
  return s;
}

function bolt(from, to, segments = 10) {
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const p = new THREE.Vector3().lerpVectors(from, to, i / segments);
    if (i > 0 && i < segments) p.add(new THREE.Vector3((Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 1.2));
    pts.push(p);
  }
  return new THREE.CatmullRomCurve3(pts);
}

export function createBossView(scene) {
  const root = new THREE.Group();
  scene.add(root);

  // The Toolbox: chipped red enamel, steel trim, yellow latches and a grudge.
  const iron = new THREE.MeshStandardMaterial({ color: '#d9452f', metalness: 0.35, roughness: 0.4 });
  const ironDark = new THREE.MeshStandardMaterial({ color: '#8a9096', metalness: 0.7, roughness: 0.35 });
  const gold = new THREE.MeshStandardMaterial({ color: '#f2c94c', metalness: 0.5, roughness: 0.35 });
  const eye = new THREE.MeshStandardMaterial({ color: '#fff4d8', emissive: '#ffcf4a', emissiveIntensity: 3.5 });
  const coreMat = new THREE.MeshStandardMaterial({ color: '#fff8d0', emissive: '#ffd24a', emissiveIntensity: 3 });

  // Pedestal (matches the physics hub).
  const base = new THREE.Mesh(new THREE.CylinderGeometry(BOSS.hubRadius, BOSS.hubRadius + 0.25, BOSS.hubHeight, 32), ironDark);
  base.position.y = BOSS.hubHeight / 2;
  base.castShadow = true;
  base.receiveShadow = true;
  [0.5, BOSS.hubHeight - 0.35].forEach((y) => {
    const band = new THREE.Mesh(new THREE.TorusGeometry(BOSS.hubRadius + 0.05, 0.09, 8, 48), gold);
    band.rotation.x = Math.PI / 2;
    band.position.y = y;
    root.add(band);
  });
  root.add(base);

  const body = new THREE.Group();
  body.position.y = BOSS.hubHeight;
  root.add(body);

  const torso = new THREE.Mesh(new RoundedBoxGeometry(3.2, 2.4, 2.3, 3, 0.35), iron);
  torso.position.y = 1.3;
  torso.castShadow = true;
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 1), coreMat);
  core.position.set(0, 1.35, 1.1);
  const coreGlow = additiveSprite('#ffd24a', 0.6, 2.6);
  coreGlow.position.copy(core.position);
  const shieldL = new THREE.Mesh(new RoundedBoxGeometry(0.75, 1.3, 0.2, 2, 0.08), gold);
  const shieldR = shieldL.clone();
  shieldL.position.set(-0.38, 1.35, 1.22);
  shieldR.position.set(0.38, 1.35, 1.22);
  body.add(torso, core, coreGlow, shieldL, shieldR);

  const head = new THREE.Group();
  head.position.set(0, 3.05, 0.1);
  const skull = new THREE.Mesh(new RoundedBoxGeometry(3.0, 0.9, 2.2, 3, 0.25), iron);
  skull.castShadow = true;
  const visor = new THREE.Mesh(new RoundedBoxGeometry(1.2, 0.22, 0.1, 2, 0.05), eye);
  visor.position.set(0, 0.05, 1.11);
  // The carry handle on the lid.
  const crest = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.1, 8, 24, Math.PI), ironDark);
  crest.position.y = 0.55;
  head.add(skull, visor, crest);
  body.add(head);

  const shoulders = [1, -1].map((s) => {
    const g = new THREE.Group();
    g.position.set(s * 2.1, 2.1, 0);
    const pad = new THREE.Mesh(new THREE.SphereGeometry(0.9, 20, 14), iron);
    pad.scale.set(1, 0.8, 1);
    pad.castShadow = true;
    // Screwdrivers bristle from the trays like spines.
    const spike = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.8, 8), gold);
    spike.position.set(s * 0.35, 0.7, 0);
    spike.rotation.z = -s * 0.5;
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.6, 6), ironDark);
    tip.position.y = 0.65;
    spike.add(tip);
    g.add(pad, spike);
    body.add(g);
    return g;
  });

  const fists = [1, -1].map((s) => {
    const f = new THREE.Mesh(new RoundedBoxGeometry(1.2, 1.2, 1.2, 3, 0.25), ironDark);
    f.castShadow = true;
    const knuckles = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.18, 0.3), gold);
    knuckles.position.set(0, 0.2, 0.5);
    f.add(knuckles);
    f.userData.side = s;
    body.add(f);
    return f;
  });

  const arms = ARM_OFFSETS.map(() => {
    const arm = createArm({ length: BOSS.armReach, hubRadius: BOSS.hubRadius, energy: '#ff2d4a' });
    arm.update(0, { presence: 0 });
    root.add(arm.pivot);
    return { arm, presence: 0 };
  });

  // Shockwave rings
  const ringGeo = new THREE.TorusGeometry(1, 0.08, 6, 96);
  ringGeo.rotateX(Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({ color: '#f2c94c', transparent: true, opacity: 0.9, depthWrite: false });
  const rings = Array.from({ length: 4 }, () => {
    const m = new THREE.Mesh(ringGeo, ringMat);
    m.position.y = 0.25;
    m.visible = false;
    root.add(m);
    return m;
  });

  // Runes
  const runeViews = [0, 1].map(() => {
    const g = new THREE.Group();
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(1.15, 40),
      new THREE.MeshBasicMaterial({ map: runeTexture('#c8323c'), transparent: true, depthWrite: false, opacity: 0 })
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.05;
    const pillar = additiveSprite('#ffe08a', 0, 3);
    pillar.position.y = 1.2;
    pillar.scale.set(1.6, 4, 1);
    g.add(disc, pillar);
    root.add(g);
    return { g, disc, pillar, level: 0 };
  });
  const arcMat = new THREE.MeshBasicMaterial({ color: '#fff3b0', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  let arcMesh = null;
  const boltMat = new THREE.MeshBasicMaterial({ color: '#fff8d0', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  let boltMeshes = [];
  let boltT = 0;

  // Defeat: a big heart rises from the burst-open box.
  const shard = new THREE.Group();
  const shardMesh = new THREE.Mesh(
    heartGeometry(0.8, 0.35),
    new THREE.MeshStandardMaterial({ color: '#ff5a76', emissive: '#d8314a', emissiveIntensity: 2, roughness: 0.25 })
  );
  shard.add(shardMesh, additiveSprite('#ff7a95', 0.8, 5));
  shard.visible = false;
  root.add(shard);

  let defeatT = -1;
  let ghost = 0;
  const fadeMats = [iron, ironDark, gold];
  const debris = [];

  function strike() {
    boltT = 0.55;
    for (const m of boltMeshes) {
      root.remove(m);
      m.geometry.dispose();
    }
    boltMeshes = [0, 1, 2].map((i) => {
      const from = new THREE.Vector3((i - 1) * 3, 30, (i - 1) * 2);
      const to = new THREE.Vector3((i - 1) * 0.4, BOSS.hubHeight + 3.2, 0.4);
      const m = new THREE.Mesh(new THREE.TubeGeometry(bolt(from, to, 14), 40, 0.12 - i * 0.03, 5), boltMat);
      root.add(m);
      return m;
    });
  }

  function collapse() {
    defeatT = 0;
    const parts = [head, ...shoulders, ...fists, shieldL, shieldR];
    for (const p of parts) {
      const world = new THREE.Vector3();
      p.getWorldPosition(world);
      debris.push({ obj: p, vel: new THREE.Vector3((Math.random() - 0.5) * 6, 5 + Math.random() * 4, (Math.random() - 0.5) * 6), spin: new THREE.Vector3(Math.random() * 5, Math.random() * 5, Math.random() * 5) });
    }
  }

  return {
    strike,
    collapse,
    corePosition: () => core.getWorldPosition(new THREE.Vector3()),
    update(state, dt, t, players = []) {
      if (!state) return;

      // Face the nearest doll.
      let target = null;
      let best = Infinity;
      for (const p of players) {
        const d = p.x * p.x + p.z * p.z;
        if (d < best) {
          best = d;
          target = p;
        }
      }
      if (target && defeatT < 0) {
        const yaw = Math.atan2(target.x, target.z);
        const diff = Math.atan2(Math.sin(yaw - body.rotation.y), Math.cos(yaw - body.rotation.y));
        body.rotation.y += diff * (1 - Math.exp(-dt * (state.attack === 'sweep' ? 1 : 3)));
      }

      // Fade the Toolbox when it stands between the camera (south) and a doll.
      const hidden = players.some((p) => p.z < -1.5 && Math.abs(p.x) < 4.5);
      ghost += ((hidden ? 1 : 0) - ghost) * (1 - Math.exp(-dt * 8));
      for (const m of fadeMats) {
        m.transparent = ghost > 0.02;
        m.opacity = 1 - ghost * 0.65;
        m.depthWrite = ghost < 0.5;
      }

      const stunned = state.stunned;
      body.position.y = BOSS.hubHeight + (defeatT < 0 ? Math.sin(t * 1.6) * 0.08 : 0);
      head.rotation.x = stunned ? 0.45 : Math.sin(t * 0.8) * 0.05;
      eye.emissiveIntensity = stunned ? 0.6 + Math.random() * 0.8 : 3.5 + state.windup * 2;
      const open = stunned ? 1 : 0;
      shieldL.position.x += (-0.38 - open * 0.55 - shieldL.position.x) * (1 - Math.exp(-dt * 8));
      shieldR.position.x += (0.38 + open * 0.55 - shieldR.position.x) * (1 - Math.exp(-dt * 8));
      coreMat.emissiveIntensity = stunned ? 5 + Math.sin(t * 20) * 1.5 : 1.8;
      coreGlow.material.opacity = stunned ? 0.95 : 0.35;
      core.rotation.y += dt * (stunned ? 6 : 1);

      if (defeatT < 0) {
        fists.forEach((f) => {
          const s = f.userData.side;
          const lift = state.attack === 'slam' ? state.windup : 0;
          f.position.set(s * 2.6, 0.7 + lift * 2.6 + Math.sin(t * 2 + s) * 0.06, 0.7);
          f.rotation.x = -lift * 0.8;
        });
      }

      arms.forEach((a, i) => {
        const want = i < (state.arms ?? 0) ? 1 : 0;
        a.presence = state.defeated ? 0 : a.presence + (want - a.presence) * (1 - Math.exp(-dt * 6));
        a.arm.pivot.rotation.y = -(state.angle + ARM_OFFSETS[i]);
        a.arm.update(t, { presence: a.presence, danger: 1, seed: i });
      });

      rings.forEach((m, i) => {
        const r = state.rings?.[i];
        m.visible = r !== undefined;
        if (m.visible) {
          m.scale.set(r, 1, r);
          m.material.opacity = 0.9;
        }
      });

      const runes = state.runes;
      runeViews.forEach((v, i) => {
        const rune = runes?.[i];
        const want = rune ? (rune.lit ? 1 : 0.55) : 0;
        v.level += (want - v.level) * (1 - Math.exp(-dt * 8));
        if (rune) v.g.position.set(rune.pos[0], 0, rune.pos[2]);
        v.disc.material.opacity = v.level;
        v.disc.rotation.z += dt * (rune?.lit ? 3 : 0.8);
        v.pillar.material.opacity = v.level * (rune?.lit ? 0.7 : 0.25);
      });
      const charging = runes && runes.every((r) => r.lit);
      if (charging) {
        if (arcMesh) {
          root.remove(arcMesh);
          arcMesh.geometry.dispose();
        }
        const a = new THREE.Vector3(runes[0].pos[0], 1.2, runes[0].pos[2]);
        const b = new THREE.Vector3(runes[1].pos[0], 1.2, runes[1].pos[2]);
        arcMesh = new THREE.Mesh(new THREE.TubeGeometry(bolt(a, b, 8), 24, 0.06, 4), arcMat);
        root.add(arcMesh);
        arcMat.opacity = 0.5 + state.runeHold * 0.5;
      } else if (arcMesh) {
        arcMat.opacity = Math.max(0, arcMat.opacity - dt * 4);
      }

      boltT = Math.max(0, boltT - dt);
      boltMat.opacity = Math.min(1, boltT * 3) * (0.7 + Math.random() * 0.3);

      if (state.defeated && defeatT < 0) collapse();
      if (defeatT >= 0) {
        defeatT += dt;
        for (const d of debris) {
          d.vel.y -= 14 * dt;
          d.obj.position.addScaledVector(d.vel, dt);
          d.obj.rotation.x += d.spin.x * dt;
          d.obj.rotation.z += d.spin.z * dt;
        }
        torso.rotation.z = Math.min(0.5, defeatT * 0.4);
        body.position.y = BOSS.hubHeight - Math.min(1.2, defeatT * 0.8);
        eye.emissiveIntensity = Math.max(0, 3.5 - defeatT * 4);
        shard.visible = defeatT > 0.6;
        shard.position.set(0, BOSS.hubHeight + 3 + Math.min(4, (defeatT - 0.6) * 1.6), 0);
        shardMesh.rotation.y += dt * 2;
      }
    },
    dispose() {
      scene.remove(root);
      root.traverse((o) => {
        if (o.isMesh || o.isSprite) {
          o.geometry?.dispose();
          o.material?.dispose?.();
        }
      });
    },
  };
}
