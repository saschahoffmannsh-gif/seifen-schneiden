// Prägung der Seifen-Vorderseite (einmalig beim Start erzeugt, keine Kosten pro Frame).
//
// Eine echte gepresste Seife hat: einen glatten Rand, eine eingedrückte Mulde (Panel) mit
// schrägen Wänden und darin eine erhabene Marke (Blatt-Emblem + Schriftzug "SEIFE").
// Wir zeichnen das als Höhenkarte auf ein Canvas, weichzeichnen es (weiche Kanten wie
// gepresste Seife) und speichern daraus die Steigungen (dh/dx, dh/dy) in einer Textur.
// Der Seifen-Shader kippt damit nur die Normalen -> Relief entsteht allein durch Licht,
// die Seife behält ihre eine Farbe. Die Textur gehört zur Außenhaut der vordersten
// Würfel und verschwindet daher automatisch mit den abgeschnittenen Würfeln.
import * as THREE from 'three';
import { BLOCK, CUBE } from './config.js';

export const RELIEF_SLOPE = 2.0; // max. kodierte Steigung (+-)

export function makeReliefTexture() {
  const faceW = BLOCK.nx * CUBE, faceH = BLOCK.ny * CUBE;   // Weltmaße der Vorderseite
  const W = 300, H = Math.round(W * faceH / faceW);         // 300 x 480 Pixel
  const px = faceW / W;                                      // Welt-Einheiten pro Pixel
  const S = W / faceW;                                       // Pixel pro Welt-Einheit

  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d', { willReadFrequently: true });

  const rrect = (x, y, w, h, r) => {
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  };
  const layer = (draw) => {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#fff'; g.strokeStyle = '#fff';
    draw();
    g.setTransform(1, 0, 0, 1, 0, 0);
    const d = g.getImageData(0, 0, W, H).data;
    const out = new Float32Array(W * H);
    for (let n = 0; n < W * H; n++) out[n] = d[n * 4] / 255;
    return out;
  };

  // 1) Mulde: abgerundetes Rechteck, Abstand zum Rand ~0.075 Welt-Einheiten
  const inset = 0.08 * S;
  const panelX = inset, panelY = inset * 1.05, panelW = W - 2 * inset, panelH = H - 2 * inset * 1.05;
  const panel = layer(() => { rrect(panelX, panelY, panelW, panelH, 0.075 * S); g.fill(); });

  // 2) Marke in der Mulde: feiner Zierrahmen, Blatt-Emblem, Schriftzug, kleine Unterzeile
  const cx = W / 2;
  const mark = layer(() => {
    // Zierrahmen (dünne erhabene Linie innen entlang der Mulde)
    const fi = 0.03 * S;
    g.lineWidth = 0.011 * S;
    rrect(panelX + fi, panelY + fi, panelW - 2 * fi, panelH - 2 * fi, 0.05 * S); g.stroke();

    // Blatt-Emblem (zwei Blätter + Stiel), obere Hälfte
    const ey = H * 0.36, leaf = 0.13 * S;
    for (const side of [-1, 1]) {
      g.save();
      g.translate(cx, ey + leaf * 0.35);
      g.rotate(side * 0.62);
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(side * leaf * 0.55, -leaf * 0.55, 0, -leaf * 1.25);
      g.quadraticCurveTo(-side * leaf * 0.55, -leaf * 0.55, 0, 0);
      g.fill();
      g.restore();
    }
    // mittleres, größeres Blatt
    g.beginPath();
    g.moveTo(cx, ey + leaf * 0.45);
    g.quadraticCurveTo(cx + leaf * 0.62, ey - leaf * 0.5, cx, ey - leaf * 1.35);
    g.quadraticCurveTo(cx - leaf * 0.62, ey - leaf * 0.5, cx, ey + leaf * 0.45);
    g.fill();
    // Stiel
    g.lineWidth = 0.012 * S; g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx, ey + leaf * 0.35); g.lineTo(cx, ey + leaf * 0.85); g.stroke();

    // Schriftzug
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `800 ${Math.round(0.135 * S)}px "Trebuchet MS", "Arial Rounded MT Bold", Verdana, sans-serif`;
    g.fillText('SEIFE', cx, H * 0.6);
    // Trennlinie + Unterzeile
    g.lineWidth = 0.008 * S;
    g.beginPath(); g.moveTo(cx - 0.12 * S, H * 0.675); g.lineTo(cx + 0.12 * S, H * 0.675); g.stroke();
    g.font = `700 ${Math.round(0.058 * S)}px "Trebuchet MS", Verdana, sans-serif`;
    g.fillText('HANDGEMACHT', cx, H * 0.73);
  });

  // weiche Kanten (wie gepresste Seife): mehrfacher Box-Blur, einmalig
  blur(panel, W, H, Math.round(0.012 * S), 3);
  blur(mark, W, H, Math.max(1, Math.round(0.004 * S)), 2);

  // Höhe in Welt-Einheiten: Mulde 1.4 cm-Modell (0.014), Marke ragt fast bis Randhöhe hoch
  const DEPTH = 0.016, MARK = 0.011;
  const h = new Float32Array(W * H);
  for (let n = 0; n < W * H; n++) h[n] = -DEPTH * panel[n] + MARK * mark[n] * panel[n];

  // Steigungen per zentraler Differenz -> RGBA8 (R = dh/dx, G = dh/dy, B = Muldentiefe für Licht-Verdeckung)
  const data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const n = y * W + x;
    const xl = x > 0 ? n - 1 : n, xr = x < W - 1 ? n + 1 : n;
    const yu = y > 0 ? n - W : n, yd = y < H - 1 ? n + W : n;
    const gx = (h[xr] - h[xl]) / ((xr - xl) * px || 1);
    // Canvas-y zeigt nach unten, Welt-y nach oben
    const gy = -(h[yd] - h[yu]) / ((yd - yu) / W * px || 1);
    // Textur-Zeile 0 = unten (Welt), Canvas-Zeile 0 = oben -> beim Schreiben spiegeln
    const o = ((H - 1 - y) * W + x) * 4;
    data[o] = enc(gx); data[o + 1] = enc(gy);
    data[o + 2] = Math.round(THREE.MathUtils.clamp(-h[n] / DEPTH, 0, 1) * 255);
    data[o + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  tex.colorSpace = THREE.NoColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

function enc(v) {
  return Math.round(THREE.MathUtils.clamp(0.5 + v / (2 * RELIEF_SLOPE), 0, 1) * 255);
}

/** Separierbarer Box-Blur (in-place), `passes` Durchläufe ~ Gauß. */
function blur(a, W, H, r, passes) {
  if (r < 1) return;
  const tmp = new Float32Array(a.length);
  const k = 1 / (2 * r + 1);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < H; y++) {
      let s = 0;
      for (let x = -r; x <= r; x++) s += a[y * W + Math.min(W - 1, Math.max(0, x))];
      for (let x = 0; x < W; x++) {
        tmp[y * W + x] = s * k;
        s += a[y * W + Math.min(W - 1, x + r + 1)] - a[y * W + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < W; x++) {
      let s = 0;
      for (let y = -r; y <= r; y++) s += tmp[Math.min(H - 1, Math.max(0, y)) * W + x];
      for (let y = 0; y < H; y++) {
        a[y * W + x] = s * k;
        s += tmp[Math.min(H - 1, y + r + 1) * W + x] - tmp[Math.max(0, y - r) * W + x];
      }
    }
  }
}
