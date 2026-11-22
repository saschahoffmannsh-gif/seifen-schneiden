// Hintergrund: Putzwand mit rustikalen Holzregalen voller Küchen-Kram.
//
// Performance-Trick: Der Hintergrund steht still und die Kamera bewegt sich nur bei einer
// Größenänderung. Deshalb wird er NICHT jedes Bild gezeichnet, sondern nur einmal (und nach
// jedem Resize) mit derselben Kamera in eine Textur gerendert, weichgezeichnet (unscharf wie
// bei Tiefenschärfe -> die Seife bleibt im Fokus) und dann pro Bild als ein einziges
// Vollbild-Rechteck hinter allem anderen gezeigt: 1 Draw-Call, egal wie viele Gläser im Regal stehen.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { makeWoodTexture, makePlasterTexture, makeClothTexture, makeShadeTexture, rng } from './textures.js';

export const WALL_Z = -3.2;            // Wand hinter dem Tisch
export const TABLE_Y = -0.07;          // Tischplatte (wie bisher der Boden)
const SHELF_Y = [0.62, 1.4, 2.18, 2.96];
const SHELF_D = 0.42;                  // Regaltiefe
const SHELF_T = 0.06;                  // Brettstärke
const X_MIN = -7.5, X_MAX = 7.5;

export function createBackdrop(renderer, tableMat) {
  const bgScene = new THREE.Scene();
  bgScene.background = new THREE.Color('#d9c2a3');

  // Licht passend zur Hauptszene (gleiche Richtung, warm)
  bgScene.add(new THREE.HemisphereLight(0xfff0dc, 0x8a5a3a, 1.25));
  const sun = new THREE.DirectionalLight(0xffe2bd, 1.5);
  sun.position.set(1.5, 4, 2.5);
  bgScene.add(sun);
  const warm = new THREE.PointLight(0xffb070, 2.2, 9, 1.2);   // warmes Licht oben links (Lampe)
  warm.position.set(-2.5, 3.4, -1.6);
  bgScene.add(warm);

  const mats = new Map();
  const mat = (color, opts = {}) => {
    const key = color + JSON.stringify(opts);
    if (!mats.has(key)) mats.set(key, new THREE.MeshLambertMaterial({ color, ...opts }));
    return mats.get(key);
  };
  const add = (geo, m, x, y, z, ry = 0) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z); mesh.rotation.y = ry;
    bgScene.add(mesh);
    return mesh;
  };

  // Wand
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(X_MAX - X_MIN + 4, 8),
    new THREE.MeshLambertMaterial({ map: makePlasterTexture({ repeat: [5, 2.6] }) }));
  wall.position.set(0, 3.9, WALL_Z);
  bgScene.add(wall);
  // hintere Tischkante im Hintergrund (damit die Unschärfe an der Kante passt)
  const tableBack = new THREE.Mesh(new THREE.PlaneGeometry(X_MAX - X_MIN + 4, 4), tableMat);
  tableBack.rotation.x = -Math.PI / 2;
  tableBack.position.set(0, TABLE_Y, WALL_Z + 2);
  bgScene.add(tableBack);
  // dunkle Kontaktkante Wand/Tisch
  const shadeTex = makeShadeTexture();
  const shadeMat = new THREE.MeshBasicMaterial({ map: shadeTex, transparent: true, depthWrite: false });
  const baseShade = new THREE.Mesh(new THREE.PlaneGeometry(X_MAX - X_MIN + 4, 0.35), shadeMat);
  baseShade.rotation.z = Math.PI; // dunkel unten
  baseShade.position.set(0, TABLE_Y + 0.17, WALL_Z + 0.005);
  bgScene.add(baseShade);

  // Regalbretter + Konsolen + Schatten darunter
  const shelfTex = makeWoodTexture({ w: 256, h: 1024, planks: 2, seed: 3, repeat: [1, 1] });
  shelfTex.rotation = Math.PI / 2;     // Maserung entlang des Bretts
  const shelfMat = new THREE.MeshLambertMaterial({ map: shelfTex });
  const darkWood = mat('#6b4126');
  const bracketGeo = new THREE.BoxGeometry(0.06, 0.26, SHELF_D * 0.85);
  for (const y of SHELF_Y) {
    const board = new THREE.Mesh(new THREE.BoxGeometry(X_MAX - X_MIN, SHELF_T, SHELF_D), shelfMat);
    board.position.set(0, y - SHELF_T / 2, WALL_Z + SHELF_D / 2);
    shelfTex.repeat.set(1, 1);
    bgScene.add(board);
    for (let x = X_MIN + 1; x <= X_MAX - 0.5; x += 2.6) add(bracketGeo, darkWood, x, y - SHELF_T - 0.13, WALL_Z + SHELF_D * 0.43);
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(X_MAX - X_MIN, 0.38), shadeMat);
    sh.position.set(0, y - SHELF_T - 0.19, WALL_Z + 0.004);
    bgScene.add(sh);
  }

  // ---------- Küchen-Kram ----------
  const r = rng(42);
  const pick = (arr) => arr[(r() * arr.length) | 0];
  const zOn = () => WALL_Z + 0.12 + r() * (SHELF_D - 0.24);

  const glass = (tint) => new THREE.MeshStandardMaterial({ color: tint, roughness: 0.12, metalness: 0, transparent: true, opacity: 0.55 });
  const glassMats = ['#d7e8dd', '#e6efe9', '#cfe0d6'].map(glass);
  const terracotta = mat('#b4673f');
  const twine = mat('#c9a66b');
  const cork = mat('#b08355');
  const lidMetal = new THREE.MeshStandardMaterial({ color: '#b8b2a6', metalness: 0.7, roughness: 0.4 });
  const greens = ['#5f8f4e', '#4e7d41', '#7aa35c', '#6b9450'].map((c) => mat(c));
  const clothMats = [makeClothTexture('#b8453a'), makeClothTexture('#4f6f9a'), makeClothTexture('#6f8f55')]
    .map((t) => new THREE.MeshLambertMaterial({ map: t }));
  const soapColors = ['#f2789a', '#f6e0a0', '#b79be0', '#8fe3c5', '#f4c6a5', '#fffaf0'];
  const contents = ['#e9d9b0', '#c58a4a', '#7a4a2a', '#f2ecdc', '#d7a13a', '#8a3b2e', '#a5b86a'];

  const jarGeo = new THREE.CylinderGeometry(1, 1, 1, 18);
  const lidGeo = new THREE.CylinderGeometry(1, 1, 1, 18);
  function jar(x, y, z) {
    const rad = 0.09 + r() * 0.06, h = 0.2 + r() * 0.2;
    const fill = 0.55 + r() * 0.35;
    const c = add(jarGeo, mat(pick(contents)), x, y + h * fill / 2, z); c.scale.set(rad * 0.92, h * fill, rad * 0.92);
    const g = add(jarGeo, pick(glassMats), x, y + h / 2, z); g.scale.set(rad, h, rad);
    const lid = add(lidGeo, r() < 0.5 ? lidMetal : cork, x, y + h + 0.02, z); lid.scale.set(rad * 1.04, 0.04, rad * 1.04);
    return rad * 2;
  }
  // Flasche als Drehkörper (einmal erzeugt, pro Flasche skaliert)
  const bottleGeo = new THREE.LatheGeometry([
    [0, 0], [0.5, 0], [0.52, 0.05], [0.52, 0.55], [0.42, 0.68], [0.18, 0.78], [0.16, 1.0], [0, 1.0],
  ].map(([a, b]) => new THREE.Vector2(a, b)), 16);
  const bottleMats = ['#6e3f12', '#4f6b2f', '#9ab8a6', '#c9732e', '#e5e1d3'].map((c) =>
    new THREE.MeshStandardMaterial({ color: c, roughness: 0.15, metalness: 0, transparent: true, opacity: 0.85 }));
  function bottle(x, y, z) {
    const s = 0.28 + r() * 0.22, w = 0.16 + r() * 0.06;
    const b = add(bottleGeo, pick(bottleMats), x, y, z); b.scale.set(w, s, w);
    const k = add(jarGeo, cork, x, y + s + 0.02, z); k.scale.set(w * 0.17, 0.05, w * 0.17);
    return w * 1.1;
  }
  const soapGeo = new RoundedBoxGeometry(1, 1, 1, 2, 0.25);
  function soaps(x, y, z) {
    const n = 2 + (r() * 3 | 0), w = 0.26, d = 0.17, h = 0.08;
    for (let i = 0; i < n; i++) {
      const s = add(soapGeo, mat(pick(soapColors)), x + (r() - 0.5) * 0.03, y + h / 2 + i * h, z, (r() - 0.5) * 0.25);
      s.scale.set(w, h, d);
    }
    const t = add(new THREE.BoxGeometry(0.015, n * h + 0.004, d + 0.006), twine, x, y + n * h / 2, z);
    return w + 0.05;
  }
  const potGeo = new THREE.CylinderGeometry(1, 0.78, 1, 16);
  const leafGeo = new THREE.IcosahedronGeometry(1, 1);
  function plant(x, y, z, big) {
    const pr = big ? 0.16 : 0.1 + r() * 0.04, ph = pr * 1.3;
    const p = add(potGeo, terracotta, x, y + ph / 2, z); p.scale.set(pr, ph, pr);
    const rim = add(potGeo, mat('#c3764b'), x, y + ph, z); rim.scale.set(pr * 1.08, 0.04, pr * 1.08);
    const n = big ? 9 : 5;
    for (let i = 0; i < n; i++) {
      const a = r() * 6.28, d = r() * pr * 0.7;
      const l = add(leafGeo, pick(greens), x + Math.cos(a) * d, y + ph + 0.06 + r() * pr * (big ? 1.6 : 1.0), z + Math.sin(a) * d * 0.6);
      const s = pr * (0.45 + r() * 0.4);
      l.scale.set(s, s * (1.2 + r()), s);
      l.rotation.set(r(), r(), r());
    }
    // hängende Ranken über die Regalkante
    if (big) for (let i = 0; i < 5; i++) {
      const l = add(leafGeo, pick(greens), x + (r() - 0.5) * pr * 2, y - 0.05 - i * 0.09, WALL_Z + SHELF_D - 0.04);
      l.scale.setScalar(0.05 + r() * 0.03);
    }
    return pr * 2.4;
  }
  const clothGeo = new THREE.BoxGeometry(1, 1, 1);
  function cloth(x, y, z) {
    const n = 2 + (r() * 3 | 0), w = 0.34, h = 0.045;
    for (let i = 0; i < n; i++) {
      const c = add(clothGeo, pick(clothMats), x + (r() - 0.5) * 0.04, y + h / 2 + i * h, z, (r() - 0.5) * 0.15);
      c.scale.set(w, h * 0.95, 0.26);
    }
    return w + 0.05;
  }
  // Brettchen / Schneidebretter hochkant an die Wand gelehnt
  const boardTex = makeWoodTexture({ w: 256, h: 512, planks: 1, seed: 9 });
  const boardMat = new THREE.MeshLambertMaterial({ map: boardTex });
  const roundBoardGeo = new THREE.CylinderGeometry(1, 1, 1, 24);
  function board(x, y) {
    const h = 0.45 + r() * 0.2;
    if (r() < 0.5) {
      const b = add(roundBoardGeo, boardMat, x, y + h / 2, WALL_Z + 0.05);
      b.rotation.x = Math.PI / 2 - 0.12; b.scale.set(h / 2, 0.035, h / 2);
    } else {
      const b = add(clothGeo, boardMat, x, y + h / 2, WALL_Z + 0.05);
      b.rotation.x = -0.12; b.scale.set(0.24 + r() * 0.08, h, 0.035);
    }
    return 0.3;
  }
  // Holzkiste
  const crateTex = makeWoodTexture({ w: 256, h: 256, planks: 3, seed: 13 });
  crateTex.rotation = Math.PI / 2;
  const crateMat = new THREE.MeshLambertMaterial({ map: crateTex });
  function crate(x, y, z) {
    const w = 0.5, h = 0.26;
    const c = add(clothGeo, crateMat, x, y + h / 2, z); c.scale.set(w, h, 0.34);
    // Seifen oder Äpfel obendrauf
    for (let i = 0; i < 4; i++) {
      const s = add(soapGeo, mat(pick(soapColors)), x - w / 2 + 0.09 + i * 0.11, y + h + 0.03, z, (r() - 0.5) * 0.4);
      s.scale.set(0.1, 0.06, 0.16);
    }
    return w + 0.06;
  }

  const makers = [jar, jar, jar, bottle, bottle, soaps, soaps, plant, cloth, board, crate];
  for (let s = 0; s < SHELF_Y.length; s++) {
    const y = SHELF_Y[s];
    let x = X_MIN + 0.3 + r() * 0.3;
    while (x < X_MAX - 0.5) {
      const f = (s === 0 && r() < 0.1) ? plant : pick(makers);
      const w = f === plant ? plant(x, y, zOn(), r() < 0.5) : f(x, y, zOn());
      x += w + 0.06 + r() * 0.22;
      if (r() < 0.1) x += 0.4; // kleine Lücken
    }
  }
  // auf der hinteren Tischkante (vor der Wand): Topfpflanze, Flaschen, Tuch
  plant(-1.9, TABLE_Y, WALL_Z + 0.5, true);
  bottle(-1.45, TABLE_Y, WALL_Z + 0.35);
  bottle(-1.25, TABLE_Y, WALL_Z + 0.45);
  jar(1.6, TABLE_Y, WALL_Z + 0.4); jar(1.85, TABLE_Y, WALL_Z + 0.32);
  crate(2.6, TABLE_Y, WALL_Z + 0.4);
  plant(-3.6, TABLE_Y, WALL_Z + 0.35, true);
  cloth(3.6, TABLE_Y, WALL_Z + 0.4);

  // ---------- einmal rendern + weichzeichnen ----------
  const rtOpts = { depthBuffer: true, type: THREE.HalfFloatType, generateMipmaps: false };
  const rtA = new THREE.WebGLRenderTarget(4, 4, { ...rtOpts, samples: 4 });
  const rtB = new THREE.WebGLRenderTarget(4, 4, { ...rtOpts, depthBuffer: false });
  const rtC = new THREE.WebGLRenderTarget(4, 4, { ...rtOpts, depthBuffer: false });
  const quadGeo = new THREE.PlaneGeometry(2, 2);
  const blurMat = new THREE.ShaderMaterial({
    uniforms: { tMap: { value: null }, uDir: { value: new THREE.Vector2() } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `uniform sampler2D tMap; uniform vec2 uDir; varying vec2 vUv;
      void main(){
        vec3 c = texture2D(tMap, vUv).rgb * 0.227;
        c += (texture2D(tMap, vUv + uDir * 1.385).rgb + texture2D(tMap, vUv - uDir * 1.385).rgb) * 0.316;
        c += (texture2D(tMap, vUv + uDir * 3.231).rgb + texture2D(tMap, vUv - uDir * 3.231).rgb) * 0.070;
        gl_FragColor = vec4(c, 1.0);
      }`,
    depthTest: false, depthWrite: false,
  });
  const blurQuad = new THREE.Mesh(quadGeo, blurMat);
  const blurScene = new THREE.Scene(); blurScene.add(blurQuad);
  const orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // Vollbild-Rechteck für die Hauptszene (wird zuerst gezeichnet, ohne Tiefentest)
  const tint = new THREE.Color(1, 1, 1);   // Ofen-Glühen färbt den Hintergrund warm
  const showMat = new THREE.ShaderMaterial({
    uniforms: { tMap: { value: rtC.texture }, uTint: { value: tint } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }',
    fragmentShader: `uniform sampler2D tMap; uniform vec3 uTint; varying vec2 vUv;
      void main(){
        vec3 c = texture2D(tMap, vUv).rgb;
        // leichter warmer Dunst + Vignette, damit der Blick zur Seife geht
        c = mix(c, vec3(0.78, 0.6, 0.43), 0.1);
        vec2 q = vUv - 0.5; c *= 1.0 - 0.35 * dot(q, q);
        gl_FragColor = vec4(c * uTint, 1.0);
        #include <colorspace_fragment>
      }`,
    depthTest: false, depthWrite: false,
  });
  const backdrop = new THREE.Mesh(quadGeo, showMat);
  backdrop.frustumCulled = false;
  backdrop.renderOrder = -1000;

  const _size = new THREE.Vector2();
  function render(camera) {
    renderer.getDrawingBufferSize(_size);
    const w = Math.max(2, Math.round(_size.x / 2)), h = Math.max(2, Math.round(_size.y / 2));
    rtA.setSize(w, h); rtB.setSize(w, h); rtC.setSize(w, h);
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(rtA); renderer.render(bgScene, camera);
    // 2x separierbarer Gauß (horizontal, vertikal), Radius ~ 1 % der Bildbreite
    const px = Math.max(1, w / 300);
    blurMat.uniforms.tMap.value = rtA.texture; blurMat.uniforms.uDir.value.set(px / w, 0);
    renderer.setRenderTarget(rtB); renderer.render(blurScene, orthoCam);
    blurMat.uniforms.tMap.value = rtB.texture; blurMat.uniforms.uDir.value.set(0, px / h);
    renderer.setRenderTarget(rtC); renderer.render(blurScene, orthoCam);
    blurMat.uniforms.tMap.value = rtC.texture; blurMat.uniforms.uDir.value.set(px * 0.6 / w, 0);
    renderer.setRenderTarget(rtB); renderer.render(blurScene, orthoCam);
    blurMat.uniforms.tMap.value = rtB.texture; blurMat.uniforms.uDir.value.set(0, px * 0.6 / h);
    renderer.setRenderTarget(rtC); renderer.render(blurScene, orthoCam);
    renderer.setRenderTarget(prev);
  }

  return { backdrop, render, tint };
}
