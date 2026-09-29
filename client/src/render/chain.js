import * as THREE from 'three';
import { CHAIN } from '@shared/constants.js';

const LINKS = 18;

export function createChain(scene) {
  const geo = new THREE.TorusGeometry(0.12, 0.042, 8, 18);
  geo.scale(1.45, 1, 1);
  const mat = new THREE.MeshStandardMaterial({
    color: '#dcbd8c',
    metalness: 0.85,
    roughness: 0.28,
    emissive: new THREE.Color('#ffae4a'),
    emissiveIntensity: 0,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, LINKS);
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  mesh.visible = false;
  scene.add(mesh);

  const warm = new THREE.Color('#ffae4a');
  const hot = new THREE.Color('#ff3a24');
  const p = new THREE.Vector3();
  const x = new THREE.Vector3();
  const y = new THREE.Vector3();
  const z = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const alt = new THREE.Vector3(1, 0, 0);
  const m = new THREE.Matrix4();
  const twist = new THREE.Matrix4().makeRotationX(Math.PI / 2);
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
        if (i % 2) m.multiply(twist);
        m.setPosition(p);
        mesh.setMatrixAt(i, m);
      }
      mesh.instanceMatrix.needsUpdate = true;

      mat.emissive.copy(warm).lerp(hot, tension);
      mat.emissiveIntensity = tension * tension * 2.4 + (tension > 0.9 ? Math.sin(t * 32) * 0.5 + 0.5 : 0);
    },
  };
}
