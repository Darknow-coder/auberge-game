// Pré-rendu du sol : terrain, chemins, eau, sols des pièces, occlusion ambiante.
import { TERRAIN, MAP_W, MAP_H } from '../data/constants.js';
import { FLOORS, ROOM_TYPES } from '../data/rooms.js';
import { hash2, shade, mix } from '../core/util.js';
import { iso, poly, HW, HH } from './iso.js';

export const MARGIN = 6;
const T = TERRAIN;

export const GRASS = [
  ['#84b658', '#80b255', '#88ba5c'], // printemps
  ['#8eaf4e', '#8aab4b', '#92b352'], // été
  ['#a49f4d', '#a09a49', '#a8a452'], // automne
  ['#eef3f7', '#ebf1f6', '#f1f5f9'], // hiver
];
const FOREST_FLOOR = ['#5f8a45', '#677f3d', '#7d6b3a', '#dfe7ee'];
const PATH = ['#c8a676', '#c2a070', '#b8945f', '#d9d2c8'];
const ROAD = ['#bfa07a', '#b99a72', '#ad8c62', '#d5cec4'];
const SAND = ['#e2d3a8', '#e6d5a4', '#d8c495', '#eef0ee'];

export function groundBounds() {
  const m = MARGIN;
  const x0 = (-m - (MAP_H + m)) * HW, x1 = (MAP_W + m + m) * HW;
  const y0 = (-2 * m) * HH - 8, y1 = (MAP_W + MAP_H + 2 * m) * HH + 8;
  return [x0, y0, x1, y1];
}

function tile(ctx, x, y, fill) {
  poly(ctx, [iso(x, y), iso(x + 1, y), iso(x + 1, y + 1), iso(x, y + 1)], fill);
  // léger débord pour éviter les liserés entre losanges
  ctx.strokeStyle = fill; ctx.lineWidth = 0.8; ctx.stroke();
}

function terrainAt(state, x, y) {
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) {
    if (y >= MAP_H && x >= 12 && x <= 14) return T.ROAD;
    return -1; // bordure forestière hors carte
  }
  return state.world.terrain[y * MAP_W + x];
}

function waterAt(state, x, y) { const t = terrainAt(state, x, y); return t === T.WATER || t === T.BRIDGE; }

/** Dessine tout le sol dans un canvas. */
export function renderGround(ctx, state, season) {
  const roomAt = state.rt.roomAt;
  const m = MARGIN;
  const grass = GRASS[season];
  for (let y = -m; y < MAP_H + m; y++) for (let x = -m; x < MAP_W + m; x++) {
    const t = terrainAt(state, x, y);
    const h = hash2(x, y, 11);
    let fill;
    switch (t) {
      case -1: fill = shade(FOREST_FLOOR[season], (h - 0.5) * 0.12 - 0.1); break;
      case T.FOREST: fill = shade(FOREST_FLOOR[season], (h - 0.5) * 0.1); break;
      case T.PATH: fill = shade(PATH[season], (h - 0.5) * 0.08); break;
      case T.ROAD: fill = shade(ROAD[season], (h - 0.5) * 0.06); break;
      case T.SAND: fill = shade(SAND[season], (h - 0.5) * 0.06); break;
      case T.WATER: case T.BRIDGE: fill = season === 3 ? '#cfe3ee' : '#4f8fae'; break;
      case T.ROCK: fill = shade(grass[0], -0.08); break;
      default: fill = grass[Math.floor(h * 3)];
    }
    tile(ctx, x, y, fill);
  }
  // Taches de couleur douces pour casser la grille
  for (let y = -m; y < MAP_H + m; y++) for (let x = -m; x < MAP_W + m; x++) {
    const t = terrainAt(state, x, y);
    if (t !== T.GRASS && t !== -1 && t !== T.FOREST) continue;
    const h = hash2(x, y, 99);
    if (h > 0.35) continue;
    const [cx, cy] = iso(x + hash2(x, y, 98), y + hash2(x, y, 97));
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, 34);
    const c = h < 0.17 ? (season === 3 ? 'rgba(200,215,230,0.25)' : 'rgba(40,70,20,0.10)') : (season === 3 ? 'rgba(255,255,255,0.35)' : 'rgba(255,240,170,0.10)');
    g.addColorStop(0, c); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy, 40, 20, 0, 0, 7); ctx.fill();
  }
  // Eau : dégradé de profondeur
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const t = terrainAt(state, x, y);
    if (t !== T.WATER && t !== T.BRIDGE) continue;
    let depth = 0;
    for (let r = 1; r <= 3; r++) if (waterAt(state, x + r, y) && waterAt(state, x - r, y) && waterAt(state, x, y + r) && waterAt(state, x, y - r)) depth = r;
    const col = season === 3 ? mix('#dcebf3', '#b9d4e3', depth / 3) : mix('#5aa3bf', '#2f6f92', depth / 3);
    tile(ctx, x, y, col);
    if (season === 3 && hash2(x, y, 4) < 0.25) { const [px, py] = iso(x + 0.5, y + 0.5); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(px - 10, py - 2); ctx.lineTo(px + 4, py + 3); ctx.lineTo(px + 12, py); ctx.stroke(); }
  }
  // Bords des chemins et de l'eau adoucis (petits cailloux, herbes)
  for (let y = -m; y < MAP_H + m; y++) for (let x = -m; x < MAP_W + m; x++) {
    const t = terrainAt(state, x, y);
    const [cx, cy] = iso(x + 0.5, y + 0.5);
    const h1 = hash2(x, y, 21), h2 = hash2(x, y, 22), h3 = hash2(x, y, 23);
    if (t === T.GRASS || t === -1 || t === T.FOREST) {
      if (roomAt && x >= 0 && y >= 0 && x < MAP_W && y < MAP_H && roomAt[y * MAP_W + x]) continue;
      // touffes d'herbe
      const n = season === 3 ? 1 : 3;
      for (let k = 0; k < n; k++) {
        const px = cx + (hash2(x, y, 30 + k) - 0.5) * 40, py = cy + (hash2(x, y, 40 + k) - 0.5) * 18;
        ctx.strokeStyle = season === 3 ? 'rgba(160,180,200,0.35)' : shade(grass[2], -0.25);
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(px - 2, py); ctx.lineTo(px - 3, py - 4); ctx.moveTo(px, py); ctx.lineTo(px, py - 5); ctx.moveTo(px + 2, py); ctx.lineTo(px + 3, py - 4); ctx.stroke();
      }
      // fleurs des prés / feuilles mortes
      if (t === T.GRASS && season < 3 && h1 < (season === 0 ? 0.35 : season === 1 ? 0.22 : 0.3)) {
        const cols = season === 2 ? ['#c9672e', '#d98a3a', '#a8502a'] : ['#f4f0e6', '#f2c14e', '#e46a8a', '#9b7fe0'];
        for (let k = 0; k < 4; k++) {
          ctx.fillStyle = cols[Math.floor(hash2(x, y, 50 + k) * cols.length)];
          const px = cx + (hash2(x, y, 60 + k) - 0.5) * 36, py = cy + (hash2(x, y, 70 + k) - 0.5) * 16;
          ctx.beginPath(); ctx.arc(px, py, season === 2 ? 1.8 : 1.4, 0, 7); ctx.fill();
        }
      }
    } else if (t === T.PATH || t === T.ROAD) {
      for (let k = 0; k < 4; k++) {
        ctx.fillStyle = season === 3 ? 'rgba(150,140,130,0.35)' : 'rgba(110,85,55,0.35)';
        const px = cx + (hash2(x, y, 80 + k) - 0.5) * 34, py = cy + (hash2(x, y, 90 + k) - 0.5) * 14;
        ctx.beginPath(); ctx.ellipse(px, py, 1.8, 1.1, 0, 0, 7); ctx.fill();
      }
      if (t === T.ROAD) { ctx.strokeStyle = 'rgba(90,70,45,0.25)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx - 14, cy - 3); ctx.lineTo(cx + 2, cy + 5); ctx.moveTo(cx - 4, cy - 6); ctx.lineTo(cx + 12, cy + 2); ctx.stroke(); }
    } else if (t === T.ROCK) {
      const g = ctx.createLinearGradient(cx - 14, cy - 14, cx + 14, cy + 6);
      g.addColorStop(0, '#b9b3a8'); g.addColorStop(1, '#7f786d');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(cx - 16, cy + 3); ctx.lineTo(cx - 10, cy - 10 - h2 * 8); ctx.lineTo(cx + 3, cy - 14 - h3 * 6); ctx.lineTo(cx + 16, cy - 2); ctx.lineTo(cx + 8, cy + 6); ctx.closePath(); ctx.fill();
      if (season === 3) { ctx.fillStyle = '#f4f7fb'; ctx.beginPath(); ctx.moveTo(cx - 10, cy - 9 - h2 * 8); ctx.lineTo(cx + 3, cy - 14 - h3 * 6); ctx.lineTo(cx + 10, cy - 7); ctx.lineTo(cx - 4, cy - 5); ctx.fill(); }
    } else if (t === T.BRIDGE) {
      const p = (a, b) => iso(x + a, y + b, 0.08);
      poly(ctx, [p(0, 0.08), p(1, 0.08), p(1, 0.92), p(0, 0.92)], '#a07246', 'rgba(60,35,15,.5)');
      ctx.strokeStyle = 'rgba(60,35,15,0.45)'; ctx.lineWidth = 0.8;
      for (let k = 1; k < 5; k++) { const [a1, b1] = p(k / 5, 0.08), [a2, b2] = p(k / 5, 0.92); ctx.beginPath(); ctx.moveTo(a1, b1); ctx.lineTo(a2, b2); ctx.stroke(); }
    }
    // Rive : liseré clair entre eau et terre
    if (t === T.WATER && season !== 3) {
      for (const [dx, dy, a, b] of [[0, -1, [0, 0], [1, 0]], [-1, 0, [0, 0], [0, 1]], [0, 1, [0, 1], [1, 1]], [1, 0, [1, 0], [1, 1]]]) {
        const nt = terrainAt(state, x + dx, y + dy);
        if (nt === T.WATER || nt === T.BRIDGE || nt === -1) continue;
        const [ax, ay] = iso(x + a[0], y + a[1]), [bx, by] = iso(x + b[0], y + b[1]);
        ctx.strokeStyle = 'rgba(230,240,235,0.55)'; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      }
    }
  }
  renderFloors(ctx, state, season);
}

function renderFloors(ctx, state, season) {
  const rt = state.rt;
  for (const room of Object.values(state.world.rooms)) {
    const fl = FLOORS[room.floor] || FLOORS.parquet_clair;
    const indoor = ROOM_TYPES[room.type].indoor;
    for (const i of room.tiles) {
      const x = i % MAP_W, y = (i / MAP_W) | 0;
      drawFloorTile(ctx, room.floor, fl, x, y, season, indoor);
    }
    // Ombre portée des murs sur le sol (occlusion ambiante)
    if (indoor) {
      for (const i of room.tiles) {
        const x = i % MAP_W, y = (i / MAP_W) | 0;
        const nb = (dx, dy) => { const nx = x + dx, ny = y + dy; return nx >= 0 && ny >= 0 && nx < MAP_W && ny < MAP_H ? rt.roomAt[ny * MAP_W + nx] : 0; };
        const shadeEdge = (a, b, c, d) => {
          const g = ctx.createLinearGradient(a[0], a[1], c[0], c[1]);
          g.addColorStop(0, 'rgba(40,25,15,0.28)'); g.addColorStop(1, 'rgba(40,25,15,0)');
          poly(ctx, [a, b, d, c], g);
        };
        if (nb(0, -1) !== room.id) shadeEdge(iso(x, y), iso(x + 1, y), iso(x, y + 0.28), iso(x + 1, y + 0.28));
        if (nb(-1, 0) !== room.id) shadeEdge(iso(x, y), iso(x, y + 1), iso(x + 0.28, y), iso(x + 0.28, y + 1));
      }
    } else if (room.type === 'garden') {
      // bordure de pierres
      for (const i of room.tiles) {
        const x = i % MAP_W, y = (i / MAP_W) | 0;
        const same = (dx, dy) => rt.roomAt[(y + dy) * MAP_W + x + dx] === room.id;
        ctx.strokeStyle = season === 3 ? 'rgba(180,190,200,.8)' : '#b8ad9a'; ctx.lineWidth = 2;
        const edges = [[0, -1, [0, 0], [1, 0]], [-1, 0, [0, 0], [0, 1]], [0, 1, [0, 1], [1, 1]], [1, 0, [1, 0], [1, 1]]];
        for (const [dx, dy, a, b] of edges) {
          if (same(dx, dy)) continue;
          const [ax, ay] = iso(x + a[0], y + a[1]), [bx, by] = iso(x + b[0], y + b[1]);
          ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
        }
      }
    }
  }
}

export function drawFloorTile(ctx, id, fl, x, y, season, indoor) {
  const h = hash2(x, y, 7);
  let base = fl.colors[0];
  if (!indoor && season === 3 && id === 'herbe') base = '#e8eff4';
  else if (!indoor && season === 2 && id === 'herbe') base = '#9aa04e';
  tile(ctx, x, y, base);
  const P = (a, b) => iso(x + a, y + b);
  ctx.lineWidth = 0.8;
  switch (id) {
    case 'parquet_clair': case 'parquet_fonce': case 'terrasse': {
      ctx.strokeStyle = shade(fl.colors[1], -0.15);
      for (let k = 1; k < 4; k++) { const [a1, b1] = P(0, k / 4), [a2, b2] = P(1, k / 4); ctx.beginPath(); ctx.moveTo(a1, b1); ctx.lineTo(a2, b2); ctx.stroke(); }
      const off = h * 0.6 + 0.2;
      for (let k = 0; k < 4; k++) { const xx = (off + k * 0.37) % 1; const [a1, b1] = P(xx, k / 4), [a2, b2] = P(xx, (k + 1) / 4); ctx.beginPath(); ctx.moveTo(a1, b1); ctx.lineTo(a2, b2); ctx.stroke(); }
      if (h < 0.3) poly(ctx, [P(0, 0.25), P(1, 0.25), P(1, 0.5), P(0, 0.5)], 'rgba(255,255,255,0.05)');
      if (!indoor && season === 3) poly(ctx, [P(0.1, 0.1), P(0.9, 0.2), P(0.8, 0.9), P(0.2, 0.8)], 'rgba(240,245,250,0.7)');
      break;
    }
    case 'tomettes': {
      ctx.strokeStyle = 'rgba(90,40,25,0.4)';
      for (let k = 1; k < 3; k++) { let [a1, b1] = P(0, k / 3), [a2, b2] = P(1, k / 3); ctx.beginPath(); ctx.moveTo(a1, b1); ctx.lineTo(a2, b2); [a1, b1] = P(k / 3, 0); [a2, b2] = P(k / 3, 1); ctx.moveTo(a1, b1); ctx.lineTo(a2, b2); ctx.stroke(); }
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (hash2(x * 3 + i, y * 3 + j, 2) < 0.3) poly(ctx, [P(i / 3, j / 3), P((i + 1) / 3, j / 3), P((i + 1) / 3, (j + 1) / 3), P(i / 3, (j + 1) / 3)], 'rgba(255,220,190,0.12)');
      break;
    }
    case 'dalles': case 'paves': case 'gravier': {
      if (id === 'gravier') { for (let k = 0; k < 10; k++) { const [px, py] = P(hash2(x, y, k) , hash2(x, y, k + 20)); ctx.fillStyle = k % 2 ? 'rgba(120,110,95,.5)' : 'rgba(240,235,225,.5)'; ctx.fillRect(px - 1, py - 0.5, 2, 1.5); } break; }
      ctx.strokeStyle = 'rgba(70,65,58,0.4)';
      const n = id === 'paves' ? 3 : 2;
      for (let k = 1; k < n; k++) { const [a1, b1] = P(0, k / n), [a2, b2] = P(1, k / n); ctx.beginPath(); ctx.moveTo(a1, b1); ctx.lineTo(a2, b2); ctx.stroke(); }
      for (let r = 0; r < n; r++) { const xx = ((r % 2) * 0.5 + 0.5 / n * 2) % 1; const [a1, b1] = P(xx, r / n), [a2, b2] = P(xx, (r + 1) / n); ctx.beginPath(); ctx.moveTo(a1, b1); ctx.lineTo(a2, b2); ctx.stroke(); }
      if (h < 0.4) poly(ctx, [P(0, 0), P(0.5, 0), P(0.5, 0.5), P(0, 0.5)], 'rgba(255,255,255,0.06)');
      if (!indoor && season === 3) poly(ctx, [P(0.1, 0.1), P(0.9, 0.2), P(0.8, 0.9), P(0.2, 0.8)], 'rgba(240,245,250,0.6)');
      break;
    }
    case 'moquette': case 'laine': {
      poly(ctx, [P(0.08, 0.08), P(0.92, 0.08), P(0.92, 0.92), P(0.08, 0.92)], null, 'rgba(255,255,255,0.08)');
      if (h < 0.5) poly(ctx, [P(0.4, 0.4), P(0.6, 0.4), P(0.6, 0.6), P(0.4, 0.6)], 'rgba(255,230,180,0.12)');
      break;
    }
    case 'marbre': {
      ctx.strokeStyle = 'rgba(150,140,130,0.35)';
      const [a1, b1] = P(h, 0), [a2, b2] = P(1 - h * 0.5, 1);
      ctx.beginPath(); ctx.moveTo(a1, b1); ctx.quadraticCurveTo((a1 + a2) / 2 + 6, (b1 + b2) / 2, a2, b2); ctx.stroke();
      poly(ctx, [P(0, 0), P(1, 0), P(1, 1), P(0, 1)], null, 'rgba(180,170,160,0.5)');
      break;
    }
    case 'herbe': {
      if (season < 3) {
        ctx.strokeStyle = shade(base, -0.2);
        for (let k = 0; k < 4; k++) { const [px, py] = P(hash2(x, y, k + 3), hash2(x, y, k + 9)); ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - 1, py - 4); ctx.moveTo(px + 2, py); ctx.lineTo(px + 3, py - 4); ctx.stroke(); }
      }
      break;
    }
    default: break;
  }
}
