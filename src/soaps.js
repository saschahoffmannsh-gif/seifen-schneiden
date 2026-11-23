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
  zitrone: {
    id: 4, name: 'Zitrone', emoji: '🍋',
    base: hex(0xf5dc4a), light: hex(0xfff5b0), accent: hex(0xb59a12),
    swatch: 'linear-gradient(#fff5b0, #f5dc4a 60%, #b59a12)',
  },
  kokos: {
    id: 5, name: 'Kokos', emoji: '🥥',
    base: hex(0xf3efe6), light: hex(0xffffff), accent: hex(0x8a6a4a),
    swatch: 'linear-gradient(#ffffff, #f3efe6 60%, #8a6a4a)',
  },
  rose: {
    id: 6, name: 'Rose', emoji: '🌹',
    base: hex(0xe38bb8), light: hex(0xf6c6de), accent: hex(0xa63d78),
    swatch: 'linear-gradient(#f6c6de, #e38bb8 60%, #a63d78)',
  },
  honig: {
    id: 7, name: 'Honig', emoji: '🍯',
    base: hex(0xe6a23a), light: hex(0xf8d58a), accent: hex(0x9a5f10),
    swatch: 'linear-gradient(#f8d58a, #e6a23a 60%, #9a5f10)',
  },
  kamille: {
    id: 8, name: 'Kamille', emoji: '🌼',
    base: hex(0xdde49a), light: hex(0xf4f7d2), accent: hex(0x8a9a30),
    swatch: 'linear-gradient(#f4f7d2, #dde49a 60%, #8a9a30)',
  },
  aktivkohle: {
    id: 9, name: 'Aktivkohle', emoji: '🖤',
    base: hex(0x3c3b40), light: hex(0x6a6970), accent: hex(0x18181b),
    swatch: 'linear-gradient(#6a6970, #3c3b40 60%, #18181b)',
  },
  matcha: {
    id: 10, name: 'Matcha', emoji: '🍵',
    base: hex(0x93b552), light: hex(0xc8dd98), accent: hex(0x587a26),
    swatch: 'linear-gradient(#c8dd98, #93b552 60%, #587a26)',
  },
  orange: {
    id: 11, name: 'Orange', emoji: '🍊',
    base: hex(0xf39448), light: hex(0xffc796), accent: hex(0xc0601a),
    swatch: 'linear-gradient(#ffc796, #f39448 60%, #c0601a)',
  },
};
export const SOAP_LIST = Object.values(SOAPS);
export const SOAP_BY_ID = SOAP_LIST.slice().sort((a, b) => a.id - b.id);

/** Jede Seife hat genau EINE Farbe (keine Marmorierung, keine Sprenkel). Schreibt sRGB in out. */
export function cubeColor(soap, out) {
  out[0] = soap.base[0]; out[1] = soap.base[1]; out[2] = soap.base[2];
}
