// Gestionnaire des panneaux latéraux / feuilles mobiles.
import { $, h, clear, isNarrow } from './dom.js';
import { buildPanel } from './panel_build.js';
import { guestsPanel, staffPanel } from './panel_guests.js';
import { managePanel, financePanel } from './panel_manage.js';
import { goalsPanel, progressPanel } from './panel_goals.js';

export const PANELS = { build: buildPanel, guests: guestsPanel, staff: staffPanel, manage: managePanel, finance: financePanel, goals: goalsPanel, progress: progressPanel };

export class Panels {
  constructor(game) {
    this.game = game;
    this.el = $('#panel');
    this.body = $('#panel-body');
    this.current = null;
    this.tabs = {};
    this.sub = {};
    this.refreshT = 0;
    this.interacting = false;
    $('#panel-close').addEventListener('click', () => { game.audio.play('click'); this.close(); });
    for (const b of document.querySelectorAll('#toolbar button')) {
      b.addEventListener('click', () => {
        game.audio.play('page');
        const name = b.dataset.panel;
        if (this.current === name) this.close(); else this.open(name);
      });
    }
    this.body.addEventListener('pointerdown', () => { this.interacting = true; });
    window.addEventListener('pointerup', () => { setTimeout(() => { this.interacting = false; }, 250); });
  }

  narrow() { return isNarrow(); }

  open(name, tab) {
    const def = PANELS[name];
    if (!def) return;
    if (name !== 'build' && this.game.ui.mode !== 'none') this.game.setMode('none');
    this.current = name;
    if (tab) this.tabs[name] = tab;
    this.tabs[name] ||= def.tabs[0][0];
    this.el.classList.remove('hidden');
    this.render();
    document.querySelectorAll('#toolbar button').forEach((b) => b.classList.toggle('on', b.dataset.panel === name));
    this.game.emit('panel', name);
  }

  /** soft : fermeture temporaire pendant la construction sur mobile. */
  close(soft = false) {
    this.el.classList.add('hidden');
    if (!soft && this.current === 'build' && this.game.ui.mode !== 'none') this.game.setMode('none');
    this.current = soft ? this.current : null;
    if (soft) this.hiddenSoft = true;
    document.querySelectorAll('#toolbar button').forEach((b) => b.classList.toggle('on', !soft && b.dataset.panel === this.current));
    this.game.emit('panel', null);
  }

  isOpen() { return !this.el.classList.contains('hidden'); }

  render() {
    const name = this.current;
    if (!name || !this.isOpen()) return;
    const def = PANELS[name];
    const tab = this.tabs[name];
    $('#panel-title').textContent = def.title;
    clear($('#panel-tabs')).append(...def.tabs.map(([id, label]) => h('button', { class: `tab${id === tab ? ' on' : ''}`, onclick: () => { this.game.audio.play('tab'); this.tabs[name] = id; this.body.scrollTop = 0; this.render(); } }, label)));
    const scroll = this.body.scrollTop;
    let content;
    try { content = def.render(this.game, tab, this); } catch (e) { console.error(e); content = h('p', { class: 'note warn' }, 'Erreur d\'affichage.'); }
    clear(this.body);
    const add = (c) => { if (Array.isArray(c)) c.forEach(add); else if (c) this.body.appendChild(c); };
    add(content);
    this.body.scrollTop = scroll;
  }

  update(dt) {
    if (!this.current || !this.isOpen()) return;
    const def = PANELS[this.current];
    if (!def.live) return;
    this.refreshT += dt;
    if (this.refreshT > 1 && !this.interacting && !this.body.matches(':hover select:focus') && document.activeElement?.tagName !== 'SELECT') { this.refreshT = 0; this.render(); }
  }
}
