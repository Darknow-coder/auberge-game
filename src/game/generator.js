// Distribution des pièces. Le générateur est « bienveillant » : il garantit en début de
// partie que les trois pièces peuvent être posées, propose régulièrement des pièces qui
// complètent une ligne (et davantage pendant un combo), puis relâche ces garanties à mesure
// que la difficulté monte, ce qui finit par mettre fin à la partie.
import { next, chance, randInt, pickIndexWeighted } from '../core/rng.js';
import { FAMILIES, FAMILY_KEYS, SHAPES, ALL_KEYS, familyWeights } from './pieces.js';
import { N, CELLS, COLORS, canPlace, fits, positions, countFilled, previewLines } from './board.js';

const lerp = (a, b, t) => a + (b - a) * t;

export function sampleKey(rng, weights) {
  const keys = FAMILY_KEYS[FAMILIES[pickIndexWeighted(rng, weights)].id];
  return keys[randInt(rng, keys.length)];
}

function fullLinesInto(c, out) {
  for (let y = 0; y < N; y++) {
    let full = true;
    for (let x = 0; x < N; x++) if (!c[y * N + x]) { full = false; break; }
    if (full) for (let x = 0; x < N; x++) out.add(y * N + x);
  }
  for (let x = 0; x < N; x++) {
    let full = true;
    for (let y = 0; y < N; y++) if (!c[y * N + x]) { full = false; break; }
    if (full) for (let y = 0; y < N; y++) out.add(y * N + x);
  }
  return out;
}

function dfs(c, shapes, mask, ctx) {
  if (!mask) return true;
  const tried = [];
  for (let i = 0; i < shapes.length; i++) {
    if (!(mask & (1 << i))) continue;
    const sh = shapes[i];
    if (tried.includes(sh)) continue;
    tried.push(sh);
    for (let y = 0; y + sh.h <= N; y++) {
      for (let x = 0; x + sh.w <= N; x++) {
        if (!canPlace(c, sh, x, y)) continue;
        if (--ctx.budget < 0) return false;
        const placed = [];
        for (const [dx, dy] of sh.cells) { const k = (y + dy) * N + x + dx; c[k] = 1; placed.push(k); }
        const full = fullLinesInto(c, new Set());
        const saved = [];
        for (const k of full) { saved.push(k, c[k]); c[k] = 0; }
        const ok = dfs(c, shapes, mask & ~(1 << i), ctx);
        for (let j = 0; j < saved.length; j += 2) c[saved[j]] = saved[j + 1];
        for (const k of placed) c[k] = 0;
        if (ok) return true;
      }
    }
  }
  return false;
}

/** Existe-t-il un ordre et des positions pour poser toutes ces formes ? (recherche bornée) */
export function solvable(c, shapes, budget = 3000) {
  return dfs(c.slice(), shapes, (1 << shapes.length) - 1, { budget });
}

/** Une des formes complète-t-elle immédiatement une ligne ? */
export function canClearNow(c, shapes) {
  const work = c.slice();
  for (const sh of shapes) {
    for (let y = 0; y + sh.h <= N; y++)
      for (let x = 0; x + sh.w <= N; x++) {
        if (!canPlace(work, sh, x, y)) continue;
        const l = previewLines(work, sh, x, y);
        if (l.rows.length || l.cols.length) return true;
      }
  }
  return false;
}

function fallbackKeys(c, rng) {
  const fitting = ALL_KEYS.filter((k) => fits(c, SHAPES[k])).sort((a, b) => SHAPES[a].n - SHAPES[b].n);
  if (!fitting.length) return ['mono:0', 'mono:0', 'mono:0'];
  const small = fitting.slice(0, Math.max(3, Math.ceil(fitting.length * 0.6)));
  for (let t = 0; t < 30; t++) {
    const keys = [0, 1, 2].map(() => small[randInt(rng, small.length)]);
    if (solvable(c, keys.map((k) => SHAPES[k]))) return keys;
  }
  return [fitting[0], 'mono:0', 'mono:0'];
}

/**
 * Tire un lot de trois pièces adapté à la grille.
 * opt : difficulty (0..1), pressure (0..1, chance de tirer un lot contraignant),
 *       mercy (lot facile garanti), combo, gemRate (chance de gemme).
 */
export function dealSet(c, rng, opt = {}) {
  const d = Math.max(0, Math.min(1, opt.difficulty ?? 0));
  const mercy = !!opt.mercy;
  const weights = familyWeights(mercy ? 0 : d);
  const fill = countFilled(c) / CELLS;
  const guarantee = mercy || next(rng) < (opt.guarantee ?? lerp(1, 0.7, d));
  const pHelp = lerp(0.42, 0.18, d) + ((opt.combo || 0) >= 2 ? 0.2 : 0) + (fill > 0.55 ? 0.12 : 0);
  const helpful = mercy || next(rng) < Math.min(0.85, pHelp);
  let keys = null;
  if (!mercy && opt.pressure && next(rng) < opt.pressure) keys = hardestSet(c, rng, weights, opt.hardTries || 4);
  for (let t = 0; t < 40 && !keys; t++) {
    const cand = [sampleKey(rng, weights), sampleKey(rng, weights), sampleKey(rng, weights)];
    if (cand[0] === cand[1] && cand[1] === cand[2]) continue;
    const shapes = cand.map((k) => SHAPES[k]);
    if (guarantee && !solvable(c, shapes)) continue;
    if (helpful && t < 28 && !canClearNow(c, shapes)) continue;
    keys = cand;
  }
  if (!keys) keys = fallbackKeys(c, rng);
  const wanted = opt.colorBias ? wantedColors(c) : [];
  return keys.map((k) => makePiece(rng, k, opt.gemRate || 0, wanted, opt.colorBias || 0));
}

/** Couleurs des lignes entamées d'une seule couleur (au moins 3 cases) : de bonnes candidates. */
export function wantedColors(c) {
  const out = [];
  for (let k = 0; k < N; k++) {
    for (let r = 0; r < 2; r++) {
      let col = 0, n = 0, ok = true;
      for (let j = 0; j < N && ok; j++) {
        const v = c[r ? k * N + j : j * N + k];
        if (!v) continue;
        if (v > COLORS || (col && v !== col)) ok = false;
        col = v;
        n++;
      }
      if (ok && n >= 3 && n < N) out.push(col);
    }
  }
  return out;
}

/** Parmi quelques lots tirés au hasard, garde le plus contraignant (pièces difficiles à caser). */
function hardestSet(c, rng, weights, tries) {
  let best = null, bestH = -1;
  for (let t = 0; t < tries; t++) {
    const cand = [sampleKey(rng, weights), sampleKey(rng, weights), sampleKey(rng, weights)];
    let h = 0;
    for (const k of cand) h += 1 / (1 + positions(c, SHAPES[k]).length);
    if (h > bestH) { bestH = h; best = cand; }
  }
  return best;
}

export function makePiece(rng, k, gemRate = 0, wanted = [], bias = 0) {
  const col = wanted.length && chance(rng, bias) ? wanted[randInt(rng, wanted.length)] : 1 + randInt(rng, COLORS);
  const p = { k, col, gem: -1 };
  if (gemRate > 0 && chance(rng, gemRate)) p.gem = randInt(rng, SHAPES[k].n);
  return p;
}
