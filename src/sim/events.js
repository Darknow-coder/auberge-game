// Événements aléatoires, dialogues à choix, personnages récurrents, visiteurs spéciaux.
import { RANDOM_EVENTS, STORIES, SPECIAL_GUESTS } from '../data/events.js';
import { clamp } from '../core/util.js';
import { clock } from './time.js';
import { getRng, notify } from './state.js';
import { earn, spend, storageCap } from './economy.js';
import { restaurantStatus } from './restaurant.js';
import { fireStaff } from './staff.js';
import { think, generateParty, spawnParty } from './guests.js';

export function makeEventApi(state) {
  const rng = getRng(state);
  const api = {
    pick: (a) => rng.pick(a),
    int: (a, b) => rng.int(a, b),
    chance: (p) => rng.chance(p),
    randomGuest: (pred) => {
      const list = state.guests.filter((g) => g.roomId && !g.gone && g.state !== 'leave' && !g.hidden && (!pred || pred(g)));
      return list.length ? rng.pick(list) : null;
    },
    randomStaff: (pred) => {
      const list = state.staff.filter((s) => s.role !== 'owner' && (!pred || pred(s)));
      return list.length ? rng.pick(list) : null;
    },
    money: (amt, cat = 'misc') => (amt >= 0 ? earn(state, amt, cat) : spend(state, -amt, cat)),
    rep: (d) => { state.reputation.value = clamp(state.reputation.value + d, 0, 100); },
    satisfy: (g, d, text) => { if (g) think(g, text, d); },
    takeStock: (type, n) => { if (state.stock[type] < n) return false; state.stock[type] -= n; return true; },
    addStock: (type, n) => { const add = Math.max(0, Math.min(n, storageCap(state, type) - state.stock[type])); state.stock[type] += add; return add; },
    restaurantOpen: () => restaurantStatus(state).open,
    hasRoom: (type) => !!state.rt.agg.byType[type],
    gardenDecor: () => state.rt.agg.gardenDecor,
    freeRooms: () => {
      const occ = new Set(state.guests.map((g) => g.roomId));
      return Object.values(state.world.rooms).filter((r) => r.type === 'bedroom' && !occ.has(r.id) && state.rt.roomStats[r.id]?.capacity > 0).length;
    },
    spawnParty: (type, delay = 30) => state.schedule.push({ t: state.time + delay, type }),
    spawnSpecial: (kind) => state.schedule.push({ t: state.time + rng.int(4, 26) * 60, special: kind }),
    modifier: (id, days, props) => {
      const day = clock(state.time).day;
      state.events.modifiers = state.events.modifiers.filter((m) => m.id !== id);
      state.events.modifiers.push({ id, until: day + days - 1, ...props });
    },
    flag: (k, v) => { state.flags[k] = v; },
    seasonIndex: () => clock(state.time).seasonIndex,
    discountNight: (g) => { g.freeNights = (g.freeNights || 0) + 1; },
    fireStaff: (s, quit) => fireStaff(state, s, quit),
    relation: (ctx, d) => {
      const ch = state.stories.chars[ctx.storyId];
      if (!ch) return;
      ch.relation += d;
      ctx.relation = ch.relation;
    },
    unlockItem: (id) => { state.inventory[id] = (state.inventory[id] || 0) + 1; },
    unlockRecipe: (id) => {
      if (!state.unlocked.recipes.includes(id)) state.unlocked.recipes.push(id);
      if (!state.menu.recipes.includes(id)) state.menu.recipes.push(id);
    },
    trainRole: (role, amt) => {
      let n = 0;
      for (const s of state.staff) if (s.role === role) { s.skill = clamp(s.skill + amt, 0, 1); n++; }
      if (!n) state.flags.guideNotes = true;
      return n;
    },
  };
  return api;
}

// ---------------------------------------------------------------- Contexte sérialisable

function packCtx(ctx) {
  const out = {};
  for (const [k, v] of Object.entries(ctx || {})) {
    if (k === 'guest') out.gid = v.id;
    else if (k === 'staff') out.sid = v.id;
    else out[k] = v;
  }
  return out;
}
function unpackCtx(state, data) {
  const ctx = { ...data };
  if (data.gid) { ctx.guest = state.guests.find((g) => g.id === data.gid); if (!ctx.guest) return null; }
  if (data.sid) { ctx.staff = state.staff.find((s) => s.id === data.sid); if (!ctx.staff) return null; }
  if (data.storyId) ctx.relation = state.stories.chars[data.storyId]?.relation || 0;
  return ctx;
}

/** Texte et choix d'un dialogue en attente (pour l'interface). */
export function describeDialog(state, d) {
  const ctx = unpackCtx(state, d.ctx);
  if (!ctx) return null;
  if (d.kind === 'event') {
    const ev = RANDOM_EVENTS.find((e) => e.id === d.id);
    return { title: ev.title, text: ev.text(ctx), choices: ev.choices.map((c) => ({ label: c.label, cost: c.cost })), guest: ctx.guest, kind: 'event' };
  }
  const st = STORIES[d.id];
  const ch = st.chapters[d.chapter];
  return { title: `${st.name} — ${ch.title}`, text: ch.text, choices: ch.choices.map((c) => ({ label: c.label, cost: c.cost })), guest: ctx.guest, kind: 'story', storyId: d.id };
}

export function resolveDialog(state, index) {
  const d = state.dialogs.shift();
  if (!d) return null;
  const ctx = unpackCtx(state, d.ctx);
  if (!ctx) return null;
  const api = makeEventApi(state);
  let def;
  if (d.kind === 'event') def = RANDOM_EVENTS.find((e) => e.id === d.id).choices[index];
  else def = STORIES[d.id].chapters[d.chapter].choices[index];
  if (!def) return null;
  const text = def.effect(state, api, ctx) || '';
  notify(state, { kind: d.kind === 'story' ? 'story' : 'event', text, title: def.label, log: true });
  return text;
}

/** Supprime les dialogues devenus caducs (client parti...). */
export function pruneDialogs(state) {
  state.dialogs = state.dialogs.filter((d) => unpackCtx(state, d.ctx));
}

// ---------------------------------------------------------------- Événements aléatoires

export function planDailyEvent(state) {
  const rng = getRng(state);
  if (rng.chance(0.6)) state.events.next = { t: state.time + rng.int(9 * 60, 17 * 60) };
  else state.events.next = null;
}

export function triggerRandomEvent(state) {
  const rng = getRng(state);
  const c = clock(state.time);
  const api = makeEventApi(state);
  const pool = [];
  for (const ev of RANDOM_EVENTS) {
    if (ev.minTier && state.tier < ev.minTier) continue;
    if (ev.seasons && !ev.seasons.includes(c.seasonIndex)) continue;
    if (ev.once && state.events.once.includes(ev.id)) continue;
    const cd = state.events.cooldowns[ev.id];
    if (cd && c.day - cd < ev.cooldown) continue;
    const ctx = ev.cond(state, api);
    if (!ctx) continue;
    pool.push([{ ev, ctx }, ev.weight]);
  }
  if (!pool.length) return null;
  const { ev, ctx } = rng.weighted(pool);
  state.events.cooldowns[ev.id] = c.day;
  if (ev.once) state.events.once.push(ev.id);
  if (ev.auto) {
    const text = ev.auto(state, api, ctx);
    notify(state, { kind: 'event', title: ev.title, text, log: true });
  } else {
    state.dialogs.push({ kind: 'event', id: ev.id, ctx: packCtx(ctx) });
    notify(state, { kind: 'dialog', text: ev.title, log: false });
  }
  return ev.id;
}

// ---------------------------------------------------------------- Personnages récurrents

function charState(state, id) {
  return (state.stories.chars[id] ||= { chapter: 0, relation: 0, visits: 0, lastDay: 0, present: false, pending: false });
}

/** Chaque matin : planifie éventuellement la visite d'un personnage. */
export function planStories(state) {
  const rng = getRng(state);
  const c = clock(state.time);
  for (const [id, st] of Object.entries(STORIES)) {
    const ch = charState(state, id);
    if (ch.present || ch.pending || ch.chapter >= st.chapters.length) continue;
    const chap = st.chapters[ch.chapter];
    if (state.tier < (chap.minTier || st.minTier)) continue;
    if (st.needs === 'restaurant' && !state.rt.agg.byType.restaurant) continue;
    if (chap.needRelation && ch.relation < chap.needRelation) continue;
    if (c.day - ch.lastDay < chap.after) continue;
    if (!rng.chance(0.3)) continue;
    ch.pending = true;
    state.schedule.push({ t: state.time + rng.int(9 * 60, 16 * 60), story: id });
  }
}

export function spawnStoryGuest(state, id) {
  const st = STORIES[id];
  const ch = charState(state, id);
  ch.pending = false;
  const chap = st.chapters[ch.chapter];
  if (!chap) return null;
  const size = chap.size || st.members.length;
  const g = generateParty(state, st.type, { size });
  const ms = st.members;
  g.members = g.members.map((m, k) => {
    const spec = ms[k];
    if (!spec) return { ...m, first: 'Léa', kid: true, age: 1, look: { ...m.look, hairStyle: 'short' } };
    return { first: spec.first, fem: spec.fem, kid: false, age: spec.age, look: { skin: spec.skin, hair: spec.hair, hairStyle: spec.hairStyle, top: spec.top, bottom: spec.bottom, hat: !!spec.hat, backpack: !!spec.backpack } };
  });
  g.fem = g.members[0].fem;
  g.name = st.name.split(',')[0];
  g.nights = chap.nights || 2;
  g.story = { id, chapter: ch.chapter };
  g.budget = Math.max(g.budget, 90);
  if (chap.free) g.budget = 1;
  if (chap.free) g.freeStay = true; // logé quelle que soit la décision ; le choix peut le renvoyer
  ch.present = true;
  spawnParty(state, g);
  notify(state, { kind: 'story', text: `${st.name} remonte le chemin de l'auberge…`, gid: g.id, log: true });
  return g;
}

export function onStoryCheckIn(state, g) {
  const ch = charState(state, g.story.id);
  state.dialogs.push({ kind: 'story', id: g.story.id, chapter: g.story.chapter, ctx: { gid: g.id, storyId: g.story.id } });
  notify(state, { kind: 'dialog', text: STORIES[g.story.id].name, log: false });
  ch.visits++;
}

export function onStoryCheckOut(state, g, review) {
  const ch = charState(state, g.story.id);
  const st = STORIES[g.story.id];
  const chap = st.chapters[g.story.chapter];
  ch.present = false;
  ch.lastDay = clock(state.time).day;
  if (chap && chap.judge === 'food') {
    const q = g.lastMealQ || 0;
    if (q >= 0.7) { state.reputation.value = clamp(state.reputation.value + 5, 0, 100); notify(state, { kind: 'good', text: `Margaux Valtorta publie une critique élogieuse de votre cuisine ! (réputation +5)`, log: true }); }
    else if (q > 0) { state.reputation.value = clamp(state.reputation.value - 2, 0, 100); notify(state, { kind: 'warn', text: 'La critique de Margaux Valtorta est mitigée… Améliorez la cuisine (cuisinier, équipement).', log: true }); }
    else notify(state, { kind: 'warn', text: 'Margaux Valtorta est repartie sans avoir pu goûter votre cuisine.', log: true });
  }
  if (review.stars >= 4) ch.relation += 1;
  ch.chapter++;
}

/** Échec d'arrivée (pas de chambre) : le personnage reviendra plus tard. */
export function onStoryRefused(state, g) {
  const ch = charState(state, g.story.id);
  ch.present = false;
  ch.lastDay = clock(state.time).day - Math.max(0, (STORIES[g.story.id].chapters[ch.chapter]?.after || 3) - 3);
}

// ---------------------------------------------------------------- Visiteurs spéciaux

export function spawnSpecial(state, kind) {
  const spec = SPECIAL_GUESTS[kind];
  const rng = getRng(state);
  const g = generateParty(state, spec.type, { size: 1 });
  g.vip = kind;
  g.nights = rng.int(spec.nights[0], spec.nights[1]);
  g.budget = Math.max(g.budget, kind === 'celebrity' ? 220 : 120);
  spawnParty(state, g);
  return g;
}

export function onVipCheckOut(state, g, review) {
  if (g.vip === 'celebrity') {
    if (review.stars >= 4) { state.reputation.value = clamp(state.reputation.value + 6, 0, 100); notify(state, { kind: 'good', text: `Surprise : ${g.name} était la célèbre chanteuse Clara Mont ! Elle vante votre auberge sur toutes les ondes (réputation +6).`, log: true }); }
    else if (review.stars <= 2) { state.reputation.value = clamp(state.reputation.value - 4, 0, 100); notify(state, { kind: 'warn', text: `${g.name} était une célébrité incognito… et son séjour l'a déçue (réputation -4).`, log: true }); }
  } else if (g.vip === 'inspector') {
    if (review.stars >= 4) { state.reputation.value = clamp(state.reputation.value + 7, 0, 100); state.flags.guideMention = (state.flags.guideMention || 0) + 1; notify(state, { kind: 'good', text: 'Le Guide des Cimes vous décerne une mention « Coup de cœur » ! (réputation +7)', log: true }); }
    else if (review.stars <= 2) { state.reputation.value = clamp(state.reputation.value - 5, 0, 100); notify(state, { kind: 'warn', text: 'L\'inspecteur du Guide des Cimes a rendu un avis sévère (réputation -5).', log: true }); }
    else notify(state, { kind: 'info', text: 'L\'inspecteur du Guide des Cimes juge votre auberge « correcte ».', log: true });
  }
}
