// Deko für die Päckchen (Recherche: Knisterpapier/Holzwolle als Füllung, Perlen, Seifenflocken,
// Rosenblätter, Lavendel, Trockenblumen, Baumwollblüte; obendrauf Satin-/Samtband, Bäckerschnur,
// Bast, Spitze, Wachssiegel, Sticker, Washi-Tape, Anhänger mit Namen, Geschenkkarte, getrocknete
// Orangenscheibe, Zimtstangen, Eukalyptus, Mini-Tannenzapfen).
//
// group = Einstieg im unteren Regal (eine Sache dort öffnet die Auswahl dieser Gruppe).
// phase 'fill' = ins offene Päckchen (vor dem Deckel), 'lid' = auf den Deckel (danach).
// look: wie es in 3D aussieht. Füllungen: geo 'sphere' | 'flat' | 'strand' | 'heart'.

export const DECO_GROUPS = [
  { id: 'fuellung', name: 'Füllung', phase: 'fill' },
  { id: 'perlen', name: 'Perlen', phase: 'fill' },
  { id: 'flocken', name: 'Seifenflocken', phase: 'fill' },
  { id: 'blueten', name: 'Blüten', phase: 'fill' },
  { id: 'baender', name: 'Schleifen & Bänder', phase: 'lid' },
  { id: 'siegel', name: 'Siegel & Sticker', phase: 'lid' },
  { id: 'anhaenger', name: 'Anhänger', phase: 'lid' },
  { id: 'natur', name: 'Naturdeko', phase: 'lid' },
];

const F = (id, group, name, cost, bonus, look) => ({ id, group, name, cost, bonus, look, unlocked: cost === 0 });

export const DECO_ITEMS = [
  F('knister-natur', 'fuellung', 'Knisterpapier natur', 0, 2, { geo: 'strand', colors: ['#c9a27a', '#b88d61', '#d8b994'], size: [0.07, 0.1], n: 10 }),
  F('knister-rosa', 'fuellung', 'Knisterpapier rosa', 60, 4, { geo: 'strand', colors: ['#f4a9bd', '#f7c3d0', '#ee8fa8'], size: [0.07, 0.1], n: 10 }),
  F('holzwolle', 'fuellung', 'Holzwolle', 90, 5, { geo: 'strand', colors: ['#e3c48f', '#d6b17a', '#ecd3a5'], size: [0.08, 0.12], n: 12 }),

  F('perlen-weiss', 'perlen', 'Weiße Perlen', 70, 4, { geo: 'sphere', colors: ['#fbf7f0', '#f3eee6', '#fffaf2'], size: [0.018, 0.024], n: 9 }),
  F('perlen-rosa', 'perlen', 'Rosa Perlen', 90, 5, { geo: 'sphere', colors: ['#f6c6d2', '#f2b2c4', '#fbd9e1'], size: [0.018, 0.024], n: 9 }),
  F('perlen-gold', 'perlen', 'Goldperlen', 160, 8, { geo: 'sphere', colors: ['#e5c25c', '#d4a93a', '#f1d98a'], size: [0.016, 0.022], n: 9, metal: true }),
  F('mini-herzen', 'perlen', 'Mini-Herzen', 140, 7, { geo: 'heart', colors: ['#e2304d', '#f06a86', '#ffffff'], size: [0.03, 0.04], n: 8 }),

  F('flocken-bunt', 'flocken', 'Seifenflocken bunt', 0, 2, { geo: 'flat', colors: ['#f2789a', '#f6e0a0', '#b79be0', '#8fe3c5', '#fff6e6'], size: [0.025, 0.04], n: 10 }),
  F('flocken-rosa', 'flocken', 'Seifenflocken rosa', 50, 3, { geo: 'flat', colors: ['#f2789a', '#f7a8be', '#ffd0dc'], size: [0.025, 0.04], n: 10 }),
  F('flocken-lavendel', 'flocken', 'Seifenflocken lavendel', 70, 4, { geo: 'flat', colors: ['#b79be0', '#d6c4f2', '#9a7bd0'], size: [0.025, 0.04], n: 10 }),
  F('glitzer', 'flocken', 'Glitzer', 180, 9, { geo: 'sphere', colors: ['#f1d98a', '#ffffff', '#e5c25c', '#f6c6d2'], size: [0.007, 0.011], n: 24, metal: true }),

  F('rosenblaetter', 'blueten', 'Rosenblätter', 80, 5, { geo: 'flat', colors: ['#c8203f', '#e0425e', '#a5162f'], size: [0.045, 0.06], n: 7, petal: true }),
  F('lavendel', 'blueten', 'Lavendelzweige', 100, 6, { geo: 'strand', colors: ['#8e6cc4', '#a487d6', '#7a5ab2'], size: [0.09, 0.12], n: 6, sprig: true }),
  F('gaensebluemchen', 'blueten', 'Gänseblümchen', 120, 7, { geo: 'flat', colors: ['#ffffff', '#fffdf4', '#f6d24a'], size: [0.03, 0.045], n: 8 }),
  F('trockenblumen', 'blueten', 'Trockenblumen', 150, 8, { geo: 'flat', colors: ['#d9a46b', '#c97b6a', '#e6cf9a', '#a8a36a'], size: [0.03, 0.05], n: 9, petal: true }),
  F('baumwolle', 'blueten', 'Baumwollblüte', 200, 10, { geo: 'sphere', colors: ['#ffffff', '#f7f4ee'], size: [0.035, 0.05], n: 5 }),

  F('schnur', 'baender', 'Bäckerschnur', 0, 2, { type: 'ribbon', color: '#f4eee6', tex: 'twine', w: 0.025, rough: 0.9 }),
  F('satin-rosa', 'baender', 'Satinband rosa', 60, 4, { type: 'ribbon', color: '#f3a5bb', w: 0.07, rough: 0.3 }),
  F('satin-rot', 'baender', 'Satinband rot', 80, 5, { type: 'ribbon', color: '#c8202f', w: 0.07, rough: 0.3 }),
  F('bast', 'baender', 'Bastband', 100, 5, { type: 'ribbon', color: '#e4cf9c', tex: 'raffia', w: 0.05, rough: 0.95 }),
  F('samt-gruen', 'baender', 'Samtband grün', 130, 7, { type: 'ribbon', color: '#2f6b4a', w: 0.07, rough: 0.95 }),
  F('goldband', 'baender', 'Goldband', 180, 9, { type: 'ribbon', color: '#d9b24c', w: 0.06, rough: 0.25, metal: 0.7 }),
  F('spitze', 'baender', 'Spitzenband', 220, 11, { type: 'ribbon', color: '#fbf6ea', tex: 'lace', w: 0.08, rough: 0.8 }),

  F('danke', 'siegel', 'Sticker „Danke“', 0, 2, { type: 'sticker', color: '#fff6e8', ink: '#b5475f', text: 'Danke' }),
  F('handmade', 'siegel', 'Sticker „Handmade“', 50, 3, { type: 'sticker', color: '#c9a173', ink: '#3e2a18', text: 'Handmade' }),
  F('herz-sticker', 'siegel', 'Herz-Sticker', 70, 4, { type: 'sticker', color: '#e2304d', ink: '#ffffff', text: '♥' }),
  F('washi', 'siegel', 'Washi-Tape', 90, 5, { type: 'washi', color: '#9fd3c7' }),
  F('siegel-rot', 'siegel', 'Wachssiegel rot', 150, 8, { type: 'seal', color: '#a3162b' }),
  F('siegel-gold', 'siegel', 'Wachssiegel gold', 220, 11, { type: 'seal', color: '#c9a04a', metal: 0.6 }),

  F('anhaenger', 'anhaenger', 'Anhänger mit Namen', 80, 5, { type: 'tag', color: '#c9a173' }),
  F('karte', 'anhaenger', 'Geschenkkarte', 120, 6, { type: 'card', color: '#fffaf0' }),

  F('orange', 'natur', 'Orangenscheibe', 100, 6, { type: 'orange' }),
  F('zimt', 'natur', 'Zimtstangen', 110, 6, { type: 'cinnamon' }),
  F('eukalyptus', 'natur', 'Eukalyptus', 130, 7, { type: 'eucalyptus' }),
  F('zapfen', 'natur', 'Mini-Tannenzapfen', 160, 8, { type: 'cone' }),
];

export const groupOf = (id) => DECO_GROUPS.find((g) => g.id === id);
export const phaseOf = (item) => groupOf(item.group).phase;
