// Seifen-Looks: Muster und Motive im Inneren des Seifenstücks.
//
// Jede Sorte hat eine Funktion colorAt(x, y, z) im Würfelraster des großen Stücks
// (x 0..15 Breite, y 0..24 Höhe, z 0..10 Tiefe; Vorderseite = z 10). Das Muster ist ein
// Querschnitt, der (fast) gleich durch das ganze Stück läuft – wie bei einer echten Schnittseife:
// Jede Scheibe zeigt das Motiv, und die Würfel einer Scheibe tragen genau diese Farben.
//
// Dieselbe Funktion liefert
//  * die Würfelfarben des großen Stücks (Schneiden, lose Würfel, Physik unverändert – nur Farben),
//  * ein feines Bild der Vorderseite für das Regal (Atlas, ein Draw Call wie bisher),
//  * kleine Bildchen für den Schrank.
// Kosten: einmal beim Laden einer Seife 3600 Funktionsaufrufe, sonst nichts pro Frame.
import { SOAP_BY_ID } from './soaps.js';
import { BLOCK } from './config.js';

const NX = 15, NY = 24, NZ = 10;   // Entwurfsraster der Looks (fein); das Spiel-Raster (BLOCK) wird darauf abgebildet
const SX = NX / BLOCK.nx, SY = NY / BLOCK.ny, SZ = NZ / BLOCK.nz;
const hx = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function set(out, c) { out[0] = c[0]; out[1] = c[1]; out[2] = c[2]; return out; }
function mixc(out, a, b, t) { out[0] = lerp(a[0], b[0], t); out[1] = lerp(a[1], b[1], t); out[2] = lerp(a[2], b[2], t); return out; }
function shade(out, k) { out[0] = Math.min(1, out[0] * k); out[1] = Math.min(1, out[1] * k); out[2] = Math.min(1, out[2] * k); return out; }

/** Ganzzahl-Hash -> 0..1 (stabil, damit jede Seife immer gleich aussieht). */
function hash(i, j, k, s = 0) {
  let h = (i * 374761393 + j * 668265263 + k * 2147483647 + s * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}
/** weiches 3D-Rauschen (Wert-Rauschen) für Marmor-Adern und Schichtkanten. */
function noise(x, y, z, s = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
  let v = 0;
  for (let c = 0; c < 8; c++) {
    const dx = c & 1, dy = (c >> 1) & 1, dz = (c >> 2) & 1;
    v += hash(ix + dx, iy + dy, iz + dz, s) * (dx ? ux : 1 - ux) * (dy ? uy : 1 - uy) * (dz ? uz : 1 - uz);
  }
  return v;
}
const fbm = (x, y, z, s) => noise(x, y, z, s) * 0.6 + noise(x * 2.1, y * 2.1, z * 2.1, s + 7) * 0.3 + noise(x * 4.3, y * 4.3, z * 4.3, s + 13) * 0.1;
/** Sprenkel: in Würfelzelle (ix,iy,iz) mit Wahrscheinlichkeit p ein Punkt (Rückgabe 0..1 = welcher). */
const speck = (x, y, z, s) => hash(Math.floor(x), Math.floor(y), Math.floor(z), s);

// ---------- Motive ----------
const C = {
  cream0: hx(0xffe4ea), cream1: hx(0xfbd3dc), berry: hx(0xe23a55), berryDk: hx(0xb5223f), berryCore: hx(0xffc7cf), berryStreak: hx(0xff8fa3), seed: hx(0xffe27a),
  leaf: hx(0x4caf50), leafDk: hx(0x2e7d32),
  lemonBg: hx(0xfff6cf), lemonRind: hx(0xd9a400), lemonPith: hx(0xfffdf2), lemon: hx(0xffd92e), lemonDk: hx(0xf0bf00),
  orangeBg: hx(0xffc796), orangeRind: hx(0xe8650a), orangePith: hx(0xffe9cc), orange: hx(0xf7931e), orangeDk: hx(0xea7d12),
  honey: hx(0xf0a830), honeyLt: hx(0xf9cd6a), honeyWall: hx(0xb3701a), honeyDk: hx(0xd88a1c),
  mint: hx(0x9ee6cb), mintVein: hx(0xf2fffa), mintDk: hx(0x3fae88),
  coal: hx(0x3a393e), coalVein: hx(0x8c8b93), coalWhite: hx(0xdedee2),
  m1: hx(0x8bb04a), m2: hx(0xc9dd99), m3: hx(0x6a9134), cream: hx(0xf5f1dc),
  rose: hx(0xe387b5), roseLt: hx(0xf9d6e8), roseDk: hx(0xb84a84),
  lav: hx(0xbba0e3), lavBud: hx(0x5b3a9a), lavMid: hx(0x8a66c8),
  cham: hx(0xdfe59f), chamPetal: hx(0xfdfdf0), chamYel: hx(0xf2c230),
  coco: hx(0xf6f2ea), cocoShell: hx(0x6b4a30), cocoShellLt: hx(0x8f6a48), cocoFlake: hx(0xe5d9c4),
  van: hx(0xf6e0a0), vanSeed: hx(0x3a2a1e),
};

function citrus(out, x, y, z, cx, cy, R, P) {
  const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy);
  if (d > R) return null;
  if (d > R - 0.95) return set(out, P.rind);
  if (d > R - 1.8) return set(out, P.pith);
  const a = Math.atan2(dy, dx) / (Math.PI * 2) + 0.5;
  const seg = (a * 9) % 1;
  if (d < 1.0 || seg < 0.09 || seg > 0.95) return set(out, P.pith);          // Mitte + Trennhäute
  mixc(out, P.flesh, P.fleshDk, speck(x * 1.7, y * 1.7, z, 21) * 0.8);       // Fruchtfleisch mit Saftbläschen
  return out;
}

export const LOOKS = {
  // Erdbeere: eine Erdbeere (breit oben, spitz unten) in hellrosa Seife – rot mit Kernchen,
  // helles Herz mit Streifen, grüne Blattkrone mit Stiel oben
  0: { name: 'Erdbeere', motif: true, rough: 0.4, colorAt(x, y, z, out) {
    const u = (x - 7.5) / 7.5, t = (y - 0.6) / 18.6;                         // t: 0 Spitze .. 1 Schulter
    // Blattkrone: spitze Kelchblätter hängen über die Schulter, darüber der Stiel
    const au = Math.abs(u);
    const leafLow = 16.6 + 2.6 * Math.abs(Math.cos(u * Math.PI * 1.6));     // Zacken nach unten
    const leafHigh = 20.6 - au * 1.8;
    if (au < 0.95 && y > leafLow && y < leafHigh) return mixc(out, C.leaf, C.leafDk, smooth(17, 20.5, y) * 0.5 + speck(x, y, z, 3) * 0.25);
    if (au < 0.14 && y >= leafHigh && y < 23.3) return set(out, C.leafDk);
    if (y > 19.2) return mixc(out, C.cream0, C.cream1, speck(x, y, z, 6) * 0.5);
    const w = t <= 0 ? 0 : 1.02 * Math.pow(Math.sin(Math.PI / 2 * Math.min(1, t * 1.15)), 0.75);
    if (Math.abs(u) > w) return mixc(out, C.cream0, C.cream1, speck(x, y, z, 6) * 0.5);   // Seife um die Beere
    const r = Math.hypot(u / Math.max(0.3, w), (t - 0.55) / 0.5);
    if (r < 0.3) return set(out, C.berryCore);
    const ang = Math.atan2(t - 0.55, u) / (Math.PI * 2) + 0.5;
    if (r < 0.58) return mixc(out, C.berryCore, C.berryStreak, smooth(0.3, 0.56, r) * ((ang * 10) % 1 < 0.35 ? 0.5 : 1));
    if (speck(x, y, z, 1) < 0.16 && (Math.floor(x) + Math.floor(y) + Math.floor(z)) % 2 === 0) return set(out, C.seed);
    return mixc(out, C.berry, C.berryDk, smooth(0.8, 1.1, r));
  } },
  // Zitrone: zwei Zitronenscheiben übereinander im hellgelben Stück
  4: { name: 'Zitrone', motif: true, rough: 0.38, colorAt(x, y, z, out) {
    const P = { rind: C.lemonRind, pith: C.lemonPith, flesh: C.lemon, fleshDk: C.lemonDk };
    return citrus(out, x, y, z, 7.5, 6.3, 6.4, P) || citrus(out, x, y, z, 7.5, 17.7, 6.4, P)
      || mixc(out, C.lemonBg, C.lemonRind, speck(x, y, z, 4) < 0.08 ? 0.5 : 0);
  } },
  // Orange: eine große Orangenscheibe, oben und unten Schale mit Sprenkeln
  11: { name: 'Orange', motif: true, rough: 0.38, colorAt(x, y, z, out) {
    const P = { rind: C.orangeRind, pith: C.orangePith, flesh: C.orange, fleshDk: C.orangeDk };
    return citrus(out, x, y, z, 7.5, 12, 7.4, P) || mixc(out, C.orangeBg, C.orangeRind, speck(x, y, z, 11) < 0.12 ? 0.55 : 0);
  } },
  // Honig: Bienenwaben, glänzend
  7: { name: 'Honig', motif: true, rough: 0.22, colorAt(x, y, z, out) {
    const s = 3.3, q = (x * Math.sqrt(3) / 3 - y / 3) / s, r = (2 / 3 * y) / s;
    // axiale Hex-Koordinaten runden
    let rx = Math.round(q), rz = Math.round(r), ry = Math.round(-q - r);
    const dx = Math.abs(rx - q), dz = Math.abs(rz - r), dy = Math.abs(ry + q + r);
    if (dx > dy && dx > dz) rx = -ry - rz; else if (dy <= dz) rz = -rx - ry;
    const fx = q - rx, fz = r - rz, fy = -fx - fz;
    const edge = Math.max(Math.abs(fx), Math.abs(fy), Math.abs(fz));      // 0 Mitte .. 0.5 Rand
    if (edge > 0.39) return set(out, C.honeyWall);
    const h = hash(rx, rz, 0, 7);
    return mixc(out, h < 0.3 ? C.honeyDk : C.honey, C.honeyLt, (1 - edge / 0.39) * 0.7);
  } },
  // Minze: Marmor mit weißen und dunkelgrünen Adern
  3: { name: 'Minze', motif: false, pattern: 'Marmor', rough: 0.34, colorAt(x, y, z, out) {
    const n = fbm(x * 0.16, y * 0.16, z * 0.16, 31);
    const v = Math.abs(Math.sin(x * 0.32 + y * 0.2 + n * 7));
    const w = Math.abs(Math.sin(x * 0.12 - y * 0.27 + n * 5 + 1.7));
    set(out, C.mint);
    if (v < 0.2) mixc(out, out, C.mintVein, 1 - v / 0.2);
    if (w < 0.08) mixc(out, out, C.mintDk, 0.8);
    return out;
  } },
  // Aktivkohle: dunkler Marmor, matt
  9: { name: 'Aktivkohle', motif: false, pattern: 'Marmor', rough: 0.72, colorAt(x, y, z, out) {
    const n = fbm(x * 0.15, y * 0.15, z * 0.15, 41);
    const v = Math.abs(Math.sin(x * 0.25 - y * 0.22 + n * 8));
    set(out, C.coal);
    if (v < 0.14) mixc(out, out, C.coalVein, 1 - v / 0.14);
    if (v < 0.04 && n > 0.5) set(out, C.coalWhite);
    return shade(out, 0.94 + 0.12 * noise(x * 0.5, y * 0.5, z * 0.5, 5));
  } },
  // Matcha: gewellte Schichten in drei Grüntönen mit cremefarbenen Linien
  10: { name: 'Matcha', motif: false, pattern: 'Schichten', rough: 0.5, colorAt(x, y, z, out) {
    const yy = y + 1.3 * Math.sin(x * 0.5 + z * 0.4) + 0.8 * (noise(x * 0.3, 0, z * 0.3, 9) - 0.5);
    const band = Math.floor(yy / 4.8), f = (yy / 4.8) % 1;
    if (f < 0.12) return set(out, C.cream);
    return set(out, [C.m1, C.m2, C.m3][((band % 3) + 3) % 3]);
  } },
  // Rose: Wirbel (Swirl) aus Rosa und Hellrosa mit dunkler Linie
  6: { name: 'Rose', motif: false, pattern: 'Wirbel', rough: 0.3, colorAt(x, y, z, out) {
    const dx = x - 7.5, dy = y - 12, r = Math.hypot(dx, dy * 0.75);
    const s = ((Math.atan2(dy, dx) / (Math.PI * 2) + r * 0.11 + z * 0.01) % 1 + 1) % 1;
    if (Math.abs(s - 0.5) < 0.05) return set(out, C.roseDk);
    return set(out, s < 0.5 ? C.rose : C.roseLt);
  } },
  // Lavendel: Blütensprenkel
  2: { name: 'Lavendel', motif: false, pattern: 'Sprenkel', rough: 0.45, colorAt(x, y, z, out) {
    const h = speck(x, y, z, 2);
    return set(out, h < 0.1 ? C.lavBud : h < 0.17 ? C.lavMid : C.lav);
  } },
  // Kamille: weiße Blütenblätter und gelbe Pünktchen
  8: { name: 'Kamille', motif: false, pattern: 'Sprenkel', rough: 0.45, colorAt(x, y, z, out) {
    const h = speck(x, y, z, 8);
    return set(out, h < 0.08 ? C.chamPetal : h < 0.13 ? C.chamYel : C.cham);
  } },
  // Kokos: braune Schale oben, weißes Fruchtfleisch mit Raspeln
  5: { name: 'Kokos', motif: true, rough: 0.5, colorAt(x, y, z, out) {
    const top = 21.6 + 0.6 * Math.sin(x * 0.8);
    if (y > top) return speck(x, y, z, 51) < 0.3 ? set(out, C.cocoShellLt) : set(out, C.cocoShell);
    if (y > top - 0.9) return set(out, C.cocoFlake);
    const h = speck(x, y, z, 5);
    return set(out, h < 0.16 ? C.cocoFlake : h < 0.19 ? C.cocoShellLt : C.coco);
  } },
  // Vanille: klassisch cremig, nur feine Vanille-Pünktchen
  1: { name: 'Vanille', motif: false, pattern: 'klassisch', rough: 0.42, colorAt(x, y, z, out) {
    return set(out, speck(x, y, z, 1) < 0.045 ? C.vanSeed : C.van);
  } },
};

/** sRGB-Farbe des Würfels (i,j,k) einer Sorte. */
export function lookColor(soap, i, j, k, out) {
  const L = LOOKS[soap.id];
  if (!L) return set(out, soap.base);
  // Würfelmitte des (gröberen) Spiel-Rasters ins Entwurfsraster der Looks (15 x 24 x 10) umrechnen
  return L.colorAt((i + 0.5) * SX, (j + 0.5) * SY, (k + 0.5) * SZ, out);
}
export const hasMotif = (soap) => !!(LOOKS[soap.id] && LOOKS[soap.id].motif);
export const lookRough = (soap) => (LOOKS[soap.id] ? LOOKS[soap.id].rough : 0.42);

/** Vorderseite einer Sorte als Bild (Ausschnitt x0..x1, y0..y1 im Würfelraster). */
function drawFace(g, soap, ox, oy, w, h, x0 = 0, x1 = NX, y0 = 0, y1 = NY) {
  const img = g.createImageData(w, h), d = img.data, out = [0, 0, 0];
  const L = LOOKS[soap.id];
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
    const x = x0 + (px + 0.5) / w * (x1 - x0), y = y1 - (py + 0.5) / h * (y1 - y0);
    if (L) L.colorAt(x, y, NZ - 0.5, out); else set(out, soap.base);
    const o = (py * w + px) * 4;
    d[o] = out[0] * 255; d[o + 1] = out[1] * 255; d[o + 2] = out[2] * 255; d[o + 3] = 255;
  }
  g.putImageData(img, ox, oy);
}

export const ATLAS_COLS = 4, ATLAS_ROWS = 3, TILE_W = 60, TILE_H = 96;
/** Atlas aller Sorten (Kachel = soap.id) für die Regal-Vorderseiten; Ausschnitt = sichtbare Platte. */
export function makeFaceAtlas(inset) {   // inset in Würfeln des Spiel-Rasters
  const c = document.createElement('canvas');
  c.width = ATLAS_COLS * TILE_W; c.height = ATLAS_ROWS * TILE_H;
  const g = c.getContext('2d');
  for (const s of SOAP_BY_ID) {
    const col = s.id % ATLAS_COLS, row = Math.floor(s.id / ATLAS_COLS);
    drawFace(g, s, col * TILE_W, row * TILE_H, TILE_W, TILE_H, inset * SX, NX - inset * SX, inset * SY, NY - inset * SY);
  }
  return c;
}

const thumbs = new Map();
/** Kleines Bild der Vorderseite (Data-URL) für den Schrank; wird gecacht. */
export function soapThumb(soap) {
  if (!thumbs.has(soap.id)) {
    const c = document.createElement('canvas'); c.width = 45; c.height = 72;
    drawFace(c.getContext('2d'), soap, 0, 0, 45, 72);
    thumbs.set(soap.id, c.toDataURL());
  }
  return thumbs.get(soap.id);
}

/** Look einer Sorte als Canvas (Ausschnitt im Würfelraster), z. B. für den Startbildschirm. */
export function lookCanvas(soap, w, h, x0 = 0, x1 = NX, y0 = 0, y1 = NY) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  drawFace(c.getContext('2d'), soap, 0, 0, w, h, x0, x1, y0, y1);
  return c;
}
