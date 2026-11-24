// Schneide-Gestell: Seifenblock + Messer hängen gemeinsam an einem Drehpunkt
// (hintere Unterkante der Seife). Beim Schneiden kippt alles weich um 45° nach hinten, wie auf
// einer schräg gehaltenen Handfläche; die gelösten Würfel rutschen dann über die schräge
// Schnittfläche nach vorne-unten und purzeln in die Schale.
// Alles in "Block-Koordinaten" (wie früher die Welt): inner.matrixWorld bildet sie in die Welt ab.
import * as THREE from 'three';
import { BLOCK, CUBE, BLOCK_BASE_Y } from './config.js';

export const TILT = THREE.MathUtils.degToRad(45);   // Neigung nach hinten
const TILT_TIME = 0.75;                              // s für Hinein-/Herauskippen
const FWD = 0.38;                                    // gekippt rückt alles etwas nach vorne (über die Schalenmitte)
const BH = BLOCK.ny * CUBE, BD = BLOCK.nz * CUBE;

const ease = (t) => t * t * t * (t * (t * 6 - 15) + 10);   // smootherstep: weich an beiden Enden

export class CutRig {
  constructor(scene) {
    this.pivot = new THREE.Vector3(0, BLOCK_BASE_Y, -BD / 2);
    this.outer = new THREE.Group();
    this.inner = new THREE.Group();
    this.inner.position.copy(this.pivot).negate();
    this.outer.position.copy(this.pivot);
    this.outer.add(this.inner);
    scene.add(this.outer);
    this.t = 0; this.target = 0; this.e = 0;    // Kipp-Fortschritt

    // ohne Auflage (Wunsch: kein Brett): die Seife liegt frei gekippt; keine Leiste für die Würfel
    this.lipFrontZ = -1e9;
    this.lipBottomY = BLOCK_BASE_Y;
    this.apply();
  }

  add(obj) { this.inner.add(obj); }

  /** Pose für Kipp-Anteil e (0 = aufrecht, 1 = 45° zurück). */
  apply() {
    const e = this.e;
    this.outer.rotation.x = -TILT * e;
    this.outer.position.set(this.pivot.x, this.pivot.y, this.pivot.z + FWD * e);
    this.outer.updateMatrixWorld(true);
  }

  /** Pro Frame. on = Seife liegt zum Schneiden bereit. Gibt true zurück, wenn sich etwas bewegt hat. */
  update(dt, on) {
    this.target = on ? 1 : 0;
    const prev = this.e;
    if (this.t !== this.target) {
      const d = dt / TILT_TIME;
      this.t = this.target > this.t ? Math.min(this.target, this.t + d) : Math.max(this.target, this.t - d);
    }
    this.e = ease(this.t);
    if (this.e !== prev) this.apply();
    return this.e !== prev;
  }

  /** Sofort aufrecht (Seife ist weg / neue kommt angeflogen). */
  reset() { this.t = 0; this.e = 0; this.apply(); }

  /** Block-Koordinaten -> Welt (out wird überschrieben). */
  toWorld(v, out) { return out.copy(v).applyMatrix4(this.inner.matrixWorld); }

  /** Pose (Welt-Position der Stückmitte + Kippwinkel) für eine Seife der Tiefe frac (1 = ganz). */
  piecePose(frac, out) {
    out.set(0, BLOCK_BASE_Y + BH / 2, -BD / 2 + BD * frac / 2).applyMatrix4(this.inner.matrixWorld);
    return -TILT * this.e;
  }

  /** Bei voller Neigung: Weltpunkt der Seifenmitte (für die Kamera-Nahaufnahme, unabhängig vom Moment). */
  fullTiltCenter(out, dy = 0) {
    const c = Math.cos(-TILT), s = Math.sin(-TILT);
    const y = BH / 2 + dy, z = BD / 2;          // relativ zum Drehpunkt
    out.set(0, this.pivot.y + y * c - z * s, this.pivot.z + FWD + y * s + z * c);
    return out;
  }
}
