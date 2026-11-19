import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHAPES, FAMILIES, FAMILY_KEYS, ALL_KEYS, rotateKey } from '../../src/game/pieces.js';
import * as B from '../../src/game/board.js';
import { createRng } from '../../src/core/rng.js';
import { dealSet, solvable, wantedColors } from '../../src/game/generator.js';
import { newGame, place, usePower, giveUp, comboMult, clearPoints, SCORE, COMBO_GRACE, TUTORIAL, trayFits, starsFor, bombArea } from '../../src/game/engine.js';

const rows = (...r) => r.concat(Array(8 - r.length).fill('........'));
/** Partie classique avec une grille et des pièces imposées. */
function setup(boardRows, tray, extra = {}) {
  const s = newGame({ mode: 'classic', seed: 1 });
  s.board = B.boardFromRows(boardRows);
  s.tray = tray.map((p) => (p ? { gem: -1, ...p } : null));
  Object.assign(s, extra);
  return s;
}

test('catalogue : formes normalisées, rotations cohérentes', () => {
  assert.equal(FAMILIES.length, 14);
  for (const k of ALL_KEYS) {
    const sh = SHAPES[k];
    assert.equal(Math.min(...sh.cells.map((c) => c[0])), 0);
    assert.equal(Math.min(...sh.cells.map((c) => c[1])), 0);
    assert.equal(sh.n, sh.cells.length);
    let r = k;
    for (let i = 0; i < 4; i++) r = rotateKey(r);
    assert.equal(r, k, `4 rotations de ${k} reviennent au départ`);
    assert.equal(SHAPES[rotateKey(k)].family, sh.family);
  }
  assert.equal(FAMILY_KEYS.mono.length, 1);
  assert.equal(FAMILY_KEYS.L4.length, 8);
  assert.equal(FAMILY_KEYS.S4.length, 4);
  assert.equal(FAMILY_KEYS.corner3.length, 4);
  assert.equal(FAMILY_KEYS.line5.length, 2);
});

test('grille : pose, bords et lignes complètes', () => {
  const b = B.createBoard();
  const sq = SHAPES['square3:0'];
  assert.ok(B.canPlace(b.c, sq, 5, 5));
  assert.ok(!B.canPlace(b.c, sq, 6, 5));
  B.placeShape(b, sq, 0, 0, 2);
  assert.ok(!B.canPlace(b.c, SHAPES['mono:0'], 1, 1));
  const f = B.boardFromRows(rows('11111111', '1.......', '1.......', '1.......', '1.......', '1.......', '1.......', '1.......'));
  assert.deepEqual(B.fullLines(f.c), { rows: [0], cols: [0] });
  assert.ok(B.linePure(f.c, true, 0));
  const cleared = B.clearLines(f, [0], [0]);
  assert.equal(cleared.length, 15, 'la case commune n\'est comptée qu\'une fois');
  assert.ok(B.isEmpty(f.c));
});

test('grille : aperçu des lignes sans modifier la grille', () => {
  const b = B.boardFromRows(rows('111111..'));
  const before = b.c.slice();
  const l = B.previewLines(b.c, SHAPES['duo:0'], 6, 0);
  assert.deepEqual(l, { rows: [0], cols: [] });
  assert.deepEqual(b.c, before);
});

test('ligne prisme : une seule couleur, pierres exclues', () => {
  const b = B.boardFromRows(rows('33333333', '3333333#', '33333331'));
  assert.ok(B.linePure(b.c, true, 0));
  assert.ok(!B.linePure(b.c, true, 1));
  assert.ok(!B.linePure(b.c, true, 2));
});

test('score : pose, ligne simple, double ligne et prisme', () => {
  const s = setup(rows('1111111.', '2222222.'), [{ k: 'line3:1', col: 3 }, { k: 'mono:0', col: 1 }, null]);
  let r = place(s, 1, 7, 0); // ligne 0 : couleur 1 partout → prisme
  assert.ok(r.ok);
  const clear = r.events.find((e) => e.type === 'clear');
  assert.equal(clear.lines, 1);
  assert.equal(clear.pures, 1);
  assert.equal(clear.points, clearPoints(1, 1));
  assert.equal(s.score, 1 + SCORE.line + SCORE.pure);
  assert.equal(clearPoints(2, 0), SCORE.line * 3);
  assert.equal(clearPoints(3, 0), SCORE.line * 6);
});

test('combo : progresse, multiplie, tolère 2 poses sans ligne puis retombe', () => {
  assert.equal(comboMult(1), 1);
  assert.equal(comboMult(3), 2);
  assert.equal(comboMult(50), 5);
  const s = setup(rows('1111111.', '2222222.', '3333333.'), [{ k: 'mono:0', col: 4 }, { k: 'mono:0', col: 4 }, { k: 'mono:0', col: 4 }]);
  place(s, 0, 7, 0);
  assert.equal(s.combo, 1);
  const r = place(s, 1, 7, 1);
  assert.equal(s.combo, 2);
  assert.equal(r.events.find((e) => e.type === 'clear').points, Math.round(SCORE.line * comboMult(2)));
  s.tray = [{ k: 'mono:0', col: 1, gem: -1 }, { k: 'mono:0', col: 1, gem: -1 }, { k: 'mono:0', col: 1, gem: -1 }];
  for (let i = 0; i < COMBO_GRACE - 1; i++) place(s, i, i, 5);
  assert.equal(s.combo, 2, 'le combo survit à deux poses sans ligne');
  const r3 = place(s, 2, 4, 5);
  assert.equal(s.combo, 0);
  assert.ok(r3.events.some((e) => e.type === 'comboEnd'));
});

test('grille nette : bonus', () => {
  const s = setup(rows('1111111.'), [{ k: 'mono:0', col: 2 }, { k: 'mono:0', col: 2 }, null]);
  const r = place(s, 0, 7, 0);
  assert.ok(r.events.some((e) => e.type === 'boardClear'));
  assert.equal(s.stats.boardClears, 1);
  assert.equal(s.score, 1 + SCORE.line + SCORE.boardClear);
});

test('pose refusée hors grille ou sur une case occupée', () => {
  const s = setup(rows('1.......'), [{ k: 'duo:0', col: 2 }, null, null]);
  assert.equal(place(s, 0, 0, 0).reason, 'blocked');
  assert.equal(place(s, 0, 7, 3).reason, 'blocked');
  assert.equal(place(s, 1, 0, 3).reason, 'empty');
  assert.ok(place(s, 0, 6, 3).ok);
});

test('lot vidé : nouveau lot distribué', () => {
  const s = setup(rows(), [{ k: 'mono:0', col: 2 }, null, null]);
  const r = place(s, 0, 0, 0);
  assert.ok(r.events.some((e) => e.type === 'refill'));
  assert.equal(s.tray.filter(Boolean).length, 3);
});

test('jauge : une ligne remplit la jauge et donne un pouvoir', () => {
  const s = setup(rows('1111111.'), [{ k: 'mono:0', col: 2 }, { k: 'mono:0', col: 2 }, null], { gauge: 95 });
  const before = s.powers.rotate + s.powers.bomb + s.powers.reroll;
  const r = place(s, 0, 7, 0);
  assert.ok(r.events.some((e) => e.type === 'power'));
  assert.equal(s.powers.rotate + s.powers.bomb + s.powers.reroll, before + 1);
  assert.equal(s.earned, 1);
});

test('pouvoirs : rotation, bombe, relance', () => {
  const s = setup(rows('11111111'.slice(0, 7) + '.', '2222....'), [{ k: 'line3:0', col: 3 }, { k: 'mono:0', col: 1 }, { k: 'square2:0', col: 4 }]);
  const k0 = s.tray[0].k;
  assert.ok(usePower(s, 'rotate', { ti: 0 }).ok);
  assert.equal(s.tray[0].k, rotateKey(k0));
  assert.equal(s.powers.rotate, 0);
  assert.equal(usePower(s, 'rotate', { ti: 1 }).reason, 'none');
  s.powers.rotate = 1;
  assert.equal(usePower(s, 'rotate', { ti: 1 }).reason, 'symmetric');
  const r = usePower(s, 'bomb', { x: 1, y: 1 });
  assert.ok(r.ok);
  assert.equal(r.events[0].cleared.length, 6);
  assert.equal(s.board.c[B.idx(3, 1)], 2, 'hors de la zone, rien ne bouge');
  assert.equal(usePower(s, 'bomb', { x: 6, y: 6 }).reason, 'none');
  s.powers.bomb = 1;
  assert.equal(usePower(s, 'bomb', { x: 6, y: 6 }).reason, 'nothing');
  assert.equal(bombArea(0, 0).length, 4);
  const trayBefore = JSON.stringify(s.tray);
  assert.ok(usePower(s, 'reroll').ok);
  assert.notEqual(JSON.stringify(s.tray), trayBefore);
  assert.equal(s.stats.powersUsed, 3);
});

test('rotation : la gemme suit la pièce', () => {
  const s = setup(rows(), [{ k: 'L4:0', col: 3, gem: 3 }, null, null]);
  const cell = SHAPES['L4:0'].cells[3];
  usePower(s, 'rotate', { ti: 0 });
  const p = s.tray[0];
  assert.ok(p.gem >= 0);
  // Après 4 rotations, la gemme revient sur la même case.
  s.powers.rotate = 3;
  for (let i = 0; i < 3; i++) usePower(s, 'rotate', { ti: 0 });
  assert.deepEqual(SHAPES[s.tray[0].k].cells[s.tray[0].gem], cell);
});

const FULLISH = ['1.1.1.1.', '.1.1.1.1', '1.1.1.1.', '.1.1.1.1', '1.1.1.1.', '.1.1.1.1', '1.1.1.1.', '.1.1.1.1'];

test('impasse : sauvetage possible avec un pouvoir, sinon fin de partie', () => {
  const s = setup(FULLISH, [{ k: 'mono:0', col: 2 }, { k: 'square2:0', col: 2 }, { k: 'line3:0', col: 2 }]);
  const r = place(s, 0, 1, 0);
  assert.equal(s.status, 'stuck');
  assert.ok(r.events.some((e) => e.type === 'stuck'));
  assert.equal(place(s, 1, 0, 0).reason, 'status');
  const u = usePower(s, 'bomb', { x: 3, y: 3 });
  assert.ok(u.ok);
  assert.equal(s.status, 'play');
  assert.ok(u.events.some((e) => e.type === 'rescued'));
  const s2 = setup(FULLISH, [{ k: 'mono:0', col: 2 }, { k: 'square2:0', col: 2 }, null], { powers: { rotate: 0, bomb: 0, reroll: 0 } });
  const r2 = place(s2, 0, 1, 0);
  assert.equal(s2.status, 'over');
  assert.equal(s2.end, 'noSpace');
  assert.ok(r2.events.some((e) => e.type === 'end'));
});

test('abandon depuis une impasse', () => {
  const s = setup(FULLISH, [{ k: 'square2:0', col: 2 }, null, null], { status: 'stuck' });
  assert.ok(giveUp(s).ok);
  assert.equal(s.status, 'over');
});

test('pièces grisées : trayFits', () => {
  const s = setup(FULLISH, [{ k: 'mono:0', col: 2 }, { k: 'square2:0', col: 2 }, null]);
  assert.deepEqual(trayFits(s), [true, false, false]);
});

test('record : événement unique quand on dépasse son meilleur score', () => {
  const s = setup(rows('1111111.'), [{ k: 'mono:0', col: 2 }, { k: 'mono:0', col: 2 }, null], { best: 50 });
  const r = place(s, 0, 7, 0);
  assert.ok(r.events.some((e) => e.type === 'record'));
  const r2 = place(s, 1, 0, 3);
  assert.ok(!r2.events.some((e) => e.type === 'record'));
});

test('sauvegarde : un état JSON rechargé rejoue à l\'identique', () => {
  const a = newGame({ mode: 'classic', seed: 99 });
  const b = JSON.parse(JSON.stringify(a));
  for (let i = 0; i < 30; i++) {
    const ti = a.tray.findIndex(Boolean);
    const pos = B.positions(a.board.c, SHAPES[a.tray[ti].k])[0];
    if (!pos) break;
    const ra = place(a, ti, pos[0], pos[1]);
    const rb = place(b, ti, pos[0], pos[1]);
    assert.equal(ra.ok, rb.ok);
    if (a.status !== 'play') break;
  }
  assert.deepEqual(a, b);
});

test('initiation : la première pièce réussit une ligne prisme', () => {
  const s = newGame({ mode: 'classic', tutorial: true, seed: 3 });
  const { ti, x, y } = TUTORIAL.target;
  const r = place(s, ti, x, y);
  const clear = r.events.find((e) => e.type === 'clear');
  assert.ok(clear && clear.pures === 1);
});

test('générateur : déterministe et lots jouables en début de partie', () => {
  const a = dealSet(B.createBoard().c, createRng(5), { difficulty: 0 });
  const b = dealSet(B.createBoard().c, createRng(5), { difficulty: 0 });
  assert.deepEqual(a, b);
  const rng = createRng(11);
  for (let t = 0; t < 60; t++) {
    const brd = B.createBoard();
    for (let i = 0; i < 64; i++) if ((i * 7 + t * 13) % 5 < 2) brd.c[i] = 1;
    for (const l of [B.fullLines(brd.c)]) B.clearLines(brd, l.rows, l.cols);
    const set = dealSet(brd.c, rng, { difficulty: 0 });
    assert.equal(set.length, 3);
    assert.ok(solvable(brd.c, set.map((p) => SHAPES[p.k]), 20000), `lot ${t} jouable`);
    for (const p of set) assert.ok(p.col >= 1 && p.col <= B.COLORS);
  }
});

test('générateur : couleurs recherchées', () => {
  const b = B.boardFromRows(rows('333.....', '1.......', '1.......', '1#......'));
  const w = wantedColors(b.c);
  assert.ok(w.includes(3));
  assert.ok(!w.includes(1), 'la colonne contient une pierre');
});

test('aventure : objectifs, coups limités et étoiles', () => {
  const level = { n: 99, rows: rows('a111111.', '########'.slice(0, 7) + '.'), goals: [{ type: 'gems', target: 1 }, { type: 'stones' }], moves: 10, diff: 0 };
  const s = newGame({ mode: 'adventure', level, seed: 4 });
  assert.equal(s.goals[1].target, 7);
  s.tray = [{ k: 'line3:1', col: 2, gem: -1 }, { k: 'mono:0', col: 2, gem: -1 }, null];
  place(s, 1, 7, 0);
  assert.equal(s.stats.gems, 1);
  assert.equal(s.status, 'play');
  s.tray = [{ k: 'mono:0', col: 2, gem: -1 }, null, null];
  const r = place(s, 0, 7, 1);
  assert.equal(s.status, 'won');
  assert.ok(r.events.some((e) => e.type === 'end' && e.status === 'won'));
  assert.equal(starsFor(s), 3);
  const lost = newGame({ mode: 'adventure', level: { ...level, moves: 1 }, seed: 4 });
  lost.tray = [{ k: 'mono:0', col: 2, gem: -1 }, null, null];
  place(lost, 0, 4, 4);
  assert.equal(lost.status, 'lost');
  assert.equal(lost.end, 'moves');
});

test('aventure : moins de 3 coups restants → lot réduit', () => {
  const level = { n: 98, rows: rows(), goals: [{ type: 'lines', target: 50 }], moves: 4, diff: 0 };
  const s = newGame({ mode: 'adventure', level, seed: 8 });
  for (let i = 0; i < 3; i++) {
    const ti = s.tray.findIndex(Boolean);
    const [x, y] = B.positions(s.board.c, SHAPES[s.tray[ti].k])[0];
    place(s, ti, x, y);
  }
  assert.equal(s.tray.filter(Boolean).length, 1);
});
