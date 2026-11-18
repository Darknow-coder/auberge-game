// Monde : grille, pièces, murs/portes, mobilier, navigation, statistiques des pièces.
import { MAP_W, MAP_H, TERRAIN, WALKABLE_TERRAIN, BUILDABLE_TERRAIN, SPOTS } from '../data/constants.js';
import { ROOM_TYPES, FLOORS, WALLS } from '../data/rooms.js';
import { FURNITURE } from '../data/furniture.js';
import { PARCELS } from '../data/progression.js';
import { STANDING_THRESHOLDS } from '../data/economy.js';
import { VILLAGE_BUILDINGS } from './map.js';

export const W = MAP_W, H = MAP_H;
export const idx = (x, y) => y * W + x;
export const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
export const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
export const DIRS4 = DIRS8.slice(0, 4);
const FRONT = [[0, 1], [1, 0], [0, -1], [-1, 0]];

// ---------------------------------------------------------------- Index runtime

const PARCEL_AT = (() => {
  const a = new Int8Array(W * H).fill(-1);
  for (const p of PARCELS) {
    const [x0, y0, x1, y1] = p.rect;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inb(x, y) && a[idx(x, y)] === -1) a[idx(x, y)] = p.id;
  }
  return a;
})();
export const parcelAt = (x, y) => (inb(x, y) ? PARCEL_AT[idx(x, y)] : -1);

const BLOCKED = (() => {
  const a = new Uint8Array(W * H);
  for (const b of VILLAGE_BUILDINGS) for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) if (inb(x, y)) a[idx(x, y)] = 1;
  return a;
})();

export function isOwned(state, x, y) {
  const p = parcelAt(x, y);
  return p >= 0 && state.world.ownedParcels.includes(p);
}

/** Reconstruit tous les index dérivés (pièces, mobilier, navigation, statistiques). */
export function rebuildIndices(state) {
  const rt = state.rt;
  const world = state.world;
  rt.roomAt = new Int32Array(W * H);
  for (const r of Object.values(world.rooms)) for (const i of r.tiles) rt.roomAt[i] = r.id;
  rt.furnAt = new Int32Array(W * H); // mobilier bloquant
  rt.seatAt = new Int32Array(W * H); // assises (praticables)
  rt.rugAt = new Int32Array(W * H); // tapis (praticables)
  for (const f of Object.values(world.furniture)) {
    const def = FURNITURE[f.type];
    const room = rt.roomAt[idx(f.x, f.y)];
    f.roomId = room || 0;
    for (const [x, y] of furnCells(f)) {
      if (!inb(x, y)) continue;
      const i = idx(x, y);
      if (def.walkable) rt.rugAt[i] = f.id; else if (def.seat) rt.seatAt[i] = f.id; else rt.furnAt[i] = f.id;
    }
  }
  rt.doors = new Set(world.doors);
  buildNav(state);
  computeAllRoomStats(state);
  computeReachability(state);
  rt.worldVersion = (rt.worldVersion || 0) + 1;
}

// ---------------------------------------------------------------- Murs et portes

export function edgeKey(ax, ay, bx, by) {
  if (bx === ax) return by < ay ? `n,${ax},${ay}` : `n,${bx},${by}`;
  return bx < ax ? `w,${ax},${ay}` : `w,${bx},${by}`;
}
export function parseEdge(key) {
  const [d, x, y] = key.split(',');
  const X = +x, Y = +y;
  return d === 'n' ? { d, a: [X, Y - 1], b: [X, Y] } : { d, a: [X - 1, Y], b: [X, Y] };
}

export function roomIdAt(state, x, y) { return inb(x, y) ? state.rt.roomAt[idx(x, y)] : 0; }
export function roomAtTile(state, x, y) { const id = roomIdAt(state, x, y); return id ? state.world.rooms[id] : null; }
export const isIndoorType = (type) => !!(type && ROOM_TYPES[type].indoor);

export function wallBetween(state, ax, ay, bx, by) {
  const ra = roomIdAt(state, ax, ay), rb = roomIdAt(state, bx, by);
  if (ra === rb) return false;
  const A = ra ? state.world.rooms[ra] : null, B = rb ? state.world.rooms[rb] : null;
  return isIndoorType(A && A.type) || isIndoorType(B && B.type);
}
export function hasDoor(state, ax, ay, bx, by) { return state.rt.doors.has(edgeKey(ax, ay, bx, by)); }
export function canCross(state, ax, ay, bx, by) { return !wallBetween(state, ax, ay, bx, by) || hasDoor(state, ax, ay, bx, by); }

/** Liste de toutes les arêtes murées (pour le rendu). */
export function listWalls(state) {
  const out = [];
  for (let y = 0; y <= H; y++) for (let x = 0; x <= W; x++) {
    if (y <= H && x < W && (inb(x, y) || inb(x, y - 1)) && wallBetween(state, x, y - 1, x, y)) out.push({ key: `n,${x},${y}`, d: 'n', x, y });
    if (x <= W && y < H && (inb(x, y) || inb(x - 1, y)) && wallBetween(state, x - 1, y, x, y)) out.push({ key: `w,${x},${y}`, d: 'w', x, y });
  }
  return out;
}

export function removeOrphanDoors(state) {
  state.world.doors = state.world.doors.filter((k) => {
    const e = parseEdge(k);
    return wallBetween(state, e.a[0], e.a[1], e.b[0], e.b[1]);
  });
  state.rt.doors = new Set(state.world.doors);
}

// ---------------------------------------------------------------- Praticabilité et navigation

export function tileWalkable(state, x, y) {
  if (!inb(x, y)) return false;
  const i = idx(x, y);
  return WALKABLE_TERRAIN.has(state.world.terrain[i]) && !BLOCKED[i] && !state.rt.furnAt[i];
}

export function buildNav(state) {
  const rt = state.rt;
  const walk = new Uint8Array(W * H);
  const cost = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = idx(x, y);
    walk[i] = tileWalkable(state, x, y) ? 1 : 0;
    const t = state.world.terrain[i];
    let c = 1;
    if (!rt.roomAt[i]) c = t === TERRAIN.PATH || t === TERRAIN.ROAD || t === TERRAIN.BRIDGE ? 1 : 1.7;
    if (rt.seatAt[i]) c += 4;
    cost[i] = c;
  }
  const nav = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = idx(x, y);
    if (!walk[i]) continue;
    let bits = 0;
    for (let d = 0; d < 4; d++) {
      const nx = x + DIRS8[d][0], ny = y + DIRS8[d][1];
      if (inb(nx, ny) && walk[idx(nx, ny)] && canCross(state, x, y, nx, ny)) bits |= 1 << d;
    }
    nav[i] = bits;
  }
  // Diagonales : autorisées seulement si les deux chemins en L sont libres (pas de coupe de coin).
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = idx(x, y);
    if (!walk[i]) continue;
    for (let d = 4; d < 8; d++) {
      const [dx, dy] = DIRS8[d];
      const nx = x + dx, ny = y + dy;
      if (!inb(nx, ny) || !walk[idx(nx, ny)]) continue;
      const dX = dx > 0 ? 0 : 1, dY = dy > 0 ? 2 : 3;
      const viaX = (nav[i] & (1 << dX)) && (nav[idx(x + dx, y)] & (1 << dY));
      const viaY = (nav[i] & (1 << dY)) && (nav[idx(x, y + dy)] & (1 << dX));
      if (viaX && viaY) nav[i] |= 1 << d;
    }
  }
  rt.walk = walk; rt.cost = cost; rt.nav = nav;
  rt.navVersion = (rt.navVersion || 0) + 1;
}

/** Permission d'entrer dans une pièce selon le rôle de l'agent. */
export function makeAllow(state, agent) {
  if (!agent || agent.kind === 'staff') return () => true;
  const own = agent.roomId || 0;
  const target = agent.goalRoom || 0;
  return (rid) => {
    if (!rid || rid === own || rid === target) return true;
    const r = state.world.rooms[rid];
    return !!(r && ROOM_TYPES[r.type].public);
  };
}

/** Accessibilité depuis la route : pièces publiques atteignables, privées atteignables par une porte. */
export function computeReachability(state) {
  const rt = state.rt;
  const seen = new Uint8Array(W * H);
  const allow = makeAllow(state, { kind: 'guest' });
  const [sx, sy] = SPOTS.roadStart;
  const q = [idx(sx, sy)];
  seen[q[0]] = 1;
  while (q.length) {
    const i = q.pop();
    const x = i % W, y = (i / W) | 0;
    const bits = rt.nav[i];
    for (let d = 0; d < 4; d++) {
      if (!(bits & (1 << d))) continue;
      const n = idx(x + DIRS8[d][0], y + DIRS8[d][1]);
      if (seen[n] || !allow(rt.roomAt[n])) continue;
      seen[n] = 1; q.push(n);
    }
  }
  rt.guestReach = seen;
  for (const room of Object.values(state.world.rooms)) {
    const st = rt.roomStats[room.id];
    if (!st) continue;
    if (ROOM_TYPES[room.type].public) st.reachable = room.tiles.some((i) => seen[i]);
    else {
      // privée : une case de la pièce doit communiquer avec une case atteinte
      st.reachable = room.tiles.some((i) => {
        const x = i % W, y = (i / W) | 0;
        return DIRS4.some(([dx, dy]) => {
          const nx = x + dx, ny = y + dy;
          return inb(nx, ny) && seen[idx(nx, ny)] && rt.walk[i] !== undefined && canCross(state, x, y, nx, ny) && rt.walk[idx(nx, ny)];
        });
      });
    }
  }
}

// ---------------------------------------------------------------- Pièces

export function normRect(x0, y0, x1, y1) {
  return [Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1)];
}

export function checkRoomRect(state, type, ax, ay, bx, by) {
  const def = ROOM_TYPES[type];
  const [x0, y0, x1, y1] = normRect(ax, ay, bx, by);
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const res = { ok: false, reason: '', cost: 0, tiles: [], rect: [x0, y0, x1, y1], w, h, merge: [] };
  if (!def) { res.reason = 'Type inconnu'; return res; }
  if (state.tier < def.tier) { res.reason = `Débloqué au palier ${def.tier}`; return res; }
  let clearing = 0;
  const adj = new Set();
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (!inb(x, y)) { res.reason = 'Hors de la carte'; return res; }
    if (!isOwned(state, x, y)) { res.reason = 'Terrain non acheté'; return res; }
    const i = idx(x, y);
    const t = state.world.terrain[i];
    if (!BUILDABLE_TERRAIN.has(t) || BLOCKED[i]) { res.reason = 'Terrain inconstructible'; return res; }
    if (state.rt.roomAt[i]) { res.reason = 'Empiète sur une pièce existante'; return res; }
    if (state.rt.furnAt[i] || state.rt.seatAt[i] || state.rt.rugAt[i]) { res.reason = 'Un objet occupe le terrain'; return res; }
    if (t === TERRAIN.FOREST) clearing++;
    res.tiles.push(i);
    for (const [dx, dy] of DIRS4) {
      const r = roomAtTile(state, x + dx, y + dy);
      if (r && r.type === type && !def.noMerge) adj.add(r.id);
    }
  }
  res.merge = [...adj];
  const mergedArea = res.tiles.length + res.merge.reduce((s, id) => s + state.world.rooms[id].tiles.length, 0);
  if (!res.merge.length) {
    const [mw, mh] = def.min;
    if (!((w >= mw && h >= mh) || (w >= mh && h >= mw))) { res.reason = `Taille minimale ${mw}×${mh}`; return res; }
    if (def.limit && Object.values(state.world.rooms).filter((r) => r.type === type).length >= def.limit) {
      res.reason = `Une seule ${def.name.toLowerCase()} possible`; return res;
    }
  }
  if (mergedArea > def.max) { res.reason = `Surface maximale ${def.max} cases`; return res; }
  res.cost = res.tiles.length * def.costPerTile + clearing * 15;
  res.clearing = clearing;
  if (state.money < res.cost) { res.reason = 'Fonds insuffisants'; return res; }
  res.ok = true;
  return res;
}

export function buildRoom(state, type, ax, ay, bx, by, { free = false } = {}) {
  const chk = checkRoomRect(state, type, ax, ay, bx, by);
  if (!chk.ok && !(free && chk.reason === 'Fonds insuffisants')) return chk;
  const def = ROOM_TYPES[type];
  for (const i of chk.tiles) if (state.world.terrain[i] === TERRAIN.FOREST) state.world.terrain[i] = TERRAIN.GRASS;
  let room;
  if (chk.merge.length) {
    room = state.world.rooms[chk.merge[0]];
    room.tiles.push(...chk.tiles);
    for (const id of chk.merge.slice(1)) {
      const other = state.world.rooms[id];
      room.tiles.push(...other.tiles);
      for (const g of state.guests) if (g.roomId === id) g.roomId = room.id;
      delete state.world.rooms[id];
    }
  } else {
    const id = state.world.nextRoomId++;
    const n = Object.values(state.world.rooms).filter((r) => r.type === type).length + 1;
    room = { id, type, tiles: chk.tiles.slice(), floor: def.floor, wall: def.wall, clean: 100, num: n };
    state.world.rooms[id] = room;
  }
  if (!free) state.money -= chk.cost;
  rebuildIndices(state);
  if (!chk.merge.length && def.indoor) autoDoor(state, room);
  if (def.indoor) ensureLinks(state, room);
  removeOrphanDoors(state);
  rebuildIndices(state);
  return { ok: true, room, cost: free ? 0 : chk.cost, merged: chk.merge.length > 0 };
}

const DOOR_PREF = {
  bedroom: { corridor: 0, reception: 1, lounge: 2, '*public': 3, outside: 9 },
  kitchen: { restaurant: 0, corridor: 1, bar: 1, reception: 2, '*public': 3, outside: 6 },
  reception: { outside: 0, corridor: 1, '*public': 2 },
  '*': { corridor: 0, reception: 1, lounge: 1, '*public': 2, outside: 3 },
};

/** Choisit et place automatiquement une porte pour une pièce neuve. */
export function autoDoor(state, room) {
  const pref = DOOR_PREF[room.type] || DOOR_PREF['*'];
  const cands = [];
  const set = new Set(room.tiles);
  for (const i of room.tiles) {
    const x = i % W, y = (i / W) | 0;
    if (!state.rt.walk[i]) continue;
    for (const [dx, dy] of DIRS4) {
      const nx = x + dx, ny = y + dy;
      if (!inb(nx, ny) || set.has(idx(nx, ny)) || !state.rt.walk[idx(nx, ny)]) continue;
      const nr = roomAtTile(state, nx, ny);
      let score;
      if (!nr || !isIndoorType(nr.type)) score = pref.outside ?? 5;
      else if (pref[nr.type] !== undefined) score = pref[nr.type];
      else if (ROOM_TYPES[nr.type].public) score = pref['*public'] ?? 4;
      else continue; // jamais de porte vers une pièce privée
      cands.push({ score, x, y, nx, ny });
    }
  }
  if (!cands.length) return null;
  const best = Math.min(...cands.map((c) => c.score));
  const pool = cands.filter((c) => c.score === best);
  pool.sort((a, b) => a.x + a.y - (b.x + b.y));
  const c = pool[Math.floor(pool.length / 2)];
  const key = edgeKey(c.x, c.y, c.nx, c.ny);
  if (!state.world.doors.includes(key)) state.world.doors.push(key);
  state.rt.doors = new Set(state.world.doors);
  return key;
}

const LINKS = [['kitchen', 'restaurant'], ['kitchen', 'bar'], ['restaurant', 'bar']];

/** Relie automatiquement les pièces qui doivent communiquer (cuisine ↔ restaurant...). */
export function ensureLinks(state, room) {
  const set = new Set(room.tiles);
  const byNeighbor = new Map();
  for (const i of room.tiles) {
    const x = i % W, y = (i / W) | 0;
    for (const [dx, dy] of DIRS4) {
      const nx = x + dx, ny = y + dy;
      if (!inb(nx, ny) || set.has(idx(nx, ny))) continue;
      const nr = roomAtTile(state, nx, ny);
      if (!nr || !isIndoorType(nr.type)) continue;
      if (!LINKS.some(([a, b]) => (a === room.type && b === nr.type) || (b === room.type && a === nr.type))) continue;
      if (!byNeighbor.has(nr.id)) byNeighbor.set(nr.id, []);
      byNeighbor.get(nr.id).push({ x, y, nx, ny });
    }
  }
  for (const edges of byNeighbor.values()) {
    if (edges.some((e) => hasDoor(state, e.x, e.y, e.nx, e.ny))) continue;
    const ok = edges.filter((e) => state.rt.walk[idx(e.x, e.y)] && state.rt.walk[idx(e.nx, e.ny)]);
    if (!ok.length) continue;
    const e = ok[Math.floor(ok.length / 2)];
    state.world.doors.push(edgeKey(e.x, e.y, e.nx, e.ny));
  }
  state.rt.doors = new Set(state.world.doors);
}

export const DOOR_COST = 30;

/** Ajoute/retire une porte entre deux cases voisines. */
export function toggleDoor(state, ax, ay, bx, by) {
  if (!wallBetween(state, ax, ay, bx, by)) return { ok: false, reason: 'Pas de mur ici' };
  const key = edgeKey(ax, ay, bx, by);
  const has = state.world.doors.includes(key);
  if (has) {
    state.world.doors = state.world.doors.filter((k) => k !== key);
    rebuildIndices(state);
    return { ok: true, removed: true };
  }
  if (!tileWalkable(state, ax, ay) || !tileWalkable(state, bx, by)) return { ok: false, reason: 'Un objet bloque le passage' };
  const ra = roomAtTile(state, ax, ay), rb = roomAtTile(state, bx, by);
  if ((ra && !isOwned(state, ax, ay)) || (rb && !isOwned(state, bx, by))) return { ok: false, reason: 'Terrain non acheté' };
  if (state.money < DOOR_COST) return { ok: false, reason: 'Fonds insuffisants' };
  state.money -= DOOR_COST;
  state.world.doors.push(key);
  rebuildIndices(state);
  return { ok: true, added: true, cost: DOOR_COST };
}

export function roomBuildCost(room) {
  const def = ROOM_TYPES[room.type];
  return room.tiles.length * def.costPerTile;
}

export function demolishRoom(state, roomId) {
  const room = state.world.rooms[roomId];
  if (!room) return { ok: false, reason: 'Pièce introuvable' };
  if (state.guests.some((g) => g.roomId === roomId)) return { ok: false, reason: 'Chambre occupée par des clients' };
  let refund = Math.round(roomBuildCost(room) * 0.5);
  for (const f of Object.values(state.world.furniture)) {
    if (f.roomId === roomId) { refund += Math.round(FURNITURE[f.type].cost * 0.5); releaseFurniture(state, f.id); delete state.world.furniture[f.id]; }
  }
  delete state.world.rooms[roomId];
  state.money += refund;
  rebuildIndices(state);
  removeOrphanDoors(state);
  rebuildIndices(state);
  return { ok: true, refund };
}

export function paintRoom(state, roomId, { floor, wall }) {
  const room = state.world.rooms[roomId];
  if (!room) return { ok: false, reason: 'Pièce introuvable' };
  let cost = 0;
  if (floor && floor !== room.floor) {
    const f = FLOORS[floor];
    if (!f || state.tier < f.tier) return { ok: false, reason: 'Style verrouillé' };
    if (f.indoor !== ROOM_TYPES[room.type].indoor) return { ok: false, reason: 'Style inadapté à cette pièce' };
    cost += f.cost * room.tiles.length + 5;
  }
  if (wall && wall !== room.wall) {
    const w = WALLS[wall];
    if (!w || state.tier < w.tier) return { ok: false, reason: 'Style verrouillé' };
    if (!ROOM_TYPES[room.type].indoor) return { ok: false, reason: 'Pas de murs à l\'extérieur' };
    cost += w.cost * Math.ceil(room.tiles.length * 0.8) + 5;
  }
  if (state.money < cost) return { ok: false, reason: 'Fonds insuffisants' };
  state.money -= cost;
  if (floor) room.floor = floor;
  if (wall) room.wall = wall;
  computeAllRoomStats(state);
  state.rt.worldVersion++;
  return { ok: true, cost };
}

// ---------------------------------------------------------------- Mobilier

export function footprint(def, rot) { return rot % 2 ? [def.h, def.w] : [def.w, def.h]; }

/** Transforme une case locale (lx, ly) en décalage monde selon la rotation. */
export function localCell(def, rot, lx, ly) {
  const cx = lx + 0.5, cy = ly + 0.5;
  let wx, wy;
  switch (rot & 3) {
    case 0: wx = cx; wy = cy; break;
    case 1: wx = def.h - cy; wy = cx; break;
    case 2: wx = def.w - cx; wy = def.h - cy; break;
    default: wx = cy; wy = def.w - cx; break;
  }
  return [Math.floor(wx), Math.floor(wy)];
}
export function frontDir(rot) { return FRONT[rot & 3]; }

export function furnCells(f) {
  const def = FURNITURE[f.type];
  const [w, h] = footprint(def, f.rot);
  const out = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out.push([f.x + x, f.y + y]);
  return out;
}

/** Emplacements d'usage d'un meuble, en coordonnées monde. */
export function furnSpots(f) {
  const def = FURNITURE[f.type];
  if (!def.use) return [];
  const [fw, fh] = footprint(def, f.rot);
  const cx = f.x + fw / 2, cy = f.y + fh / 2;
  return def.use.spots.map((s, k) => {
    const [ox, oy] = localCell(def, f.rot, s.c[0], s.c[1]);
    const x = f.x + ox, y = f.y + oy;
    const onItem = x >= f.x && y >= f.y && x < f.x + fw && y < f.y + fh;
    let face;
    if (onItem) face = frontDir(f.rot);
    else {
      const dx = cx - (x + 0.5), dy = cy - (y + 0.5);
      face = Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)];
    }
    return { k, x, y, pose: s.pose, z: s.z || 0, face, onItem, block: onItem && !def.seat, cells: onItem && !def.seat ? furnCells(f) : null };
  });
}

export function staffSpot(f) {
  const def = FURNITURE[f.type];
  if (!def.staffSpot) return null;
  const [ox, oy] = localCell(def, f.rot, def.staffSpot[0], def.staffSpot[1]);
  return [f.x + ox, f.y + oy];
}
export function clientSpot(f) {
  const def = FURNITURE[f.type];
  const c = def.clientSpot || [0, def.h];
  const [ox, oy] = localCell(def, f.rot, c[0], c[1]);
  return [f.x + ox, f.y + oy];
}

/** Rotation par défaut : dos au mur le plus proche, ou face à une table pour une chaise. */
export function suggestRotation(state, type, x, y) {
  const def = FURNITURE[type];
  if (def.autoFace) {
    for (let r = 0; r < 4; r++) {
      const [dx, dy] = FRONT[r];
      const fid = state.rt.furnAt[inb(x + dx, y + dy) ? idx(x + dx, y + dy) : 0];
      if (fid && FURNITURE[state.world.furniture[fid]?.type]?.table) return r;
      if (fid && type === 'bar_stool' && state.world.furniture[fid]?.type === 'bar_counter') return r;
    }
  }
  // Dos au mur : si mur au nord -> face +y (0) ; mur à l'ouest -> face +x (1) ; etc.
  const checks = [[0, -1, 0], [-1, 0, 1], [0, 1, 2], [1, 0, 3]];
  for (const [dx, dy, r] of checks) if (wallBetween(state, x, y, x + dx, y + dy)) return r;
  return 0;
}

export function checkFurniture(state, type, x, y, rot, { free = false, ignoreId = 0 } = {}) {
  const def = FURNITURE[type];
  const res = { ok: false, reason: '', cells: [], cost: def ? def.cost : 0 };
  if (!def) { res.reason = 'Objet inconnu'; return res; }
  if (def.special) {
    if (!(state.inventory[type] > 0) && !ignoreId) { res.reason = 'Objet unique non disponible'; return res; }
    res.cost = 0;
  } else if (state.tier < def.tier) { res.reason = `Débloqué au palier ${def.tier}`; return res; }
  if (free || ignoreId) res.cost = 0;
  const [w, h] = footprint(def, rot);
  const outdoorDef = def.rooms === 'outdoor';
  let roomId = null;
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
    if (!inb(xx, yy)) { res.reason = 'Hors de la carte'; return res; }
    const i = idx(xx, yy);
    const rid = state.rt.roomAt[i];
    if (roomId === null) roomId = rid; else if (roomId !== rid) { res.reason = 'Doit tenir dans une seule pièce'; return res; }
    const room = rid ? state.world.rooms[rid] : null;
    if (room) {
      const allowed = def.rooms === 'indoor' ? ROOM_TYPES[room.type].indoor
        : outdoorDef ? !ROOM_TYPES[room.type].indoor
          : def.rooms.includes(room.type);
      if (!allowed) { res.reason = `Ne se place pas dans : ${ROOM_TYPES[room.type].name}`; return res; }
    } else {
      if (!(outdoorDef || (Array.isArray(def.rooms) && def.rooms.includes('garden')))) { res.reason = 'Doit être placé dans une pièce adaptée'; return res; }
      if (!isOwned(state, xx, yy)) { res.reason = 'Terrain non acheté'; return res; }
      const t = state.world.terrain[i];
      if (!(t === TERRAIN.GRASS || t === TERRAIN.SAND || t === TERRAIN.PATH) || BLOCKED[i]) { res.reason = 'Terrain inadapté'; return res; }
    }
    const other = def.walkable ? state.rt.rugAt[i] : state.rt.furnAt[i] || state.rt.seatAt[i];
    if (other && other !== ignoreId) { res.reason = 'Emplacement occupé'; return res; }
    if (!def.walkable && isDoorTile(state, xx, yy)) { res.reason = 'Bloquerait une porte'; return res; }
    res.cells.push([xx, yy]);
  }
  res.roomId = roomId || 0;
  if (state.money < res.cost) { res.reason = 'Fonds insuffisants'; return res; }
  if (!def.walkable && !def.seat && !connectivityOk(state, { type, x, y, rot, id: -1 }, res.roomId, ignoreId)) {
    res.reason = 'Bloquerait un passage'; return res;
  }
  res.ok = true;
  return res;
}

function isDoorTile(state, x, y) {
  for (const [dx, dy] of DIRS4) if (hasDoor(state, x, y, x + dx, y + dy)) return true;
  return false;
}

/** Vérifie qu'après placement, portes, emplacements et la route restent reliés. */
function connectivityOk(state, f, roomId, ignoreId) {
  const rt = state.rt;
  const blocked = new Set(furnCells(f).map(([x, y]) => idx(x, y)));
  const ignoreCells = new Set();
  if (ignoreId && state.world.furniture[ignoreId]) for (const [x, y] of furnCells(state.world.furniture[ignoreId])) ignoreCells.add(idx(x, y));
  const walk = (x, y) => {
    if (!inb(x, y)) return false;
    const i = idx(x, y);
    if (blocked.has(i)) return false;
    if (ignoreCells.has(i)) return WALKABLE_TERRAIN.has(state.world.terrain[i]) && !BLOCKED[i];
    return rt.walk[i] === 1;
  };
  const inScope = roomId ? (i) => rt.roomAt[i] === roomId : () => true;
  const room = roomId ? state.world.rooms[roomId] : null;
  // Points importants : cases intérieures des portes, emplacements d'usage, postes du personnel.
  const important = [];
  if (room) {
    for (const i of room.tiles) {
      const x = i % W, y = (i / W) | 0;
      if (isDoorTile(state, x, y)) important.push(i);
    }
  }
  const items = Object.values(state.world.furniture).filter((o) => o.id !== ignoreId && (roomId ? o.roomId === roomId : !o.roomId));
  items.push(f);
  for (const o of items) {
    for (const s of furnSpots(o)) important.push({ x: s.x, y: s.y, block: s.block, cells: s.cells || [[s.x, s.y]] });
    const ss = staffSpot(o); if (ss) important.push(idx(ss[0], ss[1]));
    if (FURNITURE[o.type].clientSpot) { const cs = clientSpot(o); important.push(idx(cs[0], cs[1])); }
  }
  // Chaises autour des tables : la chaise elle-même doit rester accessible (elle est praticable).
  if (!roomId) {
    // Extérieur : la réception doit rester accessible depuis la route.
    const [sx, sy] = SPOTS.roadStart;
    const comp = flood(state, sx, sy, walk, () => true);
    for (const r of Object.values(state.world.rooms)) {
      if (r.type !== 'reception') continue;
      for (const k of state.world.doors) {
        const e = parseEdge(k);
        const ia = inb(e.a[0], e.a[1]) ? idx(e.a[0], e.a[1]) : -1, ib = idx(e.b[0], e.b[1]);
        const touches = (ia >= 0 && rt.roomAt[ia] === r.id && !rt.roomAt[ib]) || (rt.roomAt[ib] === r.id && ia >= 0 && !rt.roomAt[ia]);
        if (touches) {
          const out = rt.roomAt[ib] === r.id ? ia : ib;
          if (!comp.has(out)) return false;
        }
      }
    }
  }
  if (!important.length) return true;
  // Composante à partir du premier point praticable important.
  const pts = important.map((p) => (typeof p === 'number' ? { x: p % W, y: (p / W) | 0, block: false, cells: [[p % W, (p / W) | 0]] } : p));
  const nearComp = (comp, cells) => cells.some(([cx, cy]) => DIRS4.some(([dx, dy]) => inb(cx + dx, cy + dy) && comp.has(idx(cx + dx, cy + dy)) && canCross(state, cx, cy, cx + dx, cy + dy)));
  let start = pts.find((p) => !p.block && walk(p.x, p.y));
  if (!start) {
    // Uniquement des objets bloquants : partir d'une case praticable de la pièce.
    const tiles = room ? room.tiles : [];
    const t = tiles.find((i) => walk(i % W, (i / W) | 0));
    if (t === undefined) return !room;
    start = { x: t % W, y: (t / W) | 0 };
  }
  const comp = flood(state, start.x, start.y, walk, (i) => inScope(i));
  for (const p of pts) {
    if (p.block || !walk(p.x, p.y)) { if (!nearComp(comp, p.cells)) return false; }
    else if (!comp.has(idx(p.x, p.y))) return false;
  }
  return true;
}

function flood(state, sx, sy, walk, scope) {
  const seen = new Set();
  if (!walk(sx, sy)) return seen;
  const st = [idx(sx, sy)];
  seen.add(st[0]);
  while (st.length) {
    const i = st.pop();
    const x = i % W, y = (i / W) | 0;
    for (const [dx, dy] of DIRS4) {
      const nx = x + dx, ny = y + dy;
      if (!inb(nx, ny)) continue;
      const n = idx(nx, ny);
      if (seen.has(n) || !walk(nx, ny) || !scope(n) || !canCross(state, x, y, nx, ny)) continue;
      seen.add(n); st.push(n);
    }
  }
  return seen;
}

export function placeFurniture(state, type, x, y, rot, opts = {}) {
  const chk = checkFurniture(state, type, x, y, rot, opts);
  if (!chk.ok) return chk;
  const def = FURNITURE[type];
  const id = state.world.nextFurnId++;
  state.world.furniture[id] = { id, type, x, y, rot: rot & 3, roomId: chk.roomId };
  if (def.special) state.inventory[type] = Math.max(0, (state.inventory[type] || 0) - 1);
  state.money -= chk.cost;
  rebuildIndices(state);
  return { ok: true, id, cost: chk.cost };
}

export function moveFurniture(state, id, x, y, rot) {
  const f = state.world.furniture[id];
  if (!f) return { ok: false, reason: 'Objet introuvable' };
  const chk = checkFurniture(state, f.type, x, y, rot, { ignoreId: id });
  if (!chk.ok) return chk;
  releaseFurniture(state, id);
  f.x = x; f.y = y; f.rot = rot & 3;
  rebuildIndices(state);
  return { ok: true };
}

/** Libère les réservations d'un meuble (les agents qui l'utilisaient choisiront autre chose). */
export function releaseFurniture(state, id) {
  for (const g of state.guests) {
    if (g.act && g.act.furnId === id) { g.act = null; g.state = 'idle'; g.path = null; }
  }
}

export function sellFurniture(state, id) {
  const f = state.world.furniture[id];
  if (!f) return { ok: false, reason: 'Objet introuvable' };
  const def = FURNITURE[f.type];
  if (def.capacity && f.roomId) {
    const occ = state.guests.find((g) => g.roomId === f.roomId);
    if (occ) {
      const cap = state.rt.roomStats[f.roomId]?.capacity || 0;
      if (cap - def.capacity < occ.size) return { ok: false, reason: 'Des clients dorment dans ce lit' };
    }
  }
  releaseFurniture(state, id);
  delete state.world.furniture[id];
  const refund = def.special ? 0 : Math.round(def.cost * 0.5);
  if (def.special) state.inventory[f.type] = (state.inventory[f.type] || 0) + 1;
  state.money += refund;
  rebuildIndices(state);
  return { ok: true, refund };
}

// ---------------------------------------------------------------- Statistiques des pièces

export function computeAllRoomStats(state) {
  const rt = state.rt;
  rt.roomStats = {};
  const byRoom = {};
  for (const f of Object.values(state.world.furniture)) (byRoom[f.roomId || 0] ||= []).push(f);
  for (const room of Object.values(state.world.rooms)) rt.roomStats[room.id] = roomStats(state, room, byRoom[room.id] || []);
  // Emplacements utilisables et places assises fonctionnelles.
  rt.usables = [];
  rt.diningSeats = [];
  rt.gameSeats = [];
  rt.barSeats = [];
  for (const f of Object.values(state.world.furniture)) {
    const def = FURNITURE[f.type];
    const room = f.roomId ? state.world.rooms[f.roomId] : null;
    if (def.seat && def.autoFace) {
      const [dx, dy] = frontDir(f.rot);
      const tid = inb(f.x + dx, f.y + dy) ? rt.furnAt[idx(f.x + dx, f.y + dy)] : 0;
      const t = tid ? state.world.furniture[tid] : null;
      const tdef = t ? FURNITURE[t.type] : null;
      if (tdef && tdef.table === 'dining' && room && (room.type === 'restaurant' || room.type === 'terrace' || room.type === 'bar' || room.type === 'lounge')) {
        rt.diningSeats.push({ furnId: f.id, tableId: t.id, roomId: f.roomId, x: f.x, y: f.y, face: [dx, dy] });
        continue;
      }
      if (tdef && tdef.table === 'games') {
        rt.gameSeats.push({ furnId: f.id, tableId: t.id, roomId: f.roomId, x: f.x, y: f.y, face: [dx, dy] });
        continue;
      }
      if (t && t.type === 'bar_counter') {
        rt.barSeats.push({ furnId: f.id, tableId: t.id, roomId: f.roomId, x: f.x, y: f.y, face: [dx, dy] });
        continue;
      }
    }
    if (room && room.type === 'bar' && def.seat) {
      for (const s of furnSpots(f)) rt.barSeats.push({ furnId: f.id, spot: s.k, roomId: f.roomId, x: s.x, y: s.y, face: s.face });
      if (def.autoFace) continue;
    }
    if (def.use && def.use.kind !== 'sleep') rt.usables.push({ furnId: f.id, kind: def.use.kind, roomType: room ? room.type : 'garden', roomId: f.roomId || 0 });
  }
  for (const s of rt.gameSeats) rt.usables.push({ furnId: s.furnId, kind: 'fun', roomType: state.world.rooms[s.roomId]?.type || 'games', roomId: s.roomId, gameSeat: true });
  // Agrégats globaux.
  const agg = { bedrooms: 0, capacity: 0, byType: {}, standing: [0, 0, 0], stockCap: {}, kitchenQ: 0, decorTotal: 0, gardenDecor: 0 };
  for (const room of Object.values(state.world.rooms)) {
    const st = rt.roomStats[room.id];
    agg.byType[room.type] = (agg.byType[room.type] || 0) + 1;
    if (room.type === 'bedroom' && st.capacity > 0) { agg.bedrooms++; agg.capacity += st.capacity; agg.standing[st.standing]++; }
    agg.decorTotal += st.decor;
    if (room.type === 'kitchen') agg.kitchenQ = Math.max(agg.kitchenQ, st.kitchen);
  }
  for (const f of Object.values(state.world.furniture)) {
    const def = FURNITURE[f.type];
    if (def.stockCap) for (const [k, v] of Object.entries(def.stockCap)) agg.stockCap[k] = (agg.stockCap[k] || 0) + v;
    const room = f.roomId ? state.world.rooms[f.roomId] : null;
    if (!room || room.type === 'garden' || room.type === 'terrace') { if (def.decor > 0 && !def.use) agg.gardenDecor += 1; agg.decorTotal += def.decor * 0.5; }
  }
  rt.agg = agg;
}

export function roomStats(state, room, items) {
  const def = ROOM_TYPES[room.type];
  const st = { area: room.tiles.length, capacity: 0, comfort: 0, decor: 0, warmth: 0, kitchen: 0, counts: {}, missing: [], ok: true, standing: 0, points: 0, beds: 0, bedComfort: 0, reachable: true };
  for (const f of items) {
    const fd = FURNITURE[f.type];
    st.counts[f.type] = (st.counts[f.type] || 0) + 1;
    st.decor += fd.decor || 0;
    st.warmth += fd.warmth || 0;
    st.kitchen += fd.kitchen || 0;
    if (fd.capacity) { st.capacity += fd.capacity; st.beds++; st.bedComfort = Math.max(st.bedComfort, fd.comfort); }
    else st.comfort += fd.comfort || 0;
  }
  const fl = FLOORS[room.floor], wl = def.indoor ? WALLS[room.wall] : null;
  if (fl) { st.decor += fl.decor; st.comfort += fl.comfort; }
  if (wl) st.decor += wl.decor;
  for (const req of def.required) {
    let has;
    if (req === '@bed') has = st.capacity > 0;
    else if (req === '@table') has = items.some((f) => FURNITURE[f.type].table === 'dining');
    else has = (st.counts[req] || 0) > 0;
    if (!has) { st.ok = false; st.missing.push(req); }
  }
  if (room.type === 'bedroom') {
    st.points = Math.round(st.comfort + st.bedComfort + 0.7 * st.decor + 1.5 * Math.max(0, st.area - 2 * Math.max(1, st.capacity)));
    st.standing = st.points >= STANDING_THRESHOLDS[2] && st.area >= 9 ? 2 : st.points >= STANDING_THRESHOLDS[1] ? 1 : 0;
  }
  st.decorDensity = st.decor / Math.max(4, st.area);
  return st;
}

export function requiredLabel(req) {
  if (req === '@bed') return 'un lit';
  if (req === '@table') return 'une table';
  return FURNITURE[req] ? FURNITURE[req].name.toLowerCase() : req;
}
