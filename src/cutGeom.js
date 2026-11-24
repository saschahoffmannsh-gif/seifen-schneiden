// Gemeinsame Schneide-Geometrie für Spiel und Startbildschirm (damit beide exakt gleich aussehen):
// Messerlage, schräge Klinge, Nahaufnahme-Blickrichtung und die Rutsche für die losen Würfel.
import * as THREE from 'three';
import { BLOCK, CUBE, CUT } from './config.js';

export const KNIFE_X = -0.12;                               // Messer leicht nach links: Griff bleibt in der Nahaufnahme im Bild
// schräge Klinge: knifeY = Höhe der Schneide an der hinteren (rechten) Würfelspalte; links liegt sie tiefer
export const SKEW = THREE.MathUtils.degToRad(CUT.skewDeg), SKEW_TAN = Math.tan(SKEW);
export const X_TRAIL = (BLOCK.nx - 1) / 2 * CUBE, X_LEAD = -X_TRAIL;
export const SKEW_RISE = (X_TRAIL - X_LEAD) * SKEW_TAN;     // so viel tiefer ist die Schneide an der linken Spalte
export const ZOOM_FIT_W = 2.0, ZOOM_FIT_H = 2.7;            // so viel Szene (Breite/Höhe) zeigt die Nahaufnahme mindestens
export const CLOSE_DIR = new THREE.Vector3(0.48, 0.5, 1).normalize();   // Blickrichtung der Nahaufnahme (von vorne rechts, ~25° von oben)

/** Messer-Gruppe an die Schneidhöhe knifeY (hintere Spalte) setzen, um die Schräge gedreht. */
export function poseKnife(knife, knifeY, knifeZ, tilt = 0) {
  knife.position.set(KNIFE_X, knifeY - (X_TRAIL - KNIFE_X) * SKEW_TAN, knifeZ);
  knife.rotation.z = SKEW + tilt;
}

const _inv = new THREE.Matrix4();
/**
 * Rutsche der losen Würfel (Schnittfläche/Stufe des gekippten Blocks, Block-Koordinaten) aktualisieren.
 * blade = { on, y, z, vy } für das Anheben auf der Klinge. Pro Frame, ohne Allokation.
 */
export function syncSlope(loose, rig, b, blade) {
  const sl = loose.slope;
  sl.on = rig.e > 0.02 && b.mesh.visible && b.active;
  if (!sl.on) return;
  sl.m.set(rig.inner.matrixWorld.elements);
  sl.inv.set(_inv.copy(rig.inner.matrixWorld).invert().elements);
  sl.halfX = b.halfX; sl.topY = b.topY; sl.bottomY = b.bottomY;
  sl.cutZ = b.cutZ; sl.frontZ = b.frontZ; sl.uncutTop = b.topY - b.rowsCut * CUBE;
  sl.nCols = BLOCK.nx; for (let i = 0; i < BLOCK.nx; i++) sl.colTop[i] = b.topY - b.colRows[i] * CUBE;
  sl.lipFrontZ = rig.lipFrontZ; sl.lipBottomY = rig.lipBottomY; sl.backZ = -b.halfZ - 0.02;
  // Klinge steckt in der Scheibe: hebt die gelösten Würfel an
  sl.bladeOn = blade.on && blade.y - SKEW_RISE < b.topY;
  sl.bladeZ = blade.z; sl.bladeY = blade.y; sl.bladeVy = blade.vy || 0;
  sl.bladeX0 = X_TRAIL; sl.bladeTan = SKEW_TAN;   // Schneide schräg: Höhe an der Stelle x = bladeY + (x - X0)·tan
}
