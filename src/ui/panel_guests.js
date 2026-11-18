// Panneaux « Clients » et « Personnel ».
import { h, icon, money, stars, bar } from './dom.js';
import { STORIES } from '../data/events.js';
import { STAFF_ROLES, STAFF_TRAITS, SHIFTS, STANDING_NAMES } from '../data/economy.js';
import { portrait } from '../render/thumbs.js';
import { guestTypeLabel, moodOf, activityLabel } from './labels.js';
import { staffTaskLabel, isOnDuty } from '../sim/staff.js';
import { clock } from '../sim/time.js';
import { formatMoney } from '../core/util.js';

const avatar = (look, kid) => h('div', { class: 'avatar' }, portrait(look, 40, 40, { kid }));

export const guestsPanel = {
  title: 'Clients',
  live: true,
  tabs: [['present', 'Présents'], ['reviews', 'Avis'], ['regulars', 'Habitués'], ['stats', 'Fréquentation']],
  render(game, tab) {
    const st = game.state;
    if (tab === 'present') {
      const list = st.guests.filter((g) => g.state !== 'leave');
      if (!list.length) return h('p', { class: 'note' }, 'Aucun voyageur pour le moment. Ils arrivent en journée par le chemin du village.');
      const inRooms = list.filter((g) => g.roomId);
      const waiting = list.filter((g) => !g.roomId);
      const row = (g) => {
        const m = moodOf(g.satisfaction);
        const room = st.world.rooms[g.roomId];
        return h('div', { class: 'row click', onclick: () => game.emit('select', { kind: 'guest', id: g.id }, true) },
          avatar(g.members[0].look),
          h('div', { class: 'grow' },
            h('div', { class: 't' }, g.story ? '★ ' : '', g.name),
            h('div', { class: 's' }, `${guestTypeLabel(g)} · ${room ? `Ch. ${room.num} · nuit ${Math.min(g.nightsDone + 1, g.nights)}/${g.nights}` : 'en arrivée'}`),
            h('div', { class: 's' }, activityLabel(st, g))),
          h('div', { class: 'mood', title: m.t }, m.e));
      };
      return [
        waiting.length ? h('div', { class: 'sec' }, 'En arrivée', h('small', {}, `${waiting.length}`)) : null,
        waiting.map(row),
        h('div', { class: 'sec' }, 'En séjour', h('small', {}, `${inRooms.length} groupe${inRooms.length > 1 ? 's' : ''}`)),
        inRooms.map(row),
      ];
    }
    if (tab === 'reviews') {
      const revs = st.reputation.reviews;
      const avg = revs.length ? revs.reduce((s, r) => s + r.stars, 0) / revs.length : 0;
      return [
        h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, 'Réputation'), h('div', { class: 's' }, `${revs.length} avis récents · moyenne ${avg.toFixed(1).replace('.', ',')} ★`)), stars(st.reputation.value / 20)),
        h('p', { class: 'note' }, 'La réputation suit surtout les avis des clients (confort, repas, attente, prix) et un peu la qualité de vos installations.'),
        revs.length ? revs.map((r) => h('div', { class: 'row', style: { alignItems: 'flex-start' } },
          h('div', { class: 'grow' },
            h('div', { class: 't', style: { display: 'flex', gap: '6px', alignItems: 'center' } }, stars(r.stars), h('span', { class: 's' }, `Jour ${r.day}`)),
            h('div', { style: { fontSize: '13.5px', margin: '4px 0', fontStyle: 'italic' } }, `« ${r.text} »`),
            h('div', { class: 's' }, `${r.name} · ${r.type}${r.origin ? `, de ${r.origin}` : ''}`)))) : h('p', { class: 'note' }, 'Pas encore d\'avis : ils sont laissés au départ des clients.'),
      ];
    }
    if (tab === 'regulars') {
      return [
        h('p', { class: 'note' }, 'Certains voyageurs reviennent au fil des saisons. Vos choix lors de leurs visites façonnent leur histoire… et vos récompenses.'),
        Object.entries(STORIES).map(([id, s]) => {
          const ch = st.stories.chars[id];
          const known = ch && ch.visits > 0;
          const done = ch && ch.chapter >= s.chapters.length;
          const m = s.members[0];
          return h('div', { class: 'row' },
            known ? avatar({ skin: m.skin, hair: m.hair, hairStyle: m.hairStyle, top: m.top, bottom: m.bottom, hat: m.hat, backpack: m.backpack }) : h('div', { class: 'avatar', style: { display: 'grid', placeItems: 'center', fontSize: '20px', color: '#a89478' } }, '?'),
            h('div', { class: 'grow' },
              h('div', { class: 't' }, known ? s.name : 'Voyageur inconnu'),
              h('div', { class: 's' }, known ? `${ch.visits} visite${ch.visits > 1 ? 's' : ''} · chapitre ${Math.min(ch.chapter, s.chapters.length)}/${s.chapters.length}${done ? ' · histoire terminée' : ''}` : `Apparaît à partir du palier ${s.minTier}`),
              known ? h('div', { class: 's' }, `Relation : ${'♥'.repeat(Math.max(0, Math.min(6, ch.relation)))}${ch.relation <= 0 ? 'neutre' : ''}`) : null));
        }),
      ];
    }
    // Statistiques
    const r = st.stats.refused;
    const rep = st.lastDayReport;
    return [
      h('div', { class: 'kv' },
        h('span', {}, 'Voyageurs accueillis'), h('b', {}, st.stats.served),
        h('span', {}, 'Nuitées vendues'), h('b', {}, st.stats.nights),
        h('span', {}, 'Repas servis'), h('b', {}, st.stats.meals),
        h('span', {}, 'Boissons servies'), h('b', {}, st.stats.drinks),
        h('span', {}, 'Excursions'), h('b', {}, st.stats.excursions),
        h('span', {}, 'Groupes refusés : complet'), h('b', {}, r.full),
        h('span', {}, 'Refusés : trop cher'), h('b', {}, r.price),
        h('span', {}, 'Refusés : trop modeste'), h('b', {}, r.quality),
        h('span', {}, 'Partis après une longue attente'), h('b', {}, r.wait)),
      h('p', { class: 'note' }, adviceFor(st)),
      rep ? h('p', { class: 'note' }, `Hier : ${rep.arrivals} groupes arrivés, ${rep.reviews} avis (${rep.avgStars ? rep.avgStars.toFixed(1).replace('.', ',') + ' ★' : '—'}).`) : null,
    ];
  },
};

function adviceFor(st) {
  const r = st.stats.refused;
  const tot = r.full + r.price + r.quality + r.wait;
  if (!tot) return 'Aucun refus pour l\'instant. Gardez un œil sur la file d\'attente !';
  const max = Object.entries(r).sort((a, b) => b[1] - a[1])[0][0];
  return {
    full: 'Conseil : vous refusez surtout faute de place. Construisez des chambres, dont certaines pour les familles (3 ou 4 couchages : lits superposés).',
    price: 'Conseil : vos prix découragent une partie des voyageurs. Baissez un peu les tarifs ou augmentez le standing des chambres.',
    quality: 'Conseil : les clients exigeants trouvent vos chambres trop modestes. Améliorez le confort et le décor.',
    wait: 'Conseil : la file d\'attente est trop longue. Embauchez un(e) réceptionniste.',
  }[max];
}

export const staffPanel = {
  title: 'Personnel',
  live: true,
  tabs: [['team', 'Équipe'], ['hire', 'Recruter']],
  render(game, tab, panels) {
    const st = game.state;
    const hf = clock(st.time).hf;
    if (tab === 'team') {
      const total = st.staff.reduce((s, x) => s + x.salary, 0);
      return [
        h('p', { class: 'note' }, `Masse salariale : ${formatMoney(total)} écus par jour. Au début, vous gérez seul l'accueil et le ménage — embauchez à mesure que l'auberge grandit.`),
        st.staff.map((s) => {
          const role = s.role === 'owner' ? { name: 'Propriétaire', fem: 'Propriétaire' } : STAFF_ROLES[s.role];
          return h('div', { class: 'row', style: { alignItems: 'flex-start' } },
            h('div', { class: 'avatar', style: { cursor: 'pointer' }, onclick: () => game.emit('select', { kind: 'staff', id: s.id }, true) }, portrait(s.look, 40, 40)),
            h('div', { class: 'grow' },
              h('div', { class: 't' }, s.role === 'owner' ? 'Vous (propriétaire)' : s.name),
              h('div', { class: 's' }, `${s.fem ? role.fem : role.name}${s.role !== 'owner' ? ` · ${s.salary} écus/j` : ''} · ${staffTaskLabel(s)}`),
              s.role !== 'owner' ? h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', flexWrap: 'wrap' } },
                stars(s.skill * 5),
                h('select', { class: 'btn small', onchange: (e) => game.act('setShift', s.id, e.target.value) }, Object.entries(SHIFTS).map(([k, v]) => h('option', { value: k, selected: s.shift === k }, `${v.name} ${v.from}h–${v.to}h`))),
                s.traits.map((t) => h('span', { class: 'tag', title: STAFF_TRAITS[t].desc }, STAFF_TRAITS[t].name)),
                h('button', { class: 'btn small danger', onclick: () => game.emit('confirm', { title: `Licencier ${s.name} ?`, text: `Une indemnité d'une journée (${s.salary} écus) sera versée.`, ok: 'Licencier', danger: true, fn: () => { game.act('fire', s.id); panels.render(); } }) }, 'Licencier')) : h('div', { class: 's' }, 'Accueil et ménage quand personne d\'autre ne s\'en charge (efficacité modeste).'),
              s.role !== 'owner' && !isOnDuty(s, hf) ? h('div', { class: 's' }, 'Hors service à cette heure') : null));
        }),
      ];
    }
    const byRole = {};
    for (const c of st.candidates) (byRole[c.role] ||= []).push(c);
    const locked = Object.entries(STAFF_ROLES).filter(([, d]) => st.tier < d.tier);
    return [
      h('p', { class: 'note' }, `Nouveaux candidats tous les 3 jours (prochains : jour ${st.candidatesDay + 3 - Math.floor(st.candidatesDay / 28) * 0}). La compétence (étoiles) accélère le travail et améliore la qualité ; elle progresse avec l'expérience.`),
      Object.entries(byRole).map(([role, list]) => [
        h('div', { class: 'sec' }, STAFF_ROLES[role].name, h('small', {}, STAFF_ROLES[role].desc)),
        list.map((c) => h('div', { class: 'row' },
          avatar(c.look),
          h('div', { class: 'grow' },
            h('div', { class: 't' }, c.name),
            h('div', { style: { display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' } }, stars(c.skill * 5), c.traits.map((t) => h('span', { class: 'tag', title: STAFF_TRAITS[t].desc }, STAFF_TRAITS[t].name))),
            h('div', { class: 's' }, `${c.salary} écus / jour`)),
          h('button', { class: 'btn small primary', onclick: () => { const r = game.act('hire', c.cid, 'journee'); if (r.ok) { game.audio.play('chime'); game.emit('toast', { kind: 'good', text: `${c.name} rejoint l'équipe ! Il arrivera à sa prochaine prise de service.` }); panels.render(); } } }, 'Embaucher'))),
      ]),
      locked.length ? h('p', { class: 'note' }, `À débloquer : ${locked.map(([, d]) => `${d.name} (palier ${d.tier})`).join(', ')}.`) : null,
    ];
  },
};

export { STANDING_NAMES, money, bar, icon };
