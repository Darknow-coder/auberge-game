import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DICTS, t, setLang } from '../../src/core/i18n.js';
import { defaultProfile, loadProfile, saveProfile, saveGame, loadGame, clearGame, levelInfo, xpNeed, recordGame, currentStreak, levelUnlocked, nextLevel, store } from '../../src/meta/profile.js';
import { ACHIEVEMENTS, unlockAchievements } from '../../src/meta/achievements.js';
import { THEMES, themeById } from '../../src/meta/themes.js';
import { newGame } from '../../src/game/engine.js';
import { autoplay } from '../../src/game/bot.js';
import { LEVELS, WORLDS } from '../../src/game/levels.js';
import { ICON_NAMES } from '../../src/ui/icons.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sources = () => {
  const out = [];
  const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (p.endsWith('.js')) out.push(fs.readFileSync(p, 'utf8')); } };
  walk(path.join(root, 'src'));
  return out.join('\n');
};

test('traductions : mêmes clés en français et en anglais', () => {
  const fr = Object.keys(DICTS.fr).sort(), en = Object.keys(DICTS.en).sort();
  assert.deepEqual(fr, en);
  for (const k of fr) assert.ok(DICTS.fr[k] && DICTS.en[k], `texte vide : ${k}`);
});

test('traductions : toutes les clés utilisées existent', () => {
  const src = sources();
  const used = new Set([...src.matchAll(/\bt\('([a-zA-Z0-9_.]+)'/g)].map((m) => m[1]));
  for (const k of used) assert.ok(k in DICTS.fr, `clé manquante : ${k}`);
  // Clés construites dynamiquement.
  for (const a of ACHIEVEMENTS) { assert.ok(`ach.${a.id}` in DICTS.fr); assert.ok(`ach.${a.id}.d` in DICTS.fr); }
  for (const th of THEMES) assert.ok(`theme.${th.id}` in DICTS.fr);
  for (const w of WORLDS) { assert.ok(`world.${w.id}` in DICTS.fr); assert.ok(`world.${w.id}.sub` in DICTS.fr); }
  for (const k of ['rotate', 'bomb', 'reroll']) assert.ok(`game.power.${k}` in DICTS.fr);
  for (const g of ['score', 'areas', 'light', 'whites', 'big', 'gems', 'stones']) assert.ok(`goal.${g}` in DICTS.fr);
});

test('icônes : toutes celles utilisées existent', () => {
  const src = sources();
  const used = new Set([...src.matchAll(/\bicon\('([a-zA-Z]+)'/g)].map((m) => m[1]));
  for (const a of ACHIEVEMENTS) used.add(a.icon);
  for (const w of WORLDS) used.add(w.icon);
  for (const k of used) assert.ok(ICON_NAMES.includes(k), `icône manquante : ${k}`);
});

test('traductions : variables et typographie française', () => {
  setLang('fr');
  assert.equal(t('game.combo', { n: 4 }), 'Combo 4');
  assert.equal(t('game.record'), 'Nouveau record !');
  setLang('en');
  assert.equal(t('game.record'), 'New best!');
  setLang('fr');
});

test('profil : valeurs par défaut, sauvegarde et fusion', () => {
  const p = loadProfile();
  assert.deepEqual(p, defaultProfile());
  p.xp = 500;
  p.ach.first_area = 1;
  p.adv[3] = 2;
  saveProfile(p);
  const q = loadProfile();
  assert.equal(q.xp, 500);
  assert.equal(q.adv[3], 2);
  assert.ok(q.ach.first_area);
  // Une ancienne sauvegarde incomplète reçoit les champs manquants.
  store.set('prisme.profile.v1', JSON.stringify({ xp: 42, settings: { sfx: false } }));
  const r = loadProfile();
  assert.equal(r.xp, 42);
  assert.equal(r.settings.sfx, false);
  assert.equal(r.settings.music, true);
  assert.deepEqual(r.daily.days, {});
  store.set('prisme.profile.v1', '{corrompu');
  assert.deepEqual(loadProfile(), defaultProfile());
});

test('parties en cours : sauvegarde par mode', () => {
  const s = newGame({ mode: 'classic', seed: 1 });
  saveGame('classic', s);
  assert.deepEqual(loadGame('classic'), JSON.parse(JSON.stringify(s)));
  s.status = 'over';
  saveGame('classic', s);
  assert.equal(loadGame('classic'), null, 'une partie terminée ne se reprend pas');
  clearGame('classic');
  assert.equal(loadGame('classic'), null);
});

test('niveaux d\'expérience', () => {
  assert.deepEqual(levelInfo(0), { level: 1, cur: 0, need: xpNeed(1), pct: 0 });
  assert.equal(levelInfo(xpNeed(1)).level, 2);
  assert.equal(levelInfo(xpNeed(1) + xpNeed(2) - 1).level, 2);
  // Tous les thèmes sont atteignables et le premier est gratuit.
  assert.equal(THEMES[0].level, 1);
  assert.equal(themeById('inconnu').id, THEMES[0].id);
  for (const th of THEMES) for (const m of [1, 2, 3, 4, 5, 6, 7]) assert.match(th.lights[m], /^#[0-9a-f]{6}$/i);
});

test('fin de partie classique : record, stats, XP, trophées', () => {
  const p = defaultProfile();
  const s = autoplay(newGame({ mode: 'classic', seed: 12 }), { maxMoves: 4000 });
  const r = recordGame(p, s, { time: 60000 });
  assert.ok(r.newBest);
  assert.equal(p.best.classic, s.score);
  assert.equal(p.stats.games, 1);
  assert.equal(p.stats.areas, s.stats.areas);
  assert.equal(p.stats.light, s.stats.light);
  assert.ok(r.xp > 10);
  assert.ok(p.ach.first_area);
  assert.ok(r.trophies.some((a) => a.id === 'first_area'));
  assert.ok(r.levelAfter >= r.levelBefore);
  // Deuxième partie moins bonne : pas de record.
  const s2 = newGame({ mode: 'classic', seed: 13 });
  s2.status = 'over';
  const r2 = recordGame(p, s2, {});
  assert.ok(!r2.newBest);
});

test('aventure : étoiles conservées et niveaux débloqués', () => {
  const p = defaultProfile();
  assert.ok(levelUnlocked(p, 1));
  assert.ok(!levelUnlocked(p, 2));
  const s = newGame({ mode: 'adventure', level: LEVELS[0], seed: 3 });
  autoplay(s);
  assert.equal(s.status, 'won');
  const r = recordGame(p, s, {});
  assert.ok(r.firstWin);
  assert.ok(p.adv[1] >= 1);
  assert.ok(levelUnlocked(p, 2));
  assert.equal(nextLevel(p, LEVELS.length), 2);
  p.adv[1] = 3;
  const again = newGame({ mode: 'adventure', level: LEVELS[0], seed: 3 });
  autoplay(again);
  recordGame(p, again, {});
  assert.equal(p.adv[1], 3, 'on garde le meilleur nombre d\'étoiles');
});

test('défi du jour : série de jours consécutifs', () => {
  const p = defaultProfile();
  const play = (date, score, medal) => {
    const s = newGame({ mode: 'classic', seed: 1 });
    s.mode = 'daily';
    s.date = date;
    s.score = score;
    s.status = 'over';
    return recordGame(p, s, { medal });
  };
  assert.ok(play('2026-03-01', 1000, 'bronze').firstDaily);
  play('2026-03-02', 2000, 'gold');
  assert.equal(p.daily.streak, 2);
  assert.ok(!play('2026-03-02', 500, null).firstDaily, 'rejouer le même jour ne compte pas deux fois');
  assert.equal(p.daily.days['2026-03-02'].medal, 'gold');
  assert.equal(currentStreak(p, '2026-03-03'), 2, 'la série tient jusqu\'au lendemain');
  assert.equal(currentStreak(p, '2026-03-04'), 0, 'puis elle se perd');
  play('2026-03-05', 100, null);
  assert.equal(p.daily.streak, 1);
  assert.equal(p.daily.bestStreak, 2);
  assert.ok(p.ach.daily1 && p.ach.dailyGold);
});

test('trophées : identifiants uniques, déblocage unique', () => {
  const ids = ACHIEVEMENTS.map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length);
  const p = defaultProfile();
  p.stats.light = 600;
  const got = unlockAchievements(p, null, null);
  assert.ok(got.some((a) => a.id === 'light500'));
  assert.equal(unlockAchievements(p, null, null).length, 0);
});
