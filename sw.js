// Service worker : réseau d'abord (toujours la dernière version en ligne), cache en secours
// pour jouer hors ligne. Le cache est rempli au fil des requêtes et à l'installation.
const CACHE = 'prisme-v1';
const CORE = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'src/main.js', 'src/app.js',
  'src/core/rng.js', 'src/core/i18n.js',
  'src/game/pieces.js', 'src/game/board.js', 'src/game/generator.js', 'src/game/engine.js', 'src/game/levels.js', 'src/game/daily.js', 'src/game/bot.js',
  'src/meta/profile.js', 'src/meta/achievements.js', 'src/meta/themes.js',
  'src/render/blocks.js', 'src/render/fx.js', 'src/render/renderer.js',
  'src/ui/dom.js', 'src/ui/icons.js', 'src/ui/game.js', 'src/ui/menus.js',
  'src/audio/audio.js',
  'assets/icon.svg', 'assets/icon-192.png', 'assets/icon-512.png',
  'assets/fonts/fredoka-latin-500-normal.woff2', 'assets/fonts/fredoka-latin-600-normal.woff2', 'assets/fonts/fredoka-latin-700-normal.woff2',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match('index.html'))),
  );
});
