// Défi du jour : même grille de départ et même suite de 30 pièces pour tout le monde.
// Les seuils des médailles sont calculés en faisant jouer le joueur automatique.
import { createRng, randInt, hashString } from '../core/rng.js';
import { dealSet } from './generator.js';
import { boardFromRows } from './board.js';
import { newGame } from './engine.js';
import { autoplay } from './bot.js';

export const DAILY_PIECES = 30;
const DAILY_DIFFICULTY = 0.35;

const PATTERNS = [
  ['........', '........', '........', '...x....', '..x.x...', '........', '........', '........', '........'],
  ['........', '.x....x.', '........', '........', '...xx...', '........', '........', '.x....x.', '........'],
  ['........', '........', '..x..x..', '..x..x..', '..xxxx..', '........', '........', '........', '........'],
  ['........', '.xx..xx.', '........', '........', '........', '........', '........', '.xx..xx.', '........'],
  ['........', '........', '.x....x.', '..x..x..', '........', '..x..x..', '.x....x.', '........', '........'],
  ['........', '...x....', '...x....', '........', '.xx..xx.', '........', '....x...', '....x...', '........'],
  ['........', '........', '.x.x.x..', '........', '..x.x.x.', '........', '.x.x.x..', '........', '........'],
];

export function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function keyToDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Construit le défi d'une date. La suite de pièces est produite par le générateur adaptatif
 * pendant que le joueur automatique joue : on ne garde qu'une suite qu'il termine en entier,
 * ce qui évite les journées injouables. Le résultat ne dépend que de la date.
 */
export function dailySpec(key) {
  let last = null;
  for (let attempt = 0; attempt < 12; attempt++) {
    const rng = createRng(hashString(`prisme-daily-${key}-${attempt}`));
    const pat = PATTERNS[randInt(rng, PATTERNS.length)];
    const rows = pat.map((r) => [...r].map((ch) => (ch === 'x' ? 'rgb'[randInt(rng, 3)] : '.')).join(''));
    const sim = newGame({ mode: 'daily-sim', seed: rng.s });
    sim.board = boardFromRows(rows);
    sim.diff = DAILY_DIFFICULTY;
    sim.usePowers = false;
    sim.tray = dealSet(sim.board, sim.rng, { difficulty: DAILY_DIFFICULTY });
    const seq = sim.tray.map((p) => ({ ...p }));
    autoplay(sim, {
      maxMoves: DAILY_PIECES,
      usePowers: false,
      onEvents: (ev) => {
        if (seq.length < DAILY_PIECES && ev.some((e) => e.type === 'refill')) seq.push(...sim.tray.map((p) => ({ ...p })));
      },
    });
    last = { key, rows, seq: seq.slice(0, DAILY_PIECES), seed: hashString(`seed-${key}`) };
    if (sim.moves >= DAILY_PIECES && seq.length >= DAILY_PIECES) return last;
  }
  return last;
}

const round = (v, step) => Math.max(step, Math.round(v / step) * step);

/** Seuils bronze / argent / or à partir d'une partie du joueur automatique. */
export function dailyMedals(spec) {
  const s = autoplay(newGame({ mode: 'daily', daily: spec, seed: spec.seed }));
  const bot = s.score;
  return {
    bot,
    botMoves: s.moves,
    bronze: round(bot * 0.45, 50),
    silver: round(bot * 0.8, 50),
    gold: round(bot * 1.1, 50),
  };
}

export function medalFor(score, m) {
  if (score >= m.gold) return 'gold';
  if (score >= m.silver) return 'silver';
  if (score >= m.bronze) return 'bronze';
  return null;
}
