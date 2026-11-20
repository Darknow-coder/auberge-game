// Règles du jeu, sans DOM. Toutes les actions renvoient une liste d'événements
// ({ type, ... }) que l'interface traduit en animations, sons et messages.
// L'état est un objet JSON pur : il se sauvegarde et se recharge tel quel.
//
// Principe : on pose des pièces de lumière. Quand des cases vides se retrouvent encerclées
// (plus aucun passage vers le bord), la zone s'illumine et les pièces qui l'entourent
// disparaissent. Plus la zone est grande, plus elle rapporte. Si l'enceinte mélange
// rouge, vert et bleu, la lumière est blanche : points doublés.
//
// Modes : classic (sans fin), adventure (niveaux à objectifs), daily (30 pièces communes),
// blitz (contre la montre, chaque enclos rajoute du temps), zen (jamais de fin de partie).
import { createRng, next, randInt, pickIndexWeighted, randomSeed } from '../core/rng.js';
import { SHAPES, rotateKey } from './pieces.js';
import * as B from './board.js';
import { dealSet } from './generator.js';

export const SCORE = { cell: 1, ring: 5, boardClear: 500, bombCell: 5, object: 30 };
/** Le combo continue tant qu'on ferme un enclos au moins toutes les 2 pièces. */
export const COMBO_GRACE = 2;
export const POWER_KINDS = ['rotate', 'bomb', 'reroll'];
const POWER_WEIGHTS = [3, 2, 3];
const POWER_CAP = 5;
export const STAR_LIFE = 9;
/** Blitz : temps de départ et plafond (secondes). */
export const BLITZ = { start: 90, max: 150 };

export const comboMult = (combo) => (combo <= 1 ? 1 : Math.min(5, 1 + 0.5 * (combo - 1)));
/** Points d'une zone : ils croissent bien plus vite que sa taille (1 → 20, 4 → 200, 9 → 900). */
export const areaPoints = (a) => (20 * a * (a + 1)) / 2;
/** Multiplicateur de lumière : 1 couleur ×1, 2 couleurs ×1,5, les 3 (blanc) ×2. */
export const mixMult = (mix) => [1, 1, 1.5, 2][B.bits(mix)];
export const multiMult = (n) => 1 + 0.5 * (n - 1);
export const gaugeMax = (earned) => 100 + 40 * earned;
/** Blitz : part des bonus de temps conservée selon le nombre de pièces déjà posées. */
export const blitzDecay = (moves) => Math.max(0.2, 1 - moves / 120);
/** Secondes gagnées en Blitz pour un enclos (avant décroissance). */
export const timeBonus = (area, white, star) => 1 + Math.floor(area / 3) + (white ? 2 : 0) + (star ? 3 : 0);

/**
 * Initiation guidée en trois étapes. Chaque étape propose une seule pièce ; si elle ne ferme
 * pas l'enclos, l'étape recommence. Ensuite la partie continue normalement.
 */
export const TUTORIAL = [
  { // 1. Fermer un enclos (et découvrir la lumière blanche)
    rows: ['........', '........', '..rrrr..', '..g..b..', '..g..b..', '........', '........', '........', '........'],
    tray: [{ k: 'duo:0', col: B.R }], target: { ti: 0, x: 3, y: 5 }, text: 'tuto.step1',
  },
  { // 2. Plus la zone est grande, plus elle rapporte
    rows: ['........', '........', '........', '.g...g..', '.g...g..', '.g...g..', '.ggggg..', '........', '........'],
    tray: [{ k: 'line3:0', col: B.B }], target: { ti: 0, x: 2, y: 2 }, text: 'tuto.step2',
  },
  { // 3. Le bord ne compte pas : il faut fermer avec une pièce
    rows: ['........', '........', 'rrrr....', '...r....', '...r....', 'rrrr....', '........', '........', '........'],
    tray: [{ k: 'duo:1', col: B.G }], target: { ti: 0, x: 0, y: 3 }, text: 'tuto.step3',
  },
];

export function newGame(opt = {}) {
  const seed = opt.seed ?? randomSeed();
  const mode = opt.mode || 'classic';
  const s = {
    v: 3,
    mode,
    seed,
    rng: createRng(seed),
    level: opt.level ? opt.level.n : null,
    date: opt.daily ? opt.daily.key : null,
    board: B.createBoard(),
    tray: [null, null, null],
    score: 0,
    combo: 0,
    sinceEnclose: 0,
    powers: { rotate: 1, bomb: 1, reroll: 1 },
    gauge: 0,
    earned: 0,
    usePowers: mode === 'classic' || mode === 'adventure',
    moves: 0,
    movesMax: null,
    seq: null,
    seqIdx: 0,
    goals: null,
    diff: null,
    star: null,
    starCd: 4,
    fogEvery: 0,
    fogTick: 0,
    time: mode === 'blitz' ? BLITZ.start : null,
    stats: { areas: 0, light: 0, whites: 0, maxArea: 0, multi: 0, maxCombo: 0, boardClears: 0, powersUsed: 0, rescues: 0, gems: 0, stones: 0, stars: 0, fog: 0, crystals: 0, placed: 0, reliefs: 0, timeGained: 0 },
    status: 'play',
    end: null,
    best: opt.best || 0,
    recordShown: false,
    sets: 0,
    tutorial: opt.tutorial ? 0 : null,
  };
  if (!s.usePowers) s.powers = { rotate: 0, bomb: 0, reroll: 0 };
  if (mode === 'zen') s.diff = 0.15;
  if (opt.level) {
    const L = opt.level;
    s.board = B.boardFromRows(L.rows);
    s.movesMax = L.moves;
    s.diff = L.diff ?? 0.3;
    s.fogEvery = L.fogEvery || 0;
    s.powers = { rotate: 1, bomb: 1, reroll: 1, ...(L.powers || {}) };
    const stones = s.board.c.filter((v) => v === B.STONE).length;
    s.goals = L.goals.map((g) => ({ type: g.type, target: g.type === 'stones' ? (g.target ?? stones) : g.type === 'fog' ? B.countObjects(s.board.o, B.FOG) : g.target }));
  } else if (opt.daily) {
    s.board = B.boardFromRows(opt.daily.rows);
    s.seq = opt.daily.seq.map((p) => ({ ...p }));
    s.movesMax = s.seq.length;
  }
  const ev = [];
  if (s.tutorial != null) loadTutorialStep(s);
  else refill(s, ev);
  return s;
}

function loadTutorialStep(s) {
  const step = TUTORIAL[s.tutorial];
  s.board = B.boardFromRows(step.rows);
  s.tray = [{ ...step.tray[0] }, null, null];
}

/** Difficulté des pièces : monte avec le nombre de lots distribués. */
export function difficultyOf(s) {
  if (s.diff != null) return s.diff;
  if (s.mode === 'blitz') return Math.min(0.6, s.sets / 40);
  return Math.min(1, s.sets / 30);
}

/** Pression : chance qu'un lot soit choisi pour être contraignant (mode classique seulement). */
export function pressureOf(s) {
  if (s.mode !== 'classic') return 0;
  return Math.max(0, Math.min(0.85, (s.sets - 10) / 70));
}

function refill(s, ev) {
  if (s.seq) {
    for (let i = 0; i < 3; i++) s.tray[i] = s.seqIdx < s.seq.length ? { ...s.seq[s.seqIdx++] } : null;
  } else {
    const set = dealSet(s.board, s.rng, { difficulty: difficultyOf(s), pressure: pressureOf(s), combo: s.combo, guarantee: s.mode === 'zen' ? 1 : undefined });
    const left = s.movesMax != null ? s.movesMax - s.moves : 3;
    s.tray = set.map((p, i) => (i < left ? p : null));
  }
  s.sets++;
  ev.push({ type: 'refill' });
}

export function goalProgress(s, g) {
  const st = s.stats;
  switch (g.type) {
    case 'score': return s.score;
    case 'areas': return st.areas;
    case 'light': return st.light;
    case 'whites': return st.whites;
    case 'big': return st.maxArea;
    case 'gems': return st.gems;
    case 'stones': return st.stones;
    case 'crystals': return st.crystals;
    case 'fog': return st.fog;
    default: return 0;
  }
}

/**
 * État d'un objectif pour l'affichage. La brume se compte à rebours (cases restantes),
 * car elle peut se propager : l'objectif est atteint quand il n'en reste plus.
 */
export function goalState(s, g) {
  if (g.type === 'fog') {
    const left = B.countObjects(s.board.o, B.FOG);
    return { done: left === 0, value: left, target: 0, countdown: true };
  }
  const v = goalProgress(s, g);
  return { done: v >= g.target, value: Math.min(v, g.target), target: g.target, countdown: false };
}

function goalsDone(s) {
  return !!s.goals && s.goals.every((g) => goalState(s, g).done);
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

const hasStars = (s) => s.mode === 'classic' || s.mode === 'blitz' || s.mode === 'zen';

/** Étoile filante : apparaît sur une case vide intérieure, s'éteint après quelques coups. */
function tickStar(s, ev) {
  if (!hasStars(s)) return;
  if (s.star) {
    s.star.life--;
    if (s.star.life <= 0) {
      s.board.o[s.star.i] = 0;
      ev.push({ type: 'starGone', i: s.star.i });
      s.star = null;
      s.starCd = 3;
    }
    return;
  }
  if (s.starCd > 0) { s.starCd--; return; }
  if (next(s.rng) >= (s.mode === 'blitz' ? 0.55 : 0.4)) return;
  const spots = [];
  for (let i = 0; i < B.CELLS; i++) if (!B.isEdge(i) && !s.board.c[i] && !s.board.o[i]) spots.push(i);
  if (!spots.length) return;
  const i = spots[randInt(s.rng, spots.length)];
  s.board.o[i] = B.STAR;
  s.star = { i, life: STAR_LIFE };
  ev.push({ type: 'starSpawn', i });
}

/** Brume (Aventure) : toutes les `fogEvery` pièces, elle gagne une case vide intérieure voisine. */
function spreadFog(s, ev) {
  if (!s.fogEvery) return;
  if (++s.fogTick < s.fogEvery) return;
  s.fogTick = 0;
  const cand = new Set();
  for (let i = 0; i < B.CELLS; i++) {
    if (s.board.o[i] !== B.FOG) continue;
    const x = i % B.COLS, y = (i / B.COLS) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= B.COLS || ny >= B.ROWS) continue;
      const j = ny * B.COLS + nx;
      if (!B.isEdge(j) && !s.board.c[j] && !s.board.o[j]) cand.add(j);
    }
  }
  if (!cand.size) return;
  const list = [...cand].sort((a, b) => a - b);
  const j = list[randInt(s.rng, list.length)];
  s.board.o[j] = B.FOG;
  ev.push({ type: 'fogSpread', i: j });
}

/** Résout les enclos après une pose ; renvoie les points gagnés. */
function enclose(s, ev, origin) {
  const res = B.resolve(s.board);
  if (!res.regions.length) return 0;
  const st = s.stats;
  s.combo++;
  s.sinceEnclose = 0;
  const mult = comboMult(s.combo);
  const multi = multiMult(res.regions.length);
  let pts = 0, gauge = 0, time = 0;
  const regions = res.regions.map((r) => {
    const area = r.cells.length;
    const white = r.mix === B.WHITE;
    const star = r.stars > 0;
    const objects = r.gems + r.fog + r.crystals;
    const base = (areaPoints(area) + SCORE.ring * r.ring.length + SCORE.object * objects) * mixMult(r.mix) * (star ? 2 : 1);
    pts += base;
    st.areas++;
    st.light += area;
    st.maxArea = Math.max(st.maxArea, area);
    if (white) st.whites++;
    st.gems += r.gems;
    st.stones += r.stones;
    st.fog += r.fog;
    st.crystals += r.crystals;
    if (star) st.stars++;
    gauge += 5 + area + (white ? 8 : 0) + (star ? 25 : 0);
    time += timeBonus(area, white, star);
    return { ...r, area, white, star, points: Math.round(base * multi * mult) };
  });
  pts = Math.round(pts * multi * mult);
  st.multi = Math.max(st.multi, regions.length);
  st.maxCombo = Math.max(st.maxCombo, s.combo);
  if (s.star && s.board.o[s.star.i] !== B.STAR) { s.star = null; s.starCd = 2; }
  ev.push({ type: 'enclose', regions, cleared: res.cleared, combo: s.combo, mult, multi, points: pts, ox: origin.x, oy: origin.y });
  gauge += 2 * Math.min(s.combo - 1, 5);
  if (s.mode === 'blitz') {
    time += regions.length - 1;
    // Les bonus de temps s'amenuisent au fil de la partie : elle finit toujours par s'arrêter.
    time = Math.round(time * blitzDecay(s.moves));
    const before = s.time;
    s.time = Math.min(BLITZ.max, s.time + time);
    const gained = Math.round(s.time - before);
    if (gained > 0) { st.timeGained += gained; ev.push({ type: 'timeBonus', seconds: gained }); }
  }
  if (B.isEmpty(s.board.c)) {
    const bonus = Math.round(SCORE.boardClear * mult);
    pts += bonus;
    st.boardClears++;
    gauge += 40;
    ev.push({ type: 'boardClear', points: bonus });
  }
  addGauge(s, gauge, ev);
  return pts;
}

export function place(s, ti, x, y) {
  if (s.status !== 'play') return fail('status');
  const p = s.tray[ti];
  if (!p) return fail('empty');
  const sh = SHAPES[p.k];
  if (!B.canPlace(s.board, sh, x, y)) return fail('blocked');
  const ev = [];
  const cells = B.placeShape(s.board, sh, x, y, p.col);
  s.tray[ti] = null;
  s.moves++;
  s.stats.placed++;
  let pts = sh.n * SCORE.cell;
  ev.push({ type: 'place', ti, x, y, k: p.k, col: p.col, cells, points: pts });
  const got = enclose(s, ev, { x: x + sh.w / 2, y: y + sh.h / 2 });
  if (got) pts += got;
  else {
    s.sinceEnclose++;
    if (s.sinceEnclose >= COMBO_GRACE && s.combo > 0) {
      ev.push({ type: 'comboEnd', combo: s.combo });
      s.combo = 0;
    }
  }
  s.score += pts;
  ev.push({ type: 'score', points: pts, total: s.score });
  if (s.tutorial != null) {
    tutorialNext(s, ev, got > 0);
    return { ok: true, events: ev };
  }
  if (s.best > 0 && !s.recordShown && s.score > s.best && (s.mode === 'classic' || s.mode === 'blitz' || s.mode === 'zen')) {
    s.recordShown = true;
    ev.push({ type: 'record', previous: s.best });
  }
  tickStar(s, ev);
  spreadFog(s, ev);
  if (!s.tray.some(Boolean) && !goalsDone(s) && (s.movesMax == null || s.moves < s.movesMax)) refill(s, ev);
  checkEnd(s, ev);
  return { ok: true, events: ev };
}

/** Initiation : étape suivante si l'enclos a été fermé, sinon on recommence l'étape. */
function tutorialNext(s, ev, enclosed) {
  if (!enclosed) {
    loadTutorialStep(s);
    ev.push({ type: 'tutorialRetry', step: s.tutorial });
    return;
  }
  if (s.tutorial + 1 < TUTORIAL.length) {
    s.tutorial++;
    loadTutorialStep(s);
    ev.push({ type: 'tutorialStep', step: s.tutorial });
    return;
  }
  s.tutorial = null;
  s.board = B.createBoard();
  s.combo = 0;
  s.sinceEnclose = 0;
  s.starCd = 4;
  ev.push({ type: 'tutorialDone' });
  refill(s, ev);
}

/** Passer l'initiation : la partie classique commence aussitôt. */
export function skipTutorial(s) {
  if (s.tutorial == null) return fail('none');
  const ev = [];
  s.tutorial = null;
  s.board = B.createBoard();
  s.combo = 0;
  ev.push({ type: 'tutorialDone', skipped: true });
  refill(s, ev);
  return { ok: true, events: ev };
}

function rotatedFits(s, p) {
  let k = p.k;
  for (let r = 0; r < Math.min(3, s.powers.rotate); r++) {
    k = rotateKey(k);
    if (k === p.k) return false;
    if (B.fits(s.board, SHAPES[k])) return true;
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
  return s.tray.map((p) => !!p && B.fits(s.board, SHAPES[p.k]));
}

/** Zone 3 × 3 la plus encombrée (centre). */
function busiestArea(s) {
  let best = null;
  for (let y = 0; y < B.ROWS; y++)
    for (let x = 0; x < B.COLS; x++) {
      const n = bombArea(x, y).filter((i) => s.board.c[i]).length;
      if (!best || n > best.n) best = { x, y, n };
    }
  return best;
}

/**
 * Zen et Blitz ne s'arrêtent jamais faute de place : on redonne des pièces faciles,
 * et si cela ne suffit pas, la zone la plus encombrée se dégage.
 */
function relieve(s, ev) {
  s.stats.reliefs++;
  const set = dealSet(s.board, s.rng, { mercy: true });
  s.tray = s.tray.map((p, i) => (p ? set[i] : null));
  if (!s.tray.some(Boolean)) s.tray = set;
  if (trayFits(s).some(Boolean)) { ev.push({ type: 'relief', kind: 'reroll' }); return; }
  const { x, y } = busiestArea(s);
  const area = bombArea(x, y).filter((i) => s.board.c[i]);
  const cleared = area.map((i) => ({ i, c: s.board.c[i] }));
  for (const i of area) s.board.c[i] = 0;
  s.tray = dealSet(s.board, s.rng, { mercy: true });
  ev.push({ type: 'relief', kind: 'clear', x, y, cleared });
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
  if (s.mode === 'zen' || s.mode === 'blitz') { relieve(s, ev); return; }
  if (canRescue(s)) {
    s.status = 'stuck';
    ev.push({ type: 'stuck' });
    return;
  }
  s.status = s.mode === 'adventure' ? 'lost' : 'over';
  s.end = 'noSpace';
  ev.push({ type: 'end', status: s.status, reason: 'noSpace' });
}

/** Blitz : le temps s'écoule (appelé à chaque image tant que la partie est active). */
export function tick(s, dt) {
  if (s.mode !== 'blitz' || s.status !== 'play') return [];
  s.time = Math.max(0, s.time - dt);
  if (s.time > 0) return [];
  s.status = 'over';
  s.end = 'time';
  return [{ type: 'end', status: 'over', reason: 'time' }];
}

/** Terminer volontairement (mode Zen, ou abandon depuis la pause). */
export function finish(s) {
  if (s.status !== 'play' && s.status !== 'stuck') return fail('status');
  s.status = s.mode === 'adventure' ? 'lost' : 'over';
  s.end = 'quit';
  return { ok: true, events: [{ type: 'end', status: s.status, reason: 'quit' }] };
}

/** Cases touchées par une bombe centrée en (x, y) : carré 3×3 rogné aux bords. */
export function bombArea(x, y) {
  const out = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const cx = x + dx, cy = y + dy;
      if (cx >= 0 && cy >= 0 && cx < B.COLS && cy < B.ROWS) out.push(B.idx(cx, cy));
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
    p.k = nk;
    ev.push({ type: 'rotate', ti: arg.ti, k: nk });
  } else if (kind === 'bomb') {
    const area = bombArea(arg.x, arg.y).filter((i) => s.board.c[i]);
    if (!area.length) return fail('nothing');
    const cleared = area.map((i) => ({ i, c: s.board.c[i] }));
    let stones = 0;
    for (const i of area) { if (s.board.c[i] === B.STONE) stones++; s.board.c[i] = 0; }
    s.stats.stones += stones;
    const pts = SCORE.bombCell * area.length;
    s.score += pts;
    ev.push({ type: 'bomb', x: arg.x, y: arg.y, cleared, points: pts, stones });
    ev.push({ type: 'score', points: pts, total: s.score });
  } else if (kind === 'reroll') {
    const set = dealSet(s.board, s.rng, { mercy: true });
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
