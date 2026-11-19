import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../../src/game/board.js';
import { LEVELS, WORLDS, getLevel, worldOf } from '../../src/game/levels.js';
import { dailySpec, dailyMedals, medalFor, dateKey, DAILY_PIECES } from '../../src/game/daily.js';
import { newGame, starsFor } from '../../src/game/engine.js';
import { autoplay, bestMove } from '../../src/game/bot.js';
import { SHAPES } from '../../src/game/pieces.js';

test('aventure : 60 niveaux bien formés', () => {
  assert.equal(LEVELS.length, 60);
  assert.equal(WORLDS.at(-1).to, 60);
  for (const L of LEVELS) {
    assert.equal(L.rows.length, 8);
    for (const r of L.rows) assert.match(r, /^[.1-5#a-e]{8}$/);
    const b = B.boardFromRows(L.rows);
    const full = B.fullLines(b.c);
    assert.equal(full.rows.length + full.cols.length, 0, `niveau ${L.n} : aucune ligne pleine au départ`);
    assert.ok(L.moves >= 8 && L.moves <= 40);
    for (const g of L.goals) {
      assert.ok(['score', 'lines', 'gems', 'stones', 'pure'].includes(g.type));
      if (g.type === 'stones') assert.ok(b.c.some((v) => v === B.STONE), `niveau ${L.n} : des pierres à briser`);
      if (g.type === 'gems') {
        const onBoard = b.g.filter(Boolean).length;
        assert.ok(onBoard > 0 && (onBoard >= g.target || L.gemRate > 0), `niveau ${L.n} : assez de gemmes`);
      }
    }
    assert.equal(worldOf(L.n).id, Math.ceil(L.n / 10));
  }
  assert.equal(getLevel(61), null);
});

test('aventure : chaque niveau est gagnable par le joueur automatique', () => {
  for (const L of LEVELS) {
    let wins = 0;
    for (let i = 0; i < 16 && wins === 0; i++) {
      const s = autoplay(newGame({ mode: 'adventure', level: L, seed: 500 + i * 31 }));
      if (s.status === 'won') { wins++; assert.ok(starsFor(s) >= 1); }
    }
    assert.ok(wins > 0, `niveau ${L.n} gagné au moins une fois`);
  }
});

test('défi du jour : déterministe, 30 pièces, terminable', () => {
  const a = dailySpec('2026-11-19');
  const b = dailySpec('2026-11-19');
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.seq, dailySpec('2026-11-20').seq);
  assert.equal(a.seq.length, DAILY_PIECES);
  for (const p of a.seq) assert.ok(SHAPES[p.k]);
  const m = dailyMedals(a);
  assert.equal(m.botMoves, DAILY_PIECES);
  assert.ok(m.bronze < m.silver && m.silver < m.gold);
  assert.equal(medalFor(m.gold, m), 'gold');
  assert.equal(medalFor(m.silver, m), 'silver');
  assert.equal(medalFor(0, m), null);
  const s = newGame({ mode: 'daily', daily: a, seed: a.seed });
  assert.equal(s.usePowers, false);
  autoplay(s);
  assert.equal(s.status, 'over');
  assert.equal(s.end, 'done');
});

test('défi du jour : clé de date locale', () => {
  assert.equal(dateKey(new Date(2026, 0, 5)), '2026-01-05');
});

test('mode classique : une partie automatique se termine', () => {
  const s = autoplay(newGame({ mode: 'classic', seed: 2024 }), { maxMoves: 4000 });
  assert.equal(s.status, 'over');
  assert.ok(s.moves > 50, `au moins 50 pièces posées (${s.moves})`);
  assert.ok(s.score > 1000);
});

test('indice : le meilleur coup est toujours valide', () => {
  const s = newGame({ mode: 'classic', seed: 7 });
  for (let i = 0; i < 20; i++) {
    const m = bestMove(s);
    assert.ok(m);
    assert.ok(B.canPlace(s.board.c, SHAPES[s.tray[m.ti].k], m.x, m.y));
    autoplay(s, { maxMoves: 1 });
  }
});
