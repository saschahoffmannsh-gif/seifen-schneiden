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
const SPARE_SHOWN = 2;                // SS-17: so viele Ersatzstücke je Sorte liegen UNTER dem obersten (Stapel max. 3, Schild zeigt die echte Anzahl)
const BW = BLOCK.nx * CUBE, BH = BLOCK.ny * CUBE, BD = BLOCK.nz * CUBE; // große Seife
export const SHELF_SCALE = 0.42;                                       // Seife im Regal: 42 % (SS-14: groß genug zum Erkennen)
const FLY_TIME = 0.55;

// SS-14 Holzwerkstatt: lila Bogenregal auf dem mittleren Brett, vier Bogenfächer nebeneinander
// (höchstens 4 Sorten je Auftrag). Je Fach ein Holzsockel mit Tafel-Schild: Sortenname + Anzahl Stücke.
const NC = 4, COMP_W = 0.56, POST = 0.07, RAIL = 0.04, PLINTH_H = 0.1, RACK_H = 0.8;
const RACK_W = NC * COMP_W + (NC + 1) * POST;
const RACK_D = 0.35;
const FLOOR_Y = MIDDLE_SHELF.y + RAIL + PLINTH_H;           // Oberkante der Sockel: hier stehen die Seifen
// SS-18: Seifen liegen im Fach auf dem Rücken (um x gekippt: Motiv-Seite oben, nicht seitlich gedreht), mehrere flach
// übereinander gestapelt. Liegend: Breite BW (x), Tiefe BH (z), Höhe BD (y) je Stück.
const LIE = -Math.PI / 2, STACK_MAX_H = 0.54;               // Stapelhöhe passt unter den Bogen
const LIE_SCALE = 0.36;                                     // liegend: so tief, dass das Stück ins Fach passt (BH * 0.36 = 0.43)
const LIE_Z = WALL_Z + 0.03 + BH * LIE_SCALE / 2;           // hinten an der Rückwand anliegend
const STACK_JIT = [0, 0.018, -0.014];                       // leicht versetzt gestapelt (natürlicher, Stücke zählbar)
const _qz = new THREE.Quaternion(), _lieAxis = new THREE.Vector3(1, 0, 0);
/** Skalierung eines Stapels aus n liegenden Stücken (passt in Tiefe und unter den Bogen). */
const stackScale = (n) => Math.min(LIE_SCALE, STACK_MAX_H / (n * BD));
const compX = (c) => -RACK_W / 2 + POST + COMP_W / 2 + c * (COMP_W + POST);
const LABEL_W = 0.54, LABEL_H = 0.19, LCW = 512, LCH = 180;

/** Holzsockel + lila Bogenrahmen + dunkle Rückwand. Ein Draw-Call je Teil, keine Schatten-Maps. */
function buildRack(scene) {
  // SS-19: kein Bogenregal mehr in der Küche (Schrank ist die Menü-Kachel). Nur Pack-Deko auf dem mittleren Brett.
  return { cv: null, tex: null, labels: [], plinths: null, deco: buildStationDeco(scene) };
}

function buildStationDeco(scene) {
  const g = new THREE.Group(); g.visible = false; scene.add(g);
  const z = SHELF_Z + 0.02, y0 = MIDDLE_SHELF.y;
  const wood = new THREE.MeshStandardMaterial({ color: 0xd9aa6e, roughness: 0.6 });
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x9a6338, roughness: 0.55 });
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 28);
  const mat = (c, r = 0.5) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
  const add = (geo, m, x, y, zz, sx, sy, sz, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, zz); o.scale.set(sx, sy, sz); o.rotation.set(rx, ry, rz); g.add(o); return o; };
  // Bandspule: Band (Zylinder, Achse quer) zwischen zwei Holzscheiben
  const spool = (x, color, ry = 0) => {
    const R = 0.1, W = 0.065, y = y0 + R + 0.012;
    add(cyl, mat(color, 0.35), x, y, z, R * 0.9, W, R * 0.9, 0, ry, Math.PI / 2);
    for (const s of [-1, 1]) add(cyl, wood, x + Math.cos(ry) * s * (W / 2 + 0.006), y, z - Math.sin(ry) * s * (W / 2 + 0.006), R + 0.012, 0.012, R + 0.012, 0, ry, Math.PI / 2);
  };
  const cx0 = -1.05, cx1 = -0.35, cx2 = 0.36, cx3 = 1.08;
  spool(cx0 - 0.15, '#f29bb8', 0.15); spool(cx0 - 0.05, '#c9a6ee', 0.1); spool(cx0 + 0.05, '#e8e27a', 0.05); spool(cx0 + 0.15, '#f6c38f', 0);
  spool(cx1 - 0.1, '#e0475c', -0.1); spool(cx1, '#58b878', -0.05); spool(cx1 + 0.1, '#7fb6e6', 0);
  // Geschenkpapierrollen (stehend), Muster per Canvas
  const paper = (bg, dots, kind) => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 256; const x = c.getContext('2d');
    x.fillStyle = bg; x.fillRect(0, 0, 128, 256);
    for (let i = 0; i < 60; i++) {
      const px = (i * 37) % 128, py = (i * 53) % 256; x.fillStyle = dots[i % dots.length];
      if (kind === 'flower') { for (let k = 0; k < 5; k++) { x.beginPath(); x.arc(px + Math.cos(k * 1.256) * 5, py + Math.sin(k * 1.256) * 5, 3.5, 0, 7); x.fill(); } }
      else if (kind === 'stripe') { x.fillRect(0, (i * 18) % 256, 128, 6); }
      else { x.beginPath(); x.arc(px, py, 4, 0, 7); x.fill(); }
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 });
  };
  const rolls = [[-0.13, '#f7b6c9', ['#ffffff', '#e8679a'], 'flower', 0.46], [0, '#bfe0f5', ['#ffffff', '#f6c1d0', '#8fc7a3'], 'flower', 0.5], [0.13, '#fff1d6', ['#e9a8c4', '#c9a6ee'], 'stripe', 0.42]];
  for (const [dx, bg, dots, kind, h] of rolls) add(cyl, paper(bg, dots, kind), cx2 + dx, y0 + h / 2, z, 0.05, h, 0.05);
  // Washi-Tape-Rolle liegend + Holzstempel
  add(cyl, mat('#f2b37c', 0.5), cx3 - 0.12, y0 + 0.11, z + 0.02, 0.1, 0.09, 0.1, Math.PI / 2, 0.25, 0);
  add(cyl, mat('#fffaf0', 0.8), cx3 - 0.12, y0 + 0.11, z + 0.02, 0.06, 0.092, 0.06, Math.PI / 2, 0.25, 0);
  add(new RoundedBoxGeometry(1, 1, 1, 2, 0.1), wood, cx3 + 0.1, y0 + 0.03, z, 0.17, 0.06, 0.13);
  add(cyl, darkWood, cx3 + 0.1, y0 + 0.11, z, 0.025, 0.11, 0.025);
  add(new THREE.SphereGeometry(1, 18, 12), darkWood, cx3 + 0.1, y0 + 0.19, z, 0.045, 0.04, 0.045);
  return g;
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
    this.hs = new Float32Array(MAX).fill(SHELF_SCALE);   // Skalierung je Fach (hohe Stapel etwas kleiner)
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

  /** SS-15 Geschenktheke: statt der Rezept-Seifen liegen Bänder, Papier und Stempel im Regal. */
  setStation(on) {
    this.stationOn = on;
    for (const m of [this.body, this.face, this.blob, this.spare]) m.visible = !on;
    this.rack.deco.visible = on;
    this.drawLabels();
  }

  /** Fach für Platz i: Sorten mittig in die vier Bogenfächer verteilt. */
  comp(i) { return i + ((NC - Math.min(NC, this.soaps.length)) >> 1); }

  /** Tafel-Schilder neu malen (nur bei Änderung von Sorte/Anzahl). */
  drawLabels() { if (!this.rack || !this.rack.cv) return;
    const { cv, tex } = this.rack, g = cv.getContext('2d');
    const bySlot = new Array(NC).fill(-1);
    for (let i = 0; i < this.soaps.length; i++) bySlot[this.comp(i)] = i;
    for (let c = 0; c < NC; c++) {
      const y = c * LCH, i = bySlot[c], soap = i >= 0 ? this.soaps[i] : null;
      this.rack.labels[c].visible = !!soap && !this.stationOn;               // leeres Fach: kein Schild, kein Sockel
      this.rack.plinths.setMatrixAt(c, soap || this.stationOn ? _m.makeTranslation(compX(c), MIDDLE_SHELF.y + RAIL + PLINTH_H / 2, SHELF_Z + 0.01) : _zero);
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
    this.spareN.fill(0); this.drawSpares();   // Stapel kommen danach per setSpares
    for (let i = 0; i < MAX; i++) this.count[i] = !this.soaps[i] ? -1 : fracs && fracs[i] === 0 ? 0 : 1;   // echte Anzahl kommt per setCount
    this.drawLabels();
    for (let i = 0; i < MAX; i++) {
      const soap = this.soaps[i];
      if (!soap || (fracs && fracs[i] === 0)) { this.hide(i); continue; }   // Sorte ganz aufgebraucht
      this.layoutHome(i);
      _c.setRGB(soap.base[0], soap.base[1], soap.base[2], THREE.SRGBColorSpace);
      this.body.setColorAt(i, _c); this.face.setColorAt(i, _c.set(1, 1, 1));
      this.tile.array[i] = soap.id + (hasMotif(soap) ? 100 : 0);
      this.hide(i);
    }
    this.body.instanceColor.needsUpdate = true; this.face.instanceColor.needsUpdate = true; this.tile.needsUpdate = true;
    this.blob.instanceMatrix.needsUpdate = true;
  }

  /** Stapel in Fach i: Skalierung (passt unter den Bogen) und Lage des obersten Stücks (das fliegt). */
  layoutHome(i) {
    this.hs[i] = 0.85;
    this.home[i].set(0, 2.35, 0.12);                        // SS-19: kommt von oben, nicht vom Regal
  }
  setBlobAt(i) {
    const k = this.hs[i];
    _m.compose(_p.set(compX(this.comp(i)), FLOOR_Y + 0.003, LIE_Z), _q.identity(), _s.set(BW * k * 1.5, 1, BH * k * 1.35));
    this.blob.setMatrixAt(i, _m);
  }

  /** n Ersatzstücke UNTER dem obersten Stück in Fach i (0 = keins). */
  setSpares(i, n) {
    n = Math.min(SPARE_SHOWN, n);
    if (this.spareN[i] === n) return;
    this.spareN[i] = n; this.drawSpares();
    if (!this.soaps[i]) return;
    this.layoutHome(i);
    /* Stapel nicht mehr sichtbar in der Küche */
  }
  drawSpares() {
    for (let i = 0; i < MAX * SPARE_SHOWN; i++) this.spare.setMatrixAt(i, _zero);
    this.spare.instanceMatrix.needsUpdate = true;
  }

  /** lie: 1 = liegend (im Regal), 0 = aufrecht (über der Schale); dazwischen beim Flug. */
  place(i, pos, scale, rotX = 0, lie = 0) {
    if (rotX) _q.setFromAxisAngle(_xAxis, rotX); else _q.identity();
    if (lie) _q.multiply(_qz.setFromAxisAngle(_lieAxis, LIE * lie));
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
    if (i >= 0) this.hide(i);
  }
  /** Position auf der Flugbahn Regal (e=0) -> über der Schale (e=1). */
  flyPose(i, t) {
    const e = t * t * (3 - 2 * t), h = this.home[i];
    const back = i === this.back, f = back ? this.backFrom : _to.set(0, BLOCK_BASE_Y + BH / 2, 0);
    _p.set(h.x + (f.x - h.x) * e, h.y + (f.y - h.y) * e + Math.sin(t * Math.PI) * 0.45, h.z + (f.z - h.z) * e);
    this.place(i, _p, this.hs[i] + (1 - this.hs[i]) * e, back ? this.backAng * (1 - e) : 0, 0);
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
      if (this.bobSlot >= 0 && this.bobSlot !== this.fly && this.bobSlot !== this.back && this.soaps[this.bobSlot] && this.isShown(this.bobSlot)) this.place(this.bobSlot, this.home[this.bobSlot], this.hs[this.bobSlot]);
      this.bobSlot = bobSlot;
    }
    if (bobSlot >= 0 && bobSlot !== this.fly && bobSlot !== this.back) {
      const hop = Math.max(0, Math.sin(time * 5)) * 0.035 * (Math.sin(time * 2.5) > 0 ? 1 : 0);
      _p.copy(this.home[bobSlot]); _p.y += hop;
      this.place(bobSlot, _p, this.hs[bobSlot]);
    }
  }

  isShown(i) { this.body.getMatrixAt(i, _m); return _m.elements[0] !== 0; }
}
