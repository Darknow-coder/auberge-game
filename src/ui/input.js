// Saisie : caméra (glisser, molette, pincer), sélection et outils de construction.
import { MAP_W, MAP_H } from '../data/constants.js';
import { FURNITURE } from '../data/furniture.js';
import { ROOM_TYPES } from '../data/rooms.js';
import { PARCELS } from '../data/progression.js';
import { checkRoomRect, checkFurniture, suggestRotation, footprint, wallBetween, hasDoor, roomIdAt, parcelAt, inb, idx, normRect } from '../sim/world.js';
import { formatMoney } from '../core/util.js';

export class Input {
  constructor(game, hooks) {
    this.game = game;
    this.hooks = hooks;
    this.canvas = game.renderer.canvas;
    this.pointers = new Map();
    this.drag = null;
    this.pinch = null;
    this.keys = new Set();
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => this.down(e));
    c.addEventListener('pointermove', (e) => this.move(e));
    c.addEventListener('pointerup', (e) => this.up(e));
    c.addEventListener('pointercancel', (e) => this.cancel(e));
    c.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { game.ui.preview = this.drag && this.drag.kind === 'rect' ? game.ui.preview : null; game.ui.hoverRoom = 0; } });
    c.addEventListener('wheel', (e) => { e.preventDefault(); game.renderer.zoomAt(Math.exp(-e.deltaY * 0.0015), e.offsetX, e.offsetY); }, { passive: false });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => this.key(e, true));
    window.addEventListener('keyup', (e) => this.key(e, false));
  }

  tileAt(x, y) {
    const [fx, fy] = this.game.renderer.screenToTile(x, y);
    return { fx, fy, tx: Math.floor(fx), ty: Math.floor(fy) };
  }

  down(e) {
    this.game.audio.unlock();
    this.canvas.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY, sx: e.offsetX, sy: e.offsetY, t: performance.now(), button: e.button, type: e.pointerType });
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
      if (this.drag && this.drag.kind === 'rect') { this.game.ui.preview = null; }
      this.drag = null;
      return;
    }
    const ui = this.game.ui;
    const panButton = e.button === 1 || e.button === 2 || this.keys.has(' ');
    if (ui.mode === 'room' && !panButton) {
      const t = this.tileAt(e.offsetX, e.offsetY);
      this.drag = { kind: 'rect', x0: t.tx, y0: t.ty };
      this.updateRect(t.tx, t.ty);
      return;
    }
    this.drag = { kind: 'maybe', panOnly: panButton };
  }

  move(e) {
    const p = this.pointers.get(e.pointerId);
    const r = this.game.renderer;
    if (p) {
      const dx = e.offsetX - p.x, dy = e.offsetY - p.y;
      p.x = e.offsetX; p.y = e.offsetY;
      if (this.pinch && this.pointers.size >= 2) {
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
        r.zoomAt(d / Math.max(1, this.pinch.d), cx, cy);
        r.pan(cx - this.pinch.cx, cy - this.pinch.cy);
        this.pinch = { d, cx, cy };
        return;
      }
      if (this.drag && this.drag.kind === 'rect') {
        const t = this.tileAt(e.offsetX, e.offsetY);
        this.updateRect(t.tx, t.ty);
        return;
      }
      if (this.drag && (this.drag.kind === 'pan' || Math.hypot(e.offsetX - p.sx, e.offsetY - p.sy) > 7)) {
        this.drag.kind = 'pan';
        this.canvas.classList.add('dragging');
        this.game.follow = null;
        r.pan(dx, dy);
        return;
      }
    }
    // Survol (souris) : aperçu des outils
    if (e.pointerType === 'mouse' && !p) this.hover(e.offsetX, e.offsetY);
  }

  up(e) {
    const p = this.pointers.get(e.pointerId);
    this.pointers.delete(e.pointerId);
    this.canvas.classList.remove('dragging');
    if (this.pinch) { if (this.pointers.size < 2) this.pinch = null; this.drag = null; return; }
    if (!p) return;
    const drag = this.drag;
    this.drag = null;
    if (drag && drag.kind === 'rect') return this.finishRect(e.pointerType !== 'mouse');
    if (drag && drag.kind === 'pan') return;
    if (drag && drag.panOnly) return;
    this.tap(e.offsetX, e.offsetY, e.pointerType);
  }

  cancel(e) {
    this.pointers.delete(e.pointerId);
    this.pinch = null;
    if (this.drag && this.drag.kind === 'rect') this.game.ui.preview = null;
    this.drag = null;
  }

  key(e, down) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
    if (down) this.keys.add(e.key); else this.keys.delete(e.key);
    if (!down || !this.game.state) return;
    const g = this.game;
    switch (e.key) {
      case ' ': if (g.ui.mode === 'none') { e.preventDefault(); g.togglePause(); } break;
      case '1': case '2': case '3': g.setSpeed(+e.key); break;
      case '0': g.setSpeed(0); break;
      case 'r': case 'R': this.rotate(); break;
      case 'Escape': this.hooks.escape(); break;
      case '+': case '=': g.renderer.zoomAt(1.15, g.renderer.w / 2, g.renderer.h / 2); break;
      case '-': g.renderer.zoomAt(1 / 1.15, g.renderer.w / 2, g.renderer.h / 2); break;
      case 'b': case 'B': this.hooks.openPanel('build'); break;
      default: break;
    }
  }

  /** Défilement clavier continu. */
  update(dt) {
    const k = this.keys;
    const sp = 700 * dt;
    let dx = 0, dy = 0;
    if (k.has('ArrowLeft') || k.has('a') || k.has('q')) dx += sp;
    if (k.has('ArrowRight') || k.has('d')) dx -= sp;
    if (k.has('ArrowUp') || k.has('w') || k.has('z')) dy += sp;
    if (k.has('ArrowDown') || k.has('s')) dy -= sp;
    if (dx || dy) { this.game.follow = null; this.game.renderer.pan(dx, dy); }
  }

  rotate() {
    const ui = this.game.ui;
    if (ui.mode === 'furniture' || (ui.mode === 'move' && ui.moving)) {
      ui.rot = (ui.rot + 1) % 4;
      ui.userRot = true;
      if (ui.preview && ui.preview.kind === 'furniture') this.updateFurniture(ui.preview.x, ui.preview.y, true);
      this.game.audio.play('click');
    }
  }

  // ---------------------------------------------------------------- Construction de pièces
  updateRect(tx, ty) {
    const d = this.drag;
    const st = this.game.state;
    const ui = this.game.ui;
    const chk = checkRoomRect(st, ui.buildType, d.x0, d.y0, tx, ty);
    ui.preview = { kind: 'rect', rect: normRect(d.x0, d.y0, tx, ty), ok: chk.ok, cost: chk.cost, reason: chk.reason, end: [tx, ty], start: [d.x0, d.y0] };
  }

  finishRect(touch) {
    const ui = this.game.ui;
    const pv = ui.preview;
    if (!pv) return;
    if (touch) { ui.pending = { kind: 'rect' }; this.hooks.refreshBuildbar(); return; }
    this.commitRect();
  }

  commitRect() {
    const ui = this.game.ui;
    const pv = ui.preview;
    ui.pending = null;
    if (!pv) return;
    const [x0, y0, x1, y1] = pv.rect;
    const r = this.game.act('buildRoom', ui.buildType, x0, y0, x1, y1);
    ui.preview = null;
    if (r.ok) {
      this.game.audio.play('build');
      const name = ROOM_TYPES[ui.buildType].name;
      this.game.renderer.particles.emitWorld('dust', (x0 + x1 + 1) / 2, (y0 + y1 + 1) / 2, 0.2, 8);
      this.hooks.toast({ kind: 'info', text: `${name} ${r.merged ? 'agrandie' : 'construite'} (−${formatMoney(r.cost)} écus).${ROOM_TYPES[ui.buildType].required.length ? ' Pensez à la meubler !' : ''}`, action: r.merged ? null : { label: 'Annuler', fn: () => this.game.undoLastRoom() } });
      this.hooks.afterBuild();
    }
    this.hooks.refreshBuildbar();
  }

  // ---------------------------------------------------------------- Meubles
  updateFurniture(tx, ty, keepRot = false) {
    const g = this.game, ui = g.ui, st = g.state;
    const type = ui.mode === 'move' ? st.world.furniture[ui.moving]?.type : ui.buildType;
    if (!type) return;
    const def = FURNITURE[type];
    if (!keepRot && !ui.userRot && ui.mode === 'furniture') ui.rot = suggestRotation(st, type, tx, ty);
    const [w, d] = footprint(def, ui.rot);
    const x = tx - Math.floor((w - 1) / 2), y = ty - Math.floor((d - 1) / 2);
    const chk = checkFurniture(st, type, x, y, ui.rot, ui.mode === 'move' ? { ignoreId: ui.moving } : {});
    ui.preview = { kind: 'furniture', type, x, y, rot: ui.rot, ok: chk.ok, reason: chk.reason };
  }

  commitFurniture() {
    const g = this.game, ui = g.ui;
    const pv = ui.preview;
    ui.pending = null;
    if (!pv || pv.kind !== 'furniture') return;
    if (ui.mode === 'move') {
      const r = g.act('moveFurniture', ui.moving, pv.x, pv.y, pv.rot);
      if (r.ok) { g.audio.play('place'); ui.moving = 0; ui.preview = null; }
    } else {
      const r = g.act('placeFurniture', pv.type, pv.x, pv.y, pv.rot);
      if (r.ok) {
        g.audio.play('place');
        const [w, d] = footprint(FURNITURE[pv.type], pv.rot);
        g.renderer.particles.emitWorld('dust', pv.x + w / 2, pv.y + d / 2, 0.1, 4);
        this.hooks.afterBuild();
        if (FURNITURE[pv.type].special) g.setMode('none');
        else this.updateFurniture(pv.x + Math.floor((w - 1) / 2), pv.y + Math.floor((d - 1) / 2), true);
      }
    }
    this.hooks.refreshBuildbar();
  }

  // ---------------------------------------------------------------- Portes
  nearestEdge(fx, fy) {
    const tx = Math.floor(fx), ty = Math.floor(fy);
    const u = fx - tx, v = fy - ty;
    const c = [[v, tx, ty, tx, ty - 1], [1 - v, tx, ty, tx, ty + 1], [u, tx, ty, tx - 1, ty], [1 - u, tx, ty, tx + 1, ty]];
    c.sort((a, b) => a[0] - b[0]);
    const st = this.game.state;
    for (const [, ax, ay, bx, by] of c.slice(0, 2)) if (wallBetween(st, ax, ay, bx, by)) return { ax, ay, bx, by };
    return null;
  }

  updateDoor(fx, fy) {
    const st = this.game.state;
    const e = this.nearestEdge(fx, fy);
    if (!e) { this.game.ui.preview = null; return; }
    const has = hasDoor(st, e.ax, e.ay, e.bx, e.by);
    this.game.ui.preview = { kind: 'edge', ...e, ok: true, label: has ? 'Retirer la porte' : 'Ajouter une porte (30)' };
  }

  // ---------------------------------------------------------------- Survol et tap
  hover(x, y) {
    const g = this.game, ui = g.ui;
    if (!g.state) return;
    const t = this.tileAt(x, y);
    switch (ui.mode) {
      case 'furniture': this.updateFurniture(t.tx, t.ty); break;
      case 'move': if (ui.moving) this.updateFurniture(t.tx, t.ty, true); else ui.hoverRoom = 0; break;
      case 'door': this.updateDoor(t.fx, t.fy); break;
      case 'paint': ui.hoverRoom = roomIdAt(g.state, t.tx, t.ty); break;
      case 'demolish': ui.hoverRoom = roomIdAt(g.state, t.tx, t.ty); break;
      case 'room': ui.preview = inb(t.tx, t.ty) ? { kind: 'tile', x: t.tx, y: t.ty } : null; break;
      default: break;
    }
  }

  tap(x, y, ptype) {
    const g = this.game, ui = g.ui, st = g.state;
    if (!st) return;
    const t = this.tileAt(x, y);
    const touch = ptype !== 'mouse';
    switch (ui.mode) {
      case 'furniture': {
        if (touch) {
          // premier tap : aperçu ; second tap au même endroit : placement
          const pv = ui.preview;
          if (pv && pv.kind === 'furniture' && ui.pending && t.tx >= pv.x && t.ty >= pv.y && t.tx < pv.x + footprint(FURNITURE[pv.type], pv.rot)[0] && t.ty < pv.y + footprint(FURNITURE[pv.type], pv.rot)[1]) { this.commitFurniture(); return; }
          this.updateFurniture(t.tx, t.ty);
          ui.pending = { kind: 'furniture' };
          this.hooks.refreshBuildbar();
          return;
        }
        this.updateFurniture(t.tx, t.ty, true);
        this.commitFurniture();
        return;
      }
      case 'move': {
        if (!ui.moving) {
          const fid = inb(t.tx, t.ty) ? (st.rt.furnAt[idx(t.tx, t.ty)] || st.rt.seatAt[idx(t.tx, t.ty)] || st.rt.rugAt[idx(t.tx, t.ty)]) : 0;
          if (fid) { ui.moving = fid; ui.rot = st.world.furniture[fid].rot; ui.userRot = true; g.audio.play('click'); this.updateFurniture(t.tx, t.ty, true); this.hooks.refreshBuildbar(); }
          return;
        }
        if (touch && !ui.pending) { this.updateFurniture(t.tx, t.ty, true); ui.pending = { kind: 'furniture' }; this.hooks.refreshBuildbar(); return; }
        if (touch) { const pv = ui.preview; const [w, d] = footprint(FURNITURE[pv.type], pv.rot); if (!(t.tx >= pv.x && t.ty >= pv.y && t.tx < pv.x + w && t.ty < pv.y + d)) { this.updateFurniture(t.tx, t.ty, true); return; } }
        else this.updateFurniture(t.tx, t.ty, true);
        this.commitFurniture();
        return;
      }
      case 'door': {
        const e = this.nearestEdge(t.fx, t.fy);
        if (!e) { this.hooks.toast({ kind: 'warn', text: 'Touchez un mur pour y placer une porte.', short: true }); return; }
        const r = g.act('toggleDoor', e.ax, e.ay, e.bx, e.by);
        if (r.ok) g.audio.play(r.removed ? 'sell' : 'place');
        this.updateDoor(t.fx, t.fy);
        return;
      }
      case 'paint': {
        const rid = roomIdAt(st, t.tx, t.ty);
        if (!rid) return;
        const r = g.act('paintRoom', rid, ui.paint);
        if (r.ok) { g.audio.play('place'); this.hooks.toast({ kind: 'info', text: `Style appliqué (−${formatMoney(r.cost)} écus).`, short: true }); this.hooks.afterBuild(); }
        return;
      }
      case 'demolish': {
        const fid = inb(t.tx, t.ty) ? (st.rt.furnAt[idx(t.tx, t.ty)] || st.rt.seatAt[idx(t.tx, t.ty)] || st.rt.rugAt[idx(t.tx, t.ty)]) : 0;
        if (fid) { const r = g.act('sellFurniture', fid); if (r.ok) { g.audio.play('sell'); this.hooks.afterBuild(); } return; }
        const rid = roomIdAt(st, t.tx, t.ty);
        if (rid) {
          const room = st.world.rooms[rid];
          this.hooks.confirm({ title: `Démolir ${room.type === 'bedroom' ? `la chambre ${room.num}` : ROOM_TYPES[room.type].name.toLowerCase()} ?`, text: `Remboursement : ≈ ${formatMoney(g.roomRefund(rid))} écus (+ 50 % des meubles).`, ok: 'Démolir', danger: true, fn: () => { const r = g.act('demolishRoom', rid); if (r.ok) { g.audio.play('build'); this.hooks.afterBuild(); } } });
        }
        return;
      }
      case 'parcels': {
        const pid = parcelAt(t.tx, t.ty);
        const p = PARCELS.find((q) => q.id === pid);
        if (!p || st.world.ownedParcels.includes(pid)) return;
        if (st.tier < p.tier) { this.hooks.toast({ kind: 'warn', text: `${p.name} : disponible au palier ${p.tier}.` }); return; }
        this.hooks.confirm({ title: `Acheter « ${p.name} » ?`, text: `${p.desc} Coût : ${formatMoney(p.cost)} écus.`, ok: 'Acheter', fn: () => { const r = g.act('buyParcel', p.id); if (r.ok) g.audio.play('chime'); } });
        return;
      }
      case 'room': return;
      default: break;
    }
    // Sélection
    const agent = g.renderer.pickAgent(st, x, y);
    if (agent) { g.audio.play('click'); this.hooks.select({ kind: agent.kind === 'staff' ? 'staff' : 'guest', id: agent.id }); return; }
    if (!inb(t.tx, t.ty)) { this.hooks.select(null); return; }
    const i = idx(t.tx, t.ty);
    const fid = st.rt.furnAt[i] || st.rt.seatAt[i];
    if (fid) { g.audio.play('click'); this.hooks.select({ kind: 'furniture', id: fid }); return; }
    const rid = st.rt.roomAt[i];
    if (rid) { g.audio.play('click'); this.hooks.select({ kind: 'room', id: rid }); return; }
    const pid = parcelAt(t.tx, t.ty);
    if (pid >= 0 && !st.world.ownedParcels.includes(pid)) { g.setMode('parcels'); this.hooks.refreshBuildbar(); return; }
    this.hooks.select(null);
  }
}

export { MAP_W, MAP_H };
