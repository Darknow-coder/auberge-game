// Actions du joueur : point d'entrée unique pour l'interface et les tests.
import { RECIPES, DRINKS, SERVICES } from '../data/economy.js';
import { clamp } from '../core/util.js';
import * as World from './world.js';
import { spend, earn, takeLoan, repayLoan } from './economy.js';
import { orderStock } from './stock.js';
import { hireStaff, fireStaff } from './staff.js';
import { claimObjective, upgradeTier, buyParcel } from './progression.js';
import { resolveDialog } from './events.js';
import { recipeUnlocked, drinkUnlocked } from './restaurant.js';

const book = (state, r, cost) => { if (r.ok && cost > 0) spend(state, cost, 'build', { deduct: false }); return r; };

export const actions = {
  buildRoom(state, type, x0, y0, x1, y1) {
    const r = World.buildRoom(state, type, x0, y0, x1, y1);
    if (r.ok) state.lastBuild = { kind: 'room', roomId: r.room.id, cost: r.cost, merged: r.merged, tiles: World.checkRoomRect ? null : null };
    return book(state, r, r.cost);
  },
  placeFurniture(state, type, x, y, rot) {
    const r = World.placeFurniture(state, type, x, y, rot);
    return book(state, r, r.cost);
  },
  moveFurniture(state, id, x, y, rot) { return World.moveFurniture(state, id, x, y, rot); },
  sellFurniture(state, id) {
    const r = World.sellFurniture(state, id);
    if (r.ok && r.refund) { const t = state.ledger.today.inc; t.misc = (t.misc || 0) + r.refund; }
    return r;
  },
  demolishRoom(state, id) {
    const r = World.demolishRoom(state, id);
    if (r.ok && r.refund) { const t = state.ledger.today.inc; t.misc = (t.misc || 0) + r.refund; }
    return r;
  },
  toggleDoor(state, ax, ay, bx, by) {
    const r = World.toggleDoor(state, ax, ay, bx, by);
    return book(state, r, r.cost || 0);
  },
  paintRoom(state, id, style) {
    const r = World.paintRoom(state, id, style);
    return book(state, r, r.cost || 0);
  },
  setRoomPrice(state, standing, price) { state.prices.rooms[standing] = clamp(Math.round(price), 5, 2000); return { ok: true }; },
  setRecipePrice(state, id, price) { if (!RECIPES[id]) return { ok: false }; state.prices.recipes[id] = clamp(Math.round(price), 1, 300); return { ok: true }; },
  setDrinkPrice(state, id, price) { if (!DRINKS[id]) return { ok: false }; state.prices.drinks[id] = clamp(Math.round(price), 1, 100); return { ok: true }; },
  setServicePrice(state, id, price) { if (!SERVICES[id]) return { ok: false }; state.prices.services[id] = clamp(Math.round(price), 1, 500); return { ok: true }; },
  setBreakfastPrice(state, price) { state.prices.breakfast = clamp(Math.round(price), 1, 100); return { ok: true }; },
  toggleRecipe(state, id) {
    if (!recipeUnlocked(state, id)) return { ok: false, reason: 'Recette verrouillée' };
    const m = state.menu.recipes;
    if (m.includes(id)) { if (m.length <= 1) return { ok: false, reason: 'Gardez au moins un plat' }; state.menu.recipes = m.filter((x) => x !== id); }
    else { if (m.length >= 8) return { ok: false, reason: '8 plats maximum à la carte' }; m.push(id); }
    return { ok: true };
  },
  toggleDrink(state, id) {
    if (!drinkUnlocked(state, id)) return { ok: false, reason: 'Boisson verrouillée' };
    const m = state.menu.drinks;
    if (m.includes(id)) { if (m.length <= 1) return { ok: false, reason: 'Gardez au moins une boisson' }; state.menu.drinks = m.filter((x) => x !== id); }
    else m.push(id);
    return { ok: true };
  },
  orderStock(state, type, qty, express) { return orderStock(state, type, qty, { express }); },
  setAutoRestock(state, on) { state.autoRestockOn = !!on; return { ok: true }; },
  setRestockThreshold(state, type, v) { state.autoRestock[type] = clamp(Math.round(v), 0, 999); return { ok: true }; },
  hire(state, cid, shift) { return hireStaff(state, cid, shift); },
  fire(state, id) {
    const s = state.staff.find((x) => x.id === id);
    if (!s) return { ok: false, reason: 'Introuvable' };
    const sal = s.salary;
    const r = fireStaff(state, s);
    if (r.ok) spend(state, sal, 'salaries', { deduct: false });
    return r;
  },
  setShift(state, id, shift) {
    const s = state.staff.find((x) => x.id === id);
    if (!s || s.role === 'owner') return { ok: false };
    s.shift = shift;
    return { ok: true };
  },
  claimObjective(state, id) { return claimObjective(state, id); },
  upgradeTier(state) { return upgradeTier(state); },
  buyParcel(state, id) { return buyParcel(state, id); },
  takeLoan(state, k) { return takeLoan(state, k); },
  repayLoan(state) { return repayLoan(state); },
  resolveDialog(state, i) { return resolveDialog(state, i); },
  renameInn(state, name) { state.innName = String(name || '').slice(0, 40) || state.innName; return { ok: true }; },
};

export { earn };
