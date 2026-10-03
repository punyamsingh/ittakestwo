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

// Square stone tiles with grout lines; `cracks` adds fractures for crumbling stone.
function tiles({ base, grout, vary = 0.08, cracks = false, seed = 3 }) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const r = rnd(seed);
  ctx.fillStyle = grout;
  ctx.fillRect(0, 0, size, size);
  const n = 2;
  const cell = size / n;
  const col = new THREE.Color(base);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const t = col.clone().offsetHSL(0, 0, (r() - 0.5) * vary);
      ctx.fillStyle = `#${t.getHexString()}`;
      ctx.fillRect(i * cell + 4, j * cell + 4, cell - 8, cell - 8);
      // speckle
      for (let k = 0; k < 90; k++) {
        ctx.fillStyle = `rgba(0,0,0,${r() * 0.06})`;
        ctx.fillRect(i * cell + 4 + r() * (cell - 10), j * cell + 4 + r() * (cell - 10), 3, 3);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(i * cell + 4, j * cell + 4, cell - 8, 3);
    }
  }
  if (cracks) {
    ctx.strokeStyle = 'rgba(40,16,12,0.8)';
    ctx.lineWidth = 3;
    for (let k = 0; k < 5; k++) {
      let x = r() * size;
      let y = r() * size;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let s = 0; s < 6; s++) {
        x += (r() - 0.5) * 70;
        y += (r() - 0.5) * 70;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
  return repeating(c);
}

function grass() {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const r = rnd(11);
  ctx.fillStyle = '#8a9a2e';
  ctx.fillRect(0, 0, size, size);
  for (let k = 0; k < 1400; k++) {
    const shade = r();
    ctx.fillStyle = shade > 0.6 ? 'rgba(160,215,110,0.5)' : shade > 0.3 ? 'rgba(70,130,60,0.45)' : 'rgba(255,210,150,0.25)';
    ctx.fillRect(r() * size, r() * size, 2 + r() * 3, 2 + r() * 3);
  }
  return repeating(c);
}

function runes(color) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const m = size / 2;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(m, m, m - 10, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(m, m, m - 34, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.save();
    ctx.translate(m + Math.cos(a) * (m - 22), m + Math.sin(a) * (m - 22));
    ctx.rotate(a);
    ctx.fillRect(-2, -8, 4, 16);
    if (i % 3 === 0) ctx.fillRect(-7, -2, 14, 4);
    ctx.restore();
  }
  ctx.lineWidth = 6;
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
    const x = m + Math.cos(a) * (m - 60);
    const y = m + Math.sin(a) * (m - 60);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();
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

function banner() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#2f4a8f');
  g.addColorStop(1, '#1d2c5a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 256);
  ctx.fillStyle = '#ffc25e';
  ctx.fillRect(0, 0, 128, 10);
  ctx.fillRect(0, 222, 128, 6);
  ctx.strokeStyle = '#ffc25e';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.roundRect(22, 90, 50, 40, 20);
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(56, 90, 50, 40, 20);
  ctx.stroke();
  // swallowtail
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.moveTo(0, 256);
  ctx.lineTo(64, 214);
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
    sand: tiles({ base: '#e2b98a', grout: '#8a5a44', seed: 3 }),
    marble: tiles({ base: '#efe4d2', grout: '#a08a70', vary: 0.05, seed: 7 }),
    crumble: tiles({ base: '#d9a878', grout: '#6d4432', vary: 0.1, cracks: true, seed: 5 }),
    grass: grass(),
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
  ctx.fillStyle = 'rgba(24, 12, 40, 0.82)';
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
  ctx.fillStyle = '#fff7ef';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, y + bh / 2 + 3);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
