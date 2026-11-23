// Spielablauf (Zustandsmaschine):
//   shelf   -> Seife im Regal (mittleres Wandbrett) antippen
//   flying  -> Seife fliegt vom Regal über die Schale
//   cutting -> Seife hin und her wischend in die Schale schneiden
//   oven    -> Würfel schmelzen (Timer mit Fortschrittsbalken)
//   reveal  -> fertige marmorierte Seife aus der Form nehmen
//   unmolded -> "Verkaufen": Schale verschwindet, Seife legt sich auf den Tisch
//   pickPkg -> Päckchen im Regal antippen -> fliegt auf den Tisch, Deckel geht ab
//   pickSoap -> Seife antippen -> fliegt ins Päckchen, Deckel drauf
//   packed  -> Päckchen zur Seite wischen -> verschickt, Geld gutgeschrieben, neue Bestellung
import * as THREE from 'three';
import { BLOCK, BOWL, CUBE, CUT, OVEN_SECONDS, BLOCK_BASE_Y } from './config.js';
import { SOAP_LIST, SOAP_BY_ID } from './soaps.js';
import { makeMarbleTexture } from './marble.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { sndCut, sndPop, sndCoin, sndDing, haptic } from './audio.js';
import { PKG, TABLE_SPOT, PKG_SHELF_SCALE, SHADOW_SOAP } from './packages.js';
import { TABLE_Y } from './setting/wall.js';

const BAR_TABLE_SCALE = 0.85;                       // Seife auf dem Tisch / im Päckchen
const BAR_HALF_H = 0.18 * BAR_TABLE_SCALE;          // halbe Höhe der liegenden Seife
const easeInOut = (t) => t * t * (3 - 2 * t);
const easeOut = (t) => 1 - (1 - t) * (1 - t) * (1 - t);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _t = new THREE.Vector3();

const CUSTOMERS = ['Anna', 'Ben', 'Clara', 'Emil', 'Frieda', 'Jonas', 'Lea', 'Mila', 'Paul', 'Sophie'];
const _ray = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _hit = new THREE.Vector3();
const _plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -(BLOCK.nz * CUBE / 2 + 0.05));

const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

export class Game {
  constructor({ renderer, scene, camera, ovenLight, bg, bowl, bowlShadow }, ui, input, block, loose, knife, confetti, shelf, packages) {
    Object.assign(this, { renderer, scene, camera, ovenLight, bg, bowl, bowlShadow, ui, input, block, loose, knife, confetti, shelf, packages });
    this.anims = [];             // laufende Animationen (werden nur bei Ereignissen angelegt)
    this.pkgSlot = -1;
    this.swipe = { active: false, x0: 0, y0: 0, t0: 0, dx: 0 };
    // Seife im Regal antippen: Raycast NUR beim Tippen, nicht pro Frame
    this.tapNdc = new THREE.Vector2();
    const canvas = renderer.domElement;
    this.isAvailable = (s) => !this.cutIds.has(s.id);
    canvas.addEventListener('pointerdown', (e) => {
      const st = this.state;
      if (st === 'packed') { this.swipeStart(e); return; }
      if (st !== 'shelf' && st !== 'pickPkg' && st !== 'pickSoap') return;
      const r = canvas.getBoundingClientRect();
      this.tapNdc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      if (st === 'shelf') {
        const i = this.shelf.pick(this.tapNdc, this.camera, this.isAvailable);
        if (i >= 0) this.pickSoap(i);
      } else if (st === 'pickPkg') {
        if (this.packages.pick(this.tapNdc, this.camera) >= 0) this.openPicker();
      } else if (this.hitBar()) this.soapIntoPackage();
    });
    window.addEventListener('pointermove', (e) => this.swipeMove(e));
    window.addEventListener('pointerup', (e) => this.swipeEnd(e));
    window.addEventListener('pointercancel', (e) => this.swipeEnd(e, true));
    this.coins = 0;
    this.state = 'shelf';
    this.cutIds = new Set();      // welche Sorten schon in der Schale sind
    this.bgBase = bg.clone();
    this.bgHot = new THREE.Color('#ffd2b0');

    // Messer-Zustand
    this.knifeX = 0; this.knifeTargetX = 0; this.prevKnifeX = 0;
    this.knifeY = 2; this.knifeZ = 0; this.knifeTilt = 0;
    this.sliceProgress = 0; this.returning = false; this.slicesCut = 0;
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
    this.shelf.setSoaps(soaps);
  }

  // ---------- Zustandswechsel ----------
  toShelf() {
    this.state = 'shelf';
    this.ui.setCut(null);
    this.knife.visible = false;
    const missing = this.order.soaps.filter((s) => !this.cutIds.has(s.id));
    this.ui.hint(missing.length ? `Tippe im Regal auf ${missing[0].emoji} ${missing[0].name}` : '');
    const acts = [];
    if (this.loose.used > 0) acts.push({ label: '🔥 In den Ofen', onClick: () => this.toOven() });
    this.ui.actions(acts);
  }

  /** Seife im Regal angetippt: sie fliegt über die Schale, dann geht das Schneiden los. */
  pickSoap(slot) {
    if (this.state !== 'shelf') return;
    const soap = this.shelf.soaps[slot];
    this.state = 'flying';
    this.ui.actions([]);
    this.ui.hint('');
    haptic(8);
    this.shelf.launch(slot, () => this.startCutting(soap));
  }

  startCutting(soap) {
    this.state = 'cutting';
    this.ui.hint('Wisch hin und her – das Messer sägt sich nach unten ↔');
    this.block.load(soap);
    this.loose.blockHalfX = this.block.halfX; this.loose.blockHalfZ = this.block.halfZ;
    this.loose.blockTop = this.block.topY;
    this.knife.visible = true;
    this.knifeY = this.block.topY + 0.6;
    this.knifeZ = this.block.cutZ;
    this.sliceProgress = 0; this.returning = false; this.slicesCut = 0;
    this.ui.setCut(0, soap);
    this.loose.blockTop = -1; // Würfel fallen vorne weg, keine Kollision mit der Blockoberseite nötig
    haptic(8);
  }

  finishBlock() {
    const soap = this.block.soap;
    this.cutIds.add(soap.id);
    this.ui.setOrder(this.order, this.cutIds);
    this.loose.blockTop = -1;
    this.confetti.burst(0, BLOCK_BASE_Y + 0.2, 0.3, 110);
    sndPop(); haptic(30);
    this.ui.setCut(1, soap);
    this.ui.popup(`${soap.emoji} Fertig!`);
    this.knife.visible = false;
    setTimeout(() => this.toShelf(), 700);
    this.state = 'between';
  }

  toOven() {
    this.state = 'oven';
    this.ovenT = 0;
    this.ui.actions([]);
    this.ui.showOven(true);
    this.ui.hint('Die Seife schmilzt im Ofen …');
    // Marmor aus den Anteilen der Würfel in der Schale
    const parts = [];
    const counts = this.loose.typeCounts;
    for (const s of SOAP_BY_ID) if (counts[s.id] > 0) {
      parts.push({ rgb: s.base, w: counts[s.id] });
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
    this.bar.scale.set(0.6, 0.6, 0.6); this.bar.rotation.set(0, 0, 0);
    this.state = 'unmolded';
  }

  /** Kleine Animations-Hilfe: step(e, t) pro Frame mit e = geglättetes t, danach done(). */
  play(dur, step, done, ease = easeInOut) {
    this.anims.push({ t: 0, dur, step, done, ease });
  }

  runAnims(dt) {
    for (let i = this.anims.length - 1; i >= 0; i--) {
      const a = this.anims[i];
      a.t = Math.min(1, a.t + dt / a.dur);
      a.step(a.ease(a.t), a.t);
      if (a.t >= 1) {
        this.anims[i] = this.anims[this.anims.length - 1]; this.anims.pop();
        if (a.done) a.done();
      }
    }
  }

  /** "Verkaufen": Schale verschwindet, die fertige Seife legt sich auf den Tisch. */
  sell() {
    if (this.state !== 'unmolded') return;
    this.state = 'toTable';
    this.ui.actions([]);
    this.ui.hint('');
    const bar = this.bar;
    const p0 = bar.position.clone(), s0 = bar.scale.x, rx0 = bar.rotation.x;
    const ry0 = ((bar.rotation.y % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const ry1 = Math.round(ry0 / Math.PI) * Math.PI;
    const spot = TABLE_SPOT.soap;
    this.play(0.75, (e, t) => {
      const k = Math.max(0.001, 1 - e);
      this.bowl.scale.set(k, k, k); this.bowl.position.y = -0.25 * e;
      this.bowlShadow.scale.set(k, k, k);
      bar.position.set(p0.x + (spot.x - p0.x) * e, p0.y + (TABLE_Y + BAR_HALF_H - p0.y) * e + Math.sin(t * Math.PI) * 0.35, p0.z + (spot.z - p0.z) * e);
      bar.rotation.set(rx0 * (1 - e), ry0 + (ry1 - ry0) * e, 0);
      const sc = s0 + (BAR_TABLE_SCALE - s0) * e; bar.scale.set(sc, sc, sc);
    }, () => {
      this.bowl.visible = false; this.bowlShadow.visible = false;
      this.packages.setBlob(SHADOW_SOAP, spot.x, TABLE_Y + 0.003, spot.z, 1.35, 0.95);
      sndPop(); haptic(10);
      this.state = 'pickPkg';
      this.ui.hint('Tippe auf ein Päckchen im Regal');
    });
  }

  /** Auswahlfenster mit allen Päckchen-Sorten (Spiel-Taps sind solange pausiert). */
  openPicker() {
    this.state = 'picker';
    const thumbs = this.packages.makeThumbs(this.renderer);
    this.ui.openPicker(this.packages.types, thumbs, (type) => {
      this.state = 'pickPkg';
      this.pkgType = type;
      this.flyPackage(this.packages.slotOf(type.id));
    }, () => { if (this.state === 'picker') this.state = 'pickPkg'; });
  }

  /** Päckchen fliegt vom Regal auf den Tisch, der Deckel geht ab und landet dahinter. */
  flyPackage(i) {
    this.state = 'packing';
    this.pkgSlot = i;
    this.ui.hint('');
    this.packages.onShelf[i] = 0;
    this.packages.update(0, -1);
    this.packages.setBlob(i, 0, 0, 0, 0, 0);
    const from = this.packages.home[i], to = TABLE_SPOT.pkg, lidTo = TABLE_SPOT.lid;
    haptic(8);
    this.play(0.6, (e, t) => {
      _a.lerpVectors(from, to, e); _a.y += Math.sin(t * Math.PI) * 0.6;
      this.packages.setClosed(i, _a, 0, PKG_SHELF_SCALE + (1 - PKG_SHELF_SCALE) * e);
    }, () => {
      this.packages.setBlob(i, to.x, TABLE_Y + 0.003, to.z, PKG.w * 1.45, PKG.d * 1.6);
      sndPop();
      // Deckel abheben und hinter das Päckchen legen
      _b.copy(to); _b.y += PKG.h - PKG.lidOver;
      const lid0 = _b.clone();
      this.play(0.5, (e, t) => {
        _a.lerpVectors(lid0, lidTo, e); _a.y += Math.sin(t * Math.PI) * 0.45;
        this.packages.setLid(i, _a, -Math.sin(t * Math.PI) * 0.5, 0, 0, 1);
      }, () => {
        this.state = 'pickSoap';
        this.barBaseY = this.bar.position.y;
        this.ui.hint('Tippe auf die Seife');
      });
    });
  }

  /** Antippen der Seife auf dem Tisch (nur beim Tippen). */
  hitBar() {
    _ray.setFromCamera(this.tapNdc, this.camera);
    if (_ray.intersectObject(this.bar, false).length) return true;
    _t.copy(this.bar.position).project(this.camera);
    const dx = _t.x - this.tapNdc.x, dy = (_t.y - this.tapNdc.y) * 0.6;
    return dx * dx + dy * dy < 0.2 * 0.2;
  }

  /** Seife fliegt ins offene Päckchen, dann kommt der Deckel drauf. */
  soapIntoPackage() {
    this.state = 'packing';
    this.ui.hint('');
    const bar = this.bar, i = this.pkgSlot;
    const p0 = TABLE_SPOT.soap, to = TABLE_SPOT.pkg;
    const ry0 = bar.rotation.y, ry1 = Math.round(ry0 / Math.PI) * Math.PI;
    this.packages.setBlob(SHADOW_SOAP, 0, 0, 0, 0, 0);
    haptic(8);
    this.play(0.6, (e, t) => {
      bar.position.set(p0.x + (to.x - p0.x) * e, TABLE_Y + BAR_HALF_H + PKG.wall * e + Math.sin(t * Math.PI) * 0.7, p0.z + (to.z - p0.z) * e);
      bar.rotation.set(Math.sin(t * Math.PI) * 0.25, ry0 + (ry1 - ry0) * e, 0);
    }, () => {
      sndPop();
      const lidFrom = TABLE_SPOT.lid;
      _b.copy(to); _b.y += PKG.h - PKG.lidOver;
      const lidTo = _b.clone();
      this.play(0.45, (e, t) => {
        _a.lerpVectors(lidFrom, lidTo, e); _a.y += Math.sin(t * Math.PI) * 0.5;
        this.packages.setLid(i, _a, -Math.sin(t * Math.PI) * 0.5, 0, 0, 1);
      }, () => {
        bar.visible = false;
        sndPop(); haptic(15);
        this.state = 'packed';
        this.ui.hint('Wische das Paket zur Seite');
      });
    });
  }

  // ---------- Wischen zum Verschicken (Touch + Maus über Pointer Events) ----------
  swipeStart(e) {
    const sw = this.swipe;
    sw.active = true; sw.id = e.pointerId; sw.x0 = e.clientX; sw.y0 = e.clientY; sw.t0 = performance.now(); sw.dx = 0;
  }
  swipeMove(e) {
    const sw = this.swipe;
    if (!sw.active || e.pointerId !== sw.id || this.state !== 'packed') return;
    sw.dx = e.clientX - sw.x0;
    // Päckchen folgt dem Finger (Bildschirmbreite ~ 3,2 Welt-Einheiten)
    _a.copy(TABLE_SPOT.pkg); _a.x += sw.dx / window.innerWidth * 3.2;
    this.packages.setClosed(this.pkgSlot, _a, -sw.dx / window.innerWidth * 0.3, 1);
    this.packages.setBlob(this.pkgSlot, _a.x, TABLE_Y + 0.003, _a.z, PKG.w * 1.45, PKG.d * 1.6);
  }
  swipeEnd(e, cancel) {
    const sw = this.swipe;
    if (!sw.active || e.pointerId !== sw.id) return;
    sw.active = false;
    if (this.state !== 'packed') return;
    const dx = e.clientX - sw.x0, dy = e.clientY - sw.y0;
    const dt = Math.max(1, performance.now() - sw.t0);
    const W = window.innerWidth, adx = Math.abs(dx);
    const ok = !cancel && adx >= Math.max(50, W * 0.12) && adx > Math.abs(dy) * 1.3 && (adx / dt > 0.25 || adx >= W * 0.3);
    const x0 = TABLE_SPOT.pkg.x + dx / W * 3.2;
    if (ok) { this.sendPackage(dx > 0 ? 1 : -1, x0); return; }
    // zu kurz: zurückfedern
    this.play(0.25, (k) => {
      _a.copy(TABLE_SPOT.pkg); _a.x = x0 + (TABLE_SPOT.pkg.x - x0) * k;
      this.packages.setClosed(this.pkgSlot, _a, 0, 1);
      this.packages.setBlob(this.pkgSlot, _a.x, TABLE_Y + 0.003, _a.z, PKG.w * 1.45, PKG.d * 1.6);
    }, null, easeOut);
  }

  /** Päckchen rutscht aus dem Bild, Geld wird gutgeschrieben, neue Bestellung. */
  sendPackage(dir, x0) {
    this.state = 'sending';
    this.ui.hint('');
    const i = this.pkgSlot, x1 = dir * 5;
    this.play(0.45, (e) => {
      _a.copy(TABLE_SPOT.pkg); _a.x = x0 + (x1 - x0) * e;
      this.packages.setClosed(i, _a, -dir * 0.15 * e, 1);
      this.packages.setBlob(i, _a.x, TABLE_Y + 0.003, _a.z, PKG.w * 1.45, PKG.d * 1.6);
    }, () => {
      this.packages.hide(i);
      const earned = this.price + (this.pkgType ? this.pkgType.bonus : 0);
      this.coins += earned;
      this.ui.setCoins(this.coins, true);
      sndCoin(); haptic(20);
      this.ui.popup(`+${earned} 🪙`);
      // Schale kommt zurück, Päckchen wieder ins Regal, neue Bestellung
      this.bowl.visible = true; this.bowlShadow.visible = true;
      this.play(0.45, (e) => {
        const k = Math.max(0.001, e);
        this.bowl.scale.set(k, k, k); this.bowl.position.y = -0.25 * (1 - e);
        this.bowlShadow.scale.set(k, k, k);
      }, null, easeOut);
      this.packages.reset();
      this.newOrder();
      this.toShelf();
    }, (t) => t * t);
  }

  // ---------- pro Frame ----------
  update(dt, time) {
    // nächste gewünschte Seife im Regal hüpft leicht (zeigt: hier antippen)
    let bob = -1;
    if (this.state === 'shelf') {
      const list = this.shelf.soaps;
      for (let i = 0; i < list.length; i++) if (!this.cutIds.has(list[i].id)) { bob = i; break; }
    }
    this.shelf.update(dt, time, bob);
    let pb = -1;
    if (this.state === 'pickPkg') pb = 0;   // Standard-Päckchen hüpft
    this.packages.update(time, pb);
    // Seife auf dem Tisch hüpft leicht, solange man sie antippen soll
    if (this.state === 'pickSoap') this.bar.position.y = this.barBaseY + Math.max(0, Math.sin(time * 5)) * 0.05 * (Math.sin(time * 2.5) > 0 ? 1 : 0);
    if (this.anims.length) this.runAnims(dt);
    if (this.state === 'cutting') this.updateCutting(dt);
    else if (this.state === 'oven') this.updateOven(dt);
    else if (this.state === 'unmolded') this.updateBar(dt, time);
  }

  /**
   * Schneiden wie Brot: Das Messer steht hinter der vordersten Scheibe. Hin-und-her-Wischen
   * treibt es nach unten, die Würfel der Scheibe lösen sich dabei von oben nach unten.
   * Unten angekommen ist die Scheibe fertig, das Messer fährt hoch zur nächsten Scheibe dahinter.
   */
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
    const top = this.block.topY, height = top - this.block.bottomY;

    if (this.returning) {
      // automatisch hochfahren und eine Scheibe nach hinten wechseln
      this.knifeY = damp(this.knifeY, top + 0.06, CUT.returnSpeed, dt);
      this.knifeZ = damp(this.knifeZ, this.block.cutZ, CUT.returnSpeed, dt);
      if (top + 0.06 - this.knifeY < 0.02) { this.returning = false; this.sliceProgress = 0; }
    } else if (this.block.active) {
      if (inp.down && Math.abs(dx) > 1e-4) {
        // Jeder Wischweg (egal welche Richtung) treibt das Messer tiefer
        this.sliceProgress = Math.min(1, this.sliceProgress + Math.abs(dx) / CUT.strokePerSlice);
        const n = this.block.cutTo(this.sliceProgress, this.onCube);
        if (n) { sndCut(); haptic(5); }
        if (this.sliceProgress >= 1) this.completeSlice();
      }
      if (!this.returning) {
        this.knifeY = damp(this.knifeY, top - height * this.sliceProgress, 16, dt);
        this.knifeZ = damp(this.knifeZ, this.block.cutZ, 16, dt);
      }
    }

    this.knifeTilt = damp(this.knifeTilt, THREE.MathUtils.clamp(-dx / Math.max(dt, 1e-3) * 0.03, -0.12, 0.12), 10, dt);
    this.ui.setCut(this.block.cutFraction, this.block.soap);
    this.knife.position.set(this.knifeX, this.knifeY, this.knifeZ);
    this.knife.rotation.z = this.knifeTilt;
  }

  completeSlice() {
    const done = this.block.finishSlice(this.onCube);
    this.slicesCut++;
    sndCut(); haptic(12);
    if (this.slicesCut === 1) this.ui.hint('');
    if (this.slicesCut % 2 === 0 || done) this.ui.popup();
    if (done) { this.finishBlock(); return; }
    this.returning = true;
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
