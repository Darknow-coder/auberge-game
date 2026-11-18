// Archétypes de voyageurs, traits, noms et palettes d'apparence.
// prefs : attrait pour chaque type de lieu/activité (0 = indifférent, >1 = adore).
// wants : standing souhaité (0 simple, 1 confortable, 2 suite).

export const ARCHETYPES = {
  hiker: {
    name: 'Randonneur', fem: 'Randonneuse', plural: 'Randonneurs', tier: 1, minRep: 0, size: [1, 2],
    budget: [32, 60], exigence: [0.15, 0.4], nights: [1, 4], wants: 0, patience: 1.1, spend: 0.8,
    prefs: { hike: 1.3, lounge: 0.8, garden: 0.6, restaurant: 0.8, bar: 0.5, games: 0.2, spa: 0.4, shop: 0.4, terrace: 0.6, guides: 0.8 },
    season: [1.5, 1.2, 1.3, 0.5], age: [19, 62], backpack: 0.9, hat: 0.5, palette: 'outdoor', color: '#5d8a4a',
  },
  passing: {
    name: 'Voyageur de passage', fem: 'Voyageuse de passage', plural: 'Voyageurs de passage', tier: 1, minRep: 0, size: [1, 1],
    budget: [42, 78], exigence: [0.25, 0.5], nights: [1, 1], wants: 0, patience: 0.6, spend: 1,
    prefs: { restaurant: 0.9, bar: 0.6, lounge: 0.4, garden: 0.2, games: 0.1, spa: 0.2, shop: 0.5, terrace: 0.4 },
    season: [1, 1.1, 1, 1], age: [22, 66], backpack: 0.2, hat: 0.2, palette: 'city', color: '#6a7f9e',
  },
  family: {
    name: 'Famille', fem: 'Famille', plural: 'Familles', tier: 1, minRep: 0, size: [3, 4], family: true,
    budget: [70, 130], exigence: [0.3, 0.55], nights: [2, 5], wants: 0, patience: 0.8, spend: 1.25,
    prefs: { games: 1.3, garden: 1.0, restaurant: 1.0, terrace: 0.9, shop: 0.8, hike: 0.5, lounge: 0.5, spa: 0.3, bar: 0.2, guides: 0.6 },
    season: [0.9, 2.1, 0.6, 1.1], age: [30, 46], backpack: 0.3, hat: 0.3, palette: 'casual', color: '#d08b3c',
  },
  couple: {
    name: 'Couple', fem: 'Couple', plural: 'Couples', tier: 1, minRep: 0, size: [2, 2],
    budget: [75, 140], exigence: [0.45, 0.7], nights: [2, 4], wants: 1, patience: 1, spend: 1.2,
    prefs: { restaurant: 1.1, terrace: 1.0, spa: 1.2, lounge: 0.9, bar: 0.8, garden: 0.8, hike: 0.6, shop: 0.6, games: 0.3 },
    season: [1.2, 1.0, 1.2, 1.1], age: [24, 70], backpack: 0.1, hat: 0.2, palette: 'elegant', color: '#c45a6e',
  },
  adventurer: {
    name: 'Aventurier', fem: 'Aventurière', plural: 'Aventuriers', tier: 2, minRep: 45, size: [1, 2],
    budget: [45, 85], exigence: [0.25, 0.5], nights: [2, 4], wants: 0, patience: 1, spend: 1,
    prefs: { hike: 1.5, bar: 1.0, restaurant: 0.9, guides: 1.3, lounge: 0.6, games: 0.4, spa: 0.5, terrace: 0.5 },
    season: [1, 1.2, 0.9, 1.6], age: [21, 50], backpack: 1, hat: 0.7, palette: 'outdoor', color: '#3f7f8c',
  },
  wealthy: {
    name: 'Voyageur fortuné', fem: 'Voyageuse fortunée', plural: 'Voyageurs fortunés', tier: 3, minRep: 60, size: [1, 2],
    budget: [170, 340], exigence: [0.75, 0.95], nights: [2, 5], wants: 2, patience: 0.8, spend: 2.2,
    prefs: { spa: 1.4, restaurant: 1.2, bar: 0.9, lounge: 0.8, shop: 1.0, terrace: 0.9, garden: 0.7, guides: 0.6 },
    season: [0.9, 1.1, 0.8, 1.5], age: [35, 75], backpack: 0, hat: 0.3, palette: 'luxury', color: '#9c7a2e',
  },
  difficult: {
    name: 'Client exigeant', fem: 'Cliente exigeante', plural: 'Clients exigeants', tier: 1, minRep: 0, size: [1, 2],
    budget: [60, 115], exigence: [0.6, 0.85], nights: [1, 3], wants: 1, patience: 0.6, spend: 1.1, forcedTraits: ['grincheux'],
    prefs: { restaurant: 1.1, lounge: 0.7, bar: 0.6, spa: 0.8, garden: 0.5, terrace: 0.6, shop: 0.3 },
    season: [0.8, 0.8, 0.8, 0.8], age: [30, 75], backpack: 0, hat: 0.2, palette: 'city', color: '#7a5a8c',
  },
};

export const TRAITS = {
  grincheux: { name: 'Difficile', desc: 'Remarque tous les défauts.', pos: 0.6, neg: 1.45 },
  genereux: { name: 'Généreux', desc: 'Laisse de gros pourboires.', tip: 2.5 },
  gourmand: { name: 'Gourmand', desc: 'Accorde beaucoup d\'importance aux repas.', hunger: 1.3, food: 1.5 },
  frileux: { name: 'Frileux', desc: 'Apprécie les cheminées et poêles, surtout en hiver.', warmth: 1.8 },
  sportif: { name: 'Sportif', desc: 'Adore partir randonner.', hike: 1.6 },
  noctambule: { name: 'Noctambule', desc: 'Se couche tard, aime le bar.', night: 1, bar: 1.5 },
  esthete: { name: 'Esthète', desc: 'Sensible à la décoration.', decor: 1.6 },
  sociable: { name: 'Sociable', desc: 'Aime les espaces communs.', lounge: 1.4 },
  econome: { name: 'Économe', desc: 'Très attentif aux prix.', price: 1.5 },
  leve_tot: { name: 'Lève-tôt', desc: 'Debout aux aurores.', early: 1 },
};

export const FIRST_NAMES_F = ['Camille', 'Léa', 'Manon', 'Chloé', 'Inès', 'Louise', 'Jeanne', 'Margot', 'Élodie', 'Sophie', 'Claire', 'Anaïs', 'Lucie', 'Agathe', 'Mathilde', 'Hélène', 'Irène', 'Nina', 'Giulia', 'Anna', 'Sarah', 'Romane', 'Juliette', 'Odile', 'Bernadette', 'Solène', 'Maëlle', 'Fanny', 'Rose', 'Elsa'];
export const FIRST_NAMES_M = ['Lucas', 'Hugo', 'Louis', 'Arthur', 'Jules', 'Paul', 'Thomas', 'Antoine', 'Nicolas', 'Julien', 'Mathis', 'Raphaël', 'Gabriel', 'Étienne', 'Bastien', 'Rémi', 'Simon', 'Marco', 'Hans', 'Pierre', 'Yves', 'Gérard', 'Victor', 'Léon', 'Noé', 'Maxime', 'Benoît', 'Félix', 'Olivier', 'Joseph'];
export const KID_NAMES = ['Tom', 'Zoé', 'Léo', 'Emma', 'Nathan', 'Jade', 'Enzo', 'Lina', 'Sacha', 'Mila', 'Timéo', 'Alice'];
export const LAST_NAMES = ['Martin', 'Bernard', 'Dubois', 'Favre', 'Rochat', 'Bonnet', 'Girard', 'Perrin', 'Morel', 'Fournier', 'Lambert', 'Mercier', 'Blanc', 'Guérin', 'Muller', 'Rey', 'Vuillemin', 'Jacquet', 'Chevalier', 'Collomb', 'Burnier', 'Gaillard', 'Duc', 'Pellissier', 'Arnaud', 'Ferrari', 'Brunet', 'Roux', 'Marchand', 'Berthod', 'Cattin', 'Moret', 'Tissot', 'Rossi', 'Vallet', 'Mazet'];
export const ORIGINS = ['Lyon', 'Genève', 'Grenoble', 'Annecy', 'Turin', 'Paris', 'Bruxelles', 'Lausanne', 'Marseille', 'Strasbourg', 'Milan', 'la vallée de Belcombe', 'Valmaure', 'Saint-Alban-des-Neiges', 'Pralognet', 'Les Arolles', 'Bordeaux', 'Nantes', 'Chambéry', 'Neuchâtel'];

export const SKIN_TONES = ['#f3d2b3', '#e8bf9a', '#d9a77f', '#c18e66', '#a26f4b', '#7d5236', '#f6dcc6'];
export const HAIR_COLORS = ['#2b1d14', '#4a2f1f', '#6b4428', '#8f5f34', '#c48b4a', '#e2c07a', '#9a9a9a', '#d8d4cc', '#7a2f1e', '#1c1c22'];
export const PALETTES = {
  outdoor: { tops: ['#c4512f', '#2f6f8f', '#e0a12c', '#4f7d3c', '#8c3b5a', '#3d5a8a'], bottoms: ['#4b4a3c', '#3b4250', '#6b5a43', '#2f3a2c'] },
  city: { tops: ['#5a6b84', '#8a8f99', '#3c3f4a', '#a0603c', '#6e4a7a', '#2f5b6b'], bottoms: ['#2a2d36', '#3c3f4a', '#555a66'] },
  casual: { tops: ['#e07a5f', '#3d85c6', '#f2c14e', '#81b29a', '#e76f51', '#9b5de5'], bottoms: ['#3b5b8a', '#4a4a4a', '#7a6248'] },
  elegant: { tops: ['#8c2f39', '#2e4057', '#d5a253', '#5c4d7d', '#ece2d0', '#1f3b2d'], bottoms: ['#22252c', '#3a3a44', '#5b4636'] },
  luxury: { tops: ['#1f2a44', '#7b1e3a', '#efe6d8', '#2d4a3e', '#3a2a4a'], bottoms: ['#151820', '#2b2b33', '#3d3a36'] },
  staff: { tops: ['#f4efe6'], bottoms: ['#2d3340'] },
};
