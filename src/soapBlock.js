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

    // Pro Würfel: Bitmaske der Seiten, vor denen direkt ein Nachbarwürfel liegt
    // (+x 1, -x 2, +y 4, -y 8, +z 16, -z 32). Der Shader blendet diese Innenflächen aus.
    this.hidden = new THREE.InstancedBufferAttribute(new Float32Array(this.count), 1);
    this.hidden.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aHidden', this.hidden);
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
    // exakt Kantenlänge 1 (keine Überlappung -> kein Z-Fighting doppelter Außenflächen); der Shader
    // rastet die Ecken auf das Würfelraster ein, damit die Außenhaut wasserdicht ist.
    // Die feinen Fugen zeichnet der Shader nur auf Schnitt-/Innenflächen.
    const s = CUBE;
    for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) {
      const n = this.index(i, j, k);
      _m.makeScale(s, s, s).setPosition(this.cubeX(i), this.cubeY(j), this.cubeZ(k));
      this.mesh.setMatrixAt(n, _m);
      cubeColor(soap, _rgb);
      _c.setRGB(_rgb[0], _rgb[1], _rgb[2], THREE.SRGBColorSpace);
      this.mesh.setColorAt(n, _c);
      this.colors[n * 3] = _c.r; this.colors[n * 3 + 1] = _c.g; this.colors[n * 3 + 2] = _c.b;
    }
    const h = this.hidden.array;
    for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) {
      h[this.index(i, j, k)] = (i < nx - 1 ? 1 : 0) | (i > 0 ? 2 : 0) | (j < ny - 1 ? 4 : 0)
        | (j > 0 ? 8 : 0) | (k < nz - 1 ? 16 : 0) | (k > 0 ? 32 : 0);
    }
    this.hidden.needsUpdate = true;
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
        this.uncover(i, j, k);
        onCube(this.cubeX(i), this.cubeY(j), this.cubeZ(k),
          this.colors[idx * 3], this.colors[idx * 3 + 1], this.colors[idx * 3 + 2], this.soap.id);
        n++;
      }
      this.rowsCut++;
    }
    if (n) { this.mesh.instanceMatrix.needsUpdate = true; this.hidden.needsUpdate = true; }
    return n;
  }

  /** Würfel (i,j,k) ist weg: die zu ihm zeigenden Flächen der Nachbarn werden sichtbar. */
  uncover(i, j, k) {
    const { nx, ny, nz } = BLOCK, h = this.hidden.array;
    if (i > 0) h[this.index(i - 1, j, k)] &= ~1;
    if (i < nx - 1) h[this.index(i + 1, j, k)] &= ~2;
    if (j > 0) h[this.index(i, j - 1, k)] &= ~4;
    if (j < ny - 1) h[this.index(i, j + 1, k)] &= ~8;
    if (k > 0) h[this.index(i, j, k - 1)] &= ~16;
    if (k < nz - 1) h[this.index(i, j, k + 1)] &= ~32;
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
