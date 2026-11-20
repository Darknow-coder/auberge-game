// Missions du jour : trois défis tirés chaque jour (les mêmes pour tout le monde),
// de difficulté croissante, récompensés en expérience. Les trois réussies : bonus du jour.
import { createRng, hashString, shuffle } from '../core/rng.js';

/**
 * kind : 'sum' = cumul sur toutes les parties du jour, 'best' = meilleure partie du jour.
 * targets / xp : niveaux facile, moyen, difficile.
 */
export const MISSION_TYPES = [
  { id: 'areas', kind: 'sum', icon: 'ring', targets: [12, 20, 30], xp: [40, 70, 100] },
  { id: 'light', kind: 'sum', icon: 'sun', targets: [40, 70, 110], xp: [40, 70, 100] },
  { id: 'whites', kind: 'sum', icon: 'prism', targets: [3, 5, 8], xp: [50, 80, 120] },
  { id: 'stars', kind: 'sum', icon: 'star', targets: [2, 4, 6], xp: [50, 80, 120] },
  { id: 'big', kind: 'best', icon: 'expand', targets: [6, 9, 12], xp: [50, 80, 120] },
  { id: 'combo', kind: 'best', icon: 'flame', targets: [4, 6, 8], xp: [50, 80, 120] },
  { id: 'classic', kind: 'best', icon: 'play', targets: [3000, 8000, 15000], xp: [50, 80, 120] },
  { id: 'blitz', kind: 'best', icon: 'clock', targets: [2000, 4000, 7000], xp: [50, 80, 120] },
  { id: 'levels', kind: 'sum', icon: 'peak', targets: [1, 2, 3], xp: [50, 80, 120] },
  { id: 'daily', kind: 'sum', icon: 'calendar', targets: [1, 1, 1], xp: [60, 60, 60] },
  { id: 'games', kind: 'sum', icon: 'play', targets: [2, 3, 4], xp: [30, 50, 70] },
];
export const ALL_DONE_XP = 100;
const typeById = (id) => MISSION_TYPES.find((m) => m.id === id);

/** Les trois missions d'une date (déterministe). */
export function missionsFor(key) {
  const rng = createRng(hashString(`prisme-missions-${key}`));
  const pool = shuffle(rng, MISSION_TYPES.map((m) => m.id));
  // Pas deux missions de score le même jour.
  const picked = [];
  for (const id of pool) {
    if (picked.length === 3) break;
    if ((id === 'classic' || id === 'blitz') && picked.some((p) => p === 'classic' || p === 'blitz')) continue;
    picked.push(id);
  }
  return picked.map((id, tier) => {
    const m = typeById(id);
    return { type: id, target: m.targets[tier], xp: m.xp[tier], progress: 0, done: false };
  });
}

/** Met à jour (ou crée) les missions du jour dans le profil. */
export function ensureMissions(p, key) {
  if (!p.missions || p.missions.date !== key) p.missions = { date: key, list: missionsFor(key), bonus: false };
  return p.missions;
}

/** Ce qu'une partie terminée apporte à une mission. */
export function missionGain(type, s, info = {}) {
  const st = s.stats;
  switch (type) {
    case 'areas': return st.areas;
    case 'light': return st.light;
    case 'whites': return st.whites;
    case 'stars': return st.stars;
    case 'big': return st.maxArea;
    case 'combo': return st.maxCombo;
    case 'classic': return s.mode === 'classic' ? s.score : 0;
    case 'blitz': return s.mode === 'blitz' ? s.score : 0;
    case 'levels': return s.mode === 'adventure' && s.status === 'won' ? 1 : 0;
    case 'daily': return s.mode === 'daily' && info.firstDaily ? 1 : 0;
    case 'games': return 1;
    default: return 0;
  }
}

/**
 * Applique une partie terminée aux missions du jour. Ajoute l'XP gagnée au profil et
 * renvoie les missions accomplies par cette partie (et le bonus si les trois sont faites).
 */
export function applyMissions(p, s, key, info = {}) {
  const ms = ensureMissions(p, key);
  const done = [];
  for (const m of ms.list) {
    if (m.done) continue;
    const gain = missionGain(m.type, s, info);
    const kind = typeById(m.type).kind;
    m.progress = kind === 'sum' ? m.progress + gain : Math.max(m.progress, gain);
    if (m.progress >= m.target) {
      m.progress = m.target;
      m.done = true;
      p.xp += m.xp;
      p.stats.missions = (p.stats.missions || 0) + 1;
      done.push(m);
    }
  }
  let bonus = 0;
  if (!ms.bonus && ms.list.every((m) => m.done)) {
    ms.bonus = true;
    bonus = ALL_DONE_XP;
    p.xp += bonus;
    p.stats.missionDays = (p.stats.missionDays || 0) + 1;
  }
  return { done, bonus };
}

export const missionIcon = (type) => typeById(type)?.icon || 'star';
