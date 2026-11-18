// Projection isométrique 2:1 et primitives de dessin volumétrique.
import { shade, rgba } from '../core/util.js';

export const TW = 64;
export const TH = 32;
export const ZH = 32;
export const HW = TW / 2, HH = TH / 2;

export function iso(x, y, z = 0) {
  return [(x - y) * HW, (x + y) * HH - z * ZH];
}
export function screenToTile(sx, sy) {
  const a = sx / HW, b = sy / HH;
  return [(a + b) / 2, (b - a) / 2];
}

export function poly(ctx, pts, fill, stroke, lw = 1) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}

/** Losange au sol d'une zone [x, x+w] × [y, y+d] à la hauteur z. */
export function diamond(ctx, x, y, w, d, z, fill, stroke) {
  poly(ctx, [iso(x, y, z), iso(x + w, y, z), iso(x + w, y + d, z), iso(x, y + d, z)], fill, stroke);
}

const EDGE = 'rgba(45,28,18,0.28)';

/**
 * Pavé droit : faces du dessus, sud (+y, à gauche à l'écran) et est (+x, à droite).
 * col : couleur de base ou { top, left, right }.
 */
export function box(ctx, x, y, z, w, d, h, col, { edge = EDGE, topOnly = false } = {}) {
  const top = typeof col === 'string' ? shade(col, 0.14) : col.top;
  const left = typeof col === 'string' ? col : col.left;
  const right = typeof col === 'string' ? shade(col, -0.2) : col.right;
  const a = iso(x, y + d, z), b = iso(x + w, y + d, z), c = iso(x + w, y, z);
  const at = iso(x, y + d, z + h), bt = iso(x + w, y + d, z + h), ct = iso(x + w, y, z + h), dt = iso(x, y, z + h);
  if (!topOnly && h > 0) {
    poly(ctx, [a, b, bt, at], left, edge, 0.6);
    poly(ctx, [b, c, ct, bt], right, edge, 0.6);
  }
  poly(ctx, [dt, ct, bt, at], top, edge, 0.6);
}

/** Cylindre vertical (rayon en cases). */
export function cylinder(ctx, cx, cy, z, r, h, col, { top, edge = EDGE } = {}) {
  const rx = r * HW * 1.414, ry = r * HH * 1.414;
  const [px, py] = iso(cx, cy, z);
  const [, ty] = iso(cx, cy, z + h);
  const g = ctx.createLinearGradient(px - rx, 0, px + rx, 0);
  g.addColorStop(0, shade(col, 0.08));
  g.addColorStop(0.45, col);
  g.addColorStop(1, shade(col, -0.28));
  ctx.beginPath();
  ctx.ellipse(px, py, rx, ry, 0, 0, Math.PI);
  ctx.lineTo(px - rx, ty);
  ctx.ellipse(px, ty, rx, ry, 0, Math.PI, 0, true);
  ctx.closePath();
  ctx.fillStyle = g; ctx.fill();
  if (edge) { ctx.strokeStyle = edge; ctx.lineWidth = 0.6; ctx.stroke(); }
  ctx.beginPath();
  ctx.ellipse(px, ty, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = top || shade(col, 0.16); ctx.fill();
  if (edge) ctx.stroke();
}

/** Ellipse posée au sol (ombre, tapis rond...). */
export function groundEllipse(ctx, cx, cy, z, r, fill) {
  const [px, py] = iso(cx, cy, z);
  ctx.beginPath();
  ctx.ellipse(px, py, r * HW * 1.414, r * HH * 1.414, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill; ctx.fill();
}

/** Toit à deux pans ; axis 'x' : faîtage parallèle à x. */
export function gableRoof(ctx, x, y, z, w, d, h, col, axis = 'x', overhang = 0.15) {
  const o = overhang;
  const x0 = x - o, y0 = y - o, x1 = x + w + o, y1 = y + d + o;
  const dark = shade(col, -0.25), light = shade(col, 0.05);
  if (axis === 'x') {
    const ym = (y0 + y1) / 2;
    poly(ctx, [iso(x0, ym, z + h), iso(x1, ym, z + h), iso(x1, y0, z), iso(x0, y0, z)], dark, EDGE);
    poly(ctx, [iso(x1, y0, z), iso(x1, y1, z), iso(x1, ym, z + h)], shade(col, -0.35), EDGE);
    poly(ctx, [iso(x0, y1, z), iso(x1, y1, z), iso(x1, ym, z + h), iso(x0, ym, z + h)], light, EDGE);
  } else {
    const xm = (x0 + x1) / 2;
    poly(ctx, [iso(x0, y0, z), iso(xm, y0, z + h), iso(xm, y1, z + h), iso(x0, y1, z)], dark, EDGE);
    poly(ctx, [iso(x1, y0, z), iso(x1, y1, z), iso(xm, y1, z + h), iso(xm, y0, z + h)], light, EDGE);
    poly(ctx, [iso(x0, y1, z), iso(x1, y1, z), iso(xm, y1, z + h)], shade(col, -0.3), EDGE);
  }
}

/** Face verticale plane orientée sud (plan y = const) : rectangle de x0 à x1 entre z0 et z1. */
export function faceS(ctx, x0, x1, y, z0, z1, fill, stroke) {
  poly(ctx, [iso(x0, y, z0), iso(x1, y, z0), iso(x1, y, z1), iso(x0, y, z1)], fill, stroke);
}
/** Face verticale orientée est (plan x = const). */
export function faceE(ctx, x, y0, y1, z0, z1, fill, stroke) {
  poly(ctx, [iso(x, y0, z0), iso(x, y1, z0), iso(x, y1, z1), iso(x, y0, z1)], fill, stroke);
}

export function softShadow(ctx, cx, cy, rx, ry, a = 0.22) {
  const [px, py] = iso(cx, cy, 0);
  ctx.beginPath();
  ctx.ellipse(px, py, rx * HW * 1.414, ry * HH * 1.414, 0, 0, Math.PI * 2);
  ctx.fillStyle = rgba('#1a1208', a);
  ctx.fill();
}

// ---------------------------------------------------------------- Cache de sprites

const cache = new Map();
let cacheScale = 1;
export function setSpriteScale(s) {
  if (Math.abs(s - cacheScale) > 0.01) { cacheScale = s; cache.clear(); }
}
export function spriteScale() { return cacheScale; }
export function clearSprites() { cache.clear(); }

/**
 * Renvoie un sprite pré-rendu. bounds : [minX, minY, maxX, maxY] en pixels monde relatifs à l'ancre.
 * draw(ctx) dessine autour de l'ancre (0,0).
 */
export function sprite(key, bounds, draw) {
  let s = cache.get(key);
  if (s) return s;
  const [x0, y0, x1, y1] = bounds;
  const w = Math.max(1, Math.ceil((x1 - x0) * cacheScale)), h = Math.max(1, Math.ceil((y1 - y0) * cacheScale));
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
  const ctx = c.getContext('2d');
  ctx.scale(cacheScale, cacheScale);
  ctx.translate(-x0, -y0);
  ctx.lineJoin = 'round';
  draw(ctx);
  s = { canvas: c, x0, y0, w: x1 - x0, h: y1 - y0 };
  cache.set(key, s);
  if (cache.size > 900) cache.delete(cache.keys().next().value);
  return s;
}
export function drawSprite(ctx, s, ax, ay) {
  ctx.drawImage(s.canvas, ax + s.x0, ay + s.y0, s.w, s.h);
}
