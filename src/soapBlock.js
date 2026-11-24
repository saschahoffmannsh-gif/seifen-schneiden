// Der intakte Seifenblock: ein einziges InstancedMesh mit nx*ny*nz Würfeln.
// Geschnittene Würfel werden nur auf Skalierung 0 gesetzt (kein Erzeugen/Löschen von Meshes).
import * as THREE from 'three';
import { BLOCK, CUBE, BLOCK_BASE_Y, SLICES, SLICE_DEPTH } from './config.js';
import { lookColor, hasMotif, lookRough } from './soapLooks.js';

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
    this.rowsCut = 0;         // wie viele Reihen (von oben) der aktuellen Scheibe schon ganz gelöst sind
    this.colRows = new Int16Array(nx);   // je Spalte gelöste Reihen (schräge Klinge: links voraus)
    this.soap = null;
    this.halfX = nx * CUBE / 2;
    this.halfZ = nz * CUBE / 2;
  }

  index(i, j, k) { return (j * BLOCK.nz + k) * BLOCK.nx + i; }
  cubeX(i) { return (i - (BLOCK.nx - 1) / 2) * CUBE; }
  cubeY(j) { return BLOCK_BASE_Y + (j + 0.5) * CUBE; }
  cubeZ(k) { return (k - (BLOCK.nz - 1) / 2) * CUBE; }

  /**
   * Neuen Block einer Sorte aufbauen (passiert nur beim Auswählen, nicht pro Frame).
   * slices < SLICES: angebrochenes Stück aus dem Vorrat – vorne fehlen entsprechend viele Scheiben.
   */
  load(soap, slices = SLICES) {
    const { nx, ny, nz } = BLOCK;
    const kz = Math.max(1, Math.min(SLICES, slices)) * SLICE_DEPTH;   // vorhandene Tiefe in Würfeln
    this.soap = soap;
    this.released.fill(0);
    this.releasedCount = 0;
    this.loadedCount = nx * ny * kz;
    // exakt Kantenlänge 1 (keine Überlappung -> kein Z-Fighting doppelter Außenflächen); der Shader
    // rastet die Ecken auf das Würfelraster ein, damit die Außenhaut wasserdicht ist.
    // Die feinen Fugen zeichnet der Shader nur auf Schnitt-/Innenflächen.
    const s = CUBE;
    for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) {
      const n = this.index(i, j, k);
      if (k >= kz) { this.released[n] = 1; this.mesh.setMatrixAt(n, _zero); continue; }
      _m.makeScale(s, s, s).setPosition(this.cubeX(i), this.cubeY(j), this.cubeZ(k));
      this.mesh.setMatrixAt(n, _m);
      lookColor(soap, i, j, k, _rgb);   // Muster/Motiv der Sorte (Querschnitt läuft durchs ganze Stück)
      _c.setRGB(_rgb[0], _rgb[1], _rgb[2], THREE.SRGBColorSpace);
      this.mesh.setColorAt(n, _c);
      this.colors[n * 3] = _c.r; this.colors[n * 3 + 1] = _c.g; this.colors[n * 3 + 2] = _c.b;
    }
    const h = this.hidden.array;
    for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) {
      h[this.index(i, j, k)] = (i < nx - 1 ? 1 : 0) | (i > 0 ? 2 : 0) | (j < ny - 1 ? 4 : 0)
        | (j > 0 ? 8 : 0) | (k < kz - 1 ? 16 : 0) | (k > 0 ? 32 : 0);
    }
    this.hidden.needsUpdate = true;
    // Glanz je Sorte (Honig glänzt, Aktivkohle matt); Motiv-Seifen ohne Prägung (das Motiv ist die Vorderseite)
    const mat = this.mesh.material;
    mat.roughness = lookRough(soap);
    if (mat.userData.uniforms) mat.userData.uniforms.uReliefOn.value = hasMotif(soap) ? 0 : 1;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
    this.slice = kz / SLICE_DEPTH - 1;  // vorderste vorhandene Scheibe (Kamera-Seite)
    this.slicesLeft = kz / SLICE_DEPTH;
    this.rowsCut = 0; this.colRows.fill(0);
    this.mesh.visible = true;
  }

  /** Anteil der schon abgeschnittenen Würfel (0..1). */
  get cutFraction() { return this.releasedCount / (this.loadedCount || this.count); }

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
  /**
   * Scheibe bis zur Tiefe frac (0..1, an der hinteren = rechten Seite der Klinge) lösen. lead = wie weit
   * (in Anteilen der Höhe) die Schneide links voraus ist (schräge Klinge): Spalte i ist um
   * lead·(nx-1-i)/(nx-1) tiefer -> die Würfel einer Reihe lösen sich versetzt von links nach rechts.
   * frac darf negativ sein (nur die Spitze steckt schon in der Seife).
   */
  cutTo(frac, onCube, lead = 0) {
    if (this.slice < 0) return 0;
    const { nx, ny } = BLOCK;
    let n = 0, minRows = ny;
    for (let i = 0; i < nx; i++) {
      const d = Math.min(1, frac + lead * (nx - 1 - i) / (nx - 1));
      const target = Math.max(0, Math.min(ny, Math.floor(d * ny + 0.0001)));
      while (this.colRows[i] < target) {
        const j = ny - 1 - this.colRows[i]; // oben zuerst
        for (let dk = SLICE_DEPTH - 1; dk >= 0; dk--) {
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
        this.colRows[i]++;
      }
      if (this.colRows[i] < minRows) minRows = this.colRows[i];
    }
    this.rowsCut = minRows;   // ganz gelöste Reihen (für die Rutschfläche)
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
    this.slicesLeft--;
    this.rowsCut = 0; this.colRows.fill(0);
    if (this.slice < 0) this.mesh.visible = false;
    return this.slice < 0;
  }
}
