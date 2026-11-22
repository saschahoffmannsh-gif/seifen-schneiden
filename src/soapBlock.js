// Der intakte Seifenblock: ein einziges InstancedMesh mit nx*ny*nz Würfeln.
// Geschnittene Würfel werden nur auf Skalierung 0 gesetzt (kein Erzeugen/Löschen von Meshes).
import * as THREE from 'three';
import { BLOCK, CUBE, BLOCK_BASE_Y, SLICES, SLICE_DEPTH } from './config.js';
import { cubeColor } from './soaps.js';

const _m = new THREE.Matrix4();
const _zero = new THREE.Matrix4().makeScale(0, 0, 0);
const _c = new THREE.Color();
const _rgb = [0, 0, 0];

export class SoapBlock {
  constructor(scene, geometry, material) {
    const { nx, ny, nz } = BLOCK;
    this.count = nx * ny * nz;
    this.mesh = new THREE.InstancedMesh(geometry, material, this.count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    // Farben vorab einmal für alle Instanzen anlegen
    for (let n = 0; n < this.count; n++) this.mesh.setColorAt(n, _c.set(1, 1, 1));
    scene.add(this.mesh);

    this.released = new Uint8Array(this.count);
    this.colors = new Float32Array(this.count * 3); // lineare RGB pro Würfel
    this.slice = -1;          // aktuelle (vorderste) Scheibe in z, die geschnitten wird
    this.rowsCut = 0;         // wie viele Reihen (von oben) der aktuellen Scheibe schon gelöst sind
    this.soap = null;
    this.halfX = nx * CUBE / 2;
    this.halfZ = nz * CUBE / 2;
  }

  index(i, j, k) { return (j * BLOCK.nz + k) * BLOCK.nx + i; }
  cubeX(i) { return (i - (BLOCK.nx - 1) / 2) * CUBE; }
  cubeY(j) { return BLOCK_BASE_Y + (j + 0.5) * CUBE; }
  cubeZ(k) { return (k - (BLOCK.nz - 1) / 2) * CUBE; }

  /** Neuen Block einer Sorte aufbauen (passiert nur beim Auswählen, nicht pro Frame). */
  load(soap) {
    const { nx, ny, nz } = BLOCK;
    this.soap = soap;
    this.released.fill(0);
    this.releasedCount = 0;
    // minimal überlappend: außen eine geschlossene, glatte Seifenoberfläche ohne Pixel-Ritzen;
    // die feinen Fugen zeichnet der Shader nur auf Schnitt-/Innenflächen
    const s = CUBE * 1.015;
    for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) {
      const n = this.index(i, j, k);
      _m.makeScale(s, s, s).setPosition(this.cubeX(i), this.cubeY(j), this.cubeZ(k));
      this.mesh.setMatrixAt(n, _m);
      cubeColor(soap, _rgb);
      _c.setRGB(_rgb[0], _rgb[1], _rgb[2], THREE.SRGBColorSpace);
      this.mesh.setColorAt(n, _c);
      this.colors[n * 3] = _c.r; this.colors[n * 3 + 1] = _c.g; this.colors[n * 3 + 2] = _c.b;
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
    this.slice = SLICES - 1;  // SLICES-1 = Kamera-Seite (vorne)
    this.rowsCut = 0;
    this.mesh.visible = true;
  }

  /** Anteil der schon abgeschnittenen Würfel (0..1). */
  get cutFraction() { return this.releasedCount / this.count; }

  get active() { return this.slice >= 0; }
  /** Oberkante des Blocks (Höhe bleibt gleich, es wird von vorne nach hinten geschnitten). */
  get topY() { return BLOCK_BASE_Y + BLOCK.ny * CUBE; }
  get bottomY() { return BLOCK_BASE_Y; }
  /** z-Position der Schnittebene hinter der aktuellen Scheibe (dort läuft das Messer). */
  get cutZ() { return this.cubeZ(Math.max(this.slice, 0) * SLICE_DEPTH) - CUBE / 2; }
  /** z der Vorderseite des noch intakten Blocks. */
  get frontZ() { return this.cubeZ(Math.max(this.slice, 0) * SLICE_DEPTH + SLICE_DEPTH - 1) + CUBE / 2; }

  /**
   * Löst die Würfel der vordersten Scheibe von oben nach unten bis zum Anteil `frac` (0..1).
   * Für jeden gelösten Würfel wird onCube(x,y,z,r,g,b,soapId) aufgerufen.
   * Gibt die Anzahl gelöster Würfel zurück.
   */
  cutTo(frac, onCube) {
    if (this.slice < 0) return 0;
    const { nx, ny } = BLOCK;
    const target = Math.min(ny, Math.floor(frac * ny + 0.0001));
    let n = 0;
    while (this.rowsCut < target) {
      const j = ny - 1 - this.rowsCut; // oben zuerst
      for (let dk = SLICE_DEPTH - 1; dk >= 0; dk--) for (let i = 0; i < nx; i++) {
        const k = this.slice * SLICE_DEPTH + dk;
        const idx = this.index(i, j, k);
        if (this.released[idx]) continue;
        this.released[idx] = 1;
        this.releasedCount++;
        this.mesh.setMatrixAt(idx, _zero);
        onCube(this.cubeX(i), this.cubeY(j), this.cubeZ(k),
          this.colors[idx * 3], this.colors[idx * 3 + 1], this.colors[idx * 3 + 2], this.soap.id);
        n++;
      }
      this.rowsCut++;
    }
    if (n) this.mesh.instanceMatrix.needsUpdate = true;
    return n;
  }

  /** Rest der Scheibe lösen und zur nächsten Scheibe dahinter wechseln. true = Block ist weg. */
  finishSlice(onCube) {
    this.cutTo(1, onCube);
    this.slice--;
    this.rowsCut = 0;
    if (this.slice < 0) this.mesh.visible = false;
    return this.slice < 0;
  }
}
