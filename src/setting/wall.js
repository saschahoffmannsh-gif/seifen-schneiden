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

  // Unteres Brett: nur Deko, gleichmäßig im Wechsel über die ganze Breite
  const RIBBONS = ['#c0392b', '#e8a0b4', '#d4af37', '#7fb8a4'];
  const deco = SHELVES[0];
  const STEP = 0.5;
  let k = 0;
  for (let x = deco.x - deco.w / 2 + 0.4; x <= deco.x + deco.w / 2 - 0.3; x += STEP, k++) {
    const kind = k % 4;
    if (kind === 0) dish(x, deco.y, 'pearls');
    else if (kind === 1) blossoms(x, deco.y);
    else if (kind === 2) dish(x, deco.y, 'flakes');
    else ribbon(x, deco.y, RIBBONS[(k >> 2) % RIBBONS.length]);
  }

  for (const b of [shades, blobs, brackets, fillings, corks, leaves, dishes, pearls]) b.build(group);
  return group;
}
