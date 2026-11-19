# Prisme — document de conception

## 1. Pourquoi ce jeu ?

L'objectif était un jeu qui plaise au **public le plus large possible**, qui soit **très addictif**, et que l'on puisse réaliser avec une finition irréprochable **sans aucun fichier graphique ou sonore externe**, jouable aussi bien au doigt qu'à la souris.

Genres comparés :

| Genre | Public | Rejouabilité | Faisabilité 100 % code | Téléphone |
|---|---|---|---|---|
| **Puzzle de blocs 8×8** | immense, de 7 à 77 ans | très forte (« encore une ») | excellente | parfait |
| Fusion avec physique | immense | très forte | moteur physique délicat à rendre stable | parfait |
| Survie « bullet heaven » | joueurs réguliers | très forte | demande énormément de contenu | moyen |
| Match-3 | large | forte si niveaux nombreux | gros travail de level design | parfait |
| Roguelike à cartes | joueurs réguliers | extrême | complexe, barrière d'entrée | moyen |

Le puzzle de blocs l'emporte : c'est l'une des familles de jeux les plus téléchargées au monde depuis des années, les règles se comprennent en regardant une seule fois, une partie dure de 2 à 15 minutes, et le plaisir repose sur le **ressenti** (son, lumière, rythme) — exactement ce que le code peut produire.

## 2. Ce qui rend le jeu addictif

1. **Zéro friction** : un bouton « Jouer », la partie démarre. L'initiation tient en un geste : la toute première pièce complète une ligne d'une seule couleur, qui vide la grille. Le joueur voit en 3 secondes une ligne prisme, une grille nette et une pluie de confettis.
2. **Aperçu avant de lâcher** : pendant le glisser, les lignes qui vont disparaître se recolorent et pulsent. On anticipe la récompense.
3. **Récompense graduée** : 1 ligne = 80 points, 2 = 240, 3 = 480, 4 = 800. Chaque niveau a son mot (« Superbe ! », « Fantastique ! »), sa secousse d'écran et un son de plus en plus riche.
4. **Combo à tension** : le combo survit tant qu'on complète une ligne au moins toutes les 3 pièces ; trois points indiquent la marge restante. Chaque palier fait monter d'une note le son des lignes : on entend la série grimper. La grille s'entoure d'un halo qui chauffe.
5. **Quasi-échec et sauvetage** : quand plus rien ne rentre, les pouvoirs gagnés (tourner, bombe, relancer) offrent une dernière chance. Ces moments « in extremis » sont les plus mémorables.
6. **Générateur bienveillant puis exigeant** : au début, chaque lot de pièces est garanti jouable et propose souvent de quoi compléter une ligne (plus encore pendant un combo, ou quand la grille est très remplie). Puis la difficulté monte : grandes pièces plus fréquentes, garanties relâchées, et parfois un lot volontairement contraignant. La partie finit toujours par se terminer, mais jamais injustement dès le départ.
7. **Profondeur optionnelle** : les lignes prisme (une seule couleur) valent double. Le débutant les ignore, le joueur confirmé apprend à trier ses couleurs.
8. **Boucles de retour** : record personnel (et célébration en direct quand on le bat), défi du jour avec série de jours consécutifs, calendrier et partage, 60 niveaux d'Aventure à 3 étoiles, expérience et thèmes à débloquer, 28 trophées.

## 3. Règles précises

- Grille 8×8, 3 pièces proposées ; quand les 3 sont posées, un nouveau lot arrive.
- 14 familles de pièces (du carré 1×1 au carré 3×3, lignes de 2 à 5, coins, L, T, S, rectangle 2×3, diagonale). Couleur aléatoire parmi 5.
- Points : 1 par case posée ; lignes complétées simultanées L : `80 × L(L+1)/2` ; +160 par ligne prisme ; le tout multiplié par le combo (`1 + 0,5 × (combo − 1)`, plafonné à ×5) ; grille nette : +500 × combo.
- Jauge d'éclat : +10 par ligne, +20 par prisme, bonus de combo, +40 pour une grille nette. Seuil : 100, puis +40 à chaque pouvoir gagné (les pouvoirs se raréfient au fil de la partie).
- Fin : aucune pièce ne rentre et aucun pouvoir ne peut aider (bombe, relance, ou rotation qui permettrait une pose).

## 4. Équilibrage (mesuré avec l'IA)

Le joueur automatique évalue chaque pose (lignes, trous, fragmentation, place pour les grandes pièces, lignes prisme en préparation, objectifs). Il sert de joueur de référence, plutôt plus fort qu'un débutant.

- Classique : l'IA tient en médiane ~280 pièces (p10 ≈ 200, p90 ≈ 400). Un joueur occasionnel tiendra moins : des parties de quelques minutes, qui s'allongent avec l'expérience.
- Aventure : niveaux du monde 1 gagnés à 90–100 % par l'IA, puis 45–80 % au Sommet, avec quelques niveaux « bosses ». Un test vérifie que chacun des 60 niveaux est gagnable.
- Défi du jour : la suite de 30 pièces est générée en faisant jouer l'IA ; on ne garde qu'une suite qu'elle termine. Les médailles valent 45 %, 80 % et 110 % de son score.

## 5. Direction artistique et sonore

- Blocs « bonbons de verre » dessinés au Canvas (dégradé, biseau, reflet, éclat), 5 styles selon le thème : brillant, gelée, verre, néon, papier. Mis en cache par taille et couleur.
- Fond en aurore animée (CSS), grille en verre sombre, interface en panneaux translucides. Police Fredoka, ronde et lisible.
- Sons de cloches cristallines sur une gamme pentatonique (impossible de faire une fausse note), qui montent avec le combo ; nappe musicale générative douce (La m – Fa – Do – Sol).
- Accessibilité : symboles distincts par couleur, animations réduites (respecte aussi le réglage du système), jeu complet au clavier, contrastes élevés, vibrations désactivables.

## 6. Architecture

- `src/game` : règles pures (aucune dépendance au navigateur), testées sous Node. L'état est un objet JSON ; chaque action renvoie des événements (`place`, `clear`, `combo`, `power`, `stuck`, `end`…).
- `src/render` : rendu Canvas à la résolution de l'écran, effets à particules.
- `src/ui` : écran de jeu (DOM pour le HUD, Canvas pour la grille), menus, fenêtres modales.
- `src/meta` : profil persistant (localStorage avec repli mémoire), trophées, thèmes.
- `sw.js` : service worker « réseau d'abord » pour le jeu hors ligne.
