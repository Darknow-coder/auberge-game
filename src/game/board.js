// Grille 8×8. `c[i]` : 0 = vide, 1..5 = couleur, STONE = pierre.
// `g[i]` : 1 si la case contient une gemme (mode Aventure).
import { SHAPES } from './pieces.js';

export const N = 8;
export const CELLS = N * N;
export const COLORS = 5;
export const STONE = 9;

export function createBoard() {
  return { c: new Array(CELLS).fill(0), g: new Array(CELLS).fill(0) };
}

export function cloneBoard(b) {
  return { c: b.c.slice(), g: b.g.slice() };
}

export const idx = (x, y) => y * N + x;

export function canPlace(c, shape, x, y) {
  if (x < 0 || y < 0 || x + shape.w > N || y + shape.h > N) return false;
  for (const [dx, dy] of shape.cells) if (c[(y + dy) * N + x + dx]) return false;
  return true;
}

/** La forme rentre-t-elle quelque part ? */
export function fits(c, shape) {
  for (let y = 0; y + shape.h <= N; y++)
    for (let x = 0; x + shape.w <= N; x++) if (canPlace(c, shape, x, y)) return true;
  return false;
}

export function positions(c, shape) {
  const out = [];
  for (let y = 0; y + shape.h <= N; y++)
    for (let x = 0; x + shape.w <= N; x++) if (canPlace(c, shape, x, y)) out.push([x, y]);
  return out;
}

export function rowFull(c, y) {
  for (let x = 0; x < N; x++) if (!c[y * N + x]) return false;
  return true;
}

export function colFull(c, x) {
  for (let y = 0; y < N; y++) if (!c[y * N + x]) return false;
  return true;
}

export function fullLines(c) {
  const rows = [], cols = [];
  for (let i = 0; i < N; i++) {
    if (rowFull(c, i)) rows.push(i);
    if (colFull(c, i)) cols.push(i);
  }
  return { rows, cols };
}

/** Lignes qui seraient complétées en posant `shape` en (x, y), sans modifier la grille. */
export function previewLines(c, shape, x, y) {
  const set = [];
  for (const [dx, dy] of shape.cells) {
    const i = (y + dy) * N + x + dx;
    if (!c[i]) { c[i] = 1; set.push(i); }
  }
  const res = fullLines(c);
  for (const i of set) c[i] = 0;
  return res;
}

/** Une ligne est « prisme » si ses 8 cases ont la même couleur (pierres exclues). */
export function linePure(c, isRow, k) {
  const first = c[isRow ? k * N : k];
  if (!first || first === STONE) return false;
  for (let j = 1; j < N; j++) if (c[isRow ? k * N + j : j * N + k] !== first) return false;
  return true;
}

export function lineCells(isRow, k) {
  const out = [];
  for (let j = 0; j < N; j++) out.push(isRow ? k * N + j : j * N + k);
  return out;
}

/** Pose la pièce (sans vérification) et renvoie les index occupés. */
export function placeShape(b, shape, x, y, color, gemCell = -1) {
  const out = [];
  shape.cells.forEach(([dx, dy], j) => {
    const i = (y + dy) * N + x + dx;
    b.c[i] = color;
    if (j === gemCell) b.g[i] = 1;
    out.push(i);
  });
  return out;
}

/** Vide les lignes et colonnes données. Renvoie les cases vidées (chacune une fois). */
export function clearLines(b, rows, cols) {
  const seen = new Set();
  const out = [];
  const take = (i) => {
    if (seen.has(i)) return;
    seen.add(i);
    out.push({ i, c: b.c[i], g: b.g[i] });
    b.c[i] = 0;
    b.g[i] = 0;
  };
  for (const y of rows) for (let x = 0; x < N; x++) take(y * N + x);
  for (const x of cols) for (let y = 0; y < N; y++) take(y * N + x);
  return out;
}

export function countFilled(c) {
  let n = 0;
  for (let i = 0; i < CELLS; i++) if (c[i]) n++;
  return n;
}

export function isEmpty(c) {
  for (let i = 0; i < CELLS; i++) if (c[i]) return false;
  return true;
}

export function shapeOf(piece) {
  return SHAPES[piece.k];
}

/** Grille depuis 8 chaînes : '.' vide, '1'..'5' couleur, '#' pierre, 'a'..'e' couleur + gemme. */
export function boardFromRows(rows) {
  const b = createBoard();
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    const i = idx(x, y);
    if (ch >= '1' && ch <= '5') b.c[i] = +ch;
    else if (ch === '#') b.c[i] = STONE;
    else if (ch >= 'a' && ch <= 'e') { b.c[i] = ch.charCodeAt(0) - 96; b.g[i] = 1; }
  }));
  return b;
}
