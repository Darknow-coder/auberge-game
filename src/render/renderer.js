// Moteur de rendu : caméra, calques, tri de profondeur, interface en surimpression.
import { MAP_W, MAP_H, TERRAIN, SPOTS } from '../data/constants.js';
import { FURNITURE } from '../data/furniture.js';
import { ROOM_TYPES, WALLS } from '../data/rooms.js';
import { PARCELS } from '../data/progression.js';
import { clock } from '../sim/time.js';
import { listWalls, furnCells, footprint, frontDir, parseEdge, isOwned, parcelAt, idx } from '../sim/world.js';
import { generateScenery } from '../sim/map.js';
import { shade, hash2, clamp, rgba, mix } from '../core/util.js';
import { iso, screenToTile, box, poly, diamond, faceS, faceE, sprite, drawSprite, setSpriteScale, HW, HH, ZH, TW, TH, gableRoof, cylinder } from './iso.js';
import { furnitureSprite, treeSprite, buildingSprite, QUILT, C } from './models.js';
import { drawPerson, drawSleeper, drawBather, drawBubble, drawCat } from './characters.js';
import { renderGround, groundBounds } from './ground.js';
import { skyColors, darkness, golden, buildMountains, makeClouds, makeStars } from './environment.js';
import { Particles, Lighting } from './effects.js';

const FULL_H = 2.05, LOW_H = 0.4, EXT_LOW_H = 0.55, WALL_T = 0.14;
const SEAT_Z = { chair: 0.46, armchair: 0.42, sofa: 0.44, bench: 0.48, bar_stool: 0.72, gazebo: 0.25, deck_chair: 0.3 };

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cam = { x: 60, y: 640, zoom: 1.15 };
    this.w = 1; this.h = 1; this.dpr = 1;
    this.quality = 'high';
    this.particles = new Particles();
    this.lighting = new Lighting();
    this.clouds = null;
    this.stars = makeStars();
    this.trails = new Map();
    this.prevPos = new Map();
    this.groundKey = '';
    this.staticKey = '';
    this.t = 0;
    this.fps = 60;
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, this.quality === 'low' ? 1 : 2);
    this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
  }

  // ---------------------------------------------------------------- Caméra
  worldToScreen = (x, y, z = 0) => {
    const [px, py] = iso(x, y, z);
    return [(px - this.cam.x) * this.cam.zoom + this.w / 2, (py - this.cam.y) * this.cam.zoom + this.h / 2];
  };
  screenToWorldPx(sx, sy) {
    return [(sx - this.w / 2) / this.cam.zoom + this.cam.x, (sy - this.h / 2) / this.cam.zoom + this.cam.y];
  }
  screenToTile(sx, sy) {
    const [wx, wy] = this.screenToWorldPx(sx, sy);
    return screenToTile(wx, wy);
  }
  centerOn(tx, ty) {
    const [px, py] = iso(tx, ty, 0.5);
    this.cam.x = px; this.cam.y = py;
    this.clampCamera();
  }
  pan(dx, dy) { this.cam.x -= dx / this.cam.zoom; this.cam.y -= dy / this.cam.zoom; this.clampCamera(); }
  zoomAt(f, sx, sy) {
    const [wx, wy] = this.screenToWorldPx(sx, sy);
    const z = clamp(this.cam.zoom * f, 0.45, 2.6);
    this.cam.zoom = z;
    this.cam.x = wx - (sx - this.w / 2) / z;
    this.cam.y = wy - (sy - this.h / 2) / z;
    this.clampCamera();
  }
  clampCamera() {
    this.cam.x = clamp(this.cam.x, -1250, 1250);
    this.cam.y = clamp(this.cam.y, 0, 1300);
  }

  // ---------------------------------------------------------------- Caches
  ensureGround(state, season) {
    const key = `${state.rt.worldVersion}:${season}:${this.quality}`;
    if (key === this.groundKey) return;
    this.groundKey = key;
    const [x0, y0, x1, y1] = groundBounds();
    const s = this.quality === 'low' ? 0.6 : Math.min(1.25, this.dpr);
    const c = this.groundCanvas || document.createElement('canvas');
    c.width = Math.ceil((x1 - x0) * s); c.height = Math.ceil((y1 - y0) * s);
    const g = c.getContext('2d');
    g.setTransform(s, 0, 0, s, -x0 * s, -y0 * s);
    g.lineJoin = 'round';
    renderGround(g, state, season);
    this.groundCanvas = c;
    this.groundBounds = [x0, y0, x1, y1];
  }

  ensureStatic(state, season) {
    const key = `${state.rt.worldVersion}:${season}`;
    if (key === this.staticKey) return;
    const seasonChanged = !this.staticKey.endsWith(`:${season}`);
    this.staticKey = key;
    if (!this.scenery || seasonChanged || this.sceneryTerrainV !== state.rt.worldVersion) {
      this.scenery = generateScenery(state.seed, state.world.terrain);
      this.sceneryTerrainV = state.rt.worldVersion;
    }
    if (!this.mountains || this.mountainSeason !== season) {
      this.mountains = buildMountains(season);
      this.mountainSeason = season;
    }
    this.walls = buildWallList(state);
    this.water = [];
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if (state.world.terrain[y * MAP_W + x] === TERRAIN.WATER) this.water.push([x, y]);
    this.roomLights = [];
    for (const r of Object.values(state.world.rooms)) {
      if (!ROOM_TYPES[r.type].indoor) continue;
      let sx = 0, sy = 0;
      for (const i of r.tiles) { sx += i % MAP_W; sy += (i / MAP_W) | 0; }
      const n = r.tiles.length;
      this.roomLights.push({ x: sx / n + 0.5, y: sy / n + 0.5, z: 1, r: 1.3 + Math.sqrt(n) * 0.75, color: '#ffcf8a', a: 0.75 });
    }
    // Enseigne près de l'entrée
    this.sign = null;
    for (const k of state.world.doors) {
      const e = parseEdge(k);
      const ra = state.rt.roomAt[idx(Math.max(0, e.a[0]), Math.max(0, e.a[1]))], rb = state.rt.roomAt[idx(e.b[0], e.b[1])];
      const rec = (id) => id && state.world.rooms[id]?.type === 'reception';
      if (rec(ra) && !rb) this.sign = { x: e.b[0] - (e.d === 'n' ? 1 : 0) + 0.5, y: e.b[1] + (e.d === 'w' ? 1 : 0) + 0.5 };
      else if (rec(rb) && !ra) this.sign = { x: e.a[0] - (e.d === 'n' ? 1 : 0) + 0.5, y: e.a[1] + (e.d === 'w' ? 1 : 0) + 0.5 };
    }
  }

  // ---------------------------------------------------------------- Rendu principal
  render(state, ui, dt) {
    this.t += dt;
    const ctx = this.ctx;
    const c = clock(state.time);
    const season = c.seasonIndex;
    const hf = c.hf;
    const weather = state.weather.today;
    setSpriteScale(Math.min(2, this.dpr * Math.max(1, Math.min(this.cam.zoom, 1.6))) * (this.quality === 'low' ? 0.75 : 1));
    this.ensureGround(state, season);
    this.ensureStatic(state, season);
    const { w, h, dpr } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Ciel
    const [top, bot] = skyColors(hf, weather);
    const sg = ctx.createLinearGradient(0, 0, 0, h);
    sg.addColorStop(0, top); sg.addColorStop(0.75, bot); sg.addColorStop(1, bot);
    ctx.fillStyle = sg; ctx.fillRect(0, 0, w, h);
    const dark = darkness(hf, weather);
    this.drawSkyObjects(ctx, hf, dark, weather);
    // Monde
    const z = this.cam.zoom;
    const setWorld = (f = 1) => ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (w / 2 - this.cam.x * z * f), dpr * (h / 2 - this.cam.y * z * f));
    this.drawMountains(ctx, setWorld, dark);
    setWorld();
    // fond forestier sous la carte
    ctx.fillStyle = ['#3e6a3e', '#476a38', '#5a5a32', '#dfe7ee'][season];
    ctx.fillRect(-2600, 500, 5200, 2000);
    const [gx0, gy0, gx1, gy1] = this.groundBounds;
    ctx.drawImage(this.groundCanvas, gx0, gy0, gx1 - gx0, gy1 - gy0);
    this.drawWaterFx(ctx, season);
    if (ui.showParcels) this.drawParcels(ctx, state, ui.mode === 'parcels');
    if (ui.mode && ui.mode !== 'none') this.drawGrid(ctx, state, ui);
    this.drawCloudShadows(ctx, weather, hf);
    // Objets triés
    const items = this.collect(state, ui, season, hf);
    items.sort((a, b) => a.k - b.k);
    const vw = this.viewRect();
    for (const it of items) {
      if (it.bx !== undefined && (it.bx < vw[0] - 140 || it.bx > vw[2] + 140 || it.by < vw[1] - 60 || it.by > vw[3] + 220)) continue;
      it.d(ctx);
    }
    this.particles.update(dt, weather, season, hf, { w, h });
    this.particles.drawWorld(ctx);
    // Bulles et icônes
    this.drawOverlays(ctx, state, ui);
    // Éclairage
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.quality !== 'low' || dark > 0.3) {
      const gold = golden(hf);
      if (gold > 0.02 && dark < 0.5) { ctx.fillStyle = `rgba(255,150,80,${0.12 * gold})`; ctx.globalCompositeOperation = 'soft-light'; ctx.fillRect(0, 0, w, h); ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = `rgba(255,170,90,${0.06 * gold})`; ctx.fillRect(0, 0, w, h); }
      this.lighting.render(ctx, w, h, dark, '#0b1638', this.lightList(state, hf, dark), this.worldToScreen, z, this.t);
    }
    if (weather === 'brouillard' || weather === 'tempete') {
      const fg = ctx.createLinearGradient(0, 0, 0, h);
      fg.addColorStop(0, 'rgba(225,230,236,0.55)'); fg.addColorStop(1, 'rgba(225,230,236,0.25)');
      ctx.fillStyle = fg; ctx.fillRect(0, 0, w, h);
    }
    if (weather === 'orage' && Math.sin(this.t * 0.7) > 0.995) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(0, 0, w, h); }
    this.particles.drawScreen(ctx);
    // Aides de construction au-dessus de l'éclairage
    setWorld();
    this.drawBuildPreview(ctx, state, ui, season);
    this.fps = this.fps * 0.95 + (1 / Math.max(dt, 0.001)) * 0.05;
  }

  viewRect() {
    const [x0, y0] = this.screenToWorldPx(0, 0), [x1, y1] = this.screenToWorldPx(this.w, this.h);
    return [x0, y0, x1, y1];
  }

  drawSkyObjects(ctx, hf, dark, weather) {
    const { w, h } = this;
    if (dark > 0.25 && (weather === 'soleil' || weather === 'nuages')) {
      ctx.fillStyle = '#fff';
      for (const [sx, sy, r, ph] of this.stars) {
        ctx.globalAlpha = clamp((dark - 0.25) * 2.4, 0, 1) * (0.5 + 0.5 * Math.sin(this.t * 1.5 + ph));
        ctx.fillRect(sx * w, sy * h, r, r);
      }
      ctx.globalAlpha = 1;
    }
    const overcast = { pluie: 1, orage: 1, tempete: 1, brouillard: 0.7, neige: 0.8 }[weather] || 0;
    if (overcast < 1) {
      // soleil (6h-20h) ou lune
      const day = hf >= 6 && hf <= 20;
      const p = day ? (hf - 6) / 14 : ((hf + 4) % 24) / 10;
      const x = w * (0.1 + 0.8 * p), y = h * (0.42 - Math.sin(p * Math.PI) * 0.34);
      ctx.globalAlpha = 1 - overcast;
      if (day) {
        const g = ctx.createRadialGradient(x, y, 4, x, y, 90);
        g.addColorStop(0, 'rgba(255,248,220,0.95)'); g.addColorStop(0.15, 'rgba(255,236,180,0.6)'); g.addColorStop(1, 'rgba(255,220,150,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 90, 0, 7); ctx.fill();
      } else {
        ctx.fillStyle = '#f2efe4'; ctx.beginPath(); ctx.arc(x, y, 14, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(11,18,40,0.85)'; ctx.beginPath(); ctx.arc(x + 6, y - 3, 12, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    if (!this.clouds) this.clouds = makeClouds();
  }

  drawMountains(ctx, setWorld, dark) {
    const { dpr } = this;
    const z = this.cam.zoom;
    for (const L of this.mountains) {
      // Parallaxe : le calque se déplace f fois moins que le monde.
      const f = L.f;
      const zz = 0.6 + z * 0.4;
      const ox = this.w / 2 - this.cam.x * zz * f, oy = this.h / 2 - (this.cam.y - 300) * zz * f - 300 * zz;
      ctx.setTransform(dpr * zz, 0, 0, dpr * zz, dpr * ox, dpr * oy);
      ctx.drawImage(L.canvas, L.ox, L.oy, L.w, L.h);
      if (L === this.mountains[0] && this.clouds) {
        for (const c of this.clouds) {
          c.x += c.speed * 0.016;
          if (c.x > 2600) c.x = -2800;
          ctx.globalAlpha = 0.85 - dark * 0.6;
          ctx.drawImage(c.canvas, c.x, c.y, c.canvas.width * c.s, c.canvas.height * c.s);
          ctx.globalAlpha = 1;
        }
      }
    }
  }

  drawWaterFx(ctx, season) {
    if (season === 3) return;
    const t = this.t;
    const vw = this.viewRect();
    ctx.lineWidth = 1.2;
    for (const [x, y] of this.water) {
      const [px, py] = iso(x + 0.5, y + 0.5);
      if (px < vw[0] - 40 || px > vw[2] + 40 || py < vw[1] - 20 || py > vw[3] + 20) continue;
      const a = Math.sin(t * 1.3 + x * 0.9 + y * 0.6);
      if (a > 0.3) {
        ctx.strokeStyle = `rgba(220,240,250,${(a - 0.3) * 0.5})`;
        const ox = Math.sin(t * 0.8 + y) * 6;
        ctx.beginPath(); ctx.moveTo(px - 10 + ox, py - 2); ctx.lineTo(px + 2 + ox, py - 2); ctx.stroke();
      }
      if (hash2(x, y, Math.floor(t * 2)) < 0.004) this.particles.emitWorld('sparkle', x + Math.random(), y + Math.random(), 0.02);
    }
  }

  drawCloudShadows(ctx, weather, hf) {
    if (weather !== 'soleil' && weather !== 'nuages') return;
    if (hf < 7 || hf > 19) return;
    for (let k = 0; k < 3; k++) {
      const x = ((this.t * 14 + k * 900) % 3600) - 1800, y = 200 + k * 380;
      const g = ctx.createRadialGradient(x, y, 20, x, y, 260);
      g.addColorStop(0, 'rgba(30,40,60,0.10)'); g.addColorStop(1, 'rgba(30,40,60,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, 300, 150, 0, 0, 7); ctx.fill();
    }
  }

  // ---------------------------------------------------------------- Collecte des objets triés
  collect(state, ui, season, hf) {
    const items = [];
    const push = (k, bx, by, d) => items.push({ k, bx, by, d });
    const winter = season === 3;
    // Murs
    for (const wl of this.walls) {
      const [bx, by] = iso(wl.cx, wl.cy);
      push(wl.k, bx, by, (ctx) => drawWall(ctx, state, wl, season, hf));
    }
    // Mobilier
    for (const f of Object.values(state.world.furniture)) {
      if (ui.moving && ui.moving === f.id) continue;
      const def = FURNITURE[f.type];
      const [fw, fd] = footprint(def, f.rot);
      const k = f.x + fw / 2 + f.y + fd / 2 + (def.walkable ? -50 : 0);
      const sp = furnitureSprite(f.type, f.rot, season);
      const [ax, ay] = iso(f.x, f.y);
      push(k, ax, ay, (ctx) => {
        drawSprite(ctx, sprite(sp.key, sp.bounds, sp.draw), ax, ay);
        if (def.light && def.light.flicker) drawFlame(ctx, f, def, this.t);
        if (ui.selected && ui.selected.kind === 'furniture' && ui.selected.id === f.id) outlineCells(ctx, furnCells(f), '#ffd65a');
      });
      if (def.smoke && Math.random() < 0.05) this.particles.emitWorld('smoke', f.x + fw / 2, f.y, 2.4);
      if (def.steam && Math.random() < (winter ? 0.25 : 0.1)) this.particles.emitWorld('steam', f.x + fw / 2, f.y + fd / 2, 0.8);
    }
    // Arbres et bâtiments
    for (const tr of this.scenery.trees) {
      const [bx, by] = iso(tr.x, tr.y);
      const sp = treeSprite(tr.kind, season, tr.v);
      const s = tr.s;
      const sway = Math.sin(this.t * 1.2 + tr.x * 0.7) * 0.012;
      push(tr.x + tr.y, bx, by, (ctx) => {
        const spr = sprite(sp.key, sp.bounds, sp.draw);
        ctx.save(); ctx.translate(bx, by); ctx.scale(s, s); ctx.transform(1, 0, sway, 1, 0, 0);
        drawSprite(ctx, spr, 0, 0);
        ctx.restore();
      });
    }
    for (const b of this.scenery.buildings) {
      const sp = buildingSprite(b, season);
      const [bx, by] = iso(b.x, b.y);
      push(b.x + b.w / 2 + b.y + b.h / 2, bx, by, (ctx) => drawSprite(ctx, sprite(sp.key, sp.bounds, sp.draw), bx, by));
      if (Math.random() < 0.03 && b.kind !== 'barn') this.particles.emitWorld('smoke', b.x + b.w * 0.3 + 0.15, b.y + b.h * 0.35 + 0.15, b.kind === 'shed' ? 2.6 : 3.2);
    }
    if (this.sign) {
      const s = this.sign;
      const [bx, by] = iso(s.x, s.y);
      push(s.x + s.y, bx, by, (ctx) => drawSign(ctx, s.x, s.y, state.innName, season));
    }
    // Agents
    const now = this.t;
    for (const g of state.guests) {
      if (g.hidden || g.gone) continue;
      this.pushGuest(state, g, push, now, winter, ui);
    }
    for (const s of state.staff) {
      if (s.hidden || !s.present) continue;
      const moving = this.isMoving(s);
      const pose = moving ? 'walk' : s.pose || 'stand';
      const [bx, by] = iso(s.x, s.y);
      push(s.x + s.y, bx, by, (ctx) => drawPerson(ctx, bx, by, { look: s.look, dir: s.dir, pose, t: now + s.id, carry: s.carry, winter, selected: ui.selected?.kind === 'staff' && ui.selected.id === s.id }));
    }
    // Chat de l'auberge
    if (state.flags.cat) {
      const lounge = Object.values(state.world.rooms).find((r) => r.type === 'lounge');
      if (lounge) {
        const tiles = lounge.tiles.filter((i) => state.rt.walk[i]);
        if (tiles.length) {
          const slot = Math.floor(state.time / 45);
          const i = tiles[Math.floor(hash2(slot, 3, 5) * tiles.length)];
          const x = (i % MAP_W) + 0.5, y = ((i / MAP_W) | 0) + 0.5;
          const [bx, by] = iso(x, y);
          push(x + y, bx, by, (ctx) => drawCat(ctx, bx, by, this.t, hf > 21 || hf < 7 || hash2(slot, 1, 1) < 0.4));
        }
      }
    }
    // Charrette du fournisseur
    const cart = cartPosition(state, hf);
    if (cart) {
      const [bx, by] = iso(cart.x, cart.y);
      push(cart.x + cart.y, bx, by, (ctx) => drawCart(ctx, cart, this.t));
    }
    return items;
  }

  isMoving(a) {
    const prev = this.prevPos.get(a.kind + a.id);
    const moving = prev ? Math.abs(prev[0] - a.x) + Math.abs(prev[1] - a.y) > 0.0005 : false;
    this.prevPos.set(a.kind + a.id, [a.x, a.y, moving ? this.t : prev ? prev[2] : 0]);
    // Lissage : on reste en « marche » un court instant pour éviter le clignotement à grande vitesse.
    return moving || (prev && this.t - prev[2] < 0.12);
  }

  pushGuest(state, g, push, now, winter, ui) {
    const moving = this.isMoving(g);
    const sel = ui.selected?.kind === 'guest' && ui.selected.id === g.id;
    // Traînée pour les accompagnants
    let tr = this.trails.get(g.id);
    if (!tr) { tr = [[g.x, g.y]]; this.trails.set(g.id, tr); }
    const last = tr[0];
    if (Math.hypot(last[0] - g.x, last[1] - g.y) > 0.18) { tr.unshift([g.x, g.y]); if (tr.length > 24) tr.pop(); }
    const settled = !moving && g.memberSpots && g.act && g.act.phase !== 'walk';
    g.members.forEach((m, k) => {
      let x, y, pose = moving ? 'walk' : (g.pose === 'walk' ? 'stand' : g.pose), dir = g.dir, zOff = 0;
      if (settled && g.memberSpots[k]) {
        const s = g.memberSpots[k];
        x = s.x; y = s.y; pose = s.pose || pose; dir = s.face || dir;
        if (s.extra) { x += 0.32 * (s.extra % 2 ? 1 : -1); y += 0.3; pose = 'stand'; }
        zOff = s.z || 0;
      } else if (k === 0) { x = g.x; y = g.y; }
      else {
        const p = tr[Math.min(tr.length - 1, k * 3)] || tr[tr.length - 1];
        x = p[0] + (k % 2 ? 0.18 : -0.18); y = p[1] + 0.12;
        if (!moving) { x = g.x + [0, -0.4, 0.35, -0.1][k] ; y = g.y + [0, 0.25, 0.3, 0.55][k]; }
      }
      const tx = Math.floor(x), ty = Math.floor(y);
      const fid = tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H ? (state.rt.seatAt[idx(tx, ty)] || state.rt.furnAt[idx(tx, ty)]) : 0;
      const f = fid ? state.world.furniture[fid] : null;
      let k0 = x + y;
      if (f && (pose === 'sit' || pose === 'lie' || pose === 'bathe' || pose === 'recline' || pose === 'swing')) {
        const def = FURNITURE[f.type];
        const [fw, fd] = footprint(def, f.rot);
        const fk = f.x + fw / 2 + f.y + fd / 2;
        const front = (dir[0] + dir[1]) >= 0;
        k0 = fk + (pose === 'lie' || pose === 'bathe' || front ? 0.01 : -0.01);
      }
      if (pose === 'inside') return;
      const [bx, by] = iso(x, y);
      const look = m.look;
      push(k0 + k * 0.001, bx, by, (ctx) => {
        if (pose === 'lie' && f) {
          const fdir = frontDir(f.rot);
          const isBed = !!QUILT[f.type];
          const zb = (isBed ? 0.48 : 0.78) + zOff;
          const [hx, hy] = iso(x - fdir[0] * 0.26, y - fdir[1] * 0.26, zb);
          const [ex, ey] = iso(x + fdir[0] * 0.75, y + fdir[1] * 0.75, zb - 0.05);
          drawSleeper(ctx, hx, hy, look, isBed ? QUILT[f.type] : '#efe6d6', ex, ey, m.kid);
          return;
        }
        if (pose === 'bathe') { const [px, py] = iso(x, y, 0.6); drawBather(ctx, px, py, look); return; }
        let z = 0;
        let p = pose;
        if ((pose === 'sit' || pose === 'recline') && f) z = SEAT_Z[f.type] ?? 0.45;
        if (pose === 'swing') { z = 0.5; p = 'sit'; }
        if (pose === 'recline') p = 'sit';
        const sw = pose === 'swing' ? Math.sin(now * 2.5) * 0.25 : 0;
        const [px, py] = iso(x + dir[0] * sw, y + dir[1] * sw, z);
        drawPerson(ctx, px, py, { look, dir, pose: p, t: now + g.id * 0.37 + k, kid: m.kid, winter, selected: sel && k === 0 });
      });
    });
  }

  // ---------------------------------------------------------------- Surimpressions
  drawOverlays(ctx, state, ui) {
    const t = this.t;
    for (const g of state.guests) {
      if (g.hidden || g.gone) continue;
      let kind = null;
      if (g.bubble) kind = g.bubble;
      else if (g.music) kind = 'music';
      else if (g.mood && g.moodT > 0) kind = g.mood;
      else if (g.act && g.act.kind === 'queue' && g.wait > 25) kind = 'wait';
      else if (g.act && (g.act.kind === 'dine' || g.act.kind === 'bar') && g.act.phase === 'wait' && g.act.wait > 10) kind = 'food';
      if (g.story && !kind && Math.sin(t * 2 + g.id) > 0.3) kind = 'star';
      if (!kind) continue;
      let x = g.x, y = g.y, z = 1.45;
      if (g.memberSpots && g.memberSpots[0] && !this.isMovingQuiet(g)) { x = g.memberSpots[0].x; y = g.memberSpots[0].y; }
      if (g.pose === 'lie') z = 1.05;
      const [px, py] = iso(x, y, z);
      if (kind === 'star') drawStar(ctx, px, py - 4, t);
      else drawBubble(ctx, px, py, kind, t + g.id);
    }
    // Icônes d'alerte sur les pièces
    if (this.cam.zoom > 0.55) {
      for (const r of Object.values(state.world.rooms)) {
        const st = state.rt.roomStats[r.id];
        if (!st) continue;
        const bad = !st.ok || !st.reachable;
        const showLabel = ui.mode && ui.mode !== 'none';
        if (!bad && !showLabel) continue;
        let sx = 0, sy = 0;
        for (const i of r.tiles) { sx += i % MAP_W; sy += (i / MAP_W) | 0; }
        const cx = sx / r.tiles.length + 0.5, cy = sy / r.tiles.length + 0.5;
        const [px, py] = iso(cx, cy, 0.6);
        if (showLabel) roomLabel(ctx, px, py + (bad ? 16 : 0), r, ROOM_TYPES[r.type]);
        if (bad) warnIcon(ctx, px, py - 10, t);
      }
    }
  }
  isMovingQuiet(a) { const p = this.prevPos.get(a.kind + a.id); return p && this.t - p[2] < 0.12; }

  drawParcels(ctx, state, labels) {
    for (const p of PARCELS) {
      const owned = state.world.ownedParcels.includes(p.id);
      const [x0, y0, x1, y1] = p.rect;
      const pts = [iso(x0, y0, 0.02), iso(x1 + 1, y0, 0.02), iso(x1 + 1, y1 + 1, 0.02), iso(x0, y1 + 1, 0.02)];
      if (owned) { poly(ctx, pts, null, 'rgba(255,240,200,0.55)', 1.5); continue; }
      const can = state.tier >= p.tier;
      poly(ctx, pts, can ? 'rgba(255,214,90,0.12)' : 'rgba(40,30,20,0.18)', can ? 'rgba(255,214,90,0.85)' : 'rgba(80,60,40,0.5)', 2);
      ctx.setLineDash([]);
      if (!labels) continue;
      const [cx, cy] = iso((x0 + x1 + 1) / 2, (y0 + y1 + 1) / 2, 0.3);
      pill(ctx, cx, cy, `${p.name} · ${p.cost.toLocaleString('fr-FR')} écus${can ? '' : ` · palier ${p.tier}`}`, can ? '#fff7e2' : '#e8e0d4', can ? '#5a3d1e' : '#6b6055');
    }
  }

  drawGrid(ctx, state, ui) {
    const vw = this.viewRect();
    ctx.strokeStyle = 'rgba(255,255,255,0.13)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      if (!isOwned(state, x, y)) continue;
      const [px, py] = iso(x, y);
      if (px < vw[0] - 40 || px > vw[2] + 40 || py < vw[1] - 40 || py > vw[3] + 40) continue;
      const [ax, ay] = iso(x + 1, y), [bx, by] = iso(x, y + 1);
      ctx.moveTo(bx, by); ctx.lineTo(px, py); ctx.lineTo(ax, ay);
    }
    ctx.stroke();
  }

  drawBuildPreview(ctx, state, ui, season) {
    const pv = ui.preview;
    if (ui.hoverRoom) {
      const r = state.world.rooms[ui.hoverRoom];
      if (r) for (const i of r.tiles) diamond(ctx, i % MAP_W, (i / MAP_W) | 0, 1, 1, 0.01, ui.mode === 'demolish' ? 'rgba(220,70,60,0.35)' : 'rgba(255,214,90,0.3)');
    }
    if (ui.selected && ui.selected.kind === 'room') {
      const r = state.world.rooms[ui.selected.id];
      if (r) outlineRoom(ctx, state, r, '#ffd65a');
    }
    if (!pv) return;
    if (pv.kind === 'rect') {
      const [x0, y0, x1, y1] = pv.rect;
      const col = pv.ok ? 'rgba(120,210,120,0.42)' : 'rgba(230,80,70,0.42)';
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) diamond(ctx, x, y, 1, 1, 0.01, col, 'rgba(255,255,255,0.35)');
      const [px, py] = iso((x0 + x1 + 1) / 2, (y0 + y1 + 1) / 2, 0.5);
      pill(ctx, px, py, pv.ok ? `${x1 - x0 + 1}×${y1 - y0 + 1} · ${pv.cost} écus` : pv.reason, pv.ok ? '#f2fff0' : '#fff0ee', pv.ok ? '#24502a' : '#8a2a22');
    } else if (pv.kind === 'furniture') {
      const def = FURNITURE[pv.type];
      const [fw, fd] = footprint(def, pv.rot);
      const col = pv.ok ? 'rgba(120,210,120,0.4)' : 'rgba(230,80,70,0.45)';
      diamond(ctx, pv.x, pv.y, fw, fd, 0.01, col, 'rgba(255,255,255,0.5)');
      const sp = furnitureSprite(pv.type, pv.rot, season);
      const [ax, ay] = iso(pv.x, pv.y);
      ctx.globalAlpha = 0.78;
      drawSprite(ctx, sprite(sp.key, sp.bounds, sp.draw), ax, ay);
      ctx.globalAlpha = 1;
      if (!pv.ok && pv.reason) { const [px, py] = iso(pv.x + fw / 2, pv.y + fd / 2, 1.6); pill(ctx, px, py, pv.reason, '#fff0ee', '#8a2a22'); }
    } else if (pv.kind === 'edge') {
      const { ax, ay, bx, by } = pv;
      let p0, p1;
      if (ax === bx) { const y = Math.max(ay, by); p0 = [ax, y]; p1 = [ax + 1, y]; } else { const x = Math.max(ax, bx); p0 = [x, ay]; p1 = [x, ay + 1]; }
      const a = iso(p0[0], p0[1], 0), b = iso(p1[0], p1[1], 0), c2 = iso(p1[0], p1[1], 1.2), d = iso(p0[0], p0[1], 1.2);
      poly(ctx, [a, b, c2, d], pv.ok ? 'rgba(120,210,120,0.5)' : 'rgba(230,80,70,0.5)', '#fff', 1.5);
      if (pv.label) { const [px, py] = iso((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, 1.6); pill(ctx, px, py, pv.label, '#fffbe8', '#4a3a20'); }
    } else if (pv.kind === 'tile') {
      diamond(ctx, pv.x, pv.y, 1, 1, 0.01, 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0.6)');
    }
  }

  // ---------------------------------------------------------------- Lumières
  lightList(state, hf, dark) {
    const out = [];
    if (dark < 0.05) return out;
    for (const L of this.roomLights) out.push(L);
    for (const f of Object.values(state.world.furniture)) {
      const def = FURNITURE[f.type];
      if (!def.light) continue;
      const [fw, fd] = footprint(def, f.rot);
      out.push({ x: f.x + fw / 2, y: f.y + fd / 2, z: def.light.z, r: def.light.r, color: def.light.color, flicker: def.light.flicker });
    }
    for (const b of this.scenery.buildings) if (b.kind === 'house') out.push({ x: b.x + b.w / 2, y: b.y + b.h, z: 1, r: 2.2, color: '#ffc46a', a: 0.8 });
    if (this.sign) out.push({ x: this.sign.x, y: this.sign.y, z: 1.6, r: 1.8, color: '#ffc46a' });
    const cart = cartPosition(state, hf);
    if (cart) out.push({ x: cart.x, y: cart.y, z: 1.2, r: 1.6, color: '#ffc46a' });
    return out;
  }

  // ---------------------------------------------------------------- Sélection
  pickAgent(state, sx, sy) {
    let best = null, bd = 26 * Math.max(0.7, this.cam.zoom);
    const test = (a, x, y) => {
      const [px, py] = this.worldToScreen(x, y, 0.55);
      const d = Math.hypot(px - sx, py - sy);
      if (d < bd) { bd = d; best = a; }
    };
    for (const g of state.guests) {
      if (g.hidden || g.gone) continue;
      if (g.memberSpots && !this.isMovingQuiet(g)) g.memberSpots.forEach((s) => s && test(g, s.x, s.y));
      else test(g, g.x, g.y);
    }
    for (const s of state.staff) if (s.present && !s.hidden) test(s, s.x, s.y);
    return best;
  }
}

// ---------------------------------------------------------------- Murs

function buildWallList(state) {
  const rooms = state.world.rooms;
  const out = [];
  for (const e of listWalls(state)) {
    const front = e.d === 'n' ? [e.x, e.y] : [e.x, e.y];
    const back = e.d === 'n' ? [e.x, e.y - 1] : [e.x - 1, e.y];
    const inb = (p) => p[0] >= 0 && p[1] >= 0 && p[0] < MAP_W && p[1] < MAP_H;
    const fr = inb(front) ? rooms[state.rt.roomAt[idx(front[0], front[1])]] : null;
    const br = inb(back) ? rooms[state.rt.roomAt[idx(back[0], back[1])]] : null;
    const fIn = fr && ROOM_TYPES[fr.type].indoor, bIn = br && ROOM_TYPES[br.type].indoor;
    const full = fIn && !bIn;
    const exterior = !fIn; // face visible = extérieur du bâtiment
    const door = state.rt.doors.has(e.key);
    const style = fIn ? (WALLS[fr.wall] || WALLS.bois) : null;
    const cx = e.d === 'n' ? e.x + 0.5 : e.x, cy = e.d === 'n' ? e.y : e.y + 0.5;
    const win = full && !door && hash2(e.x, e.y, e.d === 'n' ? 3 : 4) < 0.62;
    out.push({ ...e, cx, cy, k: cx + cy, full, exterior, door, style, win, frontRoom: fr, backRoom: br });
  }
  return out;
}

function drawWall(ctx, state, wl, season, hf) {
  const t = WALL_T / 2;
  const n = wl.d === 'n';
  const H = wl.full ? FULL_H : wl.exterior ? EXT_LOW_H : LOW_H;
  const [x0, y0, w, d] = n ? [wl.x, wl.y - t, 1, WALL_T] : [wl.x - t, wl.y, WALL_T, 1];
  let face, top;
  if (wl.exterior) { face = '#9a8f7f'; top = '#7a5a3a'; }
  else { face = wl.style.colors[0]; top = shade(wl.style.colors[1], -0.25); }
  const colObj = (c) => n ? { top, left: c, right: shade(c, -0.25) } : { top, left: shade(c, -0.12), right: c };
  if (wl.door) {
    // Encadrement de porte
    const postH = wl.full ? 1.6 : H + 0.1;
    const pc = wl.exterior || wl.full ? '#6b4528' : shade(face, -0.35);
    if (n) { box(ctx, x0, y0, 0, 0.1, WALL_T, postH, pc); box(ctx, x0 + 0.9, y0, 0, 0.1, WALL_T, postH, pc); }
    else { box(ctx, x0, y0, 0, WALL_T, 0.1, postH, pc); box(ctx, x0, y0 + 0.9, 0, WALL_T, 0.1, postH, pc); }
    if (wl.full) {
      if (n) box(ctx, x0, y0, 1.6, 1, WALL_T, FULL_H - 1.6, colObj(face)); else box(ctx, x0, y0, 1.6, WALL_T, 1, FULL_H - 1.6, colObj(face));
    } else if (!wl.exterior) {
      // seuil
      if (n) box(ctx, x0 + 0.1, y0, 0, 0.8, WALL_T, 0.03, '#8a6a4a'); else box(ctx, x0, y0 + 0.1, 0, WALL_T, 0.8, 0.03, '#8a6a4a');
    }
    return;
  }
  if (wl.full) {
    if (n) box(ctx, x0, y0, 0, w, d, H, colObj(face)); else box(ctx, x0, y0, 0, w, d, H, colObj(face));
    const fy = n ? wl.y + t : wl.y; const fx = n ? wl.x : wl.x + t;
    // plinthe et lambris
    const base = shade(face, -0.28);
    if (n) faceS(ctx, wl.x, wl.x + 1, fy, 0, 0.12, base); else faceE(ctx, fx, wl.y, wl.y + 1, 0, 0.12, base);
    if (wl.style && wl.style.colors[1] && (wl.frontRoom.wall === 'fleuri')) {
      for (let k = 0; k < 3; k++) for (let j = 0; j < 4; j++) {
        const [px, py] = n ? iso(wl.x + 0.2 + k * 0.3, fy, 0.35 + j * 0.42) : iso(fx, wl.y + 0.2 + k * 0.3, 0.35 + j * 0.42);
        ctx.fillStyle = wl.style.colors[1]; ctx.beginPath(); ctx.arc(px, py, 1.6, 0, 7); ctx.fill();
      }
    } else if (wl.frontRoom.wall === 'bois' || wl.frontRoom.wall === 'lambris' || wl.frontRoom.wall === 'boiseries') {
      ctx.strokeStyle = 'rgba(60,35,15,0.18)'; ctx.lineWidth = 0.7; ctx.beginPath();
      for (let k = 1; k < 7; k++) { const z = k * 0.29; const a = n ? iso(wl.x, fy, z) : iso(fx, wl.y, z), b = n ? iso(wl.x + 1, fy, z) : iso(fx, wl.y + 1, z); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
      ctx.stroke();
    } else if (wl.frontRoom.wall === 'pierre') {
      ctx.strokeStyle = 'rgba(60,55,50,0.25)'; ctx.lineWidth = 0.7; ctx.beginPath();
      for (let k = 1; k < 6; k++) { const z = k * 0.34; const a = n ? iso(wl.x, fy, z) : iso(fx, wl.y, z), b = n ? iso(wl.x + 1, fy, z) : iso(fx, wl.y + 1, z); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); const o = (k % 2) * 0.5 + 0.25; const c1 = n ? iso(wl.x + o, fy, z) : iso(fx, wl.y + o, z), c2 = n ? iso(wl.x + o, fy, z - 0.34) : iso(fx, wl.y + o, z - 0.34); ctx.moveTo(c1[0], c1[1]); ctx.lineTo(c2[0], c2[1]); }
      ctx.stroke();
    }
    if (wl.win) drawWindow(ctx, wl, n, fx, fy, season, hf);
    // Avant-toit du chalet
    const sn = season === 3;
    const roof = sn ? '#eef3f7' : '#6b3f2a';
    if (n) poly(ctx, [iso(wl.x - 0.02, wl.y - t, H), iso(wl.x + 1.02, wl.y - t, H), iso(wl.x + 1.02, wl.y - 0.75, H + 0.42), iso(wl.x - 0.02, wl.y - 0.75, H + 0.42)], shade(roof, 0.05), 'rgba(40,20,10,0.35)', 0.6);
    else poly(ctx, [iso(wl.x - t, wl.y - 0.02, H), iso(wl.x - t, wl.y + 1.02, H), iso(wl.x - 0.75, wl.y + 1.02, H + 0.42), iso(wl.x - 0.75, wl.y - 0.02, H + 0.42)], shade(roof, -0.12), 'rgba(40,20,10,0.35)', 0.6);
    // poutre d'angle
    if (n) box(ctx, wl.x - 0.06, wl.y - 0.06, 0, 0.12, 0.12, H + 0.05, '#5b3a22'); else box(ctx, wl.x - 0.06, wl.y - 0.06, 0, 0.12, 0.12, H + 0.05, '#5b3a22');
    return;
  }
  if (wl.exterior) {
    // Muret extérieur : soubassement de pierre et lisse en bois, jardinière à la belle saison
    box(ctx, x0, y0, 0, w, d, H - 0.12, n ? { top: '#8a8273', left: '#a39a8a', right: '#857c6e' } : { top: '#8a8273', left: '#958c7c', right: '#a39a8a' });
    box(ctx, x0 - (n ? 0 : 0.02), y0 - (n ? 0.02 : 0), H - 0.12, w + (n ? 0 : 0.04), d + (n ? 0.04 : 0), 0.12, '#8a5a33');
    if (season === 3) box(ctx, x0, y0, H, w, d, 0.06, '#f4f7fb', { edge: 'rgba(150,170,190,0.4)' });
    else if (season < 2 && hash2(wl.x, wl.y, 9) < 0.5) {
      const cx = n ? wl.x + 0.5 : wl.x + 0.1, cy = n ? wl.y + 0.1 : wl.y + 0.5;
      const [px, py] = iso(cx, cy, H + 0.1);
      ctx.fillStyle = '#7a4a2a'; ctx.fillRect(px - 9, py - 2, 18, 5);
      for (let k = 0; k < 6; k++) { ctx.fillStyle = k % 2 ? '#d9343f' : '#4f8f3f'; ctx.beginPath(); ctx.arc(px - 7 + k * 2.8, py - 3 - (k % 2) * 1.5, 2.2, 0, 7); ctx.fill(); }
    }
    return;
  }
  box(ctx, x0, y0, 0, w, d, H, colObj(face));
}

function drawWindow(ctx, wl, n, fx, fy, season, hf) {
  const z0 = 0.72, z1 = 1.55, a0 = 0.2, a1 = 0.8;
  const P = (u, z) => (n ? iso(wl.x + u, fy + 0.005, z) : iso(fx + 0.005, wl.y + u, z));
  const night = hf < 6 || hf > 20.5;
  const dusk = hf > 18 && hf <= 20.5;
  poly(ctx, [P(a0 - 0.05, z0 - 0.06), P(a1 + 0.05, z0 - 0.06), P(a1 + 0.05, z1 + 0.05), P(a0 - 0.05, z1 + 0.05)], '#5b3a22');
  const g = ctx.createLinearGradient(0, P(0.5, z1)[1], 0, P(0.5, z0)[1]);
  if (night) { g.addColorStop(0, '#1a2a52'); g.addColorStop(1, '#2c3d6a'); }
  else if (dusk) { g.addColorStop(0, '#e98a62'); g.addColorStop(1, '#f5c48e'); }
  else { g.addColorStop(0, season === 3 ? '#cfe2f2' : '#9cc9ea'); g.addColorStop(1, season === 3 ? '#f2f7fb' : '#dff0f8'); }
  poly(ctx, [P(a0, z0), P(a1, z0), P(a1, z1), P(a0, z1)], g);
  // petite montagne dans le reflet
  if (!night) poly(ctx, [P(a0, z0), P(0.45, z0 + 0.32), P(0.6, z0 + 0.18), P(a1, z0 + 0.36), P(a1, z0)], 'rgba(90,120,150,0.35)');
  ctx.strokeStyle = '#5b3a22'; ctx.lineWidth = 1.4;
  const m1 = P(0.5, z0), m2 = P(0.5, z1), h1 = P(a0, (z0 + z1) / 2), h2 = P(a1, (z0 + z1) / 2);
  ctx.beginPath(); ctx.moveTo(m1[0], m1[1]); ctx.lineTo(m2[0], m2[1]); ctx.moveTo(h1[0], h1[1]); ctx.lineTo(h2[0], h2[1]); ctx.stroke();
  // rideaux
  const cur = '#c45a5a';
  poly(ctx, [P(a0 - 0.04, z1 + 0.02), P(a0 + 0.1, z1 + 0.02), P(a0 + 0.04, z0 - 0.02), P(a0 - 0.04, z0 - 0.02)], cur);
  poly(ctx, [P(a1 - 0.1, z1 + 0.02), P(a1 + 0.04, z1 + 0.02), P(a1 + 0.04, z0 - 0.02), P(a1 - 0.04, z0 - 0.02)], cur);
  poly(ctx, [P(a0 - 0.06, z0 - 0.08), P(a1 + 0.06, z0 - 0.08), P(a1 + 0.06, z0 - 0.02), P(a0 - 0.06, z0 - 0.02)], '#8a5a33');
}

function drawFlame(ctx, f, def, t) {
  const [fw, fd] = footprint(def, f.rot);
  const fdir = frontDir(f.rot);
  const z = f.type === 'fireplace' ? 0.08 : f.type === 'stove' ? 0.3 : 0.2;
  const cx = f.x + fw / 2 + fdir[0] * (fd / 2 - 0.15), cy = f.y + fd / 2 + fdir[1] * (fw / 2 - 0.15);
  if (!(fdir[0] + fdir[1] >= 0)) return;
  const [px, py] = iso(f.type === 'fireplace' ? f.x + fw / 2 + fdir[0] * 0.3 : cx, f.type === 'fireplace' ? f.y + fd / 2 + fdir[1] * 0.3 : cy, z);
  if (f.type !== 'fireplace') return;
  for (let k = 0; k < 3; k++) {
    const hgt = 9 + Math.sin(t * 9 + k * 2) * 3;
    const ox = (k - 1) * 5;
    const g = ctx.createLinearGradient(0, py - hgt, 0, py);
    g.addColorStop(0, 'rgba(255,220,120,0)'); g.addColorStop(0.4, 'rgba(255,170,60,0.9)'); g.addColorStop(1, 'rgba(255,90,30,0.95)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(px + ox - 4, py); ctx.quadraticCurveTo(px + ox - 3, py - hgt * 0.6, px + ox + Math.sin(t * 7 + k) * 1.5, py - hgt); ctx.quadraticCurveTo(px + ox + 3, py - hgt * 0.6, px + ox + 4, py); ctx.fill();
  }
}

function outlineCells(ctx, cells, col) {
  for (const [x, y] of cells) diamond(ctx, x, y, 1, 1, 0.015, null, col);
}
function outlineRoom(ctx, state, r, col) {
  ctx.lineWidth = 2;
  for (const i of r.tiles) diamond(ctx, i % MAP_W, (i / MAP_W) | 0, 1, 1, 0.02, 'rgba(255,214,90,0.12)', null);
  ctx.strokeStyle = col; ctx.lineWidth = 2.2;
  const set = new Set(r.tiles);
  ctx.beginPath();
  for (const i of r.tiles) {
    const x = i % MAP_W, y = (i / MAP_W) | 0;
    const segs = [[0, -1, [0, 0], [1, 0]], [-1, 0, [0, 0], [0, 1]], [0, 1, [0, 1], [1, 1]], [1, 0, [1, 0], [1, 1]]];
    for (const [dx, dy, a, b] of segs) {
      if (set.has(idx(x + dx, y + dy)) && x + dx >= 0 && x + dx < MAP_W) continue;
      const [ax, ay] = iso(x + a[0], y + a[1], 0.03), [bx, by] = iso(x + b[0], y + b[1], 0.03);
      ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
    }
  }
  ctx.stroke();
}

function pill(ctx, x, y, text, bg, fg) {
  ctx.save();
  ctx.font = '600 11px Nunito, sans-serif';
  const w = ctx.measureText(text).width + 14;
  ctx.fillStyle = bg; ctx.strokeStyle = 'rgba(60,40,20,0.35)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - w / 2, y - 10, w, 20, 10) : ctx.rect(x - w / 2, y - 10, w, 20); ctx.fill(); ctx.stroke();
  ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 0.5);
  ctx.restore();
}

function roomLabel(ctx, x, y, room, def) {
  const name = room.type === 'bedroom' ? `Chambre ${room.num}` : def.name;
  pill(ctx, x, y, name, 'rgba(255,250,240,0.92)', '#4a3420');
}

function warnIcon(ctx, x, y, t) {
  const s = 1 + Math.sin(t * 4) * 0.06;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = '#e0563f'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(11, 8); ctx.lineTo(-11, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 12px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('!', 0, 6);
  ctx.restore();
}

function drawStar(ctx, x, y, t) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 2) * 0.15);
  ctx.fillStyle = '#f2c14e'; ctx.strokeStyle = '#a77a1c'; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const r = i % 2 ? 3 : 7; const a = -Math.PI / 2 + (i * Math.PI) / 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}

function drawSign(ctx, x, y, name, season) {
  const [px, py] = iso(x, y, 0);
  ctx.fillStyle = 'rgba(20,14,8,0.25)'; ctx.beginPath(); ctx.ellipse(px, py, 8, 3, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#5b3a22'; ctx.fillRect(px - 2, py - 52, 4, 52);
  ctx.fillRect(px - 2, py - 52, 22, 3);
  ctx.strokeStyle = '#8a7a5a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px + 4, py - 49); ctx.lineTo(px + 4, py - 44); ctx.moveTo(px + 17, py - 49); ctx.lineTo(px + 17, py - 44); ctx.stroke();
  const label = name.length > 18 ? name.slice(0, 17) + '…' : name;
  ctx.font = '700 7px Fraunces, Georgia, serif';
  const w = Math.max(30, ctx.measureText(label).width + 8);
  ctx.fillStyle = '#7a4b2a'; ctx.strokeStyle = '#3a2414';
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(px + 10 - w / 2, py - 44, w, 13, 3) : ctx.rect(px + 10 - w / 2, py - 44, w, 13); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f6e7c8'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, px + 10, py - 37.3);
  if (season === 3) { ctx.fillStyle = '#f4f7fb'; ctx.fillRect(px + 10 - w / 2, py - 46, w, 2.5); }
}

/** Position de la charrette du fournisseur (les matins de livraison). */
function cartPosition(state, hf) {
  const day = clock(state.time).day;
  const coming = state.deliveries.some((d) => d.day === day) && hf >= 7 && hf < 8;
  const here = state.flags.lastDelivery === day && hf >= 8 && hf < 9.3;
  if (!coming && !here) return null;
  const from = [13.5, 39.5], to = [13.5, 26.5];
  let t, dir;
  if (coming) { t = (hf - 7); dir = [0, -1]; }
  else if (hf < 8.6) { t = 1; dir = [0, -1]; }
  else { t = 1 - (hf - 8.6) / 0.7; dir = [0, 1]; }
  t = clamp(t, 0, 1);
  return { x: from[0] + (to[0] - from[0]) * t, y: from[1] + (to[1] - from[1]) * t, dir, moving: coming || hf >= 8.6 };
}

function drawCart(ctx, cart, t) {
  const [px, py] = iso(cart.x, cart.y, 0);
  ctx.save(); ctx.translate(px, py);
  ctx.fillStyle = 'rgba(20,14,8,0.25)'; ctx.beginPath(); ctx.ellipse(0, 2, 26, 9, 0, 0, 7); ctx.fill();
  const bob = cart.moving ? Math.abs(Math.sin(t * 8)) * 1.5 : 0;
  // âne
  const ahead = cart.dir[1] < 0 ? -1 : 1;
  ctx.fillStyle = '#8a7a6a';
  ctx.beginPath(); ctx.ellipse(18 * ahead, -14 - bob, 10, 6, 0, 0, 7); ctx.fill();
  ctx.fillRect(14 * ahead - 2, -10, 3, 9); ctx.fillRect(22 * ahead - 2, -10, 3, 9);
  ctx.beginPath(); ctx.ellipse(27 * ahead, -20 - bob, 4.5, 3.5, 0, 0, 7); ctx.fill();
  ctx.fillRect(26 * ahead, -28 - bob, 2, 6);
  // charrette
  ctx.fillStyle = '#8a5a33'; ctx.fillRect(-16, -22, 26, 12);
  ctx.fillStyle = '#6b4528'; ctx.fillRect(-16, -12, 26, 3);
  ctx.fillStyle = '#a6764a'; ctx.beginPath(); ctx.arc(-9, -24, 5, Math.PI, 0); ctx.fill(); ctx.beginPath(); ctx.arc(1, -24, 5, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#e9dcb8'; ctx.fillRect(-4, -30, 8, 7);
  ctx.strokeStyle = '#3a2414'; ctx.lineWidth = 2; ctx.fillStyle = '#5b3a22';
  ctx.beginPath(); ctx.arc(-10, -6, 6, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(4, -6, 6, 0, 7); ctx.stroke();
  ctx.restore();
}
