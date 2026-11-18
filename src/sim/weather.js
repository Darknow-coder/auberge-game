import { SEASONS } from '../data/progression.js';
import { getRng } from './state.js';

/** Tire la météo d'une journée selon la saison. */
export function rollWeather(state, seasonIndex) {
  const rng = getRng(state);
  const probs = SEASONS[seasonIndex].weather;
  return rng.weighted(Object.entries(probs));
}
