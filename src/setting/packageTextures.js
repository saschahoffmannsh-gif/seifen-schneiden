// Prozedurale Päckchen-Texturen (einmalig beim Start per Canvas gezeichnet).
// Eckige Sorten liegen in EINEM Atlas: oben die Deckel-Kacheln, unten die Schachtel-Kacheln,
// eine Spalte pro Sorte. Bänder/Schnüre werden in ihrer eigenen Farbe gemalt (kein Einfärben).
import * as THREE from 'three';
import { rng } from './textures.js';

export const TILE = 256;
const SERIF = "'Fraunces', Georgia, serif";

function fibres(g, x0, y0, S, seed, dark = 'rgba(90,60,35,0.16)', light = 'rgba(255,255,255,0.22)', n = 900) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const x = x0 + r() * S, y = y0 + r() * S, l = 3 + r() * 9, a = r() * Math.PI;
    g.strokeStyle = r() < 0.5 ? dark : light; g.lineWidth = 0.6 + r();
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
}

/** Band mit leichtem Glanz (Satin) – senkrecht oder waagerecht durch die Mitte. */
function band(g, x0, y0, S, w, color, shine, vertical) {
  const c = x0 + S / 2, m = y0 + S / 2;
  const grad = vertical ? g.createLinearGradient(c - w / 2, 0, c + w / 2, 0) : g.createLinearGradient(0, m - w / 2, 0, m + w / 2);
  grad.addColorStop(0, color); grad.addColorStop(0.45, shine); grad.addColorStop(1, color);
  g.fillStyle = grad;
  if (vertical) g.fillRect(c - w / 2, y0, w, S); else g.fillRect(x0, m - w / 2, S, w);
}

/** Rot-weiße Bäckerschnur (gedreht). */
function string(g, x0, y0, S, vertical) {
  const w = 12, c = x0 + S / 2, m = y0 + S / 2;
  g.save(); g.beginPath();
  if (vertical) g.rect(c - w / 2, y0, w, S); else g.rect(x0, m - w / 2, S, w);
  g.clip();
  g.fillStyle = '#f7f2ea'; g.fillRect(x0, y0, S, S);
  g.strokeStyle = '#c62f2f'; g.lineWidth = 4;
  for (let k = -S; k < S * 2; k += 11) {
    g.beginPath();
    if (vertical) { g.moveTo(c - w, y0 + k); g.lineTo(c + w, y0 + k + 10); } else { g.moveTo(x0 + k, m - w); g.lineTo(x0 + k + 10, m + w); }
    g.stroke();
  }
  g.restore();
}

function edges(g, x0, y0, S, color, inset = 7, width = 4) {
  g.strokeStyle = color; g.lineWidth = width;
  g.strokeRect(x0 + inset, y0 + inset, S - 2 * inset, S - 2 * inset);
}

// SS-17: Gold-/Folien-Akzente. Was golden gemalt wird, landet zusätzlich weiß in der Effekt-Maske (Kanal R)
// -> im Material echtes Metall (glänzt mit der Umgebung). F = Masken-Kontext oder null (Einzeltextur).
function goldGrad(g, x, y, S) {
  const gr = g.createLinearGradient(x, y, x + S, y + S);
  gr.addColorStop(0, '#f7e08a'); gr.addColorStop(0.35, '#d9a93a'); gr.addColorStop(0.55, '#fff0b0'); gr.addColorStop(0.8, '#c8902a'); gr.addColorStop(1, '#f2d27a');
  return gr;
}
function gold(g, F, x, y, S, path, stroke = 0) {
  for (const [c, style] of [[g, goldGrad(g, x, y, S)], [F, '#ff0']]) {
    if (!c) continue;
    c.save(); c.beginPath(); path(c);
    if (stroke) { c.strokeStyle = style; c.lineWidth = stroke; c.stroke(); } else { c.fillStyle = style; c.fill(); }
    c.restore();
  }
}
const goldFrame = (g, F, x, y, S, inset, w) => gold(g, F, x, y, S, (c) => c.rect(x + inset, y + inset, S - 2 * inset, S - 2 * inset), w);
function star(c, cx, cy, s, n = 5) { for (let k = 0; k < n * 2; k++) { const a = k / (n * 2) * 6.283 - Math.PI / 2, d = k % 2 ? s * 0.42 : s; c.lineTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d); } c.closePath(); }
function dots(g, x, y, S, step, r, color) {
  g.fillStyle = color;
  for (let j = 0; j <= S / step; j++) for (let i = 0; i <= S / step; i++) { g.beginPath(); g.arc(x + i * step + (j % 2) * step / 2, y + j * step + step / 2, r, 0, 6.283); g.fill(); }
}

// Glanz je Sorte (0 = mattes Papier … 1 = Lack); teurere Sorten glänzen. Kanal G der Effekt-Maske.
export const PKG_GLOSS = { candy: 0.7, rosa: 0.6, mint: 0.45, aquarell: 0.3, terrazzo: 0.45, marmor: 0.85, weihnacht: 0.55, blumen: 0.4, hut: 0.45,
  furoshiki: 0.5, wabe: 0.6, noir: 0.9, sterne: 0.7, herz: 0.9, dose: 0.6 };

// Jede Sorte: draw(g, x0, y0, S, isLid, F). Steigerung nach Preis: Basis-Kartons schlicht, teure satt, kontrastreich, mit Goldfolie.
// Bewusst KEINE gemalten Bänder/Schleifen (Schleife ist nur das freiwillige Extra des Spielers).
const DESIGNS = {
  kraft(g, x, y, S, lid) {
    g.fillStyle = '#c39563'; g.fillRect(x, y, S, S);
    fibres(g, x, y, S, lid ? 47 : 31, 'rgba(90,55,25,0.2)', 'rgba(240,205,160,0.2)', 1200);
  },
  kraft0(g, x, y, S, lid) {
    g.fillStyle = '#c39563'; g.fillRect(x, y, S, S);
    fibres(g, x, y, S, lid ? 48 : 32, 'rgba(90,55,25,0.2)', 'rgba(240,205,160,0.2)', 1200);
  },
  banderole(g, x, y, S, lid) {
    DESIGNS.kraft0(g, x, y, S, lid);
    // breite bedruckte Banderole (Papier-Bauchbinde, kein Band) mit Etikett
    g.fillStyle = '#f4ead8'; g.fillRect(x + S * 0.3, y, S * 0.4, S);
    g.strokeStyle = '#6b4a2c'; g.lineWidth = 2; g.strokeRect(x + S * 0.33, y + 3, S * 0.34, S - 6);
    if (lid) { g.fillStyle = '#6b4a2c'; g.font = `600 22px ${SERIF}`; g.textAlign = 'center'; g.fillText('SEIFE', x + S / 2, y + S / 2 + 8); }
  },
  fenster(g, x, y, S, lid) {
    g.fillStyle = '#fbf7f1'; g.fillRect(x, y, S, S);
    fibres(g, x, y, S, 12, 'rgba(120,100,80,0.06)', 'rgba(255,255,255,0.3)', 300);
    if (lid) {
      const gr = g.createLinearGradient(x, y, x + S, y + S);
      gr.addColorStop(0, '#f4c3cf'); gr.addColorStop(0.5, '#f9dde4'); gr.addColorStop(1, '#efb2c2');
      g.fillStyle = gr; g.beginPath(); g.roundRect(x + S * 0.2, y + S * 0.2, S * 0.6, S * 0.6, 26); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.beginPath(); g.moveTo(x + S * 0.28, y + S * 0.7); g.lineTo(x + S * 0.5, y + S * 0.24); g.lineTo(x + S * 0.6, y + S * 0.24); g.lineTo(x + S * 0.38, y + S * 0.7); g.fill();
      g.strokeStyle = '#d9c7b0'; g.lineWidth = 4; g.beginPath(); g.roundRect(x + S * 0.2, y + S * 0.2, S * 0.6, S * 0.6, 26); g.stroke();
    } else edges(g, x, y, S, '#e7d9c6', 10, 3);
  },
  zeitung(g, x, y, S, lid) {
    g.fillStyle = '#ece7da'; g.fillRect(x, y, S, S);
    const r = rng(lid ? 3 : 4);
    g.fillStyle = 'rgba(40,40,40,0.75)'; g.font = `600 20px ${SERIF}`; g.textAlign = 'left';
    g.fillText('TAGESBLATT', x + 12, y + 28);
    for (let c = 0; c < 3; c++) for (let l = 0; l < 22; l++) {
      const w = (S / 3 - 14) * (0.6 + r() * 0.4);
      g.fillStyle = 'rgba(50,50,50,' + (0.25 + r() * 0.2) + ')';
      g.fillRect(x + 8 + c * S / 3, y + 42 + l * 9.5, w, 3);
    }
  },
  rosa(g, x, y, S, lid) {
    // Rosa Bonbon: knalliges Pink, weiße Punkte, Lack
    const gr = g.createLinearGradient(x, y, x, y + S); gr.addColorStop(0, '#ff6fa8'); gr.addColorStop(1, '#f0408a');
    g.fillStyle = gr; g.fillRect(x, y, S, S);
    dots(g, x, y, S, 30, 6.5, '#ffffff');
    if (lid) edges(g, x, y, S, '#ffffff', 8, 6);
  },
  mint(g, x, y, S, lid) {
    g.fillStyle = '#2fcf9f'; g.fillRect(x, y, S, S);
    dots(g, x, y, S, 32, 6, '#ffffff');
    dots(g, x + 16, y + 16, S - 16, 64, 4, '#ffe066');
    if (lid) edges(g, x, y, S, '#ffffff', 6, 7);
  },
  candy(g, x, y, S, lid) {
    g.save(); g.beginPath(); g.rect(x, y, S, S); g.clip();
    g.fillStyle = '#ffffff'; g.fillRect(x, y, S, S);
    g.fillStyle = '#e3122f';
    const w = lid ? 18 : 22;
    for (let k = -S; k < S * 2; k += w * 2) {
      g.beginPath(); g.moveTo(x + k, y); g.lineTo(x + k + w, y); g.lineTo(x + k + w - S, y + S); g.lineTo(x + k - S, y + S); g.closePath(); g.fill();
    }
    g.restore();
  },
  aquarell(g, x, y, S, lid, F) {
    g.fillStyle = '#fff8f0'; g.fillRect(x, y, S, S);
    const r = rng(lid ? 21 : 22), C = ['rgba(40,140,240,0.55)', 'rgba(250,70,140,0.55)', 'rgba(140,80,235,0.5)', 'rgba(20,200,170,0.5)', 'rgba(255,170,40,0.5)'];
    for (let i = 0; i < 30; i++) {
      const cx = x + r() * S, cy = y + r() * S, rad = 18 + r() * 42;
      const gr = g.createRadialGradient(cx, cy, rad * 0.2, cx, cy, rad);
      const c = C[i % C.length]; gr.addColorStop(0, c); gr.addColorStop(0.8, c); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, rad, 0, 6.283); g.fill();
    }
    goldFrame(g, F, x, y, S, 6, 6);
  },
  leinen(g, x, y, S, lid, F) {
    // tiefes Petrol-Leinen mit goldgerahmtem Etikett
    g.fillStyle = '#1f6f78'; g.fillRect(x, y, S, S);
    for (let i = 0; i < S; i += 3) {
      g.fillStyle = 'rgba(255,255,255,' + (0.05 + (i % 7) * 0.01) + ')'; g.fillRect(x + i, y, 1.5, S);
      g.fillStyle = 'rgba(0,30,35,' + (0.06 + (i % 5) * 0.012) + ')'; g.fillRect(x, y + i, S, 1.2);
    }
    if (lid) {
      g.fillStyle = '#fbf3e2'; g.fillRect(x + S * 0.28, y + S * 0.36, S * 0.44, S * 0.28);
      gold(g, F, x, y, S, (c) => c.rect(x + S * 0.28, y + S * 0.36, S * 0.44, S * 0.28), 5);
      g.fillStyle = '#1f6f78'; g.font = `600 22px ${SERIF}`; g.textAlign = 'center'; g.fillText('SAVON', x + S / 2, y + S / 2 + 8);
    } else gold(g, F, x, y, S, (c) => { c.rect(x, y + 10, S, 5); c.rect(x, y + S - 15, S, 5); });
  },
  terrazzo(g, x, y, S, lid, F) {
    g.fillStyle = '#ffd3dc'; g.fillRect(x, y, S, S);
    const r = rng(lid ? 31 : 32), C = ['#ff5a36', '#0f7c6c', '#ffb703', '#3a86ff', '#e63973', '#2b2d42'];
    for (let i = 0; i < 95; i++) {
      const cx = x + r() * S, cy = y + r() * S, rad = 3 + r() * 10, n = 5 + ((r() * 3) | 0);
      const pts = []; for (let k = 0; k < n; k++) { const a = k / n * 6.283 + r(), d = rad * (0.6 + r() * 0.5); pts.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d]); }
      const path = (c) => { pts.forEach(([px, py]) => c.lineTo(px, py)); c.closePath(); };
      if (i % 9 === 0) gold(g, F, x, y, S, path); else { g.fillStyle = C[(r() * C.length) | 0]; g.beginPath(); path(g); g.fill(); }
    }
  },
  kiste(g, x, y, S, lid) {
    // Holzlatten mit Fugen und Nagelköpfen
    const r = rng(lid ? 61 : 62), n = 4;
    for (let k = 0; k < n; k++) {
      const yy = y + k * S / n;
      g.fillStyle = ['#d3a56c', '#c99a60', '#dcb07a', '#c48f55'][k];
      g.fillRect(x, yy, S, S / n);
      for (let i = 0; i < 40; i++) { g.strokeStyle = 'rgba(110,70,30,' + (0.1 + r() * 0.15) + ')'; g.lineWidth = 1; const ly = yy + r() * S / n; g.beginPath(); g.moveTo(x, ly); g.bezierCurveTo(x + S / 3, ly + (r() - 0.5) * 6, x + S * 2 / 3, ly + (r() - 0.5) * 6, x + S, ly); g.stroke(); }
      g.fillStyle = 'rgba(70,40,15,0.6)'; g.fillRect(x, yy, S, 3);
      g.fillStyle = '#6a6460'; for (const nx of [12, S - 12]) { g.beginPath(); g.arc(x + nx, yy + S / n / 2, 3.5, 0, 6.283); g.fill(); }
    }
    if (lid) { g.fillStyle = 'rgba(60,35,15,0.75)'; g.font = `600 24px ${SERIF}`; g.textAlign = 'center'; g.fillText('HANDMADE', x + S / 2, y + S / 2 + 8); }
  },
  korb(g, x, y, S) {
    g.fillStyle = '#9c6b34'; g.fillRect(x, y, S, S);
    const h = 16;
    for (let row = 0; row < S / h; row++) for (let col = 0; col < S / 20 + 1; col++) {
      const ox = (row % 2) * 10, cx = x + col * 20 - ox, cy = y + row * h;
      const gr = g.createLinearGradient(0, cy, 0, cy + h);
      gr.addColorStop(0, '#f0c27e'); gr.addColorStop(0.5, '#d4964a'); gr.addColorStop(1, '#8e5420');
      g.fillStyle = gr; g.beginPath(); g.roundRect(cx + 1, cy + 1, 18, h - 2, 6); g.fill();
    }
  },
  marmor(g, x, y, S, lid, F) {
    // Smaragd-Marmor mit Goldadern
    const gr = g.createLinearGradient(x, y, x + S, y + S); gr.addColorStop(0, '#0b5e4a'); gr.addColorStop(0.5, '#118a68'); gr.addColorStop(1, '#07402f');
    g.fillStyle = gr; g.fillRect(x, y, S, S);
    const r = rng(lid ? 41 : 42);
    for (let i = 0; i < 12; i++) {
      const pts = []; let px = x + r() * S, py = y; pts.push([px, py]);
      while (py < y + S) { px += (r() - 0.5) * 44; py += 10 + r() * 16; pts.push([px, py]); }
      const path = (c) => { c.moveTo(pts[0][0], pts[0][1]); pts.forEach(([a, b]) => c.lineTo(a, b)); };
      if (i % 3 === 0) gold(g, F, x, y, S, path, 2.5);
      else { g.strokeStyle = 'rgba(210,255,235,' + (0.18 + r() * 0.25) + ')'; g.lineWidth = 0.8 + r() * 2; g.beginPath(); path(g); g.stroke(); }
    }
    goldFrame(g, F, x, y, S, 5, 5);
  },
  weihnacht(g, x, y, S, lid, F) {
    const gr = g.createLinearGradient(x, y, x, y + S); gr.addColorStop(0, '#d0102b'); gr.addColorStop(1, '#a00a20');
    g.fillStyle = gr; g.fillRect(x, y, S, S);
    const r = rng(lid ? 81 : 82);
    for (let i = 0; i < 22; i++) {
      const cx = x + r() * S, cy = y + r() * S, s = 6 + r() * 7;
      if (i % 2) gold(g, F, x, y, S, (c) => star(c, cx, cy, s));
      else { g.strokeStyle = '#ffffff'; g.lineWidth = 2; for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI; g.beginPath(); g.moveTo(cx - Math.cos(a) * s, cy - Math.sin(a) * s); g.lineTo(cx + Math.cos(a) * s, cy + Math.sin(a) * s); g.stroke(); } }
    }
    gold(g, F, x, y, S, (c) => { c.rect(x, y + 6, S, 6); c.rect(x, y + S - 12, S, 6); });
  },
  blumen(g, x, y, S, lid, F) {
    g.fillStyle = '#1b2a5e'; g.fillRect(x, y, S, S);
    const r = rng(lid ? 51 : 52);
    for (let i = 0; i < 16; i++) {
      const fx = x + r() * S, fy = y + r() * S, s = 9 + r() * 8;
      g.fillStyle = '#2fbf71';
      for (const a of [0.6, 2.4, 4.2]) { g.beginPath(); g.ellipse(fx + Math.cos(a) * s * 1.4, fy + Math.sin(a) * s * 1.4, s * 0.7, s * 0.35, a, 0, 6.283); g.fill(); }
      g.fillStyle = ['#ff4f8b', '#ff9f1c', '#ffd23f', '#c77dff'][i % 4];
      for (let p = 0; p < 6; p++) { const a = p / 6 * 6.283; g.beginPath(); g.arc(fx + Math.cos(a) * s * 0.6, fy + Math.sin(a) * s * 0.6, s * 0.5, 0, 6.283); g.fill(); }
      gold(g, F, x, y, S, (c) => c.arc(fx, fy, s * 0.33, 0, 6.283));
    }
    goldFrame(g, F, x, y, S, 6, 5);
  },
  dose(g, x, y, S, lid) {
    // (bestehende Blechdose, unverändert – echte Metalldosen als eigene Behälterart kommen später)
    const gr = g.createLinearGradient(x, y, x + S, y);
    gr.addColorStop(0, '#5f8f8a'); gr.addColorStop(0.35, '#a8d0c9'); gr.addColorStop(0.6, '#6f9e98'); gr.addColorStop(1, '#4e7a75');
    g.fillStyle = gr; g.fillRect(x, y, S, S);
    g.fillStyle = 'rgba(255,255,255,0.8)'; for (let i = 0; i < S; i += 24) g.fillRect(x + i, y, 4, S);
    if (!lid) { g.fillStyle = '#f3e9d3'; g.fillRect(x, y + S * 0.3, S, S * 0.4); g.fillStyle = '#7a4a2a'; g.font = `600 26px ${SERIF}`; g.textAlign = 'center'; g.fillText('SAVON', x + S / 2, y + S / 2 + 9); }
  },
  hut(g, x, y, S, lid, F) {
    // Hutschachtel: kräftiges Violett mit weißen Blümchen, Goldrand
    g.fillStyle = '#8b46d6'; g.fillRect(x, y, S, S);
    const r = rng(77);
    for (let i = 0; i < 40; i++) {
      const fx = x + r() * S, fy = y + r() * S;
      g.fillStyle = 'rgba(255,255,255,0.92)';
      for (let p = 0; p < 5; p++) { const a = p / 5 * 6.283; g.beginPath(); g.arc(fx + Math.cos(a) * 4, fy + Math.sin(a) * 4, 3, 0, 6.283); g.fill(); }
      g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(fx, fy, 2.2, 0, 6.283); g.fill();
    }
    gold(g, F, x, y, S, (c) => { c.rect(x, y + 4, S, 7); c.rect(x, y + S - 11, S, 7); });
  },
  furoshiki(g, x, y, S, lid, F) {
    // Seigaiha-Wellen: Kobaltblau, jede zweite Welle Gold
    g.fillStyle = '#1640b8'; g.fillRect(x, y, S, S);
    const R = 22;
    for (let row = 0; row < S / (R / 2) + 2; row++) for (let col = -1; col < S / (R * 2) + 1; col++) {
      const cx = x + col * R * 2 + (row % 2) * R, cy = y + row * R / 2;
      for (let k = 4; k >= 1; k--) {
        if (k === 4 && row % 3 === 0) { gold(g, F, x, y, S, (c) => c.arc(cx, cy, R, Math.PI, 0)); continue; }
        g.fillStyle = k % 2 ? '#1640b8' : '#f2f5ff'; g.beginPath(); g.arc(cx, cy, R * k / 4, Math.PI, 0); g.fill();
      }
    }
  },
  wabe(g, x, y, S, lid, F) {
    g.fillStyle = '#ffb000'; g.fillRect(x, y, S, S);
    const R = 18, w = R * Math.sqrt(3);
    for (let row = -1; row < S / (R * 1.5) + 1; row++) for (let col = -1; col < S / w + 1; col++) {
      const cx = x + col * w + (row % 2) * w / 2, cy = y + row * R * 1.5;
      const hex = (c) => { for (let k = 0; k < 6; k++) { const a = k / 6 * 6.283 + Math.PI / 6; c.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); } c.closePath(); };
      g.fillStyle = (row + col) % 3 ? 'rgba(255,240,170,0.35)' : 'rgba(200,90,0,0.25)'; g.beginPath(); hex(g); g.fill();
      gold(g, F, x, y, S, hex, 2.5);
    }
    if (lid) { g.fillStyle = '#4a2600'; g.font = `600 28px ${SERIF}`; g.textAlign = 'center'; g.fillText('HONIG', x + S / 2, y + S / 2 + 10); }
  },
  noir(g, x, y, S, lid, F) {
    // Schwarz-Lack mit Art-déco-Goldfolie
    g.fillStyle = '#0e0d10'; g.fillRect(x, y, S, S);
    goldFrame(g, F, x, y, S, 6, 5); goldFrame(g, F, x, y, S, 16, 2);
    const cx = x + S / 2, cy = y + S - 16;
    for (let k = -4; k <= 4; k++) gold(g, F, x, y, S, (c) => { c.moveTo(cx, cy); c.lineTo(cx + k * S * 0.1, y + S * 0.42); }, 2);
    gold(g, F, x, y, S, (c) => c.arc(cx, cy, S * 0.12, Math.PI, 0), 3);
    if (lid) { g.font = `600 64px ${SERIF}`; g.textAlign = 'center'; for (const c of [g, F]) { if (!c) continue; c.fillStyle = c === g ? goldGrad(g, x, y, S) : '#ff0'; c.font = g.font; c.textAlign = 'center'; c.fillText('S', x + S / 2, y + S * 0.38); } }
  },
  sterne(g, x, y, S, lid, F) {
    const gr = g.createLinearGradient(x, y, x, y + S); gr.addColorStop(0, '#2a1260'); gr.addColorStop(1, '#0d1a4a');
    g.fillStyle = gr; g.fillRect(x, y, S, S);
    const r = rng(lid ? 91 : 92);
    for (let i = 0; i < 34; i++) {
      const cx = x + r() * S, cy = y + r() * S, s = 2.5 + r() * 7;
      if (r() < 0.75) gold(g, F, x, y, S, (c) => star(c, cx, cy, s));
      else { g.fillStyle = '#ffffff'; g.beginPath(); star(g, cx, cy, s * 0.6); g.fill(); }
    }
  },
  herz(g, x, y, S, lid, F) {
    const gr = g.createLinearGradient(x, y, x, y + S);
    gr.addColorStop(0, '#ff2a4f'); gr.addColorStop(1, '#c4002a');
    g.fillStyle = gr; g.fillRect(x, y, S, S);
    goldFrame(g, F, x, y, S, 10, 5); goldFrame(g, F, x, y, S, 20, 2);
  },
};

/** Sättigung je Preisstufe: Basis etwas gedämpft, teure Sorten satter als gemalt. */
function tierSat(cost) { return cost < 100 ? 0.82 : cost < 250 ? 1.0 : 1.15; }

/** Atlas für ALLE Sorten: ATLAS_COLS Spalten; je Sorte zwei Zeilen (oben Deckel, darunter Schachtel).
 *  types: [{ id, cost }] (oder nur ids). Liefert Farb-Atlas + Effekt-Maske (R = Goldfolie/Metall, G = Lack-Glanz). */
export const ATLAS_COLS = 8;
export function makePackageAtlas(types) {
  const list = types.map((t) => (typeof t === 'string' ? { id: t, cost: 0 } : t));
  const S = TILE, n = list.length, rows = Math.ceil(n / ATLAS_COLS) * 2;
  const c = document.createElement('canvas'); c.width = S * ATLAS_COLS; c.height = S * rows;
  const m = document.createElement('canvas'); m.width = c.width / 2; m.height = c.height / 2;   // Maske in halber Auflösung reicht
  const g = c.getContext('2d'), mg = m.getContext('2d');
  const draw = () => {
    g.clearRect(0, 0, c.width, c.height);
    mg.setTransform(1, 0, 0, 1, 0, 0); mg.fillStyle = '#000'; mg.fillRect(0, 0, m.width, m.height); mg.setTransform(0.5, 0, 0, 0.5, 0, 0);
    list.forEach((t, i) => {
      const x = (i % ATLAS_COLS) * S, y = Math.floor(i / ATLAS_COLS) * 2 * S;
      const gl = Math.round((PKG_GLOSS[t.id] || 0) * 255);
      for (const [lid, yy] of [[true, y], [false, y + S]]) {
        mg.fillStyle = `rgb(0,${gl},0)`; mg.fillRect(x, yy, S, S);
        for (const ctx of [g, mg]) { ctx.save(); ctx.beginPath(); ctx.rect(x, yy, S, S); ctx.clip(); }
        DESIGNS[t.id](g, x, yy, S, lid, mg);
        finish(g, x, yy, S, i * 2 + (lid ? 0 : 1), PKG_GLOSS[t.id] || 0);
        for (const ctx of [g, mg]) ctx.restore();
        grade(g, x, yy, S, S, tierSat(t.cost));
      }
    });
  };
  draw();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  const fx = new THREE.CanvasTexture(m);
  fx.colorSpace = THREE.NoColorSpace;
  // Beschriftungen in Fraunces: sobald die Schrift geladen ist, einmal neu zeichnen
  if (document.fonts && document.fonts.load) document.fonts.load(`600 24px ${SERIF}`).then(() => { draw(); t.needsUpdate = true; fx.needsUpdate = true; }).catch(() => {});
  return { tex: t, fx, rows };
}

/** Feinschliff je Kachel: Papierkorn + leicht dunklere Kanten (Lack-Sorten: weniger Korn, glatter). */
function finish(g, x, y, S, seed, gloss = 0) {
  const r = rng(101 + seed), nGrain = Math.round(1600 * (1 - gloss * 0.8));
  for (let i = 0; i < nGrain; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(70,45,25,0.045)' : 'rgba(255,250,240,0.06)';
    g.fillRect(x + r() * S, y + r() * S, 1 + r(), 1 + r());
  }
  const e = g.createRadialGradient(x + S / 2, y + S / 2, S * 0.42, x + S / 2, y + S / 2, S * 0.75);
  e.addColorStop(0, 'rgba(60,40,22,0)'); e.addColorStop(1, `rgba(60,40,22,${0.16 * (1 - gloss * 0.5)})`);
  g.fillStyle = e; g.fillRect(x, y, S, S);
}

/** Farbgebung je Kachel: k = Sättigung (Basis < 1 gedämpft, Premium > 1 satter), Weiß warm. */
function grade(g, x, y, w, h, k = 0.8) {
  const im = g.getImageData(x, y, w, h), d = im.data, lift = k > 1 ? 0.4 : 1;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], gg = d[i + 1], b = d[i + 2];
    const l = 0.3 * r + 0.59 * gg + 0.11 * b;
    d[i] = Math.max(0, Math.min(255, 10 * lift + (l + (r - l) * k) * 0.965 + 3));
    d[i + 1] = Math.max(0, Math.min(255, 9 * lift + (l + (gg - l) * k) * 0.965));
    d[i + 2] = Math.max(0, Math.min(255, 7 * lift + (l + (b - l) * k) * 0.95));
  }
  g.putImageData(im, x, y);
}

/** Einzeltextur (z. B. Hutschachtel): Deckel oder Schachtel. */
export function makePackageTexture(id, lid) {
  const S = TILE;
  const c = document.createElement('canvas'); c.width = c.height = S;
  DESIGNS[id](c.getContext('2d'), 0, 0, S, lid, null);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}
