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

// Päckchen-Sorten: alle stehen oben im Regal; nur freigeschaltete können gewählt werden.
// shape 'box' = eckig (Atlas-Textur), 'round' = Hutschachtel. bow = Farbe der Schleife auf dem Deckel.
// tissue = Farbe des Seidenpapiers innen. cost = späterer Freischalt-Preis (noch keine Kauf-Logik),
// bonus = Preisaufschlag beim Verkauf.
export const PACKAGE_TYPES = [
  { id: 'kraft', name: 'Kraftpapier', shape: 'box', tissue: '#f4eee4', cost: 0, bonus: 0, unlocked: true },
  { id: 'rosa', name: 'Rosa mit Schleife', shape: 'box', bow: '#fbf8f5', tissue: '#ffffff', cost: 150, bonus: 10, unlocked: false },
  { id: 'mint', name: 'Mint gepunktet', shape: 'box', tissue: '#ffffff', cost: 250, bonus: 15, unlocked: false },
  { id: 'candy', name: 'Zuckerstange', shape: 'box', tissue: '#ffe3ea', cost: 350, bonus: 20, unlocked: false },
  { id: 'noir', name: 'Schwarz & Gold', shape: 'box', bow: '#d9b24c', tissue: '#e9d39a', cost: 600, bonus: 35, unlocked: false },
  { id: 'hut', name: 'Hutschachtel Flieder', shape: 'round', tissue: '#f3ecfb', cost: 800, bonus: 45, unlocked: false },
];
