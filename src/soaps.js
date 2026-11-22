// Seifensorten: Farben und Muster für das Innenleben der Würfel.

// Kleiner deterministischer Zufall, damit jede Seife gleich aussieht
function hash(i, j, k, s) {
  let h = (i * 374761393 + j * 668265263 + k * 2147483647 + s * 1013904223) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return ((h >>> 0) % 10000) / 10000;
}

const hex = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];

export const SOAPS = {
  erdbeere: {
    id: 0, name: 'Erdbeere', emoji: '🍓',
    base: hex(0xf2789a), light: hex(0xffb6c9), accent: hex(0xc2185b),
    swatch: 'linear-gradient(#ffb6c9, #f2789a 60%, #e05a80)',
  },
  vanille: {
    id: 1, name: 'Vanille', emoji: '🍦',
    base: hex(0xf6e0a0), light: hex(0xfff4d2), accent: hex(0x8a5a32),
    swatch: 'linear-gradient(#fff4d2, #f6e0a0 60%, #e9c877)',
  },
  lavendel: {
    id: 2, name: 'Lavendel', emoji: '💜',
    base: hex(0xb79be0), light: hex(0xdccbf5), accent: hex(0x6d4bb3),
    swatch: 'linear-gradient(#dccbf5, #b79be0 60%, #9a7bd0)',
  },
  minze: {
    id: 3, name: 'Minze', emoji: '🌿',
    base: hex(0x8fe3c5), light: hex(0xe3fbf2), accent: hex(0x2f9e78),
    swatch: 'linear-gradient(#e3fbf2, #8fe3c5 60%, #62cfa8)',
  },
};
export const SOAP_LIST = Object.values(SOAPS);
export const SOAP_BY_ID = SOAP_LIST.slice().sort((a, b) => a.id - b.id);

/**
 * Farbe eines Würfels im Block (i,j,k) für eine Sorte. Schreibt sRGB in out[0..2].
 * Außen (outer=true): fast einfarbig mit ganz leichter Variation, wie die Oberfläche echter Seife.
 * Innen: sanfte, wellige Schlieren + vereinzelte Sprenkel -> wird beim Schneiden sichtbar.
 */
export function cubeColor(soap, i, j, k, out, outer = false) {
  const r = hash(i, j, k, soap.id);
  const v = outer ? 0.985 + hash(k, i, j, 7) * 0.03 : 0.96 + hash(k, i, j, 7) * 0.08; // subtile Helligkeitsvariation
  let mix = 0;
  if (!outer) {
    const wave = Math.sin(i * 0.8 + k * 1.3 + soap.id) * 1.1;
    const t = Math.abs(((j + wave) % 3 + 3) % 3 - 1.5) / 1.5;      // 0..1 Schliere
    mix = Math.max(0, 1 - t * 1.6) * 0.75;
  } else {
    mix = 0.1 + Math.sin(i * 0.5 + j * 0.4 + k * 0.3) * 0.03;
  }
  let c0 = soap.base[0] + (soap.light[0] - soap.base[0]) * mix;
  let c1 = soap.base[1] + (soap.light[1] - soap.base[1]) * mix;
  let c2 = soap.base[2] + (soap.light[2] - soap.base[2]) * mix;
  if (!outer && r < 0.05) { // Sprenkel (Erdbeerkerne, Vanillepunkte …), mit Grundfarbe gemischt
    c0 = c0 * 0.4 + soap.accent[0] * 0.6; c1 = c1 * 0.4 + soap.accent[1] * 0.6; c2 = c2 * 0.4 + soap.accent[2] * 0.6;
  }
  out[0] = Math.min(1, c0 * v); out[1] = Math.min(1, c1 * v); out[2] = Math.min(1, c2 * v);
}
