// Test de bout en bout (Playwright) : chargement, nouvelle partie, construction, meubles,
// panneaux, inspecteur, sauvegarde/rechargement, affichage mobile. Lance son propre serveur.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const port = 8765;
const shots = path.join(root, 'tests/e2e/screenshots');
fs.mkdirSync(shots, { recursive: true });

const server = spawn(process.execPath, [path.join(root, 'tools/serve.mjs'), String(port)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));
let failures = 0;
const check = (cond, msg) => { console.log(`${cond ? '✔' : '✘'} ${msg}`); if (!cond) failures++; };

try {
  const browser = await chromium.launch();
  // ---------------- Ordinateur
  const page = await browser.newPage({ viewport: { width: 1366, height: 820 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://localhost:${port}/index.html`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('text=Nouvelle partie');
  await page.click('text=Nouvelle partie');
  await page.fill('.modal input[type=text]', 'Auberge du Test');
  await page.click("text=Ouvrir l'auberge");
  await page.waitForTimeout(500);
  check(await page.isVisible('#hud'), 'le HUD est affiché');
  check((await page.textContent('#hud-name')) === 'Auberge du Test', 'le nom de l\'auberge est repris');
  await page.click('text=Compris', { timeout: 2000 }).catch(() => {});
  const T = (x, y) => page.evaluate(([x, y]) => window.__game.renderer.worldToScreen(x + 0.5, y + 0.5), [x, y]);
  const money0 = await page.evaluate(() => window.__game.state.money);
  // Construire une chambre par glisser-déposer
  await page.click('#toolbar button[data-panel=build]');
  await page.click('.item[title^="Accueille"]');
  const a = await T(20, 22), b = await T(22, 23);
  await page.mouse.move(a[0], a[1]); await page.mouse.down(); await page.mouse.move(b[0], b[1], { steps: 6 }); await page.mouse.up();
  const rooms = await page.evaluate(() => Object.values(window.__game.state.world.rooms).filter((r) => r.type === 'bedroom').length);
  check(rooms === 4, 'une chambre a été construite à la souris');
  // Meubler
  await page.click('#panel-tabs >> text=Mobilier');
  await page.click('.item[title^="Lit double"]');
  const c = await T(21, 22);
  await page.mouse.move(c[0], c[1]); await page.mouse.click(c[0], c[1]);
  await page.keyboard.press('Escape');
  const bedrooms = await page.evaluate(() => window.__game.state.rt.agg.bedrooms);
  check(bedrooms === 4, 'la chambre meublée compte dans la capacité');
  const money1 = await page.evaluate(() => window.__game.state.money);
  check(money1 < money0, `la construction est payée (${money0} → ${money1})`);
  // Tous les panneaux s'ouvrent et affichent du contenu
  for (const p of ['guests', 'staff', 'manage', 'finance', 'goals', 'progress', 'build']) {
    await page.click(`#toolbar button[data-panel=${p}]`);
    const n = await page.evaluate(() => document.querySelector('#panel-body').children.length);
    check(n > 0, `panneau « ${p} » rempli`);
    const count = await page.locator('#panel-tabs .tab').count();
    for (let i = 0; i < count; i++) await page.locator('#panel-tabs .tab').nth(i).click();
  }
  await page.click('#panel-close');
  // Faire passer le temps
  await page.evaluate(() => { window.__game.setSpeed(3); });
  await page.waitForTimeout(7000);
  const st = await page.evaluate(() => ({ served: window.__game.state.stats.served, time: window.__game.state.time }));
  check(st.served >= 1, `des clients ont été accueillis (${st.served})`);
  await page.screenshot({ path: path.join(shots, 'desktop.png') });
  // Inspecteur sur un client visible
  await page.evaluate(() => window.__game.setSpeed(0));
  const gp = await page.evaluate(() => { const G = window.__game; const g = G.state.guests.find((x) => !x.hidden); if (!g) return null; G.renderer.centerOn(g.x, g.y); return G.renderer.worldToScreen(g.x, g.y, 0.55); });
  if (gp) { await page.mouse.click(gp[0], gp[1]); await page.waitForTimeout(300); check(await page.isVisible('#inspector'), 'l\'inspecteur s\'ouvre sur un client'); }
  // Sauvegarde puis rechargement
  await page.evaluate(() => window.__game.save());
  const savedTime = await page.evaluate(() => window.__game.state.time);
  await page.reload();
  await page.waitForSelector('text=Continuer la partie');
  await page.click('text=Continuer la partie');
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => ({ time: window.__game.state.time, bedrooms: window.__game.state.rt.agg.bedrooms, name: window.__game.state.innName }));
  check(after.bedrooms === 4 && after.name === 'Auberge du Test' && after.time >= savedTime, 'la partie est restaurée après rechargement');
  check(errors.length === 0, `aucune erreur JavaScript (${errors.slice(0, 3).join(' | ')})`);
  await page.close();

  // ---------------- Téléphone
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const perr = [];
  phone.on('pageerror', (e) => perr.push(String(e)));
  await phone.goto(`http://localhost:${port}/index.html`);
  await phone.waitForSelector('text=Nouvelle partie');
  await phone.tap('text=Nouvelle partie');
  await phone.tap("text=Ouvrir l'auberge");
  await phone.waitForTimeout(500);
  const tb = await phone.evaluate(() => { const r = document.querySelector('#toolbar').getBoundingClientRect(); return { w: r.width, bottom: r.bottom }; });
  check(tb.w <= 390 && tb.bottom <= 844, 'la barre d\'outils tient dans l\'écran du téléphone');
  await phone.tap('#toolbar button[data-panel=build]');
  await phone.tap('.item[title^="Accueille"]');
  check(await phone.isVisible('#buildbar'), 'la barre de construction apparaît sur mobile');
  check(!(await phone.isVisible('#panel')), 'le catalogue se replie pour laisser tracer la pièce');
  await phone.screenshot({ path: path.join(shots, 'mobile.png') });
  check(perr.length === 0, `aucune erreur JavaScript sur mobile (${perr.slice(0, 3).join(' | ')})`);
  await browser.close();
} catch (e) {
  console.error(e);
  failures++;
} finally {
  server.kill();
}
console.log(failures ? `\n${failures} échec(s)` : '\nTous les contrôles de bout en bout sont passés.');
process.exit(failures ? 1 : 0);
