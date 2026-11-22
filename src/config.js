// Zentrale Konstanten für Welt, Seife, Schale und Physik.
// Alle Maße in "Welt-Einheiten" (ca. 1 Einheit = 10 cm).

export const CUBE = 0.1;            // Kantenlänge eines Seifenwürfels (Voxel)

// Seifenblock: Anzahl Würfel in x (Breite), y (Höhe), z (Tiefe)
export const BLOCK = { nx: 8, ny: 10, nz: 6 };

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
  maxCubes: 4000,         // vorab reservierter Pool loser Würfel
};

// Schneiden: wie weit (Welt-Einheiten) ein Wisch mindestens gehen muss, damit er zählt
export const CUT = {
  minStroke: 0.14,        // Mindestweg, bevor ein Richtungswechsel eine Schicht abschließt
  fullStroke: 0.55,       // nach diesem Weg ist die Schicht auch ohne Richtungswechsel fertig
  knifeRange: 0.5,        // Messer darf sich +- so weit seitlich bewegen
};

export const OVEN_SECONDS = 5;
