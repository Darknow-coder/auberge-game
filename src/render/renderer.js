// Rendu Canvas 2D de la zone de jeu : grille, pièces, aperçu des enclos, effets.
// Toutes les coordonnées sont en pixels CSS ; le canvas est mis à l'échelle de l'écran.
import { blockSprite, glowSprite, roundRect, PAD, rgba, lightColor } from './blocks.js';
import { Fx, RAINBOW } from './fx.js';
import { SHAPES } from '../game/pieces.js';
import { COLS, ROWS, CELLS, STONE, WHITE, GEM, STAR, FOG, isCrystal, crystalNeed, canPlace, previewPlace } from '../game/board.js';
import { bombArea, areaPoints, mixMult, multiMult, comboMult, SCORE, STAR_LIFE } from '../game/engine.js';

const easeOutBack = (t) => { const c = 1.6; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const TRAY_SCALE = 0.52;
/** Rapport hauteur / largeur de la grille (marges comprises). */
export const BOARD_INSET = 0.028;
export const BOARD_RATIO = (1 - 2 * BOARD_INSET) * (ROWS / COLS) + 2 * BOARD_INSET;

export class GameView {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = 1;
    this.w = 0;
    this.h = 0;
    this.board = { x: 0, y: 0, w: 0, h: 0, cell: 0, gx: 0, gy: 0 };
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
    this.pools = [];
    this.spawn = [0, 0, 0];
    this.gray = null;
    this.hand = null;
    this.time = 0;
    this.flies = Array.from({ length: 7 }, (_, i) => ({ x: Math.random(), y: Math.random(), vx: (Math.random() - 0.5) * 0.03, vy: (Math.random() - 0.5) * 0.03, ph: i * 1.7 }));
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
    const inset = Math.round(b.width * BOARD_INSET);
    const cell = (b.width - 2 * inset) / COLS;
    this.board = { x: b.left, y: b.top, w: b.width, h: b.height, cell, inset, gx: b.left + inset, gy: b.top + inset };
    const t = trayEl.getBoundingClientRect();
    if (t.height > t.width) {
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

  cellCenter(i) {
    const [x, y] = this.cellXY(i % COLS, (i / COLS) | 0);
    return [x + this.board.cell / 2, y + this.board.cell / 2];
  }

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

  cellAt(px, py) {
    const { gx, gy, cell } = this.board;
    const x = Math.floor((px - gx) / cell), y = Math.floor((py - gy) / cell);
    return x >= 0 && y >= 0 && x < COLS && y < ROWS ? [x, y] : null;
  }

  insideBoard(px, py, margin = 0) {
    const b = this.board;
    return px >= b.x - margin && py >= b.y - margin && px <= b.x + b.w + margin && py <= b.y + b.h + margin;
  }

  /** Position cible d'une pièce tenue (coin haut-gauche en px), avec une petite tolérance. */
  snap(sh, px, py) {
    const { gx, gy, cell } = this.board;
    const fx = (px - gx) / cell, fy = (py - gy) / cell;
    const cands = [];
    for (const x of [Math.round(fx), Math.floor(fx), Math.ceil(fx)])
      for (const y of [Math.round(fy), Math.floor(fy), Math.ceil(fy)]) {
        const d = Math.hypot(x - fx, y - fy);
        if (d < 0.75 && canPlace(this.s.board, sh, x, y)) cands.push({ x, y, d });
      }
    if (!cands.length) return null;
    cands.sort((a, b) => a.d - b.d);
    return { x: cands[0].x, y: cands[0].y };
  }

  /** Points que rapporteraient des enclos (même calcul que le moteur). */
  predict(regions) {
    if (!regions.length) return 0;
    let pts = 0;
    for (const r of regions) pts += (areaPoints(r.cells.length) + SCORE.ring * r.ring.length) * mixMult(r.mix) * (r.stars ? 2 : 1);
    return Math.round(pts * multiMult(regions.length) * comboMult(this.s.combo + 1));
  }

  /** Met à jour l'aperçu : ombre de la pièce, zones qui s'illumineraient, points prévus. */
  updateGhost() {
    const d = this.drag;
    if (!d) return;
    const p = this.s.tray[d.ti];
    if (!p) { d.ghost = null; return; }
    const sh = SHAPES[p.k];
    const g = this.snap(sh, d.x, d.y);
    if (g && (!d.ghost || d.ghost.x !== g.x || d.ghost.y !== g.y)) {
      const regions = previewPlace(this.s.board, sh, g.x, g.y, p.col);
      const ring = new Set();
      for (const r of regions) for (const j of r.ring) ring.add(j);
      d.ghost = { ...g, regions, ring, points: this.predict(regions) };
    } else if (!g) d.ghost = null;
  }

  sprite(kind, cellCss) {
    const size = Math.round(cellCss * this.dpr);
    return { img: blockSprite(this.theme, kind, size, { symbol: this.symbols }), k: cellCss / size, pad: Math.ceil(size * PAD) };
  }

  drawBlock(kind, x, y, cell, scale = 1) {
    const sp = this.sprite(kind, cell);
    const full = sp.img.width * sp.k * scale;
    const off = (full - cell) / 2;
    this.ctx.drawImage(sp.img, x - off, y - off, full, full);
  }

  drawPiece(p, x, y, cell, scale = 1, alpha = 1) {
    const sh = SHAPES[p.k];
    this.ctx.globalAlpha = alpha;
    for (const [dx, dy] of sh.cells) this.drawBlock(p.col, x + dx * cell, y + dy * cell, cell, scale);
    this.ctx.globalAlpha = 1;
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
    this.drawFlies(dt);
    this.drawPools();
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
    const r = b.w * 0.04;
    const heat = Math.min(1, Math.max(0, ((this.s.combo || 0) - 1) / 8));
    ctx.save();
    ctx.shadowColor = heat > 0 ? rgba(th.ui.accent, 0.35 + heat * 0.5) : 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 18 + heat * 26 + (heat > 0 ? Math.sin(this.time * 6) * 4 * heat : 0);
    ctx.shadowOffsetY = heat > 0 ? 0 : 8;
    roundRect(ctx, b.x, b.y, b.w, b.h, r);
    ctx.fillStyle = th.board;
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = 1.5 + heat * 1.5;
    ctx.strokeStyle = heat > 0 ? rgba(th.ui.accent, 0.4 + heat * 0.5) : th.boardEdge;
    roundRect(ctx, b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1, r);
    ctx.stroke();
    const g = b.cell * 0.07;
    ctx.fillStyle = th.cell;
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++) {
        const [cx, cy] = this.cellXY(x, y);
        roundRect(ctx, cx + g, cy + g, b.cell - 2 * g, b.cell - 2 * g, b.cell * 0.18);
        ctx.fill();
      }
  }

  /** Lumière des zones encerclées : elle se répand depuis la pièce posée, puis s'élève. */
  drawPools() {
    const ctx = this.ctx, b = this.board;
    if (!this.pools.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const pool of this.pools) {
      const age = this.time - pool.t0;
      for (const c of pool.cells) {
        const k = (age - c.delay) / 0.9;
        if (k <= 0) continue;
        const a = k < 0.25 ? k / 0.25 : Math.max(0, 1 - (k - 0.25) / 0.75);
        if (a <= 0) continue;
        const [x, y] = this.cellXY(c.x, c.y);
        let color = pool.color;
        if (pool.white) color = RAINBOW[Math.floor((c.x + c.y + this.time * 8) % RAINBOW.length)];
        const g = glowSprite(color, b.cell * 1.6 * this.dpr);
        ctx.globalAlpha = a;
        ctx.drawImage(g, x - b.cell * 0.3, y - b.cell * 0.3, b.cell * 1.6, b.cell * 1.6);
        if (pool.white) { ctx.globalAlpha = a * 0.7; ctx.drawImage(glowSprite('#ffffff', b.cell * this.dpr), x, y, b.cell, b.cell); }
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
    this.pools = this.pools.filter((p) => this.time - p.t0 < p.dur);
  }

  drawCells() {
    const s = this.s, b = this.board, now = this.time, ctx = this.ctx;
    for (let i = 0; i < CELLS; i++) {
      const v = s.board.c[i];
      const x = i % COLS, y = (i / COLS) | 0;
      const [cx, cy] = this.cellXY(x, y);
      if (!v) {
        const o = s.board.o[i];
        if (o === GEM) {
          const bob = Math.sin(now * 2.4 + i) * b.cell * 0.04;
          this.drawBlock('gem', cx, cy + bob, b.cell, 0.9);
        } else if (o === FOG) {
          this.drawFog(cx, cy, b.cell, i);
        } else if (isCrystal(o)) {
          const bob = Math.sin(now * 2 + i) * b.cell * 0.03;
          this.drawBlock('crystal', cx, cy + bob, b.cell, 0.95);
          this.drawBadge(String(crystalNeed(o)), cx + b.cell * 0.78, cy + b.cell * 0.78, b.cell);
        } else if (o === STAR && s.star && s.star.i === i) {
          const life = s.star.life / STAR_LIFE;
          const pulse = 1 + Math.sin(now * (life < 0.35 ? 14 : 5)) * 0.06;
          ctx.save();
          ctx.translate(cx + b.cell / 2, cy + b.cell / 2);
          ctx.rotate(Math.sin(now * 1.5) * 0.15);
          ctx.translate(-(cx + b.cell / 2), -(cy + b.cell / 2));
          this.drawBlock('star', cx, cy, b.cell, pulse);
          ctx.restore();
          // Compte à rebours.
          ctx.strokeStyle = life < 0.35 ? 'rgba(255,120,80,0.9)' : 'rgba(255,215,110,0.85)';
          ctx.lineWidth = Math.max(2, b.cell * 0.06);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.arc(cx + b.cell / 2, cy + b.cell / 2, b.cell * 0.46, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * life);
          ctx.stroke();
        }
        continue;
      }
      let scale = 1;
      const pt = this.pop.get(i);
      if (pt != null) {
        const k = (now - pt) / 0.22;
        if (k < 0) continue; // pas encore apparu (grilles de l'initiation)
        if (k >= 1) this.pop.delete(i);
        else scale = 1 + 0.18 * Math.sin(k * Math.PI) * (1 - k);
      }
      let kind = v;
      if (this.gray && now - this.gray > (ROWS - 1 - y) * 0.07 + x * 0.012) kind = v === STONE ? STONE : 'gray';
      this.drawBlock(kind, cx, cy, b.cell, scale);
    }
  }

  drawPreview() {
    const ctx = this.ctx, b = this.board, d = this.drag;
    if (d && d.ghost) {
      const p = this.s.tray[d.ti];
      if (p) {
        const sh = SHAPES[p.k];
        const { x, y, regions, ring } = d.ghost;
        const pulse = 0.5 + 0.5 * Math.sin(this.time * 9);
        // Zones qui vont s'illuminer.
        for (const r of regions) {
          const color = r.mix === WHITE ? '#ffffff' : lightColor(this.theme, r.mix || WHITE);
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          for (const k of r.cells) {
            const [cx, cy] = this.cellXY(k % COLS, (k / COLS) | 0);
            const c2 = r.mix === WHITE ? RAINBOW[(k + Math.floor(this.time * 6)) % RAINBOW.length] : color;
            ctx.fillStyle = rgba(c2, 0.22 + 0.2 * pulse);
            roundRect(ctx, cx + 2, cy + 2, b.cell - 4, b.cell - 4, b.cell * 0.2);
            ctx.fill();
          }
          ctx.restore();
        }
        // Cristaux : vert s'ils seront récoltés, rouge si l'enclos est trop petit.
        for (const r of regions) {
          for (const [list, color] of [[r.crystalCells || [], 'rgba(120,255,170,0.95)'], [r.crystalsLeft || [], 'rgba(255,90,90,0.95)']]) {
            for (const k of list) {
              const [qx, qy] = this.cellCenter(k);
              ctx.strokeStyle = color;
              ctx.lineWidth = 3;
              ctx.beginPath();
              ctx.arc(qx, qy, b.cell * (0.42 + 0.04 * pulse), 0, Math.PI * 2);
              ctx.stroke();
            }
          }
        }
        // Blocs qui vont disparaître : liseré blanc pulsant.
        if (ring.size) {
          ctx.strokeStyle = `rgba(255,255,255,${0.45 + 0.4 * pulse})`;
          ctx.lineWidth = 2;
          for (const j of ring) {
            const [cx, cy] = this.cellXY(j % COLS, (j / COLS) | 0);
            roundRect(ctx, cx + 3, cy + 3, b.cell - 6, b.cell - 6, b.cell * 0.2);
            ctx.stroke();
          }
        }
        const alpha = regions.length ? 0.9 : 0.42;
        ctx.globalAlpha = alpha;
        for (const [dx, dy] of sh.cells) {
          const [cx, cy] = this.cellXY(x + dx, y + dy);
          this.drawBlock(p.col, cx, cy, b.cell);
        }
        ctx.globalAlpha = 1;
        // Points prévus, au centre de la plus grande zone.
        if (regions.length && d.ghost.points) {
          const big = regions.reduce((a, r) => (r.cells.length > a.cells.length ? r : a));
          let mx = 0, my = 0;
          for (const k of big.cells) { const [px, py] = this.cellCenter(k); mx += px; my += py; }
          mx /= big.cells.length;
          my /= big.cells.length;
          ctx.save();
          ctx.font = `700 ${Math.round(b.cell * 0.42)}px Fredoka, system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.lineWidth = 4;
          ctx.strokeStyle = 'rgba(10,6,30,0.8)';
          const txt = `+${d.ghost.points}`;
          ctx.strokeText(txt, mx, my);
          ctx.fillStyle = '#fff';
          ctx.fillText(txt, mx, my);
          ctx.restore();
        }
      }
    }
    if (this.bomb) {
      const area = bombArea(this.bomb.x, this.bomb.y);
      const pulse = 0.35 + 0.15 * Math.sin(this.time * 12);
      for (const i of area) {
        const [cx, cy] = this.cellXY(i % COLS, (i / COLS) | 0);
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
      this.drawPiece(p, tp.x, tp.y, tp.cell, 1, fits ? 1 : 0.3);
      ctx.restore();
      if (this.mode === 'rotate' && k >= 1) {
        const slot = this.slots[ti];
        const bx = slot.x + slot.w - 18, by = slot.y + 16;
        ctx.fillStyle = this.theme.ui.accent;
        ctx.beginPath();
        ctx.arc(bx, by, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = this.theme.ui.btnText;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(bx, by, 6, -Math.PI * 0.2, Math.PI * 1.3);
        ctx.stroke();
        const ex = bx + 6 * Math.cos(-Math.PI * 0.2), ey = by + 6 * Math.sin(-Math.PI * 0.2);
        ctx.beginPath();
        ctx.moveTo(ex + 3, ey - 1);
        ctx.lineTo(ex, ey + 4);
        ctx.lineTo(ex - 4, ey);
        ctx.stroke();
      }
    }
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

  /** Brume : volutes violettes qui ondulent lentement. */
  drawFog(cx, cy, cell, i) {
    const ctx = this.ctx, t = this.time;
    const g = glowSprite('#9b86d6', cell * 1.2 * this.dpr);
    for (let k = 0; k < 3; k++) {
      const a = t * (0.5 + k * 0.17) + i * 1.3 + k * 2.1;
      const ox = Math.cos(a) * cell * 0.16, oy = Math.sin(a * 1.3) * cell * 0.12;
      const sz = cell * (0.95 + 0.12 * Math.sin(a * 0.7));
      ctx.globalAlpha = 0.5;
      ctx.drawImage(g, cx + cell / 2 + ox - sz / 2, cy + cell / 2 + oy - sz / 2, sz, sz);
    }
    ctx.globalAlpha = 1;
    const drift = Math.sin(t * 1.2 + i) * cell * 0.05;
    this.drawBlock('fog', cx + drift, cy, cell, 0.95);
  }

  /** Pastille chiffrée (taille d'enclos exigée par un cristal). */
  drawBadge(text, x, y, cell) {
    const ctx = this.ctx, r = cell * 0.2;
    ctx.fillStyle = '#2a1460';
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = `700 ${Math.round(r * 1.35)}px Fredoka, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + 1);
  }

  /** Lucioles d'ambiance qui flottent au-dessus de la grille. */
  drawFlies(dt) {
    if (this.fx.reduced) return;
    const ctx = this.ctx, b = this.board;
    const g = glowSprite('#ffe9a8', 16 * this.dpr);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const f of this.flies) {
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (f.x < 0 || f.x > 1) f.vx *= -1;
      if (f.y < 0 || f.y > 1) f.vy *= -1;
      f.x = Math.max(0, Math.min(1, f.x));
      f.y = Math.max(0, Math.min(1, f.y));
      ctx.globalAlpha = 0.25 + 0.25 * Math.sin(this.time * 1.6 + f.ph);
      ctx.drawImage(g, b.x + f.x * b.w - 8, b.y + f.y * b.h - 8, 16, 16);
    }
    ctx.restore();
  }

  /** Fait apparaître les blocs de la grille un par un (nouvelle étape de l'initiation). */
  revealBoard(delay = 0.6) {
    for (let i = 0; i < CELLS; i++) {
      if (!this.s.board.c[i]) continue;
      const x = i % COLS, y = (i / COLS) | 0;
      this.pop.set(i, this.time + delay + (x + y) * 0.03);
    }
  }

  /** Zen et Blitz : la zone la plus encombrée se dissout doucement. */
  relieved(ev) {
    const b = this.board, fx = this.fx;
    for (const c of ev.cleared) {
      const x = c.i % COLS, y = (c.i / COLS) | 0;
      const [cx, cy] = this.cellXY(x, y);
      const sp = this.sprite(c.c, b.cell);
      fx.die(cx, cy, b.cell, sp.img, sp.pad * sp.k, Math.hypot(x - ev.x, y - ev.y) * 0.06);
      fx.rise(cx + b.cell / 2, cy + b.cell / 2, ['#bfe9ff', '#ffffff'], 2, b.cell);
    }
  }

  // ------------------------------------------------------------------ effets
  placed(cells) {
    for (const i of cells) this.pop.set(i, this.time);
  }

  refill() {
    for (let i = 0; i < 3; i++) this.spawn[i] = this.time + i * 0.07;
  }

  /** Enclos fermé : la lumière se répand dans la zone, puis l'enceinte éclate. */
  enclosed(ev) {
    const b = this.board, fx = this.fx;
    const ox = ev.ox ?? COLS / 2, oy = ev.oy ?? ROWS / 2;
    let maxDelay = 0;
    for (const r of ev.regions) {
      const color = lightColor(this.theme, r.mix || WHITE);
      const cells = r.cells.map((k) => {
        const x = k % COLS, y = (k / COLS) | 0;
        const delay = Math.hypot(x + 0.5 - ox, y + 0.5 - oy) * 0.045;
        maxDelay = Math.max(maxDelay, delay);
        return { x, y, delay };
      });
      this.pools.push({ cells, color, white: r.white, t0: this.time, dur: 1.6 + maxDelay });
      // Lumière qui s'élève de la zone.
      for (const k of r.cells) {
        const [cx, cy] = this.cellCenter(k);
        const d = Math.hypot((k % COLS) + 0.5 - ox, ((k / COLS) | 0) + 0.5 - oy) * 45;
        setTimeout(() => fx.rise(cx, cy, r.white ? RAINBOW : [color, '#ffffff'], 3, b.cell), 200 + d);
      }
    }
    // L'enceinte éclate juste après que la lumière l'a atteinte.
    for (const c of ev.cleared) {
      const x = c.i % COLS, y = (c.i / COLS) | 0;
      const [cx, cy] = this.cellXY(x, y);
      const delay = 0.12 + Math.hypot(x + 0.5 - ox, y + 0.5 - oy) * 0.035;
      const sp = this.sprite(c.c, b.cell);
      fx.die(cx, cy, b.cell, sp.img, sp.pad * sp.k, delay);
      const color = c.c === STONE ? this.theme.stone : lightColor(this.theme, c.c);
      setTimeout(() => fx.shards(cx + b.cell / 2, cy + b.cell / 2, color, c.c === STONE ? 7 : 5, b.cell), delay * 1000);
    }
    const area = ev.regions.reduce((a, r) => a + r.cells.length, 0);
    if (area >= 6 || ev.regions.length >= 2) fx.shake(3 + Math.min(10, area * 0.5));
    if (area >= 12) fx.flash(0.15);
    if (ev.regions.some((r) => r.white)) {
      const [cx, cy] = this.cellXY(ox, oy);
      fx.sparks(cx, cy, 40, RAINBOW, 2);
    }
  }

  bombed(ev) {
    const b = this.board, fx = this.fx;
    for (const c of ev.cleared) {
      const x = c.i % COLS, y = (c.i / COLS) | 0;
      const [cx, cy] = this.cellXY(x, y);
      const sp = this.sprite(c.c, b.cell);
      fx.die(cx, cy, b.cell, sp.img, sp.pad * sp.k, Math.hypot(x - ev.x, y - ev.y) * 0.04);
      fx.shards(cx + b.cell / 2, cy + b.cell / 2, c.c === STONE ? this.theme.stone : lightColor(this.theme, c.c), 6, b.cell);
    }
    const [cx, cy] = this.cellXY(ev.x + 0.5, ev.y + 0.5);
    fx.sparks(cx, cy, 36, ['#ffd36b', '#ff7a3d', '#ffffff'], 2.4);
    fx.ring(cx, cy, b.cell * 0.4, b.cell * 3, '#ffb36b', 0.5, 6);
    fx.shake(10);
    fx.flash(0.18, '#ffd0a0');
  }

  grayOut() { this.gray = this.time; }

  reset() {
    this.drag = null;
    this.returning = null;
    this.bomb = null;
    this.mode = null;
    this.pop.clear();
    this.pools = [];
    this.gray = null;
    this.hand = null;
    this.fx.clear();
  }
}
