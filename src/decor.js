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

// Päckchen-Sorten (Recherche: Fensterschachtel, Banderole, Holzkiste, Blechdose, Weidenkorb,
// Hutschachtel, Sechseck- und Herzschachtel, Furoshiki-Tuch, Zeitungspapier, Aquarell, Terrazzo …).
// shape: 'box' eckig, 'round' rund (Hutschachtel/Dose/Korb), 'hex' Sechseck, 'heart' Herz.
// cat: Reiter in der Auswahl. shelf: steht als Beispiel oben im Regal (die anderen nur in der Auswahl).
// bow: Schleifenfarbe auf dem Deckel. tissue: Füllpapier innen. cost: Freischalt-Preis, bonus: Aufpreis.
// fit: wie die Seife in der Form liegt (s = Skalierung, dz = Versatz nach hinten, ry = Drehung).
export const PKG_CATS = ['Klassisch', 'Muster', 'Natur', 'Formen', 'Festlich'];
export const PACKAGE_TYPES = [
  { id: 'kraft', name: 'Kraftpapier', cat: 'Klassisch', shape: 'box', tissue: '#f4eee4', cost: 0, bonus: 0, unlocked: true, shelf: true },
  { id: 'banderole', name: 'Kraft mit Banderole', cat: 'Klassisch', shape: 'box', tissue: '#efe6d6', cost: 60, bonus: 4 },
  { id: 'fenster', name: 'Sichtfenster', cat: 'Klassisch', shape: 'box', tissue: '#ffffff', cost: 90, bonus: 6 },
  { id: 'zeitung', name: 'Zeitungspapier', cat: 'Klassisch', shape: 'box', tissue: '#f1efe8', cost: 110, bonus: 7 },
  { id: 'rosa', name: 'Rosa mit Schleife', cat: 'Muster', shape: 'box', bow: '#fbf8f5', tissue: '#ffffff', cost: 150, bonus: 10, shelf: true },
  { id: 'mint', name: 'Mint gepunktet', cat: 'Muster', shape: 'box', tissue: '#ffffff', cost: 180, bonus: 11 },
  { id: 'candy', name: 'Zuckerstange', cat: 'Muster', shape: 'box', tissue: '#ffe3ea', cost: 220, bonus: 13 },
  { id: 'aquarell', name: 'Aquarell', cat: 'Muster', shape: 'box', tissue: '#f4f0fb', cost: 260, bonus: 15 },
  { id: 'terrazzo', name: 'Terrazzo', cat: 'Muster', shape: 'box', tissue: '#f2efe9', cost: 300, bonus: 17 },
  { id: 'marmor', name: 'Marmor', cat: 'Muster', shape: 'box', bow: '#c9a04a', tissue: '#ffffff', cost: 380, bonus: 21 },
  { id: 'blumen', name: 'Vintage-Blumen', cat: 'Muster', shape: 'box', tissue: '#fdf6ec', cost: 420, bonus: 23 },
  { id: 'noir', name: 'Schwarz & Gold', cat: 'Muster', shape: 'box', bow: '#d9b24c', tissue: '#e9d39a', cost: 600, bonus: 32 },
  { id: 'kiste', name: 'Holzkiste', cat: 'Natur', shape: 'box', tissue: '#e2c48e', cost: 200, bonus: 12, shelf: true },
  { id: 'leinen', name: 'Leinen', cat: 'Natur', shape: 'box', tissue: '#f3ede2', cost: 280, bonus: 16 },
  { id: 'korb', name: 'Weidenkorb', cat: 'Natur', shape: 'round', tissue: '#ead9b5', cost: 340, bonus: 19 },
  { id: 'dose', name: 'Blechdose', cat: 'Natur', shape: 'round', tissue: '#ffffff', cost: 450, bonus: 25 },
  { id: 'hut', name: 'Hutschachtel Flieder', cat: 'Formen', shape: 'round', tissue: '#f3ecfb', cost: 500, bonus: 28, shelf: true },
  { id: 'wabe', name: 'Honigwabe', cat: 'Formen', shape: 'hex', tissue: '#fff3cf', cost: 550, bonus: 30, shelf: true },
  { id: 'herz', name: 'Herzschachtel', cat: 'Formen', shape: 'heart', bow: '#ffffff', tissue: '#ffe0e6', cost: 700, bonus: 38, shelf: true },
  { id: 'weihnacht', name: 'Weihnachten', cat: 'Festlich', shape: 'box', bow: '#c8202f', tissue: '#f5f0e6', cost: 400, bonus: 22 },
  { id: 'furoshiki', name: 'Furoshiki-Tuch', cat: 'Festlich', shape: 'box', bow: '#2f4c8a', tissue: '#f2f0ea', cost: 520, bonus: 29 },
  { id: 'sterne', name: 'Sternenhimmel', cat: 'Festlich', shape: 'box', bow: '#e6c260', tissue: '#dfe4f5', cost: 650, bonus: 35 },
];
for (const t of PACKAGE_TYPES) if (t.unlocked === undefined) t.unlocked = false;
