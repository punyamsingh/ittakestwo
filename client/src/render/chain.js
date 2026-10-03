import * as THREE from 'three';
import { CHAIN } from '@shared/constants.js';

// Rose's red thread: short overlapping yarn segments, so it reads as one soft strand.
const LINKS = 28;
const SEG = 0.3;

export function createChain(scene) {
  const geo = new THREE.CapsuleGeometry(0.045, SEG, 3, 8);
  geo.rotateZ(Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({
    color: '#d8314a',
    roughness: 0.95,
    emissive: new THREE.Color('#ff6f91'),
    emissiveIntensity: 0,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, LINKS);
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  mesh.visible = false;
  scene.add(mesh);

  const warm = new THREE.Color('#ff6f91');
  const hot = new THREE.Color('#ff2d4a');
  const p = new THREE.Vector3();
  const x = new THREE.Vector3();
  const y = new THREE.Vector3();
  const z = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const alt = new THREE.Vector3(1, 0, 0);
  const m = new THREE.Matrix4();
  const stretch = new THREE.Matrix4();
  let tension = 0;

  return {
    get tension() {
      return tension;
    },
    hide() {
      mesh.visible = false;
    },
    // floorAt(x, y, z) -> surface height below a point, or null over a void.
    update(a, b, t, floorAt) {
      mesh.visible = true;
      const d = a.distanceTo(b);
      const slack = Math.max(0, CHAIN.length - d);
      const sag = Math.min(1.1, Math.sqrt((3 * d * slack) / 8));
      tension = THREE.MathUtils.clamp((d - CHAIN.length * 0.85) / (CHAIN.length * 0.3), 0, 1);

      for (let i = 0; i < LINKS; i++) {
        const u = (i + 0.5) / LINKS;
        p.lerpVectors(a, b, u);
        p.y -= sag * 4 * u * (1 - u);
        const floor = floorAt?.(p.x, Math.max(a.y, b.y), p.z);
        if (floor !== null && floor !== undefined && p.y < floor + 0.07) p.y = floor + 0.07;
        x.subVectors(b, a);
        x.y -= sag * 4 * (1 - 2 * u);
        x.normalize();
        z.crossVectors(x, Math.abs(x.dot(up)) > 0.95 ? alt : up).normalize();
        y.crossVectors(z, x);
        m.makeBasis(x, y, z);
        // Each segment covers its share of the strand, with a little overlap.
        m.multiply(stretch.makeScale(Math.max(0.2, (d / LINKS) * 1.25) / SEG, 1, 1));
        m.setPosition(p);
        mesh.setMatrixAt(i, m);
      }
      mesh.instanceMatrix.needsUpdate = true;

      mat.emissive.copy(warm).lerp(hot, tension);
      mat.emissiveIntensity = tension * tension * 1.6 + (tension > 0.9 ? Math.sin(t * 32) * 0.5 + 0.5 : 0);
    },
  };
}
