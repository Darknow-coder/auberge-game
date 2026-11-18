// Personnel : génération, recrutement, horaires et IA par rôle.
import { STAFF_ROLES, STAFF_TRAITS, SHIFTS } from '../data/economy.js';
import { FIRST_NAMES_F, FIRST_NAMES_M, LAST_NAMES, SKIN_TONES, HAIR_COLORS } from '../data/guests.js';
import { SPOTS } from '../data/constants.js';
import { FURNITURE } from '../data/furniture.js';
import { ROOM_TYPES } from '../data/rooms.js';
import { clamp, lerp } from '../core/util.js';
import { clock } from './time.js';
import { getRng, notify } from './state.js';
import { staffSpot, furnCells, furnSpots, W } from './world.js';
import { goTo, stepAlong, placeAt, tileOf } from './agents.js';
import { ingredientsFor, mealQuality, failOrder, kitchenStatus, barStatus } from './restaurant.js';
import { serveGuest, excursionDepart, excursionReturn } from './guests.js';

function makeStaffLook(rng, role, fem) {
  return {
    skin: rng.pick(SKIN_TONES), hair: rng.pick(HAIR_COLORS.slice(0, 7)),
    hairStyle: rng.pick(fem ? ['bun', 'ponytail', 'bob', 'long'] : ['short', 'short', 'curly', 'beard']),
    top: STAFF_ROLES[role] ? STAFF_ROLES[role].top : '#6b4a32', bottom: '#2d3340', apron: role === 'cook' || role === 'waiter', chefHat: role === 'cook',
  };
}

export function createOwner(state) {
  const rng = getRng(state);
  return {
    id: state.nextStaffId++, kind: 'staff', role: 'owner', name: 'Vous', fem: false,
    look: { skin: '#e8bf9a', hair: '#6b4428', hairStyle: 'short', top: '#7a4b2a', bottom: '#3b4250', apron: false, vest: true },
    skill: 0.15, salary: 0, shift: 'owner', traits: [], xp: 0, daysWorked: 0,
    present: true, hidden: false, x: 17.5, y: 20.5, dir: [0, 1], path: null, task: null, eff: 0.55, seed: rng.next(),
  };
}

export function generateCandidate(state, role) {
  const rng = getRng(state);
  const def = STAFF_ROLES[role];
  const fem = rng.chance(0.5);
  const skill = clamp(rng.float(0.15, 0.6) + rng.float(0, 0.4) * rng.next(), 0.1, 0.95);
  const salary = Math.round(lerp(def.salary[0], def.salary[1], skill) * rng.float(0.92, 1.08));
  const traits = rng.chance(0.55) ? [rng.pick(Object.keys(STAFF_TRAITS))] : [];
  return {
    cid: `${role}-${state.nextStaffId}-${Math.floor(rng.next() * 1e6)}`,
    role, name: `${rng.pick(fem ? FIRST_NAMES_F : FIRST_NAMES_M)} ${rng.pick(LAST_NAMES)}`, fem, skill, salary, traits,
    look: makeStaffLook(rng, role, fem),
  };
}

export function refreshCandidates(state) {
  const c = clock(state.time);
  state.candidates = [];
  for (const [role, def] of Object.entries(STAFF_ROLES)) {
    if (state.tier < def.tier) continue;
    if (role === 'manager' && state.staff.some((s) => s.role === 'manager')) continue;
    state.candidates.push(generateCandidate(state, role), generateCandidate(state, role));
  }
  state.candidatesDay = c.day;
}

export function hireStaff(state, cid, shift = 'journee') {
  const c = state.candidates.find((x) => x.cid === cid);
  if (!c) return { ok: false, reason: 'Candidat introuvable' };
  if (state.tier < STAFF_ROLES[c.role].tier) return { ok: false, reason: 'Rôle verrouillé' };
  const s = {
    id: state.nextStaffId++, kind: 'staff', role: c.role, name: c.name, fem: c.fem, look: c.look,
    skill: c.skill, salary: c.salary, shift, traits: c.traits, xp: 0, daysWorked: 0,
    present: false, hidden: true, x: SPOTS.roadStart[0] + 0.5, y: SPOTS.roadStart[1] + 0.5, dir: [0, -1], path: null, task: null, eff: 0.5,
  };
  state.staff.push(s);
  state.candidates = state.candidates.filter((x) => x.cid !== cid);
  return { ok: true, staff: s };
}

export function fireStaff(state, s, quit = false) {
  if (s.role === 'owner') return { ok: false, reason: 'Impossible' };
  dropTask(state, s);
  state.staff = state.staff.filter((x) => x.id !== s.id);
  if (!quit) state.money -= s.salary;
  return { ok: true };
}

export function isOnDuty(s, hf) {
  if (s.role === 'owner') return hf >= 6.5 && hf < 23;
  const sh = SHIFTS[s.shift] || SHIFTS.journee;
  return hf >= sh.from && hf < sh.to;
}

export function staffOnDuty(state, role) {
  const hf = clock(state.time).hf;
  return state.staff.filter((s) => s.role === role && s.present && isOnDuty(s, hf));
}

export function deskAgent(state) {
  for (const s of state.staff) {
    if (!s.present || !s.task || s.task.kind !== 'desk' || s.task.phase !== 'at') continue;
    return s;
  }
  return null;
}

export function guideAvailable(state) {
  const hf = clock(state.time).hf;
  return hf < 13 && state.staff.some((s) => s.role === 'guide' && isOnDuty(s, hf)) && Object.values(state.world.furniture).some((f) => f.type === 'guide_desk');
}

function findFurniture(state, type, roomType) {
  for (const f of Object.values(state.world.furniture)) {
    if (f.type !== type) continue;
    if (roomType && state.world.rooms[f.roomId]?.type !== roomType) continue;
    return f;
  }
  return null;
}

function dropTask(state, s) {
  const t = s.task;
  if (!t) return;
  if (t.orderId) {
    const o = state.restaurant.orders.find((x) => x.id === t.orderId);
    if (o && (o.status === 'cooking')) { o.status = 'new'; o.cookId = 0; }
    if (o && (o.status === 'pickup' || o.status === 'delivering')) { o.status = 'ready'; o.waiterId = 0; }
  }
  if (t.roomId) state.rt.cleaning?.delete(t.roomId);
  s.task = null;
}

function walkTo(state, s, x, y, cells) {
  const ok = cells ? goTo(state, s, { cells }) : goTo(state, s, { x, y });
  return ok;
}

/** Va à un poste fixe ; renvoie true quand l'agent y est. */
function goStation(state, s, kind, tile, dt, extra = {}) {
  if (!tile) return false;
  if (!s.task || s.task.kind !== kind) {
    dropTask(state, s);
    s.task = { kind, phase: 'walk', ...extra };
    const [tx, ty] = tileOf(s);
    if (tx === tile[0] && ty === tile[1]) { s.task.phase = 'at'; return true; }
    if (!walkTo(state, s, tile[0], tile[1])) { s.task = null; s.idle = 20; return false; }
  }
  if (s.task.phase === 'walk') {
    const r = stepAlong(state, s, dt);
    if (r === 'stuck') { s.task = null; s.idle = 15; return false; }
    if (r === 'arrived') { s.task.phase = 'at'; s.x = tile[0] + 0.5; s.y = tile[1] + 0.5; }
    else return false;
  }
  return s.task.phase === 'at';
}

function efficiency(state, s) {
  const manager = state.staff.some((m) => m.role === 'manager' && m.present);
  let e = 0.45 + s.skill * 0.75;
  if (manager && s.role !== 'manager') e *= 1.12;
  if (s.traits.includes('rapide')) e *= 1.15;
  return e;
}

function gainXp(s, n = 1) {
  s.xp += n;
  s.skill = clamp(s.skill + 0.0022 * n * (s.traits.includes('passionne') ? 2 : 1), 0, 1);
}

// ---------------------------------------------------------------- Nettoyage

function cleanTarget(state, s) {
  state.rt.cleaning ||= new Map();
  const sleepingIn = new Set(state.guests.filter((g) => g.act && g.act.kind === 'sleep' && g.act.phase === 'sleep').map((g) => g.roomId));
  const occupied = new Set(state.guests.filter((g) => g.roomId).map((g) => g.roomId));
  let best = null;
  for (const r of Object.values(state.world.rooms)) {
    if (!ROOM_TYPES[r.type].indoor || r.type === 'kitchen') continue;
    if (sleepingIn.has(r.id)) continue;
    const by = state.rt.cleaning.get(r.id);
    if (by && by !== s.id) continue;
    const thr = r.type === 'bedroom' ? 82 : 70;
    if (r.clean >= thr) continue;
    let p = 100 - r.clean;
    if (r.type === 'bedroom' && !occupied.has(r.id)) p += 60; // chambre libérée : prioritaire
    if (!best || p > best.p) best = { r, p };
  }
  return best ? best.r : null;
}

function doCleaning(state, s, dt) {
  const t = s.task;
  if (!t || t.kind !== 'clean') {
    const room = cleanTarget(state, s);
    if (!room) return false;
    dropTask(state, s);
    const tiles = room.tiles.filter((i) => state.rt.walk[i]);
    if (!tiles.length) return false;
    const i = tiles[Math.floor(getRng(state).next() * tiles.length)];
    s.task = { kind: 'clean', phase: 'walk', roomId: room.id, t: 0 };
    state.rt.cleaning.set(room.id, s.id);
    if (!walkTo(state, s, i % W, Math.floor(i / W))) { dropTask(state, s); s.idle = 20; return false; }
    return true;
  }
  const room = state.world.rooms[t.roomId];
  if (!room) { dropTask(state, s); return false; }
  if (t.phase === 'walk' || t.phase === 'move') {
    const r = stepAlong(state, s, dt);
    if (r === 'stuck') { dropTask(state, s); s.idle = 10; return true; }
    if (r === 'arrived') t.phase = 'work';
    return true;
  }
  // Travail : on se déplace un peu dans la pièce pour donner vie.
  const need = (6 + room.tiles.length * 2) / s.eff;
  t.t += dt;
  s.pose = 'clean';
  if ((t.t % 9) < dt && room.tiles.length > 2) {
    const tiles = room.tiles.filter((i) => state.rt.walk[i]);
    const i = tiles[Math.floor(getRng(state).next() * tiles.length)];
    if (walkTo(state, s, i % W, Math.floor(i / W))) t.phase = 'move';
  }
  if (t.t >= need) {
    let target = 100;
    if (room.type === 'bedroom') {
      const thrifty = s.traits.includes('econome') && getRng(state).chance(0.4);
      if (state.stock.supplies >= 1) { if (!thrifty) state.stock.supplies -= 1; }
      else { target = 72; notify(state, { kind: 'warn', text: 'Plus de linge propre : les chambres sont mal préparées. Commandez des fournitures !', key: 'supplies' }); }
    }
    if (s.traits.includes('meticuleux')) target = Math.min(100, target + 5);
    room.clean = Math.max(room.clean, target);
    gainXp(s, 1);
    dropTask(state, s);
  }
  return true;
}

// ---------------------------------------------------------------- Rôles

function updateReceptionist(state, s, dt) {
  const desk = findFurniture(state, 'desk', 'reception');
  if (!desk) return idleAround(state, s, dt, 'reception');
  goStation(state, s, 'desk', staffSpot(desk), dt);
  if (s.task && s.task.phase === 'at') { s.dir = [0, 1]; faceFurniture(s, desk); s.pose = 'stand'; }
  if (s.serving) gainXp(s, dt * 0.02);
}

function updateOwner(state, s, dt) {
  const queue = state.reception.queue.length;
  const recep = staffOnDuty(state, 'receptionist').some((r) => r.task && r.task.kind === 'desk');
  const desk = findFurniture(state, 'desk', 'reception');
  const cleaners = staffOnDuty(state, 'cleaner').length;
  const firstWait = queue ? (state.guests.find((g) => g.id === state.reception.queue[0])?.wait || 0) : 0;
  if (desk && !recep && queue && (!s.task || s.task.kind !== 'clean' || s.task.phase === 'walk' || firstWait > 12)) {
    goStation(state, s, 'desk', staffSpot(desk), dt);
    if (s.task && s.task.phase === 'at') { faceFurniture(s, desk); s.pose = 'stand'; }
    return;
  }
  if (s.task && s.task.kind === 'clean') { doCleaning(state, s, dt); return; }
  if (!cleaners && !queue && doCleaning(state, s, dt)) return;
  if (desk && !recep) {
    goStation(state, s, 'desk', staffSpot(desk), dt);
    if (s.task && s.task.phase === 'at') { faceFurniture(s, desk); s.pose = 'stand'; }
    return;
  }
  idleAround(state, s, dt, 'lounge');
}

function faceFurniture(s, f) {
  const cx = f.x + 0.5, cy = f.y + 0.5;
  const dx = cx - s.x, dy = cy - s.y;
  s.dir = Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)];
}

function updateCleaner(state, s, dt) {
  if (doCleaning(state, s, dt)) return;
  idleAround(state, s, dt, 'corridor');
}

function cookStation(state) {
  const k = kitchenStatus(state);
  if (!k.ok) return null;
  const stove = Object.values(state.world.furniture).find((f) => f.type === 'stove' && f.roomId === k.room.id);
  return stove ? { stove, spot: staffSpot(stove) } : null;
}

function updateCook(state, s, dt) {
  const st = cookStation(state);
  if (!st) return idleAround(state, s, dt, 'kitchen');
  const orders = state.restaurant.orders;
  const t = s.task;
  // Livraison par le cuisinier quand il n'y a pas de serveur.
  if (t && t.kind === 'deliver') return doDeliver(state, s, dt);
  if (!t || t.kind !== 'cook' || t.phase === 'walk') {
    if (!goStation(state, s, 'cook', st.spot, dt)) return;
  }
  faceFurniture(s, st.stove);
  s.pose = 'stand';
  const task = s.task;
  if (!task.orderId) {
    const o = orders.find((x) => x.kind === 'meal' && x.status === 'new' && !x.cancelled);
    if (!o) {
      // Plat prêt et aucun serveur : le cuisinier livre lui-même.
      if (!staffOnDuty(state, 'waiter').length) {
        const ready = orders.find((x) => x.kind === 'meal' && x.status === 'ready');
        if (ready) startDeliver(state, s, ready);
      }
      return;
    }
    const g = state.guests.find((x) => x.id === o.gid);
    if (!g || !g.act || g.act.orderId !== o.id) { o.status = 'done'; return; }
    const need = ingredientsFor(o);
    if (state.stock.ingredients < need) { failOrder(state, o, g, 'Rupture d\'ingrédients en cuisine ! Commandez des provisions.'); return; }
    state.stock.ingredients -= need;
    if (o.drinkUnits) state.stock.drinks = Math.max(0, state.stock.drinks - o.drinkUnits);
    o.status = 'cooking';
    o.cookId = s.id;
    task.orderId = o.id;
    task.t = 0;
    const base = o.breakfast ? 8 : 10 + (o.recipe ? 4 : 0);
    task.need = (base * (0.75 + 0.25 * Math.sqrt(o.qty))) / s.eff;
  } else {
    const o = orders.find((x) => x.id === task.orderId);
    if (!o) { task.orderId = 0; return; }
    task.t += dt;
    s.pose = 'cook';
    if (task.t >= task.need) {
      o.quality = mealQuality(state, o, s);
      o.status = 'ready';
      o.readyAt = state.time;
      task.orderId = 0;
      gainXp(s, 1);
    }
  }
}

function startDeliver(state, s, o) {
  const table = state.world.furniture[o.tableId];
  const g = state.guests.find((x) => x.id === o.gid);
  if (!table || !g) { o.status = 'done'; return; }
  dropTask(state, s);
  s.task = { kind: 'deliver', phase: 'walk', orderId: o.id };
  o.status = 'delivering';
  o.waiterId = s.id;
  if (!walkTo(state, s, 0, 0, furnCells(table))) { o.status = 'ready'; o.waiterId = 0; s.task = null; s.idle = 5; }
}

function doDeliver(state, s, dt) {
  const t = s.task;
  const o = state.restaurant.orders.find((x) => x.id === t.orderId);
  if (!o) { s.task = null; return; }
  if (t.phase === 'pickup') {
    const r = stepAlong(state, s, dt);
    if (r === 'stuck') { dropTask(state, s); return; }
    if (r !== 'arrived') return;
    t.phase = 'walk';
    o.status = 'delivering';
    const table = state.world.furniture[o.tableId];
    if (!table || !walkTo(state, s, 0, 0, furnCells(table))) { o.status = 'done'; s.task = null; }
    return;
  }
  s.carry = true;
  const r = stepAlong(state, s, dt);
  if (r === 'stuck') { dropTask(state, s); s.carry = false; return; }
  if (r !== 'arrived') return;
  s.carry = false;
  const g = state.guests.find((x) => x.id === o.gid);
  if (g && g.act && g.act.orderId === o.id) serveGuest(state, g, o);
  o.status = 'done';
  gainXp(s, 1);
  s.task = null;
}

function updateWaiter(state, s, dt) {
  const orders = state.restaurant.orders;
  if (s.task && s.task.kind === 'deliver') return doDeliver(state, s, dt);
  if (s.task && s.task.kind === 'bar' && s.task.orderId) return doBarOrder(state, s, dt);
  // Plats prêts à servir
  const ready = orders.find((x) => x.kind === 'meal' && x.status === 'ready');
  const st = cookStation(state);
  if (ready && st) {
    dropTask(state, s);
    s.task = { kind: 'deliver', phase: 'pickup', orderId: ready.id };
    ready.status = 'pickup';
    ready.waiterId = s.id;
    if (!walkTo(state, s, 0, 0, furnCells(st.stove))) { ready.status = 'ready'; ready.waiterId = 0; s.task = null; s.idle = 5; }
    return;
  }
  // Bar
  const bar = barStatus(state);
  const counter = findFurniture(state, 'bar_counter', 'bar');
  if (counter) {
    const drink = orders.find((x) => x.kind === 'drink' && x.status === 'new' && !x.cancelled);
    const at = goStation(state, s, 'bar', staffSpot(counter), dt);
    if (at) {
      faceFurniture(s, counter); s.pose = 'stand';
      if (drink && bar.open) { s.task.orderId = drink.id; s.task.t = 0; drink.status = 'cooking'; }
    }
    return;
  }
  idleAround(state, s, dt, 'restaurant');
}

function doBarOrder(state, s, dt) {
  const t = s.task;
  const o = state.restaurant.orders.find((x) => x.id === t.orderId);
  if (!o) { t.orderId = 0; return; }
  t.t += dt;
  s.pose = 'cook';
  if (t.t >= 4 / s.eff) {
    const g = state.guests.find((x) => x.id === o.gid);
    if (state.stock.drinks < o.units) { failOrder(state, o, g, 'Plus de boissons au bar ! Pensez à commander.'); t.orderId = 0; return; }
    state.stock.drinks -= o.units;
    if (g && g.act && g.act.orderId === o.id) serveGuest(state, g, o);
    o.status = 'done';
    t.orderId = 0;
    gainXp(s, 1);
  }
}

function updateGuide(state, s, dt) {
  const desk = findFurniture(state, 'guide_desk', 'guides');
  const t = s.task;
  if (t && t.kind === 'lead') {
    if (t.phase === 'walk') {
      const r = stepAlong(state, s, dt);
      if (r !== 'moving') { t.phase = 'out'; s.hidden = true; t.until = state.time + 210; }
      return;
    }
    if (t.phase === 'out') {
      if (state.time >= t.until) {
        s.hidden = false;
        placeAt(s, SPOTS.trailEnd[0], SPOTS.trailEnd[1]);
        excursionReturn(state, state.guests.filter((g) => t.group.includes(g.id)));
        gainXp(s, 3);
        s.task = null;
      }
      return;
    }
  }
  if (!desk) return idleAround(state, s, dt, 'guides');
  if (!goStation(state, s, 'guidedesk', staffSpot(desk), dt)) return;
  faceFurniture(s, desk);
  const ready = state.guests.filter((g) => g.act && g.act.kind === 'excursion' && g.act.phase === 'ready');
  const h = clock(state.time).hf;
  if (ready.length && h < 14 && (ready.length >= 2 || ready.some((g) => g.act.t > 25))) {
    dropTask(state, s);
    s.task = { kind: 'lead', phase: 'walk', group: ready.map((g) => g.id) };
    excursionDepart(state, ready);
    if (!walkTo(state, s, SPOTS.trailEnd[0], SPOTS.trailEnd[1])) { s.task.phase = 'out'; s.hidden = true; s.task.until = state.time + 210; }
  }
}

function updateManager(state, s, dt) {
  idleAround(state, s, dt, 'reception', 'lounge');
}

/** Flâne dans une pièce du type indiqué (ou dehors). */
function idleAround(state, s, dt, ...types) {
  if (s.task && s.task.kind === 'idle') {
    if (s.task.phase === 'walk') {
      const r = stepAlong(state, s, dt);
      if (r !== 'moving') { s.task.phase = 'wait'; s.task.t = 0; }
      return;
    }
    s.pose = 'stand';
    s.task.t += dt;
    if (s.task.t < 25) return;
  }
  const rng = getRng(state);
  const rooms = Object.values(state.world.rooms).filter((r) => types.includes(r.type));
  const room = rooms.length ? rng.pick(rooms) : Object.values(state.world.rooms).find((r) => r.type === 'reception');
  dropTask(state, s);
  if (!room) return;
  const tiles = room.tiles.filter((i) => state.rt.walk[i]);
  if (!tiles.length) return;
  const i = rng.pick(tiles);
  s.task = { kind: 'idle', phase: 'walk', t: 0 };
  if (!walkTo(state, s, i % W, Math.floor(i / W))) s.task = { kind: 'idle', phase: 'wait', t: 0 };
}

export function updateStaff(state, s, dt) {
  const hf = clock(state.time).hf;
  s.eff = s.role === 'owner' ? 0.55 : efficiency(state, s);
  if (s.idle > 0) { s.idle -= dt; return; }
  const duty = isOnDuty(s, hf);
  if (!duty) {
    if (!s.present) return;
    if (s.role === 'owner') { dropTask(state, s); s.present = false; s.hidden = true; return; }
    if (s.task && s.task.kind === 'lead') return updateGuide(state, s, dt);
    if (!s.task || s.task.kind !== 'leave') {
      dropTask(state, s);
      s.task = { kind: 'leave', phase: 'walk' };
      if (!walkTo(state, s, SPOTS.roadStart[0], SPOTS.roadStart[1])) { s.present = false; s.hidden = true; s.task = null; }
      return;
    }
    const r = stepAlong(state, s, dt);
    if (r !== 'moving') { s.present = false; s.hidden = true; s.task = null; }
    return;
  }
  if (!s.present) {
    s.present = true;
    s.hidden = false;
    s.task = null;
    if (s.role === 'owner') { placeAt(s, 17, 20); }
    else placeAt(s, SPOTS.roadStart[0], SPOTS.roadStart[1]);
  }
  if (s.task && s.task.kind === 'leave') s.task = null;
  s.pose = s.path ? 'walk' : (s.pose === 'walk' ? 'stand' : s.pose);
  switch (s.role) {
    case 'owner': return updateOwner(state, s, dt);
    case 'receptionist': return updateReceptionist(state, s, dt);
    case 'cleaner': return updateCleaner(state, s, dt);
    case 'cook': return updateCook(state, s, dt);
    case 'waiter': return updateWaiter(state, s, dt);
    case 'guide': return updateGuide(state, s, dt);
    case 'manager': return updateManager(state, s, dt);
    default: return undefined;
  }
}

/** Fin de journée : ancienneté. */
export function staffDayEnd(state) {
  for (const s of state.staff) if (s.role !== 'owner') s.daysWorked++;
}

export function staffTaskLabel(s) {
  if (!s.present) return 'Hors service';
  const t = s.task;
  if (!t) return 'Disponible';
  switch (t.kind) {
    case 'desk': return t.phase === 'at' ? (s.serving ? 'Accueille un client' : 'À la réception') : 'Se rend à la réception';
    case 'clean': return 'Fait le ménage';
    case 'cook': return t.orderId ? 'Cuisine un plat' : 'Aux fourneaux';
    case 'deliver': return 'Sert un plat';
    case 'bar': return t.orderId ? 'Prépare une boisson' : 'Tient le bar';
    case 'guidedesk': return 'Au comptoir des guides';
    case 'lead': return 'En excursion';
    case 'leave': return 'Rentre chez lui';
    case 'idle': return 'Fait sa ronde';
    default: return 'Occupé';
  }
}

export { FURNITURE, furnSpots };
