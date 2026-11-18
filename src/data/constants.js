// Constantes globales de simulation.

export const MAP_W = 40;
export const MAP_H = 40;
export const SAVE_VERSION = 1;

export const MIN_PER_HOUR = 60;
export const MIN_PER_DAY = 24 * 60;
export const DAYS_PER_SEASON = 7;
/** Minutes de jeu par seconde réelle à la vitesse x1 (1 h = 10 s). */
export const GAME_MIN_PER_SEC = 6;
/** Multiplicateur appliqué la nuit (0h-6h) pour ne pas faire attendre le joueur. */
export const NIGHT_BOOST = 4;

/** Vitesse de marche en cases par minute de jeu. */
export const WALK_SPEED = 0.26;

export const START_MONEY = 2600;
export const START_HOUR = 9;

export const TERRAIN = Object.freeze({
  GRASS: 0, PATH: 1, WATER: 2, ROCK: 3, FOREST: 4, BRIDGE: 5, SAND: 6, ROAD: 7,
});
export const WALKABLE_TERRAIN = new Set([TERRAIN.GRASS, TERRAIN.PATH, TERRAIN.BRIDGE, TERRAIN.SAND, TERRAIN.ROAD]);
export const BUILDABLE_TERRAIN = new Set([TERRAIN.GRASS, TERRAIN.PATH, TERRAIN.SAND, TERRAIN.FOREST]);

/** Points clés de la carte (bords de carte où apparaissent les agents). */
export const SPOTS = Object.freeze({
  roadStart: [13, 39],   // arrivée depuis le village (bord sud-ouest)
  trailEnd: [0, 9],      // départ du sentier de randonnée (bord nord-ouest)
  supplierStop: [17, 30],
});
