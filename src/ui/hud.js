// HUD : trésorerie, réputation, date, météo, vitesse.
import { $, icon, stars, clear } from './dom.js';
import { clock, formatTime } from '../sim/time.js';
import { TIERS } from '../data/progression.js';
import { formatMoney } from '../core/util.js';
import { WEATHER_ICON, weatherName } from './labels.js';
import { ledgerTotals } from '../sim/economy.js';

export class Hud {
  constructor(game) {
    this.game = game;
    this.el = $('#hud');
    this.shownMoney = null;
    this.lastKey = '';
    for (const b of this.el.querySelectorAll('.speed button')) {
      b.addEventListener('click', () => { game.audio.play('click'); game.setSpeed(+b.dataset.speed); });
    }
    game.on('speed', (s) => this.el.querySelectorAll('.speed button').forEach((b) => b.classList.toggle('on', +b.dataset.speed === s)));
  }

  update(dt) {
    const st = this.game.state;
    if (!st) return;
    // Argent animé
    const target = Math.round(st.money);
    if (this.shownMoney === null) this.shownMoney = target;
    const diff = target - this.shownMoney;
    if (Math.abs(diff) > 0) this.shownMoney += Math.abs(diff) < 2 ? diff : diff * Math.min(1, dt * 8);
    $('#hud-money-val').textContent = formatMoney(this.shownMoney);
    $('#hud-money').classList.toggle('negative', st.money < 0);
    const net = Math.round(ledgerTotals(st.ledger.today).net);
    const d = $('#hud-money-delta');
    d.textContent = net ? `${net > 0 ? '+' : ''}${formatMoney(net)} auj.` : '';
    d.className = net > 0 ? 'up' : net < 0 ? 'down' : '';
    const c = clock(st.time);
    $('#hud-time').textContent = formatTime(st.time);
    $('#hud-date').textContent = `Jour ${c.dayOfSeason} · ${c.season.name}${c.year > 1 ? ` · An ${c.year}` : ''}`;
    const night = c.hf < 6 || c.hf > 21;
    const wic = night && (st.weather.today === 'soleil' || st.weather.today === 'nuages') ? 'moon' : WEATHER_ICON[st.weather.today] || 'sun';
    const use = $('#hud-weather-ic use');
    if (use.getAttribute('href') !== `#i-${wic}`) use.setAttribute('href', `#i-${wic}`);
    $('#hud-weather-ic').parentElement.parentElement.title = `${weatherName(st.weather.today)} — demain : ${weatherName(st.weather.tomorrow)}`;
    $('#hud-guests-val').textContent = st.guests.filter((g) => g.roomId).reduce((s, g) => s + g.size, 0);
    const key = `${Math.round(st.reputation.value)}|${st.tier}|${st.innName}`;
    if (key !== this.lastKey) {
      this.lastKey = key;
      const sv = st.reputation.value / 20;
      clear($('#hud-stars')).append(...stars(sv).childNodes);
      $('#hud-rep-val').textContent = sv.toFixed(1).replace('.', ',');
      $('#hud-tier').textContent = st.tier;
      $('#hud-name').textContent = st.innName;
      $('#hud-tiername').textContent = TIERS[st.tier].name;
    }
  }
}
