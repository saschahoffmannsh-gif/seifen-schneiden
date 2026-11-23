// Päckchen aus Kraftpapier: stehen (zu) auf dem mittleren Wandbrett, fliegen beim Antippen auf
// den Tisch, Deckel geht ab, Seife rein, Deckel drauf, mit einem Wisch verschicken.
// Billig: 3 InstancedMesh (Schachtel, Deckel, Kontaktschatten), Matrizen nur bei Bewegung.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { makeKraftTexture, makeBlobTexture } from './setting/textures.js';
import { MIDDLE_SHELF, SHELF_Z, TABLE_Y } from './setting/wall.js';

// Maße auf dem Tisch (Seife liegt darin: 0.85 x 0.31 x 0.56)
export const PKG = { w: 1.05, h: 0.4, d: 0.75, wall: 0.03, lidH: 0.12, lidOver: 0.09 };
export const PKG_SHELF_SCALE = 0.3;
const SLOTS = [-0.86, -1.22];          // x-Positionen auf dem mittleren Brett (links neben den Rezept-Seifen)
export const SHADOW_SOAP = SLOTS.length; // letzter Schatten-Platz gehört der Seife auf dem Tisch

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const _s = new THREE.Vector3(), _v = new THREE.Vector3(), _p = new THREE.Vector3();
const _zero = new THREE.Matrix4().makeScale(0, 0, 0);

function boxAt(w, h, d, x, y, z) { return new THREE.BoxGeometry(w, h, d).translate(x, y, z); }

export class Packages {
  constructor(scene) {
    const { w, h, d, wall: t, lidH } = PKG;
    // offene Schachtel: Boden + 4 Wände, Ursprung unten in der Mitte
    const bodyGeo = mergeGeometries([
      boxAt(w, t, d, 0, t / 2, 0),
      boxAt(w, h, t, 0, h / 2, d / 2 - t / 2), boxAt(w, h, t, 0, h / 2, -d / 2 + t / 2),
      boxAt(t, h, d - 2 * t, w / 2 - t / 2, h / 2, 0), boxAt(t, h, d - 2 * t, -w / 2 + t / 2, h / 2, 0),
    ]);
    const lidGeo = new RoundedBoxGeometry(w + 0.04, lidH, d + 0.04, 2, 0.015).translate(0, lidH / 2, 0);
    const bodyMat = new THREE.MeshLambertMaterial({ map: makeKraftTexture({ seed: 31 }) });
    const lidMat = new THREE.MeshLambertMaterial({ map: makeKraftTexture({ seed: 47, withString: true }) });
    const n = SLOTS.length;
    this.body = new THREE.InstancedMesh(bodyGeo, bodyMat, n);
    this.lid = new THREE.InstancedMesh(lidGeo, lidMat, n);
    const blobMat = new THREE.MeshBasicMaterial({ map: makeBlobTexture(), transparent: true, depthWrite: false });
    this.blob = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), blobMat, n + 1);
    for (const m of [this.body, this.lid, this.blob]) {
      for (let i = 0; i < m.count; i++) m.setMatrixAt(i, _zero);
      m.frustumCulled = false;
      scene.add(m);
    }
    this.home = SLOTS.map((x) => new THREE.Vector3(x, MIDDLE_SHELF.y, SHELF_Z));
    this.onShelf = new Uint8Array(n);
    this.ray = new THREE.Raycaster();
    this.bobSlot = -1;
    this.reset();
  }

  get count() { return SLOTS.length; }

  /** Alle Päckchen (zu) zurück ins Regal. */
  reset() {
    for (let i = 0; i < SLOTS.length; i++) {
      this.onShelf[i] = 1;
      this.setClosed(i, this.home[i], 0, PKG_SHELF_SCALE);
      this.setBlob(i, this.home[i].x, this.home[i].y + 0.003, this.home[i].z, PKG.w * PKG_SHELF_SCALE * 1.5, PKG.d * PKG_SHELF_SCALE * 1.8);
    }
    this.setBlob(SHADOW_SOAP, 0, 0, 0, 0, 0);
  }

  /** Schachtel i: Unterkante bei pos, Drehung um y, Skalierung. */
  setBody(i, pos, rotY, scale) {
    _q.setFromEuler(_e.set(0, rotY, 0));
    this.body.setMatrixAt(i, _m.compose(pos, _q, _s.set(scale, scale, scale)));
    this.body.instanceMatrix.needsUpdate = true;
  }
  /** Deckel i: Unterkante bei pos, Drehung (x/z kippen beim Auf-/Zuklappen). */
  setLid(i, pos, rx, ry, rz, scale) {
    _q.setFromEuler(_e.set(rx, ry, rz));
    this.lid.setMatrixAt(i, _m.compose(pos, _q, _s.set(scale, scale, scale)));
    this.lid.instanceMatrix.needsUpdate = true;
  }
  /** Geschlossenes Päckchen (Deckel drauf) an pos. */
  setClosed(i, pos, rotY, scale) {
    this.setBody(i, pos, rotY, scale);
    _p.copy(pos); _p.y += (PKG.h - PKG.lidOver) * scale;
    this.setLid(i, _p, 0, rotY, 0, scale);
  }
  setBlob(i, x, y, z, sx, sz) {
    if (sx <= 0) this.blob.setMatrixAt(i, _zero);
    else this.blob.setMatrixAt(i, _m.compose(_v.set(x, y, z), _q.identity(), _s.set(sx, 1, sz)));
    this.blob.instanceMatrix.needsUpdate = true;
  }
  hide(i) {
    this.body.setMatrixAt(i, _zero); this.lid.setMatrixAt(i, _zero); this.blob.setMatrixAt(i, _zero);
    this.body.instanceMatrix.needsUpdate = this.lid.instanceMatrix.needsUpdate = this.blob.instanceMatrix.needsUpdate = true;
  }

  /** Antippen (nur beim Tippen): welches Päckchen im Regal? */
  pick(ndc, camera) {
    this.ray.setFromCamera(ndc, camera);
    const hits = this.ray.intersectObjects([this.body, this.lid], false);
    for (const h of hits) if (this.onShelf[h.instanceId]) return h.instanceId;
    let best = -1, bd = 0.13 * 0.13;
    for (let i = 0; i < SLOTS.length; i++) {
      if (!this.onShelf[i]) continue;
      _v.copy(this.home[i]).project(camera);
      const dx = _v.x - ndc.x, dy = (_v.y - ndc.y) * 0.6, dd = dx * dx + dy * dy;
      if (dd < bd) { bd = dd; best = i; }
    }
    return best;
  }

  /** Nächstes Päckchen im Regal hüpft leicht (gleiche Hinweis-Mechanik wie bei den Seifen). */
  update(time, bobSlot) {
    if (bobSlot !== this.bobSlot) {
      if (this.bobSlot >= 0 && this.onShelf[this.bobSlot]) this.setClosed(this.bobSlot, this.home[this.bobSlot], 0, PKG_SHELF_SCALE);
      this.bobSlot = bobSlot;
    }
    if (bobSlot >= 0) {
      const hop = Math.max(0, Math.sin(time * 5)) * 0.035 * (Math.sin(time * 2.5) > 0 ? 1 : 0);
      _p.copy(this.home[bobSlot]); _p.y += hop;
      this.setClosed(bobSlot, _p, 0, PKG_SHELF_SCALE);
    }
  }
}

export const TABLE_SPOT = { soap: new THREE.Vector3(-0.72, TABLE_Y, 0.25), pkg: new THREE.Vector3(0.74, TABLE_Y, 0.2), lid: new THREE.Vector3(0.74, TABLE_Y, -0.75) };
