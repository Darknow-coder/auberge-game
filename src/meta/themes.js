// Thèmes visuels, débloqués en montant de niveau. Chaque thème définit le fond, la grille,
// les couleurs des trois lumières et de leurs mélanges, le style des blocs et l'interface.
// Les lumières restent toujours reconnaissables : rouge, vert, bleu, et leurs mélanges
// jaune (R+V), magenta (R+B), cyan (V+B), blanc (R+V+B).

const lights = (r, g, b, y, m, c) => ({ 1: r, 2: g, 4: b, 3: y, 5: m, 6: c, 7: '#ffffff' });

export const THEMES = [
  {
    id: 'nuit', level: 1, style: 'lantern', dark: true,
    bg: ['#07071a', '#120f38', '#251456'],
    blobs: ['#4b34ff', '#ff3d9a', '#00b8ff'],
    board: 'rgba(8, 6, 28, 0.62)', boardEdge: 'rgba(170, 150, 255, 0.22)', cell: 'rgba(255, 255, 255, 0.045)',
    lights: lights('#ff4f6d', '#35e08f', '#4f8cff', '#ffe14f', '#ff5fd6', '#3fe6ff'),
    stone: '#8a86a0',
    ui: { text: '#ffffff', muted: 'rgba(255,255,255,0.62)', panel: 'rgba(26, 20, 66, 0.72)', edge: 'rgba(255,255,255,0.14)', accent: '#ffd36b', accent2: '#ff5fa8', btnText: '#2a1300' },
  },
  {
    id: 'aurore', level: 3, style: 'soft', dark: true,
    bg: ['#160920', '#371035', '#62203e'],
    blobs: ['#ff7a59', '#ff3d8b', '#ffc15e'],
    board: 'rgba(36, 8, 30, 0.55)', boardEdge: 'rgba(255, 170, 160, 0.25)', cell: 'rgba(255, 220, 230, 0.05)',
    lights: lights('#ff5470', '#4fe08a', '#5b8dff', '#ffd94a', '#ff66cc', '#5fe3e6'),
    stone: '#9a8290',
    ui: { text: '#fff6f2', muted: 'rgba(255,240,235,0.65)', panel: 'rgba(66, 18, 48, 0.72)', edge: 'rgba(255,220,210,0.18)', accent: '#ffc15e', accent2: '#ff5d8f', btnText: '#3a1200' },
  },
  {
    id: 'ocean', level: 6, style: 'lantern', dark: true,
    bg: ['#021420', '#052c45', '#0a4865'],
    blobs: ['#00e0ff', '#1f7bff', '#36ffc8'],
    board: 'rgba(0, 18, 36, 0.55)', boardEdge: 'rgba(120, 230, 255, 0.25)', cell: 'rgba(200, 245, 255, 0.05)',
    lights: lights('#ff6b8b', '#3ef0a5', '#43a6ff', '#ffe866', '#ff7ae0', '#5ef2ff'),
    stone: '#7f97a3',
    ui: { text: '#eefcff', muted: 'rgba(220,250,255,0.65)', panel: 'rgba(4, 42, 66, 0.74)', edge: 'rgba(160,240,255,0.18)', accent: '#5ef2ff', accent2: '#2c9bff', btnText: '#002433' },
  },
  {
    id: 'jardin', level: 10, style: 'soft', dark: true,
    bg: ['#07140b', '#10301e', '#1c472a'],
    blobs: ['#7ddc5a', '#ffd166', '#2fbf8f'],
    board: 'rgba(4, 22, 10, 0.55)', boardEdge: 'rgba(190, 240, 160, 0.22)', cell: 'rgba(230, 255, 220, 0.05)',
    lights: lights('#ff6f61', '#8bea4a', '#4fb5e8', '#ffe45a', '#ff7fd0', '#6ff0d8'),
    stone: '#8c9481',
    ui: { text: '#f4ffef', muted: 'rgba(235,255,225,0.65)', panel: 'rgba(14, 48, 28, 0.74)', edge: 'rgba(210,255,190,0.16)', accent: '#ffd166', accent2: '#7ddc5a', btnText: '#2b2000' },
  },
  {
    id: 'neon', level: 15, style: 'neon', dark: true,
    bg: ['#020205', '#06061a', '#0e0624'],
    blobs: ['#ff00d4', '#00f0ff', '#7a00ff'],
    board: 'rgba(0, 0, 0, 0.62)', boardEdge: 'rgba(0, 240, 255, 0.35)', cell: 'rgba(120, 120, 255, 0.06)',
    lights: lights('#ff2a6d', '#39ff14', '#2f7bff', '#fff200', '#ff00e6', '#00f6ff'),
    stone: '#6c6c84',
    ui: { text: '#f0f8ff', muted: 'rgba(220,235,255,0.6)', panel: 'rgba(10, 8, 30, 0.82)', edge: 'rgba(0,240,255,0.3)', accent: '#00f0ff', accent2: '#ff00d4', btnText: '#00141a' },
  },
  {
    id: 'or', level: 20, style: 'lantern', dark: true,
    bg: ['#110c04', '#281b07', '#3b290a'],
    blobs: ['#ffcf4d', '#ff9d2e', '#fff1b0'],
    board: 'rgba(28, 18, 4, 0.58)', boardEdge: 'rgba(255, 210, 110, 0.35)', cell: 'rgba(255, 230, 170, 0.06)',
    lights: lights('#ff5a4f', '#7be86a', '#58a8ff', '#ffe066', '#ff7ad9', '#6ff2f2'),
    stone: '#9a8a6a',
    ui: { text: '#fff8e6', muted: 'rgba(255,245,220,0.65)', panel: 'rgba(52, 36, 10, 0.76)', edge: 'rgba(255,215,120,0.25)', accent: '#ffcf4d', accent2: '#ff9d2e', btnText: '#2e1d00' },
  },
];

export const themeById = (id) => THEMES.find((t) => t.id === id) || THEMES[0];

/** Applique les couleurs d'interface du thème (variables CSS). */
export function applyThemeCss(theme) {
  if (typeof document === 'undefined') return;
  const r = document.documentElement.style;
  r.setProperty('--bg1', theme.bg[0]);
  r.setProperty('--bg2', theme.bg[1]);
  r.setProperty('--bg3', theme.bg[2]);
  theme.blobs.forEach((c, i) => r.setProperty(`--blob${i + 1}`, c));
  for (const [k, v] of Object.entries(theme.ui)) r.setProperty(`--${k}`, v);
  const L = theme.lights;
  [L[1], L[3], L[2], L[6], L[4], L[5]].forEach((c, i) => r.setProperty(`--c${i + 1}`, c));
  r.setProperty('--lr', L[1]);
  r.setProperty('--lg', L[2]);
  r.setProperty('--lb', L[4]);
  document.documentElement.dataset.theme = theme.id;
  document.documentElement.classList.toggle('light', !theme.dark);
  const meta = document.querySelector('meta[name=theme-color]');
  if (meta) meta.setAttribute('content', theme.bg[1]);
}
