import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { BOSS } from '@shared/constants.js';
import { textures } from './textures.js';
import { heartGeometry } from './platforms.js';

const ARENA_RADIUS = 12;

// Chapter one takes place inside the family shed, seen from doll height:
// sunlit dust, warm pine, and everything enormous.
const PALETTE = {
  fog: new THREE.Color('#d8b98e'),
  sky: new THREE.Color('#9fd3f2'),
  skyLow: new THREE.Color('#e8f4ff'),
  sun: new THREE.Color('#fff2cf'),
  wall: '#b98656',
  floor: '#8f6038',
};

// The room: everything at doll scale, so a paint tin is a tower.
const ROOM = { x: 170, zNear: 160, zFar: -300, floor: -34, ceil: 150 };

function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function canvasRepeat(w, h, draw, repeat = [1, 1]) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(...repeat);
  tex.anisotropy = 8;
  return tex;
}

// Wide boards with dark gaps, used for the shed's walls and floor.
function boardTexture(base, rand, boards = 8, repeat = [1, 1]) {
  return canvasRepeat(
    512,
    512,
    (ctx, w, h) => {
      const col = new THREE.Color(base);
      const bw = w / boards;
      for (let i = 0; i < boards; i++) {
        const t = col.clone().offsetHSL(0, 0, (rand() - 0.5) * 0.08);
        ctx.fillStyle = `#${t.getHexString()}`;
        ctx.fillRect(i * bw, 0, bw, h);
        for (let k = 0; k < 14; k++) {
          ctx.strokeStyle = `rgba(60, 30, 10, ${0.04 + rand() * 0.08})`;
          ctx.lineWidth = 1 + rand() * 2;
          const x0 = i * bw + rand() * bw;
          ctx.beginPath();
          ctx.moveTo(x0, 0);
          for (let y = 0; y <= h; y += 24) ctx.lineTo(x0 + Math.sin(y * 0.02 + k) * 4, y);
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(40, 20, 8, 0.7)';
        ctx.fillRect(i * bw, 0, 4, h);
        // nail heads
        ctx.fillStyle = 'rgba(50, 45, 40, 0.8)';
        for (const y of [h * 0.12, h * 0.88]) {
          ctx.beginPath();
          ctx.arc(i * bw + bw / 2, y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
    repeat
  );
}

// ---------- the room ----------

function buildRoom(scene, rand) {
  const group = new THREE.Group();
  const width = ROOM.x * 2;
  const depth = ROOM.zNear - ROOM.zFar;
  const height = ROOM.ceil - ROOM.floor;
  const cz = (ROOM.zNear + ROOM.zFar) / 2;

  const wallTex = boardTexture(PALETTE.wall, rand, 10, [6, 3]);
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9 });
  const sideTex = wallTex.clone();
  sideTex.repeat.set(8, 3);
  sideTex.needsUpdate = true;
  const sideMat = new THREE.MeshStandardMaterial({ map: sideTex, roughness: 0.9 });

  const floorTex = boardTexture(PALETTE.floor, rand, 6, [10, 14]);
  floorTex.rotation = Math.PI / 2;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, ROOM.floor, cz);
  floor.receiveShadow = true;

  const back = new THREE.Mesh(new THREE.PlaneGeometry(width, height), wallMat);
  back.position.set(0, ROOM.floor + height / 2, ROOM.zFar);
  const front = back.clone();
  front.rotation.y = Math.PI;
  front.position.z = ROOM.zNear;
  const left = new THREE.Mesh(new THREE.PlaneGeometry(depth, height), sideMat);
  left.rotation.y = Math.PI / 2;
  left.position.set(-ROOM.x, ROOM.floor + height / 2, cz);
  const right = left.clone();
  right.rotation.y = -Math.PI / 2;
  right.position.x = ROOM.x;

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), new THREE.MeshStandardMaterial({ color: '#6e4a2c', roughness: 1 }));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, ROOM.ceil, cz);

  // Rafters across the roof.
  const beamMat = new THREE.MeshStandardMaterial({ color: '#7a5130', roughness: 0.9 });
  for (let z = ROOM.zNear - 40; z > ROOM.zFar; z -= 70) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(width, 8, 8), beamMat);
    beam.position.set(0, ROOM.ceil - 10, z);
    group.add(beam);
  }

  group.add(floor, back, front, left, right, ceiling);
  scene.add(group);
  return group;
}

// The sunlit window on the back wall, with crossbars and a crack in one pane.
function buildWindow(scene) {
  const g = new THREE.Group();
  const w = 120;
  const h = 80;
  const sky = canvasRepeat(256, 256, (ctx, cw, ch) => {
    const grad = ctx.createLinearGradient(0, 0, 0, ch);
    grad.addColorStop(0, '#7fc3ee');
    grad.addColorStop(0.65, '#cfe9fb');
    grad.addColorStop(1, '#f6fbff');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cw, ch);
    // soft clouds
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (const [x, y, r] of [
      [50, 70, 22],
      [75, 64, 28],
      [100, 72, 20],
      [180, 110, 18],
      [200, 104, 24],
      [222, 112, 16],
    ]) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // the garden hedge along the bottom
    ctx.fillStyle = '#6fae4f';
    for (let x = 0; x < cw; x += 18) {
      ctx.beginPath();
      ctx.arc(x, ch - 18, 22, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: sky, fog: false, toneMapped: false }));
  g.add(pane);

  const frameMat = new THREE.MeshStandardMaterial({ color: '#f3ede2', roughness: 0.6 });
  const bar = (bw, bh, x, y) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 4), frameMat);
    m.position.set(x, y, 2);
    g.add(m);
  };
  bar(w + 8, 6, 0, h / 2 + 1);
  bar(w + 8, 6, 0, -h / 2 - 1);
  bar(6, h + 8, -w / 2 - 1, 0);
  bar(6, h + 8, w / 2 + 1, 0);
  bar(w, 3.5, 0, 0);
  bar(3.5, h, 0, 0);
  // Sill.
  const sill = new THREE.Mesh(new THREE.BoxGeometry(w + 20, 3, 12), frameMat);
  sill.position.set(0, -h / 2 - 4, 6);
  g.add(sill);

  // The cracked pane the draft blows through.
  const crack = new THREE.Mesh(
    new THREE.PlaneGeometry(w / 2 - 4, h / 2 - 4),
    new THREE.MeshBasicMaterial({
      map: canvasRepeat(128, 128, (ctx) => {
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(84, 40);
          ctx.lineTo(84 + Math.cos(a) * 60, 40 + Math.sin(a) * 60);
          ctx.stroke();
        }
      }),
      transparent: true,
      fog: false,
      depthWrite: false,
    })
  );
  crack.position.set(w / 4, h / 4, 0.5);
  g.add(crack);

  g.position.set(30, 62, ROOM.zFar + 1);
  scene.add(g);

  // Sun shafts slanting in from the window.
  const shaftTex = canvasRepeat(64, 256, (ctx, cw, ch) => {
    const grad = ctx.createLinearGradient(0, 0, 0, ch);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cw, ch);
    const side = ctx.createLinearGradient(0, 0, cw, 0);
    side.addColorStop(0, 'rgba(0,0,0,1)');
    side.addColorStop(0.3, 'rgba(0,0,0,0)');
    side.addColorStop(0.7, 'rgba(0,0,0,0)');
    side.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = side;
    ctx.fillRect(0, 0, cw, ch);
  });
  const shafts = [];
  [
    [-28, 0],
    [8, 0.6],
    [44, 1.3],
    [72, 2],
  ].forEach(([x, phase]) => {
    const mat = new THREE.MeshBasicMaterial({
      map: shaftTex,
      color: PALETTE.sun,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      fog: false,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(26, 260), mat);
    m.position.set(x, 30, ROOM.zFar + 120);
    m.rotation.set(-1.05, 0, 0.12);
    m.userData.phase = phase;
    scene.add(m);
    shafts.push(m);
  });
  return shafts;
}

// Giant shelving, tins and tools around the edges of the room.
function buildShedProps(scene, rand) {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: '#a8733f', roughness: 0.85 });
  const tinColors = ['#3f7fd8', '#e0563f', '#f2c94c', '#4f9e3f', '#d9578f', '#f3ede2'];
  const steel = new THREE.MeshStandardMaterial({ color: '#b9b4ab', roughness: 0.35, metalness: 0.6 });

  // Wall shelves on both sides, stacked with tins and jars.
  for (const side of [-1, 1]) {
    for (let level = 0; level < 3; level++) {
      const y = ROOM.floor + 30 + level * 42;
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(34, 3, 260), wood);
      shelf.position.set(side * (ROOM.x - 17), y, -70);
      shelf.receiveShadow = true;
      g.add(shelf);
      for (let z = -190; z < 50; z += 22 + rand() * 18) {
        const r = 6 + rand() * 5;
        const hgt = 12 + rand() * 14;
        const tin = new THREE.Mesh(new THREE.CylinderGeometry(r, r, hgt, 24), steel);
        tin.position.set(side * (ROOM.x - 14 - rand() * 6), y + 1.5 + hgt / 2, z);
        const label = new THREE.Mesh(
          new THREE.CylinderGeometry(r + 0.1, r + 0.1, hgt * 0.6, 24, 1, true),
          new THREE.MeshStandardMaterial({ color: tinColors[Math.floor(rand() * tinColors.length)], roughness: 0.7 })
        );
        label.position.copy(tin.position);
        g.add(tin, label);
      }
    }
  }

  // A pegboard behind the level with a hammer and a saw hanging on it.
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 70),
    new THREE.MeshStandardMaterial({
      color: '#c9a273',
      roughness: 0.95,
      map: canvasRepeat(
        128,
        128,
        (ctx, w, h) => {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.fillStyle = 'rgba(60, 35, 15, 0.55)';
          for (let x = 8; x < w; x += 16) for (let y = 8; y < h; y += 16) {
            ctx.beginPath();
            ctx.arc(x, y, 2.2, 0, Math.PI * 2);
            ctx.fill();
          }
        },
        [6, 3.5]
      ),
    })
  );
  board.position.set(-75, 50, ROOM.zFar + 2);
  g.add(board);
  const handle = new THREE.MeshStandardMaterial({ color: '#c8323c', roughness: 0.5 });
  const hammer = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 44, 12), handle);
  const head = new THREE.Mesh(new RoundedBoxGeometry(22, 8, 8, 2, 1.5), steel);
  head.position.y = 24;
  hammer.add(shaft, head);
  hammer.position.set(-100, 48, ROOM.zFar + 8);
  hammer.rotation.z = 0.2;
  const saw = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.BoxGeometry(56, 16, 0.6), steel);
  const grip = new THREE.Mesh(new RoundedBoxGeometry(14, 16, 4, 2, 2), wood);
  grip.position.x = 33;
  saw.add(blade, grip);
  saw.position.set(-58, 58, ROOM.zFar + 6);
  saw.rotation.z = -0.1;
  g.add(hammer, saw);

  // A hanging bulb from the rafters.
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 60, 6), new THREE.MeshStandardMaterial({ color: '#2d2a26' }));
  cord.position.set(-40, ROOM.ceil - 40, -140);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(5, 20, 16), new THREE.MeshStandardMaterial({ color: '#fff6dc', emissive: '#ffd27a', emissiveIntensity: 2.2 }));
  bulb.position.set(-40, ROOM.ceil - 74, -140);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures().glow, color: '#ffd27a', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.position.copy(bulb.position);
  halo.scale.setScalar(40);
  g.add(cord, bulb, halo);

  // Enormous paint tins standing on the floor, far below the play area.
  for (let i = 0; i < 10; i++) {
    const r = 10 + rand() * 8;
    const hgt = 24 + rand() * 12;
    const ang = rand() * Math.PI * 2;
    const dist = 110 + rand() * 60;
    const x = Math.cos(ang) * dist;
    const z = -45 + Math.sin(ang) * dist;
    const tin = new THREE.Mesh(new THREE.CylinderGeometry(r, r, hgt, 28), steel);
    tin.position.set(x, ROOM.floor + hgt / 2, z);
    const label = new THREE.Mesh(
      new THREE.CylinderGeometry(r + 0.15, r + 0.15, hgt * 0.6, 28, 1, true),
      new THREE.MeshStandardMaterial({ color: tinColors[i % tinColors.length], roughness: 0.7 })
    );
    label.position.copy(tin.position);
    g.add(tin, label);
  }

  scene.add(g);
  return g;
}

// ---------- the arena: the seat of an old wooden stool ----------

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
  const gap = 0.07 / ((r0 + r1) / 2);
  const geo = new THREE.ExtrudeGeometry(sectorShape(r0 + 0.03, r1 - 0.03, gap / 2, span - gap / 2), {
    depth: TILE_DEPTH,
    bevelEnabled: true,
    bevelThickness: TILE_BEVEL,
    bevelSize: 0.03,
    bevelSegments: 2,
    curveSegments: Math.max(4, Math.round(12 * (span / 0.6))),
  });
  geo.rotateX(Math.PI / 2);
  geo.translate(0, -TILE_BEVEL, 0);

  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75, metalness: 0 });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), i * span + offset);
    m.compose(new THREE.Vector3(0, -rand() * 0.02, 0), q, new THREE.Vector3(1, 1, 1));
    mesh.setMatrixAt(i, m);
    c.copy(colors[Math.floor(rand() * colors.length)]).offsetHSL(0, 0, (rand() - 0.5) * 0.05);
    mesh.setColorAt(i, c);
  }
  mesh.receiveShadow = true;
  return mesh;
}

function buildArena(scene, rand) {
  const group = new THREE.Group();
  const pine = ['#d9ad78', '#cf9f6a', '#e3b984', '#c99560'].map((h) => new THREE.Color(h));
  const pineDeep = ['#b9824e', '#ad7646', '#c48d58'].map((h) => new THREE.Color(h));
  const paint = ['#3f7fd8', '#3a74c8', '#4686e0'].map((h) => new THREE.Color(h));
  const rings = [
    [1.0, 3.1, 10],
    [3.1, 5.3, 16],
    [5.3, 7.5, 22],
    [7.5, BOSS.armReach - 1.4, 28],
    [BOSS.armReach - 1.15, ARENA_RADIUS, 36],
  ];
  rings.forEach(([r0, r1, n], i) => {
    // The stool's outer ring is painted, chipped blue.
    const colors = i === rings.length - 1 ? paint : i % 2 ? pineDeep : pine;
    group.add(tileRing(r0, r1, n, colors, rand, i * 0.37));
  });

  const seat = new THREE.Mesh(new THREE.CylinderGeometry(ARENA_RADIUS + 0.05, ARENA_RADIUS - 0.4, 1.4, 96), new THREE.MeshStandardMaterial({ color: '#8f5f34', roughness: 0.85 }));
  seat.position.y = -0.85;
  seat.receiveShadow = true;
  group.add(seat);

  // Painted heart-red inlay ring and a brass rim.
  const inlay = new THREE.Mesh(new THREE.RingGeometry(BOSS.armReach - 1.36, BOSS.armReach - 1.2, 128), new THREE.MeshStandardMaterial({ color: '#d8314a', roughness: 0.5 }));
  inlay.rotation.x = -Math.PI / 2;
  inlay.position.y = -0.005;
  group.add(inlay);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(ARENA_RADIUS + 0.05, 0.08, 8, 160), new THREE.MeshStandardMaterial({ color: '#e8c060', roughness: 0.35, metalness: 0.8 }));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = -0.04;
  group.add(rim);

  // Three splayed legs down to the shed floor, joined by a ring rail.
  const legMat = new THREE.MeshStandardMaterial({ color: '#8f5f34', roughness: 0.85 });
  const legLen = 36;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, legLen, 12), legMat);
    leg.position.set(Math.cos(a) * 9, -1.5 - legLen / 2, Math.sin(a) * 9);
    leg.rotation.set(Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12);
    group.add(leg);
  }
  const rail = new THREE.Mesh(new THREE.TorusGeometry(10.6, 0.5, 8, 64), legMat);
  rail.rotation.x = Math.PI / 2;
  rail.position.y = -16;
  group.add(rail);

  scene.add(group);
  return group;
}

// Dust drifting in the sunbeams.
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
    speeds[i] = 0.05 + rand() * 0.2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.12,
    map: textures().glow,
    color: '#fff3d6',
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);
  const update = (dt, t) => {
    const p = geo.attributes.position;
    for (let i = 0; i < count; i++) {
      let y = p.getY(i) + Math.sin(t * 0.4 + i) * speeds[i] * dt;
      if (y > 10) y = -6;
      p.setY(i, y);
      p.setX(i, p.getX(i) + Math.sin(t * 0.25 + i) * 0.004);
    }
    p.needsUpdate = true;
  };
  return { points, update };
}

// The lobby centrepiece: Dr. Hakim's Book of Love, open on a stand, with a heart above it.
function buildHub(group) {
  const red = new THREE.MeshStandardMaterial({ color: '#c8323c', roughness: 0.55 });
  const pages = new THREE.MeshStandardMaterial({ color: '#fbf3e4', roughness: 0.8 });
  const gold = new THREE.MeshStandardMaterial({ color: '#e8c060', roughness: 0.3, metalness: 0.8 });
  const hub = new THREE.Group();
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 0.5, 24), new THREE.MeshStandardMaterial({ color: '#8f5f34', roughness: 0.8 }));
  stand.position.y = 0.25;
  stand.castShadow = true;
  stand.receiveShadow = true;
  hub.add(stand);
  const book = new THREE.Group();
  book.position.y = 0.6;
  [1, -1].forEach((s) => {
    const cover = new THREE.Mesh(new RoundedBoxGeometry(0.75, 0.08, 1.05, 2, 0.03), red);
    cover.position.set(s * 0.38, 0, 0);
    cover.rotation.z = s * 0.18;
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.1, 0.95), pages);
    leaf.position.set(s * 0.36, 0.08, 0);
    leaf.rotation.z = s * 0.18;
    book.add(cover, leaf);
  });
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.05, 8), gold);
  spine.rotation.x = Math.PI / 2;
  book.add(spine);
  book.castShadow = true;
  hub.add(book);
  const heart = new THREE.Mesh(heartGeometry(0.3, 0.14), new THREE.MeshStandardMaterial({ color: '#ff5a76', emissive: '#d8314a', emissiveIntensity: 1.6, roughness: 0.3 }));
  heart.position.y = 1.4;
  hub.add(heart);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures().glow, color: '#ff7a95', transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.position.y = 1.4;
  glow.scale.setScalar(2);
  hub.add(glow);
  group.add(hub);
  const update = (dt, t) => {
    heart.rotation.y += dt * 1.4;
    heart.position.y = 1.4 + Math.sin(t * 2.2) * 0.08;
    glow.position.y = heart.position.y;
    const beat = 1 + Math.max(0, Math.sin(t * 5)) * 0.08;
    heart.scale.setScalar(beat);
  };
  return { hub, update };
}

// ---------- lights ----------

const KEY_OFFSET = new THREE.Vector3(-10, 26, 8);

function buildLights(scene) {
  scene.add(new THREE.HemisphereLight('#fff3dc', '#7a5232', 1.25));

  // Warm sunlight, high and from the front-left so the dolls stay readable.
  const key = new THREE.DirectionalLight('#fff0d0', 2.7);
  key.position.copy(KEY_OFFSET);
  scene.add(key.target);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const s = ARENA_RADIUS + 3;
  Object.assign(key.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 70 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.03;
  scene.add(key);

  // Cool sky bounce from the front, so faces aren't lost in silhouette.
  const fill = new THREE.DirectionalLight('#cfe6ff', 0.9);
  fill.position.set(10, 12, 20);
  scene.add(fill);
  return key;
}

export function buildEnvironment(scene) {
  const rand = seededRandom(20240917);
  scene.background = PALETTE.fog.clone();
  scene.fog = new THREE.Fog(PALETTE.fog, 70, 420);

  buildRoom(scene, rand);
  const shafts = buildWindow(scene);
  buildShedProps(scene, rand);
  const key = buildLights(scene);
  const plaza = buildArena(scene, rand);
  const hub = buildHub(plaza);
  const motes = buildMotes(scene, rand);

  return {
    plaza,
    // The boss arena reuses the stool seat but not the book on its stand.
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
      for (const s of shafts) s.material.opacity = 0.13 + Math.sin(t * 0.35 + s.userData.phase) * 0.04;
      motes.update(dt, t);
    },
  };
}
