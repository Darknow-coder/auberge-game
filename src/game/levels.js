// Mode Aventure : 60 niveaux répartis en 6 mondes. Chaque niveau part d'un motif dessiné
// à la main, transformé (rotation, miroir) puis habillé selon le monde : blocs colorés,
// gemmes à récolter, pierres à briser, lignes d'une seule couleur à réussir.
// Le tirage est déterministe : le niveau 12 est le même pour tout le monde.
import { createRng, randInt, shuffle, hashString } from '../core/rng.js';
import { N, COLORS } from './board.js';

export const WORLDS = [
  { id: 1, from: 1, to: 10, icon: 'spark' },
  { id: 2, from: 11, to: 20, icon: 'gem' },
  { id: 3, from: 21, to: 30, icon: 'stone' },
  { id: 4, from: 31, to: 40, icon: 'prism' },
  { id: 5, from: 41, to: 50, icon: 'leaf' },
  { id: 6, from: 51, to: 60, icon: 'peak' },
];

const T = {
  rows2: ['........', '........', '........', '........', '........', '........', 'xxxxx.xx', 'xx.xxxxx'],
  bars: ['........', 'xxx..xxx', '........', '........', '........', '........', 'xxx..xxx', '........'],
  stairs: ['x.......', 'xx......', 'xxx.....', 'xxxx....', '........', '........', '........', '........'],
  corners: ['xx....xx', 'xx....xx', '........', '........', '........', '........', 'xx....xx', 'xx....xx'],
  frame: ['xx....xx', 'x......x', '........', '........', '........', '........', 'x......x', 'xx....xx'],
  cross: ['...xx...', '...xx...', '........', 'xx....xx', 'xx....xx', '........', '...xx...', '...xx...'],
  diamond: ['........', '...xx...', '..x..x..', '.x....x.', '.x....x.', '..x..x..', '...xx...', '........'],
  pillars: ['.x....x.', '.x....x.', '.x....x.', '........', '........', '.x....x.', '.x....x.', '.x....x.'],
  heart: ['........', '.xx.xx..', 'x..x..x.', 'x.....x.', '.x...x..', '..x.x...', '...x....', '........'],
  center: ['........', '........', '..xxxx..', '..x..x..', '..x..x..', '..xxxx..', '........', '........'],
  U: ['........', '........', 'x......x', 'x......x', 'x......x', 'x......x', 'xxx..xxx', '........'],
  zigzag: ['x.......', '.x......', '..x.....', '...x....', '....x...', '.....x..', '......x.', '........'],
  checker: ['........', '.x.x.x..', '..x.x.x.', '.x.x.x..', '..x.x.x.', '.x.x.x..', '........', '........'],
  steps: ['........', '........', '......xx', '....xxxx', '..xxxxx.', 'xxxxx...', 'xxx.....', '........'],
  ring: ['..xxxx..', '.x....x.', 'x......x', 'x......x', 'x......x', 'x......x', '.x....x.', '..xxxx..'],
  wave: ['........', 'xx......', '..xx....', '....xx..', '......xx', '....xx..', '..xx....', 'xx......'],
  bowl: ['........', '........', '........', '........', 'x......x', 'xx....xx', 'xxx..xxx', 'xxxx.xxx'],
  tower: ['...x....', '...xx...', '...xx...', '..xxx...', '..xxx...', '..xxxx..', '..xxxx..', '........'],
  prism3: ['........', '........', '........', '........', '........', 'xxxxx...', '........', 'xxxxxx..'],
  prismCols: ['x.x.....', 'x.x.....', 'x.x.....', 'x.x.....', 'x.......', 'x.x.....', '..x.....', '........'],
  prismMix: ['........', 'xxxxx...', '........', '........', '.......x', '.......x', '.......x', 'xxxxxx.x'],
  flower: ['...x....', '..xxx...', '.xx.xx..', '..xxx...', '...x....', '........', '.....xx.', '.....xx.'],
  arrow: ['...xx...', '..xxxx..', '.xx..xx.', 'xx....xx', '...xx...', '...xx...', '...xx...', '........'],
  maze: ['x.xxx.x.', 'x.....x.', 'x.xxx...', '..x.x.x.', 'x.x...x.', 'x.xxx.x.', 'x.......', 'x.xxxxx.'],
};

// [motif, objectifs, coups, options]
// options : mat ('color' | 'stone' | 'mix' | 'rowColor' | 'colColor'), gems (gemmes posées),
//           gemRate (gemmes dans les pièces), diff (difficulté des pièces), rot, mirror.
const g = (type, target) => ({ type, target });
const TABLE = [
  // Monde 1 — Premiers éclats : apprendre à faire des lignes
  ['rows2', [g('lines', 2)], 8, { diff: 0 }],
  ['bars', [g('score', 400)], 14, { diff: 0 }],
  ['stairs', [g('lines', 4)], 15, { diff: 0.05 }],
  ['corners', [g('score', 700)], 16, { diff: 0.05 }],
  ['U', [g('lines', 6)], 18, { diff: 0.1 }],
  ['diamond', [g('score', 1000)], 21, { diff: 0.1 }],
  ['pillars', [g('lines', 8)], 22, { diff: 0.12 }],
  ['center', [g('score', 1500)], 24, { diff: 0.15 }],
  ['steps', [g('lines', 10)], 24, { diff: 0.15 }],
  ['heart', [g('score', 2200)], 28, { diff: 0.2 }],
  // Monde 2 — Grotte aux gemmes
  ['rows2', [g('gems', 3)], 10, { gems: 3, diff: 0.1, rot: 2 }],
  ['corners', [g('gems', 4)], 12, { gems: 4, diff: 0.1 }],
  ['frame', [g('gems', 5)], 17, { gems: 5, diff: 0.12 }],
  ['diamond', [g('gems', 6)], 22, { gems: 5, gemRate: 0.15, diff: 0.15 }],
  ['cross', [g('gems', 6)], 18, { gems: 6, diff: 0.15 }],
  ['pillars', [g('gems', 8)], 22, { gems: 6, gemRate: 0.12, diff: 0.18, rot: 1 }],
  ['heart', [g('gems', 8)], 25, { gems: 6, gemRate: 0.15, diff: 0.2 }],
  ['checker', [g('gems', 8)], 32, { gems: 7, gemRate: 0.12, diff: 0.2 }],
  ['wave', [g('gems', 9)], 28, { gems: 6, gemRate: 0.18, diff: 0.22 }],
  ['ring', [g('gems', 11)], 32, { gems: 9, gemRate: 0.15, diff: 0.25 }],
  // Monde 3 — Carrière de pierre
  ['bars', [g('stones')], 10, { mat: 'stone', diff: 0.1 }],
  ['frame', [g('stones')], 24, { mat: 'stone', diff: 0.15 }],
  ['center', [g('stones')], 22, { mat: 'stone', diff: 0.18 }],
  ['zigzag', [g('stones')], 34, { mat: 'stone', diff: 0.18 }],
  ['diamond', [g('stones')], 28, { mat: 'stone', diff: 0.2 }],
  ['U', [g('stones')], 24, { mat: 'stone', diff: 0.2 }],
  ['stairs', [g('stones'), g('lines', 8)], 22, { mat: 'stone', diff: 0.22, mirror: true }],
  ['corners', [g('stones')], 20, { mat: 'stone', diff: 0.25 }],
  ['bowl', [g('stones')], 20, { mat: 'stone', diff: 0.25 }],
  ['ring', [g('stones')], 36, { mat: 'stone', diff: 0.28 }],
  // Monde 4 — Lac prisme : des lignes d'une seule couleur
  ['prism3', [g('pure', 1)], 10, { mat: 'rowColor', diff: 0.1 }],
  ['prism3', [g('pure', 1), g('lines', 4)], 16, { mat: 'rowColor', diff: 0.12, rot: 1 }],
  ['prismCols', [g('pure', 1)], 16, { mat: 'colColor', diff: 0.12 }],
  ['prismMix', [g('pure', 2)], 22, { mat: 'rowColor', diff: 0.15 }],
  ['prism3', [g('pure', 2)], 22, { mat: 'rowColor', diff: 0.15, mirror: true }],
  ['bars', [g('pure', 2)], 22, { mat: 'rowColor', diff: 0.18 }],
  ['prismCols', [g('pure', 2), g('score', 1500)], 24, { mat: 'colColor', diff: 0.18, mirror: true }],
  ['bowl', [g('pure', 2)], 24, { mat: 'rowColor', diff: 0.2 }],
  ['prismMix', [g('pure', 3)], 32, { mat: 'rowColor', diff: 0.2, rot: 2 }],
  ['steps', [g('pure', 3)], 36, { mat: 'rowColor', diff: 0.22 }],
  // Monde 5 — Forêt mêlée : gemmes et pierres
  ['flower', [g('gems', 4), g('stones')], 24, { mat: 'mix', gems: 4, diff: 0.2 }],
  ['arrow', [g('gems', 5), g('stones')], 22, { mat: 'mix', gems: 4, gemRate: 0.1, diff: 0.22 }],
  ['ring', [g('stones'), g('lines', 10)], 26, { mat: 'mix', diff: 0.25 }],
  ['tower', [g('gems', 6), g('stones')], 24, { mat: 'mix', gems: 5, gemRate: 0.1, diff: 0.25 }],
  ['heart', [g('gems', 5), g('stones')], 34, { mat: 'mix', gems: 4, gemRate: 0.12, diff: 0.25, rot: 2 }],
  ['steps', [g('stones'), g('score', 2000)], 26, { mat: 'mix', diff: 0.28 }],
  ['wave', [g('gems', 8), g('stones')], 32, { mat: 'mix', gems: 5, gemRate: 0.14, diff: 0.28 }],
  ['diamond', [g('stones'), g('gems', 5)], 30, { mat: 'mix', gems: 4, gemRate: 0.1, diff: 0.3, rot: 1 }],
  ['flower', [g('gems', 8), g('stones'), g('lines', 10)], 34, { mat: 'mix', gems: 5, gemRate: 0.12, diff: 0.3, mirror: true }],
  ['maze', [g('stones')], 30, { mat: 'mix', diff: 0.3 }],
  // Monde 6 — Le Sommet
  ['ring', [g('score', 3000)], 26, { diff: 0.45 }],
  ['tower', [g('stones'), g('pure', 1)], 22, { mat: 'stone', diff: 0.4 }],
  ['arrow', [g('gems', 8), g('score', 2000)], 28, { gems: 6, gemRate: 0.12, diff: 0.42, rot: 2 }],
  ['maze', [g('stones'), g('lines', 12)], 30, { mat: 'stone', diff: 0.42 }],
  ['prismMix', [g('pure', 3), g('score', 2500)], 28, { mat: 'rowColor', diff: 0.42 }],
  ['bowl', [g('stones'), g('gems', 6)], 22, { mat: 'mix', gems: 5, gemRate: 0.12, diff: 0.45 }],
  ['flower', [g('lines', 14)], 30, { diff: 0.5 }],
  ['steps', [g('stones'), g('pure', 2)], 26, { mat: 'mix', diff: 0.5, mirror: true }],
  ['cross', [g('gems', 10), g('stones'), g('score', 2500)], 32, { mat: 'mix', gems: 6, gemRate: 0.15, diff: 0.5 }],
  ['heart', [g('score', 4500)], 38, { diff: 0.55 }],
];

const rotate = (rows) => rows.map((_, y) => rows.map((r) => r[y]).reverse().join(''));
const mirror = (rows) => rows.map((r) => [...r].reverse().join(''));

function transform(rows, opt) {
  let out = rows.slice();
  for (let i = 0; i < (opt.rot || 0); i++) out = rotate(out);
  if (opt.mirror) out = mirror(out);
  return out;
}

function buildLevel(n, [tpl, goals, moves, opt]) {
  const rng = createRng(hashString(`prisme-level-${n}`));
  const shape = transform(T[tpl], opt);
  const mat = opt.mat || 'color';
  const grid = shape.map((r) => [...r]);
  const lineColor = [];
  const order = shuffle(rng, [1, 2, 3, 4, 5]);
  for (let k = 0; k < N; k++) lineColor.push(order[k % COLORS]);
  const colored = [];
  let alt = 0;
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      if (grid[y][x] !== 'x') continue;
      let v;
      if (mat === 'stone') v = '#';
      else if (mat === 'mix') v = (alt++ % 2 === 0) ? '#' : String(1 + randInt(rng, COLORS));
      else if (mat === 'rowColor') v = String(lineColor[y]);
      else if (mat === 'colColor') v = String(lineColor[x]);
      else v = String(1 + randInt(rng, COLORS));
      grid[y][x] = v;
      if (v !== '#') colored.push([x, y]);
    }
  shuffle(rng, colored);
  for (const [x, y] of colored.slice(0, opt.gems || 0)) grid[y][x] = String.fromCharCode(96 + +grid[y][x]);
  return {
    n,
    rows: grid.map((r) => r.join('')),
    goals: goals.map((x) => ({ ...x })),
    moves,
    gemRate: opt.gemRate || 0,
    diff: opt.diff ?? 0.2,
  };
}

export const LEVELS = TABLE.map((row, i) => buildLevel(i + 1, row));

export function getLevel(n) {
  return LEVELS[n - 1] || null;
}

export function worldOf(n) {
  return WORLDS.find((w) => n >= w.from && n <= w.to);
}
