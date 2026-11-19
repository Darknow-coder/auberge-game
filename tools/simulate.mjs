// Simulation d'équilibrage avec le joueur automatique.
//   node tools/simulate.mjs classic 40        -> 40 parties classiques
//   node tools/simulate.mjs levels 8          -> chaque niveau 8 fois (taux de victoire)
//   node tools/simulate.mjs daily 14          -> 14 défis du jour consécutifs
import { newGame, starsFor } from '../src/game/engine.js';
import { autoplay } from '../src/game/bot.js';
import { LEVELS, WORLDS } from '../src/game/levels.js';
import { dailySpec, dailyMedals } from '../src/game/daily.js';

const [mode = 'classic', countArg = '30', fromArg, toArg] = process.argv.slice(2);
const count = +countArg;
const pct = (a, q) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };

if (mode === 'classic') {
  const scores = [], moves = [], lines = [], pure = [], powers = [], combos = [];
  const t0 = performance.now();
  for (let i = 0; i < count; i++) {
    const s = autoplay(newGame({ mode: 'classic', seed: 1000 + i }), { maxMoves: 3000 });
    scores.push(s.score); moves.push(s.moves); lines.push(s.stats.lines); pure.push(s.stats.pure); powers.push(s.stats.powersUsed); combos.push(s.stats.maxCombo);
  }
  const ms = performance.now() - t0;
  const row = (n, a) => console.log(`${n.padEnd(10)} médiane ${pct(a, 0.5)}  p10 ${pct(a, 0.1)}  p90 ${pct(a, 0.9)}  max ${Math.max(...a)}`);
  console.log(`${count} parties classiques en ${(ms / 1000).toFixed(1)} s`);
  row('score', scores); row('pièces', moves); row('lignes', lines); row('prismes', pure); row('pouvoirs', powers); row('combo max', combos);
} else if (mode === 'levels') {
  const from = +(fromArg || 1), to = +(toArg || LEVELS.length);
  for (let n = from; n <= to; n++) {
    const L = LEVELS[n - 1];
    let wins = 0, stars = 0, used = 0;
    for (let i = 0; i < count; i++) {
      const s = autoplay(newGame({ mode: 'adventure', level: L, seed: 77 + i * 13 }));
      if (s.status === 'won') { wins++; stars += starsFor(s); used += s.moves; }
    }
    const w = WORLDS.find((x) => n >= x.from && n <= x.to);
    const goals = L.goals.map((g) => `${g.type}${g.target ?? ''}`).join('+');
    console.log(`${String(n).padStart(2)} [${w.id}] ${goals.padEnd(18)} coups ${String(L.moves).padStart(2)}  victoire ${String(Math.round((wins / count) * 100)).padStart(3)}%  étoiles moy ${(wins ? stars / wins : 0).toFixed(1)}  coups utilisés ${wins ? Math.round(used / wins) : '-'}`);
  }
} else if (mode === 'daily') {
  const start = new Date(2026, 10, 1);
  for (let i = 0; i < count; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const spec = dailySpec(key);
    const m = dailyMedals(spec);
    console.log(`${key}  bronze ${m.bronze}  argent ${m.silver}  or ${m.gold}  (bot ${m.bot}, ${m.botMoves}/${spec.seq.length} pièces)`);
  }
}
