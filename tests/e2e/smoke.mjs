// Test de bout en bout (Playwright) : initiation, glisser-déposer souris et tactile, clavier,
// pouvoirs, impasse, fin de partie, reprise après rechargement, Aventure, défi du jour,
// réglages, thèmes, mise en page mobile. Lance son propre serveur.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const port = 8765;
const shots = path.join(root, 'tests/e2e/screenshots');
fs.mkdirSync(shots, { recursive: true });

const server = spawn(process.execPath, [path.join(root, 'tools/serve.mjs'), String(port)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));
const URL = `http://localhost:${port}/index.html?nosw`;
let failures = 0;
const check = (cond, msg) => { console.log(`${cond ? '✔' : '✘'} ${msg}`); if (!cond) failures++; };

/** Joue avec l'IA jusqu'à la fin (ou n coups), en abandonnant en cas d'impasse. */
const botPlay = (page, n = 5000, giveUp = true) => page.evaluate(async ([n, giveUp]) => {
  const { bestMove } = await import('/src/game/bot.js');
  const g = window.__prisme.game;
  for (let i = 0; i < n; i++) {
    const s = g.s;
    if (s.status === 'stuck') { if (giveUp) g.onGiveUp(); break; }
    if (s.status !== 'play') break;
    const m = bestMove(s);
    if (!m) break;
    g.doPlace(m.ti, m.x, m.y);
  }
}, [n, giveUp]);

const state = (page) => page.evaluate(() => { const s = window.__prisme.game.s; return s && { score: s.score, moves: s.moves, status: s.status, mode: s.mode, level: s.level }; });

async function fresh(page, profile = null) {
  await page.goto(URL);
  await page.evaluate((p) => { localStorage.clear(); if (p) localStorage.setItem('prisme.profile.v1', JSON.stringify(p)); }, profile);
  await page.reload();
  await page.waitForSelector('#btn-play');
}

try {
  const browser = await chromium.launch();
  const errors = [];
  const watch = (page, label) => {
    page.on('pageerror', (e) => errors.push(`${label}: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`${label}: ${m.text()}`); });
  };

  // ------------------------------------------------------------ Ordinateur
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'fr-FR' });
  const page = await ctx.newPage();
  watch(page, 'ordinateur');
  await fresh(page);
  check((await page.textContent('#btn-play')).includes('Jouer'), 'accueil en français');
  await page.screenshot({ path: path.join(shots, 'accueil.png') });

  // Initiation : la première pièce ferme un enclos de lumière blanche.
  await page.click('#btn-play');
  await page.waitForTimeout(400);
  check(await page.evaluate(() => !!window.__prisme.view.hand), 'la main de l\'initiation est affichée');
  const tuto = await page.evaluate(() => {
    const v = window.__prisme.view, tp = v.trayPiece(0), [x, y] = v.cellXY(3, 5);
    return { from: [tp.x + tp.cell, tp.y + tp.cell / 2], to: [x + v.board.cell, y + v.board.cell / 2] };
  });
  await page.mouse.move(...tuto.from);
  await page.mouse.down();
  await page.mouse.move(tuto.to[0], tuto.to[1], { steps: 10 });
  const ghost = await page.evaluate(() => window.__prisme.view.drag && window.__prisme.view.drag.ghost);
  check(ghost && ghost.x === 3 && ghost.y === 5 && ghost.regions.length === 1 && ghost.points > 0, 'l\'aperçu montre la zone qui va s\'illuminer et les points');
  await page.mouse.up();
  let st = await state(page);
  check(st.moves === 1 && st.score > 900, `pose à la souris + enclos de lumière blanche + grille nette (${st.score} pts)`);
  check(await page.evaluate(() => window.__prisme.profile.tutorialDone), 'initiation marquée comme faite');

  // Clavier : 1 choisit la pièce, les flèches la déplacent, Entrée la pose.
  const kbOk = await page.evaluate(() => { const s = window.__prisme.game.s; return s.tray[1] != null; });
  await page.keyboard.press(kbOk ? '2' : '3');
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  st = await state(page);
  check(st.moves === 2, 'pose au clavier');

  // Pause
  await page.keyboard.press('Escape');
  await page.waitForSelector('.modal.show .pause, .modal.show.pause, .modal-card.pause');
  check(await page.isVisible('text=Reprendre'), 'menu pause');
  await page.click('text=Reprendre');
  await page.waitForTimeout(250);

  // Reprise après rechargement
  await botPlay(page, 6);
  const before = await state(page);
  await page.reload();
  await page.waitForSelector('#btn-play');
  check((await page.textContent('#btn-play')).includes('Continuer'), 'l\'accueil propose de continuer');
  await page.click('#btn-play');
  await page.waitForTimeout(300);
  const after = await state(page);
  check(after.score === before.score && after.moves === before.moves, 'la partie reprend à l\'identique après rechargement');

  // Impasse et pouvoir « bombe » à la souris.
  await page.evaluate(() => {
    const g = window.__prisme.game, s = g.s;
    // Grille pleine sauf quelques cases isolées sur le bord : rien ne rentre, aucun enclos.
    for (let y = 0; y < 9; y++) for (let x = 0; x < 8; x++) { s.board.c[y * 8 + x] = x === 0 && y % 2 === 0 ? 0 : 1; s.board.o[y * 8 + x] = 0; }
    s.star = null;
    s.tray = [{ k: 'square2:0', col: 2, gem: -1 }, { k: 'square3:0', col: 3, gem: -1 }, { k: 'line5:0', col: 4, gem: -1 }];
    s.status = 'stuck';
    s.powers = { rotate: 0, bomb: 1, reroll: 0 };
    g.start(s);
  });
  await page.waitForTimeout(300);
  check(await page.isVisible('#stuck .btn'), 'le panneau « Plus de place » s\'affiche');
  await page.click('[data-power=bomb]');
  const cell = await page.evaluate(() => { const v = window.__prisme.view; const [x, y] = v.cellXY(3, 3); return [x + v.board.cell / 2, y + v.board.cell / 2]; });
  await page.mouse.move(...cell);
  await page.mouse.down();
  await page.mouse.up();
  st = await state(page);
  check(st.status === 'play', 'la bombe sauve la partie');
  await page.screenshot({ path: path.join(shots, 'bombe.png') });

  // Fin de partie → bilan
  await page.evaluate(() => { window.__prisme.game.s.powers = { rotate: 0, bomb: 0, reroll: 0 }; });
  await botPlay(page);
  await page.waitForSelector('text=Partie terminée', { timeout: 8000 });
  check(await page.isVisible('text=Rejouer'), 'bilan de fin de partie');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(shots, 'bilan.png') });
  check(await page.evaluate(() => window.__prisme.profile.stats.games === 1 && window.__prisme.profile.best.classic > 0), 'record et statistiques enregistrés');
  await page.click('text=Rejouer');
  await page.waitForTimeout(300);
  st = await state(page);
  check(st.moves === 0 && st.status === 'play', 'nouvelle partie lancée');

  // Aventure
  await page.evaluate(() => window.__prisme.show('home'));
  await page.click('#btn-adventure');
  await page.waitForSelector('[data-level="1"]');
  check(await page.isDisabled('[data-level="2"]'), 'niveau 2 verrouillé au départ');
  await page.click('[data-level="1"]');
  await page.waitForSelector('.intro');
  check((await page.textContent('.intro')).includes('Fermer 1 enclos'), 'objectifs du niveau affichés');
  await page.click('.intro .btn.primary');
  await page.waitForTimeout(300);
  st = await state(page);
  check(st.mode === 'adventure' && st.level === 1, 'niveau 1 lancé');
  await botPlay(page);
  await page.waitForSelector('text=Niveau 1 réussi', { timeout: 8000 });
  await page.waitForTimeout(1600);
  check(await page.evaluate(() => document.querySelectorAll('.stars.big .star.on').length >= 1), 'étoiles attribuées');
  await page.screenshot({ path: path.join(shots, 'niveau-reussi.png') });
  await page.click('text=Niveau suivant');
  await page.waitForSelector('.intro');
  await page.click('.intro .btn.primary');
  await page.waitForTimeout(200);
  check((await state(page)).level === 2, 'niveau suivant');

  // Défi du jour
  await page.evaluate(() => window.__prisme.show('daily'));
  await page.waitForSelector('#btn-daily-play');
  await page.screenshot({ path: path.join(shots, 'defi.png') });
  await page.click('#btn-daily-play');
  await page.waitForTimeout(300);
  st = await state(page);
  check(st.mode === 'daily', 'défi du jour lancé');
  check(!(await page.isVisible('#powers')), 'pas de pouvoirs pendant le défi');
  await botPlay(page);
  await page.waitForSelector('text=Défi terminé', { timeout: 8000 });
  check(await page.evaluate(() => Object.keys(window.__prisme.profile.daily.days).length === 1 && window.__prisme.profile.daily.streak === 1), 'défi enregistré, série de 1 jour');
  await page.click('text=Accueil');

  // Réglages : langue anglaise, puis retour au français.
  await page.evaluate(() => window.__prisme.show('settings'));
  await page.click('text=English');
  check(await page.isVisible('text=Settings'), 'interface en anglais');
  await page.click('text=Français');
  await page.click('[data-setting=symbols]');
  check(await page.evaluate(() => window.__prisme.profile.settings.symbols === true), 'option symboles activée');

  // Thèmes : un thème verrouillé ne se choisit pas, un thème débloqué oui.
  await page.evaluate(() => { window.__prisme.profile.xp = 2000; window.__prisme.show('themes'); });
  check(await page.isDisabled('[data-theme-id=or]'), 'thème « Or » verrouillé');
  await page.click('[data-theme-id=ocean]');
  check(await page.evaluate(() => window.__prisme.profile.theme === 'ocean'), 'thème Océan appliqué');
  await page.evaluate(() => window.__prisme.show('trophies'));
  check((await page.$$('.ach.on')).length > 3, 'trophées débloqués visibles');
  await ctx.close();

  // ------------------------------------------------------------ Téléphone (tactile)
  const mctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'fr-FR' });
  const mob = await mctx.newPage();
  watch(mob, 'téléphone');
  await fresh(mob, { tutorialDone: true });
  await mob.tap('#btn-play');
  await mob.waitForTimeout(400);
  const lay = await mob.evaluate(() => {
    const v = window.__prisme.view, b = v.board;
    const powers = document.querySelector('#powers').getBoundingClientRect();
    return { inside: b.x >= 0 && b.x + b.w <= innerWidth && b.y >= 0 && b.y + b.h <= innerHeight, powersInside: powers.bottom <= innerHeight, size: b.w, scroll: document.documentElement.scrollWidth <= innerWidth };
  });
  check(lay.inside && lay.powersInside && lay.scroll, `mise en page mobile (grille de ${Math.round(lay.size)} px, rien ne déborde)`);
  const cdp = await mctx.newCDPSession(mob);
  const d = await mob.evaluate(async () => {
    const { bestMove } = await import('/src/game/bot.js');
    const g = window.__prisme.game, v = g.view, m = bestMove(g.s), tp = v.trayPiece(m.ti), sh = tp.sh, [x, y] = v.cellXY(m.x, m.y);
    return { from: [tp.x + tp.cell / 2, tp.y + tp.cell / 2], to: [x + (sh.w * v.board.cell) / 2, y + sh.h * v.board.cell + v.board.cell * 1.1] };
  });
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  await touch('touchStart', ...d.from);
  for (let i = 1; i <= 10; i++) await touch('touchMove', d.from[0] + ((d.to[0] - d.from[0]) * i) / 10, d.from[1] + ((d.to[1] - d.from[1]) * i) / 10);
  await mob.screenshot({ path: path.join(shots, 'mobile-glisser.png') });
  await touch('touchEnd', 0, 0);
  check((await state(mob)).moves === 1, 'pose au doigt (la pièce flotte au-dessus du doigt)');
  await botPlay(mob, 12);
  await mob.waitForTimeout(800);
  await mob.screenshot({ path: path.join(shots, 'mobile-partie.png') });
  await mctx.close();

  // ------------------------------------------------------------ Téléphone à l'horizontale
  const lctx = await browser.newContext({ ...devices['iPhone 13 landscape'], locale: 'fr-FR' });
  const land = await lctx.newPage();
  watch(land, 'paysage');
  await fresh(land, { tutorialDone: true });
  await land.tap('#btn-play');
  await land.waitForTimeout(400);
  const ll = await land.evaluate(() => {
    const v = window.__prisme.view, b = v.board, last = v.slots[2];
    const p = document.querySelector('#powers').getBoundingClientRect();
    return document.querySelector('#screen-game').classList.contains('landscape') && b.y >= 0 && b.y + b.h <= innerHeight + 1 && last.y + last.h <= innerHeight + 1 && last.x + last.w <= innerWidth && p.bottom <= innerHeight;
  });
  check(ll, 'disposition paysage : grille, pièces et pouvoirs visibles');
  await land.screenshot({ path: path.join(shots, 'paysage.png') });
  await lctx.close();

  check(errors.length === 0, `aucune erreur JavaScript${errors.length ? ' :\n  ' + errors.join('\n  ') : ''}`);
  await browser.close();
} catch (e) {
  console.error(e);
  failures++;
} finally {
  server.kill();
}
console.log(failures ? `\n${failures} échec(s)` : '\nTous les tests de bout en bout passent.');
process.exit(failures ? 1 : 0);
