// Petits utilitaires DOM.
import { formatMoney } from '../core/util.js';

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}
function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function icon(name, cls = 'ic') {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', cls);
  const use = document.createElementNS(ns, 'use');
  use.setAttribute('href', `#i-${name}`);
  svg.appendChild(use);
  return svg;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };

export function money(v, withIcon = true) {
  const span = h('span', { class: 'pr' });
  if (withIcon) span.appendChild(icon('coin'));
  span.appendChild(document.createTextNode(formatMoney(v)));
  return span;
}

export function stars(value, max = 5) {
  const el = h('span', { class: 'stars' });
  for (let i = 1; i <= max; i++) {
    const full = value >= i - 0.25, half = !full && value >= i - 0.75;
    const ic = icon('star');
    if (!full && !half) ic.classList.add('empty');
    if (half) { ic.style.color = 'var(--gold)'; ic.style.opacity = '0.55'; }
    el.appendChild(ic);
  }
  return el;
}

export function bar(frac, cls = '') {
  const v = Math.max(0, Math.min(1, frac));
  const c = cls || (v < 0.25 ? 'bad' : v < 0.5 ? 'warn' : '');
  return h('div', { class: `bar ${c}` }, h('i', { style: { width: `${Math.round(v * 100)}%` } }));
}

export function stepper(value, onChange, { step = 1, min = 0, max = 9999, fmt = (v) => v } = {}) {
  const b = h('b', {}, fmt(value));
  const set = (nv) => { nv = Math.max(min, Math.min(max, nv)); value = nv; b.textContent = fmt(nv); onChange(nv); };
  const rep = (d) => {
    let t, iv;
    const start = (e) => { e.preventDefault(); set(value + d); t = setTimeout(() => { iv = setInterval(() => set(value + d * 2), 70); }, 380); };
    const stop = () => { clearTimeout(t); clearInterval(iv); };
    return { onpointerdown: start, onpointerup: stop, onpointerleave: stop, onpointercancel: stop };
  };
  return h('div', { class: 'stepper' }, h('button', { ...rep(-step), 'aria-label': 'Diminuer' }, '−'), b, h('button', { ...rep(step), 'aria-label': 'Augmenter' }, '+'));
}

export function toggle(on, onChange) {
  const el = h('button', { class: `toggle${on ? ' on' : ''}`, role: 'switch', 'aria-checked': String(!!on) });
  el.addEventListener('click', () => { on = !on; el.classList.toggle('on', on); el.setAttribute('aria-checked', String(on)); onChange(on); });
  return el;
}

export function tabs(list, current, onSelect) {
  return list.map(([id, label]) => h('button', { class: `tab${id === current ? ' on' : ''}`, onclick: () => onSelect(id) }, label));
}

export const isTouch = () => matchMedia('(pointer: coarse)').matches;
export const isNarrow = () => matchMedia('(max-width: 760px)').matches;
