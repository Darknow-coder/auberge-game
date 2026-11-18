import { createNewGame } from '../../src/sim/state.js';
import { update, bootstrapDay } from '../../src/sim/sim.js';
import { actions } from '../../src/sim/actions.js';
import { suggestRotation } from '../../src/sim/world.js';
import { clock } from '../../src/sim/time.js';

export function newGame(seed = 42) {
  const s = createNewGame({ seed, innName: 'Test' });
  bootstrapDay(s);
  return s;
}

/** Avance de `hours` heures en résolvant automatiquement les dialogues (choix 0). */
export function run(s, hours, onStep) {
  const end = s.time + hours * 60;
  while (s.time < end) {
    update(s, Math.min(10, end - s.time));
    while (s.dialogs.length) actions.resolveDialog(s, 0);
    s.rt.notifications.length = 0;
    if (onStep) onStep(s);
  }
}

/** Ajoute cuisine + restaurant meublés et embauche cuisinier et serveur. */
export function setupRestaurant(s) {
  s.money += 20000;
  const ok = (r, l) => { if (!r.ok) throw new Error(`${l}: ${r.reason}`); return r; };
  ok(actions.buildRoom(s, 'kitchen', 12, 13, 14, 15), 'cuisine');
  ok(actions.buildRoom(s, 'restaurant', 15, 13, 18, 15), 'restaurant');
  ok(actions.placeFurniture(s, 'stove', 12, 13, 0), 'fourneau');
  ok(actions.placeFurniture(s, 'pantry', 14, 13, 0), 'garde-manger');
  ok(actions.placeFurniture(s, 'table_small', 17, 14, 0), 'table');
  ok(actions.placeFurniture(s, 'chair', 16, 14, suggestRotation(s, 'chair', 16, 14)), 'chaise1');
  ok(actions.placeFurniture(s, 'chair', 18, 14, suggestRotation(s, 'chair', 18, 14)), 'chaise2');
  ok(actions.placeFurniture(s, 'table_long', 15, 13, 0), 'table longue');
  for (const role of ['cook', 'waiter']) {
    const c = s.candidates.find((x) => x.role === role);
    ok(actions.hire(s, c.cid, 'journee'), role);
  }
  s.stock.ingredients = 60;
  return s;
}

export { actions, clock, update };
