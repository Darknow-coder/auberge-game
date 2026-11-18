// Visiteurs : génération, réception, choix de chambre, IA d'activités, avis.
import { ARCHETYPES, TRAITS, FIRST_NAMES_F, FIRST_NAMES_M, KID_NAMES, LAST_NAMES, ORIGINS, SKIN_TONES, HAIR_COLORS, PALETTES } from '../data/guests.js';
import { FURNITURE, USE_KINDS } from '../data/furniture.js';
import { ROOM_TYPES } from '../data/rooms.js';
import { STANDING_NAMES } from '../data/economy.js';
import { WEATHER } from '../data/progression.js';
import { SPOTS } from '../data/constants.js';
import { STORIES, SPECIAL_GUESTS } from '../data/events.js';
import { clamp } from '../core/util.js';
import { clock } from './time.js';
import { getRng, notify } from './state.js';
import { idx, inb, furnSpots, staffSpot, clientSpot, roomAtTile, DIRS4 } from './world.js';
import { goTo, stepAlong, placeAt, tileOf } from './agents.js';
import { earn, modProduct } from './economy.js';
import { restaurantStatus, placeMealOrder, placeDrinkOrder, cancelOrdersOf, barStatus } from './restaurant.js';
import { deskAgent, guideAvailable } from './staff.js';
import { onStoryCheckIn, onStoryCheckOut, onVipCheckOut, onStoryRefused } from './events.js';

// ---------------------------------------------------------------- Génération

function makeLook(rng, a, { kid = false, fem = false, age = 30 } = {}) {
  const pal = PALETTES[a.palette] || PALETTES.casual;
  const grey = age > 60 && rng.chance(0.7);
  const styles = fem ? ['long', 'bob', 'ponytail', 'bun', 'curly'] : ['short', 'short', 'curly', 'bald', 'beard'];
  return {
    skin: rng.pick(SKIN_TONES),
    hair: grey ? rng.pick(['#9a9a9a', '#d8d4cc', '#bdb8ad']) : rng.pick(HAIR_COLORS.slice(0, 6).concat(['#7a2f1e', '#1c1c22'])),
    hairStyle: kid ? (fem ? 'ponytail' : 'short') : rng.pick(styles),
    top: rng.pick(pal.tops),
    bottom: rng.pick(pal.bottoms),
    hat: !kid && rng.chance(a.hat || 0),
    backpack: !kid && rng.chance(a.backpack || 0),
  };
}

export function generateParty(state, type, opts = {}) {
  const rng = getRng(state);
  const a = ARCHETYPES[type];
  const size = opts.size || rng.int(a.size[0], a.size[1]);
  const last = rng.pick(LAST_NAMES);
  const members = [];
  const leadFem = rng.chance(0.5);
  const adultAge = rng.int(a.age[0], a.age[1]);
  for (let k = 0; k < size; k++) {
    let fem, kid = false, age, first;
    if (a.family && k >= 2) { kid = true; fem = rng.chance(0.5); age = rng.int(4, 12); first = rng.pick(KID_NAMES); }
    else {
      fem = k === 0 ? leadFem : (type === 'couple' || a.family) ? !leadFem : rng.chance(0.5);
      age = clamp(adultAge + rng.int(-4, 4), 18, 85);
      first = rng.pick(fem ? FIRST_NAMES_F : FIRST_NAMES_M);
    }
    members.push({ first, fem, kid, age, look: makeLook(rng, a, { kid, fem, age }) });
  }
  let name;
  if (a.family) name = `Famille ${last}`;
  else if (size === 2 && type === 'couple') name = `${members[0].first} et ${members[1].first} ${last}`;
  else if (size === 2) name = `${members[0].first} ${last} & ${members[1].first}`;
  else name = `${members[0].first} ${last}`;
  const traits = [...(a.forcedTraits || [])];
  if (rng.chance(0.65)) {
    const t = rng.pick(Object.keys(TRAITS).filter((k) => k !== 'grincheux' || rng.chance(0.3)));
    if (!traits.includes(t)) traits.push(t);
  }
  const prefs = { ...a.prefs };
  if (traits.includes('sportif')) prefs.hike = (prefs.hike || 0.3) * 1.6;
  if (traits.includes('sociable')) prefs.lounge = (prefs.lounge || 0.4) * 1.4;
  if (traits.includes('noctambule')) prefs.bar = (prefs.bar || 0.4) * 1.5;
  const g = {
    id: state.nextGuestId++, kind: 'guest', type, name, fem: members[0].fem, size, members,
    origin: rng.pick(ORIGINS),
    budget: Math.round(rng.float(a.budget[0], a.budget[1])),
    exigence: rng.float(a.exigence[0], a.exigence[1]),
    nights: rng.int(a.nights[0], a.nights[1]),
    nightsDone: 0, traits, prefs,
    needs: { energy: rng.int(55, 85), hunger: rng.int(35, 75), fun: rng.int(45, 75) },
    satisfaction: 62, thoughts: [], highlights: [],
    roomId: 0, rate: 0, freeNights: 0, spent: 0,
    state: 'arrive', act: null, x: SPOTS.roadStart[0] + 0.5, y: SPOTS.roadStart[1] + 0.5, dir: [0, -1], pose: 'stand', hidden: false,
    timer: 0, wait: 0, arrivedAt: state.time, checkoutHour: rng.float(8.6, 11.3), recent: [], flags: {},
    story: null, vip: null, mood: null,
  };
  if (opts.story) Object.assign(g, opts.story);
  return g;
}

/** Met un groupe sur la route : il remonte le chemin jusqu'à la réception. */
export function spawnParty(state, g) {
  state.guests.push(g);
  state.stats.arrivals++;
  startQueue(state, g, 'in');
  return g;
}

// ---------------------------------------------------------------- Pensées et satisfaction

export function think(g, text, delta = 0, { key } = {}) {
  if (key) { g.flags[key] = true; }
  let d = delta;
  if (g.traits.includes('grincheux')) d = d > 0 ? d * TRAITS.grincheux.pos : d * TRAITS.grincheux.neg;
  g.satisfaction = clamp(g.satisfaction + d, 0, 100);
  const th = { text, d: Math.round(d * 10) / 10 };
  g.thoughts.unshift(th);
  if (g.thoughts.length > 10) g.thoughts.length = 10;
  if (Math.abs(d) >= 3) { g.highlights.push(th); if (g.highlights.length > 24) g.highlights.shift(); }
  g.mood = d > 2 ? 'happy' : d < -2 ? 'angry' : g.mood;
  g.moodT = 40;
}
const once = (g, key) => { if (g.flags[key]) return false; g.flags[key] = true; return true; };

// ---------------------------------------------------------------- Réception

function receptionDesk(state) {
  for (const f of Object.values(state.world.furniture)) {
    if (f.type !== 'desk') continue;
    const room = state.world.rooms[f.roomId];
    if (room && room.type === 'reception') return f;
  }
  return null;
}

/** Cases de file d'attente devant le comptoir (la première est la place du client servi). */
export function queueSlots(state) {
  const desk = receptionDesk(state);
  if (!desk) return [];
  const key = `${state.rt.worldVersion}`;
  if (state.rt.queueKey === key) return state.rt.queueSlots;
  const [cx, cy] = clientSpot(desk);
  const ss = staffSpot(desk);
  const room = desk.roomId;
  const out = [];
  const seen = new Set([idx(cx, cy)]);
  const q = [[cx, cy]];
  while (q.length && out.length < 10) {
    const [x, y] = q.shift();
    if (inb(x, y) && state.rt.walk[idx(x, y)] && !(ss && ss[0] === x && ss[1] === y)) out.push([x, y]);
    for (const [dx, dy] of DIRS4) {
      const nx = x + dx, ny = y + dy;
      if (!inb(nx, ny) || seen.has(idx(nx, ny)) || state.rt.roomAt[idx(nx, ny)] !== room || !state.rt.walk[idx(nx, ny)]) continue;
      if (ss && Math.abs(nx - ss[0]) + Math.abs(ny - ss[1]) === 0) continue;
      // ne pas passer derrière le comptoir
      if (ss && ((desk.rot === 0 && ny < desk.y) || (desk.rot === 2 && ny > desk.y) || (desk.rot === 1 && nx < desk.x) || (desk.rot === 3 && nx > desk.x))) continue;
      seen.add(idx(nx, ny));
      q.push([nx, ny]);
    }
  }
  state.rt.queueKey = key;
  state.rt.queueSlots = out;
  return out;
}

export function startQueue(state, g, mode) {
  releaseAct(state, g);
  g.act = { kind: 'queue', mode, slot: -1 };
  g.state = mode === 'in' ? 'arrive' : 'checkout';
  g.wait = 0;
  g.hidden = false;
  if (!state.reception.queue.includes(g.id)) state.reception.queue.push(g.id);
}

function updateQueue(state, g, dt) {
  const q = state.reception.queue;
  const pos = q.indexOf(g.id);
  const slots = queueSlots(state);
  if (!g.path) g.wait += dt; // la marche depuis la route ne compte pas comme attente
  if (!slots.length) {
    // Pas de réception utilisable : on patiente devant l'entrée puis on renonce.
    if (g.act.mode === 'in' && g.wait > 45) return leaveInn(state, g, 'Pas de réception ouverte', 'quality');
    if (g.act.mode === 'out' && g.wait > 20) return checkOut(state, g);
    return;
  }
  const slot = Math.min(pos, slots.length - 1);
  if (g.act.slot !== slot || (!g.path && (Math.floor(g.x) !== slots[slot][0] || Math.floor(g.y) !== slots[slot][1]))) {
    if (g.act.slot !== slot || !g.path) {
      g.act.slot = slot;
      const [sx, sy] = slots[slot];
      if (!goTo(state, g, { x: sx, y: sy })) {
        g.act.noPath = (g.act.noPath || 0) + dt;
        if (g.act.mode === 'in' && g.act.noPath > 30) return leaveInn(state, g, 'Impossible d\'atteindre la réception', 'quality');
        if (g.act.mode === 'out' && g.act.noPath > 30) return checkOut(state, g);
      }
    }
  }
  if (g.path) { stepAlong(state, g, dt); return; }
  g.pose = 'stand';
  g.dir = [0, -1];
  // Patience
  const a = ARCHETYPES[g.type];
  const limit = (g.act.mode === 'in' ? 110 : 70) * a.patience * (g.story || g.vip ? 1.6 : 1);
  if (g.act.mode === 'in' && g.wait > limit) {
    state.stats.refused.wait++;
    state.reputation.value = clamp(state.reputation.value - 0.6, 0, 100);
    return leaveInn(state, g, 'A perdu patience dans la file d\'attente', 'wait');
  }
  if (pos === 0 && slot === 0) {
    const staff = deskAgent(state);
    if (!staff) return;
    g.act.service = (g.act.service || 0) + dt * staff.eff;
    staff.serving = g.id;
    const need = g.act.mode === 'in' ? 14 : 8;
    if (g.act.service >= need) {
      q.shift();
      staff.serving = 0;
      if (staff.traits && staff.traits.includes('souriant')) think(g, 'Un accueil vraiment souriant.', 2);
      if (g.act.mode === 'in') checkIn(state, g, staff); else checkOut(state, g);
    }
  }
}

// ---------------------------------------------------------------- Choix de chambre

export function maxPayFor(g, standing) {
  let m = g.budget * (1 + 0.38 * standing);
  if (g.traits.includes('econome')) m *= 0.85;
  if (standing > ARCHETYPES[g.type].wants) m *= 1.06;
  return m;
}

export function chooseRoom(state, g) {
  const occupied = new Set(state.guests.filter((o) => o.roomId && o.id !== g.id).map((o) => o.roomId));
  let best = null, sawCap = false, sawPrice = false, sawQuality = false;
  const wants = ARCHETYPES[g.type].wants;
  for (const room of Object.values(state.world.rooms)) {
    if (room.type !== 'bedroom' || occupied.has(room.id)) continue;
    const st = state.rt.roomStats[room.id];
    if (!st || !st.reachable || st.capacity < g.size) continue;
    sawCap = true;
    if (st.standing < wants - 1) { sawQuality = true; continue; }
    const price = state.prices.rooms[st.standing];
    const free = g.freeStay;
    if (!free && price > maxPayFor(g, st.standing)) { sawPrice = true; continue; }
    const u = st.points / 45 + st.standing * 0.5 + (st.standing >= wants ? 0.6 : 0) - (free ? 0 : price / g.budget) * 0.8 + room.clean / 250 - (st.capacity - g.size) * 0.15;
    if (!best || u > best.u) best = { room, st, price: free ? 0 : price, u };
  }
  if (best) return best;
  return { reason: !sawCap ? 'full' : sawPrice ? 'price' : sawQuality ? 'quality' : 'full' };
}

const REFUSE_TEXT = { full: 'Complet : aucune chambre adaptée de libre', price: 'Trouve les chambres trop chères', quality: 'Trouve les chambres trop modestes' };

function checkIn(state, g, staff) {
  const c = clock(state.time);
  const choice = chooseRoom(state, g);
  if (!choice.room) {
    state.stats.refused[choice.reason]++;
    notify(state, { kind: 'refuse', text: `${g.name} repart : ${REFUSE_TEXT[choice.reason].toLowerCase()}.`, gid: g.id, reason: choice.reason, log: true });
    if (g.story) onStoryRefused(state, g);
    return leaveInn(state, g, REFUSE_TEXT[choice.reason], choice.reason, true);
  }
  const { room, st, price } = choice;
  g.roomId = room.id;
  g.rate = price;
  g.standing = st.standing;
  g.checkInDay = c.day;
  g.checkinTime = state.time;
  state.stats.served += g.size;
  // Première impression : accueil, décor, jardin.
  const recSt = Object.values(state.world.rooms).find((r) => r.type === 'reception');
  const recDecor = recSt ? state.rt.roomStats[recSt.id].decorDensity : 0;
  const impression = clamp((recDecor - 0.4) * 8 + Math.min(6, state.rt.agg.gardenDecor) * 0.8 - 1, -6, 8);
  if (impression > 2) think(g, 'Quelle charmante auberge !', impression);
  else if (impression < -2) think(g, 'L\'accueil manque un peu de charme.', impression);
  // Attente
  if (g.wait > 35) think(g, 'J\'ai attendu longtemps à la réception.', -Math.min(14, (g.wait - 35) / 5));
  else if (g.wait < 12) think(g, 'Enregistrement rapide et efficace.', 2);
  // Chambre
  const wants = ARCHETYPES[g.type].wants;
  if (st.standing < wants) think(g, 'La chambre est plus modeste que ce que j\'espérais.', -6);
  const q = st.points / 55;
  const exig = g.exigence * (g.traits.includes('esthete') ? 1.1 : 1);
  const dq = (q - exig) * 16;
  if (dq > 3) think(g, st.standing === 2 ? 'Une suite somptueuse !' : 'La chambre est très agréable.', Math.min(12, dq));
  else if (dq < -3) think(g, 'La chambre est un peu spartiate.', Math.max(-12, dq));
  if (room.clean < 55) think(g, 'La chambre n\'avait pas été bien nettoyée.', -10);
  if (st.capacity > g.size + 1) think(g, 'Une chambre spacieuse pour nous.', 1);
  notify(state, { kind: 'checkin', text: `${g.name} s'installe en chambre ${room.num} (${STANDING_NAMES[st.standing]}, ${price} écus/nuit).`, gid: g.id, log: true });
  if (g.story) onStoryCheckIn(state, g);
  g.state = 'stay';
  // Dépose des bagages en chambre.
  startRest(state, g, 12);
}

// ---------------------------------------------------------------- Départ et avis

const OPENERS = {
  5: ['Un séjour merveilleux !', 'Coup de cœur absolu.', 'Une adresse exceptionnelle.', 'Tout était parfait.'],
  4: ['Très bon séjour.', 'Une belle découverte.', 'Nous reviendrons avec plaisir.', 'Excellent accueil.'],
  3: ['Séjour correct.', 'Pas mal, sans plus.', 'Une auberge honnête.', 'Quelques points à améliorer.'],
  2: ['Séjour décevant.', 'Peut mieux faire.', 'Pas vraiment à la hauteur.'],
  1: ['À éviter.', 'Très déçu.', 'Une expérience à oublier.'],
};
export function starsFor(s) { return s >= 86 ? 5 : s >= 68 ? 4 : s >= 48 ? 3 : s >= 28 ? 2 : 1; }

export function makeReview(state, g) {
  const rng = getRng(state);
  const stars = starsFor(g.satisfaction);
  const pos = g.highlights.filter((t) => t.d > 0).sort((a, b) => b.d - a.d)[0];
  const neg = g.highlights.filter((t) => t.d < 0).sort((a, b) => a.d - b.d)[0];
  let text = rng.pick(OPENERS[stars]);
  if (pos && stars >= 3) text += ' ' + pos.text;
  if (neg && stars <= 4) text += ' ' + (stars >= 3 ? 'Seul bémol : ' + neg.text.charAt(0).toLowerCase() + neg.text.slice(1) : neg.text);
  else if (pos && stars < 3) text += ' ' + pos.text;
  const a = ARCHETYPES[g.type];
  return {
    stars, text, name: g.name, type: g.size === 1 && g.fem ? a.fem : a.name, day: clock(state.time).day,
    origin: g.origin, vip: g.vip || null,
  };
}

export function applyReview(state, review) {
  const score = review.stars * 20 - 8;
  const rep = state.reputation;
  rep.value = clamp(rep.value + (score - rep.value) * 0.11, 0, 100);
  rep.reviews.unshift(review);
  if (rep.reviews.length > 40) rep.reviews.length = 40;
  state.stats.reviews++;
}

function checkOut(state, g) {
  const rng = getRng(state);
  const nights = Math.max(1, g.nightsDone);
  const billed = Math.max(0, nights - (g.freeNights || 0));
  const roomTotal = g.freeStay ? 0 : billed * g.rate;
  if (roomTotal > 0) { earn(state, roomTotal, 'rooms'); g.spent += roomTotal; }
  // Rapport qualité-prix
  if (!g.freeStay && g.rate > 0) {
    const r = g.rate / maxPayFor(g, g.standing || 0);
    const pm = g.traits.includes('econome') ? 1.5 : 1;
    if (r < 0.72) think(g, 'Un excellent rapport qualité-prix.', 5 * pm);
    else if (r > 0.95) think(g, 'C\'était un peu cher pour ce que c\'est.', -6 * pm);
  }
  if (g.satisfaction >= 75 && rng.chance(0.55)) {
    const tip = Math.round((g.rate || 20) * rng.float(0.08, 0.2) * (g.traits.includes('genereux') ? 2.5 : 1) * g.size ** 0.5);
    if (tip > 0) { earn(state, tip, 'tips'); g.tip = tip; }
  }
  const review = makeReview(state, g);
  applyReview(state, review);
  if (g.vip) onVipCheckOut(state, g, review);
  if (g.story) onStoryCheckOut(state, g, review);
  notify(state, { kind: 'review', text: `${'★'.repeat(review.stars)}${'☆'.repeat(5 - review.stars)} ${g.name} : « ${review.text} »`, review, gid: g.id, log: true });
  // Bouche-à-oreille
  if (g.satisfaction >= 84 && rng.chance(0.35)) {
    state.schedule.push({ t: state.time + rng.int(18, 60) * 60, type: g.type, word: true });
    notify(state, { kind: 'good', text: `${g.name} recommande l'auberge à ses proches !`, log: true });
  }
  const room = state.world.rooms[g.roomId];
  if (room) room.clean = Math.max(0, room.clean - 12);
  g.roomId = 0;
  leaveInn(state, g, null);
}

/** Le groupe quitte l'auberge à pied jusqu'à la route. */
export function leaveInn(state, g, reason, refuseKind = null, silent = false) {
  releaseAct(state, g);
  const qi = state.reception.queue.indexOf(g.id);
  if (qi >= 0) state.reception.queue.splice(qi, 1);
  if (g.roomId) {
    // Départ forcé avant la fin : on facture les nuits passées.
    if (g.nightsDone > 0 && !g.freeStay) earn(state, g.nightsDone * g.rate, 'rooms');
    g.roomId = 0;
  }
  if (reason && !silent && refuseKind) notify(state, { kind: 'refuse', text: `${g.name} : ${reason.toLowerCase()}.`, gid: g.id, log: true });
  g.state = 'leave';
  g.act = { kind: 'leave' };
  g.leaveReason = reason;
  g.hidden = false;
  g.pose = 'stand';
  const [rx, ry] = SPOTS.roadStart;
  if (!goTo(state, g, { x: rx, y: ry })) g.gone = true;
}

// ---------------------------------------------------------------- Activités

/** Si l'agent est « dans » un objet bloquant (lit, bain), on le ramène sur sa case d'accès. */
function unsnap(state, g) {
  if (!g.anchor) return;
  const [x, y] = tileOf(g);
  if (!state.rt.walk[idx(x, y)]) placeAt(g, g.anchor[0], g.anchor[1]);
  g.anchor = null;
}
function snapTo(g, x, y) {
  g.anchor = tileOf(g);
  placeAt(g, x, y);
}

function releaseAct(state, g) {
  unsnap(state, g);
  if (g.act && g.act.keys) for (const k of g.act.keys) if (state.rt.reserved.get(k) === g.id) state.rt.reserved.delete(k);
  if (g.act && (g.act.kind === 'dine' || g.act.kind === 'bar')) cancelOrdersOf(state, g.id);
  g.memberSpots = null;
  g.act = null;
}
function reserve(state, g, keys) {
  for (const k of keys) state.rt.reserved.set(k, g.id);
  g.act.keys = keys;
}
const isFree = (state, key) => !state.rt.reserved.has(key);

/** Reconstruit les réservations après chargement. */
export function rebuildReservations(state) {
  state.rt.reserved = new Map();
  for (const g of state.guests) if (g.act && g.act.keys) for (const k of g.act.keys) state.rt.reserved.set(k, g.id);
}

function startRest(state, g, minutes) {
  releaseAct(state, g);
  const room = state.world.rooms[g.roomId];
  if (!room) { g.act = null; return; }
  const rng = getRng(state);
  const tiles = room.tiles.filter((i) => state.rt.walk[i]);
  const i = tiles.length ? rng.pick(tiles) : room.tiles[0];
  g.goalRoom = room.id;
  g.act = { kind: 'rest', phase: 'walk', dur: minutes };
  if (!goTo(state, g, { x: i % state.world.w, y: Math.floor(i / state.world.w) })) { g.act = null; g.restFail = state.time; }
}

function startSleep(state, g) {
  releaseAct(state, g);
  const beds = Object.values(state.world.furniture).filter((f) => f.roomId === g.roomId && FURNITURE[f.type].capacity);
  g.goalRoom = g.roomId;
  if (!beds.length) {
    g.act = { kind: 'sleep', phase: 'walk', noBed: true };
    const room = state.world.rooms[g.roomId];
    const i = room.tiles.find((t) => state.rt.walk[t]) ?? room.tiles[0];
    if (!goTo(state, g, { x: i % state.world.w, y: Math.floor(i / state.world.w) })) return sleepFail(state, g);
    return;
  }
  beds.sort((a, b) => FURNITURE[b.type].comfort - FURNITURE[a.type].comfort);
  const bed = beds[0];
  g.act = { kind: 'sleep', phase: 'walk', furnId: bed.id };
  const spots = furnSpots(bed);
  if (!goTo(state, g, { cells: spots[0].cells || [[spots[0].x, spots[0].y]] })) return sleepFail(state, g);
}

function sleepFail(state, g) {
  g.act = null;
  if (once(g, 'noaccess')) think(g, 'Impossible d\'accéder à notre chambre !', -25);
  if (!g.flags.noaccessLeft && g.satisfaction < 30) { g.flags.noaccessLeft = true; return leaveInn(state, g, 'Chambre inaccessible', 'quality'); }
  // dort dans la salle commune faute de mieux
  g.act = { kind: 'sleep', phase: 'sleep', floor: true };
  g.pose = 'stand';
}

/** Positions des membres du groupe autour d'un emplacement. */
function setMemberSpots(g, spots) {
  g.memberSpots = g.members.map((m, k) => spots[k] || spots[spots.length - 1] && { ...spots[spots.length - 1], pose: 'stand', extra: k });
}

function startUse(state, g, u, spotList) {
  releaseAct(state, g);
  const f = state.world.furniture[u.furnId];
  const def = FURNITURE[f.type];
  const rng = getRng(state);
  const kd = USE_KINDS[u.kind];
  const keys = spotList.map((s) => `${f.id}:${s.k}`);
  g.goalRoom = f.roomId || 0;
  g.act = { kind: 'use', phase: 'walk', furnId: f.id, use: u.kind, roomType: u.roomType, spots: spotList, dur: rng.int(kd.dur[0], kd.dur[1]) };
  reserve(state, g, keys);
  const s = spotList[0];
  const ok = s.block ? goTo(state, g, { cells: s.cells }) : goTo(state, g, { x: s.x, y: s.y });
  if (!ok) { releaseAct(state, g); g.failUse = g.failUse || {}; g.failUse[f.id] = state.time; return false; }
  if (def.use.price) {
    const price = state.prices.services[def.use.price] * Math.min(g.size, spotList.length || 1);
    g.act.price = price;
  }
  return true;
}

function freeSpotsOf(state, g, f) {
  const def = FURNITURE[f.type];
  const spots = furnSpots(f).filter((s) => isFree(state, `${f.id}:${s.k}`));
  if (def.kids && !g.members.some((m) => m.kid) && f.type === 'swing' && getRng(state).chance(0.6)) return [];
  return spots;
}

function canReach(state, g, s) {
  const rt = state.rt;
  if (s.block) return s.cells.some(([cx, cy]) => DIRS4.some(([dx, dy]) => inb(cx + dx, cy + dy) && rt.guestReach[idx(cx + dx, cy + dy)]));
  const i = idx(s.x, s.y);
  if (rt.guestReach[i]) return true;
  // seat in own bedroom
  return g.roomId && rt.roomAt[i] === g.roomId;
}

function hasKids(g) { return g.members.some((m) => m.kid); }

function scoreUsables(state, g, c, weather, opts) {
  const rt = state.rt;
  const rng = getRng(state);
  const fun = (100 - g.needs.fun) / 50, tired = (100 - g.needs.energy) / 100;
  const night = c.hf >= 21 || c.hf < 7;
  const [gx, gy] = tileOf(g);
  for (const u of rt.usables) {
    const f = state.world.furniture[u.furnId];
    if (!f) continue;
    const def = FURNITURE[f.type];
    const room = f.roomId ? state.world.rooms[f.roomId] : null;
    if (room && !ROOM_TYPES[room.type].public && room.id !== g.roomId) continue;
    if (g.failUse && g.failUse[f.id] && state.time - g.failUse[f.id] < 120) continue;
    let s;
    switch (u.kind) {
      case 'relax': s = fun * 0.8 + tired * 1.2; break;
      case 'read': s = fun * 0.9; break;
      case 'fun': s = fun * 1.1 * (g.needs.energy > 25 ? 1 : 0.3); break;
      case 'music': s = fun * 0.8; break;
      case 'view': s = fun; break;
      case 'spa': s = (fun + tired) * 1.2; if (state.prices.services.spa > g.budget * 0.35) s *= 0.4; break;
      case 'shop': s = g.flags.shopped ? 0.05 : 0.7; if (state.stock.souvenirs <= 0) s = 0; break;
      case 'excursion': s = 0; break;
      default: s = 0.3;
    }
    if (s <= 0) continue;
    const pref = g.prefs[u.roomType] ?? 0.3;
    s *= 0.25 + pref;
    const outdoor = !room || !ROOM_TYPES[room.type].indoor || (def.use && def.use.outdoor);
    if (outdoor) { s *= weather.outdoor; if (night) s *= 0.15; if (c.seasonIndex === 3 && f.type !== 'hot_tub') s *= 0.6; }
    if (def.use.sunny && !(state.weather.today === 'soleil' && (c.seasonIndex === 1 || c.seasonIndex === 0))) continue;
    if (def.kids) s *= hasKids(g) ? 1.8 : 0.3;
    if (def.warmth || f.type === 'armchair' || f.type === 'sofa') {
      const warm = room ? rt.roomStats[room.id].warmth : 0;
      if (warm && (c.seasonIndex === 3 || c.seasonIndex === 2)) s *= g.traits.includes('frileux') ? 1.8 : 1.3;
    }
    if (g.recent.includes(f.type)) s *= 0.45;
    const d = Math.abs(f.x - gx) + Math.abs(f.y - gy);
    s *= 1 / (1 + d / 28);
    if (s < 0.05) continue;
    const spots = freeSpotsOf(state, g, f).filter((sp) => canReach(state, g, sp));
    if (!spots.length) continue;
    const need = def.use.kind === 'spa' || u.kind === 'fun' || def.seat ? Math.min(g.size, spots.length) : 1;
    opts.push({ kind: 'use', u, spots: spots.slice(0, need), score: s * rng.float(0.8, 1.2) });
  }
  // Tables de jeux (chaises autour d'une table de jeux)
}

function pickDiningSeats(state, g, roomTypes) {
  const rt = state.rt;
  const byTable = new Map();
  for (const s of rt.diningSeats) {
    const room = state.world.rooms[s.roomId];
    if (!room || !roomTypes.includes(room.type)) continue;
    if (!isFree(state, `${s.furnId}:0`)) continue;
    if (!rt.guestReach[idx(s.x, s.y)]) continue;
    if (!byTable.has(s.tableId)) byTable.set(s.tableId, []);
    byTable.get(s.tableId).push(s);
  }
  let best = null;
  for (const seats of byTable.values()) {
    if (seats.length < Math.min(g.size, 2) && seats.length < g.size) continue;
    const fit = Math.abs(seats.length - g.size);
    if (!best || fit < best.fit) best = { seats: seats.slice(0, g.size), fit };
  }
  return best ? best.seats : null;
}

function startDine(state, g, terrace) {
  const types = terrace ? ['terrace'] : ['restaurant', 'bar', 'lounge'];
  const seats = pickDiningSeats(state, g, types);
  if (!seats) return false;
  releaseAct(state, g);
  const c = clock(state.time);
  g.goalRoom = 0;
  g.act = { kind: 'dine', phase: 'walk', seats: seats.map((s) => ({ furnId: s.furnId, x: s.x, y: s.y, face: s.face, k: 0, pose: 'sit' })), tableId: seats[0].tableId, breakfast: c.hf < 10.5, terrace };
  reserve(state, g, seats.map((s) => `${s.furnId}:0`));
  if (!goTo(state, g, { x: seats[0].x, y: seats[0].y })) { releaseAct(state, g); return false; }
  return true;
}

function startBar(state, g) {
  const rt = state.rt;
  const free = rt.barSeats.filter((s) => isFree(state, `${s.furnId}:${s.spot || 0}`) && rt.guestReach[idx(s.x, s.y)]);
  if (!free.length) return false;
  const rng = getRng(state);
  const first = rng.pick(free);
  const seats = [first, ...free.filter((s) => s !== first && Math.abs(s.x - first.x) + Math.abs(s.y - first.y) <= 2)].slice(0, g.size);
  releaseAct(state, g);
  g.goalRoom = 0;
  g.act = { kind: 'bar', phase: 'walk', seats: seats.map((s) => ({ furnId: s.furnId, x: s.x, y: s.y, face: s.face, k: s.spot || 0, pose: 'sit' })) };
  reserve(state, g, seats.map((s) => `${s.furnId}:${s.spot || 0}`));
  if (!goTo(state, g, { x: first.x, y: first.y })) { releaseAct(state, g); return false; }
  return true;
}

function startAway(state, g, kind, minutes) {
  releaseAct(state, g);
  g.goalRoom = 0;
  const dest = kind === 'hike' ? SPOTS.trailEnd : SPOTS.roadStart;
  g.act = { kind, phase: 'walk', away: minutes };
  if (!goTo(state, g, { x: dest[0], y: dest[1] })) { g.act = null; return false; }
  return true;
}

const WANDER_SPOTS = [[32, 24], [30, 24], [27, 24], [20, 26], [19, 27], [28, 20], [28, 28], [26, 30], [16, 30], [23, 12]];
function startWander(state, g) {
  const rng = getRng(state);
  const spots = WANDER_SPOTS.filter(([x, y]) => state.rt.walk[idx(x, y)] && state.rt.guestReach[idx(x, y)]);
  if (!spots.length) return false;
  const [x, y] = rng.pick(spots);
  releaseAct(state, g);
  g.goalRoom = 0;
  g.act = { kind: 'wander', phase: 'walk', dur: rng.int(15, 30) };
  return goTo(state, g, { x: x + rng.int(-1, 1), y }) || goTo(state, g, { x, y });
}

function startExcursion(state, g) {
  const desk = Object.values(state.world.furniture).find((f) => f.type === 'guide_desk');
  if (!desk) return false;
  const spots = furnSpots(desk).filter((s) => isFree(state, `${desk.id}:${s.k}`));
  if (!spots.length) return false;
  releaseAct(state, g);
  g.goalRoom = 0;
  g.act = { kind: 'excursion', phase: 'walk', furnId: desk.id };
  reserve(state, g, [`${desk.id}:${spots[0].k}`]);
  if (!goTo(state, g, { x: spots[0].x, y: spots[0].y })) { releaseAct(state, g); return false; }
  return true;
}

/** Choix de la prochaine activité (IA par utilité). */
export function decide(state, g) {
  const c = clock(state.time);
  const h = c.hf;
  const rng = getRng(state);
  const weather = WEATHER[state.weather.today] || WEATHER.soleil;
  unsnap(state, g);
  // Départ
  if (g.roomId && g.nightsDone >= g.nights && h >= g.checkoutHour && h < 20) {
    if (state.events.modifiers.some((m) => m.extend && m.until >= c.day)) {
      if (once(g, 'ext' + c.day)) { g.nights++; think(g, 'La route est bloquée, nous restons une nuit de plus.', 1); }
    } else return startQueue(state, g, 'out');
  }
  // Sommeil
  const bedtime = g.traits.includes('noctambule') ? 23.6 : g.traits.includes('leve_tot') ? 21.2 : 22 + (g.id % 5) * 0.2;
  if (g.roomId && (h >= bedtime || h < 5.5 || g.needs.energy < 10)) return startSleep(state, g);
  const opts = [];
  // Repas
  const mealTime = (h >= 7 && h < 10) || (h >= 12 && h < 14) || (h >= 19 && h < 21.5);
  const hungry = 100 - g.needs.hunger;
  if (g.needs.hunger < 58 || (mealTime && g.needs.hunger < 82)) {
    const rs = restaurantStatus(state);
    if (rs.open) {
      const terraceOk = weather.outdoor > 0.6 && h >= 11 && h < 20.5 && c.seasonIndex !== 3 && state.rt.diningSeats.some((s) => state.world.rooms[s.roomId]?.type === 'terrace');
      opts.push({ kind: 'dine', terrace: terraceOk && rng.chance(0.65), score: (hungry / 40) * (0.4 + (g.prefs.restaurant || 0.5)) * (mealTime ? 1.9 : 0.8) * (g.traits.includes('gourmand') ? 1.3 : 1) });
    } else if (g.needs.hunger < 35) {
      opts.push({ kind: 'outing', score: hungry / 45 });
      if (once(g, 'nofood')) think(g, rs.reason === 'none' ? 'Pas de restaurant à l\'auberge, il faut descendre au village.' : 'Le restaurant était fermé quand j\'avais faim.', -4);
    }
  }
  // Bar
  if (h >= 15 && h < 23.5 && barStatus(state).open) {
    const s = (0.3 + (g.prefs.bar || 0.3)) * ((100 - g.needs.fun) / 60 + 0.3) * (h >= 18 ? 1.5 : 0.6) * (g.members.some((m) => m.kid) ? 0.3 : 1);
    opts.push({ kind: 'bar', score: s });
  }
  // Randonnée
  if (h >= 7.5 && h < 14 && weather.hike > 0 && g.needs.energy > 45 && !g.flags['hike' + c.day] && (g.prefs.hike || 0) > 0.3) {
    opts.push({ kind: 'hike', score: (g.prefs.hike || 0) * weather.hike * 1.5 * (c.seasonIndex === 3 ? 0.7 : 1) });
  }
  // Excursion guidée
  if (h >= 8 && h < 12 && weather.hike > 0.2 && guideAvailable(state) && !g.flags['exc' + c.day] && g.spent < g.budget * 4 && (g.prefs.guides || g.prefs.hike)) {
    opts.push({ kind: 'excursion', score: ((g.prefs.guides || 0) + (g.prefs.hike || 0) * 0.5) * weather.hike * 1.3 });
  }
  scoreUsables(state, g, c, weather, opts);
  // Repos en chambre
  if (g.roomId && (!g.restFail || state.time - g.restFail > 180)) opts.push({ kind: 'rest', score: 0.15 + (100 - g.needs.energy) / 90 });
  // Promenade
  if (h > 7 && h < 20.5) opts.push({ kind: 'wander', score: 0.25 * weather.outdoor + 0.05 });
  if (!opts.length) return startRest(state, g, 30);
  opts.sort((a, b) => b.score - a.score);
  const top = opts.slice(0, 4);
  const pick = rng.weighted(top.map((o) => [o, o.score * o.score]));
  let ok = false;
  switch (pick.kind) {
    case 'dine':
      ok = startDine(state, g, pick.terrace) || startDine(state, g, false);
      if (!ok && g.needs.hunger < 40) {
        if (once(g, 'fullresto' + c.day)) think(g, 'Le restaurant était complet, il a fallu descendre au village.', -3);
        ok = startAway(state, g, 'outing', rng.int(80, 120));
      }
      break;
    case 'outing': ok = startAway(state, g, 'outing', rng.int(80, 120)); break;
    case 'bar': ok = startBar(state, g); break;
    case 'hike': ok = startAway(state, g, 'hike', rng.int(140, 280) * (g.type === 'adventurer' ? 1.3 : 1)); g.flags['hike' + c.day] = true; break;
    case 'excursion': ok = startExcursion(state, g); g.flags['exc' + c.day] = true; break;
    case 'use': ok = startUse(state, g, pick.u, pick.spots); break;
    case 'rest': startRest(state, g, rng.int(25, 50)); ok = !!g.act; break;
    case 'wander': ok = startWander(state, g); break;
  }
  if (!ok) { g.idleT = 10; if (!g.act) startRest(state, g, 20); }
}

// ---------------------------------------------------------------- Mise à jour

function decayNeeds(g, dt, awake = true) {
  const n = g.needs;
  if (awake) {
    n.energy = clamp(n.energy - 0.06 * dt, 0, 100);
    n.hunger = clamp(n.hunger - 0.085 * dt * (g.traits.includes('gourmand') ? 1.25 : 1), 0, 100);
    n.fun = clamp(n.fun - 0.05 * dt, 0, 100);
  } else {
    n.hunger = clamp(n.hunger - 0.02 * dt, 0, 100);
  }
  if (n.hunger < 12) { g.satisfaction = clamp(g.satisfaction - 0.015 * dt, 0, 100); if (once(g, 'starving')) think(g, 'J\'ai l\'estomac dans les talons…', -3); }
  if (n.fun < 12 && awake) { g.satisfaction = clamp(g.satisfaction - 0.01 * dt, 0, 100); if (once(g, 'bored')) think(g, 'On s\'ennuie un peu ici.', -2); }
  if (n.energy < 8 && awake) g.satisfaction = clamp(g.satisfaction - 0.01 * dt, 0, 100);
}

function arriveAway(state, g) {
  // L'agent atteint le bord de la carte : il disparaît pour la durée de l'activité.
  g.hidden = true;
  g.act.phase = 'away';
  g.act.until = state.time + g.act.away;
  const c = clock(state.time);
  const cap = (c.day - 1) * 1440 + 19.5 * 60;
  if (g.act.kind === 'hike' && g.act.until > cap) g.act.until = Math.max(state.time + 60, cap);
}

function returnFromAway(state, g) {
  const rng = getRng(state);
  const k = g.act.kind;
  g.hidden = false;
  const dest = k === 'hike' || k === 'excursionAway' ? SPOTS.trailEnd : SPOTS.roadStart;
  placeAt(g, dest[0], dest[1]);
  if (k === 'hike') {
    const weather = WEATHER[state.weather.today] || WEATHER.soleil;
    let d = (3 + 4 * weather.hike) * (0.6 + (g.prefs.hike || 0.5) * 0.5);
    if (state.flags.chamois) d *= 1.25;
    if (state.flags.waterfall) d *= 1.2;
    const lines = state.flags.waterfall
      ? ['La cascade cachée est à couper le souffle !', 'Superbe randonnée jusqu\'à la cascade.']
      : ['Superbe randonnée, quelle vue sur les sommets !', 'Belle balade en forêt.', 'Nous avons aperçu des chamois !', 'Le sentier du lac est magnifique.'];
    think(g, rng.pick(lines), d);
    g.needs.fun = clamp(g.needs.fun + 45, 0, 100);
    g.needs.energy = clamp(g.needs.energy - 30, 0, 100);
    g.needs.hunger = clamp(g.needs.hunger - 25, 0, 100);
  } else if (k === 'outing') {
    g.needs.hunger = clamp(g.needs.hunger + 60, 0, 100);
    g.needs.fun = clamp(g.needs.fun + 10, 0, 100);
  }
  g.act = null;
  g.state = 'stay';
}

function finishUse(state, g) {
  const f = state.world.furniture[g.act.furnId];
  const a = g.act;
  if (f) {
    const def = FURNITURE[f.type];
    const room = f.roomId ? state.world.rooms[f.roomId] : null;
    const st = room ? state.rt.roomStats[room.id] : null;
    const pref = g.prefs[a.roomType] ?? 0.4;
    const decorBonus = st ? clamp(st.decorDensity - 0.5, -0.5, 1.5) * 2 * (g.traits.includes('esthete') ? 1.6 : 1) : 0.5;
    const d = 1 + pref * 2.5 + decorBonus;
    const LINES = {
      relax: ['Un vrai moment de détente.', 'On est bien installé ici.', 'Quel calme, c\'est reposant.'],
      read: ['J\'ai trouvé un excellent livre.', 'Belle bibliothèque !'],
      fun: ['On s\'est bien amusés !', 'Partie endiablée !', 'Les enfants ont adoré.'],
      music: ['Un air de piano au coin du feu, magique.'],
      view: ['Une vue imprenable sur les montagnes.', 'Le panorama est sublime.'],
      spa: ['Le spa est divin.', 'Je me sens comme neuf après le spa.'],
      shop: ['J\'ai trouvé de jolis souvenirs.'],
    };
    const lines = LINES[a.use] || LINES.relax;
    if (room && room.clean < 40) think(g, `${ROOM_TYPES[room.type].name} n'était pas très propre.`, -4);
    else if (getRng(state).chance(0.6)) think(g, getRng(state).pick(lines), d);
    else g.satisfaction = clamp(g.satisfaction + d * 0.6, 0, 100);
    if (room && ROOM_TYPES[room.type].indoor) room.clean = Math.max(0, room.clean - 1.2 * g.size);
    g.recent.unshift(f.type); if (g.recent.length > 3) g.recent.pop();
  }
  g.act = null;
}

function beginUse(state, g) {
  const a = g.act;
  const f = state.world.furniture[a.furnId];
  if (!f) { releaseAct(state, g); return; }
  const s = a.spots[0];
  if (s.block) snapTo(g, s.x, s.y); else placeAt(g, s.x, s.y);
  g.pose = s.pose; g.dir = s.face;
  setMemberSpots(g, a.spots.map((sp) => ({ x: sp.x + 0.5, y: sp.y + 0.5, pose: sp.pose, face: sp.face, z: sp.z })));
  a.phase = 'using';
  a.t = 0;
  if (a.use === 'shop') {
    const rng = getRng(state);
    const def = FURNITURE[f.type];
    const n = Math.min(state.stock.souvenirs, def.use.small ? 1 : rng.int(1, Math.min(3, g.size + 1)));
    if (n <= 0) { think(g, 'Plus rien en rayon à la boutique…', -3); a.dur = 5; return; }
    const price = Math.round(state.prices.services.souvenir * n * (def.use.small ? 0.4 : 1));
    if (price > g.budget * 0.8) { a.dur = 6; return; }
    state.stock.souvenirs -= n;
    earn(state, price, 'shop'); g.spent += price; g.flags.shopped = true;
    g.bubble = 'coin';
  } else if (a.price) {
    if (a.price > g.budget * 1.2) { think(g, 'Le spa est bien trop cher.', -4); releaseAct(state, g); return; }
    earn(state, a.price, 'activities'); g.spent += a.price; g.bubble = 'coin';
  }
}

/** Mise à jour d'un groupe de clients sur dt minutes. */
export function updateGuest(state, g, dt) {
  if (g.gone) return;
  if (g.moodT > 0) { g.moodT -= dt; if (g.moodT <= 0) g.mood = null; }
  if (g.bubbleT === undefined && g.bubble) g.bubbleT = 30;
  if (g.bubble) { g.bubbleT -= dt; if (g.bubbleT <= 0) { g.bubble = null; g.bubbleT = undefined; } }
  const a = g.act;
  // File d'attente / départ
  if (a && a.kind === 'queue') { decayNeeds(g, dt); return updateQueue(state, g, dt); }
  if (a && a.kind === 'leave') {
    const r = stepAlong(state, g, dt);
    if (r !== 'moving') g.gone = true;
    return;
  }
  if (g.state === 'arrive') { startQueue(state, g, 'in'); return; }
  const sleeping = a && a.kind === 'sleep' && a.phase === 'sleep';
  if (!(a && a.phase === 'away')) decayNeeds(g, dt, !sleeping);
  if (!a) {
    g.pose = 'stand';
    if (g.idleT > 0) { g.idleT -= dt; return; }
    return decide(state, g);
  }
  // Déplacement vers l'activité
  if (a.phase === 'walk') {
    const r = stepAlong(state, g, dt);
    if (r === 'stuck') { releaseAct(state, g); g.idleT = 5; return; }
    if (r === 'moving') { g.pose = 'walk'; return; }
    return arrived(state, g);
  }
  switch (a.kind) {
    case 'use': return tickUse(state, g, dt);
    case 'rest': {
      a.dur -= dt;
      g.needs.energy = clamp(g.needs.energy + 0.25 * dt, 0, 100);
      if (a.dur <= 0) g.act = null;
      return;
    }
    case 'sleep': return tickSleep(state, g, dt);
    case 'dine': case 'bar': return tickMeal(state, g, dt);
    case 'hike': case 'outing': {
      if (a.phase === 'away' && state.time >= a.until) returnFromAway(state, g);
      else if (a.phase === 'away') { g.needs.energy = clamp(g.needs.energy - 0.03 * dt, 0, 100); }
      return;
    }
    case 'excursion': return tickExcursion(state, g, dt);
    case 'wander': {
      a.dur -= dt; g.pose = 'stand';
      g.needs.fun = clamp(g.needs.fun + 0.35 * dt, 0, 100);
      if (a.dur <= 0) {
        if (getRng(state).chance(0.35)) think(g, getRng(state).pick(['Quelle belle promenade au bord du lac.', 'L\'air de la montagne fait du bien.', 'Le paysage est splendide.']), 2);
        g.act = null;
      }
      return;
    }
    default: g.act = null;
  }
}

function arrived(state, g) {
  const a = g.act;
  switch (a.kind) {
    case 'use': return beginUse(state, g);
    case 'rest': a.phase = 'rest'; g.pose = 'stand'; return;
    case 'sleep': {
      a.phase = 'sleep';
      const bed = state.world.furniture[a.furnId];
      a.startDay = clock(state.time).day;
      a.startHf = clock(state.time).hf;
      if (bed) {
        const spots = furnSpots(bed);
        snapTo(g, spots[0].x, spots[0].y);
        g.pose = 'lie'; g.dir = spots[0].face;
        setMemberSpots(g, spots.map((s) => ({ x: s.x + 0.5, y: s.y + 0.5, pose: 'lie', face: s.face, z: s.z })));
      } else { g.pose = 'stand'; }
      return;
    }
    case 'dine': case 'bar': {
      const s0 = a.seats[0];
      placeAt(g, s0.x, s0.y);
      g.pose = 'sit'; g.dir = s0.face;
      setMemberSpots(g, a.seats.map((s) => ({ x: s.x + 0.5, y: s.y + 0.5, pose: 'sit', face: s.face })));
      a.phase = 'wait'; a.wait = 0;
      if (a.kind === 'dine') placeMealOrder(state, g); else placeDrinkOrder(state, g);
      return;
    }
    case 'hike': case 'outing': return arriveAway(state, g);
    case 'excursion': {
      a.phase = 'book';
      a.t = 0;
      g.pose = 'stand';
      return;
    }
    case 'wander': a.phase = 'stay'; return;
    default: g.act = null;
  }
}

function tickUse(state, g, dt) {
  const a = g.act;
  const kd = USE_KINDS[a.use];
  a.t += dt;
  g.needs.fun = clamp(g.needs.fun + kd.fun * dt, 0, 100);
  g.needs.energy = clamp(g.needs.energy + kd.energy * dt, 0, 100);
  if (a.use === 'music') g.music = true;
  if (a.t >= a.dur) { g.music = false; finishUse(state, g); releaseAct(state, g); }
}

function tickSleep(state, g, dt) {
  const a = g.act;
  const c = clock(state.time);
  g.pose = a.floor ? 'stand' : 'lie';
  g.needs.energy = clamp(g.needs.energy + 0.24 * dt, 0, 100);
  g.bubble = 'zzz'; g.bubbleT = 5;
  const wake = g.traits.includes('leve_tot') ? 6.3 : g.traits.includes('noctambule') ? 9 : 7 + (g.id % 7) * 0.22;
  const overnight = c.day > (a.startDay || c.day) || (a.startHf !== undefined && a.startHf < 5);
  const nap = !overnight && a.startHf !== undefined && a.startHf >= 7 && a.startHf < 20.5;
  if (nap && g.needs.energy >= 60 && c.hf < 21) { releaseAct(state, g); g.pose = 'stand'; g.bubble = null; return; }
  if (overnight && c.hf >= wake && c.hf < 13 && (g.needs.energy >= 70 || c.hf >= 10)) {
    // Réveil : une nuit de plus.
    g.nightsDone++;
    state.stats.nights++;
    const room = state.world.rooms[g.roomId];
    const st = state.rt.roomStats[g.roomId];
    if (room) room.clean = Math.max(0, room.clean - 22);
    if (a.noBed || a.floor) think(g, 'Nous avons dormi sans vrai lit…', -18);
    else if (st) {
      const cold = modProduct(state, 'comfort');
      let comfort = (st.bedComfort + st.comfort * 0.6) * (cold === 1 ? 1 : 1 + (cold - 1));
      const winter = c.seasonIndex === 3;
      if (winter && st.warmth === 0) { comfort -= 6; if (once(g, 'cold' + c.day)) think(g, 'Il faisait un peu froid dans la chambre.', g.traits.includes('frileux') ? -6 : -2); }
      if (winter && st.warmth > 0 && once(g, 'warm')) think(g, 'Le poêle a gardé la chambre bien au chaud.', 4);
      const d = (comfort / 30 - g.exigence) * 9;
      if (d > 2.5) think(g, 'Nous avons très bien dormi, le lit est confortable.', Math.min(7, d));
      else if (d < -2.5) think(g, 'Le lit n\'était pas très confortable.', Math.max(-8, d));
      if (room && room.clean < 30) think(g, 'La chambre n\'a pas été faite.', -6);
    }
    releaseAct(state, g);
    g.pose = 'stand';
    g.bubble = null;
  }
}

function tickMeal(state, g, dt) {
  const a = g.act;
  if (a.phase === 'wait') {
    a.wait += dt;
    const limit = (a.kind === 'dine' ? 115 : 50) * ARCHETYPES[g.type].patience * 1.2;
    if (a.wait > limit) {
      think(g, a.kind === 'dine' ? 'Nous avons attendu notre repas une éternité !' : 'Personne ne sert au bar…', -12);
      releaseAct(state, g);
      return;
    }
    return;
  }
  if (a.phase === 'eat') {
    a.t += dt;
    if (a.t >= a.dur) {
      const room = state.world.rooms[state.world.furniture[a.seats[0].furnId]?.roomId];
      if (room && ROOM_TYPES[room.type].indoor) room.clean = Math.max(0, room.clean - 1.5 * g.size);
      releaseAct(state, g);
    }
  }
}

export function abortMeal(state, g, text, delta) {
  think(g, text, delta);
  releaseAct(state, g);
}

/** Appelé par le restaurant quand le plat ou la boisson arrive à table. */
export function serveGuest(state, g, order) {
  const a = g.act;
  if (!a || (a.kind !== 'dine' && a.kind !== 'bar') || a.phase !== 'wait') return false;
  const rng = getRng(state);
  a.phase = 'eat';
  a.t = 0;
  a.dur = order.kind === 'meal' ? rng.int(28, 42) : rng.int(18, 30);
  const c = clock(state.time);
  if (order.kind === 'meal') {
    g.needs.hunger = clamp(g.needs.hunger + (order.breakfast ? 48 : 62), 0, 100);
    earn(state, order.total, 'meals');
    if (order.drinksTotal) earn(state, order.drinksTotal, 'drinks');
    g.spent += order.total + (order.drinksTotal || 0);
    state.stats.meals += order.qty;
    const food = g.traits.includes('gourmand') ? 1.5 : 1;
    let d = (order.quality - g.exigence * 0.7) * 22 * food;
    if (a.wait > 75) d -= (a.wait - 75) / 8;
    if (order.priceRatio > 1.35) { think(g, `${order.name} : délicieux, mais hors de prix.`, -5); }
    if (a.terrace) think(g, 'Quel plaisir de manger en terrasse !', 4);
    if (d > 2) think(g, order.breakfast ? 'Un petit-déjeuner copieux et savoureux.' : `${order.name} : un régal !`, Math.min(12, d));
    else if (d < -2) think(g, order.breakfast ? 'Le petit-déjeuner était bien quelconque.' : `${order.name} : plutôt décevant.`, Math.max(-10, d));
    else g.satisfaction = clamp(g.satisfaction + 1, 0, 100);
    if (g.vipCare && g.story) g.judgeQ = Math.max(g.judgeQ || 0, order.quality);
    g.lastMealQ = order.quality;
  } else {
    g.needs.fun = clamp(g.needs.fun + 18, 0, 100);
    g.needs.hunger = clamp(g.needs.hunger + 5, 0, 100);
    earn(state, order.total, 'drinks');
    g.spent += order.total;
    state.stats.drinks += order.qty;
    const room = state.world.rooms[state.world.furniture[a.seats[0].furnId]?.roomId];
    const amb = room ? state.rt.roomStats[room.id].decorDensity : 0;
    if (getRng(state).chance(0.5)) think(g, c.hf >= 20 ? 'Une soirée bien sympathique au bar.' : `${order.name}, parfait.`, 2 + amb * 2);
  }
  g.bubble = 'coin';
  return true;
}

function tickExcursion(state, g, dt) {
  const a = g.act;
  if (a.phase === 'book') {
    a.t += dt;
    if (a.t >= 8) {
      if (!guideAvailable(state)) { think(g, 'Pas de guide disponible pour l\'excursion.', -3); releaseAct(state, g); return; }
      const price = state.prices.services.excursion * g.size;
      if (price > g.budget * 1.5) { think(g, 'L\'excursion est trop chère pour nous.', -2); releaseAct(state, g); return; }
      earn(state, price, 'activities'); g.spent += price; g.bubble = 'coin';
      a.phase = 'ready';
      a.t = 0;
    }
  } else if (a.phase === 'ready') {
    a.t += dt;
    if (a.t > 120) { think(g, 'Le guide n\'est jamais venu nous chercher…', -8); releaseAct(state, g); }
  } else if (a.phase === 'follow') {
    const r = stepAlong(state, g, dt);
    if (r !== 'moving') { g.hidden = true; a.phase = 'out'; }
  } else if (a.phase === 'out') {
    // retour géré par le guide
  }
}

/** Départ d'une excursion : appelé par le guide. */
export function excursionDepart(state, guests) {
  for (const g of guests) {
    if (g.act.keys) for (const k of g.act.keys) state.rt.reserved.delete(k);
    g.act.keys = null;
    g.act.phase = 'follow';
    g.goalRoom = 0;
    if (!goTo(state, g, { x: SPOTS.trailEnd[0], y: SPOTS.trailEnd[1] })) { g.hidden = true; g.act.phase = 'out'; }
  }
}
export function excursionReturn(state, guests) {
  const rng = getRng(state);
  for (const g of guests) {
    if (!g.act || g.act.kind !== 'excursion') continue;
    g.hidden = false;
    placeAt(g, SPOTS.trailEnd[0], SPOTS.trailEnd[1]);
    const bonus = state.flags.guideNotes ? 1.1 : 1;
    think(g, rng.pick(['L\'excursion guidée était fantastique !', 'Notre guide connaissait chaque sommet, passionnant.', 'Une sortie en raquettes inoubliable !']), 10 * bonus);
    g.needs.fun = clamp(g.needs.fun + 50, 0, 100);
    g.needs.energy = clamp(g.needs.energy - 30, 0, 100);
    g.needs.hunger = clamp(g.needs.hunger - 25, 0, 100);
    state.stats.excursions++;
    g.act = null;
  }
}

/** Rappel de quel groupe est concerné par une histoire. */
export function storyGuestSpec(storyId, chapterIdx) {
  const st = STORIES[storyId];
  const ch = st.chapters[chapterIdx];
  return { st, ch };
}
export { SPECIAL_GUESTS };
