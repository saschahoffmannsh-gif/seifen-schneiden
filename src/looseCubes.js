// Lose Würfel: ein vorab reservierter Pool in EINEM InstancedMesh (ein Draw Call).
// Eigene, sehr billige Physik: Würfel fallen senkrecht (kein Zug zur Mitte), Schalenwand, Boden.
// Liegende Würfel werden "eingefroren" und nicht mehr berechnet. Kein Physik-Engine,
// keine Allokationen im Frame (alle Vektoren/Matrizen werden wiederverwendet).
import * as THREE from 'three';
import { BOWL, CUBE, PHYS } from './config.js';

const MAX = PHYS.maxCubes;
const HALF = CUBE / 2;

// Höhenfeld über dem Schalenboden: so stapeln sich gelandete Würfel, ohne Würfel-Würfel-Kollision
const GRID = Math.ceil((BOWL.rimR * 2) / CUBE) + 2;
const GRID_OFF = (GRID * CUBE) / 2;

const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3(CUBE * 0.94, CUBE * 0.94, CUBE * 0.94);
const _zero = new THREE.Matrix4().makeScale(0, 0, 0);

export class LooseCubes {
  constructor(scene, geometry, material) {
    this.mesh = new THREE.InstancedMesh(geometry, material, MAX);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    const col = new THREE.Color(1, 1, 1);
    for (let i = 0; i < MAX; i++) { this.mesh.setMatrixAt(i, _zero); this.mesh.setColorAt(i, col); }
    this.mesh.count = 0; // es werden nur so viele gezeichnet, wie schon benutzt wurden
    scene.add(this.mesh);

    this.pos = new Float32Array(MAX * 3);
    this.vel = new Float32Array(MAX * 3);
    this.rot = new Float32Array(MAX * 3);   // Euler-Winkel
    this.spin = new Float32Array(MAX * 3);  // Winkelgeschwindigkeit
    this.state = new Uint8Array(MAX);       // 0 frei, 1 fliegt, 2 liegt (eingefroren)
    this.type = new Int8Array(MAX).fill(-1);
    this.cell = new Int16Array(MAX).fill(-1); // Höhenfeld-Zelle, auf der der Würfel liegt
    this.heights = new Float32Array(GRID * GRID);
    this.next = 0;
    this.used = 0;
    this.activeCount = 0;
    this.typeCounts = new Int32Array(8);  // wie viele Würfel pro Sorte in der Schale sind
    this.blockTop = -1;                   // Oberkante des Seifenblocks (Kollision)
    this.blockHalfX = 0; this.blockHalfZ = 0;
    this.onLand = null;                   // Callback für Klick-Geräusch
    this.dirtyMin = MAX; this.dirtyMax = -1;
    this.colMin = MAX; this.colMax = -1;
  }

  /** Einen Würfel aus dem Pool holen. Ist der Pool voll, wird der älteste recycelt. */
  spawn(x, y, z, r, g, b, typeId) {
    const i = this.next;
    this.next = (this.next + 1) % MAX;
    if (this.used < MAX) { this.used++; this.mesh.count = this.used; }
    if (this.state[i] === 2) this.unsettle(i);
    if (this.state[i] !== 1) this.activeCount++;
    if (this.type[i] >= 0) this.typeCounts[this.type[i]]--;
    this.type[i] = typeId; this.typeCounts[typeId]++;
    this.state[i] = 1;
    const o = i * 3;
    this.pos[o] = x; this.pos[o + 1] = y; this.pos[o + 2] = z;
    // Würfel fallen senkrecht genau dort runter, wo sie sich von der Seife lösen:
    // kein Zug zur Mitte, nur ein winziger Zufall, damit es nicht wie ein Raster aussieht.
    this.vel[o] = (Math.random() - 0.5) * 0.06;
    this.vel[o + 1] = -Math.random() * 0.15;
    this.vel[o + 2] = (Math.random() - 0.5) * 0.06;
    this.rot[o] = 0; this.rot[o + 1] = 0; this.rot[o + 2] = 0;
    this.spin[o] = (Math.random() - 0.5) * 5;
    this.spin[o + 1] = (Math.random() - 0.5) * 3;
    this.spin[o + 2] = (Math.random() - 0.5) * 5;
    this.mesh.setColorAt(i, _tmpColor.setRGB(r, g, b));
    if (i < this.colMin) this.colMin = i;
    if (i > this.colMax) this.colMax = i;
    this.writeMatrix(i);
  }

  unsettle(i) {
    const c = this.cell[i];
    if (c >= 0) this.heights[c] = Math.max(0, this.heights[c] - CUBE);
    this.cell[i] = -1;
  }

  /** Ein fester Physik-Schritt der Länge h für alle fliegenden Würfel. */
  step(h) {
    if (this.activeCount === 0) return;
    const P = this.pos, V = this.vel, R = this.rot, S = this.spin;
    const g = PHYS.gravity * h;
    const slope = (BOWL.rimR - BOWL.floorR) / BOWL.height;
    for (let i = 0; i < this.used; i++) {
      if (this.state[i] !== 1) continue;
      const o = i * 3;
      V[o + 1] -= g;
      let x = P[o] + V[o] * h, y = P[o + 1] + V[o + 1] * h, z = P[o + 2] + V[o + 2] * h;
      R[o] += S[o] * h; R[o + 1] += S[o + 1] * h; R[o + 2] += S[o + 2] * h;

      // 1) Oberseite des restlichen Seifenblocks: Würfel hüpfen ab und purzeln seitlich runter
      if (this.blockTop > 0 && V[o + 1] < 0 &&
          Math.abs(x) < this.blockHalfX && Math.abs(z) < this.blockHalfZ &&
          y - HALF < this.blockTop && y > this.blockTop - 0.12) {
        y = this.blockTop + HALF;
        V[o + 1] = -V[o + 1] * 0.35;
        V[o] += (x >= 0 ? 1 : -1) * 0.5;
        V[o + 2] += 0.3;
      }

      // 2) Schalenwand (kegelförmig): radial zurückschieben und abprallen
      const maxR = BOWL.floorR + Math.min(Math.max(y, 0), BOWL.height) * slope - HALF;
      const rr = x * x + z * z;
      if (rr > maxR * maxR) {
        const r = Math.sqrt(rr), nx = x / r, nz = z / r;
        x = nx * maxR; z = nz * maxR;
        const vn = V[o] * nx + V[o + 2] * nz;
        if (vn > 0) { V[o] -= 1.4 * vn * nx; V[o + 2] -= 1.4 * vn * nz; }
      }

      // 3) Boden bzw. Höhenfeld der schon liegenden Würfel
      const c = this.cellAt(x, z);
      const ground = this.heights[c];
      if (y - HALF <= ground && V[o + 1] < 0) {
        y = ground + HALF;
        // kaum Abprallen, kein seitliches Wegrutschen: Würfel bleiben da liegen, wo sie landen
        V[o + 1] = -V[o + 1] * 0.12;
        V[o] *= 0.3; V[o + 2] *= 0.3;
        S[o] *= 0.4; S[o + 1] *= 0.4; S[o + 2] *= 0.4;
        if (V[o + 1] < 0.5) {
          P[o] = x; P[o + 1] = y; P[o + 2] = z;
          this.settle(i);
          continue;
        }
      }
      P[o] = x; P[o + 1] = y; P[o + 2] = z;
      this.writeMatrix(i);
    }
  }

  cellAt(x, z) {
    let cx = Math.floor((x + GRID_OFF) / CUBE), cz = Math.floor((z + GRID_OFF) / CUBE);
    cx = cx < 0 ? 0 : cx >= GRID ? GRID - 1 : cx;
    cz = cz < 0 ? 0 : cz >= GRID ? GRID - 1 : cz;
    return cz * GRID + cx;
  }

  /**
   * Würfel zur Ruhe bringen. Er bleibt auf seiner Zelle liegen; nur wenn der Turm dort deutlich
   * höher ist als ein direkter Nachbar, kippt er eine Zelle zur Seite (natürliche Böschung des
   * Haufens). Die Richtung ist zufällig und hängt NICHT von der Schalenmitte ab.
   */
  settle(i) {
    const o = i * 3, P = this.pos;
    let c = this.cellAt(P[o], P[o + 2]);
    const limR = BOWL.floorR - HALF;
    for (let it = 0; it < 3; it++) {
      const cx = c % GRID, cz = (c / GRID) | 0;
      let best = c, bh = this.heights[c] - CUBE * 2.2; // erst ab 2,2 Würfeln Höhenunterschied kippen -> steiler Haufen an Ort und Stelle
      const d0 = (Math.random() * 4) | 0;           // zufällige Startrichtung, keine Vorzugsrichtung
      for (let dd = 0; dd < 4; dd++) {
        const d = (d0 + dd) & 3;
        const nx = cx + (d === 0 ? 1 : d === 1 ? -1 : 0);
        const nz = cz + (d === 2 ? 1 : d === 3 ? -1 : 0);
        if (nx < 0 || nz < 0 || nx >= GRID || nz >= GRID) continue;
        const wx = (nx + 0.5) * CUBE - GRID_OFF, wz = (nz + 0.5) * CUBE - GRID_OFF;
        if (wx * wx + wz * wz > limR * limR) continue;
        const n = nz * GRID + nx;
        if (this.heights[n] < bh) { bh = this.heights[n]; best = n; }
      }
      if (best === c) break;
      // nur um den Zellversatz verschieben (nicht auf die Zellmitte ziehen)
      P[o] += ((best % GRID) - cx) * CUBE;
      P[o + 2] += (((best / GRID) | 0) - cz) * CUBE;
      c = best;
    }
    P[o + 1] = this.heights[c] + HALF;
    this.heights[c] += CUBE * 0.92;
    this.cell[i] = c;
    // Lage leicht schief, aber flach -> sieht nach echtem Haufen aus
    this.rot[o] = (Math.random() - 0.5) * 0.3;
    this.rot[o + 2] = (Math.random() - 0.5) * 0.3;
    this.state[i] = 2;
    this.activeCount--;
    this.writeMatrix(i);
    if (this.onLand) this.onLand();
  }

  writeMatrix(i) {
    const o = i * 3;
    _p.set(this.pos[o], this.pos[o + 1], this.pos[o + 2]);
    _q.setFromEuler(_e.set(this.rot[o], this.rot[o + 1], this.rot[o + 2]));
    _m.compose(_p, _q, _s);
    this.mesh.setMatrixAt(i, _m);
    if (i < this.dirtyMin) this.dirtyMin = i;
    if (i > this.dirtyMax) this.dirtyMax = i;
  }

  /** Einmal pro Frame: nur den geänderten Bereich zur GPU hochladen. */
  flush() {
    if (this.colMax >= 0) {
      const c = this.mesh.instanceColor;
      c.clearUpdateRanges();
      c.addUpdateRange(this.colMin * 3, (this.colMax - this.colMin + 1) * 3);
      c.needsUpdate = true;
      this.colMin = MAX; this.colMax = -1;
    }
    if (this.dirtyMax < 0) return;
    const attr = this.mesh.instanceMatrix;
    attr.clearUpdateRanges();
    attr.addUpdateRange(this.dirtyMin * 16, (this.dirtyMax - this.dirtyMin + 1) * 16);
    attr.needsUpdate = true;
    this.dirtyMin = MAX; this.dirtyMax = -1;
  }

  /** Schmelz-Animation: alle Würfel flacher und tiefer machen (t = 0..1). Nur im Ofen-Schritt. */
  melt(t) {
    const k = 1 - t;
    _s.set(CUBE * 0.94 * (1 + t * 0.5), CUBE * 0.94 * Math.max(0.02, k), CUBE * 0.94 * (1 + t * 0.5));
    for (let i = 0; i < this.used; i++) {
      if (this.state[i] !== 2) continue;
      const o = i * 3;
      _p.set(this.pos[o], this.pos[o + 1] * k, this.pos[o + 2]);
      _q.setFromEuler(_e.set(this.rot[o] * k, this.rot[o + 1], this.rot[o + 2] * k));
      _m.compose(_p, _q, _s);
      this.mesh.setMatrixAt(i, _m);
    }
    this.mesh.instanceMatrix.clearUpdateRanges();
    this.mesh.instanceMatrix.needsUpdate = true;
    _s.set(CUBE * 0.94, CUBE * 0.94, CUBE * 0.94);
  }

  /** Durchschnittliche Füllhöhe in der Schale (für die geschmolzene Seife). */
  fillHeight() {
    let n = 0; for (let i = 0; i < this.used; i++) if (this.state[i]) n++;
    const vol = n * CUBE * CUBE * CUBE;
    return vol / (Math.PI * BOWL.floorR * BOWL.floorR);
  }

  /** Schale leeren (nach dem Herausnehmen der fertigen Seife). */
  clear() {
    for (let i = 0; i < MAX; i++) { this.mesh.setMatrixAt(i, _zero); }
    this.state.fill(0); this.type.fill(-1); this.cell.fill(-1); this.heights.fill(0);
    this.typeCounts.fill(0);
    this.next = 0; this.used = 0; this.activeCount = 0; this.mesh.count = 0;
    this.mesh.instanceMatrix.clearUpdateRanges();
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

const _tmpColor = new THREE.Color();
