// Deko für die Päckchen (Recherche: Knisterpapier/Holzwolle als Füllung, Perlen, Seifenflocken,
// Rosenblätter, Lavendel, Trockenblumen, Baumwollblüte; obendrauf Satin-/Samtband, Bäckerschnur,
// Bast, Spitze, Wachssiegel, Sticker, Washi-Tape, Anhänger mit Namen, Geschenkkarte, getrocknete
// Orangenscheibe, Zimtstangen, Eukalyptus, Mini-Tannenzapfen).
//
// group = Einstieg im unteren Regal (eine Sache dort öffnet die Auswahl dieser Gruppe).
// phase 'fill' = ins offene Päckchen (vor dem Deckel), 'lid' = auf den Deckel (danach).
// look: wie es in 3D aussieht (siehe deco.js / decoGeo.js).
// Seifenflocken und Füllpapier (Knisterpapier, Holzwolle) sind raus: sahen nicht gut aus.

export const DECO_GROUPS = [
  { id: 'perlen', name: 'Perlen', phase: 'fill' },
  { id: 'blueten', name: 'Blüten', phase: 'fill' },
  { id: 'baender', name: 'Schleifen & Bänder', phase: 'lid' },
  { id: 'anhaenger', name: 'Anhänger', phase: 'lid' },
  { id: 'siegel', name: 'Siegel & Sticker', phase: 'lid' },
  { id: 'natur', name: 'Naturdeko', phase: 'lid' },
];

const F = (id, group, name, cost, bonus, look) => ({ id, group, name, cost, bonus, look, unlocked: cost === 0 });

// Füllungen: geo 'pearl' (perlmutt, schillernd), 'metal' (Gold/Silber), 'heart', 'flower', 'rose', 'sprig', 'petal'.
export const DECO_ITEMS = [
  F('perlen-weiss', 'perlen', 'Perlmutt-Perlen', 0, 3, { geo: 'pearl', colors: ['#fbf7f0', '#f6efe6', '#fffaf4'], size: [0.016, 0.026], n: 9 }),
  F('perlen-rosa', 'perlen', 'Rosé-Perlen', 60, 4, { geo: 'pearl', colors: ['#f6d2dc', '#f2c0ce', '#fbe0e7'], size: [0.016, 0.026], n: 9 }),
  F('perlen-champagner', 'perlen', 'Champagner-Perlen', 90, 5, { geo: 'pearl', colors: ['#f1dfc0', '#e9d1a8', '#f7ead2'], size: [0.016, 0.026], n: 9 }),
  F('perlen-gold', 'perlen', 'Goldperlen', 140, 7, { geo: 'metal', colors: ['#e9c25a', '#d4a93a', '#f1d98a'], size: [0.014, 0.022], n: 9 }),
  F('perlen-silber', 'perlen', 'Silberperlen', 140, 7, { geo: 'metal', colors: ['#e8eaee', '#cfd3da', '#f5f6f8'], size: [0.014, 0.022], n: 9 }),
  F('mini-herzen', 'perlen', 'Mini-Herzen', 120, 6, { geo: 'heart', colors: ['#e2304d', '#f06a86', '#ffffff'], size: [0.03, 0.04], n: 8 }),

  F('margeriten', 'blueten', 'Margeriten', 0, 3, { geo: 'flower', colors: ['#ffffff', '#fffaf2', '#fff4f6'], size: [0.07, 0.09], n: 6 }),
  F('vergissmeinnicht', 'blueten', 'Vergissmeinnicht', 70, 4, { geo: 'flower', colors: ['#8fb8f0', '#a9c8f6', '#7fa8e6'], size: [0.06, 0.075], n: 8 }),
  F('rosenblaetter', 'blueten', 'Rosenblätter', 80, 5, { geo: 'petal', colors: ['#c8203f', '#e0425e', '#b51a37'], size: [0.05, 0.065], n: 8 }),
  F('lavendel', 'blueten', 'Lavendelzweige', 100, 6, { geo: 'sprig', colors: ['#ffffff', '#f4f0ff'], size: [0.17, 0.21], n: 5 }),
  F('rosen-getrocknet', 'blueten', 'Getrocknete Rosen', 150, 8, { geo: 'rose', colors: ['#c45a6e', '#d98a9a', '#b8485e'], size: [0.04, 0.05], n: 5 }),
  F('rosen-creme', 'blueten', 'Rosenknospen creme', 180, 9, { geo: 'rose', colors: ['#f6e7d6', '#f1dcc4', '#fbf0e4'], size: [0.04, 0.05], n: 5 }),

  F('schnur', 'baender', 'Bäckerschnur', 0, 2, { type: 'ribbon', color: '#f4eee6', tex: 'twine', w: 0.025, rough: 0.9 }),
  F('satin-rosa', 'baender', 'Satinschleife rosa', 50, 4, { type: 'ribbon', color: '#f3a5bb', w: 0.06, rough: 0.28, sheen: true }),
  F('satin-rot', 'baender', 'Satinschleife rot', 70, 5, { type: 'ribbon', color: '#c8202f', w: 0.06, rough: 0.28, sheen: true }),
  F('organza', 'baender', 'Organza hellblau', 90, 5, { type: 'ribbon', color: '#bcdcf4', w: 0.07, rough: 0.35, opacity: 0.75 }),
  F('bast', 'baender', 'Bastband', 90, 5, { type: 'ribbon', color: '#e4cf9c', tex: 'raffia', w: 0.045, rough: 0.95 }),
  F('karo', 'baender', 'Karoband', 110, 6, { type: 'ribbon', color: '#ffffff', tex: 'gingham', w: 0.055, rough: 0.8 }),
  F('samt-gruen', 'baender', 'Samtschleife grün', 130, 7, { type: 'ribbon', color: '#2f6b4a', w: 0.06, rough: 0.95 }),
  F('goldband', 'baender', 'Goldschleife', 180, 9, { type: 'ribbon', color: '#e8c35e', w: 0.055, rough: 0.3, metal: 0.65 }),
  F('spitze', 'baender', 'Spitzenband', 220, 11, { type: 'ribbon', color: '#fbf6ea', tex: 'lace', w: 0.07, rough: 0.8 }),

  F('anhaenger', 'anhaenger', 'Kraft-Anhänger mit Namen', 0, 3, { type: 'tag', paper: '#c9a173', ink: '#3e2a18', edge: '#8a6a44' }),
  F('anhaenger-weiss', 'anhaenger', 'Anhänger weiß-gold', 60, 4, { type: 'tag', paper: '#fffaf0', ink: '#8a6a1a', edge: '#d4af37' }),
  F('anhaenger-rosa', 'anhaenger', 'Anhänger rosa', 70, 4, { type: 'tag', paper: '#f7d4de', ink: '#9a3355', edge: '#e38bb8' }),
  F('holz-anhaenger', 'anhaenger', 'Holzscheibe mit Namen', 110, 6, { type: 'woodtag' }),
  F('karte', 'anhaenger', 'Geschenkkarte', 120, 6, { type: 'card', color: '#fffaf0' }),

  F('danke', 'siegel', 'Sticker „Danke“', 0, 2, { type: 'sticker', color: '#fff6e8', ink: '#b5475f', text: 'Danke' }),
  F('handmade', 'siegel', 'Sticker „Handmade“', 50, 3, { type: 'sticker', color: '#c9a173', ink: '#3e2a18', text: 'Handmade' }),
  F('herz-sticker', 'siegel', 'Herz-Sticker', 70, 4, { type: 'sticker', color: '#e2304d', ink: '#ffffff', text: '♥' }),
  F('washi', 'siegel', 'Washi-Tape', 90, 5, { type: 'washi', color: '#9fd3c7' }),
  F('siegel-rot', 'siegel', 'Wachssiegel rot', 150, 8, { type: 'seal', color: '#a3162b' }),
  F('siegel-gold', 'siegel', 'Wachssiegel gold', 220, 11, { type: 'seal', color: '#c9a04a', metal: 0.6 }),

  F('orange', 'natur', 'Orangenscheibe', 100, 6, { type: 'orange' }),
  F('zimt', 'natur', 'Zimtstangen', 110, 6, { type: 'cinnamon' }),
  F('eukalyptus', 'natur', 'Eukalyptus', 130, 7, { type: 'eucalyptus' }),
  F('zapfen', 'natur', 'Mini-Tannenzapfen', 160, 8, { type: 'cone' }),
];

export const groupOf = (id) => DECO_GROUPS.find((g) => g.id === id);
export const phaseOf = (item) => groupOf(item.group).phase;
