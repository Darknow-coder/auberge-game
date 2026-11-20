// Joueur automatique. Sert aux tests (chaque niveau doit être gagnable), à l'équilibrage,
// aux médailles du défi du jour et aux indices pour les débutants.
import { SHAPES, rotateKey } from './pieces.js';
import { COLS, ROWS, CELLS, STONE, WHITE, GEM, STAR, isEdge, canPlace, fits, enclosures, ringOf, mixOf, bits } from './board.js';
import { place, usePower, goalProgress, areaPoints, mixMult } from './engine.js';

const BIG = ['square3:0', 'line5:0', 'line5:1', 'corner5:0', 'rect6:0', 'rect6:1', 'square2:0', 'line4:0', 'line4:1'];
const EDGE = Array.from({ length: CELLS }, (_, i) => isEdge(i));

export const W = { pocket: 0.6, block: 0.5, edge: 0.3, room: 0.8, deadEdge: 2, enclose: 1, orb: 2.5, stone: 1.2 };

const NO_GOALS = { gems: 0, stones: 0, whites: 0, big: 0, star: 1, areas: 0, light: 0 };

/** Évalue une grille (plus c'est haut, mieux c'est). */
export function evaluate(b, gw = NO_GOALS) {
  const c = b.c, o = b.o;
  let pocket = 0, blocks = 0, edge = 0, dead = 0;
  for (let i = 0; i < CELLS; i++) {
    const x = i % COLS, y = (i / COLS) | 0;
    if (c[i]) { blocks++; if (EDGE[i]) edge++; continue; }
    let nb = 0, stoneNb = 0;
    if (x > 0 && c[i - 1]) { nb++; if (c[i - 1] === STONE) stoneNb++; }
    if (x < COLS - 1 && c[i + 1]) { nb++; if (c[i + 1] === STONE) stoneNb++; }
    if (y > 0 && c[i - COLS]) { nb++; if (c[i - COLS] === STONE) stoneNb++; }
    if (y < ROWS - 1 && c[i + COLS]) { nb++; if (c[i + COLS] === STONE) stoneNb++; }
    if (EDGE[i]) { if (nb >= 2 && !o[i]) dead += nb - 1; continue; }
    let w = 1;
    if (o[i] === GEM) w += gw.gems ? W.orb : 0;
    if (o[i] === STAR) w += W.orb * gw.star;
    pocket += nb * nb * w + (gw.stones ? stoneNb * W.stone : 0);
  }
  let room = 0;
  for (const k of BIG) if (fits(b, SHAPES[k])) room++;
  return pocket * W.pocket - blocks * W.block - edge * W.edge + room * W.room - dead * W.deadEdge;
}

/** Valeur immédiate des enclos qu'une grille contient (avant résolution). */
function enclosureValue(c, o, gw) {
  const regs = enclosures(c);
  if (!regs.length) return { v: 0, regs };
  let v = 0;
  for (const cells of regs) {
    const ring = ringOf(c, cells);
    const mix = mixOf(c, ring);
    v += (areaPoints(cells.length) + 5 * ring.length) * mixMult(mix) / 10;
    for (const k of cells) { if (o[k] === GEM) v += gw.gems; if (o[k] === STAR) v += 40 * gw.star; }
    for (const j of ring) if (c[j] === STONE) v += gw.stones;
    if (mix === WHITE) v += gw.whites;
    if (gw.big && cells.length >= gw.big) v += 60;
    v += gw.light * cells.length;
  }
  return { v: v + (8 + gw.areas) * regs.length, regs };
}

function moveValue(b, sh, x, y, col, gw) {
  const c = b.c, o = b.o;
  const undo = [];
  for (const [dx, dy] of sh.cells) { const k = (y + dy) * COLS + x + dx; undo.push(k, c[k]); c[k] = col; }
  const { v, regs } = enclosureValue(c, o, gw);
  const oUndo = [];
  for (const cells of regs) {
    for (const j of ringOf(c, cells)) { undo.push(j, c[j]); c[j] = 0; }
    for (const k of cells) if (o[k]) { oUndo.push(k, o[k]); o[k] = 0; }
  }
  const value = v * W.enclose + evaluate(b, gw);
  for (let j = undo.length - 2; j >= 0; j -= 2) c[undo[j]] = undo[j + 1];
  for (let j = 0; j < oUndo.length; j += 2) o[oUndo[j]] = oUndo[j + 1];
  return value;
}

function goalWeights(s) {
  const w = { gems: 0, stones: 0, whites: 0, big: 0, star: s.mode === 'classic' ? 1 : 0, areas: 0, light: 0 };
  for (const g of s.goals || []) {
    if (goalProgress(s, g) >= g.target) continue;
    if (g.type === 'gems') w.gems = 30;
    if (g.type === 'stones') w.stones = 6;
    if (g.type === 'whites') w.whites = 25;
    if (g.type === 'big') w.big = g.target;
    if (g.type === 'areas') w.areas = 25;
    if (g.type === 'light') w.light = 10;
  }
  return w;
}

/** Plus grande zone qu'un second coup permettrait d'encercler (anticipation pour les grands enclos). */
function bestFollowUpArea(b, tray, skip) {
  let best = 0;
  const c = b.c;
  tray.forEach((p, ti) => {
    if (!p || ti === skip) return;
    const sh = SHAPES[p.k];
    for (let y = 0; y + sh.h <= ROWS; y++)
      for (let x = 0; x + sh.w <= COLS; x++) {
        if (!canPlace(b, sh, x, y)) continue;
        for (const [dx, dy] of sh.cells) c[(y + dy) * COLS + x + dx] = 1;
        for (const r of enclosures(c)) if (r.length > best) best = r.length;
        for (const [dx, dy] of sh.cells) c[(y + dy) * COLS + x + dx] = 0;
      }
  });
  return best;
}

/** Meilleur coup immédiat : { ti, x, y, value } ou null. */
export function bestMove(s) {
  const b = { c: s.board.c.slice(), o: s.board.o.slice() };
  const gw = goalWeights(s);
  let best = null;
  const seen = new Set();
  s.tray.forEach((p, ti) => {
    if (!p || seen.has(p.k + ':' + p.col)) return;
    seen.add(p.k + ':' + p.col);
    const sh = SHAPES[p.k];
    for (let y = 0; y + sh.h <= ROWS; y++)
      for (let x = 0; x + sh.w <= COLS; x++) {
        if (!canPlace(b, sh, x, y)) continue;
        let v = moveValue(b, sh, x, y, p.col, gw) + sh.n * 0.3;
        if (gw.big) {
          // Objectif « grand enclos » : on regarde si une autre pièce pourrait ensuite le refermer.
          for (const [dx, dy] of sh.cells) b.c[(y + dy) * COLS + x + dx] = p.col;
          if (!enclosures(b.c).length && bestFollowUpArea(b, s.tray, ti) >= gw.big) v += 50;
          for (const [dx, dy] of sh.cells) b.c[(y + dy) * COLS + x + dx] = 0;
        }
        if (!best || v > best.value) best = { ti, x, y, value: v };
      }
  });
  return best;
}

function bestBomb(s) {
  let best = null;
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++) {
      let n = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const cx = x + dx, cy = y + dy;
          if (cx >= 0 && cy >= 0 && cx < COLS && cy < ROWS && s.board.c[cy * COLS + cx]) n++;
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
    if (r !== p.k && fits(s.board, SHAPES[r])) return usePower(s, 'rotate', { ti }).ok;
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

export { bits };
