// Prozedurale Canvas-Texturen für die rustikale Küche. Alles wird genau einmal beim Start
// gezeichnet (keine Bilddateien, keine Kosten pro Frame).
import * as THREE from 'three';

/** kleiner deterministischer Zufallsgenerator, damit die Küche immer gleich aussieht */
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function toTex(c, { repeat = [1, 1], srgb = true, aniso = 1 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = aniso;
  return t;
}

/**
 * Holzbretter: senkrechte Bretter (laufen in der Textur von oben nach unten) mit Maserung,
 * Ästen und dunklen Fugen. `planks` Bretter pro Texturbreite.
 */
export function makeWoodCanvas({ w = 512, h = 1024, planks = 4, seed = 7, tones } = {}) {
  const [c, g] = canvas(w, h);
  const r = rng(seed);
  tones = tones || ['#8f5c37', '#9d6840', '#83512f', '#a4703f', '#8a5a38'];
  const pw = w / planks;
  for (let p = 0; p < planks; p++) {
    const x0 = p * pw;
    // Grundton pro Brett + leichter Verlauf
    const base = tones[(p + seed) % tones.length];
    g.fillStyle = base; g.fillRect(x0, 0, pw, h);
    const lg = g.createLinearGradient(x0, 0, x0 + pw, 0);
    lg.addColorStop(0, 'rgba(60,30,10,0.18)'); lg.addColorStop(0.5, 'rgba(255,220,170,0.06)'); lg.addColorStop(1, 'rgba(60,30,10,0.2)');
    g.fillStyle = lg; g.fillRect(x0, 0, pw, h);
    // Brett-Stöße (Querfugen) an zufälliger Höhe
    const joint = r() * h;
    // Maserung: viele feine, leicht gewellte Linien entlang des Bretts
    for (let l = 0; l < 46; l++) {
      const gx = x0 + 3 + r() * (pw - 6);
      const amp = 1 + r() * 4, freq = 0.004 + r() * 0.01, ph = r() * 6.28;
      g.strokeStyle = r() < 0.6 ? `rgba(70,35,12,${0.08 + r() * 0.2})` : `rgba(255,215,160,${0.05 + r() * 0.1})`;
      g.lineWidth = 0.6 + r() * 1.6;
      g.beginPath();
      for (let y = 0; y <= h; y += 8) {
        const x = gx + Math.sin(y * freq + ph) * amp + Math.sin(y * freq * 3.1 + ph) * amp * 0.3;
        if (y === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    }
    // Äste
    const knots = r() < 0.75 ? 1 + (r() * 2 | 0) : 0;
    for (let k = 0; k < knots; k++) {
      const kx = x0 + pw * (0.25 + r() * 0.5), ky = r() * h, kr = 5 + r() * 9;
      for (let ring = 5; ring >= 0; ring--) {
        g.strokeStyle = `rgba(60,28,8,${0.12 + 0.1 * (5 - ring) / 5})`;
        g.lineWidth = 1.2;
        g.beginPath(); g.ellipse(kx, ky, kr * (0.5 + ring * 0.35), kr * (1.4 + ring * 1.3), 0, 0, Math.PI * 2); g.stroke();
      }
      g.fillStyle = 'rgba(55,25,8,0.65)';
      g.beginPath(); g.ellipse(kx, ky, kr * 0.45, kr * 0.9, 0, 0, Math.PI * 2); g.fill();
    }
    // feine Kratzer / Gebrauchsspuren
    for (let s = 0; s < 14; s++) {
      g.strokeStyle = `rgba(255,230,190,${0.05 + r() * 0.08})`; g.lineWidth = 0.7;
      const sx = x0 + r() * pw, sy = r() * h, a = (r() - 0.5) * 1.2, len = 10 + r() * 40;
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + Math.sin(a) * len, sy + Math.cos(a) * len); g.stroke();
    }
    // Fugen: dunkle Längsfuge + Querstoß
    g.fillStyle = 'rgba(40,18,6,0.85)'; g.fillRect(x0, 0, 2.5, h);
    g.fillStyle = 'rgba(255,220,170,0.12)'; g.fillRect(x0 + 2.5, 0, 1.5, h);
    g.fillStyle = 'rgba(40,18,6,0.7)'; g.fillRect(x0, joint, pw, 2);
  }
  return c;
}

export function makeWoodTexture(opts = {}) {
  return toTex(makeWoodCanvas(opts), opts);
}

/** Warmer, gekalkter Putz mit ein paar freiliegenden Ziegeln. */
export function makePlasterTexture({ repeat = [1, 1] } = {}) {
  const W = 512, H = 512;
  const [c, g] = canvas(W, H);
  const r = rng(11);
  g.fillStyle = '#e9d6bb'; g.fillRect(0, 0, W, H);
  // fleckige Struktur
  for (let i = 0; i < 900; i++) {
    const x = r() * W, y = r() * H, rad = 4 + r() * 26;
    const light = r() < 0.5;
    const rg = g.createRadialGradient(x, y, 0, x, y, rad);
    rg.addColorStop(0, light ? 'rgba(255,248,235,0.18)' : 'rgba(170,125,85,0.10)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // freiliegende Ziegel (zwei Stellen)
  const bricks = (bx, by, cols, rows) => {
    for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
      if (r() < 0.25) continue;
      const x = bx + col * 46 + (row % 2) * 23, y = by + row * 20;
      g.fillStyle = ['#b9744f', '#a8643f', '#c4825a', '#9e5c3c'][(r() * 4) | 0];
      g.globalAlpha = 0.55 + r() * 0.3;
      g.fillRect(x, y, 42, 16);
    }
    g.globalAlpha = 1;
  };
  bricks(30, 340, 4, 5);
  bricks(330, 60, 3, 4);
  return toTex(c, { repeat });
}

/** Gebürsteter Stahl: feine Streifen in Laufrichtung u (rund um die Schale). */
export function makeBrushedTexture() {
  const W = 1024, H = 256;
  const [c, g] = canvas(W, H);
  const r = rng(5);
  g.fillStyle = '#d0d0d0'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 2600; i++) {
    const y = r() * H, x = r() * W, len = 60 + r() * 400;
    const v = 150 + r() * 105 | 0;
    g.strokeStyle = `rgba(${v},${v},${v},${0.25 + r() * 0.4})`;
    g.lineWidth = 0.5 + r() * 1.2;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + len, y + (r() - 0.5) * 1.5); g.stroke();
  }
  const t = toTex(c, { srgb: false });
  t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/** Leinen-Geschirrtuch mit roten Streifen. */
export function makeClothTexture(stripe = '#b8453a') {
  const [c, g] = canvas(128, 128);
  g.fillStyle = '#efe6d6'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = stripe;
  g.fillRect(0, 18, 128, 10); g.fillRect(0, 34, 128, 4);
  g.fillRect(0, 90, 128, 10); g.fillRect(0, 106, 128, 4);
  const r = rng(3);
  for (let i = 0; i < 600; i++) {
    g.fillStyle = `rgba(120,90,60,${r() * 0.08})`;
    g.fillRect(r() * 128, r() * 128, 1, 3);
  }
  return toTex(c);
}

/**
 * Kleine warme Umgebungs-Karte (equirect) für Spiegelungen: Decke hell, Wand warm,
 * helles Fenster, Holz unten. Wird einmal über PMREM vorgefiltert.
 */
export function makeEnvTexture() {
  const W = 512, H = 256;
  const [c, g] = canvas(W, H);
  const lg = g.createLinearGradient(0, 0, 0, H);
  lg.addColorStop(0, '#fdfaf5'); lg.addColorStop(0.4, '#e6ded3');
  lg.addColorStop(0.5, '#a89585'); lg.addColorStop(0.56, '#4a3a30'); lg.addColorStop(0.7, '#6e5240'); lg.addColorStop(1, '#3e2c22');
  g.fillStyle = lg; g.fillRect(0, 0, W, H);
  // Fenster (hell) und ein dunkleres Regal
  g.fillStyle = '#ffffff'; g.fillRect(W * 0.62, H * 0.18, W * 0.12, H * 0.22);
  g.fillStyle = '#fff9ef'; g.fillRect(W * 0.1, H * 0.12, W * 0.05, H * 0.25);
  g.fillStyle = 'rgba(90,55,30,0.6)'; g.fillRect(W * 0.2, H * 0.3, W * 0.3, H * 0.04);
  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Weicher Schatten-Verlauf (oben dunkel -> unten transparent) für Regalschatten an der Wand. */
export function makeShadeTexture() {
  const [c, g] = canvas(4, 64);
  const lg = g.createLinearGradient(0, 0, 0, 64);
  lg.addColorStop(0, 'rgba(70,40,20,0.55)'); lg.addColorStop(1, 'rgba(70,40,20,0)');
  g.fillStyle = lg; g.fillRect(0, 0, 4, 64);
  const t = new THREE.CanvasTexture(c);
  return t;
}
