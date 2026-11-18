// Génération de la carte : terrain, lac, rivière, route, sentiers, forêts, et auberge de départ.
import { MAP_W, MAP_H, TERRAIN } from '../data/constants.js';
import { Rng, hash2 } from '../core/util.js';

const T = TERRAIN;

export const VILLAGE_BUILDINGS = [
  { kind: 'house', x: 5, y: 33, w: 3, h: 3, roof: '#8a3b2e', wall: '#e8dcc4' },
  { kind: 'barn', x: 3, y: 28, w: 4, h: 3, roof: '#6b4a32', wall: '#9c6b43' },
  { kind: 'chapel', x: 6, y: 37, w: 2, h: 3, roof: '#4f5866', wall: '#efe7d8' },
  { kind: 'house', x: 19, y: 35, w: 3, h: 2, roof: '#5c6b3c', wall: '#e6d3b3' },
  { kind: 'shed', x: 25, y: 0, w: 2, h: 2, roof: '#6b4a32', wall: '#8f6a45' },
];

export function generateTerrain(seed) {
  const rng = new Rng(seed * 7 + 13);
  const W = MAP_W, H = MAP_H;
  const t = new Array(W * H).fill(T.GRASS);
  const set = (x, y, v) => { if (x >= 0 && y >= 0 && x < W && y < H) t[y * W + x] = v; };
  const get = (x, y) => t[y * W + x];

  // Lac à l'est (ellipse irrégulière) avec rive de sable.
  const lcx = 34, lcy = 20, lrx = 4.6, lry = 8;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const a = Math.atan2(y - lcy, x - lcx);
    const wob = 1 + 0.12 * Math.sin(a * 3 + 1) + 0.07 * Math.sin(a * 5 + 2);
    const d = Math.hypot((x - lcx) / lrx, (y - lcy) / lry) / wob;
    if (d < 1) set(x, y, T.WATER);
    else if (d < 1.22) set(x, y, T.SAND);
  }
  // Rivière depuis les montagnes (bord nord-est) jusqu'au lac.
  for (let y = 0; y <= 12; y++) {
    const cx = Math.round(31 + Math.sin(y * 0.55) * 1.6 + y * 0.18);
    set(cx, y, T.WATER); set(cx + 1, y, T.WATER);
  }
  // Route du village (bord sud-ouest) jusqu'à l'auberge.
  const road = [];
  for (let y = 39; y >= 25; y--) {
    const x = Math.round(13 + Math.sin((39 - y) * 0.32) * 1.4);
    road.push([x, y]);
  }
  let prev = null;
  for (const [x, y] of road) {
    set(x, y, T.ROAD);
    if (prev && prev[0] !== x) for (let xx = Math.min(prev[0], x); xx <= Math.max(prev[0], x); xx++) set(xx, prev[1], T.ROAD);
    prev = [x, y];
  }
  // Raccord route -> porte de l'auberge (17,24).
  for (let x = 13; x <= 17; x++) set(x, 25, T.PATH);
  set(17, 24, T.PATH);
  // Sentier de randonnée vers le nord-ouest (forêt) depuis l'arrière de l'auberge.
  const trail = [[14, 24], [13, 23], [12, 21], [12, 19], [11, 17], [10, 15], [9, 13], [7, 12], [5, 11], [3, 10], [1, 9], [0, 9]];
  for (let i = 0; i < trail.length - 1; i++) {
    const [ax, ay] = trail[i], [bx, by] = trail[i + 1];
    const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
    for (let k = 0; k <= n; k++) set(Math.round(ax + ((bx - ax) * k) / n), Math.round(ay + ((by - ay) * k) / n), T.PATH);
  }
  for (let y = 24; y <= 25; y++) set(14, y, T.PATH);
  // Petit chemin vers le ponton du lac (le ponton avance sur l'eau).
  for (let x = 24; x <= 33; x++) set(x, 24, get(x, 24) === T.WATER ? T.BRIDGE : T.PATH);
  // Sentier vers la cabane du nord, puis passerelle sur la rivière.
  for (let y = 1; y <= 12; y++) set(24, y, T.PATH);
  for (let x = 25; x <= 37; x++) set(x, 3, get(x, 3) === T.WATER ? T.BRIDGE : T.PATH);

  // Forêts : bandes nord-ouest et nord, plus coin est/sud-est. Bruit déterministe.
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (get(x, y) !== T.GRASS) continue;
    const n = rng.next();
    let f = 0;
    if (x < 10 && y < 12) f = 0.75;
    else if (y < 6) f = 0.55;
    else if (x < 6) f = 0.45;
    else if (x > 34 && y > 30) f = 0.6;
    else if (y > 35 && x > 20) f = 0.45;
    else if (x > 37) f = 0.5;
    if (n < f) set(x, y, T.FOREST);
  }
  // Arbres isolés dans les prés (hors cœur du terrain de l'auberge).
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (get(x, y) !== T.GRASS) continue;
    if (x >= 12 && x <= 27 && y >= 13 && y <= 33) continue;
    if (rng.chance(0.06)) set(x, y, T.FOREST);
  }
  // Rochers au pied des montagnes.
  for (let i = 0; i < 18; i++) {
    const x = rng.int(0, 30), y = rng.int(0, 4);
    if (get(x, y) === T.GRASS || get(x, y) === T.FOREST) set(x, y, T.ROCK);
  }
  // Dégage le terrain de départ de l'auberge et la route.
  for (let y = 13; y <= 27; y++) for (let x = 12; x <= 27; x++) if (get(x, y) === T.FOREST || get(x, y) === T.ROCK) set(x, y, T.GRASS);
  // Emprise des bâtiments du village.
  for (const b of VILLAGE_BUILDINGS) for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) set(x, y, T.GRASS);
  return t;
}

/** Arbres décoratifs : dérivés du terrain (cases FOREST) et d'une bordure hors carte, de façon stable (hash). */
export function generateScenery(seed, terrain) {
  const trees = [];
  for (let y = -7; y < MAP_H + 7; y++) for (let x = -7; x < MAP_W + 7; x++) {
    const inside = x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
    const h1 = hash2(x, y, seed), h2 = hash2(x, y, seed + 1), h3 = hash2(x, y, seed + 2);
    if (inside) {
      if (terrain[y * MAP_W + x] !== T.FOREST) continue;
      const lone = hash2(x, y, seed + 9) < 0.25;
      const kind = h1 < 0.78 ? 'pine' : h1 < 0.9 ? 'birch' : 'oak';
      trees.push({ x: x + 0.5 + (h2 - 0.5) * 0.3, y: y + 0.5 + (h3 - 0.5) * 0.3, kind: lone && h1 > 0.5 ? 'oak' : kind, s: 0.85 + h2 * 0.4, v: h3, tx: x, ty: y });
    } else {
      if (y >= MAP_H && Math.abs(x - 13) < 3) continue; // route
      if (h1 < (x < 0 || y < 0 ? 0.85 : 0.72)) trees.push({ x: x + 0.5 + (h2 - 0.5) * 0.4, y: y + 0.5 + (h3 - 0.5) * 0.4, kind: h2 < 0.86 ? 'pine' : 'birch', s: 0.95 + h3 * 0.45, v: h1, outside: true });
    }
  }
  return { trees, buildings: VILLAGE_BUILDINGS };
}
