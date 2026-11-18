// Fenêtres modales : dialogues d'événements, confirmations, menu, nouvelle partie.
import { $, h, icon, clear } from './dom.js';
import { describeDialog } from '../sim/events.js';
import { portrait } from '../render/thumbs.js';
import { formatMoney } from '../core/util.js';
import { clock } from '../sim/time.js';

export class Modals {
  constructor(game) {
    this.game = game;
    this.root = $('#modal-root');
    this.open = 0;
  }

  show(content, { blocking = true, onClose, dismissable = true } = {}) {
    const back = h('div', { class: 'modal-back' });
    const box = h('div', { class: 'modal', role: 'dialog' }, content);
    back.appendChild(box);
    if (dismissable) back.addEventListener('pointerdown', (e) => { if (e.target === back) close(); });
    this.root.appendChild(back);
    if (blocking) this.game.blockers++;
    this.open++;
    let closed = false;
    const close = () => {
      if (closed) return; closed = true;
      back.remove();
      if (blocking) this.game.blockers = Math.max(0, this.game.blockers - 1);
      this.open--;
      if (onClose) onClose();
    };
    back.close = close;
    return close;
  }

  closeAll() { for (const b of [...this.root.children]) b.close && b.close(); }

  /** Dialogue d'événement ou d'histoire (met le jeu en pause). */
  dialog() {
    const st = this.game.state;
    if (!st.dialogs.length || this.dialogOpen) return;
    const d = st.dialogs[0];
    const desc = describeDialog(st, d);
    if (!desc) { st.dialogs.shift(); return; }
    this.dialogOpen = true;
    this.game.audio.play(desc.kind === 'story' ? 'star' : 'bell');
    const g = desc.guest;
    let close;
    const choose = (i) => {
      const text = this.game.act('resolveDialog', i);
      close();
      this.game.audio.play('click');
      if (text && typeof text === 'string') this.game.emit('toast', { kind: desc.kind === 'story' ? 'story' : 'event', text, duration: 9000 });
    };
    close = this.show([
      h('div', { class: 'storyhead' },
        g ? h('div', { class: 'portrait' }, portrait(g.members[0].look, 72, 72, { winter: clock(st.time).seasonIndex === 3 })) : null,
        h('div', {}, h('div', { class: 'kicker' }, desc.kind === 'story' ? 'Histoire d\'habitué' : 'Événement'), h('h2', {}, desc.title))),
      h('p', { class: 'lead' }, desc.text),
      h('div', { class: 'choices' }, desc.choices.map((c, i) => h('button', { class: `btn ${i === 0 ? 'primary' : ''}`, onclick: () => choose(i) }, h('span', {}, c.label), c.cost ? h('span', { style: { opacity: 0.85 } }, `−${c.cost} écus`) : null))),
    ], { dismissable: false, onClose: () => { this.dialogOpen = false; } });
  }

  confirm({ title, text, ok = 'Confirmer', danger = false, fn }) {
    const close = this.show([
      h('h2', {}, title),
      text ? h('p', { class: 'lead' }, text) : null,
      h('div', { class: 'btns', style: { justifyContent: 'flex-end', marginTop: '6px' } },
        h('button', { class: 'btn', onclick: () => close() }, 'Annuler'),
        h('button', { class: `btn ${danger ? 'danger' : 'primary'}`, onclick: () => { close(); fn(); } }, ok)),
    ]);
  }

  newGame(onStart) {
    const input = h('input', { type: 'text', value: "L'Auberge des Sommets", maxLength: 40 });
    const close = this.show([
      h('h2', {}, 'Nouvelle auberge'),
      h('p', { class: 'lead' }, 'Vous venez d\'hériter d\'une petite auberge au pied des montagnes : une réception, une salle commune et trois chambres. À vous d\'en faire une adresse réputée !'),
      h('label', { class: 'field' }, 'Nom de votre établissement', input),
      h('div', { class: 'btns', style: { justifyContent: 'flex-end' } },
        h('button', { class: 'btn', onclick: () => close() }, 'Retour'),
        h('button', { class: 'btn gold', onclick: () => { close(); onStart(input.value.trim()); } }, 'Ouvrir l\'auberge')),
    ], { blocking: false });
    setTimeout(() => { input.focus(); input.select(); }, 50);
  }

  menu() {
    const g = this.game;
    const s = g.settings;
    const range = (key, label) => {
      const el = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: s[key] });
      el.addEventListener('input', () => { s[key] = +el.value; g.saveSettings(); });
      return h('label', { class: 'field' }, label, el);
    };
    const file = h('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' } });
    file.addEventListener('change', async () => {
      if (!file.files[0]) return;
      try { await g.importSave(file.files[0]); close(); g.emit('toast', { kind: 'good', text: 'Sauvegarde importée.' }); }
      catch (e) { g.emit('toast', { kind: 'bad', text: 'Fichier de sauvegarde invalide.' }); }
    });
    const last = g.lastSaved ? new Date(g.lastSaved).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—';
    const close = this.show([
      h('h2', {}, 'Menu'),
      h('p', { class: 'note' }, `Sauvegarde automatique activée · dernière à ${last}.`),
      h('div', { class: 'btns' },
        h('button', { class: 'btn primary', onclick: () => { if (g.save()) { g.audio.play('chime'); g.emit('toast', { kind: 'good', text: 'Partie sauvegardée.' }); close(); } } }, icon('save'), 'Sauvegarder'),
        h('button', { class: 'btn', onclick: () => g.exportSave() }, 'Exporter'),
        h('button', { class: 'btn', onclick: () => file.click() }, 'Importer'), file),
      h('div', { class: 'sec' }, 'Son'),
      range('music', 'Musique'), range('sfx', 'Effets sonores'), range('amb', 'Ambiance (vent, pluie, oiseaux)'),
      h('div', { class: 'sec' }, 'Affichage'),
      h('div', { class: 'btns' },
        h('button', { class: `btn small${s.quality === 'high' ? ' primary' : ''}`, onclick: () => { s.quality = 'high'; g.saveSettings(); close(); this.menu(); } }, 'Qualité élevée'),
        h('button', { class: `btn small${s.quality === 'low' ? ' primary' : ''}`, onclick: () => { s.quality = 'low'; g.saveSettings(); close(); this.menu(); } }, 'Économie (mobiles modestes)'),
        h('button', { class: 'btn small', onclick: () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.(); } }, 'Plein écran'),
        h('button', { class: `btn small${s.tips ? ' primary' : ''}`, onclick: () => { s.tips = !s.tips; g.saveSettings(); close(); this.menu(); } }, s.tips ? 'Conseils : oui' : 'Conseils : non')),
      h('div', { class: 'sec' }, 'Commandes'),
      h('p', { class: 'note' }, 'Glisser : déplacer la vue · Molette / pincer : zoom · Espace : pause · 1-2-3 : vitesse · R : tourner un meuble · Échap : annuler · Touchez un client, un employé, une pièce ou un meuble pour voir sa fiche.'),
      h('div', { class: 'sec' }, 'Journal'),
      h('div', { style: { maxHeight: '160px', overflowY: 'auto', fontSize: '12.5px' } }, g.state.log.slice(0, 30).map((l) => h('div', { style: { padding: '3px 0', borderBottom: '1px dashed var(--line)' } }, h('b', {}, `J${clock(l.t).day} ${String(clock(l.t).hour).padStart(2, '0')}h `), l.text))),
      h('div', { class: 'btns', style: { justifyContent: 'space-between', marginTop: '14px' } },
        h('button', { class: 'btn danger', onclick: () => { close(); this.confirm({ title: 'Recommencer une partie ?', text: 'La partie actuelle sera remplacée (pensez à l\'exporter si vous voulez la garder).', ok: 'Nouvelle partie', danger: true, fn: () => this.newGame((name) => g.newGame(name)) }); } }, 'Nouvelle partie'),
        h('button', { class: 'btn primary', onclick: () => close() }, 'Reprendre')),
    ]);
  }

  /** Bilan de fin de journée (non bloquant). */
  report(r) {
    const refusedTot = Object.values(r.refused || {}).reduce((a, b) => a + b, 0);
    let tip = '';
    if (r.refused.full >= 2) tip = 'Plusieurs voyageurs sont repartis faute de chambre adaptée : construisez-en de nouvelles !';
    else if (r.refused.price >= 2) tip = 'Certains voyageurs trouvent vos prix trop élevés.';
    else if (r.refused.wait >= 1) tip = 'Des clients ont perdu patience à la réception : un(e) réceptionniste aiderait.';
    else if (r.net < 0) tip = 'Journée déficitaire : surveillez salaires et stocks.';
    const close = this.show([
      h('div', { class: 'kicker', style: { color: 'var(--forest-2)' } }, `Fin du jour ${r.day}`),
      h('h2', {}, r.net >= 0 ? 'Belle journée !' : 'Journée difficile'),
      h('div', { class: 'report-grid' },
        h('div', { class: 'cell' }, h('small', {}, 'Recettes'), h('b', { style: { color: '#3d7a5a' } }, `+${formatMoney(r.inc)}`)),
        h('div', { class: 'cell' }, h('small', {}, 'Dépenses'), h('b', { style: { color: '#c0503f' } }, `−${formatMoney(r.exp)}`)),
        h('div', { class: 'cell' }, h('small', {}, 'Groupes arrivés'), h('b', {}, r.arrivals)),
        h('div', { class: 'cell' }, h('small', {}, 'Refusés / partis'), h('b', {}, refusedTot)),
        h('div', { class: 'cell' }, h('small', {}, 'Avis du jour'), h('b', {}, r.reviews ? `${r.avgStars.toFixed(1).replace('.', ',')} ★ (${r.reviews})` : '—')),
        h('div', { class: 'cell' }, h('small', {}, 'Trésorerie'), h('b', {}, formatMoney(r.money)))),
      tip ? h('p', { class: 'note warn' }, tip) : null,
      h('div', { class: 'btns', style: { justifyContent: 'flex-end' } }, h('button', { class: 'btn primary', onclick: () => close() }, 'Continuer')),
    ], { blocking: false });
    setTimeout(close, 9000);
  }
}
