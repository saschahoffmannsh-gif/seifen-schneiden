// Hochwertigere Deko-Geometrien (einmal erzeugt, als InstancedMesh bzw. geteilt genutzt):
// echte Blüten (Margerite, Vergissmeinnicht, Kirschblüte, Gerbera, Hortensie, Pfingstrose, Ranunkel,
// Rosenknospe) aus geformten Blütenblättern, und eine echte Schleife (zwei Schlaufen, Knoten, zwei Enden)
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

/**
 * Blütenblatt (liegt flach entlang +x, Länge len): schmale Basis, runde/eingekerbte/spitze Spitze,
 * quer gemuldet (cup), zur Spitze gehoben (lift) bzw. eingerollt (curl), Rand gewellt (ruffle).
 * col(t, zn) -> Farbe (t = 0 Basis .. 1 Spitze, zn = -1..1 quer).
 */
function bladePetal({ len = 1, wid = 0.4, cup = 0.2, lift = 0.1, curl = 0, notch = 0, point = 0, ruffle = 0, sx = 12, sz = 8, col }) {
  const g = new THREE.PlaneGeometry(1, 1, sx, sz).translate(0.5, 0, 0).rotateX(-Math.PI / 2);
  const p = g.attributes.position, n = p.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const t = p.getX(i), zn = p.getZ(i) * 2;                     // 0..1, -1..1
    // Breite: schmale Basis, bauchig, zur Spitze rund (point -> spitz)
    const base = 0.28 + 0.72 * THREE.MathUtils.smoothstep(t, 0, 0.35);
    const round = Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, t - 0.45) / 0.55, 2 + point * 2)));
    const w = wid / 2 * base * (round * (1 - point) + Math.sin(Math.PI * Math.min(1, t)) * point);
    const z = zn * w;
    const x = t * len - notch * len * Math.pow(1 - Math.abs(zn), 2.5) * THREE.MathUtils.smoothstep(t, 0.75, 1);
    const y = zn * zn * cup * wid + lift * t * t * len - curl * Math.pow(THREE.MathUtils.smoothstep(t, 0.55, 1), 2) * len
      + ruffle * wid * Math.sin(zn * 4.2 + t * 3) * t * t;
    p.setXYZ(i, x, y, z);
    const k = col(t, zn); c[i * 3] = k[0]; c[i * 3 + 1] = k[1]; c[i * 3 + 2] = k[2];
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  g.computeVertexNormals();
  return g.toNonIndexed();
}

/**
 * Blüte aus Kränzen von Blütenblättern + Mitte (+ Staubgefäße). Durchmesser ~1, Mitte im Ursprung.
 * rings: { n, len, wid, cup, lift, curl, notch, point, ruffle, tilt, r0, y, phase, col }
 */
function blossom({ rings, center, stamens }) {
  const parts = [];
  for (const R of rings) {
    for (let k = 0; k < R.n; k++) {
      const jit = 1 + Math.sin(k * 12.9898 + R.n) * 0.06;     // leicht ungleich, wie echt
      const g = bladePetal({ ...R, len: R.len * jit });
      g.rotateZ(R.tilt || 0).translate(R.r0 || 0, (R.y || 0) + (k % 2) * 0.004, 0).rotateY((k + (R.phase || 0)) / R.n * Math.PI * 2);
      parts.push(g);
    }
  }
  if (center) {
    const { r, h, y = 0.02, col } = center;
    const m = new THREE.SphereGeometry(r, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, h / r, 1).translate(0, y, 0);
    paint(m, (yy, rr) => col(Math.min(1, rr / r)));
    parts.push(m.toNonIndexed());
  }
  if (stamens) {
    const { n, len, r0 = 0.02, spread = 0.35, stalk, tip } = stamens;
    const st = new THREE.CylinderGeometry(0.005, 0.006, 1, 4).translate(0, 0.5, 0), an = new THREE.SphereGeometry(1, 6, 4);
    const Z = new THREE.Vector3(0, 0, 1), Y = new THREE.Vector3(0, 1, 0);
    for (let k = 0; k < n; k++) {
      const a = k * 2.399, l = len * (0.8 + 0.2 * Math.sin(k * 3.1));
      const g = st.clone().scale(1, l, 1).rotateZ(-spread).rotateY(a).translate(Math.cos(a) * r0, 0.02, -Math.sin(a) * r0);
      paint(g, () => stalk); parts.push(g.toNonIndexed());
      const e = new THREE.Vector3(0, l, 0).applyAxisAngle(Z, -spread).applyAxisAngle(Y, a);
      const h = an.clone().scale(0.014, 0.01, 0.014).translate(e.x + Math.cos(a) * r0, e.y + 0.02, e.z - Math.sin(a) * r0);
      paint(h, () => tip); parts.push(h.toNonIndexed());
    }
  }
  for (const g of parts) for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color') g.deleteAttribute(k);
  return mergeGeometries(parts);
}

/** Margerite/Kamille: viele schmale weiße Zungenblüten, gewölbte gelbe Mitte. */
export function daisyGeometry() {
  return blossom({
    rings: [
      { n: 17, len: 0.44, wid: 0.11, cup: 0.18, lift: -0.03, tilt: 0.12, r0: 0.07, y: 0.01, col: (t) => mixc(rgb('#e9e4d6'), rgb('#ffffff'), Math.min(1, t * 2.2)) },
      { n: 15, len: 0.4, wid: 0.1, cup: 0.18, lift: -0.02, tilt: 0.2, r0: 0.07, y: 0.02, phase: 0.5, col: (t) => mixc(rgb('#e4dfd0'), rgb('#fdfdfb'), Math.min(1, t * 2.2)) },
    ],
    center: { r: 0.12, h: 0.07, y: 0.025, col: (rr) => mixc(rgb('#f6c21c'), rgb('#d98f0b'), 1 - rr) },
  });
}
/** Vergissmeinnicht: fünf runde himmelblaue Blätter, weißer Ring, gelbes Auge. */
export function forgetMeNotGeometry() {
  return blossom({
    rings: [{ n: 5, len: 0.42, wid: 0.42, cup: 0.12, lift: 0.04, tilt: 0.1, r0: 0.03, col: (t) => t < 0.12 ? mixc(rgb('#fff3c4'), rgb('#ffffff'), t / 0.12) : mixc(rgb('#e8f0ff'), rgb('#5f8fe0'), Math.min(1, (t - 0.12) * 5)) }],
    center: { r: 0.06, h: 0.03, y: 0.02, col: (rr) => mixc(rgb('#f2c230'), rgb('#e8a514'), rr) },
  });
}
/** Kirschblüte: fünf zartrosa, an der Spitze eingekerbte Blätter, tiefrosa Mitte, feine Staubgefäße. */
export function cherryGeometry() {
  return blossom({
    rings: [{ n: 5, len: 0.46, wid: 0.4, cup: 0.14, lift: 0.08, notch: 0.1, ruffle: 0.03, tilt: 0.16, r0: 0.02, col: (t) => t < 0.3 ? mixc(rgb('#d9577f'), rgb('#f7c8d6'), t / 0.3) : mixc(rgb('#f7c8d6'), rgb('#fff4f7'), (t - 0.3) / 0.7) }],
    center: { r: 0.05, h: 0.03, y: 0.015, col: () => rgb('#c2456a') },
    stamens: { n: 16, len: 0.17, spread: 0.6, stalk: rgb('#f3e3e6'), tip: rgb('#e8b84a') },
  });
}
/** Gerbera: zwei Kränze schmaler, leuchtender Blätter, dunkle Mitte mit goldenem Kranz. */
export function gerberaGeometry() {
  const c = (a, b) => (t) => mixc(rgb(a), rgb(b), Math.min(1, t * 1.6));
  return blossom({
    rings: [
      { n: 22, len: 0.42, wid: 0.1, cup: 0.12, lift: -0.02, tilt: 0.08, r0: 0.1, y: 0.0, point: 0.15, col: c('#d8381f', '#f2603a') },
      { n: 18, len: 0.34, wid: 0.09, cup: 0.14, lift: 0.02, tilt: 0.22, r0: 0.1, y: 0.02, phase: 0.5, point: 0.15, col: c('#c92e18', '#ea5430') },
      { n: 16, len: 0.12, wid: 0.04, cup: 0.1, lift: 0.04, tilt: 0.6, r0: 0.08, y: 0.03, col: () => rgb('#f1c44a') },
    ],
    center: { r: 0.11, h: 0.05, y: 0.03, col: (rr) => mixc(rgb('#3a2a12'), rgb('#6b4a1a'), rr) },
  });
}
/** Hortensienblüte: vier breite, rundliche Blätter in Flieder/Blau, kleines Auge. */
export function hydrangeaGeometry() {
  return blossom({
    rings: [{ n: 4, len: 0.46, wid: 0.5, cup: 0.1, lift: 0.05, ruffle: 0.02, tilt: 0.12, r0: 0.01, col: (t, z) => mixc(rgb('#8d8fe0'), rgb('#c3a6ea'), Math.min(1, t * 1.2 + Math.abs(z) * 0.2)) }],
    center: { r: 0.04, h: 0.03, y: 0.02, col: () => rgb('#7d74c8') },
  });
}
/**
 * Gefüllte Blüte (Pfingstrose/Ranunkel): viele Kränze, innen kleiner und steiler (fast aufrecht),
 * dadurch eine runde, dichte Blütenkugel. Farbe innen etwas kräftiger.
 */
function filledBloom({ layers, perLayer, len0, len1, wid, cup, ruffle, tilt0, tilt1, outer, inner }) {
  const rings = [];
  for (let l = 0; l < layers; l++) {
    const f = l / (layers - 1);
    rings.push({ n: perLayer + (l % 3), len: len0 + (len1 - len0) * f, wid: wid * (1 - 0.3 * f), cup: cup + f * 0.25, lift: 0.02,
      curl: (1 - f) * 0.06, ruffle, tilt: tilt0 + (tilt1 - tilt0) * Math.pow(f, 0.8), r0: 0.03 * (1 - f), y: f * 0.12, phase: l * 0.618,
      col: (t) => mixc(rgb(inner), rgb(outer), Math.min(1, (1 - f) * 0.7 + t * 0.4)) });
  }
  return blossom({ rings });
}
/** Pfingstrose: große, gewellte, gefüllte Blüte in Zartrosa. */
export function peonyGeometry() {
  return filledBloom({ layers: 6, perLayer: 7, len0: 0.46, len1: 0.2, wid: 0.52, cup: 0.24, ruffle: 0.025, tilt0: 0.35, tilt1: 1.25, outer: '#f4b8cb', inner: '#d9668c' });
}
/** Ranunkel: dicht gefüllt, viele kleine runde Blätter, Pfirsich. */
export function ranunculusGeometry() {
  return filledBloom({ layers: 9, perLayer: 8, len0: 0.38, len1: 0.12, wid: 0.42, cup: 0.32, ruffle: 0, tilt0: 0.5, tilt1: 1.4, outer: '#ffb98c', inner: '#ec7446' });
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
