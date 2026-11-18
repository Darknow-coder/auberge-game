// Catalogue du mobilier. Coordonnées locales à la rotation 0 : x vers la droite, y vers l'avant (+y = face avant).
// rooms : liste de types de pièces, ou 'indoor' (toute pièce intérieure) / 'outdoor' (jardin, terrasse, terrain nu).
// seat : les cases de l'objet sont praticables et servent d'assise.
// walkable : objet plat (tapis), praticable.
// table : 'dining' | 'games' — les chaises adjacentes deviennent des places assises de cette fonction.
// use : usage par les clients. spots : emplacements {c:[lx,ly], pose, z?}. Si la case est bloquante, le client s'en approche puis s'y installe.
// staffSpot / clientSpot : cases (locales) où se tiennent l'employé et le client.

const INDOOR_SEATING = ['bedroom', 'lounge', 'reception', 'bar', 'games', 'spa', 'restaurant', 'corridor'];

export const FURN_CATEGORIES = [
  { id: 'lits', name: 'Chambres' },
  { id: 'salon', name: 'Salon' },
  { id: 'accueil', name: 'Accueil' },
  { id: 'cuisine', name: 'Cuisine' },
  { id: 'restaurant', name: 'Restaurant & Bar' },
  { id: 'loisirs', name: 'Loisirs' },
  { id: 'deco', name: 'Décoration' },
  { id: 'exterieur', name: 'Extérieur' },
];

const list = [
  // ---- Chambres ----
  { id: 'bed_single', name: 'Lit simple', cat: 'lits', rooms: ['bedroom'], w: 1, h: 2, cost: 120, tier: 1, comfort: 10, capacity: 1,
    use: { kind: 'sleep', spots: [{ c: [0, 0], pose: 'lie' }] } },
  { id: 'bunk_bed', name: 'Lit superposé', cat: 'lits', rooms: ['bedroom'], w: 1, h: 2, cost: 170, tier: 1, comfort: 7, capacity: 2,
    use: { kind: 'sleep', spots: [{ c: [0, 0], pose: 'lie' }, { c: [0, 0], pose: 'lie', z: 0.9 }] } },
  { id: 'bed_double', name: 'Lit double', cat: 'lits', rooms: ['bedroom'], w: 2, h: 2, cost: 230, tier: 1, comfort: 16, capacity: 2,
    use: { kind: 'sleep', spots: [{ c: [0, 0], pose: 'lie' }, { c: [1, 0], pose: 'lie' }] } },
  { id: 'bed_cozy', name: 'Grand lit douillet', cat: 'lits', rooms: ['bedroom'], w: 2, h: 2, cost: 420, tier: 2, comfort: 24, decor: 1, capacity: 2,
    use: { kind: 'sleep', spots: [{ c: [0, 0], pose: 'lie' }, { c: [1, 0], pose: 'lie' }] } },
  { id: 'bed_canopy', name: 'Lit à baldaquin', cat: 'lits', rooms: ['bedroom'], w: 2, h: 2, cost: 950, tier: 4, comfort: 40, decor: 4, capacity: 2,
    use: { kind: 'sleep', spots: [{ c: [0, 0], pose: 'lie' }, { c: [1, 0], pose: 'lie' }] } },
  { id: 'nightstand', name: 'Table de chevet', cat: 'lits', rooms: ['bedroom'], w: 1, h: 1, cost: 40, tier: 1, comfort: 3, decor: 1,
    light: { r: 1.6, color: '#ffcf7a', z: 0.7 } },
  { id: 'wardrobe', name: 'Armoire', cat: 'lits', rooms: ['bedroom', 'corridor'], w: 1, h: 1, cost: 90, tier: 1, comfort: 4, decor: 1 },
  { id: 'dresser', name: 'Commode peinte', cat: 'lits', rooms: ['bedroom', 'corridor', 'lounge', 'reception'], w: 2, h: 1, cost: 150, tier: 2, comfort: 3, decor: 3 },
  { id: 'writing_desk', name: 'Secrétaire', cat: 'lits', rooms: ['bedroom', 'lounge'], w: 1, h: 1, cost: 120, tier: 2, comfort: 3, decor: 2 },
  { id: 'bathtub', name: 'Baignoire à pieds', cat: 'lits', rooms: ['bedroom', 'spa'], w: 1, h: 2, cost: 460, tier: 3, comfort: 14, decor: 2 },
  { id: 'faience_stove', name: 'Poêle en faïence', cat: 'lits', rooms: ['bedroom', 'lounge', 'restaurant', 'reception', 'spa', 'bar'], w: 1, h: 1, cost: 380, tier: 3, comfort: 8, decor: 3, warmth: 2,
    light: { r: 1.4, color: '#ff9a4a', z: 0.3, flicker: true } },
  { id: 'armchair', name: 'Fauteuil', cat: 'salon', rooms: INDOOR_SEATING, w: 1, h: 1, cost: 85, tier: 1, comfort: 4, decor: 1, seat: true,
    use: { kind: 'relax', spots: [{ c: [0, 0], pose: 'sit' }] } },

  // ---- Salon ----
  { id: 'fireplace', name: 'Cheminée', cat: 'salon', rooms: ['lounge', 'restaurant', 'reception', 'bar', 'spa', 'games'], w: 2, h: 1, cost: 550, tier: 1, decor: 6, warmth: 3,
    light: { r: 3.2, color: '#ff8a3a', z: 0.4, flicker: true }, smoke: true },
  { id: 'sofa', name: 'Canapé', cat: 'salon', rooms: INDOOR_SEATING, w: 2, h: 1, cost: 170, tier: 1, comfort: 5, decor: 1, seat: true,
    use: { kind: 'relax', spots: [{ c: [0, 0], pose: 'sit' }, { c: [1, 0], pose: 'sit' }] } },
  { id: 'bookshelf', name: 'Bibliothèque', cat: 'salon', rooms: ['lounge', 'bedroom', 'games', 'reception', 'corridor'], w: 1, h: 1, cost: 130, tier: 1, decor: 2,
    use: { kind: 'read', spots: [{ c: [0, 1], pose: 'stand' }] } },
  { id: 'coffee_table', name: 'Table basse', cat: 'salon', rooms: 'indoor', w: 1, h: 1, cost: 50, tier: 1, decor: 1 },
  { id: 'grandfather_clock', name: 'Horloge comtoise', cat: 'salon', rooms: 'indoor', w: 1, h: 1, cost: 260, tier: 2, decor: 4 },
  { id: 'piano', name: 'Piano droit', cat: 'salon', rooms: ['lounge', 'bar', 'restaurant'], w: 2, h: 1, cost: 900, tier: 3, decor: 4,
    use: { kind: 'music', spots: [{ c: [0, 1], pose: 'sit' }] } },

  // ---- Accueil ----
  { id: 'desk', name: "Comptoir d'accueil", cat: 'accueil', rooms: ['reception'], w: 2, h: 1, cost: 250, tier: 1, decor: 2,
    staffSpot: [0, -1], clientSpot: [0, 1], light: { r: 1.5, color: '#ffd89a', z: 1 } },
  { id: 'luggage_rack', name: 'Porte-bagages', cat: 'accueil', rooms: ['reception', 'corridor', 'bedroom'], w: 1, h: 1, cost: 60, tier: 1, decor: 1, comfort: 1 },
  { id: 'linen_cupboard', name: 'Armoire à linge', cat: 'accueil', rooms: ['corridor', 'reception', 'kitchen'], w: 1, h: 1, cost: 150, tier: 1, decor: 0, stockCap: { supplies: 30 } },

  // ---- Cuisine ----
  { id: 'stove', name: 'Fourneau', cat: 'cuisine', rooms: ['kitchen'], w: 2, h: 1, cost: 420, tier: 1, kitchen: 1,
    staffSpot: [0, 1], light: { r: 1.6, color: '#ff8a3a', z: 0.5, flicker: true } },
  { id: 'worktop', name: 'Plan de travail', cat: 'cuisine', rooms: ['kitchen'], w: 1, h: 1, cost: 110, tier: 1, kitchen: 0.5 },
  { id: 'sink', name: 'Évier', cat: 'cuisine', rooms: ['kitchen', 'bar'], w: 1, h: 1, cost: 120, tier: 1, kitchen: 0.4 },
  { id: 'pantry', name: 'Garde-manger', cat: 'cuisine', rooms: ['kitchen'], w: 1, h: 1, cost: 200, tier: 1, stockCap: { ingredients: 40 } },
  { id: 'bread_oven', name: 'Four à pain', cat: 'cuisine', rooms: ['kitchen'], w: 1, h: 1, cost: 650, tier: 2, kitchen: 1.2,
    light: { r: 1.4, color: '#ff7a2a', z: 0.4, flicker: true } },
  { id: 'wine_rack', name: 'Casier à bouteilles', cat: 'cuisine', rooms: ['kitchen', 'bar', 'restaurant'], w: 1, h: 1, cost: 180, tier: 1, decor: 1, stockCap: { drinks: 40 } },

  // ---- Restaurant & bar ----
  { id: 'table_small', name: 'Table ronde', cat: 'restaurant', rooms: ['restaurant', 'terrace', 'bar', 'lounge'], w: 1, h: 1, cost: 90, tier: 1, decor: 1, table: 'dining' },
  { id: 'table_long', name: 'Table de ferme', cat: 'restaurant', rooms: ['restaurant', 'terrace', 'bar'], w: 2, h: 1, cost: 170, tier: 1, decor: 1.5, table: 'dining' },
  { id: 'chair', name: 'Chaise', cat: 'restaurant', rooms: [...INDOOR_SEATING, 'terrace'], w: 1, h: 1, cost: 35, tier: 1, seat: true, autoFace: true,
    use: { kind: 'relax', spots: [{ c: [0, 0], pose: 'sit' }] } },
  { id: 'buffet', name: 'Buffet du matin', cat: 'restaurant', rooms: ['restaurant'], w: 2, h: 1, cost: 340, tier: 2, decor: 2, breakfast: 1 },
  { id: 'bar_counter', name: 'Comptoir de bar', cat: 'restaurant', rooms: ['bar'], w: 3, h: 1, cost: 480, tier: 2, decor: 3,
    staffSpot: [1, -1], light: { r: 2, color: '#ffc46a', z: 1 } },
  { id: 'bar_stool', name: 'Tabouret', cat: 'restaurant', rooms: ['bar'], w: 1, h: 1, cost: 30, tier: 2, seat: true, autoFace: true,
    use: { kind: 'relax', spots: [{ c: [0, 0], pose: 'sit' }] } },
  { id: 'barrel', name: 'Tonneau', cat: 'restaurant', rooms: ['bar', 'kitchen', 'restaurant', 'terrace'], w: 1, h: 1, cost: 70, tier: 1, decor: 2, stockCap: { drinks: 20 } },

  // ---- Loisirs ----
  { id: 'billiard', name: 'Billard', cat: 'loisirs', rooms: ['games', 'bar', 'lounge'], w: 2, h: 1, cost: 700, tier: 2, decor: 2,
    use: { kind: 'fun', spots: [{ c: [0, 1], pose: 'stand' }, { c: [1, -1], pose: 'stand' }] } },
  { id: 'foosball', name: 'Baby-foot', cat: 'loisirs', rooms: ['games', 'bar'], w: 2, h: 1, cost: 380, tier: 2, decor: 1,
    use: { kind: 'fun', spots: [{ c: [0, 1], pose: 'stand' }, { c: [1, -1], pose: 'stand' }] } },
  { id: 'game_table', name: 'Table de jeux', cat: 'loisirs', rooms: ['games', 'lounge', 'bar'], w: 1, h: 1, cost: 150, tier: 1, decor: 1, table: 'games' },
  { id: 'dartboard', name: 'Jeu de fléchettes', cat: 'loisirs', rooms: ['games', 'bar'], w: 1, h: 1, cost: 140, tier: 2, decor: 1,
    use: { kind: 'fun', spots: [{ c: [0, 2], pose: 'stand' }] } },
  { id: 'toy_chest', name: 'Coffre à jouets', cat: 'loisirs', rooms: ['games', 'lounge', 'bedroom'], w: 1, h: 1, cost: 120, tier: 2, decor: 1, kids: true,
    use: { kind: 'fun', spots: [{ c: [0, 1], pose: 'stand' }] } },
  { id: 'souvenir_stand', name: 'Présentoir à souvenirs', cat: 'loisirs', rooms: ['shop'], w: 1, h: 1, cost: 300, tier: 3, decor: 2, stockCap: { souvenirs: 20 },
    use: { kind: 'shop', spots: [{ c: [0, 1], pose: 'stand' }] } },
  { id: 'postcards', name: 'Tourniquet de cartes', cat: 'loisirs', rooms: ['shop', 'reception'], w: 1, h: 1, cost: 120, tier: 3, decor: 1,
    use: { kind: 'shop', spots: [{ c: [0, 1], pose: 'stand' }], small: true } },
  { id: 'shop_counter', name: 'Caisse en bois', cat: 'loisirs', rooms: ['shop'], w: 2, h: 1, cost: 220, tier: 3, decor: 2 },
  { id: 'guide_desk', name: 'Comptoir des guides', cat: 'loisirs', rooms: ['guides'], w: 2, h: 1, cost: 380, tier: 3, decor: 2,
    staffSpot: [0, -1], use: { kind: 'excursion', spots: [{ c: [0, 1], pose: 'stand' }, { c: [1, 1], pose: 'stand' }] } },
  { id: 'ski_rack', name: 'Râtelier à skis', cat: 'loisirs', rooms: ['guides', 'reception', 'corridor'], w: 1, h: 1, cost: 160, tier: 3, decor: 2 },
  { id: 'map_board', name: 'Carte des sentiers', cat: 'loisirs', rooms: ['guides', 'reception', 'lounge'], w: 1, h: 1, cost: 180, tier: 2, decor: 3,
    use: { kind: 'read', spots: [{ c: [0, 1], pose: 'stand' }] } },
  { id: 'sauna', name: 'Sauna', cat: 'loisirs', rooms: ['spa'], w: 2, h: 2, cost: 1400, tier: 4, decor: 3, steam: true,
    use: { kind: 'spa', spots: [{ c: [0, 1], pose: 'inside' }, { c: [1, 1], pose: 'inside' }], price: 'spa' } },
  { id: 'hot_tub', name: 'Bain nordique', cat: 'loisirs', rooms: ['spa', 'terrace', 'garden'], w: 2, h: 2, cost: 1600, tier: 4, decor: 4, steam: true,
    use: { kind: 'spa', spots: [{ c: [0, 0], pose: 'bathe' }, { c: [1, 1], pose: 'bathe' }], price: 'spa' } },
  { id: 'massage_table', name: 'Table de massage', cat: 'loisirs', rooms: ['spa'], w: 1, h: 2, cost: 900, tier: 4, decor: 1,
    use: { kind: 'spa', spots: [{ c: [0, 0], pose: 'lie' }], price: 'massage' } },

  // ---- Décoration intérieure ----
  { id: 'plant', name: 'Plante en pot', cat: 'deco', rooms: 'indoor', w: 1, h: 1, cost: 35, tier: 1, decor: 2 },
  { id: 'big_plant', name: 'Grande plante', cat: 'deco', rooms: 'indoor', w: 1, h: 1, cost: 75, tier: 1, decor: 3 },
  { id: 'floor_lamp', name: 'Lampadaire', cat: 'deco', rooms: 'indoor', w: 1, h: 1, cost: 55, tier: 1, decor: 2,
    light: { r: 2.4, color: '#ffd28a', z: 1.3 } },
  { id: 'rug', name: 'Tapis tissé', cat: 'deco', rooms: 'indoor', w: 2, h: 2, cost: 90, tier: 1, decor: 3, comfort: 1, walkable: true },
  { id: 'flower_vase', name: 'Bouquet de fleurs', cat: 'deco', rooms: 'indoor', w: 1, h: 1, cost: 45, tier: 1, decor: 2 },
  { id: 'painting', name: 'Tableau sur chevalet', cat: 'deco', rooms: 'indoor', w: 1, h: 1, cost: 160, tier: 2, decor: 4 },
  { id: 'sculpture', name: 'Sculpture en bois', cat: 'deco', rooms: 'indoor', w: 1, h: 1, cost: 420, tier: 3, decor: 6 },
  { id: 'lake_painting', name: 'Tableau du lac (Jules)', cat: 'deco', rooms: 'indoor', w: 1, h: 1, cost: 0, tier: 1, decor: 9, special: true },
  { id: 'old_map', name: "Carte ancienne d'Augustin", cat: 'deco', rooms: 'indoor', w: 1, h: 1, cost: 0, tier: 1, decor: 7, special: true },
  { id: 'ice_axe', name: "Piolet d'Augustin", cat: 'deco', rooms: 'indoor', w: 1, h: 1, cost: 0, tier: 1, decor: 10, special: true },

  // ---- Extérieur ----
  { id: 'bench', name: 'Banc', cat: 'exterieur', rooms: 'outdoor', w: 2, h: 1, cost: 70, tier: 1, decor: 1, seat: true,
    use: { kind: 'relax', spots: [{ c: [0, 0], pose: 'sit' }, { c: [1, 0], pose: 'sit' }], outdoor: true } },
  { id: 'flower_bed', name: 'Parterre de fleurs', cat: 'exterieur', rooms: 'outdoor', w: 1, h: 1, cost: 40, tier: 1, decor: 3 },
  { id: 'hedge', name: 'Haie taillée', cat: 'exterieur', rooms: 'outdoor', w: 1, h: 1, cost: 30, tier: 1, decor: 1 },
  { id: 'lantern', name: 'Lanterne', cat: 'exterieur', rooms: 'outdoor', w: 1, h: 1, cost: 60, tier: 1, decor: 1,
    light: { r: 2.6, color: '#ffc26a', z: 1.2 } },
  { id: 'young_tree', name: 'Jeune érable', cat: 'exterieur', rooms: 'outdoor', w: 1, h: 1, cost: 80, tier: 1, decor: 3 },
  { id: 'birdhouse', name: 'Nichoir', cat: 'exterieur', rooms: 'outdoor', w: 1, h: 1, cost: 50, tier: 1, decor: 2 },
  { id: 'woodpile', name: 'Tas de bois', cat: 'exterieur', rooms: 'outdoor', w: 1, h: 1, cost: 40, tier: 1, decor: 1 },
  { id: 'swing', name: 'Balançoire', cat: 'exterieur', rooms: 'outdoor', w: 2, h: 1, cost: 260, tier: 1, decor: 2, kids: true,
    use: { kind: 'fun', spots: [{ c: [0, 0], pose: 'swing' }], outdoor: true } },
  { id: 'deck_chair', name: 'Chaise longue', cat: 'exterieur', rooms: ['terrace', 'garden', 'spa'], w: 1, h: 2, cost: 110, tier: 2, decor: 1, seat: true,
    use: { kind: 'relax', spots: [{ c: [0, 0], pose: 'recline' }], outdoor: true, sunny: true } },
  { id: 'well', name: 'Puits', cat: 'exterieur', rooms: 'outdoor', w: 1, h: 1, cost: 300, tier: 2, decor: 4 },
  { id: 'fountain', name: 'Fontaine', cat: 'exterieur', rooms: 'outdoor', w: 2, h: 2, cost: 800, tier: 3, decor: 8 },
  { id: 'telescope', name: 'Longue-vue', cat: 'exterieur', rooms: 'outdoor', w: 1, h: 1, cost: 450, tier: 3, decor: 2,
    use: { kind: 'view', spots: [{ c: [0, 1], pose: 'stand' }], outdoor: true } },
  { id: 'gazebo', name: 'Kiosque', cat: 'exterieur', rooms: 'outdoor', w: 2, h: 2, cost: 2600, tier: 5, decor: 12, seat: true,
    use: { kind: 'relax', spots: [{ c: [0, 0], pose: 'sit' }, { c: [1, 1], pose: 'sit' }], outdoor: true } },
  { id: 'ibex_statue', name: 'Statue du bouquetin', cat: 'exterieur', rooms: 'outdoor', w: 1, h: 1, cost: 3200, tier: 5, decor: 15 },
];

export const FURNITURE = Object.fromEntries(list.map((f) => [f.id, {
  decor: 0, comfort: 0, capacity: 0, ...f,
}]));

export const FURNITURE_ORDER = list.map((f) => f.id);

/** Effets par minute d'usage selon le type d'activité. */
export const USE_KINDS = {
  relax: { label: 'Se détend', dur: [40, 70], fun: 0.55, energy: 0.18 },
  read: { label: 'Lit un livre', dur: [35, 55], fun: 0.7, energy: 0.05 },
  fun: { label: 'S\'amuse', dur: [35, 55], fun: 1.0, energy: -0.08 },
  music: { label: 'Joue du piano', dur: [25, 40], fun: 1.0, energy: 0 },
  view: { label: 'Admire le paysage', dur: [20, 30], fun: 0.9, energy: 0 },
  spa: { label: 'Profite du spa', dur: [45, 70], fun: 1.0, energy: 0.35 },
  shop: { label: 'Fait du shopping', dur: [12, 20], fun: 0.6, energy: 0 },
  excursion: { label: 'Réserve une excursion', dur: [8, 12], fun: 0, energy: 0 },
  sleep: { label: 'Dort', dur: [0, 0], fun: 0, energy: 0 },
};
