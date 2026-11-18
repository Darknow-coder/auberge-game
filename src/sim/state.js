// Création, sérialisation et migration de l'état de jeu.
import { SAVE_VERSION, START_MONEY, START_HOUR, MAP_W, MAP_H } from '../data/constants.js';
import { RECIPES, DRINKS, SERVICES, ROOM_REF_PRICE } from '../data/economy.js';
import { Rng } from '../core/util.js';
import { generateTerrain } from './map.js';
import { rebuildIndices, buildRoom, placeFurniture, edgeKey } from './world.js';
import { createOwner, refreshCandidates } from './staff.js';
import { rollWeather } from './weather.js';

export function createRuntime() {
  return { notifications: [], rng: null, dirty: true };
}

export function createNewGame({ seed = (Date.now() % 1e9) | 0, innName = 'Auberge des Sommets' } = {}) {
  const state = {
    version: SAVE_VERSION,
    seed,
    rngState: seed,
    innName,
    time: START_HOUR * 60,
    money: START_MONEY,
    tier: 1,
    reputation: { value: 40, reviews: [], history: [] },
    daily: { arrivals0: 0, refused0: { full: 0, price: 0, wait: 0, quality: 0 } },
    stats: { arrivals: 0, served: 0, meals: 0, drinks: 0, reviews: 0, excursions: 0, nights: 0, refused: { full: 0, price: 0, wait: 0, quality: 0 }, spent: 0 },
    ledger: { today: { inc: {}, exp: {} }, history: [] },
    prices: {
      rooms: ROOM_REF_PRICE.slice(),
      recipes: Object.fromEntries(Object.entries(RECIPES).map(([k, r]) => [k, r.price])),
      drinks: Object.fromEntries(Object.entries(DRINKS).map(([k, d]) => [k, d.price])),
      services: Object.fromEntries(Object.entries(SERVICES).map(([k, s]) => [k, s.price])),
      breakfast: 10,
    },
    menu: { recipes: ['soupe', 'omelette', 'croute', 'tarte'], drinks: ['tisane', 'cafe', 'chocolat', 'jus', 'biere'] },
    stock: { ingredients: 12, drinks: 30, supplies: 30, souvenirs: 0 },
    deliveries: [],
    autoRestock: { ingredients: 15, drinks: 20, supplies: 12, souvenirs: 8 },
    restaurant: { orders: [], nextOrder: 1 },
    reception: { queue: [] },
    world: {
      w: MAP_W, h: MAP_H,
      terrain: generateTerrain(seed),
      rooms: {}, nextRoomId: 1,
      doors: [],
      furniture: {}, nextFurnId: 1,
      ownedParcels: [0],
    },
    inventory: {},
    unlocked: { recipes: [] },
    guests: [], nextGuestId: 1,
    schedule: [],
    staff: [], nextStaffId: 1,
    candidates: [], candidatesDay: 0,
    objectives: { claimed: [] },
    stories: { chars: {} },
    events: { cooldowns: {}, once: [], modifiers: [], next: null },
    flags: {},
    weather: { today: 'soleil', tomorrow: 'nuages', season: 0 },
    dialogs: [],
    loan: null,
    log: [],
    lastDayReport: null,
  };
  state.rt = createRuntime();
  rebuildIndices(state);
  buildStartingInn(state);
  state.staff.push(createOwner(state));
  refreshCandidates(state);
  state.weather.tomorrow = rollWeather(state, 0);
  return state;
}

/** Auberge de départ : réception, salle commune, couloir, trois chambres et un petit jardin. */
function buildStartingInn(state) {
  const R = (type, x0, y0, x1, y1) => buildRoom(state, type, x0, y0, x1, y1, { free: true }).room;
  R('lounge', 15, 16, 18, 19);
  R('reception', 16, 20, 18, 23);
  R('corridor', 19, 16, 19, 23);
  R('bedroom', 20, 16, 22, 17);
  R('bedroom', 20, 18, 22, 19);
  R('bedroom', 20, 20, 22, 21);
  R('garden', 18, 25, 21, 27);
  // Portes maîtrisées (remplacent les portes automatiques).
  state.world.doors = [
    edgeKey(17, 23, 17, 24), // entrée
    edgeKey(18, 22, 19, 22), // réception -> couloir
    edgeKey(18, 19, 18, 20), // salle commune -> réception
    edgeKey(19, 17, 20, 17),
    edgeKey(19, 19, 20, 19),
    edgeKey(19, 21, 20, 21),
  ];
  rebuildIndices(state);
  const P = (type, x, y, rot = 0) => {
    const r = placeFurniture(state, type, x, y, rot, { free: true });
    if (!r.ok) throw new Error(`Placement initial impossible: ${type} @${x},${y} (${r.reason})`);
  };
  // Réception
  P('desk', 16, 21, 0);
  P('plant', 18, 23);
  P('luggage_rack', 16, 23);
  // Salle commune
  P('fireplace', 16, 16, 0);
  P('sofa', 16, 18, 2);
  P('armchair', 18, 17, 3);
  P('bookshelf', 15, 16, 0);
  P('plant', 15, 19);
  // Chambres
  P('bed_single', 22, 16, 0); P('nightstand', 21, 16);
  P('bed_double', 21, 18, 0); P('plant', 20, 18);
  P('bed_double', 21, 20, 0); P('wardrobe', 20, 20);
  // Jardin et abords
  P('bench', 19, 25, 0);
  P('flower_bed', 18, 25); P('flower_bed', 21, 25);
  P('lantern', 16, 24);
  P('linen_cupboard', 19, 16, 1);
}

// ---------------------------------------------------------------- Sauvegarde

export function serialize(state) {
  const { rt, ...rest } = state;
  return JSON.stringify({ ...rest, rngState: rt.rng ? rt.rng.s : state.rngState });
}

export function deserialize(json) {
  const data = typeof json === 'string' ? JSON.parse(json) : json;
  if (!data || typeof data !== 'object' || !data.world || !Array.isArray(data.world.terrain)) throw new Error('Sauvegarde invalide');
  if (data.world.terrain.length !== MAP_W * MAP_H) throw new Error('Carte incompatible');
  const state = migrate(data);
  state.rt = createRuntime();
  state.rt.rng = new Rng(state.rngState);
  rebuildIndices(state);
  // Les réservations de places sont reconstruites à partir des activités.
  return state;
}

function migrate(s) {
  if (!s.version) s.version = 1;
  // Champs ajoutés au fil des versions : valeurs par défaut défensives.
  s.inventory ||= {};
  s.unlocked ||= { recipes: [] };
  s.flags ||= {};
  s.dialogs ||= [];
  s.schedule ||= [];
  s.deliveries ||= [];
  s.events ||= { cooldowns: {}, once: [], modifiers: [], next: null };
  s.stories ||= { chars: {} };
  s.reputation.history ||= [];
  s.daily ||= { arrivals0: s.stats.arrivals, refused0: { ...s.stats.refused } };
  s.version = SAVE_VERSION;
  return s;
}

export function getRng(state) {
  if (!state.rt.rng) state.rt.rng = new Rng(state.rngState);
  return state.rt.rng;
}

export function notify(state, n) {
  state.rt.notifications.push({ t: state.time, ...n });
  if (n.log !== false && n.text) {
    state.log.unshift({ t: state.time, text: n.text, kind: n.kind || 'info' });
    if (state.log.length > 60) state.log.length = 60;
  }
}
