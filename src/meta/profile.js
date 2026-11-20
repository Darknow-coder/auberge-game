// Profil du joueur : réglages, records, expérience, trophées, progression de l'Aventure,
// défis du jour. Tout est stocké dans le navigateur (localStorage), avec un repli en mémoire.
import { THEMES } from './themes.js';
import { unlockAchievements, totalStars } from './achievements.js';
import { starsFor } from '../game/engine.js';
import { keyToDate, dateKey } from '../game/daily.js';

const PROFILE_KEY = 'prisme.profile.v1';
const SAVE_PREFIX = 'prisme.save.';
const memory = new Map();

export const store = {
  get(key) {
    try { const v = localStorage.getItem(key); if (v !== null) return v; } catch { /* stockage indisponible */ }
    return memory.has(key) ? memory.get(key) : null;
  },
  set(key, value) {
    memory.set(key, value);
    try { localStorage.setItem(key, value); } catch { /* quota ou navigation privée */ }
  },
  remove(key) {
    memory.delete(key);
    try { localStorage.removeItem(key); } catch { /* idem */ }
  },
};

export function defaultProfile() {
  return {
    v: 1,
    xp: 0,
    theme: 'nuit',
    settings: { sfx: true, music: true, vibrate: true, symbols: false, motion: false, lang: null },
    best: { classic: 0 },
    stats: { games: 0, classicGames: 0, classicTotal: 0, areas: 0, light: 0, whites: 0, maxArea: 0, multi: 0, shooting: 0, boardClears: 0, bestCombo: 0, pieces: 0, powers: 0, rescues: 0, time: 0 },
    ach: {},
    adv: {},
    daily: { days: {}, streak: 0, bestStreak: 0, last: null },
    tips: {},
    tutorialDone: false,
  };
}

function merge(base, data) {
  if (!data || typeof data !== 'object') return base;
  for (const k of Object.keys(base)) {
    if (!(k in data)) continue;
    const b = base[k], d = data[k];
    if (b && typeof b === 'object' && !Array.isArray(b) && d && typeof d === 'object') {
      // Objets « dictionnaires » (trophées, étoiles, jours) : copiés tels quels.
      base[k] = Object.keys(b).length ? merge(b, d) : { ...d };
    } else if (typeof d === typeof b || b === null) base[k] = d;
  }
  return base;
}

export function loadProfile() {
  let data = null;
  try { data = JSON.parse(store.get(PROFILE_KEY) || 'null'); } catch { data = null; }
  return merge(defaultProfile(), data);
}

export function saveProfile(p) {
  store.set(PROFILE_KEY, JSON.stringify(p));
}

export function resetProfile() {
  store.remove(PROFILE_KEY);
  for (const slot of ['classic', 'adventure', 'daily']) clearGame(slot);
  return defaultProfile();
}

// ---------- Parties en cours
export function saveGame(slot, s) { store.set(SAVE_PREFIX + slot, JSON.stringify(s)); }
export function clearGame(slot) { store.remove(SAVE_PREFIX + slot); }
export function loadGame(slot) {
  try {
    const s = JSON.parse(store.get(SAVE_PREFIX + slot) || 'null');
    if (s && s.v === 3 && s.board && s.board.o && Array.isArray(s.tray) && (s.status === 'play' || s.status === 'stuck')) return s;
  } catch { /* sauvegarde illisible */ }
  return null;
}

// ---------- Niveaux d'expérience
export const xpNeed = (level) => 120 + 60 * (level - 1);

export function levelInfo(xp) {
  let level = 1, rest = xp;
  while (rest >= xpNeed(level)) { rest -= xpNeed(level); level++; }
  return { level, cur: rest, need: xpNeed(level), pct: rest / xpNeed(level) };
}

export const unlockedThemes = (p) => THEMES.filter((t) => t.level <= levelInfo(p.xp).level);

// ---------- Aventure
export const levelUnlocked = (p, n) => n === 1 || p.adv[n - 1] >= 1;
export function nextLevel(p, max) {
  for (let n = 1; n <= max; n++) if (!(p.adv[n] >= 1)) return n;
  return null;
}
export { totalStars };

// ---------- Défi du jour
export function currentStreak(p, today = dateKey()) {
  const d = p.daily;
  if (!d.last) return 0;
  if (d.last === today) return d.streak;
  const y = keyToDate(today);
  y.setDate(y.getDate() - 1);
  return d.last === dateKey(y) ? d.streak : 0;
}

function registerDaily(p, key, score, medal) {
  const d = p.daily;
  const prev = d.days[key];
  const order = { gold: 3, silver: 2, bronze: 1 };
  if (prev) {
    if (score > prev.score) prev.score = score;
    if ((order[medal] || 0) > (order[prev.medal] || 0)) prev.medal = medal;
    return false;
  }
  d.days[key] = { score, medal };
  const y = keyToDate(key);
  y.setDate(y.getDate() - 1);
  d.streak = d.last === dateKey(y) ? d.streak + 1 : 1;
  d.last = key;
  d.bestStreak = Math.max(d.bestStreak, d.streak);
  return true;
}

// ---------- Fin de partie
export function xpForGame(s, info = {}) {
  if (s.mode === 'classic') return 10 + Math.floor(s.score / 50);
  if (s.mode === 'adventure') {
    if (s.status !== 'won') return 5 + Math.floor(s.score / 100);
    return 25 + 10 * starsFor(s) + (info.firstWin ? 30 : 0);
  }
  if (s.mode === 'daily') {
    if (!info.firstDaily) return 5 + Math.floor(s.score / 100);
    return 30 + ({ gold: 40, silver: 25, bronze: 15 }[info.medal] || 0);
  }
  return 0;
}

/**
 * Enregistre une partie terminée : statistiques, records, étoiles, défi du jour, XP,
 * trophées et thèmes débloqués. Renvoie un compte rendu pour l'écran de résultats.
 */
export function recordGame(p, s, info = {}) {
  const st = p.stats;
  const g = s.stats;
  // XP des trophées déjà gagnés pendant la partie : comptée dans la progression de cette partie.
  const levelBefore = levelInfo(p.xp - (info.liveXp || 0)).level;
  st.games++;
  st.areas += g.areas;
  st.light += g.light;
  st.whites += g.whites;
  st.shooting += g.stars;
  st.maxArea = Math.max(st.maxArea, g.maxArea);
  st.multi = Math.max(st.multi, g.multi);
  st.boardClears += g.boardClears;
  st.bestCombo = Math.max(st.bestCombo, g.maxCombo);
  st.pieces += g.placed;
  st.powers += g.powersUsed;
  st.rescues += g.rescues;
  st.time += info.time || 0;
  const report = { xp: 0, levelBefore, levelAfter: levelBefore, newThemes: [], trophies: [], newBest: false, prevBest: p.best.classic, stars: 0, firstWin: false, firstDaily: false, medal: info.medal || null };
  if (s.mode === 'classic') {
    st.classicGames++;
    st.classicTotal += s.score;
    if (s.score > p.best.classic) { report.newBest = true; p.best.classic = s.score; }
  } else if (s.mode === 'adventure' && s.status === 'won') {
    report.stars = starsFor(s);
    report.firstWin = !(p.adv[s.level] >= 1);
    p.adv[s.level] = Math.max(p.adv[s.level] || 0, report.stars);
  } else if (s.mode === 'daily') {
    report.firstDaily = registerDaily(p, s.date, s.score, info.medal);
  }
  report.xp = xpForGame(s, { firstWin: report.firstWin, firstDaily: report.firstDaily, medal: info.medal });
  p.xp += report.xp;
  report.trophies = unlockAchievements(p, s, { newBest: report.newBest, prevBest: report.prevBest, level: levelInfo(p.xp).level });
  // Le trophée « niveau 10 » peut dépendre de l'XP des autres trophées.
  report.trophies.push(...unlockAchievements(p, s, { level: levelInfo(p.xp).level }));
  report.levelAfter = levelInfo(p.xp).level;
  report.newThemes = THEMES.filter((t) => t.level > levelBefore && t.level <= report.levelAfter);
  return report;
}
