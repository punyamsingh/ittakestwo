import * as THREE from 'three';
import { buildCreature, animateCreature, disposeCreature } from './creatures.js';

// Renders creature thumbnails for the lobby UI from the real 3D models.
export function createPortraits(size = 192) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(size, size, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffe8d0', '#3a2418', 1.8));
  const key = new THREE.DirectionalLight('#ffe2c4', 2.6);
  key.position.set(2, 4, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight('#8fa6d8', 1.6);
  rim.position.set(-3, 2, -3);
  scene.add(rim);

  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 30);
  const cache = new Map();

  return {
    get(avatar) {
      const key = `${avatar.type}|${avatar.color}`;
      if (cache.has(key)) return cache.get(key);
      const entry = buildCreature(avatar);
      entry.root.rotation.y = 0.45;
      scene.add(entry.root);
      animateCreature(entry, 0, 0.8, { vel: null, grounded: true, alive: true, faceCamera: false });
      entry.root.rotation.y = 0.45;
      const h = entry.height;
      camera.position.set(0, h * 0.62, h * 2.35 + 1.2);
      camera.lookAt(0, h * 0.47, 0);
      renderer.render(scene, camera);
      const url = renderer.domElement.toDataURL('image/png');
      disposeCreature(entry);
      cache.set(key, url);
      return url;
    },
  };
}
