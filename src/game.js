// Spielablauf (Zustandsmaschine):
//   shelf   -> Seife aus dem Schrank wählen
//   cutting -> Seife hin und her wischend in die Schale schneiden
//   oven    -> Würfel schmelzen (Timer mit Fortschrittsbalken)
//   reveal  -> fertige marmorierte Seife aus der Form nehmen und verkaufen
import * as THREE from 'three';
import { BLOCK, BOWL, CUBE, CUT, OVEN_SECONDS, BLOCK_BASE_Y } from './config.js';
import { SOAP_LIST, SOAP_BY_ID } from './soaps.js';
import { makeMarbleTexture } from './marble.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { sndCut, sndPop, sndCoin, sndDing, haptic } from './audio.js';

const CUSTOMERS = ['Anna', 'Ben', 'Clara', 'Emil', 'Frieda', 'Jonas', 'Lea', 'Mila', 'Paul', 'Sophie'];
const _ray = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _hit = new THREE.Vector3();
const _plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -(BLOCK.nz * CUBE / 2 + 0.05));

const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

export class Game {
  constructor({ scene, camera, ovenLight, bg }, ui, input, block, loose, knife, confetti) {
    Object.assign(this, { scene, camera, ovenLight, bg, ui, input, block, loose, knife, confetti });
    this.coins = 0;
    this.state = 'shelf';
    this.cutIds = new Set();      // welche Sorten schon in der Schale sind
    this.bgBase = bg.clone();
    this.bgHot = new THREE.Color('#ffd2b0');

    // Messer-Zustand
    this.knifeX = 0; this.knifeTargetX = 0; this.prevKnifeX = 0;
    this.knifeY = 2; this.knifeTilt = 0;
    this.strokeDir = 0; this.strokeDist = 0; this.layerProgress = 0; this.needTurn = false;
    this.layersCut = 0;
    knife.position.set(0, 2.2, BLOCK.nz * CUBE / 2 + 0.03);
    knife.visible = false;
    scene.add(knife);

    // Fertige Seife (Geometrie + Material einmalig; nur die Textur wechselt pro Seife)
    this.barMat = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0 });
    this.bar = new THREE.Mesh(new RoundedBoxGeometry(1.0, 0.36, 0.66, 4, 0.1), this.barMat);
    this.bar.visible = false;
    scene.add(this.bar);
    // geschmolzene Seife in der Schale (Kegelstumpf, Höhe per Skalierung)
    this.liquid = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 48), this.barMat);
    this.liquid.visible = false;
    scene.add(this.liquid);

    // Klick-Geräusch, wenn Würfel landen
    this.onCube = (x, y, z, r, g, b, id) => loose.spawn(x, y, z, r, g, b, id);

    this.newOrder();
    this.toShelf();
  }

  newOrder() {
    const pool = SOAP_LIST.slice().sort(() => Math.random() - 0.5);
    // erste Bestellung immer Erdbeere + Vanille (wie im Konzept)
    const soaps = this.firstDone ? pool.slice(0, 2) : [SOAP_LIST[0], SOAP_LIST[1]];
    this.firstDone = true;
    this.order = { customer: CUSTOMERS[(Math.random() * CUSTOMERS.length) | 0], soaps };
    this.cutIds.clear();
    this.ui.setOrder(this.order, this.cutIds);
  }

  // ---------- Zustandswechsel ----------
  toShelf() {
    this.state = 'shelf';
    this.knife.visible = false;
    this.ui.showShelf(true, (s) => this.pickSoap(s));
    const missing = this.order.soaps.filter((s) => !this.cutIds.has(s.id));
    this.ui.hint(missing.length ? `Nimm ${missing[0].emoji} ${missing[0].name} aus dem Schrank` : 'Alles drin – ab in den Ofen!');
    const acts = [];
    if (this.loose.used > 0) acts.push({ label: '🔥 In den Ofen', onClick: () => this.toOven() });
    this.ui.actions(acts);
  }

  pickSoap(soap) {
    if (this.state !== 'shelf') return;
    this.state = 'cutting';
    this.ui.showShelf(false);
    this.ui.actions([]);
    this.ui.hint('Wisch hin und her, um zu schneiden ↔');
    this.block.load(soap);
    this.loose.blockHalfX = this.block.halfX; this.loose.blockHalfZ = this.block.halfZ;
    this.loose.blockTop = this.block.topY;
    this.knife.visible = true;
    this.knifeY = this.block.topY + 0.6;
    this.strokeDir = 0; this.strokeDist = 0; this.layerProgress = 0; this.needTurn = false;
    this.layersCut = 0;
    haptic(8);
  }

  finishBlock() {
    const soap = this.block.soap;
    this.cutIds.add(soap.id);
    this.ui.setOrder(this.order, this.cutIds);
    this.loose.blockTop = -1;
    this.confetti.burst(0, BLOCK_BASE_Y + 0.2, 0.3, 110);
    sndPop(); haptic(30);
    this.ui.popup(`${soap.emoji} Fertig!`);
    this.knife.visible = false;
    setTimeout(() => this.toShelf(), 700);
    this.state = 'between';
  }

  toOven() {
    this.state = 'oven';
    this.ovenT = 0;
    this.ui.showShelf(false);
    this.ui.actions([]);
    this.ui.showOven(true);
    this.ui.hint('Die Seife schmilzt im Ofen …');
    // Marmor aus den Anteilen der Würfel in der Schale
    const parts = [];
    const counts = this.loose.typeCounts;
    for (const s of SOAP_BY_ID) if (counts[s.id] > 0) {
      parts.push({ rgb: s.base, w: counts[s.id] * 0.65 });
      parts.push({ rgb: s.light, w: counts[s.id] * 0.35 });
    }
    // Farben abwechselnd mischen, damit Adern verschiedener Sorten nebeneinander liegen
    parts.sort((a, b) => (a.rgb[0] + a.rgb[2]) - (b.rgb[0] + b.rgb[2]));
    if (this.barMat.map) this.barMat.map.dispose();
    this.barMat.map = makeMarbleTexture(parts);
    this.barMat.needsUpdate = true;
    this.fill = Math.max(0.08, this.loose.fillHeight());
    this.liquid.visible = true;
    this.liquid.scale.set(BOWL.floorR, 0.001, BOWL.floorR);
  }

  toReveal() {
    this.state = 'reveal';
    this.ui.showOven(false);
    this.ovenLight.intensity = 0;
    this.bg.copy(this.bgBase);
    sndDing();
    this.ui.hint('Fertig geschmolzen!');
    this.ui.actions([{ label: '✨ Aus der Form nehmen', onClick: () => this.unmold() }]);
  }

  unmold() {
    this.loose.clear();
    this.liquid.visible = false;
    this.bar.visible = true;
    this.barT = 0;
    this.confetti.burst(0, 0.8, 0.4, 140);
    sndPop(); haptic(25);
    this.ui.popup('Wunderschön!');
    const match = this.order.soaps.every((s) => this.cutIds.has(s.id));
    const extra = [...this.cutIds].filter((id) => !this.order.soaps.some((s) => s.id === id)).length;
    this.price = match ? 40 - extra * 10 : 15;
    this.ui.hint(match ? `${this.order.customer} ist begeistert!` : `Nicht ganz die Bestellung …`);
    this.ui.actions([{ label: `🪙 Verkaufen für ${this.price}`, alt: true, onClick: () => this.sell() }]);
    this.state = 'unmolded';
  }

  sell() {
    this.coins += this.price;
    this.ui.setCoins(this.coins, true);
    sndCoin(); haptic(15);
    this.bar.visible = false;
    this.newOrder();
    this.toShelf();
  }

  // ---------- pro Frame ----------
  update(dt, time) {
    if (this.state === 'cutting') this.updateCutting(dt);
    else if (this.state === 'oven') this.updateOven(dt);
    else if (this.state === 'unmolded') this.updateBar(dt, time);
  }

  /** Hin-und-her-Wischen: jeder Richtungswechsel (bzw. ein voller Wisch) schneidet eine Schicht. */
  updateCutting(dt) {
    const inp = this.input;
    if (inp.down) {
      _ndc.set(inp.x, inp.y);
      _ray.setFromCamera(_ndc, this.camera);
      if (_ray.ray.intersectPlane(_plane, _hit)) {
        // Finger etwas verstärken, damit kleine Wischer reichen
        this.knifeTargetX = THREE.MathUtils.clamp(_hit.x * 1.3, -CUT.knifeRange, CUT.knifeRange);
      }
    }
    this.prevKnifeX = this.knifeX;
    this.knifeX = damp(this.knifeX, this.knifeTargetX, 28, dt);
    const dx = this.knifeX - this.prevKnifeX;

    if (inp.down && Math.abs(dx) > 1e-4 && this.block.active) {
      const dir = dx > 0 ? 1 : -1;
      if (dir !== this.strokeDir) {
        // Richtungswechsel: hat der vorige Wisch genug Weg gemacht -> Schicht fertig
        if (this.strokeDir !== 0 && this.strokeDist >= CUT.minStroke && !this.needTurn) this.completeLayer();
        this.strokeDir = dir; this.strokeDist = 0; this.needTurn = false;
      }
      this.strokeDist += Math.abs(dx);
      if (!this.needTurn) {
        const p = Math.min(1, this.strokeDist / CUT.fullStroke);
        if (p > this.layerProgress) {
          this.layerProgress = p;
          const n = this.block.cutTo(p, this.onCube);
          if (n) sndCut();
        }
        if (this.layerProgress >= 1) { this.completeLayer(); this.needTurn = true; }
      }
    }

    // Messerhöhe: Schneide sinkt mit dem Fortschritt durch die Schicht -> mit jedem Wisch tiefer
    const top = this.block.active ? this.block.topY : BLOCK_BASE_Y;
    const edgeY = top - CUBE * this.layerProgress;
    this.knifeY = damp(this.knifeY, edgeY, 14, dt);
    this.knifeTilt = damp(this.knifeTilt, THREE.MathUtils.clamp(-dx / Math.max(dt, 1e-3) * 0.03, -0.12, 0.12), 10, dt);
    this.knife.position.x = this.knifeX;
    this.knife.position.y = this.knifeY;
    this.knife.rotation.z = this.knifeTilt;
  }

  completeLayer() {
    const done = this.block.finishLayer(this.onCube);
    this.layerProgress = 0;
    this.layersCut++;
    this.loose.blockTop = done ? -1 : this.block.topY;
    sndCut(); haptic(8);
    if (this.layersCut === 2) this.ui.hint('');
    if (this.layersCut % 3 === 0 || done) this.ui.popup();
    if (done) this.finishBlock();
  }

  updateOven(dt) {
    this.ovenT += dt / OVEN_SECONDS;
    const t = Math.min(1, this.ovenT);
    this.ui.setOven(t);
    const e = t * t * (3 - 2 * t);
    this.loose.melt(e);
    // flüssige Seife steigt, Schalenwand ist kegelförmig -> Radius wächst mit der Höhe
    const h = this.fill * e;
    const r = BOWL.floorR + h * (BOWL.rimR - BOWL.floorR) / BOWL.height;
    this.liquid.scale.set(r - 0.01, Math.max(0.001, h), r - 0.01);
    this.liquid.position.y = h / 2;
    this.ovenLight.intensity = Math.sin(Math.min(1, t * 1.2) * Math.PI) * 3;
    this.bg.copy(this.bgBase).lerp(this.bgHot, Math.sin(t * Math.PI) * 0.8);
    if (t >= 1) this.toReveal();
  }

  /** Fertige Seife hebt sich weich aus der Schale und dreht sich langsam. */
  updateBar(dt, time) {
    this.barT = Math.min(1, this.barT + dt * 1.6);
    const e = 1 - Math.pow(1 - this.barT, 3);
    const s = 0.6 + 0.4 * e + Math.sin(this.barT * Math.PI) * 0.08;
    this.bar.scale.set(s, s, s);
    this.bar.position.set(0, 0.25 + e * 1.0, 0.1);
    this.bar.rotation.set(0.35 * e, time * 0.6, 0);
  }
}
