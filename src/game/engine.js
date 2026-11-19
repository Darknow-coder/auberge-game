// Règles du jeu, sans DOM. Toutes les actions renvoient une liste d'événements
// ({ type, ... }) que l'interface traduit en animations, sons et messages.
// L'état est un objet JSON pur : il se sauvegarde et se recharge tel quel.
import { createRng, pickIndexWeighted, randomSeed } from '../core/rng.js';
import { SHAPES, rotateKey } from './pieces.js';
import * as B from './board.js';
import { dealSet } from './generator.js';

export const SCORE = { cell: 1, line: 80, pure: 160, boardClear: 500, bombCell: 5 };
/** Le combo continue tant qu'on complète une ligne au moins toutes les 3 pièces. */
export const COMBO_GRACE = 3;
export const POWER_KINDS = ['rotate', 'bomb', 'reroll'];
const POWER_WEIGHTS = [3, 2, 3];
const POWER_CAP = 5;

export const comboMult = (combo) => (combo <= 1 ? 1 : Math.min(5, 1 + 0.5 * (combo - 1)));
export const clearPoints = (lines, pures) => (SCORE.line * lines * (lines + 1)) / 2 + SCORE.pure * pures;
export const gaugeMax = (earned) => 100 + 40 * earned;

/** Partie d'initiation : la première pièce complète une ligne d'une seule couleur. */
export const TUTORIAL = {
  rows: ['........', '........', '........', '........', '........', '........', '........', '222222..'],
  tray: [{ k: 'duo:0', col: 2, gem: -1 }, { k: 'corner3:0', col: 4, gem: -1 }, { k: 'line3:1', col: 3, gem: -1 }],
  target: { ti: 0, x: 6, y: 7 },
};

export function newGame(opt = {}) {
  const seed = opt.seed ?? randomSeed();
  const s = {
    v: 1,
    mode: opt.mode || 'classic',
    seed,
    rng: createRng(seed),
    level: opt.level ? opt.level.n : null,
    date: opt.daily ? opt.daily.key : null,
    board: B.createBoard(),
    tray: [null, null, null],
    score: 0,
    combo: 0,
    sinceClear: 0,
    powers: { rotate: 1, bomb: 1, reroll: 1 },
    gauge: 0,
    earned: 0,
    usePowers: true,
    moves: 0,
    movesMax: null,
    seq: null,
    seqIdx: 0,
    goals: null,
    gemRate: 0,
    diff: null,
    stats: { lines: 0, pure: 0, maxCombo: 0, maxLines: 0, clears: 0, boardClears: 0, powersUsed: 0, rescues: 0, gems: 0, stones: 0, placed: 0 },
    status: 'play',
    end: null,
    best: opt.best || 0,
    recordShown: false,
    sets: 0,
    tutorial: !!opt.tutorial,
  };
  if (opt.level) {
    const L = opt.level;
    s.board = B.boardFromRows(L.rows);
    s.movesMax = L.moves;
    s.gemRate = L.gemRate || 0;
    s.diff = L.diff ?? 0.3;
    s.powers = { rotate: 1, bomb: 1, reroll: 1, ...(L.powers || {}) };
    const stones = s.board.c.filter((v) => v === B.STONE).length;
    s.goals = L.goals.map((g) => ({ type: g.type, target: g.type === 'stones' ? (g.target ?? stones) : g.target }));
  } else if (opt.daily) {
    s.board = B.boardFromRows(opt.daily.rows);
    s.seq = opt.daily.seq.map((p) => ({ ...p }));
    s.movesMax = s.seq.length;
    s.usePowers = false;
    s.powers = { rotate: 0, bomb: 0, reroll: 0 };
  } else if (s.tutorial) {
    s.board = B.boardFromRows(TUTORIAL.rows);
  }
  const ev = [];
  if (s.tutorial) { s.tray = TUTORIAL.tray.map((p) => ({ ...p })); s.sets = 1; }
  else refill(s, ev);
  return s;
}

/** Difficulté des pièces : monte avec le nombre de lots distribués (mode classique). */
export function difficultyOf(s) {
  if (s.diff != null) return s.diff;
  return Math.min(1, s.sets / 45);
}

/** Coup de pouce sur les couleurs : plus fort quand un niveau demande des lignes prisme. */
export function colorBiasOf(s) {
  return s.goals && s.goals.some((g) => g.type === 'pure') ? 0.5 : 0.2;
}

/** Pression : chance qu'un lot soit choisi pour être contraignant. */
export function pressureOf(s) {
  if (s.mode !== 'classic' || s.tutorial && s.sets < 4) return 0;
  return Math.max(0, Math.min(0.75, (s.sets - 25) / 120));
}

function refill(s, ev) {
  if (s.seq) {
    for (let i = 0; i < 3; i++) s.tray[i] = s.seqIdx < s.seq.length ? { ...s.seq[s.seqIdx++] } : null;
  } else {
    const set = dealSet(s.board.c, s.rng, { difficulty: difficultyOf(s), pressure: pressureOf(s), combo: s.combo, gemRate: s.gemRate, colorBias: colorBiasOf(s) });
    const left = s.movesMax != null ? s.movesMax - s.moves : 3;
    s.tray = set.map((p, i) => (i < left ? p : null));
  }
  s.sets++;
  ev.push({ type: 'refill' });
}

export function goalProgress(s, g) {
  switch (g.type) {
    case 'score': return s.score;
    case 'lines': return s.stats.lines;
    case 'gems': return s.stats.gems;
    case 'stones': return s.stats.stones;
    case 'pure': return s.stats.pure;
    default: return 0;
  }
}

const fail = (reason) => ({ ok: false, reason, events: [] });

function addGauge(s, amount, ev) {
  if (!s.usePowers || amount <= 0) return;
  s.gauge += amount;
  while (s.gauge >= gaugeMax(s.earned)) {
    s.gauge -= gaugeMax(s.earned);
    s.earned++;
    const weights = POWER_KINDS.map((k, i) => (s.powers[k] >= POWER_CAP ? 0 : POWER_WEIGHTS[i]));
    if (weights.every((w) => !w)) continue;
    const kind = POWER_KINDS[pickIndexWeighted(s.rng, weights)];
    s.powers[kind]++;
    ev.push({ type: 'power', kind });
  }
}

function collect(s, cleared) {
  let gems = 0, stones = 0;
  for (const c of cleared) {
    if (c.g) gems++;
    if (c.c === B.STONE) stones++;
  }
  s.stats.gems += gems;
  s.stats.stones += stones;
  return { gems, stones };
}

export function place(s, ti, x, y) {
  if (s.status !== 'play') return fail('status');
  const p = s.tray[ti];
  if (!p) return fail('empty');
  const sh = SHAPES[p.k];
  if (!B.canPlace(s.board.c, sh, x, y)) return fail('blocked');
  const ev = [];
  const cells = B.placeShape(s.board, sh, x, y, p.col, p.gem);
  s.tray[ti] = null;
  s.moves++;
  s.stats.placed++;
  let pts = sh.n * SCORE.cell;
  ev.push({ type: 'place', ti, x, y, k: p.k, col: p.col, cells, points: pts });

  const { rows, cols } = B.fullLines(s.board.c);
  const lines = rows.length + cols.length;
  if (lines) {
    const pureRows = rows.filter((r) => B.linePure(s.board.c, true, r));
    const pureCols = cols.filter((c) => B.linePure(s.board.c, false, c));
    const pures = pureRows.length + pureCols.length;
    s.combo++;
    s.sinceClear = 0;
    const mult = comboMult(s.combo);
    const cp = Math.round(clearPoints(lines, pures) * mult);
    const cleared = B.clearLines(s.board, rows, cols);
    const got = collect(s, cleared);
    const st = s.stats;
    st.lines += lines;
    st.pure += pures;
    st.clears++;
    st.maxCombo = Math.max(st.maxCombo, s.combo);
    st.maxLines = Math.max(st.maxLines, lines);
    pts += cp;
    ev.push({ type: 'clear', rows, cols, pureRows, pureCols, cleared, lines, pures, combo: s.combo, mult, points: cp, gems: got.gems, stones: got.stones, ox: x + sh.w / 2, oy: y + sh.h / 2, col: p.col });
    let gauge = 10 * lines + 20 * pures + 2 * Math.min(s.combo - 1, 5);
    if (B.isEmpty(s.board.c)) {
      const bonus = Math.round(SCORE.boardClear * mult);
      pts += bonus;
      st.boardClears++;
      gauge += 40;
      ev.push({ type: 'boardClear', points: bonus });
    }
    addGauge(s, gauge, ev);
  } else {
    s.sinceClear++;
    if (s.sinceClear >= COMBO_GRACE && s.combo > 0) {
      ev.push({ type: 'comboEnd', combo: s.combo });
      s.combo = 0;
    }
  }
  s.score += pts;
  ev.push({ type: 'score', points: pts, total: s.score });
  if (s.best > 0 && !s.recordShown && s.score > s.best && s.mode === 'classic') {
    s.recordShown = true;
    ev.push({ type: 'record', previous: s.best });
  }
  if (!s.tray.some(Boolean) && !goalsDone(s) && (s.movesMax == null || s.moves < s.movesMax)) refill(s, ev);
  checkEnd(s, ev);
  return { ok: true, events: ev };
}

function goalsDone(s) {
  return !!s.goals && s.goals.every((g) => goalProgress(s, g) >= g.target);
}

function rotatedFits(s, p) {
  let k = p.k;
  for (let r = 0; r < Math.min(3, s.powers.rotate); r++) {
    k = rotateKey(k);
    if (k === p.k) return false;
    if (B.fits(s.board.c, SHAPES[k])) return true;
  }
  return false;
}

export function canRescue(s) {
  if (!s.usePowers) return false;
  if (s.powers.bomb > 0 || s.powers.reroll > 0) return true;
  return s.powers.rotate > 0 && s.tray.some((p) => p && rotatedFits(s, p));
}

/** Pour chaque pièce du plateau : peut-elle être posée quelque part ? */
export function trayFits(s) {
  return s.tray.map((p) => !!p && B.fits(s.board.c, SHAPES[p.k]));
}

function checkEnd(s, ev) {
  if (s.status !== 'play') return;
  if (goalsDone(s)) {
    s.status = 'won';
    s.end = 'goals';
    ev.push({ type: 'end', status: 'won', reason: 'goals' });
    return;
  }
  if (s.movesMax != null && s.moves >= s.movesMax) {
    s.status = s.mode === 'daily' ? 'over' : 'lost';
    s.end = s.mode === 'daily' ? 'done' : 'moves';
    ev.push({ type: 'end', status: s.status, reason: s.end });
    return;
  }
  if (trayFits(s).some(Boolean)) return;
  if (canRescue(s)) {
    s.status = 'stuck';
    ev.push({ type: 'stuck' });
    return;
  }
  s.status = s.mode === 'adventure' ? 'lost' : 'over';
  s.end = 'noSpace';
  ev.push({ type: 'end', status: s.status, reason: 'noSpace' });
}

function rotateGem(oldKey, newKey, gem) {
  if (gem < 0) return -1;
  const rot = SHAPES[oldKey].cells.map(([x, y]) => [-y, x]);
  const minX = Math.min(...rot.map((c) => c[0]));
  const minY = Math.min(...rot.map((c) => c[1]));
  const gx = rot[gem][0] - minX, gy = rot[gem][1] - minY;
  return SHAPES[newKey].cells.findIndex(([x, y]) => x === gx && y === gy);
}

/** Cases touchées par une bombe centrée en (x, y) : carré 3×3 rogné aux bords. */
export function bombArea(x, y) {
  const out = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const cx = x + dx, cy = y + dy;
      if (cx >= 0 && cy >= 0 && cx < B.N && cy < B.N) out.push(B.idx(cx, cy));
    }
  return out;
}

export function usePower(s, kind, arg = {}) {
  if (s.status !== 'play' && s.status !== 'stuck') return fail('status');
  if (!s.usePowers || !(s.powers[kind] > 0)) return fail('none');
  const wasStuck = s.status === 'stuck';
  const ev = [];
  if (kind === 'rotate') {
    const p = s.tray[arg.ti];
    if (!p) return fail('empty');
    const nk = rotateKey(p.k);
    if (nk === p.k) return fail('symmetric');
    p.gem = rotateGem(p.k, nk, p.gem);
    p.k = nk;
    ev.push({ type: 'rotate', ti: arg.ti, k: nk });
  } else if (kind === 'bomb') {
    const area = bombArea(arg.x, arg.y).filter((i) => s.board.c[i]);
    if (!area.length) return fail('nothing');
    const cleared = area.map((i) => ({ i, c: s.board.c[i], g: s.board.g[i] }));
    for (const i of area) { s.board.c[i] = 0; s.board.g[i] = 0; }
    const got = collect(s, cleared);
    const pts = SCORE.bombCell * area.length;
    s.score += pts;
    ev.push({ type: 'bomb', x: arg.x, y: arg.y, cleared, points: pts, gems: got.gems, stones: got.stones });
    ev.push({ type: 'score', points: pts, total: s.score });
  } else if (kind === 'reroll') {
    const set = dealSet(s.board.c, s.rng, { mercy: true, gemRate: s.gemRate, colorBias: colorBiasOf(s) });
    s.tray = s.tray.map((p, i) => (p ? set[i] : null));
    ev.push({ type: 'reroll' });
  } else return fail('kind');
  s.powers[kind]--;
  s.stats.powersUsed++;
  if (wasStuck) s.status = 'play';
  checkEnd(s, ev);
  if (wasStuck && s.status === 'play') {
    s.stats.rescues++;
    ev.push({ type: 'rescued' });
  }
  return { ok: true, events: ev };
}

/** Abandon (depuis l'écran « Plus de place »). */
export function giveUp(s) {
  if (s.status !== 'play' && s.status !== 'stuck') return fail('status');
  s.status = s.mode === 'adventure' ? 'lost' : 'over';
  s.end = 'noSpace';
  return { ok: true, events: [{ type: 'end', status: s.status, reason: 'noSpace' }] };
}

/** Étoiles d'un niveau gagné selon les coups restants. */
export function starsFor(s) {
  if (s.status !== 'won') return 0;
  const left = (s.movesMax - s.moves) / s.movesMax;
  return left >= 0.35 ? 3 : left >= 0.15 ? 2 : 1;
}
