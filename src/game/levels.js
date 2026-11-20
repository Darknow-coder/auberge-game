// Mode Aventure : 60 niveaux répartis en 6 mondes, sur la grille 8 × 9.
// Chaque niveau part d'un motif dessiné à la main (enclos à moitié construits, murs, cuvettes),
// éventuellement retourné, puis habillé selon le monde : blocs colorés, pierres, gemmes.
// Le tirage est déterministe : le niveau 12 est le même pour tout le monde.
import { createRng, randInt, shuffle, hashString } from '../core/rng.js';
import { COLS, ROWS } from './board.js';

export const WORLDS = [
  { id: 1, from: 1, to: 10, icon: 'spark' },
  { id: 2, from: 11, to: 20, icon: 'gem' },
  { id: 3, from: 21, to: 30, icon: 'stone' },
  { id: 4, from: 31, to: 40, icon: 'prism' },
  { id: 5, from: 41, to: 50, icon: 'leaf' },
  { id: 6, from: 51, to: 60, icon: 'peak' },
];

// Motifs 8 × 9 : 'x' = mur (habillé selon le niveau), 'o' = gemme, '.' = vide.
const T = {
  ring1: ['........', '........', '........', '...x....', '..xox...', '........', '........', '........', '........'],
  cup: ['........', '........', '..x..x..', '..xoox..', '..xxxx..', '........', '........', '........', '........'],
  cups2: ['........', '.x.x....', '.xox....', '.xxx.x.x', '.....xox', '.....xxx', '........', '........', '........'],
  dots: ['........', '..x...x.', '........', '.x..x...', '......x.', '..x.....', '.....x..', '.x......', '........'],
  frame: ['........', '.xxx.xx.', '.x....x.', '.x....x.', '........', '.x....x.', '.xx.xxx.', '........', '........'],
  walls: ['........', '.x..x...', '.x..x..x', '.x..x..x', '.x.....x', '....x..x', '.x..x...', '.x..x...', '........'],
  arch: ['........', '........', '..xxxx..', '.x....x.', '.x....x.', '.x....x.', '........', '........', '........'],
  spiral: ['........', '.xxxxxx.', '.x......', '.x.xxx..', '.x.x.x..', '.x.x....', '.x.xxxxx', '.x......', '........'],
  grid: ['........', '.x.x.x..', '........', '.x.x.x.x', '........', '..x.x.x.', '........', '.x.x.x..', '........'],
  heart: ['........', '.xx..xx.', 'x..xx..x', 'x......x', '.x....x.', '..x..x..', '........', '........', '........'],
  combs: ['........', '.x.x.x..', '.x.x.x..', '.xxxxxx.', '........', '..xxxxxx', '..x.x.x.', '..x.x.x.', '........'],
  steps: ['........', '.xx.....', '..xx....', '...xx...', '....xx..', '.....xx.', '........', '........', '........'],
  ladder: ['........', '..x..x..', '..xx.x..', '..x..x..', '..x..x..', '..x.xx..', '..x..x..', '........', '........'],
  bowls: ['........', '........', '.x.x.x.x', '.xxx.xxx', '........', '.x.x.x.x', '.xxx.xxx', '........', '........'],
  maze: ['........', '.xxxx.x.', '.x....x.', '.x.xx.x.', '...x..x.', '.x.x.xx.', '.x......', '.xxx.xx.', '........'],
  cross: ['........', '...x....', '...x....', '.xx..x..', '...x....', '...x....', '......x.', '.....x.x', '........'],
  big: ['........', '.xxxxxx.', '.x......', '.x......', '.x......', '.x......', '.x......', '.xxxxxx.', '........'],
  zigzag: ['........', '.x......', '..x.....', '.x.x....', '....x...', '...x.x..', '......x.', '.....x.x', '........'],
  pond: ['........', '..xx.x..', '.x....x.', '.x....x.', '.x......', '.x......', '..xx..x.', '........', '........'],
  basin: ['........', '........', '.x....x.', '.x....x.', '.x....x.', '.x....x.', '.xx..xx.', '........', '........'],
};

// [motif, objectifs, pièces disponibles, options]
// options : mat ('color' | 'stone' | 'mix' | 'red' | 'green' | 'blue' | 'rg'), gems (gemmes en plus),
//           diff (difficulté des pièces), flip (haut ↔ bas), mirror (gauche ↔ droite).
const g = (type, target) => ({ type, target });
const TABLE = [
  // Monde 1 — Premières lueurs : apprendre à encercler
  ['ring1', [g('areas', 1)], 4, { diff: 0 }],
  ['cup', [g('areas', 2)], 8, { diff: 0 }],
  ['cups2', [g('areas', 3)], 9, { diff: 0.05 }],
  ['dots', [g('score', 500)], 12, { diff: 0.05 }],
  ['arch', [g('big', 4)], 10, { diff: 0.05 }],
  ['frame', [g('light', 10)], 14, { diff: 0.1 }],
  ['walls', [g('areas', 6)], 14, { diff: 0.1 }],
  ['spiral', [g('score', 2000)], 16, { diff: 0.12 }],
  ['grid', [g('light', 15)], 20, { diff: 0.15 }],
  ['basin', [g('big', 8)], 12, { diff: 0.1 }],
  // Monde 2 — Grotte aux gemmes : encercler les gemmes
  ['cup', [g('gems', 2)], 6, { diff: 0.05, flip: true }],
  ['cups2', [g('gems', 2)], 9, { diff: 0.08, mirror: true }],
  ['dots', [g('gems', 3)], 12, { gems: 3, diff: 0.1 }],
  ['frame', [g('gems', 4)], 15, { gems: 4, diff: 0.1 }],
  ['bowls', [g('gems', 4)], 16, { gems: 4, diff: 0.12 }],
  ['bowls', [g('gems', 4)], 18, { gems: 4, diff: 0.12, flip: true }],
  ['heart', [g('gems', 5)], 18, { gems: 5, diff: 0.15, flip: true }],
  ['grid', [g('gems', 5)], 20, { gems: 5, diff: 0.15 }],
  ['ladder', [g('gems', 5)], 22, { gems: 5, diff: 0.18 }],
  ['maze', [g('gems', 7)], 24, { gems: 7, diff: 0.2 }],
  // Monde 3 — Carrière de pierre : les pierres servent de murs et se brisent avec l'enclos
  ['cup', [g('stones')], 6, { mat: 'stone', diff: 0.1 }],
  ['arch', [g('stones')], 10, { mat: 'stone', diff: 0.1, flip: true }],
  ['cups2', [g('stones')], 10, { mat: 'stone', diff: 0.12 }],
  ['steps', [g('stones')], 14, { mat: 'stone', diff: 0.15 }],
  ['bowls', [g('stones')], 14, { mat: 'stone', diff: 0.15 }],
  ['dots', [g('stones')], 20, { mat: 'stone', diff: 0.12 }],
  ['frame', [g('stones')], 18, { mat: 'stone', diff: 0.2 }],
  ['ladder', [g('stones')], 18, { mat: 'stone', diff: 0.2, mirror: true }],
  ['walls', [g('stones')], 24, { mat: 'stone', diff: 0.22 }],
  ['combs', [g('stones')], 22, { mat: 'stone', diff: 0.25 }],
  // Monde 4 — Lumière blanche : mélanger rouge, vert et bleu dans une même enceinte
  ['cup', [g('whites', 1)], 8, { mat: 'rg', diff: 0.1 }],
  ['arch', [g('whites', 1)], 10, { mat: 'red', diff: 0.1 }],
  ['cups2', [g('whites', 2)], 12, { mat: 'blue', diff: 0.12 }],
  ['dots', [g('whites', 2)], 14, { mat: 'color', diff: 0.12 }],
  ['frame', [g('whites', 2), g('light', 10)], 16, { mat: 'green', diff: 0.15 }],
  ['bowls', [g('whites', 3)], 16, { mat: 'rg', diff: 0.15 }],
  ['heart', [g('whites', 3)], 20, { mat: 'red', diff: 0.18 }],
  ['grid', [g('whites', 3), g('score', 1500)], 20, { mat: 'color', diff: 0.18 }],
  ['ladder', [g('whites', 4)], 22, { mat: 'blue', diff: 0.2 }],
  ['pond', [g('whites', 4), g('big', 8)], 24, { mat: 'color', diff: 0.2 }],
  // Monde 5 — Forêt mêlée : gemmes, pierres et grands enclos
  ['bowls', [g('gems', 3), g('stones')], 16, { mat: 'mix', gems: 3, diff: 0.2 }],
  ['pond', [g('big', 10)], 14, { mat: 'color', diff: 0.2 }],
  ['frame', [g('gems', 4), g('stones')], 20, { mat: 'mix', gems: 4, diff: 0.22 }],
  ['zigzag', [g('light', 18)], 20, { diff: 0.22 }],
  ['ladder', [g('stones'), g('whites', 2)], 18, { mat: 'mix', diff: 0.25 }],
  ['heart', [g('gems', 4), g('big', 5)], 20, { gems: 4, diff: 0.25 }],
  ['maze', [g('stones'), g('gems', 4)], 24, { mat: 'mix', gems: 4, diff: 0.25 }],
  ['basin', [g('big', 12)], 16, { mat: 'color', diff: 0.25, flip: true }],
  ['combs', [g('stones'), g('light', 16)], 24, { mat: 'mix', diff: 0.28 }],
  ['grid', [g('gems', 5), g('whites', 3)], 26, { gems: 5, diff: 0.3 }],
  // Monde 6 — Le Sommet
  ['spiral', [g('score', 4000)], 24, { diff: 0.4 }],
  ['walls', [g('stones'), g('big', 6)], 24, { mat: 'stone', diff: 0.4 }],
  ['dots', [g('gems', 5), g('score', 2500)], 24, { gems: 5, diff: 0.42 }],
  ['maze', [g('stones'), g('whites', 3)], 24, { mat: 'mix', diff: 0.42 }],
  ['big', [g('big', 12), g('whites', 1)], 18, { mat: 'red', diff: 0.42 }],
  ['bowls', [g('gems', 5), g('stones'), g('areas', 10)], 26, { mat: 'mix', gems: 5, diff: 0.45 }],
  ['zigzag', [g('light', 22)], 26, { diff: 0.45 }],
  ['combs', [g('stones'), g('gems', 4)], 26, { mat: 'stone', gems: 4, diff: 0.48 }],
  ['heart', [g('whites', 4), g('big', 7)], 26, { mat: 'color', diff: 0.5 }],
  ['cross', [g('score', 5000)], 30, { diff: 0.55 }],
];

const flipV = (rows) => rows.slice().reverse();
const mirror = (rows) => rows.map((r) => [...r].reverse().join(''));

function buildLevel(n, [tpl, goals, moves, opt]) {
  const rng = createRng(hashString(`prisme-enclos-${n}`));
  let shape = T[tpl].slice();
  if (opt.flip) shape = flipV(shape);
  if (opt.mirror) shape = mirror(shape);
  const mat = opt.mat || 'color';
  const grid = shape.map((r) => [...r]);
  const pick = { red: 'r', green: 'g', blue: 'b' };
  let alt = 0;
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++) {
      if (grid[y][x] !== 'x') continue;
      let v;
      if (mat === 'stone') v = '#';
      else if (mat === 'mix') v = alt++ % 2 === 0 ? '#' : 'rgb'[randInt(rng, 3)];
      else if (mat in pick) v = pick[mat];
      else if (mat === 'rg') v = 'rg'[randInt(rng, 2)];
      else v = 'rgb'[randInt(rng, 3)];
      grid[y][x] = v;
    }
  // Gemmes supplémentaires sur des cases intérieures vides.
  const spots = [];
  for (let y = 1; y < ROWS - 1; y++) for (let x = 1; x < COLS - 1; x++) if (grid[y][x] === '.') spots.push([x, y]);
  shuffle(rng, spots);
  for (const [x, y] of spots.slice(0, opt.gems || 0)) grid[y][x] = 'o';
  return { n, rows: grid.map((r) => r.join('')), goals: goals.map((x) => ({ ...x })), moves, diff: opt.diff ?? 0.2 };
}

export const LEVELS = TABLE.map((row, i) => buildLevel(i + 1, row));

export function getLevel(n) {
  return LEVELS[n - 1] || null;
}

export function worldOf(n) {
  return WORLDS.find((w) => n >= w.from && n <= w.to);
}
