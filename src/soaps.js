// Seifensorten: Farben und Muster für das Innenleben der Würfel.


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

/** Jede Seife hat genau EINE Farbe (keine Marmorierung, keine Sprenkel). Schreibt sRGB in out. */
export function cubeColor(soap, out) {
  out[0] = soap.base[0]; out[1] = soap.base[1]; out[2] = soap.base[2];
}
