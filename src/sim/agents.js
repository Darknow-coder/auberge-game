// Déplacement des agents (clients et personnel) le long des chemins A*.
import { WALK_SPEED } from '../data/constants.js';
import { idx, inb, DIRS8, makeAllow } from './world.js';
import { findPath, adjacentGoal } from './pathfinding.js';

export const tileOf = (a) => [Math.floor(a.x), Math.floor(a.y)];

/**
 * Lance un déplacement. goal : { x, y } (case exacte) ou { cells: [[x,y],...] } (à côté d'un objet bloquant).
 * Renvoie true si un chemin existe.
 */
export function goTo(state, a, goal) {
  const [sx, sy] = tileOf(a);
  const allow = makeAllow(state, a);
  const g = goal.cells ? adjacentGoal(state, goal.cells) : { x: goal.x, y: goal.y };
  const path = findPath(state, sx, sy, g, allow);
  if (!path) { a.path = null; a.goal = null; return false; }
  a.path = path;
  a.pi = 0;
  a.goal = goal;
  a.navV = state.rt.navVersion;
  return true;
}

function stepValid(state, ax, ay, bx, by) {
  const i = idx(ax, ay);
  const dx = bx - ax, dy = by - ay;
  const d = DIRS8.findIndex(([x, y]) => x === dx && y === dy);
  if (d < 0) return false;
  if (!state.rt.walk[i]) return true; // départ depuis une case bloquée (lit) : toléré
  return (state.rt.nav[i] & (1 << d)) !== 0;
}

/** Avance l'agent ; renvoie 'arrived' | 'moving' | 'stuck'. */
export function stepAlong(state, a, dt, speedMul = 1) {
  if (!a.path) return 'arrived';
  if (a.navV !== state.rt.navVersion) {
    // Le monde a changé : on vérifie le reste du chemin et on recalcule si besoin.
    let ok = true;
    let [px, py] = tileOf(a);
    for (let k = a.pi; k < a.path.length; k++) {
      const [nx, ny] = a.path[k];
      if (!inb(nx, ny) || !state.rt.walk[idx(nx, ny)] || !stepValid(state, px, py, nx, ny)) { ok = false; break; }
      px = nx; py = ny;
    }
    a.navV = state.rt.navVersion;
    if (!ok) {
      const goal = a.goal;
      if (!goal || !goTo(state, a, goal)) { a.path = null; return 'stuck'; }
    }
  }
  let dist = WALK_SPEED * speedMul * (a.kind === 'staff' ? 1.45 : 1) * dt;
  while (dist > 0 && a.pi < a.path.length) {
    const [tx, ty] = a.path[a.pi];
    const cx = tx + 0.5, cy = ty + 0.5;
    const dx = cx - a.x, dy = cy - a.y;
    const d = Math.hypot(dx, dy);
    if (d > 1e-6) a.dir = [Math.abs(dx) > 0.05 ? Math.sign(dx) : 0, Math.abs(dy) > 0.05 ? Math.sign(dy) : 0];
    if (d <= dist) { a.x = cx; a.y = cy; dist -= d; a.pi++; } else { a.x += (dx / d) * dist; a.y += (dy / d) * dist; dist = 0; }
  }
  a.moving = true;
  if (a.pi >= a.path.length) { a.path = null; a.moving = false; return 'arrived'; }
  return 'moving';
}

export function placeAt(a, x, y) { a.x = x + 0.5; a.y = y + 0.5; a.path = null; }
export const distTo = (a, x, y) => Math.abs(a.x - (x + 0.5)) + Math.abs(a.y - (y + 0.5));
