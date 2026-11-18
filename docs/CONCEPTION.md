# L'Auberge des Sommets — Document de conception

## 1. Boucle de jeu

```
Voyageurs arrivent ─► Réception (attente, enregistrement) ─► Choix d'une chambre (prix / standing / capacité)
       ▲                                                              │
       │                                                              ▼
 Réputation ◄── Avis ◄── Départ (paiement) ◄── Séjour : repas, bar, loisirs, randonnées, sommeil
       │                                                              │
       └─► plus de voyageurs, nouveaux profils ──► argent ──► construire / meubler / recruter / stocker
```

Boucle courte (minutes) : observer, réagir aux besoins (cuisine en rupture, chambres sales, file à la réception).
Boucle moyenne (jours) : agrandir, fixer les prix, équilibrer personnel et stocks, objectifs.
Boucle longue (saisons/années) : paliers d'établissement, terrains, histoires d'habitués, standing des suites.

## 2. Systèmes

| Système | Rôle | Interactions |
|---|---|---|
| Temps | 1 h de jeu = 10 s réelles (x1). Nuits accélérées. Saison = 7 jours. | Météo, horaires, salaires, saisons |
| Monde | Grille isométrique 40×40, parcelles achetables, pièces = ensembles de cases | Murs/portes déduits, navigation |
| Construction | Pièces tracées au doigt/à la souris, fusion des pièces adjacentes, portes automatiques + outil porte | Coût par case, contrôle d'accessibilité |
| Mobilier | Objets à empreinte, rotation 4 sens, emplacements d'usage (assis, debout, couché) | Confort, décor, capacité, usages, lumière |
| Standing | Score d'une chambre = confort + 0,7 × décor + espace → Simple / Confortable / Suite | Prix, attentes des clients |
| Visiteurs | Groupes (1–4 pers.) avec archétype, traits, budget, exigence, besoins (énergie, faim, détente), pensées | IA par utilité, satisfaction, avis |
| Restaurant/Bar | Commande ► cuisinier ► serveur ► service ; qualité = recette × compétence × équipement | Stocks, satisfaction, revenus |
| Personnel | Rôles, compétence, salaire, horaires ; le propriétaire aide au début | Vitesse et qualité des services |
| Économie | Grand livre journalier (revenus/dépenses par catégorie), prix fixés par le joueur, prêt | Demande, avis « rapport qualité-prix » |
| Stocks | 4 ressources, commandes livrées le lendemain par charrette (ou express +40 %) | Gérant = réassort automatique |
| Réputation | 80 % moyenne des avis récents + 20 % qualité des installations | Demande, profils débloqués, paliers |
| Progression | 5 paliers, déblocages (pièces, meubles, recettes, rôles, terrains), objectifs récompensés | Toute la boucle longue |
| Saisons/Météo | Visuels, demande, profils, recettes de saison, chauffage, terrasse, randonnées | Économie, événements |
| Événements | Événements aléatoires à choix + 5 personnages récurrents en plusieurs chapitres | Relations, récompenses uniques |

## 3. Architecture technique

Jeu 100 % statique (HTML/CSS/JS modules natifs, aucune étape de build), hébergeable sur GitHub Pages / Netlify.

```
src/core     utilitaires purs (RNG déterministe, maths, couleurs)
src/data     contenu déclaratif (pièces, meubles, archétypes, recettes, paliers, objectifs, événements, histoires)
src/sim      simulation pure, sans DOM — testable sous Node
src/render   rendu Canvas 2D isométrique procédural (sprites mis en cache)
src/ui       interface DOM (HUD, panneaux, inspecteur, dialogues, saisie)
src/audio    musique et ambiances génératives WebAudio
tests/unit   tests Node (node --test) des systèmes
tests/e2e    test Playwright (chargement, construction, simulation, mobile)
```

Principes :
- L'état de jeu (`state`) est un objet JSON sérialisable ; les index runtime (`state.rt`) sont reconstruits au chargement.
- La simulation avance par pas de ≤ 1 minute de jeu, indépendamment du rendu.
- Ajouter du contenu = ajouter une entrée dans `src/data/*` (+ un modèle visuel dans `src/render/models.js` pour un meuble).
- Les graphismes sont 100 % générés par code (aucun asset tiers hormis deux polices OFL auto-hébergées).

## 4. Direction artistique

- Vue isométrique 2:1, maquette « diorama » : chalet en bois et pierre, murs arrière pleine hauteur avec fenêtres, murs intérieurs en coupe basse.
- Palette : verts sapin, bois miel, pierre grise chaude, accents rouge volets / or lumière. Ciel et éclairage selon l'heure.
- Saisons : herbe, feuillage, neige au sol et sur les murs, fleurs aux fenêtres, particules (pétales, lucioles, feuilles, flocons).
- Vie ambiante : fumée des cheminées, nuages et leurs ombres, oiseaux, reflets du lac, charrette du fournisseur.
- Interface : panneaux crème, titres Fraunces, texte Nunito, icônes SVG maison.

## 5. Risques identifiés et parades

| Risque | Parade |
|---|---|
| Performances mobiles (canvas plein écran) | Sol pré-rendu, sprites en cache, éclairage sur canvas réduit, réglage qualité |
| Tri de profondeur isométrique | Clé de profondeur par centre d'empreinte, murs indexés par arête |
| Visiteurs bloqués | Validation de placement (accès aux portes et emplacements), recalcul de chemin, délais de patience, test de simulation longue |
| Économie déséquilibrée | Simulation sans affichage sur plusieurs jours dans les tests, constantes centralisées |
| Sauvegardes corrompues/anciennes | Versionnage + migration + validation au chargement, export/import manuel |
| Complexité d'interface sur téléphone | Barre d'outils basse, panneaux en feuille, confirmation tactile des constructions |
