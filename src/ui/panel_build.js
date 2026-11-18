// Panneau « Construire » : pièces, mobilier, extérieur, styles, outils.
import { h, icon, money } from './dom.js';
import { ROOM_TYPES, ROOM_ORDER, FLOORS, WALLS } from '../data/rooms.js';
import { FURNITURE, FURNITURE_ORDER, FURN_CATEGORIES } from '../data/furniture.js';
import { furnitureThumb, roomThumb, floorThumb, wallThumb } from '../render/thumbs.js';

function itemCard({ thumb, name, price, locked, lockText, on, onClick, tags = [], title }) {
  const el = h('button', { class: `item${locked ? ' locked' : ''}${on ? ' on' : ''}`, 'data-lock': lockText || '', title: title || name, onclick: onClick },
    thumb,
    h('span', { class: 'nm' }, name),
    price,
    tags.length ? h('span', { class: 'tags' }, tags) : null);
  return el;
}

function furnTags(def) {
  const t = [];
  if (def.capacity) t.push(h('span', { class: 'tag u' }, `${def.capacity} pers.`));
  if (def.comfort) t.push(h('span', { class: 'tag c' }, `Confort +${def.comfort}`));
  if (def.decor) t.push(h('span', { class: 'tag d' }, `Décor +${def.decor}`));
  if (def.use && def.use.kind !== 'sleep' && !def.capacity) t.push(h('span', { class: 'tag u' }, { relax: 'Détente', read: 'Lecture', fun: 'Jeu', music: 'Musique', view: 'Vue', spa: 'Spa', shop: 'Vente', excursion: 'Excursions' }[def.use.kind]));
  if (def.table) t.push(h('span', { class: 'tag u' }, def.table === 'dining' ? 'Table de repas' : 'Table de jeux'));
  if (def.stockCap) t.push(h('span', { class: 'tag' }, 'Stockage'));
  if (def.light) t.push(h('span', { class: 'tag' }, 'Lumière'));
  return t;
}

export const buildPanel = {
  title: 'Construire',
  tabs: [['rooms', 'Pièces'], ['furniture', 'Mobilier'], ['outdoor', 'Extérieur'], ['styles', 'Sols & murs'], ['tools', 'Outils']],
  render(game, tab, panels) {
    const st = game.state;
    const ui = game.ui;
    const pick = (fn) => () => { game.audio.play('click'); fn(); if (panels.narrow()) panels.close(true); panels.render(); };
    if (tab === 'rooms') {
      return [
        h('p', { class: 'note' }, 'Choisissez un type de pièce, puis tracez-la en glissant sur votre terrain. Les pièces identiques adjacentes fusionnent (sauf les chambres). Une porte est ajoutée automatiquement.'),
        h('div', { class: 'grid' }, ROOM_ORDER.map((id) => {
          const d = ROOM_TYPES[id];
          const locked = st.tier < d.tier;
          return itemCard({
            thumb: roomThumb(id), name: d.name, title: d.desc,
            price: h('span', { class: 'pr' }, icon('coin'), `${d.costPerTile}/case`),
            locked, lockText: `Palier ${d.tier}`,
            on: ui.mode === 'room' && ui.buildType === id,
            onClick: locked ? () => game.emit('toast', { kind: 'warn', text: `${d.name} : disponible au palier ${d.tier}.` }) : pick(() => game.setMode('room', { type: id })),
          });
        })),
        ui.mode === 'room' ? h('p', { class: 'note ok' }, ROOM_TYPES[ui.buildType].desc) : null,
      ];
    }
    if (tab === 'furniture' || tab === 'outdoor') {
      const cats = tab === 'outdoor' ? ['exterieur'] : FURN_CATEGORIES.map((c) => c.id).filter((c) => c !== 'exterieur');
      panels.sub.furniture ||= 'lits';
      const cat = tab === 'outdoor' ? 'exterieur' : panels.sub.furniture;
      const list = FURNITURE_ORDER.filter((id) => FURNITURE[id].cat === cat && (!FURNITURE[id].special || st.inventory[id] > 0));
      if (tab === 'furniture') {
        const specials = FURNITURE_ORDER.filter((id) => FURNITURE[id].special && st.inventory[id] > 0 && !list.includes(id));
        list.push(...specials.filter(() => cat === 'deco'));
      }
      return [
        tab === 'furniture' ? h('div', { class: 'chips' }, FURN_CATEGORIES.filter((c) => cats.includes(c.id)).map((c) => h('button', { class: `chipbtn${c.id === cat ? ' on' : ''}`, onclick: () => { panels.sub.furniture = c.id; game.audio.play('tab'); panels.render(); } }, c.name))) : h('p', { class: 'note' }, 'Aménagez les abords : jardin, terrasse ou terrain nu de votre propriété. Le décor extérieur rend l\'auberge plus attrayante.'),
        h('div', { class: 'grid' }, list.map((id) => {
          const d = FURNITURE[id];
          const locked = !d.special && st.tier < d.tier;
          return itemCard({
            thumb: furnitureThumb(id), name: d.name,
            price: d.special ? h('span', { class: 'pr' }, `Unique ×${st.inventory[id]}`) : money(d.cost),
            locked, lockText: `Palier ${d.tier}`, tags: furnTags(d),
            on: ui.mode === 'furniture' && ui.buildType === id,
            title: `${d.name} — ${roomsText(d)}`,
            onClick: locked ? () => game.emit('toast', { kind: 'warn', text: `${d.name} : disponible au palier ${d.tier}.` }) : pick(() => game.setMode('furniture', { type: id, rot: 0 })),
          });
        })),
        ui.mode === 'furniture' ? h('p', { class: 'note ok' }, `${FURNITURE[ui.buildType].name} : ${roomsText(FURNITURE[ui.buildType])}. Touche R ou bouton ⟲ pour tourner.`) : null,
      ];
    }
    if (tab === 'styles') {
      const floors = Object.entries(FLOORS), walls = Object.entries(WALLS);
      return [
        h('p', { class: 'note' }, 'Les styles améliorent le décor (et parfois le confort) d\'une pièce. Le prix dépend de sa surface.'),
        h('div', { class: 'sec' }, 'Sols'),
        h('div', { class: 'grid' }, floors.map(([id, f]) => itemCard({
          thumb: floorThumb(id), name: f.name, price: h('span', { class: 'pr' }, icon('coin'), `${f.cost}/case`),
          tags: [f.decor ? h('span', { class: 'tag d' }, `Décor +${f.decor}`) : null, f.comfort ? h('span', { class: 'tag c' }, `Confort +${f.comfort}`) : null, h('span', { class: 'tag' }, f.indoor ? 'Intérieur' : 'Extérieur')].filter(Boolean),
          locked: st.tier < f.tier, lockText: `Palier ${f.tier}`,
          on: ui.mode === 'paint' && ui.paint?.floor === id,
          onClick: st.tier < f.tier ? () => {} : pick(() => game.setMode('paint', { paint: { floor: id, label: `Sol : ${f.name}` } })),
        }))),
        h('div', { class: 'sec' }, 'Murs'),
        h('div', { class: 'grid' }, walls.map(([id, w]) => itemCard({
          thumb: wallThumb(id), name: w.name, price: h('span', { class: 'pr' }, icon('coin'), `${w.cost}/case`),
          tags: [w.decor ? h('span', { class: 'tag d' }, `Décor +${w.decor}`) : null].filter(Boolean),
          locked: st.tier < w.tier, lockText: `Palier ${w.tier}`,
          on: ui.mode === 'paint' && ui.paint?.wall === id,
          onClick: st.tier < w.tier ? () => {} : pick(() => game.setMode('paint', { paint: { wall: id, label: `Murs : ${w.name}` } })),
        }))),
      ];
    }
    // Outils
    const tool = (mode, ic, name, desc) => h('button', { class: `row click${ui.mode === mode ? ' on' : ''}`, onclick: pick(() => game.setMode(mode)) },
      h('div', { class: 'avatar', style: { display: 'grid', placeItems: 'center', background: '#efe2cc' } }, icon(ic)),
      h('div', { class: 'grow', style: { textAlign: 'left' } }, h('div', { class: 't' }, name), h('div', { class: 's' }, desc)));
    const lb = st.lastBuild && st.lastBuild.kind === 'room' && !st.lastBuild.merged && st.world.rooms[st.lastBuild.roomId];
    return [
      tool('door', 'door', 'Portes', 'Ajouter ou retirer une porte sur un mur (30 écus).'),
      tool('move', 'move', 'Déplacer un meuble', 'Gratuit. Touchez un meuble puis son nouvel emplacement.'),
      tool('demolish', 'trash', 'Démolir / revendre', 'Revend les meubles et pièces à 50 % de leur prix.'),
      tool('parcels', 'map', 'Acheter du terrain', 'Agrandissez votre propriété pour bâtir plus grand.'),
      lb ? h('button', { class: 'btn', style: { marginTop: '8px' }, onclick: () => { if (game.undoLastRoom()) { game.audio.play('sell'); game.emit('toast', { kind: 'info', text: 'Dernière pièce annulée et remboursée.' }); panels.render(); } } }, icon('rotate'), 'Annuler la dernière pièce (remboursée)') : null,
    ];
  },
};

function roomsText(d) {
  if (d.rooms === 'indoor') return 'toute pièce intérieure';
  if (d.rooms === 'outdoor') return 'jardin, terrasse ou terrain nu';
  return d.rooms.map((r) => ROOM_TYPES[r]?.name.toLowerCase()).filter(Boolean).join(', ');
}
