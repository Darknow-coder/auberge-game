// Dessin procédural des blocs, mis en cache par (thème, couleur, taille, variante).
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

/** Marge autour du bloc (pour les halos du style néon), en fraction de la taille. */
export const PAD = 0.25;

/**
 * Sprite d'un bloc de `size` pixels (réels). `kind` : index de couleur 1..5, STONE, ou 'gray'.
 * opts : gem (gemme incrustée), symbol (symbole daltonien).
 */
export function blockSprite(theme, kind, size, opts = {}) {
  size = Math.max(4, Math.round(size));
  const key = `${theme.id}|${kind}|${size}|${opts.gem ? 1 : 0}|${opts.symbol ? 1 : 0}`;
  let cv = cache.get(key);
  if (cv) return cv;
  const pad = Math.ceil(size * PAD);
  cv = makeCanvas(size + pad * 2, size + pad * 2);
  const ctx = cv.getContext('2d');
  ctx.translate(pad, pad);
  if (kind === STONE) drawStone(ctx, size, theme);
  else {
    const color = kind === 'gray' ? (theme.dark ? '#5d5a70' : '#b8ad9e') : theme.colors[kind - 1];
    drawBlock(ctx, size, color, theme.style);
    if (opts.symbol && kind !== 'gray') drawSymbol(ctx, size, kind, theme.style);
  }
  if (opts.gem) drawGem(ctx, size);
  cache.set(key, cv);
  return cv;
}

function drawBlock(ctx, s, c, style) {
  const g = s * 0.05;
  const x = g, y = g, w = s - 2 * g;
  if (style === 'neon') {
    roundRect(ctx, x + s * 0.04, y + s * 0.04, w - s * 0.08, w - s * 0.08, s * 0.16);
    ctx.fillStyle = mix(c, 'black', 0.72);
    ctx.fill();
    ctx.save();
    ctx.shadowColor = c;
    ctx.shadowBlur = s * 0.28;
    ctx.lineWidth = s * 0.075;
    ctx.strokeStyle = c;
    ctx.stroke();
    ctx.restore();
    roundRect(ctx, x + s * 0.18, y + s * 0.18, w - s * 0.36, w - s * 0.36, s * 0.08);
    ctx.fillStyle = rgba(c, 0.35);
    ctx.fill();
    ctx.lineWidth = s * 0.03;
    ctx.strokeStyle = mix(c, 'white', 0.55);
    roundRect(ctx, x + s * 0.04, y + s * 0.04, w - s * 0.08, w - s * 0.08, s * 0.16);
    ctx.stroke();
    return;
  }
  if (style === 'flat') {
    roundRect(ctx, x, y, w, w, s * 0.16);
    ctx.fillStyle = mix(c, 'black', 0.2);
    ctx.fill();
    roundRect(ctx, x, y, w, w - s * 0.1, s * 0.16);
    ctx.fillStyle = c;
    ctx.fill();
    roundRect(ctx, x + s * 0.12, y + s * 0.1, w - s * 0.24, s * 0.1, s * 0.05);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fill();
    return;
  }
  const radius = style === 'jelly' ? s * 0.3 : s * 0.2;
  // Corps : dégradé vertical.
  roundRect(ctx, x, y, w, w, radius);
  const body = ctx.createLinearGradient(0, y, 0, y + w);
  if (style === 'glass') {
    body.addColorStop(0, `rgba(${mixRgb(c, 'white', 0.3).join(',')},0.92)`);
    body.addColorStop(1, rgba(c, 0.55));
  } else {
    body.addColorStop(0, mix(c, 'white', 0.28));
    body.addColorStop(0.55, c);
    body.addColorStop(1, mix(c, 'black', 0.28));
  }
  ctx.fillStyle = body;
  ctx.fill();
  // Biseau intérieur.
  ctx.save();
  roundRect(ctx, x, y, w, w, radius);
  ctx.clip();
  ctx.lineWidth = s * 0.09;
  const edge = ctx.createLinearGradient(0, y, 0, y + w);
  edge.addColorStop(0, 'rgba(255,255,255,0.55)');
  edge.addColorStop(0.5, 'rgba(255,255,255,0.08)');
  edge.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.strokeStyle = edge;
  roundRect(ctx, x, y, w, w, radius);
  ctx.stroke();
  // Reflet brillant sur la moitié haute.
  const hl = ctx.createLinearGradient(0, y, 0, y + w * 0.55);
  hl.addColorStop(0, `rgba(255,255,255,${style === 'glass' ? 0.5 : 0.42})`);
  hl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hl;
  if (style === 'jelly') {
    ctx.beginPath();
    ctx.ellipse(x + w * 0.5, y + w * 0.26, w * 0.36, w * 0.17, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (style === 'glass') {
    ctx.beginPath();
    ctx.moveTo(x, y + w * 0.62);
    ctx.lineTo(x + w * 0.62, y);
    ctx.lineTo(x + w * 0.9, y);
    ctx.lineTo(x, y + w * 0.9);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fill();
  } else {
    roundRect(ctx, x + w * 0.1, y + w * 0.07, w * 0.8, w * 0.38, radius * 0.7);
    ctx.fill();
  }
  ctx.restore();
  // Éclat lumineux.
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(x + w * 0.22, y + w * 0.22, s * 0.045, 0, Math.PI * 2);
  ctx.fill();
}

function drawStone(ctx, s, theme) {
  const g = s * 0.05;
  const x = g, y = g, w = s - 2 * g;
  const c = theme.stone;
  roundRect(ctx, x, y, w, w, s * 0.14);
  const body = ctx.createLinearGradient(0, y, 0, y + w);
  body.addColorStop(0, mix(c, 'white', 0.18));
  body.addColorStop(1, mix(c, 'black', 0.35));
  ctx.fillStyle = body;
  ctx.fill();
  ctx.save();
  roundRect(ctx, x, y, w, w, s * 0.14);
  ctx.clip();
  // Taches de granit (positions fixes).
  const dots = [[0.25, 0.3, 0.07], [0.68, 0.22, 0.05], [0.55, 0.62, 0.08], [0.25, 0.75, 0.05], [0.8, 0.78, 0.06]];
  ctx.fillStyle = mix(c, 'black', 0.3);
  for (const [dx, dy, r] of dots) { ctx.beginPath(); ctx.arc(x + w * dx, y + w * dy, s * r, 0, Math.PI * 2); ctx.fill(); }
  // Fissures.
  ctx.strokeStyle = mix(c, 'black', 0.5);
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
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  roundRect(ctx, x, y, w, w, s * 0.14);
  ctx.stroke();
  ctx.restore();
}

function drawGem(ctx, s) {
  const cx = s / 2, cy = s / 2 + s * 0.02, r = s * 0.28;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = s * 0.08;
  ctx.shadowOffsetY = s * 0.03;
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
  grad.addColorStop(1, '#4fc8ff');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(20,70,120,0.55)';
  ctx.lineWidth = Math.max(1, s * 0.025);
  ctx.stroke();
  // Facettes.
  ctx.beginPath();
  ctx.moveTo(cx - r, cy - r * 0.35);
  ctx.lineTo(cx + r, cy - r * 0.35);
  ctx.moveTo(cx - r * 0.5, cy - r * 0.85);
  ctx.lineTo(cx - r * 0.25, cy - r * 0.35);
  ctx.lineTo(cx, cy + r);
  ctx.lineTo(cx + r * 0.25, cy - r * 0.35);
  ctx.lineTo(cx + r * 0.5, cy - r * 0.85);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.arc(cx - r * 0.45, cy - r * 0.55, s * 0.035, 0, Math.PI * 2);
  ctx.fill();
}

/** Symboles distincts par couleur (option daltonisme) : rond, triangle, carré, losange, étoile. */
function drawSymbol(ctx, s, kind, style) {
  const cx = s / 2, cy = s / 2, r = s * 0.17;
  ctx.save();
  ctx.fillStyle = style === 'flat' ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.8)';
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = Math.max(1, s * 0.02);
  ctx.beginPath();
  if (kind === 1) ctx.arc(cx, cy, r, 0, Math.PI * 2);
  else if (kind === 2) { ctx.moveTo(cx, cy - r * 1.1); ctx.lineTo(cx + r * 1.05, cy + r * 0.8); ctx.lineTo(cx - r * 1.05, cy + r * 0.8); ctx.closePath(); }
  else if (kind === 3) ctx.rect(cx - r * 0.85, cy - r * 0.85, r * 1.7, r * 1.7);
  else if (kind === 4) { ctx.moveTo(cx, cy - r * 1.15); ctx.lineTo(cx + r * 1.0, cy); ctx.lineTo(cx, cy + r * 1.15); ctx.lineTo(cx - r * 1.0, cy); ctx.closePath(); }
  else {
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.5 : r * 1.15;
      ctx[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    ctx.closePath();
  }
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
