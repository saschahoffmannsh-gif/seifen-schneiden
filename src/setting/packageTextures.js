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

// Jede Sorte: draw(g, x0, y0, S, isLid)
const DESIGNS = {
  kraft(g, x, y, S, lid) {
    g.fillStyle = '#c39563'; g.fillRect(x, y, S, S);
    fibres(g, x, y, S, lid ? 47 : 31, 'rgba(90,55,25,0.2)', 'rgba(240,205,160,0.2)', 1200);
    string(g, x, y, S, true); if (lid) string(g, x, y, S, false);
  },
  rosa(g, x, y, S, lid) {
    g.fillStyle = '#f6bccb'; g.fillRect(x, y, S, S);
    fibres(g, x, y, S, 5, 'rgba(180,90,120,0.08)', 'rgba(255,255,255,0.25)', 500);
    band(g, x, y, S, 30, '#f4f1ee', '#ffffff', true); if (lid) band(g, x, y, S, 30, '#f4f1ee', '#ffffff', false);
  },
  mint(g, x, y, S, lid) {
    g.fillStyle = '#a5dcc6'; g.fillRect(x, y, S, S);
    g.fillStyle = '#ffffff';
    const step = 32;
    for (let j = 0; j <= S / step; j++) for (let i = 0; i <= S / step; i++) {
      const ox = (j % 2) * step / 2;
      g.beginPath(); g.arc(x + i * step + ox, y + j * step + step / 2, 6, 0, 6.283); g.fill();
    }
    if (lid) edges(g, x, y, S, '#6fb79b', 5, 6);
  },
  candy(g, x, y, S, lid) {
    g.save(); g.beginPath(); g.rect(x, y, S, S); g.clip();
    g.fillStyle = '#fff7f2'; g.fillRect(x, y, S, S);
    g.fillStyle = lid ? '#e2425f' : '#f07a96';
    const w = lid ? 18 : 24;
    for (let k = -S; k < S * 2; k += w * 2) {
      g.beginPath(); g.moveTo(x + k, y); g.lineTo(x + k + w, y); g.lineTo(x + k + w - S, y + S); g.lineTo(x + k - S, y + S); g.closePath(); g.fill();
    }
    g.restore();
  },
  noir(g, x, y, S, lid) {
    g.fillStyle = '#1d1b1e'; g.fillRect(x, y, S, S);
    fibres(g, x, y, S, 9, 'rgba(0,0,0,0.25)', 'rgba(255,255,255,0.05)', 400);
    edges(g, x, y, S, '#d9b24c', 6, 5);
    band(g, x, y, S, 24, '#c99a2e', '#f3d987', true); if (lid) band(g, x, y, S, 24, '#c99a2e', '#f3d987', false);
  },
  banderole(g, x, y, S, lid) {
    DESIGNS.kraft0(g, x, y, S, lid);
    // breite bedruckte Banderole (Bauchbinde) aus cremefarbenem Papier mit Etikett
    g.fillStyle = '#f4ead8'; g.fillRect(x + S * 0.3, y, S * 0.4, S);
    g.strokeStyle = '#6b4a2c'; g.lineWidth = 2; g.strokeRect(x + S * 0.33, y + 3, S * 0.34, S - 6);
    if (lid) { g.fillStyle = '#6b4a2c'; g.font = `600 22px ${SERIF}`; g.textAlign = 'center'; g.fillText('SEIFE', x + S / 2, y + S / 2 + 8); }
  },
  kraft0(g, x, y, S, lid) {
    g.fillStyle = '#c39563'; g.fillRect(x, y, S, S);
    fibres(g, x, y, S, lid ? 48 : 32, 'rgba(90,55,25,0.2)', 'rgba(240,205,160,0.2)', 1200);
  },
  fenster(g, x, y, S, lid) {
    g.fillStyle = '#fbf7f1'; g.fillRect(x, y, S, S);
    fibres(g, x, y, S, 12, 'rgba(120,100,80,0.06)', 'rgba(255,255,255,0.3)', 300);
    if (lid) {
      // Sichtfenster: zartes Rosa (Seife scheint durch) + Spiegelung
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
    string(g, x, y, S, true);
  },
  aquarell(g, x, y, S, lid) {
    g.fillStyle = '#fbf8f3'; g.fillRect(x, y, S, S);
    const r = rng(lid ? 21 : 22), C = ['rgba(150,190,230,0.35)', 'rgba(240,160,190,0.35)', 'rgba(190,170,230,0.35)', 'rgba(160,220,200,0.3)'];
    for (let i = 0; i < 26; i++) {
      const cx = x + r() * S, cy = y + r() * S, rad = 18 + r() * 40;
      const gr = g.createRadialGradient(cx, cy, rad * 0.2, cx, cy, rad);
      const c = C[i % 4]; gr.addColorStop(0, c); gr.addColorStop(0.8, c); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, rad, 0, 6.283); g.fill();
    }
  },
  terrazzo(g, x, y, S, lid) {
    g.fillStyle = '#f1ece4'; g.fillRect(x, y, S, S);
    const r = rng(lid ? 31 : 32), C = ['#e0866b', '#3f6e66', '#e8c27a', '#a8b9c9', '#d9a5a0', '#5a5450'];
    for (let i = 0; i < 90; i++) {
      const cx = x + r() * S, cy = y + r() * S, rad = 3 + r() * 9, n = 5 + ((r() * 3) | 0);
      g.fillStyle = C[(r() * C.length) | 0]; g.beginPath();
      for (let k = 0; k < n; k++) { const a = k / n * 6.283 + r(), d = rad * (0.6 + r() * 0.5); g.lineTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d); }
      g.fill();
    }
  },
  marmor(g, x, y, S, lid) {
    g.fillStyle = '#f6f4f1'; g.fillRect(x, y, S, S);
    const r = rng(lid ? 41 : 42);
    for (let i = 0; i < 9; i++) {
      g.strokeStyle = i % 3 ? 'rgba(120,120,130,0.25)' : 'rgba(80,80,90,0.4)'; g.lineWidth = 0.8 + r() * 2.2;
      g.beginPath(); let px = x + r() * S, py = y; g.moveTo(px, py);
      while (py < y + S) { px += (r() - 0.5) * 40; py += 10 + r() * 16; g.lineTo(px, py); }
      g.stroke();
    }
    edges(g, x, y, S, '#c9a04a', 5, 4);
  },
  blumen(g, x, y, S, lid) {
    g.fillStyle = '#f5ead8'; g.fillRect(x, y, S, S);
    const r = rng(lid ? 51 : 52);
    for (let i = 0; i < 16; i++) {
      const fx = x + r() * S, fy = y + r() * S, s = 9 + r() * 7;
      g.fillStyle = 'rgba(110,140,90,0.8)';
      for (const a of [0.6, 2.4, 4.2]) { g.beginPath(); g.ellipse(fx + Math.cos(a) * s * 1.4, fy + Math.sin(a) * s * 1.4, s * 0.7, s * 0.35, a, 0, 6.283); g.fill(); }
      g.fillStyle = i % 2 ? '#d9707f' : '#e9a25a';
      for (let p = 0; p < 6; p++) { const a = p / 6 * 6.283; g.beginPath(); g.arc(fx + Math.cos(a) * s * 0.6, fy + Math.sin(a) * s * 0.6, s * 0.5, 0, 6.283); g.fill(); }
      g.fillStyle = '#f6dc8a'; g.beginPath(); g.arc(fx, fy, s * 0.35, 0, 6.283); g.fill();
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
  leinen(g, x, y, S, lid) {
    g.fillStyle = '#d8cdb8'; g.fillRect(x, y, S, S);
    for (let i = 0; i < S; i += 3) {
      g.fillStyle = 'rgba(255,255,255,' + (0.08 + (i % 7) * 0.012) + ')'; g.fillRect(x + i, y, 1.5, S);
      g.fillStyle = 'rgba(90,70,40,' + (0.05 + (i % 5) * 0.01) + ')'; g.fillRect(x, y + i, S, 1.2);
    }
    if (lid) { g.fillStyle = '#f7f1e4'; g.fillRect(x + S * 0.3, y + S * 0.38, S * 0.4, S * 0.24); g.strokeStyle = '#8a6a44'; g.lineWidth = 2; g.strokeRect(x + S * 0.32, y + S * 0.4, S * 0.36, S * 0.2); }
  },
  korb(g, x, y, S, lid) {
    // Weidengeflecht: versetzte Bänder
    g.fillStyle = '#9c6b34'; g.fillRect(x, y, S, S);
    const h = 16;
    for (let row = 0; row < S / h; row++) for (let col = 0; col < S / 20 + 1; col++) {
      const ox = (row % 2) * 10, cx = x + col * 20 - ox, cy = y + row * h;
      const gr = g.createLinearGradient(0, cy, 0, cy + h);
      gr.addColorStop(0, '#e2b878'); gr.addColorStop(0.5, '#c9944f'); gr.addColorStop(1, '#8e5f2c');
      g.fillStyle = gr; g.beginPath(); g.roundRect(cx + 1, cy + 1, 18, h - 2, 6); g.fill();
    }
  },
  dose(g, x, y, S, lid) {
    // bedruckte Blechdose: Metallglanz, Streifen und Etikett
    const gr = g.createLinearGradient(x, y, x + S, y);
    gr.addColorStop(0, '#5f8f8a'); gr.addColorStop(0.35, '#a8d0c9'); gr.addColorStop(0.6, '#6f9e98'); gr.addColorStop(1, '#4e7a75');
    g.fillStyle = gr; g.fillRect(x, y, S, S);
    g.fillStyle = 'rgba(255,255,255,0.8)'; for (let i = 0; i < S; i += 24) g.fillRect(x + i, y, 4, S);
    if (!lid) { g.fillStyle = '#f3e9d3'; g.fillRect(x, y + S * 0.3, S, S * 0.4); g.fillStyle = '#7a4a2a'; g.font = `600 26px ${SERIF}`; g.textAlign = 'center'; g.fillText('SAVON', x + S / 2, y + S / 2 + 9); }
  },
  wabe(g, x, y, S, lid) {
    g.fillStyle = '#f2b93b'; g.fillRect(x, y, S, S);
    const R = 18, w = R * Math.sqrt(3);
    g.strokeStyle = 'rgba(150,90,10,0.55)'; g.lineWidth = 3;
    for (let row = -1; row < S / (R * 1.5) + 1; row++) for (let col = -1; col < S / w + 1; col++) {
      const cx = x + col * w + (row % 2) * w / 2, cy = y + row * R * 1.5;
      g.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * 6.283 + Math.PI / 6; g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); } g.closePath(); g.stroke();
      g.fillStyle = 'rgba(255,235,160,0.25)'; g.fill();
    }
    if (lid) { g.fillStyle = '#4a2e0e'; g.font = `600 28px ${SERIF}`; g.textAlign = 'center'; g.fillText('HONIG', x + S / 2, y + S / 2 + 10); }
  },
  herz(g, x, y, S, lid) {
    const gr = g.createLinearGradient(x, y, x, y + S);
    gr.addColorStop(0, '#e2304d'); gr.addColorStop(1, '#b81d3a');
    g.fillStyle = gr; g.fillRect(x, y, S, S);
    fibres(g, x, y, S, 71, 'rgba(90,0,20,0.15)', 'rgba(255,200,210,0.12)', 900);   // Samt
    if (lid) { g.strokeStyle = 'rgba(255,230,235,0.8)'; g.setLineDash([6, 6]); g.lineWidth = 3; g.strokeRect(x + 14, y + 14, S - 28, S - 28); g.setLineDash([]); }
  },
  weihnacht(g, x, y, S, lid) {
    g.fillStyle = '#1f5a3a'; g.fillRect(x, y, S, S);
    const r = rng(lid ? 81 : 82);
    for (let i = 0; i < 26; i++) {
      const cx = x + r() * S, cy = y + r() * S, s = 6 + r() * 6;
      g.strokeStyle = '#f5f1e6'; g.lineWidth = 2;
      for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI; g.beginPath(); g.moveTo(cx - Math.cos(a) * s, cy - Math.sin(a) * s); g.lineTo(cx + Math.cos(a) * s, cy + Math.sin(a) * s); g.stroke(); }
    }
    band(g, x, y, S, 26, '#b81d2a', '#ef5a5f', true); if (lid) band(g, x, y, S, 26, '#b81d2a', '#ef5a5f', false);
  },
  furoshiki(g, x, y, S, lid) {
    // japanisches Wellenmuster (Seigaiha) auf Indigo
    g.fillStyle = '#2f4c8a'; g.fillRect(x, y, S, S);
    const R = 22;
    for (let row = 0; row < S / (R / 2) + 2; row++) for (let col = -1; col < S / (R * 2) + 1; col++) {
      const cx = x + col * R * 2 + (row % 2) * R, cy = y + row * R / 2;
      for (let k = 4; k >= 1; k--) { g.fillStyle = k % 2 ? '#2f4c8a' : '#e9eef7'; g.beginPath(); g.arc(cx, cy, R * k / 4, Math.PI, 0); g.fill(); }
    }
  },
  sterne(g, x, y, S, lid) {
    g.fillStyle = '#1d2747'; g.fillRect(x, y, S, S);
    const r = rng(lid ? 91 : 92);
    for (let i = 0; i < 34; i++) {
      const cx = x + r() * S, cy = y + r() * S, s = 2 + r() * 6;
      g.fillStyle = r() < 0.7 ? '#e6c260' : '#ffffff'; g.beginPath();
      for (let k = 0; k < 10; k++) { const a = k / 10 * 6.283 - Math.PI / 2, d = k % 2 ? s * 0.45 : s; g.lineTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d); }
      g.fill();
    }
  },
  hut(g, x, y, S, lid) {
    // Hutschachtel flieder mit kleinen Blümchen; Deckel mit weißem Rand-Band
    g.fillStyle = '#c9b2e6'; g.fillRect(x, y, S, S);
    const r = rng(77);
    for (let i = 0; i < 40; i++) {
      const fx = x + r() * S, fy = y + r() * S;
      g.fillStyle = 'rgba(255,255,255,0.85)';
      for (let p = 0; p < 5; p++) { const a = p / 5 * 6.283; g.beginPath(); g.arc(fx + Math.cos(a) * 4, fy + Math.sin(a) * 4, 3, 0, 6.283); g.fill(); }
      g.fillStyle = '#f2c14e'; g.beginPath(); g.arc(fx, fy, 2.2, 0, 6.283); g.fill();
    }
    if (lid) { g.fillStyle = '#ffffff'; g.fillRect(x, y + S * 0.35, S, S * 0.3); }
  },
};

/** Atlas für ALLE Sorten: ATLAS_COLS Spalten; je Sorte zwei Zeilen (oben Deckel, darunter Schachtel). */
export const ATLAS_COLS = 8;
export function makePackageAtlas(ids) {
  const S = TILE, n = ids.length, rows = Math.ceil(n / ATLAS_COLS) * 2;
  const c = document.createElement('canvas'); c.width = S * ATLAS_COLS; c.height = S * rows;
  const g = c.getContext('2d');
  const draw = () => {
    g.clearRect(0, 0, c.width, c.height);
    ids.forEach((id, i) => {
      const x = (i % ATLAS_COLS) * S, y = Math.floor(i / ATLAS_COLS) * 2 * S;
      for (const [lid, yy] of [[true, y], [false, y + S]]) {
        g.save(); g.beginPath(); g.rect(x, yy, S, S); g.clip();
        DESIGNS[id](g, x, yy, S, lid);
        finish(g, x, yy, S, i * 2 + (lid ? 0 : 1));
        g.restore();
      }
    });
    grade(g, c.width, c.height);
  };
  draw();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  // Beschriftungen in Fraunces: sobald die Schrift geladen ist, einmal neu zeichnen
  if (document.fonts && document.fonts.load) document.fonts.load(`600 24px ${SERIF}`).then(() => { draw(); t.needsUpdate = true; }).catch(() => {});
  return { tex: t, rows };
}

/** Feinschliff je Kachel: Papierkorn + leicht dunklere Kanten (wirkt wie Licht-Verdeckung an Falzen). */
function finish(g, x, y, S, seed) {
  const r = rng(101 + seed);
  for (let i = 0; i < 1600; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(70,45,25,0.045)' : 'rgba(255,250,240,0.06)';
    g.fillRect(x + r() * S, y + r() * S, 1 + r(), 1 + r());
  }
  const e = g.createRadialGradient(x + S / 2, y + S / 2, S * 0.42, x + S / 2, y + S / 2, S * 0.75);
  e.addColorStop(0, 'rgba(60,40,22,0)'); e.addColorStop(1, 'rgba(60,40,22,0.16)');
  g.fillStyle = e; g.fillRect(x, y, S, S);
}

/** Farbgebung „Premium“: Sättigung etwas zurück, Schwarz leicht angehoben, Weiß warm. */
function grade(g, w, h) {
  const im = g.getImageData(0, 0, w, h), d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], gg = d[i + 1], b = d[i + 2];
    const l = 0.3 * r + 0.59 * gg + 0.11 * b, k = 0.8;
    d[i] = Math.min(255, 10 + (l + (r - l) * k) * 0.965 + 3);
    d[i + 1] = Math.min(255, 9 + (l + (gg - l) * k) * 0.965);
    d[i + 2] = Math.min(255, 7 + (l + (b - l) * k) * 0.95);
  }
  g.putImageData(im, 0, 0);
}

/** Einzeltextur (z. B. Hutschachtel): Deckel oder Schachtel. */
export function makePackageTexture(id, lid) {
  const S = TILE;
  const c = document.createElement('canvas'); c.width = c.height = S;
  DESIGNS[id](c.getContext('2d'), 0, 0, S, lid);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}
