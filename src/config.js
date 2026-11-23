// Zentrale Konstanten für Welt, Seife, Schale und Physik.
// Alle Maße in "Welt-Einheiten" (ca. 1 Einheit = 10 cm).

export const CUBE = 0.05;           // Kantenlänge eines Seifenwürfels (Voxel) – fein geschnitten

// Seifenblock: Anzahl Würfel in x (Breite), y (Höhe), z (Tiefe)
// Aufrecht stehendes Seifenstück: höher als breit, 10 Scheiben von vorne nach hinten.
// 15 x 24 x 10 = 3600 Würfel pro Seife; jede Scheibe ist 1 Würfel dick (360 Würfel) = 10 % der Form.
export const BLOCK = { nx: 15, ny: 24, nz: 10 };
export const SLICES = 10;
export const SLICE_DEPTH = BLOCK.nz / SLICES;   // Würfel pro Scheibe in z
export const SOAP_RADIUS = 0.12;    // Rundung der Kanten/Ecken des Seifenstücks
export const SOAP_BULGE = 0.03;     // Kissen-Wölbung der Vorderseite (Mitte steht so weit vor)

// Schale (Form): innerer Boden bei y = 0
export const BOWL = {
  floorR: 1.0,      // Innenradius am Boden
  rimR: 1.25,       // Innenradius am Rand
  height: 0.62,     // Höhe des Randes
};

// Höhe, auf der der Seifenblock über der Schale steht (früher auf einem Gitter, das ist weg)
export const RACK_Y = BOWL.height + 0.03;
export const BLOCK_BASE_Y = RACK_Y + 0.02;

// Physik
export const PHYS = {
  gravity: 9.8,
  step: 1 / 120,          // fester Zeitschritt
  maxSteps: 4,            // max. Physik-Schritte pro Frame (Schutz vor "Spiral of death")
  maxCubes: 10000,        // vorab reservierter Pool loser Würfel (reicht für 3 Seifen à 2880)
};

// Schneiden
export const CUT = {
  // Das Messer folgt dem Finger senkrecht; nur abwärts schneidet es (Tiefe = Fortschritt der Scheibe).
  returnSpeed: 9,         // wie schnell das Messer nach einer Scheibe wieder hochfährt
};

export const OVEN_SECONDS = 5;

// Die Form fasst genau ein ganzes Seifenstück: 100 % = 10 Scheiben = 3600 Würfel.
// Jede Bestellung ist eine Mischung in Prozent (Schritte von 10 % = eine Scheibe).
export const MOULD_CUBES = BLOCK.nx * BLOCK.ny * BLOCK.nz;
export const PCT_PER_SLICE = 100 / SLICES;
