// Spielstand im Browser (localStorage): Münzen und freigeschaltete Päckchen/Deko.
const KEY = 'seifen-save-v1';

function read() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}
const data = Object.assign({ coins: 0, unlocked: [] }, read());

export const save = {
  get coins() { return data.coins; },
  set coins(v) { data.coins = v; this.flush(); },
  isUnlocked(id) { return data.unlocked.includes(id); },
  unlock(id) { if (!data.unlocked.includes(id)) data.unlocked.push(id); this.flush(); },
  flush() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* privat-Modus: egal */ } },
};

/** Freigeschaltet-Status aus dem Spielstand auf eine Liste übertragen (Präfix trennt Päckchen/Deko). */
export function applyUnlocks(list, prefix) {
  for (const t of list) if (!t.unlocked && save.isUnlocked(prefix + t.id)) t.unlocked = true;
}
