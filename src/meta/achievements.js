// Trophées. `check(profil, partie, contexte)` : la partie peut être absente (vérification
// hors partie). Les trophées `live` sont aussi vérifiés pendant la partie, après chaque coup.
import { LEVELS } from '../game/levels.js';

const classic = (s) => s && s.mode === 'classic';
const advDone = (p, from, to) => { for (let n = from; n <= to; n++) if (!(p.adv[n] >= 1)) return false; return true; };
export const totalStars = (p) => Object.values(p.adv).reduce((a, b) => a + b, 0);

export const ACHIEVEMENTS = [
  { id: 'first_line', icon: 'spark', xp: 20, live: true, check: (p, s) => p.stats.lines >= 1 || (s && s.stats.lines >= 1) },
  { id: 'prism', icon: 'prism', xp: 40, live: true, check: (p, s) => p.stats.prisms >= 1 || (s && s.stats.pure >= 1) },
  { id: 'prism5', icon: 'prism', xp: 150, live: true, check: (p, s) => s && s.stats.pure >= 5 },
  { id: 'combo5', icon: 'flame', xp: 40, live: true, check: (p, s) => p.stats.bestCombo >= 5 || (s && s.stats.maxCombo >= 5) },
  { id: 'combo10', icon: 'flame', xp: 80, live: true, check: (p, s) => p.stats.bestCombo >= 10 || (s && s.stats.maxCombo >= 10) },
  { id: 'combo25', icon: 'flame', xp: 200, live: true, check: (p, s) => p.stats.bestCombo >= 25 || (s && s.stats.maxCombo >= 25) },
  { id: 'multi3', icon: 'lines', xp: 60, live: true, check: (p, s) => p.stats.maxLines >= 3 || (s && s.stats.maxLines >= 3) },
  { id: 'multi4', icon: 'lines', xp: 150, live: true, check: (p, s) => p.stats.maxLines >= 4 || (s && s.stats.maxLines >= 4) },
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
  { id: 'lines500', icon: 'lines', xp: 100, check: (p) => p.stats.lines >= 500 },
  { id: 'lines5000', icon: 'lines', xp: 300, check: (p) => p.stats.lines >= 5000 },
  { id: 'world1', icon: 'spark', xp: 80, check: (p) => advDone(p, 1, 10) },
  { id: 'world3', icon: 'stone', xp: 150, check: (p) => advDone(p, 1, 30) },
  { id: 'world6', icon: 'peak', xp: 500, check: (p) => advDone(p, 1, LEVELS.length) },
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
