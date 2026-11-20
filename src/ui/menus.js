// Écrans de menu (DOM) : accueil, Aventure, défi du jour, trophées, statistiques, thèmes, réglages.
import { h } from './dom.js';
import { icon } from './icons.js';
import { t, tn, fmt, getLang, LANGS } from '../core/i18n.js';
import { LEVELS, WORLDS } from '../game/levels.js';
import { dateKey, keyToDate } from '../game/daily.js';
import { loadGame, levelInfo, levelUnlocked, nextLevel, totalStars, currentStreak, ensureMissions } from '../meta/profile.js';
import { missionIcon } from '../meta/missions.js';
import { ACHIEVEMENTS } from '../meta/achievements.js';
import { THEMES } from '../meta/themes.js';
import { blockSprite } from '../render/blocks.js';
import { STONE } from '../game/board.js';

const header = (app, title, extra = null, back = 'home') => h('header.menu-head',
  h('button.icon-btn', { 'aria-label': t('common.back'), html: icon('back'), onclick: () => { app.sound.tap(); app.show(back); } }),
  h('h1.menu-title', { text: title }),
  h('div.menu-extra', extra));

function logo() {
  const letters = [...'PRISME'].map((ch, i) => h('span', { style: { '--i': i }, text: ch }));
  return h('div.logo-wrap',
    h('div.logo-prism', { html: '<svg viewBox="0 0 120 70" aria-hidden="true"><defs><linearGradient id="lg" x1="0" x2="1"><stop offset="0" stop-color="var(--c1)"/><stop offset=".25" stop-color="var(--c2)"/><stop offset=".5" stop-color="var(--c3)"/><stop offset=".75" stop-color="var(--c4)"/><stop offset="1" stop-color="var(--c5)"/></linearGradient></defs><path d="M0 40 L44 36" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".9"/><path d="M60 6 L84 56 H36 Z" fill="rgba(255,255,255,.12)" stroke="#fff" stroke-width="3" stroke-linejoin="round"/><path d="M70 30 L120 14 L120 58 L72 40 Z" fill="url(#lg)" opacity=".9"/></svg>' }),
    h('h1.logo', { 'aria-label': 'Prisme' }, letters),
    h('p.tagline', { text: t('app.tagline') }));
}

function missionsCard(app) {
  const p = app.profile;
  const ms = ensureMissions(p, dateKey());
  const done = ms.list.filter((m) => m.done).length;
  const row = (m) => {
    const label = m.type === 'classic' || m.type === 'blitz' ? t(`mission.${m.type}`, { n: fmt(m.target) }) : tn(`mission.${m.type}`, m.target);
    const pct = Math.min(100, (m.progress / m.target) * 100);
    return h(`div.mission${m.done ? '.done' : ''}`,
      h('span.mission-ic', { html: icon(m.done ? 'check' : missionIcon(m.type)) }),
      h('div.mission-body',
        h('div.mission-top', h('span', { text: label }), h('b', { text: `+${m.xp}` })),
        h('div.mission-bar', h('i', { style: { width: `${pct}%` } }))));
  };
  return h('div.missions-card',
    h('div.missions-head',
      h('span.missions-title', { html: `${icon('target')} ${t('mission.title')}` }),
      h(`span.missions-bonus${ms.bonus ? '.got' : ''}`, { html: `${icon('gift')} ${done}/3` })),
    ms.list.map(row));
}

function home(app) {
  const p = app.profile;
  const lv = levelInfo(p.xp);
  const saved = loadGame('classic');
  const next = nextLevel(p, LEVELS.length);
  const today = dateKey();
  const doneToday = !!p.daily.days[today];
  const streak = currentStreak(p, today);
  const stars = totalStars(p);
  const ach = Object.keys(p.ach).length;
  const esc = (x) => String(x).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  const card = (id, cls, ic, name, sub, meta, onclick, extra = null) => h(`button.mode-card.${cls}#${id}`, { onclick: () => { app.sound.tap(); onclick(); } },
    h('span.mode-ic', { html: icon(ic) }),
    h('span.mode-name', { text: name }),
    h('span.mode-sub', { html: meta ? `${esc(sub)} · <span class="mode-meta">${meta}</span>` : esc(sub) }),
    extra);
  return h('section.home#screen-home',
    h('div.home-top',
      h('button.player-chip', { onclick: () => app.show('stats'), 'aria-label': t('home.stats') },
        h('span.player-lv', { text: t('home.level', { n: lv.level }) }),
        h('span.player-bar', h('span', { style: { width: `${lv.pct * 100}%` } }))),
      h('button.icon-btn', { 'aria-label': t('home.settings'), html: icon('gear'), onclick: () => { app.sound.tap(); app.show('settings'); } })),
    h('div.home-scroll',
      logo(),
      h('div.home-main',
        h('button.btn.primary.huge.play-btn#btn-play', { autofocus: true, onclick: () => { app.sound.tap(); app.startClassic(); } },
          h('span.play-ic', { html: icon('play') }),
          h('span.play-txt', h('b', { text: saved ? t('home.continue') : t('home.play') }),
            h('small', { text: saved ? t('home.resume', { n: fmt(saved.score) }) : p.best.classic ? t('home.best', { n: fmt(p.best.classic) }) : t('home.classicSub') }))),
        h('div.mode-cards',
          card('btn-adventure', 'adv', 'peak', t('home.adventure'), next ? t('home.adventureSub', { n: next }) : t('home.adventureDone'), `${icon('starFill')} ${stars}`, () => app.show('adventure')),
          card('btn-daily', 'daily', 'calendar', t('home.daily'), doneToday ? t('home.dailyDone') : t('home.dailyTodo'), `${icon('flame')} ${t('home.streak', { n: streak })}`, () => app.show('daily'), doneToday ? null : h('span.dot-new')),
          card('btn-blitz', 'blitz', 'clock', t('mode.blitz'), loadGame('blitz') ? t('home.continue') : p.best.blitz ? t('home.best', { n: fmt(p.best.blitz) }) : t('mode.blitzSub'), null, () => app.startArcade('blitz')),
          card('btn-zen', 'zen', 'lotus', t('mode.zen'), loadGame('zen') ? t('home.continue') : p.best.zen ? t('home.best', { n: fmt(p.best.zen) }) : t('mode.zenSub'), null, () => app.startArcade('zen'))),
        missionsCard(app))),
    h('nav.home-nav',
      h('button.nav-btn', { onclick: () => app.show('trophies'), html: `${icon('trophy')}<span>${t('home.trophies')}</span><small>${ach}/${ACHIEVEMENTS.length}</small>` }),
      h('button.nav-btn', { onclick: () => app.show('stats'), html: `${icon('chart')}<span>${t('home.stats')}</span>` }),
      h('button.nav-btn', { onclick: () => app.show('themes'), html: `${icon('palette')}<span>${t('home.themes')}</span>` })));
}

function adventure(app, params) {
  const p = app.profile;
  const max = LEVELS.length * 3;
  const current = nextLevel(p, LEVELS.length);
  const focus = params.focus || current || LEVELS.length;
  const worlds = WORLDS.map((w) => {
    const unlocked = levelUnlocked(p, w.from);
    let got = 0;
    for (let n = w.from; n <= w.to; n++) got += p.adv[n] || 0;
    const btns = [];
    for (let n = w.from; n <= w.to; n++) {
      const open = levelUnlocked(p, n);
      const st = p.adv[n] || 0;
      btns.push(h(`button.lvl${open ? '' : '.locked'}${n === current ? '.current' : ''}${st ? '.done' : ''}`, {
        'data-level': n, disabled: !open, 'aria-label': t('level.title', { n }),
        onclick: () => { app.sound.tap(); app.startLevel(n); },
      },
      open ? h('span.lvl-n', { text: n }) : h('span.lvl-lock', { html: icon('lock') }),
      h('span.lvl-stars', [1, 2, 3].map((i) => h(`i${i <= st ? '.on' : ''}`)))));
    }
    return h(`section.world.w${w.id}${unlocked ? '' : '.locked'}`,
      h('div.world-head',
        h('span.world-ic', { html: icon(w.icon) }),
        h('div.world-txt', h('h2', { text: t(`world.${w.id}`) }), h('p', { text: unlocked ? t(`world.${w.id}.sub`) : t('world.locked') })),
        h('span.world-stars', { html: `${icon('starFill')} ${got}/${(w.to - w.from + 1) * 3}` })),
      h('div.lvl-grid', btns));
  });
  const el = h('section.adventure#screen-adventure',
    header(app, t('adv.title'), h('span.chip', { html: `${icon('starFill')} ${t('adv.stars', { n: totalStars(p), max })}` })),
    h('div.menu-scroll', worlds));
  setTimeout(() => {
    const b = el.querySelector(`[data-level="${focus}"]`);
    if (b) b.scrollIntoView({ block: 'center' });
  }, 30);
  return el;
}

function daily(app, params) {
  const p = app.profile;
  const today = dateKey();
  const { medals } = app.getDaily(today);
  const rec = p.daily.days[today];
  const streak = currentStreak(p, today);
  const base = keyToDate(today);
  const month = params.month ?? 0;
  const view = new Date(base.getFullYear(), base.getMonth() + month, 1);
  const first = (view.getDay() + 6) % 7; // lundi en premier
  const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const loc = getLang() === 'fr' ? 'fr-FR' : 'en-US';
  const wd = [...Array(7)].map((_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(loc, { weekday: 'narrow' }));
  const cells = [];
  for (let i = 0; i < first; i++) cells.push(h('span.cal-empty'));
  for (let d = 1; d <= days; d++) {
    const key = dateKey(new Date(view.getFullYear(), view.getMonth(), d));
    const r = p.daily.days[key];
    cells.push(h(`span.cal-day${key === today ? '.today' : ''}${r ? '.done' : ''}${r && r.medal ? '.' + r.medal : ''}`, { title: r ? `${fmt(r.score)} ${t('common.pts')}` : key },
      r ? h('span.cal-mark', { html: icon(r.medal ? 'medal' : 'check') }) : h('span', { text: d })));
  }
  const title = view.toLocaleDateString(loc, { month: 'long', year: 'numeric' });
  return h('section.daily#screen-daily',
    header(app, t('daily.title')),
    h('div.menu-scroll',
      h('div.card.streak-card',
        h('div.streak-big', h('span', { html: icon('flame') }), h('b', { text: streak })),
        h('div', h('div.streak-label', { text: t('daily.streak') }), h('div.muted', { text: t('daily.bestStreak', { n: p.daily.bestStreak }) }))),
      h('div.card.calendar',
        h('div.cal-head',
          h('button.icon-btn.small', { 'aria-label': '‹', html: icon('arrowL'), onclick: () => app.show('daily', { month: month - 1 }) }),
          h('span.cal-title', { text: title }),
          h('button.icon-btn.small', { 'aria-label': '›', html: icon('arrowR'), disabled: month >= 0, onclick: () => app.show('daily', { month: month + 1 }) })),
        h('div.cal-grid', wd.map((x) => h('span.cal-wd', { text: x })), cells)),
      h('div.card.today-card',
        h('p', { text: t('daily.desc') }),
        h('div.medal-row', ['bronze', 'silver', 'gold'].map((k) => h(`div.medal-step.${k}${rec && rec.score >= medals[k] ? '.ok' : ''}`, h('span.medal-dot.' + k), h('span', { text: fmt(medals[k]) })))),
        rec ? h('p.today-score', { text: t('daily.today', { n: fmt(rec.score) }) }) : null,
        h('button.btn.primary.big#btn-daily-play', { autofocus: true, html: `${icon('play')}<span>${rec ? t('daily.replay') : t('daily.play')}</span>`, onclick: () => { app.sound.tap(); app.startDaily({ fresh: !!rec }); } }))));
}

function trophies(app) {
  const p = app.profile;
  const n = Object.keys(p.ach).length;
  return h('section.trophies#screen-trophies',
    header(app, t('trophies.title'), h('span.chip', { text: t('trophies.count', { n, max: ACHIEVEMENTS.length }) })),
    h('div.menu-scroll.ach-list', ACHIEVEMENTS.map((a) => h(`div.ach${p.ach[a.id] ? '.on' : ''}`,
      h('span.ach-ic', { html: icon(p.ach[a.id] ? a.icon : 'lock') }),
      h('div.ach-txt', h('b', { text: t(`ach.${a.id}`) }), h('small', { text: t(`ach.${a.id}.d`) })),
      a.xp ? h('span.ach-xp', { text: `+${a.xp} XP` }) : null))));
}

function stats(app) {
  const p = app.profile, s = p.stats;
  const lv = levelInfo(p.xp);
  const hours = Math.floor(s.time / 3600000), mins = Math.floor((s.time % 3600000) / 60000);
  const rows = [
    ['stats.games', fmt(s.games)],
    ['stats.bestClassic', fmt(p.best.classic)],
    ['stats.bestBlitz', fmt(p.best.blitz || 0)],
    ['stats.bestZen', fmt(p.best.zen || 0)],
    ['stats.missions', fmt(s.missions || 0)],
    ['stats.avgClassic', fmt(s.classicGames ? s.classicTotal / s.classicGames : 0)],
    ['stats.areas', fmt(s.areas)],
    ['stats.light', fmt(s.light)],
    ['stats.whites', fmt(s.whites)],
    ['stats.maxArea', fmt(s.maxArea)],
    ['stats.shooting', fmt(s.shooting)],
    ['stats.boardClears', fmt(s.boardClears)],
    ['stats.bestCombo', fmt(s.bestCombo)],
    ['stats.pieces', fmt(s.pieces)],
    ['stats.powers', fmt(s.powers)],
    ['stats.stars', `${totalStars(p)} / ${LEVELS.length * 3}`],
    ['stats.dailyBest', fmt(p.daily.bestStreak)],
    ['stats.time', hours ? `${hours} h ${String(mins).padStart(2, '0')}` : `${mins} min`],
  ];
  return h('section.stats#screen-stats',
    header(app, t('stats.title')),
    h('div.menu-scroll',
      h('div.card.level-card',
        h('div.level-badge', { text: lv.level }),
        h('div.level-info', h('b', { text: t('home.level', { n: lv.level }) }), h('div.xp-bar', h('div.xp-fill', { style: { width: `${lv.pct * 100}%` } })), h('small.muted', { text: `${fmt(lv.cur)} / ${fmt(lv.need)} XP` }))),
      h('div.card.stat-list', rows.map(([k, v]) => h('div.stat-item', h('span', { text: t(k) }), h('b', { text: v }))))));
}

function themePreview(theme) {
  const cv = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cell = 26;
  cv.width = Math.round(cell * 6 * dpr);
  cv.height = Math.round(cell * 1.4 * dpr);
  cv.className = 'theme-canvas';
  const ctx = cv.getContext('2d');
  const size = Math.round(cell * dpr);
  [1, 2, 4, STONE, 'gem', 'star'].forEach((k, i) => {
    const sp = blockSprite(theme, k, size);
    const pad = (sp.width - size) / 2;
    ctx.drawImage(sp, i * size - pad, (cv.height - size) / 2 - pad);
  });
  return cv;
}

function themes(app) {
  const p = app.profile;
  const lv = levelInfo(p.xp).level;
  return h('section.themes#screen-themes',
    header(app, t('themes.title')),
    h('div.menu-scroll.theme-grid', THEMES.map((th) => {
      const open = th.level <= lv;
      const active = p.theme === th.id;
      return h(`button.theme-card${active ? '.active' : ''}${open ? '' : '.locked'}`, {
        'data-theme-id': th.id, disabled: !open,
        style: { background: `linear-gradient(150deg, ${th.bg[0]}, ${th.bg[2]})`, color: th.ui.text },
        onclick: () => { app.sound.tap(); app.setTheme(th.id); app.show('themes'); },
      },
      themePreview(th),
      h('span.theme-name', { text: t(`theme.${th.id}`) }),
      h('span.theme-state', { html: active ? `${icon('check')} ${t('themes.active')}` : open ? t('themes.use') : `${icon('lock')} ${t('themes.locked', { n: th.level })}` }));
    })));
}

function settings(app) {
  const st = app.profile.settings;
  const sw = (key, ic, label, sub) => h('div.set-row',
    h('span.set-ic', { html: icon(ic) }),
    h('div.set-txt', h('span', { text: label }), sub ? h('small', { text: sub }) : null),
    h(`button.switch${st[key] ? '.on' : ''}`, {
      role: 'switch', 'aria-checked': String(!!st[key]), 'aria-label': label, 'data-setting': key,
      onclick: (e) => { app.setSetting(key, !st[key]); e.currentTarget.classList.toggle('on', st[key]); e.currentTarget.setAttribute('aria-checked', String(st[key])); app.sound.tap(); },
    }, h('i')));
  const langs = h('div.seg', LANGS.map((l) => h(`button${getLang() === l ? '.on' : ''}`, { text: l === 'fr' ? 'Français' : 'English', onclick: () => app.setSetting('lang', l) })));
  return h('section.settings#screen-settings',
    header(app, t('settings.title')),
    h('div.menu-scroll',
      h('div.card',
        sw('sfx', 'sound', t('settings.sfx')),
        sw('music', 'music', t('settings.music')),
        sw('vibrate', 'vibrate', t('settings.vibrate')),
        sw('symbols', 'eye', t('settings.symbols'), t('settings.symbolsSub')),
        sw('motion', 'motion', t('settings.motion')),
        h('div.set-row', h('span.set-ic', { html: icon('globe') }), h('div.set-txt', h('span', { text: t('settings.lang') })), langs)),
      h('div.card.btn-col',
        window.__installPrompt ? h('button.btn.primary', {
          html: `${icon('home')}<span>${t('settings.install')}</span>`,
          onclick: async () => {
            const ev = window.__installPrompt;
            window.__installPrompt = null;
            try { await ev.prompt(); } catch { /* refusé */ }
            app.show('settings');
          },
        }) : null,
        h('button.btn', { html: `${icon('help')}<span>${t('pause.help')}</span>`, onclick: () => app.help() }),
        h('button.btn', {
          html: `${icon('replay')}<span>${t('settings.tutorial')}</span>`,
          onclick: () => {
            const go = () => { app.profile.tutorialDone = false; app.saveProfile(); app.startClassic({ fresh: true }); };
            if (loadGame('classic')) app.confirm(t('pause.restartConfirm'), go); else go();
          },
        }),
        h('button.btn.danger-ghost', { html: `${icon('trash')}<span>${t('settings.reset')}</span>`, onclick: () => app.confirm(t('settings.resetConfirm'), () => app.resetAll(), true) })),
      h('p.credits', { text: t('settings.credits') })));
}

export const SCREENS = { home, adventure, daily, trophies, stats, themes, settings };
