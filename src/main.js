// Einstieg: baut alles zusammen und startet die Hauptschleife.
import * as THREE from 'three';
import './style.css';
import { createScene } from './scene.js';
import { SoapBlock } from './soapBlock.js';
import { LooseCubes } from './looseCubes.js';
import { createKnife } from './knife.js';
import { Confetti } from './confetti.js';
import { createInput } from './input.js';
import { createUI } from './ui.js';
import { Game } from './game.js';
import { ShelfSoaps } from './shelfSoaps.js';
import { BOWL } from './config.js';
import { unlockAudio, sndTick } from './audio.js';
import { PHYS } from './config.js';
import { createBlockMaterial, createLooseMaterial } from './soapMaterial.js';

const canvas = document.getElementById('scene');
const view = createScene(canvas);
const ui = createUI();
const input = createInput(canvas, unlockAudio);
document.addEventListener('pointerdown', unlockAudio, { once: true });

// Block: unterteilte Würfel (damit die Rundung im Shader weich wird).
// Geometrien/Materialien werden genau einmal erzeugt.
const blockGeo = new THREE.BoxGeometry(1, 1, 1, 2, 2, 2);
// lose Würfel sind sehr klein -> einfache Box (24 Vertices), damit auch 10 000 Stück billig bleiben
const looseGeo = new THREE.BoxGeometry(1, 1, 1);
const block = new SoapBlock(view.scene, blockGeo, createBlockMaterial());
const loose = new LooseCubes(view.scene, looseGeo, createLooseMaterial());
loose.onLand = sndTick;
const confetti = new Confetti(view.scene);
const shelfSoaps = new ShelfSoaps(view.scene);
const game = new Game(view, ui, input, block, loose, createKnife(), confetti, shelfSoaps);

// Bestell-Zettel unter die Schale legen: Unterkante der Schale auf den Bildschirm projizieren
// (nur beim Start und bei Größenänderung, nicht pro Frame)
const _bp = new THREE.Vector3();
function layoutUI() {
  view.camera.updateMatrixWorld();
  let low = -1;
  for (const [y, r] of [[-0.07, BOWL.floorR + 0.02], [BOWL.height + 0.035, BOWL.rimR + 0.06]]) {
    _bp.set(0, y, r).project(view.camera);
    low = Math.max(low, (1 - _bp.y) / 2 * window.innerHeight);
  }
  document.documentElement.style.setProperty('--bowl-bottom', `${Math.round(low)}px`);
  document.body.classList.toggle('landscape', window.innerWidth > window.innerHeight * 1.15);
}
layoutUI();
window.addEventListener('resize', layoutUI);
window.__game = game; // für Tests/Debugging

// FPS-Anzeige mit ?fps=1
const showFps = new URLSearchParams(location.search).get('fps') === '1';
ui.showFps(showFps);
let fpsFrames = 0, fpsTime = 0, worst = 0;

// Hauptschleife: Delta-Time (begrenzt) + fester Physik-Zeitschritt
let last = performance.now(), acc = 0, time = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.05) dt = 0.05;        // nach Tab-Wechsel o. Ä. keine Riesensprünge
  if (dt < 0) dt = 0;
  time += dt;

  game.update(dt, time);

  acc += dt;
  let steps = 0;
  while (acc >= PHYS.step && steps < PHYS.maxSteps) { loose.step(PHYS.step); acc -= PHYS.step; steps++; }
  if (steps === PHYS.maxSteps) acc = 0;
  loose.flush();
  confetti.update(dt);

  view.renderer.render(view.scene, view.camera);

  if (showFps) {
    fpsFrames++; fpsTime += dt; worst = Math.max(worst, dt);
    if (fpsTime >= 0.5) {
      const info = view.renderer.info.render;
      ui.setFps(`${Math.round(fpsFrames / fpsTime)} FPS\nmax ${(worst * 1000).toFixed(1)} ms\ncalls ${info.calls}\nfliegend ${loose.activeCount}\nWürfel ${loose.used}`);
      fpsFrames = 0; fpsTime = 0; worst = 0;
    }
  }
}
requestAnimationFrame(frame);
