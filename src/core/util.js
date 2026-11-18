// Utilitaires purs partagés (aucune dépendance DOM).

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const sum = (arr, fn = (x) => x) => arr.reduce((s, x) => s + fn(x), 0);

/** Générateur pseudo-aléatoire déterministe (mulberry32) sérialisable. */
export class Rng {
  constructor(seed = 1) { this.s = (seed >>> 0) || 1; }
  next() {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  float(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return Math.floor(a + (b - a + 1) * this.next()); }
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  /** items: [[value, weight], ...] */
  weighted(items) {
    const total = items.reduce((s, it) => s + Math.max(0, it[1]), 0);
    if (total <= 0) return items.length ? items[0][0] : undefined;
    let r = this.next() * total;
    for (const [v, w] of items) { r -= Math.max(0, w); if (r <= 0) return v; }
    return items[items.length - 1][0];
  }
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(this.next() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  }
}

/** Hash entier stable de coordonnées (variations visuelles déterministes). */
export function hash2(x, y, seed = 0) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function formatMoney(v) {
  const n = Math.round(v);
  return n.toLocaleString('fr-FR').replace(/ | /g, ' ');
}

export function plural(n, one, many) { return `${n} ${Math.abs(n) > 1 ? many : one}`; }

// ---- Couleurs ----
export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
}
/** Éclaircit (amt>0) ou assombrit (amt<0) une couleur, amt dans [-1,1]. */
export function shade(hex, amt) {
  const [r, g, b] = hexToRgb(hex);
  if (amt >= 0) return rgbToHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
  return rgbToHex(r * (1 + amt), g * (1 + amt), b * (1 + amt));
}
export function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t));
}
export function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
