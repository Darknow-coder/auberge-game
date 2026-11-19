// Point d'entrée.
import { App } from './app.js';

// La police sert aussi aux textes dessinés dans le canvas : on la charge tout de suite.
try { for (const f of ['700 24px Fredoka', '600 16px Fredoka']) document.fonts.load(f).catch(() => {}); } catch { /* sans incidence */ }

// Installation sur l'écran d'accueil (Android / ordinateur).
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); window.__installPrompt = e; });

const app = new App();
app.show('home');
// Accès pour les tests de bout en bout et le débogage.
window.__prisme = app;

// Service worker : jeu jouable hors ligne et installable sur l'écran d'accueil.
if ('serviceWorker' in navigator && location.protocol !== 'file:' && !new URLSearchParams(location.search).has('nosw')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

document.documentElement.classList.add('ready');
