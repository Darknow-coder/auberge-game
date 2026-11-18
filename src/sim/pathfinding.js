// A* sur la grille de navigation 8 directions (tas binaire).
import { W, H, idx, inb, DIRS8, canCross } from './world.js';

class Heap {
  constructor() { this.a = []; this.p = []; }
  push(v, pr) {
    const a = this.a, p = this.p;
    a.push(v); p.push(pr);
    let i = a.length - 1;
    while (i > 0) {
      const j = (i - 1) >> 1;
      if (p[j] <= p[i]) break;
      [a[i], a[j]] = [a[j], a[i]]; [p[i], p[j]] = [p[j], p[i]];
      i = j;
    }
  }
  pop() {
    const a = this.a, p = this.p;
    const top = a[0];
    const lv = a.pop(), lp = p.pop();
    if (a.length) {
      a[0] = lv; p[0] = lp;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && p[l] < p[m]) m = l;
        if (r < a.length && p[r] < p[m]) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]]; [p[i], p[m]] = [p[m], p[i]];
        i = m;
      }
    }
    return top;
  }
  get size() { return this.a.length; }
}

const G = new Float32Array(W * H);
const FROM = new Int32Array(W * H);
const STAMP = new Uint32Array(W * H);
const CLOSED = new Uint32Array(W * H);
let stamp = 1;

/**
 * Cherche un chemin de (sx, sy) vers un but.
 * goal : { x, y } ou { test(x, y) -> bool, x, y } (x, y servent d'heuristique).
 * allow(roomId) : autorise l'entrée dans une pièce.
 * Renvoie la liste des cases [x, y] (départ exclu), [] si déjà arrivé, null si impossible.
 */
export function findPath(state, sx, sy, goal, allow = () => true, maxNodes = 4000) {
  const rt = state.rt;
  const test = goal.test || ((x, y) => x === goal.x && y === goal.y);
  if (test(sx, sy)) return [];
  stamp++;
  if (stamp > 0xfffffff0) { STAMP.fill(0); CLOSED.fill(0); stamp = 1; }
  const s = idx(sx, sy);
  const hx = goal.x, hy = goal.y;
  const h = (x, y) => { const dx = Math.abs(x - hx), dy = Math.abs(y - hy); return (dx + dy) + (1.4142 - 2) * Math.min(dx, dy); };
  const open = new Heap();
  G[s] = 0; FROM[s] = -1; STAMP[s] = stamp;
  open.push(s, h(sx, sy));
  let expanded = 0;
  while (open.size) {
    const i = open.pop();
    if (CLOSED[i] === stamp) continue;
    CLOSED[i] = stamp;
    const x = i % W, y = (i / W) | 0;
    if (i !== s && test(x, y)) return rebuild(i, s);
    if (++expanded > maxNodes) break;
    let bits = rt.nav[i];
    if (i === s && !rt.walk[i]) {
      // Départ sur une case bloquée (lit, sauna...) : on sort par les voisins praticables.
      bits = 0;
      for (let d = 0; d < 4; d++) {
        const nx = x + DIRS8[d][0], ny = y + DIRS8[d][1];
        if (inb(nx, ny) && rt.walk[idx(nx, ny)] && canCross(state, x, y, nx, ny)) bits |= 1 << d;
      }
    }
    if (!bits) continue;
    for (let d = 0; d < 8; d++) {
      if (!(bits & (1 << d))) continue;
      const nx = x + DIRS8[d][0], ny = y + DIRS8[d][1];
      const n = idx(nx, ny);
      if (CLOSED[n] === stamp) continue;
      const rid = rt.roomAt[n];
      if (rid && rid !== rt.roomAt[s] && !allow(rid)) continue;
      const step = (d < 4 ? 1 : 1.4142) * rt.cost[n];
      const g = G[i] + step;
      if (STAMP[n] !== stamp || g < G[n]) {
        STAMP[n] = stamp; G[n] = g; FROM[n] = i;
        open.push(n, g + h(nx, ny) * 0.999);
      }
    }
  }
  return null;
}

function rebuild(end, start) {
  const out = [];
  let i = end;
  while (i !== start && i >= 0) { out.push([i % W, (i / W) | 0]); i = FROM[i]; }
  out.reverse();
  return out;
}

/** But « à côté d'une des cases » d'un objet bloquant (lit, sauna, bain). */
export function adjacentGoal(state, cells) {
  const set = new Set(cells.map(([x, y]) => idx(x, y)));
  const [tx, ty] = cells[0];
  return {
    x: tx, y: ty,
    test: (x, y) => {
      if (state.rt.walk[idx(x, y)] !== 1) return false;
      for (const [dx, dy] of DIRS8.slice(0, 4)) {
        const nx = x + dx, ny = y + dy;
        if (inb(nx, ny) && set.has(idx(nx, ny)) && canCross(state, x, y, nx, ny)) return true;
      }
      return false;
    },
  };
}
