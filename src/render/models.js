// Modèles procéduraux : meubles (avec rotation), arbres, bâtiments du village.
import { shade, mix, hash2 } from '../core/util.js';
import { iso, box, cylinder, poly, groundEllipse, gableRoof, HW, HH, ZH } from './iso.js';
import { FURNITURE } from '../data/furniture.js';

export const C = {
  wood: '#b07a47', woodD: '#7f5230', woodL: '#d6a66e', woodR: '#9a5f36',
  linen: '#f4ede1', white: '#f7f3ec', stone: '#a39c90', stoneD: '#7d766b', metal: '#4a4f57', iron: '#2f3136',
  brass: '#caa04a', copper: '#c0703e', leaf: '#5f9a4a', leafD: '#3f7a3a', pot: '#c06a45', glass: '#bfe0ea',
  red: '#b8464b', green: '#4f7f53', blue: '#4f74a0', felt: '#2f7a4f', cream: '#ece2cf',
};
export const QUILT = { bed_single: '#c0574f', bunk_bed: '#4f7aa0', bed_double: '#5c7fa8', bed_cozy: '#8a5a9c', bed_canopy: '#9c2f3f' };

/** Fabrique un contexte de modélisation local → monde pour une rotation donnée. */
function modeler(ctx, def, rot) {
  const W = def.w, D = def.h;
  const tp = (lx, ly) => {
    switch (rot & 3) {
      case 0: return [lx, ly];
      case 1: return [D - ly, lx];
      case 2: return [W - lx, D - ly];
      default: return [ly, W - lx];
    }
  };
  const items = [];
  const push = (k, fn) => items.push({ k, fn, i: items.length });
  const m = {
    rot, tp,
    frontVisible: (rot & 3) === 0 || (rot & 3) === 1,
    box(lx, ly, lz, lw, ld, lh, col, o) {
      const [ax, ay] = tp(lx, ly), [bx, by] = tp(lx + lw, ly + ld);
      const x = Math.min(ax, bx), y = Math.min(ay, by), w = Math.abs(bx - ax), d = Math.abs(by - ay);
      push(x + w / 2 + y + d / 2 + lz * 0.02, () => box(ctx, x, y, lz, w, d, lh, col, o));
    },
    cyl(lx, ly, lz, r, h, col, o) {
      const [x, y] = tp(lx, ly);
      push(x + y + lz * 0.02, () => cylinder(ctx, x, y, lz, r, h, col, o));
    },
    /** Dessin libre : fn(P) où P(lx, ly, lz) renvoie le point écran. */
    custom(lx, ly, lz, fn, bias = 0) {
      const [x, y] = tp(lx, ly);
      push(x + y + lz * 0.02 + bias, () => fn((a, b, c) => { const [px, py] = tp(a, b); return iso(px, py, c); }));
    },
    /** Quadrilatère sur la face avant locale (plan y = ly), visible si la face l'est. */
    front(ly, lx0, lx1, z0, z1, fill, stroke, bias = 0.01) {
      if (!m.frontVisible) return;
      const P = (a, b, c) => { const [px, py] = tp(a, b); return iso(px, py, c); };
      const [cx, cy] = tp((lx0 + lx1) / 2, ly);
      push(cx + cy + 0.5 + bias + z0 * 0.02, () => poly(ctx, [P(lx0, ly, z0), P(lx1, ly, z0), P(lx1, ly, z1), P(lx0, ly, z1)], fill, stroke, 0.6));
    },
    flush() { items.sort((a, b) => a.k - b.k || a.i - b.i); for (const it of items) it.fn(); },
  };
  return m;
}

const leafBall = (ctx, x, y, r, col) => {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, shade(col, 0.25)); g.addColorStop(1, shade(col, -0.25));
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
};
const flowerDots = (ctx, P, cx, cy, z, colors, n, seed, spread = 0.32) => {
  for (let i = 0; i < n; i++) {
    const a = hash2(i, seed, 3) * Math.PI * 2, r = Math.sqrt(hash2(i, seed, 5)) * spread;
    const [px, py] = P(cx + Math.cos(a) * r, cy + Math.sin(a) * r, z + hash2(i, seed, 7) * 0.12);
    ctx.fillStyle = colors[i % colors.length];
    ctx.beginPath(); ctx.arc(px, py, 1.7, 0, Math.PI * 2); ctx.fill();
  }
};

function bed(m, def, quilt, opts = {}) {
  const W = def.w, D = def.h;
  const fr = opts.frame || C.wood;
  m.box(0.05, 0.02, 0, W - 0.1, D - 0.06, 0.26, shade(fr, -0.1));
  m.box(0.04, 0, 0, W - 0.08, 0.12, opts.head || 0.78, shade(fr, -0.15));
  if (opts.ornate) m.box(0.1, 0.01, opts.head || 0.78, W - 0.2, 0.1, 0.1, shade(fr, 0.1));
  m.box(0.09, 0.12, 0.26, W - 0.18, D - 0.22, opts.thick || 0.13, C.linen);
  const pw = W > 1 ? 0.62 : 0.62;
  for (let k = 0; k < W; k++) m.box(k + 0.19, 0.17, 0.26 + (opts.thick || 0.13), pw, 0.3, 0.09, C.white);
  m.box(0.09, 0.56, 0.26 + (opts.thick || 0.13) - 0.02, W - 0.18, D - 0.68, 0.05, quilt);
  m.custom(W / 2, 0.56 + (D - 0.68) / 2, 0.42, (P) => {
    const ctx = m.ctx;
  }, 0.3);
  m.box(0.04, D - 0.12, 0, W - 0.08, 0.1, 0.42, shade(fr, -0.05));
}

/** Liste des modèles : (m, ctx, def, season, f) */
const MODELS = {
  bed_single: (m, ctx, def) => bed(m, def, QUILT.bed_single),
  bed_double: (m, ctx, def) => bed(m, def, QUILT.bed_double),
  bed_cozy: (m, ctx, def) => bed(m, def, QUILT.bed_cozy, { frame: '#c48a52', head: 0.95, thick: 0.18, ornate: true }),
  bed_canopy: (m, ctx, def) => {
    bed(m, def, QUILT.bed_canopy, { frame: '#7a4628', head: 1.0, thick: 0.18, ornate: true });
    for (const [x, y] of [[0.02, 0.02], [1.86, 0.02], [0.02, 1.86], [1.86, 1.86]]) m.box(x, y, 0, 0.12, 0.12, 2.05, '#6a3a20');
    m.box(0, 0, 2.05, 2, 2, 0.1, '#9c2f3f');
    m.front(1.98, 0.02, 0.35, 0.9, 2.05, 'rgba(156,47,63,0.85)');
    m.front(1.98, 1.65, 1.98, 0.9, 2.05, 'rgba(156,47,63,0.85)');
  },
  bunk_bed: (m, ctx, def) => {
    bed(m, def, QUILT.bunk_bed, { head: 0.6 });
    for (const [x, y] of [[0.02, 0.02], [0.86, 0.02], [0.02, 1.86], [0.86, 1.86]]) m.box(x, y, 0, 0.12, 0.12, 1.55, C.woodD);
    m.box(0.06, 0.06, 0.9, 0.88, 1.88, 0.1, C.wood);
    m.box(0.1, 0.12, 1.0, 0.8, 1.78, 0.12, C.linen);
    m.box(0.18, 0.17, 1.12, 0.64, 0.3, 0.08, C.white);
    m.box(0.1, 0.56, 1.1, 0.8, 1.3, 0.05, '#d08b3c');
    m.box(0.06, 0.04, 1.2, 0.88, 0.08, 0.3, C.woodD);
  },
  nightstand: (m) => {
    m.box(0.18, 0.12, 0, 0.64, 0.6, 0.5, C.woodR);
    m.front(0.72, 0.24, 0.76, 0.28, 0.42, shade(C.woodR, 0.12), 'rgba(40,20,10,.3)');
    m.cyl(0.5, 0.4, 0.5, 0.06, 0.16, C.brass);
    m.custom(0.5, 0.4, 0.66, (P) => { const [x, y] = P(0.5, 0.4, 0.66); poly(m.ctx, [[x - 6, y + 2], [x + 6, y + 2], [x + 4, y - 7], [x - 4, y - 7]], '#f3d9a0', 'rgba(80,50,20,.4)'); }, 0.2);
  },
  wardrobe: (m) => {
    m.box(0.08, 0.15, 0, 0.84, 0.62, 1.75, C.woodR);
    m.box(0.04, 0.12, 1.75, 0.92, 0.68, 0.08, shade(C.woodR, -0.1));
    m.front(0.77, 0.14, 0.48, 0.1, 1.65, shade(C.woodR, 0.1), 'rgba(40,20,10,.35)');
    m.front(0.77, 0.52, 0.86, 0.1, 1.65, shade(C.woodR, 0.1), 'rgba(40,20,10,.35)');
  },
  dresser: (m) => {
    const col = '#6f9a9a';
    m.box(0.08, 0.2, 0, 1.84, 0.58, 0.8, col);
    m.box(0.05, 0.18, 0.8, 1.9, 0.62, 0.06, C.woodL);
    for (let k = 0; k < 3; k++) m.front(0.78, 0.18, 1.82, 0.08 + k * 0.24, 0.27 + k * 0.24, shade(col, 0.1), 'rgba(30,40,40,.35)');
    m.custom(0.5, 0.45, 0.86, (P) => flowerDots(m.ctx, P, 0.45, 0.45, 0.88, ['#e8c24a', '#d9534f', '#f4f0e6'], 9, 4, 0.12), 0.2);
    m.cyl(0.45, 0.45, 0.86, 0.07, 0.14, '#5577aa');
  },
  writing_desk: (m) => {
    m.box(0.12, 0.2, 0, 0.76, 0.55, 0.78, C.woodR);
    m.box(0.1, 0.18, 0.78, 0.8, 0.3, 0.25, shade(C.woodR, -0.08));
    m.front(0.76, 0.18, 0.82, 0.2, 0.6, shade(C.woodR, 0.08), 'rgba(40,20,10,.3)');
    m.box(0.3, 0.55, 0.78, 0.3, 0.2, 0.02, C.white);
  },
  bathtub: (m) => {
    for (const [x, y] of [[0.15, 0.15], [0.75, 0.15], [0.15, 1.75], [0.75, 1.75]]) m.box(x, y, 0, 0.1, 0.1, 0.12, C.brass);
    m.box(0.1, 0.1, 0.12, 0.8, 1.8, 0.5, '#f2f0ea');
    m.custom(0.5, 1, 0.62, (P) => poly(m.ctx, [P(0.2, 0.2, 0.6), P(0.8, 0.2, 0.6), P(0.8, 1.8, 0.6), P(0.2, 1.8, 0.6)], '#9fd2e3', 'rgba(60,90,110,.3)'), 0.4);
    m.box(0.42, 0.06, 0.62, 0.16, 0.08, 0.2, C.brass);
  },
  faience_stove: (m) => {
    m.box(0.1, 0.12, 0, 0.8, 0.76, 0.15, C.stoneD);
    m.box(0.14, 0.16, 0.15, 0.72, 0.68, 1.3, '#e9dfcd');
    for (let k = 0; k < 5; k++) m.front(0.84, 0.16, 0.86, 0.2 + k * 0.25, 0.22 + k * 0.25, '#5b7fb0');
    m.front(0.84, 0.36, 0.64, 0.3, 0.55, '#3a2418');
    m.front(0.845, 0.4, 0.6, 0.32, 0.5, '#ff9a4a');
    m.box(0.1, 0.12, 1.45, 0.8, 0.76, 0.1, C.stoneD);
  },
  armchair: (m) => {
    const col = '#a24d3c';
    m.box(0.12, 0.15, 0, 0.76, 0.72, 0.36, shade(col, -0.1));
    m.box(0.12, 0.1, 0.36, 0.76, 0.18, 0.55, col);
    m.box(0.08, 0.2, 0.3, 0.14, 0.66, 0.24, shade(col, -0.05));
    m.box(0.78, 0.2, 0.3, 0.14, 0.66, 0.24, shade(col, -0.05));
    m.box(0.22, 0.3, 0.36, 0.56, 0.55, 0.08, shade(col, 0.1));
  },
  fireplace: (m) => {
    m.box(0, 0.05, 0, 2, 0.75, 1.15, C.stone);
    m.box(-0.05, 0.02, 1.15, 2.1, 0.85, 0.12, C.woodD);
    m.box(0.3, 0.08, 1.27, 1.4, 0.55, 0.9, C.stoneD);
    m.front(0.8, 0.45, 1.55, 0.05, 0.8, '#21140d', 'rgba(0,0,0,.4)');
    m.box(0.45, 0.6, 0, 1.1, 0.4, 0.04, '#5a4b40');
    m.custom(1, 0.6, 0.05, (P) => {
      const ctx = m.ctx;
      for (let k = 0; k < 3; k++) { const [x, y] = P(0.7 + k * 0.3, 0.62, 0.08); ctx.fillStyle = '#5b3a24'; ctx.fillRect(x - 6, y - 2, 12, 4); }
    }, 0.5);
  },
  sofa: (m) => {
    const col = '#5f7f9a';
    m.box(0.06, 0.15, 0, 1.88, 0.75, 0.34, shade(col, -0.12));
    m.box(0.06, 0.08, 0.34, 1.88, 0.2, 0.52, col);
    m.box(0, 0.15, 0.26, 0.18, 0.75, 0.3, shade(col, -0.05));
    m.box(1.82, 0.15, 0.26, 0.18, 0.75, 0.3, shade(col, -0.05));
    m.box(0.2, 0.3, 0.34, 0.78, 0.55, 0.1, shade(col, 0.12));
    m.box(1.02, 0.3, 0.34, 0.78, 0.55, 0.1, shade(col, 0.12));
    m.box(0.3, 0.2, 0.44, 0.3, 0.12, 0.28, '#d8b65c');
  },
  bookshelf: (m) => {
    m.box(0.06, 0.1, 0, 0.88, 0.5, 1.8, C.woodD);
    if (m.frontVisible) {
      const cols = ['#a8423e', '#3f6a8a', '#d1a843', '#4f7f53', '#7a4a7a', '#c96a3a', '#2f4f5f'];
      for (let r = 0; r < 4; r++) {
        m.front(0.6, 0.1, 0.9, 0.08 + r * 0.43, 0.42 + r * 0.43, '#3a2416');
        let x = 0.13;
        let k = r * 3;
        while (x < 0.86) {
          const w = 0.05 + hash2(k, r, 2) * 0.05;
          m.front(0.605, x, Math.min(0.87, x + w), 0.1 + r * 0.43, 0.32 + r * 0.43 + hash2(k, r, 9) * 0.06, cols[k % cols.length], null, 0.02);
          x += w + 0.01; k++;
        }
      }
    }
  },
  coffee_table: (m) => {
    m.box(0.15, 0.2, 0, 0.7, 0.6, 0.3, C.woodR);
    m.box(0.1, 0.15, 0.3, 0.8, 0.7, 0.05, C.woodL);
    m.box(0.3, 0.35, 0.35, 0.3, 0.22, 0.02, '#d9534f');
    m.cyl(0.66, 0.6, 0.35, 0.07, 0.08, C.white);
  },
  grandfather_clock: (m) => {
    m.box(0.25, 0.3, 0, 0.5, 0.4, 0.3, C.woodD);
    m.box(0.3, 0.33, 0.3, 0.4, 0.34, 1.2, C.woodR);
    m.box(0.22, 0.28, 1.5, 0.56, 0.44, 0.5, C.woodD);
    m.custom(0.5, 0.72, 1.75, (P) => {
      const [x, y] = P(0.5, 0.72, 1.75);
      m.ctx.beginPath(); m.ctx.arc(x, y, 6, 0, Math.PI * 2); m.ctx.fillStyle = C.cream; m.ctx.fill(); m.ctx.strokeStyle = C.brass; m.ctx.lineWidth = 1.2; m.ctx.stroke();
      m.ctx.strokeStyle = '#222'; m.ctx.lineWidth = 0.8; m.ctx.beginPath(); m.ctx.moveTo(x, y); m.ctx.lineTo(x + 3, y - 2); m.ctx.moveTo(x, y); m.ctx.lineTo(x, y - 4.5); m.ctx.stroke();
    }, 0.8);
  },
  piano: (m) => {
    m.box(0.05, 0.05, 0, 1.9, 0.5, 1.25, '#2a2224');
    m.box(0.1, 0.5, 0.65, 1.8, 0.25, 0.08, '#2a2224');
    m.custom(1, 0.75, 0.74, (P) => poly(m.ctx, [P(0.15, 0.55, 0.74), P(1.85, 0.55, 0.74), P(1.85, 0.72, 0.74), P(0.15, 0.72, 0.74)], C.white, 'rgba(0,0,0,.3)'), 0.4);
    m.box(0.6, 1.1, 0, 0.8, 0.4, 0.45, '#2a2224');
    m.cyl(0.4, 0.3, 1.25, 0.06, 0.12, C.brass);
  },
  desk: (m) => {
    m.box(0, 0.15, 0, 2, 0.7, 1.0, C.woodR);
    m.box(-0.04, 0.1, 1.0, 2.08, 0.8, 0.08, '#e8e2d6');
    for (let k = 0; k < 4; k++) m.front(0.85, 0.08 + k * 0.48, 0.48 + k * 0.48, 0.1, 0.9, shade(C.woodR, 0.1), 'rgba(40,20,10,.35)');
    m.box(0.25, 0.35, 1.08, 0.45, 0.3, 0.05, '#7a2f36');
    m.cyl(1.55, 0.45, 1.08, 0.08, 0.06, C.brass, { top: '#e8c86a' });
    m.cyl(1.2, 0.35, 1.08, 0.04, 0.3, C.brass);
    m.custom(1.2, 0.35, 1.38, (P) => { const [x, y] = P(1.2, 0.35, 1.38); poly(m.ctx, [[x - 5, y + 2], [x + 5, y + 2], [x + 3, y - 5], [x - 3, y - 5]], '#3d6b4a'); }, 0.5);
  },
  luggage_rack: (m) => {
    m.box(0.15, 0.25, 0, 0.7, 0.5, 0.35, C.woodD);
    m.box(0.18, 0.3, 0.35, 0.64, 0.4, 0.32, '#7a4a2f');
    m.box(0.25, 0.34, 0.67, 0.5, 0.32, 0.25, '#3f6a8a');
    m.box(0.42, 0.45, 0.92, 0.16, 0.08, 0.06, C.iron);
  },
  linen_cupboard: (m) => {
    m.box(0.08, 0.15, 0, 0.84, 0.6, 1.6, '#e7dfd0');
    m.front(0.75, 0.14, 0.86, 0.85, 1.5, '#d8ccb6', 'rgba(60,50,40,.3)');
    m.front(0.755, 0.2, 0.8, 0.95, 1.12, '#f6f1e7');
    m.front(0.755, 0.2, 0.8, 1.2, 1.38, '#cfe0ea');
    m.front(0.75, 0.14, 0.86, 0.1, 0.75, '#d8ccb6', 'rgba(60,50,40,.3)');
  },
  stove: (m) => {
    m.box(0.02, 0.1, 0, 1.96, 0.8, 0.85, C.iron);
    m.box(0, 0.08, 0.85, 2, 0.84, 0.06, '#55595f');
    m.front(0.9, 0.2, 0.9, 0.15, 0.6, '#24262a', 'rgba(200,200,200,.2)');
    m.front(0.9, 1.1, 1.8, 0.15, 0.6, '#24262a', 'rgba(200,200,200,.2)');
    m.front(0.905, 0.4, 0.7, 0.3, 0.42, '#ff7a2a');
    m.cyl(0.55, 0.45, 0.91, 0.22, 0.28, C.copper);
    m.cyl(1.45, 0.5, 0.91, 0.18, 0.12, '#4a4f57');
    m.box(0.2, 0, 0.91, 1.6, 0.12, 0.6, '#4a4d52');
  },
  worktop: (m) => {
    m.box(0.05, 0.1, 0, 0.9, 0.8, 0.85, '#c9b79a');
    m.box(0.02, 0.08, 0.85, 0.96, 0.84, 0.07, C.woodL);
    m.box(0.25, 0.3, 0.92, 0.45, 0.3, 0.03, '#a8784a');
    m.custom(0.5, 0.5, 0.95, (P) => { flowerDots(m.ctx, P, 0.45, 0.42, 0.96, ['#e0703a', '#7fb04a', '#d94b3b'], 5, 11, 0.14); }, 0.3);
  },
  sink: (m) => {
    m.box(0.05, 0.1, 0, 0.9, 0.8, 0.85, '#d9d4ca');
    m.box(0.02, 0.08, 0.85, 0.96, 0.84, 0.07, '#bdb6aa');
    m.custom(0.5, 0.5, 0.92, (P) => poly(m.ctx, [P(0.2, 0.25, 0.92), P(0.8, 0.25, 0.92), P(0.8, 0.75, 0.92), P(0.2, 0.75, 0.92)], '#8fa3ad', 'rgba(0,0,0,.25)'), 0.3);
    m.box(0.45, 0.12, 0.92, 0.1, 0.1, 0.25, C.brass);
  },
  pantry: (m) => {
    m.box(0.06, 0.12, 0, 0.88, 0.7, 1.7, '#9c7a4f');
    m.front(0.82, 0.1, 0.9, 0.1, 1.6, '#6f5232');
    for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) m.front(0.83, 0.16 + k * 0.25, 0.3 + k * 0.25, 0.2 + r * 0.5, 0.42 + r * 0.5, ['#e2b04a', '#c0563a', '#8fae5a'][(r + k) % 3]);
  },
  bread_oven: (m) => {
    m.box(0.05, 0.1, 0, 0.9, 0.85, 0.55, '#a8593d');
    m.custom(0.5, 0.5, 0.55, (P) => {
      const ctx = m.ctx; const [x, y] = P(0.5, 0.52, 0.55);
      const g = ctx.createRadialGradient(x - 6, y - 14, 2, x, y - 6, 22);
      g.addColorStop(0, '#d58a5f'); g.addColorStop(1, '#8a4630');
      ctx.beginPath(); ctx.ellipse(x, y, 25, 13, 0, Math.PI, 0); ctx.bezierCurveTo(x + 25, y - 30, x - 25, y - 30, x - 25, y); ctx.fillStyle = g; ctx.fill();
    }, 0.4);
    m.front(0.95, 0.3, 0.7, 0.12, 0.42, '#2a140c');
    m.front(0.955, 0.36, 0.64, 0.14, 0.3, '#ff7a2a');
  },
  wine_rack: (m) => {
    m.box(0.08, 0.15, 0, 0.84, 0.55, 1.4, C.woodD);
    if (m.frontVisible) for (let r = 0; r < 5; r++) for (let k = 0; k < 4; k++) m.front(0.705, 0.14 + k * 0.19, 0.27 + k * 0.19, 0.12 + r * 0.26, 0.25 + r * 0.26, ['#5a1f2a', '#2f4a2a', '#6a2a1a'][(r * 3 + k) % 3]);
  },
  table_small: (m) => {
    m.cyl(0.5, 0.5, 0, 0.12, 0.06, C.woodD);
    m.cyl(0.5, 0.5, 0.06, 0.05, 0.6, C.woodD);
    m.cyl(0.5, 0.5, 0.66, 0.4, 0.05, C.white, { top: '#f6f2ea' });
    m.cyl(0.5, 0.5, 0.71, 0.04, 0.16, '#e8dcc0', { top: '#ffd66a' });
  },
  table_long: (m) => {
    for (const [x, y] of [[0.12, 0.2], [1.8, 0.2], [0.12, 0.7], [1.8, 0.7]]) m.box(x, y, 0, 0.08, 0.08, 0.62, C.woodD);
    m.box(0.05, 0.12, 0.62, 1.9, 0.76, 0.07, C.woodL);
    m.box(0.3, 0.38, 0.69, 1.4, 0.24, 0.01, '#c84b4b');
    m.cyl(1, 0.5, 0.69, 0.08, 0.12, '#7a9a5a');
  },
  chair: (m) => {
    for (const [x, y] of [[0.24, 0.28], [0.68, 0.28], [0.24, 0.7], [0.68, 0.7]]) m.box(x, y, 0, 0.07, 0.07, 0.4, C.woodD);
    m.box(0.2, 0.24, 0.4, 0.6, 0.56, 0.06, C.woodR);
    m.box(0.2, 0.2, 0.46, 0.6, 0.08, 0.5, C.woodR);
    m.front(0.8, 0.26, 0.74, 0.41, 0.45, '#c84b4b');
  },
  buffet: (m) => {
    m.box(0.02, 0.15, 0, 1.96, 0.7, 0.85, C.woodR);
    m.box(0, 0.12, 0.85, 2, 0.76, 0.06, '#e8e2d6');
    m.cyl(0.4, 0.45, 0.91, 0.18, 0.08, '#d9a35b', { top: '#c7883e' });
    m.cyl(1, 0.45, 0.91, 0.16, 0.12, C.white, { top: '#e14b3b' });
    m.cyl(1.55, 0.45, 0.91, 0.12, 0.3, '#c8e0ec');
  },
  bar_counter: (m) => {
    m.box(0, 0.3, 0, 3, 0.62, 1.05, '#7c4f2c');
    m.box(-0.05, 0.25, 1.05, 3.1, 0.72, 0.08, '#4a2e1a');
    for (let k = 0; k < 6; k++) m.front(0.92, 0.05 + k * 0.5, 0.48 + k * 0.5, 0.12, 0.92, '#8f5d36', 'rgba(30,15,5,.35)');
    for (let k = 0; k < 3; k++) m.box(0.9 + k * 0.25, 0.4, 1.13, 0.06, 0.06, 0.32, C.brass);
    m.box(0.05, 0, 0, 2.9, 0.22, 1.3, '#5b3a22');
    for (let k = 0; k < 10; k++) m.cyl(0.2 + k * 0.28, 0.1, 1.3, 0.05, 0.22, ['#3a6a3a', '#7a2a2a', '#c9a24a', '#2a4a6a'][k % 4]);
  },
  bar_stool: (m) => {
    m.cyl(0.5, 0.5, 0, 0.18, 0.04, C.iron);
    m.cyl(0.5, 0.5, 0.04, 0.04, 0.6, C.iron);
    m.cyl(0.5, 0.5, 0.64, 0.22, 0.08, '#8a3a2f');
  },
  barrel: (m) => {
    m.cyl(0.5, 0.5, 0, 0.36, 0.95, '#8a5a33', { top: '#a6764a' });
    m.custom(0.5, 0.5, 0.3, (P) => {
      const ctx = m.ctx;
      for (const z of [0.18, 0.75]) { const [x, y] = P(0.5, 0.5, z); ctx.beginPath(); ctx.ellipse(x, y, 0.37 * HW * 1.414, 0.37 * HH * 1.414, 0, 0, Math.PI); ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 1.6; ctx.stroke(); }
    }, 0.6);
  },
  billiard: (m) => {
    for (const [x, y] of [[0.1, 0.15], [1.78, 0.15], [0.1, 0.75], [1.78, 0.75]]) m.box(x, y, 0, 0.12, 0.12, 0.6, C.woodD);
    m.box(0, 0.08, 0.6, 2, 0.84, 0.16, '#6a3a20');
    m.custom(1, 0.5, 0.76, (P) => {
      const ctx = m.ctx;
      poly(ctx, [P(0.1, 0.17, 0.76), P(1.9, 0.17, 0.76), P(1.9, 0.83, 0.76), P(0.1, 0.83, 0.76)], C.felt);
      const balls = [[0.5, 0.5, '#fff'], [1.3, 0.4, '#d33'], [1.4, 0.55, '#ec3'], [1.5, 0.45, '#239'], [1.45, 0.62, '#222']];
      for (const [bx, by, c] of balls) { const [x, y] = P(bx, by, 0.78); ctx.beginPath(); ctx.arc(x, y, 1.9, 0, 7); ctx.fillStyle = c; ctx.fill(); }
      const [ax, ay] = P(0.2, 0.7, 0.8), [bx2, by2] = P(0.45, 0.52, 0.8);
      ctx.strokeStyle = '#d6b07a'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx2, by2); ctx.stroke();
    }, 0.5);
  },
  foosball: (m) => {
    for (const [x, y] of [[0.15, 0.2], [1.75, 0.2], [0.15, 0.7], [1.75, 0.7]]) m.box(x, y, 0, 0.1, 0.1, 0.55, C.metal);
    m.box(0.05, 0.12, 0.55, 1.9, 0.76, 0.3, '#2f6f9f');
    m.custom(1, 0.5, 0.85, (P) => {
      const ctx = m.ctx;
      poly(ctx, [P(0.12, 0.2, 0.85), P(1.88, 0.2, 0.85), P(1.88, 0.8, 0.85), P(0.12, 0.8, 0.85)], '#3f8f4f');
      for (let k = 0; k < 6; k++) { const [x0, y0] = P(0.3 + k * 0.28, 0, 0.95), [x1, y1] = P(0.3 + k * 0.28, 1, 0.95); ctx.strokeStyle = '#ccc'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
    }, 0.5);
  },
  game_table: (m) => {
    for (const [x, y] of [[0.18, 0.18], [0.74, 0.18], [0.18, 0.74], [0.74, 0.74]]) m.box(x, y, 0, 0.08, 0.08, 0.62, C.woodD);
    m.box(0.1, 0.1, 0.62, 0.8, 0.8, 0.06, C.woodL);
    m.custom(0.5, 0.5, 0.68, (P) => {
      const ctx = m.ctx;
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) poly(ctx, [P(0.26 + i * 0.12, 0.26 + j * 0.12, 0.69), P(0.38 + i * 0.12, 0.26 + j * 0.12, 0.69), P(0.38 + i * 0.12, 0.38 + j * 0.12, 0.69), P(0.26 + i * 0.12, 0.38 + j * 0.12, 0.69)], (i + j) % 2 ? '#2a2a2a' : '#f0e6d2');
    }, 0.4);
  },
  dartboard: (m) => {
    m.box(0.35, 0.3, 0, 0.3, 0.3, 0.08, C.woodD);
    m.box(0.46, 0.4, 0.08, 0.08, 0.08, 1.15, C.woodD);
    m.custom(0.5, 0.5, 1.4, (P) => {
      const ctx = m.ctx; const [x, y] = P(0.5, 0.5, 1.45);
      for (const [r, c] of [[11, '#1f1f1f'], [9, '#e8dcc0'], [7, '#c33'], [5, '#e8dcc0'], [3, '#2a7a3a'], [1.5, '#c33']]) { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = c; ctx.fill(); }
    }, 0.6);
  },
  toy_chest: (m) => {
    m.box(0.12, 0.2, 0, 0.76, 0.6, 0.5, '#d27a3a');
    m.box(0.1, 0.18, 0.5, 0.8, 0.64, 0.06, '#e8a24a');
    m.cyl(0.35, 0.4, 0.56, 0.1, 0.18, '#e14b3b');
    m.box(0.55, 0.35, 0.56, 0.18, 0.18, 0.18, '#3d85c6');
  },
  souvenir_stand: (m) => {
    m.box(0.1, 0.15, 0, 0.8, 0.7, 0.2, C.woodD);
    for (let r = 0; r < 3; r++) {
      m.box(0.12, 0.2 + r * 0.12, 0.2 + r * 0.42, 0.76, 0.6 - r * 0.12, 0.05, C.woodR);
      for (let k = 0; k < 3; k++) m.box(0.2 + k * 0.22, 0.3 + r * 0.12, 0.25 + r * 0.42, 0.14, 0.14, 0.18, ['#c45a6e', '#3d85c6', '#e8c24a', '#5f9a4a'][(r + k) % 4]);
    }
  },
  postcards: (m) => {
    m.cyl(0.5, 0.5, 0, 0.18, 0.05, C.metal);
    m.cyl(0.5, 0.5, 0.05, 0.03, 1.2, C.metal);
    for (let r = 0; r < 3; r++) m.custom(0.5, 0.5, 0.5 + r * 0.25, (P) => {
      const ctx = m.ctx; const [x, y] = P(0.5, 0.5, 0.5 + r * 0.25);
      for (let k = 0; k < 3; k++) { ctx.fillStyle = ['#7fb6e8', '#f2c14e', '#81b29a'][(k + r) % 3]; ctx.fillRect(x - 9 + k * 6, y - 5, 5, 7); }
    }, 0.4 + r * 0.01);
  },
  shop_counter: (m) => {
    m.box(0.05, 0.2, 0, 1.9, 0.6, 0.95, C.woodR);
    m.box(0, 0.15, 0.95, 2, 0.7, 0.06, C.woodL);
    m.box(1.3, 0.3, 1.01, 0.4, 0.3, 0.22, '#3a3f46');
    m.box(0.3, 0.3, 1.01, 0.5, 0.35, 0.12, '#d9c39a');
  },
  guide_desk: (m) => {
    m.box(0, 0.2, 0, 2, 0.65, 1.0, '#6f5a3c');
    m.box(-0.03, 0.15, 1.0, 2.06, 0.75, 0.07, C.woodL);
    m.custom(0.9, 0.5, 1.07, (P) => poly(m.ctx, [P(0.4, 0.3, 1.08), P(1.3, 0.3, 1.08), P(1.3, 0.75, 1.08), P(0.4, 0.75, 1.08)], '#e9dcb8', 'rgba(80,60,30,.5)'), 0.4);
    m.cyl(1.65, 0.5, 1.07, 0.14, 0.1, '#c9a24a', { top: '#8a6a2a' });
    for (let k = 0; k < 4; k++) m.front(0.85, 0.05 + k * 0.5, 0.45 + k * 0.5, 0.1, 0.9, shade('#6f5a3c', 0.1), 'rgba(30,20,10,.3)');
  },
  ski_rack: (m) => {
    m.box(0.1, 0.4, 0, 0.8, 0.2, 0.08, C.woodD);
    m.box(0.1, 0.4, 1.2, 0.8, 0.2, 0.08, C.woodD);
    for (let k = 0; k < 4; k++) m.box(0.16 + k * 0.19, 0.44, 0.08, 0.06, 0.1, 1.5, ['#d33', '#36c', '#ec3', '#2a2'][k]);
  },
  map_board: (m) => {
    m.box(0.2, 0.4, 0, 0.08, 0.08, 1.6, C.woodD);
    m.box(0.72, 0.4, 0, 0.08, 0.08, 1.6, C.woodD);
    m.box(0.12, 0.42, 0.6, 0.76, 0.06, 0.95, '#e9dcb8');
    m.front(0.49, 0.18, 0.82, 0.68, 1.48, '#d8e7c4', 'rgba(80,60,30,.5)');
    m.front(0.495, 0.3, 0.7, 0.95, 1.3, '#a8c8a0');
    m.front(0.495, 0.5, 0.78, 0.75, 0.95, '#8fbbd8');
  },
  sauna: (m) => {
    m.box(0.05, 0.05, 0, 1.9, 1.9, 1.9, '#c08a52');
    m.box(0, 0, 1.9, 2, 2, 0.12, '#8a5a33');
    m.front(1.95, 0.3, 0.9, 0.05, 1.6, '#9a6a3a', 'rgba(40,20,10,.4)');
    m.front(1.955, 0.45, 0.75, 1.0, 1.4, '#ffd59a');
    m.front(1.95, 1.2, 1.7, 1.0, 1.4, '#ffd59a', 'rgba(40,20,10,.4)');
  },
  hot_tub: (m) => {
    m.cyl(1, 1, 0, 0.92, 0.75, '#9a6a3c', { top: '#b07a47' });
    m.custom(1, 1, 0.76, (P) => {
      const ctx = m.ctx; const [x, y] = P(1, 1, 0.72);
      ctx.beginPath(); ctx.ellipse(x, y, 0.8 * HW * 1.414, 0.8 * HH * 1.414, 0, 0, 7);
      const g = ctx.createLinearGradient(x - 40, y - 20, x + 40, y + 20); g.addColorStop(0, '#9fe0e8'); g.addColorStop(1, '#4fa9c0');
      ctx.fillStyle = g; ctx.fill();
    }, 0.6);
  },
  massage_table: (m) => {
    for (const [x, y] of [[0.2, 0.2], [0.72, 0.2], [0.2, 1.72], [0.72, 1.72]]) m.box(x, y, 0, 0.08, 0.08, 0.6, C.woodL);
    m.box(0.12, 0.1, 0.6, 0.76, 1.8, 0.14, '#efe6d6');
    m.box(0.14, 0.9, 0.74, 0.72, 0.5, 0.03, '#8fc0c4');
  },
  plant: (m, ctx, def, season) => {
    m.cyl(0.5, 0.5, 0, 0.2, 0.35, C.pot, { top: '#5b3a24' });
    m.custom(0.5, 0.5, 0.35, (P) => {
      const [x, y] = P(0.5, 0.5, 0.55);
      leafBall(m.ctx, x - 5, y + 2, 7, C.leaf); leafBall(m.ctx, x + 5, y + 1, 7, C.leafD); leafBall(m.ctx, x, y - 6, 8, '#6fae55');
    }, 0.5);
  },
  big_plant: (m) => {
    m.cyl(0.5, 0.5, 0, 0.26, 0.45, '#d9d2c4', { top: '#5b3a24' });
    m.custom(0.5, 0.5, 0.45, (P) => {
      const ctx = m.ctx; const [x, y] = P(0.5, 0.5, 0.45);
      ctx.strokeStyle = '#6b4a2f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 30); ctx.stroke();
      leafBall(ctx, x - 7, y - 30, 9, C.leafD); leafBall(ctx, x + 7, y - 34, 9, C.leaf); leafBall(ctx, x, y - 44, 10, '#6fae55'); leafBall(ctx, x + 2, y - 22, 7, C.leaf);
    }, 0.5);
  },
  floor_lamp: (m) => {
    m.cyl(0.5, 0.5, 0, 0.14, 0.04, C.iron);
    m.cyl(0.5, 0.5, 0.04, 0.025, 1.3, C.iron);
    m.custom(0.5, 0.5, 1.35, (P) => { const [x, y] = P(0.5, 0.5, 1.3); poly(m.ctx, [[x - 8, y + 2], [x + 8, y + 2], [x + 5, y - 9], [x - 5, y - 9]], '#f5deb0', 'rgba(80,50,20,.4)'); }, 0.5);
  },
  rug: (m) => {
    m.custom(1, 1, 0, (P) => {
      const ctx = m.ctx;
      poly(ctx, [P(0.1, 0.1, 0.01), P(1.9, 0.1, 0.01), P(1.9, 1.9, 0.01), P(0.1, 1.9, 0.01)], '#a8423e');
      poly(ctx, [P(0.25, 0.25, 0.012), P(1.75, 0.25, 0.012), P(1.75, 1.75, 0.012), P(0.25, 1.75, 0.012)], null, '#e8c86a', 1.2);
      poly(ctx, [P(1, 0.5, 0.013), P(1.5, 1, 0.013), P(1, 1.5, 0.013), P(0.5, 1, 0.013)], '#2f4f6f', '#e8c86a', 1);
    }, -5);
  },
  flower_vase: (m) => {
    m.box(0.25, 0.25, 0, 0.5, 0.5, 0.6, C.woodR);
    m.cyl(0.5, 0.5, 0.6, 0.09, 0.2, '#5b7fb0');
    m.custom(0.5, 0.5, 0.8, (P) => flowerDots(m.ctx, P, 0.5, 0.5, 0.82, ['#e94b5f', '#f2c14e', '#f4f0e6', '#c45ac4'], 12, 8, 0.14), 0.4);
  },
  painting: (m) => easel(m, ['#8fbbd8', '#a8c8a0', '#e9dcb8']),
  lake_painting: (m) => easel(m, ['#5fa0c8', '#e8d090', '#3f7a5a'], true),
  sculpture: (m) => {
    m.box(0.25, 0.25, 0, 0.5, 0.5, 0.7, '#d9d2c4');
    m.custom(0.5, 0.5, 0.7, (P) => {
      const ctx = m.ctx; const [x, y] = P(0.5, 0.5, 0.7);
      ctx.fillStyle = '#8a5a33'; ctx.beginPath(); ctx.ellipse(x, y - 10, 8, 10, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 4, y - 22, 5, 0, 7); ctx.fill();
      ctx.fillStyle = '#a6764a'; ctx.beginPath(); ctx.ellipse(x - 2, y - 12, 3, 6, 0.3, 0, 7); ctx.fill();
    }, 0.5);
  },
  old_map: (m) => {
    m.box(0.15, 0.4, 0, 0.7, 0.2, 0.7, C.woodD);
    m.box(0.12, 0.42, 0.7, 0.76, 0.08, 0.7, '#6a3a20');
    m.front(0.51, 0.18, 0.82, 0.76, 1.34, '#e3cf9a');
    m.front(0.515, 0.3, 0.7, 0.9, 1.2, '#b08850');
  },
  ice_axe: (m) => {
    m.box(0.2, 0.2, 0, 0.6, 0.6, 0.8, '#3a2a1c');
    m.box(0.22, 0.22, 0.8, 0.56, 0.56, 0.5, 'rgba(200,230,240,0.35)');
    m.custom(0.5, 0.5, 0.85, (P) => {
      const ctx = m.ctx; const [x, y] = P(0.5, 0.5, 0.85), [x2, y2] = P(0.5, 0.5, 1.25);
      ctx.strokeStyle = '#8a5a33'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.strokeStyle = '#9aa3ab'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x2 - 8, y2 + 2); ctx.lineTo(x2 + 9, y2 - 1); ctx.stroke();
    }, 0.6);
  },
  bench: (m) => {
    for (const x of [0.15, 1.75]) { m.box(x, 0.3, 0, 0.1, 0.5, 0.42, C.iron); m.box(x, 0.18, 0.42, 0.1, 0.12, 0.45, C.iron); }
    m.box(0.08, 0.28, 0.42, 1.84, 0.55, 0.06, C.woodR);
    m.box(0.08, 0.16, 0.55, 1.84, 0.08, 0.32, C.woodR);
  },
  flower_bed: (m, ctx, def, season) => {
    m.box(0.08, 0.08, 0, 0.84, 0.84, 0.16, '#8f7a6a');
    m.box(0.14, 0.14, 0.16, 0.72, 0.72, 0.03, '#5a3e2a');
    const cols = season === 3 ? [] : season === 2 ? ['#d98a3a', '#b8563a', '#e8c24a'] : ['#e94b5f', '#f2c14e', '#f4f0e6', '#c45ac4', '#5b8fe0'];
    m.custom(0.5, 0.5, 0.2, (P) => {
      const ctx2 = m.ctx;
      if (season === 3) { poly(ctx2, [P(0.1, 0.1, 0.22), P(0.9, 0.1, 0.22), P(0.9, 0.9, 0.22), P(0.1, 0.9, 0.22)], '#f4f7fb'); return; }
      for (let i = 0; i < 9; i++) { const [x, y] = P(0.25 + (i % 3) * 0.25, 0.25 + Math.floor(i / 3) * 0.25, 0.22); leafBall(ctx2, x, y - 2, 4, season === 2 ? '#7a8a3a' : C.leaf); }
      flowerDots(ctx2, P, 0.5, 0.5, 0.3, cols, 16, 5, 0.33);
    }, 0.4);
  },
  hedge: (m, ctx, def, season) => {
    m.box(0.08, 0.1, 0, 0.84, 0.8, 0.7, season === 2 ? '#6f7a3a' : '#4a7f3f');
    if (season === 3) m.box(0.08, 0.1, 0.7, 0.84, 0.8, 0.06, '#f4f7fb');
  },
  lantern: (m) => {
    m.box(0.42, 0.42, 0, 0.16, 0.16, 0.1, C.stoneD);
    m.box(0.46, 0.46, 0.1, 0.08, 0.08, 1.15, C.iron);
    m.box(0.38, 0.38, 1.25, 0.24, 0.24, 0.26, '#ffe2a0');
    m.box(0.35, 0.35, 1.51, 0.3, 0.3, 0.06, C.iron);
  },
  young_tree: (m, ctx, def, season) => {
    m.cyl(0.5, 0.5, 0, 0.05, 0.9, '#6b4a2f');
    m.custom(0.5, 0.5, 0.9, (P) => {
      const [x, y] = P(0.5, 0.5, 1.15);
      const col = ['#6fae55', '#4f8f3f', '#d9772f', null][season];
      if (!col) { m.ctx.strokeStyle = '#6b4a2f'; m.ctx.lineWidth = 1.2; for (let k = 0; k < 5; k++) { m.ctx.beginPath(); m.ctx.moveTo(x, y + 8); m.ctx.lineTo(x - 10 + k * 5, y - 10 + (k % 2) * 4); m.ctx.stroke(); } return; }
      leafBall(m.ctx, x - 6, y + 2, 9, col); leafBall(m.ctx, x + 6, y, 9, shade(col, -0.1)); leafBall(m.ctx, x, y - 8, 10, shade(col, 0.1));
    }, 0.6);
  },
  birdhouse: (m) => {
    m.box(0.46, 0.46, 0, 0.08, 0.08, 1.2, C.woodD);
    m.box(0.33, 0.33, 1.2, 0.34, 0.34, 0.32, '#c96a3a');
    m.custom(0.5, 0.5, 1.52, (P) => { const ctx2 = m.ctx; gableRoof(ctx2, ...[0.5 - 0.17, 0.5 - 0.17].map((v) => v), 1.52, 0.34, 0.34, 0.2, '#6a3a2a', 'x', 0.05); }, 0.5);
  },
  woodpile: (m, ctx, def, season) => {
    m.custom(0.5, 0.5, 0, (P) => {
      const ctx2 = m.ctx;
      for (let r = 0; r < 3; r++) for (let k = 0; k < 4 - r; k++) {
        const [x, y] = P(0.25 + k * 0.17 + r * 0.08, 0.5, 0.1 + r * 0.17);
        ctx2.beginPath(); ctx2.ellipse(x, y, 5, 5, 0, 0, 7); ctx2.fillStyle = '#a6764a'; ctx2.fill(); ctx2.strokeStyle = '#5b3a24'; ctx2.lineWidth = 1; ctx2.stroke();
        ctx2.beginPath(); ctx2.arc(x, y, 2, 0, 7); ctx2.strokeStyle = '#d6a66e'; ctx2.stroke();
      }
      if (season === 3) { const [x, y] = P(0.5, 0.5, 0.6); ctx2.fillStyle = '#f4f7fb'; ctx2.beginPath(); ctx2.ellipse(x, y, 16, 5, 0, 0, 7); ctx2.fill(); }
    }, 0.4);
  },
  swing: (m) => {
    for (const x of [0.05, 1.85]) { m.box(x, 0.2, 0, 0.1, 0.1, 1.9, C.woodD); m.box(x, 0.7, 0, 0.1, 0.1, 1.9, C.woodD); }
    m.box(0.05, 0.42, 1.85, 1.9, 0.12, 0.1, C.woodD);
    m.custom(1, 0.5, 0.5, (P) => {
      const ctx2 = m.ctx;
      const [a, b] = P(0.7, 0.48, 1.85), [c, d] = P(0.7, 0.48, 0.5), [e, f] = P(1.3, 0.48, 1.85), [g, h] = P(1.3, 0.48, 0.5);
      ctx2.strokeStyle = '#8a7a5a'; ctx2.lineWidth = 1; ctx2.beginPath(); ctx2.moveTo(a, b); ctx2.lineTo(c, d); ctx2.moveTo(e, f); ctx2.lineTo(g, h); ctx2.stroke();
    }, 0.3);
    m.box(0.65, 0.38, 0.45, 0.7, 0.2, 0.05, C.woodR);
  },
  deck_chair: (m) => {
    m.box(0.15, 0.4, 0, 0.7, 1.4, 0.25, C.woodL);
    m.custom(0.5, 0.4, 0.25, (P) => poly(m.ctx, [P(0.18, 0.45, 0.25), P(0.82, 0.45, 0.25), P(0.82, 0.05, 0.75), P(0.18, 0.05, 0.75)], '#3d85c6', 'rgba(20,40,60,.4)'), 0.3);
    m.custom(0.5, 1.1, 0.26, (P) => poly(m.ctx, [P(0.18, 0.45, 0.26), P(0.82, 0.45, 0.26), P(0.82, 1.75, 0.26), P(0.18, 1.75, 0.26)], '#f4f0e6', 'rgba(20,40,60,.3)'), 0.3);
  },
  well: (m, ctx, def, season) => {
    m.cyl(0.5, 0.5, 0, 0.42, 0.6, C.stone, { top: '#2a3a44' });
    m.box(0.1, 0.46, 0.6, 0.08, 0.08, 0.9, C.woodD);
    m.box(0.82, 0.46, 0.6, 0.08, 0.08, 0.9, C.woodD);
    m.custom(0.5, 0.5, 1.5, (P) => gableRoof(m.ctx, 0.05, 0.25, 1.5, 0.9, 0.5, 0.3, season === 3 ? '#e8eef4' : '#7a3a2a', 'x', 0.08), 0.6);
  },
  fountain: (m, ctx, def, season) => {
    m.cyl(1, 1, 0, 0.92, 0.42, C.stone, { top: season === 3 ? '#dfeef5' : '#5fb0c8' });
    m.cyl(1, 1, 0.42, 0.16, 0.65, C.stone);
    m.cyl(1, 1, 1.07, 0.38, 0.1, C.stone, { top: season === 3 ? '#dfeef5' : '#7fc6d8' });
    m.cyl(1, 1, 1.17, 0.08, 0.3, C.stone);
  },
  telescope: (m) => {
    m.custom(0.5, 0.5, 0, (P) => {
      const ctx2 = m.ctx;
      const [tx, ty] = P(0.5, 0.5, 1.1);
      for (const [a, b] of [[0.2, 0.3], [0.8, 0.35], [0.5, 0.85]]) { const [x, y] = P(a, b, 0); ctx2.strokeStyle = '#6b4a2f'; ctx2.lineWidth = 2; ctx2.beginPath(); ctx2.moveTo(x, y); ctx2.lineTo(tx, ty); ctx2.stroke(); }
      ctx2.save(); ctx2.translate(tx, ty); ctx2.rotate(-0.4);
      ctx2.fillStyle = C.brass; ctx2.fillRect(-14, -3.5, 26, 7); ctx2.fillStyle = '#8a6a2a'; ctx2.fillRect(10, -4.5, 5, 9);
      ctx2.restore();
    }, 0.5);
  },
  gazebo: (m, ctx, def, season) => {
    for (const [x, y] of [[0.05, 0.05], [1.85, 0.05], [0.05, 1.85], [1.85, 1.85]]) m.box(x, y, 0, 0.1, 0.1, 1.8, '#f2ece0');
    m.box(0, 0, 0, 2, 2, 0.12, '#d9cbb3');
    m.custom(1, 1, 1.8, (P) => {
      const ctx2 = m.ctx;
      const top = P(1, 1, 2.7);
      const col = season === 3 ? '#eef3f7' : '#4f6f5f';
      poly(ctx2, [P(-0.15, 2.15, 1.8), P(2.15, 2.15, 1.8), top], shade(col, 0.05), 'rgba(0,0,0,.25)');
      poly(ctx2, [P(2.15, -0.15, 1.8), P(2.15, 2.15, 1.8), top], shade(col, -0.2), 'rgba(0,0,0,.25)');
    }, 1.5);
  },
  ibex_statue: (m) => {
    m.box(0.15, 0.15, 0, 0.7, 0.7, 0.55, C.stone);
    m.custom(0.5, 0.5, 0.55, (P) => {
      const ctx2 = m.ctx; const [x, y] = P(0.5, 0.5, 0.55);
      ctx2.fillStyle = '#7a6a4a';
      ctx2.beginPath(); ctx2.ellipse(x, y - 14, 13, 8, 0, 0, 7); ctx2.fill();
      for (const dx of [-9, -4, 5, 10]) ctx2.fillRect(x + dx, y - 10, 2.5, 10);
      ctx2.beginPath(); ctx2.ellipse(x + 13, y - 24, 5, 6, 0.4, 0, 7); ctx2.fill();
      ctx2.strokeStyle = '#5a4a32'; ctx2.lineWidth = 2.5; ctx2.beginPath(); ctx2.arc(x + 8, y - 28, 9, -1.6, 0.4); ctx2.stroke();
    }, 0.5);
  },
};

function easel(m, cols, big = false) {
  m.box(0.3, 0.45, 0, 0.06, 0.06, 1.3, C.woodD);
  m.box(0.64, 0.45, 0, 0.06, 0.06, 1.3, C.woodD);
  m.box(0.47, 0.25, 0, 0.06, 0.06, 1.2, C.woodD);
  const h0 = big ? 0.55 : 0.65, h1 = big ? 1.45 : 1.25;
  m.box(0.18, 0.48, h0, 0.64, 0.05, h1 - h0, '#c9a24a');
  m.front(0.535, 0.22, 0.78, h0 + 0.05, h1 - 0.05, cols[0]);
  m.front(0.537, 0.22, 0.78, h0 + 0.05, h0 + (h1 - h0) * 0.4, cols[2]);
  m.front(0.538, 0.4, 0.6, h0 + (h1 - h0) * 0.55, h0 + (h1 - h0) * 0.75, cols[1]);
}

/** Dessine un meuble dans un sprite mis en cache. */
export function furnitureSprite(type, rot, season) {
  const def = FURNITURE[type];
  const [w, d] = rot % 2 ? [def.h, def.w] : [def.w, def.h];
  const seasonal = ['flower_bed', 'hedge', 'young_tree', 'woodpile', 'well', 'fountain', 'gazebo'].includes(type);
  const key = `f:${type}:${rot}:${seasonal ? season : 0}`;
  const maxH = 3.0;
  return {
    key,
    bounds: [-d * HW - 6, -maxH * ZH - 6, w * HW + 6, (w + d) * HH + 6],
    draw: (ctx) => {
      const m = modeler(ctx, def, rot);
      m.ctx = ctx;
      const fn = MODELS[type];
      if (fn) fn(m, ctx, def, season);
      else m.box(0.1, 0.1, 0, def.w - 0.2, def.h - 0.2, 0.6, C.wood);
      m.flush();
    },
  };
}

// ---------------------------------------------------------------- Arbres

const FOLIAGE = {
  pine: ['#3f7a4a', '#3b7046', '#4d6b3f', '#3d5e4a'],
  birch: ['#8cc063', '#79a84f', '#e3b13a', null],
  oak: ['#6aa64e', '#5a9142', '#d0662e', null],
};

export function treeSprite(kind, season, variant) {
  const v = Math.floor(variant * 3);
  const key = `t:${kind}:${season}:${v}`;
  return {
    key,
    bounds: [-34, -128, 34, 12],
    draw: (ctx) => {
      ctx.fillStyle = 'rgba(20,30,15,0.22)';
      ctx.beginPath(); ctx.ellipse(0, 2, 22, 9, 0, 0, Math.PI * 2); ctx.fill();
      if (kind === 'pine') {
        const col = shade(FOLIAGE.pine[season], (v - 1) * 0.06);
        ctx.fillStyle = '#5b3a24'; ctx.fillRect(-3, -14, 6, 16);
        const layers = 4;
        for (let i = 0; i < layers; i++) {
          const y = -12 - i * 22, w = 26 - i * 5.5, hgt = 34 - i * 3;
          const g = ctx.createLinearGradient(-w, 0, w, 0);
          g.addColorStop(0, shade(col, 0.12)); g.addColorStop(0.55, col); g.addColorStop(1, shade(col, -0.32));
          ctx.beginPath(); ctx.moveTo(-w, y); ctx.quadraticCurveTo(0, y + 7, w, y); ctx.lineTo(0, y - hgt); ctx.closePath();
          ctx.fillStyle = g; ctx.fill();
          if (season === 3) {
            ctx.beginPath(); ctx.moveTo(-w * 0.75, y - hgt * 0.28); ctx.quadraticCurveTo(0, y - hgt * 0.15, w * 0.6, y - hgt * 0.32); ctx.lineTo(0, y - hgt); ctx.closePath();
            ctx.fillStyle = 'rgba(244,248,252,0.92)'; ctx.fill();
          }
        }
      } else {
        const fol = FOLIAGE[kind][season];
        const trunk = kind === 'birch' ? '#e8e4da' : '#6b4a2f';
        ctx.fillStyle = trunk; ctx.fillRect(-3, -40, 6, 42);
        if (kind === 'birch') { ctx.fillStyle = '#3a3a3a'; for (let k = 0; k < 5; k++) ctx.fillRect(-3, -36 + k * 7, 3 + (k % 2) * 3, 1.5); }
        if (!fol) {
          ctx.strokeStyle = trunk; ctx.lineWidth = 2;
          for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.moveTo(0, -30 - k * 3); ctx.lineTo(-18 + k * 7, -62 - (k % 3) * 8); ctx.stroke(); }
          ctx.fillStyle = 'rgba(244,248,252,0.9)';
          for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.ellipse(-12 + k * 8, -60 - (k % 2) * 6, 5, 2, 0, 0, 7); ctx.fill(); }
          return;
        }
        const c = shade(fol, (v - 1) * 0.06);
        const balls = kind === 'oak' ? [[-12, -48, 15], [12, -50, 15], [0, -64, 17], [-4, -44, 13], [8, -38, 11]] : [[-8, -50, 11], [8, -56, 12], [0, -70, 12], [-2, -42, 10]];
        for (const [x, y, r] of balls) leafBall(ctx, x, y, r, c);
        if (season === 2 && kind === 'oak') { ctx.fillStyle = '#e8a23a'; for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.arc(-14 + k * 6, -46 - (k % 3) * 9, 2, 0, 7); ctx.fill(); } }
      }
    },
  };
}

// ---------------------------------------------------------------- Bâtiments du village

export function buildingSprite(b, season) {
  const key = `b:${b.kind}:${b.x}:${b.y}:${season}`;
  const w = b.w, d = b.h;
  return {
    key,
    bounds: [-d * HW - 20, -5 * ZH, w * HW + 20, (w + d) * HH + 10],
    draw: (ctx) => {
      const snow = season === 3;
      const roofCol = snow ? '#e9eff5' : b.roof;
      if (b.kind === 'chapel') {
        box(ctx, 0.1, 0.1, 0, w - 0.2, d - 0.2, 1.6, b.wall);
        gableRoof(ctx, 0.1, 0.1, 1.6, w - 0.2, d - 0.2, 1.0, roofCol, 'y', 0.18);
        box(ctx, 0.6, d - 0.9, 0, 0.8, 0.8, 3.2, b.wall);
        poly(ctx, [iso(0.5, d - 0.1, 3.2), iso(1.5, d - 0.1, 3.2), iso(1.0, d - 0.5, 4.4)], shade(b.roof, 0.05));
        poly(ctx, [iso(1.5, d - 1, 3.2), iso(1.5, d - 0.1, 3.2), iso(1.0, d - 0.5, 4.4)], shade(b.roof, -0.2));
        const [cx, cy] = iso(1.0, d - 0.1, 2.6);
        ctx.fillStyle = '#3a3026'; ctx.beginPath(); ctx.arc(cx - 6, cy, 4, Math.PI, 0); ctx.lineTo(cx - 2, cy + 6); ctx.lineTo(cx - 10, cy + 6); ctx.fill();
        return;
      }
      if (b.kind === 'barn') {
        box(ctx, 0.1, 0.1, 0, w - 0.2, d - 0.2, 1.5, b.wall);
        for (let k = 0; k < w * 3; k++) { const [x0, y0] = iso(0.1 + k / 3, d - 0.1, 0), [, y1] = iso(0.1 + k / 3, d - 0.1, 1.5); ctx.strokeStyle = 'rgba(40,20,10,.25)'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0, y1); ctx.stroke(); }
        const p = [iso(1.4, d - 0.1, 0), iso(2.6, d - 0.1, 0), iso(2.6, d - 0.1, 1.2), iso(1.4, d - 0.1, 1.2)];
        poly(ctx, p, '#6b3a22', '#e8dcc4', 1.2);
        gableRoof(ctx, 0.1, 0.1, 1.5, w - 0.2, d - 0.2, 1.1, roofCol, 'x', 0.2);
        return;
      }
      box(ctx, 0.1, 0.1, 0, w - 0.2, d - 0.2, 0.5, '#9d968a');
      box(ctx, 0.1, 0.1, 0.5, w - 0.2, d - 0.2, b.kind === 'shed' ? 0.8 : 1.3, b.wall);
      const top = b.kind === 'shed' ? 1.3 : 1.8;
      // fenêtres et porte
      for (let k = 0; k < w - 1; k++) {
        const [x, y] = iso(0.6 + k, d - 0.1, 1.1);
        ctx.fillStyle = '#ffe6a8'; ctx.fillRect(x - 5, y - 9, 10, 9);
        ctx.fillStyle = '#4f6a3a'; ctx.fillRect(x - 9, y - 9, 4, 9); ctx.fillRect(x + 5, y - 9, 4, 9);
      }
      const [dx, dy] = iso(w - 0.4, d - 0.1, 0);
      ctx.fillStyle = '#5b3a24'; ctx.fillRect(dx - 6, dy - 22, 9, 20);
      gableRoof(ctx, 0.1, 0.1, top, w - 0.2, d - 0.2, 1.0, roofCol, w >= d ? 'x' : 'y', 0.22);
      // cheminée
      box(ctx, w * 0.3, d * 0.35, top + 0.3, 0.3, 0.3, 0.9, '#8a7a6a');
    },
  };
}
