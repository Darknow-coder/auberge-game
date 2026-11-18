import { MIN_PER_DAY, DAYS_PER_SEASON } from '../data/constants.js';
import { SEASONS } from '../data/progression.js';

/** Décompose un temps de jeu (minutes depuis le jour 1 à 0h). */
export function clock(t) {
  const day = Math.floor(t / MIN_PER_DAY) + 1;
  const m = t - (day - 1) * MIN_PER_DAY;
  const hour = Math.floor(m / 60);
  const minute = Math.floor(m % 60);
  const seasonIndex = Math.floor((day - 1) / DAYS_PER_SEASON) % 4;
  const year = Math.floor((day - 1) / (DAYS_PER_SEASON * 4)) + 1;
  const dayOfSeason = ((day - 1) % DAYS_PER_SEASON) + 1;
  return { day, hour, minute, hf: m / 60, seasonIndex, season: SEASONS[seasonIndex], year, dayOfSeason };
}

export const seasonOf = (t) => clock(t).seasonIndex;
export const hourOf = (t) => (t % MIN_PER_DAY) / 60;
export const dayOf = (t) => Math.floor(t / MIN_PER_DAY) + 1;

export function formatTime(t) {
  const c = clock(t);
  return `${String(c.hour).padStart(2, '0')}:${String(Math.floor(c.minute / 10) * 10).padStart(2, '0')}`;
}
export function formatDate(t) {
  const c = clock(t);
  return `Jour ${c.dayOfSeason} · ${c.season.name} · An ${c.year}`;
}
