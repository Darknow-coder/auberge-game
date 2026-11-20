// Grille de jeu : 8 colonnes × 9 lignes.
// `c[i]` : 0 = vide, 1 / 2 / 4 = bloc de lumière rouge / verte / bleue, STONE = pierre.
// `o[i]` : objet posé sur une case VIDE (gemme en Aventure, étoile filante en Classique).
//          Une case qui porte un objet ne peut pas recevoir de pièce : il faut l'encercler.
//
// Règle centrale : une zone de cases vides qui n'est plus reliée au bord de la grille est
// « encerclée ». Elle s'illumine, et toutes les pièces qui l'entourent (y compris en
// diagonale) disparaissent. Le bord est ouvert : la lumière s'échappe par les côtés.
import { SHAPES } from './pieces.js';

export const COLS = 8;
export const ROWS = 9;
export const CELLS = COLS * ROWS;
export const R = 1, G = 2, B = 4, WHITE = 7, STONE = 8;
export const COLORS = [R, G, B];
export const GEM = 1, STAR = 2;

export const bits = (m) => (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1);
export const idx = (x, y) => y * COLS + x;
export const isEdge = (i) => { const x = i % COLS, y = (i / COLS) | 0; return x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1; };

export function createBoard() {
  return { c: new Array(CELLS).fill(0), o: new Array(CELLS).fill(0) };
}

export function cloneBoard(b) {
  return { c: b.c.slice(), o: b.o.slice() };
}

export function canPlace(b, shape, x, y) {
  if (x < 0 || y < 0 || x + shape.w > COLS || y + shape.h > ROWS) return false;
  for (const [dx, dy] of shape.cells) {
    const i = (y + dy) * COLS + x + dx;
    if (b.c[i] || b.o[i]) return false;
  }
  return true;
}

export function fits(b, shape) {
  for (let y = 0; y + shape.h <= ROWS; y++)
    for (let x = 0; x + shape.w <= COLS; x++) if (canPlace(b, shape, x, y)) return true;
  return false;
}

export function positions(b, shape) {
  const out = [];
  for (let y = 0; y + shape.h <= ROWS; y++)
    for (let x = 0; x + shape.w <= COLS; x++) if (canPlace(b, shape, x, y)) out.push([x, y]);
  return out;
}

const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Zones de cases vides encerclées (non reliées au bord), en 4-connexité. */
export function enclosures(c) {
  const seen = new Uint8Array(CELLS);
  const stack = [];
  for (let x = 0; x < COLS; x++) for (const y of [0, ROWS - 1]) { const i = y * COLS + x; if (!c[i] && !seen[i]) { seen[i] = 1; stack.push(i); } }
  for (let y = 1; y < ROWS - 1; y++) for (const x of [0, COLS - 1]) { const i = y * COLS + x; if (!c[i] && !seen[i]) { seen[i] = 1; stack.push(i); } }
  while (stack.length) {
    const i = stack.pop(), x = i % COLS, y = (i / COLS) | 0;
    for (const [dx, dy] of D4) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      const j = ny * COLS + nx;
      if (!seen[j] && !c[j]) { seen[j] = 1; stack.push(j); }
    }
  }
  const regions = [];
  for (let i = 0; i < CELLS; i++) {
    if (c[i] || seen[i]) continue;
    const reg = [];
    seen[i] = 2;
    stack.push(i);
    while (stack.length) {
      const k = stack.pop(), x = k % COLS, y = (k / COLS) | 0;
      reg.push(k);
      for (const [dx, dy] of D4) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
        const j = ny * COLS + nx;
        if (!seen[j] && !c[j]) { seen[j] = 2; stack.push(j); }
      }
    }
    regions.push(reg.sort((a, b) => a - b));
  }
  return regions;
}

/** Blocs qui entourent une zone : voisins de ses cases, diagonales comprises. */
export function ringOf(c, region) {
  const set = new Set();
  for (const k of region) {
    const x = k % COLS, y = (k / COLS) | 0;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
        const j = ny * COLS + nx;
        if (c[j]) set.add(j);
      }
  }
  return [...set].sort((a, b) => a - b);
}

/** Mélange des lumières d'un anneau (rouge + vert + bleu = blanc). Les pierres n'éclairent pas. */
export function mixOf(c, ring) {
  let m = 0;
  for (const j of ring) if (c[j] !== STONE) m |= c[j];
  return m;
}

/** Description des zones encerclées (sans rien modifier). */
export function findEnclosures(b) {
  return enclosures(b.c).map((cells) => {
    const ring = ringOf(b.c, cells);
    const gemCells = cells.filter((k) => b.o[k] === GEM);
    let stars = 0, stones = 0;
    for (const k of cells) if (b.o[k] === STAR) stars++;
    for (const j of ring) if (b.c[j] === STONE) stones++;
    return { cells, ring, mix: mixOf(b.c, ring), gems: gemCells.length, gemCells, stars, stones };
  });
}

/** Pose la pièce (sans vérification). Renvoie les index occupés. */
export function placeShape(b, shape, x, y, col) {
  const out = [];
  for (const [dx, dy] of shape.cells) {
    const i = (y + dy) * COLS + x + dx;
    b.c[i] = col;
    out.push(i);
  }
  return out;
}

/**
 * Résout les enclos : illumine les zones encerclées, retire les objets qu'elles contiennent
 * et efface les blocs qui les entourent. Renvoie les zones et les blocs effacés.
 */
export function resolve(b) {
  const regions = findEnclosures(b);
  if (!regions.length) return { regions, cleared: [] };
  const clear = new Set();
  for (const r of regions) {
    for (const j of r.ring) clear.add(j);
    for (const k of r.cells) b.o[k] = 0;
  }
  const cleared = [...clear].sort((a, b2) => a - b2).map((i) => ({ i, c: b.c[i] }));
  for (const { i } of cleared) b.c[i] = 0;
  return { regions, cleared };
}

/** Ce que produirait une pose, sans modifier la grille (pour l'aperçu). */
export function previewPlace(b, shape, x, y, col) {
  const saved = [];
  for (const [dx, dy] of shape.cells) { const i = (y + dy) * COLS + x + dx; saved.push(i, b.c[i]); b.c[i] = col; }
  const regions = findEnclosures(b);
  for (let j = 0; j < saved.length; j += 2) b.c[saved[j]] = saved[j + 1];
  return regions;
}

export function isEmpty(c) {
  for (let i = 0; i < CELLS; i++) if (c[i]) return false;
  return true;
}

export function countBlocks(c) {
  let n = 0;
  for (let i = 0; i < CELLS; i++) if (c[i]) n++;
  return n;
}

export function shapeOf(piece) {
  return SHAPES[piece.k];
}

/** Grille depuis 9 chaînes de 8 caractères : '.' vide, r g b blocs, '#' pierre, 'o' gemme, '*' étoile. */
export function boardFromRows(rows) {
  const b = createBoard();
  const col = { r: R, g: G, b: B };
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    const i = idx(x, y);
    if (ch in col) b.c[i] = col[ch];
    else if (ch === '#') b.c[i] = STONE;
    else if (ch === 'o') b.o[i] = GEM;
    else if (ch === '*') b.o[i] = STAR;
  }));
  return b;
}
