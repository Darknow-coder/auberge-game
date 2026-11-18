// Simulation sans affichage : joue N jours avec un « joueur automatique » simple et affiche l'économie.
import { createNewGame } from '../src/sim/state.js';
import { update, bootstrapDay } from '../src/sim/sim.js';
import { clock } from '../src/sim/time.js';
import { actions } from '../src/sim/actions.js';

const days = +(process.argv[2] || 10);
const seed = +(process.argv[3] || 42);
const auto = process.argv.includes('--auto');
const s = createNewGame({ seed });
bootstrapDay(s);
let lastDay = 1;
const t0 = Date.now();
while (clock(s.time).day <= days) {
  update(s, 10);
  while (s.dialogs.length) actions.resolveDialog(s, 0);
  for (const n of s.rt.notifications) if (process.argv.includes('-v')) console.log(`[${clock(n.t).day} ${clock(n.t).hour}h] ${n.kind}: ${n.text}`);
  s.rt.notifications.length = 0;
  const d = clock(s.time).day;
  if (d !== lastDay) {
    const r = s.lastDayReport;
    console.log(`J${r.day} net ${Math.round(r.net)} (in ${Math.round(r.inc)} / out ${Math.round(r.exp)}) argent ${Math.round(s.money)} rep ${s.reputation.value.toFixed(1)} arrivées ${r.arrivals} refus ${JSON.stringify(r.refused)} avis ${r.reviews} (${r.avgStars.toFixed(1)}★) clients ${s.guests.length} stock ${JSON.stringify(s.stock)}`);
    lastDay = d;
    if (auto && typeof globalThis.autoPlay === 'function') globalThis.autoPlay(s);
  }
}
console.log('stats', JSON.stringify(s.stats), 'temps', Date.now() - t0, 'ms');
