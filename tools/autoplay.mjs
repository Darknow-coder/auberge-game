// « Joueur automatique » simple pour équilibrer l'économie et tester de longues parties.
import { actions } from '../src/sim/actions.js';
import { suggestRotation } from '../src/sim/world.js';
import { objectiveList, tierRequirements } from '../src/sim/progression.js';
import { TIERS } from '../src/data/progression.js';
import { clock } from '../src/sim/time.js';

const PLAN = [
  { need: 1900, steps: [['room', 'kitchen', 12, 13, 14, 15], ['room', 'restaurant', 15, 13, 18, 15], ['f', 'stove', 12, 13, 0], ['f', 'table_small', 17, 14, 0], ['chair', 16, 14], ['chair', 18, 14], ['hire', 'cook']] },
  { need: 700, steps: [['room', 'bedroom', 20, 22, 22, 23], ['f', 'bed_double', 21, 22, 0], ['f', 'plant', 20, 22, 0]] },
  { need: 500, steps: [['hire', 'waiter'], ['f', 'table_long', 15, 13, 0], ['f', 'pantry', 14, 13, 0]] },
  { need: 900, steps: [['room', 'corridor', 19, 24, 23, 24], ['room', 'corridor', 23, 16, 23, 23], ['room', 'bedroom', 24, 16, 26, 17], ['f', 'bunk_bed', 25, 16, 0], ['f', 'bed_single', 26, 16, 0]] },
  { need: 700, steps: [['room', 'bedroom', 24, 18, 26, 19], ['f', 'bed_double', 25, 18, 0]] },
  { need: 400, steps: [['hire', 'receptionist'], ['f', 'rug', 15, 17, 0], ['f', 'nightstand', 20, 23, 0]] },
  { need: 700, steps: [['room', 'bedroom', 24, 20, 26, 21], ['f', 'bed_double', 25, 20, 0]] },
  { need: 500, steps: [['hire', 'cleaner'], ['f', 'flower_bed', 22, 26, 0], ['f', 'flower_bed', 22, 27, 0], ['f', 'hedge', 23, 26, 0], ['f', 'lantern', 23, 27, 0]] },
  { need: 700, steps: [['room', 'bedroom', 24, 22, 26, 23], ['f', 'bunk_bed', 25, 22, 0], ['f', 'bunk_bed', 26, 22, 0]] },
];

export function makeAutoPlayer() {
  let stage = 0;
  const log = [];
  return {
    log,
    daily(s) {
      // Objectifs et paliers
      for (const o of objectiveList(s)) if (o.done && !o.claimed) actions.claimObjective(s, o.id);
      const next = TIERS[s.tier + 1];
      if (next && tierRequirements(s).every((r) => r.ok) && s.money > next.cost + 800) { actions.upgradeTier(s); log.push(`J${clock(s.time).day} palier ${s.tier}`); }
      s.autoRestockOn = true;
      while (stage < PLAN.length && s.money > PLAN[stage].need + 400) {
        for (const st of PLAN[stage].steps) {
          let r;
          if (st[0] === 'room') r = actions.buildRoom(s, st[1], st[2], st[3], st[4], st[5]);
          else if (st[0] === 'f') r = actions.placeFurniture(s, st[1], st[2], st[3], st[4]);
          else if (st[0] === 'chair') r = actions.placeFurniture(s, 'chair', st[1], st[2], suggestRotation(s, 'chair', st[1], st[2]));
          else if (st[0] === 'hire') { const c = s.candidates.find((x) => x.role === st[1]) ; r = c ? actions.hire(s, c.cid, 'journee') : { ok: false, reason: 'pas de candidat' }; }
          if (!r.ok) log.push(`J${clock(s.time).day} échec ${st.join(' ')} : ${r.reason}`);
        }
        log.push(`J${clock(s.time).day} étape ${stage} (argent ${Math.round(s.money)})`);
        stage++;
      }
    },
  };
}
