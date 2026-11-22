// Lose Würfel: ein vorab reservierter Pool in EINEM InstancedMesh (ein Draw Call).
// Eigene, sehr billige Physik: Würfel fallen senkrecht, rutschen/rollen dann wie Schüttgut
// hangabwärts (Höhenfeld), Schalenwand, Boden.
// Liegende Würfel werden "eingefroren" und nicht mehr berechnet. Kein Physik-Engine,
// keine Allokationen im Frame (alle Vektoren/Matrizen werden wiederverwendet).
import * as THREE from 'three';
import { BOWL, CUBE, PHYS } from './config.js';

const MAX = PHYS.maxCubes;
const HALF = CUBE / 2;

// Höhenfeld über dem Schalenboden: so stapeln sich gelandete Würfel, ohne Würfel-Würfel-Kollision
const GRID = Math.ceil((BOWL.rimR * 2) / CUBE) + 2;
const GRID_OFF = (GRID * CUBE) / 2;

// Schüttgut-Verhalten des Haufens
const PILE = {
  repose: 0.7,      // ab so vielen Würfelhöhen Unterschied zum Nachbarn rutscht ein Würfel weiter (flacher Böschungswinkel)
  slideSpeed: 0.55, // Rutsch-/Rollgeschwindigkeit hangabwärts
  outward: 0.25,    // leichter Zug nach außen beim Rutschen (füllt die Schale)
  maxHops: 60,       // Sicherheitsgrenze: so oft darf ein Würfel weiterrutschen
};
const NB_X = [1, -1, 0, 0, 1, 1, -1, -1];
const NB_Z = [0, 0, 1, -1, 1, -1, 1, -1];
const NB_W = [1, 1, 1, 1, Math.SQRT1_2, Math.SQRT1_2, Math.SQRT1_2, Math.SQRT1_2];

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
    this.hops = new Uint8Array(MAX);
    this.lastCell = new Int16Array(MAX).fill(-1); // Zelle, auf der das Gefälle zuletzt geprüft wurde
    this.sliding = new Uint8Array(MAX);           // 1 = rutscht gerade zur nächsten Zelle          // wie oft der Würfel schon hangabwärts weitergerutscht ist
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
    this.hops[i] = 0; this.lastCell[i] = -1; this.sliding[i] = 0;
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
      if (y - HALF <= ground && V[o + 1] <= 0) {
        y = ground + HALF;
        V[o + 1] = -V[o + 1] * 0.1;
        // Schüttgut: Ist ein Nachbar deutlich tiefer, rollt/rutscht der Würfel dorthin (animiert,
        // über die normale Physik), statt hier liegen zu bleiben. So entsteht ein flacher Hügel.
        // Gefälle nur prüfen, wenn der Würfel eine neue Zelle erreicht (nicht in jedem Schritt)
        let dn = -1;
        if (c !== this.lastCell[i]) {
          this.lastCell[i] = c;
          dn = this.hops[i] < PILE.maxHops ? this.downhill(c, ground) : -1;
          this.sliding[i] = dn >= 0 ? 1 : 0;
        }
        if (dn >= 0) {
          this.hops[i]++;
          const tx = ((dn % GRID) + 0.5) * CUBE - GRID_OFF, tz = (((dn / GRID) | 0) + 0.5) * CUBE - GRID_OFF;
          let dx = tx - x, dz = tz - z;
          const dl = Math.sqrt(dx * dx + dz * dz) || 1;
          dx /= dl; dz /= dl;
          // leicht nach außen rollen (weg von der Mitte), damit sich die Schale füllt
          const rl = Math.sqrt(x * x + z * z);
          if (rl > 1e-3) { dx += (x / rl) * PILE.outward; dz += (z / rl) * PILE.outward; }
          const sp = PILE.slideSpeed + Math.random() * 0.25;
          V[o] = V[o] * 0.3 + dx * sp; V[o + 2] = V[o + 2] * 0.3 + dz * sp;
          S[o] = dz * 9; S[o + 2] = -dx * 9;      // kippt in Rutschrichtung
        } else if (!this.sliding[i]) {
          // Boden/Haufen bremst: Würfel rutscht noch kurz aus und bleibt dann liegen
          V[o] *= 0.82; V[o + 2] *= 0.82;
          S[o] *= 0.6; S[o + 1] *= 0.6; S[o + 2] *= 0.6;
          if (V[o + 1] < 0.3 && V[o] * V[o] + V[o + 2] * V[o + 2] < 0.04) {
            // vor dem Einfrieren nochmal prüfen: inzwischen können hier andere Würfel liegen
            if (this.hops[i] < PILE.maxHops && this.downhill(c, ground) >= 0) { this.lastCell[i] = -1; P[o] = x; P[o + 1] = y; P[o + 2] = z; this.writeMatrix(i); continue; }
            P[o] = x; P[o + 1] = y; P[o + 2] = z;
            this.settle(i);
            continue;
          }
        } else {
          // rutscht gerade: kaum Reibung, bis die nächste Zelle erreicht ist (Notbremse, falls er hängt)
          V[o] *= 0.995; V[o + 2] *= 0.995;
          if (V[o] * V[o] + V[o + 2] * V[o + 2] < 0.01) this.sliding[i] = 0;
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

  /** Tiefste Nachbarzelle (8er-Nachbarschaft), die mehr als PILE.repose tiefer liegt, sonst -1. */
  downhill(c, h) {
    const cx = c % GRID, cz = (c / GRID) | 0;
    const limR = BOWL.floorR - HALF;
    let best = -1, bestDrop = PILE.repose * CUBE;
    const d0 = (Math.random() * 8) | 0;             // zufällige Reihenfolge bei Gleichstand
    for (let dd = 0; dd < 8; dd++) {
      const d = (d0 + dd) & 7;
      const nx = cx + NB_X[d], nz = cz + NB_Z[d];
      if (nx < 0 || nz < 0 || nx >= GRID || nz >= GRID) continue;
      const wx = (nx + 0.5) * CUBE - GRID_OFF, wz = (nz + 0.5) * CUBE - GRID_OFF;
      if (wx * wx + wz * wz > limR * limR) continue;
      const drop = (h - this.heights[nz * GRID + nx]) * NB_W[d]; // diagonal weiter weg -> Gefälle kleiner
      if (drop > bestDrop) { bestDrop = drop; best = nz * GRID + nx; }
    }
    return best;
  }

  /** Würfel zur Ruhe bringen: auf seiner aktuellen Zelle einfrieren (kein Springen). */
  settle(i) {
    const o = i * 3, P = this.pos;
    const c = this.cellAt(P[o], P[o + 2]);
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
    this.state.fill(0); this.type.fill(-1); this.cell.fill(-1); this.heights.fill(0); this.hops.fill(0); this.lastCell.fill(-1); this.sliding.fill(0);
    this.typeCounts.fill(0);
    this.next = 0; this.used = 0; this.activeCount = 0; this.mesh.count = 0;
    this.mesh.instanceMatrix.clearUpdateRanges();
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

const _tmpColor = new THREE.Color();
