// Félicitations et combos : toujours en anglais et en capitales, quelle que soit la langue
// de l'interface (choix de style : ça claque davantage, comme dans les jeux d'arcade).

/** Mot de félicitation selon la taille du plus grand enclos (null en dessous de 4 cases). */
export function areaHype(n) {
  if (n >= 20) return 'LEGENDARY!';
  if (n >= 16) return 'INCREDIBLE!';
  if (n >= 12) return 'AMAZING!';
  if (n >= 9) return 'AWESOME!';
  if (n >= 6) return 'GREAT!';
  if (n >= 4) return 'NICE!';
  return null;
}

/** Palier de combo (null en dessous de 6). */
export function comboTier(n) {
  if (n >= 15) return 'GODLIKE!';
  if (n >= 10) return 'UNSTOPPABLE!';
  if (n >= 6) return 'ON FIRE!';
  return null;
}

export const multiHype = (n) => (n >= 4 ? 'QUADRUPLE!' : n === 3 ? 'TRIPLE!' : 'DOUBLE!');

export const HYPE = {
  white: 'WHITE LIGHT!',
  star: 'STAR CAUGHT!',
  clean: 'CLEAN SWEEP!',
  record: 'NEW RECORD!',
  levelClear: 'LEVEL CLEAR!',
  dailyDone: 'CHALLENGE COMPLETE!',
  rescued: 'SAVED!',
  combo: (n) => `COMBO ×${n}`,
  time: (s) => `+${s}s`,
};
