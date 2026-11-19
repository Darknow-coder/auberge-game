// Rendu Canvas 2D de la zone de jeu : grille, pièces, aperçus, effets.
// Toutes les coordonnées sont en pixels CSS ; le canvas est mis à l'échelle de l'écran.
import { blockSprite, roundRect, PAD, rgba } from './blocks.js';
import { Fx } from './fx.js';
import { SHAPES } from '../game/pieces.js';
import { N, STONE, previewLines, canPlace } from '../game/board.js';
import { bombArea } from '../game/engine.js';

const easeOutBack = (t) => { const c = 1.6; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const TRAY_SCALE = 0.52;

export class GameView {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = 1;
    this.w = 0;
    this.h = 0;
    this.board = { x: 0, y: 0, size: 0, cell: 0, inset: 0 };
    this.slots = [];
    this.theme = null;
    this.symbols = false;
    this.s = null;
    this.drag = null;
    this.returning = null;
    this.bomb = null;
    this.mode = null;
    this.fits = [true, true, true];
    this.fx = new Fx();
    this.pop = new Map();
    this.spawn = [0, 0, 0];
    this.gray = null;
    this.hand = null;
    this.time = 0;
    this.hidden = new Set();
  }

  resize() {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.cv.width = Math.round(this.w * this.dpr);
    this.cv.height = Math.round(this.h * this.dpr);
    this.cv.style.width = `${this.w}px`;
    this.cv.style.height = `${this.h}px`;
  }

  /** Lit la position des emplacements DOM de la grille et du plateau de pièces. */
  layout(boardEl, trayEl) {
    const b = boardEl.getBoundingClientRect();
    const inset = Math.round(b.width * 0.028);
    const cell = (b.width - 2 * inset) / N;
    this.board = { x: b.left, y: b.top, size: b.width, cell, inset, gx: b.left + inset, gy: b.top + inset };
    const t = trayEl.getBoundingClientRect();
    if (t.height > t.width) {
      // Plateau vertical (disposition paysage) : pièces empilées.
      const sh = t.height / 3;
      this.slots = [0, 1, 2].map((i) => ({ x: t.left, y: t.top + i * sh, w: t.width, h: sh }));
    } else {
      const sw = t.width / 3;
      this.slots = [0, 1, 2].map((i) => ({ x: t.left + i * sw, y: t.top, w: sw, h: t.height }));
    }
  }

  get trayCell() {
    const c = this.board.cell * TRAY_SCALE;
    const maxBySlot = this.slots.length ? Math.min(this.slots[0].w / 5.3, this.slots[0].h / 5.3) : c;
    return Math.min(c, maxBySlot);
  }

  cellXY(x, y) {
    return [this.board.gx + x * this.board.cell, this.board.gy + y * this.board.cell];
  }

  /** Position (coin haut-gauche) et taille de case d'une pièce posée dans le plateau. */
  trayPiece(ti) {
    const p = this.s && this.s.tray[ti];
    const slot = this.slots[ti];
    if (!p || !slot) return null;
    const sh = SHAPES[p.k], c = this.trayCell;
    return { x: slot.x + (slot.w - sh.w * c) / 2, y: slot.y + (slot.h - sh.h * c) / 2, cell: c, sh };
  }

  hitTray(px, py) {
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i];
      if (px >= s.x - 10 && px <= s.x + s.w + 10 && py >= s.y - 10 && py <= s.y + s.h + 10) return i;
    }
    return -1;
  }

  /** Case de la grille sous un point (ou null). */
  cellAt(px, py) {
    const { gx, gy, cell } = this.board;
    const x = Math.floor((px - gx) / cell), y = Math.floor((py - gy) / cell);
    return x >= 0 && y >= 0 && x < N && y < N ? [x, y] : null;
  }

  insideBoard(px, py, margin = 0) {
    const b = this.board;
    return px >= b.x - margin && py >= b.y - margin && px <= b.x + b.size + margin && py <= b.y + b.size + margin;
  }

  /**
   * Position cible d'une pièce tenue dont le coin haut-gauche est en (px, py).
   * Arrondi à la case la plus proche ; si elle est occupée, essaie les cases voisines
   * (tolérance d'environ 0,6 case) pour que la pose « aimante » reste naturelle.
   */
  snap(sh, px, py) {
    const { gx, gy, cell } = this.board;
    const fx = (px - gx) / cell, fy = (py - gy) / cell;
    const c = this.s.board.c;
    const cands = [];
    for (const x of [Math.round(fx), Math.floor(fx), Math.ceil(fx)])
      for (const y of [Math.round(fy), Math.floor(fy), Math.ceil(fy)]) {
        const d = Math.hypot(x - fx, y - fy);
        if (d < 0.75 && canPlace(c, sh, x, y)) cands.push({ x, y, d });
      }
    if (!cands.length) return null;
    cands.sort((a, b) => a.d - b.d);
    return { x: cands[0].x, y: cands[0].y };
  }

  /** Met à jour l'aperçu (ombre de la pièce et lignes qui seraient complétées). */
  updateGhost() {
    const d = this.drag;
    if (!d) return;
    const p = this.s.tray[d.ti];
    if (!p) { d.ghost = null; return; }
    const sh = SHAPES[p.k];
    const g = this.snap(sh, d.x, d.y);
    if (g && (!d.ghost || d.ghost.x !== g.x || d.ghost.y !== g.y)) {
      const lines = previewLines(this.s.board.c, sh, g.x, g.y);
      d.ghost = { ...g, lines, set: new Set(lineCellsOf(lines)) };
    } else if (!g) d.ghost = null;
  }

  sprite(kind, cellCss, opts) {
    const size = Math.round(cellCss * this.dpr);
    return { img: blockSprite(this.theme, kind, size, { ...opts, symbol: this.symbols }), k: cellCss / size, pad: Math.ceil(size * PAD) };
  }

  drawBlock(kind, x, y, cell, scale = 1, opts) {
    const sp = this.sprite(kind, cell, opts);
    const full = sp.img.width * sp.k * scale;
    const off = (full - cell) / 2;
    this.ctx.drawImage(sp.img, x - off, y - off, full, full);
  }

  drawPiece(p, x, y, cell, scale = 1, alpha = 1) {
    const sh = SHAPES[p.k];
    const ctx = this.ctx;
    ctx.globalAlpha = alpha;
    sh.cells.forEach(([dx, dy], j) => this.drawBlock(p.col, x + dx * cell, y + dy * cell, cell, scale, { gem: j === p.gem }));
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------------ dessin
  frame(dt) {
    this.time += dt;
    this.fx.update(dt);
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    if (!this.s || !this.theme) return;
    const [sx, sy] = this.fx.shakeOffset();
    ctx.save();
    ctx.translate(sx, sy);
    this.drawBoard();
    this.drawCells();
    this.drawPreview();
    this.fx.drawBoardLayer(ctx);
    ctx.restore();
    this.drawTray(dt);
    this.drawHeld();
    this.drawHand();
    this.fx.drawTopLayer(ctx, this.w, this.h);
  }

  drawBoard() {
    const ctx = this.ctx, b = this.board, th = this.theme;
    const r = b.size * 0.04;
    const heat = Math.min(1, Math.max(0, ((this.s.combo || 0) - 1) / 8));
    ctx.save();
    ctx.shadowColor = heat > 0 ? rgba(th.ui.accent, 0.35 + heat * 0.5) : 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 18 + heat * 26 + (heat > 0 ? Math.sin(this.time * 6) * 4 * heat : 0);
    ctx.shadowOffsetY = heat > 0 ? 0 : 8;
    roundRect(ctx, b.x, b.y, b.size, b.size, r);
    ctx.fillStyle = th.board;
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = 1.5 + heat * 1.5;
    ctx.strokeStyle = heat > 0 ? rgba(th.ui.accent, 0.4 + heat * 0.5) : th.boardEdge;
    roundRect(ctx, b.x + 0.5, b.y + 0.5, b.size - 1, b.size - 1, r);
    ctx.stroke();
    ctx.fillStyle = th.cell;
    const g = b.cell * 0.06;
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const [cx, cy] = this.cellXY(x, y);
        roundRect(ctx, cx + g, cy + g, b.cell - 2 * g, b.cell - 2 * g, b.cell * 0.16);
        ctx.fill();
      }
  }

  drawCells() {
    const s = this.s, b = this.board, now = this.time;
    for (let i = 0; i < N * N; i++) {
      const v = s.board.c[i];
      if (!v || this.hidden.has(i)) continue;
      const x = i % N, y = (i / N) | 0;
      const [cx, cy] = this.cellXY(x, y);
      let scale = 1;
      const pt = this.pop.get(i);
      if (pt != null) {
        const k = (now - pt) / 0.22;
        if (k >= 1) this.pop.delete(i);
        else scale = k < 0 ? 1 : 1 + 0.18 * Math.sin(k * Math.PI) * (1 - k);
      }
      let kind = v;
      if (this.gray && now - this.gray > (N - 1 - y) * 0.07 + x * 0.012) kind = 'gray';
      this.drawBlock(kind, cx, cy, b.cell, scale, { gem: !!s.board.g[i] && kind !== 'gray' });
    }
  }

  drawPreview() {
    const ctx = this.ctx, b = this.board, d = this.drag;
    if (d && d.ghost) {
      const p = this.s.tray[d.ti];
      if (p) {
        const sh = SHAPES[p.k];
        const { x, y, set } = d.ghost;
        // Cases des lignes qui vont disparaître : recolorées et pulsantes.
        if (set.size) {
          const pulse = 0.25 + 0.2 * Math.sin(this.time * 10);
          for (const i of set) {
            const gx = i % N, gy = (i / N) | 0;
            const [cx, cy] = this.cellXY(gx, gy);
            if (this.s.board.c[i]) {
              const stone = this.s.board.c[i] === STONE;
              this.drawBlock(stone ? STONE : p.col, cx, cy, b.cell, 1, { gem: !!this.s.board.g[i] });
              ctx.globalAlpha = pulse;
              ctx.fillStyle = '#ffffff';
              roundRect(ctx, cx + b.cell * 0.06, cy + b.cell * 0.06, b.cell * 0.88, b.cell * 0.88, b.cell * 0.18);
              ctx.fill();
              ctx.globalAlpha = 1;
            }
          }
        }
        const alpha = set.size ? 0.85 : 0.42;
        sh.cells.forEach(([dx, dy], j) => {
          const [cx, cy] = this.cellXY(x + dx, y + dy);
          ctx.globalAlpha = alpha;
          this.drawBlock(p.col, cx, cy, b.cell, 1, { gem: j === p.gem });
        });
        ctx.globalAlpha = 1;
      }
    }
    if (this.bomb) {
      const area = bombArea(this.bomb.x, this.bomb.y);
      const pulse = 0.35 + 0.15 * Math.sin(this.time * 12);
      for (const i of area) {
        const [cx, cy] = this.cellXY(i % N, (i / N) | 0);
        ctx.fillStyle = `rgba(255, 90, 60, ${pulse})`;
        roundRect(ctx, cx + 2, cy + 2, b.cell - 4, b.cell - 4, b.cell * 0.18);
        ctx.fill();
      }
      const [cx, cy] = this.cellXY(this.bomb.x, this.bomb.y);
      ctx.strokeStyle = 'rgba(255,220,200,0.9)';
      ctx.lineWidth = 2;
      roundRect(ctx, cx - b.cell + 1, cy - b.cell + 1, b.cell * 3 - 2, b.cell * 3 - 2, b.cell * 0.25);
      ctx.stroke();
    }
  }

  drawTray(dt) {
    const ctx = this.ctx;
    for (let ti = 0; ti < 3; ti++) {
      const p = this.s.tray[ti];
      if (!p) continue;
      if (this.drag && this.drag.ti === ti) continue;
      if (this.returning && this.returning.ti === ti) continue;
      const tp = this.trayPiece(ti);
      if (!tp) continue;
      const age = this.time - this.spawn[ti];
      const k = age < 0 ? 0 : Math.min(1, age / 0.35);
      const sc = k < 1 ? easeOutBack(k) : 1;
      const fits = this.fits[ti];
      const cx = tp.x + (tp.sh.w * tp.cell) / 2, cy = tp.y + (tp.sh.h * tp.cell) / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(sc, sc);
      ctx.translate(-cx, -cy);
      if (k === 0) ctx.globalAlpha = 0;
      this.drawPiece(p, tp.x, tp.y, tp.cell, 1, fits ? 1 : 0.32);
      ctx.restore();
      if (this.mode === 'rotate' && k >= 1) {
        const slot = this.slots[ti];
        const rr = 13, bx = slot.x + slot.w - 18, by = slot.y + 16;
        ctx.fillStyle = this.theme.ui.accent;
        ctx.beginPath();
        ctx.arc(bx, by, rr, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = this.theme.ui.btnText;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(bx, by, 6, -Math.PI * 0.2, Math.PI * 1.3);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(bx + 6 * Math.cos(-Math.PI * 0.2) + 3, by + 6 * Math.sin(-Math.PI * 0.2) - 1);
        ctx.lineTo(bx + 6 * Math.cos(-Math.PI * 0.2), by + 6 * Math.sin(-Math.PI * 0.2) + 4);
        ctx.lineTo(bx + 6 * Math.cos(-Math.PI * 0.2) - 4, by + 6 * Math.sin(-Math.PI * 0.2));
        ctx.stroke();
      }
    }
    // Pièce qui revient au plateau après une pose refusée.
    const r = this.returning;
    if (r) {
      r.t += dt;
      const k = Math.min(1, r.t / 0.18);
      const tp = this.trayPiece(r.ti);
      const p = this.s.tray[r.ti];
      if (!tp || !p || k >= 1) this.returning = null;
      else {
        const e = easeOutCubic(k);
        const cell = r.cell + (tp.cell - r.cell) * e;
        this.drawPiece(p, r.x + (tp.x - r.x) * e, r.y + (tp.y - r.y) * e, cell);
      }
    }
  }

  drawHeld() {
    const d = this.drag;
    if (!d) return;
    const p = this.s.tray[d.ti];
    if (!p) return;
    const k = Math.min(1, (this.time - d.t0) / 0.1);
    const cell = d.fromCell + (this.board.cell - d.fromCell) * easeOutCubic(k);
    const sh = SHAPES[p.k];
    // Le centre de la pièce reste sous la position visée pendant le grossissement.
    const cx = d.x + (sh.w * this.board.cell) / 2, cy = d.y + (sh.h * this.board.cell) / 2;
    const x = cx - (sh.w * cell) / 2, y = cy - (sh.h * cell) / 2;
    const ctx = this.ctx;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 10;
    this.drawPiece(p, x, y, cell, 1.04);
    ctx.restore();
  }

  drawHand() {
    const h = this.hand;
    if (!h || this.drag) return;
    const ctx = this.ctx;
    const period = 2.2;
    const t = ((this.time - h.t0) % period) / period;
    const tp = this.trayPiece(h.ti);
    if (!tp) return;
    const [tx, ty] = this.cellXY(h.x, h.y);
    const fx = tp.x + (tp.sh.w * tp.cell) / 2, fy = tp.y + (tp.sh.h * tp.cell) / 2;
    const ex = tx + (tp.sh.w * this.board.cell) / 2, ey = ty + (tp.sh.h * this.board.cell) / 2;
    const m = t < 0.15 ? 0 : t > 0.75 ? 1 : easeOutCubic((t - 0.15) / 0.6);
    const x = fx + (ex - fx) * m, y = fy + (ey - fy) * m;
    // Ombre de la cible.
    const p = this.s.tray[h.ti];
    if (p) this.drawPiece(p, tx, ty, this.board.cell, 1, 0.25 + 0.15 * Math.sin(this.time * 5));
    const alpha = t > 0.85 ? 1 - (t - 0.85) / 0.15 : t < 0.08 ? t / 0.08 : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x + 8, y + 10, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x + 8, y + 10, 22 + Math.sin(this.time * 8) * 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // ------------------------------------------------------------------ effets
  /** Animation de pose : les cases « rebondissent ». */
  placed(cells) {
    for (const i of cells) this.pop.set(i, this.time);
  }

  refill() {
    for (let i = 0; i < 3; i++) this.spawn[i] = this.time + i * 0.07;
  }

  /** Lignes complétées : blocs qui éclatent en vague depuis la pièce posée, faisceaux, éclats. */
  cleared(ev) {
    const b = this.board, fx = this.fx;
    const ox = ev.ox ?? 3.5, oy = ev.oy ?? 3.5;
    const pureSet = new Set([...ev.pureRows.map((r) => `r${r}`), ...ev.pureCols.map((c) => `c${c}`)]);
    for (const c of ev.cleared) {
      const x = c.i % N, y = (c.i / N) | 0;
      const [cx, cy] = this.cellXY(x, y);
      const delay = Math.hypot(x + 0.5 - ox, y + 0.5 - oy) * 0.028;
      const sp = this.sprite(c.c === STONE ? STONE : c.c, b.cell, { gem: !!c.g });
      fx.die(cx, cy, b.cell, sp.img, sp.pad * sp.k, delay);
      const color = c.c === STONE ? this.theme.stone : this.theme.colors[c.c - 1];
      setTimeout(() => fx.shards(cx + b.cell / 2, cy + b.cell / 2, color, c.c === STONE ? 7 : 5, b.cell), delay * 1000);
    }
    for (const r of ev.rows) {
      const [x0, y0] = this.cellXY(0, r);
      fx.beam(x0, y0, b.cell * N, b.cell, this.theme.colors[(ev.col || 1) - 1], 0.02, pureSet.has(`r${r}`));
    }
    for (const c of ev.cols) {
      const [x0, y0] = this.cellXY(c, 0);
      fx.beam(x0, y0, b.cell, b.cell * N, this.theme.colors[(ev.col || 1) - 1], 0.02, pureSet.has(`c${c}`));
    }
    if (ev.pures) {
      const [cx, cy] = this.cellXY(ox, oy);
      fx.sparks(cx, cy, 40, ['#ff4d6d', '#ffa62b', '#ffe14d', '#27d07d', '#3dc4ff', '#b45cff'], 2);
    }
    const lines = ev.lines;
    if (lines >= 2) fx.shake(3 + lines * 2.2);
    if (lines >= 3) fx.flash(0.12 + 0.04 * lines);
  }

  bombed(ev) {
    const b = this.board, fx = this.fx;
    for (const c of ev.cleared) {
      const x = c.i % N, y = (c.i / N) | 0;
      const [cx, cy] = this.cellXY(x, y);
      const sp = this.sprite(c.c === STONE ? STONE : c.c, b.cell, { gem: !!c.g });
      fx.die(cx, cy, b.cell, sp.img, sp.pad * sp.k, Math.hypot(x - ev.x, y - ev.y) * 0.04);
      fx.shards(cx + b.cell / 2, cy + b.cell / 2, c.c === STONE ? this.theme.stone : this.theme.colors[c.c - 1], 6, b.cell);
    }
    const [cx, cy] = this.cellXY(ev.x + 0.5, ev.y + 0.5);
    fx.sparks(cx, cy, 36, ['#ffd36b', '#ff7a3d', '#ffffff'], 2.4);
    fx.ring(cx, cy, b.cell * 0.4, b.cell * 3, '#ffb36b', 0.5, 6);
    fx.shake(10);
    fx.flash(0.18, '#ffd0a0');
  }

  /** Grise la grille de bas en haut (fin de partie). */
  grayOut() { this.gray = this.time; }

  reset() {
    this.drag = null;
    this.returning = null;
    this.bomb = null;
    this.mode = null;
    this.pop.clear();
    this.gray = null;
    this.hand = null;
    this.hidden.clear();
    this.fx.clear();
  }
}

function lineCellsOf(lines) {
  const out = [];
  for (const r of lines.rows) for (let x = 0; x < N; x++) out.push(r * N + x);
  for (const c of lines.cols) for (let y = 0; y < N; y++) out.push(y * N + c);
  return out;
}
