import * as THREE from 'three';

const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export function createCameraRig(camera) {
  const pos = new THREE.Vector3(34, 18, 0);
  // Teleports (respawns, level loads) snap instead of swooping across the level.
  let snapNext = false;
  const look = new THREE.Vector3();
  const wantPos = new THREE.Vector3();
  const wantLook = new THREE.Vector3();
  const shake = new THREE.Vector3();
  let mode = 'orbit';
  let trauma = 0;
  // Horizontal lens shift (px) so the lobby scene centres in the space beside the panel.
  let shift = 0;
  let shiftTarget = 0;

  camera.position.copy(pos);
  camera.lookAt(look);

  return {
    get mode() {
      return mode;
    },
    setMode(next) {
      mode = next;
    },
    snap() {
      snapNext = true;
    },
    addTrauma(amount) {
      trauma = Math.min(1, trauma + amount * (reducedMotion ? 0.3 : 1));
    },
    /**
     * focus: midpoint of the players; spread: distance between them.
     */
    update(dt, t, { focus, spread = 0, insetLeft = 0 } = {}) {
      let rate = 3;
      shiftTarget = 0;
      if (mode === 'orbit') {
        const a = t * 0.05 + 0.6;
        wantPos.set(Math.cos(a) * 30, 15, Math.sin(a) * 30);
        wantLook.set(0, -1.5, 0);
        rate = 1.2;
      } else if (mode === 'lobby') {
        wantPos.set(0, 2.5, 11.2);
        wantLook.set(0, 0.9, 2.2);
        shiftTarget = insetLeft / 2;
        rate = 2.2;
      } else if (mode === 'arena') {
        const f = focus ?? look;
        const zoom = 1 + Math.max(0, spread - 4) * 0.05;
        // Steep and player-following, so the Warden's bulk doesn't hide anyone behind it.
        wantLook.set(f.x * 0.6, 0.5, f.z * 0.6 + 0.5);
        wantPos.set(wantLook.x, 21 * zoom, wantLook.z + 10.5 * zoom);
        rate = 3;
      } else {
        // Level: follow the pair from behind and above, looking a little ahead.
        const f = focus ?? look;
        const zoom = 1 + Math.max(0, spread - 3.5) * 0.06;
        wantLook.set(f.x * 0.85, f.y + 0.4, f.z - 2.2);
        wantPos.set(f.x * 0.85, f.y + 8.2 * zoom, f.z + 10.5 * zoom);
        rate = 3.4;
      }
      const k = snapNext ? 1 : 1 - Math.exp(-dt * rate);
      snapNext = false;
      pos.lerp(wantPos, k);
      look.lerp(wantLook, k);

      trauma = Math.max(0, trauma - dt * 1.6);
      const s = trauma * trauma;
      shake.set(
        (Math.sin(t * 37.1) + Math.sin(t * 61.7) * 0.5) * s * 0.55,
        (Math.sin(t * 43.3 + 1) + Math.sin(t * 71.9) * 0.5) * s * 0.4,
        (Math.sin(t * 29.3 + 2) + Math.sin(t * 53.3) * 0.5) * s * 0.55
      );
      camera.position.copy(pos).add(shake);
      camera.lookAt(look.x + shake.x * 0.4, look.y + shake.y * 0.4, look.z + shake.z * 0.4);
      camera.rotateZ(Math.sin(t * 23.7) * s * 0.035);

      shift += (shiftTarget - shift) * (1 - Math.exp(-dt * 4));
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (Math.abs(shift) > 0.5) camera.setViewOffset(w, h, -shift, 0, w, h);
      else if (camera.view?.enabled) camera.clearViewOffset();
    },
  };
}
