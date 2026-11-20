// Distribution des pièces. Le générateur est « bienveillant » en début de partie : il garantit
// que les trois pièces peuvent être posées et propose souvent de quoi fermer un enclos
// (davantage pendant un combo), puis relâche ces garanties quand la difficulté monte.
import { next, chance, randInt, pickIndexWeighted } from '../core/rng.js';
import { FAMILIES, FAMILY_KEYS, SHAPES, ALL_KEYS, familyWeights } from './pieces.js';
import { COLS, ROWS, CELLS, COLORS, canPlace, fits, positions, enclosures, ringOf, countBlocks } from './board.js';

const lerp = (a, b, t) => a + (b - a) * t;

export function sampleKey(rng, weights) {
  const keys = FAMILY_KEYS[FAMILIES[pickIndexWeighted(rng, weights)].id];
  return keys[randInt(rng, keys.length)];
}

export const sampleColor = (rng) => COLORS[randInt(rng, COLORS.length)];

/** Pose puis résolution des enclos sur un tableau de cases (pour les recherches). */
function playOn(c, o, sh, x, y) {
  const undo = [];
  for (const [dx, dy] of sh.cells) { const k = (y + dy) * COLS + x + dx; undo.push(k, c[k]); c[k] = 1; }
  const regs = enclosures(c);
  let enclosed = regs.length;
  for (const r of regs) for (const j of ringOf(c, r)) { undo.push(j, c[j]); c[j] = 0; }
  return { undo, enclosed };
}

function unplay(c, undo) {
  for (let j = undo.length - 2; j >= 0; j -= 2) c[undo[j]] = undo[j + 1];
}

function canPlaceArr(c, o, sh, x, y) {
  for (const [dx, dy] of sh.cells) { const k = (y + dy) * COLS + x + dx; if (c[k] || o[k]) return false; }
  return true;
}

function dfs(c, o, shapes, mask, ctx) {
  if (!mask) return true;
  const tried = [];
  for (let i = 0; i < shapes.length; i++) {
    if (!(mask & (1 << i))) continue;
    const sh = shapes[i];
    if (tried.includes(sh)) continue;
    tried.push(sh);
    for (let y = 0; y + sh.h <= ROWS; y++) {
      for (let x = 0; x + sh.w <= COLS; x++) {
        if (!canPlaceArr(c, o, sh, x, y)) continue;
        if (--ctx.budget < 0) return false;
        const { undo } = playOn(c, o, sh, x, y);
        const ok = dfs(c, o, shapes, mask & ~(1 << i), ctx);
        unplay(c, undo);
        if (ok) return true;
      }
    }
  }
  return false;
}

/** Existe-t-il un ordre et des positions pour poser toutes ces formes ? (recherche bornée) */
export function solvable(b, shapes, budget = 2500) {
  return dfs(b.c.slice(), b.o, shapes, (1 << shapes.length) - 1, { budget });
}

/** Une des formes ferme-t-elle immédiatement un enclos ? */
export function canEncloseNow(b, shapes) {
  const c = b.c.slice();
  for (const sh of shapes) {
    for (let y = 0; y + sh.h <= ROWS; y++)
      for (let x = 0; x + sh.w <= COLS; x++) {
        if (!canPlaceArr(c, b.o, sh, x, y)) continue;
        for (const [dx, dy] of sh.cells) c[(y + dy) * COLS + x + dx] = 1;
        const n = enclosures(c).length;
        for (const [dx, dy] of sh.cells) c[(y + dy) * COLS + x + dx] = 0;
        if (n) return true;
      }
  }
  return false;
}

function fallbackKeys(b, rng) {
  const fitting = ALL_KEYS.filter((k) => fits(b, SHAPES[k])).sort((a, c) => SHAPES[a].n - SHAPES[c].n);
  if (!fitting.length) return ['mono:0', 'mono:0', 'mono:0'];
  const small = fitting.slice(0, Math.max(3, Math.ceil(fitting.length * 0.6)));
  for (let t = 0; t < 30; t++) {
    const keys = [0, 1, 2].map(() => small[randInt(rng, small.length)]);
    if (solvable(b, keys.map((k) => SHAPES[k]))) return keys;
  }
  return [fitting[0], 'mono:0', 'mono:0'];
}

/** Parmi quelques lots tirés au hasard, garde le plus contraignant (pièces difficiles à caser). */
function hardestSet(b, rng, weights, tries) {
  let best = null, bestH = -1;
  for (let t = 0; t < tries; t++) {
    const cand = [sampleKey(rng, weights), sampleKey(rng, weights), sampleKey(rng, weights)];
    let h = 0;
    for (const k of cand) h += 1 / (1 + positions(b, SHAPES[k]).length);
    if (h > bestH) { bestH = h; best = cand; }
  }
  return best;
}

/**
 * Tire un lot de trois pièces adapté à la grille.
 * opt : difficulty (0..1), pressure (0..1, chance de tirer un lot contraignant),
 *       mercy (lot facile garanti), combo.
 */
export function dealSet(b, rng, opt = {}) {
  const d = Math.max(0, Math.min(1, opt.difficulty ?? 0));
  const mercy = !!opt.mercy;
  const weights = familyWeights(mercy ? 0 : d);
  const fill = countBlocks(b.c) / CELLS;
  const guarantee = mercy || next(rng) < (opt.guarantee ?? lerp(1, 0.55, d));
  const pHelp = lerp(0.4, 0.15, d) + ((opt.combo || 0) >= 2 ? 0.2 : 0) + (fill > 0.5 ? 0.15 : 0);
  const helpful = mercy || next(rng) < Math.min(0.85, pHelp);
  let keys = null;
  if (!mercy && opt.pressure && next(rng) < opt.pressure) keys = hardestSet(b, rng, weights, opt.hardTries || 4);
  for (let t = 0; t < 40 && !keys; t++) {
    const cand = [sampleKey(rng, weights), sampleKey(rng, weights), sampleKey(rng, weights)];
    if (cand[0] === cand[1] && cand[1] === cand[2]) continue;
    const shapes = cand.map((k) => SHAPES[k]);
    if (guarantee && !solvable(b, shapes)) continue;
    if (helpful && t < 28 && !canEncloseNow(b, shapes)) continue;
    keys = cand;
  }
  if (!keys) keys = fallbackKeys(b, rng);
  return keys.map((k) => makePiece(rng, k));
}

export function makePiece(rng, k, col) {
  return { k, col: col ?? sampleColor(rng) };
}
