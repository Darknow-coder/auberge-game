import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, actions } from './helpers.js';
import { Rng } from '../../src/core/util.js';
import { checkRoomRect, checkFurniture, roomAtTile, wallBetween, canCross, hasDoor, makeAllow, furnSpots, staffSpot, clientSpot } from '../../src/sim/world.js';
import { findPath, adjacentGoal } from '../../src/sim/pathfinding.js';
import { SPOTS } from '../../src/data/constants.js';
import { generateTerrain } from '../../src/sim/map.js';

test('le générateur aléatoire est déterministe', () => {
  const a = new Rng(123), b = new Rng(123);
  for (let i = 0; i < 50; i++) assert.equal(a.next(), b.next());
  assert.deepEqual(generateTerrain(9), generateTerrain(9));
});

test('l\'auberge de départ est complète et accessible', () => {
  const s = newGame();
  const types = Object.values(s.world.rooms).map((r) => r.type).sort();
  assert.deepEqual(types, ['bedroom', 'bedroom', 'bedroom', 'corridor', 'garden', 'lounge', 'reception']);
  for (const r of Object.values(s.world.rooms)) {
    const st = s.rt.roomStats[r.id];
    assert.ok(st.reachable, `${r.type} ${r.id} doit être accessible`);
    assert.ok(st.ok, `${r.type} ${r.id} doit avoir son mobilier requis`);
  }
  assert.equal(s.rt.agg.bedrooms, 3);
});

test('un client trouve un chemin de la route au comptoir, sans traverser les chambres', () => {
  const s = newGame();
  const desk = Object.values(s.world.furniture).find((f) => f.type === 'desk');
  const [cx, cy] = clientSpot(desk);
  const [sx, sy] = SPOTS.roadStart;
  const path = findPath(s, sx, sy, { x: cx, y: cy }, makeAllow(s, { kind: 'guest' }));
  assert.ok(path && path.length > 10);
  for (const [x, y] of path) {
    const r = roomAtTile(s, x, y);
    assert.ok(!r || r.type !== 'bedroom', 'pas de passage par une chambre');
  }
  // Le personnel atteint son poste derrière le comptoir
  const [px, py] = staffSpot(desk);
  assert.ok(findPath(s, cx, cy, { x: px, y: py }, () => true));
});

test('les murs bloquent le passage sauf aux portes', () => {
  const s = newGame();
  // Mur entre la chambre 1 (20,16) et la chambre 2 (20,18) : pas de porte
  assert.ok(wallBetween(s, 21, 17, 21, 18));
  assert.ok(!canCross(s, 21, 17, 21, 18));
  // Porte de la chambre 1 sur le couloir
  assert.ok(hasDoor(s, 19, 17, 20, 17));
  assert.ok(canCross(s, 19, 17, 20, 17));
});

test('validation de construction : terrain, chevauchement, taille, fonds', () => {
  const s = newGame();
  assert.equal(checkRoomRect(s, 'bedroom', 20, 16, 22, 17).reason, 'Empiète sur une pièce existante');
  assert.equal(checkRoomRect(s, 'bedroom', 2, 2, 4, 4).reason, 'Terrain non acheté');
  assert.match(checkRoomRect(s, 'bedroom', 23, 16, 23, 16).reason, /Taille minimale/);
  assert.match(checkRoomRect(s, 'bar', 23, 16, 25, 18).reason, /palier 2/);
  s.money = 10;
  assert.equal(checkRoomRect(s, 'bedroom', 23, 16, 25, 17).reason, 'Fonds insuffisants');
  s.money = 5000;
  const r = actions.buildRoom(s, 'bedroom', 23, 16, 25, 17);
  assert.ok(r.ok);
  assert.equal(s.money, 5000 - 6 * 40);
  assert.equal(s.ledger.today.exp.build, 240);
});

test('une nouvelle chambre reçoit une porte et devient utilisable une fois meublée', () => {
  const s = newGame();
  s.money = 5000;
  const r = actions.buildRoom(s, 'bedroom', 20, 22, 22, 23);
  assert.ok(r.ok);
  const st0 = s.rt.roomStats[r.room.id];
  assert.ok(st0.reachable, 'porte automatique vers le couloir');
  assert.ok(!st0.ok, 'pas encore de lit');
  assert.ok(actions.placeFurniture(s, 'bed_double', 21, 22, 0).ok);
  const st = s.rt.roomStats[r.room.id];
  assert.ok(st.ok);
  assert.equal(st.capacity, 2);
  assert.equal(s.rt.agg.bedrooms, 4);
});

test('les meubles ne peuvent ni bloquer une porte ni isoler un emplacement', () => {
  const s = newGame();
  s.money = 5000;
  // (20,17) est la case intérieure de la porte de la chambre 1
  assert.equal(checkFurniture(s, 'plant', 20, 17, 0).reason, 'Bloquerait une porte');
  // Placer une armoire en (21,17) isolerait le lit (seul accès)
  assert.equal(checkFurniture(s, 'wardrobe', 21, 17, 0).reason, 'Bloquerait un passage');
  // Mauvaise pièce
  assert.match(checkFurniture(s, 'stove', 23, 20, 0).reason, /pièce|Terrain/);
  assert.match(checkFurniture(s, 'bed_single', 16, 18, 0).reason, /Ne se place pas|occupé/);
});

test('le lit est accessible par une case voisine', () => {
  const s = newGame();
  const bed = Object.values(s.world.furniture).find((f) => f.type === 'bed_double');
  const spot = furnSpots(bed)[0];
  assert.ok(spot.block);
  const path = findPath(s, 19, 22, adjacentGoal(s, spot.cells), makeAllow(s, { kind: 'guest', roomId: bed.roomId }));
  assert.ok(path, 'le client rejoint son lit');
});

test('démolition : remboursement de moitié et chambre occupée protégée', () => {
  const s = newGame();
  s.money = 5000;
  const r = actions.buildRoom(s, 'corridor', 23, 16, 23, 19);
  const before = s.money;
  const d = actions.demolishRoom(s, r.room.id);
  assert.ok(d.ok);
  assert.equal(s.money - before, Math.round(4 * 15 * 0.5));
  const bedroom = Object.values(s.world.rooms).find((x) => x.type === 'bedroom');
  s.guests.push({ id: 999, roomId: bedroom.id, act: null, members: [] });
  assert.equal(actions.demolishRoom(s, bedroom.id).reason, 'Chambre occupée par des clients');
});

test('les pièces identiques adjacentes fusionnent (sauf les chambres)', () => {
  const s = newGame();
  s.money = 9000;
  const a = actions.buildRoom(s, 'lounge', 23, 16, 25, 18);
  const b = actions.buildRoom(s, 'lounge', 26, 16, 26, 18);
  assert.ok(a.ok && b.ok && b.merged);
  assert.equal(s.world.rooms[a.room.id].tiles.length, 12);
  const c = actions.buildRoom(s, 'bedroom', 23, 19, 25, 20);
  const d = actions.buildRoom(s, 'bedroom', 23, 21, 25, 22);
  assert.ok(c.ok && d.ok && !d.merged);
});

test('outil porte : ajout et retrait', () => {
  const s = newGame();
  s.money = 1000;
  assert.equal(actions.toggleDoor(s, 21, 17, 21, 18).reason, 'Un objet bloque le passage');
  const add = actions.toggleDoor(s, 18, 18, 19, 18);
  assert.ok(add.ok && add.added);
  assert.ok(canCross(s, 18, 18, 19, 18));
  const rem = actions.toggleDoor(s, 18, 18, 19, 18);
  assert.ok(rem.ok && rem.removed);
  assert.equal(actions.toggleDoor(s, 25, 25, 25, 26).reason, 'Pas de mur ici');
});
