// Économie : grand livre, demande, fin de journée, prêt.
import { ROOM_REF_PRICE, STOCK_TYPES } from '../data/economy.js';
import { ROOM_TYPES } from '../data/rooms.js';
import { FURNITURE } from '../data/furniture.js';
import { TIERS, SEASONS, WEATHER } from '../data/progression.js';
import { ARCHETYPES } from '../data/guests.js';
import { clamp } from '../core/util.js';
import { clock } from './time.js';

export const INCOME_CATS = { rooms: 'Nuitées', meals: 'Repas', drinks: 'Boissons', activities: 'Activités', shop: 'Boutique', tips: 'Pourboires', misc: 'Divers' };
export const EXPENSE_CATS = { salaries: 'Salaires', supplies: 'Approvisionnements', maintenance: 'Entretien', bills: 'Factures', build: 'Travaux & mobilier', loan: 'Remboursement du prêt', misc: 'Divers' };

export function earn(state, amount, cat = 'misc') {
  if (!amount) return;
  state.money += amount;
  const t = state.ledger.today.inc;
  t[cat] = (t[cat] || 0) + amount;
}
export function spend(state, amount, cat = 'misc', { deduct = true } = {}) {
  if (!amount) return;
  if (deduct) state.money -= amount;
  const t = state.ledger.today.exp;
  t[cat] = (t[cat] || 0) + amount;
}
export function ledgerTotals(day) {
  const inc = Object.values(day.inc).reduce((a, b) => a + b, 0);
  const exp = Object.values(day.exp).reduce((a, b) => a + b, 0);
  return { inc, exp, net: inc - exp };
}

/** Modificateurs temporaires actifs (événements). */
export function modifiers(state) {
  const day = clock(state.time).day;
  return state.events.modifiers.filter((m) => m.until >= day);
}
export function modProduct(state, key) {
  return modifiers(state).reduce((p, m) => p * (m[key] ?? 1), 1);
}

/** Indice de prix des chambres (1 = prix de référence). */
export function priceIndex(state) {
  const r = state.prices.rooms;
  return (r[0] / ROOM_REF_PRICE[0] * 0.6 + r[1] / ROOM_REF_PRICE[1] * 0.3 + r[2] / ROOM_REF_PRICE[2] * 0.1);
}

/** Attrait global (décor, jardin, services). 0.85 – 1.35 */
export function attractiveness(state) {
  const agg = state.rt.agg;
  const decor = agg.decorTotal / Math.max(6, Object.keys(state.world.rooms).length * 4);
  const services = ['restaurant', 'bar', 'games', 'spa', 'shop', 'guides', 'terrace'].filter((t) => agg.byType[t]).length;
  return clamp(0.85 + decor * 0.12 + services * 0.04 + Math.min(10, agg.gardenDecor) * 0.01, 0.85, 1.4);
}

/** Nombre attendu de groupes de voyageurs pour la journée et facteurs explicatifs. */
export function demandForecast(state) {
  const c = clock(state.time);
  const season = SEASONS[c.seasonIndex];
  const weather = WEATHER[state.weather.today] || WEATHER.soleil;
  const rep = state.reputation.value;
  const bedrooms = state.rt.agg.bedrooms;
  const base = 1.1 + 0.42 * bedrooms + TIERS[state.tier].baseDemand * 0.5;
  const repF = 0.45 + rep / 85;
  const pi = priceIndex(state);
  const priceF = clamp(1.25 - (pi - 1) * 0.75, 0.45, 1.6);
  const attrF = attractiveness(state);
  const evF = modProduct(state, 'demand');
  const waterfall = state.flags.waterfall ? 1.05 : 1;
  const total = base * season.demand * weather.demand * repF * priceF * attrF * evF * waterfall;
  return { total, base, season: season.demand, weather: weather.demand, rep: repF, price: priceF, attr: attrF, events: evF };
}

/** Pondération des archétypes selon la saison, la réputation et les installations. */
export function archetypeWeights(state) {
  const c = clock(state.time);
  const agg = state.rt.agg;
  const out = [];
  for (const [id, a] of Object.entries(ARCHETYPES)) {
    if (state.tier < a.tier || state.reputation.value < a.minRep) continue;
    let w = a.season[c.seasonIndex];
    if (id === 'family') w *= 0.7 + (agg.byType.games ? 0.4 : 0) + Math.min(0.3, agg.gardenDecor * 0.05);
    if (id === 'hiker') w *= 1.3 * (state.flags.waterfall ? 1.2 : 1);
    if (id === 'wealthy') w *= 0.4 + (agg.standing[2] ? 0.6 : 0) + (agg.byType.spa ? 0.4 : 0);
    if (id === 'couple') w *= 1 + (agg.byType.restaurant ? 0.2 : 0) + (agg.byType.spa ? 0.3 : 0);
    if (id === 'difficult') w *= 0.45;
    if (id === 'adventurer') w *= agg.byType.guides ? 1.4 : 1;
    out.push([id, w]);
  }
  return out;
}

/** Coûts quotidiens d'entretien (par case bâtie et par meuble). */
export function maintenanceCost(state) {
  let tiles = 0;
  for (const r of Object.values(state.world.rooms)) tiles += r.tiles.length * (ROOM_TYPES[r.type].indoor ? 1 : 0.4);
  const furn = Object.values(state.world.furniture).reduce((s, f) => s + FURNITURE[f.type].cost, 0);
  return Math.round(tiles * 0.45 + furn * 0.002);
}

/** Factures (chauffage, électricité, eau) prélevées chaque jour, plus élevées en hiver. */
export function billsCost(state) {
  const c = clock(state.time);
  let indoor = 0;
  for (const r of Object.values(state.world.rooms)) if (ROOM_TYPES[r.type].indoor) indoor += r.tiles.length;
  return Math.round(4 + indoor * 0.18 * SEASONS[c.seasonIndex].heating + state.guests.length * 0.6);
}

export function salariesCost(state) {
  return state.staff.filter((s) => s.role !== 'owner').reduce((a, s) => a + s.salary, 0);
}

export function storageCap(state, type) {
  return STOCK_TYPES[type].baseCap + (state.rt.agg.stockCap[type] || 0);
}

// ---------------------------------------------------------------- Prêt

export const LOAN_OPTIONS = [
  { amount: 3000, days: 14, rate: 0.12 },
  { amount: 8000, days: 21, rate: 0.15 },
  { amount: 20000, days: 28, rate: 0.18 },
];

export function takeLoan(state, k) {
  const opt = LOAN_OPTIONS[k];
  if (!opt) return { ok: false, reason: 'Offre inconnue' };
  if (state.loan) return { ok: false, reason: 'Un prêt est déjà en cours' };
  if (k > 0 && state.tier < k + 1) return { ok: false, reason: `Disponible au palier ${k + 1}` };
  const total = Math.round(opt.amount * (1 + opt.rate));
  state.loan = { principal: opt.amount, remaining: total, daily: Math.ceil(total / opt.days), daysLeft: opt.days };
  earn(state, opt.amount, 'misc');
  return { ok: true };
}

export function repayLoan(state) {
  if (!state.loan) return { ok: false, reason: 'Aucun prêt' };
  if (state.money < state.loan.remaining) return { ok: false, reason: 'Fonds insuffisants' };
  spend(state, state.loan.remaining, 'loan');
  state.loan = null;
  return { ok: true };
}

/** Clôture comptable de la journée : salaires, entretien, factures, prêt. Renvoie le bilan. */
export function closeDayAccounts(state) {
  const sal = salariesCost(state);
  const maint = maintenanceCost(state);
  const bills = billsCost(state);
  spend(state, sal, 'salaries');
  spend(state, maint, 'maintenance');
  spend(state, bills, 'bills');
  if (state.loan) {
    const pay = Math.min(state.loan.daily, state.loan.remaining);
    spend(state, pay, 'loan');
    state.loan.remaining -= pay;
    state.loan.daysLeft--;
    if (state.loan.remaining <= 0) state.loan = null;
  }
  const day = clock(state.time - 1).day;
  const today = state.ledger.today;
  const totals = ledgerTotals(today);
  const entry = { day, incBy: today.inc, expBy: today.exp, ...totals, money: Math.round(state.money), rep: Math.round(state.reputation.value) };
  state.ledger.history.push(entry);
  if (state.ledger.history.length > 56) state.ledger.history.shift();
  state.ledger.today = { inc: {}, exp: {} };
  return entry;
}
