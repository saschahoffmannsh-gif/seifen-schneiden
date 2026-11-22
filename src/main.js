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
import { unlockAudio, sndTick } from './audio.js';
import { PHYS } from './config.js';
import { createBlockMaterial, createLooseMaterial } from './soapMaterial.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const canvas = document.getElementById('scene');
const view = createScene(canvas);
const ui = createUI();
const input = createInput(canvas, unlockAudio);
document.addEventListener('pointerdown', unlockAudio, { once: true });

// Block: unterteilte Würfel (damit die Rundung im Shader weich wird), lose Würfel: leicht abgerundet.
// Geometrien/Materialien werden genau einmal erzeugt.
const blockGeo = new THREE.BoxGeometry(1, 1, 1, 3, 3, 3);
const looseGeo = new RoundedBoxGeometry(1, 1, 1, 2, 0.14);
const block = new SoapBlock(view.scene, blockGeo, createBlockMaterial());
const loose = new LooseCubes(view.scene, looseGeo, createLooseMaterial());
loose.onLand = sndTick;
const confetti = new Confetti(view.scene);
const game = new Game(view, ui, input, block, loose, createKnife(), confetti);
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
