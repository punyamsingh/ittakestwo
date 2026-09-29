import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { SWEEPER } from '@shared/constants.js';

const ARM_BOTTOM = 0.18;
const FAN_SPAN = 0.75;

// Floor wedge just ahead of the arm; u runs along the sweep angle, v outward.
function fanGeometry(inner, outer, span, segments = 40) {
  const pos = [];
  const uv = [];
  const idx = [];
  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    const a = u * span;
    pos.push(Math.cos(a) * inner, 0, Math.sin(a) * inner, Math.cos(a) * outer, 0, Math.sin(a) * outer);
    uv.push(u, 0, u, 1);
    if (i < segments) {
      const k = i * 2;
      idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return geo;
}

let fanAlpha = null;
function fanAlphaMap() {
  if (fanAlpha) return fanAlpha;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 4;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 128, 0);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.25, '#d8d8d8');
  g.addColorStop(0.6, '#5a5a5a');
  g.addColorStop(1, '#000000');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 4);
  fanAlpha = new THREE.CanvasTexture(c);
  return fanAlpha;
}

/**
 * A rotating hazard arm (local +x) with its leading edge on local +z, plus a
 * floor telegraph showing where it's about to pass.
 */
export function createArm({ length, hubRadius, energy = '#ff2d55', scale = 1 }) {
  const reach = length - hubRadius + 0.1;
  const height = (SWEEPER.top - ARM_BOTTOM) * scale;
  const width = SWEEPER.halfWidth * 2 * scale;
  const pivot = new THREE.Group();

  const metal = new THREE.MeshStandardMaterial({ color: '#2c2340', metalness: 0.55, roughness: 0.35, transparent: true });
  const glow = new THREE.MeshStandardMaterial({ color: '#ffd0da', emissive: energy, emissiveIntensity: 3.4, roughness: 0.3, transparent: true });

  const beam = new THREE.Mesh(new RoundedBoxGeometry(reach, height, width, 3, Math.min(0.1, width / 3)), metal);
  beam.position.set(hubRadius + reach / 2 - 0.05, ARM_BOTTOM + height / 2, 0);
  beam.castShadow = true;
  const strip = new THREE.Mesh(new THREE.BoxGeometry(reach - 0.3, height * 0.34, 0.04), glow);
  strip.position.set(beam.position.x, beam.position.y, width / 2 + 0.01);
  const topStrip = new THREE.Mesh(new THREE.BoxGeometry(reach - 0.4, 0.04, width * 0.4), glow);
  topStrip.position.set(beam.position.x, ARM_BOTTOM + height + 0.01, 0);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.28 * scale, 20, 14), glow);
  tip.position.set(length, beam.position.y, 0);

  const fanMat = new THREE.MeshBasicMaterial({ color: '#ff2450', alphaMap: fanAlphaMap(), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const fan = new THREE.Mesh(fanGeometry(hubRadius + 0.05, length + 0.2, FAN_SPAN), fanMat);
  fan.position.y = 0.03;
  fan.renderOrder = 2;

  pivot.add(beam, strip, topStrip, tip, fan);

  return {
    pivot,
    /** presence 0..1 fades the whole arm in; danger 0..1 fades the floor telegraph. */
    update(t, { presence = 1, danger = 1, seed = 0 } = {}) {
      pivot.visible = presence > 0.01;
      metal.opacity = presence;
      glow.opacity = presence;
      metal.transparent = presence < 0.999;
      glow.transparent = presence < 0.999;
      glow.emissiveIntensity = 3.4 + Math.sin(t * 8 + seed) * 0.6;
      tip.scale.setScalar(1 + Math.sin(t * 10 + seed) * 0.12);
      fanMat.opacity = (0.72 + Math.sin(t * 9 + seed) * 0.1) * danger * presence;
      fan.visible = fanMat.opacity > 0.01;
    },
  };
}

// A spinner as placed in a level: a small pedestal with 1–3 arms.
export function createSpinner(def) {
  const group = new THREE.Group();
  group.position.set(...def.pos);
  const stone = new THREE.MeshStandardMaterial({ color: '#4a3150', roughness: 0.75 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 1.1, 24), stone);
  base.position.y = 0.55;
  base.castShadow = true;
  base.receiveShadow = true;
  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.28, 0),
    new THREE.MeshStandardMaterial({ color: '#ffb0c4', emissive: '#ff2f6d', emissiveIntensity: 3, roughness: 0.2 })
  );
  core.position.y = 1.4;
  group.add(base, core);
  const count = def.arms ?? 1;
  const arms = Array.from({ length: count }, () => {
    const arm = createArm({ length: def.length, hubRadius: 0.7 });
    group.add(arm.pivot);
    return arm;
  });
  return {
    group,
    update(angle, t) {
      core.rotation.y = t * 2;
      arms.forEach((arm, i) => {
        arm.pivot.rotation.y = -(angle + (i * Math.PI * 2) / count);
        arm.update(t, { seed: i });
      });
    },
  };
}
