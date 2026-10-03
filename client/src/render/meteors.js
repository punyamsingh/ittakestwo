import * as THREE from 'three';
import { METEOR } from '@shared/constants.js';
import { textures } from './textures.js';

// A big hex-head bolt, falling point-first.
function boltGeometry() {
  const r = METEOR.radius;
  const head = new THREE.CylinderGeometry(r * 1.05, r * 1.05, r * 0.55, 6);
  head.translate(0, r * 1.05, 0);
  const shank = new THREE.CylinderGeometry(r * 0.48, r * 0.48, r * 1.7, 12);
  shank.translate(0, 0, 0);
  const tip = new THREE.ConeGeometry(r * 0.48, r * 0.5, 12);
  tip.rotateX(Math.PI);
  tip.translate(0, -r * 1.1, 0);
  return [head, shank, tip];
}

export function createMeteors(scene, effects) {
  const [headGeo, shankGeo, tipGeo] = boltGeometry();
  const rockMat = new THREE.MeshStandardMaterial({ color: '#b9bec5', roughness: 0.3, metalness: 0.8, flatShading: true });
  const glowMat = new THREE.SpriteMaterial({ map: textures().glow, color: '#fff3c4', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.35 });
  const discGeo = new THREE.CircleGeometry(METEOR.blastRadius, 48);
  discGeo.rotateX(-Math.PI / 2);
  const ringGeo = new THREE.RingGeometry(METEOR.blastRadius - 0.12, METEOR.blastRadius, 64);
  ringGeo.rotateX(-Math.PI / 2);
  const dotGeo = new THREE.CircleGeometry(0.16, 20);
  dotGeo.rotateX(-Math.PI / 2);

  const live = new Map();
  const pool = [];
  let onSpawn = () => {};

  function make() {
    const rock = new THREE.Group();
    for (const geo of [headGeo, shankGeo, tipGeo]) {
      const m = new THREE.Mesh(geo, rockMat);
      m.castShadow = true;
      rock.add(m);
    }
    const glow = new THREE.Sprite(glowMat);
    glow.scale.setScalar(1.7);
    rock.add(glow);

    const marker = new THREE.Group();
    const discMat = new THREE.MeshBasicMaterial({ color: '#f2a93c', transparent: true, opacity: 0.25, depthWrite: false });
    const ringMat = new THREE.MeshBasicMaterial({ color: '#f2c94c', transparent: true, opacity: 0.8, depthWrite: false });
    const disc = new THREE.Mesh(discGeo, discMat);
    const ring = new THREE.Mesh(ringGeo, ringMat);
    const dot = new THREE.Mesh(dotGeo, ringMat);
    marker.add(disc, ring, dot);
    marker.renderOrder = 2;
    return { rock, marker, disc, ring, discMat, ringMat };
  }

  function acquire() {
    const e = pool.pop() ?? make();
    scene.add(e.rock, e.marker);
    return e;
  }

  function release(id) {
    const e = live.get(id);
    if (!e) return;
    scene.remove(e.rock, e.marker);
    live.delete(id);
    pool.push(e);
  }

  return {
    onSpawn(fn) {
      onSpawn = fn;
    },
    sync(list, dt, t) {
      const seen = new Set();
      for (const m of list) {
        seen.add(m.id);
        let e = live.get(m.id);
        if (!e) {
          e = acquire();
          e.spin = new THREE.Vector3(Math.random() * 4, Math.random() * 4, Math.random() * 4);
          live.set(m.id, e);
          onSpawn(m);
        }
        const [x, y, z] = m.pos;
        e.rock.position.set(x, y, z);
        // Bolts tumble a little but mostly fall point-down, spinning on their axis.
        e.rock.rotation.set(Math.sin(t * e.spin.x) * 0.25, e.rock.rotation.y + e.spin.y * dt * 2, Math.cos(t * e.spin.z) * 0.25);
        e.marker.position.set(x, (m.gy ?? 0) + 0.04, z);
        const k = m.k;
        e.disc.scale.setScalar(0.15 + 0.85 * k);
        const pulse = 0.5 + 0.5 * Math.sin(t * (6 + k * 26));
        e.discMat.opacity = 0.12 + k * 0.3;
        e.ringMat.opacity = 0.35 + 0.55 * pulse * (0.4 + k * 0.6);
        if (Math.random() < 0.3) effects.trail(m.pos);
      }
      for (const id of Array.from(live.keys())) if (!seen.has(id)) release(id);
    },
    clear() {
      for (const id of Array.from(live.keys())) release(id);
    },
  };
}
