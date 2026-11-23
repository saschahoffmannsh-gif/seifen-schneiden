// Rezept-Seifen auf dem mittleren Wandbrett: kleine, aufrecht stehende Seifenstücke (gleicher
// Look wie die große Seife: abgerundet, wachsig, eingeprägte Marke vorne). Antippen = Seife
// fliegt über die Schale. Billig: 3 InstancedMesh (Körper, Prägung, Kontaktschatten), Matrizen
// werden nur geschrieben, wenn sich etwas bewegt; Raycast nur beim Antippen.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { BLOCK, CUBE, BLOCK_BASE_Y, SOAP_RADIUS } from './config.js';
import { makeReliefTexture, RELIEF_SLOPE } from './relief.js';
import { makeBlobTexture } from './setting/textures.js';
import { MIDDLE_SHELF, SHELF_Z } from './setting/wall.js';

const MAX = 4;
const BW = BLOCK.nx * CUBE, BH = BLOCK.ny * CUBE, BD = BLOCK.nz * CUBE; // große Seife
export const SHELF_SCALE = 0.36;                                       // Seife im Regal: 36 %
const SPACING = 0.62;
const FLY_TIME = 0.55;

const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _q = new THREE.Quaternion();
const _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
const _v = new THREE.Vector3();
const _zero = new THREE.Matrix4().makeScale(0, 0, 0);

/** Steigungs-Textur der großen Seife -> Normal Map (einmalig beim Start). */
function reliefNormalMap() {
  const src = makeReliefTexture();
  const { data: d, width: W, height: H } = src.image;
  const out = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const gx = (d[i * 4] / 255 - 0.5) * 2 * RELIEF_SLOPE, gy = (d[i * 4 + 1] / 255 - 0.5) * 2 * RELIEF_SLOPE;
    const l = Math.hypot(gx, gy, 1);
    out[i * 4] = Math.round((0.5 - 0.5 * gx / l) * 255);
    out[i * 4 + 1] = Math.round((0.5 - 0.5 * gy / l) * 255);
    out[i * 4 + 2] = Math.round((0.5 + 0.5 / l) * 255);
    out[i * 4 + 3] = 255;
  }
  src.dispose();
  const t = new THREE.DataTexture(out, W, H, THREE.RGBAFormat);
  t.colorSpace = THREE.NoColorSpace;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}

export class ShelfSoaps {
  constructor(scene) {
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.42, metalness: 0, envMapIntensity: 0.7 });
    this.body = new THREE.InstancedMesh(new RoundedBoxGeometry(BW, BH, BD, 3, SOAP_RADIUS), mat, MAX);
    // Prägung: flache Platte direkt vor der Vorderseite, gleiche Farbe/Material + Normal Map
    const r = SOAP_RADIUS;
    const nmap = reliefNormalMap();
    nmap.repeat.set(1 - 2 * r / BW, 1 - 2 * r / BH);
    nmap.offset.set(r / BW, r / BH);
    const faceMat = mat.clone();
    faceMat.normalMap = nmap;
    this.face = new THREE.InstancedMesh(new THREE.PlaneGeometry(BW - 2 * r, BH - 2 * r), faceMat, MAX);
    this.faceOffset = new THREE.Matrix4().makeTranslation(0, 0, BD / 2 + 0.002);
    const blobMat = new THREE.MeshBasicMaterial({ map: makeBlobTexture(), transparent: true, depthWrite: false });
    this.blob = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), blobMat, MAX);
    for (const m of [this.body, this.face, this.blob]) {
      for (let i = 0; i < MAX; i++) m.setMatrixAt(i, _zero);
      m.frustumCulled = false;
      scene.add(m);
    }
    for (let i = 0; i < MAX; i++) { this.body.setColorAt(i, _c.set(1, 1, 1)); this.face.setColorAt(i, _c); }

    this.soaps = [];                       // Seife pro Platz (oder null)
    this.home = Array.from({ length: MAX }, () => new THREE.Vector3());
    this.fly = -1; this.flyT = 0; this.onArrive = null;
    this.ray = new THREE.Raycaster();
    this.bobSlot = -1;
  }

  /** Rezept-Seifen ins Regal stellen (nur bei neuer Bestellung). */
  setSoaps(list) {
    this.soaps = list.slice(0, MAX);
    const n = this.soaps.length;
    for (let i = 0; i < MAX; i++) {
      const soap = this.soaps[i];
      if (!soap) { this.hide(i); continue; }
      this.home[i].set((i - (n - 1) / 2) * SPACING, MIDDLE_SHELF.y + BH * SHELF_SCALE / 2, SHELF_Z);
      _c.setRGB(soap.base[0], soap.base[1], soap.base[2], THREE.SRGBColorSpace);
      this.body.setColorAt(i, _c); this.face.setColorAt(i, _c);
      this.place(i, this.home[i], SHELF_SCALE);
      _m.compose(_p.set(this.home[i].x, MIDDLE_SHELF.y + 0.003, SHELF_Z), _q.identity(), _s.set(BW * SHELF_SCALE * 1.7, 1, BD * SHELF_SCALE * 2.6));
      this.blob.setMatrixAt(i, _m);
    }
    this.body.instanceColor.needsUpdate = true; this.face.instanceColor.needsUpdate = true;
    this.blob.instanceMatrix.needsUpdate = true;
  }

  place(i, pos, scale) {
    _m.compose(pos, _q.identity(), _s.set(scale, scale, scale));
    this.body.setMatrixAt(i, _m);
    this.face.setMatrixAt(i, _m2.multiplyMatrices(_m, this.faceOffset));
    this.body.instanceMatrix.needsUpdate = true; this.face.instanceMatrix.needsUpdate = true;
  }

  hide(i) {
    this.body.setMatrixAt(i, _zero); this.face.setMatrixAt(i, _zero); this.blob.setMatrixAt(i, _zero);
    this.body.instanceMatrix.needsUpdate = true; this.face.instanceMatrix.needsUpdate = true; this.blob.instanceMatrix.needsUpdate = true;
  }

  /** Antippen: welche Seife wurde getroffen? (nur beim Tippen aufgerufen) */
  pick(ndc, camera, isAvailable, exactOnly = false) {
    this.ray.setFromCamera(ndc, camera);
    const hits = this.ray.intersectObject(this.body, false);
    for (const h of hits) if (this.soaps[h.instanceId] && isAvailable(this.soaps[h.instanceId])) return h.instanceId;
    if (exactOnly) return -1;
    // daneben getippt? Großzügig: nächste Seife in Bildschirmnähe (Finger sind dick)
    let best = -1, bd = 0.13 * 0.13;
    for (let i = 0; i < this.soaps.length; i++) {
      if (!this.soaps[i] || !isAvailable(this.soaps[i]) || i === this.fly) continue;
      _v.copy(this.home[i]).project(camera);
      const dx = _v.x - ndc.x, dy = (_v.y - ndc.y) * 0.6, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  /** Seife i fliegt vom Regal über die Schale; danach onArrive(). */
  launch(i, onArrive) {
    this.fly = i; this.flyT = 0; this.onArrive = onArrive;
    this.blob.setMatrixAt(i, _zero); this.blob.instanceMatrix.needsUpdate = true;
  }

  /** Pro Frame: Flug animieren, nächste gewünschte Seife leicht hüpfen lassen. Keine Allokationen. */
  update(dt, time, bobSlot) {
    if (this.fly >= 0) {
      this.flyT = Math.min(1, this.flyT + dt / FLY_TIME);
      const t = this.flyT, e = t * t * (3 - 2 * t);
      const h = this.home[this.fly];
      const ty = BLOCK_BASE_Y + BH / 2;
      _p.set(h.x * (1 - e), h.y + (ty - h.y) * e + Math.sin(t * Math.PI) * 0.45, h.z * (1 - e));
      this.place(this.fly, _p, SHELF_SCALE + (1 - SHELF_SCALE) * e);
      if (t >= 1) {
        const i = this.fly; this.fly = -1;
        this.hide(i);
        const cb = this.onArrive; this.onArrive = null;
        cb && cb();
      }
    }
    if (bobSlot !== this.bobSlot) {           // vorher hüpfende Seife zurück auf ihren Platz
      if (this.bobSlot >= 0 && this.bobSlot !== this.fly && this.soaps[this.bobSlot] && this.isShown(this.bobSlot)) this.place(this.bobSlot, this.home[this.bobSlot], SHELF_SCALE);
      this.bobSlot = bobSlot;
    }
    if (bobSlot >= 0 && bobSlot !== this.fly) {
      const hop = Math.max(0, Math.sin(time * 5)) * 0.035 * (Math.sin(time * 2.5) > 0 ? 1 : 0);
      _p.copy(this.home[bobSlot]); _p.y += hop;
      this.place(bobSlot, _p, SHELF_SCALE);
    }
  }

  isShown(i) { this.body.getMatrixAt(i, _m); return _m.elements[0] !== 0; }
}
