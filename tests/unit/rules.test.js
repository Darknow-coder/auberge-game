import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHAPES, FAMILIES, FAMILY_KEYS, ALL_KEYS, rotateKey } from '../../src/game/pieces.js';
import * as B from '../../src/game/board.js';
import { createRng } from '../../src/core/rng.js';
import { dealSet, solvable, canEncloseNow } from '../../src/game/generator.js';
import { newGame, place, usePower, giveUp, comboMult, areaPoints, mixMult, SCORE, COMBO_GRACE, TUTORIAL, trayFits, starsFor, bombArea, STAR_LIFE } from '../../src/game/engine.js';

const EMPTY = '........';
const rows = (...r) => r.concat(Array(B.ROWS - r.length).fill(EMPTY));
/** Partie classique avec une grille et des pièces imposées (sans étoile filante). */
function setup(boardRows, tray, extra = {}) {
  const s = newGame({ mode: 'classic', seed: 1 });
  s.board = B.boardFromRows(boardRows);
  s.tray = tray.map((p) => (p ? { col: B.R, ...p } : null));
  s.starCd = 999;
  Object.assign(s, extra);
  return s;
}

test('catalogue : formes normalisées, rotations cohérentes', () => {
  assert.equal(FAMILIES.length, 14);
  for (const k of ALL_KEYS) {
    const sh = SHAPES[k];
    assert.equal(Math.min(...sh.cells.map((c) => c[0])), 0);
    assert.equal(Math.min(...sh.cells.map((c) => c[1])), 0);
    let r = k;
    for (let i = 0; i < 4; i++) r = rotateKey(r);
    assert.equal(r, k);
  }
  assert.equal(FAMILY_KEYS.L4.length, 8);
});

test('grille 8 × 9 : bords, pose et objets', () => {
  assert.equal(B.COLS, 8);
  assert.equal(B.ROWS, 9);
  const b = B.boardFromRows(rows('r.......', '.o......'));
  assert.ok(B.isEdge(B.idx(0, 4)) && B.isEdge(B.idx(7, 8)) && !B.isEdge(B.idx(3, 4)));
  assert.ok(!B.canPlace(b, SHAPES['mono:0'], 0, 0), 'case occupée');
  assert.ok(!B.canPlace(b, SHAPES['mono:0'], 1, 1), 'une gemme ne se recouvre pas');
  assert.ok(B.canPlace(b, SHAPES['line4:1'], 7, 5), 'pièce verticale dans la dernière colonne');
  assert.ok(!B.canPlace(b, SHAPES['line4:1'], 7, 6), 'hors de la grille en bas');
});

test('enclos : zone non reliée au bord, en 4-connexité', () => {
  const open = B.boardFromRows(rows(EMPTY, '..rrr...', '..r.r...', '..r.....'));
  assert.equal(B.enclosures(open.c).length, 0, 'une brèche laisse fuir la lumière');
  const closed = B.boardFromRows(rows(EMPTY, '...r....', '..r.r...', '...r....'));
  const e = B.findEnclosures(closed);
  assert.equal(e.length, 1);
  assert.deepEqual(e[0].cells, [B.idx(3, 2)]);
  assert.equal(e[0].ring.length, 4, 'les diagonales vides ne comptent pas');
  const diag = B.boardFromRows(rows(EMPTY, '..rr....', '..r.r...', '...rr...'));
  assert.equal(B.findEnclosures(diag)[0].ring.length, 6, 'l\'anneau inclut les blocs en diagonale');
  const wall = B.boardFromRows(rows('r.r.....', '.r......'));
  assert.equal(B.enclosures(wall.c).length, 0, 'le bord ne sert pas de mur');
});

test('enclos : mélange des lumières de l\'enceinte', () => {
  const b = B.boardFromRows(rows(EMPTY, '...r....', '..g.b...', '...r....'));
  const [e] = B.findEnclosures(b);
  assert.equal(e.mix, B.WHITE);
  assert.equal(mixMult(e.mix), 2);
  assert.equal(mixMult(B.R), 1);
  assert.equal(mixMult(B.R | B.G), 1.5);
  const st = B.boardFromRows(rows(EMPTY, '...#....', '..#.#...', '...r....'));
  assert.equal(B.findEnclosures(st)[0].mix, B.R, 'les pierres n\'éclairent pas');
});

test('pose qui ferme un enclos : points, anneau effacé, statistiques', () => {
  const s = setup(rows(EMPTY, '...g....', '..g.b...'), [{ k: 'mono:0', col: B.R }, { k: 'mono:0', col: B.R }, null]);
  const r = place(s, 0, 3, 3);
  assert.ok(r.ok);
  const enc = r.events.find((e) => e.type === 'enclose');
  assert.ok(enc, 'un enclos est fermé');
  assert.equal(enc.regions.length, 1);
  assert.equal(enc.regions[0].area, 1);
  assert.ok(enc.regions[0].white);
  assert.equal(enc.cleared.length, 4);
  assert.equal(enc.points, (areaPoints(1) + SCORE.ring * 4) * 2);
  assert.ok(B.isEmpty(s.board.c));
  assert.ok(r.events.some((e) => e.type === 'boardClear'));
  assert.equal(s.stats.areas, 1);
  assert.equal(s.stats.light, 1);
  assert.equal(s.stats.whites, 1);
  assert.equal(s.score, 1 + enc.points + SCORE.boardClear);
});

test('points : très croissants avec la taille de la zone', () => {
  assert.equal(areaPoints(1), 20);
  assert.equal(areaPoints(4), 200);
  assert.equal(areaPoints(9), 900);
  assert.ok(areaPoints(9) / 9 > 4 * (areaPoints(1) / 1));
});

test('deux enclos d\'un coup : bonus multiple', () => {
  const s = setup(rows(EMPTY, '.r...r..', 'r.r.r.r.', EMPTY), [{ k: 'line5:0', col: B.R }, null, null]);
  const r = place(s, 0, 1, 3);
  const enc = r.events.find((e) => e.type === 'enclose');
  assert.equal(enc.regions.length, 2);
  assert.equal(enc.multi, 1.5);
  assert.equal(s.stats.multi, 2);
});

test('combo : progresse, tolère une pose sans enclos, puis retombe', () => {
  assert.equal(COMBO_GRACE, 2);
  assert.equal(comboMult(1), 1);
  assert.equal(comboMult(3), 2);
  assert.equal(comboMult(40), 5);
  const s = setup(rows(EMPTY, '...r..r.', '..r.rr.r', EMPTY, EMPTY, EMPTY, '..r.....', '.r.r....'),
    [{ k: 'mono:0' }, { k: 'mono:0' }, { k: 'mono:0' }]);
  place(s, 0, 3, 3);
  assert.equal(s.combo, 1);
  place(s, 1, 6, 3);
  assert.equal(s.combo, 2);
  s.tray = [{ k: 'mono:0', col: B.G }, { k: 'mono:0', col: B.G }, { k: 'mono:0', col: B.G }];
  place(s, 0, 6, 6);
  assert.equal(s.combo, 2, 'une pose sans enclos est tolérée');
  const r = place(s, 1, 0, 8);
  assert.equal(s.combo, 0);
  assert.ok(r.events.some((e) => e.type === 'comboEnd'));
});

test('gemmes et pierres : récoltées et brisées par l\'enclos', () => {
  const s = setup(rows(EMPTY, '...#....', '..#o#...'), [{ k: 'mono:0' }, null, null]);
  s.goals = [{ type: 'gems', target: 1 }, { type: 'stones', target: 3 }];
  s.movesMax = 5;
  s.mode = 'adventure';
  const r = place(s, 0, 3, 3);
  assert.equal(s.stats.gems, 1);
  assert.equal(s.stats.stones, 3);
  assert.equal(s.board.o[B.idx(3, 2)], 0);
  assert.equal(s.status, 'won');
  assert.ok(r.events.some((e) => e.type === 'end' && e.status === 'won'));
  assert.equal(starsFor(s), 3);
});

test('étoile filante : apparaît à l\'intérieur, s\'éteint, se capture', () => {
  const s = setup(rows(), [{ k: 'mono:0' }, { k: 'mono:0' }, { k: 'mono:0' }], { starCd: 0 });
  let spawned = null;
  for (let i = 0; i < 40 && !spawned; i++) {
    s.tray = [{ k: 'mono:0', col: B.R }, null, null];
    s.board.c.fill(0);
    if (s.star) { s.board.o[s.star.i] = 0; s.star = null; }
    const r = place(s, 0, 0, 0);
    spawned = r.events.find((e) => e.type === 'starSpawn');
  }
  assert.ok(spawned, 'une étoile finit par apparaître');
  assert.ok(!B.isEdge(spawned.i));
  assert.equal(s.board.o[spawned.i], B.STAR);
  assert.equal(s.star.life, STAR_LIFE);
  // Elle s'éteint après STAR_LIFE poses.
  let gone = false;
  for (let i = 0; i < STAR_LIFE && !gone; i++) {
    s.tray = [{ k: 'mono:0', col: B.R }, null, null];
    s.board.c.fill(0);
    s.board.o.fill(0);
    s.board.o[spawned.i] = B.STAR;
    gone = place(s, 0, 0, 0).events.some((e) => e.type === 'starGone');
  }
  assert.ok(gone);
  // Capture : une étoile encerclée double les points de l'enclos.
  const t = setup(rows(EMPTY, '...r....', '..r*r...'), [{ k: 'mono:0' }, null, null]);
  t.star = { i: B.idx(3, 2), life: 5 };
  const r = place(t, 0, 3, 3);
  const enc = r.events.find((e) => e.type === 'enclose');
  assert.ok(enc.regions[0].star);
  assert.equal(enc.points, (areaPoints(1) + SCORE.ring * 4) * 2);
  assert.equal(t.stats.stars, 1);
  assert.equal(t.star, null);
});

test('pose refusée hors grille, sur un bloc ou sur un objet', () => {
  const s = setup(rows('r.......', '.o......'), [{ k: 'duo:0' }, null, null]);
  assert.equal(place(s, 0, 0, 0).reason, 'blocked');
  assert.equal(place(s, 0, 7, 3).reason, 'blocked');
  assert.equal(place(s, 0, 1, 1).reason, 'blocked');
  assert.equal(place(s, 1, 0, 3).reason, 'empty');
  assert.ok(place(s, 0, 4, 4).ok);
});

test('pouvoirs : rotation, bombe, relance', () => {
  const s = setup(rows(EMPTY, '.rrr....', '.r.r....', '.rr.....'), [{ k: 'line3:0' }, { k: 'mono:0' }, { k: 'square2:0' }]);
  const k0 = s.tray[0].k;
  assert.ok(usePower(s, 'rotate', { ti: 0 }).ok);
  assert.equal(s.tray[0].k, rotateKey(k0));
  assert.equal(usePower(s, 'rotate', { ti: 1 }).reason, 'none');
  s.powers.rotate = 1;
  assert.equal(usePower(s, 'rotate', { ti: 1 }).reason, 'symmetric');
  const r = usePower(s, 'bomb', { x: 2, y: 2 });
  assert.ok(r.ok);
  assert.equal(r.events[0].cleared.length, 7);
  assert.equal(bombArea(0, 0).length, 4);
  s.powers.bomb = 1;
  assert.equal(usePower(s, 'bomb', { x: 6, y: 7 }).reason, 'nothing');
  const before = JSON.stringify(s.tray);
  assert.ok(usePower(s, 'reroll').ok);
  assert.notEqual(JSON.stringify(s.tray), before);
  assert.equal(s.stats.powersUsed, 3);
});

// Grille pleine sauf quelques cases isolées sur le bord gauche (aucun enclos possible).
const FULLISH = Array.from({ length: 9 }, (_, y) => (y % 2 ? 'rrrrrrrr' : '.rrrrrrr'));

test('impasse : sauvetage possible avec un pouvoir, sinon fin de partie', () => {
  const s = setup(FULLISH, [{ k: 'square2:0' }, { k: 'line3:0' }, null]);
  s.tray = [{ k: 'square2:0', col: B.R }, { k: 'line3:0', col: B.R }, null];
  assert.deepEqual(trayFits(s), [false, false, false]);
  const s2 = setup(FULLISH, [{ k: 'mono:0' }, { k: 'square2:0' }, null], { powers: { rotate: 0, bomb: 0, reroll: 0 } });
  assert.equal(B.enclosures(s2.board.c).length, 0);
  const r2 = place(s2, 0, 0, 0);
  assert.ok(r2.ok);
  assert.equal(s2.status, 'over');
  assert.equal(s2.end, 'noSpace');
  const s3 = setup(FULLISH, [{ k: 'mono:0' }, { k: 'square2:0' }, null]);
  const r3 = place(s3, 0, 0, 0);
  assert.equal(s3.status, 'stuck');
  assert.ok(r3.events.some((e) => e.type === 'stuck'));
  const u = usePower(s3, 'bomb', { x: 3, y: 4 });
  assert.ok(u.ok);
  assert.equal(s3.status, 'play');
  assert.ok(u.events.some((e) => e.type === 'rescued'));
  const s4 = setup(FULLISH, [{ k: 'square2:0' }, null, null], { status: 'stuck' });
  assert.ok(giveUp(s4).ok);
  assert.equal(s4.status, 'over');
});

test('record : événement unique quand on dépasse son meilleur score', () => {
  const s = setup(rows(EMPTY, '...r....', '..r.r...'), [{ k: 'mono:0' }, { k: 'mono:0' }, null], { best: 50 });
  const r = place(s, 0, 3, 3);
  assert.ok(r.events.some((e) => e.type === 'record'));
  const r2 = place(s, 1, 0, 0);
  assert.ok(!r2.events.some((e) => e.type === 'record'));
});

test('sauvegarde : un état JSON rechargé rejoue à l\'identique', () => {
  const a = newGame({ mode: 'classic', seed: 99 });
  const b = JSON.parse(JSON.stringify(a));
  for (let i = 0; i < 40; i++) {
    const ti = a.tray.findIndex(Boolean);
    const pos = B.positions(a.board, SHAPES[a.tray[ti].k])[0];
    if (!pos) break;
    const ra = place(a, ti, pos[0], pos[1]);
    const rb = place(b, ti, pos[0], pos[1]);
    assert.equal(ra.ok, rb.ok);
    if (a.status !== 'play') break;
  }
  assert.deepEqual(a, b);
});

test('initiation : la première pièce ferme un enclos de lumière blanche', () => {
  const s = newGame({ mode: 'classic', tutorial: true, seed: 3 });
  assert.equal(B.enclosures(s.board.c).length, 0);
  const { ti, x, y } = TUTORIAL.target;
  const r = place(s, ti, x, y);
  const enc = r.events.find((e) => e.type === 'enclose');
  assert.ok(enc && enc.regions[0].white && enc.regions[0].area === 4);
});

test('générateur : déterministe et lots jouables en début de partie', () => {
  const a = dealSet(B.createBoard(), createRng(5), { difficulty: 0 });
  const b = dealSet(B.createBoard(), createRng(5), { difficulty: 0 });
  assert.deepEqual(a, b);
  const rng = createRng(11);
  for (let t = 0; t < 40; t++) {
    const brd = B.createBoard();
    for (let i = 0; i < B.CELLS; i++) if ((i * 7 + t * 13) % 5 < 2) brd.c[i] = B.R;
    B.resolve(brd);
    const set = dealSet(brd, rng, { difficulty: 0 });
    assert.equal(set.length, 3);
    assert.ok(solvable(brd, set.map((p) => SHAPES[p.k]), 30000), `lot ${t} jouable`);
    for (const p of set) assert.ok(B.COLORS.includes(p.col));
  }
});

test('générateur : détecte un enclos fermable', () => {
  const b = B.boardFromRows(rows(EMPTY, '...r....', '..r.r...'));
  assert.ok(canEncloseNow(b, [SHAPES['mono:0']]));
  assert.ok(!canEncloseNow(B.createBoard(), [SHAPES['mono:0']]));
});

test('aventure : coups limités, défaite et lot réduit', () => {
  const level = { n: 99, rows: rows(), goals: [{ type: 'areas', target: 50 }], moves: 4, diff: 0 };
  const s = newGame({ mode: 'adventure', level, seed: 8 });
  for (let i = 0; i < 3; i++) {
    const ti = s.tray.findIndex(Boolean);
    const [x, y] = B.positions(s.board, SHAPES[s.tray[ti].k]).at(-1);
    place(s, ti, x, y);
  }
  assert.equal(s.tray.filter(Boolean).length, 1);
  const ti = s.tray.findIndex(Boolean);
  const [x, y] = B.positions(s.board, SHAPES[s.tray[ti].k])[0];
  place(s, ti, x, y);
  assert.equal(s.status, 'lost');
  assert.equal(s.end, 'moves');
  assert.equal(starsFor(s), 0);
});
