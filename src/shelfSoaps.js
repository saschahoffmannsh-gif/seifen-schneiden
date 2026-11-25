// Rezept-Seifen auf dem mittleren Wandbrett: kleine, aufrecht stehende Seifenstücke (gleicher
// Look wie die große Seife: abgerundet, wachsig, eingeprägte Marke vorne). Antippen = Seife
// fliegt über die Schale. Billig: 3 InstancedMesh (Körper, Prägung, Kontaktschatten), Matrizen
// werden nur geschrieben, wenn sich etwas bewegt; Raycast nur beim Antippen.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { BLOCK, CUBE, BLOCK_BASE_Y, SOAP_RADIUS } from './config.js';
import { makeReliefTexture, RELIEF_SLOPE } from './relief.js';
import { makeBlobTexture } from './setting/textures.js';
import { MIDDLE_SHELF, SHELF_Z, WALL_Z } from './setting/wall.js';
import { makeFaceAtlas, hasMotif, ATLAS_COLS, ATLAS_ROWS } from './soapLooks.js';

const MAX = 4;
const SPARE_SHOWN = 4;                // so viele Ersatzstücke je Sorte werden hinter dem vordersten gezeigt
const BW = BLOCK.nx * CUBE, BH = BLOCK.ny * CUBE, BD = BLOCK.nz * CUBE; // große Seife
export const SHELF_SCALE = 0.42;                                       // Seife im Regal: 42 % (SS-14: groß genug zum Erkennen)
const FLY_TIME = 0.55;

// SS-14 Holzwerkstatt: lila Bogenregal auf dem mittleren Brett, vier Bogenfächer nebeneinander
// (höchstens 4 Sorten je Auftrag). Je Fach ein Holzsockel mit Tafel-Schild: Sortenname + Anzahl Stücke.
const NC = 4, COMP_W = 0.56, POST = 0.07, RAIL = 0.04, PLINTH_H = 0.1, RACK_H = 0.8;
const RACK_W = NC * COMP_W + (NC + 1) * POST;
const RACK_D = 0.35;
const FLOOR_Y = MIDDLE_SHELF.y + RAIL + PLINTH_H;           // Oberkante der Sockel: hier stehen die Seifen
const STAGGER_X = 0.036, STAGGER_Z = 0.03;                 // Ersatzstücke: gestaffelt nach hinten rechts
const compX = (c) => -RACK_W / 2 + POST + COMP_W / 2 + c * (COMP_W + POST);
const LABEL_W = 0.54, LABEL_H = 0.19, LCW = 512, LCH = 180;

/** Holzsockel + lila Bogenrahmen + dunkle Rückwand. Ein Draw-Call je Teil, keine Schatten-Maps. */
function buildRack(scene) {
  const y0 = MIDDLE_SHELF.y;
  const shape = new THREE.Shape();
  const R = 0.06, L = -RACK_W / 2, Rt = RACK_W / 2, T = RACK_H;
  shape.moveTo(L, 0); shape.lineTo(Rt, 0); shape.lineTo(Rt, T - R); shape.quadraticCurveTo(Rt, T, Rt - R, T);
  shape.lineTo(L + R, T); shape.quadraticCurveTo(L, T, L, T - R); shape.lineTo(L, 0);
  const archH = 0.15, sideTop = RACK_H - 0.08 - archH;
  for (let c = 0; c < NC; c++) {
    const x0 = compX(c) - COMP_W / 2, x1 = compX(c) + COMP_W / 2;
    const h = new THREE.Path();
    h.moveTo(x0, RAIL); h.lineTo(x1, RAIL); h.lineTo(x1, sideTop);
    h.absellipse(compX(c), sideTop, COMP_W / 2, archH, 0, Math.PI, false);
    h.lineTo(x0, RAIL);
    shape.holes.push(h);
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: RACK_D - 0.02, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.008, bevelSegments: 2, curveSegments: 14 });
  const lilac = new THREE.MeshStandardMaterial({ color: 0xa88bd4, roughness: 0.6, metalness: 0, envMapIntensity: 0.5 });
  const frame = new THREE.Mesh(geo, lilac);
  frame.position.set(0, y0, WALL_Z + 0.012);
  scene.add(frame);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(RACK_W - 0.02, RACK_H - 0.02), new THREE.MeshStandardMaterial({ color: 0x7a64a2, roughness: 0.85 }));
  back.position.set(0, y0 + RACK_H / 2, WALL_Z + 0.014);
  scene.add(back);
  const plinths = new THREE.InstancedMesh(new RoundedBoxGeometry(0.44, PLINTH_H, 0.28, 2, 0.012),
    new THREE.MeshStandardMaterial({ color: 0xcf9a5c, roughness: 0.62, envMapIntensity: 0.4 }), NC);
  for (let c = 0; c < NC; c++) plinths.setMatrixAt(c, _m.makeTranslation(compX(c), y0 + RAIL + PLINTH_H / 2, SHELF_Z + 0.01));
  scene.add(plinths);
  // Tafel-Schilder: eine Canvas-Textur (4 Zeilen), je Fach eine Fläche vorne am Sockel
  const cv = document.createElement('canvas'); cv.width = LCW; cv.height = LCH * NC;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true;
  const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  const labels = [];
  for (let c = 0; c < NC; c++) {
    const g = new THREE.PlaneGeometry(LABEL_W, LABEL_H), uv = g.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setY(k, (NC - 1 - c + uv.getY(k)) / NC);
    const m = new THREE.Mesh(g, mat);
    m.position.set(compX(c), y0 + 0.07, WALL_Z + RACK_D + 0.03);   // Tafel vorne am Fach, über Leiste und Sockel
    scene.add(m); labels.push(m);
  }
  return { cv, tex, labels, plinths };
}

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
    // Vorderseite zeigt den Seifen-Look (Muster/Motiv) aus einem Atlas: Kachel je Instanz (aTile),
    // aTile >= 100 = Motiv-Seife ohne Prägung. Weiterhin ein einziger Draw Call.
    const atlas = new THREE.CanvasTexture(makeFaceAtlas(r / CUBE));
    atlas.colorSpace = THREE.SRGBColorSpace; atlas.anisotropy = 4;
    faceMat.map = atlas;
    faceMat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aTile; varying float vNoRelief;')
        .replace('#include <uv_vertex>', `#include <uv_vertex>
          { float t = mod(aTile, 100.0); float c = mod(t, ${ATLAS_COLS}.0), rr = floor(t / ${ATLAS_COLS}.0);
            vMapUv = vec2((c + uv.x) / ${ATLAS_COLS}.0, (${ATLAS_ROWS - 1}.0 - rr + uv.y) / ${ATLAS_ROWS}.0);
            vNoRelief = aTile >= 99.5 ? 1.0 : 0.0; }`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vNoRelief;')
        .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n  if (vNoRelief > 0.5) normal = nonPerturbedNormal;');
    };
    const faceGeo = new THREE.PlaneGeometry(BW - 2 * r, BH - 2 * r);
    this.tile = new THREE.InstancedBufferAttribute(new Float32Array(MAX), 1);
    faceGeo.setAttribute('aTile', this.tile);
    this.face = new THREE.InstancedMesh(faceGeo, faceMat, MAX);
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
    this.count = new Int16Array(MAX).fill(-1);
    this.rack = buildRack(scene);
    this.drawLabels();
    document.fonts && document.fonts.load('600 64px Fredoka').then(() => this.drawLabels()).catch(() => {});
  }

  /** Fach für Platz i: Sorten mittig in die vier Bogenfächer verteilt. */
  comp(i) { return i + ((NC - Math.min(NC, this.soaps.length)) >> 1); }

  /** Tafel-Schilder neu malen (nur bei Änderung von Sorte/Anzahl). */
  drawLabels() {
    const { cv, tex } = this.rack, g = cv.getContext('2d');
    const bySlot = new Array(NC).fill(-1);
    for (let i = 0; i < this.soaps.length; i++) bySlot[this.comp(i)] = i;
    for (let c = 0; c < NC; c++) {
      const y = c * LCH, i = bySlot[c], soap = i >= 0 ? this.soaps[i] : null;
      this.rack.labels[c].visible = !!soap;                                    // leeres Fach: kein Schild, kein Sockel
      this.rack.plinths.setMatrixAt(c, soap ? _m.makeTranslation(compX(c), MIDDLE_SHELF.y + RAIL + PLINTH_H / 2, SHELF_Z + 0.01) : _zero);
      g.fillStyle = '#b07a44'; g.fillRect(0, y, LCW, LCH);                     // Holzrahmen
      g.fillStyle = '#2f3a33'; g.fillRect(9, y + 9, LCW - 18, LCH - 18);       // Tafel
      if (!soap) continue;
      const n = Math.max(0, this.count[i]);
      g.textBaseline = 'middle';
      g.fillStyle = n > 0 ? '#ffe9a8' : '#8d978f';
      g.font = '700 124px Fredoka, "DM Sans", sans-serif'; g.textAlign = 'right';
      const cnt = '×' + n; g.fillText(cnt, LCW - 20, y + LCH / 2 + 6);
      const cw = g.measureText(cnt).width;
      g.fillStyle = n > 0 ? '#fbf7ee' : '#9aa39c'; g.textAlign = 'left';
      let fs = 112; g.font = `600 ${fs}px Fredoka, "DM Sans", sans-serif`;
      const maxW = LCW - 20 - cw - 14 - 22;
      while (g.measureText(soap.name).width > maxW && fs > 36) { fs -= 2; g.font = `600 ${fs}px Fredoka, "DM Sans", sans-serif`; }
      g.fillText(soap.name, 22, y + LCH / 2 + 6);
    }
    tex.needsUpdate = true; this.rack.plinths.instanceMatrix.needsUpdate = true;
  }

  /** Anzahl Stücke (inkl. angeschnittenem) einer Sorte fürs Schild. */
  setCount(i, n) { if (this.count[i] !== n) { this.count[i] = n; this.drawLabels(); } }

  /** Rezept-Seifen ins Regal stellen (nur bei neuer Bestellung). */
  /** fracs[i]: Länge des Stücks (Anteil der Scheiben, angebrochene Stücke sind kürzer). */
  setSoaps(list, fracs = null) {
    this.soaps = list.slice(0, MAX);
    for (let i = 0; i < MAX; i++) this.frac[i] = fracs && fracs[i] != null ? Math.max(0.08, fracs[i]) : 1;
    this.spareN.fill(0); this.drawSpares();
    for (let i = 0; i < MAX; i++) this.count[i] = !this.soaps[i] ? -1 : fracs && fracs[i] === 0 ? 0 : 1;   // echte Anzahl kommt per setCount
    this.drawLabels();
    for (let i = 0; i < MAX; i++) {
      const soap = this.soaps[i];
      if (!soap || (fracs && fracs[i] === 0)) { this.hide(i); continue; }   // Sorte ganz aufgebraucht
      this.home[i].set(compX(this.comp(i)) - 0.055, FLOOR_Y + BH * SHELF_SCALE / 2, SHELF_Z);
      _c.setRGB(soap.base[0], soap.base[1], soap.base[2], THREE.SRGBColorSpace);
      this.body.setColorAt(i, _c); this.face.setColorAt(i, _c.set(1, 1, 1));
      this.tile.array[i] = soap.id + (hasMotif(soap) ? 100 : 0);
      this.place(i, this.home[i], SHELF_SCALE);
      _m.compose(_p.set(this.home[i].x, FLOOR_Y + 0.003, SHELF_Z), _q.identity(), _s.set(BW * SHELF_SCALE * 1.7, 1, BD * SHELF_SCALE * 2.6));
      this.blob.setMatrixAt(i, _m);
    }
    this.body.instanceColor.needsUpdate = true; this.face.instanceColor.needsUpdate = true; this.tile.needsUpdate = true;
    this.blob.instanceMatrix.needsUpdate = true;
  }

  /** n Ersatzstücke hinter Platz i (0 = keins). */
  setSpares(i, n) { this.spareN[i] = Math.min(SPARE_SHOWN, n); this.drawSpares(); }
  drawSpares() {
    for (let i = 0; i < MAX; i++) for (let k = 0; k < SPARE_SHOWN; k++) {
      const idx = i * SPARE_SHOWN + k, soap = this.soaps[i];
      if (!soap || k >= this.spareN[i]) { this.spare.setMatrixAt(idx, _zero); continue; }
      // gestaffelt nach hinten rechts, damit man die Stücke zählen kann
      _p.set(compX(this.comp(i)) - 0.055 + STAGGER_X * (k + 1), FLOOR_Y + BH * SHELF_SCALE / 2, SHELF_Z - STAGGER_Z * (k + 1));
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
    _m.compose(_p.set(this.home[i].x, FLOOR_Y + 0.003, SHELF_Z), _q.identity(), _s.set(BW * SHELF_SCALE * 1.7, 1, BD * SHELF_SCALE * 2.6));
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
