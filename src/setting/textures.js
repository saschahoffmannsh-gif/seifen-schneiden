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
  g.fillStyle = '#f0dfc6'; g.fillRect(0, 0, W, H);
  // fleckige Struktur
  for (let i = 0; i < 900; i++) {
    const x = r() * W, y = r() * H, rad = 4 + r() * 26;
    const light = r() < 0.5;
    const rg = g.createRadialGradient(x, y, 0, x, y, rad);
    rg.addColorStop(0, light ? 'rgba(255,248,235,0.18)' : 'rgba(170,125,85,0.10)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // feine Körnung
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = r() < 0.5 ? `rgba(255,250,240,${r() * 0.16})` : `rgba(140,100,65,${r() * 0.12})`;
    g.fillRect(r() * W, r() * H, 1 + r() * 2, 1 + r() * 2);
  }
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

/** Brett mit Maserung entlang der Länge (für die Ablagen). */
export function makeBoardTexture({ aniso = 1 } = {}) {
  const src = makeWoodCanvas({ w: 128, h: 1024, planks: 1, seed: 4, tones: ['#94603a'] });
  const [c, g] = canvas(1024, 128);
  g.translate(1024, 0); g.rotate(Math.PI / 2); g.drawImage(src, 0, 0);
  return toTex(c, { aniso });
}

/** Runder weicher Schatten (Kontaktschatten unter Dingen). */
export function makeBlobTexture() {
  const [c, g] = canvas(64, 64);
  const rg = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  rg.addColorStop(0, 'rgba(60,32,15,0.45)'); rg.addColorStop(1, 'rgba(60,32,15,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/** Pappe (Päckchen): hell mit feinen Fasern, wird pro Sorte eingefärbt. withString = rot-weiße Schnur über Kreuz (Deckel). */
export function makeKraftTexture({ withString = false, seed = 31 } = {}) {
  const S = 256;
  const [c, g] = canvas(S, S);
  const r = rng(seed);
  // helle, neutrale Pappe: die Farbe je Päckchen-Sorte kommt per instanceColor dazu
  g.fillStyle = '#f2ece4'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 1400; i++) {
    const x = r() * S, y = r() * S, l = 3 + r() * 10, a = r() * Math.PI;
    g.strokeStyle = r() < 0.5 ? 'rgba(90,60,35,0.16)' : 'rgba(255,255,255,0.3)';
    g.lineWidth = 0.6 + r();
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  if (withString) {
    for (const [x, y, w, h] of [[S / 2 - 7, 0, 14, S], [0, S / 2 - 7, S, 14]]) {
      g.fillStyle = '#f4eee4'; g.fillRect(x, y, w, h);
      g.fillStyle = '#c0392b';
      if (w < h) for (let k = 0; k < S; k += 12) g.fillRect(x, k, w, 6); else for (let k = 0; k < S; k += 12) g.fillRect(k, y, 6, h);
    }
  }
  return toTex(c);
}

/**
 * Handgemachte Metro-/Zellige-Fliesen (Halbverband) in Creme und warmem Weiß:
 * jede Fliese mit eigenem Farbton, eigener Glasur-Welligkeit und eigenem Glanz, Glasur an den
 * Kanten leicht dunkler (wie gelaufen), feine helle Fugen. Liefert Farbe, Rauheit und Normalen
 * aus EINEM einmal berechneten Höhenfeld (512², kachelbar).
 */
export function makeTileTextures({ repeat = [1, 1], aniso = 1 } = {}) {
  const N = 512, COLS = 4, ROWS = 8, TW = N / COLS, TH = N / ROWS, G = 1.5;
  const r = rng(29);
  const tiles = [];
  const TONES = [[251, 249, 244], [249, 246, 239], [252, 251, 247], [247, 243, 235], [250, 247, 241], [248, 245, 239]];
  for (let i = 0; i < COLS * ROWS; i++) {
    const t = TONES[(r() * TONES.length) | 0], j = (r() - 0.5) * 5;
    tiles.push({
      c: [t[0] + j, t[1] + j * 0.9, t[2] + j * 0.7 - r() * 4],
      rough: 0.1 + r() * 0.14,
      a: 0.03 + r() * 0.05, b: 0.05 + r() * 0.08, p1: r() * 6.28, p2: r() * 6.28, amp: 0.18 + r() * 0.3,
      tilt: (r() - 0.5) * 0.5, tiltV: (r() - 0.5) * 0.5, ep: r() * 6.28,
    });
  }
  const hgt = new Float32Array(N * N), edge = new Float32Array(N * N), tid = new Uint8Array(N * N);
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let y = 0; y < N; y++) {
    const row = (y / TH) | 0, v = y - row * TH, off = row % 2 ? TW / 2 : 0;
    for (let x = 0; x < N; x++) {
      const xs = (x - off + N) % N, c = (xs / TW) | 0, u = xs - c * TW, ti = row * COLS + c, T = tiles[ti];
      // Kanten leicht unregelmäßig (handgeformt)
      const g = G + 0.6 * Math.sin(u * 0.21 + T.ep) * Math.sin(v * 0.37 + T.ep * 2);
      const e = Math.min(u, TW - 1 - u, v, TH - 1 - v) - g;
      const k = y * N + x;
      tid[k] = ti; edge[k] = e;
      if (e < 0) { hgt[k] = -0.25; continue; }
      const pillow = ss(0, 6, e);
      const wave = Math.sin(u * T.a + T.p1) * Math.sin(v * T.b + T.p2) * T.amp + (u / TW - 0.5) * T.tilt + (v / TH - 0.5) * T.tiltV;
      hgt[k] = pillow * 0.55 + pillow * wave * 0.16;
    }
  }
  const [cc, gc] = canvas(N, N), [rc, gr] = canvas(N, N), [nc, gn] = canvas(N, N);
  const ci = gc.createImageData(N, N), ri = gr.createImageData(N, N), ni = gn.createImageData(N, N);
  const S = 1.25;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const k = y * N + x, p = k * 4, e = edge[k], T = tiles[tid[k]];
    const noise = (r() - 0.5);
    if (e < 0) {
      // Fuge: warmes Hellgrau, zur Mitte etwas dunkler
      const d = 232 + noise * 6 + Math.max(-1, e) * 4;
      ci.data[p] = d + 4; ci.data[p + 1] = d + 1; ci.data[p + 2] = d - 6;
      ri.data[p + 1] = 235;
    } else {
      const rim = 1 - ss(0, 9, e);                       // Glasur an der Kante dichter/dunkler
      const hv = hgt[k];
      const shade = 1 - rim * 0.05 + (hv - 0.55) * 0.06 + noise * 0.01;
      ci.data[p] = T.c[0] * shade; ci.data[p + 1] = T.c[1] * (shade - rim * 0.008); ci.data[p + 2] = T.c[2] * (shade - rim * 0.02);
      ri.data[p + 1] = 255 * Math.min(1, T.rough + Math.abs(hv - 0.55) * 0.2 + rim * 0.06 + noise * 0.03);
    }
    ci.data[p + 3] = ri.data[p + 3] = ni.data[p + 3] = 255;
    const hl = hgt[y * N + (x + N - 1) % N], hr = hgt[y * N + (x + 1) % N];
    const hu = hgt[((y + N - 1) % N) * N + x], hd = hgt[((y + 1) % N) * N + x];
    let nx = -(hr - hl) * S, ny = (hd - hu) * S, nz = 1;
    const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    ni.data[p] = (nx * 0.5 + 0.5) * 255; ni.data[p + 1] = (ny * 0.5 + 0.5) * 255; ni.data[p + 2] = (nz * 0.5 + 0.5) * 255;
  }
  gc.putImageData(ci, 0, 0); gr.putImageData(ri, 0, 0); gn.putImageData(ni, 0, 0);
  return {
    map: toTex(cc, { repeat, aniso }),
    roughnessMap: toTex(rc, { repeat, srgb: false, aniso }),
    normalMap: toTex(nc, { repeat, srgb: false, aniso }),
  };
}
