// Notifications éphémères.
import { $, h, icon } from './dom.js';

const ICONS = { review: 'star', refuse: 'warn', warn: 'warn', bad: 'warn', checkin: 'bell', good: 'heart', story: 'heart', event: 'info', delivery: 'leaf', objective: 'target', tier: 'mountain', season: 'leaf', info: 'info' };

export class Toasts {
  constructor(game) {
    this.game = game;
    this.root = $('#toasts');
    this.recent = new Map();
  }

  show({ kind = 'info', text, html, onClick, duration, key, action }) {
    if (!text && !html) return;
    const k = key || text;
    const now = performance.now();
    if (this.recent.has(k) && now - this.recent.get(k) < (key ? 20000 : 1500)) return;
    this.recent.set(k, now);
    const body = h('div', { class: 'grow' });
    if (html) body.innerHTML = html; else body.textContent = text;
    if (action) body.appendChild(h('div', { style: { marginTop: '6px' } }, h('button', { class: 'btn small gold', onclick: (e) => { e.stopPropagation(); action.fn(); el.remove(); } }, action.label)));
    const el = h('div', { class: `toast ${kind}` }, icon(ICONS[kind] || 'info'), body);
    el.addEventListener('click', () => { if (onClick) onClick(); this.dismiss(el); });
    this.root.prepend(el);
    while (this.root.children.length > 5) this.root.lastChild.remove();
    const d = duration || (kind === 'review' || kind === 'story' || kind === 'tier' ? 8000 : action ? 9000 : 5200);
    setTimeout(() => this.dismiss(el), d);
  }

  dismiss(el) {
    if (!el.isConnected) return;
    el.classList.add('out');
    setTimeout(() => el.remove(), 300);
  }
}
