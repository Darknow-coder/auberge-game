# Prisme

**Le puzzle de blocs lumineux.** Glissez les pièces sur la grille 8×8, complétez des lignes et des colonnes pour les faire éclater, enchaînez les combos. Une partie se lance en une seconde, se comprend sans explication et se rejoue « juste une dernière fois ».

Jouable dans le navigateur, sur téléphone comme sur ordinateur, en français et en anglais. Aucune dépendance, aucun serveur, aucune publicité : graphismes, musique et bruitages sont générés par le code. Le jeu s'installe sur l'écran d'accueil du téléphone et fonctionne hors ligne. La progression est sauvegardée dans le navigateur.

## Lancer le jeu

Le jeu utilise des modules JavaScript : il doit être servi en HTTP (ouvrir `index.html` depuis le disque ne marche pas).

```bash
node tools/serve.mjs
```

Ouvrez ensuite <http://localhost:8080>. N'importe quel serveur statique convient (`python3 -m http.server`, Netlify, GitHub Pages…).

**GitHub Pages** : le workflow `.github/workflows/pages.yml` publie le site à chaque push sur `main`. Il faut d'abord activer Pages dans *Settings › Pages › Source : GitHub Actions*.

## Comment jouer

| Action | Téléphone | Ordinateur |
|---|---|---|
| Poser une pièce | la glisser du bas vers la grille (elle flotte au-dessus du doigt) | glisser-déposer à la souris |
| Au clavier | | `1` `2` `3` choisir · flèches déplacer · `Entrée` poser · `Échap` annuler |
| Pouvoirs | toucher le bouton, puis la pièce (tourner) ou la grille (bombe) | idem, ou `R` `B` `N` |
| Pause | bouton en haut à gauche | `Échap` ou `P` |

- Une **ligne ou une colonne complète** disparaît. Plusieurs d'un coup rapportent beaucoup plus (×1, ×3, ×6, ×10…).
- **Combo** : tant que vous complétez une ligne au moins toutes les 3 pièces, le multiplicateur monte (jusqu'à ×5). Les trois points du badge indiquent les pièces restantes avant de le perdre.
- **Ligne prisme** : une ligne d'une seule couleur vaut double et fait monter la jauge plus vite.
- **Jauge d'éclat** : les lignes la remplissent. Pleine, elle donne un pouvoir : **Tourner** une pièce, **Bombe** 3×3, **Relancer** les pièces.
- La partie s'arrête quand plus aucune pièce ne rentre (et qu'aucun pouvoir ne peut vous sauver).

## Contenu

- **Classique** : sans fin, pour battre son record. Le générateur de pièces est bienveillant au début (il garantit des lots jouables et propose souvent de quoi compléter une ligne, davantage pendant un combo), puis la pression monte progressivement.
- **Aventure** : 60 niveaux en 6 mondes, chacun avec sa mécanique (lignes, gemmes à récolter, pierres à briser, lignes prisme, puis mélanges), un nombre de pièces limité et 1 à 3 étoiles selon les pièces restantes.
- **Défi du jour** : 30 pièces, les mêmes pour tout le monde ce jour-là, médailles bronze / argent / or, série de jours consécutifs, calendrier et résultat à partager.
- **Progression** : niveaux d'expérience, 28 trophées, 7 thèmes visuels à débloquer (Nuit, Aurore, Océan, Jardin, Néon, Papier, Or), statistiques détaillées.
- **Confort** : initiation en un geste, conseils contextuels affichés une seule fois, symboles sur les couleurs (daltonisme), animations réduites, vibrations, musique et sons réglables, reprise automatique de la partie en cours.

## Tests et équilibrage

```bash
npm test                         # règles, contenu, profil, traductions (Node, sans navigateur)
npm run test:e2e                 # bout en bout Playwright, ordinateur + téléphone tactile
npm run sim -- classic 40        # 40 parties classiques jouées par l'IA
npm run sim -- levels 20         # taux de victoire de chaque niveau d'Aventure
npm run sim -- daily 30          # médailles des 30 prochains défis du jour
```

Un joueur automatique (`src/game/bot.js`) sert à l'équilibrage : chaque niveau d'Aventure est testé comme gagnable, les défis du jour ne sont retenus que si l'IA peut les terminer, et les seuils de médailles sont calculés à partir de son score.

## Architecture

```
src/core     générateur aléatoire déterministe, traductions FR/EN
src/game     règles sans DOM : pièces, grille, générateur, moteur, niveaux, défi du jour, IA
src/meta     profil, expérience, trophées, thèmes
src/render   rendu Canvas 2D : blocs procéduraux mis en cache, effets (éclats, faisceaux, textes)
src/ui       écran de jeu (saisie souris/tactile/clavier), menus, icônes SVG
src/audio    sons et musique générative (WebAudio)
tests/       tests Node et Playwright
tools/       serveur local, simulation, génération des icônes
docs/        document de conception
```

Le moteur (`src/game/engine.js`) est un état JSON pur : chaque action renvoie une liste d'événements que l'interface traduit en animations et en sons. La partie se sauvegarde donc telle quelle après chaque coup.

## Licences

- Code : MIT (voir `LICENSE`).
- Police Fredoka : SIL Open Font License 1.1, auto-hébergée (`assets/fonts/`, licence jointe).
- Aucun autre fichier externe.
