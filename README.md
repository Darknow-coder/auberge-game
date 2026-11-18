# L'Auberge des Sommets

Jeu de gestion en 2D isométrique, jouable dans le navigateur (ordinateur et téléphone).
Vous reprenez une petite auberge au pied des montagnes et la transformez, saison après saison, en destination incontournable de la vallée.

Tout est fait en HTML, CSS et JavaScript, sans dépendance ni serveur : les graphismes, la musique et les bruitages sont générés par le code. La partie est sauvegardée automatiquement dans le navigateur.

## Lancer le jeu

Le jeu utilise des modules JavaScript : il doit être servi en HTTP. Ouvrir `index.html` directement depuis le disque (`file://`) ne marche pas.

```bash
node tools/serve.mjs
```

Ouvrez ensuite <http://localhost:8080>. N'importe quel serveur statique fait l'affaire (`python3 -m http.server`, Netlify, GitHub Pages…).

**GitHub Pages** : le workflow `.github/workflows/pages.yml` publie le site à chaque push sur `main`. Il faut d'abord activer Pages dans *Settings › Pages › Source : GitHub Actions*.

## Comment jouer

| Action | Ordinateur | Téléphone |
|---|---|---|
| Déplacer la vue | glisser, flèches / ZQSD / WASD | glisser à un doigt |
| Zoom | molette, `+` / `-` | pincer |
| Voir une fiche | clic sur un client, un employé, une pièce, un meuble | toucher |
| Construire une pièce | Construire › Pièces, puis glisser sur le terrain | glisser, puis « Construire » |
| Placer un meuble | clic (`R` pour tourner) | toucher pour prévisualiser, toucher à nouveau ou « Placer » |
| Vitesse | `Espace` pause, `1` `2` `3` | boutons du HUD |

Les voyageurs arrivent par le chemin du village et s'enregistrent à la réception. Chacun choisit une chambre selon sa capacité, son standing et votre prix. Pendant le séjour, ils mangent, se détendent, partent en randonnée, puis paient en partant et laissent un avis. Ces avis font votre réputation, et la réputation attire plus de monde, y compris de nouveaux profils.

## Contenu

- **Construction libre** : 13 types de pièces tracées à la main. Les pièces identiques voisines fusionnent, les portes se posent toutes seules (et se modifient avec l'outil Portes), et les placements qui couperaient un passage sont refusés. On peut changer sols et murs, déplacer, revendre ou démolir, et annuler la dernière pièce construite.
- **72 meubles**, chacun utile : couchages, confort, décor, chaleur, rangement, équipement de cuisine, activités. Le standing d'une chambre (Simple, Confortable, Suite) se calcule à partir du lit, du confort, du décor et de l'espace.
- **Voyageurs** : 7 profils (randonneur, famille, couple, voyageur de passage, aventurier, client fortuné, client exigeant) et 10 traits. Chaque groupe a des noms, une apparence, un budget, une exigence, trois besoins (énergie, appétit, détente) et des pensées. Ils choisissent leurs activités selon leurs besoins.
- **Restaurant et bar** : 11 recettes et 9 boissons, avec une carte et des prix modifiables et des recettes de saison. Le service suit une vraie chaîne : commande, cuisinier, serveur, table. La qualité dépend du cuisinier et de l'équipement.
- **Personnel** : réceptionniste, agent d'entretien, cuisinier, serveur, guide et gérant. Chacun a une compétence (qui progresse), un salaire, des horaires, un trait et des heures supplémentaires si un service est en cours. Au début, c'est vous qui faites l'accueil et le ménage.
- **Économie** : grand livre par catégorie, charges quotidiennes (salaires, entretien, chauffage plus cher en hiver) et prix qui jouent sur la demande. Stocks livrés le lendemain par la charrette (ou en express), réassort automatique, prêts bancaires.
- **Progression** : 5 paliers d’établissement, 5 parcelles à acheter et 28 objectifs avec récompense.
- **Saisons et météo** : visuels, demande, profils de voyageurs, chauffage, randonnées et terrasse changent selon la saison. 7 types de météo.
- **Événements et histoires** : 16 événements aléatoires, la plupart avec des choix, et 5 personnages récurrents en plusieurs chapitres (jeunes mariés, vieux guide, peintre, alpiniste, critique culinaire), avec des objets uniques à gagner. Des célébrités et des inspecteurs passent incognito.

## Tests

```bash
npm test          # tests des systèmes (Node, sans navigateur)
npm run test:e2e  # test de bout en bout Playwright (ordinateur + téléphone)
npm run sim -- 40 7 --auto   # simulation équilibrage : 40 jours, graine 7, joueur automatique
```

Les tests unitaires couvrent la construction, les murs et portes, le pathfinding, le mobilier, l’économie, les stocks, la sauvegarde, les objectifs et les paliers, ainsi que le fonctionnement réel du restaurant, du bar, de la salle de jeux, de la boutique, des excursions et du spa. Une simulation de 12 jours vérifie aussi qu’aucun client ne reste bloqué.

## Architecture

```
src/core     utilitaires purs (générateur aléatoire déterministe, couleurs)
src/data     contenu déclaratif : pièces, meubles, voyageurs, recettes, paliers, objectifs, événements, histoires
src/sim      simulation sans DOM : monde, pathfinding A*, visiteurs, personnel, restaurant, économie, événements
src/render   rendu Canvas 2D isométrique procédural : sol pré-rendu, sprites en cache, éclairage, météo
src/ui       interface : HUD, panneaux, inspecteur, modales, saisie souris/tactile
src/audio    musique générative et ambiances WebAudio
tests/       tests Node et Playwright
docs/        document de conception
```

Pour ajouter du contenu, il suffit d'ajouter une entrée dans `src/data/*.js`. Pour un nouveau meuble, ajoutez aussi son modèle dans `src/render/models.js` (sinon un bloc générique s'affiche).

## Licences

- Code : MIT (voir `LICENSE`).
- Polices Fraunces et Nunito : SIL Open Font License 1.1, auto-hébergées (`assets/fonts/`, licences jointes).
- Aucun autre fichier externe : graphismes, sons et musique sont générés par le code.
