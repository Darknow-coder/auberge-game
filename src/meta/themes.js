// Thèmes visuels, débloqués en montant de niveau. Chaque thème définit le fond,
// la grille, la palette des 5 couleurs de blocs, le style de dessin et les couleurs d'interface.

export const THEMES = [
  {
    id: 'nuit', level: 1, style: 'gloss', dark: true,
    bg: ['#0b0a1f', '#17123f', '#2a1660'],
    blobs: ['#5b3cff', '#ff3d9a', '#00c2ff'],
    board: 'rgba(14, 10, 40, 0.55)', boardEdge: 'rgba(170, 150, 255, 0.22)', cell: 'rgba(255, 255, 255, 0.055)',
    colors: ['#ff4d6d', '#ffa62b', '#27d07d', '#3d8bff', '#b45cff'],
    stone: '#8a86a0',
    ui: { text: '#ffffff', muted: 'rgba(255,255,255,0.62)', panel: 'rgba(28, 22, 70, 0.72)', edge: 'rgba(255,255,255,0.14)', accent: '#ffd36b', accent2: '#ff5fa8', btnText: '#2a1300' },
  },
  {
    id: 'aurore', level: 3, style: 'jelly', dark: true,
    bg: ['#1a0b24', '#3d1238', '#6b2340'],
    blobs: ['#ff7a59', '#ff3d8b', '#ffc15e'],
    board: 'rgba(40, 10, 34, 0.5)', boardEdge: 'rgba(255, 170, 160, 0.25)', cell: 'rgba(255, 220, 230, 0.06)',
    colors: ['#ff5470', '#ff9a3c', '#ffd23f', '#5fd3c6', '#c278ff'],
    stone: '#9a8290',
    ui: { text: '#fff6f2', muted: 'rgba(255,240,235,0.65)', panel: 'rgba(70, 20, 50, 0.7)', edge: 'rgba(255,220,210,0.18)', accent: '#ffc15e', accent2: '#ff5d8f', btnText: '#3a1200' },
  },
  {
    id: 'ocean', level: 6, style: 'glass', dark: true,
    bg: ['#021622', '#05304a', '#0a4d6b'],
    blobs: ['#00e0ff', '#1f7bff', '#36ffc8'],
    board: 'rgba(0, 20, 40, 0.5)', boardEdge: 'rgba(120, 230, 255, 0.25)', cell: 'rgba(200, 245, 255, 0.06)',
    colors: ['#ff6b8b', '#ffb547', '#3ef0a5', '#43b0ff', '#a98bff'],
    stone: '#7f97a3',
    ui: { text: '#eefcff', muted: 'rgba(220,250,255,0.65)', panel: 'rgba(4, 45, 70, 0.72)', edge: 'rgba(160,240,255,0.18)', accent: '#5ef2ff', accent2: '#2c9bff', btnText: '#002433' },
  },
  {
    id: 'jardin', level: 10, style: 'gloss', dark: true,
    bg: ['#08160d', '#123321', '#1f4a2c'],
    blobs: ['#7ddc5a', '#ffd166', '#2fbf8f'],
    board: 'rgba(5, 25, 12, 0.5)', boardEdge: 'rgba(190, 240, 160, 0.22)', cell: 'rgba(230, 255, 220, 0.06)',
    colors: ['#ff6f61', '#ffc04d', '#8bdc4a', '#4fb5e8', '#d48cff'],
    stone: '#8c9481',
    ui: { text: '#f4ffef', muted: 'rgba(235,255,225,0.65)', panel: 'rgba(16, 52, 30, 0.72)', edge: 'rgba(210,255,190,0.16)', accent: '#ffd166', accent2: '#7ddc5a', btnText: '#2b2000' },
  },
  {
    id: 'neon', level: 15, style: 'neon', dark: true,
    bg: ['#020205', '#07071a', '#100726'],
    blobs: ['#ff00d4', '#00f0ff', '#7a00ff'],
    board: 'rgba(0, 0, 0, 0.6)', boardEdge: 'rgba(0, 240, 255, 0.35)', cell: 'rgba(120, 120, 255, 0.07)',
    colors: ['#ff2a6d', '#ff9f1c', '#39ff14', '#00e5ff', '#d100ff'],
    stone: '#6c6c84',
    ui: { text: '#f0f8ff', muted: 'rgba(220,235,255,0.6)', panel: 'rgba(10, 8, 30, 0.8)', edge: 'rgba(0,240,255,0.3)', accent: '#00f0ff', accent2: '#ff00d4', btnText: '#00141a' },
  },
  {
    id: 'papier', level: 20, style: 'flat', dark: false,
    bg: ['#f6efe3', '#efe4d2', '#e8d9c0'],
    blobs: ['#ffd7a8', '#ffc2c7', '#bfe3d6'],
    board: 'rgba(255, 252, 245, 0.75)', boardEdge: 'rgba(120, 90, 60, 0.22)', cell: 'rgba(110, 80, 50, 0.08)',
    colors: ['#e85d5d', '#f2a33a', '#4fb477', '#4a8fd9', '#9b6bd6'],
    stone: '#a39888',
    ui: { text: '#3b2f25', muted: 'rgba(59,47,37,0.62)', panel: 'rgba(255, 250, 240, 0.86)', edge: 'rgba(90,60,30,0.15)', accent: '#e8833a', accent2: '#e85d79', btnText: '#ffffff' },
  },
  {
    id: 'or', level: 25, style: 'gloss', dark: true,
    bg: ['#120d04', '#2a1d07', '#3d2a0a'],
    blobs: ['#ffcf4d', '#ff9d2e', '#fff1b0'],
    board: 'rgba(30, 20, 4, 0.55)', boardEdge: 'rgba(255, 210, 110, 0.35)', cell: 'rgba(255, 230, 170, 0.07)',
    colors: ['#ff5a4f', '#ffb22e', '#e8e04a', '#4fd1c5', '#e07bff'],
    stone: '#9a8a6a',
    ui: { text: '#fff8e6', muted: 'rgba(255,245,220,0.65)', panel: 'rgba(55, 38, 10, 0.75)', edge: 'rgba(255,215,120,0.25)', accent: '#ffcf4d', accent2: '#ff9d2e', btnText: '#2e1d00' },
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
  theme.colors.forEach((c, i) => r.setProperty(`--c${i + 1}`, c));
  document.documentElement.dataset.theme = theme.id;
  document.documentElement.classList.toggle('light', !theme.dark);
  const meta = document.querySelector('meta[name=theme-color]');
  if (meta) meta.setAttribute('content', theme.bg[1]);
}
