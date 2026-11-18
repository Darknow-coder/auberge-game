// Point d'entrée : assemble le jeu, l'interface et l'écran titre.
import { Game } from './game.js';
import { Hud } from './ui/hud.js';
import { Toasts } from './ui/toasts.js';
import { Panels } from './ui/panels.js';
import { Inspector } from './ui/inspector.js';
import { Modals } from './ui/modals.js';
import { Input } from './ui/input.js';
import { $, h, icon, clear, isNarrow } from './ui/dom.js';
import { createNewGame } from './sim/state.js';
import { update } from './sim/sim.js';
import { objectiveList, tierRequirements } from './sim/progression.js';
import { TIERS } from './data/progression.js';
import { clock } from './sim/time.js';
import { formatMoney } from './core/util.js';

const canvas = $('#view');
const game = new Game(canvas);
window.__game = game; // utile pour les tests automatisés

const hud = new Hud(game);
const toasts = new Toasts(game);
const panels = new Panels(game);
const inspector = new Inspector(game);
const modals = new Modals(game);

function select(sel, center = false) {
  inspector.show(sel);
  if (sel && center) {
    const st = game.state;
    const a = sel.kind === 'guest' ? st.guests.find((g) => g.id === sel.id) : st.staff.find((s) => s.id === sel.id);
    if (a && !a.hidden) game.renderer.centerOn(a.x, a.y);
    if (isNarrow()) panels.close();
  }
}

const input = new Input(game, {
  select,
  toast: (t) => toasts.show(t),
  confirm: (o) => modals.confirm(o),
  openPanel: (n, t) => panels.open(n, t),
  refreshBuildbar: () => renderBuildbar(),
  afterBuild: () => { if (panels.current === 'build' && panels.isOpen()) panels.render(); },
  escape: () => {
    if (modals.open) return;
    if (game.ui.mode !== 'none') { game.setMode('none'); return; }
    if (inspector.sel) { inspector.show(null); return; }
    if (panels.isOpen()) panels.close();
  },
});

// ---------------------------------------------------------------- Événements du jeu
game.on('toast', (t) => toasts.show(t));
game.on('confirm', (o) => modals.confirm(o));
game.on('select', (sel, center) => select(sel, center));
game.on('openPanel', (n, t) => panels.open(n, t));
game.on('dialog', () => modals.dialog());
game.on('mode', () => {
  canvas.classList.toggle('building', game.ui.mode !== 'none');
  if (game.ui.mode !== 'none' && game.ui.mode !== 'move') inspector.show(null);
  game.ui.userRot = false;
  renderBuildbar();
});
game.on('change', () => { renderBadges(); });
game.on('celebrate', (o) => toasts.show({ kind: 'objective', text: `Récompense obtenue : ${o.title} !` }));
game.on('tierup', () => {
  const st = game.state;
  modals.show([
    h('div', { class: 'kicker', style: { color: 'var(--gold)' } }, 'Nouveau palier'),
    h('h2', {}, TIERS[st.tier].name),
    h('p', { class: 'lead' }, `Félicitations ! ${st.innName} gagne en prestige. Déblocages : ${TIERS[st.tier].unlocks}.`),
    h('div', { class: 'btns', style: { justifyContent: 'flex-end' } }, h('button', { class: 'btn gold', onclick: (e) => e.target.closest('.modal-back').close() }, 'Merveilleux !')),
  ]);
});

game.on('notify', (n) => {
  const st = game.state;
  const focus = n.gid ? () => select({ kind: 'guest', id: n.gid }, true) : null;
  switch (n.kind) {
    case 'checkin': game.audio.play('bell'); toasts.show({ kind: 'checkin', text: n.text, onClick: focus, duration: 3500 }); break;
    case 'review': {
      game.audio.play('star');
      const r = n.review;
      toasts.show({ kind: 'review', html: `<b>${'★'.repeat(r.stars)}${'☆'.repeat(5 - r.stars)}</b> ${esc(r.name)} : « ${esc(r.text)} »`, onClick: () => panels.open('guests', 'reviews') });
      break;
    }
    case 'refuse': toasts.show({ kind: 'refuse', text: n.text, duration: 4200 }); break;
    case 'warn': game.audio.play('warn'); toasts.show({ kind: 'warn', text: n.text, key: n.key }); break;
    case 'report': {
      const r = n.report;
      toasts.show({ kind: r.net >= 0 ? 'good' : 'warn', html: `<b>Fin du jour ${r.day}</b> : ${r.net >= 0 ? '+' : '−'}${formatMoney(Math.abs(r.net))} écus · ${r.arrivals} groupes arrivés${r.reviews ? ` · ${r.avgStars.toFixed(1).replace('.', ',')} ★` : ''}`, action: { label: 'Voir le bilan', fn: () => modals.report(r) }, duration: 9000 });
      game.save();
      break;
    }
    case 'tier': game.audio.play('chime'); toasts.show({ kind: 'tier', text: n.text }); break;
    case 'objective': game.audio.play('chime'); toasts.show({ kind: 'objective', text: n.text, onClick: () => panels.open('goals') }); break;
    case 'story': toasts.show({ kind: 'story', text: n.text, onClick: focus }); break;
    case 'season': game.audio.play('chime'); toasts.show({ kind: 'season', text: n.text, duration: 9000 }); break;
    case 'dialog': break;
    case 'delivery': game.audio.play('coin'); toasts.show({ kind: 'delivery', text: n.text }); break;
    default: if (n.text) toasts.show({ kind: n.kind === 'good' ? 'good' : n.kind === 'event' ? 'event' : 'info', text: n.text, onClick: focus });
  }
  renderBadges();
  void st;
});

function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

// ---------------------------------------------------------------- Barre de construction
function renderBuildbar() {
  const bb = $('#buildbar');
  const d = game.describeMode();
  if (!d) { bb.classList.add('hidden'); return; }
  const ui = game.ui;
  const pending = ui.pending;
  const pvOk = ui.preview && ui.preview.ok;
  clear(bb).append(...[
    h('div', { class: 'lbl' }, d.title, h('small', {}, pending && ui.preview && !pvOk ? (ui.preview.reason || 'Emplacement invalide') : d.sub)),
    (ui.mode === 'furniture' || (ui.mode === 'move' && ui.moving)) ? h('button', { class: 'btn', title: 'Tourner (R)', onclick: () => { input.rotate(); renderBuildbar(); } }, icon('rotate'), h('span', {}, 'Tourner')) : null,
    pending ? h('button', { class: 'btn primary', disabled: !pvOk, onclick: () => { if (pending.kind === 'rect') input.commitRect(); else input.commitFurniture(); renderBuildbar(); } }, icon('check'), h('span', {}, ui.mode === 'room' ? `Construire${ui.preview?.cost ? ` (${formatMoney(ui.preview.cost)})` : ''}` : 'Placer')) : null,
    isNarrow() && ui.mode !== 'parcels' ? h('button', { class: 'btn', title: 'Catalogue', onclick: () => panels.open('build') }, icon('hammer')) : null,
    h('button', { class: 'btn', title: 'Terminer (Échap)', onclick: () => { game.audio.play('click'); game.setMode('none'); } }, icon('close'), h('span', {}, 'Terminer')),
  ].filter(Boolean));
  bb.classList.remove('hidden');
}

// ---------------------------------------------------------------- Badges et conseils
function renderBadges() {
  const st = game.state;
  if (!st) return;
  const done = objectiveList(st).filter((o) => o.done && !o.claimed).length;
  const bg = $('#badge-goals');
  bg.textContent = done; bg.classList.toggle('hidden', !done);
  const reqs = tierRequirements(st);
  const can = reqs.length && reqs.every((r) => r.ok) && TIERS[st.tier + 1] && st.money >= TIERS[st.tier + 1].cost;
  const bp = $('#badge-progress');
  bp.textContent = '!'; bp.classList.toggle('hidden', !can);
}

const TIPS = [
  { id: 'welcome', when: () => true, text: 'Bienvenue ! Les voyageurs arrivent par le chemin du village et s\'enregistrent à la réception. Touchez un client pour lire ses pensées.' },
  { id: 'build', when: (s) => s.stats.served >= 1, text: 'Les nuitées sont payées au départ. Pour accueillir plus de monde, ouvrez « Construire » et tracez une nouvelle chambre, puis meublez-la.' },
  { id: 'food', when: (s) => clock(s.time).day >= 2 || s.stats.reviews >= 2, text: 'Les clients ont faim ! Construisez une cuisine (avec un fourneau) à côté d\'une salle de restaurant (tables + chaises), puis recrutez un cuisinier.' },
  { id: 'stock', when: (s) => s.rt.agg.byType.kitchen && s.stock.ingredients < 8, text: 'Vos ingrédients s\'épuisent : commandez-en dans « Gestion › Stocks ». La charrette livre chaque matin à 8 h.' },
  { id: 'prices', when: (s) => clock(s.time).day >= 3, text: 'Ajustez vos tarifs dans « Gestion › Tarifs » : trop chers, les voyageurs repartent ; trop bas, vous perdez de l\'argent.' },
  { id: 'tier', when: (s) => clock(s.time).day >= 4, text: 'Consultez « Progression » : en remplissant les conditions, votre auberge passe au palier supérieur et débloque bar, terrasse, salle de jeux…' },
];
let tipT = 0;
function updateTips(dt) {
  const st = game.state;
  if (!st || !game.settings.tips || modals.open) return;
  tipT += dt;
  if (tipT < 1) return;
  tipT = 0;
  const el = $('#hint');
  if (game.ui.mode !== 'none' || (isNarrow() && (panels.isOpen() || inspector.sel))) { el.classList.add('hidden'); return; }
  if (!el.classList.contains('hidden')) return;
  st.flags.tips ||= [];
  const tip = TIPS.find((t) => !st.flags.tips.includes(t.id) && t.when(st));
  if (!tip) return;
  clear(el).append(icon('info'), h('span', {}, tip.text), h('button', { class: 'btn small gold', onclick: () => { st.flags.tips.push(tip.id); el.classList.add('hidden'); game.audio.play('click'); } }, 'Compris'));
  el.classList.remove('hidden');
}

// ---------------------------------------------------------------- Boucle d'interface
game.on('frame', (dt) => {
  if (!game.state || !inGame) { titleFrame(dt); return; }
  hud.update(dt);
  panels.update(dt);
  inspector.update(dt);
  input.update(dt);
  updateTips(dt);
  badgeT += dt;
  if (badgeT > 2) { badgeT = 0; renderBadges(); }
});
let badgeT = 0;

$('#hud-money').addEventListener('click', () => panels.open('finance'));
$('#hud-rep').addEventListener('click', () => panels.open('guests', 'reviews'));
$('#hud-inn').addEventListener('click', () => panels.open('progress'));
$('#hud-guests').addEventListener('click', () => panels.open('guests'));
$('#hud-menu').addEventListener('click', () => { game.audio.play('click'); modals.menu(); });

window.addEventListener('resize', () => game.renderer.resize());
document.addEventListener('visibilitychange', () => { if (document.hidden && inGame) game.save(); });
window.addEventListener('pagehide', () => { if (inGame) game.save(); });
document.addEventListener('pointerdown', () => game.audio.unlock(), { once: false, passive: true });

// ---------------------------------------------------------------- Écran titre
let inGame = false;
let demo = null;
function titleFrame(dt) {
  if (!demo) return;
  update(demo, dt * 4);
  demo.rt.notifications.length = 0;
  demo.dialogs.length = 0;
  const r = game.renderer;
  r.cam.x += dt * 9;
  if (r.cam.x > 420) r.cam.x = -180;
  r.render(demo, { mode: 'none' }, dt);
}

function showTitle() {
  inGame = false;
  demo = createNewGame({ seed: 7, innName: 'Auberge des Sommets' });
  demo.time = 16.8 * 60;
  demo.weather.today = 'soleil';
  update(demo, 30);
  game.state = null;
  game.renderer.cam.zoom = isNarrow() ? 0.75 : 1;
  game.renderer.centerOn(17, 22);
  for (const id of ['#hud', '#toolbar', '#panel', '#inspector', '#buildbar', '#hint']) $(id).classList.add('hidden');
  $('#title').classList.remove('hidden');
  const acts = clear($('#title-actions'));
  if (game.hasSave()) acts.append(h('button', { class: 'btn gold', onclick: () => { game.audio.unlock(); try { if (game.load()) enterGame(); } catch (e) { toasts.show({ kind: 'bad', text: 'Sauvegarde illisible : une nouvelle partie est nécessaire.' }); } } }, 'Continuer la partie'));
  acts.append(h('button', { class: `btn ${game.hasSave() ? '' : 'gold'}`, onclick: () => { game.audio.unlock(); const start = (name) => { game.newGame(name); enterGame(); }; if (game.hasSave()) modals.confirm({ title: 'Nouvelle partie ?', text: 'Votre sauvegarde actuelle sera remplacée.', ok: 'Commencer', danger: true, fn: () => modals.newGame(start) }); else modals.newGame(start); } }, 'Nouvelle partie'));
}

function enterGame() {
  inGame = true;
  demo = null;
  $('#title').classList.add('hidden');
  for (const id of ['#hud', '#toolbar']) $(id).classList.remove('hidden');
  hud.shownMoney = null;
  hud.lastKey = '';
  game.emit('speed', game.speed);
  renderBadges();
  game.audio.play('chime');
}

// Démarrage
game.renderer.resize();
document.fonts?.ready.then(() => { game.renderer.groundKey = ''; });
$('#loading').classList.add('hidden');
showTitle();
game.start();
