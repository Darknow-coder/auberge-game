// Point d'entrée.
import { App } from './app.js';

const app = new App();
app.show('home');
// Accès pour les tests de bout en bout et le débogage.
window.__prisme = app;

// Service worker : jeu jouable hors ligne et installable sur l'écran d'accueil.
if ('serviceWorker' in navigator && location.protocol !== 'file:' && !new URLSearchParams(location.search).has('nosw')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

document.documentElement.classList.add('ready');
