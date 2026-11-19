// Joueur automatique. Sert aux tests (chaque niveau doit être gagnable), à l'équilibrage,
// aux médailles du défi du jour et aux indices.
import { SHAPES, rotateKey } from './pieces.js';
import { N, CELLS, STONE, canPlace, fits } from './board.js';
import { place, usePower, goalProgress } from './engine.js';

const BIG = ['square3:0', 'line5:0', 'line5:1', 'corner5:0', 'rect6:0', 'rect6:1'].map((k) => SHAPES[k]);

/** Évalue une grille (plus c'est haut, mieux c'est). `gw` : poids des objectifs en cours. */
export function evaluate(c, gw = NO_GOALS) {
  let empty = 0, holes = 0, trans = 0;
  for (let y = 0; y < N; y++) {
    let prev = 1;
    for (let x = 0; x < N; x++) {
      const f = c[y * N + x] ? 1 : 0;
      if (f !== prev) trans++;
      prev = f;
      if (!f) {
        empty++;
        const up = y === 0 || c[(y - 1) * N + x], dn = y === N - 1 || c[(y + 1) * N + x];
        const lf = x === 0 || c[y * N + x - 1], rt = x === N - 1 || c[y * N + x + 1];
        if (up && dn && lf && rt) holes++;
      }
    }
    if (!prev) trans++;
  }
  for (let x = 0; x < N; x++) {
    let prev = 1;
    for (let y = 0; y < N; y++) {
      const f = c[y * N + x] ? 1 : 0;
      if (f !== prev) trans++;
      prev = f;
    }
    if (!prev) trans++;
  }
  let room = 0;
  for (const sh of BIG) if (fits(c, sh)) room++;
  // Lignes « presque prisme » : toutes les cases posées ont la même couleur.
  let pureHope = 0;
  for (let k = 0; k < N; k++) {
    for (const isRow of [true, false]) {
      let col = 0, n = 0, ok = true;
      for (let j = 0; j < N && ok; j++) {
        const v = c[isRow ? k * N + j : j * N + k];
        if (!v) continue;
        if (v === STONE || (col && v !== col)) ok = false;
        col = v;
        n++;
      }
      if (ok && n >= 4) pureHope += n - 3;
    }
  }
  // Objectifs : remplir les lignes qui contiennent des pierres ou des gemmes.
  let goal = 0;
  if (gw.stones || gw.gems) {
    for (let k = 0; k < N; k++) {
      for (const isRow of [true, false]) {
        let t = 0, f = 0;
        for (let j = 0; j < N; j++) {
          const i = isRow ? k * N + j : j * N + k;
          if (!c[i]) continue;
          f++;
          if ((gw.stones && c[i] === STONE) || (gw.gems && gw.g[i])) t++;
        }
        if (t) goal += t * (f / N) * (f / N);
      }
    }
  }
  return empty * 1.0 - holes * 6 - trans * 0.9 + room * 3 + pureHope * (0.6 + gw.pure / 15) + goal * 3;
}

const NO_GOALS = { stones: 0, gems: 0, pure: 0, g: null };

/** Simule la pose et renvoie la valeur du coup. */
function moveValue(c, sh, x, y, col, goalW) {
  const placed = [];
  for (const [dx, dy] of sh.cells) { const i = (y + dy) * N + x + dx; c[i] = col; placed.push(i); }
  const rows = [], cols = [];
  for (let k = 0; k < N; k++) {
    let r = true, q = true;
    for (let j = 0; j < N; j++) { if (!c[k * N + j]) r = false; if (!c[j * N + k]) q = false; }
    if (r) rows.push(k);
    if (q) cols.push(k);
  }
  let value = 0;
  const saved = [];
  if (rows.length || cols.length) {
    const lines = rows.length + cols.length;
    value += 14 * lines + 6 * lines * lines;
    for (const r of rows) {
      const f = c[r * N]; let pure = f !== STONE;
      for (let j = 0; j < N; j++) { const i = r * N + j; if (c[i] !== f) pure = false; if (c[i] === STONE) value += goalW.stones; if (goalW.g && goalW.g[i]) value += goalW.gems; }
      if (pure) value += 10 + goalW.pure;
    }
    for (const q of cols) {
      const f = c[q]; let pure = f !== STONE;
      for (let j = 0; j < N; j++) { const i = j * N + q; if (c[i] !== f) pure = false; if (c[i] === STONE) value += goalW.stones; if (goalW.g && goalW.g[i]) value += goalW.gems; }
      if (pure) value += 10 + goalW.pure;
    }
    for (const r of rows) for (let j = 0; j < N; j++) { const i = r * N + j; if (c[i]) { saved.push(i, c[i]); c[i] = 0; } }
    for (const q of cols) for (let j = 0; j < N; j++) { const i = j * N + q; if (c[i]) { saved.push(i, c[i]); c[i] = 0; } }
  }
  value += evaluate(c, goalW);
  for (let j = 0; j < saved.length; j += 2) c[saved[j]] = saved[j + 1];
  for (const i of placed) c[i] = 0;
  return value;
}

function goalWeights(s) {
  const w = { stones: 0, gems: 0, pure: 0, g: null };
  for (const g of s.goals || []) {
    if (goalProgress(s, g) >= g.target) continue;
    if (g.type === 'stones') w.stones = 4;
    if (g.type === 'gems') { w.gems = 10; w.g = s.board.g; }
    if (g.type === 'pure') w.pure = 30;
  }
  return w;
}

/** Meilleur coup immédiat : { ti, x, y, value } ou null. */
export function bestMove(s) {
  const c = s.board.c.slice();
  const gw = goalWeights(s);
  let best = null;
  const seen = new Set();
  s.tray.forEach((p, ti) => {
    if (!p || seen.has(p.k + ':' + p.col)) return;
    seen.add(p.k + ':' + p.col);
    const sh = SHAPES[p.k];
    for (let y = 0; y + sh.h <= N; y++)
      for (let x = 0; x + sh.w <= N; x++) {
        if (!canPlace(c, sh, x, y)) continue;
        // Petite préférence pour poser d'abord les grosses pièces.
        const v = moveValue(c, sh, x, y, p.col, gw) + sh.n * 0.35;
        if (!best || v > best.value) best = { ti, x, y, value: v };
      }
  });
  return best;
}

function bestBomb(s) {
  let best = null;
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      let n = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const cx = x + dx, cy = y + dy;
          if (cx >= 0 && cy >= 0 && cx < N && cy < N && s.board.c[cy * N + cx]) n++;
        }
      if (!best || n > best.n) best = { x, y, n };
    }
  return best;
}

/** Utilise un pouvoir pour se sortir d'une impasse. Renvoie true si un pouvoir a servi. */
export function rescue(s) {
  for (let ti = 0; ti < 3; ti++) {
    const p = s.tray[ti];
    if (!p || s.powers.rotate <= 0) continue;
    const r = rotateKey(p.k);
    if (r !== p.k && fits(s.board.c, SHAPES[r])) return usePower(s, 'rotate', { ti }).ok;
  }
  if (s.powers.reroll > 0) return usePower(s, 'reroll').ok;
  if (s.powers.bomb > 0) { const b = bestBomb(s); return usePower(s, 'bomb', b).ok; }
  return false;
}

/** Joue jusqu'à la fin de la partie (ou `maxMoves`). */
export function autoplay(s, { maxMoves = 5000, usePowers = true, onEvents } = {}) {
  let guard = 0;
  while (guard++ < maxMoves) {
    if (s.status === 'stuck') {
      if (!usePowers || !rescue(s)) { s.status = s.mode === 'adventure' ? 'lost' : 'over'; s.end = 'noSpace'; }
      continue;
    }
    if (s.status !== 'play') break;
    const m = bestMove(s);
    if (!m) break;
    const r = place(s, m.ti, m.x, m.y);
    if (onEvents) onEvents(r.events);
  }
  return s;
}
