// Verpackungs-Deko für später: wird freigeschaltet und erhöht den Verkaufspreis.
// Bisher nur Daten (keine Oberfläche); die Deko steht schon sichtbar im Regal (setting/wall.js),
// ist aber noch nicht anklickbar.
export const DECOR = [
  { id: 'schleife', name: 'Schleifenband', bonus: 5, cost: 60, unlocked: false },
  { id: 'blueten', name: 'Deko-Blüten', bonus: 8, cost: 120, unlocked: false },
  { id: 'perlen', name: 'Perlen', bonus: 10, cost: 180, unlocked: false },
  { id: 'flocken', name: 'Seifenflocken', bonus: 12, cost: 250, unlocked: false },
];

/** Preisaufschlag aller freigeschalteten und aufs Päckchen gelegten Deko-Teile. */
export function decorBonus(ids) {
  let b = 0;
  for (const d of DECOR) if (d.unlocked && ids.includes(d.id)) b += d.bonus;
  return b;
}

// Päckchen-Sorten: alle stehen im Regal; nur freigeschaltete können gewählt werden.
// color = Grundfarbe der Pappe (multipliziert mit der hellen Papier-Textur).
// cost = späterer Freischalt-Preis (noch keine Kauf-Logik), bonus = Preisaufschlag beim Verkauf.
export const PACKAGE_TYPES = [
  { id: 'kraft', name: 'Kraftpapier', color: '#c4925e', cost: 0, bonus: 0, unlocked: true },
  { id: 'rosa', name: 'Rosa Geschenkbox', color: '#f3a9bd', cost: 150, bonus: 10, unlocked: false },
  { id: 'mint', name: 'Mint-Schachtel', color: '#9fd9c2', cost: 300, bonus: 20, unlocked: false },
  { id: 'gold', name: 'Goldene Box', color: '#e2b84a', cost: 600, bonus: 35, unlocked: false },
];
