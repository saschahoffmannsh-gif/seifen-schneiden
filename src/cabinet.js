// Seifenschrank (Vollbild): Apothekerschrank mit großen Schubladen, alphabetisch nach Sorte (A–Z,
// deutsche Sortierung), spaltenweise. Ein Fach je Sorte – immer voll (man nimmt so viele Stücke wie
// man will, kostenlos). Gesperrte Sorten sind abgedunkelte Fächer. Keine leeren Platzhalter.
// Der Schrank scrollt seitlich, siehe ui.layoutCabinet.
import { SOAP_LIST } from './soaps.js';


const LOCKED = [
  ['Ziegenmilch', '#f1ece0'], ['Olive', '#a7a85a'], ['Sandelholz', '#b98a5e'], ['Meersalz', '#9ec9de'],
  ['Kirsche', '#b8344e'], ['Mango', '#f6b13d'], ['Zimt', '#a0582c'], ['Eukalyptus', '#7fb6a4'],
  ['Hafer', '#e3d2a8'], ['Jasmin', '#f7f1d6'], ['Pfirsich', '#f7b78f'], ['Kaffee', '#6b4529'],
  ['Sheabutter', '#efe2c0'], ['Teebaum', '#86a77a'], ['Aloe', '#b8dd9a'], ['Granatapfel', '#a3243b'],
  ['Bergamotte', '#d9d36a'], ['Lemongras', '#c7d76c'], ['Mandel', '#e8cfae'], ['Patchouli', '#6e5a3e'],
];

const collator = new Intl.Collator('de', { sensitivity: 'base' });

/** [{kind:'soap', soap} | {kind:'locked', name, color}] – alphabetisch. */
export function cabinetLayout() {
  const sorts = [...SOAP_LIST.map((soap) => ({ name: soap.name, soap })), ...LOCKED.map(([name, color]) => ({ name, color }))];
  sorts.sort((a, b) => collator.compare(a.name, b.name));
  const list = [];
  for (const s of sorts) {
    if (s.soap) list.push({ kind: 'soap', soap: s.soap });
    else list.push({ kind: 'locked', name: s.name, color: s.color });
  }
  return list;
}

export const soapCss = (s) => `rgb(${s.base.map((c) => Math.round(c * 255)).join(',')})`;
