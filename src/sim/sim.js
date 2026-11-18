// Boucle de simulation : temps, planning quotidien, agents, fin de journée.
import { MIN_PER_DAY, DAYS_PER_SEASON } from '../data/constants.js';
import { SEASONS, WEATHER } from '../data/progression.js';
import { clamp } from '../core/util.js';
import { clock } from './time.js';
import { getRng, notify } from './state.js';
import { demandForecast, archetypeWeights, closeDayAccounts, attractiveness } from './economy.js';
import { generateParty, spawnParty, updateGuest, rebuildReservations } from './guests.js';
import { updateStaff, refreshCandidates, staffDayEnd } from './staff.js';
import { processDeliveries, autoRestock, DELIVERY_HOUR } from './stock.js';
import { planDailyEvent, triggerRandomEvent, planStories, spawnStoryGuest, spawnSpecial, pruneDialogs } from './events.js';
import { rollWeather } from './weather.js';
import { objectiveList } from './progression.js';

/** Avance la simulation de dtMin minutes de jeu (par pas d'au plus 1 minute). */
export function update(state, dtMin) {
  if (!state.rt.reserved) rebuildReservations(state);
  let remaining = dtMin;
  while (remaining > 1e-9) {
    const dt = Math.min(1, remaining);
    step(state, dt);
    remaining -= dt;
  }
}

function crossed(before, after, hour) {
  const h = hour * 60;
  const b = before % MIN_PER_DAY, a = after % MIN_PER_DAY;
  if (Math.floor(after / MIN_PER_DAY) !== Math.floor(before / MIN_PER_DAY)) return b < h || a >= h;
  return b < h && a >= h;
}

function step(state, dt) {
  const before = state.time;
  state.time += dt;
  const c0 = clock(before), c1 = clock(state.time);
  if (c1.day !== c0.day) newDay(state, c0, c1);
  if (crossed(before, state.time, 7)) autoRestock(state);
  if (crossed(before, state.time, DELIVERY_HOUR)) processDeliveries(state);
  if (crossed(before, state.time, 6)) morning(state);
  // Arrivées planifiées
  if (state.schedule.length) {
    const due = state.schedule.filter((s) => s.t <= state.time);
    if (due.length) {
      state.schedule = state.schedule.filter((s) => s.t > state.time);
      for (const s of due) spawnScheduled(state, s);
    }
  }
  if (state.events.next && state.time >= state.events.next.t) {
    state.events.next = null;
    triggerRandomEvent(state);
  }
  for (const g of state.guests) updateGuest(state, g, dt);
  if (state.guests.some((g) => g.gone)) {
    state.guests = state.guests.filter((g) => !g.gone);
    const ids = new Set(state.guests.map((g) => g.id));
    state.reception.queue = state.reception.queue.filter((id) => ids.has(id));
    if (state.dialogs.length) pruneDialogs(state);
  }
  for (const s of state.staff) updateStaff(state, s, dt);
  if (state.restaurant.orders.length) state.restaurant.orders = state.restaurant.orders.filter((o) => o.status !== 'done' && o.status !== 'failed');
  if (Math.floor(before / 10) !== Math.floor(state.time / 10)) checkObjectives(state);
}

function spawnScheduled(state, s) {
  if (s.story) return spawnStoryGuest(state, s.story);
  if (s.special) return spawnSpecial(state, s.special);
  // Route bloquée (tempête) : personne ne vient.
  const c = clock(state.time);
  if (state.events.modifiers.some((m) => m.until >= c.day && m.demand !== undefined && m.demand < 0.1) && !s.word) return null;
  const rng = getRng(state);
  const type = s.type || rng.weighted(archetypeWeights(state));
  if (!type) return null;
  return spawnParty(state, generateParty(state, type));
}

/** Planifie les arrivées de la journée (appelé à 6h, ou au lancement). */
export function planArrivals(state, fromHour = 8.5) {
  const rng = getRng(state);
  const f = demandForecast(state);
  const c = clock(state.time);
  const span = Math.max(0.2, (20 - Math.max(fromHour, 8.5)) / 11.5);
  const expected = f.total * span;
  let n = Math.floor(expected);
  if (rng.chance(expected - n)) n++;
  const dayStart = (c.day - 1) * MIN_PER_DAY;
  for (let k = 0; k < n; k++) {
    const h = Math.max(fromHour, 8.5) + (rng.next() + rng.next()) / 2 * (20 - Math.max(fromHour, 8.5));
    state.schedule.push({ t: dayStart + h * 60 });
  }
  state.rt.forecast = f;
  return n;
}

function morning(state) {
  planArrivals(state);
  planDailyEvent(state);
  planStories(state);
}

function newDay(state, c0, c1) {
  // Clôture de la veille
  const entry = closeDayAccounts(state);
  staffDayEnd(state);
  const todayRefused = { ...state.stats.refused };
  const prevRef = state.daily.refused0;
  const refused = Object.fromEntries(Object.keys(todayRefused).map((k) => [k, todayRefused[k] - (prevRef[k] || 0)]));
  state.daily.refused0 = todayRefused;
  // Dérive lente de la réputation vers la qualité des installations.
  const facility = clamp(25 + (attractiveness(state) - 0.85) * 90 + state.rt.agg.standing[1] * 3 + state.rt.agg.standing[2] * 6, 0, 95);
  state.reputation.value = clamp(state.reputation.value + (facility - state.reputation.value) * 0.015, 0, 100);
  state.reputation.history.push(Math.round(state.reputation.value));
  if (state.reputation.history.length > 56) state.reputation.history.shift();
  const reviewsToday = state.reputation.reviews.filter((r) => r.day === c0.day);
  state.lastDayReport = {
    day: c0.day, ...entry, refused,
    arrivals: state.stats.arrivals - state.daily.arrivals0,
    reviews: reviewsToday.length,
    avgStars: reviewsToday.length ? reviewsToday.reduce((s, r) => s + r.stars, 0) / reviewsToday.length : 0,
    guests: state.guests.length,
  };
  state.daily.arrivals0 = state.stats.arrivals;
  notify(state, { kind: 'report', text: `Bilan du jour ${c0.dayOfSeason} : ${entry.net >= 0 ? '+' : ''}${Math.round(entry.net)} écus`, report: state.lastDayReport, log: false });
  // Nouvelle journée
  state.weather.today = state.weather.tomorrow;
  state.weather.tomorrow = rollWeather(state, clock(state.time + MIN_PER_DAY).seasonIndex);
  state.events.modifiers = state.events.modifiers.filter((m) => m.until >= c1.day);
  if (c1.seasonIndex !== c0.seasonIndex) {
    notify(state, { kind: 'season', text: `${SEASONS[c1.seasonIndex].name} arrive sur les sommets ! ${seasonHint(c1.seasonIndex)}`, log: true });
    // Saison hivernale : la météo du jour doit être cohérente
    if (!SEASONS[c1.seasonIndex].weather[state.weather.today]) state.weather.today = rollWeather(state, c1.seasonIndex);
  }
  if (c1.day - state.candidatesDay >= 3) refreshCandidates(state);
}

function seasonHint(i) {
  return [
    'Les randonneurs reviennent, les prés refleurissent.',
    'Haute saison : familles nombreuses, terrasse et activités en plein air.',
    'Les forêts se parent d\'or ; fréquentation plus calme, plats mijotés à l\'honneur.',
    'La neige recouvre tout : les voyageurs recherchent chaleur et confort. Pensez au chauffage !',
  ][i];
}

function checkObjectives(state) {
  const list = objectiveList(state);
  state.rt.objDone ||= new Set(state.objectives.claimed);
  for (const o of list) {
    if (o.done && !o.claimed && !state.rt.objDone.has(o.id)) {
      state.rt.objDone.add(o.id);
      notify(state, { kind: 'objective', text: `Objectif atteint : ${o.title} ! Réclamez votre récompense.`, log: true, id: o.id });
    }
  }
}

/** Démarrage d'une partie : un premier client rapidement pour lancer l'action. */
export function bootstrapDay(state) {
  const c = clock(state.time);
  if (!state.rt.booted) {
    state.rt.booted = true;
    if (c.day === 1 && state.stats.arrivals === 0 && !state.schedule.length) {
      state.schedule.push({ t: state.time + 12, type: 'hiker' });
      state.schedule.push({ t: state.time + 75, type: 'passing' });
      planArrivals(state, c.hf + 1.5);
      planDailyEvent(state);
    }
  }
}

export { WEATHER };
