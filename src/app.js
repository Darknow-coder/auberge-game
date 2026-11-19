// Application : navigation entre écrans, sessions de jeu, sauvegarde, fenêtres modales.
import { h, $, tweenNumber, vibrate, prefs } from './ui/dom.js';
import { icon } from './ui/icons.js';
import { t, fmt, setLang, detectLang, getLang } from './core/i18n.js';
import { newGame, goalProgress, starsFor } from './game/engine.js';
import { getLevel, LEVELS, worldOf } from './game/levels.js';
import { dailySpec, dailyMedals, medalFor, dateKey } from './game/daily.js';
import { loadProfile, saveProfile, saveGame, loadGame, clearGame, recordGame, levelInfo, currentStreak, resetProfile, levelUnlocked } from './meta/profile.js';
import { THEMES, themeById, applyThemeCss } from './meta/themes.js';
import { clearSpriteCache } from './render/blocks.js';
import { GameView } from './render/renderer.js';
import { Sound } from './audio/audio.js';
import { GameScreen } from './ui/game.js';
import { SCREENS } from './ui/menus.js';

const GOAL_ICON = { score: 'star', lines: 'lines', gems: 'gem', stones: 'stone', pure: 'prism' };

export class App {
  constructor() {
    this.profile = loadProfile();
    const st = this.profile.settings;
    setLang(st.lang || detectLang());
    this.sound = new Sound();
    this.sound.sfxOn = st.sfx;
    this.sound.musicOn = st.music;
    prefs.vibrate = st.vibrate;
    this.reducedMotion = st.motion || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    document.documentElement.classList.toggle('reduced', !!this.reducedMotion);
    this.setTheme(this.profile.theme, false);
    this.view = new GameView($('#stage'));
    this.root = $('#app');
    this.game = new GameScreen(this);
    this.root.append(this.game.el);
    this.menuEl = null;
    this.screen = null;
    this.modals = [];
    this.dailyMedals = null;
    this.dailyCache = {};

    window.addEventListener('keydown', (e) => this.onKey(e));
    window.addEventListener('resize', () => { if (this.screen === 'game') this.game.layout(); });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { this.sound.suspend(); if (this.screen === 'game' && this.game.s) this.saveSession(this.game.s); }
      else this.sound.resume();
    });
    // Le premier geste débloque l'audio (règle des navigateurs).
    const unlock = () => this.sound.unlock();
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
  }

  get modalOpen() { return this.modals.length > 0; }
  get theme() { return this._theme; }

  saveProfile() { saveProfile(this.profile); }

  // ------------------------------------------------------------------ navigation
  show(name, params) {
    this.closeAllModals();
    if (name === 'game') {
      if (this.menuEl) { this.menuEl.remove(); this.menuEl = null; }
      this.game.el.classList.add('active');
      document.body.classList.add('in-game');
      this.screen = 'game';
      return;
    }
    if (this.screen === 'game') {
      if (this.game.s && !this.game.ending && (this.game.s.status === 'play' || this.game.s.status === 'stuck')) this.saveSession(this.game.s);
      this.game.stop();
      this.game.el.classList.remove('active');
      document.body.classList.remove('in-game');
    }
    this.screenParams = params;
    const el = SCREENS[name](this, params || {});
    el.classList.add('screen', 'menu-screen', 'enter');
    if (this.menuEl) this.menuEl.remove();
    this.menuEl = el;
    this.root.append(el);
    this.screen = name;
    requestAnimationFrame(() => el.classList.remove('enter'));
    const focus = el.querySelector('[autofocus]');
    if (focus) focus.focus({ preventScroll: true });
  }

  refresh() {
    if (this.screen && this.screen !== 'game') this.show(this.screen, this.screenParams);
    this.game.relabel();
  }

  onKey(e) {
    if (e.key === 'Escape' && this.modalOpen) {
      const m = this.modals.at(-1);
      if (m.dismissable) { this.closeModal(); e.preventDefault(); }
      return;
    }
    if (this.modalOpen) return;
    if (this.screen === 'game') {
      if (this.game.onKey(e)) { e.preventDefault(); return; }
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { this.pause(); e.preventDefault(); }
    }
  }

  // ------------------------------------------------------------------ sessions
  slot(s) { return s.mode === 'adventure' ? 'adventure' : s.mode === 'daily' ? 'daily' : 'classic'; }
  saveSession(s) { saveGame(this.slot(s), s); }
  clearSession(s) { clearGame(this.slot(s)); }

  startClassic({ fresh = false } = {}) {
    const saved = !fresh && loadGame('classic');
    const s = saved || newGame({ mode: 'classic', best: this.profile.best.classic, tutorial: !this.profile.tutorialDone });
    if (!saved) this.saveSession(s);
    this.play(s);
  }

  startLevel(n, { intro = true } = {}) {
    const L = getLevel(n);
    if (!L) return;
    const saved = loadGame('adventure');
    if (saved && saved.level === n) { this.play(saved); return; }
    const go = () => { const s = newGame({ mode: 'adventure', level: L }); this.saveSession(s); this.play(s); };
    if (intro) this.levelIntro(L, go);
    else go();
  }

  getDaily(key = dateKey()) {
    if (!this.dailyCache[key]) {
      const spec = dailySpec(key);
      this.dailyCache[key] = { spec, medals: dailyMedals(spec) };
    }
    return this.dailyCache[key];
  }

  startDaily({ fresh = false } = {}) {
    const key = dateKey();
    const { spec, medals } = this.getDaily(key);
    this.dailyMedals = medals;
    const saved = !fresh && loadGame('daily');
    const s = saved && saved.date === key ? saved : newGame({ mode: 'daily', daily: spec, seed: spec.seed });
    this.saveSession(s);
    this.play(s);
  }

  play(s) {
    if (s.mode === 'daily' && !this.dailyMedals) this.dailyMedals = this.getDaily(s.date).medals;
    this.show('game');
    this.game.start(s);
  }

  restart() {
    const s = this.game.s;
    if (!s) return;
    this.clearSession(s);
    if (s.mode === 'classic') this.startClassic({ fresh: true });
    else if (s.mode === 'adventure') this.startLevel(s.level, { intro: false });
    else this.startDaily({ fresh: true });
  }

  finishGame(s, time) {
    const medal = s.mode === 'daily' ? medalFor(s.score, this.dailyMedals) : null;
    // Trophées gagnés pendant la partie : rappelés dans le bilan.
    const live = this.game.liveTrophies || [];
    const report = recordGame(this.profile, s, { time, medal, liveXp: live.reduce((a, x) => a + x.xp, 0) });
    report.liveTrophies = live;
    this.saveProfile();
    if (s.mode === 'adventure') this.resultsAdventure(s, report);
    else if (s.mode === 'daily') this.resultsDaily(s, report, medal);
    else this.resultsClassic(s, report);
  }

  // ------------------------------------------------------------------ réglages
  setTheme(id, refresh = true) {
    const th = themeById(id);
    this.profile.theme = th.id;
    this._theme = th;
    applyThemeCss(th);
    clearSpriteCache();
    if (this.view) this.view.theme = th;
    if (refresh) this.saveProfile();
  }

  setSetting(key, value) {
    const st = this.profile.settings;
    st[key] = value;
    if (key === 'sfx') this.sound.setSfx(value);
    if (key === 'vibrate') { prefs.vibrate = value; if (value) vibrate(30); }
    if (key === 'music') { this.sound.unlock(); this.sound.setMusic(value); }
    if (key === 'symbols') { this.view.symbols = value; clearSpriteCache(); }
    if (key === 'motion') {
      this.reducedMotion = value;
      this.view.fx.reduced = value;
      document.documentElement.classList.toggle('reduced', value);
    }
    if (key === 'lang') { setLang(value); this.saveProfile(); this.refresh(); return; }
    this.saveProfile();
  }

  resetAll() {
    this.profile = resetProfile();
    this.saveProfile();
    this.setTheme('nuit');
    this.toast(t('settings.resetDone'), 'check');
    this.show('home');
  }

  // ------------------------------------------------------------------ modales et notifications
  modal(content, { dismissable = true, cls = '', onClose } = {}) {
    const root = $('#modal-root');
    const card = h(`div.modal-card${cls ? '.' + cls.split(' ').join('.') : ''}`, { role: 'dialog', 'aria-modal': 'true' }, content);
    const back = h('div.modal', { onclick: (e) => { if (e.target === back && dismissable) this.closeModal(); } }, card);
    const m = { el: back, dismissable, onClose };
    this.modals.push(m);
    root.append(back);
    requestAnimationFrame(() => back.classList.add('show'));
    const f = card.querySelector('[autofocus]') || card.querySelector('button');
    if (f) setTimeout(() => f.focus({ preventScroll: true }), 50);
    return m;
  }

  closeModal() {
    const m = this.modals.pop();
    if (!m) return;
    m.el.classList.remove('show');
    setTimeout(() => m.el.remove(), 200);
    if (m.onClose) m.onClose();
  }

  closeAllModals() {
    while (this.modals.length) {
      const m = this.modals.pop();
      m.el.remove();
    }
  }

  confirm(text, onYes, danger = false) {
    this.modal([
      h('p.confirm-text', { text }),
      h('div.btn-row',
        h('button.btn.ghost', { text: t('common.cancel'), onclick: () => this.closeModal() }),
        h(`button.btn${danger ? '.danger' : '.primary'}`, { text: t('common.confirm'), autofocus: true, onclick: () => { this.closeModal(); onYes(); } })),
    ], { cls: 'small' });
  }

  /** Notifications affichées une à la fois, dans l'ordre. */
  toast(text, ic = 'sparkle', cls = '') {
    (this.toastQueue ||= []).push({ text, ic, cls });
    if (!this.toastBusy) this.nextToast();
  }

  nextToast() {
    const item = this.toastQueue.shift();
    if (!item) { this.toastBusy = false; return; }
    this.toastBusy = true;
    const box = $('#toasts');
    const el = h(`div.toast${item.cls ? '.' + item.cls : ''}`, { role: 'status' }, h('span.toast-ic', { html: icon(item.ic) }), h('span', { text: item.text }));
    box.append(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => { el.remove(); this.nextToast(); }, 300);
    }, this.toastQueue.length ? 1500 : 2300);
  }

  trophyToast(a) {
    this.sound.trophy();
    this.toast(`${t('result.trophy', { name: t(`ach.${a.id}`) })}`, 'trophy', 'trophy');
  }

  pause() {
    if (!this.game.s || this.game.ending || this.modalOpen) return;
    this.sound.tap();
    const st = this.profile.settings;
    const toggle = (key, ic, label) => h(`button.toggle-chip${st[key] ? '.on' : ''}`, {
      'aria-pressed': String(!!st[key]), html: `${icon(ic)}<span>${label}</span>`,
      onclick: (e) => { this.setSetting(key, !st[key]); e.currentTarget.classList.toggle('on', st[key]); e.currentTarget.setAttribute('aria-pressed', String(st[key])); },
    });
    this.modal([
      h('h2.modal-title', { text: t('pause.title') }),
      h('div.btn-col',
        h('button.btn.primary.big', { html: `${icon('play')}<span>${t('pause.resume')}</span>`, autofocus: true, onclick: () => this.closeModal() }),
        h('button.btn', { html: `${icon('replay')}<span>${t('pause.restart')}</span>`, onclick: () => { this.closeModal(); this.confirm(t('pause.restartConfirm'), () => this.restart()); } }),
        h('button.btn', { html: `${icon('help')}<span>${t('pause.help')}</span>`, onclick: () => this.help() }),
        h('button.btn', { html: `${icon('home')}<span>${t('common.home')}</span>`, onclick: () => this.show('home') })),
      h('div.chip-row', toggle('sfx', 'sound', t('settings.sfx')), toggle('music', 'music', t('settings.music')), toggle('vibrate', 'vibrate', t('settings.vibrate'))),
    ], { cls: 'pause' });
  }

  help() {
    const steps = [1, 2, 3, 4, 5, 6].map((i) => h('li', h('span.help-n', { text: i }), h('span', { text: t(`help.${i}`) })));
    this.modal([
      h('h2.modal-title', { text: t('help.title') }),
      h('ol.help-list', steps),
      h('button.btn.primary', { text: t('common.ok'), autofocus: true, onclick: () => this.closeModal() }),
    ], { cls: 'help' });
  }

  goalLine(g, s) {
    const done = s ? Math.min(goalProgress(s, g), g.target) : null;
    const target = g.type === 'score' ? fmt(g.target) : g.target;
    return h(`div.goal-line${s && done >= g.target ? '.ok' : ''}`,
      h('span.goal-ic', { html: icon(s && done >= g.target ? 'check' : GOAL_ICON[g.type]) }),
      h('span', { text: t(`goal.${g.type}`, { n: target }) }),
      s ? h('b', { text: g.type === 'score' ? `${fmt(done)}/${fmt(g.target)}` : `${done}/${g.target}` }) : null);
  }

  levelIntro(L, go) {
    const w = worldOf(L.n);
    const stones = L.rows.join('').split('').filter((c) => c === '#').length;
    const goals = L.goals.map((g) => ({ ...g, target: g.type === 'stones' ? (g.target ?? stones) : g.target }));
    const best = this.profile.adv[L.n] || 0;
    this.modal([
      h('div.modal-kicker', { text: t(`world.${w.id}`) }),
      h('h2.modal-title', { text: t('level.title', { n: L.n }) }),
      h('div.stars.small', [1, 2, 3].map((i) => h(`span.star${i <= best ? '.on' : ''}`, { html: icon('starFill') }))),
      h('div.goal-list', goals.map((g) => this.goalLine(g))),
      h('p.muted', { text: t('level.moves', { n: L.moves }) }),
      h('button.btn.primary.big', { html: `${icon('play')}<span>${t('level.play')}</span>`, autofocus: true, onclick: () => { this.closeModal(); go(); } }),
    ], { cls: 'intro' });
  }

  // ------------------------------------------------------------------ résultats
  xpBlock(report) {
    const gained = report.xp + [...report.trophies, ...(report.liveTrophies || [])].reduce((a, x) => a + x.xp, 0);
    const before = levelInfo(this.profile.xp - gained);
    const after = levelInfo(this.profile.xp);
    const fill = h('div.xp-fill', { style: { width: `${before.pct * 100}%` } });
    const lvl = h('span.xp-level', { text: t('home.level', { n: before.level }) });
    const box = h('div.xp-block', lvl, h('div.xp-bar', fill), h('span.xp-gain', { text: t('result.xp', { n: gained }) }));
    setTimeout(() => {
      if (after.level > before.level) {
        fill.style.width = '100%';
        setTimeout(() => {
          fill.style.transition = 'none';
          fill.style.width = '0%';
          void fill.offsetWidth;
          fill.style.transition = '';
          fill.style.width = `${after.pct * 100}%`;
          lvl.textContent = t('home.level', { n: after.level });
          lvl.classList.add('up');
          this.sound.levelUp();
          this.toast(t('result.levelUp', { n: after.level }), 'crown', 'level');
          for (const th of report.newThemes) setTimeout(() => this.toast(t('result.unlockTheme', { name: t(`theme.${th.id}`) }), 'palette', 'level'), 700);
        }, 700);
      } else fill.style.width = `${after.pct * 100}%`;
    }, 500);
    return box;
  }

  trophyChips(report) {
    const list = [...(report.liveTrophies || []), ...report.trophies];
    if (!list.length) return null;
    if (report.trophies.length) setTimeout(() => this.sound.trophy(), 900);
    return h('div.unlocks', list.map((a) => h('div.unlock', h('span', { html: icon('trophy') }), h('span', { text: t(`ach.${a.id}`) }))));
  }

  statRow(s) {
    const cell = (v, l) => h('div.stat', h('b', { text: v }), h('small', { text: l }));
    return h('div.stat-row', cell(fmt(s.stats.lines), t('result.lines')), cell(s.stats.maxCombo, t('result.combo')), cell(s.stats.pure, t('result.prisms')));
  }

  bigScore(score) {
    const el = h('div.big-score', { text: '0' });
    setTimeout(() => tweenNumber(el, 0, score, 900, fmt), 150);
    return el;
  }

  resultsClassic(s, report) {
    if (report.newBest && report.prevBest > 0) setTimeout(() => this.sound.record(), 400);
    this.modal([
      h('h2.modal-title', { text: t('result.over') }),
      report.newBest ? h('div.ribbon', { text: t('result.newBest') }) : null,
      this.bigScore(s.score),
      h('div.best-line', { html: `${icon('crown')} ${t('result.best')} ${fmt(this.profile.best.classic)}` }),
      this.statRow(s),
      this.xpBlock(report),
      this.trophyChips(report),
      h('div.btn-row',
        h('button.btn.ghost', { html: `${icon('home')}<span>${t('common.home')}</span>`, onclick: () => this.show('home') }),
        h('button.btn.primary.big', { html: `${icon('replay')}<span>${t('result.again')}</span>`, autofocus: true, onclick: () => this.startClassic({ fresh: true }) })),
    ], { dismissable: false, cls: 'results' });
  }

  resultsAdventure(s, report) {
    const won = s.status === 'won';
    const L = getLevel(s.level);
    const next = s.level < LEVELS.length ? s.level + 1 : null;
    const stars = won ? report.stars : 0;
    const starEls = [1, 2, 3].map((i) => h('span.star', { html: icon('starFill') }));
    if (won) starEls.forEach((el, i) => { if (i < stars) setTimeout(() => { el.classList.add('on'); this.sound.star(i); vibrate(12); }, 500 + i * 380); });
    this.modal([
      h('div.modal-kicker', { text: t(`world.${worldOf(s.level).id}`) }),
      h('h2.modal-title', { text: won ? t('result.won', { n: s.level }) : t('result.lost') }),
      won ? h('div.stars.big', starEls) : h('p.muted', { text: t('result.lostHint') }),
      won ? this.bigScore(s.score) : h('div.goal-list', L.goals.map((g, i) => this.goalLine(s.goals[i], s))),
      this.xpBlock(report),
      this.trophyChips(report),
      h('div.btn-row',
        h('button.btn.ghost', { html: `${icon('back')}<span>${t('result.map')}</span>`, onclick: () => this.show('adventure', { focus: s.level }) }),
        won ? h('button.btn', { html: `${icon('replay')}`, 'aria-label': t('result.retry'), title: t('result.retry'), onclick: () => this.startLevel(s.level, { intro: false }) }) : null,
        won && next && levelUnlocked(this.profile, next)
          ? h('button.btn.primary.big', { html: `<span>${t('result.next')}</span>${icon('arrowR')}`, autofocus: true, onclick: () => this.startLevel(next) })
          : h('button.btn.primary.big', { html: `${icon('replay')}<span>${t('result.retry')}</span>`, autofocus: true, onclick: () => this.startLevel(s.level, { intro: false }) })),
    ], { dismissable: false, cls: 'results' });
  }

  resultsDaily(s, report, medal) {
    const m = this.dailyMedals;
    const streak = currentStreak(this.profile);
    const medalEl = h(`div.medal-big.${medal || 'none'}`, { html: icon(medal ? 'medal' : 'check') });
    if (medal) setTimeout(() => this.sound.star(2), 700);
    this.modal([
      h('h2.modal-title', { text: t('result.dailyDone') }),
      medalEl,
      medal ? h('div.medal-name', { text: t(`medal.${medal}`) }) : null,
      this.bigScore(s.score),
      h('div.medal-row', ['bronze', 'silver', 'gold'].map((k) => h(`div.medal-step.${k}${s.score >= m[k] ? '.ok' : ''}`, h('span.medal-dot.' + k), h('span', { text: fmt(m[k]) })))),
      h('div.streak-line', { html: `${icon('flame')} ${t('daily.streak')} : <b>${t('daily.days', { n: streak })}</b>` }),
      this.xpBlock(report),
      this.trophyChips(report),
      h('div.btn-row',
        h('button.btn.ghost', { html: `${icon('home')}<span>${t('common.home')}</span>`, onclick: () => this.show('home') }),
        h('button.btn.primary.big', { html: `${icon('share')}<span>${t('result.share')}</span>`, autofocus: true, onclick: () => this.share(s, medal, streak) })),
    ], { dismissable: false, cls: 'results' });
  }

  async share(s, medal, streak) {
    const emoji = { gold: '🥇', silver: '🥈', bronze: '🥉' }[medal] || '';
    const d = new Date(s.date + 'T12:00:00');
    const date = d.toLocaleDateString(getLang() === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' });
    const text = t('result.shareText', { date, score: fmt(s.score), medal: emoji, streak });
    const url = location.href.split('#')[0].split('?')[0];
    try {
      if (navigator.share) { await navigator.share({ text, url }); return; }
    } catch { /* partage annulé */ }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      this.toast(t('result.copied'), 'check');
    } catch {
      this.toast(text, 'share');
    }
  }
}

export { THEMES, starsFor, levelInfo };
