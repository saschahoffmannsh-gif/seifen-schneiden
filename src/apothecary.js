// SS-19: Vollbild-Seifenregal als 3D-Apothekerschrank im Pastell-Comic-Look
// (so nah wie möglich am festgelegten Referenzbild, nur breiter mit mehr Fächern).
// Der Schrank steht fest und füllt fast den Bildschirm; Wischen schiebt die Kamera
// seitlich mit Schwung, an den Enden ist Schluss. Schilder laufen mit.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { SOAP_LIST } from './soaps.js';
import { makeEnvTexture } from './setting/textures.js';

const COLS = 4, ROWS = 5;
const CELL_W = 0.52, CELL_H = 0.45, DIV = 0.14;
const PITCH_X = CELL_W + DIV, PITCH_Y = CELL_H + DIV, DEPTH = 0.46;
const FRAME = 0.12, BASE_H = 0.075, CROWN_H = 0.06, BACK_T = 0.07;
const SOAP_W = CELL_W * 0.78, SOAP_H = CELL_H * 0.58, SOAP_D = CELL_W * 0.76, SOAP_R = 0.09;
const DAMP = 6.2, CAM_TILT = 15 * Math.PI / 180, SOAP_TILT = 18 * Math.PI / 180;
const PINK_BG = 0xffd9ea;

const FACE = new Map();

function rgb(c, k = 1) {
  return `rgb(${Math.round(c.r * 255 * k)},${Math.round(c.g * 255 * k)},${Math.round(c.b * 255 * k)})`;
}
function col(soap) {
  const a = soap.base, b = soap.light || soap.base;
  const c = new THREE.Color(
    a[0] * 0.92 + b[0] * 0.08,
    a[1] * 0.92 + b[1] * 0.08,
    a[2] * 0.92 + b[2] * 0.08,
  );
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  // sattere Candy-Pastellfarben, Creme bleibt warm und hell
  const sBoost = hsl.s < 0.18 ? 1.15 : 1.32;
  c.setHSL(
    hsl.h,
    Math.min(0.92, hsl.s * sBoost),
    Math.max(0.36, Math.min(0.78, hsl.l * 0.94 + 0.03)),
  );
  return c;
}

function drawGlyph(g, id, r) {
  const petal = (n, rad, wr, hr, rot0 = -Math.PI / 2) => {
    for (let i = 0; i < n; i++) {
      const a = rot0 + (i / n) * Math.PI * 2;
      g.beginPath();
      g.ellipse(Math.cos(a) * rad, Math.sin(a) * rad, wr, hr, a, 0, 7);
      g.fill();
    }
  };
  if (id === 0) { // Erdbeere: klassische Beere mit Kelch
    g.beginPath();
    g.moveTo(0, r * 0.78);
    g.bezierCurveTo(r * 0.72, r * 0.55, r * 0.7, r * 0.05, r * 0.38, -r * 0.22);
    g.quadraticCurveTo(r * 0.16, -r * 0.08, 0, -r * 0.15);
    g.quadraticCurveTo(-r * 0.16, -r * 0.08, -r * 0.38, -r * 0.22);
    g.bezierCurveTo(-r * 0.7, r * 0.05, -r * 0.72, r * 0.55, 0, r * 0.78);
    g.closePath(); g.fill();
    g.beginPath();
    g.moveTo(0, -r * 0.12);
    g.quadraticCurveTo(-r * 0.38, -r * 0.55, -r * 0.52, -r * 0.22);
    g.quadraticCurveTo(-r * 0.12, -r * 0.22, 0, -r * 0.12);
    g.quadraticCurveTo(r * 0.12, -r * 0.22, r * 0.52, -r * 0.22);
    g.quadraticCurveTo(r * 0.38, -r * 0.55, 0, -r * 0.12);
    g.closePath(); g.fill();
    g.beginPath();
    g.moveTo(0, -r * 0.12); g.lineTo(0, -r * 0.55);
    g.lineWidth = r * 0.07; g.stroke();
  } else if (id === 1) { // Vanille: klare 5-Blatt-Blüte
    petal(5, r * 0.46, r * 0.34, r * 0.2);
    g.beginPath(); g.arc(0, 0, r * 0.22, 0, 7); g.fill();
  } else if (id === 2) { // Lavendel: drei kräftige Ähren, mittig
    for (const x of [-r * 0.4, 0, r * 0.4]) {
      g.beginPath();
      g.moveTo(x - r * 0.08, r * 0.62);
      g.lineTo(x + r * 0.08, r * 0.62);
      g.lineTo(x + r * 0.06, r * 0.05);
      g.lineTo(x - r * 0.06, r * 0.05);
      g.closePath(); g.fill();
      for (let k = 0; k < 4; k++) {
        g.beginPath();
        g.ellipse(x, -r * 0.02 - k * r * 0.2, r * 0.16, r * 0.18, 0, 0, 7);
        g.fill();
      }
    }
  } else if (id === 3) { // Minze: breites Blatt schräg
    g.beginPath();
    g.ellipse(0, 0, r * 0.72, r * 0.38, -0.55, 0, 7);
    g.fill();
  } else if (id === 4 || id === 11) { // Zitrone / Orange: Scheibe
    const lw = g.lineWidth;
    g.lineWidth = r * 0.14;
    g.beginPath(); g.arc(0, 0, r * 0.78, 0, 7); g.stroke();
    g.lineWidth = r * 0.05;
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      g.beginPath();
      g.moveTo(Math.cos(a) * r * 0.14, Math.sin(a) * r * 0.14);
      g.lineTo(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7);
      g.stroke();
    }
    g.lineWidth = lw;
  } else if (id === 5) { // Kokos
    const lw = g.lineWidth;
    g.lineWidth = r * 0.11;
    g.beginPath(); g.arc(0, 0, r * 0.72, 0, 7); g.stroke();
    g.lineWidth = r * 0.08;
    g.beginPath(); g.arc(-r * 0.2, -r * 0.12, r * 0.14, 0, 7); g.stroke();
    g.beginPath(); g.arc(r * 0.2, -r * 0.2, r * 0.11, 0, 7); g.stroke();
    g.beginPath(); g.arc(r * 0.08, r * 0.2, r * 0.13, 0, 7); g.stroke();
    g.lineWidth = lw;
  } else if (id === 6) { // Rose: offene Blüte
    petal(5, r * 0.44, r * 0.34, r * 0.22);
    g.beginPath(); g.arc(0, 0, r * 0.22, 0, 7); g.fill();
  } else if (id === 7) { // Honig: klare Wabe
    const hex = (cx, cy, hr) => {
      g.beginPath();
      g.moveTo(cx + hr, cy);
      for (let i = 1; i <= 6; i++) g.lineTo(cx + Math.cos(i * Math.PI / 3) * hr, cy + Math.sin(i * Math.PI / 3) * hr);
      g.closePath(); g.fill();
    };
    const hr = r * 0.28, dx = hr * 1.85, dy = hr * 1.62;
    hex(0, 0, hr); hex(-dx, 0, hr); hex(dx, 0, hr);
    hex(-dx / 2, -dy, hr); hex(dx / 2, -dy, hr);
    hex(-dx / 2, dy, hr); hex(dx / 2, dy, hr);
  } else if (id === 8) { // Kamille
    petal(8, r * 0.5, r * 0.24, r * 0.16);
    g.beginPath(); g.arc(0, 0, r * 0.26, 0, 7); g.fill();
  } else if (id === 9) { // Aktivkohle: Wirbel
    const lw = g.lineWidth;
    g.lineWidth = r * 0.1;
    g.beginPath();
    g.moveTo(0, 0);
    for (let i = 1; i <= 56; i++) {
      const tt = i / 56, a = tt * Math.PI * 3.4, rr = tt * r * 0.78;
      g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    g.stroke();
    g.lineWidth = lw;
  } else if (id === 10) { // Matcha: breites Blatt schräg
    g.beginPath();
    g.ellipse(0, 0, r * 0.7, r * 0.36, 0.6, 0, 7);
    g.fill();
  } else {
    petal(5, r * 0.4, r * 0.28, r * 0.17);
    g.beginPath(); g.arc(0, 0, r * 0.18, 0, 7); g.fill();
  }
}

function paintGlyph(g, soap, S, scale = 0.40) {
  g.save();
  g.translate(S / 2, S / 2);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.lineWidth = 5;
  drawGlyph(g, soap.id, S * scale);
  if (soap.id === 3 || soap.id === 10) {
    g.beginPath();
    g.moveTo(0, S * 0.24);
    g.quadraticCurveTo(S * 0.016, 0, 0, -S * 0.24);
    g.lineWidth = 10;
    g.stroke();
  }
  g.restore();
}

function heightCanvas(soap, S = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, S, S);
  g.filter = 'blur(1.1px)';
  g.fillStyle = '#fff';
  g.strokeStyle = '#fff';
  paintGlyph(g, soap, S);
  g.filter = 'none';
  return c;
}

function normalFromHeight(c, strength = 4.4) {
  const w = c.width, h = c.height;
  const g = c.getContext('2d');
  const src = g.getImageData(0, 0, w, h).data;
  const out = g.createImageData(w, h);
  const dst = out.data;
  const at = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const nx = -dx, ny = dy, nz = 1;
      const len = Math.hypot(nx, ny, nz) || 1;
      const i = (y * w + x) * 4;
      dst[i] = (nx / len * 0.5 + 0.5) * 255;
      dst[i + 1] = (ny / len * 0.5 + 0.5) * 255;
      dst[i + 2] = (nz / len * 0.5 + 0.5) * 255;
      dst[i + 3] = 255;
    }
  }
  const n = document.createElement('canvas');
  n.width = w; n.height = h;
  n.getContext('2d').putImageData(out, 0, 0);
  return n;
}

/** Gleichfarbiges Relief: leichte Vertiefung, helle Außenkante, dunkle Innenkante. */
function reliefAlbedo(soap, S = 512) {
  const body = col(soap);
  const lum = body.r * 0.22 + body.g * 0.7 + body.b * 0.08;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = rgb(body, 1);
  g.fillRect(0, 0, S, S);
  const dark = lum < 0.38
    ? 'rgba(0,0,0,0.4)'
    : `rgba(${Math.round(body.r * 55)},${Math.round(body.g * 55)},${Math.round(body.b * 55)},0.65)`;
  const light = lum < 0.38
    ? 'rgba(255,255,255,0.4)'
    : 'rgba(255,255,255,0.75)';
  const recess = lum < 0.38
    ? rgb(new THREE.Color(Math.min(1, body.r * 1.28 + 0.08), Math.min(1, body.g * 1.28 + 0.08), Math.min(1, body.b * 1.28 + 0.08)))
    : rgb(new THREE.Color(body.r * 0.78, body.g * 0.78, body.b * 0.78));
  const run = (dx, dy, fill) => {
    g.save();
    g.translate(dx, dy);
    g.fillStyle = fill;
    g.strokeStyle = fill;
    paintGlyph(g, soap, S);
    g.restore();
  };
  run(4, 5, dark);
  run(-4, -4, light);
  run(0, 0, recess);
  return c;
}

function tex(canvas, { color = false, linear = true } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.generateMipmaps = !linear;
  t.minFilter = linear ? THREE.LinearFilter : THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

function stampMaps(soap) {
  if (FACE.has(soap.id)) return FACE.get(soap.id);
  const height = heightCanvas(soap);
  const maps = {
    albedo: tex(reliefAlbedo(soap), { color: true, linear: true }),
    bump: tex(height, { linear: true }),
    normal: tex(normalFromHeight(height), { linear: true }),
  };
  maps.normal.colorSpace = THREE.NoColorSpace;
  FACE.set(soap.id, maps);
  return maps;
}

function starTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.translate(128, 128);
  const glow = g.createRadialGradient(0, 0, 2, 0, 0, 120);
  glow.addColorStop(0, 'rgba(255, 240, 150, 0.95)');
  glow.addColorStop(0.2, 'rgba(255, 210, 80, 0.55)');
  glow.addColorStop(1, 'rgba(255, 200, 60, 0)');
  g.fillStyle = glow; g.beginPath(); g.arc(0, 0, 120, 0, 7); g.fill();
  g.fillStyle = '#ffe56a';
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4 - Math.PI / 2, r = i % 2 ? 14 : 110;
    i ? g.lineTo(Math.cos(a) * r, Math.sin(a) * r) : g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.closePath(); g.fill();
  g.fillStyle = '#fff8d0';
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4 - Math.PI / 2, r = i % 2 ? 7 : 70;
    i ? g.lineTo(Math.cos(a) * r, Math.sin(a) * r) : g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.closePath(); g.fill();
  return tex(c, { color: true });
}

function cubbyAOTex() {
  const S = 256, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const vg = g.createLinearGradient(0, 0, 0, S);
  vg.addColorStop(0, 'rgba(90, 40, 16, .5)');
  vg.addColorStop(0.2, 'rgba(90, 40, 16, .12)');
  vg.addColorStop(0.75, 'rgba(90, 40, 16, .04)');
  vg.addColorStop(1, 'rgba(90, 40, 16, .18)');
  g.fillStyle = vg; g.fillRect(0, 0, S, S);
  const hg = g.createLinearGradient(0, 0, S, 0);
  hg.addColorStop(0, 'rgba(70, 30, 10, .38)');
  hg.addColorStop(0.16, 'rgba(70, 30, 10, 0)');
  hg.addColorStop(0.84, 'rgba(70, 30, 10, 0)');
  hg.addColorStop(1, 'rgba(70, 30, 10, .38)');
  g.fillStyle = hg; g.fillRect(0, 0, S, S);
  return tex(c);
}

function blobTex() {
  const S = 128, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 6, 64, 64, 62);
  gr.addColorStop(0, 'rgba(70, 32, 12, .55)');
  gr.addColorStop(0.5, 'rgba(70, 32, 12, .2)');
  gr.addColorStop(1, 'rgba(70, 32, 12, 0)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  return tex(c);
}

function toyWoodTex(aniso, opts = {}) {
  const w = 512, h = 512, planks = opts.planks || 4;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const tones = opts.tones || ['#efc37a', '#e4b56a', '#f3cc88', '#dca85c'];
  const grain = opts.grain || 0.14;
  const pw = w / planks;
  for (let p = 0; p < planks; p++) {
    const x0 = p * pw;
    g.fillStyle = tones[p % tones.length];
    g.fillRect(x0, 0, pw, h);
    const lg = g.createLinearGradient(x0, 0, x0 + pw, 0);
    lg.addColorStop(0, 'rgba(120, 60, 16, .16)');
    lg.addColorStop(0.45, 'rgba(255, 236, 190, .12)');
    lg.addColorStop(1, 'rgba(120, 60, 16, .14)');
    g.fillStyle = lg; g.fillRect(x0, 0, pw, h);
    for (let l = 0; l < 14; l++) {
      g.strokeStyle = `rgba(130, 70, 22, ${grain * (0.45 + (l % 3) * 0.25)})`;
      g.lineWidth = 1 + (l % 2);
      const gx = x0 + 8 + (l / 14) * (pw - 16), ph = l * 0.85;
      g.beginPath();
      for (let y = 0; y <= h; y += 6) {
        const x = gx + Math.sin(y * 0.014 + ph) * 3.5;
        if (y === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    }
  }
  const t = tex(c, { color: true, linear: false });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  return t;
}

export function mountApothecary(canvas, getItems) {
  const host = canvas.parentElement;
  const labelsRoot = document.getElementById('shelf-labels');
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, powerPreference: 'high-performance', stencil: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(PINK_BG, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PINK_BG);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envSrc = makeEnvTexture();
  const env = pmrem.fromEquirectangular(envSrc).texture;
  envSrc.dispose(); pmrem.dispose();
  scene.environment = env;
  scene.environmentIntensity = 0.42;

  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const woodMap = toyWoodTex(aniso, {
    planks: 3, tones: ['#e8c078', '#f0cc8a', '#e2b66c'], grain: 0.07,
  });
  woodMap.repeat.set(1, 1);
  const wood = new THREE.MeshStandardMaterial({
    map: woodMap, color: 0xffffff, roughness: 0.58, metalness: 0, envMapIntensity: 0.14,
  });
  const backMap = toyWoodTex(aniso, {
    planks: 5,
    tones: ['#c4893e', '#b47a34', '#cb9348', '#a86c2c'], grain: 0.22,
  });
  const woodBack = new THREE.MeshStandardMaterial({
    map: backMap, color: 0xffffff, roughness: 0.72, metalness: 0, envMapIntensity: 0.06,
  });
  const lilac = new THREE.MeshPhysicalMaterial({
    color: 0xd4b4f0, roughness: 0.32, metalness: 0.05, clearcoat: 0.5, clearcoatRoughness: 0.28,
    envMapIntensity: 0.35, emissive: 0xf3e8ff, emissiveIntensity: 0.04,
  });
  const lilacHi = new THREE.MeshPhysicalMaterial({
    color: 0xf3e6ff, roughness: 0.22, metalness: 0.04, clearcoat: 0.65, clearcoatRoughness: 0.2,
    envMapIntensity: 0.4, emissive: 0xffffff, emissiveIntensity: 0.08,
  });

  scene.add(new THREE.HemisphereLight(0xfff6e8, 0xd4a060, 1.18));
  const sun = new THREE.DirectionalLight(0xfff3d8, 1.2);
  sun.position.set(-2.2, 5.4, 5.5);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffe4c8, 0.32);
  fill.position.set(2.4, 2.4, 4.2);
  scene.add(fill);

  const cabW = COLS * PITCH_X + DIV + FRAME * 2;
  const gridH = ROWS * PITCH_Y + DIV;
  const cabH = gridH + BASE_H + CROWN_H;
  const cabD = DEPTH + BACK_T;
  const cabinet = new THREE.Group();
  scene.add(cabinet);

  const addBox = (mat, w, h, d, x, y, z, r = 0) => {
    const geo = r > 0 ? new RoundedBoxGeometry(w, h, d, 5, r) : new THREE.BoxGeometry(w, h, d);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    cabinet.add(m);
    return m;
  };

  addBox(lilac, FRAME, cabH, cabD + 0.05, -cabW / 2 + FRAME / 2, cabH / 2, 0.01, 0.055);
  addBox(lilac, FRAME, cabH, cabD + 0.05, cabW / 2 - FRAME / 2, cabH / 2, 0.01, 0.055);
  addBox(lilac, cabW + 0.03, CROWN_H, cabD + 0.07, 0, cabH - CROWN_H / 2, 0.015, 0.04);
  addBox(lilacHi, cabW + 0.02, CROWN_H * 0.38, cabD + 0.05, 0, cabH - CROWN_H * 0.22, 0.03, 0.03);
  addBox(lilacHi, FRAME * 0.45, cabH - CROWN_H * 0.4, 0.03, -cabW / 2 + FRAME * 0.72, cabH / 2 - CROWN_H * 0.1, cabD / 2 + 0.015, 0.02);
  addBox(lilac, cabW + 0.03, BASE_H, cabD + 0.07, 0, BASE_H / 2, 0.015, 0.04);
  addBox(woodBack, cabW - FRAME * 1.7, gridH, BACK_T, 0, BASE_H + gridH / 2, -DEPTH / 2 - BACK_T / 2, 0.02);
  for (let r = 0; r <= ROWS; r++) {
    addBox(wood, cabW - FRAME * 2, DIV, cabD - BACK_T * 0.35, 0, BASE_H + r * PITCH_Y, 0.035, 0.058);
  }
  for (let c = 1; c < COLS; c++) {
    const x = -cabW / 2 + FRAME + DIV / 2 + c * PITCH_X;
    addBox(wood, DIV, gridH, cabD - BACK_T * 0.35, x, BASE_H + gridH / 2, 0.035, 0.058);
  }

  function boardCenterY(rowFromBottom) { return BASE_H + rowFromBottom * PITCH_Y; }
  function shelfTop(rowFromBottom) { return boardCenterY(rowFromBottom) + DIV / 2; }
  function cellPos(col, row) {
    const x = -cabW / 2 + FRAME + DIV + CELL_W / 2 + col * PITCH_X;
    const y = shelfTop(ROWS - 1 - row) + CELL_H / 2;
    return { x, y, z: DEPTH / 2 - SOAP_D / 2 - 0.03 };
  }

  const aoMat = new THREE.MeshBasicMaterial({ map: cubbyAOTex(), transparent: true, depthWrite: false, opacity: 0.95 });
  const aoGeo = new THREE.PlaneGeometry(CELL_W * 0.98, CELL_H * 0.98);
  for (let row = 0; row < ROWS; row++) {
    for (let c = 0; c < COLS; c++) {
      const p = cellPos(c, row);
      const ao = new THREE.Mesh(aoGeo, aoMat);
      ao.position.set(p.x, p.y, -DEPTH / 2 + 0.01);
      cabinet.add(ao);
    }
  }

  const soapsRoot = new THREE.Group();
  cabinet.add(soapsRoot);
  const bodyGeo = new RoundedBoxGeometry(SOAP_W, SOAP_H, SOAP_D, 7, SOAP_R);
  const faceGeo = new THREE.PlaneGeometry(SOAP_W * 0.72, SOAP_D * 0.72);
  const hlTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(80, 80, 2, 80, 80, 130);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.22, 'rgba(255,255,255,.45)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    return tex(c);
  })();
  const hlGeo = new THREE.PlaneGeometry(SOAP_W * 0.7, SOAP_D * 0.55);
  const blobMat = new THREE.MeshBasicMaterial({ map: blobTex(), transparent: true, depthWrite: false });
  const blobGeo = new THREE.PlaneGeometry(SOAP_W * 1.12, SOAP_D * 0.9);
  const starMat = new THREE.MeshBasicMaterial({
    map: starTex(), transparent: true, depthWrite: false, depthTest: false, opacity: 1,
  });
  const starGeo = new THREE.PlaneGeometry(1, 1);
  const sparkles = [];
  const labelAnchors = [];

  function addSoap(group, soap, yOff) {
    const bodyCol = col(soap);
    const body = new THREE.Mesh(bodyGeo, new THREE.MeshPhysicalMaterial({
      color: bodyCol, roughness: 0.22, metalness: 0,
      clearcoat: 0.82, clearcoatRoughness: 0.14, envMapIntensity: 0.55,
    }));
    const maps = stampMaps(soap);
    const face = new THREE.Mesh(faceGeo, new THREE.MeshPhysicalMaterial({
      color: 0xffffff, map: maps.albedo, bumpMap: maps.bump, bumpScale: 0.06,
      normalMap: maps.normal, normalScale: new THREE.Vector2(1.05, 1.05),
      roughness: 0.3, metalness: 0,
      clearcoat: 0.45, clearcoatRoughness: 0.28, envMapIntensity: 0.35,
    }));
    face.rotation.x = -Math.PI / 2;
    const hl = new THREE.Mesh(hlGeo, new THREE.MeshBasicMaterial({
      map: hlTex, transparent: true, depthWrite: false, opacity: 0.88,
    }));
    hl.rotation.x = -Math.PI / 2;
    hl.position.set(-SOAP_W * 0.14, SOAP_H + 0.0032, -SOAP_D * 0.08);
    const sh = new THREE.Mesh(blobGeo, blobMat);
    sh.rotation.x = -Math.PI / 2;
    sh.position.set(0, yOff - SOAP_H / 2 + 0.003, 0.01);
    const pivot = new THREE.Group();
    pivot.position.set(0, yOff - SOAP_H / 2, 0);
    pivot.rotation.x = SOAP_TILT;
    body.position.y = SOAP_H / 2;
    face.position.set(0, SOAP_H + 0.0014, 0);
    hl.position.y = SOAP_H + 0.0032;
    pivot.add(body); pivot.add(face); pivot.add(hl);
    group.add(sh); group.add(pivot);
  }

  function addSparkle(group, x, y, z, s) {
    const m = new THREE.Mesh(starGeo, starMat.clone());
    m.position.set(x, y, z);
    m.scale.setScalar(s);
    m.userData.phase = Math.random() * 6;
    m.userData.base = s;
    m.renderOrder = 4;
    group.add(m);
    sparkles.push(m);
  }

  function pack() {
    const raw = (getItems && getItems()) || null;
    if (raw && raw.items) return raw;
    if (Array.isArray(raw) && raw.length) return { items: raw, caption: '' };
    return { items: SOAP_LIST.map((soap) => ({ soap, pieces: 2 })), caption: 'Die Sorten der Manufaktur' };
  }

  function clearLabels() {
    if (labelsRoot) labelsRoot.innerHTML = '';
    labelAnchors.length = 0;
  }

  function fillSoaps() {
    sparkles.length = 0;
    while (soapsRoot.children.length) soapsRoot.remove(soapsRoot.children[0]);
    clearLabels();
    const { items, caption } = pack();
    const msg = document.getElementById('shelf-msg');
    if (msg) {
      msg.textContent = caption || '';
      msg.hidden = !caption;
    }
    const isVorrat = /Vorrat/i.test(caption || '');
    const placed = [];
    if (isVorrat) {
      items.forEach((it, i) => {
        if (it && it.pieces > 0 && i < COLS * ROWS) {
          placed.push({ it, col: i % COLS, row: Math.floor(i / COLS) });
        }
      });
    } else {
      const n = COLS * ROWS;
      for (let i = 0; i < n; i++) {
        const it = items[i % items.length];
        if (it && it.pieces > 0) placed.push({ it, col: i % COLS, row: Math.floor(i / COLS) });
      }
    }
    for (const { it, col, row } of placed) {
      const soap = it.soap;
      const n = it.pieces;
      const p = cellPos(col, row);
      const g = new THREE.Group();
      g.position.set(p.x, p.y, p.z);
      const floorY = -CELL_H / 2 + SOAP_H / 2 + 0.012;
      addSoap(g, soap, floorY);
      const topY = floorY + SOAP_H * 0.7;
      addSparkle(g, -SOAP_W * 0.62, topY + 0.1, SOAP_D * 0.55, 0.13);
      addSparkle(g, SOAP_W * 0.6, topY + 0.06, SOAP_D * 0.5, 0.1);
      addSparkle(g, -SOAP_W * 0.15, topY + 0.16, SOAP_D * 0.2, 0.085);
      addSparkle(g, SOAP_W * 0.22, topY + 0.02, SOAP_D * 0.62, 0.075);
      soapsRoot.add(g);

      if (labelsRoot) {
        const el = document.createElement('span');
        el.className = 'shelf-pill';
        el.textContent = `${soap.name} ×${n}`;
        labelsRoot.appendChild(el);
        const anchor = new THREE.Vector3(
          p.x,
          boardCenterY(ROWS - 1 - row) - DIV * 0.08,
          DEPTH / 2 + 0.035,
        );
        labelAnchors.push({ el, anchor });
      }
    }
  }

  const floorMap = toyWoodTex(aniso, { planks: 7, tones: ['#f0c888', '#e8bc78', '#f4d09a', '#ecd09a'] });

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 2.4),
    new THREE.MeshStandardMaterial({ map: floorMap, roughness: 0.72, metalness: 0, envMapIntensity: 0.1 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 0.7);
  scene.add(floor);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 50);
  const look = new THREE.Vector3();
  const lookY = cabH * 0.5;
  let camZ = 8, camY = lookY + 2;
  let camX = 0, vel = 0, dragging = false, lastPx = 0, lastT = 0, moved = false;
  let camMin = 0, camMax = 0, worldPerPx = 0.004;
  const _proj = new THREE.Vector3();

  function layoutCam() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    const saT = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sa-top')) || 0;
    const saB = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sa-bottom')) || 0;
    const topHUD = saT + 86, botHUD = saB + 58;
    const bandMid = (topHUD + (h - botHUD)) / 2 / h;
    const bandH = Math.max(0.45, (h - botHUD - topHUD) / h);
    // Genau 3 Fächer + linker Rahmen füllen die Bildbreite.
    const visW = FRAME + 3 * PITCH_X;
    const halfW = visW / 2;
    const halfH = halfW * (h / w);
    camera.left = -halfW; camera.right = halfW;
    camera.top = halfH; camera.bottom = -halfH;
    camera.setViewOffset(w, h, 0, (0.5 - bandMid) * h, w, h);
    camera.updateProjectionMatrix();
    camZ = 8;
    camY = lookY + camZ * Math.tan(CAM_TILT);
    worldPerPx = visW / w;
    const peek = 0;
    camMin = -cabW / 2 + visW / 2 - peek;
    camMax = cabW / 2 - visW / 2 + peek;
    if (camMax < camMin) { const mid = (camMin + camMax) / 2; camMin = camMax = mid; }
    camX = THREE.MathUtils.clamp(camX, camMin, camMax);
  }

  function applyCam() {
    camera.position.set(camX, camY, camZ);
    look.set(camX, lookY, 0);
    camera.lookAt(look);
  }

  function placeLabels() {
    if (!labelAnchors.length) return;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    camera.updateMatrixWorld();
    for (const { el, anchor } of labelAnchors) {
      _proj.copy(anchor).project(camera);
      const x = (_proj.x * 0.5 + 0.5) * w;
      const y = (-_proj.y * 0.5 + 0.5) * h;
      const vis = _proj.z < 1 && x > -60 && x < w + 60 && y > -30 && y < h + 30;
      el.style.display = vis ? '' : 'none';
      if (vis) el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -35%)`;
    }
  }

  function resetCam() {
    vel = 0;
    camX = camMin;
    applyCam();
    placeLabels();
  }

  function resize() { layoutCam(); applyCam(); placeLabels(); }

  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button != null && e.button !== 0) return;
    dragging = true; moved = false; vel = 0;
    lastPx = e.clientX; lastT = performance.now();
    canvas.setPointerCapture?.(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const now = performance.now();
    const dx = e.clientX - lastPx;
    if (Math.abs(dx) > 2) moved = true;
    const dt = Math.max(0.008, (now - lastT) / 1000);
    camX -= dx * worldPerPx;
    vel = -(dx * worldPerPx) / dt;
    camX = THREE.MathUtils.clamp(camX, camMin, camMax);
    if (camX === camMin || camX === camMax) vel = 0;
    lastPx = e.clientX; lastT = now;
    applyCam();
    placeLabels();
  });
  const endDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    try { canvas.releasePointerCapture?.(e.pointerId); } catch { /* schon frei */ }
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('click', (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);

  let raf = 0, last = 0, running = false, time = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now; time += dt;
    if (!dragging && vel) {
      camX += vel * dt;
      vel *= Math.exp(-DAMP * dt);
      if (camX < camMin) { camX = camMin; vel = 0; }
      if (camX > camMax) { camX = camMax; vel = 0; }
      if (Math.abs(vel) < 0.002) vel = 0;
      applyCam();
    }
    for (const s of sparkles) {
      const k = 0.82 + 0.28 * Math.sin(time * 3.1 + s.userData.phase);
      s.scale.setScalar(s.userData.base * k);
      s.material.opacity = 0.65 + 0.35 * Math.sin(time * 3.4 + s.userData.phase * 1.2);
      s.lookAt(camera.position);
    }
    renderer.render(scene, camera);
    placeLabels();
    canvas.dataset.camX = camX.toFixed(3);
    canvas.dataset.camMin = camMin.toFixed(3);
    canvas.dataset.camMax = camMax.toFixed(3);
    canvas.dataset.cabX = cabinet.position.x.toFixed(3);
  }

  if (document.fonts && document.fonts.load) {
    document.fonts.load('600 13px Fredoka').then(() => { if (running) { fillSoaps(); placeLabels(); } }).catch(() => {});
  }
  if (window.ResizeObserver) new ResizeObserver(() => { if (running) resize(); }).observe(host || canvas);

  const api = {
    start() {
      if (running) return;
      running = true; last = 0; time = 0;
      resize(); fillSoaps();
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
    refresh() { fillSoaps(); placeLabels(); },
    resetCam() { resize(); resetCam(); },
    jump(x) { vel = 0; camX = THREE.MathUtils.clamp(x, camMin, camMax); applyCam(); placeLabels(); },
    get camX() { return camX; },
    get camMin() { return camMin; },
    get camMax() { return camMax; },
    get cabinetX() { return cabinet.position.x; },
    get running() { return running; },
    el: canvas,
  };
  return api;
}
