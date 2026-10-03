import * as THREE from 'three';

function canvasTexture(size, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function radial(stops) {
  return canvasTexture(128, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    for (const [at, color] of stops) g.addColorStop(at, color);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });
}

let cache = null;

export function textures() {
  if (cache) return cache;
  cache = {
    blob: radial([
      [0, 'rgba(0,0,0,0.9)'],
      [0.45, 'rgba(0,0,0,0.55)'],
      [1, 'rgba(0,0,0,0)'],
    ]),
    glow: radial([
      [0, 'rgba(255,255,255,1)'],
      [0.25, 'rgba(255,255,255,0.7)'],
      [1, 'rgba(255,255,255,0)'],
    ]),
    scorch: canvasTexture(128, (ctx, s) => {
      const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0, 'rgba(20,8,6,0.85)');
      g.addColorStop(0.5, 'rgba(35,14,10,0.55)');
      g.addColorStop(1, 'rgba(35,14,10,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
      ctx.strokeStyle = 'rgba(15,6,4,0.6)';
      ctx.lineWidth = 3;
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + Math.random() * 0.4;
        ctx.beginPath();
        ctx.moveTo(s / 2 + Math.cos(a) * s * 0.12, s / 2 + Math.sin(a) * s * 0.12);
        ctx.lineTo(s / 2 + Math.cos(a) * s * (0.3 + Math.random() * 0.15), s / 2 + Math.sin(a) * s * (0.3 + Math.random() * 0.15));
        ctx.stroke();
      }
    }),
  };
  return cache;
}

function rnd(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function repeating(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

// Wooden planks running along v, with grain, knots and dark seams.
function planks({ base, seam, count = 4, seed = 3, vary = 0.08 }) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const r = rnd(seed);
  const col = new THREE.Color(base);
  const w = size / count;
  for (let i = 0; i < count; i++) {
    const t = col.clone().offsetHSL((r() - 0.5) * 0.02, 0, (r() - 0.5) * vary);
    ctx.fillStyle = `#${t.getHexString()}`;
    ctx.fillRect(i * w, 0, w, size);
    for (let k = 0; k < 9; k++) {
      ctx.strokeStyle = `rgba(70, 35, 12, ${0.05 + r() * 0.1})`;
      ctx.lineWidth = 1 + r() * 1.5;
      const x0 = i * w + 4 + r() * (w - 8);
      ctx.beginPath();
      ctx.moveTo(x0, 0);
      for (let y = 0; y <= size; y += 16) ctx.lineTo(x0 + Math.sin(y * 0.03 + k + i) * 2.5, y);
      ctx.stroke();
    }
    if (r() > 0.45) {
      ctx.fillStyle = 'rgba(80, 40, 15, 0.35)';
      ctx.beginPath();
      ctx.ellipse(i * w + w / 2 + (r() - 0.5) * w * 0.4, r() * size, 4, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // A butt joint somewhere along the plank, and the seam beside it.
    ctx.fillStyle = seam;
    ctx.fillRect(i * w, r() * size, w, 2);
    ctx.fillRect(i * w, 0, 3, size);
    ctx.fillStyle = 'rgba(255,240,210,0.12)';
    ctx.fillRect(i * w + 3, 0, 2, size);
  }
  return repeating(c);
}

// Corrugated cardboard with damp stains, tears and packing tape: it gives way.
function cardboard(seed = 5) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const r = rnd(seed);
  ctx.fillStyle = '#c99a62';
  ctx.fillRect(0, 0, size, size);
  for (let x = 0; x < size; x += 8) {
    ctx.fillStyle = 'rgba(120, 80, 40, 0.12)';
    ctx.fillRect(x, 0, 3, size);
  }
  for (let k = 0; k < 3; k++) {
    const x = r() * size;
    const y = r() * size;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 40 + r() * 60);
    g.addColorStop(0, 'rgba(90, 55, 25, 0.35)');
    g.addColorStop(1, 'rgba(90, 55, 25, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  ctx.strokeStyle = 'rgba(70, 40, 18, 0.7)';
  ctx.lineWidth = 3;
  for (let k = 0; k < 4; k++) {
    let x = r() * size;
    let y = r() * size;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 5; s++) {
      x += (r() - 0.5) * 60;
      y += (r() - 0.5) * 60;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(230, 200, 140, 0.55)';
  ctx.fillRect(0, size * 0.42, size, 34);
  return repeating(c);
}

// Cloth book cover (white, tinted per book) with a gilt border.
function bookCover(seed = 13) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const r = rnd(seed);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  for (let k = 0; k < 1600; k++) {
    ctx.fillStyle = `rgba(0,0,0,${r() * 0.07})`;
    ctx.fillRect(r() * size, r() * size, 2, 2);
  }
  ctx.strokeStyle = '#f0d488';
  ctx.lineWidth = 6;
  ctx.strokeRect(18, 18, size - 36, size - 36);
  ctx.lineWidth = 2;
  ctx.strokeRect(30, 30, size - 60, size - 60);
  return repeating(c);
}

// The lid of a paint tin: pressed rings and a splash of colour.
function tinLid(seed = 9) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const r = rnd(seed);
  const m = size / 2;
  const g = ctx.createRadialGradient(m * 0.8, m * 0.7, 10, m, m, m);
  g.addColorStop(0, '#e8e4dc');
  g.addColorStop(1, '#a9a49b');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  ctx.lineWidth = 5;
  for (const k of [0.92, 0.8, 0.5]) {
    ctx.strokeStyle = 'rgba(70, 64, 58, 0.35)';
    ctx.beginPath();
    ctx.arc(m, m, m * k, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.arc(m, m, m * k - 4, Math.PI * 1.1, Math.PI * 1.7);
    ctx.stroke();
  }
  const paints = ['#3f7fd8', '#e0563f', '#f2c94c', '#4f9e3f'];
  ctx.fillStyle = paints[Math.floor(r() * paints.length)];
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.ellipse(m * 1.45, m * 0.55, 26, 16, 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  return repeating(c);
}

// A chunky cog with a heart at its hub: the shed's buttons, goals and boss pads.
function runes(color) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const m = size / 2;
  ctx.fillStyle = color;
  ctx.beginPath();
  const teeth = 12;
  for (let i = 0; i < teeth * 2; i++) {
    const a0 = (i / (teeth * 2)) * Math.PI * 2;
    const a1 = ((i + 1) / (teeth * 2)) * Math.PI * 2;
    const rr = i % 2 ? m - 30 : m - 8;
    ctx.lineTo(m + Math.cos(a0) * rr, m + Math.sin(a0) * rr);
    ctx.lineTo(m + Math.cos(a1) * rr, m + Math.sin(a1) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(m, m, m - 52, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.beginPath();
  ctx.moveTo(m, m + 34);
  ctx.bezierCurveTo(m - 60, m - 8, m - 26, m - 52, m, m - 22);
  ctx.bezierCurveTo(m + 26, m - 52, m + 60, m - 8, m, m + 34);
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function chevrons() {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(64, 64, 56, 0, Math.PI * 2);
  ctx.stroke();
  for (const y of [78, 52]) {
    ctx.beginPath();
    ctx.moveTo(40, y + 10);
    ctx.lineTo(64, y - 10);
    ctx.lineTo(88, y + 10);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Rose's crayon drawing of her family, pinned up as a pennant.
function banner() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fbf3e4';
  ctx.fillRect(0, 0, 128, 256);
  ctx.fillStyle = '#d8314a';
  ctx.fillRect(0, 0, 128, 12);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const figure = (x, h, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(x, 150 - h, 10, 0, Math.PI * 2);
    ctx.moveTo(x, 160 - h);
    ctx.lineTo(x, 190);
    ctx.lineTo(x - 8, 212);
    ctx.moveTo(x, 190);
    ctx.lineTo(x + 8, 212);
    ctx.stroke();
  };
  figure(30, 26, '#3f7fd8');
  figure(64, 6, '#d9578f');
  figure(98, 30, '#4f9e3f');
  ctx.strokeStyle = '#7a5a3c';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(30, 152);
  ctx.lineTo(98, 152);
  ctx.stroke();
  ctx.fillStyle = '#d8314a';
  ctx.beginPath();
  ctx.moveTo(64, 92);
  ctx.bezierCurveTo(24, 66, 40, 30, 64, 52);
  ctx.bezierCurveTo(88, 30, 104, 66, 64, 92);
  ctx.fill();
  // swallowtail
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.moveTo(0, 256);
  ctx.lineTo(64, 230);
  ctx.lineTo(128, 256);
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

let levelCache = null;
const runeCache = new Map();

export function levelTextures() {
  if (levelCache) return levelCache;
  levelCache = {
    // (Keys kept from the old theme; they now hold shed surfaces.)
    grass: planks({ base: '#c48a52', seam: '#5a3418', seed: 11 }),
    sand: tinLid(9),
    marble: planks({ base: '#e6c79a', seam: '#9a7448', count: 3, seed: 7, vary: 0.05 }),
    crumble: cardboard(5),
    book: bookCover(13),
    chevrons: chevrons(),
    banner: banner(),
  };
  return levelCache;
}

export function runeTexture(color = '#ffffff') {
  if (!runeCache.has(color)) runeCache.set(color, runes(color));
  return runeCache.get(color);
}

export function labelTexture(text, color) {
  const canvas = document.createElement('canvas');
  const w = 256;
  const h = 112;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.font = '800 52px "Baloo 2", Nunito, sans-serif';
  const tw = Math.min(w - 20, ctx.measureText(text).width + 44);
  const x = (w - tw) / 2;
  const y = 8;
  const bh = 68;
  ctx.fillStyle = 'rgba(251, 243, 228, 0.95)';
  ctx.beginPath();
  ctx.roundRect(x, y, tw, bh, bh / 2);
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = color;
  ctx.stroke();
  // pointer
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(w / 2 - 14, y + bh + 4);
  ctx.lineTo(w / 2 + 14, y + bh + 4);
  ctx.lineTo(w / 2, y + bh + 26);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#3b2a20';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, y + bh / 2 + 3);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
