// Gezacktes Messer (einmalig erzeugte Geometrie). Bewegt wird nur die Gruppe (Position/Rotation).
import * as THREE from 'three';

export function createKnife() {
  const group = new THREE.Group();

  // Klinge: Umriss mit Zacken an der Unterkante, Spitze links
  const L = 0.62, H = 0.17, teeth = 18;
  const shape = new THREE.Shape();
  shape.moveTo(-L - 0.12, 0.1);           // Spitze
  shape.quadraticCurveTo(-L + 0.1, H + 0.02, -L + 0.3, H);
  shape.lineTo(L, H);
  shape.lineTo(L, 0);
  for (let t = 0; t < teeth; t++) {       // Sägezähne von rechts nach links
    const x0 = L - (t / teeth) * (2 * L);
    const x1 = L - ((t + 0.5) / teeth) * (2 * L);
    const x2 = L - ((t + 1) / teeth) * (2 * L);
    shape.lineTo(x1, -0.028);
    shape.lineTo(x2, 0);
    void x0;
  }
  shape.quadraticCurveTo(-L - 0.02, 0.02, -L - 0.12, 0.1);
  const bladeGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.012, bevelEnabled: false });
  bladeGeo.translate(0, 0, -0.006);
  const blade = new THREE.Mesh(bladeGeo, new THREE.MeshLambertMaterial({ color: 0xdfe5ea, emissive: 0x2a3036 }));
  group.add(blade);

  // heller Schliff-Streifen über den Zacken (Glanz-Andeutung ohne Env-Map)
  const shine = new THREE.Mesh(
    new THREE.PlaneGeometry(2 * L, 0.035),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }),
  );
  shine.position.set(0, 0.035, 0.0075);
  group.add(shine);

  // Griff
  const handle = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.11, 0.07),
    new THREE.MeshLambertMaterial({ color: 0x3b3f46 }),
  );
  handle.position.set(L + 0.23, H * 0.55, 0);
  group.add(handle);
  const bolster = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.13, 0.08),
    new THREE.MeshLambertMaterial({ color: 0xa9b1b8 }),
  );
  bolster.position.set(L + 0.02, H * 0.55, 0);
  group.add(bolster);

  return group;
}
