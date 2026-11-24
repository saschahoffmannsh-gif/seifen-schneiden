// Bestellungen: Kundschaft, eine individuelle Mischung in Prozent (Schritte von 10 % = eine Scheibe),
// manchmal ein gewünschter Zusatz, und die Belohnung.
// Ein Auftrag hat eine oder mehrere Seifen: order.items = [{ mix, additive, shape, reward, qty }].
// Die Seifen werden nacheinander gemacht; order.cur ist die aktuelle, und mix/soaps/additive/shape/reward
// spiegeln sie (setItem). Puzzle: Ein Stück aus dem Schrank = 10 Scheiben = 100 % einer Seife.
// barsNeeded(order) = Stücke je Sorte, wenn man die Scheiben über alle Seifen addiert (ceil(Summe/10)).
// Seifenkörbe (mehrere Seifen in einer Verpackung) kommen später und setzen auf items/qty auf.
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

/**
 * Wie viele Seifen ein neuer Auftrag hat (Puzzle-Kurve nach abgeschlossenen Aufträgen `done`):
 *   Auftrag 1 (Lernauftrag): 1 Seife.
 *   ab Auftrag 2 (done 1–3): 60 % zwei Seifen, sonst eine.
 *   ab Auftrag 5 (done 4–7): 20 % drei, 55 % zwei, 25 % eine.
 *   ab Auftrag 9 (done ≥ 8): 35 % drei, 50 % zwei, 15 % eine.
 * Zusätzlich hängt ab dem Start immer mindestens ein Zwei-Seifen-Auftrag am Brett (forceMulti).
 */
export function soapCountFor(done, r = Math.random()) {
  if (done < 1) return 1;
  if (done < 4) return r < 0.6 ? 2 : 1;
  if (done < 8) return r < 0.2 ? 3 : r < 0.75 ? 2 : 1;
  return r < 0.35 ? 3 : r < 0.85 ? 2 : 1;
}

const shuffled = (a) => a.slice().sort(() => Math.random() - 0.5);
const pick = (a) => a[(Math.random() * a.length) | 0];

/** Eine Seife (item): Mischung aus kinds mit zufälligen 10er-Anteilen, ggf. ein Pflichtanteil für die erste Sorte. */
function makeMix(kinds, firstPct = 0) {
  if (firstPct) {
    const rest = kinds.length > 1 ? parts(kinds.length - 1).map((x) => x * (10 - firstPct / 10) / 10) : [];
    // Rest auf ganze 10er verteilen (mindestens 10 % je Sorte)
    let left = 100 - firstPct; const out = [{ soap: kinds[0], pct: firstPct }];
    for (let k = 1; k < kinds.length; k++) {
      const v = k === kinds.length - 1 ? left : Math.max(10, Math.min(left - 10 * (kinds.length - 1 - k), Math.round(rest[k - 1]) * 10 || 10));
      out.push({ soap: kinds[k], pct: v }); left -= v;
    }
    return out.sort((a, b) => b.pct - a.pct);
  }
  const p = parts(kinds.length);
  return kinds.map((soap, k) => ({ soap, pct: p[k] * 10 })).sort((a, b) => b.pct - a.pct);
}

/**
 * Neue Bestellung. first = allererste (Vanille 60 % · Erdbeere 40 %). avoid = Namen, die schon am Brett hängen.
 * done = abgeschlossene Aufträge (Kurve, siehe soapCountFor); soapCount erzwingt eine Anzahl Seifen.
 * Mehrere Seifen: alle teilen sich eine Sorte (das Rätsel: Anteile über die Seifen addieren),
 * höchstens 4 Sorten insgesamt (so viele Plätze hat das Regal).
 */
export function makeOrder({ first = false, avoid = [], avoidRecipes = [], done = 0, soapCount = 0 } = {}) {
  let customer;
  do { customer = CUSTOMERS[(Math.random() * CUSTOMERS.length) | 0]; } while (avoid.includes(customer) && avoid.length < CUSTOMERS.length);
  const n = first ? 1 : soapCount || soapCountFor(done);
  let mixes;
  if (first) mixes = [[{ soap: SOAPS.vanille, pct: 60 }, { soap: SOAPS.erdbeere, pct: 40 }]];
  else if (n === 1) {
    const k = Math.random() < 0.35 ? 3 : 2;
    for (let tries = 0; tries < 20; tries++) {   // keine zwei gleichen Rezepte gleichzeitig am Brett
      mixes = [makeMix(shuffled(SOAP_LIST).slice(0, k))];
      if (!avoidRecipes.includes(mixes[0].map((m) => m.soap.id + ':' + m.pct).join('+'))) break;
    }
  } else {
    // gemeinsame Sorte + je Seife 1 (bei 2 Seifen manchmal 2) weitere Sorten, insgesamt höchstens 4
    const pool = shuffled(SOAP_LIST), shared = pool[0], others = pool.slice(1);
    const extra = n === 2 && Math.random() < 0.35 ? 2 : 1;
    // Anteile der gemeinsamen Sorte: in gut der Hälfte der Aufträge zusammen über 100 % (dann 2 Stücke nötig)
    const over = Math.random() < 0.6;
    mixes = [];
    let used = 1, sum = 0;
    for (let k = 0; k < n; k++) {
      const kinds = [shared];
      for (let e = 0; e < extra; e++) {
        // neue Sorte, solange Platz ist, sonst eine schon benutzte wiederverwenden
        const fresh = others.filter((x) => !kinds.includes(x) && !mixes.some((m) => m.some((q) => q.soap === x)));
        const prev = [...new Set(mixes.flat().map((q) => q.soap))].filter((x) => x !== shared && !kinds.includes(x));
        kinds.push(used < 4 && fresh.length ? (used++, fresh[0]) : pick(prev.length ? prev : fresh));
      }
      const lo = over ? 50 : 20, hi = over ? 80 : 50;
      let sp = (lo + Math.floor(Math.random() * ((hi - lo) / 10 + 1)) * 10);
      if (k === n - 1 && !over) sp = Math.min(sp, Math.max(10, 100 - sum));   // knapp unter/auf 100 % bleiben
      if (k === n - 1 && over && sum + sp <= 100) sp = Math.min(90 - (kinds.length - 2) * 10, 110 - sum);
      sp = Math.max(10, Math.min(100 - (kinds.length - 1) * 10, sp));
      sum += sp;
      mixes.push(makeMix(kinds, sp));
    }
  }
  const items = mixes.map((mix, k) => {
    // manchmal ein Wunsch-Zusatz (nur freigeschaltete, damit es immer machbar ist); bei mehreren Seifen höchstens bei einer
    let additive = null;
    if (!first && (k === 0 || n === 1) && Math.random() < (n > 1 ? 0.25 : 0.4)) {
      const ok = ADDITIVES.filter((a) => a.unlocked);
      if (ok.length) additive = pick(ok);
    }
    // Seifenform: nur freigeschaltete; Klassisch bleibt häufig, besondere Formen bringen mehr
    let shape = DEFAULT_SHAPE;
    const special = SOAP_SHAPES.filter((s) => s.unlocked && s !== DEFAULT_SHAPE);
    if (!first && special.length && Math.random() < 0.6) shape = pick(special);
    const reward = 36 + mix.length * 4 + (additive ? 8 : 0) + shape.bonus + ((Math.random() * 4) | 0) * 2;
    return { mix, additive, shape, reward, qty: 1 };
  });
  const order = { id: nextId++, customer, items, cur: 0, total: items.reduce((a, it) => a + it.reward, 0) };
  return setItem(order, 0);
}

/** Aktuelle Seife k eines Auftrags: mix/soaps/additive/shape/reward spiegeln items[k] (der Rest des Spiels liest diese Felder). */
export function setItem(order, k) {
  const it = order.items[k];
  order.cur = k;
  order.mix = it.mix; order.soaps = it.mix.map((m) => m.soap);
  order.additive = it.additive; order.shape = it.shape; order.reward = it.reward;
  return order;
}

/** Scheiben je Sorte, die ab Seife `from` (inklusive) noch gebraucht werden: Map soapId -> Scheiben. */
export function slicesNeeded(order, from = 0) {
  const need = new Map();
  for (let k = from; k < order.items.length; k++) {
    const it = order.items[k];
    for (const m of it.mix) need.set(m.soap.id, (need.get(m.soap.id) || 0) + m.pct / PCT_PER_SLICE * (it.qty || 1));
  }
  return need;
}

/** Text wie "Vanille 60 % · Erdbeere 40 %". */
export const mixText = (mix) => mix.map((m) => `${m.soap.name} ${m.pct} %`).join(' · ');

/**
 * Bedarf an Seifenstücken je Sorte: Map soapId -> Stückzahl = aufgerundet (Scheiben über alle Seifen / 10).
 * Beispiel: Seife 1 mit 70 % Vanille + Seife 2 mit 40 % Vanille = 11 Scheiben -> 2 Stücke.
 * (Reste eines angeschnittenen Stücks bleiben innerhalb des Auftrags nutzbar.)
 */
export function barsNeeded(order) {
  const need = new Map();
  if (!order) return need;
  for (const [id, sl] of slicesNeeded(order)) need.set(id, Math.ceil(sl / BAR_SLICES - 1e-9));
  return need;
}

/** Alle Sorten eines Auftrags (über alle Seifen), in der Reihenfolge ihres ersten Auftretens. */
export function orderSorts(order) {
  const out = [];
  for (const it of order.items || [order]) for (const m of it.mix) if (!out.includes(m.soap)) out.push(m.soap);
  return out;
}
