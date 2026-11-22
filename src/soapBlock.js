// Der intakte Seifenblock: ein einziges InstancedMesh mit nx*ny*nz Würfeln.
// Geschnittene Würfel werden nur auf Skalierung 0 gesetzt (kein Erzeugen/Löschen von Meshes).
import * as THREE from 'three';
import { BLOCK, CUBE, BLOCK_BASE_Y } from './config.js';
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
    this.layer = -1;          // aktuelle (oberste) Schicht, die geschnitten wird
    this.rowsCut = 0;         // wie viele Reihen (z) der aktuellen Schicht schon gelöst sind
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
    const s = CUBE * 0.96; // kleine Fuge -> sichtbares Würfelraster
    for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) {
      const n = this.index(i, j, k);
      _m.makeScale(s, s, s).setPosition(this.cubeX(i), this.cubeY(j), this.cubeZ(k));
      this.mesh.setMatrixAt(n, _m);
      cubeColor(soap, i, j, k, _rgb);
      _c.setRGB(_rgb[0], _rgb[1], _rgb[2], THREE.SRGBColorSpace);
      this.mesh.setColorAt(n, _c);
      this.colors[n * 3] = _c.r; this.colors[n * 3 + 1] = _c.g; this.colors[n * 3 + 2] = _c.b;
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
    this.layer = ny - 1;
    this.rowsCut = 0;
    this.mesh.visible = true;
  }

  get active() { return this.layer >= 0; }
  /** Oberkante des noch intakten Blocks (für Kollision und Messerhöhe). */
  get topY() { return BLOCK_BASE_Y + (this.layer + 1) * CUBE; }

  /**
   * Löst Reihen der aktuellen Schicht bis zum Anteil `frac` (0..1) von vorne nach hinten.
   * Für jeden gelösten Würfel wird onCube(x,y,z,r,g,b,soapId) aufgerufen.
   * Gibt die Anzahl gelöster Würfel zurück.
   */
  cutTo(frac, onCube) {
    if (this.layer < 0) return 0;
    const { nx, nz } = BLOCK;
    const target = Math.min(nz, Math.ceil(frac * nz));
    let n = 0;
    while (this.rowsCut < target) {
      const k = nz - 1 - this.rowsCut; // vorne (Kamera-Seite) zuerst
      for (let i = 0; i < nx; i++) {
        const idx = this.index(i, this.layer, k);
        if (this.released[idx]) continue;
        this.released[idx] = 1;
        this.mesh.setMatrixAt(idx, _zero);
        onCube(this.cubeX(i), this.cubeY(this.layer), this.cubeZ(k),
          this.colors[idx * 3], this.colors[idx * 3 + 1], this.colors[idx * 3 + 2], this.soap.id);
        n++;
      }
      this.rowsCut++;
    }
    if (n) this.mesh.instanceMatrix.needsUpdate = true;
    return n;
  }

  /** Rest der Schicht lösen und eine Schicht tiefer gehen. Gibt true zurück, wenn der Block weg ist. */
  finishLayer(onCube) {
    this.cutTo(1, onCube);
    this.layer--;
    this.rowsCut = 0;
    if (this.layer < 0) this.mesh.visible = false;
    return this.layer < 0;
  }
}
