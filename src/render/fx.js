// Effets visuels : éclats, étincelles, faisceaux de lignes, textes flottants, confettis,
// blocs qui disparaissent et gemmes qui s'envolent vers les objectifs.

const rand = (a, b) => a + Math.random() * (b - a);
const easeOutBack = (t) => { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const RAINBOW = ['#ff4d6d', '#ffa62b', '#ffe14d', '#27d07d', '#3dc4ff', '#7b6bff', '#d45cff'];

export class Fx {
  constructor() {
    this.parts = [];
    this.texts = [];
    this.beams = [];
    this.dying = [];
    this.flyers = [];
    this.rings = [];
    this.shakeAmp = 0;
    this.shakeT = 0;
    this.flashA = 0;
    this.flashColor = '#ffffff';
    this.reduced = false;
  }

  get busy() {
    return this.parts.length + this.texts.length + this.beams.length + this.dying.length + this.flyers.length + this.rings.length > 0 || this.shakeAmp > 0.2 || this.flashA > 0.01;
  }

  clear() {
    this.parts.length = this.texts.length = this.beams.length = this.dying.length = this.flyers.length = this.rings.length = 0;
    this.shakeAmp = 0;
    this.flashA = 0;
  }

  shake(amp) { if (!this.reduced) this.shakeAmp = Math.max(this.shakeAmp, amp); }
  flash(a, color = '#ffffff') { this.flashA = Math.max(this.flashA, this.reduced ? a * 0.4 : a); this.flashColor = color; }

  shards(x, y, color, n, size) {
    if (this.reduced) n = Math.ceil(n / 3);
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), sp = rand(60, 260);
      this.parts.push({ k: 'shard', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - rand(40, 160), g: 620, life: 0, max: rand(0.45, 0.85), size: size * rand(0.12, 0.26), rot: rand(0, 6), vr: rand(-10, 10), color });
    }
  }

  sparks(x, y, n, colors, spread = 1) {
    if (this.reduced) n = Math.ceil(n / 3);
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), sp = rand(30, 200) * spread;
      this.parts.push({ k: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0, life: 0, max: rand(0.4, 0.9), size: rand(1.5, 3.5), color: colors[i % colors.length] });
    }
  }

  confetti(w, n = 90) {
    if (this.reduced) n = 25;
    for (let i = 0; i < n; i++) {
      this.parts.push({ k: 'confetti', x: rand(0, w), y: rand(-80, -10), vx: rand(-40, 40), vy: rand(80, 220), g: 60, life: 0, max: rand(2.2, 3.6), size: rand(5, 9), rot: rand(0, 6), vr: rand(-6, 6), color: RAINBOW[i % RAINBOW.length], ph: rand(0, 6) });
    }
  }

  ring(x, y, r0, r1, color, dur = 0.5, width = 4) {
    this.rings.push({ x, y, r0, r1, color, t: 0, dur, width });
  }

  beam(x, y, w, h, color, delay = 0, rainbow = false) {
    this.beams.push({ x, y, w, h, color, t: -delay, dur: 0.45, rainbow });
  }

  die(x, y, size, sprite, pad, delay) {
    this.dying.push({ x, y, size, sprite, pad, t: -delay, dur: 0.32 });
  }

  fly(sprite, size, x0, y0, x1, y1, delay, onArrive) {
    this.flyers.push({ sprite, size, x0, y0, x1, y1, t: -delay, dur: 0.75, onArrive });
  }

  /** opts : size, color, rainbow, dur, dy (montée), stroke */
  text(text, x, y, opts = {}) {
    this.texts.push({ text, x, y, t: -(opts.delay || 0), size: opts.size || 28, color: opts.color || '#fff', rainbow: !!opts.rainbow, dur: opts.dur || 1.1, dy: opts.dy ?? 40, weight: opts.weight || 700 });
  }

  update(dt) {
    for (const p of this.parts) {
      p.life += dt;
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.k === 'confetti') p.x += Math.sin(p.life * 4 + p.ph) * 40 * dt;
      if (p.rot != null) p.rot += p.vr * dt;
      if (p.k === 'spark') { p.vx *= 1 - 2.5 * dt; p.vy *= 1 - 2.5 * dt; }
    }
    this.parts = this.parts.filter((p) => p.life < p.max);
    for (const list of [this.texts, this.beams, this.dying, this.rings]) for (const o of list) o.t += dt;
    this.texts = this.texts.filter((o) => o.t < o.dur);
    this.beams = this.beams.filter((o) => o.t < o.dur);
    this.dying = this.dying.filter((o) => o.t < o.dur);
    this.rings = this.rings.filter((o) => o.t < o.dur);
    for (const f of this.flyers) {
      f.t += dt;
      if (f.t >= f.dur && !f.done) { f.done = true; if (f.onArrive) f.onArrive(); }
    }
    this.flyers = this.flyers.filter((f) => !f.done);
    this.shakeT += dt;
    this.shakeAmp *= Math.pow(0.0015, dt);
    if (this.shakeAmp < 0.2) this.shakeAmp = 0;
    this.flashA *= Math.pow(0.004, dt);
  }

  shakeOffset() {
    if (!this.shakeAmp) return [0, 0];
    return [Math.sin(this.shakeT * 61) * this.shakeAmp, Math.cos(this.shakeT * 53) * this.shakeAmp];
  }

  /** Effets dessinés au niveau de la grille (sous la pièce tenue). */
  drawBoardLayer(ctx) {
    for (const d of this.dying) {
      if (d.t < 0) {
        ctx.drawImage(d.sprite, d.x - d.pad, d.y - d.pad, d.size + 2 * d.pad, d.size + 2 * d.pad);
        continue;
      }
      const k = d.t / d.dur;
      const sc = k < 0.25 ? 1 + k * 0.6 : 1.15 * (1 - easeOutCubic((k - 0.25) / 0.75));
      const cx = d.x + d.size / 2, cy = d.y + d.size / 2, s = (d.size + 2 * d.pad) * sc;
      ctx.globalAlpha = 1 - k * 0.5;
      ctx.drawImage(d.sprite, cx - s / 2, cy - s / 2, s, s);
      if (k < 0.4) {
        ctx.globalAlpha = (0.4 - k) * 2;
        ctx.fillStyle = '#fff';
        const w = d.size * sc * 0.9;
        ctx.fillRect(cx - w / 2, cy - w / 2, w, w);
      }
      ctx.globalAlpha = 1;
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of this.beams) {
      if (b.t < 0) continue;
      const k = b.t / b.dur;
      const a = (1 - k) * 0.9;
      const grow = 1 + k * 0.25;
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      const w = b.w * (b.w > b.h ? 1 : grow), h = b.h * (b.h > b.w ? 1 : grow);
      let fill;
      if (b.rainbow) {
        fill = b.w > b.h ? ctx.createLinearGradient(b.x, 0, b.x + b.w, 0) : ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
        RAINBOW.forEach((c, i) => fill.addColorStop(i / (RAINBOW.length - 1), c));
      } else fill = b.color;
      ctx.globalAlpha = a;
      ctx.fillStyle = fill;
      ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
      ctx.globalAlpha = a * 0.8;
      ctx.fillStyle = '#ffffff';
      const t = Math.min(w, h) * 0.18;
      if (b.w > b.h) ctx.fillRect(cx - w / 2, cy - t / 2, w, t);
      else ctx.fillRect(cx - t / 2, cy - h / 2, t, h);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  /** Effets au-dessus de tout. */
  drawTopLayer(ctx, w, h) {
    ctx.save();
    for (const r of this.rings) {
      const k = easeOutCubic(r.t / r.dur);
      ctx.globalAlpha = 1 - r.t / r.dur;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width * (1 - k * 0.6);
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * k, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const p of this.parts) {
      const k = p.life / p.max;
      ctx.globalAlpha = p.k === 'confetti' ? Math.min(1, (1 - k) * 3) : 1 - k * k;
      if (p.k === 'spark') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - k * 0.5), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      } else {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        const s = p.size;
        if (p.k === 'confetti') ctx.fillRect(-s / 2, -s / 4, s, s / 2 * (0.6 + 0.4 * Math.sin(p.life * 9 + p.ph)));
        else ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
    for (const f of this.flyers) {
      if (f.t < 0) continue;
      const k = easeOutCubic(Math.min(1, f.t / f.dur));
      const mx = (f.x0 + f.x1) / 2, my = Math.min(f.y0, f.y1) - 80;
      const x = (1 - k) * (1 - k) * f.x0 + 2 * (1 - k) * k * mx + k * k * f.x1;
      const y = (1 - k) * (1 - k) * f.y0 + 2 * (1 - k) * k * my + k * k * f.y1;
      const s = f.size * (1 - k * 0.4);
      ctx.drawImage(f.sprite, x - s / 2, y - s / 2, s, s);
    }
    for (const o of this.texts) {
      if (o.t < 0) continue;
      const k = o.t / o.dur;
      const pop = o.t < 0.3 ? easeOutBack(Math.min(1, o.t / 0.3)) : 1;
      const alpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      const y = o.y - o.dy * easeOutCubic(k);
      ctx.save();
      ctx.translate(o.x, y);
      ctx.scale(pop, pop);
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.font = `${o.weight} ${o.size}px Fredoka, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(3, o.size * 0.16);
      ctx.strokeStyle = 'rgba(10, 6, 30, 0.75)';
      ctx.strokeText(o.text, 0, 0);
      if (o.rainbow) {
        const tw = ctx.measureText(o.text).width;
        const g = ctx.createLinearGradient(-tw / 2, 0, tw / 2, 0);
        const shift = (o.t * 0.6) % 1;
        RAINBOW.forEach((c, i) => g.addColorStop(((i / (RAINBOW.length - 1)) + shift) % 1, c));
        ctx.fillStyle = g;
      } else ctx.fillStyle = o.color;
      ctx.fillText(o.text, 0, 0);
      ctx.restore();
    }
    if (this.flashA > 0.01) {
      ctx.globalAlpha = this.flashA;
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
  }
}
