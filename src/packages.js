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
import { makePackageAtlas, ATLAS_COLS } from './setting/packageTextures.js';
import { TOP_SHELF, SHELF_Z, TABLE_Y } from './setting/wall.js';
import { PACKAGE_TYPES } from './decor.js';

// Maße auf dem Tisch: passt knapp um die Seife (0.85 x 0.31 x 0.56)
export const PKG = { w: 0.95, h: 0.34, d: 0.65, wall: 0.025, lidH: 0.1, lidOver: 0.07, lidPad: 0.025, r: 0.5 };
export const PKG_SHELF_SCALE = 0.36;
const SPACING = 0.5, CENTER_X = -0.27;   // Reihe auf dem obersten Brett (Bildmitte liegt bei x ~ -0.27)
const N = PACKAGE_TYPES.length;
export const SHADOW_SOAP = N, SHADOW_LID = N + 1;
const HEX_R = 0.58, HEART_W = 1.35;
// wie die Seife je Form im Päckchen liegt (Skalierung, Versatz nach hinten)
const FIT = { box: { s: 1, dz: 0 }, round: { s: 0.9, dz: 0 }, hex: { s: 0.92, dz: 0 }, heart: { s: 0.75, dz: -0.107 } };

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

/**
 * Atlas-Material: Kachel pro Instanz (aTile), LID = Deckel-Zeile. REPX: wie oft die Kachel
 * waagerecht wiederholt wird (runde/sechseckige Wände), immer innerhalb der eigenen Kachel.
 */
function atlasMaterial(map, rows, lid, repx = 1, extra = {}) {
  // Papier/Karton: matt mit leichtem Schimmer (PBR, Umgebungslicht aus scene.environment)
  const mat = new THREE.MeshStandardMaterial({ map, roughness: 0.66, metalness: 0, envMapIntensity: 0.55, ...extra });
  mat.defines = { PKG_LID: lid ? '1.0' : '0.0', PKG_ROWS: rows.toFixed(1), PKG_COLS: ATLAS_COLS.toFixed(1), PKG_REPX: repx.toFixed(1) };
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aTile;\nvarying vec2 vTileUv; varying vec2 vCell;')
      .replace('#include <uv_vertex>', `#include <uv_vertex>
        vTileUv = vec2(uv.x * PKG_REPX, uv.y);
        vCell = vec2(mod(aTile, PKG_COLS), floor(aTile / PKG_COLS) * 2.0 + (1.0 - PKG_LID));`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vTileUv; varying vec2 vCell;')
      .replace('#include <map_fragment>', `
        vec2 tuv = vec2(fract(vTileUv.x), clamp(vTileUv.y, 0.0, 1.0));
        vec2 auv = vec2((vCell.x + 0.03 + 0.94 * tuv.x) / PKG_COLS, 1.0 - (vCell.y + 1.0 - (0.03 + 0.94 * tuv.y)) / PKG_ROWS);
        diffuseColor *= texture2D(map, auv);`);
  };
  mat.customProgramCacheKey = () => 'pkgA' + lid + repx;
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

/** Herz-Umriss (Ursprung in der Bounding-Box-Mitte), Breite W. */
function heartPoints(W, n = 72) {
  const k = W / 32, pts = [];
  for (let i = 0; i < n; i++) {
    const t = i / n * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3, y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    pts.push(new THREE.Vector2(x * k, (y + 2.54) * k));
  }
  return pts;
}

/** Seidenpapier: zerknitterte Bäusche entlang der Innenwand (path(t) -> [x, z], t in 0..1). */
function tissueAlong(path, n, seed) {
  const parts = [];
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const g = crumple(10 + i);
    const [x, z] = path((i + 0.5) / n);
    // bleibt unter der Deckel-Unterkante (Deckel geschlossen bei h - lidOver)
    g.scale(0.05 + r() * 0.01, 0.04 + r() * 0.012, 0.05 + r() * 0.01).rotateY(r() * 3).translate(x, PKG.h - PKG.lidOver - 0.075 + r() * 0.01, z);
    parts.push(g);
  }
  const m = mergeGeometries(parts);
  m.computeVertexNormals();
  return m;
}
function boxPath(t) {
  const per = 2 * (PKG.w + PKG.d), s = t * per;
  const hw = PKG.w / 2 - PKG.wall - 0.078, hd = PKG.d / 2 - PKG.wall - 0.078;
  if (s < PKG.w) return [-hw + s / PKG.w * 2 * hw, hd];
  if (s < PKG.w + PKG.d) return [hw, hd - (s - PKG.w) / PKG.d * 2 * hd];
  if (s < 2 * PKG.w + PKG.d) return [hw - (s - PKG.w - PKG.d) / PKG.w * 2 * hw, -hd];
  return [-hw, -hd + (s - 2 * PKG.w - PKG.d) / PKG.d * 2 * hd];
}

function bowGeometry() {
  const loop = (a) => new THREE.TorusGeometry(0.075, 0.022, 8, 18).scale(1, 0.7, 1).rotateZ(a).translate(Math.cos(a) * 0.08, Math.sin(a) * 0.05 + 0.05, 0);
  const tail = (s) => new THREE.BoxGeometry(0.05, 0.012, 0.16).rotateY(s * 0.6).translate(s * 0.07, 0.006, 0.09);
  const knot = new THREE.SphereGeometry(0.035, 10, 8).scale(1, 0.8, 0.8).translate(0, 0.045, 0);
  const g = mergeGeometries([loop(0.35), loop(Math.PI - 0.35), knot, tail(1), tail(-1)].map((x) => x.toNonIndexed()));
  return g;
}

/**
 * Deckel mit abgerundeter Oberkante (statt harter Zylinderkante). Gruppen wie CylinderGeometry:
 * 0 = Rand (Lathe), 1 = Deckelfläche oben, 2 = unten -> gleiche Material-Arrays/Atlas-UVs.
 */
function roundedLid(R, H, segs, b = 0.014) {
  const prof = [[R, 0], [R, H - b], [R - b * 0.29, H - b * 0.29], [R - b, H]].map(([x, y]) => new THREE.Vector2(x, y));
  const side = new THREE.LatheGeometry(prof, segs);
  const top = new THREE.CircleGeometry(R - b, segs, Math.PI / 2).rotateX(-Math.PI / 2).translate(0, H, 0);
  const bottom = new THREE.CircleGeometry(R, segs, Math.PI / 2).rotateX(Math.PI / 2);
  const g = mergeGeometries([side.toNonIndexed(), top.toNonIndexed(), bottom.toNonIndexed()], true);
  return g;
}

/** Herz als offene Schachtel (Wand + Boden) bzw. Deckel; UVs planar (Deckel) und um den Umfang (Wand). */
function heartGeometries() {
  const { h, wall, lidH, lidPad } = PKG;
  const outer = heartPoints(HEART_W), inner = outer.map((p) => p.clone().multiplyScalar((HEART_W - 2 * wall * 1.6) / HEART_W));
  const sh = new THREE.Shape(outer); sh.holes.push(new THREE.Path(inner.slice().reverse()));
  const uvGen = {
    generateTopUV(g, v, a, b, c) { return [a, b, c].map((i) => new THREE.Vector2(v[i * 3] / HEART_W + 0.5, v[i * 3 + 1] / HEART_W + 0.5)); },
    generateSideWallUV(g, v, a, b, c, d) {
      return [a, b, c, d].map((i) => new THREE.Vector2((Math.atan2(v[i * 3 + 1], v[i * 3]) / 6.283 + 0.5) * 3, v[i * 3 + 2] / Math.max(h, 0.001)));
    },
  };
  const wallG = new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false, curveSegments: 1, UVGenerator: uvGen });
  const floor = new THREE.ShapeGeometry(new THREE.Shape(inner));
  const fuv = floor.attributes.uv, fp = floor.attributes.position;
  for (let i = 0; i < fuv.count; i++) fuv.setXY(i, fp.getX(i) / HEART_W + 0.5, fp.getY(i) / HEART_W + 0.5);
  floor.translate(0, 0, 0.004);
  const body = mergeGeometries([wallG.toNonIndexed(), floor.toNonIndexed()]).rotateX(-Math.PI / 2);
  const lidPts = outer.map((p) => p.clone().multiplyScalar((HEART_W + 2 * lidPad) / HEART_W));
  const lidG = new THREE.ExtrudeGeometry(new THREE.Shape(lidPts), { depth: lidH, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 1, UVGenerator: uvGen });
  lidG.translate(0, 0, 0.012); lidG.rotateX(-Math.PI / 2);
  body.computeVertexNormals();
  return { body, lid: lidG, tissue: tissueAlong((t) => { const p = inner[Math.floor(t * inner.length) % inner.length]; return [p.x * 0.85, -p.y * 0.85]; }, 30, 9) };
}

export class Packages {
  constructor(scene) {
    const { w, h, d, wall: t, lidH, lidPad, r: R } = PKG;
    this.types = PACKAGE_TYPES;
    const { tex: atlas, rows } = makePackageAtlas(this.types.map((x) => x.id));

    // ---- Formen-Familien: je Familie EIN InstancedMesh für Schachteln und EINS für Deckel ----
    const rb = (W, H, D, x, y, z) => new RoundedBoxGeometry(W, H, D, 2, 0.008).translate(x, y, z);
    const boxBody = mergeGeometries([
      rb(w, t, d, 0, t / 2, 0),
      rb(w, h, t, 0, h / 2, d / 2 - t / 2), rb(w, h, t, 0, h / 2, -d / 2 + t / 2),
      rb(t, h, d - 2 * t, w / 2 - t / 2, h / 2, 0), rb(t, h, d - 2 * t, -w / 2 + t / 2, h / 2, 0),
    ]);
    const boxLid = new RoundedBoxGeometry(w + 2 * lidPad, lidH, d + 2 * lidPad, 2, 0.02).translate(0, lidH / 2, 0);
    // runde Schachtel (Wand innen sichtbar, Boden) + Deckel mit Deckelfläche
    const cyl = (r, segs) => {
      const side = new THREE.CylinderGeometry(r, r, h, segs, 1, true).translate(0, h / 2, 0);
      const floor = new THREE.CircleGeometry(r * 0.99, segs, Math.PI / 2).rotateX(-Math.PI / 2).translate(0, 0.004, 0);   // Ecken wie die Wand (keine Zacken)
      const lid = roundedLid(r + lidPad, lidH, segs);
      return { body: mergeGeometries([side, floor], true), lid };
    };
    const round = cyl(R, 40), hex = cyl(HEX_R, 6);
    const heart = heartGeometries();
    const A = (lid, repx, extra) => atlasMaterial(atlas, rows, lid, repx, extra);
    const capB = A(false, 1, { side: THREE.DoubleSide }), capL = A(true, 1);
    const FAM = {
      box: { body: boxBody, lid: boxLid, mB: A(false, 1), mL: A(true, 1), foot: [w, d], tissue: tissueAlong(boxPath, 30, 3) },
      round: { body: round.body, lid: round.lid, mB: [A(false, 3, { side: THREE.DoubleSide }), capB], mL: [A(true, 3), capL, capL], foot: [2 * R, 2 * R],
        tissue: tissueAlong((t) => [Math.cos(t * 6.283) * (R - 0.08), Math.sin(t * 6.283) * (R - 0.08)], 26, 5) },
      hex: { body: hex.body, lid: hex.lid, mB: [A(false, 6, { side: THREE.DoubleSide }), capB], mL: [A(true, 6), capL, capL], foot: [2 * HEX_R, 2 * HEX_R * 0.87],
        tissue: tissueAlong((t) => [Math.cos(t * 6.283) * (HEX_R * 0.87 - 0.09), Math.sin(t * 6.283) * (HEX_R * 0.87 - 0.09)], 26, 7) },
      heart: { body: heart.body, lid: heart.lid, mB: A(false, 1, { side: THREE.DoubleSide }), mL: A(true, 1), foot: [HEART_W, HEART_W * 0.97], tissue: heart.tissue },
    };
    this.fams = FAM;
    for (const [key, f] of Object.entries(FAM)) {
      const members = this.types.filter((x) => x.shape === key);
      f.n = Math.max(1, members.length);
      f.body.setAttribute('aTile', new THREE.InstancedBufferAttribute(new Float32Array(f.n), 1));
      f.lid.setAttribute('aTile', new THREE.InstancedBufferAttribute(new Float32Array(f.n), 1));
      f.bodyMesh = new THREE.InstancedMesh(f.body, f.mB, f.n);
      f.lidMesh = new THREE.InstancedMesh(f.lid, f.mL, f.n);
      f.used = 0;
    }

    // Schleifen auf den Deckeln
    this.bowGeo = bowGeometry();
    this.bowMat = new THREE.MeshStandardMaterial({ roughness: 0.42, metalness: 0.05, envMapIntensity: 0.9 });   // Satinband
    const nBow = this.types.filter((x) => x.bow).length;
    this.bow = new THREE.InstancedMesh(this.bowGeo, this.bowMat, Math.max(1, nBow));
    this.bowOffset = new THREE.Matrix4().makeTranslation(0, lidH, 0);

    // Seidenpapier im offenen Päckchen (nur beim gewählten Päckchen sichtbar)
    this.tissue = new THREE.Mesh(FAM.box.tissue, new THREE.MeshLambertMaterial({ flatShading: true }));
    this.tissue.matrixAutoUpdate = false; this.tissue.visible = false;

    const blobMat = new THREE.MeshBasicMaterial({ map: makeBlobTexture(), transparent: true, depthWrite: false });
    this.blob = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), blobMat, N + 2);

    // Plätze: einige Sorten als Beispiel nebeneinander auf dem obersten Brett, die übrigen
    // starten (unsichtbar) in der Mitte des Bretts und fliegen von dort auf den Tisch.
    let wi = 0;
    const shelfIds = this.types.filter((x) => x.shelf);
    this.slots = this.types.map((ty, i) => {
      const f = FAM[ty.shape];
      const sl = { type: ty, fam: f, inst: f.used++, bow: -1, fit: FIT[ty.shape] };
      f.body.attributes.aTile.array[sl.inst] = i; f.lid.attributes.aTile.array[sl.inst] = i;
      if (ty.bow) { sl.bow = wi; this.bow.setColorAt(wi, new THREE.Color(ty.bow)); wi++; }
      return sl;
    });
    for (const f of Object.values(FAM)) {
      for (const m of [f.bodyMesh, f.lidMesh]) { for (let i = 0; i < m.count; i++) m.setMatrixAt(i, _zero); m.frustumCulled = false; scene.add(m); }
    }
    for (const m of [this.bow, this.blob]) {
      for (let i = 0; i < m.count; i++) m.setMatrixAt(i, _zero);
      m.frustumCulled = false;
      scene.add(m);
    }
    scene.add(this.tissue);
    // Deko-Inhalt folgt dem gewählten Päckchen (Schachtel-Raum) bzw. seinem Deckel
    this.content = new THREE.Group(); this.lidContent = new THREE.Group();
    for (const g of [this.content, this.lidContent]) { g.matrixAutoUpdate = false; g.visible = false; scene.add(g); }
    this.suppressBow = false;
    const ns = shelfIds.length;
    this.shelfSlot = this.types.map((ty) => shelfIds.indexOf(ty));
    this.home = this.types.map((ty, i) => {
      const k = this.shelfSlot[i];
      return new THREE.Vector3(CENTER_X + (k >= 0 ? (k - (ns - 1) / 2) * SPACING : 0), TOP_SHELF.y, SHELF_Z);
    });
    this.onShelf = new Uint8Array(N);
    this.ray = new THREE.Raycaster();
    this.bobSlot = -1;
    this.active = -1;
    this.thumbs = null;
    this.reset();
  }

  get count() { return N; }
  slotOf(id) { return this.types.findIndex((t) => t.id === id); }
  footprint(i) { return this.slots[i].fam.foot; }
  /** Wie die Seife in Päckchen i liegt: { s, dz }. */
  fit(i) { return this.slots[i].fit; }
  /** Eine Deko-Schleife ersetzt die Schleife der Päckchen-Sorte (am gewählten Päckchen). */
  setBowHidden(h) {
    this.suppressBow = h;
    const sl = this.slots[this.active];
    if (!sl || sl.bow < 0) return;
    if (h) this.bow.setMatrixAt(sl.bow, _zero);
    else { sl.fam.lidMesh.getMatrixAt(sl.inst, _m); this.bow.setMatrixAt(sl.bow, _m2.multiplyMatrices(_m, this.bowOffset)); }
    this.bow.instanceMatrix.needsUpdate = true;
  }
  /** Höhe der Deckel-Oberseite über der Deckel-Unterkante. */
  lidTop(i) { return this.types[i].shape === 'heart' ? PKG.lidH + 0.024 : PKG.lidH; }

  /** Alle Päckchen (zu) zurück ins Regal. */
  reset() {
    this.setActive(-1);
    for (let i = 0; i < N; i++) {
      if (this.shelfSlot[i] < 0) { this.onShelf[i] = 0; this.hide(i); continue; }
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
    // Seidenpapier-Knäuel entfernt (wirkte wie Füllpapier, sah nicht gut aus) – Mesh bleibt unsichtbar
    this.tissue.visible = false;
    this.content.visible = this.lidContent.visible = i >= 0;
    if (i < 0) return;
    this.tissue.geometry = this.slots[i].fam.tissue;
    this.tissue.material.color.set(this.types[i].tissue || '#ffffff');
  }

  /** Schachtel i: Unterkante bei pos, Drehung um y, Skalierung. */
  setBody(i, pos, rotY, scale) {
    _q.setFromEuler(_e.set(0, rotY, 0));
    _m.compose(pos, _q, _s.set(scale, scale, scale));
    const sl = this.slots[i];
    sl.fam.bodyMesh.setMatrixAt(sl.inst, _m); sl.fam.bodyMesh.instanceMatrix.needsUpdate = true;
    if (i === this.active) {
      this.tissue.matrix.copy(_m); this.tissue.matrixWorldNeedsUpdate = true;
      this.content.matrix.copy(_m); this.content.matrixWorldNeedsUpdate = true;
    }
  }
  /** Deckel i: Unterkante bei pos, Drehung (x/z kippen beim Auf-/Zuklappen). */
  setLid(i, pos, rx, ry, rz, scale) {
    _q.setFromEuler(_e.set(rx, ry, rz));
    _m.compose(pos, _q, _s.set(scale, scale, scale));
    const sl = this.slots[i];
    sl.fam.lidMesh.setMatrixAt(sl.inst, _m); sl.fam.lidMesh.instanceMatrix.needsUpdate = true;
    if (sl.bow >= 0) {
      // eine Deko-Schleife ersetzt die Schleife der Päckchen-Sorte
      if (i === this.active && this.suppressBow) this.bow.setMatrixAt(sl.bow, _zero);
      else this.bow.setMatrixAt(sl.bow, _m2.multiplyMatrices(_m, this.bowOffset));
      this.bow.instanceMatrix.needsUpdate = true;
    }
    if (i === this.active) { this.lidContent.matrix.copy(_m); this.lidContent.matrixWorldNeedsUpdate = true; }
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
    const sl = this.slots[i], f = sl.fam;
    f.bodyMesh.setMatrixAt(sl.inst, _zero); f.lidMesh.setMatrixAt(sl.inst, _zero);
    if (sl.bow >= 0) this.bow.setMatrixAt(sl.bow, _zero);
    this.blob.setMatrixAt(i, _zero);
    f.bodyMesh.instanceMatrix.needsUpdate = f.lidMesh.instanceMatrix.needsUpdate = this.bow.instanceMatrix.needsUpdate = this.blob.instanceMatrix.needsUpdate = true;
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
      {
        const f = sl.fam, bg = f.body.clone(), lg = f.lid.clone();
        bg.setAttribute('aTile', new THREE.InstancedBufferAttribute(new Float32Array([this.slotOf(sl.type.id)]), 1));
        lg.setAttribute('aTile', new THREE.InstancedBufferAttribute(new Float32Array([this.slotOf(sl.type.id)]), 1));
        const b = new THREE.InstancedMesh(bg, f.mB, 1), l = new THREE.InstancedMesh(lg, f.mL, 1);
        b.setMatrixAt(0, _m.identity()); l.setMatrixAt(0, _m.makeTranslation(0, this.lidY, 0));
        const k = 0.95 / Math.max(f.foot[0], 0.95);
        g.scale.setScalar(k);
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
