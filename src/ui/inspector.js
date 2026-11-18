// Inspecteur : fiche détaillée d'un client, d'un employé, d'une pièce ou d'un meuble.
import { $, h, icon, clear, bar, stars, money } from './dom.js';
import { ARCHETYPES, TRAITS } from '../data/guests.js';
import { STAFF_ROLES, STAFF_TRAITS, SHIFTS, STANDING_NAMES, STANDING_THRESHOLDS } from '../data/economy.js';
import { ROOM_TYPES, FLOORS, WALLS } from '../data/rooms.js';
import { FURNITURE, USE_KINDS } from '../data/furniture.js';
import { portrait, furnitureThumb, roomThumb } from '../render/thumbs.js';
import { guestTypeLabel, moodOf, activityLabel, NEED_LABELS } from './labels.js';
import { staffTaskLabel } from '../sim/staff.js';
import { requiredLabel, footprint } from '../sim/world.js';
import { clock } from '../sim/time.js';

export class Inspector {
  constructor(game) {
    this.game = game;
    this.el = $('#inspector');
    this.sel = null;
    this.t = 0;
  }

  show(sel) {
    this.sel = sel;
    this.game.ui.selected = sel;
    if (!sel) { this.el.classList.add('hidden'); this.game.follow = null; return; }
    this.el.classList.remove('hidden');
    this.render();
  }

  update(dt) {
    if (!this.sel) return;
    this.t += dt;
    if (this.t > 0.7) { this.t = 0; this.render(); }
  }

  render() {
    const sel = this.sel;
    const st = this.game.state;
    let content = null;
    if (sel.kind === 'guest') {
      const g = st.guests.find((x) => x.id === sel.id);
      if (!g) return this.show(null);
      content = this.guest(g, st);
    } else if (sel.kind === 'staff') {
      const s = st.staff.find((x) => x.id === sel.id);
      if (!s) return this.show(null);
      content = this.staff(s, st);
    } else if (sel.kind === 'room') {
      const r = st.world.rooms[sel.id];
      if (!r) return this.show(null);
      content = this.room(r, st);
    } else if (sel.kind === 'furniture') {
      const f = st.world.furniture[sel.id];
      if (!f) return this.show(null);
      content = this.furniture(f, st);
    }
    const scroll = this.el.scrollTop;
    clear(this.el);
    this.el.append(h('button', { class: 'icon-btn insp-close', onclick: () => { this.game.audio.play('click'); this.show(null); } }, icon('close')), ...[content].flat(3).filter(Boolean));
    this.el.scrollTop = scroll;
  }

  guest(g, st) {
    const a = ARCHETYPES[g.type];
    const m = moodOf(g.satisfaction);
    const room = st.world.rooms[g.roomId];
    const c = clock(st.time);
    const vip = g.vip && (g.vip === 'celebrity' ? 'Semble observer chaque détail…' : 'Prend beaucoup de notes…');
    return [
      h('div', { class: 'insp-head' },
        h('div', { class: 'portrait' }, portrait(g.members[0].look, 64, 64, { winter: c.seasonIndex === 3 })),
        h('div', {}, h('h3', {}, g.story ? '★ ' : '', g.name), h('div', { class: 'sub' }, `${guestTypeLabel(g)} · de ${g.origin}`), h('div', { class: 'sub' }, `${g.members.map((x) => `${x.first} (${x.age} ans)`).join(', ')}`))),
      h('div', { class: 'activity' }, activityLabel(st, g)),
      h('div', { class: 'kv' },
        h('span', {}, 'Chambre'), h('b', {}, room ? `n° ${room.num} · ${STANDING_NAMES[g.standing || 0]}` : '—'),
        h('span', {}, 'Séjour'), h('b', {}, `${g.nights} nuit${g.nights > 1 ? 's' : ''}${g.roomId ? ` (${g.nightsDone} passée${g.nightsDone > 1 ? 's' : ''})` : ''}`),
        h('span', {}, 'Budget / nuit'), h('b', {}, `≈ ${g.budget} écus`),
        h('span', {}, 'Tarif obtenu'), h('b', {}, g.roomId ? (g.freeStay ? 'offert' : `${g.rate} écus`) : '—'),
        h('span', {}, 'Exigence'), h('b', {}, '●'.repeat(Math.round(g.exigence * 5)) + '○'.repeat(5 - Math.round(g.exigence * 5))),
        h('span', {}, 'Dépensé ici'), h('b', {}, `${Math.round(g.spent)} écus`)),
      g.traits.length ? h('div', { class: 'chips' }, g.traits.map((t) => h('span', { class: 'tag', title: TRAITS[t].desc }, TRAITS[t].name))) : null,
      vip ? h('p', { class: 'note' }, vip) : null,
      h('div', { class: 'sec' }, 'Satisfaction', h('small', {}, `${m.e} ${m.t}`)),
      bar(g.satisfaction / 100),
      h('div', { class: 'sec' }, 'Besoins'),
      Object.entries(NEED_LABELS).map(([k, label]) => h('div', { class: 'need' }, h('span', {}, label), bar(g.needs[k] / 100), h('b', {}, Math.round(g.needs[k])))),
      g.thoughts.length ? [h('div', { class: 'sec' }, 'Pensées'), h('ul', { class: 'thoughts' }, g.thoughts.slice(0, 6).map((t) => h('li', { class: t.d > 0 ? 'p' : t.d < 0 ? 'n' : '' }, `« ${t.text} »`)))] : null,
      h('div', { class: 'btns', style: { marginTop: '10px' } }, h('button', { class: 'btn small', onclick: () => { this.game.follow = this.game.follow === g.id ? null : g.id; this.render(); } }, icon('follow'), this.game.follow === g.id ? 'Ne plus suivre' : 'Suivre')),
    ];
  }

  staff(s, st) {
    const role = s.role === 'owner' ? { name: 'Propriétaire', fem: 'Propriétaire', desc: 'Vous accueillez les clients et faites le ménage tant que personne d\'autre ne s\'en charge.' } : STAFF_ROLES[s.role];
    return [
      h('div', { class: 'insp-head' }, h('div', { class: 'portrait' }, portrait(s.look, 64, 64)), h('div', {}, h('h3', {}, s.role === 'owner' ? 'Vous' : s.name), h('div', { class: 'sub' }, s.fem ? role.fem : role.name))),
      h('div', { class: 'activity' }, staffTaskLabel(s)),
      h('p', { class: 'note' }, role.desc),
      s.role !== 'owner' ? [
        h('div', { class: 'kv' },
          h('span', {}, 'Compétence'), stars(s.skill * 5),
          h('span', {}, 'Efficacité'), h('b', {}, `${Math.round((s.eff || 0.5) * 100)} %`),
          h('span', {}, 'Salaire'), h('b', {}, `${s.salary} écus / jour`),
          h('span', {}, 'Ancienneté'), h('b', {}, `${s.daysWorked} jour${s.daysWorked > 1 ? 's' : ''}`),
          h('span', {}, 'Horaires'), h('b', {}, `${SHIFTS[s.shift].name} (${SHIFTS[s.shift].from}h–${SHIFTS[s.shift].to}h)`)),
        s.traits.length ? h('div', { class: 'chips' }, s.traits.map((t) => h('span', { class: 'tag', title: STAFF_TRAITS[t].desc }, STAFF_TRAITS[t].name))) : null,
        h('div', { class: 'btns', style: { marginTop: '10px' } },
          h('button', { class: 'btn small', onclick: () => this.game.emit('openPanel', 'staff') }, 'Gérer l\'équipe'),
          h('button', { class: 'btn small', onclick: () => { this.game.follow = this.game.follow === s.id ? null : s.id; this.render(); } }, icon('follow'), 'Suivre')),
      ] : null,
    ];
  }

  room(r, st) {
    const def = ROOM_TYPES[r.type];
    const rs = st.rt.roomStats[r.id];
    const occ = st.guests.find((g) => g.roomId === r.id);
    const issues = [];
    if (!rs.ok) issues.push(`Il manque : ${rs.missing.map(requiredLabel).join(', ')}.`);
    if (!rs.reachable) issues.push('Inaccessible aux clients : ajoutez une porte vers un couloir ou une pièce commune (Construire › Outils › Portes).');
    let standing = null;
    if (r.type === 'bedroom') {
      const next = STANDING_THRESHOLDS[rs.standing + 1];
      standing = [
        h('div', { class: 'sec' }, `Standing : ${STANDING_NAMES[rs.standing]}`, h('small', {}, `${rs.points} points`)),
        bar(Math.min(1, rs.points / (STANDING_THRESHOLDS[2] + 10)), 'none'),
        h('p', { class: 'note' }, next ? `${next - rs.points > 0 ? `Encore ${next - rs.points} points` : 'Il manque de l\'espace (9 cases min.)'} pour « ${STANDING_NAMES[rs.standing + 1]} ». Les points viennent du lit, du confort, du décor (meubles, sol, murs) et de l'espace par personne.` : 'Standing maximal atteint.'),
      ];
    }
    return [
      h('div', { class: 'insp-head' }, h('div', { class: 'portrait', style: { background: '#f3e6cf' } }, roomThumb(r.type, 64, 64)), h('div', {}, h('h3', {}, r.type === 'bedroom' ? `Chambre ${r.num}` : def.name), h('div', { class: 'sub' }, `${rs.area} cases${r.type === 'bedroom' ? ` · ${rs.capacity} couchage${rs.capacity > 1 ? 's' : ''}` : ''}`))),
      issues.map((t) => h('p', { class: 'note warn' }, t)),
      h('p', { class: 'note' }, def.desc),
      standing,
      h('div', { class: 'kv' },
        h('span', {}, 'Confort'), h('b', {}, Math.round(rs.comfort + rs.bedComfort)),
        h('span', {}, 'Décor'), h('b', {}, Math.round(rs.decor)),
        def.indoor ? h('span', {}, 'Chaleur') : null, def.indoor ? h('b', {}, rs.warmth ? 'chauffée' : 'aucune source') : null,
        r.type === 'kitchen' ? h('span', {}, 'Équipement') : null, r.type === 'kitchen' ? h('b', {}, rs.kitchen.toFixed(1)) : null,
        h('span', {}, 'Sol'), h('b', {}, FLOORS[r.floor]?.name || '—'),
        def.indoor ? h('span', {}, 'Murs') : null, def.indoor ? h('b', {}, WALLS[r.wall]?.name || '—') : null,
        r.type === 'bedroom' ? h('span', {}, 'Occupée par') : null, r.type === 'bedroom' ? h('b', {}, occ ? occ.name : 'libre') : null,
        r.type === 'bedroom' ? h('span', {}, 'Prix / nuit') : null, r.type === 'bedroom' ? h('b', {}, `${st.prices.rooms[rs.standing]} écus`) : null),
      def.indoor ? [h('div', { class: 'sec' }, 'Propreté'), bar(r.clean / 100)] : null,
      h('div', { class: 'btns', style: { marginTop: '10px' } },
        h('button', { class: 'btn small', onclick: () => this.game.emit('openPanel', 'build', 'styles') }, icon('brush'), 'Sols & murs'),
        h('button', { class: 'btn small', onclick: () => this.game.emit('openPanel', 'build', 'furniture') }, icon('sofa'), 'Meubler'),
        h('button', { class: 'btn small danger', onclick: () => this.game.emit('confirm', { title: `Démolir ${r.type === 'bedroom' ? `la chambre ${r.num}` : def.name.toLowerCase()} ?`, text: `Vous récupérez 50 % de la construction et des meubles (≈ ${this.game.roomRefund(r.id)} écus + meubles).`, ok: 'Démolir', danger: true, fn: () => { const res = this.game.act('demolishRoom', r.id); if (res.ok) { this.game.audio.play('build'); this.show(null); } } }) }, icon('trash'), 'Démolir')),
    ];
  }

  furniture(f, st) {
    const d = FURNITURE[f.type];
    const room = st.world.rooms[f.roomId];
    const eff = [];
    if (d.capacity) eff.push(`${d.capacity} couchage${d.capacity > 1 ? 's' : ''}`);
    if (d.comfort) eff.push(`confort +${d.comfort}`);
    if (d.decor) eff.push(`décor +${d.decor}`);
    if (d.warmth) eff.push('chauffe la pièce');
    if (d.kitchen) eff.push(`équipement de cuisine +${d.kitchen}`);
    if (d.stockCap) eff.push(`stockage +${Object.values(d.stockCap)[0]}`);
    if (d.use && USE_KINDS[d.use.kind] && d.use.kind !== 'sleep') eff.push(USE_KINDS[d.use.kind].label.toLowerCase());
    if (d.table) eff.push(d.table === 'dining' ? 'places assises avec des chaises autour' : 'jeux avec des chaises autour');
    const rotOk = d.w !== d.h || d.use || d.staffSpot || d.autoFace;
    return [
      h('div', { class: 'insp-head' }, h('div', { class: 'portrait', style: { background: '#f3e6cf' } }, furnitureThumb(f.type, 64, 64)), h('div', {}, h('h3', {}, d.name), h('div', { class: 'sub' }, room ? (room.type === 'bedroom' ? `Chambre ${room.num}` : ROOM_TYPES[room.type].name) : 'Extérieur'))),
      h('p', { class: 'note' }, eff.length ? `Effets : ${eff.join(', ')}.` : 'Élément décoratif.'),
      h('div', { class: 'btns' },
        rotOk ? h('button', { class: 'btn small', onclick: () => { const [fw, fd] = footprint(d, f.rot); const r = this.game.act('moveFurniture', f.id, f.x, f.y, (f.rot + 1) % 4); if (!r.ok) this.game.act('moveFurniture', f.id, f.x, f.y, (f.rot + 2) % 4); this.game.audio.play('place'); } }, icon('rotate'), 'Tourner') : null,
        h('button', { class: 'btn small', onclick: () => { this.game.setMode('move'); this.game.ui.moving = f.id; this.game.ui.rot = f.rot; this.game.emit('mode', 'move'); this.show(null); } }, icon('move'), 'Déplacer'),
        h('button', { class: 'btn small danger', onclick: () => { const r = this.game.act('sellFurniture', f.id); if (r.ok) { this.game.audio.play('sell'); this.show(null); } } }, icon('trash'), d.special ? 'Ranger' : `Vendre (+${Math.round(d.cost * 0.5)})`)),
    ];
  }
}

export { money };
