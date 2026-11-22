// Zentrale Konstanten für Welt, Seife, Schale und Physik.
// Alle Maße in "Welt-Einheiten" (ca. 1 Einheit = 10 cm).

export const CUBE = 0.05;           // Kantenlänge eines Seifenwürfels (Voxel) – fein geschnitten

// Seifenblock: Anzahl Würfel in x (Breite), y (Höhe), z (Tiefe)
// Aufrecht stehendes Seifenstück: höher als breit, 4 Scheiben von vorne nach hinten.
// 15 x 24 x 8 = 2880 Würfel pro Seife; jede Scheibe ist 2 Würfel dick (15 x 24 x 2 = 720 Würfel).
export const BLOCK = { nx: 15, ny: 24, nz: 8 };
export const SLICES = 4;
export const SLICE_DEPTH = BLOCK.nz / SLICES;   // Würfel pro Scheibe in z
export const SOAP_RADIUS = 0.12;    // Rundung der Kanten/Ecken des Seifenstücks
export const SOAP_BULGE = 0.03;     // Kissen-Wölbung der Vorderseite (Mitte steht so weit vor)

// Schale (Form): innerer Boden bei y = 0
export const BOWL = {
  floorR: 1.0,      // Innenradius am Boden
  rimR: 1.25,       // Innenradius am Rand
  height: 0.62,     // Höhe des Randes
};

// Gitter, auf dem der Seifenblock über der Schale liegt
export const RACK_Y = BOWL.height + 0.03;
export const BLOCK_BASE_Y = RACK_Y + 0.02;

// Physik
export const PHYS = {
  gravity: 9.8,
  step: 1 / 120,          // fester Zeitschritt
  maxSteps: 4,            // max. Physik-Schritte pro Frame (Schutz vor "Spiral of death")
  maxCubes: 10000,        // vorab reservierter Pool loser Würfel (reicht für 3 Seifen à 2880)
};

// Schneiden: wie weit (Welt-Einheiten) ein Wisch mindestens gehen muss, damit er zählt
export const CUT = {
  // Hin-und-her-Wischen treibt das Messer durch die vorderste Scheibe nach unten:
  strokePerSlice: 2.0,    // so viel Wischweg (Welt-Einheiten) braucht eine ganze Scheibe (oben -> unten)
  knifeRange: 0.32,       // Messer darf sich +- so weit seitlich bewegen
  returnSpeed: 9,         // wie schnell das Messer nach einer Scheibe wieder hochfährt
};

export const OVEN_SECONDS = 5;
