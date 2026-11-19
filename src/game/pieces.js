// Catalogue des pièces. Chaque famille est dessinée en ASCII ; toutes ses rotations
// (et symétries si `mirror`) sont générées puis dédoublonnées.
// `w` = [poids en début de partie, poids en difficulté maximale].

export const FAMILIES = [
  { id: 'mono', art: ['#'], w: [2.5, 1.2] },
  { id: 'duo', art: ['##'], w: [5, 3] },
  { id: 'line3', art: ['###'], w: [7, 5] },
  { id: 'corner3', art: ['##', '#.'], w: [7, 5] },
  { id: 'square2', art: ['##', '##'], w: [6, 5] },
  { id: 'line4', art: ['####'], w: [5, 5] },
  { id: 'L4', art: ['#.', '#.', '##'], mirror: true, w: [5, 7] },
  { id: 'T4', art: ['###', '.#.'], w: [4, 5] },
  { id: 'S4', art: ['.##', '##.'], mirror: true, w: [3, 5] },
  { id: 'line5', art: ['#####'], w: [2.5, 4.5] },
  { id: 'corner5', art: ['###', '#..', '#..'], w: [2.5, 5] },
  { id: 'rect6', art: ['###', '###'], w: [2.5, 4] },
  { id: 'square3', art: ['###', '###', '###'], w: [1.5, 3.5] },
  { id: 'diag2', art: ['#.', '.#'], w: [0, 1.2] },
];

function parseArt(art) {
  const cells = [];
  art.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') cells.push([x, y]); }));
  return cells;
}

function normalize(cells) {
  const minX = Math.min(...cells.map((c) => c[0]));
  const minY = Math.min(...cells.map((c) => c[1]));
  const out = cells.map(([x, y]) => [x - minX, y - minY]);
  out.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  return out;
}

const keyOf = (cells) => cells.map((c) => c.join(',')).join(';');
const rotateCells = (cells) => normalize(cells.map(([x, y]) => [-y, x])); // 90° horaire
const mirrorCells = (cells) => normalize(cells.map(([x, y]) => [-x, y]));

/** Toutes les formes, indexées par clé (`famille:variante`). */
export const SHAPES = {};
/** Clés des variantes de chaque famille. */
export const FAMILY_KEYS = {};
const byGeometry = {};

for (const fam of FAMILIES) {
  const bases = [normalize(parseArt(fam.art))];
  if (fam.mirror) bases.push(mirrorCells(bases[0]));
  const seen = new Set();
  const keys = [];
  for (const base of bases) {
    let cur = base;
    for (let r = 0; r < 4; r++) {
      const geo = keyOf(cur);
      if (!seen.has(geo)) {
        seen.add(geo);
        const key = `${fam.id}:${keys.length}`;
        const w = Math.max(...cur.map((c) => c[0])) + 1;
        const h = Math.max(...cur.map((c) => c[1])) + 1;
        SHAPES[key] = { key, family: fam.id, cells: cur, w, h, n: cur.length };
        byGeometry[geo] = key;
        keys.push(key);
      }
      cur = rotateCells(cur);
    }
  }
  FAMILY_KEYS[fam.id] = keys;
}

export const ALL_KEYS = Object.keys(SHAPES);

/** Clé de la forme obtenue en tournant `key` de 90° dans le sens horaire. */
export function rotateKey(key) {
  return byGeometry[keyOf(rotateCells(SHAPES[key].cells))];
}

/** Poids de chaque famille pour une difficulté d ∈ [0, 1]. */
export function familyWeights(d) {
  return FAMILIES.map((f) => f.w[0] + (f.w[1] - f.w[0]) * d);
}
