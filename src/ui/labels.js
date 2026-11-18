// Textes d'interface dérivés de l'état.
import { ARCHETYPES, TRAITS } from '../data/guests.js';
import { USE_KINDS } from '../data/furniture.js';
import { WEATHER } from '../data/progression.js';

export const WEATHER_ICON = { soleil: 'sun', nuages: 'cloud', pluie: 'rain', orage: 'storm', brouillard: 'fog', neige: 'snow', tempete: 'snow' };
export const weatherName = (w) => (WEATHER[w] ? WEATHER[w].name : w);

export function guestTypeLabel(g) {
  const a = ARCHETYPES[g.type];
  return g.size === 1 && g.fem ? a.fem : a.name;
}

export function moodOf(s) {
  if (s >= 85) return { e: '😍', t: 'Enchanté' };
  if (s >= 68) return { e: '😊', t: 'Satisfait' };
  if (s >= 48) return { e: '🙂', t: 'Correct' };
  if (s >= 28) return { e: '😕', t: 'Déçu' };
  return { e: '😠', t: 'Furieux' };
}

export function activityLabel(state, g) {
  const a = g.act;
  if (g.state === 'leave' || (a && a.kind === 'leave')) return 'Quitte l\'auberge';
  if (!a) return 'Réfléchit à ce qu\'il va faire';
  switch (a.kind) {
    case 'queue': return a.mode === 'in' ? (g.path ? 'Arrive à l\'auberge' : 'Attend à la réception') : 'Règle la note';
    case 'rest': return a.phase === 'walk' ? 'Monte dans sa chambre' : 'Se repose dans sa chambre';
    case 'sleep': return a.phase === 'walk' ? 'Va se coucher' : 'Dort';
    case 'dine': return a.phase === 'walk' ? 'Va au restaurant' : a.phase === 'wait' ? 'Attend son plat' : (a.breakfast ? 'Prend son petit-déjeuner' : 'Déguste son repas');
    case 'bar': return a.phase === 'walk' ? 'Va au bar' : a.phase === 'wait' ? 'Attend sa boisson' : 'Prend un verre';
    case 'hike': return a.phase === 'away' ? 'En randonnée' : 'Part en randonnée';
    case 'outing': return a.phase === 'away' ? 'Mange au village' : 'Descend au village';
    case 'wander': return 'Se promène';
    case 'excursion': return a.phase === 'out' || a.phase === 'follow' ? 'En excursion guidée' : a.phase === 'ready' ? 'Attend le guide' : 'Réserve une excursion';
    case 'use': return a.phase === 'walk' ? 'Se déplace' : (USE_KINDS[a.use]?.label || 'Profite de l\'auberge');
    default: return 'Flâne';
  }
}

export function traitChips(g) { return g.traits.map((t) => TRAITS[t]).filter(Boolean); }

export const NEED_LABELS = { energy: 'Énergie', hunger: 'Appétit', fun: 'Détente' };
