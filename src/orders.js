// Bestellungen: Kundschaft, eine individuelle Mischung in Prozent (Schritte von 10 % = eine Scheibe),
// manchmal ein gewünschter Zusatz, und die Belohnung.
// Datenmodell offen für später (mehrere Seifen in einem größeren Päckchen): order.items = [{ mix, additive }];
// heute hat jede Bestellung genau ein item, die Felder mix/soaps/additive spiegeln es.
import { SOAP_LIST, SOAPS } from './soaps.js';
import { ADDITIVES } from './additives.js';

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
  const reward = 36 + mix.length * 4 + (additive ? 8 : 0) + ((Math.random() * 4) | 0) * 2;
  const soaps = mix.map((m) => m.soap);
  return { id: nextId++, customer, mix, soaps, additive, reward, items: [{ mix, additive }] };
}

/** Text wie "Vanille 60 % · Erdbeere 40 %". */
export const mixText = (mix) => mix.map((m) => `${m.soap.name} ${m.pct} %`).join(' · ');
