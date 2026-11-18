import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, run, setupRestaurant, actions, clock } from './helpers.js';
import { serialize, deserialize } from '../../src/sim/state.js';
import { generateParty, chooseRoom, starsFor } from '../../src/sim/guests.js';
import { closeDayAccounts, takeLoan } from '../../src/sim/economy.js';
import { orderStock, processDeliveries } from '../../src/sim/stock.js';
import { objectiveList } from '../../src/sim/progression.js';
import { restaurantStatus } from '../../src/sim/restaurant.js';

/** Détecte les clients bloqués : même position et même activité trop longtemps hors sommeil/absence. */
function stuckWatcher() {
  const seen = new Map();
  const stuck = [];
  return {
    check(s) {
      for (const g of s.guests) {
        const sig = `${Math.round(g.x * 4)},${Math.round(g.y * 4)},${g.act ? g.act.kind + g.act.phase : 'none'}`;
        const prev = seen.get(g.id);
        if (!prev || prev.sig !== sig) { seen.set(g.id, { sig, t: s.time }); continue; }
        const idle = s.time - prev.t;
        const legit = g.hidden || (g.act && (g.act.kind === 'sleep' || g.act.phase === 'away' || g.act.phase === 'out'));
        if (!legit && idle > 8 * 60) stuck.push(`${g.name} ${sig} depuis ${Math.round(idle)} min`);
      }
    },
    stuck,
  };
}

test('simulation de 12 jours : clients servis, avis, aucun blocage', () => {
  const s = newGame(5);
  const w = stuckWatcher();
  run(s, 24 * 12, (st) => w.check(st));
  assert.equal(clock(s.time).day, 13);
  assert.ok(s.stats.served >= 10, `servis : ${s.stats.served}`);
  assert.ok(s.stats.reviews >= 5, `avis : ${s.stats.reviews}`);
  assert.ok(s.stats.nights >= 10);
  assert.ok(s.ledger.history.length >= 11);
  assert.ok(s.ledger.history.some((d) => d.inc > 0), 'des recettes ont été encaissées');
  assert.deepEqual(w.stuck, []);
  // Aucun client « fantôme » dans la file
  for (const id of s.reception.queue) assert.ok(s.guests.some((g) => g.id === id));
});

test('le restaurant prépare, sert et encaisse des repas', () => {
  const s = setupRestaurant(newGame(11));
  const w = stuckWatcher();
  run(s, 24 * 5, (st) => w.check(st));
  assert.ok(s.stats.meals > 5, `repas : ${s.stats.meals}`);
  const meals = s.ledger.history.reduce((a, d) => a + (d.incBy.meals || 0), 0);
  assert.ok(meals > 0, 'recettes repas');
  assert.ok(s.ledger.history.length === 5);
  assert.deepEqual(w.stuck, []);
});

test('un restaurant sans cuisinier est fermé', () => {
  const s = newGame();
  assert.equal(restaurantStatus(s).reason, 'none');
  setupRestaurant(s);
  s.staff = s.staff.filter((x) => x.role !== 'cook');
  assert.equal(restaurantStatus(s).reason, 'cook');
});

test('choix de chambre : capacité, prix et budget', () => {
  const s = newGame();
  const fam = generateParty(s, 'family', { size: 4 });
  assert.equal(chooseRoom(s, fam).reason, 'full', 'aucune chambre de 4 couchages');
  const hiker = generateParty(s, 'hiker', { size: 1 });
  hiker.budget = 50;
  s.prices.rooms[0] = 200;
  assert.equal(chooseRoom(s, hiker).reason, 'price');
  s.prices.rooms[0] = 30;
  const c = chooseRoom(s, hiker);
  assert.ok(c.room && c.price === 30);
});

test('notes : satisfaction convertie en étoiles', () => {
  assert.equal(starsFor(95), 5);
  assert.equal(starsFor(70), 4);
  assert.equal(starsFor(50), 3);
  assert.equal(starsFor(30), 2);
  assert.equal(starsFor(5), 1);
});

test('comptabilité de fin de journée et prêt', () => {
  const s = newGame();
  const m0 = s.money;
  const r = takeLoan(s, 0);
  assert.ok(r.ok);
  assert.equal(s.money, m0 + 3000);
  assert.equal(takeLoan(s, 0).reason, 'Un prêt est déjà en cours');
  const entry = closeDayAccounts(s);
  assert.ok(entry.exp > 0);
  assert.ok(s.loan.remaining < 3000 * 1.12);
});

test('commandes de stock : livraison le lendemain et express immédiat', () => {
  const s = newGame();
  s.stock.supplies = 10;
  const r = orderStock(s, 'supplies', 20);
  assert.ok(r.ok && r.qty === 20);
  assert.equal(s.stock.supplies, 10);
  s.time += 24 * 60;
  processDeliveries(s);
  assert.equal(s.stock.supplies, 30);
  const e = orderStock(s, 'supplies', 5, { express: true });
  assert.ok(e.ok);
  assert.equal(s.stock.supplies, 35);
  assert.equal(orderStock(s, 'souvenirs', 5).reason, 'Aucun stockage pour ce produit');
});

test('sauvegarde : aller-retour en pleine journée puis reprise de la simulation', () => {
  const s = setupRestaurant(newGame(21));
  run(s, 30);
  const json = serialize(s);
  const t = deserialize(json);
  assert.equal(t.time, s.time);
  assert.equal(t.money, s.money);
  assert.equal(t.guests.length, s.guests.length);
  assert.deepEqual(Object.keys(t.world.rooms), Object.keys(s.world.rooms));
  assert.equal(serialize(t), json, 'sérialisation stable');
  run(t, 48);
  assert.ok(clock(t.time).day >= 3);
  assert.throws(() => deserialize('{"foo":1}'));
});

test('objectifs : progression et réclamation de récompense', () => {
  const s = newGame();
  run(s, 6);
  const first = objectiveList(s).find((o) => o.id === 'first_guest');
  assert.ok(first.done);
  const m = s.money;
  assert.ok(actions.claimObjective(s, 'first_guest').ok);
  assert.equal(s.money, m + 100);
  assert.equal(actions.claimObjective(s, 'first_guest').reason, 'Déjà réclamé');
  assert.equal(actions.claimObjective(s, 'tier2').reason, 'Objectif non atteint');
});

test('palier supérieur : conditions requises puis passage', () => {
  const s = setupRestaurant(newGame(3));
  assert.equal(actions.upgradeTier(s).reason, 'Conditions non remplies');
  s.reputation.value = 60;
  s.stats.served = 40;
  s.money += 5000;
  for (const [x0, y0, x1, y1] of [[20, 22, 22, 23], [23, 16, 25, 17]]) {
    const r = actions.buildRoom(s, 'bedroom', x0, y0, x1, y1);
    assert.ok(r.ok, r.reason);
  }
  assert.ok(actions.placeFurniture(s, 'bed_single', 22, 22, 0).ok);
  assert.ok(actions.placeFurniture(s, 'bed_single', 23, 16, 0).ok);
  const r = actions.upgradeTier(s);
  assert.ok(r.ok, r.reason);
  assert.equal(s.tier, 2);
  assert.ok(actions.buildRoom(s, 'bar', 23, 20, 25, 22).ok, 'le bar est débloqué');
});

test('achat de terrain', () => {
  const s = newGame();
  s.money = 10000;
  assert.match(actions.buildRoom(s, 'garden', 15, 29, 17, 31).reason, /non acheté/);
  assert.ok(actions.buyParcel(s, 1).ok);
  assert.ok(actions.buildRoom(s, 'garden', 15, 29, 17, 31).ok);
  assert.match(actions.buyParcel(s, 2).reason, /palier 2/);
});
