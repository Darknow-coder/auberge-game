// Particules (météo, fumée, vapeur, lucioles...) et éclairage nocturne.
import { iso } from './iso.js';

export class Particles {
  constructor() { this.world = []; this.screen = []; }

  /** Particules liées au monde (fumée, vapeur, étincelles). */
  emitWorld(kind, x, y, z, n = 1) {
    for (let i = 0; i < n; i++) {
      if (this.world.length > 500) return;
      const p = { kind, x, y, z, vx: 0, vy: 0, vz: 0, life: 0, max: 1, r: 2 };
      if (kind === 'smoke') { p.vz = 0.35 + Math.random() * 0.2; p.vx = 0.05 + Math.random() * 0.06; p.vy = -0.04; p.max = 4 + Math.random() * 2; p.r = 3; }
      else if (kind === 'steam') { p.vz = 0.3 + Math.random() * 0.2; p.vx = (Math.random() - 0.5) * 0.1; p.vy = (Math.random() - 0.5) * 0.1; p.max = 2.2; p.r = 3; p.x += (Math.random() - 0.5) * 1.2; p.y += (Math.random() - 0.5) * 1.2; }
      else if (kind === 'sparkle') { p.max = 0.9; p.r = 1.5; }
      else if (kind === 'coin') { p.vz = 0.9; p.max = 1.1; p.r = 3; }
      else if (kind === 'heart') { p.vz = 0.6; p.max = 1.4; p.r = 3; }
      else if (kind === 'dust') { p.vz = 0.25; p.vx = (Math.random() - 0.5) * 0.6; p.vy = (Math.random() - 0.5) * 0.6; p.max = 0.8; p.r = 3; }
      this.world.push(p);
    }
  }

  update(dt, weather, season, hf, view) {
    for (const p of this.world) {
      p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.kind === 'smoke') p.r += dt * 2.2;
      if (p.kind === 'steam') p.r += dt * 2;
    }
    this.world = this.world.filter((p) => p.life < p.max);
    // Météo et ambiance en coordonnées écran
    const { w, h } = view;
    const night = hf < 6 || hf > 21;
    const want = { pluie: 260, orage: 420, neige: 220, tempete: 520 }[weather] || 0;
    const kind = weather === 'neige' || weather === 'tempete' ? 'snow' : want ? 'rain' : null;
    let amb = null, ambN = 0;
    if (!want) {
      if (season === 0 && !night) { amb = 'petal'; ambN = 18; }
      else if (season === 2) { amb = 'leaf'; ambN = 26; }
      else if (season === 1 && night) { amb = 'firefly'; ambN = 40; }
      else if (season === 3 && weather !== 'soleil') { amb = 'snow'; ambN = 50; }
    }
    const count = (k) => this.screen.reduce((s, p) => s + (p.kind === k ? 1 : 0), 0);
    const spawn = (k, n) => {
      for (let i = 0; i < n; i++) {
        const p = { kind: k, x: Math.random() * (w + 200) - 100, y: Math.random() * h, life: 0, max: 99, s: 0.6 + Math.random() * 0.8, ph: Math.random() * 6 };
        if (k === 'rain') { p.vx = -120; p.vy = 900 + Math.random() * 300; p.y = Math.random() * h - h; }
        if (k === 'snow') { p.vx = weather === 'tempete' ? -260 : -20; p.vy = weather === 'tempete' ? 220 : 40 + Math.random() * 40; }
        if (k === 'petal') { p.vx = 30 + Math.random() * 20; p.vy = 25 + Math.random() * 15; p.col = Math.random() < 0.5 ? '#f6c6d6' : '#fff2f6'; }
        if (k === 'leaf') { p.vx = 40 + Math.random() * 30; p.vy = 35 + Math.random() * 20; p.col = ['#d9822b', '#b8502a', '#e3b13a'][Math.floor(Math.random() * 3)]; }
        if (k === 'firefly') { p.vx = 0; p.vy = 0; p.y = h * 0.3 + Math.random() * h * 0.7; }
        this.screen.push(p);
      }
    };
    if (kind) { const c = count(kind); if (c < want) spawn(kind, Math.min(40, want - c)); }
    if (amb) { const c = count(amb); if (c < ambN && Math.random() < 0.3) spawn(amb, 1); }
    for (const p of this.screen) {
      p.life += dt; p.ph += dt;
      if (p.kind === 'firefly') { p.x += Math.sin(p.ph * 0.7) * 12 * dt; p.y += Math.cos(p.ph * 0.9) * 10 * dt; if (p.life > 8) p.max = 0; continue; }
      p.x += (p.vx + (p.kind === 'snow' || p.kind === 'leaf' || p.kind === 'petal' ? Math.sin(p.ph * 2) * 25 : 0)) * dt;
      p.y += p.vy * dt;
      if (p.y > h + 20 || p.x < -120 || p.x > w + 120) p.max = 0;
    }
    this.screen = this.screen.filter((p) => p.life < p.max && (kind || p.kind !== 'rain') && !(p.kind === 'rain' && kind !== 'rain'));
    if (!kind && !amb) this.screen = this.screen.filter((p) => p.kind === 'snow' && p.y < h * 0.3 ? false : true);
  }

  drawWorld(ctx) {
    for (const p of this.world) {
      const [x, y] = iso(p.x, p.y, p.z);
      const a = 1 - p.life / p.max;
      if (p.kind === 'smoke') { ctx.fillStyle = `rgba(210,210,215,${0.35 * a})`; ctx.beginPath(); ctx.arc(x, y, p.r, 0, 7); ctx.fill(); }
      else if (p.kind === 'steam') { ctx.fillStyle = `rgba(255,255,255,${0.32 * a})`; ctx.beginPath(); ctx.arc(x, y, p.r, 0, 7); ctx.fill(); }
      else if (p.kind === 'sparkle') { ctx.fillStyle = `rgba(255,255,255,${0.8 * Math.sin(a * Math.PI)})`; ctx.fillRect(x - 2, y - 0.5, 4, 1); ctx.fillRect(x - 0.5, y - 2, 1, 4); }
      else if (p.kind === 'coin') { ctx.fillStyle = `rgba(226,177,60,${a})`; ctx.beginPath(); ctx.ellipse(x, y, 3 * Math.abs(Math.cos(p.life * 8)) + 0.5, 3, 0, 0, 7); ctx.fill(); }
      else if (p.kind === 'heart') { ctx.fillStyle = `rgba(224,86,107,${a})`; ctx.beginPath(); ctx.arc(x - 1.5, y, 2, 0, 7); ctx.arc(x + 1.5, y, 2, 0, 7); ctx.moveTo(x - 3.4, y + 0.8); ctx.lineTo(x, y + 4.5); ctx.lineTo(x + 3.4, y + 0.8); ctx.fill(); }
      else if (p.kind === 'dust') { ctx.fillStyle = `rgba(200,180,150,${0.5 * a})`; ctx.beginPath(); ctx.arc(x, y, p.r + p.life * 4, 0, 7); ctx.fill(); }
    }
  }

  drawScreen(ctx) {
    for (const p of this.screen) {
      if (p.kind === 'rain') { ctx.strokeStyle = 'rgba(200,215,235,0.45)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - 2.5, p.y + 14); ctx.stroke(); }
      else if (p.kind === 'snow') { ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(p.x, p.y, 1.4 * p.s + 0.6, 0, 7); ctx.fill(); }
      else if (p.kind === 'petal' || p.kind === 'leaf') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.ph * 2); ctx.fillStyle = p.col;
        ctx.beginPath(); ctx.ellipse(0, 0, p.kind === 'leaf' ? 4 : 3, 1.8, 0, 0, 7); ctx.fill(); ctx.restore();
      } else if (p.kind === 'firefly') {
        const a = 0.4 + 0.6 * Math.abs(Math.sin(p.ph * 2));
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 6);
        g.addColorStop(0, `rgba(240,255,150,${a})`); g.addColorStop(1, 'rgba(240,255,150,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, 7); ctx.fill();
      }
    }
  }
}

/** Éclairage : assombrit l'écran puis « perce » des halos chauds autour des sources de lumière. */
export class Lighting {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
  }
  render(target, w, h, dark, tint, lights, worldToScreen, zoom, t) {
    if (dark < 0.02) return;
    const s = 0.5;
    const cw = Math.ceil(w * s), ch = Math.ceil(h * s);
    if (this.canvas.width !== cw || this.canvas.height !== ch) { this.canvas.width = cw; this.canvas.height = ch; }
    const c = this.ctx;
    c.globalCompositeOperation = 'source-over';
    c.clearRect(0, 0, cw, ch);
    c.fillStyle = tint;
    c.globalAlpha = dark;
    c.fillRect(0, 0, cw, ch);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'destination-out';
    for (const L of lights) {
      const [sx, sy] = worldToScreen(L.x, L.y, L.z || 0);
      const fl = L.flicker ? 0.9 + Math.sin(t * 13 + L.x * 3) * 0.05 + Math.sin(t * 7.3 + L.y) * 0.05 : 1;
      const r = L.r * 46 * zoom * fl * s;
      const px = sx * s, py = sy * s;
      if (px < -r || py < -r || px > cw + r || py > ch + r) continue;
      const g = c.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, `rgba(0,0,0,${0.95 * (L.a || 1)})`);
      g.addColorStop(0.5, `rgba(0,0,0,${0.5 * (L.a || 1)})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.beginPath(); c.ellipse(px, py, r, r * 0.62, 0, 0, 7); c.fill();
    }
    target.drawImage(this.canvas, 0, 0, w, h);
    // Halo additif chaud
    target.save();
    target.globalCompositeOperation = 'lighter';
    for (const L of lights) {
      const [sx, sy] = worldToScreen(L.x, L.y, L.z || 0);
      const r = L.r * 30 * zoom;
      if (sx < -r || sy < -r || sx > w + r || sy > h + r) continue;
      const g = target.createRadialGradient(sx, sy, 0, sx, sy, r);
      const a = 0.22 * dark * (L.a || 1);
      g.addColorStop(0, hexA(L.color || '#ffc46a', a));
      g.addColorStop(1, hexA(L.color || '#ffc46a', 0));
      target.fillStyle = g;
      target.beginPath(); target.ellipse(sx, sy, r, r * 0.65, 0, 0, 7); target.fill();
    }
    target.restore();
  }
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
