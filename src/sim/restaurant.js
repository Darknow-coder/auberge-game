// Restaurant et bar : état d'ouverture, commandes, choix des plats.
import { RECIPES, DRINKS, BREAKFAST } from '../data/economy.js';
import { clock } from './time.js';
import { getRng, notify } from './state.js';
import { staffOnDuty } from './staff.js';
import { abortMeal } from './guests.js';

export function recipeUnlocked(state, id) {
  const r = RECIPES[id];
  return !!r && (state.tier >= r.tier || state.unlocked.recipes.includes(id));
}
export function drinkUnlocked(state, id) { return !!DRINKS[id] && state.tier >= DRINKS[id].tier; }

export function kitchenStatus(state) {
  const k = Object.values(state.world.rooms).find((r) => r.type === 'kitchen');
  if (!k) return { ok: false, reason: 'kitchen' };
  const st = state.rt.roomStats[k.id];
  if (!st || !st.ok) return { ok: false, reason: 'stove' };
  return { ok: true, room: k, stats: st };
}

const REASONS = {
  none: 'Pas de salle de restaurant',
  seats: 'Aucune place assise (chaises autour des tables)',
  kitchen: 'Pas de cuisine',
  stove: 'La cuisine n\'a pas de fourneau',
  cook: 'Aucun cuisinier en service',
  stock: 'Plus d\'ingrédients',
  menu: 'La carte est vide',
};
export const restaurantReasonText = (r) => REASONS[r] || r;

export function restaurantStatus(state) {
  const rt = state.rt;
  if (!rt.agg.byType.restaurant && !rt.diningSeats.length) return { open: false, reason: 'none' };
  if (!rt.diningSeats.length) return { open: false, reason: 'seats' };
  const k = kitchenStatus(state);
  if (!k.ok) return { open: false, reason: k.reason };
  if (!staffOnDuty(state, 'cook').length) return { open: false, reason: 'cook' };
  if (state.stock.ingredients < 1) return { open: false, reason: 'stock' };
  if (!state.menu.recipes.some((id) => recipeUnlocked(state, id))) return { open: false, reason: 'menu' };
  return { open: true };
}

export function barStatus(state) {
  const rt = state.rt;
  const bar = Object.values(state.world.rooms).find((r) => r.type === 'bar');
  if (!bar) return { open: false, reason: 'Pas de bar' };
  if (!rt.roomStats[bar.id].ok) return { open: false, reason: 'Pas de comptoir' };
  if (!rt.barSeats.length) return { open: false, reason: 'Pas de tabourets' };
  if (!staffOnDuty(state, 'waiter').length) return { open: false, reason: 'Aucun serveur en service' };
  if (state.stock.drinks < 1) return { open: false, reason: 'Plus de boissons' };
  if (!state.menu.drinks.some((id) => drinkUnlocked(state, id))) return { open: false, reason: 'Carte des boissons vide' };
  return { open: true, room: bar };
}

function chooseDrink(state, g) {
  const rng = getRng(state);
  const si = clock(state.time).seasonIndex;
  const list = state.menu.drinks.filter((id) => drinkUnlocked(state, id));
  if (!list.length) return null;
  const econ = g.traits.includes('econome') ? 2 : 1;
  return rng.weighted(list.map((id) => {
    const d = DRINKS[id];
    const p = state.prices.drinks[id];
    let w = d.season[si] * Math.pow(d.price / Math.max(1, p), 1.2 * econ);
    if (id === 'petillant' && g.budget < 120) w *= 0.15;
    return [id, w];
  }));
}

export function placeMealOrder(state, g) {
  const rng = getRng(state);
  const c = clock(state.time);
  const breakfast = c.hf < 10.5;
  let recipeId = 'breakfast', rec = BREAKFAST, unit = state.prices.breakfast;
  if (!breakfast) {
    const list = state.menu.recipes.filter((id) => recipeUnlocked(state, id));
    const econ = g.traits.includes('econome') ? 2 : 1.2;
    const gourmet = g.traits.includes('gourmand') ? 2 : 1;
    recipeId = rng.weighted(list.map((id) => {
      const r = RECIPES[id];
      const p = state.prices.recipes[id];
      let w = Math.pow(r.quality, gourmet) * r.season[c.seasonIndex] * Math.pow(r.price / Math.max(1, p), econ);
      if (p > g.budget * 0.45) w *= 0.2;
      return [id, w];
    }));
    rec = RECIPES[recipeId];
    unit = state.prices.recipes[recipeId];
  }
  const adults = g.members.filter((m) => !m.kid).length;
  let drinksTotal = 0, drinkUnits = 0;
  for (let k = 0; k < g.size; k++) {
    if (!rng.chance(k < adults ? 0.6 : 0.4)) continue;
    const d = chooseDrink(state, g);
    if (!d) break;
    drinksTotal += state.prices.drinks[d];
    drinkUnits += DRINKS[d].units || 1;
  }
  const kids = g.size - adults;
  const total = Math.round(unit * adults + unit * 0.6 * kids);
  const order = {
    id: state.restaurant.nextOrder++, gid: g.id, kind: 'meal', recipe: recipeId, name: rec.name,
    qty: g.size, status: 'new', t: state.time, breakfast, total, drinksTotal, drinkUnits,
    priceRatio: unit / (breakfast ? 10 : rec.price), tableId: g.act.tableId,
  };
  state.restaurant.orders.push(order);
  g.act.orderId = order.id;
  return order;
}

export function placeDrinkOrder(state, g) {
  const adults = Math.max(1, g.members.filter((m) => !m.kid).length);
  const d = chooseDrink(state, g);
  if (!d) return null;
  const order = {
    id: state.restaurant.nextOrder++, gid: g.id, kind: 'drink', drink: d, name: DRINKS[d].name, qty: g.size,
    status: 'new', t: state.time, total: state.prices.drinks[d] * adults + (g.size - adults) * 2, units: (DRINKS[d].units || 1) * g.size,
  };
  state.restaurant.orders.push(order);
  g.act.orderId = order.id;
  return order;
}

export function ingredientsFor(order) {
  if (order.breakfast) return Math.max(1, Math.round(order.qty * 0.5));
  return Math.max(1, Math.round(RECIPES[order.recipe].ing * order.qty * 0.5));
}

export function cancelOrdersOf(state, gid) {
  state.restaurant.orders = state.restaurant.orders.filter((o) => o.gid !== gid || o.status === 'delivering' || o.status === 'pickup');
  for (const o of state.restaurant.orders) if (o.gid === gid) o.cancelled = true;
}

export function failOrder(state, order, guest, text) {
  order.status = 'failed';
  if (guest && guest.act && guest.act.orderId === order.id) abortMeal(state, guest, order.kind === 'meal' ? 'Plus rien en cuisine, nous sommes repartis le ventre vide.' : 'Plus rien à boire au bar !', -8);
  notify(state, { kind: 'warn', text, log: true, key: 'stock' });
}

/** Qualité d'un plat selon le cuisinier et l'équipement de la cuisine. */
export function mealQuality(state, order, cook) {
  const base = order.breakfast ? BREAKFAST.quality * (state.rt.agg.byType.restaurant && hasBuffet(state) ? 1.2 : 1) : RECIPES[order.recipe].quality;
  const k = kitchenStatus(state);
  const kq = k.ok ? Math.min(3.2, k.stats.kitchen) : 0.5;
  const skill = cook ? cook.skill : 0.3;
  let q = base * (0.55 + 0.45 * skill) * (0.82 + 0.08 * kq);
  if (cook && cook.traits.includes('meticuleux')) q *= 1.06;
  return Math.round(q * 100) / 100;
}
function hasBuffet(state) { return Object.values(state.world.furniture).some((f) => f.type === 'buffet'); }
