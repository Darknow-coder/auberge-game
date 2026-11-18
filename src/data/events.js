// Événements aléatoires (avec ou sans choix) et histoires de personnages récurrents.
// Chaque `cond(s, api)` renvoie un contexte (objet) si l'événement peut se produire, sinon null.
// Les `effect(s, api, ctx)` appliquent les conséquences et renvoient un texte de résultat.

export const RANDOM_EVENTS = [
  {
    id: 'lost_item', title: 'Un objet perdu', weight: 1.2, cooldown: 3,
    cond: (s, api) => { const g = api.randomGuest((g) => g.state !== 'hiking'); return g ? { guest: g, item: api.pick(['sa montre', 'son carnet de voyage', 'ses lunettes', 'son appareil photo', 'une bague de famille']) } : null; },
    text: (c) => `${c.guest.name} a perdu ${c.item} et semble désemparé${c.guest.fem ? 'e' : ''}. Que faites-vous ?`,
    choices: [
      { label: 'Organiser une recherche', effect: (s, api, c) => {
        if (api.chance(0.7)) { api.satisfy(c.guest, 18, `On a retrouvé ${c.item} !`); api.money(30, 'tips', 'Pourboire de remerciement'); return `Retrouvé derrière un fauteuil ! ${c.guest.name} vous laisse 30 écus de pourboire.`; }
        api.satisfy(c.guest, 5, 'Ils ont tout fait pour m\'aider.'); return 'Introuvable… mais votre dévouement a été apprécié.'; } },
      { label: 'Offrir un dédommagement', cost: 40, effect: (s, api, c) => { api.money(-40, 'misc', 'Dédommagement'); api.satisfy(c.guest, 12, 'Un geste commercial apprécié.'); return 'Le geste est apprécié.'; } },
      { label: 'Ne rien faire', effect: (s, api, c) => { api.satisfy(c.guest, -8, 'Personne ne m\'a aidé à chercher.'); return 'Le client repart bredouille…'; } },
    ],
  },
  {
    id: 'birthday', title: 'Un anniversaire', weight: 1, cooldown: 5,
    cond: (s, api) => { if (!api.restaurantOpen()) return null; const g = api.randomGuest((g) => g.type === 'family' || g.type === 'couple'); return g ? { guest: g } : null; },
    text: (c) => `${c.guest.name} souhaite organiser une petite fête d'anniversaire ce soir au restaurant. Il faudra 6 portions d'ingrédients.`,
    choices: [
      { label: 'Accepter (+150 écus)', effect: (s, api, c) => {
        if (!api.takeStock('ingredients', 6)) { api.satisfy(c.guest, -6, 'La fête a été annulée faute de provisions.'); return 'Pas assez d\'ingrédients en stock… la fête est annulée.'; }
        api.money(150, 'meals', 'Fête d\'anniversaire'); api.satisfy(c.guest, 22, 'Une fête d\'anniversaire inoubliable !'); api.rep(1); return 'Gâteau, chansons et rires : une soirée mémorable.'; } },
      { label: 'Refuser poliment', effect: (s, api, c) => { api.satisfy(c.guest, -4, 'Dommage pour la fête…'); return 'Ils fêteront cela ailleurs.'; } },
    ],
  },
  {
    id: 'generous_tip', title: 'Pourboire généreux', weight: 1, cooldown: 2,
    cond: (s, api) => { const g = api.randomGuest((g) => g.satisfaction > 70); return g ? { guest: g, amount: api.int(25, 70) } : null; },
    auto: (s, api, c) => { api.money(c.amount, 'tips', 'Pourboire'); return `${c.guest.name} est ravi${c.guest.fem ? 'e' : ''} de son séjour et laisse ${c.amount} écus de pourboire !`; },
  },
  {
    id: 'waterfall', title: 'Une découverte', weight: 0.7, cooldown: 30, once: true,
    cond: (s, api) => { const g = api.randomGuest((g) => g.type === 'hiker' || g.type === 'adventurer'); return g ? { guest: g } : null; },
    text: (c) => `De retour de randonnée, ${c.guest.name} raconte avoir découvert une cascade cachée au-dessus du lac. « Vous devriez la faire connaître ! »`,
    choices: [
      { label: 'Baliser le sentier', cost: 250, effect: (s, api) => { api.money(-250, 'build', 'Balisage du sentier'); api.flag('waterfall', true); api.rep(2); return 'Le « Sentier de la Cascade » attire désormais davantage de randonneurs (+20 %).'; } },
      { label: 'Le remercier', effect: (s, api, c) => { api.satisfy(c.guest, 6, 'Ils ont écouté mon histoire avec intérêt.'); return 'Une belle histoire à raconter au coin du feu.'; } },
    ],
  },
  {
    id: 'celebrity', title: 'Rumeur au village', weight: 0.5, cooldown: 12, minTier: 2,
    cond: () => ({}),
    auto: (s, api) => { api.spawnSpecial('celebrity'); return 'On murmure qu\'une personnalité connue voyagerait incognito dans la région… Soignez chaque client !'; },
  },
  {
    id: 'angry', title: 'Un client mécontent', weight: 1.2, cooldown: 2,
    cond: (s, api) => { const g = api.randomGuest((g) => g.satisfaction < 42 && g.state !== 'leaving'); return g ? { guest: g } : null; },
    text: (c) => `${c.guest.name} est très mécontent${c.guest.fem ? 'e' : ''} et menace de laisser un avis désastreux sur le Guide des Cimes.`,
    choices: [
      { label: 'Offrir le repas', cost: 25, effect: (s, api, c) => { api.money(-25, 'misc', 'Repas offert'); api.satisfy(c.guest, 14, 'On m\'a offert un repas pour s\'excuser.'); return 'Le client se radoucit un peu.'; } },
      { label: 'Offrir une nuit', effect: (s, api, c) => { api.discountNight(c.guest); api.satisfy(c.guest, 26, 'Une nuit offerte, voilà qui est correct.'); return 'Une nuit ne sera pas facturée. Le client est apaisé.'; } },
      { label: 'Ignorer', effect: (s, api, c) => { api.satisfy(c.guest, -6, 'On ne m\'a même pas écouté.'); return 'Le client fulmine dans son coin…'; } },
    ],
  },
  {
    id: 'group_tour', title: 'Un groupe arrive', weight: 0.8, cooldown: 6,
    cond: (s, api) => (api.freeRooms() >= 2 ? { n: Math.min(4, api.freeRooms()) } : null),
    auto: (s, api, c) => { for (let i = 0; i < c.n; i++) api.spawnParty(api.pick(['hiker', 'hiker', 'passing', 'adventurer']), 30 + i * 12); return `Un groupe de ${c.n} équipes de randonneurs remonte le chemin. Préparez-vous !`; },
  },
  {
    id: 'busy_weekend', title: 'Week-end de pont', weight: 0.7, cooldown: 10,
    cond: () => ({}),
    auto: (s, api) => { api.modifier('weekend', 2, { demand: 1.5 }); return 'Un week-end prolongé s\'annonce : la fréquentation va grimper pendant 2 jours.'; },
  },
  {
    id: 'festival', title: 'Fête du village', weight: 0.6, cooldown: 14,
    cond: (s, api) => ({ name: ['Fête des fleurs', 'Fête de la transhumance', 'Fête des récoltes', 'Fête des lumières'][api.seasonIndex()] }),
    text: (c) => `La ${c.name} a lieu au village ces deux prochains jours ! Le comité vous propose de tenir un stand.`,
    choices: [
      { label: 'Tenir un stand', cost: 150, effect: (s, api) => { api.money(-150, 'misc', 'Stand à la fête'); api.modifier('festival', 2, { demand: 1.45 }); api.rep(3); return 'Votre stand fait sensation : réputation en hausse et visiteurs en nombre.'; } },
      { label: 'Simplement profiter', effect: (s, api) => { api.modifier('festival', 2, { demand: 1.2 }); return 'La fête attire tout de même quelques voyageurs supplémentaires.'; } },
    ],
  },
  {
    id: 'supplier_promo', title: 'Promotion du fromager', weight: 0.8, cooldown: 6,
    cond: (s, api) => (api.hasRoom('kitchen') ? {} : null),
    text: () => 'Le fromager du village vous propose 30 portions d\'ingrédients à prix cassé : 70 écus au lieu de 120.',
    choices: [
      { label: 'Acheter (70)', effect: (s, api) => { api.money(-70, 'supplies', 'Promotion ingrédients'); const n = api.addStock('ingredients', 30); return `${n} portions rangées au garde-manger.`; } },
      { label: 'Non merci', effect: () => 'Une autre fois peut-être.' },
    ],
  },
  {
    id: 'heating', title: 'Panne de chauffage', weight: 1.4, cooldown: 10, seasons: [3],
    cond: () => ({}),
    text: () => 'La chaudière fait des siennes et les chambres se refroidissent. Le chauffagiste peut passer aujourd\'hui.',
    choices: [
      { label: 'Réparer (260)', effect: (s, api) => { api.money(-260, 'maintenance', 'Réparation du chauffage'); return 'La chaleur revient dans toute l\'auberge.'; } },
      { label: 'Attendre', effect: (s, api) => { api.modifier('cold', 3, { comfort: -0.25 }); return 'Les chambres seront moins confortables pendant 3 jours.'; } },
    ],
  },
  {
    id: 'blizzard', title: 'Route bloquée', weight: 0.9, cooldown: 12, seasons: [3],
    cond: () => ({}),
    auto: (s, api) => { api.modifier('blizzard', 1, { demand: 0.05, extend: true }); return 'Une tempête de neige bloque la route : pas d\'arrivées aujourd\'hui, mais vos clients prolongeront volontiers leur séjour.'; },
  },
  {
    id: 'inspector', title: 'Le Guide des Cimes', weight: 0.6, cooldown: 14, minTier: 2,
    cond: () => ({}),
    auto: (s, api) => { api.spawnSpecial('inspector'); return 'Un inspecteur du Guide des Cimes séjournera bientôt chez vous, incognito. Sa note pèsera lourd !'; },
  },
  {
    id: 'stray_cat', title: 'Un chat errant', weight: 0.6, cooldown: 99, once: true,
    cond: (s, api) => (api.hasRoom('lounge') ? {} : null),
    text: () => 'Un chat roux s\'est glissé dans la salle commune et ronronne près de la cheminée. Les clients semblent l\'adorer.',
    choices: [
      { label: 'L\'adopter', effect: (s, api) => { api.flag('cat', true); api.rep(1); return 'Bienvenue à Caramel, la nouvelle mascotte de l\'auberge !'; } },
      { label: 'Le raccompagner dehors', effect: () => 'Le chat retourne vers le village.' },
    ],
  },
  {
    id: 'raise', title: 'Demande d\'augmentation', weight: 0.8, cooldown: 7,
    cond: (s, api) => { const st = api.randomStaff((x) => x.daysWorked > 8 && !x.raised); return st ? { staff: st } : null; },
    text: (c) => `${c.staff.name} travaille dur depuis ${c.staff.daysWorked} jours et demande une augmentation de 15 %.`,
    choices: [
      { label: 'Accepter', effect: (s, api, c) => { c.staff.salary = Math.round(c.staff.salary * 1.15); c.staff.raised = true; c.staff.skill = Math.min(1, c.staff.skill + 0.05); return `${c.staff.name} est motivé${c.staff.fem ? 'e' : ''} et progresse.`; } },
      { label: 'Refuser', effect: (s, api, c) => { c.staff.raised = true; if (api.chance(0.3)) { api.fireStaff(c.staff, true); return `${c.staff.name} a donné sa démission…`; } return `${c.staff.name} accepte la décision, sans enthousiasme.`; } },
    ],
  },
  {
    id: 'wedding', title: 'Une demande en mariage', weight: 0.5, cooldown: 20, minTier: 3,
    cond: (s, api) => (api.gardenDecor() >= 5 ? {} : null),
    text: () => 'Un couple du village rêve de célébrer son mariage dans votre jardin. Il faudra 12 portions d\'ingrédients et 20 boissons.',
    choices: [
      { label: 'Organiser la noce (+900)', effect: (s, api) => {
        if (!api.takeStock('ingredients', 12) || !api.takeStock('drinks', 20)) return 'Les stocks sont insuffisants : la noce se fera ailleurs.';
        api.money(900, 'activities', 'Mariage au jardin'); api.rep(4); return 'Une noce magnifique ! Tout le village en parle.'; } },
      { label: 'Décliner', effect: () => 'Le couple trouvera un autre lieu.' },
    ],
  },
];

// --- Personnages récurrents ---
// look : apparence fixe. chapters : étapes successives ; after = jours minimum depuis la visite précédente.
export const STORIES = {
  elise_marc: {
    name: 'Élise & Marc', type: 'couple', minTier: 1,
    members: [
      { first: 'Élise', fem: true, age: 28, skin: '#f3d2b3', hair: '#7a2f1e', hairStyle: 'long', top: '#c45a6e', bottom: '#3a3a44' },
      { first: 'Marc', fem: false, age: 30, skin: '#e8bf9a', hair: '#2b1d14', hairStyle: 'short', top: '#2e4057', bottom: '#22252c' },
    ],
    chapters: [
      { after: 2, nights: 2, title: 'Jeunes mariés',
        text: 'Élise et Marc entrent main dans la main. « Nous sommes en lune de miel ! On nous a dit que votre auberge était charmante… »',
        choices: [
          { label: 'Offrir une bouteille (30)', effect: (s, api, c) => { api.money(-30, 'misc', 'Cadeau'); api.relation(c, 2); api.satisfy(c.guest, 20, 'Une bouteille offerte pour notre lune de miel !'); return 'Les jeunes mariés sont touchés par l\'attention.'; } },
          { label: 'Les féliciter', effect: (s, api, c) => { api.relation(c, 1); api.satisfy(c.guest, 6, 'Un accueil chaleureux.'); return '« Merci, c\'est adorable ! »'; } },
        ] },
      { after: 9, nights: 2, title: 'Un mois déjà',
        text: '« Nous revoilà ! Nous fêtons notre premier mois de mariage. Nous avons parlé de vous à nos amis. »',
        choices: [
          { label: 'Leur réserver la plus belle chambre', effect: (s, api, c) => { api.relation(c, 1); api.satisfy(c.guest, 12, 'Ils se sont souvenus de nous !'); if (c.relation >= 3) { api.spawnParty('couple', 60); return 'Touchés, ils ont convaincu un couple d\'amis de venir aussi.'; } return 'Ils sont ravis d\'être reconnus.'; } },
          { label: 'Accueil habituel', effect: () => 'Ils s\'installent tranquillement.' },
        ] },
      { after: 18, nights: 3, title: 'Une petite surprise', size: 3,
        text: 'Élise et Marc reviennent… avec un bébé dans les bras ! « Voici Léa. Nous voulions lui montrer l\'endroit où tout a commencé. »',
        choices: [
          { label: 'Installer un berceau (60)', effect: (s, api, c) => { api.money(-60, 'misc', 'Berceau'); api.relation(c, 2); api.satisfy(c.guest, 22, 'Un berceau nous attendait !'); return 'La petite Léa dort comme un loir.'; } },
          { label: 'Les féliciter chaleureusement', effect: (s, api, c) => { api.relation(c, 1); return '« Elle a déjà vos montagnes dans les yeux ! »'; } },
        ] },
      { after: 14, nights: 2, title: 'Un article élogieux',
        text: 'Marc est devenu journaliste pour un magazine de voyage. « Nous aimerions consacrer un article à votre auberge. »',
        choices: [
          { label: 'Accepter avec joie', effect: (s, api, c) => { const r = c.relation >= 4 ? 6 : 3; api.rep(r); api.money(300, 'misc', 'Droits photos'); return `L'article paraît : réputation +${r} et 300 écus de droits photos.`; } },
        ] },
    ],
  },
  augustin: {
    name: 'Augustin, le vieux guide', type: 'hiker', minTier: 1,
    members: [{ first: 'Augustin', last: 'Berthod', fem: false, age: 74, skin: '#d9a77f', hair: '#d8d4cc', hairStyle: 'beard', top: '#7a3b2a', bottom: '#4b4a3c', hat: true, backpack: true }],
    chapters: [
      { after: 4, nights: 2, title: 'Le vieux guide',
        text: 'Un vieil homme au visage buriné pose son sac. « Augustin Berthod, guide depuis cinquante ans. Je connais chaque sentier de ces montagnes. Vous avez une minute pour une histoire ? »',
        choices: [
          { label: 'Écouter son histoire', effect: (s, api, c) => { api.relation(c, 2); api.flag('chamois', true); return 'Il vous parle du Sentier des Chamois, oublié de tous. Les randonnées de vos clients seront plus belles (+satisfaction).'; } },
          { label: 'Pas le temps', effect: (s, api, c) => { api.relation(c, 0); return 'Il hausse les épaules et monte se coucher.'; } },
        ] },
      { after: 10, nights: 2, title: 'La carte ancienne',
        text: '« Je ne peux plus monter aussi haut qu\'avant. J\'aimerais que ma vieille carte reste ici, où elle sera utile. »',
        choices: [
          { label: 'Accepter la carte', effect: (s, api, c) => { api.relation(c, 2); api.unlockItem('old_map'); return 'La « Carte ancienne d\'Augustin » est disponible dans le menu Construire (décor exceptionnel).'; } },
        ] },
      { after: 14, nights: 3, title: 'Transmettre', minTier: 3,
        text: '« Il paraît que vous organisez des excursions. Laissez-moi former votre guide quelques jours. »',
        choices: [
          { label: 'Avec plaisir', effect: (s, api, c) => { api.relation(c, 2); const n = api.trainRole('guide', 0.2); return n ? 'Vos guides ont beaucoup appris (+compétence).' : 'Vous n\'avez pas encore de guide… il vous laisse ses notes (excursions +10 % de satisfaction).'; } },
        ] },
      { after: 20, nights: 1, title: 'Le dernier sommet',
        text: '« C\'est ma dernière saison en montagne. Je voulais vous laisser quelque chose. » Il vous tend son vieux piolet.',
        choices: [
          { label: 'L\'accrocher avec fierté', effect: (s, api, c) => { api.unlockItem('ice_axe'); api.rep(3); return 'Le « Piolet d\'Augustin » rejoint votre décoration. Une légende de la vallée.'; } },
        ] },
    ],
  },
  jules: {
    name: 'Jules, peintre itinérant', type: 'passing', minTier: 1,
    members: [{ first: 'Jules', last: 'Moret', fem: false, age: 34, skin: '#f3d2b3', hair: '#4a2f1f', hairStyle: 'curly', top: '#d5a253', bottom: '#3b4250', hat: true }],
    chapters: [
      { after: 6, nights: 2, free: true, title: 'Un artiste sans le sou',
        text: 'Un jeune peintre aux mains tachées de couleurs : « Je n\'ai presque plus d\'argent… Pourrais-je payer ma chambre avec un tableau du lac ? »',
        choices: [
          { label: 'Accepter le tableau', effect: (s, api, c) => { api.relation(c, 2); c.guest.freeStay = true; api.unlockItem('lake_painting'); return 'Le « Tableau du lac » est disponible dans Construire > Décoration (décor +9).'; } },
          { label: 'Refuser poliment', effect: (s, api, c) => { api.relation(c, -1); c.guest.nights = 0; return 'Il repart vers le village, son carton sous le bras.'; } },
        ] },
      { after: 25, nights: 2, title: 'Le peintre devenu célèbre', needRelation: 1,
        text: 'Jules est de retour, élégamment vêtu. « Mon tableau du lac a lancé ma carrière ! Je voudrais organiser une exposition chez vous. »',
        choices: [
          { label: 'Organiser l\'exposition', effect: (s, api) => { api.money(600, 'activities', 'Exposition de Jules'); api.rep(3); api.modifier('expo', 2, { demand: 1.3 }); return 'Le tout-Valmaure se presse à l\'exposition : 600 écus et réputation en hausse.'; } },
        ] },
    ],
  },
  lina: {
    name: "Lina, l'alpiniste", type: 'adventurer', minTier: 2,
    members: [{ first: 'Lina', last: 'Cattin', fem: true, age: 29, skin: '#c18e66', hair: '#1c1c22', hairStyle: 'ponytail', top: '#e0a12c', bottom: '#2f3a2c', hat: true, backpack: true }],
    chapters: [
      { after: 3, nights: 3, title: 'Objectif sommet',
        text: '« Je m\'appelle Lina. Je prépare l\'ascension de l\'Aiguille Blanche, en solitaire. Il me faudrait des provisions pour trois jours. »',
        choices: [
          { label: 'Fournir 8 portions', effect: (s, api, c) => { if (!api.takeStock('ingredients', 8)) return 'Votre garde-manger est vide… Lina partira avec ce qu\'elle a.'; api.relation(c, 3); return 'Lina vous remercie : « Je vous enverrai une carte du sommet ! »'; } },
          { label: 'Lui souhaiter bonne chance', effect: (s, api, c) => { api.relation(c, 1); return '« Merci ! On se revoit à la descente. »'; } },
        ] },
      { after: 7, nights: 2, title: 'Retour du sommet',
        text: 'Lina revient, épuisée mais rayonnante : « J\'ai réussi ! Et j\'ai raconté à tout le monde où j\'avais préparé l\'ascension. »',
        choices: [
          { label: 'Fêter ça au bar', effect: (s, api, c) => { const r = c.relation >= 3 ? 5 : 2; api.rep(r); api.money(120, 'drinks', 'Tournée de célébration'); api.spawnParty('adventurer', 90); return `Une soirée mémorable ! Réputation +${r}, et des alpinistes arrivent déjà.`; } },
        ] },
    ],
  },
  valtorta: {
    name: 'Mme Valtorta, critique culinaire', type: 'difficult', minTier: 2, needs: 'restaurant',
    members: [{ first: 'Margaux', last: 'Valtorta', fem: true, age: 52, skin: '#e8bf9a', hair: '#9a9a9a', hairStyle: 'bun', top: '#1f2a44', bottom: '#151820' }],
    chapters: [
      { after: 5, nights: 1, title: 'Une cliente attentive', judge: 'food',
        text: 'Une dame élégante examine la carte avec un petit carnet. Votre serveur chuchote : « C\'est Margaux Valtorta, la critique culinaire ! »',
        choices: [
          { label: 'Soigner particulièrement sa table', effect: (s, api, c) => { api.relation(c, 1); c.guest.vipCare = true; return 'Vos équipes sont sur le qui-vive. Son avis dépendra de la qualité des plats servis.'; } },
          { label: 'La traiter comme les autres', effect: () => 'Que la cuisine parle d\'elle-même.' },
        ] },
      { after: 20, nights: 1, title: 'Le retour de la critique', judge: 'food', minTier: 3,
        text: '« J\'ai entendu dire que votre carte s\'était enrichie. Je viens vérifier. »',
        choices: [
          { label: 'Lui présenter le chef', effect: (s, api, c) => { api.relation(c, 1); api.unlockRecipe('sommets'); return 'Impressionnée, elle vous confie sa recette du « Menu des Sommets » (débloqué).'; } },
        ] },
    ],
  },
};

/** Visiteurs spéciaux ponctuels (non récurrents). */
export const SPECIAL_GUESTS = {
  celebrity: { type: 'wealthy', nights: [2, 3], vip: 'celebrity', name: 'Un voyageur discret' },
  inspector: { type: 'difficult', nights: [1, 2], vip: 'inspector', name: 'Un client méticuleux' },
};
