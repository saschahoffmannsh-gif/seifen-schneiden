// Seifenschrank (Vollbild): Apothekerschrank mit vielen kleinen Schubladen. Feste, "zufällige"
// Anordnung (gleicher Seed), damit man sich mit der Zeit merken kann, wo was liegt.
import { SOAP_LIST } from './soaps.js';

export const CAB_COLS = 7, CAB_ROWS = 12;

const LOCKED = [
  ['Ziegenmilch', '#f1ece0'], ['Olive', '#a7a85a'], ['Sandelholz', '#b98a5e'], ['Meersalz', '#9ec9de'],
  ['Kirsche', '#b8344e'], ['Mango', '#f6b13d'], ['Zimt', '#a0582c'], ['Eukalyptus', '#7fb6a4'],
  ['Hafer', '#e3d2a8'], ['Jasmin', '#f7f1d6'], ['Pfirsich', '#f7b78f'], ['Kaffee', '#6b4529'],
  ['Sheabutter', '#efe2c0'], ['Teebaum', '#86a77a'], ['Aloe', '#b8dd9a'], ['Granatapfel', '#a3243b'],
  ['Bergamotte', '#d9d36a'], ['Lemongras', '#c7d76c'], ['Mandel', '#e8cfae'], ['Patchouli', '#6e5a3e'],
];

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

/** [{kind:'soap', soap} | {kind:'locked', name, color} | {kind:'empty'}], CAB_COLS*CAB_ROWS Stück */
export function cabinetLayout() {
  const r = rng(7);
  const list = [];
  for (const soap of SOAP_LIST) for (let k = 0; k < 3; k++) list.push({ kind: 'soap', soap });
  for (const [name, color] of LOCKED) list.push({ kind: 'locked', name, color });
  while (list.length < CAB_COLS * CAB_ROWS) list.push({ kind: 'empty' });
  for (let i = list.length - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0; [list[i], list[j]] = [list[j], list[i]]; }
  return list;
}

export const soapCss = (s) => `rgb(${s.base.map((c) => Math.round(c * 255)).join(',')})`;
