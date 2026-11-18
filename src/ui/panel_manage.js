// Panneau « Gestion » : tarifs, carte, boissons, stocks ; et « Finances ».
import { h, icon, money, stepper, toggle, bar } from './dom.js';
import { RECIPES, DRINKS, SERVICES, STOCK_TYPES, ROOM_REF_PRICE, STANDING_NAMES, BREAKFAST } from '../data/economy.js';
import { restaurantStatus, barStatus, recipeUnlocked, drinkUnlocked, restaurantReasonText } from '../sim/restaurant.js';
import { storageCap, demandForecast, ledgerTotals, INCOME_CATS, EXPENSE_CATS, LOAN_OPTIONS, salariesCost, maintenanceCost, billsCost } from '../sim/economy.js';
import { pending, EXPRESS_MULT } from '../sim/stock.js';
import { clock } from '../sim/time.js';
import { formatMoney } from '../core/util.js';

const seasonName = (i) => ['printemps', 'été', 'automne', 'hiver'][i];

function priceRow(name, sub, value, ref, onChange, extra) {
  const ratio = value / ref;
  const hint = ratio < 0.85 ? ['bon marché', '#3d7a5a'] : ratio > 1.2 ? ['cher', '#c0503f'] : ['raisonnable', '#7a6553'];
  return h('div', { class: 'row' },
    h('div', { class: 'grow' }, h('div', { class: 't' }, name), h('div', { class: 's' }, sub, ' · ', h('span', { style: { color: hint[1], fontWeight: 800 } }, hint[0]), ` (réf. ${ref})`), extra || null),
    stepper(value, onChange, { step: 1, min: 1, max: 999, fmt: (v) => `${v} é.` }));
}

export const managePanel = {
  title: 'Gestion',
  tabs: [['prices', 'Tarifs'], ['menu', 'Carte'], ['drinks', 'Boissons'], ['stock', 'Stocks']],
  render(game, tab, panels) {
    const st = game.state;
    const si = clock(st.time).seasonIndex;
    if (tab === 'prices') {
      const f = demandForecast(st);
      const agg = st.rt.agg;
      return [
        h('p', { class: 'note' }, 'Des prix bas attirent plus de voyageurs mais rapportent moins ; des prix élevés font fuir les petits budgets. Chaque client compare le prix au standing de la chambre et à son budget.'),
        h('div', { class: 'sec' }, 'Chambres', h('small', {}, 'prix par nuit selon le standing')),
        [0, 1, 2].map((s) => priceRow(`Chambre ${STANDING_NAMES[s].toLowerCase()}`, `${agg.standing[s]} chambre${agg.standing[s] > 1 ? 's' : ''}`, st.prices.rooms[s], ROOM_REF_PRICE[s], (v) => game.act('setRoomPrice', s, v))),
        h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, 'Affluence prévue aujourd\'hui'), h('div', { class: 's' }, `≈ ${f.total.toFixed(1).replace('.', ',')} groupes · effet des prix ×${f.price.toFixed(2).replace('.', ',')} · réputation ×${f.rep.toFixed(2).replace('.', ',')} · saison ×${f.season.toFixed(2).replace('.', ',')}`))),
        h('div', { class: 'sec' }, 'Restauration'),
        priceRow('Petit-déjeuner', 'servi de 7 h à 10 h 30', st.prices.breakfast, 10, (v) => game.act('setBreakfastPrice', v)),
        h('div', { class: 'sec' }, 'Services'),
        Object.entries(SERVICES).filter(([, s]) => st.tier >= s.tier).map(([id, s]) => priceRow(s.name, 'par personne', st.prices.services[id], s.price, (v) => game.act('setServicePrice', id, v))),
        Object.values(SERVICES).some((s) => st.tier < s.tier) ? h('p', { class: 'note' }, 'D\'autres services (spa, excursions, boutique) se débloquent avec les paliers.') : null,
      ];
    }
    if (tab === 'menu') {
      const rs = restaurantStatus(st);
      return [
        h('p', { class: rs.open ? 'note ok' : 'note warn' }, rs.open ? 'Le restaurant est ouvert.' : `Restaurant fermé : ${restaurantReasonText(rs.reason)}.`),
        h('p', { class: 'note' }, `Jusqu'à 8 plats à la carte. Les clients choisissent selon la qualité, la saison (${seasonName(si)}) et le prix. Les ingrédients sont consommés à la préparation.`),
        Object.entries(RECIPES).map(([id, r]) => {
          const un = recipeUnlocked(st, id);
          const on = st.menu.recipes.includes(id);
          const seasonal = r.season[si] >= 1.25 ? ' · de saison ✿' : r.season[si] <= 0.7 ? ' · hors saison' : '';
          if (!un) return h('div', { class: 'row', style: { opacity: 0.55 } }, icon('lock'), h('div', { class: 'grow' }, h('div', { class: 't' }, r.name), h('div', { class: 's' }, `Débloqué au palier ${r.tier}`)));
          return h('div', { class: 'row' },
            toggle(on, () => { const res = game.act('toggleRecipe', id); if (!res.ok) panels.render(); }),
            h('div', { class: 'grow' }, h('div', { class: 't' }, r.name), h('div', { class: 's' }, `Qualité ${'●'.repeat(Math.round(r.quality * 5))}${'○'.repeat(5 - Math.round(r.quality * 5))} · ${r.ing} ingr./pers.${seasonal}`)),
            stepper(st.prices.recipes[id], (v) => game.act('setRecipePrice', id, v), { min: 1, max: 300, fmt: (v) => `${v} é.` }));
        }),
      ];
    }
    if (tab === 'drinks') {
      const bs = barStatus(st);
      return [
        h('p', { class: bs.open ? 'note ok' : 'note' }, bs.open ? 'Le bar est ouvert.' : `Bar : ${bs.reason}. Les boissons sont aussi servies avec les repas.`),
        Object.entries(DRINKS).map(([id, d]) => {
          const un = drinkUnlocked(st, id);
          if (!un) return h('div', { class: 'row', style: { opacity: 0.55 } }, icon('lock'), h('div', { class: 'grow' }, h('div', { class: 't' }, d.name), h('div', { class: 's' }, `Débloqué au palier ${d.tier}`)));
          const seasonal = d.season[si] >= 1.3 ? 'de saison ✿' : d.season[si] <= 0.6 ? 'hors saison' : 'toute l\'année';
          return h('div', { class: 'row' },
            toggle(st.menu.drinks.includes(id), () => { const res = game.act('toggleDrink', id); if (!res.ok) panels.render(); }),
            h('div', { class: 'grow' }, h('div', { class: 't' }, d.name), h('div', { class: 's' }, seasonal)),
            stepper(st.prices.drinks[id], (v) => game.act('setDrinkPrice', id, v), { min: 1, max: 100, fmt: (v) => `${v} é.` }));
        }),
      ];
    }
    // Stocks
    const manager = st.staff.some((s) => s.role === 'manager');
    return [
      h('p', { class: 'note' }, 'Les commandes sont livrées le lendemain à 8 h par la charrette du fournisseur. La livraison express est immédiate mais coûte 40 % de plus.'),
      Object.entries(STOCK_TYPES).map(([id, s]) => {
        const cap = storageCap(st, id);
        const have = Math.floor(st.stock[id]);
        const pend = pending(st, id);
        const frac = cap ? have / cap : 0;
        if (cap <= 0) return h('div', { class: 'row', style: { opacity: 0.6 } }, h('div', { class: 'grow' }, h('div', { class: 't' }, s.name), h('div', { class: 's' }, id === 'souvenirs' ? 'Placez un présentoir dans une boutique pour stocker des souvenirs.' : 'Aucun stockage.')));
        const room = cap - have - pend;
        const order = (q, express) => { const r = game.act('orderStock', id, q, express); if (r.ok) { game.audio.play('coin'); game.emit('toast', { kind: 'delivery', text: express ? `${r.qty} ${s.name.toLowerCase()} livrés immédiatement (−${r.cost} écus).` : `${r.qty} ${s.name.toLowerCase()} commandés (−${r.cost} écus), livraison demain 8 h.` }); panels.render(); } };
        return h('div', { class: 'row', style: { flexDirection: 'column', alignItems: 'stretch' } },
          h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' } }, h('div', { class: 't' }, s.name), h('div', { class: 's' }, `${have} / ${cap}${pend ? ` · +${pend} en livraison` : ''}`)),
          bar(frac),
          h('div', { class: 's' }, `${s.desc} ${s.unitCost} écus l'unité.`),
          h('div', { class: 'btns' },
            h('button', { class: 'btn small', disabled: room < 1, onclick: () => order(10) }, '+10'),
            h('button', { class: 'btn small', disabled: room < 1, onclick: () => order(25) }, '+25'),
            h('button', { class: 'btn small primary', disabled: room < 1, onclick: () => order(room) }, `Remplir (${Math.max(0, room)})`),
            h('button', { class: 'btn small gold', disabled: cap - have < 1, onclick: () => order(Math.min(15, cap - have), true) }, 'Express ×15')));
      }),
      h('div', { class: 'sec' }, 'Réapprovisionnement automatique'),
      h('div', { class: 'row' }, toggle(!!st.autoRestockOn, (on) => { game.act('setAutoRestock', on); panels.render(); }),
        h('div', { class: 'grow' }, h('div', { class: 't' }, 'Commander automatiquement'), h('div', { class: 's' }, manager ? 'Votre gérant passe les commandes chaque matin sans frais.' : 'Chaque matin, recomplète les stocks sous le seuil (+15 % de frais tant que vous n\'avez pas de gérant).'))),
      st.autoRestockOn ? Object.entries(STOCK_TYPES).map(([id, s]) => h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, s.name), h('div', { class: 's' }, 'seuil de commande')), stepper(st.autoRestock[id], (v) => game.act('setRestockThreshold', id, v), { step: 5, min: 0, max: 400 }))) : null,
    ];
  },
};

export const financePanel = {
  title: 'Finances',
  live: true,
  tabs: [['today', 'Aujourd\'hui'], ['history', 'Historique'], ['loan', 'Prêt']],
  render(game, tab, panels) {
    const st = game.state;
    if (tab === 'today') {
      const t = st.ledger.today;
      const tot = ledgerTotals(t);
      const line = (label, v, neg) => [h('span', {}, label), h('b', { style: { color: neg ? '#c0503f' : '#3d7a5a' } }, `${neg ? '−' : '+'}${formatMoney(v)}`)];
      return [
        h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 's' }, 'Trésorerie'), h('div', { class: 't', style: { fontSize: '22px' } }, `${formatMoney(st.money)} écus`)), h('div', { style: { textAlign: 'right' } }, h('div', { class: 's' }, 'Résultat du jour'), h('b', { style: { fontSize: '18px', color: tot.net >= 0 ? '#3d7a5a' : '#c0503f' } }, `${tot.net >= 0 ? '+' : '−'}${formatMoney(Math.abs(tot.net))}`))),
        h('div', { class: 'sec' }, 'Recettes'),
        h('div', { class: 'kv' }, Object.entries(INCOME_CATS).flatMap(([k, n]) => (t.inc[k] ? line(n, t.inc[k]) : []))),
        !Object.keys(t.inc).length ? h('p', { class: 'note' }, 'Aucune recette encore aujourd\'hui : les nuitées sont payées au départ des clients.') : null,
        h('div', { class: 'sec' }, 'Dépenses'),
        h('div', { class: 'kv' }, Object.entries(EXPENSE_CATS).flatMap(([k, n]) => (t.exp[k] ? line(n, t.exp[k], true) : []))),
        h('div', { class: 'sec' }, 'Charges prévues à minuit'),
        h('div', { class: 'kv' },
          h('span', {}, 'Salaires'), h('b', {}, `${formatMoney(salariesCost(st))}`),
          h('span', {}, 'Entretien'), h('b', {}, `${formatMoney(maintenanceCost(st))}`),
          h('span', {}, 'Factures (chauffage, eau...)'), h('b', {}, `${formatMoney(billsCost(st))}`),
          st.loan ? h('span', {}, 'Remboursement du prêt') : null, st.loan ? h('b', {}, `${formatMoney(st.loan.daily)}`) : null),
      ];
    }
    if (tab === 'history') {
      const hist = st.ledger.history.slice(-14);
      const c = h('canvas', { class: 'chart' });
      requestAnimationFrame(() => drawChart(c, hist));
      const last = hist[hist.length - 1];
      return [
        h('div', { class: 'legend' }, h('span', {}, h('i', { style: { background: '#3f7a5a' } }), 'Recettes'), h('span', {}, h('i', { style: { background: '#c0503f' } }), 'Dépenses'), h('span', {}, h('i', { style: { background: '#d9a43a' } }), 'Réputation')),
        c,
        hist.length ? h('div', { class: 'kv', style: { marginTop: '10px' } },
          h('span', {}, 'Bénéfice moyen (7 j)'), h('b', {}, formatMoney(avg(hist.slice(-7).map((d) => d.net)))),
          h('span', {}, 'Meilleure journée'), h('b', {}, formatMoney(Math.max(...hist.map((d) => d.net)))),
          last ? h('span', {}, 'Hier') : null, last ? h('b', {}, `${last.net >= 0 ? '+' : ''}${formatMoney(last.net)}`) : null) : h('p', { class: 'note' }, 'L\'historique apparaît à la fin de la première journée.'),
      ];
    }
    return [
      h('p', { class: 'note' }, 'La banque de la vallée peut avancer des fonds pour accélérer vos travaux. Le remboursement (intérêts compris) est prélevé chaque soir.'),
      st.loan ? h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, `Prêt en cours : ${formatMoney(st.loan.remaining)} écus restants`), h('div', { class: 's' }, `${st.loan.daily} écus/jour · ${st.loan.daysLeft} jours`)), h('button', { class: 'btn small', onclick: () => { const r = game.act('repayLoan'); if (r.ok) { game.audio.play('coin'); panels.render(); } } }, 'Solder')) : null,
      LOAN_OPTIONS.map((o, k) => h('div', { class: 'row' },
        h('div', { class: 'grow' }, h('div', { class: 't' }, `${formatMoney(o.amount)} écus`), h('div', { class: 's' }, `${Math.round(o.rate * 100)} % d'intérêts · ${o.days} jours · ${Math.ceil(o.amount * (1 + o.rate) / o.days)} écus/jour${k > 0 ? ` · palier ${k + 1}` : ''}`)),
        h('button', { class: 'btn small primary', disabled: !!st.loan || st.tier < k + 1 && k > 0, onclick: () => { const r = game.act('takeLoan', k); if (r.ok) { game.audio.play('coin'); panels.render(); } } }, 'Emprunter'))),
    ];
  },
};

function avg(a) { return a.length ? Math.round(a.reduce((s, x) => s + x, 0) / a.length) : 0; }

function drawChart(c, hist) {
  const r = c.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  c.width = r.width * dpr; c.height = r.height * dpr;
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  const W = r.width, H = r.height, pad = 22;
  if (!hist.length) return;
  const max = Math.max(50, ...hist.map((d) => Math.max(d.inc, d.exp)));
  const bw = (W - pad * 2) / hist.length;
  ctx.font = '600 10px Nunito, sans-serif'; ctx.fillStyle = '#9a8670';
  hist.forEach((d, i) => {
    const x = pad + i * bw;
    const hi = (d.inc / max) * (H - pad * 2), he = (d.exp / max) * (H - pad * 2);
    ctx.fillStyle = '#3f7a5a'; ctx.fillRect(x + bw * 0.12, H - pad - hi, bw * 0.36, hi);
    ctx.fillStyle = '#c0503f'; ctx.fillRect(x + bw * 0.5, H - pad - he, bw * 0.36, he);
    ctx.fillStyle = '#9a8670'; ctx.textAlign = 'center'; ctx.fillText(`J${d.day}`, x + bw / 2, H - 6);
  });
  ctx.strokeStyle = '#d9a43a'; ctx.lineWidth = 2; ctx.beginPath();
  hist.forEach((d, i) => { const x = pad + i * bw + bw / 2, y = H - pad - (d.rep / 100) * (H - pad * 2); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
  ctx.stroke();
}

export { BREAKFAST, money, EXPRESS_MULT };
