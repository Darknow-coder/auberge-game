// Types de pièces. `public` : accessible aux clients ; `staffOnly` : réservé au personnel.
// `min` : dimensions minimales du rectangle tracé (dans un sens ou l'autre).

export const ROOM_TYPES = {
  reception: {
    name: 'Réception', indoor: true, public: true, costPerTile: 30, min: [3, 3], max: 30, tier: 1,
    required: ['desk'], floor: 'parquet_clair', wall: 'bois', color: '#d9a35b', limit: 1,
    desc: "Les voyageurs s'y enregistrent et y règlent leur séjour. Un comptoir est indispensable.",
  },
  bedroom: {
    name: 'Chambre', indoor: true, public: false, costPerTile: 40, min: [2, 3], max: 24, tier: 1,
    required: ['@bed'], floor: 'parquet_clair', wall: 'bois', color: '#c47b6a', noMerge: true,
    desc: 'Accueille un groupe de voyageurs. Son standing dépend du confort, du décor et de l\'espace.',
  },
  corridor: {
    name: 'Couloir', indoor: true, public: true, costPerTile: 15, min: [1, 2], max: 60, tier: 1,
    required: [], floor: 'parquet_fonce', wall: 'bois', color: '#a88f6c',
    desc: 'Relie les pièces entre elles.',
  },
  lounge: {
    name: 'Salle commune', indoor: true, public: true, costPerTile: 35, min: [3, 3], max: 40, tier: 1,
    required: [], floor: 'parquet_fonce', wall: 'pierre', color: '#8fa86b',
    desc: 'Lieu de repos et de détente : fauteuils, cheminée, bibliothèque.',
  },
  kitchen: {
    name: 'Cuisine', indoor: true, public: false, staffOnly: true, costPerTile: 60, min: [2, 3], max: 30, tier: 1,
    required: ['stove'], floor: 'tomettes', wall: 'crepi', color: '#d6c27a', limit: 1,
    desc: 'Le cuisinier y prépare les plats. Fourneau obligatoire ; garde-manger pour stocker plus.',
  },
  restaurant: {
    name: 'Restaurant', indoor: true, public: true, costPerTile: 45, min: [3, 3], max: 60, tier: 1,
    required: ['@table'], floor: 'parquet_fonce', wall: 'bois', color: '#c9915a',
    desc: 'Les clients y prennent leurs repas. Nécessite des tables, des chaises et une cuisine.',
  },
  bar: {
    name: 'Bar', indoor: true, public: true, costPerTile: 55, min: [3, 3], max: 40, tier: 2,
    required: ['bar_counter'], floor: 'parquet_fonce', wall: 'lambris', color: '#9c6b4a', limit: 1,
    desc: 'Boissons et convivialité, surtout en soirée. Servi par un serveur.',
  },
  games: {
    name: 'Salle de jeux', indoor: true, public: true, costPerTile: 50, min: [3, 3], max: 40, tier: 2,
    required: [], floor: 'moquette', wall: 'crepi', color: '#7f9fc2',
    desc: 'Billard, baby-foot et jeux de société : les familles adorent.',
  },
  shop: {
    name: 'Boutique de souvenirs', indoor: true, public: true, costPerTile: 50, min: [2, 3], max: 24, tier: 3,
    required: ['souvenir_stand'], floor: 'parquet_clair', wall: 'crepi', color: '#c79ac2', limit: 1,
    desc: 'Les voyageurs y achètent des souvenirs (stock « Souvenirs »).',
  },
  guides: {
    name: 'Cabane des guides', indoor: true, public: true, costPerTile: 55, min: [2, 3], max: 20, tier: 3,
    required: ['guide_desk'], floor: 'dalles', wall: 'bois', color: '#6f9a8a', limit: 1,
    desc: 'Excursions guidées en montagne (raquettes en hiver). Nécessite un guide.',
  },
  spa: {
    name: 'Espace bien-être', indoor: true, public: true, costPerTile: 90, min: [3, 4], max: 40, tier: 4,
    required: [], floor: 'dalles', wall: 'boiseries', color: '#8fc0c4',
    desc: 'Sauna, bains et massages : très prisé des clients fortunés.',
  },
  garden: {
    name: 'Jardin', indoor: false, public: true, costPerTile: 10, min: [2, 2], max: 80, tier: 1,
    required: [], floor: 'herbe', wall: null, color: '#7fb86b',
    desc: 'Espace extérieur fleuri : bancs, parterres, balançoire. Améliore l\'attrait de l\'auberge.',
  },
  terrace: {
    name: 'Terrasse', indoor: false, public: true, costPerTile: 25, min: [2, 2], max: 50, tier: 2,
    required: [], floor: 'terrasse', wall: null, color: '#c8a97a',
    desc: 'Repas et boissons en plein air aux beaux jours, chaises longues l\'été.',
  },
};

export const ROOM_ORDER = ['bedroom', 'corridor', 'reception', 'lounge', 'kitchen', 'restaurant', 'bar', 'games', 'shop', 'guides', 'spa', 'garden', 'terrace'];

/** Styles de sol. cost = coût par case pour repeindre ; decor/comfort ajoutés au score de la pièce. */
export const FLOORS = {
  parquet_clair: { name: 'Parquet clair', cost: 0, decor: 0, comfort: 0, tier: 1, indoor: true, colors: ['#d8b07a', '#c99e66'] },
  parquet_fonce: { name: 'Parquet sombre', cost: 6, decor: 1, comfort: 0, tier: 1, indoor: true, colors: ['#9b6a43', '#8a5c38'] },
  tomettes: { name: 'Tomettes', cost: 8, decor: 1, comfort: 0, tier: 1, indoor: true, colors: ['#c0704d', '#ad6243'] },
  dalles: { name: 'Dalles de pierre', cost: 10, decor: 1.5, comfort: 0, tier: 1, indoor: true, colors: ['#b7b0a3', '#a29b8e'] },
  moquette: { name: 'Moquette bordeaux', cost: 12, decor: 2, comfort: 2, tier: 2, indoor: true, colors: ['#8e3b46', '#7f3440'] },
  laine: { name: 'Tapis de laine', cost: 18, decor: 3, comfort: 3, tier: 3, indoor: true, colors: ['#d9c9a8', '#cbb995'] },
  marbre: { name: 'Marbre', cost: 30, decor: 5, comfort: 1, tier: 4, indoor: true, colors: ['#ece6dc', '#d9d1c4'] },
  herbe: { name: 'Gazon', cost: 0, decor: 0, comfort: 0, tier: 1, indoor: false, colors: ['#7db35b', '#6fa64f'] },
  gravier: { name: 'Gravier', cost: 4, decor: 1, comfort: 0, tier: 1, indoor: false, colors: ['#c9bfae', '#b8ad9a'] },
  terrasse: { name: 'Platelage bois', cost: 6, decor: 1, comfort: 0, tier: 1, indoor: false, colors: ['#c49a6c', '#b38a5d'] },
  paves: { name: 'Pavés', cost: 9, decor: 2, comfort: 0, tier: 2, indoor: false, colors: ['#a59f96', '#958e84'] },
};

export const WALLS = {
  bois: { name: 'Bois de pin', cost: 0, decor: 0, tier: 1, colors: ['#c8935c', '#b07d4b'] },
  pierre: { name: 'Pierre', cost: 10, decor: 1, tier: 1, colors: ['#b5aea2', '#9d968a'] },
  crepi: { name: 'Crépi blanc', cost: 6, decor: 0.5, tier: 1, colors: ['#efe7d8', '#ddd3c1'] },
  lambris: { name: 'Lambris sombre', cost: 12, decor: 1.5, tier: 2, colors: ['#7c5236', '#6a452c'] },
  fleuri: { name: 'Papier peint fleuri', cost: 14, decor: 2, tier: 2, colors: ['#e9d6b8', '#a9c49a'] },
  boiseries: { name: 'Boiseries sculptées', cost: 22, decor: 3, tier: 3, colors: ['#a87444', '#8f6136'] },
};
