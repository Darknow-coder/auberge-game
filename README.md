# Prisme

**Encerclez la nuit, libérez la lumière.** Un puzzle original : on pose des pièces de lumière sur une grille de 8 × 9 pour **encercler des zones vides**. Dès qu'une zone n'a plus aucun passage vers le bord, elle s'illumine et son enceinte disparaît. Plus la zone est grande, plus elle rapporte. Et si l'enceinte mélange **rouge, vert et bleu**, la lumière devient **blanche** : points doublés.

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

- **Encercler** : une zone de cases vides qui n'est plus reliée au bord s'illumine ; toutes les pièces qui l'entourent (diagonales comprises) disparaissent. Le bord de la grille ne compte pas comme un mur.
- **Plus c'est grand, plus ça rapporte** : 1 case = 20 points, 4 cases = 200, 9 cases = 900, 16 cases = 2 720. Faut-il fermer tout de suite, ou risquer un plus grand bassin ?
- **Lumière blanche** : une enceinte qui contient du rouge, du vert et du bleu double les points (deux couleurs : ×1,5).
- **Aperçu** : pendant qu'on tient une pièce, la zone qui va s'illuminer brille, l'enceinte est surlignée et les points s'affichent.
- **Combo** : fermez un enclos au moins toutes les 2 pièces pour faire monter le multiplicateur (jusqu'à ×5). Plusieurs enclos d'un coup : bonus supplémentaire.
- **Étoiles filantes** (Classique) : elles apparaissent sur une case vide et s'éteignent après 9 pièces. Encerclées à temps, elles doublent les points de l'enclos.
- **Jauge d'éclat** : les enclos la remplissent. Pleine, elle donne un pouvoir : **Tourner** une pièce, **Bombe** 3 × 3, **Relancer** les pièces.
- La partie s'arrête quand plus aucune pièce ne rentre (et qu'aucun pouvoir ne peut vous sauver).

## Contenu

- **Classique** : sans fin, pour battre son record, avec les étoiles filantes. Le générateur de pièces est bienveillant au début (lots toujours jouables, souvent de quoi fermer un enclos), puis la pression monte.
- **Aventure** : 60 niveaux en 6 mondes — premiers enclos, gemmes à encercler, pierres qui servent de murs puis se brisent, lumière blanche, grands bassins à refermer — avec un nombre de pièces limité et 1 à 3 étoiles.
- **Défi du jour** : 30 pièces, les mêmes pour tout le monde ce jour-là, médailles bronze / argent / or, série de jours consécutifs, calendrier et résultat à partager.
- **Progression** : niveaux d'expérience, 32 trophées, 6 thèmes visuels à débloquer (Nuit, Aurore, Océan, Jardin, Néon, Or), statistiques détaillées.
- **Confort** : initiation en un geste, conseils contextuels affichés une seule fois, aide automatique pour les débutants qui hésitent, symboles sur les couleurs (daltonisme), animations réduites, vibrations, musique et sons réglables, reprise automatique de la partie en cours, disposition paysage.

## Tests et équilibrage

```bash
npm test                         # règles, contenu, profil, traductions (Node, sans navigateur)
npm run test:e2e                 # bout en bout Playwright : ordinateur, téléphone tactile, paysage
npm run sim -- classic 40        # 40 parties classiques jouées par l'IA
npm run sim -- levels 12         # taux de victoire de chaque niveau d'Aventure
npm run sim -- daily 30          # médailles des 30 prochains défis du jour
```

Un joueur automatique (`src/game/bot.js`) sert à l'équilibrage : chaque niveau d'Aventure est testé comme gagnable, les défis du jour ne sont retenus que si l'IA peut les terminer, et les seuils de médailles sont calculés à partir de son score.

## Architecture

```
src/core     générateur aléatoire déterministe, traductions FR/EN
src/game     règles sans DOM : pièces, grille et enclos, générateur, moteur, niveaux, défi du jour, IA
src/meta     profil, expérience, trophées, thèmes
src/render   rendu Canvas 2D : lanternes de lumière mises en cache, lumière des enclos, effets
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
