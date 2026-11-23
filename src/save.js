// Spielstand im Browser (localStorage): Münzen und freigeschaltete Päckchen/Deko.
const KEY = 'seifen-save-v1';

function read() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}
const data = Object.assign({ coins: 0, unlocked: [], stock: {} }, read());
// Alte Spielstände: Lavendelzweige und lose Rosenblätter gibt es nicht mehr (nur noch echte Blüten).
// Wer sie gekauft hatte, bekommt die gleichwertige Blüte frei; unbekannte Einträge stören nicht.
const RENAMED = { 'deco:lavendel': 'deco:hortensien', 'deco:rosenblaetter': 'deco:kirschblueten' };
if (!Array.isArray(data.unlocked)) data.unlocked = [];
if (!data.stock || typeof data.stock !== 'object') data.stock = {};
data.unlocked = [...new Set(data.unlocked.filter((x) => typeof x === 'string').map((x) => RENAMED[x] || x))];

// Seifen-Vorrat im Schrank, in Scheiben (10 Scheiben = ein ganzes Stück). Start: 2 Stück je Sorte.
export const STOCK_START = 20, STOCK_MAX = 30, BAR_SLICES = 10, BAR_PRICE = 6;

export const save = {
  get coins() { return data.coins; },
  set coins(v) { data.coins = v; this.flush(); },
  isUnlocked(id) { return data.unlocked.includes(id); },
  unlock(id) { if (!data.unlocked.includes(id)) data.unlocked.push(id); this.flush(); },
  /** Vorrat einer Sorte (Scheiben). */
  stock(id) { return data.stock[id] ?? STOCK_START; },
  setStock(id, n) { data.stock[id] = Math.max(0, Math.min(STOCK_MAX, n)); this.flush(); },
  flush() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* privat-Modus: egal */ } },
};

/** Freigeschaltet-Status aus dem Spielstand auf eine Liste übertragen (Präfix trennt Päckchen/Deko). */
export function applyUnlocks(list, prefix) {
  for (const t of list) if (!t.unlocked && save.isUnlocked(prefix + t.id)) t.unlocked = true;
}
