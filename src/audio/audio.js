// Musique générative, ambiances et bruitages synthétisés (WebAudio, aucun fichier).

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
// Ré majeur : progression I – vi – IV – V
const CHORDS = [[62, 66, 69], [59, 62, 66], [55, 59, 62], [57, 61, 64]];
const PENTA = [62, 64, 66, 69, 71, 74, 76, 78, 81, 83];

export class GameAudio {
  constructor(settings) {
    this.ctx = null;
    this.vol = { music: settings.music ?? 0.45, sfx: settings.sfx ?? 0.7, amb: settings.amb ?? 0.5 };
    this.env = { hour: 9, season: 0, weather: 'soleil', night: false };
    this.beat = 0;
    this.lastSfx = {};
  }

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(ctx.destination);
    this.musicBus = ctx.createGain(); this.musicBus.gain.value = this.vol.music; this.musicBus.connect(this.master);
    this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = this.vol.sfx; this.sfxBus.connect(this.master);
    this.ambBus = ctx.createGain(); this.ambBus.gain.value = this.vol.amb; this.ambBus.connect(this.master);
    // écho doux pour la musique
    this.delay = ctx.createDelay(1.5); this.delay.delayTime.value = 0.42;
    const fb = ctx.createGain(); fb.gain.value = 0.28;
    const wet = ctx.createGain(); wet.gain.value = 0.35;
    this.delay.connect(fb); fb.connect(this.delay); this.delay.connect(wet); wet.connect(this.musicBus);
    this.noise = this.makeNoise();
    this.startAmbience();
    this.nextBeat = ctx.currentTime + 0.3;
    this.timer = setInterval(() => this.schedule(), 120);
  }

  setVolumes(v) {
    Object.assign(this.vol, v);
    if (!this.ctx) return;
    this.musicBus.gain.setTargetAtTime(this.vol.music, this.ctx.currentTime, 0.1);
    this.sfxBus.gain.setTargetAtTime(this.vol.sfx, this.ctx.currentTime, 0.1);
    this.ambBus.gain.setTargetAtTime(this.vol.amb, this.ctx.currentTime, 0.1);
  }

  makeNoise() {
    const ctx = this.ctx;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0526;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.18;
    }
    return buf;
  }

  startAmbience() {
    const ctx = this.ctx;
    const mk = (type, freq, q) => {
      const src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); g.gain.value = 0;
      src.connect(f); f.connect(g); g.connect(this.ambBus); src.start();
      return { g, f };
    };
    this.wind = mk('bandpass', 420, 0.6);
    this.rain = mk('highpass', 1800, 0.4);
    this.windLfo = 0;
  }

  /** Met à jour l'ambiance selon l'heure, la saison et la météo. */
  setEnv(env) {
    this.env = env;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const w = { tempete: 0.5, orage: 0.32, neige: 0.2, pluie: 0.16, brouillard: 0.1 }[env.weather] ?? 0.08;
    this.wind.g.gain.setTargetAtTime(w * (0.7 + 0.3 * Math.sin(t * 0.2)), t, 1.5);
    this.wind.f.frequency.setTargetAtTime(380 + Math.sin(t * 0.13) * 120, t, 2);
    const r = { pluie: 0.22, orage: 0.32 }[env.weather] ?? 0;
    this.rain.g.gain.setTargetAtTime(r, t, 1.5);
  }

  schedule() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const bpm = this.env.night ? 58 : 70;
    const beatLen = 60 / bpm;
    while (this.nextBeat < ctx.currentTime + 0.5) {
      this.playBeat(this.nextBeat, beatLen);
      this.nextBeat += beatLen;
      this.beat++;
    }
    // Ambiance animale
    const h = this.env.hour;
    if (!this.env.night && this.env.season < 3 && (this.env.weather === 'soleil' || this.env.weather === 'nuages') && Math.random() < (this.env.season === 2 ? 0.02 : 0.05)) this.bird(ctx.currentTime + Math.random() * 0.3);
    if (this.env.night && this.env.season === 1 && Math.random() < 0.25) this.cricket(ctx.currentTime);
    if (h > 5 && h < 6.5 && Math.random() < 0.01) this.bird(ctx.currentTime);
  }

  playBeat(t, len) {
    const bar = Math.floor(this.beat / 4) % 4;
    const pos = this.beat % 4;
    const chord = CHORDS[bar];
    const night = this.env.night;
    if (pos === 0) {
      for (const n of chord) this.pad(t, NOTE(n - 12), len * 4, night ? 0.025 : 0.035);
      this.tone(t, NOTE(chord[0] - 24), len * 1.8, 0.07, 'sine', 0.02, 0.9);
    }
    const p = night ? 0.3 : 0.55;
    if (Math.random() < p) {
      const pool = PENTA.filter((n) => chord.some((c) => (n - c) % 12 === 0) || Math.random() < 0.4);
      const n = pool[Math.floor(Math.random() * pool.length)];
      const when = t + (Math.random() < 0.3 ? len / 2 : 0);
      const winter = this.env.season === 3;
      this.pluck(when, NOTE(n + (winter ? 12 : 0)), winter ? 0.05 : 0.07);
    }
  }

  pad(t, f, dur, vol) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 1.003;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.35); g.gain.linearRampToValueAtTime(0, t + dur * 1.05);
    o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(this.musicBus);
    o.start(t); o2.start(t); o.stop(t + dur * 1.1); o2.stop(t + dur * 1.1);
  }

  pluck(t, f, vol) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2;
    const g = ctx.createGain(), g2 = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    g2.gain.value = 0.25;
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(this.musicBus); g.connect(this.delay);
    o.start(t); o2.start(t); o.stop(t + 1.5); o2.stop(t + 1.5);
  }

  tone(t, f, dur, vol, type = 'sine', att = 0.005, rel = 0.3, bus = this.musicBus, f2) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + rel);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + rel + 0.05);
  }

  bird(t) {
    const base = 2600 + Math.random() * 1600;
    const n = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) this.tone(t + i * 0.09, base, 0.05, 0.025, 'sine', 0.005, 0.03, this.ambBus, base * (1.2 + Math.random() * 0.3));
  }
  cricket(t) {
    for (let i = 0; i < 3; i++) this.tone(t + i * 0.05, 4400, 0.02, 0.008, 'square', 0.002, 0.01, this.ambBus);
  }

  noiseBurst(t, dur, freq, vol, type = 'lowpass') {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.sfxBus);
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }

  play(name) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    if (this.lastSfx[name] && now - this.lastSfx[name] < 0.06) return;
    this.lastSfx[name] = now;
    const S = this.sfxBus;
    switch (name) {
      case 'click': this.tone(now, 720, 0.03, 0.08, 'sine', 0.002, 0.04, S); break;
      case 'tab': this.tone(now, 560, 0.03, 0.06, 'triangle', 0.002, 0.05, S); break;
      case 'coin': this.tone(now, 988, 0.05, 0.08, 'triangle', 0.002, 0.12, S); this.tone(now + 0.07, 1319, 0.08, 0.08, 'triangle', 0.002, 0.25, S); break;
      case 'bell': this.tone(now, 1046, 0.1, 0.07, 'sine', 0.002, 1.1, S); this.tone(now, 1568, 0.1, 0.035, 'sine', 0.002, 0.9, S); break;
      case 'build': this.noiseBurst(now, 0.25, 500, 0.4); this.tone(now, 120, 0.12, 0.25, 'sine', 0.002, 0.15, S, 60); this.tone(now + 0.14, 140, 0.08, 0.18, 'sine', 0.002, 0.1, S, 70); break;
      case 'place': this.tone(now, 220, 0.06, 0.18, 'sine', 0.002, 0.1, S, 110); this.noiseBurst(now, 0.08, 900, 0.15); break;
      case 'sell': this.tone(now, 660, 0.05, 0.08, 'triangle', 0.002, 0.08, S, 440); break;
      case 'error': this.tone(now, 330, 0.08, 0.09, 'square', 0.003, 0.05, S); this.tone(now + 0.1, 247, 0.12, 0.09, 'square', 0.003, 0.08, S); break;
      case 'chime': [784, 988, 1175, 1568].forEach((f, i) => this.tone(now + i * 0.09, f, 0.08, 0.07, 'triangle', 0.003, 0.6, S)); break;
      case 'star': this.tone(now, 1319, 0.06, 0.05, 'sine', 0.002, 0.7, S); this.tone(now + 0.08, 1760, 0.06, 0.04, 'sine', 0.002, 0.8, S); break;
      case 'page': this.noiseBurst(now, 0.12, 3000, 0.08, 'highpass'); break;
      case 'warn': this.tone(now, 440, 0.1, 0.06, 'triangle', 0.003, 0.2, S); this.tone(now + 0.15, 440, 0.1, 0.06, 'triangle', 0.003, 0.2, S); break;
      default: break;
    }
  }
}
