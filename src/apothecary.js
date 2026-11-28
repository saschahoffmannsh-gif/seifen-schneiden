// SS-19: Vollbild-Seifenregal als 3D-Apothekerschrank im Pastell-Comic-Look
// (so nah wie möglich am festgelegten Referenzbild, nur breiter mit mehr Fächern).
// Der Schrank steht fest und füllt fast den Bildschirm; Wischen schiebt die Kamera
// seitlich mit Schwung, an den Enden ist Schluss. Schilder laufen mit.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { SOAP_LIST } from './soaps.js';
import { makeEnvTexture } from './setting/textures.js';

const COLS = 6, ROWS = 5;
const CELL = 0.54, DIV = 0.1, PITCH = CELL + DIV, DEPTH = 0.50;
const FRAME = 0.14, BASE_H = 0.15, CROWN_H = 0.13, BACK_T = 0.08;
const SOAP_W = 0.49, SOAP_H = 0.18, SOAP_D = 0.46, SOAP_R = 0.085;
const DAMP = 6.2, CAM_TILT = 28 * Math.PI / 180;
const PINK_BG = 0xffd9ea;

// Längerer Schrank: 12 Sorten über 6 Spalten, Startansicht gut gefüllt.
const SLOTS = [
  [0, 0], [1, 0], [2, 0],
  [0, 1], [1, 1], [3, 1],
  [0, 2], [2, 2], [4, 2],
  [1, 3], [3, 3], [5, 4],
];

const FACE = new Map();

function rgb(c, k = 1) {
  return `rgb(${Math.round(c.r * 255 * k)},${Math.round(c.g * 255 * k)},${Math.round(c.b * 255 * k)})`;
}
function col(soap) {
  const a = soap.base, b = soap.light || soap.base;
  const k = 0.68; // überwiegend base, damit Pastell satt bleibt
  return new THREE.Color(
    a[0] * k + b[0] * (1 - k),
    a[1] * k + b[1] * (1 - k),
    a[2] * k + b[2] * (1 - k),
  );
}

/** Glatte, hochauflösende Prägung je Sorte – kein Voxel-Look. */
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

function stampTex(soap) {
  if (FACE.has(soap.id)) return FACE.get(soap.id);
  const S = 1024, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const body = col(soap);
  const lum = body.r * 0.22 + body.g * 0.7 + body.b * 0.08;
  const dark = lum < 0.38
    ? `rgba(255,255,255,0.7)`
    : rgb(new THREE.Color(body.r * 0.5, body.g * 0.5, body.b * 0.5));
  const mid = lum < 0.38
    ? `rgba(235,235,240,0.85)`
    : rgb(new THREE.Color(body.r * 0.62, body.g * 0.62, body.b * 0.62));
  const hi = lum < 0.38 ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.55)';
  const run = (dx, dy, fill) => {
    g.save();
    g.translate(S / 2 + dx, S / 2 + dy);
    g.fillStyle = fill;
    g.strokeStyle = fill;
    g.lineWidth = 5;
    g.lineJoin = 'round';
    g.lineCap = 'round';
    drawGlyph(g, soap.id, S * 0.42);
    if (soap.id === 3 || soap.id === 10) {
      g.beginPath();
      g.moveTo(0, S * 0.24);
      g.quadraticCurveTo(S * 0.016, 0, 0, -S * 0.24);
      g.lineWidth = 10;
      g.stroke();
    }
    g.restore();
  };
  run(7, 9, dark);
  run(-6, -7, hi);
  run(0, 0, mid);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.premultiplyAlpha = true;
  tex.needsUpdate = true;
  FACE.set(soap.id, tex);
  return tex;
}

function starTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.translate(64, 64);
  const glow = g.createRadialGradient(0, 0, 2, 0, 0, 60);
  glow.addColorStop(0, 'rgba(255, 252, 220, 1)');
  glow.addColorStop(0.25, 'rgba(255, 236, 150, .7)');
  glow.addColorStop(1, 'rgba(255, 236, 150, 0)');
  g.fillStyle = glow; g.beginPath(); g.arc(0, 0, 60, 0, 7); g.fill();
  g.fillStyle = '#fffce6';
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4 - Math.PI / 2, r = i % 2 ? 8 : 52;
    i ? g.lineTo(Math.cos(a) * r, Math.sin(a) * r) : g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.closePath(); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true;
  return t;
}

function cubbyAOTex() {
  const S = 256, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const vg = g.createLinearGradient(0, 0, 0, S);
  vg.addColorStop(0, 'rgba(70, 32, 16, .42)');
  vg.addColorStop(0.22, 'rgba(70, 32, 16, .12)');
  vg.addColorStop(0.7, 'rgba(70, 32, 16, .05)');
  vg.addColorStop(1, 'rgba(70, 32, 16, .28)');
  g.fillStyle = vg; g.fillRect(0, 0, S, S);
  const hg = g.createLinearGradient(0, 0, S, 0);
  hg.addColorStop(0, 'rgba(60, 25, 10, .28)');
  hg.addColorStop(0.18, 'rgba(60, 25, 10, 0)');
  hg.addColorStop(0.82, 'rgba(60, 25, 10, 0)');
  hg.addColorStop(1, 'rgba(60, 25, 10, .28)');
  g.fillStyle = hg; g.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  return t;
}

function blobTex() {
  const S = 128, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 8, 64, 64, 62);
  gr.addColorStop(0, 'rgba(50, 24, 10, .4)');
  gr.addColorStop(0.55, 'rgba(50, 24, 10, .16)');
  gr.addColorStop(1, 'rgba(50, 24, 10, 0)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  return t;
}

function toyWoodTex(aniso) {
  const w = 512, h = 512, planks = 5;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const tones = ['#efc37a', '#f3cc86', '#e8b86c', '#f6d092', '#e2b062'];
  const pw = w / planks;
  for (let p = 0; p < planks; p++) {
    const x0 = p * pw;
    g.fillStyle = tones[p % tones.length];
    g.fillRect(x0, 0, pw, h);
    const lg = g.createLinearGradient(x0, 0, x0 + pw, 0);
    lg.addColorStop(0, 'rgba(160, 90, 30, .1)');
    lg.addColorStop(0.5, 'rgba(255, 240, 200, .12)');
    lg.addColorStop(1, 'rgba(160, 90, 30, .12)');
    g.fillStyle = lg; g.fillRect(x0, 0, pw, h);
    for (let l = 0; l < 18; l++) {
      g.strokeStyle = `rgba(180, 110, 40, ${0.04 + (l % 3) * 0.03})`;
      g.lineWidth = 1 + (l % 2);
      const gx = x0 + 8 + (l / 18) * (pw - 16), ph = l * 0.7;
      g.beginPath();
      for (let y = 0; y <= h; y += 8) {
        const x = gx + Math.sin(y * 0.012 + ph) * 3;
        if (y === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    }
    g.fillStyle = 'rgba(140, 80, 30, .22)'; g.fillRect(x0, 0, 3, h);
    g.fillStyle = 'rgba(255, 240, 200, .18)'; g.fillRect(x0 + 3, 0, 2, h);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  t.needsUpdate = true;
  return t;
}

function slotOf(id) { return SLOTS[id % SLOTS.length]; }

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
  scene.environmentIntensity = 0.32;

  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const woodMap = toyWoodTex(aniso);
  woodMap.repeat.set(1, 1);
  const wood = new THREE.MeshStandardMaterial({
    map: woodMap, roughness: 0.55, metalness: 0, envMapIntensity: 0.2,
  });
  const woodBack = new THREE.MeshStandardMaterial({
    color: 0xd49a4c, roughness: 0.72, metalness: 0, envMapIntensity: 0.08,
  });
  const lilac = new THREE.MeshPhysicalMaterial({
    color: 0xd2b4f4, roughness: 0.32, metalness: 0.06, clearcoat: 0.55, clearcoatRoughness: 0.25,
    envMapIntensity: 0.4, emissive: 0xf3e8ff, emissiveIntensity: 0.06,
  });

  scene.add(new THREE.HemisphereLight(0xfff6fb, 0xe0b070, 1.05));
  const sun = new THREE.DirectionalLight(0xfff8f0, 0.95);
  sun.position.set(-0.4, 6.5, 3.2);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffe8f4, 0.32);
  fill.position.set(2.4, 2.4, 4);
  scene.add(fill);

  const cabW = COLS * PITCH + DIV + FRAME * 2;
  const gridH = ROWS * PITCH + DIV;
  const cabH = gridH + BASE_H + CROWN_H;
  const cabD = DEPTH + BACK_T;
  const cabinet = new THREE.Group();
  scene.add(cabinet);

  const addBox = (mat, w, h, d, x, y, z, r = 0) => {
    const geo = r > 0 ? new RoundedBoxGeometry(w, h, d, 4, r) : new THREE.BoxGeometry(w, h, d);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    cabinet.add(m);
    return m;
  };

  addBox(lilac, FRAME, cabH, cabD + 0.05, -cabW / 2 + FRAME / 2, cabH / 2, 0, 0.06);
  addBox(lilac, FRAME, cabH, cabD + 0.05, cabW / 2 - FRAME / 2, cabH / 2, 0, 0.06);
  addBox(lilac, cabW + 0.03, CROWN_H, cabD + 0.08, 0, cabH - CROWN_H / 2, 0.015, 0.06);
  addBox(lilac, cabW + 0.03, BASE_H, cabD + 0.08, 0, BASE_H / 2, 0.015, 0.06);
  addBox(woodBack, cabW - FRAME * 1.7, gridH, BACK_T, 0, BASE_H + gridH / 2, -DEPTH / 2 - BACK_T / 2, 0.02);
  for (let r = 0; r <= ROWS; r++) {
    addBox(wood, cabW - FRAME * 2, DIV, cabD - BACK_T * 0.2, 0, BASE_H + r * PITCH, 0.012, 0.04);
  }
  for (let c = 1; c < COLS; c++) {
    const x = -cabW / 2 + FRAME + DIV / 2 + c * PITCH;
    addBox(wood, DIV, gridH, cabD - BACK_T * 0.2, x, BASE_H + gridH / 2, 0.012, 0.04);
  }

  function shelfTop(rowFromBottom) { return BASE_H + rowFromBottom * PITCH + DIV / 2; }
  function cellPos(col, row) {
    const x = -cabW / 2 + FRAME + DIV + CELL / 2 + col * PITCH;
    const y = shelfTop(ROWS - 1 - row) + CELL / 2;
    return { x, y, z: DEPTH / 2 - SOAP_D / 2 - 0.01 };
  }

  // Sanfte Schatten in jedem Fach (auch den leeren)
  const aoMat = new THREE.MeshBasicMaterial({ map: cubbyAOTex(), transparent: true, depthWrite: false, opacity: 0.95 });
  const aoGeo = new THREE.PlaneGeometry(CELL * 0.98, CELL * 0.98);
  for (let row = 0; row < ROWS; row++) {
    for (let c = 0; c < COLS; c++) {
      const p = cellPos(c, row);
      const ao = new THREE.Mesh(aoGeo, aoMat);
      ao.position.set(p.x, p.y, -DEPTH / 2 + 0.012);
      cabinet.add(ao);
    }
  }

  const soapsRoot = new THREE.Group();
  cabinet.add(soapsRoot);
  const bodyGeo = new RoundedBoxGeometry(SOAP_W, SOAP_H, SOAP_D, 6, SOAP_R);
  const faceGeo = new THREE.PlaneGeometry(SOAP_W * 0.84, SOAP_D * 0.84);
  const hlTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(90, 80, 4, 90, 80, 140);
    gr.addColorStop(0, 'rgba(255,255,255,.85)');
    gr.addColorStop(0.35, 'rgba(255,255,255,.25)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c); t.needsUpdate = true; return t;
  })();
  const hlGeo = new THREE.PlaneGeometry(SOAP_W * 0.7, SOAP_D * 0.55);
  const blobMat = new THREE.MeshBasicMaterial({ map: blobTex(), transparent: true, depthWrite: false });
  const blobGeo = new THREE.PlaneGeometry(SOAP_W * 1.15, SOAP_D * 0.85);
  const starMat = new THREE.MeshBasicMaterial({ map: starTex(), transparent: true, depthWrite: false, opacity: 0.95 });
  const starGeo = new THREE.PlaneGeometry(1, 1);
  const sparkles = [];
  const labelAnchors = [];

  function addSoap(group, soap, yOff) {
    const body = new THREE.Mesh(bodyGeo, new THREE.MeshPhysicalMaterial({
      color: col(soap), roughness: 0.32, metalness: 0,
      clearcoat: 0.45, clearcoatRoughness: 0.28, envMapIntensity: 0.35,
    }));
    body.position.y = yOff;
    const face = new THREE.Mesh(faceGeo, new THREE.MeshBasicMaterial({
      map: stampTex(soap), transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }));
    face.rotation.x = -Math.PI / 2;
    face.position.set(0, yOff + SOAP_H / 2 + 0.0015, 0);
    const hl = new THREE.Mesh(hlGeo, new THREE.MeshBasicMaterial({
      map: hlTex, transparent: true, depthWrite: false, opacity: 0.28,
    }));
    hl.rotation.x = -Math.PI / 2;
    hl.position.set(-SOAP_W * 0.06, yOff + SOAP_H / 2 + 0.005, -SOAP_D * 0.08);
    const sh = new THREE.Mesh(blobGeo, blobMat);
    sh.rotation.x = -Math.PI / 2;
    sh.position.set(0, yOff - SOAP_H / 2 + 0.004, 0.01);
    group.add(sh); group.add(body); group.add(face); group.add(hl);
  }

  function addSparkle(group, x, y, z, s) {
    const m = new THREE.Mesh(starGeo, starMat.clone());
    m.position.set(x, y, z);
    m.scale.setScalar(s);
    m.userData.phase = Math.random() * 6;
    m.userData.base = s;
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
    const byId = new Map(items.map((it) => [it.soap.id, it]));
    for (const soap of SOAP_LIST) {
      const it = byId.get(soap.id);
      if (!it || it.pieces <= 0) continue;
      const [col, row] = slotOf(soap.id);
      const p = cellPos(col, row);
      const g = new THREE.Group();
      g.position.set(p.x, p.y, p.z);
      const n = it.pieces;
      const floorY = -CELL / 2 + SOAP_H / 2 + 0.02;
      addSoap(g, soap, floorY);
      const topY = floorY + SOAP_H * 0.55;
      addSparkle(g, -SOAP_W * 0.48, topY + 0.08, SOAP_D * 0.42, 0.1);
      addSparkle(g, SOAP_W * 0.5, topY + 0.03, SOAP_D * 0.38, 0.075);
      addSparkle(g, SOAP_W * 0.08, topY + 0.14, SOAP_D * 0.2, 0.06);
      addSparkle(g, -SOAP_W * 0.22, topY - 0.02, SOAP_D * 0.48, 0.055);
      addSparkle(g, SOAP_W * 0.36, topY + 0.1, -SOAP_D * 0.1, 0.05);
      soapsRoot.add(g);

      if (labelsRoot) {
        const el = document.createElement('span');
        el.className = 'shelf-pill';
        el.textContent = `${soap.name} ×${n}`;
        labelsRoot.appendChild(el);
        const anchor = new THREE.Vector3(p.x, shelfTop(ROWS - 1 - row) + 0.02, DEPTH / 2 + 0.04);
        labelAnchors.push({ el, anchor });
      }
    }
  }

  const floorMap = toyWoodTex(aniso);
  floorMap.repeat.set(7, 3);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 3.2),
    new THREE.MeshStandardMaterial({ map: floorMap, roughness: 0.7, metalness: 0, envMapIntensity: 0.12 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 1.0);
  scene.add(floor);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 50);
  const look = new THREE.Vector3();
  const lookY = cabH * 0.5;
  let camZ = 8, camY = lookY + 4;
  let camX = 0, vel = 0, dragging = false, lastPx = 0, lastT = 0, moved = false;
  let camMin = 0, camMax = 0, worldPerPx = 0.004;
  const _proj = new THREE.Vector3();

  function layoutCam() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    const saT = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sa-top')) || 0;
    const saB = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sa-bottom')) || 0;
    const topHUD = saT + 84, botHUD = saB + 48;
    const bandMid = (topHUD + (h - botHUD)) / 2 / h;
    const bandH = Math.max(0.45, (h - botHUD - topHUD) / h);
    const apparentH = cabH * Math.cos(CAM_TILT) + cabD * Math.sin(CAM_TILT);
    const wantH = apparentH / (bandH * 0.99);
    const halfH = wantH / 2;
    const halfW = halfH * (w / h);
    camera.left = -halfW; camera.right = halfW;
    camera.top = halfH; camera.bottom = -halfH;
    camera.setViewOffset(w, h, 0, (0.5 - bandMid) * h, w, h);
    camera.updateProjectionMatrix();
    camZ = 8;
    camY = lookY + camZ * Math.tan(CAM_TILT);
    const visW = 2 * halfW;
    worldPerPx = visW / w;
    const peek = FRAME * 0.25;
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
      const vis = _proj.z < 1 && x > -50 && x < w + 50 && y > -20 && y < h + 20;
      el.style.display = vis ? '' : 'none';
      if (vis) el.style.transform = `translate(${x}px, ${y}px) translate(-50%, 12%)`;
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
      const k = 0.78 + 0.32 * Math.sin(time * 4 + s.userData.phase);
      s.scale.setScalar(s.userData.base * k);
      s.material.opacity = 0.7 + 0.3 * Math.sin(time * 5.1 + s.userData.phase * 1.4);
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
    document.fonts.load('600 15px Fredoka').then(() => { if (running) { fillSoaps(); placeLabels(); } }).catch(() => {});
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
