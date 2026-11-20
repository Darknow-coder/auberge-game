import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MISSION_TYPES, missionsFor, ensureMissions, applyMissions, ALL_DONE_XP } from '../../src/meta/missions.js';
import { defaultProfile, recordGame } from '../../src/meta/profile.js';
import { newGame } from '../../src/game/engine.js';
import { DICTS } from '../../src/core/i18n.js';

const fakeGame = (mode, stats = {}, extra = {}) => {
  const s = newGame({ mode: mode === 'adventure' ? 'classic' : mode, seed: 1 });
  s.mode = mode;
  Object.assign(s.stats, stats);
  s.status = 'over';
  return Object.assign(s, extra);
};

test('missions : trois par jour, déterministes, difficulté croissante', () => {
  const a = missionsFor('2026-11-20'), b = missionsFor('2026-11-20');
  assert.deepEqual(a, b);
  assert.equal(a.length, 3);
  assert.equal(new Set(a.map((m) => m.type)).size, 3);
  for (let d = 1; d <= 28; d++) {
    const list = missionsFor(`2026-02-${String(d).padStart(2, '0')}`);
    const scores = list.filter((m) => m.type === 'classic' || m.type === 'blitz').length;
    assert.ok(scores <= 1, 'pas deux missions de score le même jour');
  }
  for (const m of MISSION_TYPES) {
    assert.ok(`mission.${m.id}` in DICTS.fr && `mission.${m.id}` in DICTS.en, `texte de la mission ${m.id}`);
    assert.ok(m.targets[0] <= m.targets[1] && m.targets[1] <= m.targets[2]);
  }
});

test('missions : cumul sur la journée, meilleure partie, bonus des trois', () => {
  const p = defaultProfile();
  const key = '2026-11-20';
  const ms = ensureMissions(p, key);
  ms.list = [
    { type: 'areas', target: 10, xp: 40, progress: 0, done: false },
    { type: 'big', target: 6, xp: 50, progress: 0, done: false },
    { type: 'games', target: 2, xp: 30, progress: 0, done: false },
  ];
  const xp0 = p.xp;
  let r = applyMissions(p, fakeGame('classic', { areas: 6, maxArea: 4 }), key);
  assert.equal(r.done.length, 0);
  assert.equal(ms.list[0].progress, 6);
  assert.equal(ms.list[1].progress, 4, 'meilleure partie, pas un cumul');
  r = applyMissions(p, fakeGame('zen', { areas: 5, maxArea: 7 }), key);
  assert.deepEqual(r.done.map((m) => m.type), ['areas', 'big', 'games']);
  assert.equal(r.bonus, ALL_DONE_XP);
  assert.equal(p.xp, xp0 + 40 + 50 + 30 + ALL_DONE_XP);
  assert.equal(p.stats.missionDays, 1);
  // Un nouveau jour : nouvelles missions.
  const next = ensureMissions(p, '2026-11-21');
  assert.equal(next.date, '2026-11-21');
  assert.ok(next.list.every((m) => !m.done));
});

test('fin de partie : records par mode et missions dans le bilan', () => {
  const p = defaultProfile();
  const s = fakeGame('blitz', { areas: 40, light: 120, maxArea: 13, maxCombo: 9 }, { score: 6000 });
  const r = recordGame(p, s, { today: '2026-11-20' });
  assert.ok(r.newBest);
  assert.equal(p.best.blitz, 6000);
  assert.equal(p.best.classic, 0);
  assert.equal(p.stats.blitzGames, 1);
  assert.ok(r.missions && Array.isArray(r.missions.done));
  assert.ok(r.xp > 10);
});
