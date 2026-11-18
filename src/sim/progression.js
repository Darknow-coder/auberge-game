// Paliers, objectifs, parcelles, requêtes de progression.
import { OBJECTIVES, TIERS, PARCELS, TIER_REQ_LABELS } from '../data/progression.js';
import { FURNITURE } from '../data/furniture.js';
import { notify } from './state.js';
import { spend, earn } from './economy.js';
import { kitchenStatus } from './restaurant.js';
import { refreshCandidates } from './staff.js';
import { clamp } from '../core/util.js';

export function queryApi(state) {
  const rt = state.rt;
  const rooms = Object.values(state.world.rooms);
  return {
    bedrooms: () => rt.agg.bedrooms,
    roomsAtStanding: (n) => rooms.filter((r) => r.type === 'bedroom' && rt.roomStats[r.id]?.capacity > 0 && rt.roomStats[r.id].standing >= n).length,
    hasRoom: (type, ok) => rooms.some((r) => r.type === type && (!ok || rt.roomStats[r.id]?.ok)),
    restaurantOpen: () => !!rt.diningSeats.length && kitchenStatus(state).ok && state.staff.some((s) => s.role === 'cook'),
    gardenDecor: () => rt.agg.gardenDecor,
    terraceTables: () => (rt.diningSeats.some((s) => state.world.rooms[s.roomId]?.type === 'terrace') ? 1 : 0),
    gamesActivities: () => {
      const ids = new Set();
      for (const u of rt.usables) if (state.world.rooms[u.roomId]?.type === 'games' && (u.kind === 'fun' || u.kind === 'read')) ids.add(u.gameSeat ? 'table' + state.world.furniture[u.furnId]?.roomId : state.world.furniture[u.furnId]?.type);
      return ids.size;
    },
    spaEquipment: () => Object.values(state.world.furniture).filter((f) => state.world.rooms[f.roomId]?.type === 'spa' && FURNITURE[f.type].use?.kind === 'spa').length,
  };
}

export function objectiveList(state) {
  const api = queryApi(state);
  return OBJECTIVES.map((o) => {
    const [cur, max] = o.progress(state, api);
    return { ...o, cur: Math.min(cur, max), max, done: cur >= max, claimed: state.objectives.claimed.includes(o.id) };
  });
}

/** Les 4 premiers objectifs non réclamés. */
export function activeObjectives(state) {
  return objectiveList(state).filter((o) => !o.claimed).slice(0, 4);
}

export function claimObjective(state, id) {
  const o = objectiveList(state).find((x) => x.id === id);
  if (!o || o.claimed) return { ok: false, reason: 'Déjà réclamé' };
  if (!o.done) return { ok: false, reason: 'Objectif non atteint' };
  state.objectives.claimed.push(id);
  if (o.reward.money) earn(state, o.reward.money, 'misc');
  if (o.reward.rep) state.reputation.value = clamp(state.reputation.value + o.reward.rep, 0, 100);
  return { ok: true, reward: o.reward };
}

export function tierRequirements(state, tier = state.tier + 1) {
  const t = TIERS[tier];
  if (!t) return [];
  const api = queryApi(state);
  const out = [];
  for (const [k, v] of Object.entries(t.req)) {
    let cur, ok;
    switch (k) {
      case 'rep': cur = Math.round(state.reputation.value); ok = cur >= v; break;
      case 'bedrooms': cur = api.bedrooms(); ok = cur >= v; break;
      case 'confort': cur = api.roomsAtStanding(1); ok = cur >= v; break;
      case 'suites': cur = api.roomsAtStanding(2); ok = cur >= v; break;
      case 'served': cur = state.stats.served; ok = cur >= v; break;
      case 'restaurant': ok = api.restaurantOpen(); cur = ok ? 1 : 0; break;
      case 'bar': ok = api.hasRoom('bar', true); cur = ok ? 1 : 0; break;
      case 'leisure': ok = api.hasRoom('games') || api.gardenDecor() >= 4; cur = ok ? 1 : 0; break;
      case 'staff': cur = state.staff.filter((s) => s.role !== 'owner').length; ok = cur >= v; break;
      case 'spa': ok = api.spaEquipment() >= 1; cur = ok ? 1 : 0; break;
      default: cur = 0; ok = false;
    }
    out.push({ key: k, label: TIER_REQ_LABELS[k](v), cur, target: typeof v === 'number' ? v : 1, ok });
  }
  return out;
}

export function upgradeTier(state) {
  const next = TIERS[state.tier + 1];
  if (!next) return { ok: false, reason: 'Palier maximal atteint' };
  const reqs = tierRequirements(state);
  if (reqs.some((r) => !r.ok)) return { ok: false, reason: 'Conditions non remplies' };
  if (state.money < next.cost) return { ok: false, reason: 'Fonds insuffisants' };
  spend(state, next.cost, 'build');
  state.tier++;
  refreshCandidates(state);
  notify(state, { kind: 'tier', text: `Votre établissement devient « ${next.name} » ! Nouveaux déblocages : ${next.unlocks}.`, log: true });
  return { ok: true };
}

export function buyParcel(state, id) {
  const p = PARCELS.find((x) => x.id === id);
  if (!p) return { ok: false, reason: 'Parcelle inconnue' };
  if (state.world.ownedParcels.includes(id)) return { ok: false, reason: 'Déjà acheté' };
  if (state.tier < p.tier) return { ok: false, reason: `Disponible au palier ${p.tier}` };
  if (state.money < p.cost) return { ok: false, reason: 'Fonds insuffisants' };
  spend(state, p.cost, 'build');
  state.world.ownedParcels.push(id);
  notify(state, { kind: 'good', text: `Vous avez acheté « ${p.name} ». De nouvelles possibilités de construction s'offrent à vous !`, log: true });
  return { ok: true };
}
