// Rendering-Grundgerüst: Renderer, Kamera, Licht, Holztisch, Metallschale, Fake-Schatten,
// Wand mit Holz-Ablagen direkt hinter dem Tisch (siehe setting/wall.js). Bewusst billig gehalten:
// keine Shadow-Maps, Texturen einmalig per Canvas erzeugt, Wiederholtes als InstancedMesh, max. DPR 2.
import * as THREE from 'three';
import { BOWL } from './config.js';
import { createKitchenWall, WALL_Z, TABLE_Y } from './setting/wall.js';
import { makeWoodTexture, makeBrushedTexture, makeEnvTexture } from './setting/textures.js';

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, powerPreference: 'high-performance', stencil: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  // Warme Küchen-Umgebung für Spiegelungen (Seifenglanz, Metallschale), einmalig vorgefiltert
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envSrc = makeEnvTexture();
  const env = pmrem.fromEquirectangular(envSrc).texture;
  envSrc.dispose();
  pmrem.dispose();
  scene.environment = env;
  scene.environmentIntensity = 0.4;
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60);
  const target = new THREE.Vector3(0, 0.9, 0);
  // Blickrichtung (von vorne oben); Abstand wird beim Resize ans Seitenverhältnis angepasst
  const viewDir = new THREE.Vector3(0.18, 0.68, 1).normalize(); // leicht schräg von vorne: Vorderseite + Schnittfläche gut sichtbar

  // Licht: Himmel/Boden + eine Richtung. Keine Schatten-Maps.
  scene.add(new THREE.HemisphereLight(0xfff4e6, 0xa8744c, 1.25));
  const sun = new THREE.DirectionalLight(0xfff0dc, 1.4);
  sun.position.set(1.5, 4, 2.5);
  scene.add(sun);
  // warmes Ofenlicht (nur während des Schmelzens aktiv)
  const ovenLight = new THREE.PointLight(0xff8a3d, 0, 6);
  ovenLight.position.set(0, 1.8, 1.2);
  scene.add(ovenLight);

  // Holztisch: Bretter laufen von vorne nach hinten (Maserung per Canvas-Textur)
  const TABLE_FRONT = 7, TABLE_W = 20;
  const tableDepth = TABLE_FRONT - WALL_Z;
  const tableTex = makeWoodTexture({ w: 512, h: 1024, planks: 4, seed: 7, aniso });
  tableTex.repeat.set(TABLE_W / 1.8, tableDepth / 3.6);
  const tableMat = new THREE.MeshLambertMaterial({ map: tableTex });
  const table = new THREE.Mesh(new THREE.PlaneGeometry(TABLE_W, tableDepth), tableMat);
  table.rotation.x = -Math.PI / 2;
  table.position.set(0, TABLE_Y, (TABLE_FRONT + WALL_Z) / 2);
  scene.add(table);

  // Wand mit Ablagen direkt an der hinteren Tischkante (echte Geometrie, gleiches Licht)
  createKitchenWall(scene, { env, aniso });
  const bg = new THREE.Color('#d8c3a6');
  scene.background = bg;

  // Fake-Schatten: weicher Kreis aus einer Canvas-Textur (einmalig erzeugt)
  const sc = document.createElement('canvas');
  sc.width = sc.height = 128;
  const g = sc.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 10, 64, 64, 64);
  grad.addColorStop(0, 'rgba(50,25,10,0.6)');
  grad.addColorStop(0.55, 'rgba(50,25,10,0.32)');
  grad.addColorStop(1, 'rgba(50,25,10,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.3, 3.3),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.065;
  scene.add(shadow);

  // Schale als Drehkörper (Lathe). Profil: außen unten -> Rand -> innen -> Boden
  const t = 0.06;
  const pts = [
    [0, -0.07], [BOWL.floorR + 0.02, -0.07], [BOWL.rimR + t + 0.02, BOWL.height],
    [BOWL.rimR + t, BOWL.height + 0.035], [BOWL.rimR, BOWL.height + 0.03],
    [BOWL.floorR, 0], [0, 0],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  // Metallschale: gebürsteter Stahl (Streifen rund um die Schale), spiegelt die warme Küche
  const brushed = makeBrushedTexture();
  brushed.repeat.set(3, 1);
  brushed.anisotropy = aniso;
  const steel = new THREE.MeshStandardMaterial({
    color: 0xe4e7eb, metalness: 1, roughness: 0.34, roughnessMap: brushed,
    envMap: env, envMapIntensity: 1.15, side: THREE.DoubleSide,
  });
  const bowl = new THREE.Mesh(new THREE.LatheGeometry(pts, 64), steel);
  scene.add(bowl);

  // Kamera so weit weg, dass Breite UND Höhe der Szene ins Bild passen (Hoch- und Querformat)
  const FIT_W = 2.95;
  const camBase = { pos: new THREE.Vector3(), look: new THREE.Vector3(), version: 0 };
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Querformat: mehr Höhe zeigen, damit alle drei Regalbretter (Päckchen oben) ins Bild passen
    const land = camera.aspect > 1.15;
    const FIT_H = land ? 4.5 : 3.1, lift = land ? 0.8 : 0.32;  // etwas angehoben: unterer Teil des Wandschranks sichtbar
    const vf = THREE.MathUtils.degToRad(camera.fov);
    const hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
    const dist = Math.max(FIT_W / 2 / Math.tan(hf / 2), FIT_H / 2 / Math.tan(vf / 2));
    // Grundstellung merken (das Spiel blendet daraus weich in die Nahaufnahme beim Schneiden über)
    camBase.pos.copy(target).addScaledVector(viewDir, dist);
    camBase.pos.y += 0.05 + lift;
    camBase.look.set(target.x, target.y - 0.12 + lift, target.z);
    camera.position.copy(camBase.pos);
    camera.lookAt(camBase.look);
    camera.updateProjectionMatrix();
    camBase.version++;
  }
  resize();
  window.addEventListener('resize', resize);

  return { renderer, scene, camera, camBase, bowl, bowlShadow: shadow, ovenLight, bg, env };
}
