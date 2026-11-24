// Bestellungen: Kundschaft, eine individuelle Mischung in Prozent (Schritte von 10 % = eine Scheibe),
// manchmal ein gewünschter Zusatz, und die Belohnung.
// Datenmodell offen für später (Seifenkörbe mit mehreren Seifen): order.items = [{ mix, additive, shape, qty }];
// heute hat jede Bestellung genau ein item (qty 1), die Felder mix/soaps/additive spiegeln es.
// barsNeeded(order) zählt über alle items, wie viele Stücke je Sorte aus dem Schrank geholt werden müssen.
import { SOAP_LIST, SOAPS } from './soaps.js';
import { ADDITIVES } from './additives.js';
import { SOAP_SHAPES, DEFAULT_SHAPE } from './shapes.js';
import { PCT_PER_SLICE } from './config.js';
import { BAR_SLICES } from './save.js';

const CUSTOMERS = ['Anna', 'Ben', 'Clara', 'Emil', 'Frieda', 'Jonas', 'Lea', 'Mila', 'Paul', 'Sophie', 'Greta', 'Oskar', 'Ida', 'Theo'];
let nextId = 1;

/** n Teile (je mindestens 1) die zusammen 10 ergeben, zufällig. */
function parts(n) {
  for (;;) {
    const cuts = [];
    while (cuts.length < n - 1) { const c = 1 + ((Math.random() * 9) | 0); if (!cuts.includes(c)) cuts.push(c); }
    cuts.sort((a, b) => a - b);
    const p = []; let last = 0;
    for (const c of cuts) { p.push(c - last); last = c; }
    p.push(10 - last);
    if (p.every((x) => x >= 1) && !(n === 2 && p[0] === 5 && Math.random() < 0.5)) return p;
  }
}

/** Neue Bestellung. first = allererste (Vanille 60 % · Erdbeere 40 %). avoid = Namen, die schon am Brett hängen. */
export function makeOrder({ first = false, avoid = [], avoidRecipes = [] } = {}) {
  let customer;
  do { customer = CUSTOMERS[(Math.random() * CUSTOMERS.length) | 0]; } while (avoid.includes(customer) && avoid.length < CUSTOMERS.length);
  let mix;
  if (first) mix = [{ soap: SOAPS.vanille, pct: 60 }, { soap: SOAPS.erdbeere, pct: 40 }];
  else {
    const n = Math.random() < 0.35 ? 3 : 2;
    for (let tries = 0; tries < 20; tries++) {   // keine zwei gleichen Rezepte gleichzeitig am Brett
      const kinds = SOAP_LIST.slice().sort(() => Math.random() - 0.5).slice(0, n);
      const p = parts(n);
      mix = kinds.map((soap, k) => ({ soap, pct: p[k] * 10 })).sort((a, b) => b.pct - a.pct);
      if (!avoidRecipes.includes(mix.map((m) => m.soap.id + ':' + m.pct).join('+'))) break;
    }
  }
  // manchmal ein Wunsch-Zusatz (nur freigeschaltete, damit es immer machbar ist)
  let additive = null;
  if (!first && Math.random() < 0.4) {
    const ok = ADDITIVES.filter((a) => a.unlocked);
    if (ok.length) additive = ok[(Math.random() * ok.length) | 0];
  }
  // Seifenform: nur freigeschaltete; Klassisch bleibt häufig, besondere Formen bringen mehr
  let shape = DEFAULT_SHAPE;
  const special = SOAP_SHAPES.filter((s) => s.unlocked && s !== DEFAULT_SHAPE);
  if (!first && special.length && Math.random() < 0.6) shape = special[(Math.random() * special.length) | 0];
  const reward = 36 + mix.length * 4 + (additive ? 8 : 0) + shape.bonus + ((Math.random() * 4) | 0) * 2;
  const soaps = mix.map((m) => m.soap);
  return { id: nextId++, customer, mix, soaps, additive, shape, reward, items: [{ mix, additive, shape, qty: 1 }] };
}

/** Text wie "Vanille 60 % · Erdbeere 40 %". */
export const mixText = (mix) => mix.map((m) => `${m.soap.name} ${m.pct} %`).join(' · ');

/**
 * Bedarf an Seifenstücken je Sorte: Map soapId -> Stückzahl. Jede Seife (item) braucht von jeder ihrer
 * Sorten mindestens ein Stück (mehr, wenn die Scheiben nicht aus einem Stück reichen), mal qty.
 * Heute: 1 je Sorte. Ein Seifenkorb mit zwei Seiten Vanille ergibt später automatisch 2.
 */
export function barsNeeded(order) {
  const need = new Map();
  if (!order) return need;
  for (const it of order.items || [{ mix: order.mix, qty: 1 }]) {
    for (const m of it.mix) {
      const bars = Math.max(1, Math.ceil(m.pct / PCT_PER_SLICE / BAR_SLICES)) * (it.qty || 1);
      need.set(m.soap.id, (need.get(m.soap.id) || 0) + bars);
    }
  }
  return need;
}
