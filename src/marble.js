// Marmor-Textur für die fertige Seife, einmalig pro Seife auf einem Canvas berechnet.
// Die Farben und ihre Anteile kommen aus den Würfeln, die in der Schale gelandet sind.
import * as THREE from 'three';

// einfache Value-Noise + fBm (nur beim Erzeugen der Textur, nicht pro Frame)
function makeNoise(seed) {
  const p = new Uint8Array(512);
  let s = seed;
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 256; i++) p[i + 256] = p[i];
  const fade = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x) & 255, yi = Math.floor(y) & 255, xf = x - Math.floor(x), yf = y - Math.floor(y);
    const a = p[p[xi] + yi] / 255, b = p[p[xi + 1] + yi] / 255, c = p[p[xi] + yi + 1] / 255, d = p[p[xi + 1] + yi + 1] / 255;
    const u = fade(xf), v = fade(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

/**
 * @param {{rgb:number[], w:number}[]} parts  sRGB-Farben (0..1) mit Gewicht – die Flächenanteile
 *   entsprechen den Gewichten (60 % Vanille -> 60 % der Fläche vanillefarben)
 * @param {{tint?:[string,number][], specks?:object[]}} fx  Zusätze: Tönung und Sprenkel
 */
export function makeMarbleTexture(parts, size = 256, fx = {}) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(size, size);
  const noise = makeNoise((Math.random() * 1e9) | 1);
  const fbm = (x, y) => noise(x, y) * 0.5 + noise(x * 2, y * 2) * 0.25 + noise(x * 4, y * 4) * 0.125 + noise(x * 8, y * 8) * 0.0625;
  const total = parts.reduce((s, p) => s + p.w, 0) || 1;
  // kumulative Schwellen: jede Farbe bekommt einen Anteil am Wertebereich
  let acc = 0;
  const th = parts.map((p) => (acc += p.w / total));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size * 4, v = y / size * 4;
    // verzerrte Wellen -> Marmor-Adern
    // asin macht die Sinus-Welle gleichverteilt -> Fläche je Farbe = ihr Anteil
    const w = 0.5 + Math.asin(Math.sin((u + v * 0.6) * 2.2 + fbm(u, v) * 7)) / Math.PI;
    let idx = 0; while (idx < th.length - 1 && w > th[idx]) idx++;
    const c = parts[idx].rgb;
    // weiche Kanten: helle Ader an Übergängen
    const edge = Math.min(...th.slice(0, -1).map((t) => Math.abs(w - t)), 1);
    const glow = edge < 0.025 ? 0.12 * (1 - edge / 0.025) : 0;
    const o = (y * size + x) * 4;
    img.data[o] = Math.min(255, (c[0] + glow) * 255);
    img.data[o + 1] = Math.min(255, (c[1] + glow) * 255);
    img.data[o + 2] = Math.min(255, (c[2] + glow) * 255);
    img.data[o + 3] = 255;
  }
  // Tönung (z. B. Honig, Ziegenmilch) über alles
  if (fx.tint) for (const [hex, a] of fx.tint) {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    for (let o = 0; o < img.data.length; o += 4) {
      img.data[o] += (r - img.data[o]) * a; img.data[o + 1] += (g - img.data[o + 1]) * a; img.data[o + 2] += (b - img.data[o + 2]) * a;
    }
  }
  ctx.putImageData(img, 0, 0);
  // Sprenkel (Öle, Mohn, Blüten, Aktivkohle-Wirbel); Fläche bezogen auf 256 px
  const k = size / 256;
  if (fx.specks) for (const s of fx.specks) {
    for (let i = 0; i < s.n; i++) {
      ctx.fillStyle = s.colors[i % s.colors.length];
      const x = Math.random() * size, y = Math.random() * size, rr = (s.r[0] + Math.random() * (s.r[1] - s.r[0])) * k;
      ctx.globalAlpha = s.petal ? 0.85 : 0.9;
      ctx.beginPath();
      if (s.petal) ctx.ellipse(x, y, rr * 1.8, rr, Math.random() * 3, 0, 6.283);
      else if (rr > 2.5 * k) { // Wirbel: kleine Schlieren
        ctx.ellipse(x, y, rr * 2.4, rr * 0.5, Math.random() * 3, 0, 6.283);
      } else ctx.arc(x, y, rr, 0, 6.283);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
