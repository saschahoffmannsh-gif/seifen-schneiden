// Glattes Kochmesser ohne Zacken (einmalig erzeugte Geometrie). Bewegt wird nur die Gruppe.
// Klinge aus poliertem Stahl (PBR, spiegelt die Umgebung), heller Schliff an der Schneide,
// Griff aus dunklem Holz mit Stahlnieten.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export function createKnife() {
  const group = new THREE.Group();

  // Klinge: gerade Schneide unten, zur Spitze (links) sanft ansteigend; Rücken oben gerade
  const L = 0.62, H = 0.17, tipX = -L - 0.12;
  const shape = new THREE.Shape();
  shape.moveTo(L, 0);
  shape.lineTo(-L + 0.18, 0);
  shape.quadraticCurveTo(-L - 0.06, 0.004, tipX, 0.075);            // Schneide biegt zur Spitze hoch
  shape.quadraticCurveTo(-L + 0.06, H + 0.004, -L + 0.3, H);        // Rücken fällt zur Spitze ab
  shape.lineTo(L, H);
  shape.lineTo(L, 0);
  const bladeGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.004, bevelSegments: 3, curveSegments: 24 });
  bladeGeo.translate(0, 0, -0.003);
  // Schliff: unten an der Schneide heller und glatter (Vertex-Farben, kein Extra-Mesh)
  const pos = bladeGeo.attributes.position, col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i), k = THREE.MathUtils.smoothstep(y, 0.022, 0.04);   // 0 = Schliff, 1 = Klingenfläche
    const v = 1.0 - 0.12 * k;
    col[i * 3] = v; col[i * 3 + 1] = v; col[i * 3 + 2] = v * 1.01;
  }
  bladeGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const steel = new THREE.MeshStandardMaterial({ color: 0xe6eaee, metalness: 1, roughness: 0.26, vertexColors: true, envMapIntensity: 1.15 });
  group.add(new THREE.Mesh(bladeGeo, steel));

  // Griff: dunkles Holz, weich abgerundet
  const wood = new THREE.MeshStandardMaterial({ color: 0x3a281d, metalness: 0, roughness: 0.5 });
  const handle = new THREE.Mesh(new RoundedBoxGeometry(0.44, 0.108, 0.07, 3, 0.032), wood);
  handle.position.set(L + 0.255, H * 0.55, 0);
  group.add(handle);
  // Kropf (Übergang Klinge -> Griff) aus Stahl
  const metal = new THREE.MeshStandardMaterial({ color: 0xd9dde1, metalness: 1, roughness: 0.3 });
  const bolster = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.13, 0.078, 2, 0.018), metal);
  bolster.position.set(L + 0.02, H * 0.55, 0);
  group.add(bolster);
  // drei Nieten
  const rivetGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.074, 16).rotateX(Math.PI / 2);
  for (const x of [0.1, 0.24, 0.38]) {
    const r = new THREE.Mesh(rivetGeo, metal);
    r.position.set(L + 0.03 + x, H * 0.55, 0);
    group.add(r);
  }
  return group;
}
