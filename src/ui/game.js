// Écran de jeu : HUD, saisie (souris, tactile, clavier), traduction des événements du moteur
// en effets visuels et sonores, pouvoirs, initiation et enchaînement de fin de partie.
import { h, $, tweenNumber, vibrate } from './dom.js';
import { icon } from './icons.js';
import { t, fmt, getLang } from '../core/i18n.js';
import { SHAPES } from '../game/pieces.js';
import { COLS, ROWS } from '../game/board.js';
import { place, usePower, giveUp, trayFits, goalState, gaugeMax, comboMult, COMBO_GRACE, TUTORIAL, tick, finish, skipTutorial, BLITZ } from '../game/engine.js';
import { bestMove } from '../game/bot.js';
import { HYPE, areaHype, comboTier, multiHype } from '../core/hype.js';
import { unlockAchievements } from '../meta/achievements.js';
import { clearSpriteCache } from '../render/blocks.js';
import { BOARD_RATIO } from '../render/renderer.js';

const POWERS = ['rotate', 'bomb', 'reroll'];
export const GOAL_ICON = { score: 'star', areas: 'ring', light: 'sun', whites: 'prism', big: 'expand', gems: 'gem', stones: 'stone', fog: 'cloud', crystals: 'crystal' };

export class GameScreen {
  constructor(app) {
    this.app = app;
    this.view = app.view;
    this.s = null;
    this.raf = 0;
    this.last = 0;
    this.ending = false;
    this.startTime = 0;
    this.kb = null;
    this.build();
    this.bindInput();
  }

  // ------------------------------------------------------------------ DOM
  build() {
    const pw = (k) => h('button.power', { 'data-power': k, 'aria-label': t(`game.power.${k}`), title: t(`game.power.${k}`), onclick: (e) => this.onPower(k, e) },
      h('span.power-ic', { html: icon(k) }), h('span.power-n', { text: '0' }));
    this.el = h('section.screen.game-screen#screen-game', { 'aria-label': 'Prisme' },
      h('header.hud',
        h('button.icon-btn#btn-pause', { 'aria-label': t('pause.title'), html: icon('pause'), onclick: () => this.app.pause() }),
        h('div.hud-center',
          h('div.hud-label#hud-label'),
          h('div.hud-score#hud-score', { text: '0' }),
          h('div.hud-sub#hud-sub')),
        h('div.hud-right#hud-right')),
      h('div.status-row',
        h('div.goals#goals'),
        h('div.combo#combo', h('span.combo-ic', { html: icon('flame') }), h('span.combo-t'), h('span.combo-dots'))),
      h('div.play-area',
        h('div#board-slot'),
        h('div#tray-slot')),
      h('div.banner#banner', { role: 'status', 'aria-live': 'polite' }),
      h('button.btn.small.ghost.skip-tuto#skip-tuto', { text: t('tuto.skip'), onclick: () => this.onSkipTutorial() }),
      h('div.powers#powers',
        h('div.gauge', { title: t('game.gauge') }, h('span.gauge-ic', { html: icon('sparkle') }), h('div.gauge-bar', h('div.gauge-fill#gauge-fill'))),
        h('div.power-row', POWERS.map(pw))),
      h('div.stuck#stuck',
        h('div.stuck-t', { text: t('game.stuck') }),
        h('div.stuck-s', { text: t('game.stuckHint') }),
        h('button.btn.small.ghost', { text: t('game.giveUp'), onclick: () => this.onGiveUp() })));
  }

  relabel() {
    for (const k of POWERS) {
      const b = this.el.querySelector(`[data-power=${k}]`);
      b.setAttribute('aria-label', t(`game.power.${k}`));
      b.title = t(`game.power.${k}`);
    }
    $('.stuck-t', this.el).textContent = t('game.stuck');
    $('.stuck-s', this.el).textContent = t('game.stuckHint');
    $('.stuck .btn', this.el).textContent = t('game.giveUp');
  }

  layout() {
    if (!this.s) return;
    const el = this.el;
    const W = window.innerWidth, H = window.innerHeight;
    // Paysage peu haut (téléphone tourné, petite fenêtre) : infos à gauche, pièces à droite.
    const landscape = W > H * 1.25 && H < 900;
    el.classList.toggle('landscape', landscape);
    let size;
    if (landscape) {
      size = Math.floor(Math.max(170, Math.min((H - 24) / BOARD_RATIO, (W - 250) / 1.42, 520)));
    } else {
      const hud = $('.hud', el).offsetHeight;
      const status = $('.status-row', el).offsetHeight;
      const powers = this.s.usePowers ? $('#powers', el).offsetHeight : 0;
      const avail = el.clientHeight - hud - status - powers - 28;
      size = Math.floor(Math.max(190, Math.min(el.clientWidth - 28, avail / (BOARD_RATIO + 0.395), 500)));
    }
    if (size !== this.lastSize) { this.lastSize = size; clearSpriteCache(); }
    el.style.setProperty('--board', `${size}px`);
    el.style.setProperty('--board-h', `${Math.round(size * BOARD_RATIO)}px`);
    this.view.resize();
    this.view.layout($('#board-slot', el), $('#tray-slot', el));
    this.placeBanner();
  }

  // ------------------------------------------------------------------ cycle de vie
  start(s) {
    this.s = s;
    this.ending = false;
    this.kb = null;
    this.liveTrophies = [];
    this.startTime = performance.now();
    const v = this.view;
    v.reset();
    v.s = s;
    v.theme = this.app.theme;
    v.symbols = this.app.profile.settings.symbols;
    v.fx.reduced = this.app.reducedMotion;
    this.el.dataset.mode = s.mode;
    this.el.classList.toggle('no-powers', !s.usePowers);
    this.hideStuck();
    this.banner(null);
    this.layout();
    v.refill();
    v.fits = trayFits(s);
    this.refreshHud(true);
    if (s.status === 'stuck') this.showStuck();
    this.lastSecond = null;
    this.el.classList.toggle('in-tutorial', s.tutorial != null);
    if (s.tutorial != null) this.showTutorialStep();
    this.app.sound.setIntensity(0);
    this.loop();
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.saveTime();
  }

  saveTime() {
    if (!this.startTime) return 0;
    const ms = performance.now() - this.startTime;
    this.startTime = performance.now();
    return ms;
  }

  loop() {
    cancelAnimationFrame(this.raf);
    this.last = performance.now();
    this.idleSince = performance.now();
    const frame = (now) => {
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.idleHint(now);
      if (this.s && this.s.mode === 'blitz' && this.playing) this.clock(dt);
      this.view.frame(dt);
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  /** Blitz : le chrono tourne, avec tic-tac dans les 10 dernières secondes. */
  clock(dt) {
    const ev = tick(this.s, dt);
    const sec = Math.ceil(this.s.time);
    if (sec !== this.lastSecond) {
      this.lastSecond = sec;
      this.refreshTimer();
      if (sec <= 10 && sec > 0) { this.app.sound.timeTick(sec <= 5); vibrate(sec <= 5 ? 12 : 0); }
    }
    if (ev.length) this.handle(ev);
  }

  refreshTimer() {
    const s = this.s, el = $('#hud-right', this.el);
    if (s.mode !== 'blitz') return;
    const sec = Math.ceil(s.time);
    const pct = Math.min(1, s.time / BLITZ.start);
    let badge = $('.timer', el);
    if (!badge) {
      el.innerHTML = `<div class="timer" title="${t('game.time')}"><svg viewBox="0 0 36 36"><circle class="timer-bg" cx="18" cy="18" r="15.5"/><circle class="timer-fg" cx="18" cy="18" r="15.5" pathLength="100"/></svg><b></b></div>`;
      badge = $('.timer', el);
    }
    $('b', badge).textContent = sec;
    $('.timer-fg', badge).style.strokeDashoffset = String(100 - pct * 100);
    badge.classList.toggle('low', sec <= 10);
  }

  /** Initiation : main animée vers la cible de l'étape et consigne. */
  showTutorialStep() {
    const s = this.s, v = this.view;
    if (s.tutorial == null) return;
    const step = TUTORIAL[s.tutorial];
    v.hand = { ...step.target, t0: v.time };
    this.banner(`${s.tutorial + 1}/${TUTORIAL.length} · ${t(step.text)}`, 0, 'tip');
  }

  onSkipTutorial() {
    if (!this.s || this.s.tutorial == null || this.ending) return;
    this.view.hand = null;
    this.handle(skipTutorial(this.s).events);
  }

  /** Zen : terminer la séance (depuis la pause). */
  onFinish() {
    if (!this.s || this.ending) return;
    const r = finish(this.s);
    if (r.ok) this.handle(r.events);
  }

  /** Pendant les premières parties, montre un bon coup si le joueur hésite longtemps. */
  idleHint(now) {
    const v = this.view;
    if (v.drag || v.mode || !this.playing || this.s.status !== 'play') { this.idleSince = now; return; }
    if (v.hand || this.s.tutorial != null || this.app.profile.stats.games >= 3 || now - this.idleSince < 15000) return;
    const m = bestMove(this.s);
    if (m) v.hand = { ti: m.ti, x: m.x, y: m.y, t0: v.time };
  }

  get playing() { return this.s && !this.ending && (this.s.status === 'play' || this.s.status === 'stuck') && !this.app.modalOpen; }

  // ------------------------------------------------------------------ HUD
  refreshHud(instant = false) {
    const s = this.s, el = this.el;
    const scoreEl = $('#hud-score', el);
    const prev = +(scoreEl.dataset.v || 0);
    scoreEl.dataset.v = s.score;
    if (instant || s.score < prev) scoreEl.textContent = fmt(s.score);
    else if (s.score !== prev) {
      tweenNumber(scoreEl, prev, s.score, 450, fmt);
      scoreEl.classList.remove('bump');
      void scoreEl.offsetWidth;
      scoreEl.classList.add('bump');
    }
    const label = $('#hud-label', el), sub = $('#hud-sub', el), right = $('#hud-right', el);
    if (s.mode === 'classic' || s.mode === 'zen' || s.mode === 'blitz') {
      label.textContent = s.mode === 'classic' ? '' : t(`mode.${s.mode}`);
      const best = Math.max(this.app.profile.best[s.mode] || 0, s.score);
      sub.innerHTML = `${icon('crown')} ${fmt(best)}`;
      if (s.mode === 'blitz') this.refreshTimer();
      else right.innerHTML = '';
    } else if (s.mode === 'adventure') {
      label.textContent = t('game.level', { n: s.level });
      sub.textContent = '';
      right.innerHTML = `<div class="moves-badge" title="${t('game.moves')}"><b>${s.movesMax - s.moves}</b><small>${t('game.moves')}</small></div>`;
    } else {
      label.textContent = t('daily.title');
      const m = this.app.dailyMedals;
      const next = m && ['bronze', 'silver', 'gold'].find((k) => s.score < m[k]);
      sub.innerHTML = m && next ? `<span class="medal-dot ${next}"></span> ${fmt(m[next])}` : m ? `<span class="medal-dot gold"></span> ${t('medal.gold')}` : '';
      right.innerHTML = `<div class="moves-badge" title="${t('game.pieces')}"><b>${s.movesMax - s.moves}</b><small>${t('game.pieces')}</small></div>`;
    }
    // Objectifs (Aventure)
    const goals = $('#goals', el);
    if (s.goals) {
      goals.innerHTML = s.goals.map((g) => {
        const st = goalState(s, g);
        const txt = st.countdown ? String(st.value) : g.type === 'score' ? `${fmt(st.value)}/${fmt(g.target)}` : `${st.value}/${g.target}`;
        return `<div class="goal ${st.done ? 'ok' : ''}" data-goal="${g.type}">${icon(st.done ? 'check' : GOAL_ICON[g.type])}<span>${txt}</span></div>`;
      }).join('');
    } else goals.innerHTML = '';
    // Combo
    const combo = $('#combo', el);
    const on = s.combo >= 2;
    combo.classList.toggle('on', on);
    combo.classList.toggle('hot', s.combo >= 6);
    if (on) {
      $('.combo-t', combo).textContent = `${t('game.combo', { n: s.combo })} · ×${comboMult(s.combo).toLocaleString(getLang())}`;
      const left = COMBO_GRACE - s.sinceEnclose;
      $('.combo-dots', combo).innerHTML = Array.from({ length: COMBO_GRACE }, (_, i) => `<i class="${i < left ? 'on' : ''}"></i>`).join('');
    }
    // Pouvoirs
    if (s.usePowers) {
      for (const k of POWERS) {
        const b = el.querySelector(`[data-power=${k}]`);
        const n = s.powers[k];
        b.querySelector('.power-n').textContent = n;
        b.classList.toggle('empty', n <= 0);
        b.classList.toggle('active', this.view.mode === k || (k === 'bomb' && this.view.mode === 'bomb'));
      }
      $('#gauge-fill', el).style.width = `${Math.min(100, (s.gauge / gaugeMax(s.earned)) * 100)}%`;
    }
  }

  banner(text, dur = 2600, cls = '') {
    const b = $('#banner', this.el);
    clearTimeout(this.bannerTimer);
    if (!text) { b.classList.remove('show'); return; }
    b.textContent = text;
    b.className = `banner show ${cls}`;
    this.placeBanner();
    if (dur) this.bannerTimer = setTimeout(() => b.classList.remove('show'), dur);
  }

  /** Bannière sous les pièces (portrait) ou dans la colonne de gauche (paysage). */
  placeBanner() {
    const b = $('#banner', this.el);
    if (this.el.classList.contains('landscape')) {
      const st = $('.status-row', this.el).getBoundingClientRect();
      b.style.left = `${st.left + st.width / 2}px`;
      b.style.top = `${st.bottom + 8}px`;
      b.style.maxWidth = `${st.width}px`;
    } else {
      const tr = $('#tray-slot', this.el).getBoundingClientRect();
      b.style.left = `${tr.left + tr.width / 2}px`;
      b.style.top = `${Math.min(tr.bottom + 4, window.innerHeight - 60)}px`;
      b.style.maxWidth = `${tr.width - 10}px`;
    }
  }

  /** Conseil affiché une seule fois par profil. */
  tip(key, delay = 0) {
    const p = this.app.profile;
    if (p.tips[key] || (this.s && this.s.tutorial != null)) return;
    p.tips[key] = 1;
    this.app.saveProfile();
    setTimeout(() => this.banner(t(`tip.${key}`), 4200, 'tip'), delay);
  }

  showStuck() {
    this.el.classList.add('is-stuck');
  }

  hideStuck() { this.el.classList.remove('is-stuck'); }

  // ------------------------------------------------------------------ saisie
  bindInput() {
    const el = this.el;
    el.addEventListener('pointerdown', (e) => this.onDown(e));
    window.addEventListener('pointermove', (e) => this.onMove(e));
    window.addEventListener('pointerup', (e) => this.onUp(e));
    window.addEventListener('pointercancel', () => this.cancelDrag());
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  onDown(e) {
    if (!this.playing || e.button > 0) return;
    if (e.target.closest('button')) return;
    this.app.sound.unlock();
    const v = this.view, x = e.clientX, y = e.clientY;
    this.kb = null;
    this.idleSince = performance.now();
    if (v.hand && !s0tutorial(this.s)) v.hand = null;
    if (v.mode === 'bomb') {
      const c = v.cellAt(x, y);
      if (c) { v.bomb = { x: c[0], y: c[1] }; this.bombPointer = e.pointerId; }
      else this.setMode(null);
      return;
    }
    const ti = v.hitTray(x, y);
    if (v.mode === 'rotate') {
      if (ti >= 0 && this.s.tray[ti]) this.doPower('rotate', { ti });
      else this.setMode(null);
      return;
    }
    if (ti < 0 || !this.s.tray[ti]) return;
    if (this.s.status !== 'play') return;
    e.preventDefault();
    const sh = SHAPES[this.s.tray[ti].k];
    const tp = v.trayPiece(ti);
    const touch = e.pointerType !== 'mouse';
    const cell = v.board.cell;
    const d = { ti, pid: e.pointerId, touch, t0: v.time, fromCell: tp ? tp.cell : cell, x: 0, y: 0, ghost: null };
    d.offX = (sh.w * cell) / 2;
    d.offY = touch ? sh.h * cell + cell * 1.1 : (sh.h * cell) / 2;
    d.x = x - d.offX;
    d.y = y - d.offY;
    v.drag = d;
    v.returning = null;
    v.updateGhost();
    this.app.sound.pick();
    vibrate(6);
    this.el.classList.add('dragging');
  }

  onMove(e) {
    const v = this.view;
    if (v.drag && e.pointerId === v.drag.pid) {
      const before = v.drag.ghost && `${v.drag.ghost.x},${v.drag.ghost.y}`;
      v.drag.x = e.clientX - v.drag.offX;
      v.drag.y = e.clientY - v.drag.offY;
      v.updateGhost();
      const after = v.drag.ghost && `${v.drag.ghost.x},${v.drag.ghost.y}`;
      if (after && after !== before && v.drag.ghost.regions.length) { vibrate(4); this.app.sound.preview(); }
    } else if (v.mode === 'bomb' && this.bombPointer === e.pointerId) {
      const c = v.cellAt(e.clientX, e.clientY);
      v.bomb = c ? { x: c[0], y: c[1] } : null;
    } else if (v.mode === 'bomb' && e.pointerType === 'mouse' && this.playing) {
      const c = v.cellAt(e.clientX, e.clientY);
      v.bomb = c ? { x: c[0], y: c[1] } : null;
    }
  }

  onUp(e) {
    const v = this.view;
    if (v.drag && e.pointerId === v.drag.pid) {
      const d = v.drag;
      this.el.classList.remove('dragging');
      if (d.ghost) this.doPlace(d.ti, d.ghost.x, d.ghost.y);
      else {
        if (v.insideBoard(e.clientX, e.clientY, 20)) this.app.sound.invalid();
        v.returning = { ti: d.ti, x: d.x, y: d.y, cell: v.board.cell, t: 0 };
        v.drag = null;
      }
      return;
    }
    if (v.mode === 'bomb' && this.bombPointer === e.pointerId) {
      this.bombPointer = null;
      const c = v.cellAt(e.clientX, e.clientY);
      if (c && this.playing) this.doPower('bomb', { x: c[0], y: c[1] });
    }
  }

  cancelDrag() {
    const v = this.view;
    if (v.drag) { v.returning = { ti: v.drag.ti, x: v.drag.x, y: v.drag.y, cell: v.board.cell, t: 0 }; v.drag = null; }
    this.el.classList.remove('dragging');
    this.bombPointer = null;
  }

  /** Clavier : 1-3 pour choisir une pièce, flèches pour la déplacer, Entrée pour poser. */
  onKey(e) {
    if (!this.playing) return false;
    const v = this.view, s = this.s, k = e.key;
    this.idleSince = performance.now();
    if (['1', '2', '3'].includes(k)) {
      const ti = +k - 1;
      if (!s.tray[ti]) return true;
      if (v.mode === 'rotate') { this.doPower('rotate', { ti }); return true; }
      if (s.status !== 'play') return true;
      const sh = SHAPES[s.tray[ti].k];
      const start = this.kb && this.kb.ti !== ti ? { x: this.kb.x, y: this.kb.y } : { x: Math.floor((COLS - sh.w) / 2), y: Math.floor((ROWS - sh.h) / 2) };
      this.kb = { ti, x: Math.min(start.x, COLS - sh.w), y: Math.min(start.y, ROWS - sh.h) };
      this.syncKb(true);
      this.app.sound.pick();
      return true;
    }
    if (v.mode === 'bomb') {
      if (!v.bomb) v.bomb = { x: 3, y: 3 };
      const mv = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[k];
      if (mv) { v.bomb = { x: clamp(v.bomb.x + mv[0], 0, COLS - 1), y: clamp(v.bomb.y + mv[1], 0, ROWS - 1) }; return true; }
      if (k === 'Enter' || k === ' ') { this.doPower('bomb', v.bomb); return true; }
      if (k === 'Escape') { this.setMode(null); return true; }
      return false;
    }
    if (this.kb) {
      const sh = SHAPES[s.tray[this.kb.ti].k];
      const mv = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[k];
      if (mv) {
        this.kb.x = clamp(this.kb.x + mv[0], 0, COLS - sh.w);
        this.kb.y = clamp(this.kb.y + mv[1], 0, ROWS - sh.h);
        this.syncKb();
        return true;
      }
      if (k === 'Enter' || k === ' ') {
        const d = v.drag;
        if (d && d.ghost) { const kb = this.kb; this.kb = null; this.doPlace(kb.ti, d.ghost.x, d.ghost.y); }
        else this.app.sound.invalid();
        return true;
      }
      if (k === 'Escape') { this.kb = null; v.drag = null; return true; }
    }
    if (k === 'r' || k === 'R') { this.onPower('rotate'); return true; }
    if (k === 'b' || k === 'B') { this.onPower('bomb'); return true; }
    if (k === 'n' || k === 'N') { this.onPower('reroll'); return true; }
    return false;
  }

  syncKb(fresh) {
    const v = this.view, kb = this.kb;
    const [x, y] = v.cellXY(kb.x, kb.y);
    v.drag = { ti: kb.ti, pid: -1, kb: true, t0: fresh ? v.time : (v.drag ? v.drag.t0 : v.time), fromCell: v.board.cell, x, y, offX: 0, offY: 0, ghost: null };
    v.updateGhost();
    if (v.drag.ghost && (v.drag.ghost.x !== kb.x || v.drag.ghost.y !== kb.y)) v.drag.ghost = null;
  }

  // ------------------------------------------------------------------ actions
  doPlace(ti, x, y) {
    const v = this.view;
    v.drag = null;
    const r = place(this.s, ti, x, y);
    if (!r.ok) { this.app.sound.invalid(); return; }
    v.hand = null;
    this.idleSince = performance.now();
    this.handle(r.events);
  }

  onPower(kind) {
    if (!this.playing || !this.s.usePowers) return;
    this.app.sound.unlock();
    if (this.s.powers[kind] <= 0) { this.banner(t('game.power.empty'), 2600); this.app.sound.invalid(); return; }
    if (kind === 'reroll') { this.doPower('reroll'); return; }
    if (this.view.mode === kind) { this.setMode(null); return; }
    this.setMode(kind);
  }

  setMode(kind, silent = false) {
    const v = this.view;
    v.mode = kind;
    v.bomb = null;
    if (!silent) this.app.sound.tap();
    this.el.classList.toggle('mode-bomb', kind === 'bomb');
    this.el.classList.toggle('mode-rotate', kind === 'rotate');
    if (kind) this.banner(t(`game.power.${kind}Hint`), 0, 'hint');
    else this.banner(null);
    this.refreshHud();
  }

  doPower(kind, arg) {
    const r = usePower(this.s, kind, arg);
    if (!r.ok) {
      this.app.sound.invalid();
      if (kind === 'bomb' && r.reason === 'nothing') this.view.bomb = null;
      return;
    }
    // Une charge par utilisation : on quitte le mode, pour pouvoir ensuite glisser la pièce.
    this.setMode(null, true);
    this.handle(r.events);
  }

  onGiveUp() {
    if (!this.s || this.s.status !== 'stuck') return;
    const r = giveUp(this.s);
    this.hideStuck();
    this.handle(r.events);
  }

  // ------------------------------------------------------------------ événements du moteur
  handle(events) {
    const app = this.app, v = this.view, s = this.s, snd = app.sound, b = v.board;
    const center = [b.x + b.w / 2, b.y + b.h * 0.4];
    for (const e of events) {
      switch (e.type) {
        case 'place':
          v.placed(e.cells);
          snd.place(SHAPES[e.k].n);
          vibrate(8);
          break;
        case 'enclose': {
          v.enclosed(e);
          const area = e.regions.reduce((a, r) => a + r.area, 0);
          const biggest = Math.max(...e.regions.map((r) => r.area));
          const white = e.regions.some((r) => r.white);
          const star = e.regions.some((r) => r.star);
          snd.enclose(area, e.combo, white, e.regions.length);
          vibrate(area >= 9 || e.regions.length > 1 ? [0, 30, 40, 30] : 18);
          // Félicitations en anglais, empilées au centre de la grille sans se chevaucher.
          const lines = [];
          const praise = areaHype(biggest);
          if (white) lines.push([HYPE.white, { size: 36, style: 'rainbow', dur: 1.7 }]);
          if (e.regions.length >= 2) lines.push([multiHype(e.regions.length), { size: 36, style: 'fire' }]);
          else if (praise) lines.push([praise, { size: 30 + Math.min(16, biggest), style: biggest >= 12 ? 'fire' : 'gold' }]);
          if (star) { lines.push([HYPE.star, { size: 28, style: 'gold' }]); setTimeout(() => snd.starCaught(), 250); }
          if (e.combo >= 2) {
            const tier = comboTier(e.combo);
            lines.push([tier ? `${HYPE.combo(e.combo)} ${tier}` : HYPE.combo(e.combo), { size: 24 + Math.min(14, e.combo), style: e.combo >= 6 ? 'fire' : 'ice', dur: 1.2 }]);
          }
          v.fx.fadeTexts('praise');
          const top = center[1] - 44;
          let y = top, delay = 0;
          for (const [text, opts] of lines) { v.fx.hype(text, center[0], y, { delay, ...opts }); y += opts.size * 1.25; delay += 0.12; }
          // Les points s'affichent là où la pièce a été posée, sauf s'ils tombent sur la pile
          // de félicitations : ils passent alors juste au-dessus ou juste en dessous.
          const ptSize = 22 + Math.min(16, Math.sqrt(area) * 4), half = ptSize / 2;
          let [px, py] = v.cellXY(e.ox, e.oy);
          py -= 10;
          if (lines.length) {
            const stackTop = top - lines[0][1].size * 0.6 - 26;
            const stackBottom = y - lines[lines.length - 1][1].size * 0.65;
            if (py + half > stackTop && py - half - 40 < stackBottom) {
              const above = Math.max(b.y + half + 4, stackTop - half - 4);
              const below = Math.min(b.y + b.h - half - 4, stackBottom + half + 44);
              const aboveFits = above + half <= stackTop, belowFits = below - half - 40 >= stackBottom;
              py = aboveFits && (!belowFits || py < (stackTop + stackBottom) / 2) ? above : belowFits ? below : above;
            }
          }
          v.fx.text(`+${fmt(e.points)}`, px, py, { size: ptSize, color: '#fff', dur: 1.1 });
          if (biggest >= 9) {
            const big = e.regions.reduce((a, r) => (r.area > a.area ? r : a));
            let mx = 0, my = 0;
            for (const k of big.cells) { const [qx, qy] = v.cellCenter(k); mx += qx; my += qy; }
            v.fx.rays(mx / big.cells.length, my / big.cells.length, big.white ? 'rgba(255,255,255,0.5)' : 'rgba(255,220,140,0.45)', b.cell * (2 + Math.sqrt(biggest)));
          }
          this.flyGems(e.regions);
          if (e.combo === 2) this.tip('combo', 900);
          if (white) this.tip('white', 1600);
          snd.setIntensity(Math.min(3, Math.floor(e.combo / 3)));
          break;
        }
        case 'boardClear':
          v.fx.hype(HYPE.clean, center[0], center[1] + 100, { size: 38, style: 'rainbow', dur: 1.9, delay: 0.35, tag: 'clean' });
          v.fx.confetti(v.w, 70);
          v.fx.flash(0.2);
          setTimeout(() => snd.boardClear(), 300);
          break;
        case 'comboEnd':
          snd.comboEnd();
          snd.setIntensity(0);
          break;
        case 'tutorialStep':
          v.revealBoard(1.1);
          setTimeout(() => { if (this.s === s && s.tutorial != null) this.showTutorialStep(); }, 1200);
          this.banner(t('tuto.good'), 1100, 'tip');
          break;
        case 'tutorialRetry':
          v.revealBoard(0.5);
          this.banner(t('tuto.retry'), 1500, 'tip');
          setTimeout(() => { if (this.s === s && s.tutorial != null) this.showTutorialStep(); }, 1600);
          break;
        case 'tutorialDone':
          this.app.profile.tutorialDone = true;
          this.app.saveProfile();
          this.el.classList.remove('in-tutorial');
          v.hand = null;
          setTimeout(() => this.banner(t('tuto.done'), 3500, 'tip'), e.skipped ? 0 : 1100);
          break;
        case 'timeBonus': {
          const tb = $('.timer', this.el);
          const r = tb ? tb.getBoundingClientRect() : null;
          const tx = r ? r.left + r.width / 2 : center[0], ty = r ? r.bottom + 14 : b.y;
          v.fx.hype(HYPE.time(e.seconds), tx, ty, { size: 22, style: 'ice', dur: 1.1, dy: 18, tag: 'time', tilt: 0 });
          if (tb) { tb.classList.remove('gain'); void tb.offsetWidth; tb.classList.add('gain'); }
          snd.timeBonus();
          break;
        }
        case 'relief':
          if (e.kind === 'clear') v.relieved(e);
          else v.refill();
          snd.relief();
          this.banner(t('game.relief'), 1800);
          break;
        case 'fogSpread': {
          const [fx0, fy0] = v.cellCenter(e.i);
          v.fx.sparks(fx0, fy0, 10, ['#b9a6d8', '#8d7bb0'], 0.4);
          snd.fogSpread();
          break;
        }
        case 'starSpawn': {
          const [cx, cy] = v.cellCenter(e.i);
          v.fx.sparks(cx, cy, 18, ['#ffe27a', '#ffffff'], 0.8);
          v.fx.ring(cx, cy, 4, b.cell * 0.9, '#ffd36b', 0.6, 3);
          snd.starSpawn();
          this.tip('star', 500);
          break;
        }
        case 'starGone': {
          const [cx, cy] = v.cellCenter(e.i);
          v.fx.sparks(cx, cy, 10, ['#ffe27a'], 0.5);
          snd.starGone();
          break;
        }
        case 'power': {
          const btn = this.el.querySelector(`[data-power=${e.kind}]`);
          setTimeout(() => {
            snd.power();
            if (btn) { btn.classList.remove('gain'); void btn.offsetWidth; btn.classList.add('gain'); }
            const r = btn && btn.getBoundingClientRect();
            if (r) { v.fx.sparks(r.left + r.width / 2, r.top + r.height / 2, 24, [app.theme.ui.accent, '#ffffff'], 1.2); v.fx.ring(r.left + r.width / 2, r.top + r.height / 2, 10, 46, app.theme.ui.accent, 0.5, 3); }
            this.banner(t('game.power.gained', { name: t(`game.power.${e.kind}`) }), 2200);
          }, 450);
          this.tip('power', 2800);
          break;
        }
        case 'refill':
          v.refill();
          break;
        case 'record':
          setTimeout(() => {
            snd.record();
            v.fx.confetti(v.w, 110);
            v.fx.hype(HYPE.record, center[0], b.y + b.h * 0.18, { size: 40, style: 'gold', dur: 2.1, tag: 'record' });
          }, 500);
          break;
        case 'stuck':
          setTimeout(() => { if (this.s === s && s.status === 'stuck') { snd.stuck(); this.showStuck(); } }, 250);
          break;
        case 'rescued':
          this.hideStuck();
          break;
        case 'bomb':
          v.bombed(e);
          snd.bomb();
          vibrate([0, 40, 30, 60]);
          break;
        case 'reroll':
          v.refill();
          snd.reroll();
          break;
        case 'rotate':
          v.spawn[e.ti] = v.time;
          snd.rotate();
          break;
        case 'end':
          this.end(e);
          break;
        default:
          break;
      }
    }
    v.fits = trayFits(s);
    if (s.status === 'play' && s.tray.some((p, i) => p && !v.fits[i]) && v.fits.some(Boolean)) this.tip('gray', 600);
    this.refreshHud();
    // Trophées débloqués en cours de partie.
    const got = unlockAchievements(app.profile, s, null, { liveOnly: true });
    got.forEach((a) => {
      this.liveTrophies.push(a);
      // Un trophée à la fois, une fois les félicitations du coup retombées.
      const at = Math.max(performance.now() + 1200, this.nextTrophyAt || 0);
      this.nextTrophyAt = at + 2300;
      setTimeout(() => {
        snd.trophy();
        v.fx.text(t('result.trophy', { name: t(`ach.${a.id}`) }), b.x + b.w / 2, b.y + b.h * 0.08, { size: 17, color: app.theme.ui.accent, dur: 2.2, dy: 26 });
      }, at - performance.now());
    });
    if (s.status === 'play' || s.status === 'stuck') app.saveSession(s);
    if (got.length) app.saveProfile();
  }

  /** Les gemmes encerclées s'envolent vers l'objectif. */
  flyGems(regions) {
    const v = this.view, b = v.board;
    const target = $('[data-goal=gems]', this.el);
    const cells = regions.flatMap((r) => r.gemCells || []);
    if (!cells.length) return;
    const sp = v.sprite('gem', b.cell);
    const r = target ? target.getBoundingClientRect() : null;
    cells.forEach((i, n) => {
      const [x, y] = v.cellCenter(i);
      const tx = r ? r.left + 14 : x, ty = r ? r.top + r.height / 2 : y - 80;
      v.fx.fly(sp.img, b.cell * 1.4, x, y, tx, ty, 0.2 + n * 0.08, () => {
        this.app.sound.gem();
        if (target) { target.classList.remove('bump'); void target.offsetWidth; target.classList.add('bump'); }
      });
    });
  }

  end(e) {
    this.ending = true;
    const app = this.app, v = this.view, s = this.s, snd = app.sound, b = v.board;
    this.hideStuck();
    this.setMode(null, true);
    v.drag = null;
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    let delay = 1300;
    if (e.status === 'won') {
      v.fx.hype(HYPE.levelClear, cx, cy, { size: 42, style: 'rainbow', dur: 1.9, delay: 0.3, tag: 'end' });
      setTimeout(() => { snd.win(); v.fx.confetti(v.w, 90); }, 300);
      delay = 1700;
    } else if (e.reason === 'quit') {
      delay = 300;
    } else if (e.reason === 'time') {
      v.fx.text(t('game.timeUp'), cx, cy, { size: 38, color: '#fff', dur: 1.8, delay: 0.1 });
      setTimeout(() => { v.grayOut(); snd.timeUp(); }, 100);
      delay = 1700;
    } else if (e.reason === 'done') {
      v.fx.hype(HYPE.dailyDone, cx, cy, { size: 32, style: 'rainbow', dur: 1.7, delay: 0.2, tag: 'end' });
      setTimeout(() => snd.win(), 200);
      delay = 1300;
    } else {
      v.fx.text(t(e.reason === 'moves' ? 'game.noMoves' : 'game.noSpace'), cx, cy, { size: 36, color: '#fff', dur: 1.8, delay: 0.25 });
      setTimeout(() => { v.grayOut(); s.mode === 'adventure' ? snd.lose() : snd.gameOver(); }, 250);
      delay = 1800;
    }
    app.clearSession(s);
    setTimeout(() => app.finishGame(s, this.saveTime()), delay);
  }
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const s0tutorial = (s) => s.tutorial != null;
