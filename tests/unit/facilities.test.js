import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, run, actions } from './helpers.js';
import { suggestRotation } from '../../src/sim/world.js';
import { barStatus } from '../../src/sim/restaurant.js';
import { refreshCandidates } from '../../src/sim/staff.js';

function ok(r, label) { assert.ok(r.ok, `${label} : ${r.reason}`); return r; }

test('installations avancées : bar, jeux, boutique, guides et spa sont utilisés et rapportent', () => {
  const s = newGame(17);
  s.tier = 4;
  s.money = 100000;
  s.reputation.value = 70;
  refreshCandidates(s);
  ok(actions.buyParcel(s, 3), 'lisière de la forêt');
  // Chambres supplémentaires pour avoir du monde
  ok(actions.buildRoom(s, 'bedroom', 20, 22, 22, 23), 'chambre');
  ok(actions.placeFurniture(s, 'bed_double', 21, 22, 0), 'lit');
  // Bar
  ok(actions.buildRoom(s, 'bar', 23, 13, 26, 15), 'bar');
  ok(actions.placeFurniture(s, 'bar_counter', 23, 14, 0), 'comptoir');
  for (const x of [23, 24, 25]) ok(actions.placeFurniture(s, 'bar_stool', x, 15, suggestRotation(s, 'bar_stool', x, 15)), 'tabouret');
  // Salle de jeux
  ok(actions.buildRoom(s, 'games', 12, 16, 14, 18), 'salle de jeux');
  ok(actions.placeFurniture(s, 'billiard', 12, 17, 0), 'billard');
  ok(actions.placeFurniture(s, 'dartboard', 12, 16, 1), 'fléchettes');
  // Boutique
  ok(actions.buildRoom(s, 'shop', 23, 18, 25, 20), 'boutique');
  ok(actions.placeFurniture(s, 'souvenir_stand', 24, 18, 0), 'présentoir');
  s.stock.souvenirs = 20;
  // Cabane des guides
  ok(actions.buildRoom(s, 'guides', 23, 21, 25, 23), 'guides');
  ok(actions.placeFurniture(s, 'guide_desk', 23, 22, 0), 'comptoir des guides');
  // Spa
  ok(actions.buildRoom(s, 'spa', 20, 9, 23, 12), 'spa');
  ok(actions.placeFurniture(s, 'sauna', 20, 9, 0), 'sauna');
  const door = s.world.doors.find((k) => { const [, x, y] = k.split(',').map(Number); return x >= 20 && x <= 24 && y >= 9 && y <= 13; });
  const hx = door && +door.split(',')[1] >= 22 ? 20 : 22;
  ok(actions.placeFurniture(s, 'hot_tub', hx, 11, 0), `bain nordique (porte ${door})`);
  for (const role of ['waiter', 'guide', 'receptionist']) {
    const c = s.candidates.find((x) => x.role === role);
    ok(actions.hire(s, c.cid, 'journee'), role);
  }
  for (const r of Object.values(s.world.rooms)) assert.ok(s.rt.roomStats[r.id].reachable, `${r.type} accessible`);
  const used = new Set();
  run(s, 24 * 5, (st) => {
    for (const g of st.guests) if (g.act && g.act.kind === 'use' && g.act.phase === 'using') used.add(st.world.furniture[g.act.furnId]?.type);
    if (barStatus(st).open) used.add('bar-open');
  });
  const inc = s.ledger.history.reduce((acc, d) => { for (const [k, v] of Object.entries(d.incBy)) acc[k] = (acc[k] || 0) + v; return acc; }, {});
  assert.ok(used.has('bar-open'), 'le bar ouvre avec un serveur en service');
  assert.ok(s.stats.drinks > 0, `boissons servies au bar : ${s.stats.drinks}`);
  assert.ok(used.has('billiard') || used.has('dartboard'), `jeux utilisés : ${[...used].join(', ')}`);
  assert.ok((inc.shop || 0) > 0, 'ventes en boutique');
  assert.ok(s.stats.excursions > 0, `excursions : ${s.stats.excursions}`);
  assert.ok((inc.activities || 0) > 0, 'recettes d\'activités (spa, excursions)');
  assert.ok(used.has('sauna') || used.has('hot_tub'), 'le spa est fréquenté');
});
