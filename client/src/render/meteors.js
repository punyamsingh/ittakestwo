import * as THREE from 'three';
import { METEOR } from '@shared/constants.js';
import { textures } from './textures.js';

function rockGeometry() {
  const geo = new THREE.IcosahedronGeometry(METEOR.radius, 1);
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = Math.sin(v.x * 9.1) * Math.cos(v.y * 7.3) * Math.sin(v.z * 8.7);
    v.multiplyScalar(1 + n * 0.18);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

export function createMeteors(scene, effects) {
  const geo = rockGeometry();
  const rockMat = new THREE.MeshStandardMaterial({ color: '#4a2418', emissive: '#ff5a1f', emissiveIntensity: 1.5, roughness: 0.8, flatShading: true });
  const glowMat = new THREE.SpriteMaterial({ map: textures().glow, color: '#ff7a2e', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.7 });
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
    const rock = new THREE.Mesh(geo, rockMat);
    rock.castShadow = true;
    const glow = new THREE.Sprite(glowMat);
    glow.scale.setScalar(1.7);
    rock.add(glow);

    const marker = new THREE.Group();
    const discMat = new THREE.MeshBasicMaterial({ color: '#ff4a2e', transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending });
    const ringMat = new THREE.MeshBasicMaterial({ color: '#ffb35c', transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending });
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
        e.rock.rotation.x += e.spin.x * dt;
        e.rock.rotation.y += e.spin.y * dt;
        e.marker.position.set(x, (m.gy ?? 0) + 0.04, z);
        const k = m.k;
        e.disc.scale.setScalar(0.15 + 0.85 * k);
        const pulse = 0.5 + 0.5 * Math.sin(t * (6 + k * 26));
        e.discMat.opacity = 0.12 + k * 0.3;
        e.ringMat.opacity = 0.35 + 0.55 * pulse * (0.4 + k * 0.6);
        if (Math.random() < 0.9) effects.trail(m.pos);
      }
      for (const id of Array.from(live.keys())) if (!seen.has(id)) release(id);
    },
    clear() {
      for (const id of Array.from(live.keys())) release(id);
    },
  };
}
