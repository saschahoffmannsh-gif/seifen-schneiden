// Hochwertigere Deko-Geometrien (einmal erzeugt, als InstancedMesh bzw. geteilt genutzt):
// Blüte mit gewölbten Blütenblättern + Mitte, Rosenknospe aus gedrehten Blättern, Lavendelzweig mit
// Knospen, einzelnes gewölbtes Rosenblatt, und eine echte Schleife (zwei Schlaufen, Knoten, zwei Enden)
// als Band-Fläche entlang einer Kurve. Farbverläufe über Vertex-Farben (Instanz-Farbe multipliziert).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const _c = new THREE.Color();

/** Färbt alle Vertices einer Geometrie: f(y01, r01, pos) -> [r,g,b]. */
function paint(geo, f) {
  const p = geo.attributes.position, n = p.count, col = new Float32Array(n * 3);
  geo.computeBoundingBox();
  const bb = geo.boundingBox, h = bb.max.y - bb.min.y || 1;
  for (let i = 0; i < n; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const c = f((y - bb.min.y) / h, Math.hypot(x, z), x, y, z);
    col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}
const rgb = (hex) => { _c.set(hex); return [_c.r, _c.g, _c.b]; };
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Ein Blütenblatt: Ellipse, die sich nach oben wölbt (Löffelform), Länge 1 entlang +x. */
function petalGeo(len = 1, wid = 0.42, cup = 0.22, lift = 0.25, segs = 8) {
  const g = new THREE.PlaneGeometry(len, wid, segs, 4).translate(len / 2, 0, 0).rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), t = x / len;
    const w = Math.sin(Math.PI * Math.min(1, t * 0.92 + 0.08)) * (t < 0.15 ? 0.5 + t * 3.3 : 1);   // schmale Basis, runde Spitze
    const zz = z * w;
    p.setZ(i, zz);
    p.setY(i, (zz / (wid / 2)) ** 2 * cup * wid + t * t * lift);   // Mulde quer + Spitze hebt sich
  }
  g.computeVertexNormals();
  return g;
}

/** Margerite/Vergissmeinnicht: Kranz aus gewölbten Blättern + gewölbte Mitte. Durchmesser ~1. */
export function flowerGeometry(petals = 10) {
  const parts = [];
  for (let k = 0; k < petals; k++) {
    const g = petalGeo(0.46, 0.17, 0.25, 0.12).translate(0.05, 0.02 + (k % 2) * 0.012, 0).rotateY(k / petals * Math.PI * 2);
    paint(g, (y, r) => mixc(rgb('#f3eee6'), [1, 1, 1], Math.min(1, r * 2.4)));
    parts.push(g);
  }
  const mid = new THREE.SphereGeometry(0.11, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.55, 1).translate(0, 0.03, 0);
  paint(mid, (y) => mixc(rgb('#e0a514'), rgb('#ffd84a'), y));
  parts.push(mid);
  for (const g of parts) { if (g.index) continue; }
  return mergeGeometries(parts.map((g) => g.index ? g.toNonIndexed() : g)).center();
}

/** Getrocknete Rosenknospe: spiralig gedrehte, nach innen gebogene Blätter. Höhe ~1. */
export function roseGeometry() {
  const parts = [];
  const n = 9;
  for (let k = 0; k < n; k++) {
    const t = k / n, rad = 0.12 + t * 0.32, h = 0.75 - t * 0.2;
    const g = new THREE.CylinderGeometry(rad, rad * 0.55, h, 10, 3, true, 0, Math.PI * (1.0 + t * 0.2));
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {   // Blattrand oben nach außen rollen
      const y = p.getY(i) / h + 0.5, x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z) || 1;
      const out = 1 + y * y * 0.25 * t;
      p.setX(i, x * out); p.setZ(i, z * out);
    }
    g.computeVertexNormals();
    g.rotateY(k * 2.4).translate(0, h / 2 + 0.1, 0);
    paint(g, (y) => mixc([0.55, 0.42, 0.45], [1, 1, 1], 0.35 + y * 0.65 - t * 0.2));
    parts.push(g.toNonIndexed());
  }
  const sepal = new THREE.ConeGeometry(0.2, 0.2, 7).rotateX(Math.PI).translate(0, 0.08, 0);
  paint(sepal, () => rgb('#5b6b3a'));
  parts.push(sepal.toNonIndexed());
  return mergeGeometries(parts).center();
}

/** Lavendelzweig: Stiel + viele kleine Knospen (Farben fest in den Vertices). Länge 1 entlang +x. */
export function sprigGeometry() {
  const parts = [];
  const stem = new THREE.CylinderGeometry(0.02, 0.026, 1, 6).rotateZ(Math.PI / 2).translate(0.5, 0, 0);
  paint(stem, () => rgb('#6f8a52'));
  parts.push(stem.toNonIndexed());
  const bud = new THREE.SphereGeometry(1, 6, 4);
  for (let k = 0; k < 26; k++) {
    const t = 0.45 + k / 26 * 0.53, a = k * 2.3, taper = 1 - (k / 26) * 0.35;
    const g = bud.clone().scale(0.06 * taper, 0.04 * taper, 0.04 * taper).rotateZ(0.5).rotateX(a)
      .translate(t, Math.cos(a) * 0.04 * taper, Math.sin(a) * 0.04 * taper);
    const tone = k % 3 ? '#8e6cc4' : '#a487d6';
    paint(g, () => rgb(k > 21 ? '#b9a2e3' : tone));
    parts.push(g.toNonIndexed());
  }
  return mergeGeometries(parts).translate(-0.5, 0, 0);
}

/** Einzelnes Rosenblatt (gewölbt, Rand heller). Durchmesser ~1. */
export function petalGeometry() {
  const g = petalGeo(1, 0.8, 0.12, 0.07, 10).translate(-0.5, 0, 0);
  paint(g, (y, r, x, yy, z) => mixc([0.78, 0.78, 0.78], [1, 1, 1], Math.min(1, Math.abs(z) * 2 + (x + 0.5) * 0.6)));
  return g;
}

/**
 * Band entlang einer Kurve (flache Fläche, Breite w, liegt quer zur Kurve in Richtung "side").
 * pts: Kurvenpunkte, side(t, tangent) -> Vector3 (Querrichtung).
 */
function bandAlong(curve, w, segs, sideOf, taper = (t) => 1) {
  const pos = [], idx = [];
  const T = new THREE.Vector3(), S = new THREE.Vector3(), P = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    curve.getPointAt(t, P); curve.getTangentAt(t, T);
    sideOf(t, T, S);
    const hw = w / 2 * taper(t);
    pos.push(P.x - S.x * hw, P.y - S.y * hw, P.z - S.z * hw, P.x + S.x * hw, P.y + S.y * hw, P.z + S.z * hw);
    if (i < segs) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  // uv für Muster-Texturen (Länge entlang u)
  const uv = []; for (let i = 0; i <= segs; i++) uv.push(i / segs * 4, 0, i / segs * 4, 1);
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

/**
 * Richtige Schleife (lokal, Knoten im Ursprung, liegt auf y=0): zwei aufgestellte Schlaufen nach links/rechts,
 * ein Knoten, zwei Enden mit leichtem Schwung nach vorne. w = Bandbreite, size = Schlaufenlänge.
 */
export function bowGeometry(w = 0.07, size = 0.17) {
  const parts = [];
  const Z = new THREE.Vector3(0, 0, 1);
  for (const s of [-1, 1]) {
    // Schlaufe: geschlossene Kurve vom Knoten hinaus, oben zurück
    // Schlaufe: Ellipse vom Knoten nach außen, schräg nach oben gestellt (~25°), leicht nach hinten
    const pts = [], L = size, H = size * 0.42;
    for (let i = 0; i <= 28; i++) {
      const a = i / 28 * Math.PI * 2;
      const ax = L * (0.5 - 0.5 * Math.cos(a));
      pts.push(new THREE.Vector3(s * ax, 0.02 + ax * 0.5 + (H / 2) * Math.sin(a), -ax * 0.18));
    }
    const curve = new THREE.CatmullRomCurve3(pts, false);
    // Band quer zur Schlaufe, leicht nach hinten gekippt, an Knoten schmaler (gerafft)
    parts.push(bandAlong(curve, w, 40, (t, T, S) => S.copy(Z).addScaledVector(T, -T.dot(Z)).normalize(), (t) => 0.55 + 0.45 * Math.sin(Math.PI * t)));
    // Ende (Bandende): vom Knoten schräg nach vorne unten, leicht gewellt
    const tail = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.012, 0), new THREE.Vector3(s * size * 0.25, 0.006, size * 0.45),
      new THREE.Vector3(s * size * 0.45, 0.012, size * 0.85), new THREE.Vector3(s * size * 0.62, 0.004, size * 1.2),
    ]);
    parts.push(bandAlong(tail, w * 0.9, 20, (t, T, S) => S.crossVectors(T, new THREE.Vector3(0, 1, 0)).normalize().multiplyScalar(-1).lerp(new THREE.Vector3(0, 1, 0), 0.25).normalize(), (t) => 0.7 + 0.3 * t));
  }
  const knot = new THREE.CylinderGeometry(w * 0.42, w * 0.42, w * 1.05, 12).rotateX(Math.PI / 2).scale(1, 0.75, 1).translate(0, w * 0.35, 0);
  const geos = parts.map((g) => g.toNonIndexed());
  const k2 = knot.toNonIndexed(); k2.deleteAttribute('uv'); k2.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(k2.attributes.position.count * 2), 2));
  geos.push(k2);
  for (const g of geos) if (!g.attributes.normal) g.computeVertexNormals();
  return mergeGeometries(geos);
}
