// Startbildschirm in 3D: dieselbe Schneide-Szene wie im Spiel – gekippte Voxel-Seife (SoapBlock,
// gleiche Materialien/Looks), dasselbe schräge Messer (CutRig + cutGeom), dieselbe Würfel-Physik
// (LooseCubes) über derselben Metallschale, gleiches Licht und gleiche Umgebung.
// Der Schieberegler steuert die Schnitttiefe (0..1). Eigener Renderer (DPR max. 1.5),
// läuft nur, solange der Startbildschirm offen ist.
import * as THREE from 'three';
import { BLOCK, CUBE, PHYS } from './config.js';
import { SOAPS } from './soaps.js';
import { SoapBlock } from './soapBlock.js';
import { LooseCubes } from './looseCubes.js';
import { CutRig } from './cutRig.js';
import { createKnife } from './knife.js';
import { createBowl } from './scene.js';
import { makeEnvTexture } from './setting/textures.js';
import { createBlockMaterial, createLooseMaterial } from './soapMaterial.js';
import { CLOSE_DIR, SKEW_RISE, poseKnife, syncSlope } from './cutGeom.js';
import { sndCut, sndTick } from './audio.js';

const FIT_W = 2.0, FIT_H = 2.2;     // so viel Szene (um die gekippte Seife) passt in das Band zwischen Logo und Regler
const LOOKS = [SOAPS.erdbeere, SOAPS.minze, SOAPS.lavendel, SOAPS.zitrone, SOAPS.rose];

export function createStartScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance', stencil: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0);

  // Licht + Umgebung exakt wie im Spiel (scene.js)
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envSrc = makeEnvTexture();
  const env = pmrem.fromEquirectangular(envSrc).texture;
  envSrc.dispose(); pmrem.dispose();
  scene.environment = env;
  scene.environmentIntensity = 0.4;
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  scene.add(new THREE.HemisphereLight(0xfff4e6, 0xa8744c, 1.25));
  const sun = new THREE.DirectionalLight(0xfff0dc, 1.4);
  sun.position.set(1.5, 4, 2.5);
  scene.add(sun);
  scene.add(createBowl(env, aniso));

  // Seife + Messer am Kipp-Gestell (voll gekippt, wie beim Schneiden im Spiel)
  const block = new SoapBlock(scene, new THREE.BoxGeometry(1, 1, 1, 2, 2, 2), createBlockMaterial());
  const rig = new CutRig(scene);
  rig.add(block.mesh);
  const knife = createKnife();
  rig.add(knife);
  rig.target = 1; rig.t = 1; rig.e = 1; rig.apply();
  const loose = new LooseCubes(scene, new THREE.BoxGeometry(1, 1, 1), createLooseMaterial());
  loose.onLand = sndTick;
  const _a = new THREE.Vector3(), _b = new THREE.Vector3();
  const onCube = (x, y, z, r, g, b, id) => { rig.toWorld(_a.set(x, y, z), _b); loose.spawn(_b.x, _b.y, _b.z, r, g, b, id, rig.outer.rotation.x); };

  let look = 0;
  let knifeZ = 0, top = 0, height = 1, rest = 0, cutRaw = 0, knifeY = 0, knifeVy = 0, targetY = 0, done = false;
  function reset() {
    loose.clear();
    block.load(LOOKS[look++ % LOOKS.length]);
    top = block.topY; height = top - block.bottomY;
    rest = top + 0.06 + SKEW_RISE;                // Ruhelage wie im Spiel: knapp über der Seife
    cutRaw = 0; knifeY = targetY = rest; knifeVy = 0; done = false;
    knifeZ = block.cutZ;
    poseKnife(knife, knifeY, knifeZ);
  }
  reset();

  /** Schieberegler 0..1 -> Höhe der Schneide (0 = Ruhelage, 1 = ganz durch). */
  function setCut(p) {
    p = Math.max(0, Math.min(1, p));
    targetY = rest + (top - height - rest) * p;
  }

  // Kamera: Blickrichtung der Nahaufnahme im Spiel, Ausschnitt ins Band zwischen Wortmarke und Menü
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60);
  const look3 = new THREE.Vector3();
  rig.fullTiltCenter(look3, -0.05);
  look3.x += 0.12;   // Messergriff (rechts) bleibt im Bild
  let W = 0, H = 0, cy = 0.5, band = 1;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h || (w === W && h === H)) return;
    W = w; H = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const vf = THREE.MathUtils.degToRad(camera.fov), hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
    const dist = Math.max(FIT_W / 2 / Math.tan(hf / 2), FIT_H / 2 / Math.tan(vf / 2) / Math.max(0.15, band * 0.94));   // etwas Luft zu Wortmarke und Regler
    camera.position.copy(look3).addScaledVector(CLOSE_DIR, dist);
    camera.lookAt(look3);
    // Bildmitte auf die Mitte des Bands schieben
    camera.setViewOffset(w, h, 0, (0.5 - cy) * h, w, h);
    camera.updateProjectionMatrix();
  }

  const blade = { on: true, y: 0, z: 0, vy: 0 };
  let acc = 0;
  function step(dt) {
    // Messer folgt dem Regler direkt (leicht geglättet), schneidet nur nach unten weiter
    const prev = knifeY;
    knifeY += (targetY - knifeY) * Math.min(1, dt * 30);
    knifeVy = dt > 0 ? (knifeY - prev) / dt : 0;
    if (!done) {
      const raw = (top - knifeY) / height;
      if (raw > cutRaw) {
        cutRaw = Math.min(1, raw);
        const n = block.cutTo(cutRaw, onCube, SKEW_RISE / height);
        if (n > 0) sndCut();
      }
    }
    poseKnife(knife, knifeY, knifeZ);
    rig.outer.updateMatrixWorld(true);
    blade.y = knifeY; blade.z = knife.position.z; blade.vy = knifeVy; blade.on = !done;
    syncSlope(loose, rig, block, blade);
    loose.blockTop = -1;   // wie im Spiel beim Schneiden: Würfel fallen vorne weg
    acc = Math.min(acc + dt, PHYS.step * PHYS.maxSteps);
    while (acc >= PHYS.step) { loose.step(PHYS.step); acc -= PHYS.step; }
    loose.flush();
  }

  let raf = 0, last = 0, running = false, first = true;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    resize();
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016); last = now;
    step(dt);
    renderer.render(scene, camera);
    if (first) { first = false; canvas.classList.add('ready'); }
  }

  return {
    start() { if (running) return; running = true; W = H = 0; last = 0; raf = requestAnimationFrame(frame); },
    stop() { running = false; cancelAnimationFrame(raf); },
    /** Mitte (0..1 der Höhe) und verfügbare Höhe (Anteil) für die Seife setzen. */
    layout(centerY, bandH) { cy = centerY; band = bandH; W = H = 0; },
    setCut,
    /** Ganz durchgeschoben: Rest der Scheibe löst sich, Würfel fallen in die Schale. */
    finish() { if (done) return; block.cutTo(1, onCube, SKEW_RISE / height); block.finishSlice(onCube); sndCut(); done = true; targetY = top - height; },
    /** Neue Seife für den nächsten Besuch des Startbildschirms. */
    reset,
  };
}
