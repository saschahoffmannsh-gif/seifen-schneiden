// SS-19: Vollbild-Seifenregal als echte 3D-Szene. Ein fest stehender Apothekerschrank
// (Gitter aus offenen Quadrat-Fächern, eine Sorte je Fach). Wischen schiebt die Kamera
// seitlich mit Schwung; der Schrank bleibt stehen, an den Enden ist Schluss (kein Loop).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { SOAP_LIST } from './soaps.js';
import { lookCanvas } from './soapLooks.js';
import { makeWoodTexture, makePlasterTexture, makeEnvTexture } from './setting/textures.js';

const COLS = 8, ROWS = 4;
const CELL = 0.44, DIV = 0.07, PITCH = CELL + DIV, DEPTH = 0.4;
const FRAME = 0.1, BASE_H = 0.34, CROWN_H = 0.22, BACK_T = 0.07;
const SOAP_W = 0.34, SOAP_H = 0.078, SOAP_D = 0.27, SOAP_R = 0.046;
const DAMP = 7;

// Spalten/Reihen je Sorte (Lücken dazwischen, rechte Fächer oft leer – wie ein Apothekerschrank).
const SLOTS = [
  [0, 0], [2, 0], [4, 0],
  [1, 1], [3, 1], [5, 1],
  [0, 2], [2, 2], [4, 2],
  [1, 3], [3, 3], [5, 3],
];

const WOOD = ['#c49658', '#d2a66a', '#b88948', '#c9a060', '#a87438'];
const FACE = new Map();

function faceTex(soap) {
  if (!FACE.has(soap.id)) {
    const c = lookCanvas(soap, 256, 200);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    t.needsUpdate = true;
    FACE.set(soap.id, t);
  }
  return FACE.get(soap.id);
}

function brassLabel(name, n) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  const lg = g.createLinearGradient(0, 0, 0, 64);
  lg.addColorStop(0, '#f0d9a0'); lg.addColorStop(0.45, '#d4b06a'); lg.addColorStop(1, '#a87c3c');
  g.fillStyle = lg; g.fillRect(0, 0, 256, 64);
  g.strokeStyle = 'rgba(80, 48, 16, .45)'; g.lineWidth = 6; g.strokeRect(3, 3, 250, 58);
  g.fillStyle = 'rgba(255, 240, 200, .35)'; g.fillRect(8, 6, 240, 10);
  g.font = '600 32px Fredoka, "DM Sans", sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#3a2412';
  const text = n > 0 ? `${name} ×${n}` : name;
  let size = 32;
  while (size > 16 && g.measureText(text).width > 230) {
    size -= 1; g.font = `600 ${size}px Fredoka, "DM Sans", sans-serif`;
  }
  g.fillText(text, 128, 36);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

function windowTex() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 384;
  const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, 260);
  sky.addColorStop(0, '#c8e8ff'); sky.addColorStop(0.55, '#8ec8f0'); sky.addColorStop(1, '#c5e4a8');
  g.fillStyle = sky; g.fillRect(0, 0, 256, 384);
  g.fillStyle = '#7eb85a';
  g.beginPath(); g.ellipse(40, 310, 70, 50, 0, 0, 7); g.ellipse(160, 320, 90, 55, 0, 0, 7); g.fill();
  g.fillStyle = '#6aa34c';
  g.beginPath(); g.ellipse(230, 300, 60, 48, 0, 0, 7); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

function slotOf(id) { return SLOTS[id % SLOTS.length]; }

export function mountApothecary(canvas, getItems) {
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, powerPreference: 'high-performance', stencil: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0xc8b08a, 1);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envSrc = makeEnvTexture();
  const env = pmrem.fromEquirectangular(envSrc).texture;
  envSrc.dispose(); pmrem.dispose();
  scene.environment = env;
  scene.environmentIntensity = 0.45;

  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const woodMap = makeWoodTexture({ w: 512, h: 1024, planks: 5, seed: 9, aniso, tones: WOOD, repeat: [1, 1] });
  const wood = new THREE.MeshStandardMaterial({
    map: woodMap, roughness: 0.72, metalness: 0, envMapIntensity: 0.28,
  });
  const woodDark = wood.clone();
  woodDark.color = new THREE.Color('#b07a42');
  const plaster = new THREE.MeshStandardMaterial({
    map: makePlasterTexture({ repeat: [2, 1] }), roughness: 0.92, metalness: 0, envMapIntensity: 0.15,
  });
  const floorMap = makeWoodTexture({
    w: 512, h: 1024, planks: 6, seed: 3, aniso,
    tones: ['#c9a06a', '#d4ad78', '#b89058', '#c8a468', '#a87c48'],
    repeat: [8, 12],
  });
  const floorMat = new THREE.MeshStandardMaterial({ map: floorMap, roughness: 0.8, metalness: 0, envMapIntensity: 0.2 });

  scene.add(new THREE.HemisphereLight(0xfff4e6, 0x8a5a38, 1.15));
  const sun = new THREE.DirectionalLight(0xfff3d8, 1.25);
  sun.position.set(-4, 5, 3);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffe8c8, 0.35);
  fill.position.set(3, 2.5, 4);
  scene.add(fill);

  const cabW = COLS * PITCH + DIV + FRAME * 2;
  const gridH = ROWS * PITCH + DIV;
  const cabH = gridH + BASE_H + CROWN_H;
  const cabD = DEPTH + BACK_T;
  const cabinet = new THREE.Group();
  cabinet.position.set(0, 0, 0);
  scene.add(cabinet);

  const box = (mat, w, h, d, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    cabinet.add(m);
    return m;
  };

  // Korpus: Rückwand, Seiten, Sockel, Krone, Innenböden und Trennwände
  box(woodDark, cabW - FRAME * 1.2, gridH, BACK_T, 0, BASE_H + gridH / 2, -DEPTH / 2 - BACK_T / 2);
  box(wood, FRAME, cabH - CROWN_H * 0.3, cabD, -cabW / 2 + FRAME / 2, cabH / 2 - CROWN_H * 0.15, 0);
  box(wood, FRAME, cabH - CROWN_H * 0.3, cabD, cabW / 2 - FRAME / 2, cabH / 2 - CROWN_H * 0.15, 0);
  box(wood, cabW + 0.04, BASE_H, cabD + 0.04, 0, BASE_H / 2, 0.01);
  box(wood, cabW + 0.08, 0.07, cabD + 0.08, 0, cabH - 0.04, 0.02);
  box(wood, cabW + 0.02, CROWN_H - 0.05, cabD + 0.02, 0, cabH - CROWN_H / 2 - 0.02, 0);

  for (let r = 0; r <= ROWS; r++) {
    const y = BASE_H + r * PITCH;
    box(wood, cabW - FRAME * 2, DIV, cabD - BACK_T * 0.2, 0, y, 0.01);
  }
  for (let c = 1; c < COLS; c++) {
    const x = -cabW / 2 + FRAME + DIV / 2 + c * PITCH;
    box(wood, DIV, gridH, cabD - BACK_T * 0.2, x, BASE_H + gridH / 2, 0.01);
  }

  function shelfTop(rowFromBottom) { return BASE_H + rowFromBottom * PITCH + DIV / 2; }
  function cellPos(col, row) {
    const x = -cabW / 2 + FRAME + DIV + CELL / 2 + col * PITCH;
    const y = shelfTop(ROWS - 1 - row) + CELL / 2;
    return { x, y, z: 0.02 };
  }

  const soapsRoot = new THREE.Group();
  cabinet.add(soapsRoot);
  const bodyGeo = new RoundedBoxGeometry(SOAP_W, SOAP_H, SOAP_D, 3, SOAP_R);
  const faceGeo = new THREE.PlaneGeometry(SOAP_W - SOAP_R * 2.1, SOAP_D - SOAP_R * 2.1);
  const plateGeo = new THREE.BoxGeometry(0.40, 0.085, 0.016);
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xe0c078, metalness: 0.65, roughness: 0.35, envMapIntensity: 0.8,
  });

  function addPiece(group, soap, yOff, wobX) {
    const body = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({
      color: new THREE.Color(soap.base[0], soap.base[1], soap.base[2]),
      roughness: 0.42, metalness: 0.04, envMapIntensity: 0.7,
    }));
    body.position.set(wobX, yOff, 0);
    const face = new THREE.Mesh(faceGeo, new THREE.MeshStandardMaterial({
      map: faceTex(soap), roughness: 0.4, metalness: 0, envMapIntensity: 0.55,
    }));
    face.rotation.x = -Math.PI / 2;
    face.position.set(wobX, yOff + SOAP_H / 2 + 0.0018, 0);
    group.add(body); group.add(face);
  }

  function pack() {
    const raw = (getItems && getItems()) || null;
    if (raw && raw.items) return raw;
    if (Array.isArray(raw) && raw.length) return { items: raw, caption: '' };
    return { items: SOAP_LIST.map((soap) => ({ soap, pieces: 2 })), caption: 'Die Sorten der Manufaktur' };
  }

  function fillSoaps() {
    while (soapsRoot.children.length) {
      const ch = soapsRoot.children[0];
      soapsRoot.remove(ch);
      // Geometrien sind geteilt, nur Label-Texturen entsorgen
      const mat = ch.material;
      if (mat && mat.map && mat.map.__label) mat.map.dispose();
    }
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
      const n = it.pieces, shown = Math.min(3, n);
      const floorY = -CELL / 2 + SOAP_H / 2 + 0.006;
      for (let k = 0; k < shown; k++) {
        addPiece(g, soap, floorY + k * SOAP_H * 0.88, k === 1 ? -0.008 : k === 2 ? 0.01 : 0);
      }
      const plateY = -CELL / 2 - DIV / 2 + 0.01;
      const plate = new THREE.Mesh(plateGeo, new THREE.MeshStandardMaterial({
        map: brassLabel(soap.name, n), metalness: 0.45, roughness: 0.4, envMapIntensity: 0.6,
        color: 0xffffff,
      }));
      plate.material.map.__label = true;
      plate.position.set(0, plateY, cabD / 2 - 0.02);
      plate.rotation.x = -0.55; // stärker zur Kamera gekippt, gut lesbar
      g.add(plate);
      soapsRoot.add(g);
    }
  }

  // Raum: Boden, Wände, Fenster, Pflanze, ein paar Deckenbalken
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 12), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 1);
  scene.add(floor);

  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(16, 7), plaster);
  backWall.position.set(0, 3.2, -cabD / 2 - 0.4);
  scene.add(backWall);
  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(8, 7), plaster);
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(-cabW / 2 - 1.35, 3.2, 1.2);
  scene.add(leftWall);

  // Fenster in der Rückwand links neben dem Schrank (wie im Referenzbild)
  const win = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 1.9),
    new THREE.MeshBasicMaterial({ map: windowTex() }),
  );
  win.position.set(-cabW / 2 - 0.85, 1.55, -cabD / 2 - 0.38);
  scene.add(win);
  const winLight = new THREE.PointLight(0xfff6dd, 0.7, 8);
  winLight.position.set(-cabW / 2 - 0.5, 1.7, 0.3);
  scene.add(winLight);
  const wf = new THREE.MeshStandardMaterial({ color: 0xb88950, roughness: 0.7, metalness: 0 });
  const winFrame = new THREE.Group();
  winFrame.position.copy(win.position);
  const addF = (w, h, x, y, z = 0.04) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), wf);
    m.position.set(x, y, z); winFrame.add(m);
  };
  addF(1.34, 0.08, 0, 0.99); addF(1.34, 0.08, 0, -0.99);
  addF(0.08, 2.06, -0.63, 0); addF(0.08, 2.06, 0.63, 0);
  addF(0.05, 1.98, 0, 0, 0.03);
  scene.add(winFrame);

  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 0.22, 20),
    new THREE.MeshStandardMaterial({ color: 0xb45a3a, roughness: 0.7, metalness: 0 }));
  pot.position.set(-cabW / 2 - 0.42, 0.11, 0.35);
  scene.add(pot);
  const dirt = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 16),
    new THREE.MeshStandardMaterial({ color: 0x4a3020, roughness: 1 }));
  dirt.position.set(pot.position.x, 0.22, pot.position.z);
  scene.add(dirt);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x4f9a4a, roughness: 0.6, metalness: 0 });
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), leafMat);
    const a = (i / 7) * Math.PI * 2;
    leaf.scale.set(1.1, 0.45, 0.7);
    leaf.position.set(pot.position.x + Math.cos(a) * 0.1, 0.38 + (i % 3) * 0.1, pot.position.z + Math.sin(a) * 0.1);
    leaf.rotation.set(0.4, a, 0.3);
    scene.add(leaf);
  }

  for (let i = 0; i < 3; i++) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(14, 0.12, 0.18), wood);
    beam.position.set(0, 3.9, -1.8 + i * 1.15);
    scene.add(beam);
  }

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 40);
  const look = new THREE.Vector3();
  const gridY = BASE_H + gridH / 2;
  let camZ = 5.2, camY = gridY + 1.15;
  let camX = 0, vel = 0, dragging = false, lastPx = 0, lastT = 0, moved = false;
  let camMin = 0, camMax = 0, worldPerPx = 0.004;

  function layoutCam() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const saT = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sa-top')) || 0;
    const saB = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sa-bottom')) || 0;
    const topHUD = saT + 100, botHUD = saB + 56;
    const bandMid = (topHUD + (h - botHUD)) / 2 / h;
    const bandH = Math.max(0.4, (h - botHUD - topHUD) / h);
    // Etwa 4,6 Fächer breit sichtbar, Schrank steht in der Bandbreite zwischen Titel und Hinweis.
    const wantW = 4.05 * PITCH + FRAME;
    const wantH = cabH / (bandH * 0.92);
    const vf = THREE.MathUtils.degToRad(camera.fov);
    const hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
    camZ = Math.max(wantW / 2 / Math.tan(hf / 2), wantH / 2 / Math.tan(vf / 2));
    camY = gridY + Math.min(1.35, camZ * 0.28);
    camera.setViewOffset(w, h, 0, (0.5 - bandMid) * h, w, h);
    camera.updateProjectionMatrix();
    const visH = 2 * Math.tan(vf / 2) * camZ;
    const visW = visH * camera.aspect;
    worldPerPx = visW / w;
    const peek = Math.min(visW * 0.14, 0.38);
    camMin = -cabW / 2 + visW / 2 - peek;
    camMax = cabW / 2 - visW / 2 + peek * 0.3;
    if (camMax < camMin) { const mid = (camMin + camMax) / 2; camMin = camMax = mid; }
    camX = THREE.MathUtils.clamp(camX, camMin, camMax);
  }

  function applyCam() {
    camera.position.set(camX, camY, camZ);
    look.set(camX, gridY + 0.08, 0);
    camera.lookAt(look);
  }

  function resetCam() {
    vel = 0;
    camX = camMin;
    applyCam();
  }

  function resize() { layoutCam(); applyCam(); }

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
    // Greifen: Finger nach links → Kamera nach rechts (rechter Schrankteil kommt ins Bild)
    camX -= dx * worldPerPx;
    vel = -(dx * worldPerPx) / dt;
    camX = THREE.MathUtils.clamp(camX, camMin, camMax);
    if (camX === camMin || camX === camMax) vel = 0;
    lastPx = e.clientX; lastT = now;
    applyCam();
  });
  const endDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    try { canvas.releasePointerCapture?.(e.pointerId); } catch { /* schon frei */ }
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('click', (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);

  let raf = 0, last = 0, running = false;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;
    if (!dragging && vel) {
      camX += vel * dt;
      vel *= Math.exp(-DAMP * dt);
      if (camX < camMin) { camX = camMin; vel = 0; }
      if (camX > camMax) { camX = camMax; vel = 0; }
      if (Math.abs(vel) < 0.002) vel = 0;
      applyCam();
    }
    renderer.render(scene, camera);
    canvas.dataset.camX = camX.toFixed(3);
    canvas.dataset.camMin = camMin.toFixed(3);
    canvas.dataset.camMax = camMax.toFixed(3);
    canvas.dataset.cabX = cabinet.position.x.toFixed(3);
  }

  if (document.fonts && document.fonts.load) {
    document.fonts.load('600 28px Fredoka').then(() => { if (running) fillSoaps(); }).catch(() => {});
  }
  if (window.ResizeObserver) new ResizeObserver(() => { if (running) resize(); }).observe(canvas.parentElement || canvas);

  const api = {
    start() {
      if (running) return;
      running = true; last = 0;
      resize(); fillSoaps();
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
    refresh() { fillSoaps(); },
    resetCam() { resize(); resetCam(); },
    jump(x) { vel = 0; camX = THREE.MathUtils.clamp(x, camMin, camMax); applyCam(); },
    get camX() { return camX; },
    get camMin() { return camMin; },
    get camMax() { return camMax; },
    get cabinetX() { return cabinet.position.x; },
    get running() { return running; },
    el: canvas,
  };
  return api;
}
