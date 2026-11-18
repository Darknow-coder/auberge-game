// Vignettes pour l'interface : meubles, pièces, styles, portraits.
import { FURNITURE } from '../data/furniture.js';
import { ROOM_TYPES, FLOORS, WALLS } from '../data/rooms.js';
import { furnitureSprite } from './models.js';
import { drawPerson } from './characters.js';
import { iso, box, poly, diamond } from './iso.js';
import { drawFloorTile } from './ground.js';
import { shade } from '../core/util.js';

const cache = new Map();

/** Dessine via draw(ctx) dans un grand canvas, recadre sur le contenu et adapte à w×h. */
function fitted(key, w, h, draw, pad = 6) {
  if (cache.has(key)) return cloneCanvas(cache.get(key));
  const S = 420;
  const src = document.createElement('canvas');
  src.width = S; src.height = S;
  const sctx = src.getContext('2d');
  sctx.translate(S / 2, S * 0.62);
  sctx.scale(2, 2);
  sctx.lineJoin = 'round';
  draw(sctx);
  const data = sctx.getImageData(0, 0, S, S).data;
  let x0 = S, y0 = S, x1 = 0, y1 = 0;
  for (let y = 0; y < S; y += 2) for (let x = 0; x < S; x += 2) {
    if (data[(y * S + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  const out = document.createElement('canvas');
  out.width = w * 2; out.height = h * 2;
  if (x1 > x0) {
    const bw = x1 - x0 + 2, bh = y1 - y0 + 2;
    const s = Math.min((out.width - pad * 4) / bw, (out.height - pad * 4) / bh, 1.6);
    const ctx = out.getContext('2d');
    ctx.drawImage(src, x0, y0, bw, bh, (out.width - bw * s) / 2, (out.height - bh * s) / 2, bw * s, bh * s);
  }
  cache.set(key, out);
  return cloneCanvas(out);
}
function cloneCanvas(c) {
  const n = document.createElement('canvas');
  n.width = c.width; n.height = c.height;
  n.getContext('2d').drawImage(c, 0, 0);
  return n;
}

export function furnitureThumb(type, w = 84, h = 64) {
  const def = FURNITURE[type];
  const rot = def.w > def.h ? 0 : def.h > def.w ? 1 : 0;
  return fitted(`f:${type}`, w, h, (ctx) => {
    const sp = furnitureSprite(type, rot, 0);
    sp.draw(ctx);
  });
}

export function roomThumb(type, w = 84, h = 64) {
  const def = ROOM_TYPES[type];
  return fitted(`r:${type}`, w, h, (ctx) => {
    const fl = FLOORS[def.floor];
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) drawFloorTile(ctx, def.floor, fl, x, y, 1, def.indoor);
    if (def.indoor) {
      const wl = WALLS[def.wall];
      box(ctx, 0, -0.07, 0, 2, 0.14, 1.1, { top: shade(wl.colors[1], -0.2), left: wl.colors[0], right: shade(wl.colors[0], -0.2) });
      box(ctx, -0.07, 0, 0, 0.14, 2, 1.1, { top: shade(wl.colors[1], -0.2), left: shade(wl.colors[0], -0.1), right: wl.colors[0] });
    }
    // pastille de couleur du type
    const [px, py] = iso(1, 1, 0.05);
    ctx.fillStyle = def.color; ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.ellipse(px, py, 16, 8, 0, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
  });
}

export function floorThumb(id, w = 84, h = 64) {
  const fl = FLOORS[id];
  return fitted(`fl:${id}`, w, h, (ctx) => {
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) drawFloorTile(ctx, id, fl, x, y, 1, fl.indoor);
  });
}

export function wallThumb(id, w = 84, h = 64) {
  const wl = WALLS[id];
  return fitted(`wl:${id}`, w, h, (ctx) => {
    diamond(ctx, 0, 0, 2, 1.2, 0, '#d8b07a');
    box(ctx, 0, -0.07, 0, 2, 0.14, 1.4, { top: shade(wl.colors[1], -0.25), left: wl.colors[0], right: shade(wl.colors[0], -0.25) });
    if (id === 'fleuri') for (let k = 0; k < 6; k++) { const [px, py] = iso(0.25 + (k % 3) * 0.6, 0.08, 0.4 + Math.floor(k / 3) * 0.6); ctx.fillStyle = wl.colors[1]; ctx.beginPath(); ctx.arc(px, py, 2.4, 0, 7); ctx.fill(); }
  });
}

export function portrait(look, w = 64, h = 64, opts = {}) {
  const c = document.createElement('canvas');
  c.width = w * 2; c.height = h * 2;
  const ctx = c.getContext('2d');
  ctx.scale(2, 2);
  const s = opts.kid ? 2.6 : 2.15;
  ctx.translate(w / 2, h + (opts.kid ? 16 : 30));
  ctx.scale(s, s);
  drawPerson(ctx, 0, 0, { look, dir: [0, 1], pose: 'stand', t: 0, kid: opts.kid, winter: opts.winter });
  return c;
}
