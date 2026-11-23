// Wand direkt an der hinteren Tischkante mit drei Holzbrettern als Ablagen und ein paar
// rustikalen Sachen darauf (Seifenstücke, Gläser, kleine Pflanzen, Tuch).
//
// Alles ist echte 3D-Geometrie in der Hauptszene: gleiches Licht, gleiche Schärfe, gleiche
// Materialien wie Tisch und Schale ("aus einem Guss"). Billig gehalten:
//  * Texturen einmalig per Canvas, gemeinsam genutzte Materialien
//  * wiederholte Dinge (Seifenstücke, Blätter, Töpfe, Gläser, Konsolen, Schatten) als
//    InstancedMesh -> ein Draw-Call pro Sorte
//  * keine Shadow-Maps, nur weiche Fake-Schatten (Verlaufs-Texturen)
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { makePlasterTexture, makeBoardTexture, makeClothTexture, makeShadeTexture, makeBlobTexture, rng } from './textures.js';

export const WALL_Z = -1.75;          // Wand steht direkt hinter der Schale an der Tischkante
export const TABLE_Y = -0.07;         // Tischplatte
const WALL_W = 24, WALL_H = 7;
// Ablagen: Höhe der Oberkante, Breite, Mitte x. Die Höhen sind so gewählt, dass die Bretter aus der
// Spielkamera zwischen den Anzeigen sichtbar sind (knapp über dem Schalenrand, zwischen
// Fortschritt und Hinweis, rechts neben der Bestellung).
const SHELVES = [
  { y: 0.6, w: 9.0, x: -0.4 },
  { y: 1.6, w: 9.0, x: -0.4 },
  { y: 2.5, w: 9.0, x: -0.4 },
];
// mittleres Brett bleibt frei: dort stehen die Seifen fürs aktuelle Rezept (siehe shelfSoaps.js)
export const MIDDLE_SHELF = SHELVES[1];
const K = 1.3;                        // Größe der Deko-Sachen
const SHELF_D = 0.36, SHELF_T = 0.07;
export const SHELF_Z = WALL_Z + SHELF_D * 0.5;  // Mitte der Bretttiefe

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
    for (const bx of [sh.x - sh.w / 2 + 0.6, sh.x - 1.2, sh.x + 1.9, sh.x + sh.w / 2 - 0.6]) {
      brackets.add(bx, sh.y - SHELF_T - 0.13, WALL_Z + 0.015, 0.035, 0.26, 0.03);
      brackets.add(bx, sh.y - SHELF_T - 0.012, WALL_Z + SHELF_D * 0.42, 0.035, 0.024, SHELF_D * 0.8);
      brackets.add(bx, sh.y - SHELF_T - 0.09, WALL_Z + 0.1, 0.03, 0.022, 0.24, Math.PI / 4, 0, 0);
    }
  }

  // ---------- Sachen auf den Ablagen ----------
  const r = rng(21);
  const soapGeo = new RoundedBoxGeometry(1, 1, 1, 2, 0.22);
  const soapMat = new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0, envMap: env, envMapIntensity: 0.35 });
  const soaps = batch(soapGeo, soapMat, { colors: true });
  const twine = batch(box, new THREE.MeshLambertMaterial({ color: 0xc9a66b }));
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 20);
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xe3efe9, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.42, envMap: env, envMapIntensity: 0.9, depthWrite: false });
  const glasses = batch(cyl, glassMat);
  const fillings = batch(cyl, new THREE.MeshLambertMaterial(), { colors: true });
  const lids = batch(cyl, new THREE.MeshStandardMaterial({ color: 0xb7b0a4, metalness: 0.8, roughness: 0.35, envMap: env, envMapIntensity: 0.8 }));
  const corkMat = new THREE.MeshLambertMaterial({ color: 0xb08355 });
  const corks = batch(cyl, corkMat);
  const potGeo = new THREE.CylinderGeometry(1, 0.76, 1, 18);
  const pots = batch(potGeo, new THREE.MeshLambertMaterial({ color: 0xb8693f }));
  const leafGeo = new THREE.SphereGeometry(1, 10, 8);
  const leaves = batch(leafGeo, new THREE.MeshLambertMaterial(), { colors: true });
  const clothMat = new THREE.MeshLambertMaterial({ map: makeClothTexture('#b8453a') });
  const cloths = batch(new RoundedBoxGeometry(1, 1, 1, 2, 0.2), clothMat);
  const shelfBlobs = blobs;
  // Verpackungs-Deko (für später freischaltbar, siehe decor.js): Schälchen, Perlen, Blüten, Flocken, Band
  const dishPts = [[0, 0], [0.8, 0], [0.97, 0.22], [1, 0.42], [0.93, 0.42], [0.84, 0.12], [0, 0.1]].map(([a, b]) => new THREE.Vector2(a, b));
  const dishes = batch(new THREE.LatheGeometry(dishPts, 20), new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0, envMap: env, envMapIntensity: 0.5 }), { colors: true });
  const pearls = batch(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshStandardMaterial({ roughness: 0.18, metalness: 0.15, envMap: env, envMapIntensity: 1.0 }), { colors: true });

  const SOAP_COLORS = ['#f2789a', '#f6e0a0', '#b79be0', '#8fe3c5', '#f4c6a5', '#fff6e6'];
  const FILL = ['#e9d9b0', '#c58a4a', '#f2ecdc', '#d7a13a', '#8a3b2e', '#a5b86a', '#7a4a2a'];
  const GREENS = ['#5f8f4e', '#4e7d41', '#7aa35c', '#6b9450'];
  const pick = (a) => a[(r() * a.length) | 0];
  const zMid = WALL_Z + SHELF_D * 0.5;

  function soapStack(x, y, n = 2 + (r() * 2 | 0)) {
    const w = 0.24 * K, h = 0.075 * K, d = 0.16 * K;
    for (let i = 0; i < n; i++) soaps.add(x + (r() - 0.5) * 0.02, y + h / 2 + i * h, zMid, w, h * 0.96, d, 0, (r() - 0.5) * 0.2, 0, pick(SOAP_COLORS));
    twine.add(x, y + n * h / 2, zMid, 0.014, n * h + 0.004, d + 0.006);
    shelfBlobs.add(x, y + 0.002, zMid, w * 1.6, d * 1.9, 1, -Math.PI / 2, 0, 0);
    return w;
  }
  function jar(x, y, tall) {
    const rad = (tall ? 0.085 : 0.11) * K, h = (tall ? 0.34 : 0.22) * K, fill = 0.55 + r() * 0.35;
    fillings.add(x, y + h * fill / 2 + 0.005, zMid, rad * 0.9, h * fill, rad * 0.9, 0, 0, 0, pick(FILL));
    glasses.add(x, y + h / 2, zMid, rad, h, rad);
    (r() < 0.6 ? lids : corks).add(x, y + h + 0.018, zMid, rad * 1.04, 0.036, rad * 1.04);
    shelfBlobs.add(x, y + 0.002, zMid, rad * 3.2, rad * 3.2, 1, -Math.PI / 2, 0, 0);
    return rad * 2;
  }
  function plant(x, y, big) {
    const pr = (big ? 0.13 : 0.095) * K, ph = pr * 1.25;
    pots.add(x, y + ph / 2, zMid, pr, ph, pr);
    pots.add(x, y + ph, zMid, pr * 1.1, 0.035, pr * 1.1);
    // Blätter: flache, längliche Ellipsoide, rund um die Mitte nach außen geneigt
    const n = big ? 11 : 7;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.28 + r() * 0.4;
      const len = pr * (big ? 1.9 : 1.4) * (0.75 + r() * 0.45);
      const tilt = 0.2 + r() * 0.6;               // wie weit das Blatt nach außen kippt
      const cx = Math.sin(tilt) * len * 0.5, cy = Math.cos(tilt) * len * 0.5;
      _e.set(0, 0, 0);
      leaves.add(x + Math.cos(a) * cx, y + ph + cy * 0.95, zMid + Math.sin(a) * cx,
        len * 0.32, len * 0.5, len * 0.09,
        Math.sin(a) * tilt, -a + Math.PI / 2, -Math.cos(a) * tilt, pick(GREENS));
    }
    shelfBlobs.add(x, y + 0.002, zMid, pr * 3.2, pr * 3.2, 1, -Math.PI / 2, 0, 0);
    return pr * 2.2;
  }
  function cloth(x, y) {
    const w = 0.32 * K, h = 0.045 * K;
    for (let i = 0; i < 3; i++) cloths.add(x + (r() - 0.5) * 0.03, y + h / 2 + i * h, zMid, w, h * 0.95, 0.24 * K, 0, (r() - 0.5) * 0.12, 0);
    shelfBlobs.add(x, y + 0.002, zMid, w * 1.5, 0.4, 1, -Math.PI / 2, 0, 0);
    return w;
  }

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
    return R * 2;
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
        leaves.add(cx + Math.cos(a) * pr * 0.75, cy, cz + Math.sin(a) * pr * 0.75, pr * 0.62, 0.014, pr * 0.42, 0.35, -a, 0, pc);
      }
      pearls.add(cx, cy + 0.008, cz, pr * 0.28, pr * 0.2, pr * 0.28, 0, 0, 0, cc);
    });
    shelfBlobs.add(x, y + 0.002, zMid, 0.5, 0.36, 1, -Math.PI / 2, 0, 0);
    return 0.3 * K;
  }
  /** Rolle Schleifenband (liegend) mit kurzem Ende. */
  function ribbon(x, y) {
    const R = 0.075 * K, W = 0.09 * K;
    // Achse zur Kamera: man sieht die runde Seite der Rolle
    fillings.add(x, y + R, zMid, R, W, R, Math.PI / 2, 0, 0, '#c0392b');
    corks.add(x, y + R, zMid, R * 0.42, W * 1.06, R * 0.42, Math.PI / 2, 0, 0);
    fillings.add(x + R * 0.55, y + 0.004, zMid + W * 0.5 + 0.035, 0.03, 0.004, 0.05, 0, 0.5, 0, '#c0392b');
    shelfBlobs.add(x, y + 0.002, zMid, R * 3.4, R * 3, 1, -Math.PI / 2, 0, 0);
    return R * 2;
  }

  // Von links nach rechts locker aufreihen (Breite kommt vom jeweiligen Ding zurück)
  const S = soapStack, J = jar, P = plant, C = cloth, D = dish, B = blossoms, R = ribbon;
  // aufgeräumt: gleichmäßige Abstände, im sichtbaren Mittelteil Verpackungs-Deko
  const rows = [
    [[P, 1], [J, 1], [S, 3], [J, 0], [C], [P, 0], [J, 1], [S, 2], [D, 'pearls'], [B], [D, 'flakes'], [R], [J, 1], [S, 3], [P, 1], [C]],
    [],   // mittleres Brett: frei für die Rezept-Seifen und Päckchen
    [[S, 2], [J, 1], [P, 1], [C], [J, 0], [S, 3], [P, 0], [J, 1], [D, 'flakes'], [S, 2], [B], [P, 1], [D, 'pearls'], [J, 0], [R], [S, 3]],
  ];
  const halfOf = (f, arg) => f === soapStack ? 0.16 * K : f === jar ? (arg ? 0.085 : 0.11) * K : f === plant ? (arg ? 0.15 : 0.11) * K
    : f === dish ? 0.155 * K : f === blossoms ? 0.16 * K : f === ribbon ? 0.08 * K : 0.17 * K;
  rows.forEach((row, ri) => {
    const sh = SHELVES[ri];
    let x = sh.x - sh.w / 2 + 0.3 + ri * 0.1;
    for (const it of row) {
      const [f, arg] = it;
      const half = halfOf(f, arg);
      x += half;
      if (f === soapStack || f === dish) f(x, sh.y, arg); else if (f === cloth || f === blossoms || f === ribbon) f(x, sh.y); else f(x, sh.y, !!arg);
      x += half + 0.15;
    }
  });

  for (const b of [shades, blobs, brackets, soaps, twine, fillings, glasses, lids, corks, pots, leaves, cloths, dishes, pearls]) b.build(group);
  return group;
}
