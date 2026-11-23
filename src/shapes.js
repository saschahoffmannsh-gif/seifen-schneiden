// Seifenformen (Gussformen). Recherche: gängige Formen für handgemachte Seife sind das klassische
// Rechteck (Riegel), Oval, Rund, Achteck, Herz, Blume, Stern, Muschel und Kuppel (halbkugelig).
// "Klassisch" ist von Anfang an da, die anderen werden mit Münzen freigeschaltet (wie Päckchen).
// Bestellungen nennen eine Form (nur freigeschaltete); falsche Form beim Ausformen -> −30 % Preis.
//
// Jede Form: Umriss in der Draufsicht (x Breite ≤ 1.0, z Tiefe ≤ 0.7), weich gerundete 3D-Kanten,
// eine Prägung oben (Bump-Textur: eingetiefter Rand + Motiv) und ein Symbol für Zettel/Auswahl.
import * as THREE from 'three';
import { save } from './save.js';

const TAU = Math.PI * 2;
const polar = (f, n = 96) => Array.from({ length: n }, (_, i) => { const a = i / n * TAU, r = f(a); return [Math.cos(a) * r[0], Math.sin(a) * r[1]]; });

/** Umriss als Punktliste [x, z] (gegen den Uhrzeigersinn in x/-z), Mittelpunkt 0. */
function outlinePts(id) {
  switch (id) {
    case 'oval': return polar(() => [0.5, 0.34]);
    case 'rund': return polar(() => [0.36, 0.36]);
    case 'kuppel': return polar(() => [0.36, 0.36]);
    case 'achteck': {
      const w = 0.47, d = 0.33, c = 0.13, pts = [[w, -d + c], [w, d - c], [w - c, d], [-w + c, d], [-w, d - c], [-w, -d + c], [-w + c, -d], [w - c, -d]];
      return pts;
    }
    case 'herz': return Array.from({ length: 96 }, (_, i) => {
      const t = i / 96 * TAU, x = 16 * Math.sin(t) ** 3, y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      return [x / 16 * 0.42, -(y + 2.5) / 16 * 0.42];
    }).reverse();
    case 'blume': return polar((a) => { const r = 0.27 + 0.065 * Math.cos(6 * a); return [r * 1.05, r * 1.05]; }, 144);
    case 'stern': return polar((a) => { const k = Math.pow((Math.cos(5 * (a + Math.PI / 2)) + 1) / 2, 1.6); const r = 0.2 + 0.19 * k; return [r, r]; }, 160);
    case 'muschel': return Array.from({ length: 120 }, (_, i) => {
      // Fächer um das Schloss unten: welliger Außenrand (Rippen), kleine "Ohren" am Schloss
      const t = i / 120, a = -Math.PI * 0.62 + t * Math.PI * 1.24;
      const rib = 1 - 0.035 * Math.abs(Math.sin(a * 7.5));
      let r = 0.5 * rib;
      const ear = Math.abs(Math.abs(a) - Math.PI * 0.62);
      if (ear < 0.25) r *= 0.42 + 0.58 * (ear / 0.25) ** 0.7;
      return [Math.sin(a) * r * 0.95, -(Math.cos(a) * r - 0.2)];
    });
    default: {   // klassisch: Rechteck mit großen Radien
      const w = 0.48, d = 0.32, R = 0.12, pts = [];
      for (let q = 0; q < 4; q++) {
        const cx = q === 0 || q === 3 ? w - R : -w + R, cz = q < 2 ? d - R : -d + R;
        for (let k = 0; k <= 8; k++) { const a = (q + k / 8) * Math.PI / 2; pts.push([cx + Math.cos(a) * R, cz + Math.sin(a) * R]); }
      }
      return pts;
    }
  }
}

export const SOAP_SHAPES = [
  { id: 'klassisch', name: 'Klassisch', cost: 0, bonus: 0 },
  { id: 'oval', name: 'Oval', cost: 60, bonus: 3 },
  { id: 'rund', name: 'Rund', cost: 80, bonus: 4 },
  { id: 'achteck', name: 'Achteck', cost: 100, bonus: 5 },
  { id: 'herz', name: 'Herz', cost: 140, bonus: 7 },
  { id: 'blume', name: 'Blume', cost: 160, bonus: 8 },
  { id: 'kuppel', name: 'Kuppel', cost: 180, bonus: 9 },
  { id: 'stern', name: 'Stern', cost: 200, bonus: 10 },
  { id: 'muschel', name: 'Muschel', cost: 240, bonus: 12 },
];
for (const s of SOAP_SHAPES) s.unlocked = s.cost === 0 || save.isUnlocked('shape:' + s.id);
export const SHAPE_BY_ID = Object.fromEntries(SOAP_SHAPES.map((s) => [s.id, s]));
export const DEFAULT_SHAPE = SOAP_SHAPES[0];

/** Liegt (x, z) im Umriss? (für Perlen/Flocken auf der Oberseite) */
export function insideShape(id, x, z, inset = 0) {
  const pts = outlinePts(id);
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i], [xj, zj] = pts[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
  }
  if (!inside || inset <= 0) return inside;
  for (let a = 0; a < 8; a++) if (!insideShape(id, x + Math.cos(a / 8 * TAU) * inset, z + Math.sin(a / 8 * TAU) * inset)) return false;
  return true;
}

// ---------- 2D: Symbol + Prägung ----------
/** Umriss in ein 2D-Canvas zeichnen (Mitte cx/cy, size = Pixel für 1 Welt-Einheit). */
export function traceShape(g, id, cx, cy, size, k = 1) {
  const pts = outlinePts(id);
  g.beginPath();
  pts.forEach(([x, z], i) => { const px = cx + x * size * k, py = cy + z * size * k; if (i) g.lineTo(px, py); else g.moveTo(px, py); });
  g.closePath();
}
/** Kleines Symbol (Zettel, Auswahl): gefüllter Umriss mit hellem Rand. */
export function drawShapeIcon(g, id, cx, cy, px, fill = '#c9a27a', line = 'rgba(80,55,30,.55)') {
  const size = px / 1.0;
  g.save();
  traceShape(g, id, cx, cy, size);
  g.fillStyle = fill; g.fill();
  g.lineWidth = Math.max(1, px * 0.045); g.strokeStyle = line; g.stroke();
  traceShape(g, id, cx, cy, size, 0.72);
  g.lineWidth = Math.max(0.8, px * 0.03); g.strokeStyle = 'rgba(255,255,255,.55)'; g.stroke();
  g.restore();
}
export function shapeIconURL(id, px = 120) {
  const c = document.createElement('canvas'); c.width = c.height = px;
  drawShapeIcon(c.getContext('2d'), id, px / 2, px / 2, px * 0.92, '#e6cfb3');
  return c.toDataURL();
}

/** Prägung oben (Höhenkarte, hell = erhaben): eingetiefte Rinne nahe dem Rand + Motiv in der Mitte. */
function embossTexture(id) {
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#808080'; g.fillRect(0, 0, S, S);
  g.filter = 'blur(3px)';
  // Rinne (eingetieft)
  traceShape(g, id, S / 2, S / 2, S, id === 'kuppel' ? 0.62 : 0.8);
  g.lineWidth = 10; g.strokeStyle = '#3a3a3a'; g.stroke();
  // Motiv (erhaben)
  g.fillStyle = '#d8d8d8'; g.strokeStyle = '#d8d8d8';
  const cx = S / 2, cy = S / 2;
  if (id === 'muschel') {
    g.lineWidth = 9;
    for (let k = -5; k <= 5; k++) { const a = k * 0.21; g.beginPath(); g.moveTo(cx, cy + 0.2 * S); g.lineTo(cx + Math.sin(a) * 0.38 * S, cy + 0.2 * S - Math.cos(a) * 0.4 * S); g.stroke(); }
  } else if (id === 'stern' || id === 'herz' || id === 'blume') {
    traceShape(g, id, cx, cy, S, 0.34); g.fill();
  } else if (id === 'kuppel') {
    g.beginPath(); g.arc(cx, cy, 0.09 * S, 0, TAU); g.fill();
  } else {
    // Blatt-Emblem + Schriftzug
    g.save(); g.translate(cx, cy - 0.05 * S);
    g.beginPath(); g.moveTo(0, -0.07 * S); g.quadraticCurveTo(0.06 * S, -0.01 * S, 0, 0.05 * S); g.quadraticCurveTo(-0.06 * S, -0.01 * S, 0, -0.07 * S); g.fill();
    g.restore();
    g.font = `600 ${Math.round(S * 0.075)}px Fraunces, Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('SEIFE', cx, cy + 0.08 * S);
  }
  g.filter = 'none';
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4;
  return t;
}

// ---------- 3D ----------
const H = 0.36, BEVEL = 0.075;
const cache = new Map();
/** Geometrie der fertigen Seife (Gruppe 0 = Ober-/Unterseite, 1 = Seiten), Höhe 0.36, Mitte 0. */
export function shapeGeometry(id) {
  if (cache.has(id)) return cache.get(id);
  let geo;
  if (id === 'kuppel') {
    // Kuppel: Rotationskörper, flacher Boden, weich gewölbte Oberseite
    const R = 0.36, pts = [new THREE.Vector2(0, 0)];
    for (let i = 0; i <= 6; i++) { const a = i / 6 * Math.PI / 2; pts.push(new THREE.Vector2(R - 0.03 + Math.sin(a) * 0.03, 0.03 - Math.cos(a) * 0.03 + 0.03)); }
    for (let i = 1; i <= 24; i++) { const a = i / 24 * Math.PI / 2; pts.push(new THREE.Vector2((R - 0.005) * Math.cos(a) ** 0.9, 0.06 + (H - 0.06) * Math.sin(a))); }
    geo = new THREE.LatheGeometry(pts, 72).translate(0, -H / 2, 0);
    // UV von oben (für Marmor + Prägung)
    const p = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) + 0.5, 0.5 - p.getZ(i));
    geo.clearGroups(); geo.addGroup(0, geo.index.count, 0);
  } else {
    const pts = outlinePts(id);
    // Umriss um die Rundung nach innen versetzen, damit die Außenmaße stimmen
    const shape = new THREE.Shape(pts.map(([x, z]) => { const l = Math.hypot(x, z) || 1, k = Math.max(0.2, 1 - BEVEL * 0.9 / l); return new THREE.Vector2(x * k, -z * k); }));
    const uvGen = {
      generateTopUV: (g, v, a, b, c) => [a, b, c].map((k) => new THREE.Vector2(v[k * 3] + 0.5, v[k * 3 + 1] + 0.5)),
      generateSideWallUV: (g, v, a, b, c, d) => [a, b, c, d].map((k) => new THREE.Vector2(0.5 + Math.atan2(v[k * 3 + 1], v[k * 3]) / TAU * 2.2, v[k * 3 + 2] / H + 0.5)),
    };
    geo = new THREE.ExtrudeGeometry(shape, { depth: H - 2 * BEVEL, bevelEnabled: true, bevelThickness: BEVEL, bevelSize: BEVEL * 0.9, bevelSegments: 6, curveSegments: 24, UVGenerator: uvGen });
    geo.translate(0, 0, -(H - 2 * BEVEL) / 2).rotateX(-Math.PI / 2);
    geo.computeVertexNormals();
  }
  geo.computeBoundingBox();
  cache.set(id, geo);
  return geo;
}
/** Höhe der Oberseite bei (x, z) (Kuppel gewölbt, sonst flach). */
export function shapeTopY(id, x, z) {
  if (id !== 'kuppel') return H / 2;
  const r = Math.min(1, Math.hypot(x, z) / 0.355);
  return -H / 2 + 0.06 + (H - 0.06) * Math.sqrt(Math.max(0, 1 - Math.pow(r, 1 / 0.9 * 1.0) ** 2));
}
const embossCache = new Map();
export function shapeEmboss(id) {
  if (!embossCache.has(id)) embossCache.set(id, embossTexture(id));
  return embossCache.get(id);
}
