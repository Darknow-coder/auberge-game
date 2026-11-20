// Simulation d'équilibrage avec le joueur automatique.
//   node tools/simulate.mjs classic 40        -> 40 parties classiques
//   node tools/simulate.mjs levels 8          -> chaque niveau 8 fois (taux de victoire)
//   node tools/simulate.mjs levels 8 21 30    -> niveaux 21 à 30 seulement
//   node tools/simulate.mjs daily 14          -> 14 défis du jour consécutifs
import { newGame, starsFor } from '../src/game/engine.js';
import { autoplay } from '../src/game/bot.js';
import { LEVELS, WORLDS } from '../src/game/levels.js';
import { dailySpec, dailyMedals, dateKey } from '../src/game/daily.js';

const [mode = 'classic', countArg = '30', fromArg, toArg] = process.argv.slice(2);
const count = +countArg;
const pct = (a, q) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };

if (mode === 'classic') {
  const m = { score: [], pièces: [], enclos: [], lumière: [], 'aire max': [], blancs: [], 'combo max': [], étoiles: [], pouvoirs: [] };
  const t0 = performance.now();
  for (let i = 0; i < count; i++) {
    const s = autoplay(newGame({ mode: 'classic', seed: 1000 + i }), { maxMoves: 4000 });
    const st = s.stats;
    m.score.push(s.score); m.pièces.push(s.moves); m.enclos.push(st.areas); m.lumière.push(st.light); m['aire max'].push(st.maxArea);
    m.blancs.push(st.whites); m['combo max'].push(st.maxCombo); m.étoiles.push(st.stars); m.pouvoirs.push(st.powersUsed);
  }
  console.log(`${count} parties classiques en ${((performance.now() - t0) / 1000).toFixed(1)} s`);
  for (const [k, a] of Object.entries(m)) console.log(`${k.padEnd(10)} médiane ${pct(a, 0.5)}  p10 ${pct(a, 0.1)}  p90 ${pct(a, 0.9)}  max ${Math.max(...a)}`);
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
    console.log(`${String(n).padStart(2)} [${w.id}] ${goals.padEnd(22)} pièces ${String(L.moves).padStart(2)}  victoire ${String(Math.round((wins / count) * 100)).padStart(3)}%  étoiles moy ${(wins ? stars / wins : 0).toFixed(1)}  pièces utilisées ${wins ? Math.round(used / wins) : '-'}`);
  }
} else if (mode === 'daily') {
  const start = new Date(2026, 10, 1);
  for (let i = 0; i < count; i++) {
    const key = dateKey(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
    const spec = dailySpec(key);
    const m = dailyMedals(spec);
    console.log(`${key}  bronze ${m.bronze}  argent ${m.silver}  or ${m.gold}  (IA ${m.bot}, ${m.botMoves}/${spec.seq.length} pièces)`);
  }
}
