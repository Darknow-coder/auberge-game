// Stocks : commandes, livraisons du lendemain, réassort automatique.
import { STOCK_TYPES } from '../data/economy.js';
import { clock } from './time.js';
import { notify } from './state.js';
import { spend, storageCap } from './economy.js';

export const DELIVERY_HOUR = 8;
export const EXPRESS_MULT = 1.4;
export const AUTO_FEE = 1.15;

export function pending(state, type) {
  return state.deliveries.filter((d) => d.type === type).reduce((s, d) => s + d.qty, 0);
}

/** Commande de marchandises. express : livraison immédiate (+40 %). */
export function orderStock(state, type, qty, { express = false, auto = false } = {}) {
  const def = STOCK_TYPES[type];
  if (!def) return { ok: false, reason: 'Produit inconnu' };
  const cap = storageCap(state, type);
  if (cap <= 0) return { ok: false, reason: 'Aucun stockage pour ce produit' };
  const room = cap - state.stock[type] - (express ? 0 : pending(state, type));
  const n = Math.max(0, Math.min(qty, room));
  if (n <= 0) return { ok: false, reason: 'Réserve pleine' };
  const manager = state.staff.some((s) => s.role === 'manager');
  const mult = express ? EXPRESS_MULT : auto && !manager ? AUTO_FEE : 1;
  const cost = Math.ceil(n * def.unitCost * mult);
  if (state.money < cost) return { ok: false, reason: 'Fonds insuffisants' };
  spend(state, cost, 'supplies');
  if (express) state.stock[type] += n;
  else {
    const c = clock(state.time);
    const day = c.hf < DELIVERY_HOUR - 0.5 ? c.day : c.day + 1;
    state.deliveries.push({ type, qty: n, day });
  }
  return { ok: true, qty: n, cost };
}

export function processDeliveries(state) {
  const day = clock(state.time).day;
  const due = state.deliveries.filter((d) => d.day <= day);
  if (!due.length) return;
  state.deliveries = state.deliveries.filter((d) => d.day > day);
  state.flags.lastDelivery = day;
  const parts = [];
  for (const d of due) {
    const add = Math.max(0, Math.min(d.qty, storageCap(state, d.type) - state.stock[d.type]));
    state.stock[d.type] += add;
    parts.push(`${add} ${STOCK_TYPES[d.type].name.toLowerCase()}`);
  }
  notify(state, { kind: 'delivery', text: `La charrette du fournisseur a livré : ${parts.join(', ')}.`, log: true });
}

/** Réassort automatique (activé par seuils) chaque matin. */
export function autoRestock(state) {
  if (!state.autoRestockOn) return;
  for (const [type, thr] of Object.entries(state.autoRestock)) {
    if (!thr) continue;
    const cap = storageCap(state, type);
    if (cap <= 0) continue;
    const have = state.stock[type] + pending(state, type);
    if (have < thr) orderStock(state, type, cap - have, { auto: true });
  }
}
