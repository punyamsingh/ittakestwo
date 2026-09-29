import * as THREE from 'three';
import { BOSS } from '@shared/constants.js';

const ARENA_RADIUS = 12;
import { textures } from './textures.js';

const PALETTE = {
  skyTop: new THREE.Color('#1d1646'),
  skyMid: new THREE.Color('#6b3a8f'),
  horizon: new THREE.Color('#ff9a78'),
  below: new THREE.Color('#7a4a8e'),
  sun: new THREE.Color('#ffc98a'),
  cloudLit: new THREE.Color('#ffbfa3'),
  cloudShade: new THREE.Color('#7d4a8f'),
  fog: new THREE.Color('#b77a9e'),
};

// ---------- small deterministic noise helpers ----------

function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function noise2(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const NOISE_GLSL = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * vnoise(p);
      p = p * 2.03 + vec2(17.3, 9.1);
      a *= 0.5;
    }
    return v;
  }
`;

// ---------- sky + clouds ----------

function buildSky(scene, sunDir) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTop: { value: PALETTE.skyTop },
      uMid: { value: PALETTE.skyMid },
      uHorizon: { value: PALETTE.horizon },
      uBelow: { value: PALETTE.below },
      uSun: { value: PALETTE.sun },
      uSunDir: { value: sunDir },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop, uMid, uHorizon, uBelow, uSun, uSunDir;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.28, h));
        col = mix(col, uTop, smoothstep(0.22, 0.9, h));
        col = mix(col, uBelow, smoothstep(0.0, -0.25, h));
        float s = max(dot(d, uSunDir), 0.0);
        col += uSun * (pow(s, 900.0) * 8.0 + pow(s, 24.0) * 0.55 + pow(s, 4.0) * 0.18);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), mat);
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  scene.add(sky);
}

function buildCloudLayer(scene, { y, scale, speed, coverage, alpha, lit, shade }) {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTime: { value: 0 },
      uLit: { value: lit },
      uShade: { value: shade },
      uFar: { value: PALETTE.horizon.clone().lerp(PALETTE.below, 0.35) },
      uScale: { value: scale },
      uSpeed: { value: speed },
      uCoverage: { value: coverage },
      uAlpha: { value: alpha },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime, uScale, uSpeed, uCoverage, uAlpha;
      uniform vec3 uLit, uShade, uFar;
      varying vec3 vWorld;
      ${NOISE_GLSL}
      void main() {
        vec2 p = vWorld.xz * uScale;
        float n = fbm(p + vec2(uTime * uSpeed, uTime * uSpeed * 0.4));
        float n2 = fbm(p * 2.3 - vec2(uTime * uSpeed * 1.6, 0.0));
        float d = n * 0.7 + n2 * 0.3;
        float a = smoothstep(uCoverage, uCoverage + 0.28, d);
        vec3 col = mix(uShade, uLit, smoothstep(uCoverage, uCoverage + 0.45, d));
        float dist = length(vWorld.xz);
        float far = smoothstep(90.0, 300.0, dist);
        col = mix(col, uFar, far);
        a = mix(a * uAlpha, 1.0, far) * (1.0 - smoothstep(380.0, 480.0, dist));
        gl_FragColor = vec4(col, a);
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  mesh.renderOrder = -5;
  scene.add(mesh);
  return mat;
}

// ---------- the arena ----------

function sectorShape(r0, r1, a0, a1) {
  const s = new THREE.Shape();
  s.moveTo(r0 * Math.cos(a0), r0 * Math.sin(a0));
  s.lineTo(r1 * Math.cos(a0), r1 * Math.sin(a0));
  s.absarc(0, 0, r1, a0, a1, false);
  s.lineTo(r0 * Math.cos(a1), r0 * Math.sin(a1));
  s.absarc(0, 0, r0, a1, a0, true);
  return s;
}

const TILE_DEPTH = 0.32;
const TILE_BEVEL = 0.045;

function tileRing(r0, r1, count, colors, rand, offset) {
  const span = (Math.PI * 2) / count;
  const gap = 0.09 / ((r0 + r1) / 2);
  const geo = new THREE.ExtrudeGeometry(sectorShape(r0 + 0.04, r1 - 0.04, gap / 2, span - gap / 2), {
    depth: TILE_DEPTH,
    bevelEnabled: true,
    bevelThickness: TILE_BEVEL,
    bevelSize: 0.035,
    bevelSegments: 2,
    curveSegments: Math.max(4, Math.round(12 * (span / 0.6))),
  });
  geo.rotateX(Math.PI / 2);
  geo.translate(0, -TILE_BEVEL, 0);

  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, metalness: 0 });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), i * span + offset);
    m.compose(new THREE.Vector3(0, -rand() * 0.025, 0), q, new THREE.Vector3(1, 1, 1));
    mesh.setMatrixAt(i, m);
    c.copy(colors[Math.floor(rand() * colors.length)]).offsetHSL(0, 0, (rand() - 0.5) * 0.05);
    mesh.setColorAt(i, c);
  }
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  return mesh;
}

function buildArena(scene, rand) {
  const group = new THREE.Group();
  const sand = ['#e6c091', '#dcb183', '#ecca9c', '#d8a978'].map((h) => new THREE.Color(h));
  const sandDeep = ['#cf9f72', '#c79466', '#d6a87a'].map((h) => new THREE.Color(h));
  const clay = ['#c9785a', '#bd6b50', '#d38566'].map((h) => new THREE.Color(h));
  const rings = [
    [1.0, 3.1, 10],
    [3.1, 5.3, 16],
    [5.3, 7.5, 22],
    [7.5, BOSS.armReach - 1.4, 28],
    [BOSS.armReach - 1.15, ARENA_RADIUS, 36],
  ];
  rings.forEach(([r0, r1, n], i) => {
    const colors = i === rings.length - 1 ? clay : i % 2 ? sandDeep : sand;
    group.add(tileRing(r0, r1, n, colors, rand, i * 0.37));
  });

  // Grout bed under the tiles.
  const bed = new THREE.Mesh(
    new THREE.CylinderGeometry(ARENA_RADIUS + 0.05, ARENA_RADIUS + 0.05, 0.3, 96),
    new THREE.MeshStandardMaterial({ color: '#3b2340', roughness: 1 })
  );
  bed.position.y = -0.2;
  bed.receiveShadow = true;
  group.add(bed);

  // Gold inlay ring and gold trim at the rim.
  const gold = new THREE.MeshStandardMaterial({ color: '#ffcf7a', emissive: '#ff9d3c', emissiveIntensity: 1.1, roughness: 0.35, metalness: 0.6 });
  const inlay = new THREE.Mesh(new THREE.RingGeometry(BOSS.armReach - 1.36, BOSS.armReach - 1.2, 128), gold);
  inlay.rotation.x = -Math.PI / 2;
  inlay.position.y = -0.005;
  group.add(inlay);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(ARENA_RADIUS + 0.05, 0.07, 8, 160), gold);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = -0.04;
  group.add(rim);

  group.add(buildUnderside(rand));
  scene.add(group);
  return group;
}

function buildUnderside(rand) {
  const R = ARENA_RADIUS + 0.3;
  const profile = [
    [R, -0.33],
    [R + 0.25, -0.7],
    [R - 0.2, -1.4],
    [R - 1.6, -2.5],
    [R - 3.6, -3.9],
    [R - 6.0, -5.8],
    [R - 8.4, -8.0],
    [R - 10.4, -10.6],
    [0.2, -13.2],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const geo = new THREE.LatheGeometry(profile, 56);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const moss = new THREE.Color('#5f9a4e');
  const mossDark = new THREE.Color('#3f6f3e');
  const rockTop = new THREE.Color('#7a4f6a');
  const rockLow = new THREE.Color('#3a2242');
  const c = new THREE.Color();
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const ang = Math.atan2(v.z, v.x);
    if (v.y < -0.5) {
      const n = noise2(ang * 4, v.y * 0.6) - 0.5;
      const push = 1 + n * 0.22;
      v.x *= push;
      v.z *= push;
      v.y += (noise2(ang * 7, v.y) - 0.5) * 0.6;
    }
    const mossLine = -0.9 - noise2(ang * 9, 3) * 0.9;
    if (v.y > mossLine) {
      c.copy(moss).lerp(mossDark, noise2(ang * 11, v.y * 3));
    } else {
      const t = THREE.MathUtils.clamp(-v.y / 13, 0, 1);
      c.copy(rockTop).lerp(rockLow, t).offsetHSL(0, 0, (noise2(ang * 5, v.y) - 0.5) * 0.06);
    }
    pos.setXYZ(i, v.x, v.y, v.z);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const rock = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }));
  rock.receiveShadow = true;

  const group = new THREE.Group();
  group.add(rock);

  // Glowing crystal clusters poking out of the rock.
  const crystalMat = new THREE.MeshStandardMaterial({ color: '#8ff0ff', emissive: '#35c8ff', emissiveIntensity: 2.4, roughness: 0.2 });
  const crystalGeo = new THREE.OctahedronGeometry(0.5, 0);
  for (let i = 0; i < 9; i++) {
    const ang = (i / 9) * Math.PI * 2 + rand() * 0.4;
    const depth = 1.6 + rand() * 6;
    const radius = (R - 1) * (1 - depth / 14) + 0.2;
    const cluster = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const cr = new THREE.Mesh(crystalGeo, crystalMat);
      cr.scale.set(0.35 + rand() * 0.25, 0.9 + rand() * 1.1, 0.35 + rand() * 0.25);
      cr.position.set((rand() - 0.5) * 0.5, 0, (rand() - 0.5) * 0.5);
      cr.rotation.set((rand() - 0.5) * 0.8, rand() * Math.PI, (rand() - 0.5) * 0.8);
      cluster.add(cr);
    }
    cluster.position.set(Math.cos(ang) * radius, -depth, Math.sin(ang) * radius);
    cluster.lookAt(Math.cos(ang) * (radius + 3), -depth - 1.5, Math.sin(ang) * (radius + 3));
    cluster.rotateX(Math.PI / 2);
    group.add(cluster);
  }
  return group;
}

// ---------- scenery ----------

function buildLanterns(group, rand) {
  const lanterns = [];
  const bodyGeo = new THREE.CylinderGeometry(0.24, 0.2, 0.46, 10);
  const capGeo = new THREE.CylinderGeometry(0.13, 0.26, 0.1, 10);
  const bodyMat = new THREE.MeshStandardMaterial({ color: '#ffd29a', emissive: '#ff9a3c', emissiveIntensity: 2.6, roughness: 0.6 });
  const capMat = new THREE.MeshStandardMaterial({ color: '#4a2a36', roughness: 0.7 });
  const halo = new THREE.SpriteMaterial({ map: textures().glow, color: '#ff9d52', transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending });
  for (let i = 0; i < 14; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    const top = new THREE.Mesh(capGeo, capMat);
    top.position.y = 0.28;
    const bottom = new THREE.Mesh(capGeo, capMat);
    bottom.position.y = -0.28;
    bottom.rotation.x = Math.PI;
    const glow = new THREE.Sprite(halo);
    glow.scale.setScalar(1.8);
    g.add(body, top, bottom, glow);
    const ang = (i / 14) * Math.PI * 2 + rand() * 0.25;
    const r = ARENA_RADIUS + 2.2 + rand() * 2.5;
    g.position.set(Math.cos(ang) * r, 0.6 + rand() * 2.6, Math.sin(ang) * r);
    g.userData = { baseY: g.position.y, phase: rand() * Math.PI * 2, speed: 0.6 + rand() * 0.5 };
    group.add(g);
    lanterns.push(g);
  }
  return lanterns;
}

function buildIslet(rand, scale) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(3, 2.7, 0.8, 9),
    new THREE.MeshStandardMaterial({ color: '#6aa35a', roughness: 1, flatShading: true })
  );
  g.add(top);
  const rockGeo = new THREE.ConeGeometry(2.8, 5 + rand() * 3, 9, 3);
  rockGeo.rotateX(Math.PI);
  const p = rockGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = 1 + (hash2(i, 7) - 0.5) * 0.35;
    p.setX(i, p.getX(i) * k);
    p.setZ(i, p.getZ(i) * k);
  }
  rockGeo.computeVertexNormals();
  const rock = new THREE.Mesh(rockGeo, new THREE.MeshStandardMaterial({ color: '#6d4262', roughness: 1, flatShading: true }));
  rock.position.y = -0.4 - rockGeo.parameters.height / 2;
  g.add(rock);
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#6b4632', roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: rand() > 0.5 ? '#ff9fb8' : '#7fc86a', roughness: 0.9, flatShading: true });
  const trees = 1 + Math.floor(rand() * 3);
  for (let i = 0; i < trees; i++) {
    const t = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.1, 6), trunkMat);
    trunk.position.y = 0.55;
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9 + rand() * 0.4, 0), leafMat);
    crown.position.y = 1.5;
    t.add(trunk, crown);
    const a = rand() * Math.PI * 2;
    const r = rand() * 1.8;
    t.position.set(Math.cos(a) * r, 0.4, Math.sin(a) * r);
    g.add(t);
  }
  g.scale.setScalar(scale);
  return g;
}

function buildDistantIslands(scene, rand) {
  const islets = [];
  for (let i = 0; i < 9; i++) {
    const g = buildIslet(rand, 0.7 + rand() * 1.1);
    const ang = (i / 9) * Math.PI * 2 + rand() * 0.4;
    const dist = 70 + rand() * 45;
    let x = Math.cos(ang) * dist;
    const z = -45 + Math.sin(ang) * dist;
    if (Math.abs(x) < 38) x = Math.sign(x || 1) * (38 + rand() * 10);
    g.position.set(x, -8 + rand() * 12, z);
    g.rotation.y = rand() * Math.PI;
    g.userData = { baseY: g.position.y, phase: rand() * 6.28 };
    scene.add(g);
    islets.push(g);
  }
  return islets;
}

function buildMotes(scene, rand) {
  const count = 260;
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const ang = rand() * Math.PI * 2;
    const r = 4 + rand() * 30;
    positions[i * 3] = Math.cos(ang) * r;
    positions[i * 3 + 1] = -6 + rand() * 16;
    positions[i * 3 + 2] = Math.sin(ang) * r;
    speeds[i] = 0.2 + rand() * 0.4;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.16,
    map: textures().glow,
    color: '#ffd9a8',
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);
  const update = (dt, t) => {
    const p = geo.attributes.position;
    for (let i = 0; i < count; i++) {
      let y = p.getY(i) + speeds[i] * dt;
      if (y > 10) y = -6;
      p.setY(i, y);
      p.setX(i, p.getX(i) + Math.sin(t * 0.3 + i) * 0.002);
    }
    p.needsUpdate = true;
  };
  return { points, update };
}

function buildHub(group) {
  const stone = new THREE.MeshStandardMaterial({ color: '#4a3150', roughness: 0.75 });
  const gold = new THREE.MeshStandardMaterial({ color: '#ffcf7a', emissive: '#ff9d3c', emissiveIntensity: 0.9, metalness: 0.7, roughness: 0.3 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1, 0.5, 32), stone);
  base.position.y = 0.25;
  base.castShadow = true;
  base.receiveShadow = true;
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.045, 8, 48), gold);
  band.rotation.x = Math.PI / 2;
  band.position.y = 0.44;
  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.36, 0),
    new THREE.MeshStandardMaterial({ color: '#c9f6ff', emissive: '#4fd8ff', emissiveIntensity: 3, roughness: 0.2 })
  );
  core.position.y = 1.05;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.035, 8, 48), gold);
  ring.position.y = 1.05;
  const hub = new THREE.Group();
  hub.add(base, band, core, ring);
  group.add(hub);
  const update = (dt, t) => {
    core.rotation.y += dt * 1.6;
    core.position.y = 1.05 + Math.sin(t * 2.2) * 0.07;
    ring.rotation.x = Math.PI / 2 + Math.sin(t * 1.3) * 0.4;
    ring.rotation.y += dt;
  };
  return { hub, update };
}

// The World Spire: the story's goal, always looming on the horizon.
function buildSpire(scene) {
  const tint = PALETTE.horizon.clone().lerp(PALETTE.skyMid, 0.55);
  const rock = new THREE.MeshBasicMaterial({ color: tint.clone().multiplyScalar(0.75), fog: false });
  const rockDark = new THREE.MeshBasicMaterial({ color: tint.clone().multiplyScalar(0.55), fog: false });
  const glow = new THREE.MeshBasicMaterial({ color: '#bff4ff', fog: false });
  const g = new THREE.Group();
  const segments = [
    [26, 20, 60, -40],
    [18, 13, 55, 20],
    [12, 8, 45, 70],
    [7, 3, 30, 108],
  ];
  segments.forEach(([r0, r1, h, y], i) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, h, 7), i % 2 ? rock : rockDark);
    m.position.y = y + h / 2;
    m.rotation.y = i * 0.4;
    g.add(m);
  });
  const shards = [];
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Mesh(new THREE.OctahedronGeometry(3 + (i % 3), 0), i === 0 ? glow : rock);
    const a = (i / 7) * Math.PI * 2;
    s.position.set(Math.cos(a) * 22, 150 + (i % 3) * 8, Math.sin(a) * 22);
    s.userData.a = a;
    g.add(s);
    shards.push(s);
  }
  const crown = new THREE.Mesh(new THREE.OctahedronGeometry(9, 0), glow);
  crown.position.y = 158;
  crown.scale.y = 1.6;
  g.add(crown);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures().glow, color: '#8fe8ff', transparent: true, opacity: 0.7, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
  halo.position.y = 158;
  halo.scale.setScalar(80);
  g.add(halo);
  g.position.set(55, -70, -330);
  g.renderOrder = -8;
  scene.add(g);
  return (t) => {
    crown.rotation.y = t * 0.15;
    shards.forEach((s, i) => {
      const a = s.userData.a + t * 0.04;
      s.position.x = Math.cos(a) * 22;
      s.position.z = Math.sin(a) * 22;
      s.rotation.y = t * 0.3 + i;
    });
  };
}

// ---------- lights ----------

const KEY_OFFSET = new THREE.Vector3(10, 24, 14);

function buildLights(scene) {
  scene.add(new THREE.HemisphereLight('#ffd2c6', '#3d2150', 0.95));

  const key = new THREE.DirectionalLight('#ffe0bd', 2.6);
  key.position.copy(KEY_OFFSET);
  scene.add(key.target);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const s = ARENA_RADIUS + 3;
  Object.assign(key.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 70 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.03;
  scene.add(key);

  const rim = new THREE.DirectionalLight('#9fb2ff', 1.0);
  rim.position.set(-14, 9, -16);
  scene.add(rim);
  return key;
}

export function buildEnvironment(scene) {
  const rand = seededRandom(20240917);
  scene.fog = new THREE.Fog(PALETTE.fog, 55, 190);
  const sunDir = new THREE.Vector3(-0.45, 0.1, -1).normalize();

  buildSky(scene, sunDir);
  const clouds = [
    buildCloudLayer(scene, { y: -16, scale: 0.03, speed: 0.35, coverage: 0.46, alpha: 0.92, lit: PALETTE.cloudLit, shade: PALETTE.cloudShade }),
    buildCloudLayer(scene, {
      y: -30,
      scale: 0.018,
      speed: 0.18,
      coverage: 0.2,
      alpha: 1,
      lit: PALETTE.cloudLit.clone().lerp(PALETTE.cloudShade, 0.35),
      shade: PALETTE.cloudShade.clone().multiplyScalar(0.7),
    }),
  ];
  const key = buildLights(scene);
  const plaza = buildArena(scene, rand);
  const hub = buildHub(plaza);
  const lanterns = buildLanterns(plaza, rand);
  const islets = buildDistantIslands(scene, rand);
  const motes = buildMotes(scene, rand);
  const updateSpire = buildSpire(scene);

  return {
    plaza,
    // The boss arena reuses the plaza floor but not its centre crystal.
    setPlaza(visible, { hub: showHub = true } = {}) {
      plaza.visible = visible;
      hub.hub.visible = showHub;
    },
    // Keep the shadow-casting light (and ambient motes) centred on the action.
    setFocus(v) {
      key.target.position.copy(v);
      key.position.copy(v).add(KEY_OFFSET);
      motes.points.position.set(v.x, 0, v.z);
    },
    update(dt, t) {
      hub.update(dt, t);
      updateSpire(t);
      for (const c of clouds) c.uniforms.uTime.value = t;
      for (const l of lanterns) {
        const u = l.userData;
        l.position.y = u.baseY + Math.sin(t * u.speed + u.phase) * 0.25;
        l.rotation.y = Math.sin(t * 0.4 + u.phase) * 0.3;
      }
      for (const g of islets) g.position.y = g.userData.baseY + Math.sin(t * 0.25 + g.userData.phase) * 0.6;
      motes.update(dt, t);
    },
  };
}
