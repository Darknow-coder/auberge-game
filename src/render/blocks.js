// Dessin procédural des blocs de lumière (« lanternes »), des pierres, des gemmes et des
// étoiles, mis en cache par (thème, sorte, taille, variante).
import { STONE } from '../game/board.js';

export function hexToRgb(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
export function mixRgb(hex, target, t) {
  const a = hexToRgb(hex), b = target === 'white' ? [255, 255, 255] : target === 'black' ? [0, 0, 0] : hexToRgb(target);
  return a.map((v, i) => Math.round(v + (b[i] - v) * t));
}
export function mix(hex, target, t) {
  return `rgb(${mixRgb(hex, target, t).join(',')})`;
}
export function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

const cache = new Map();
export function clearSpriteCache() { cache.clear(); }

/** Marge autour du bloc (pour les halos), en fraction de la taille. */
export const PAD = 0.3;

/** Couleur d'une lumière (masque 1..7) dans le thème. */
export function lightColor(theme, mask) {
  return theme.lights[mask] || '#ffffff';
}

/**
 * Sprite de `size` pixels (réels). `kind` : masque de couleur 1 / 2 / 4, STONE, 'gray',
 * 'gem' (gemme seule) ou 'star' (étoile). opts.symbol : symbole daltonien sur la couleur.
 */
export function blockSprite(theme, kind, size, opts = {}) {
  size = Math.max(4, Math.round(size));
  const key = `${theme.id}|${kind}|${size}|${opts.symbol ? 1 : 0}`;
  let cv = cache.get(key);
  if (cv) return cv;
  const pad = Math.ceil(size * PAD);
  cv = makeCanvas(size + pad * 2, size + pad * 2);
  const ctx = cv.getContext('2d');
  ctx.translate(pad, pad);
  if (kind === STONE) drawStone(ctx, size, theme);
  else if (kind === 'gem') drawGem(ctx, size);
  else if (kind === 'crystal') drawCrystal(ctx, size);
  else if (kind === 'fog') drawCloud(ctx, size);
  else if (kind === 'star') drawStar(ctx, size);
  else {
    const color = kind === 'gray' ? (theme.dark ? '#5d5a70' : '#b8ad9e') : lightColor(theme, kind);
    drawLantern(ctx, size, color, theme.style, kind !== 'gray');
    if (opts.symbol && kind !== 'gray') drawSymbol(ctx, size, kind);
  }
  cache.set(key, cv);
  return cv;
}

/** Lanterne de verre : cadre sombre teinté, cœur lumineux, halo. */
function drawLantern(ctx, s, c, style, glow) {
  const g = s * 0.05;
  const x = g, y = g, w = s - 2 * g;
  if (style === 'neon') {
    roundRect(ctx, x + s * 0.05, y + s * 0.05, w - s * 0.1, w - s * 0.1, s * 0.2);
    ctx.fillStyle = mix(c, 'black', 0.78);
    ctx.fill();
    ctx.save();
    ctx.shadowColor = c;
    ctx.shadowBlur = s * 0.3;
    ctx.lineWidth = s * 0.08;
    ctx.strokeStyle = c;
    ctx.stroke();
    ctx.restore();
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s * 0.13, 0, Math.PI * 2);
    ctx.fillStyle = mix(c, 'white', 0.5);
    ctx.fill();
    return;
  }
  const r = style === 'soft' ? s * 0.32 : s * 0.24;
  // Halo extérieur.
  if (glow) {
    ctx.save();
    ctx.shadowColor = rgba(c, 0.75);
    ctx.shadowBlur = s * 0.22;
    roundRect(ctx, x, y, w, w, r);
    ctx.fillStyle = mix(c, 'black', 0.5);
    ctx.fill();
    ctx.restore();
  }
  // Cadre : verre sombre teinté.
  roundRect(ctx, x, y, w, w, r);
  const frame = ctx.createLinearGradient(0, y, 0, y + w);
  frame.addColorStop(0, mix(c, 'black', 0.25));
  frame.addColorStop(1, mix(c, 'black', 0.6));
  ctx.fillStyle = frame;
  ctx.fill();
  // Cœur lumineux.
  const inset = s * 0.1;
  roundRect(ctx, x + inset, y + inset, w - 2 * inset, w - 2 * inset, r * 0.7);
  const core = ctx.createRadialGradient(s * 0.45, s * 0.4, s * 0.02, s / 2, s / 2, s * 0.5);
  core.addColorStop(0, mix(c, 'white', 0.75));
  core.addColorStop(0.35, mix(c, 'white', 0.25));
  core.addColorStop(0.75, c);
  core.addColorStop(1, mix(c, 'black', 0.2));
  ctx.fillStyle = core;
  ctx.fill();
  // Reflet.
  ctx.save();
  roundRect(ctx, x + inset, y + inset, w - 2 * inset, w - 2 * inset, r * 0.7);
  ctx.clip();
  const hl = ctx.createLinearGradient(0, y + inset, 0, y + w * 0.5);
  hl.addColorStop(0, 'rgba(255,255,255,0.45)');
  hl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hl;
  ctx.fillRect(x, y, w, w * 0.45);
  ctx.restore();
  // Liseré clair du cadre.
  ctx.lineWidth = Math.max(1, s * 0.03);
  ctx.strokeStyle = rgba('#ffffff', 0.22);
  roundRect(ctx, x + ctx.lineWidth / 2, y + ctx.lineWidth / 2, w - ctx.lineWidth, w - ctx.lineWidth, r);
  ctx.stroke();
}

function drawStone(ctx, s, theme) {
  const g = s * 0.05;
  const x = g, y = g, w = s - 2 * g;
  const c = theme.stone;
  roundRect(ctx, x, y, w, w, s * 0.16);
  const body = ctx.createLinearGradient(0, y, 0, y + w);
  body.addColorStop(0, mix(c, 'white', 0.12));
  body.addColorStop(1, mix(c, 'black', 0.4));
  ctx.fillStyle = body;
  ctx.fill();
  ctx.save();
  roundRect(ctx, x, y, w, w, s * 0.16);
  ctx.clip();
  const dots = [[0.25, 0.3, 0.07], [0.68, 0.22, 0.05], [0.55, 0.62, 0.08], [0.25, 0.75, 0.05], [0.8, 0.78, 0.06]];
  ctx.fillStyle = mix(c, 'black', 0.3);
  for (const [dx, dy, rr] of dots) { ctx.beginPath(); ctx.arc(x + w * dx, y + w * dy, s * rr, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = mix(c, 'black', 0.55);
  ctx.lineWidth = Math.max(1, s * 0.035);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.15, y + w * 0.45);
  ctx.lineTo(x + w * 0.4, y + w * 0.52);
  ctx.lineTo(x + w * 0.5, y + w * 0.38);
  ctx.lineTo(x + w * 0.78, y + w * 0.46);
  ctx.moveTo(x + w * 0.4, y + w * 0.52);
  ctx.lineTo(x + w * 0.46, y + w * 0.82);
  ctx.stroke();
  ctx.lineWidth = s * 0.08;
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  roundRect(ctx, x, y, w, w, s * 0.16);
  ctx.stroke();
  ctx.restore();
}

/** Gemme posée dans une case vide. */
function drawGem(ctx, s) {
  const cx = s / 2, cy = s / 2 + s * 0.03, r = s * 0.3;
  ctx.save();
  ctx.shadowColor = 'rgba(120, 230, 255, 0.9)';
  ctx.shadowBlur = s * 0.25;
  ctx.beginPath();
  ctx.moveTo(cx - r, cy - r * 0.35);
  ctx.lineTo(cx - r * 0.5, cy - r * 0.85);
  ctx.lineTo(cx + r * 0.5, cy - r * 0.85);
  ctx.lineTo(cx + r, cy - r * 0.35);
  ctx.lineTo(cx, cy + r);
  ctx.closePath();
  const grad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.45, '#b9f3ff');
  grad.addColorStop(1, '#3fb8ff');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(20,70,120,0.6)';
  ctx.lineWidth = Math.max(1, s * 0.025);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - r, cy - r * 0.35);
  ctx.lineTo(cx + r, cy - r * 0.35);
  ctx.moveTo(cx - r * 0.5, cy - r * 0.85);
  ctx.lineTo(cx - r * 0.25, cy - r * 0.35);
  ctx.lineTo(cx, cy + r);
  ctx.lineTo(cx + r * 0.25, cy - r * 0.35);
  ctx.lineTo(cx + r * 0.5, cy - r * 0.85);
  ctx.stroke();
}

/** Halo lumineux circulaire (mis en cache) : sert à la lumière des enclos et à la brume. */
export function glowSprite(color, size) {
  size = Math.max(4, Math.round(size));
  const key = `glow|${color}|${size}`;
  let cv = cache.get(key);
  if (cv) return cv;
  cv = makeCanvas(size, size);
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, color);
  g.addColorStop(0.45, rgba(color, 0.55));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  cache.set(key, cv);
  return cv;
}

/** Nuage de brume (mode Aventure). */
function drawCloud(ctx, s) {
  ctx.save();
  ctx.shadowColor = 'rgba(200, 180, 255, 0.8)';
  ctx.shadowBlur = s * 0.2;
  const grad = ctx.createLinearGradient(0, s * 0.25, 0, s * 0.78);
  grad.addColorStop(0, '#f3edff');
  grad.addColorStop(1, '#a796d6');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(s * 0.36, s * 0.56, s * 0.17, 0, Math.PI * 2);
  ctx.arc(s * 0.52, s * 0.44, s * 0.2, 0, Math.PI * 2);
  ctx.arc(s * 0.67, s * 0.57, s * 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(s * 0.36, s * 0.55, s * 0.31, s * 0.17);
  ctx.restore();
  ctx.fillStyle = 'rgba(90, 70, 140, 0.35)';
  ctx.fillRect(s * 0.3, s * 0.68, s * 0.42, s * 0.05);
}

/** Cristal (mode Aventure) : prisme hexagonal violet et cyan. */
function drawCrystal(ctx, s) {
  const cx = s / 2, cy = s / 2;
  const w = s * 0.24, hgt = s * 0.38;
  ctx.save();
  ctx.shadowColor = 'rgba(190, 120, 255, 0.9)';
  ctx.shadowBlur = s * 0.28;
  ctx.beginPath();
  ctx.moveTo(cx, cy - hgt);
  ctx.lineTo(cx + w, cy - hgt * 0.45);
  ctx.lineTo(cx + w, cy + hgt * 0.45);
  ctx.lineTo(cx, cy + hgt);
  ctx.lineTo(cx - w, cy + hgt * 0.45);
  ctx.lineTo(cx - w, cy - hgt * 0.45);
  ctx.closePath();
  const grad = ctx.createLinearGradient(cx - w, cy - hgt, cx + w, cy + hgt);
  grad.addColorStop(0, '#fbeaff');
  grad.addColorStop(0.4, '#c78bff');
  grad.addColorStop(1, '#5a3dff');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(40, 10, 90, 0.6)';
  ctx.lineWidth = Math.max(1, s * 0.025);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy - hgt);
  ctx.lineTo(cx, cy + hgt);
  ctx.moveTo(cx - w, cy - hgt * 0.45);
  ctx.lineTo(cx, cy - hgt * 0.1);
  ctx.lineTo(cx + w, cy - hgt * 0.45);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(cx - w * 0.45, cy - hgt * 0.4, s * 0.035, 0, Math.PI * 2);
  ctx.fill();
}

export function starPath(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
    ctx[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
}

/** Étoile filante (mode Classique). */
function drawStar(ctx, s) {
  ctx.save();
  ctx.shadowColor = 'rgba(255, 210, 90, 0.95)';
  ctx.shadowBlur = s * 0.3;
  starPath(ctx, s / 2, s / 2, s * 0.36);
  const grad = ctx.createRadialGradient(s * 0.45, s * 0.42, s * 0.02, s / 2, s / 2, s * 0.4);
  grad.addColorStop(0, '#fffbe6');
  grad.addColorStop(0.5, '#ffe27a');
  grad.addColorStop(1, '#ffb02e');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();
  ctx.lineWidth = Math.max(1, s * 0.025);
  ctx.strokeStyle = 'rgba(120, 70, 0, 0.45)';
  starPath(ctx, s / 2, s / 2, s * 0.36);
  ctx.stroke();
}

/** Symboles par couleur (option daltonisme) : rouge = rond, vert = triangle, bleu = carré. */
function drawSymbol(ctx, s, kind) {
  const cx = s / 2, cy = s / 2, r = s * 0.16;
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = Math.max(1, s * 0.025);
  ctx.beginPath();
  if (kind === 1) ctx.arc(cx, cy, r, 0, Math.PI * 2);
  else if (kind === 2) { ctx.moveTo(cx, cy - r * 1.15); ctx.lineTo(cx + r * 1.1, cy + r * 0.85); ctx.lineTo(cx - r * 1.1, cy + r * 0.85); ctx.closePath(); }
  else ctx.rect(cx - r * 0.9, cy - r * 0.9, r * 1.8, r * 1.8);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
