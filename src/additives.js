// Hochwertige Zusätze für die Seifenmasse: kommen vor dem Schmelzen in die Schale.
// Wirkung auf die fertige Seife: Glanz (sheen), Sprenkel in der Textur (specks), Tönung (tint),
// eingebettete Perlen bzw. Goldflocken (instanzierte Teilchen auf der Oberfläche).
// Freischalten mit Münzen wie Päckchen/Deko (Spielstand-Präfix 'add:').

export const ADD_CATS = ['Pflege', 'Duft', 'Optik'];
export const MAX_ADDITIVES = 2;

const A = (id, cat, name, emoji, cost, bonus, fx) => ({ id, cat, name, emoji, cost, bonus, fx, unlocked: cost === 0 });

export const ADDITIVES = [
  A('lavendeloel', 'Duft', 'Lavendelöl', '💧', 0, 3, { specks: { colors: ['#8e6cc4'], n: 50, r: [1.2, 2.2] } }),
  A('blueten', 'Optik', 'Getrocknete Blüten', '🌸', 0, 3, { specks: { colors: ['#d9486a', '#f2c14e', '#9c6ad0'], n: 90, r: [1.5, 3], petal: true } }),
  A('sheabutter', 'Pflege', 'Sheabutter', '🧈', 40, 5, { sheen: 0.12, tint: ['#fff3d6', 0.18] }),
  A('honig', 'Pflege', 'Honig', '🍯', 50, 5, { sheen: 0.1, tint: ['#e6a23a', 0.2] }),
  A('ziegenmilch', 'Pflege', 'Ziegenmilch', '🥛', 60, 6, { sheen: 0.06, tint: ['#ffffff', 0.3] }),
  A('bienenwachs', 'Pflege', 'Bienenwachs', '🐝', 70, 6, { sheen: 0.18, tint: ['#f2d06b', 0.12] }),
  A('arganoel', 'Pflege', 'Arganöl', '🫒', 80, 7, { sheen: 0.22, tint: ['#d9b45a', 0.08] }),
  A('rosenoel', 'Duft', 'Rosenöl', '🌹', 90, 7, { specks: { colors: ['#e05a88'], n: 70, r: [1.2, 2] }, tint: ['#f6c6de', 0.08] }),
  A('orangenoel', 'Duft', 'Orangenöl', '🍊', 50, 5, { specks: { colors: ['#f39448'], n: 60, r: [1.2, 2] } }),
  A('mohn', 'Optik', 'Mohnsamen', '⚫', 40, 4, { specks: { colors: ['#20202a', '#3a3a48'], n: 220, r: [1.2, 1.8] } }),
  A('aktivkohle', 'Optik', 'Aktivkohle-Wirbel', '🖤', 60, 5, { specks: { colors: ['#2a2a30'], n: 26, r: [3, 6] } }),
  A('goldflocken', 'Optik', 'Goldflocken', '✨', 150, 10, { flakes: { color: '#e5c25c', n: 34 } }),
  A('perlen', 'Optik', 'Perlen in der Seife', '⚪', 120, 9, { pearls: { color: '#fbf6ee', n: 36 } }),
];
export const ADD_BY_ID = Object.fromEntries(ADDITIVES.map((a) => [a.id, a]));

/** Kleines Bildchen für die Auswahl (Canvas, einmalig). */
const thumbs = {};
export function additiveThumb(a) {
  if (thumbs[a.id]) return thumbs[a.id];
  const c = document.createElement('canvas'); c.width = c.height = 160;
  const g = c.getContext('2d');
  // Schälchen
  g.fillStyle = '#efe4d2'; g.beginPath(); g.ellipse(80, 100, 62, 34, 0, 0, 6.283); g.fill();
  g.fillStyle = '#d9c7a8'; g.beginPath(); g.ellipse(80, 92, 54, 24, 0, 0, 6.283); g.fill();
  const fx = a.fx;
  const r = (() => { let s = a.id.length * 97 + 13; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  if (fx.pearls) for (let i = 0; i < 12; i++) { const x = 50 + r() * 60, y = 82 + r() * 18; const gr = g.createRadialGradient(x - 3, y - 3, 1, x, y, 8); gr.addColorStop(0, '#fff'); gr.addColorStop(1, '#d8cfc0'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, 7, 0, 6.283); g.fill(); }
  else if (fx.flakes) for (let i = 0; i < 18; i++) { g.fillStyle = i % 3 ? '#e5c25c' : '#f6e3a0'; g.save(); g.translate(46 + r() * 68, 80 + r() * 22); g.rotate(r() * 3); g.fillRect(-6, -3, 12, 6); g.restore(); }
  else if (fx.specks) { const s = fx.specks; for (let i = 0; i < 40; i++) { g.fillStyle = s.colors[i % s.colors.length]; g.beginPath(); g.arc(44 + r() * 72, 80 + r() * 24, (s.r[0] + r() * (s.r[1] - s.r[0])) * 2.2, 0, 6.283); g.fill(); } }
  else { g.fillStyle = fx.tint ? fx.tint[0] : '#fff'; g.beginPath(); g.ellipse(80, 92, 44, 17, 0, 0, 6.283); g.fill(); g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.ellipse(66, 87, 14, 5, -0.3, 0, 6.283); g.fill(); }
  g.font = '44px serif'; g.textAlign = 'center'; g.fillText(a.emoji, 80, 50);
  return (thumbs[a.id] = c.toDataURL());
}
