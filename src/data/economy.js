// Rôles du personnel, recettes, boissons, stocks et services.

export const STAFF_ROLES = {
  receptionist: { name: 'Réceptionniste', fem: 'Réceptionniste', tier: 1, salary: [28, 58], top: '#2f5b7a', desc: 'Enregistre les arrivées et les départs. Plus il est compétent, plus la file avance vite.' },
  cleaner: { name: "Agent d'entretien", fem: "Agente d'entretien", tier: 1, salary: [24, 46], top: '#5f8f6e', desc: 'Nettoie les chambres et les espaces communs. Utilise du linge.' },
  cook: { name: 'Cuisinier', fem: 'Cuisinière', tier: 1, salary: [38, 80], top: '#f1ece2', desc: 'Prépare les plats. La compétence améliore la qualité et la vitesse.' },
  waiter: { name: 'Serveur', fem: 'Serveuse', tier: 1, salary: [26, 50], top: '#7a2f36', desc: 'Apporte les plats en salle et tient le bar.' },
  guide: { name: 'Guide de montagne', fem: 'Guide de montagne', tier: 3, salary: [60, 110], top: '#c46a2f', desc: 'Emmène les clients en excursion (payante).' },
  manager: { name: 'Gérant', fem: 'Gérante', tier: 3, salary: [95, 165], top: '#2b2f3a', desc: 'Motive l\'équipe (+12 % d\'efficacité) et réapprovisionne automatiquement les stocks.' },
};

export const STAFF_TRAITS = {
  souriant: { name: 'Souriant', desc: 'Les clients apprécient son accueil.' },
  rapide: { name: 'Rapide', desc: 'Travaille 15 % plus vite.' },
  meticuleux: { name: 'Méticuleux', desc: 'Travail de meilleure qualité.' },
  econome: { name: 'Économe', desc: 'Gaspille moins de fournitures.' },
  passionne: { name: 'Passionné', desc: 'Progresse plus vite.' },
};

/** Shifts : heures de début et de fin (fin exclusive). */
export const SHIFTS = {
  matin: { name: 'Matin', from: 6, to: 14 },
  journee: { name: 'Journée', from: 7, to: 21 },
  soir: { name: 'Soir', from: 14, to: 23 },
};

// season: bonus d'attrait selon la saison [printemps, été, automne, hiver]
export const RECIPES = {
  soupe: { name: 'Soupe du potager', ing: 1, price: 9, quality: 0.5, tier: 1, season: [1, 0.7, 1.1, 1.3] },
  omelette: { name: 'Omelette aux cèpes', ing: 1, price: 11, quality: 0.55, tier: 1, season: [1, 1, 1.3, 0.9] },
  salade: { name: 'Salade des prés', ing: 1, price: 11, quality: 0.6, tier: 1, season: [1.2, 1.4, 0.9, 0.6] },
  croute: { name: 'Croûte au fromage', ing: 2, price: 15, quality: 0.66, tier: 1, season: [1, 0.8, 1.1, 1.3] },
  gratin: { name: 'Gratin montagnard', ing: 2, price: 17, quality: 0.7, tier: 1, season: [0.9, 0.6, 1.2, 1.5] },
  tarte: { name: 'Tarte aux myrtilles', ing: 1, price: 9, quality: 0.65, tier: 1, season: [1, 1.3, 1.1, 0.8] },
  truite: { name: 'Truite du lac aux amandes', ing: 2, price: 19, quality: 0.76, tier: 2, season: [1.2, 1.2, 1, 0.8] },
  fondue: { name: 'Fondue des alpages', ing: 3, price: 23, quality: 0.8, tier: 2, season: [0.8, 0.5, 1.3, 1.7] },
  ragout: { name: 'Ragoût du chasseur', ing: 3, price: 26, quality: 0.85, tier: 3, season: [0.8, 0.6, 1.6, 1.2] },
  fromages: { name: 'Plateau de fromages affinés', ing: 3, price: 28, quality: 0.88, tier: 3, season: [1, 1, 1, 1.1] },
  sommets: { name: 'Menu des Sommets', ing: 5, price: 58, quality: 1, tier: 4, season: [1, 1, 1, 1], gastro: true },
};
export const BREAKFAST = { name: 'Petit-déjeuner montagnard', ing: 1, price: 10, quality: 0.6 };

export const DRINKS = {
  tisane: { name: 'Tisane des cimes', price: 3, tier: 1, season: [1, 0.7, 1.1, 1.3] },
  cafe: { name: 'Café', price: 3, tier: 1, season: [1, 1, 1, 1] },
  chocolat: { name: 'Chocolat chaud', price: 4, tier: 1, season: [0.9, 0.4, 1.1, 1.8] },
  jus: { name: 'Jus de pomme du verger', price: 4, tier: 1, season: [1.1, 1.5, 1.1, 0.6] },
  biere: { name: 'Bière blonde de la vallée', price: 5, tier: 1, season: [1, 1.4, 1, 0.8] },
  cidre: { name: 'Cidre fermier', price: 5, tier: 2, season: [1, 1.1, 1.5, 0.8] },
  vin_chaud: { name: 'Vin chaud aux épices', price: 6, tier: 2, season: [0.6, 0.2, 1.1, 2] },
  genepi: { name: 'Liqueur des glaciers', price: 8, tier: 3, season: [1, 1, 1, 1.3] },
  petillant: { name: 'Vin pétillant', price: 18, tier: 4, season: [1, 1.1, 1, 1.1], units: 2 },
};

export const STOCK_TYPES = {
  ingredients: { name: 'Ingrédients', unitCost: 4, baseCap: 40, desc: 'Pour les plats et petits-déjeuners.' },
  drinks: { name: 'Boissons', unitCost: 1.5, baseCap: 60, desc: 'Servies au restaurant et au bar.' },
  supplies: { name: "Linge & produits d'accueil", unitCost: 2, baseCap: 40, desc: 'Utilisés à chaque nettoyage de chambre.' },
  souvenirs: { name: 'Souvenirs', unitCost: 5, baseCap: 0, desc: 'Vendus dans la boutique.' },
};

/** Services tarifés par le joueur. */
export const SERVICES = {
  spa: { name: 'Séance de spa', price: 16, tier: 4 },
  massage: { name: 'Massage', price: 32, tier: 4 },
  excursion: { name: 'Excursion guidée', price: 26, tier: 3 },
  souvenir: { name: 'Souvenir (prix moyen)', price: 12, tier: 3 },
};

/** Prix de référence par standing ; base de calcul de la demande. */
export const ROOM_REF_PRICE = [46, 85, 175];
export const STANDING_NAMES = ['Simple', 'Confortable', 'Suite'];
export const STANDING_THRESHOLDS = [0, 32, 70];
