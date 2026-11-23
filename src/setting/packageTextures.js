// Prozedurale Päckchen-Texturen (einmalig beim Start per Canvas gezeichnet).
// Eckige Sorten liegen in EINEM Atlas: oben die Deckel-Kacheln, unten die Schachtel-Kacheln,
// eine Spalte pro Sorte. Bänder/Schnüre werden in ihrer eigenen Farbe gemalt (kein Einfärben).
import * as THREE from 'three';
import { rng } from './textures.js';

export const TILE = 256;

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

/** Atlas für die eckigen Sorten (ids in Reihenfolge). */
export function makePackageAtlas(ids) {
  const S = TILE, n = ids.length;
  const c = document.createElement('canvas'); c.width = S * n; c.height = S * 2;
  const g = c.getContext('2d');
  ids.forEach((id, i) => { DESIGNS[id](g, i * S, 0, S, true); DESIGNS[id](g, i * S, S, S, false); });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
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
