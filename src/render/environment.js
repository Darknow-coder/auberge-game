// Ciel, astres, montagnes en parallaxe, nuages.
import { mix, shade, hash2, clamp, lerp } from '../core/util.js';

const SKY_KEYS = [
  [0, '#08102b', '#16224a'], [4.5, '#0e1638', '#2a2f5e'], [5.8, '#3a4f8f', '#e39b7f'], [7, '#6e9ed6', '#f3d2a8'],
  [9, '#5f9be0', '#cfe6f4'], [16, '#649fde', '#dcecf4'], [18.2, '#6b8cc9', '#f3c48e'], [19.4, '#4a5a9e', '#ee8f68'],
  [20.6, '#222c62', '#6a4f7e'], [22, '#0d1532', '#202a52'], [24, '#08102b', '#16224a'],
];
const GREY = { soleil: 0, nuages: 0.35, pluie: 0.62, orage: 0.78, brouillard: 0.55, neige: 0.5, tempete: 0.75 };

export function skyColors(hf, weather) {
  let a = SKY_KEYS[0], b = SKY_KEYS[1];
  for (let i = 0; i < SKY_KEYS.length - 1; i++) if (hf >= SKY_KEYS[i][0] && hf < SKY_KEYS[i + 1][0]) { a = SKY_KEYS[i]; b = SKY_KEYS[i + 1]; break; }
  const t = (hf - a[0]) / (b[0] - a[0]);
  let top = mix(a[1], b[1], t), bot = mix(a[2], b[2], t);
  const g = GREY[weather] || 0;
  if (g) { top = mix(top, shade('#7f8a99', darkness(hf, 'soleil') * -1.2), g); bot = mix(bot, shade('#a3abb5', darkness(hf, 'soleil') * -1.2), g); }
  return [top, bot];
}

/** Obscurité (0 jour – ~0.62 nuit) selon l'heure et la météo. */
export function darkness(hf, weather) {
  let d;
  if (hf < 5) d = 0.62;
  else if (hf < 7.2) d = lerp(0.62, 0, (hf - 5) / 2.2);
  else if (hf < 18.3) d = 0;
  else if (hf < 21) d = lerp(0, 0.62, (hf - 18.3) / 2.7);
  else d = 0.62;
  const w = { pluie: 0.12, orage: 0.2, brouillard: 0.08, neige: 0.06, tempete: 0.18, nuages: 0.04 }[weather] || 0;
  return clamp(d + w * (1 - d), 0, 0.7);
}
/** Teinte chaude de l'aube et du crépuscule (0..1). */
export function golden(hf) {
  if (hf > 5.5 && hf < 8) return Math.sin(((hf - 5.5) / 2.5) * Math.PI);
  if (hf > 17.3 && hf < 20.4) return Math.sin(((hf - 17.3) / 3.1) * Math.PI);
  return 0;
}

// ---------------------------------------------------------------- Montagnes

function ridge(seed, n, rough, amp) {
  // déplacement du point médian
  const pts = new Float32Array(n + 1);
  pts[0] = hash2(seed, 1, 3) * amp; pts[n] = hash2(seed, 2, 3) * amp;
  let step = n, scale = amp;
  while (step > 1) {
    const half = step / 2;
    for (let i = half; i < n; i += step) pts[i] = (pts[i - half] + pts[i + half]) / 2 + (hash2(seed, i, step) - 0.5) * scale;
    scale *= rough;
    step = half;
  }
  return pts;
}

const LAYERS = [
  { f: 0.08, seed: 7, base: -760, v: 0.1, amp: 520, rough: 0.56, col: ['#9fb3cf', '#a6b6cc', '#b8a9a6', '#b9c6d8'], snow: [0.55, 0.3, 0.42, 0.95] },
  { f: 0.2, seed: 19, base: -470, v: 0.26, amp: 400, rough: 0.52, col: ['#6f8aa3', '#728b9c', '#8a7f86', '#9fb1c6'], snow: [0.32, 0.12, 0.22, 0.9] },
  { f: 0.38, seed: 31, base: -120, v: 0.42, amp: 170, rough: 0.5, col: ['#476b55', '#4b6a4a', '#6b6440', '#cbd8e2'], snow: [0, 0, 0, 0.6], trees: true },
];

/** Construit les calques de montagnes pour une saison (canvas larges, en pixels monde). */
export function buildMountains(season) {
  const W = 6400, H = 2600, OX = -3200, OY = -1400;
  return LAYERS.map((L, li) => {
    const c = document.createElement('canvas');
    c.width = W / 2; c.height = H / 2;
    const ctx = c.getContext('2d');
    ctx.scale(0.5, 0.5);
    ctx.translate(-OX, -OY);
    const n = 256;
    const pts = ridge(L.seed, n, L.rough, L.amp);
    const xs = (i) => OX + (i / n) * W;
    const ys = (i) => L.base + Math.abs(xs(i)) * L.v - pts[i] + L.amp * 0.5;
    const col = L.col[season];
    const g = ctx.createLinearGradient(0, L.base - L.amp, 0, L.base + 900);
    g.addColorStop(0, shade(col, 0.08)); g.addColorStop(1, shade(col, -0.18));
    ctx.beginPath(); ctx.moveTo(OX, OY + H);
    for (let i = 0; i <= n; i++) ctx.lineTo(xs(i), ys(i));
    ctx.lineTo(OX + W, OY + H); ctx.closePath();
    ctx.fillStyle = g; ctx.fill();
    ctx.save();
    ctx.beginPath(); ctx.moveTo(OX, OY + H);
    for (let i = 0; i <= n; i++) ctx.lineTo(xs(i), ys(i));
    ctx.lineTo(OX + W, OY + H); ctx.closePath(); ctx.clip();
    // Versants ombrés
    for (let i = 2; i < n - 2; i++) {
      if (pts[i] > pts[i - 1] && pts[i] > pts[i + 1]) {
        const px = xs(i), py = ys(i);
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + 120 + hash2(i, li, 1) * 160, py + 600); ctx.lineTo(px + 10, py + 700); ctx.closePath();
        ctx.fillStyle = 'rgba(20,30,50,0.13)'; ctx.fill();
      }
    }
    // Neige au-dessus de la limite
    if (L.snow[season] > 0) {
      const lim = L.base - L.amp * 0.5 + L.amp * (1 - L.snow[season]) * 1.6;
      ctx.beginPath(); ctx.moveTo(OX, OY);
      for (let i = 0; i <= n; i++) {
        const wob = Math.sin(i * 1.7) * 18 + hash2(i, li, 9) * 30;
        const y0 = ys(i);
        ctx.lineTo(xs(i), Math.max(y0, Math.min(y0 + 110 + wob, lim + Math.abs(xs(i)) * L.v + wob)));
      }
      ctx.lineTo(OX + W, OY); ctx.closePath();
      const sg = ctx.createLinearGradient(0, L.base - L.amp, 0, lim + 300);
      sg.addColorStop(0, '#ffffff'); sg.addColorStop(1, '#d9e3ee');
      ctx.fillStyle = sg; ctx.fill();
    }
    ctx.restore();
    // Sapins en silhouette sur la colline proche
    if (L.trees) {
      const tc = season === 3 ? '#3f5a50' : season === 2 ? '#4f5a32' : '#2f4f3a';
      for (let k = 0; k < 900; k++) {
        const i = Math.floor(hash2(k, 5, 5) * n);
        const px = xs(i) + (hash2(k, 6, 6) - 0.5) * 20, py = ys(i) + hash2(k, 7, 7) * 260 + 10;
        const h = 18 + hash2(k, 8, 8) * 26;
        ctx.fillStyle = season === 2 && hash2(k, 9, 9) < 0.35 ? '#a4672e' : tc;
        ctx.beginPath(); ctx.moveTo(px - h * 0.28, py); ctx.lineTo(px, py - h); ctx.lineTo(px + h * 0.28, py); ctx.fill();
        if (season === 3) { ctx.fillStyle = 'rgba(240,245,250,0.8)'; ctx.beginPath(); ctx.moveTo(px - h * 0.12, py - h * 0.55); ctx.lineTo(px, py - h); ctx.lineTo(px + h * 0.12, py - h * 0.55); ctx.fill(); }
      }
    }
    return { canvas: c, f: L.f, ox: OX, oy: OY, w: W, h: H };
  });
}

// ---------------------------------------------------------------- Nuages

export function makeClouds() {
  const out = [];
  for (let k = 0; k < 9; k++) {
    const c = document.createElement('canvas');
    const w = 260 + hash2(k, 1, 1) * 200, h = 90;
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    for (let i = 0; i < 9; i++) {
      const x = 40 + hash2(k, i, 2) * (w - 80), y = 50 + (hash2(k, i, 3) - 0.5) * 20, r = 22 + hash2(k, i, 4) * 26;
      const g = ctx.createRadialGradient(x, y - r * 0.3, r * 0.2, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    }
    out.push({ canvas: c, x: hash2(k, 9, 9) * 4000 - 2000, y: -1250 + hash2(k, 8, 8) * 600, speed: 4 + hash2(k, 7, 7) * 6, s: 0.8 + hash2(k, 6, 6) * 0.8 });
  }
  return out;
}

export function makeStars(n = 160) {
  const s = [];
  for (let k = 0; k < n; k++) s.push([hash2(k, 1, 77), hash2(k, 2, 77) * 0.55, 0.4 + hash2(k, 3, 77) * 1.2, hash2(k, 4, 77) * 6]);
  return s;
}
