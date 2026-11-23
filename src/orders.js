// Bestellungen: Kundschaft, gewünschte Seifen (aus den vorhandenen Sorten) und Belohnung.
import { SOAP_LIST, SOAPS } from './soaps.js';

const CUSTOMERS = ['Anna', 'Ben', 'Clara', 'Emil', 'Frieda', 'Jonas', 'Lea', 'Mila', 'Paul', 'Sophie', 'Greta', 'Oskar', 'Ida', 'Theo'];
let nextId = 1;

/** Neue Bestellung. first = allererste (Konzept: Erdbeere + Vanille). avoid = Namen, die schon am Brett hängen. */
export function makeOrder({ first = false, avoid = [], avoidRecipes = [] } = {}) {
  let customer;
  do { customer = CUSTOMERS[(Math.random() * CUSTOMERS.length) | 0]; } while (avoid.includes(customer) && avoid.length < CUSTOMERS.length);
  let soaps;
  if (first) soaps = [SOAPS.erdbeere, SOAPS.vanille];
  else {
    // meist zwei Sorten, manchmal drei (der Würfel-Pool reicht für drei Seifen)
    const n = Math.random() < 0.25 ? 3 : 2;
    for (let tries = 0; tries < 20; tries++) {   // keine zwei gleichen Rezepte gleichzeitig am Brett
      soaps = SOAP_LIST.slice().sort(() => Math.random() - 0.5).slice(0, n).sort((a, b) => a.id - b.id);
      if (!avoidRecipes.includes(soaps.map((s) => s.id).join('+'))) break;
    }
  }
  // Belohnung: Grundpreis pro Seife + etwas Trinkgeld
  const reward = soaps.length * 18 + 4 + ((Math.random() * 4) | 0) * 2;
  return { id: nextId++, customer, soaps, reward };
}
