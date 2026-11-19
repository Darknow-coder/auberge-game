// Sons et musique synthétisés avec WebAudio (aucun fichier audio).
// Les sons de lignes montent d'une note à chaque combo : la tension monte avec la série.

const PENTA = [0, 2, 4, 7, 9]; // gamme pentatonique majeure
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
/** Note n de la gamme pentatonique à partir de `root` (midi). */
const penta = (root, n) => root + 12 * Math.floor(n / 5) + PENTA[((n % 5) + 5) % 5];

export class Sound {
  constructor() {
    this.ctx = null;
    this.sfxOn = true;
    this.musicOn = true;
    this.music = null;
  }

  /** À appeler lors d'un geste de l'utilisateur (règle des navigateurs). */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.ctx = new AC(); } catch { return; }
    const c = this.ctx;
    this.master = c.createDynamicsCompressor();
    this.master.threshold.value = -14;
    this.master.ratio.value = 4;
    this.master.connect(c.destination);
    this.out = c.createGain();
    this.out.gain.value = 0.9;
    this.out.connect(this.master);
    this.sfx = c.createGain();
    this.sfx.gain.value = this.sfxOn ? 1 : 0;
    this.sfx.connect(this.out);
    this.mus = c.createGain();
    this.mus.gain.value = this.musicOn ? 0.55 : 0;
    this.mus.connect(this.out);
    this.reverb = c.createConvolver();
    this.reverb.buffer = this.impulse(2.4);
    this.revGain = c.createGain();
    this.revGain.gain.value = 0.32;
    this.reverb.connect(this.revGain);
    this.revGain.connect(this.out);
    this.noiseBuf = this.noise(1);
    if (this.musicOn) this.startMusic();
  }

  impulse(sec) {
    const c = this.ctx, len = Math.floor(c.sampleRate * sec);
    const buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    return buf;
  }

  noise(sec) {
    const c = this.ctx, len = Math.floor(c.sampleRate * sec);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  setSfx(on) {
    this.sfxOn = on;
    if (this.sfx) this.sfx.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.02);
  }

  setMusic(on) {
    this.musicOn = on;
    if (!this.ctx) return;
    this.mus.gain.setTargetAtTime(on ? 0.55 : 0, this.ctx.currentTime, 0.3);
    if (on) this.startMusic();
    else this.stopMusic();
  }

  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {}); }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); }

  get ready() { return !!this.ctx && this.sfxOn; }
  get now() { return this.ctx.currentTime; }

  // ------------------------------------------------------------ voix de base
  tone({ f, t = 0, dur = 0.3, type = 'sine', gain = 0.2, attack = 0.004, f2 = null, rev = 0.2, dest = null, q = null }) {
    const c = this.ctx, start = this.now + t;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, start);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    let node = o;
    if (q) {
      const fl = c.createBiquadFilter();
      fl.type = 'lowpass';
      fl.frequency.value = q;
      o.connect(fl);
      node = fl;
    }
    node.connect(g);
    g.connect(dest || this.sfx);
    if (rev) {
      const s = c.createGain();
      s.gain.value = rev;
      g.connect(s);
      s.connect(this.reverb);
    }
    o.start(start);
    o.stop(start + dur + 0.05);
  }

  /** Cloche cristalline : fondamentale + partiel inharmonique. */
  bell(f, t = 0, gain = 0.16, dur = 0.9, dest = null) {
    this.tone({ f, t, dur, gain, type: 'sine', rev: 0.35, dest });
    this.tone({ f: f * 2.76, t, dur: dur * 0.45, gain: gain * 0.28, type: 'sine', rev: 0.3, dest });
    this.tone({ f: f * 5.4, t, dur: dur * 0.18, gain: gain * 0.1, type: 'sine', rev: 0.2, dest });
  }

  whoosh({ t = 0, dur = 0.3, from = 400, to = 3000, gain = 0.12, type = 'bandpass' }) {
    const c = this.ctx, start = this.now + t;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const fl = c.createBiquadFilter();
    fl.type = type;
    fl.Q.value = 1.2;
    fl.frequency.setValueAtTime(from, start);
    fl.frequency.exponentialRampToValueAtTime(to, start + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(fl);
    fl.connect(g);
    g.connect(this.sfx);
    src.start(start);
    src.stop(start + dur + 0.05);
  }

  // ------------------------------------------------------------ effets
  tap() { if (this.ready) this.tone({ f: 1400, dur: 0.05, gain: 0.05, type: 'triangle', rev: 0 }); }
  pick() { if (this.ready) this.tone({ f: 880, f2: 1320, dur: 0.07, gain: 0.07, type: 'triangle', rev: 0.05 }); }
  /** Anticipation : la pièce tenue complèterait une ligne. */
  preview() { if (this.ready) this.tone({ f: 1760, dur: 0.12, gain: 0.025, type: 'sine', rev: 0.4 }); }
  invalid() { if (this.ready) this.tone({ f: 190, f2: 120, dur: 0.16, gain: 0.14, type: 'triangle', rev: 0 }); }

  place(n = 3) {
    if (!this.ready) return;
    const base = 260 - n * 12 + Math.random() * 20;
    this.tone({ f: base, f2: base * 0.6, dur: 0.09, gain: 0.22, type: 'sine', rev: 0.05 });
    this.tone({ f: base * 3.1, dur: 0.035, gain: 0.05, type: 'triangle', rev: 0 });
  }

  clear(lines, combo, pures) {
    if (!this.ready) return;
    const root = 72;
    const step = Math.min(combo - 1, 10);
    const count = Math.min(2 + lines, 7);
    for (let i = 0; i < count; i++) this.bell(midi(penta(root, step + i)), i * 0.055, 0.13);
    this.whoosh({ dur: 0.35, from: 600, to: 5000, gain: 0.05 + lines * 0.015 });
    if (pures) {
      for (let i = 0; i < 9; i++) this.tone({ f: midi(penta(84, i + step)), t: 0.12 + i * 0.03, dur: 0.35, gain: 0.05, type: 'sine', rev: 0.5 });
    }
    if (lines >= 3) this.tone({ f: 55, f2: 40, dur: 0.5, gain: 0.25, type: 'sine', rev: 0.1 });
  }

  comboEnd() { if (this.ready) this.tone({ f: 520, f2: 330, dur: 0.25, gain: 0.05, type: 'triangle', rev: 0.2 }); }

  boardClear() {
    if (!this.ready) return;
    [60, 64, 67, 72, 76].forEach((m, i) => this.bell(midi(m), i * 0.07, 0.12, 1.6));
    this.whoosh({ t: 0.05, dur: 0.8, from: 300, to: 8000, gain: 0.08 });
  }

  power() {
    if (!this.ready) return;
    this.tone({ f: 330, f2: 1320, dur: 0.35, gain: 0.07, type: 'sawtooth', q: 2500, rev: 0.3 });
    this.bell(midi(88), 0.3, 0.1);
    this.bell(midi(91), 0.38, 0.08);
  }

  rotate() { if (this.ready) { this.tone({ f: 600, f2: 950, dur: 0.12, gain: 0.08, type: 'triangle', rev: 0.1 }); } }

  reroll() {
    if (!this.ready) return;
    this.whoosh({ dur: 0.22, from: 500, to: 4000, gain: 0.12 });
    this.whoosh({ t: 0.16, dur: 0.22, from: 700, to: 5000, gain: 0.1 });
    this.bell(midi(84), 0.3, 0.08);
  }

  bomb() {
    if (!this.ready) return;
    this.whoosh({ dur: 0.7, from: 3000, to: 120, gain: 0.35, type: 'lowpass' });
    this.tone({ f: 90, f2: 35, dur: 0.6, gain: 0.45, type: 'sine', rev: 0.15 });
  }

  stuck() { if (this.ready) { this.tone({ f: 330, dur: 0.3, gain: 0.08, type: 'triangle' }); this.tone({ f: 311, t: 0.18, dur: 0.4, gain: 0.08, type: 'triangle' }); } }

  gameOver() {
    if (!this.ready) return;
    [67, 64, 60, 55].forEach((m, i) => this.tone({ f: midi(m), t: i * 0.18, dur: 0.6, gain: 0.1, type: 'triangle', rev: 0.4, q: 2000 }));
  }

  record() {
    if (!this.ready) return;
    [72, 76, 79, 84, 88].forEach((m, i) => this.tone({ f: midi(m), t: i * 0.08, dur: 0.5, gain: 0.09, type: 'triangle', rev: 0.3 }));
    this.bell(midi(96), 0.45, 0.1, 1.2);
  }

  star(i) { if (this.ready) this.bell(midi(penta(79, i * 2)), 0, 0.15, 1); }
  win() { if (this.ready) [60, 64, 67, 72].forEach((m, i) => this.bell(midi(m + 12), i * 0.09, 0.12, 1.2)); }
  lose() { if (this.ready) [64, 60].forEach((m, i) => this.tone({ f: midi(m), t: i * 0.22, dur: 0.6, gain: 0.09, type: 'triangle', rev: 0.4 })); }
  levelUp() { if (this.ready) for (let i = 0; i < 6; i++) this.bell(midi(penta(76, i)), i * 0.06, 0.1); }
  trophy() { if (this.ready) { this.bell(midi(88), 0, 0.12); this.bell(midi(93), 0.12, 0.12); } }
  gem() { if (this.ready) this.bell(midi(96 + Math.floor(Math.random() * 3) * 2), 0, 0.07, 0.5); }

  // ------------------------------------------------------------ musique générative
  startMusic() {
    if (!this.ctx || this.music) return;
    const prog = [[57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62]]; // Am F C G
    const beat = 60 / 74;
    let next = this.now + 0.2;
    let step = 0;
    const tick = () => {
      if (!this.ctx) return;
      while (next < this.now + 0.6) {
        const bar = Math.floor(step / 8);
        const chord = prog[Math.floor(bar / 2) % prog.length];
        const t = next - this.now;
        if (step % 16 === 0) {
          for (const m of chord) {
            this.tone({ f: midi(m), t, dur: beat * 16, gain: 0.03, attack: 1.4, type: 'triangle', q: 900, rev: 0.6, dest: this.mus });
            this.tone({ f: midi(m) * 1.004, t, dur: beat * 16, gain: 0.02, attack: 1.6, type: 'sine', rev: 0.6, dest: this.mus });
          }
          this.tone({ f: midi(chord[0] - 24), t, dur: beat * 8, gain: 0.05, attack: 0.3, type: 'sine', rev: 0.1, dest: this.mus });
        }
        if (step % 16 === 8) this.tone({ f: midi(chord[0] - 24), t, dur: beat * 8, gain: 0.04, attack: 0.3, type: 'sine', rev: 0.1, dest: this.mus });
        if (Math.random() < (step % 2 ? 0.18 : 0.38)) {
          const tones = chord.map((m) => m + 12).concat([chord[0] + 24, chord[2] + 12 + 2]);
          const m = tones[Math.floor(Math.random() * tones.length)];
          this.bell(midi(m), t, 0.035, 1.4, this.mus);
        }
        next += beat / 2;
        step++;
      }
    };
    tick();
    this.music = setInterval(tick, 150);
  }

  stopMusic() {
    if (this.music) clearInterval(this.music);
    this.music = null;
  }
}
