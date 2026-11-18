// Contrôleur principal : boucle, vitesse, sauvegarde, actions, événements d'interface.
import { GAME_MIN_PER_SEC, NIGHT_BOOST, SAVE_VERSION } from './data/constants.js';
import { createNewGame, serialize, deserialize } from './sim/state.js';
import { update, bootstrapDay } from './sim/sim.js';
import { actions } from './sim/actions.js';
import { clock } from './sim/time.js';
import { Renderer } from './render/renderer.js';
import { GameAudio } from './audio/audio.js';
import { ROOM_TYPES } from './data/rooms.js';
import { FURNITURE } from './data/furniture.js';
import { roomBuildCost } from './sim/world.js';
import { earn } from './sim/economy.js';

export const SAVE_KEY = 'auberge-des-sommets/save';
export const SETTINGS_KEY = 'auberge-des-sommets/settings';
const SPEEDS = [0, GAME_MIN_PER_SEC, GAME_MIN_PER_SEC * 2.4, GAME_MIN_PER_SEC * 5];

function loadSettings() {
  try { return { music: 0.45, sfx: 0.7, amb: 0.5, quality: 'high', tips: true, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; }
  catch { return { music: 0.45, sfx: 0.7, amb: 0.5, quality: 'high', tips: true }; }
}

export class Game {
  constructor(canvas) {
    this.settings = loadSettings();
    this.renderer = new Renderer(canvas);
    this.renderer.quality = this.settings.quality;
    this.audio = new GameAudio(this.settings);
    this.state = null;
    this.speed = 1;
    this.blockers = 0; // modales ouvertes => pause
    this.ui = { mode: 'none', preview: null, selected: null, hoverRoom: 0, showParcels: false, moving: 0, buildType: null, rot: 0, paint: null };
    this.handlers = {};
    this.follow = null;
    this.last = performance.now();
    this.saveTimer = 0;
    this.running = false;
  }

  on(ev, fn) { (this.handlers[ev] ||= []).push(fn); }
  emit(ev, ...a) { for (const fn of this.handlers[ev] || []) fn(...a); }

  // ---------------------------------------------------------------- Parties
  newGame(innName) {
    this.state = createNewGame({ innName: innName || "L'Auberge des Sommets" });
    bootstrapDay(this.state);
    this.renderer.centerOn(19, 20);
    this.renderer.cam.zoom = window.innerWidth < 760 ? 0.95 : 1.2;
    this.setSpeed(1);
    this.save();
    this.emit('start');
  }

  hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; } }

  load() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    this.state = deserialize(raw);
    this.state.rt.booted = true;
    this.renderer.centerOn(19, 20);
    this.renderer.cam.zoom = window.innerWidth < 760 ? 0.95 : 1.2;
    this.setSpeed(1);
    this.emit('start');
    return true;
  }

  save() {
    if (!this.state) return false;
    try {
      localStorage.setItem(SAVE_KEY, serialize(this.state));
      this.lastSaved = Date.now();
      return true;
    } catch (e) {
      this.emit('toast', { kind: 'bad', text: 'Sauvegarde impossible (stockage du navigateur plein ou désactivé).' });
      return false;
    }
  }

  exportSave() {
    const blob = new Blob([serialize(this.state)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `auberge-des-sommets-jour${clock(this.state.time).day}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  async importSave(file) {
    const text = await file.text();
    const st = deserialize(text); // lève une erreur si invalide
    this.state = st;
    this.state.rt.booted = true;
    this.save();
    this.emit('start');
  }

  saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); } catch { /* ignore */ }
    this.audio.setVolumes({ music: this.settings.music, sfx: this.settings.sfx, amb: this.settings.amb });
    if (this.renderer.quality !== this.settings.quality) { this.renderer.quality = this.settings.quality; this.renderer.resize(); this.renderer.groundKey = ''; }
  }

  // ---------------------------------------------------------------- Temps
  setSpeed(s) {
    this.speed = s;
    this.emit('speed', s);
  }
  togglePause() { if (this.speed === 0) this.setSpeed(this.prevSpeed || 1); else { this.prevSpeed = this.speed; this.setSpeed(0); } }
  get paused() { return this.speed === 0 || this.blockers > 0; }

  start() {
    if (this.running) return;
    this.running = true;
    const frame = (now) => {
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      this.tick(dt);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  tick(dt) {
    const st = this.state;
    if (st) {
      if (!this.paused) {
        const c = clock(st.time);
        const quietNight = (c.hf >= 23.5 || c.hf < 6) && st.guests.every((g) => g.hidden || (g.act && g.act.kind === 'sleep') || g.state === 'leave');
        const rate = SPEEDS[this.speed] * (quietNight ? NIGHT_BOOST : 1);
        update(st, dt * rate);
      }
      if (st.rt.notifications.length) {
        const list = st.rt.notifications.splice(0);
        for (const n of list) this.emit('notify', n);
      }
      if (st.dialogs.length && this.blockers === 0) this.emit('dialog');
      if (this.follow) {
        const a = st.guests.find((g) => g.id === this.follow) || st.staff.find((s) => s.id === this.follow);
        if (a && !a.hidden) { const r = this.renderer; const [tx, ty] = [a.x, a.y]; const [px, py] = [(tx - ty) * 32, (tx + ty) * 16 - 16]; r.cam.x += (px - r.cam.x) * Math.min(1, dt * 4); r.cam.y += (py - r.cam.y) * Math.min(1, dt * 4); }
        else this.follow = null;
      }
      this.saveTimer += dt;
      if (this.saveTimer > 45) { this.saveTimer = 0; this.save(); }
      const c = clock(st.time);
      this.audio.setEnv({ hour: c.hf, season: c.seasonIndex, weather: st.weather.today, night: c.hf < 6 || c.hf > 21 });
      this.renderer.render(st, this.ui, dt);
    }
    this.emit('frame', dt);
  }

  // ---------------------------------------------------------------- Actions
  act(name, ...args) {
    const res = actions[name](this.state, ...args);
    if (res && res.ok === false) {
      if (res.reason) this.emit('toast', { kind: 'warn', text: res.reason, short: true });
      this.audio.play('error');
    }
    this.emit('change', name, res);
    return res || { ok: true };
  }

  /** Annule la dernière construction de pièce (remboursement intégral). */
  undoLastRoom() {
    const lb = this.state.lastBuild;
    if (!lb || lb.kind !== 'room' || lb.merged) return false;
    const room = this.state.world.rooms[lb.roomId];
    if (!room) return false;
    const r = actions.demolishRoom(this.state, lb.roomId);
    if (!r.ok) { this.emit('toast', { kind: 'warn', text: r.reason }); return false; }
    // la démolition rembourse 50 % : on complète jusqu'à 100 %
    const rest = lb.cost - r.refund;
    if (rest > 0) earn(this.state, rest, 'misc');
    this.state.lastBuild = null;
    this.emit('change', 'undo');
    return true;
  }

  // ---------------------------------------------------------------- Modes de construction
  setMode(mode, opts = {}) {
    const ui = this.ui;
    ui.mode = mode;
    ui.preview = null;
    ui.hoverRoom = 0;
    ui.moving = 0;
    ui.pending = null;
    ui.buildType = opts.type || null;
    ui.paint = opts.paint || null;
    ui.showParcels = mode === 'parcels' || (mode !== 'none' && opts.showParcels !== false && mode === 'room');
    if (mode === 'furniture') ui.rot = opts.rot ?? 0;
    this.emit('mode', mode);
  }

  describeMode() {
    const ui = this.ui;
    switch (ui.mode) {
      case 'room': { const d = ROOM_TYPES[ui.buildType]; return { title: d.name, sub: `${d.costPerTile} écus / case · glissez pour tracer`, rotate: false }; }
      case 'furniture': { const d = FURNITURE[ui.buildType]; return { title: d.name, sub: d.special ? 'Objet unique' : `${d.cost} écus · ${this.touch ? 'touchez pour placer' : 'cliquez pour placer'}`, rotate: d.w !== d.h || true }; }
      case 'door': return { title: 'Portes', sub: '30 écus · touchez un mur pour ajouter ou retirer une porte' };
      case 'paint': return { title: ui.paint?.label || 'Styles', sub: 'Touchez une pièce pour appliquer le style' };
      case 'demolish': return { title: 'Démolir / vendre', sub: 'Touchez un meuble (revendu 50 %) ou une pièce' };
      case 'move': return { title: 'Déplacer', sub: ui.moving ? 'Touchez le nouvel emplacement' : 'Touchez un meuble à déplacer', rotate: !!ui.moving };
      case 'parcels': return { title: 'Terrains', sub: 'Touchez une parcelle dorée pour l\'acheter' };
      default: return null;
    }
  }

  roomRefund(roomId) {
    const r = this.state.world.rooms[roomId];
    return r ? Math.round(roomBuildCost(r) * 0.5) : 0;
  }
}

export { SAVE_VERSION };
