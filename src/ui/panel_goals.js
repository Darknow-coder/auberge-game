// Panneaux « Objectifs » et « Progression ».
import { h, icon, bar } from './dom.js';
import { TIERS, PARCELS, OBJECTIVES } from '../data/progression.js';
import { objectiveList, tierRequirements } from '../sim/progression.js';
import { formatMoney } from '../core/util.js';

function rewardText(r) {
  const p = [];
  if (r.money) p.push(`${formatMoney(r.money)} écus`);
  if (r.rep) p.push(`+${r.rep} réputation`);
  return p.join(' · ');
}

export const goalsPanel = {
  title: 'Objectifs',
  live: true,
  tabs: [['active', 'En cours'], ['done', 'Accomplis']],
  render(game, tab, panels) {
    const st = game.state;
    const list = objectiveList(st);
    if (tab === 'done') {
      const done = list.filter((o) => o.claimed);
      return [
        h('p', { class: 'note' }, `${done.length} / ${OBJECTIVES.length} objectifs accomplis.`),
        done.map((o) => h('div', { class: 'row' }, h('div', { class: 'avatar', style: { display: 'grid', placeItems: 'center', background: '#e3f0e6', color: '#3d7a5a' } }, icon('check')), h('div', { class: 'grow' }, h('div', { class: 't' }, o.title), h('div', { class: 's' }, o.desc)))),
      ];
    }
    const active = list.filter((o) => !o.claimed).slice(0, 4);
    if (!active.length) return h('p', { class: 'note ok' }, 'Bravo, tous les objectifs sont accomplis ! Continuez à faire rayonner votre auberge.');
    return [
      h('p', { class: 'note' }, 'Accomplissez ces objectifs pour gagner des récompenses. De nouveaux apparaissent au fur et à mesure.'),
      active.map((o) => h('div', { class: `goal${o.done ? ' done' : ''}` },
        h('h3', {}, o.title),
        h('p', {}, o.desc),
        bar(o.cur / o.max, o.done ? '' : 'none'),
        h('div', { class: 'foot' },
          h('span', { class: 's', style: { fontWeight: 800, color: '#7a6553' } }, `${formatCur(o.cur, o.max)}`),
          h('span', { class: 'reward', style: { marginLeft: 'auto' } }, icon('coin'), rewardText(o.reward)),
          o.done ? h('button', { class: 'btn small gold', onclick: () => { const r = game.act('claimObjective', o.id); if (r.ok) { game.audio.play('chime'); game.emit('celebrate', o); panels.render(); } } }, 'Réclamer') : null))),
    ];
  },
};

function formatCur(cur, max) {
  if (max >= 1000) return `${formatMoney(cur)} / ${formatMoney(max)}`;
  return `${cur} / ${max}`;
}

export const progressPanel = {
  title: 'Progression',
  live: true,
  tabs: [['tier', 'Établissement'], ['land', 'Terrains']],
  render(game, tab, panels) {
    const st = game.state;
    if (tab === 'land') {
      return [
        h('p', { class: 'note' }, 'Achetez des parcelles pour agrandir votre domaine. Les arbres sont défrichés automatiquement lors de la construction.'),
        h('button', { class: 'btn', style: { marginBottom: '8px' }, onclick: () => { game.setMode('parcels'); if (panels.narrow()) panels.close(true); } }, icon('map'), 'Voir les parcelles sur la carte'),
        PARCELS.map((p) => {
          const owned = st.world.ownedParcels.includes(p.id);
          const can = st.tier >= p.tier;
          return h('div', { class: 'row' },
            h('div', { class: 'avatar', style: { display: 'grid', placeItems: 'center', background: owned ? '#e3f0e6' : '#efe2cc', color: owned ? '#3d7a5a' : '#8a5a33' } }, icon(owned ? 'check' : 'map')),
            h('div', { class: 'grow' }, h('div', { class: 't' }, p.name), h('div', { class: 's' }, owned ? 'Propriété' : `${p.desc || ''} ${!can ? `Palier ${p.tier} requis.` : ''}`)),
            owned ? null : h('button', { class: 'btn small primary', disabled: !can || st.money < p.cost, onclick: () => game.emit('confirm', { title: `Acheter « ${p.name} » ?`, text: `Coût : ${formatMoney(p.cost)} écus.`, ok: 'Acheter', fn: () => { const r = game.act('buyParcel', p.id); if (r.ok) { game.audio.play('chime'); panels.render(); } } }) }, `${formatMoney(p.cost)} é.`));
        }),
      ];
    }
    const cur = TIERS[st.tier], next = TIERS[st.tier + 1];
    const reqs = tierRequirements(st);
    const allOk = reqs.length && reqs.every((r) => r.ok);
    return [
      h('div', { class: 'tiercard' }, h('small', {}, `Palier ${st.tier} sur 5`), h('h3', {}, cur.name), h('div', { style: { fontSize: '13px', marginTop: '4px', opacity: 0.9 } }, `${st.innName}`)),
      next ? [
        h('div', { class: 'sec' }, `Prochain palier : ${next.name}`),
        reqs.map((r) => h('div', { class: `req${r.ok ? ' ok' : ''}` }, h('span', { class: 'dot' }, r.ok ? icon('check') : null), r.label, h('span', { class: 'cur' }, r.target > 1 ? `${r.cur} / ${r.target}` : r.ok ? 'OK' : '—'))),
        h('div', { class: 'req' }, h('span', { class: 'dot', style: { background: st.money >= next.cost ? '#3f7a5a' : '#eadfcd' } }, st.money >= next.cost ? icon('check') : null), `Travaux de rénovation : ${formatMoney(next.cost)} écus`),
        h('p', { class: 'note', style: { marginTop: '10px' } }, `Débloque : ${next.unlocks}.`),
        h('button', { class: 'btn gold', style: { width: '100%' }, disabled: !allOk || st.money < next.cost, onclick: () => { const r = game.act('upgradeTier'); if (r.ok) { game.audio.play('chime'); game.emit('tierup'); panels.render(); } } }, icon('mountain'), `Devenir « ${next.name} »`),
      ] : h('p', { class: 'note ok' }, 'Votre auberge est une destination incontournable ! Continuez à accueillir, améliorer et faire grandir sa légende.'),
      h('div', { class: 'sec' }, 'Les cinq paliers'),
      TIERS.slice(1).map((t, i) => h('div', { class: 'row', style: { opacity: i + 1 <= st.tier ? 1 : 0.65 } }, h('div', { class: 'tier-badge' }, i + 1), h('div', { class: 'grow' }, h('div', { class: 't' }, t.name), h('div', { class: 's' }, t.unlocks || 'Réception, chambres, salle commune, cuisine, restaurant, jardin')))),
    ];
  },
};
