// Reine Physik-Simulation des Würfelhaufens ohne Browser: node tests/pile-sim.mjs
import * as THREE from 'three';
import { LooseCubes } from '../src/looseCubes.js';
import { PHYS, CUBE } from '../src/config.js';
const scene = new THREE.Scene();
const l = new LooseCubes(scene, new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
let t = 0, steps = 0, ms = 0;
const run = (sec) => { const n = Math.round(sec / PHYS.step); const a = performance.now(); for (let i = 0; i < n; i++) { l.step(PHYS.step); l.flush(); } ms += performance.now() - a; steps += n; t += sec; };
// zwei Seifen à 4 Scheiben, je 24 Reihen (2 x 15 Würfel), ca. 3 Reihen pro 0,1 s
for (let soap = 0; soap < 2; soap++) for (let s = 0; s < 4; s++) { for (let row = 0; row < 24; row++) { for (let dk = 0; dk < 2; dk++) for (let i = 0; i < 15; i++) l.spawn(-0.35 + i * 0.05, 0.69 + (23 - row) * 0.05, 0.175 - s * 0.1 - dk * 0.05, 1, 1, 1, soap); run(0.035); } run(0.4); }
for (let k = 0; k < 10 && l.activeCount; k++) run(1);
const W = Math.sqrt(l.heights.length);
let hmax = 0, filled = 0, sum = 0; for (const v of l.heights) { hmax = Math.max(hmax, v); if (v > 0) filled++; sum += v; }
let rmax = 0; for (let i = 0; i < l.used; i++) rmax = Math.max(rmax, Math.hypot(l.pos[i * 3], l.pos[i * 3 + 2]));
// Höhenprofil entlang x durch die Mitte
const mid = (W / 2) | 0; const prof = []; for (let x = 0; x < W; x += 3) prof.push((l.heights[mid * W + x] / CUBE).toFixed(0));
console.log({ simSeconds: t.toFixed(1), stillActive: l.activeCount, hmaxCubes: (hmax / CUBE).toFixed(1), filledCells: filled, avgH: (sum / filled / CUBE).toFixed(1), rmax: rmax.toFixed(2), msPerStep: (ms / steps).toFixed(3) });
console.log('Profil (Würfel hoch, links->rechts):', prof.join(' '));
