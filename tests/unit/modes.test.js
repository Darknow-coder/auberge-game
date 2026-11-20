import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../../src/game/board.js';
import { SHAPES } from '../../src/game/pieces.js';
import { newGame, place, tick, finish, skipTutorial, timeBonus, goalState, BLITZ, trayFits } from '../../src/game/engine.js';
import { autoplay } from '../../src/game/bot.js';

const EMPTY = '........';
const rows = (...r) => r.concat(Array(B.ROWS - r.length).fill(EMPTY));
const FULLISH = Array.from({ length: 9 }, (_, y) => (y % 2 ? 'rrrrrrrr' : '.rrrrrrr'));

test('Blitz : le temps s\'écoule, les enclos en rajoutent, la partie finit au chrono', () => {
  const s = newGame({ mode: 'blitz', seed: 2 });
  assert.equal(s.time, BLITZ.start);
  assert.equal(s.usePowers, false);
  assert.deepEqual(tick(s, 10), []);
  assert.equal(s.time, BLITZ.start - 10);
  s.board = B.boardFromRows(rows(EMPTY, '...r....', '..r.r...'));
  s.tray = [{ k: 'mono:0', col: B.G }, null, null];
  const r = place(s, 0, 3, 3);
  const bonus = r.events.find((e) => e.type === 'timeBonus');
  assert.equal(bonus.seconds, timeBonus(1, false, false));
  assert.equal(s.time, BLITZ.start - 10 + bonus.seconds);
  const end = tick(s, 999);
  assert.equal(end[0].type, 'end');
  assert.equal(s.status, 'over');
  assert.equal(s.end, 'time');
  assert.deepEqual(tick(s, 1), [], 'plus rien après la fin');
  assert.ok(timeBonus(9, true, true) > timeBonus(1, false, false));
});

test('Blitz et Zen : jamais bloqué, la grille se dégage', () => {
  for (const mode of ['blitz', 'zen']) {
    const s = newGame({ mode, seed: 5 });
    s.board = B.boardFromRows(FULLISH);
    s.tray = [{ k: 'mono:0', col: B.R }, { k: 'square3:0', col: B.R }, null];
    const r = place(s, 0, 0, 0);
    assert.ok(r.events.some((e) => e.type === 'relief'), `${mode} : soulagement`);
    assert.equal(s.status, 'play');
    assert.ok(trayFits(s).some(Boolean));
  }
  const zen = autoplay(newGame({ mode: 'zen', seed: 9 }), { maxMoves: 400 });
  assert.equal(zen.status, 'play', 'une longue partie Zen ne s\'arrête pas');
  assert.ok(finish(zen).ok);
  assert.equal(zen.status, 'over');
  assert.equal(zen.end, 'quit');
});

test('initiation : on peut la passer', () => {
  const s = newGame({ mode: 'classic', tutorial: true, seed: 1 });
  const r = skipTutorial(s);
  assert.ok(r.ok && r.events.some((e) => e.type === 'tutorialDone'));
  assert.equal(s.tutorial, null);
  assert.ok(B.isEmpty(s.board.c));
  assert.equal(skipTutorial(s).reason, 'none');
});

test('brume : se propage vers l\'intérieur et se dissipe quand on l\'encercle', () => {
  const level = { n: 99, rows: rows(EMPTY, EMPTY, '...~....'), goals: [{ type: 'fog' }], moves: 30, diff: 0, fogEvery: 2 };
  const s = newGame({ mode: 'adventure', level, seed: 4 });
  assert.equal(s.goals[0].target, 1);
  assert.equal(goalState(s, s.goals[0]).value, 1);
  s.tray = [{ k: 'mono:0', col: B.R }, { k: 'mono:0', col: B.R }, null];
  place(s, 0, 0, 8);
  const r = place(s, 1, 7, 8);
  const spread = r.events.find((e) => e.type === 'fogSpread');
  assert.ok(spread, 'la brume gagne une case toutes les 2 pièces');
  assert.ok(!B.isEdge(spread.i));
  assert.equal(B.countObjects(s.board.o, B.FOG), 2);
  assert.ok(!B.canPlace(s.board, SHAPES['mono:0'], 3, 3 - 1) || s.board.o[B.idx(3, 2)] !== B.FOG);
  // Encercler toute la brume la dissipe et gagne le niveau.
  s.board.c.fill(0);
  s.board.o.fill(0);
  s.board.o[B.idx(3, 3)] = B.FOG;
  s.board = { c: B.boardFromRows(rows(EMPTY, EMPTY, '...r....', '..r.r...')).c, o: s.board.o };
  s.tray = [{ k: 'mono:0', col: B.R }, null, null];
  s.fogEvery = 0;
  const r2 = place(s, 0, 3, 4);
  assert.equal(s.stats.fog, 1);
  assert.ok(goalState(s, s.goals[0]).done);
  assert.equal(s.status, 'won');
  assert.ok(r2.events.some((e) => e.type === 'end' && e.status === 'won'));
});

test('cristaux : récoltés seulement dans un enclos assez grand', () => {
  // Cristal « 2 » seul dans un enclos d'une case : il reste.
  const small = B.boardFromRows(rows(EMPTY, '...r....', '..r2r...', '...r....'));
  const res = B.resolve(small);
  assert.equal(res.regions[0].crystals, 0);
  assert.ok(B.isCrystal(small.o[B.idx(3, 2)]), 'le cristal reste en place');
  // Cristal « 2 » dans un enclos de deux cases : récolté.
  const big = B.boardFromRows(rows(EMPTY, '...rr...', '..r2.r..', '...rr...'));
  const res2 = B.resolve(big);
  assert.equal(res2.regions[0].crystals, 1);
  assert.equal(big.o[B.idx(3, 2)], 0);
  const level = { n: 98, rows: rows(EMPTY, '...rr...', '..r3..r.', '...rrr..'), goals: [{ type: 'crystals', target: 1 }], moves: 5, diff: 0 };
  const s = newGame({ mode: 'adventure', level, seed: 1 });
  s.tray = [{ k: 'mono:0', col: B.G }, null, null];
  place(s, 0, 5, 1);
  assert.equal(s.stats.crystals, 1);
  assert.equal(s.status, 'won');
});
