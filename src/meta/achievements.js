// Trophées. `check(profil, partie, contexte)` : la partie peut être absente (vérification
// hors partie). Les trophées `live` sont aussi vérifiés pendant la partie, après chaque coup.
import { LEVELS } from '../game/levels.js';

const classic = (s) => s && s.mode === 'classic';
const advDone = (p, from, to) => { for (let n = from; n <= to; n++) if (!(p.adv[n] >= 1)) return false; return true; };
export const totalStars = (p) => Object.values(p.adv).reduce((a, b) => a + b, 0);

export const ACHIEVEMENTS = [
  { id: 'first_area', icon: 'spark', xp: 20, live: true, check: (p, s) => p.stats.areas >= 1 || (s && s.stats.areas >= 1) },
  { id: 'white', icon: 'prism', xp: 40, live: true, check: (p, s) => p.stats.whites >= 1 || (s && s.stats.whites >= 1) },
  { id: 'white10', icon: 'prism', xp: 150, live: true, check: (p, s) => s && s.stats.whites >= 10 },
  { id: 'big6', icon: 'expand', xp: 60, live: true, check: (p, s) => p.stats.maxArea >= 6 || (s && s.stats.maxArea >= 6) },
  { id: 'big12', icon: 'expand', xp: 150, live: true, check: (p, s) => p.stats.maxArea >= 12 || (s && s.stats.maxArea >= 12) },
  { id: 'multi2', icon: 'ring', xp: 50, live: true, check: (p, s) => p.stats.multi >= 2 || (s && s.stats.multi >= 2) },
  { id: 'multi3', icon: 'ring', xp: 150, live: true, check: (p, s) => p.stats.multi >= 3 || (s && s.stats.multi >= 3) },
  { id: 'combo5', icon: 'flame', xp: 40, live: true, check: (p, s) => p.stats.bestCombo >= 5 || (s && s.stats.maxCombo >= 5) },
  { id: 'combo10', icon: 'flame', xp: 80, live: true, check: (p, s) => p.stats.bestCombo >= 10 || (s && s.stats.maxCombo >= 10) },
  { id: 'combo20', icon: 'flame', xp: 200, live: true, check: (p, s) => p.stats.bestCombo >= 20 || (s && s.stats.maxCombo >= 20) },
  { id: 'star', icon: 'star', xp: 40, live: true, check: (p, s) => p.stats.shooting >= 1 || (s && s.stats.stars >= 1) },
  { id: 'star10', icon: 'star', xp: 150, live: true, check: (p, s) => s && s.stats.stars >= 10 },
  { id: 'clean', icon: 'sparkle', xp: 60, live: true, check: (p, s) => p.stats.boardClears >= 1 || (s && s.stats.boardClears >= 1) },
  { id: 'score5k', icon: 'star', xp: 50, live: true, check: (p, s) => p.best.classic >= 5000 || (classic(s) && s.score >= 5000) },
  { id: 'score20k', icon: 'star', xp: 100, live: true, check: (p, s) => p.best.classic >= 20000 || (classic(s) && s.score >= 20000) },
  { id: 'score50k', icon: 'crown', xp: 200, live: true, check: (p, s) => p.best.classic >= 50000 || (classic(s) && s.score >= 50000) },
  { id: 'score100k', icon: 'crown', xp: 400, live: true, check: (p, s) => p.best.classic >= 100000 || (classic(s) && s.score >= 100000) },
  { id: 'rescue', icon: 'bomb', xp: 40, live: true, check: (p, s) => p.stats.rescues >= 1 || (s && s.stats.rescues >= 1) },
  { id: 'purist', icon: 'gem', xp: 150, live: true, check: (p, s) => classic(s) && s.score >= 10000 && s.stats.powersUsed === 0 },
  { id: 'record', icon: 'crown', xp: 50, check: (p, s, ctx) => !!(ctx && ctx.newBest && ctx.prevBest > 0) },
  { id: 'games10', icon: 'play', xp: 50, check: (p) => p.stats.games >= 10 },
  { id: 'games50', icon: 'play', xp: 150, check: (p) => p.stats.games >= 50 },
  { id: 'light500', icon: 'sun', xp: 100, check: (p) => p.stats.light >= 500 },
  { id: 'light5000', icon: 'sun', xp: 300, check: (p) => p.stats.light >= 5000 },
  { id: 'world1', icon: 'spark', xp: 80, check: (p) => advDone(p, 1, 10) },
  { id: 'world3', icon: 'stone', xp: 150, check: (p) => advDone(p, 1, 30) },
  { id: 'world6', icon: 'peak', xp: 300, check: (p) => advDone(p, 1, 60) },
  { id: 'world7', icon: 'cloud', xp: 200, check: (p) => advDone(p, 61, 70) },
  { id: 'world8', icon: 'crystal', xp: 500, check: (p) => advDone(p, 1, LEVELS.length) },
  { id: 'crystal', icon: 'crystal', xp: 50, live: true, check: (p, s) => p.stats.crystals >= 1 || (s && s.stats.crystals >= 1) },
  { id: 'blitz3k', icon: 'clock', xp: 80, live: true, check: (p, s) => p.best.blitz >= 3000 || (s && s.mode === 'blitz' && s.score >= 3000) },
  { id: 'blitz8k', icon: 'clock', xp: 200, live: true, check: (p, s) => p.best.blitz >= 8000 || (s && s.mode === 'blitz' && s.score >= 8000) },
  { id: 'zen200', icon: 'lotus', xp: 80, live: true, check: (p, s) => s && s.mode === 'zen' && s.stats.light >= 200 },
  { id: 'missions10', icon: 'target', xp: 150, check: (p) => (p.stats.missions || 0) >= 10 },
  { id: 'missionDay', icon: 'target', xp: 60, check: (p) => (p.stats.missionDays || 0) >= 1 },
  { id: 'stars90', icon: 'star', xp: 200, check: (p) => totalStars(p) >= 90 },
  { id: 'daily1', icon: 'calendar', xp: 40, check: (p) => Object.keys(p.daily.days).length >= 1 },
  { id: 'daily7', icon: 'flame', xp: 200, check: (p) => p.daily.bestStreak >= 7 },
  { id: 'dailyGold', icon: 'medal', xp: 100, check: (p) => Object.values(p.daily.days).some((d) => d.medal === 'gold') },
  { id: 'level10', icon: 'crown', xp: 0, check: (p, s, ctx) => !!(ctx && ctx.level >= 10) },
];

/** Débloque les trophées remplis. Renvoie les nouveaux (et ajoute leur XP au profil). */
export function unlockAchievements(p, s, ctx, { liveOnly = false } = {}) {
  const out = [];
  for (const a of ACHIEVEMENTS) {
    if (p.ach[a.id] || (liveOnly && !a.live)) continue;
    if (a.check(p, s, ctx)) {
      p.ach[a.id] = Date.now();
      p.xp += a.xp;
      out.push(a);
    }
  }
  return out;
}
