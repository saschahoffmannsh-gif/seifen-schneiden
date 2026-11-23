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
