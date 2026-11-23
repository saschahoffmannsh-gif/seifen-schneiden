// Päckchen: alle Sorten stehen nebeneinander auf dem obersten Wandbrett. Antippen öffnet die
// Auswahl; das gewählte Päckchen fliegt auf den Tisch, der Deckel geht ab und liegt daneben,
// Seife rein, Deckel drauf, mit einem Wisch verschicken.
//
// Billig gehalten:
//  * eckige Sorten: EIN InstancedMesh für Schachteln + EIN InstancedMesh für Deckel; die Muster
//    kommen aus einem gemeinsamen Textur-Atlas (Kachel pro Instanz über das Attribut aTile)
//  * Hutschachtel: 2 einfache Meshes, Schleifen: 1 InstancedMesh, Seidenpapier: 1 Mesh,
//    Kontaktschatten: 1 InstancedMesh
//  * Matrizen werden nur geschrieben, wenn sich etwas bewegt; Raycast nur beim Antippen
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { makeBlobTexture, rng } from './setting/textures.js';
import { makePackageAtlas, makePackageTexture } from './setting/packageTextures.js';
import { TOP_SHELF, SHELF_Z, TABLE_Y } from './setting/wall.js';
import { PACKAGE_TYPES } from './decor.js';

// Maße auf dem Tisch: passt knapp um die Seife (0.85 x 0.31 x 0.56)
export const PKG = { w: 0.95, h: 0.34, d: 0.65, wall: 0.025, lidH: 0.1, lidOver: 0.07, lidPad: 0.025, r: 0.5 };
export const PKG_SHELF_SCALE = 0.36;
const SPACING = 0.47, CENTER_X = -0.27;   // Reihe auf dem obersten Brett (Bildmitte liegt bei x ~ -0.27)
const N = PACKAGE_TYPES.length;
export const SHADOW_SOAP = N, SHADOW_LID = N + 1;

// Plätze auf dem Tisch (Schale ist dann weg): Seife links, Päckchen rechts, Deckel liegt flach
// vorne daneben (deutlicher Abstand, leicht gedreht, eigener Schatten).
export const TABLE_SPOT = {
  soap: new THREE.Vector3(-0.62, TABLE_Y, -0.25),
  pkg: new THREE.Vector3(0.5, TABLE_Y, -0.34),
  lid: new THREE.Vector3(0.3, TABLE_Y, 0.68),
  lidRy: -0.26,
};

const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const _s = new THREE.Vector3(), _v = new THREE.Vector3(), _p = new THREE.Vector3();
const _zero = new THREE.Matrix4().makeScale(0, 0, 0);

/** Atlas-Material: Kachel pro Instanz (aTile), Zeile 1 = Deckel, 0 = Schachtel. */
function atlasMaterial(map, row, tiles) {
  const mat = new THREE.MeshLambertMaterial({ map });
  mat.defines = { PKG_ROW: row.toFixed(1), PKG_TILES: tiles.toFixed(1) };
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aTile;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\n vMapUv = (vec2(aTile, PKG_ROW) + 0.03 + 0.94 * uv) / vec2(PKG_TILES, 2.0);\n#endif');
  };
  mat.customProgramCacheKey = () => 'pkg' + row;
  return mat;
}

function crumple(seed) {
  const r = rng(seed);
  let g = new THREE.IcosahedronGeometry(1, 1);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const k = 0.75 + r() * 0.5; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); }
  return g;
}

/** Seidenpapier: zerknitterte Bäusche rund an der Innenwand (Seife liegt in der Mitte). */
function tissueGeometry(round) {
  const parts = [];
  const r = rng(round ? 5 : 3);
  const n = round ? 26 : 30;
  for (let i = 0; i < n; i++) {
    const g = crumple(10 + i);
    let x, z;
    if (round) { const a = i / n * 6.283; x = Math.cos(a) * (PKG.r - 0.08); z = Math.sin(a) * (PKG.r - 0.08); }
    else {
      const per = 2 * (PKG.w + PKG.d), t = (i + 0.5) / n * per;
      const hw = PKG.w / 2 - PKG.wall - 0.078, hd = PKG.d / 2 - PKG.wall - 0.078; // Bausch (max. 0.075) bleibt innen
      if (t < PKG.w) { x = -hw + t / PKG.w * 2 * hw; z = hd; }
      else if (t < PKG.w + PKG.d) { x = hw; z = hd - (t - PKG.w) / PKG.d * 2 * hd; }
      else if (t < 2 * PKG.w + PKG.d) { x = hw - (t - PKG.w - PKG.d) / PKG.w * 2 * hw; z = -hd; }
      else { x = -hw; z = -hd + (t - 2 * PKG.w - PKG.d) / PKG.d * 2 * hd; }
    }
    // bleibt unter der Deckel-Unterkante (Deckel geschlossen bei h - lidOver)
    g.scale(0.05 + r() * 0.01, 0.04 + r() * 0.012, 0.05 + r() * 0.01).rotateY(r() * 3).translate(x, PKG.h - PKG.lidOver - 0.075 + r() * 0.01, z);
    parts.push(g);
  }
  const m = mergeGeometries(parts);
  m.computeVertexNormals();
  return m;
}

function bowGeometry() {
  const loop = (a) => new THREE.TorusGeometry(0.075, 0.022, 8, 18).scale(1, 0.7, 1).rotateZ(a).translate(Math.cos(a) * 0.08, Math.sin(a) * 0.05 + 0.05, 0);
  const tail = (s) => new THREE.BoxGeometry(0.05, 0.012, 0.16).rotateY(s * 0.6).translate(s * 0.07, 0.006, 0.09);
  const knot = new THREE.SphereGeometry(0.035, 10, 8).scale(1, 0.8, 0.8).translate(0, 0.045, 0);
  const g = mergeGeometries([loop(0.35), loop(Math.PI - 0.35), knot, tail(1), tail(-1)].map((x) => x.toNonIndexed()));
  return g;
}

export class Packages {
  constructor(scene) {
    const { w, h, d, wall: t, lidH, lidPad, r: R } = PKG;
    this.types = PACKAGE_TYPES;
    const boxIds = this.types.filter((x) => x.shape === 'box').map((x) => x.id);
    const atlas = makePackageAtlas(boxIds);

    // eckige Schachtel: Boden + 4 Wände mit leicht gerundeten Kanten, Ursprung unten in der Mitte
    const rb = (W, H, D, x, y, z) => new RoundedBoxGeometry(W, H, D, 2, 0.008).translate(x, y, z);
    this.boxGeo = mergeGeometries([
      rb(w, t, d, 0, t / 2, 0),
      rb(w, h, t, 0, h / 2, d / 2 - t / 2), rb(w, h, t, 0, h / 2, -d / 2 + t / 2),
      rb(t, h, d - 2 * t, w / 2 - t / 2, h / 2, 0), rb(t, h, d - 2 * t, -w / 2 + t / 2, h / 2, 0),
    ]);
    this.boxLidGeo = new RoundedBoxGeometry(w + 2 * lidPad, lidH, d + 2 * lidPad, 2, 0.02).translate(0, lidH / 2, 0);
    this.boxMat = atlasMaterial(atlas, 0, boxIds.length);
    this.boxLidMat = atlasMaterial(atlas, 1, boxIds.length);
    const nb = boxIds.length;
    this.boxGeo.setAttribute('aTile', new THREE.InstancedBufferAttribute(new Float32Array(nb), 1));
    this.boxLidGeo.setAttribute('aTile', new THREE.InstancedBufferAttribute(new Float32Array(nb), 1));
    this.body = new THREE.InstancedMesh(this.boxGeo, this.boxMat, nb);
    this.lid = new THREE.InstancedMesh(this.boxLidGeo, this.boxLidMat, nb);

    // Hutschachtel (rund)
    const hatBody = mergeGeometries([
      new THREE.CylinderGeometry(R, R, h, 40, 1, true).translate(0, h / 2, 0),
      new THREE.CircleGeometry(R, 40).rotateX(-Math.PI / 2).translate(0, 0.004, 0),
    ]);
    const hatLid = new THREE.CylinderGeometry(R + lidPad, R + lidPad, lidH, 40).translate(0, lidH / 2, 0);
    const hatTex = makePackageTexture('hut', false); hatTex.repeat.set(3, 1);
    const hatLidTex = makePackageTexture('hut', true); hatLidTex.repeat.set(3, 1);
    this.hatGeo = hatBody; this.hatLidGeo = hatLid;
    this.hatMat = new THREE.MeshLambertMaterial({ map: hatTex, side: THREE.DoubleSide });
    this.hatLidMat = new THREE.MeshLambertMaterial({ map: hatLidTex });

    // Schleifen auf den Deckeln
    this.bowGeo = bowGeometry();
    this.bowMat = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.1 });
    const nBow = this.types.filter((x) => x.bow).length;
    this.bow = new THREE.InstancedMesh(this.bowGeo, this.bowMat, Math.max(1, nBow));
    this.bowOffset = new THREE.Matrix4().makeTranslation(0, lidH, 0);

    // Seidenpapier im offenen Päckchen (nur beim gewählten Päckchen sichtbar)
    this.tissueBox = tissueGeometry(false); this.tissueRound = tissueGeometry(true);
    this.tissue = new THREE.Mesh(this.tissueBox, new THREE.MeshLambertMaterial({ flatShading: true }));
    this.tissue.matrixAutoUpdate = false; this.tissue.visible = false;

    const blobMat = new THREE.MeshBasicMaterial({ map: makeBlobTexture(), transparent: true, depthWrite: false });
    this.blob = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), blobMat, N + 2);

    // Plätze: Reihe auf dem obersten Brett
    let bi = 0, wi = 0;
    this.slots = this.types.map((ty, i) => {
      const sl = { type: ty, round: ty.shape === 'round', inst: -1, bow: -1 };
      if (!sl.round) { sl.inst = bi; this.boxGeo.attributes.aTile.array[bi] = bi; this.boxLidGeo.attributes.aTile.array[bi] = bi; bi++; }
      if (ty.bow) { sl.bow = wi; this.bow.setColorAt(wi, new THREE.Color(ty.bow)); wi++; }
      return sl;
    });
    this.hatBody = new THREE.Mesh(this.hatGeo, this.hatMat); this.hatLid = new THREE.Mesh(this.hatLidGeo, this.hatLidMat);
    for (const m of [this.hatBody, this.hatLid]) { m.matrixAutoUpdate = false; m.frustumCulled = false; scene.add(m); }
    for (const m of [this.body, this.lid, this.bow, this.blob]) {
      for (let i = 0; i < m.count; i++) m.setMatrixAt(i, _zero);
      m.frustumCulled = false;
      scene.add(m);
    }
    scene.add(this.tissue);
    this.home = this.types.map((_, i) => new THREE.Vector3(CENTER_X + (i - (N - 1) / 2) * SPACING, TOP_SHELF.y, SHELF_Z));
    this.onShelf = new Uint8Array(N);
    this.ray = new THREE.Raycaster();
    this.bobSlot = -1;
    this.active = -1;
    this.thumbs = null;
    this.reset();
  }

  get count() { return N; }
  slotOf(id) { return this.types.findIndex((t) => t.id === id); }
  footprint(i) { return this.slots[i].round ? [PKG.r * 2, PKG.r * 2] : [PKG.w, PKG.d]; }

  /** Alle Päckchen (zu) zurück ins Regal. */
  reset() {
    this.setActive(-1);
    for (let i = 0; i < N; i++) {
      this.onShelf[i] = 1;
      this.setClosed(i, this.home[i], 0, PKG_SHELF_SCALE);
      const [fw, fd] = this.footprint(i);
      this.setBlob(i, this.home[i].x, this.home[i].y + 0.003, this.home[i].z, fw * PKG_SHELF_SCALE * 1.5, fd * PKG_SHELF_SCALE * 1.8);
    }
    this.setBlob(SHADOW_SOAP, 0, 0, 0, 0, 0);
    this.setBlob(SHADOW_LID, 0, 0, 0, 0, 0);
  }

  /** Gewähltes Päckchen: bekommt Seidenpapier in seiner Farbe. */
  setActive(i) {
    this.active = i;
    this.tissue.visible = i >= 0;
    if (i < 0) return;
    this.tissue.geometry = this.slots[i].round ? this.tissueRound : this.tissueBox;
    this.tissue.material.color.set(this.types[i].tissue || '#ffffff');
  }

  /** Schachtel i: Unterkante bei pos, Drehung um y, Skalierung. */
  setBody(i, pos, rotY, scale) {
    _q.setFromEuler(_e.set(0, rotY, 0));
    _m.compose(pos, _q, _s.set(scale, scale, scale));
    const sl = this.slots[i];
    if (sl.round) { this.hatBody.matrix.copy(_m); this.hatBody.matrixWorldNeedsUpdate = true; }
    else { this.body.setMatrixAt(sl.inst, _m); this.body.instanceMatrix.needsUpdate = true; }
    if (i === this.active) { this.tissue.matrix.copy(_m); this.tissue.matrixWorldNeedsUpdate = true; }
  }
  /** Deckel i: Unterkante bei pos, Drehung (x/z kippen beim Auf-/Zuklappen). */
  setLid(i, pos, rx, ry, rz, scale) {
    _q.setFromEuler(_e.set(rx, ry, rz));
    _m.compose(pos, _q, _s.set(scale, scale, scale));
    const sl = this.slots[i];
    if (sl.round) { this.hatLid.matrix.copy(_m); this.hatLid.matrixWorldNeedsUpdate = true; }
    else { this.lid.setMatrixAt(sl.inst, _m); this.lid.instanceMatrix.needsUpdate = true; }
    if (sl.bow >= 0) { this.bow.setMatrixAt(sl.bow, _m2.multiplyMatrices(_m, this.bowOffset)); this.bow.instanceMatrix.needsUpdate = true; }
  }
  /** Höhe der Deckel-Unterkante über der Schachtel-Unterkante, wenn geschlossen. */
  get lidY() { return PKG.h - PKG.lidOver; }
  setClosed(i, pos, rotY, scale) {
    this.setBody(i, pos, rotY, scale);
    _p.copy(pos); _p.y += this.lidY * scale;
    this.setLid(i, _p, 0, rotY, 0, scale);
  }
  setBlob(i, x, y, z, sx, sz, ry = 0) {
    if (sx <= 0) this.blob.setMatrixAt(i, _zero);
    else this.blob.setMatrixAt(i, _m.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(0, ry, 0)), _s.set(sx, 1, sz)));
    this.blob.instanceMatrix.needsUpdate = true;
  }
  hide(i) {
    _m.copy(_zero);
    const sl = this.slots[i];
    if (sl.round) { this.hatBody.matrix.copy(_zero); this.hatLid.matrix.copy(_zero); this.hatBody.matrixWorldNeedsUpdate = this.hatLid.matrixWorldNeedsUpdate = true; }
    else { this.body.setMatrixAt(sl.inst, _zero); this.lid.setMatrixAt(sl.inst, _zero); }
    if (sl.bow >= 0) this.bow.setMatrixAt(sl.bow, _zero);
    this.blob.setMatrixAt(i, _zero);
    this.body.instanceMatrix.needsUpdate = this.lid.instanceMatrix.needsUpdate = this.bow.instanceMatrix.needsUpdate = this.blob.instanceMatrix.needsUpdate = true;
    if (i === this.active) this.setActive(-1);
  }

  /** Antippen (nur beim Tippen): welches Päckchen im Regal? Großzügig über die Bildschirmnähe. */
  pick(ndc, camera) {
    let best = -1, bd = 0.09 * 0.09;
    for (let i = 0; i < N; i++) {
      if (!this.onShelf[i]) continue;
      _v.copy(this.home[i]); _v.y += 0.06;
      _v.project(camera);
      const dx = _v.x - ndc.x, dy = (_v.y - ndc.y) * 0.5, dd = dx * dx + dy * dy;
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

  /**
   * Vorschaubilder für das Auswahlfenster: einmalig mit dem Spiel-Renderer in ein kleines
   * Render-Target gezeichnet (gleiche Geometrie, Materialien und Licht-Stimmung wie im Spiel).
   */
  makeThumbs(renderer) {
    if (this.thumbs) return this.thumbs;
    const S = 256;
    const rt = new THREE.WebGLRenderTarget(S, S);
    rt.texture.colorSpace = THREE.SRGBColorSpace;
    const sc = new THREE.Scene();
    sc.add(new THREE.HemisphereLight(0xfff4e6, 0xa8744c, 1.25));
    const sun = new THREE.DirectionalLight(0xfff0dc, 1.4); sun.position.set(1.5, 4, 2.5); sc.add(sun);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
    cam.position.set(0, 1.4, 2.35); cam.lookAt(0, -0.02, 0);
    const px = new Uint8Array(S * S * 4);
    const cv = document.createElement('canvas'); cv.width = cv.height = S;
    const c2 = cv.getContext('2d'), img = c2.createImageData(S, S);
    const prevTarget = renderer.getRenderTarget(), prevAlpha = renderer.getClearAlpha();
    const prevColor = new THREE.Color(); renderer.getClearColor(prevColor);
    renderer.setClearColor(0x000000, 0);
    const bowMat = this.bowMat.clone();
    this.thumbs = this.slots.map((sl) => {
      const g = new THREE.Group();
      const temp = [];
      if (sl.round) {
        g.add(new THREE.Mesh(this.hatGeo, this.hatMat));
        const l = new THREE.Mesh(this.hatLidGeo, this.hatLidMat); l.position.y = this.lidY; g.add(l);
      } else {
        const bg = this.boxGeo.clone(), lg = this.boxLidGeo.clone();
        bg.setAttribute('aTile', new THREE.InstancedBufferAttribute(new Float32Array([sl.inst]), 1));
        lg.setAttribute('aTile', new THREE.InstancedBufferAttribute(new Float32Array([sl.inst]), 1));
        const b = new THREE.InstancedMesh(bg, this.boxMat, 1), l = new THREE.InstancedMesh(lg, this.boxLidMat, 1);
        b.setMatrixAt(0, _m.identity()); l.setMatrixAt(0, _m.makeTranslation(0, this.lidY, 0));
        g.add(b, l); temp.push(bg, lg);
      }
      if (sl.type.bow) {
        bowMat.color.set(sl.type.bow);
        const bw = new THREE.Mesh(this.bowGeo, bowMat); bw.position.y = this.lidY + PKG.lidH; g.add(bw);
      }
      g.rotation.y = -0.45; g.position.y = -0.2;
      sc.add(g);
      renderer.setRenderTarget(rt); renderer.clear(); renderer.render(sc, cam);
      renderer.readRenderTargetPixels(rt, 0, 0, S, S, px);
      for (let y = 0; y < S; y++) img.data.set(px.subarray((S - 1 - y) * S * 4, (S - y) * S * 4), y * S * 4); // Zeilen umdrehen
      c2.putImageData(img, 0, 0);
      sc.remove(g); temp.forEach((x) => x.dispose());
      return cv.toDataURL('image/png');
    });
    renderer.setRenderTarget(prevTarget); renderer.setClearColor(prevColor, prevAlpha);
    rt.dispose(); bowMat.dispose();
    return this.thumbs;
  }
}
