// Générateur pseudo-aléatoire déterministe (mulberry32).
// L'état est un simple objet { s } pour pouvoir être sauvegardé en JSON.

export function createRng(seed) {
  return { s: seed >>> 0 };
}

/** Nombre dans [0, 1). Fait avancer l'état. */
export function next(r) {
  let t = (r.s = (r.s + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const randInt = (r, n) => Math.floor(next(r) * n);
export const chance = (r, p) => next(r) < p;
export const pick = (r, arr) => arr[randInt(r, arr.length)];

/** Tire un index selon des poids positifs. */
export function pickIndexWeighted(r, weights) {
  let total = 0;
  for (const w of weights) total += w;
  let x = next(r) * total;
  for (let i = 0; i < weights.length; i++) {
    x -= weights[i];
    if (x < 0) return i;
  }
  return weights.length - 1;
}

export function shuffle(r, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(r, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Hachage FNV-1a 32 bits d'une chaîne. */
export function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function randomSeed() {
  return (Math.random() * 4294967296) >>> 0;
}
