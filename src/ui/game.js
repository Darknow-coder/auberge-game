// Écran de jeu : HUD, saisie (souris, tactile, clavier), traduction des événements du moteur
// en effets visuels et sonores, pouvoirs, initiation et enchaînement de fin de partie.
import { h, $, tweenNumber, vibrate } from './dom.js';
import { icon } from './icons.js';
import { t, fmt } from '../core/i18n.js';
import { SHAPES } from '../game/pieces.js';
import { N } from '../game/board.js';
import { place, usePower, giveUp, trayFits, goalProgress, gaugeMax, COMBO_GRACE, TUTORIAL } from '../game/engine.js';
import { unlockAchievements } from '../meta/achievements.js';

const POWERS = ['rotate', 'bomb', 'reroll'];
const GOAL_ICON = { score: 'star', lines: 'lines', gems: 'gem', stones: 'stone', pure: 'prism' };

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
        h('div.banner#banner', { role: 'status', 'aria-live': 'polite' }),
        h('div#tray-slot')),
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
    const W = el.clientWidth, H = el.clientHeight;
    const hud = $('.hud', el).offsetHeight;
    const status = $('.status-row', el).offsetHeight;
    const powers = this.s.usePowers ? $('#powers', el).offsetHeight : 0;
    const avail = H - hud - status - powers - 28;
    const size = Math.floor(Math.max(200, Math.min(W - 28, avail / 1.4, 540)));
    el.style.setProperty('--board', `${size}px`);
    this.view.resize();
    this.view.layout($('#board-slot', el), $('#tray-slot', el));
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
    if (s.tutorial && s.moves === 0) {
      v.hand = { ...TUTORIAL.target, t0: v.time };
      this.banner(t('tuto.drag'), 0);
    }
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
    const tick = (now) => {
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.view.frame(dt);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
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
    if (s.mode === 'classic') {
      label.textContent = '';
      const best = Math.max(this.app.profile.best.classic, s.score);
      sub.innerHTML = `${icon('crown')} ${fmt(best)}`;
      right.innerHTML = '';
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
        const done = Math.min(goalProgress(s, g), g.target);
        const ok = done >= g.target;
        const txt = g.type === 'score' ? `${fmt(done)}/${fmt(g.target)}` : `${done}/${g.target}`;
        return `<div class="goal ${ok ? 'ok' : ''}" data-goal="${g.type}">${icon(ok ? 'check' : GOAL_ICON[g.type])}<span>${txt}</span></div>`;
      }).join('');
    } else goals.innerHTML = '';
    // Combo
    const combo = $('#combo', el);
    const on = s.combo >= 2;
    combo.classList.toggle('on', on);
    combo.classList.toggle('hot', s.combo >= 6);
    if (on) {
      $('.combo-t', combo).textContent = t('game.combo', { n: s.combo });
      const left = COMBO_GRACE - s.sinceClear;
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
    if (dur) this.bannerTimer = setTimeout(() => b.classList.remove('show'), dur);
  }

  /** Conseil affiché une seule fois par profil. */
  tip(key, delay = 0) {
    const p = this.app.profile;
    if (p.tips[key]) return;
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
    if (v.mode === 'bomb') {
      const c = v.cellAt(x, y);
      if (c) { v.bomb = { x: c[0], y: c[1] }; this.bombPointer = e.pointerId; }
      else this.setMode(null);
      return;
    }
    const ti = v.hitTray(x, y);
    if (ti < 0 || !this.s.tray[ti]) return;
    if (v.mode === 'rotate') { this.doPower('rotate', { ti }); return; }
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
      if (after && after !== before && v.drag.ghost.set.size) vibrate(4);
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
    if (['1', '2', '3'].includes(k)) {
      const ti = +k - 1;
      if (!s.tray[ti]) return true;
      if (v.mode === 'rotate') { this.doPower('rotate', { ti }); return true; }
      if (s.status !== 'play') return true;
      const sh = SHAPES[s.tray[ti].k];
      const start = this.kb && this.kb.ti !== ti ? { x: this.kb.x, y: this.kb.y } : { x: Math.floor((N - sh.w) / 2), y: Math.floor((N - sh.h) / 2) };
      this.kb = { ti, x: Math.min(start.x, N - sh.w), y: Math.min(start.y, N - sh.h) };
      this.syncKb(true);
      this.app.sound.pick();
      return true;
    }
    if (v.mode === 'bomb') {
      if (!v.bomb) v.bomb = { x: 3, y: 3 };
      const mv = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[k];
      if (mv) { v.bomb = { x: clamp(v.bomb.x + mv[0], 0, N - 1), y: clamp(v.bomb.y + mv[1], 0, N - 1) }; return true; }
      if (k === 'Enter' || k === ' ') { this.doPower('bomb', v.bomb); return true; }
      if (k === 'Escape') { this.setMode(null); return true; }
      return false;
    }
    if (this.kb) {
      const sh = SHAPES[s.tray[this.kb.ti].k];
      const mv = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[k];
      if (mv) {
        this.kb.x = clamp(this.kb.x + mv[0], 0, N - sh.w);
        this.kb.y = clamp(this.kb.y + mv[1], 0, N - sh.h);
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
    if (v.hand) { v.hand = null; this.banner(null); }
    if (this.s.tutorial && !this.app.profile.tutorialDone) { this.app.profile.tutorialDone = true; this.app.saveProfile(); }
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
    if (kind !== 'rotate' || this.s.powers.rotate <= 0) this.setMode(null, true);
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
    const center = [b.x + b.size / 2, b.y + b.size * 0.42];
    for (const e of events) {
      switch (e.type) {
        case 'place':
          v.placed(e.cells);
          snd.place(SHAPES[e.k].n);
          vibrate(8);
          break;
        case 'clear': {
          v.cleared(e);
          snd.clear(e.lines, e.combo, e.pures);
          vibrate(e.lines >= 3 ? [0, 30, 40, 30] : 18);
          const [px, py] = v.cellXY(e.ox, e.oy);
          v.fx.text(`+${fmt(e.points)}`, px, py - 10, { size: 22 + Math.min(14, e.lines * 3), color: '#fff', dur: 1 });
          let y = center[1];
          if (e.pures) {
            v.fx.text(t(e.pures > 1 ? 'game.prism2' : 'game.prism'), center[0], y - 40, { size: 34, rainbow: true, dur: 1.5, delay: 0.05 });
            y += 6;
          } else if (e.lines >= 2) {
            v.fx.text(t(`praise.${Math.min(5, e.lines)}`), center[0], y - 40, { size: 30 + e.lines * 3, color: app.theme.ui.accent, dur: 1.3 });
          }
          if (e.combo >= 2) v.fx.text(t('game.combo', { n: e.combo }), center[0], y + 4, { size: 26 + Math.min(14, e.combo), color: e.combo >= 6 ? '#ff8a3d' : '#fff', dur: 1.1, delay: 0.08 });
          if (e.gems) this.flyGems(e.cleared);
          if (e.combo === 2) this.tip('combo', 900);
          if (s.tutorial && s.stats.clears === 1) setTimeout(() => this.banner(t(e.pures ? 'tuto.prism' : 'tuto.cleared'), 3800, 'tip'), 500);
          break;
        }
        case 'boardClear':
          v.fx.text(t('game.boardClear'), center[0], center[1] + 46, { size: 40, rainbow: true, dur: 1.8, delay: 0.25 });
          v.fx.confetti(v.w, 70);
          v.fx.flash(0.25);
          setTimeout(() => snd.boardClear(), 200);
          break;
        case 'comboEnd':
          snd.comboEnd();
          break;
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
            v.fx.text(t('game.record'), center[0], b.y + b.size * 0.2, { size: 38, color: app.theme.ui.accent, dur: 2 });
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
          if (e.gems) this.flyGems(e.cleared);
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
    got.forEach((a, i) => {
      this.liveTrophies.push(a);
      setTimeout(() => {
        snd.trophy();
        v.fx.text(t('result.trophy', { name: t(`ach.${a.id}`) }), b.x + b.size / 2, b.y + b.size * 0.1, { size: 17, color: app.theme.ui.accent, dur: 2.2, dy: 26 });
      }, 700 + i * 900);
    });
    if (s.status === 'play' || s.status === 'stuck') app.saveSession(s);
    if (got.length) app.saveProfile();
  }

  flyGems(cleared) {
    const v = this.view, b = v.board;
    const target = $('[data-goal=gems]', this.el);
    if (!target) return;
    const r = target.getBoundingClientRect();
    const sp = v.sprite(1, b.cell, { gem: true });
    let i = 0;
    for (const c of cleared) {
      if (!c.g) continue;
      const [x, y] = v.cellXY(c.i % N, (c.i / N) | 0);
      // Le sprite de gemme seule : on dessine le bloc entier, réduit.
      v.fx.fly(sp.img, b.cell * 1.3, x + b.cell / 2, y + b.cell / 2, r.left + 14, r.top + r.height / 2, 0.15 + i * 0.08, () => {
        this.app.sound.gem();
        target.classList.remove('bump');
        void target.offsetWidth;
        target.classList.add('bump');
      });
      i++;
    }
  }

  end(e) {
    this.ending = true;
    const app = this.app, v = this.view, s = this.s, snd = app.sound, b = v.board;
    this.hideStuck();
    this.setMode(null, true);
    v.drag = null;
    const cx = b.x + b.size / 2, cy = b.y + b.size / 2;
    let delay = 1300;
    if (e.status === 'won') {
      v.fx.text(t('game.goalsDone'), cx, cy, { size: 36, rainbow: true, dur: 1.8, delay: 0.3 });
      setTimeout(() => { snd.win(); v.fx.confetti(v.w, 90); }, 300);
      delay = 1600;
    } else if (e.reason === 'done') {
      setTimeout(() => snd.win(), 200);
      delay = 900;
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
