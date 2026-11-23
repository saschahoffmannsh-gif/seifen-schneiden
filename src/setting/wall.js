// Wand direkt an der hinteren Tischkante mit drei Holzbrettern als Ablagen:
//   oben   = Päckchen (siehe packages.js)
//   Mitte  = Seifen fürs aktuelle Rezept (siehe shelfSoaps.js)
//   unten  = Verpackungs-Deko (Blüten, Schälchen mit Perlen / Seifenflocken, Schleifenband)
//
// Alles ist echte 3D-Geometrie in der Hauptszene: gleiches Licht, gleiche Schärfe, gleiche
// Materialien wie Tisch und Schale ("aus einem Guss"). Billig gehalten:
//  * Texturen einmalig per Canvas, gemeinsam genutzte Materialien
//  * wiederholte Dinge (Blätter, Perlen, Schälchen, Konsolen, Schatten) als InstancedMesh
//    -> ein Draw-Call pro Sorte
//  * keine Shadow-Maps, nur weiche Fake-Schatten (Verlaufs-Texturen)
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { makePlasterTexture, makeBoardTexture, makeShadeTexture, makeBlobTexture, rng } from './textures.js';

export const WALL_Z = -1.75;          // Wand steht direkt hinter der Schale an der Tischkante
export const TABLE_Y = -0.07;         // Tischplatte
const WALL_W = 24, WALL_H = 7;
// Ablagen: Höhe der Oberkante, Breite, Mitte x. Die Höhen sind so gewählt, dass die Bretter aus der
// Spielkamera zwischen den Anzeigen sichtbar sind (knapp über dem Schalenrand, zwischen
// Fortschritt und Hinweis, rechts neben der Bestellung).
// Breite Bretter (14 Einheiten): reichen auch im Querformat über das ganze Bild.
const SHELVES = [
  { y: 0.6, w: 14.0, x: -0.4 },
  { y: 1.6, w: 14.0, x: -0.4 },
  { y: 2.5, w: 14.0, x: -0.4 },
];
export const MIDDLE_SHELF = SHELVES[1];   // Rezept-Seifen
export const TOP_SHELF = SHELVES[2];      // Päckchen
const K = 1.3;                        // Größe der Deko-Sachen
const SHELF_D = 0.36, SHELF_T = 0.07;
export const SHELF_Z = WALL_Z + SHELF_D * 0.5;  // Mitte der Bretttiefe
// Wandschrank mit Türen über dem obersten Brett: im Spiel ist nur der untere Teil zu sehen
export const CABINET = { x: -0.27, w: 2.9, bottom: 2.98, h: 1.7, d: 0.42 };
// Deko-Einstiege auf dem unteren Brett (sichtbarer Bereich): eine Sache je Deko-Gruppe
export const DECO_SPOTS = ['fuellung', 'perlen', 'flocken', 'blueten', 'baender', 'siegel', 'anhaenger', 'natur']
  .map((group, k) => ({ group, x: -1.62 + k * 0.42 }));
export const DECO_Y = 0.6;
export const SHELF_FRONT_Z = WALL_Z + SHELF_D + 0.005; // Vorderkante der Bretter

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();

/** Kleiner Helfer: sammelt Instanzen und baut daraus EIN InstancedMesh. */
function batch(geo, mat, { colors = false } = {}) {
  const items = [];
  return {
    add(x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0, color) { items.push([x, y, z, sx, sy, sz, rx, ry, rz, color]); },
    build(scene) {
      if (!items.length) return null;
      const mesh = new THREE.InstancedMesh(geo, mat, items.length);
      items.forEach(([x, y, z, sx, sy, sz, rx, ry, rz, color], i) => {
        _q.setFromEuler(_e.set(rx, ry, rz));
        mesh.setMatrixAt(i, _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz)));
        if (colors) mesh.setColorAt(i, _c.set(color || '#ffffff'));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
      scene.add(mesh);
      return mesh;
    },
  };
}

export function createKitchenWall(scene, { env, aniso = 1 }) {
  const group = new THREE.Group();
  scene.add(group);

  // ---------- Wand ----------
  const wallMat = new THREE.MeshLambertMaterial({ map: makePlasterTexture({ repeat: [WALL_W / 2.2, WALL_H / 2.2] }) });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(WALL_W, WALL_H), wallMat);
  wall.position.set(0, TABLE_Y + WALL_H / 2, WALL_Z);
  group.add(wall);

  // Fake-Schatten (gemeinsames Material): Wand/Tisch-Kante, unter den Brettern, hinter der Schale
  const shadeMat = new THREE.MeshBasicMaterial({ map: makeShadeTexture(), transparent: true, depthWrite: false });
  const blobMat = new THREE.MeshBasicMaterial({ map: makeBlobTexture(), transparent: true, depthWrite: false });
  const plane = new THREE.PlaneGeometry(1, 1);
  const shades = batch(plane, shadeMat);
  // dunkler Streifen unten an der Wand (Licht kommt schlecht in die Ecke) + Streifen auf dem Tisch
  shades.add(0, TABLE_Y + 0.22, WALL_Z + 0.003, WALL_W, 0.45, 1, 0, 0, Math.PI);
  shades.add(0, TABLE_Y + 0.002, WALL_Z + 0.16, WALL_W, 0.32, 1, -Math.PI / 2, 0, 0);
  for (const sh of SHELVES) shades.add(sh.x, sh.y - SHELF_T - 0.2, WALL_Z + 0.003, sh.w + 0.3, 0.42, 1);
  const blobs = batch(plane, blobMat);
  // weicher Schatten der Schale auf der Wand (Licht von vorne rechts oben)
  blobs.add(-0.35, 0.35, WALL_Z + 0.004, 3.4, 1.3, 1);

  // ---------- Ablagen: dicke Holzbretter auf Eisen-Konsolen ----------
  const boardTex = makeBoardTexture({ aniso });
  const boardMat = new THREE.MeshLambertMaterial({ map: boardTex });
  const iron = new THREE.MeshStandardMaterial({ color: 0x2d2622, metalness: 0.6, roughness: 0.55, envMap: env, envMapIntensity: 0.6 });
  const box = new THREE.BoxGeometry(1, 1, 1);
  const brackets = batch(box, iron);
  for (const sh of SHELVES) {
    const g = new RoundedBoxGeometry(sh.w, SHELF_T, SHELF_D, 2, 0.015);
    // Maserung entlang des Bretts: u-Koordinaten auf die Brettlänge skalieren
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * sh.w / 2.4);
    const b = new THREE.Mesh(g, boardMat);
    b.position.set(sh.x, sh.y - SHELF_T / 2, WALL_Z + SHELF_D / 2 + 0.005);
    group.add(b);
    // L-Konsolen: senkrechter Arm an der Wand + waagerechter Arm unter dem Brett + Strebe
    for (const bx of [sh.x - sh.w / 2 + 0.6, sh.x - 4.1, sh.x - 1.2, sh.x + 1.9, sh.x + 4.8, sh.x + sh.w / 2 - 0.6]) {
      brackets.add(bx, sh.y - SHELF_T - 0.13, WALL_Z + 0.015, 0.035, 0.26, 0.03);
      brackets.add(bx, sh.y - SHELF_T - 0.012, WALL_Z + SHELF_D * 0.42, 0.035, 0.024, SHELF_D * 0.8);
      brackets.add(bx, sh.y - SHELF_T - 0.09, WALL_Z + 0.1, 0.03, 0.022, 0.24, Math.PI / 4, 0, 0);
    }
  }

  // ---------- Wandschrank (Seifen-Vorrat): Korpus, Sockelleiste, zwei Türen mit Füllung, Messingknäufe ----------
  {
    const C = CABINET, cz = WALL_Z + C.d / 2;
    const darkWood = new THREE.MeshLambertMaterial({ map: boardTex, color: 0xb88a62 });
    const doorWood = new THREE.MeshLambertMaterial({ map: boardTex, color: 0xe0bb92 });
    const brass = new THREE.MeshStandardMaterial({ color: 0xc9a04a, metalness: 0.85, roughness: 0.32, envMap: env, envMapIntensity: 1.0 });
    const body = new THREE.Mesh(box, darkWood);
    body.scale.set(C.w, C.h, C.d); body.position.set(C.x, C.bottom + C.h / 2, cz);
    group.add(body);
    const ledge = new THREE.Mesh(new RoundedBoxGeometry(C.w + 0.1, 0.08, C.d + 0.06, 2, 0.02), darkWood);
    ledge.position.set(C.x, C.bottom + 0.02, cz + 0.02);
    group.add(ledge);
    const doors = batch(box, doorWood), panels = batch(box, darkWood), knobs = batch(new THREE.SphereGeometry(1, 16, 12), brass);
    const dw = C.w / 2 - 0.07, dh = C.h - 0.14, dz = WALL_Z + C.d + 0.022;
    for (const s of [-1, 1]) {
      const dx = C.x + s * (dw / 2 + 0.015);
      doors.add(dx, C.bottom + 0.07 + dh / 2, dz, dw, dh, 0.04);
      panels.add(dx, C.bottom + 0.07 + dh / 2 + 0.06, dz + 0.022, dw - 0.2, dh - 0.32, 0.012);   // abgesetzte Füllung
      knobs.add(C.x + s * 0.09, C.bottom + 0.26, dz + 0.045, 0.035, 0.035, 0.03);
      knobs.add(C.x + s * 0.09, C.bottom + 0.26, dz + 0.025, 0.016, 0.016, 0.03);
    }
    for (const b of [doors, panels, knobs]) b.build(group);
    shades.add(C.x, C.bottom - 0.12, WALL_Z + 0.003, C.w + 0.3, 0.34, 1);
  }

  // ---------- Verpackungs-Deko auf dem unteren Brett (für später freischaltbar, siehe decor.js) ----------
  const r = rng(21);
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 20);
  const fillings = batch(cyl, new THREE.MeshLambertMaterial(), { colors: true });
  const corks = batch(cyl, new THREE.MeshLambertMaterial({ color: 0xb08355 }));
  const leaves = batch(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshLambertMaterial(), { colors: true });
  const dishPts = [[0, 0], [0.8, 0], [0.97, 0.22], [1, 0.42], [0.93, 0.42], [0.84, 0.12], [0, 0.1]].map(([a, b]) => new THREE.Vector2(a, b));
  const dishes = batch(new THREE.LatheGeometry(dishPts, 20), new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0, envMap: env, envMapIntensity: 0.5 }), { colors: true });
  const pearls = batch(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshStandardMaterial({ roughness: 0.18, metalness: 0.15, envMap: env, envMapIntensity: 1.0 }), { colors: true });
  const shelfBlobs = blobs;
  const pick = (a) => a[(r() * a.length) | 0];
  const zMid = WALL_Z + SHELF_D * 0.5;

  /** Schälchen (Keramik) mit Inhalt: 'pearls' oder 'flakes'. */
  function dish(x, y, kind) {
    const R = 0.155 * K, H = 0.42 * R;
    dishes.add(x, y, zMid, R, R, R, 0, 0, 0, kind === 'pearls' ? '#e8e2d8' : '#c9d9e6');
    if (kind === 'pearls') {
      const PC = ['#fbf7f0', '#f6e9ea', '#efe6f7', '#fffaf0'];
      for (let i = 0; i < 40; i++) {
        const a = r() * 6.28, d = Math.sqrt(r()) * R * 0.72, pr = 0.019 + r() * 0.007;
        pearls.add(x + Math.cos(a) * d, y + H * 0.55 + pr * 0.6 + r() * 0.012 * (1 - d / R), zMid + Math.sin(a) * d, pr, pr, pr, 0, 0, 0, pick(PC));
      }
    } else {
      const FC = ['#f2789a', '#f6e0a0', '#b79be0', '#8fe3c5', '#fff6e6'];
      for (let i = 0; i < 34; i++) {
        const a = r() * 6.28, d = Math.sqrt(r()) * R * 0.75, fr = 0.022 + r() * 0.012;
        fillings.add(x + Math.cos(a) * d, y + H * 0.6 + r() * 0.02, zMid + Math.sin(a) * d, fr, 0.006, fr * 0.7, (r() - 0.5) * 0.9, r() * 3, (r() - 0.5) * 0.9, pick(FC));
      }
    }
    shelfBlobs.add(x, y + 0.002, zMid, R * 3, R * 3, 1, -Math.PI / 2, 0, 0);
  }
  /** Ein paar Deko-Blüten (5 Blütenblätter + Perlen-Mitte), liegen locker auf dem Brett. */
  function blossoms(x, y) {
    const COLS = [['#f7b6c8', '#f2d16b'], ['#fff3f0', '#f2c14e'], ['#d9c2f0', '#f6e0a0']];
    const spots = [[-0.1, 0.04, 0.085], [0.09, -0.05, 0.08], [0.0, 0.02, 0.07]];
    spots.forEach(([dx, dz, pr], k) => {
      const [pc, cc] = COLS[k % 3];
      const cx = x + dx * K, cz = zMid + dz * 0.8, cy = y + 0.014 + k * 0.014;
      for (let i = 0; i < 5; i++) {
        const a = i / 5 * 6.28 + k;
        leaves.add(cx + Math.cos(a) * pr * 0.7, cy, cz + Math.sin(a) * pr * 0.7, pr * 0.62, 0.014, pr * 0.42, 0.35, -a, 0, pc);
      }
      pearls.add(cx, cy + 0.008, cz, pr * 0.28, pr * 0.2, pr * 0.28, 0, 0, 0, cc);
    });
    shelfBlobs.add(x, y + 0.002, zMid, 0.5, 0.36, 1, -Math.PI / 2, 0, 0);
  }
  /** Rolle Schleifenband (Achse zur Kamera) mit kurzem Ende. */
  function ribbon(x, y, color) {
    const R = 0.075 * K, W = 0.09 * K;
    fillings.add(x, y + R, zMid, R, W, R, Math.PI / 2, 0, 0, color);
    corks.add(x, y + R, zMid, R * 0.42, W * 1.06, R * 0.42, Math.PI / 2, 0, 0);
    fillings.add(x + R * 0.55, y + 0.004, zMid + W * 0.5 + 0.035, 0.03, 0.004, 0.05, 0, 0.5, 0, color);
    shelfBlobs.add(x, y + 0.002, zMid, R * 3.4, R * 3, 1, -Math.PI / 2, 0, 0);
  }

  const blocks = batch(box, new THREE.MeshLambertMaterial(), { colors: true });
  /** Kistchen mit Holzwolle/Knisterpapier. */
  function crate(x, y) {
    const W = 0.26, D = 0.2, H = 0.1;
    blocks.add(x, y + 0.006, zMid, W, 0.012, D, 0, 0, 0, '#b98a58');
    for (const s of [-1, 1]) { blocks.add(x + s * W / 2, y + H / 2, zMid, 0.014, H, D, 0, 0, 0, '#c99a60'); blocks.add(x, y + H / 2, zMid + s * D / 2, W, H, 0.014, 0, 0, 0, '#d3a56c'); }
    for (let i = 0; i < 26; i++) fillings.add(x + (r() - 0.5) * W * 0.8, y + H * 0.75 + r() * 0.035, zMid + (r() - 0.5) * D * 0.8, 0.005, 0.09, 0.005, r() * 3, r() * 3, r() * 3, pick(['#e3c48f', '#d6b17a', '#f4a9bd']));
    shelfBlobs.add(x, y + 0.002, zMid, 0.45, 0.34, 1, -Math.PI / 2, 0, 0);
  }
  /** Sticker-Dose + Wachssiegel. */
  function sealTin(x, y) {
    fillings.add(x - 0.04, y + 0.03, zMid, 0.1, 0.06, 0.1, 0, 0, 0, '#9fbfbd');
    [['#fff6e8', -0.07, -0.02], ['#e2304d', -0.02, 0.03], ['#c9a173', -0.03, -0.04]].forEach(([c, dx, dz]) => fillings.add(x + dx, y + 0.062, zMid + dz, 0.035, 0.004, 0.035, 0.1, 0, 0.1, c));
    fillings.add(x + 0.1, y + 0.012, zMid + 0.06, 0.045, 0.024, 0.045, 0, 0, 0, '#a3162b');
    fillings.add(x + 0.1, y + 0.026, zMid + 0.06, 0.03, 0.01, 0.03, 0, 0, 0, '#a3162b');
    shelfBlobs.add(x, y + 0.002, zMid, 0.42, 0.3, 1, -Math.PI / 2, 0, 0);
  }
  /** Anhänger (Kraftpapier) mit Schnur, angelehnt. */
  function tags(x, y) {
    for (let i = 0; i < 3; i++) blocks.add(x - 0.06 + i * 0.06, y + 0.07, zMid - 0.04 + i * 0.02, 0.08, 0.13, 0.004, -0.25, (i - 1) * 0.3, (i - 1) * 0.12, i === 1 ? '#fffaf0' : '#c9a173');
    fillings.add(x, y + 0.006, zMid + 0.07, 0.04, 0.012, 0.04, 0, 0, 0, '#d9c7a8');
    shelfBlobs.add(x, y + 0.002, zMid, 0.38, 0.28, 1, -Math.PI / 2, 0, 0);
  }
  /** Naturdeko: Orangenscheibe, Zimtstangen, Zapfen. */
  function natur(x, y) {
    fillings.add(x - 0.07, y + 0.075, zMid, 0.075, 0.014, 0.075, Math.PI / 2 - 0.25, 0.3, 0, '#e47a1e');
    for (const dz of [-0.03, 0.0, 0.03]) fillings.add(x + 0.06, y + 0.018 + (dz === 0 ? 0.03 : 0), zMid + dz + 0.03, 0.017, 0.2, 0.017, 0, 0.4, Math.PI / 2, '#8a4a22');
    leaves.add(x + 0.1, y + 0.04, zMid - 0.07, 0.035, 0.045, 0.035, 0, 0, 0, '#7a4a26');
    shelfBlobs.add(x, y + 0.002, zMid, 0.45, 0.32, 1, -Math.PI / 2, 0, 0);
  }

  // Unteres Brett: im sichtbaren Bereich je Deko-Gruppe eine Sache (Antippen öffnet die Auswahl),
  // links und rechts davon (außerhalb des Bildes) die bisherige Deko-Reihe.
  const RIBBONS = ['#c0392b', '#e8a0b4', '#d4af37', '#7fb8a4'];
  const deco = SHELVES[0];
  for (const { group: gname, x } of DECO_SPOTS) {
    if (gname === 'fuellung') crate(x, deco.y);
    else if (gname === 'perlen') dish(x, deco.y, 'pearls');
    else if (gname === 'flocken') dish(x, deco.y, 'flakes');
    else if (gname === 'blueten') blossoms(x, deco.y);
    else if (gname === 'baender') ribbon(x, deco.y, RIBBONS[0]);
    else if (gname === 'siegel') sealTin(x, deco.y);
    else if (gname === 'anhaenger') tags(x, deco.y);
    else natur(x, deco.y);
  }
  let k = 0;
  for (let x = deco.x - deco.w / 2 + 0.4; x <= deco.x + deco.w / 2 - 0.3; x += 0.5, k++) {
    if (x > DECO_SPOTS[0].x - 0.45 && x < DECO_SPOTS[DECO_SPOTS.length - 1].x + 0.45) continue;
    const kind = k % 4;
    if (kind === 0) dish(x, deco.y, 'pearls');
    else if (kind === 1) blossoms(x, deco.y);
    else if (kind === 2) dish(x, deco.y, 'flakes');
    else ribbon(x, deco.y, RIBBONS[(k >> 2) % RIBBONS.length]);
  }

  for (const b of [shades, blobs, brackets, fillings, corks, leaves, dishes, pearls, blocks]) b.build(group);
  return group;
}
