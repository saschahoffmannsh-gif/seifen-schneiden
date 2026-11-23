// Startbildschirm in 3D: drei weich abgerundete Seifenstücke (Riegel mit geprägtem Schriftzug,
// Kiesel, runde Seife) schweben langsam vor warmem Licht, dazu ein paar schillernde Seifenblasen.
// Eigener, kleiner Renderer (DPR max. 1.5) – läuft nur, solange der Startbildschirm offen ist.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/** Planare Draufsicht-UVs (x/z), damit die Prägung nur oben mittig sitzt und die Seiten frei bleiben. */
function topUV(geo, w, d) {
  const p = geo.attributes.position, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = p.getX(i) / w + 0.5; uv[i * 2 + 1] = 0.5 - p.getZ(i) / d; }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

/** Prägung als Bump-Map: mittleres Grau, eingeprägte Linien dunkler, weich (leicht unscharf). */
function emboss(draw, w = 512, h = 512) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
  g.filter = 'blur(1.6px)';
  g.strokeStyle = '#1c1c1c'; g.fillStyle = '#1c1c1c';
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  return t;
}

function leafPath(g, x, y, s) {
  g.beginPath();
  g.moveTo(x, y - s); g.bezierCurveTo(x + s * 0.7, y - s * 0.4, x + s * 0.7, y + s * 0.4, x, y + s);
  g.bezierCurveTo(x - s * 0.7, y + s * 0.4, x - s * 0.7, y - s * 0.4, x, y - s); g.fill();
}

function soapMat(color, sheen, bump, bumpScale = 3) {
  const c = new THREE.Color(color);
  return new THREE.MeshPhysicalMaterial({
    color: c, roughness: 0.58, metalness: 0,
    sheen: 0.55, sheenRoughness: 0.5, sheenColor: new THREE.Color(sheen),
    clearcoat: 0.22, clearcoatRoughness: 0.5,
    emissive: c.clone().multiplyScalar(0.07),   // weiches "Durchscheinen" (SSS-Anmutung)
    bumpMap: bump || null, bumpScale,
  });
}

/** Runde Seife: Lathe-Profil mit stark gerundeten Kanten. */
function puckGeometry(r = 0.52, h = 0.34, k = 0.15) {
  const pts = [new THREE.Vector2(0, -h / 2)];
  const seg = 10;
  for (let i = 0; i <= seg; i++) { const a = -Math.PI / 2 + (i / seg) * (Math.PI / 2); pts.push(new THREE.Vector2(r - k + Math.cos(a) * k, -h / 2 + k + Math.sin(a) * k)); }
  for (let i = 0; i <= seg; i++) { const a = (i / seg) * (Math.PI / 2); pts.push(new THREE.Vector2(r - k + Math.cos(a) * k, h / 2 - k + Math.sin(a) * k)); }
  pts.push(new THREE.Vector2(0, h / 2));
  const geo = new THREE.LatheGeometry(pts, 72);
  geo.computeVertexNormals();
  return topUV(geo, r * 2, r * 2);
}

/** Seifenblase: Fresnel-Rand mit wanderndem Regenbogen-Schimmer und kleinem Glanzpunkt. */
function bubbleMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vP = position; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uTime; varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){
        float f = 1.0 - max(dot(normalize(vN), normalize(vV)), 0.0);
        float fr = pow(f, 2.4);
        vec3 iri = 0.55 + 0.45 * cos(6.2831 * (f * 1.3 + vP.y * 0.6 + uTime * 0.05 + vec3(0.0, 0.33, 0.67)));
        vec3 L = normalize(vec3(-0.5, 0.8, 0.6));
        float spec = pow(max(dot(reflect(-L, normalize(vN)), normalize(vV)), 0.0), 40.0);
        vec3 col = mix(vec3(1.0), iri, 0.75) ;
        float a = fr * 0.62 + spec * 0.9 + 0.03;
        gl_FragColor = vec4(col + spec, a);
      }`,
  });
}

/** Weicher Kontaktschatten (radialer Verlauf) unter einer Seife. */
function shadowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(70,45,25,0.42)'); gr.addColorStop(0.55, 'rgba(70,45,25,0.16)'); gr.addColorStop(1, 'rgba(70,45,25,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export function createStartScene(canvas) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  } catch { return { start() {}, stop() {} }; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.32;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 60);
  camera.position.set(0, 2.1, 9.8);
  camera.lookAt(0, 0, 0);

  const key = new THREE.DirectionalLight(0xfff0dc, 2.9); key.position.set(-4.5, 4, 1.8); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffd6bf, 1.4); rim.position.set(4, 2, -3); scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xfff8ee, 0xb89878, 0.45));

  const world = new THREE.Group(); scene.add(world);
  const comp = new THREE.Group(); world.add(comp);

  // Prägungen (Schrift aus der geladenen Fraunces, sonst Serif-Fallback)
  const font = (sz, it = true) => `${it ? 'italic ' : ''}500 ${sz}px Fraunces, Georgia, serif`;
  const makeBarBump = () => emboss((g, w, h) => {
    g.lineWidth = 7;
    const rx = w * 0.3, ry = h * 0.25;
    g.beginPath(); g.ellipse(w / 2, h / 2, rx, ry, 0, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 3; g.beginPath(); g.ellipse(w / 2, h / 2, rx - 16, ry - 16, 0, 0, Math.PI * 2); g.stroke();
    g.font = font(50); g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('Soap Shop', w / 2, h / 2 - 6);
    g.font = '600 20px "DM Sans", sans-serif'; g.fillText('M A N U F A K T U R', w / 2, h / 2 + 50);
    leafPath(g, w / 2, h / 2 - 66, 12);
  });
  const makePebbleBump = () => emboss((g, w, h) => {
    // großes Blatt mit Mittelrippe und Adern
    g.save(); g.translate(w / 2, h / 2); g.rotate(-0.5);
    g.lineWidth = 6; g.beginPath(); g.moveTo(0, -150); g.bezierCurveTo(95, -70, 95, 70, 0, 150); g.bezierCurveTo(-95, 70, -95, -70, 0, -150); g.stroke();
    g.lineWidth = 4; g.beginPath(); g.moveTo(0, -130); g.lineTo(0, 175); g.stroke();
    g.lineWidth = 3;
    for (let k = -2; k <= 2; k++) { const y = k * 45; g.beginPath(); g.moveTo(0, y + 18); g.quadraticCurveTo(32, y, 58, y - 22); g.moveTo(0, y + 18); g.quadraticCurveTo(-32, y, -58, y - 22); g.stroke(); }
    g.restore();
  }, 512, 512);
  const makePuckBump = () => emboss((g, w, h) => {
    g.lineWidth = 6; g.beginPath(); g.arc(w / 2, h / 2, w * 0.33, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 2.5; g.beginPath(); g.arc(w / 2, h / 2, w * 0.33 - 14, 0, Math.PI * 2); g.stroke();
    g.font = font(64); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('Hafer', w / 2, h / 2 + 8);
    leafPath(g, w / 2, h / 2 - 54, 13);
    g.font = '600 17px "DM Sans", sans-serif'; g.fillText('&  H O N I G', w / 2, h / 2 + 58);
  });

  // 1) Riegel (rosé, geprägt)
  const BW = 1.62, BH = 0.56, BD = 1.02;
  const barGeo = topUV(new RoundedBoxGeometry(BW, BH, BD, 8, 0.26), BW, BD);
  const barMat = soapMat(0xdc9e92, 0xffe9e2, null);
  const bar = new THREE.Mesh(barGeo, barMat);
  // 2) Kiesel (salbei)
  const pebGeo = topUV(new THREE.SphereGeometry(1, 64, 40), 2, 2);
  const pebMat = soapMat(0xa7b98f, 0xeef8e4, null, 9);
  const peb = new THREE.Mesh(pebGeo, pebMat); peb.scale.set(0.64, 0.27, 0.46);
  // 3) Runde Seife (Hafer/Creme, geprägt)
  const puckMat = soapMat(0xe9d4b0, 0xfff6e6, null, 10);
  const puck = new THREE.Mesh(puckGeometry(), puckMat);

  const shTex = shadowTexture();
  const mkShadow = (w, d) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false })); m.rotation.x = -Math.PI / 2; return m; };

  const items = [
    { mesh: bar, base: new THREE.Vector3(0.02, 0.08, 0), rot: new THREE.Euler(0.62, -0.3, 0.06), amp: 0.07, ph: 0, sh: mkShadow(2.3, 1.5) },
    { mesh: peb, base: new THREE.Vector3(-0.86, -0.5, 0.55), rot: new THREE.Euler(0.62, 0.5, -0.1), amp: 0.06, ph: 1.9, sh: mkShadow(1.6, 1.1) },
    { mesh: puck, base: new THREE.Vector3(0.9, -0.46, 0.42), rot: new THREE.Euler(0.55, 0, 0.18), amp: 0.065, ph: 3.6, sh: mkShadow(1.5, 1.2) },
  ];
  const FLOOR = -1.02;
  for (const it of items) { it.mesh.position.copy(it.base); it.mesh.rotation.copy(it.rot); comp.add(it.mesh); it.sh.position.set(it.base.x, FLOOR, it.base.z); comp.add(it.sh); }

  // Prägungen erst nach dem Laden der Schrift erzeugen
  const fontsReady = document.fonts && document.fonts.load ? Promise.all([document.fonts.load(font(70)), document.fonts.load('600 20px "DM Sans"')]).catch(() => {}) : Promise.resolve();
  fontsReady.then(() => {
    barMat.bumpMap = makeBarBump(); barMat.bumpScale = 11; barMat.needsUpdate = true;
    puckMat.bumpMap = makePuckBump(); puckMat.needsUpdate = true;
    pebMat.bumpMap = makePebbleBump(); pebMat.needsUpdate = true;
  });

  // Seifenblasen
  const bubMat = bubbleMaterial();
  const bubGeo = new THREE.SphereGeometry(1, 32, 20);
  const bubbles = [];
  const BUB = [[-1.25, 0.9, -0.6, 0.2], [1.2, 1.25, -0.9, 0.14], [0.55, -1.2, 1.2, 0.1], [-0.4, 1.55, -1.4, 0.09], [1.45, 0.1, 0.4, 0.075], [-1.5, -0.2, 0.9, 0.11]];
  for (const [x, y, z, r] of BUB) { const m = new THREE.Mesh(bubGeo, bubMat); m.scale.setScalar(r); m.position.set(x, y, z); m.userData = { x, y, z, r, s: 0.06 + Math.random() * 0.05, p: Math.random() * 6 }; world.add(m); bubbles.push(m); }

  // Größe / Bildausschnitt: Komposition passt in die Breite und sitzt zwischen Wortmarke und Menü
  let W = 0, H = 0, cy = 0.5, band = 1;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h || (w === W && h === H)) return;
    W = w; H = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    const visH = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), visW = visH * camera.aspect;
    // Platz zwischen Wortmarke und Menü (vom Menü gemessen, Anteil der Höhe)
    const s = Math.min(1.1, visW / 3.3, visH / 4.6, (band * visH) / 2.35);
    world.scale.setScalar(s);
    world.position.y = (0.5 - cy) * visH;
  }

  // sanfte Parallaxe mit Finger/Maus
  let px = 0, py = 0, tx = 0, ty = 0;
  const onMove = (e) => { const p = e.touches ? e.touches[0] : e; tx = (p.clientX / window.innerWidth - 0.5); ty = (p.clientY / window.innerHeight - 0.5); };
  window.addEventListener('pointermove', onMove, { passive: true });

  let raf = 0, t0 = performance.now(), running = false, first = true;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    resize();
    const t = (now - t0) / 1000;
    px += (tx - px) * 0.04; py += (ty - py) * 0.04;
    comp.rotation.y = px * 0.25 + Math.sin(t * 0.21) * 0.05;
    comp.rotation.x = py * 0.12;
    for (const it of items) {
      const b = Math.sin(t * 0.9 + it.ph);
      it.mesh.position.y = it.base.y + b * it.amp;
      it.mesh.rotation.set(it.rot.x + Math.sin(t * 0.5 + it.ph) * 0.04, it.rot.y + Math.sin(t * 0.33 + it.ph) * 0.12, it.rot.z + Math.cos(t * 0.45 + it.ph) * 0.03);
      const k = 1 - (b * it.amp) * 1.6;
      it.sh.scale.set(k, k, 1); it.sh.material.opacity = 0.75 * k;
    }
    for (const m of bubbles) {
      const u = m.userData;
      let y = u.y + ((t * u.s + u.p) % 3.4);
      if (y > 2.2) y -= 3.4;
      m.position.set(u.x + Math.sin(t * 0.7 + u.p) * 0.08, y, u.z);
      const fade = Math.min(1, (2.2 - y) * 2, (y + 1.2) * 2);
      m.scale.setScalar(u.r * Math.max(0.01, fade));
    }
    bubMat.uniforms.uTime.value = t;
    renderer.render(scene, camera);
    if (first) { first = false; canvas.classList.add('ready'); }
  }

  return {
    start() { if (running) return; running = true; W = H = 0; raf = requestAnimationFrame(frame); },
    stop() { running = false; cancelAnimationFrame(raf); },
    /** Mitte (0..1 der Höhe) und verfügbare Höhe (Anteil) für die Seifen setzen. */
    layout(centerY, bandH) { cy = centerY; band = bandH; W = H = 0; },
  };
}
