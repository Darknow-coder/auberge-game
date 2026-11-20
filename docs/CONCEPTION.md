# Prisme — document de conception

## 1. Le constat de départ

La première version de Prisme reprenait le squelette des puzzles de blocs à la Block Blast : grille 8 × 8, trois pièces à poser, lignes et colonnes complètes qui disparaissent. Elle était fluide et agréable, mais sans identité : on y jouait exactement comme à Block Blast. Les ajouts (lignes d'une seule couleur, pouvoirs) restaient secondaires.

Objectif de la refonte : **garder ce qui plaît** (le glisser-déposer fluide, les effets, le rythme, la progression), mais **changer ce à quoi on pense à chaque coup**, et que cela se voie au premier coup d'œil.

## 2. Pistes étudiées

| Piste | Verdict |
|---|---|
| **Couches de lumière** : les pièces se superposent, rouge + vert + bleu = blanc, une ligne toute blanche disparaît | Abandonnée après prototype : la première ligne n'arrivait qu'au 17ᵉ coup, et les pièces se bloquaient vite faute de couche libre (parties de ~30 pièces). Et le squelette « lignes » restait celui de Block Blast. |
| Lancer les pièces depuis les bords (elles glissent jusqu'à un obstacle) | Original, mais difficile à manier au doigt sur un petit écran. |
| Grille circulaire à anneaux tournants | Très visuel, mais les formes courbes deviennent peu lisibles. |
| **Encercler des zones vides** | Retenue : règle neuve, immédiatement lisible, et le prototype donne le bon rythme dès le premier essai. |

## 3. La règle retenue : encercler la nuit

- Grille **8 colonnes × 9 lignes** (plus haute que large : elle occupe mieux un écran de téléphone et ne ressemble plus au carré 8 × 8).
- On pose les pièces où l'on veut, comme dans un puzzle de blocs.
- **Une zone de cases vides qui n'a plus de passage vers le bord est encerclée** (4-connexité). Elle s'illumine, et tous les blocs qui la touchent — diagonales comprises — disparaissent. Le bord est ouvert : la lumière s'échappe par les côtés, il faut donc fermer l'enclos avec des pièces.
- **Points très croissants avec la taille** : `20 × A(A+1)/2` pour une zone de A cases (1 → 20, 4 → 200, 9 → 900), plus 5 points par bloc de l'enceinte. Fermer vite et petit, ou viser un grand bassin et risquer l'encombrement : c'est le cœur stratégique (quitte ou double).
- **Mélange des lumières** : chaque pièce est rouge, verte ou bleue. Une enceinte qui contient les trois couleurs donne une **lumière blanche** (×2), deux couleurs ×1,5 — le nom « Prisme » prend tout son sens.
- **Plusieurs enclos d'un coup** : ×1,5 pour deux, ×2 pour trois.
- **Combo** : il continue tant qu'on ferme un enclos au moins toutes les 2 pièces (multiplicateur jusqu'à ×5).
- **Étoiles filantes** (Classique, Blitz, Zen) : une étoile apparaît sur une case vide intérieure et s'éteint après 9 pièces. Elle ne peut pas être recouverte : il faut l'encercler, ce qui double les points de l'enclos. Elles donnent des objectifs à court terme et renouvellent sans cesse la grille.
- La partie s'arrête quand plus aucune pièce ne rentre.

## 4. Ce qui rend le jeu addictif

1. **Une initiation en un geste** : la première pièce ferme un petit enclos rouge-vert-bleu. En trois secondes, le joueur voit une zone s'illuminer en blanc, l'enceinte éclater et la grille se vider.
2. **L'aperçu** : pendant le glisser, la zone qui va s'illuminer brille (en arc-en-ciel si elle sera blanche), l'enceinte est surlignée et les points prévus s'affichent. On mesure la récompense avant de lâcher, ce qui rend la prise de risque lisible.
3. **Récompense variable** : beaucoup de petits enclos rapides, et de temps en temps un grand bassin qui rapporte dix fois plus. Ce mélange de petites et grosses récompenses est l'un des ressorts les plus puissants du jeu vidéo.
4. **Tension du quasi-fermé** : un grand enclos à qui il manque une case, en attendant la bonne pièce.
5. **Étoiles filantes** : un objectif qui apparaît, clignote et s'éteint, avec un compte à rebours visible.
6. **Générateur bienveillant puis exigeant** : lots garantis jouables et souvent de quoi fermer un enclos au début, puis la pression monte (grandes pièces, lots contraignants) jusqu'à la fin de partie.
7. **Boucles de retour** : record (et célébration en direct quand on le bat), défi du jour avec série et partage, missions du jour, 80 niveaux à 3 étoiles, expérience, thèmes, 40 trophées.

## 5. Deuxième phase : variété et fidélité

- **Blitz** (90 s) : chaque enclos rajoute `1 + aire/3` secondes (+2 lumière blanche, +3 étoile), multiplié par `max(0,2 ; 1 − pièces/120)`. Simulation avec un rythme humain : la partie dure 2 min 15 à 2 min 50 quel que soit le rythme (1,6 à 3 s par pièce) ; seule la vitesse fait monter le score.
- **Zen** : jamais de fin de partie. Le générateur garantit toujours des lots jouables ; si rien ne rentre malgré tout, de nouvelles pièces faciles arrivent, puis la zone 3 × 3 la plus encombrée se dissout.
- **Initiation guidée en 3 étapes** : fermer un enclos (lumière blanche), fermer un grand bassin (« plus c'est grand, plus ça rapporte »), fermer contre le bord (« le bord ne compte pas »). Chaque étape ne propose qu'une pièce ; une pose ratée fait recommencer l'étape. Bouton « Passer ».
- **Missions du jour** : trois missions tirées par date (facile, moyenne, difficile), progression cumulée sur la journée ou meilleure partie selon le type, XP à la clé et bonus de journée parfaite.
- **Brume** (monde 7) : objet posé sur une case vide, qui gagne une case intérieure voisine toutes les 2 à 4 pièces ; on la dissipe en l'encerclant. Elle crée de l'urgence et réduit l'espace.
- **Cristaux** (monde 8) : un cristal « n » ne se récolte que dans un enclos d'au moins n cases ; l'aperçu les entoure en vert (récolté) ou en rouge (enclos trop petit). Ils apprennent à viser grand.
- **Félicitations en anglais**, en capitales, avec rebond, inclinaison, dégradé, halo et reflet ; paliers selon la taille du plus grand enclos (NICE! dès 4 cases jusqu'à LEGENDARY! à 20) et selon le combo (ON FIRE!, UNSTOPPABLE!, GODLIKE!). Rayons de lumière pour les enclos de 9 cases et plus.
- **Musique** : une pulsation et des notes s'ajoutent quand le combo monte, puis retombent quand il s'arrête.

## 6. Équilibrage (mesuré avec l'IA)

Le joueur automatique valorise les cases presque entourées, évite l'encombrement, vise les objectifs (gemmes, pierres, lumière blanche) et anticipe d'un coup pour les grands bassins.

- Classique : premier enclos au 3ᵉ ou 4ᵉ coup ; environ un enclos toutes les deux pièces ; l'IA tient en médiane ~350 pièces (p10 ≈ 230). Un joueur occasionnel tiendra moins.
- Aventure : monde 1 gagné à 75–100 % par l'IA, puis 25–100 % selon les niveaux, avec quelques niveaux « boss » (le niveau 80 reste à ~20 %). Un test vérifie que chacun des 80 niveaux est gagnable et qu'aucun ne commence avec un enclos déjà fermé.
- Défi du jour : la suite de 30 pièces est générée en faisant jouer l'IA ; on ne garde qu'une suite qu'elle termine. Les médailles valent 45 %, 80 % et 110 % de son score.

## 7. Direction artistique et sonore

- Blocs en **lanternes de verre** (cadre sombre teinté, cœur lumineux, halo) plutôt qu'en cubes brillants ; pierres, gemmes et étoiles dessinées au Canvas et mises en cache.
- La lumière d'un enclos se répand depuis la pièce posée, colorée par le mélange de l'enceinte (jaune, magenta, cyan… ou arc-en-ciel pour le blanc), puis s'élève en particules.
- Sons de cloches cristallines sur une gamme pentatonique ; la cascade est plus longue pour un grand enclos et plus aiguë avec le combo. Nappe musicale générative douce.
- Accessibilité : symboles distincts pour rouge, vert et bleu, animations réduites, jeu complet au clavier, vibrations désactivables.

## 8. Architecture

- `src/game` : règles pures (aucune dépendance au navigateur), testées sous Node. `board.js` détecte les enclos (parcours depuis le bord), `engine.js` applique les règles et renvoie des événements (`place`, `enclose`, `starSpawn`, `power`, `stuck`, `end`…).
- `src/render` : rendu Canvas à la résolution de l'écran, lumière des enclos, particules, félicitations animées.
- `src/ui` : écran de jeu (DOM pour le HUD, Canvas pour la grille), menus, fenêtres modales.
- `src/meta` : profil persistant (localStorage avec repli mémoire), trophées, missions du jour, thèmes.
- `sw.js` : service worker « réseau d'abord » pour le jeu hors ligne.
