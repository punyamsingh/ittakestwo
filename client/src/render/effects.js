import * as THREE from 'three';
import { METEOR } from '@shared/constants.js';
import { textures } from './textures.js';

// One draw call per blend mode for every particle in the game.
class Particles {
  constructor(scene, max, blending) {
    this.max = max;
    this.cursor = 0;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.color = new Float32Array(max * 4);
    this.size = new Float32Array(max);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.size0 = new Float32Array(max);
    this.size1 = new Float32Array(max);
    this.alpha0 = new Float32Array(max);
    this.gravity = new Float32Array(max);
    this.drag = new Float32Array(max);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.color, 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = geo;
    this.uniforms = { uScale: { value: 400 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending,
      vertexShader: /* glsl */ `
        attribute float aSize;
        attribute vec4 aColor;
        uniform float uScale;
        varying vec4 vColor;
        void main() {
          vColor = aColor;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uScale / max(0.1, -mv.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec4 vColor;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(vColor.rgb, vColor.a * a);
        }
      `,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
  }

  emit({ x, y, z, vx = 0, vy = 0, vz = 0, life = 0.6, size = 0.3, sizeEnd = 0, color, alpha = 1, gravity = 0, drag = 0 }) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;
    this.pos.set([x, y, z], i * 3);
    this.vel.set([vx, vy, vz], i * 3);
    this.color.set([color.r, color.g, color.b, alpha], i * 4);
    this.life[i] = life;
    this.maxLife[i] = life;
    this.size0[i] = size;
    this.size1[i] = sizeEnd;
    this.alpha0[i] = alpha;
    this.gravity[i] = gravity;
    this.drag[i] = drag;
    this.size[i] = size;
  }

  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) {
        this.size[i] = 0;
        continue;
      }
      this.life[i] -= dt;
      const t = 1 - Math.max(0, this.life[i]) / this.maxLife[i];
      const k = Math.exp(-this.drag[i] * dt);
      const j = i * 3;
      this.vel[j] *= k;
      this.vel[j + 1] = this.vel[j + 1] * k - this.gravity[i] * dt;
      this.vel[j + 2] *= k;
      this.pos[j] += this.vel[j] * dt;
      this.pos[j + 1] += this.vel[j + 1] * dt;
      this.pos[j + 2] += this.vel[j + 2] * dt;
      this.size[i] = this.size0[i] + (this.size1[i] - this.size0[i]) * t;
      this.color[i * 4 + 3] = this.alpha0[i] * (1 - t * t);
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aColor.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
  }

  clear() {
    this.life.fill(0);
    this.size.fill(0);
  }
}

export function createEffects(scene, camera, renderer) {
  const sparks = new Particles(scene, 900, THREE.AdditiveBlending);
  const dust = new Particles(scene, 500, THREE.NormalBlending);

  const ringGeo = new THREE.RingGeometry(0.86, 1, 64);
  ringGeo.rotateX(-Math.PI / 2);
  const rings = [];
  const scorchGeo = new THREE.PlaneGeometry(1, 1);
  scorchGeo.rotateX(-Math.PI / 2);
  const scorches = [];
  const flashes = [];

  function resize() {
    const h = renderer.getDrawingBufferSize(new THREE.Vector2()).y;
    const scale = h / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    sparks.uniforms.uScale.value = scale;
    dust.uniforms.uScale.value = scale;
  }
  resize();

  function ring(x, y, z, { color, radius, duration = 0.45, width = 1 }) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const m = new THREE.Mesh(ringGeo, mat);
    m.position.set(x, y + 0.04, z);
    m.renderOrder = 3;
    scene.add(m);
    rings.push({ m, t: 0, duration, radius, width });
  }

  function flash(x, y, z, color, scale, duration = 0.25) {
    const mat = new THREE.SpriteMaterial({ map: textures().glow, color, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending });
    const s = new THREE.Sprite(mat);
    s.position.set(x, y, z);
    s.scale.setScalar(scale);
    scene.add(s);
    flashes.push({ s, t: 0, duration, scale });
  }

  const tmpColor = new THREE.Color();
  const col = (hex) => tmpColor.set(hex).clone();

  return {
    resize,
    hitBurst([x, y, z], hex) {
      const c = col(hex);
      const white = col('#fff4e0');
      for (let i = 0; i < 28; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 3 + Math.random() * 5;
        sparks.emit({ x, y, z, vx: Math.cos(a) * s, vy: 1 + Math.random() * 4, vz: Math.sin(a) * s, life: 0.35 + Math.random() * 0.3, size: 0.28, sizeEnd: 0.02, color: i % 3 ? c : white, gravity: 9, drag: 3 });
      }
      flash(x, y, z, hex, 1.7, 0.18);
      ring(x, Math.max(0, y - 0.55), z, { color: hex, radius: 1.8, duration: 0.35 });
    },
    landPuff([x, y, z], strength = 1) {
      const c = col('#caa27c');
      const n = Math.round(4 + strength * 5);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.3;
        const s = 1.2 + Math.random() * 1.4 * strength;
        dust.emit({ x: x + Math.cos(a) * 0.35, y: y + 0.08, z: z + Math.sin(a) * 0.35, vx: Math.cos(a) * s, vy: 0.3 + Math.random() * 0.5, vz: Math.sin(a) * s, life: 0.35 + Math.random() * 0.25, size: 0.28, sizeEnd: 0.55, color: c, alpha: 0.38, drag: 5 });
      }
    },
    impact([x, , z], y = 0) {
      const orange = col('#ff8a3c');
      const yellow = col('#ffe08a');
      const smoke = col('#4a3428');
      for (let i = 0; i < 34; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 3 + Math.random() * 7;
        sparks.emit({ x, y: y + 0.2, z, vx: Math.cos(a) * s, vy: 2 + Math.random() * 7, vz: Math.sin(a) * s, life: 0.5 + Math.random() * 0.5, size: 0.34, sizeEnd: 0.02, color: i % 2 ? orange : yellow, gravity: 14, drag: 1.5 });
      }
      for (let i = 0; i < 22; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 1 + Math.random() * 3;
        dust.emit({ x, y: y + 0.3, z, vx: Math.cos(a) * s, vy: 1 + Math.random() * 2.5, vz: Math.sin(a) * s, life: 0.9 + Math.random() * 0.6, size: 0.6, sizeEnd: 1.6, color: smoke, alpha: 0.5, drag: 2.2 });
      }
      ring(x, y, z, { color: '#ffb35c', radius: METEOR.blastRadius * 1.35, duration: 0.5 });
      ring(x, y, z, { color: '#ff5a2e', radius: METEOR.blastRadius * 0.9, duration: 0.3 });
      flash(x, y + 0.6, z, '#ff9a4a', 4.2, 0.28);
      const mat = new THREE.MeshBasicMaterial({ map: textures().scorch, transparent: true, depthWrite: false, opacity: 0.85 });
      const s = new THREE.Mesh(scorchGeo, mat);
      s.position.set(x, y + 0.015, z);
      s.rotation.y = Math.random() * Math.PI;
      s.scale.setScalar(METEOR.blastRadius * 1.5);
      s.renderOrder = 1;
      scene.add(s);
      scorches.push({ s, t: 0 });
    },
    trail([x, y, z]) {
      sparks.emit({
        x: x + (Math.random() - 0.5) * 0.3,
        y: y + 0.2,
        z: z + (Math.random() - 0.5) * 0.3,
        vx: (Math.random() - 0.5) * 0.6,
        vy: 1.5 + Math.random(),
        vz: (Math.random() - 0.5) * 0.6,
        life: 0.35,
        size: 0.55,
        sizeEnd: 0.1,
        color: Math.random() > 0.4 ? col('#ff7a2e') : col('#ffd27a'),
        alpha: 0.9,
        drag: 2,
      });
    },
    sparkle([x, y, z], hex, n = 12) {
      const c = col(hex);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        sparks.emit({ x, y, z, vx: Math.cos(a) * 1.5, vy: 1.5 + Math.random() * 2, vz: Math.sin(a) * 1.5, life: 0.6 + Math.random() * 0.4, size: 0.22, sizeEnd: 0, color: c, gravity: 2, drag: 2 });
      }
    },
    update(dt) {
      sparks.update(dt);
      dust.update(dt);
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.t += dt / r.duration;
        if (r.t >= 1) {
          scene.remove(r.m);
          r.m.material.dispose();
          rings.splice(i, 1);
          continue;
        }
        const e = 1 - Math.pow(1 - r.t, 3);
        r.m.scale.setScalar(0.1 + e * r.radius);
        r.m.material.opacity = 1 - r.t;
      }
      for (let i = flashes.length - 1; i >= 0; i--) {
        const f = flashes[i];
        f.t += dt / f.duration;
        if (f.t >= 1) {
          scene.remove(f.s);
          f.s.material.dispose();
          flashes.splice(i, 1);
          continue;
        }
        f.s.material.opacity = 0.6 * (1 - f.t);
        f.s.scale.setScalar(f.scale * (0.6 + f.t * 0.6));
      }
      for (let i = scorches.length - 1; i >= 0; i--) {
        const s = scorches[i];
        s.t += dt;
        s.s.material.opacity = 0.85 * (1 - Math.max(0, (s.t - 2.5) / 2));
        if (s.t > 4.5) {
          scene.remove(s.s);
          s.s.material.dispose();
          scorches.splice(i, 1);
        }
      }
    },
    clear() {
      sparks.clear();
      dust.clear();
      for (const r of rings) scene.remove(r.m);
      for (const f of flashes) scene.remove(f.s);
      for (const s of scorches) scene.remove(s.s);
      rings.length = 0;
      flashes.length = 0;
      scorches.length = 0;
    },
  };
}
