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
const SPARE_SHOWN = 4;                // so viele Ersatzstücke je Sorte werden hinter dem vordersten gezeigt
const BW = BLOCK.nx * CUBE, BH = BLOCK.ny * CUBE, BD = BLOCK.nz * CUBE; // große Seife
export const SHELF_SCALE = 0.36;                                       // Seife im Regal: 36 %
const SPACING = 0.62;
const FLY_TIME = 0.55;

const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _q = new THREE.Quaternion();
const _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
const _v = new THREE.Vector3(), _to = new THREE.Vector3(), _xAxis = new THREE.Vector3(1, 0, 0);
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
    this.frac = new Float32Array(16).fill(1);
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

    // Ersatzstücke (weitere volle Stücke derselben Sorte) stehen leicht versetzt hinter dem vordersten
    this.spare = new THREE.InstancedMesh(this.body.geometry, mat, MAX * SPARE_SHOWN);
    for (let i = 0; i < MAX * SPARE_SHOWN; i++) { this.spare.setMatrixAt(i, _zero); this.spare.setColorAt(i, _c.set(1, 1, 1)); }
    this.spare.frustumCulled = false;
    scene.add(this.spare);
    this.spareN = new Uint8Array(MAX);
    this.soaps = [];                       // Seife pro Platz (oder null)
    this.home = Array.from({ length: MAX }, () => new THREE.Vector3());
    this.fly = -1; this.flyT = 0; this.onArrive = null;
    this.back = -1; this.backT = 0;          // Seife fliegt von der Schale zurück ins Regal
    this.backFrom = new THREE.Vector3(); this.backAng = 0;
    this.ray = new THREE.Raycaster();
    this.bobSlot = -1;
  }

  /** Rezept-Seifen ins Regal stellen (nur bei neuer Bestellung). */
  /** fracs[i]: Länge des Stücks (Anteil der Scheiben, angebrochene Stücke sind kürzer). */
  setSoaps(list, fracs = null) {
    this.soaps = list.slice(0, MAX);
    for (let i = 0; i < MAX; i++) this.frac[i] = fracs && fracs[i] != null ? Math.max(0.08, fracs[i]) : 1;
    this.spareN.fill(0); this.drawSpares();
    const n = this.soaps.length;
    for (let i = 0; i < MAX; i++) {
      const soap = this.soaps[i];
      if (!soap || (fracs && fracs[i] === 0)) { this.hide(i); continue; }   // Sorte ganz aufgebraucht
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

  /** n Ersatzstücke hinter Platz i (0 = keins). */
  setSpares(i, n) { this.spareN[i] = Math.min(SPARE_SHOWN, n); this.drawSpares(); }
  drawSpares() {
    const n = this.soaps.length;
    for (let i = 0; i < MAX; i++) for (let k = 0; k < SPARE_SHOWN; k++) {
      const idx = i * SPARE_SHOWN + k, soap = this.soaps[i];
      if (!soap || k >= this.spareN[i]) { this.spare.setMatrixAt(idx, _zero); continue; }
      // gestaffelt nach hinten rechts, damit man die Stücke zählen kann
      _p.set((i - (n - 1) / 2) * SPACING + 0.075 * (k + 1), MIDDLE_SHELF.y + BH * SHELF_SCALE / 2, SHELF_Z - 0.05 * (k + 1));
      _m.compose(_p, _q.identity(), _s.set(SHELF_SCALE, SHELF_SCALE, SHELF_SCALE));
      this.spare.setMatrixAt(idx, _m);
      _c.setRGB(soap.base[0] * 0.93, soap.base[1] * 0.93, soap.base[2] * 0.93, THREE.SRGBColorSpace);
      this.spare.setColorAt(idx, _c);
    }
    this.spare.instanceMatrix.needsUpdate = true; this.spare.instanceColor.needsUpdate = true;
  }

  place(i, pos, scale, rotX = 0) {
    if (rotX) _q.setFromAxisAngle(_xAxis, rotX); else _q.identity();
    _m.compose(pos, _q, _s.set(scale, scale, scale * this.frac[i]));
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
    this.body.computeBoundingSphere();   // Instanzen bewegen sich (Flug) -> Hülle nur beim Tippen auffrischen
    const hits = this.ray.intersectObject(this.body, false);
    for (const h of hits) if (this.soaps[h.instanceId] && isAvailable(this.soaps[h.instanceId])) return h.instanceId;
    if (exactOnly) return -1;
    // daneben getippt? Großzügig: nächste Seife in Bildschirmnähe (Finger sind dick)
    let best = -1, bd = 0.13 * 0.13;
    for (let i = 0; i < this.soaps.length; i++) {
      if (!this.soaps[i] || !isAvailable(this.soaps[i]) || i === this.fly || i === this.back) continue;
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

  /** Seife i (gerade über der Schale) fliegt zurück auf ihren Platz im Regal. */
  /** from/ang: Startlage (Mitte des Reststücks in der Welt, Kippwinkel um x) – die gekippte Seife richtet sich im Flug auf. */
  flyBack(i, from = null, ang = 0) {
    if (this.back >= 0) this.landBack();
    this.back = i; this.backT = 0;
    if (from) this.backFrom.copy(from); else this.backFrom.set(0, BLOCK_BASE_Y + BH / 2, 0);
    this.backAng = ang;
    this.blob.setMatrixAt(i, _zero); this.blob.instanceMatrix.needsUpdate = true;
    this.flyPose(i, 0);
  }
  landBack() {
    const i = this.back; this.back = -1;
    if (!this.soaps[i]) return;
    this.place(i, this.home[i], SHELF_SCALE);
    _m.compose(_p.set(this.home[i].x, MIDDLE_SHELF.y + 0.003, SHELF_Z), _q.identity(), _s.set(BW * SHELF_SCALE * 1.7, 1, BD * SHELF_SCALE * 2.6));
    this.blob.setMatrixAt(i, _m); this.blob.instanceMatrix.needsUpdate = true;
  }
  /** Position auf der Flugbahn Regal (e=0) -> über der Schale (e=1). */
  flyPose(i, t) {
    const e = t * t * (3 - 2 * t), h = this.home[i];
    const back = i === this.back, f = back ? this.backFrom : _to.set(0, BLOCK_BASE_Y + BH / 2, 0);
    _p.set(h.x + (f.x - h.x) * e, h.y + (f.y - h.y) * e + Math.sin(t * Math.PI) * 0.45, h.z + (f.z - h.z) * e);
    this.place(i, _p, SHELF_SCALE + (1 - SHELF_SCALE) * e, back ? this.backAng * e : 0);
  }

  /** Pro Frame: Flug animieren, nächste gewünschte Seife leicht hüpfen lassen. Keine Allokationen. */
  update(dt, time, bobSlot) {
    if (this.fly >= 0) {
      this.flyT = Math.min(1, this.flyT + dt / FLY_TIME);
      const t = this.flyT;
      this.flyPose(this.fly, t);
      if (t >= 1) {
        const i = this.fly; this.fly = -1;
        this.hide(i);
        const cb = this.onArrive; this.onArrive = null;
        cb && cb();
      }
    }
    if (this.back >= 0) {
      this.backT = Math.min(1, this.backT + dt / FLY_TIME);
      this.flyPose(this.back, 1 - this.backT);
      if (this.backT >= 1) this.landBack();
    }
    if (bobSlot !== this.bobSlot) {           // vorher hüpfende Seife zurück auf ihren Platz
      if (this.bobSlot >= 0 && this.bobSlot !== this.fly && this.bobSlot !== this.back && this.soaps[this.bobSlot] && this.isShown(this.bobSlot)) this.place(this.bobSlot, this.home[this.bobSlot], SHELF_SCALE);
      this.bobSlot = bobSlot;
    }
    if (bobSlot >= 0 && bobSlot !== this.fly && bobSlot !== this.back) {
      const hop = Math.max(0, Math.sin(time * 5)) * 0.035 * (Math.sin(time * 2.5) > 0 ? 1 : 0);
      _p.copy(this.home[bobSlot]); _p.y += hop;
      this.place(bobSlot, _p, SHELF_SCALE);
    }
  }

  isShown(i) { this.body.getMatrixAt(i, _m); return _m.elements[0] !== 0; }
}
