// Spielablauf (Zustandsmaschine):
//   choose  -> keine Bestellung: Zettel am mittleren Brett antippen, groß lesen, annehmen
//   shelf   -> Bestellung aktiv: Wandschrank antippen -> Vollbild-Schrank, passende Schublade finden
//   cabinet -> Schrank ist offen
//   flying  -> Seife fliegt vom Regal über die Schale
//   cutting -> Seife hin und her wischend in die Schale schneiden
//   oven    -> Würfel schmelzen (Timer mit Fortschrittsbalken)
//   reveal  -> fertige marmorierte Seife aus der Form nehmen
//   unmolded -> "Verkaufen": Schale verschwindet, Seife legt sich auf den Tisch
//   pickPkg -> Päckchen im Regal antippen -> fliegt auf den Tisch, Deckel geht ab
//   pickSoap -> Seife antippen -> fliegt ins Päckchen, Deckel drauf
//   packed  -> Päckchen zur Seite wischen -> verschickt, Geld gutgeschrieben, neue Bestellung
import * as THREE from 'three';
import { BLOCK, BOWL, CUBE, CUT, OVEN_SECONDS, BLOCK_BASE_Y, SLICES, MOULD_CUBES, PCT_PER_SLICE } from './config.js';
import { SOAP_LIST, SOAP_BY_ID } from './soaps.js';
import { makeMarbleTexture } from './marble.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { sndCut, sndPop, sndCoin, sndDing, haptic } from './audio.js';
import { PKG, TABLE_SPOT, PKG_SHELF_SCALE, SHADOW_SOAP, SHADOW_LID } from './packages.js';
import { TABLE_Y, CABINET, SHELF_FRONT_Z } from './setting/wall.js';
import { OrderNotes, NOTE_COUNT } from './orderNotes.js';
import { makeOrder } from './orders.js';
import { ADDITIVES, ADD_CATS, MAX_ADDITIVES, additiveThumb } from './additives.js';
import { cabinetLayout } from './cabinet.js';
import { save, applyUnlocks, BAR_SLICES, BAR_PRICE, STOCK_MAX } from './save.js';
import { PKG_CATS, PACKAGE_TYPES } from './decor.js';
import { Deco } from './deco.js';
import { Showcase } from './showcase.js';
import { DECO_ITEMS, DECO_GROUPS, phaseOf, groupOf } from './decoItems.js';
import { DECO_SPOTS, DECO_Y, SHELF_Z } from './setting/wall.js';

const FILL_CAP = 40, FILL_MAX_KINDS = 4;     // Teile pro Füllungs-Sorte, verschiedene Füllungen
const DRAG_LIFT = 55;                        // px: Deko schwebt so weit über dem Finger
const _dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(TABLE_Y + 0.75));
const _dragPos = new THREE.Vector3(), _dragTarget = new THREE.Vector3();

const BAR_TABLE_SCALE = 0.85;                       // Seife auf dem Tisch / im Päckchen
const BAR_HALF_H = 0.18 * BAR_TABLE_SCALE;          // halbe Höhe der liegenden Seife
const easeInOut = (t) => t * t * (3 - 2 * t);
const easeOut = (t) => 1 - (1 - t) * (1 - t) * (1 - t);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _t = new THREE.Vector3();

const _m4 = new THREE.Matrix4(), _qq = new THREE.Quaternion(), _qq2 = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0), _side = new THREE.Vector3(1, 0, 0);
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
    this.isAvailable = () => true;   // alle Sorten der Bestellung antippbar (leerer Vorrat -> Hinweis)
    canvas.addEventListener('pointerdown', (e) => {
      const st = this.state;
      const r = canvas.getBoundingClientRect();
      this.tapNdc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      if (st === 'unmolded') { this.showcase.down(e); return; }
      if (st === 'decorFill' || st === 'packed') {
        if (this.drag || this.deco.busy) return;
        // Deko-Regal antippen > gewählte Deko ziehen > (zu) Päckchen wegwischen
        const gr = this.pickDecoShelf();
        if (gr) { this.openDecoSheet(gr); return; }
        if (this.armed) { this.startDrag(this.armed, e); return; }
        if (st === 'packed') this.swipeStart(e);
        return;
      }
      if (st !== 'choose' && st !== 'shelf' && st !== 'pickPkg' && st !== 'pickSoap') return;
      // Reihenfolge: Seife direkt getroffen > Zettel (genaues Rechteck) > Seife in der Nähe > Schrank
      if (st === 'shelf' && this.stocked) {
        const i = this.shelf.pick(this.tapNdc, this.camera, this.isAvailable, true);
        if (i >= 0) { this.pickSoap(i); return; }
      }
      const n = this.notes.pick(this.tapNdc, this.camera);
      if (n >= 0) { this.openNote(n); return; }
      if (st === 'shelf' && this.stocked) {
        const i = this.shelf.pick(this.tapNdc, this.camera, this.isAvailable);
        if (i >= 0) { this.pickSoap(i); return; }
      }
      if (st === 'choose' || st === 'shelf') {
        if (this.hitCabinet()) this.openCabinet();
      } else if (st === 'pickPkg') {
        if (this.packages.pick(this.tapNdc, this.camera) >= 0) this.openPicker();
      } else if (this.hitBar()) this.soapIntoPackage();
    });
    window.addEventListener('pointermove', (e) => { if (this.showcase.move(e)) return; if (this.drag) this.dragMove(e); else this.swipeMove(e); });
    window.addEventListener('pointerup', (e) => { if (this.showcase.up(e)) return; if (this.drag) this.dragEnd(e); else this.swipeEnd(e); });
    window.addEventListener('pointercancel', (e) => { if (this.showcase.up(e)) return; if (this.drag) this.dragEnd(e, true); else this.swipeEnd(e, true); });
    // Deko: freigeschaltete aus dem Spielstand, 3D-Teile am Päckchen
    applyUnlocks(DECO_ITEMS, 'deco:');
    this.deco = new Deco(scene, packages);
    this.drag = null; this.armed = null;
    applyUnlocks(PACKAGE_TYPES, 'pkg:');
    applyUnlocks(ADDITIVES, 'add:');
    this.additives = [];          // Zusätze in der aktuellen Seifenmasse
    this.pcts = {};               // aktuelle Anteile in der Form (Prozent je Sorten-id), ohne Allokation pro Frame
    this.stockOf = (id) => save.stock(id);
    this.coins = save.coins;     // Münzen bleiben gespeichert (localStorage)
    ui.setCoins(this.coins);
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
    // eingebettete Perlen / Goldflocken auf der fertigen Seife (Kinder der Seife -> wandern mit ins Päckchen)
    this.pearlMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 18, 12), new THREE.MeshPhysicalMaterial({ color: '#fbf6ee', roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08,
      iridescence: 1, iridescenceIOR: 1.6, iridescenceThicknessRange: [180, 520], sheen: 0.6, sheenColor: 0xfff2f6, envMapIntensity: 1.6 }), 48);
    this.flakeMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 6), new THREE.MeshStandardMaterial({ color: '#e5c25c', roughness: 0.28, metalness: 1 }), 48);
    for (const m of [this.pearlMesh, this.flakeMesh]) { m.count = 0; m.frustumCulled = false; this.bar.add(m); }
    this.showcase = new Showcase(scene);

    // Klick-Geräusch, wenn Würfel landen
    this.onCube = (x, y, z, r, g, b, id) => loose.spawn(x, y, z, r, g, b, id);

    // Bestell-Zettel am mittleren Brett + Seifenschrank
    this.notes = new OrderNotes(scene);
    for (let i = 0; i < NOTE_COUNT; i++) this.notes.set(i, makeOrder({ first: i === 0, avoid: this.noteNames(), avoidRecipes: this.noteRecipes() }));
    this.activeNote = -1;
    this.order = null;
    this.picked = new Set(); this.pickedDrawers = new Set(); this.stocked = false;
    this.cabLayout = cabinetLayout();
    this.toChoose();
  }

  noteRecipes() { return this.notes ? this.notes.orders.filter(Boolean).map((o) => o.mix.map((m) => m.soap.id + ':' + m.pct).join('+')) : []; }
  noteNames() { return this.notes ? this.notes.orders.filter(Boolean).map((o) => o.customer) : []; }

  /** Keine Bestellung aktiv: Spieler wählt einen Zettel am Regal. */
  toChoose() {
    this.state = 'choose';
    this.order = null;
    this.cutIds.clear();
    this.ui.setOrder(null);
    this.ui.setCut(null);
    this.shelf.setSoaps([]);
    this.ui.hint('Wähle eine Bestellung am Regal');
    this.ui.actions([]);
  }

  /** Zettel i groß öffnen; annehmen nur, wenn gerade keine Bestellung läuft. */
  openNote(i) {
    const o = this.notes.orders[i];
    if (!o) return;
    haptic(6);
    this.ui.openNote(o, this.state === 'choose' && !this.order, () => this.acceptOrder(i), { stockOf: this.stockOf });
  }

  acceptOrder(i) {
    if (this.state !== 'choose') return;
    this.order = this.notes.orders[i];
    this.activeNote = i;
    this.notes.setActive(i, true);
    this.cutIds.clear();
    this.picked.clear(); this.pickedDrawers.clear(); this.stocked = false;
    this.additives = []; this.warnedAdd = false;
    this.ui.setOrder(this.order);
    this.refreshMix();
    sndPop();
    this.toShelf();
  }

  /** Antippen des Wandschranks: Tipp oberhalb seiner Unterkante, zwischen seinen Seiten (nur beim Tippen). */
  hitCabinet() {
    const C = CABINET;
    _a.set(C.x - C.w / 2, C.bottom, SHELF_FRONT_Z + 0.06).project(this.camera);
    _b.set(C.x + C.w / 2, C.bottom, SHELF_FRONT_Z + 0.06).project(this.camera);
    return this.tapNdc.y > Math.min(_a.y, _b.y) - 0.02 && this.tapNdc.x > _a.x && this.tapNdc.x < _b.x;
  }

  /** Anteile in der Form neu zählen (Prozent der Form je Sorte) und im Zettel anzeigen. */
  refreshMix() {
    if (!this.order) return;
    const c = this.loose.typeCounts;
    let fill = 0;
    for (const s of SOAP_BY_ID) { const p = c[s.id] * 100 / MOULD_CUBES; this.pcts[s.id] = p; fill += p; }
    this.fillPct = fill;
    this.ui.setMix(this.order, this.pcts, fill, this.additives, this.stockOf);
  }

  /** Sorten der Bestellung, von denen noch deutlich zu wenig in der Form ist. */
  missingSoaps() { return this.order ? this.order.mix.filter((m) => (this.pcts[m.soap.id] || 0) < m.pct - 4).map((m) => m.soap) : []; }

  /** Scheiben in Schublade d (jede Sorte hat 3 Schubladen à max. 10 Scheiben, gefüllt der Reihe nach). */
  drawerStock(d) {
    const same = this.cabLayout.filter((x) => x.kind === 'soap' && x.soap === d.soap);
    const k = same.indexOf(d);
    return Math.max(0, Math.min(BAR_SLICES, save.stock(d.soap.id) - k * BAR_SLICES));
  }

  /** Neues Stück einer Sorte kaufen (10 Scheiben). */
  offerRestock(soap, after) {
    const S = save.stock(soap.id);
    if (S > STOCK_MAX - BAR_SLICES) { this.ui.popup('Schublade ist voll'); return; }
    const c = document.createElement('canvas'); c.width = c.height = 120;
    const g = c.getContext('2d'); g.fillStyle = `rgb(${soap.base.map((v) => Math.round(v * 255)).join(',')})`;
    g.beginPath(); g.roundRect(20, 30, 80, 60, 14); g.fill(); g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.roundRect(28, 38, 64, 10, 5); g.fill();
    // nie festsitzen: wer kein Geld hat, bekommt das Stück geschenkt
    const cost = this.coins >= BAR_PRICE ? BAR_PRICE : 0;
    this.ui.openUnlock({ thumb: c.toDataURL(), name: `${soap.emoji} ${soap.name} – neues Stück`, cost, bonus: 0 }, this.coins, () => {
      this.coins -= cost; save.coins = this.coins; this.ui.setCoins(this.coins, true);
      save.setStock(soap.id, S + BAR_SLICES);
      if (after) after();
      return true;
    }, { line: `+${BAR_SLICES} Scheiben (Vorrat jetzt ${S})` + (cost ? '' : ' · ein Geschenk'), verb: cost ? 'Kaufen' : 'Mitnehmen' });
  }

  /** Vollbild-Schrank: alle Seifen der Bestellung in den Schubladen finden. */
  openCabinet() {
    const back = this.state;
    this.state = 'cabinet';
    haptic(8);
    const o = this.order;
    const findText = () => {
      if (!o) return 'Nimm zuerst eine Bestellung an';
      const rest = o.soaps.filter((s) => !this.picked.has(s.id));
      return rest.length ? `Gesucht: ${rest.map((s) => s.name).join(', ')}` : 'Alles beisammen';
    };
    this.ui.hint('');
    this.ui.openCabinet(this.cabLayout, findText(), (d) => !!o && this.stocked === false && d.kind === 'soap' && this.picked.has(d.soap.id) && this.pickedDrawers.has(d), (d) => {
      if (d.kind === 'locked') return 'Noch gesperrt';
      // leere Schublade: neues Stück nachkaufen (geht immer, auch ohne Bestellung)
      if (d.kind === 'soap' && this.drawerStock(d) === 0) {
        this.offerRestock(d.soap, () => { this.ui.refreshCabinet(); this.refreshMix(); });
        return { refresh: true };
      }
      if (d.kind === 'empty') return 'Leer';
      if (!o) return 'Nimm zuerst eine Bestellung an';
      if (this.stocked) return 'Die Seifen stehen schon im Regal';
      if (!o.soaps.includes(d.soap)) return 'Nicht in der Bestellung';
      if (this.picked.has(d.soap.id)) return 'Bereits ausgewählt';
      this.picked.add(d.soap.id); this.pickedDrawers.add(d);
      sndPop(); haptic(12);
      const all = o.soaps.every((s) => this.picked.has(s.id));
      return { find: findText(), done: all ? () => this.stockShelf() : null };
    }, () => { if (back === 'choose') this.toChoose(); else this.toShelf(); }, (d) => this.drawerStock(d));
  }

  /** Alle gefundenen Seifen fliegen (nacheinander) von oben auf das mittlere Brett und stellen sich auf. */
  stockShelf() {
    this.state = 'stocking';
    this.stocked = true;
    const list = this.order.soaps;
    this.shelf.setSoaps(list, this.shelfFracs());
    const home = this.shelf.home, n = list.length;
    for (let i = 0; i < n; i++) this.shelf.hide(i);
    this.play(0.5 + n * 0.12, (e) => {
      const T = e * (0.5 + n * 0.12);
      for (let i = 0; i < n; i++) {
        const t = Math.min(1, Math.max(0, (T - i * 0.12) / 0.5));
        if (t <= 0) continue;
        const k = easeOut(t);
        _t.copy(home[i]); _t.y += (1 - k) * 0.9 + Math.sin(t * Math.PI) * 0.06;
        this.shelf.place(i, _t, 0.36 * (0.4 + 0.6 * k));
      }
    }, () => { this.shelf.setSoaps(list, this.shelfFracs()); sndPop(); this.toShelf(); }, (t) => t);
  }

  /** Länge der Seifenstücke im Regal: so viele Scheiben, wie das nächste Stück hat (Rest aus dem Vorrat). */
  shelfFracs() { return this.order.soaps.map((s) => Math.min(SLICES, save.stock(s.id)) / SLICES); }

  // ---------- Zustandswechsel ----------
  toShelf() {
    this.state = 'shelf';
    this.ui.setCut(null);
    this.knife.visible = false;
    this.refreshMix();
    const missing = this.missingSoaps();
    if (!this.stocked) this.ui.hint('Hol die Seifen aus dem Schrank');
    else if (missing.length) {
      const m = this.order.mix.find((x) => x.soap === missing[0]);
      this.ui.hint(`${m.soap.name}: ${m.pct / PCT_PER_SLICE} Scheiben für ${m.pct} % – tippe aufs Stück`);
    } else this.ui.hint(this.order.additive && !this.additives.includes(this.order.additive) ? `Fast fertig – noch ${this.order.additive.name} hinzufügen` : 'Die Mischung stimmt – jetzt schmelzen');
    const acts = [];
    if (this.stocked) acts.push({ label: '✨ Zusätze', onClick: () => this.openAdditives() });
    if (this.loose.used > 0) acts.push({ label: '🔥 Schmelzen', alt: true, onClick: () => this.toOven() });
    this.ui.actions(acts);
  }

  /** Seife im Regal angetippt: sie fliegt über die Schale, dann geht das Schneiden los. */
  pickSoap(slot) {
    if (this.state !== 'shelf') return;
    const soap = this.shelf.soaps[slot];
    if (save.stock(soap.id) <= 0) {
      this.ui.hint(`${soap.name} ist aufgebraucht – hol ein neues Stück aus dem Schrank`);
      return;
    }
    this.state = 'flying';
    this.ui.actions([]);
    this.ui.hint('');
    haptic(8);
    this.shelf.launch(slot, () => this.startCutting(soap));
  }

  startCutting(soap) {
    this.state = 'cutting';
    const m = this.order.mix.find((x) => x.soap === soap);
    const have = Math.round(this.pcts[soap.id] || 0);
    this.ui.hint(m ? `Noch ${m.pct / PCT_PER_SLICE - Math.round(have / PCT_PER_SLICE)} Scheiben ${soap.name} – sanft hin und her wischen` : 'Sanft hin und her wischen');
    this.block.load(soap, Math.min(SLICES, save.stock(soap.id)));
    this.ui.actions([{ label: '✋ Fertig mit dieser Seife', onClick: () => this.stopCutting() }]);
    this.loose.blockHalfX = this.block.halfX; this.loose.blockHalfZ = this.block.halfZ;
    this.loose.blockTop = this.block.topY;
    this.knife.visible = true;
    this.knifeY = this.block.topY + 0.6;
    this.knifeZ = this.block.cutZ;
    this.sliceProgress = 0; this.returning = false; this.slicesCut = 0;
    this.loose.blockTop = -1; // Würfel fallen vorne weg, keine Kollision mit der Blockoberseite nötig
    haptic(8);
  }

  /**
   * Schneiden beenden (Knopf oder Stück ist alle). Verbrauchte Scheiben gehen vom Vorrat ab;
   * eine angefangene Scheibe zählt als verbraucht (der Rest davon ist Verschnitt). Der Rest des
   * Stücks bleibt im Vorrat (im Regal sichtbar kürzer) für diese und spätere Bestellungen.
   */
  stopCutting() {
    if (this.state !== 'cutting') return;
    const soap = this.block.soap;
    const used = this.slicesCut + (this.block.rowsCut > 0 ? 1 : 0);
    save.setStock(soap.id, save.stock(soap.id) - used);
    this.block.mesh.visible = false;
    this.block.slice = -1;
    this.loose.blockTop = -1;
    this.knife.visible = false;
    this.ui.actions([]);
    this.refreshMix();
    const p = Math.round(this.pcts[soap.id] || 0);
    if (used) { this.confetti.burst(0, BLOCK_BASE_Y + 0.2, 0.3, 60); this.ui.popup(`${soap.emoji} ${p} %`); }
    sndPop(); haptic(20);
    this.shelf.setSoaps(this.order.soaps, this.shelfFracs());
    this.state = 'between';
    setTimeout(() => this.toShelf(), 600);
  }

  // ---------- Zusätze ----------
  openAdditives() {
    if (this.state !== 'shelf') return;
    this.state = 'addSheet';
    const need = this.order && this.order.additive;
    const items = ADDITIVES.slice().sort((a, b) => ADD_CATS.indexOf(a.cat) - ADD_CATS.indexOf(b.cat)).map((a) => ({
      id: a.id, name: a.name, cat: a.cat, thumb: additiveThumb(a), unlocked: a.unlocked, cost: a.cost, bonus: a.bonus,
      sub: (this.additives.includes(a) ? '✔ enthalten' : `+${a.bonus} 🪙`) + (need === a ? ' · gewünscht' : ''),
      disabled: !this.additives.includes(a) && this.additives.length >= MAX_ADDITIVES ? `Höchstens ${MAX_ADDITIVES} Zusätze` : null,
      add: a,
    }));
    this.ui.openSheet(items, {
      title: 'Zusätze', cats: ADD_CATS, startCat: need ? need.cat : null, coins: () => this.coins,
      onBuy: (x) => this.buy(x.cost, 'add:' + x.id, () => { x.add.unlocked = true; }),
      onSelect: (x) => { this.state = 'shelf'; this.toggleAdditive(x.add); },
      onClose: () => { this.state = 'shelf'; this.toShelf(); },
    });
  }

  toggleAdditive(a) {
    const i = this.additives.indexOf(a);
    if (i >= 0) { this.additives.splice(i, 1); this.ui.popup(`${a.name} entfernt`); }
    else {
      this.additives.push(a);
      this.confetti.burst(0, 0.7, 0.2, 40);
      this.ui.popup(`+ ${a.emoji} ${a.name}`);
      sndPop(); haptic(12);
    }
    this.toShelf();
  }

  toOven() {
    // gewünschter Zusatz fehlt noch? Einmal freundlich daran erinnern (Auswahl geht auf)
    const need = this.order && this.order.additive;
    if (need && !this.additives.includes(need) && !this.warnedAdd && this.state === 'shelf') {
      this.warnedAdd = true;
      this.ui.hint(`${this.order.customer} wünscht sich ${need.name} – oder direkt schmelzen`);
      this.openAdditives();
      return;
    }
    this.refreshMix();
    this.quality = this.rateMix();
    this.state = 'oven';
    this.ovenT = 0;
    this.ui.actions([]);
    this.ui.showOven(true);
    this.ui.hint('Die Seife schmilzt …');
    // Marmor aus den Anteilen der Würfel in der Schale
    const parts = [];
    const counts = this.loose.typeCounts;
    for (const s of SOAP_BY_ID) if (counts[s.id] > 0) {
      parts.push({ rgb: s.base, w: counts[s.id] });
    }
    // Farben abwechselnd mischen, damit Adern verschiedener Sorten nebeneinander liegen
    parts.sort((a, b) => (a.rgb[0] + a.rgb[2]) - (b.rgb[0] + b.rgb[2]));
    // Zusätze: Tönung + Sprenkel in die Textur, Glanz ins Material
    const fx = { tint: [], specks: [] };
    let sheen = 0;
    for (const a of this.additives) {
      if (a.fx.tint) fx.tint.push(a.fx.tint);
      if (a.fx.specks) fx.specks.push(a.fx.specks);
      sheen += a.fx.sheen || 0;
    }
    if (this.barMat.map) this.barMat.map.dispose();
    this.barMat.map = makeMarbleTexture(parts, 256, fx);
    this.barMat.roughness = Math.max(0.12, 0.35 - sheen);
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
    this.ui.hint('Geschmolzen – bereit zum Ausformen');
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
    const q = this.quality || this.rateMix();
    this.price = q.price;
    this.buildBarBits();
    this.ui.showQuality(q);
    this.ui.hint((q.stars === 3 ? 'Perfekt' : q.stars === 2 ? 'Eine schöne Seife' : 'Fast') + ' – dreh sie mit dem Finger');
    this.showcase.start(this.bar);
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

  /**
   * Bewertung der Mischung: Abweichung je Sorte (Prozentpunkte der Form, also auch zu wenig/zu viel
   * Füllung) -> Genauigkeit 0..100, Sterne und Preis-Faktor. Fremde Sorten zählen voll als Abweichung.
   */
  rateMix() {
    const o = this.order, rows = [];
    let dev = 0;
    for (const m of o.mix) {
      const a = this.pcts[m.soap.id] || 0, d = Math.abs(a - m.pct);
      dev += d;
      rows.push({ label: `${m.soap.emoji} ${m.soap.name}`, value: `${Math.round(a)} % / ${m.pct} %`, cls: d <= 5 ? 'good' : d > 12 ? 'bad' : '' });
    }
    for (const s of SOAP_BY_ID) if (!o.mix.some((m) => m.soap === s) && this.pcts[s.id] > 0.5) dev += this.pcts[s.id];
    const accuracy = Math.max(0, Math.round(100 - dev));
    const stars = accuracy >= 90 ? 3 : accuracy >= 70 ? 2 : 1;
    const fill = Math.round(this.fillPct || 0);
    rows.push({ label: '🫙 Form', value: `${fill} % voll`, cls: Math.abs(fill - 100) <= 5 ? 'good' : Math.abs(fill - 100) > 15 ? 'bad' : '' });
    let price = Math.round(o.reward * [0, 0.7, 1, 1.25][stars]);
    if (o.additive) {
      const ok = this.additives.includes(o.additive);
      rows.push({ label: `${o.additive.emoji} ${o.additive.name}`, value: ok ? '✔ wie gewünscht' : 'fehlt · −20 %', cls: ok ? 'good' : 'bad' });
      if (!ok) price = Math.round(price * 0.8);
    }
    let extra = 0;
    for (const a of this.additives) extra += a.bonus;
    if (extra) rows.push({ label: '✨ Zusätze', value: `+${extra} 🪙`, cls: 'good' });
    price += extra;
    rows.push({ label: 'Preis', value: `${price} 🪙` });
    return { accuracy, stars, price, rows, fill };
  }

  /** Perlen / Goldflocken auf der fertigen Seife verteilen (einmal beim Ausformen). */
  buildBarBits() {
    const pearls = this.additives.find((a) => a.fx.pearls), flakes = this.additives.find((a) => a.fx.flakes);
    const put = (mesh, n, make) => {
      mesh.count = 0;
      for (let i = 0; i < n; i++) { make(i, _m4); mesh.setMatrixAt(mesh.count++, _m4); }
      mesh.instanceMatrix.needsUpdate = true;
    };
    // Seife: 1.0 x 0.36 x 0.66, Rundung 0.1 -> Teile nur auf den flachen Bereichen von Oberseite und Vorderseite
    const spot = (i, onTop, out, nrm) => {
      if (onTop) { out.set((Math.random() - 0.5) * 0.78, 0.18, (Math.random() - 0.5) * 0.44); nrm.set(0, 1, 0); }
      else { out.set((Math.random() - 0.5) * 0.78, (Math.random() - 0.5) * 0.14, 0.33); nrm.set(0, 0, 1); }
    };
    put(this.pearlMesh, pearls ? pearls.fx.pearls.n : 0, (i, m) => {
      const r = 0.026 + Math.random() * 0.012;
      spot(i, Math.random() < 0.72, _a, _b);
      _a.addScaledVector(_b, -r * 0.35);           // halb eingebettet
      m.compose(_a, _qq.identity(), _t.set(r, r, r));
    });
    put(this.flakeMesh, flakes ? flakes.fx.flakes.n : 0, (i, m) => {
      const r = 0.018 + Math.random() * 0.022;
      spot(i, Math.random() < 0.75, _a, _b);
      _qq.setFromUnitVectors(_up, _b);
      _qq.multiply(_qq2.setFromAxisAngle(_up, Math.random() * 6.283));
      _qq.multiply(_qq2.setFromAxisAngle(_side, (Math.random() - 0.5) * 0.5));
      m.compose(_a, _qq, _t.set(r, 0.003, r * (0.5 + Math.random() * 0.5)));
    });
  }

  /** "Verkaufen": Schale verschwindet, die fertige Seife legt sich auf den Tisch. */
  sell() {
    if (this.state !== 'unmolded') return;
    this.showcase.stop();
    this.ui.showQuality(null);
    if (this.quality) this.ui.setMixSummary(this.quality);
    this.state = 'toTable';
    document.body.classList.add('table-mode');
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
      this.ui.hint('Wähle eine Verpackung im Regal');
    });
  }

  /** Auswahlfenster mit allen Päckchen-Sorten (Spiel-Taps sind solange pausiert). */
  openPicker() {
    this.state = 'picker';
    const thumbs = this.packages.makeThumbs(this.renderer);
    const items = this.packages.types.map((t, i) => ({ id: t.id, name: t.name, cat: t.cat, thumb: thumbs[i], unlocked: t.unlocked,
      cost: t.cost, bonus: t.bonus, sub: t.bonus ? `+${t.bonus} 🪙` : 'Standard', type: t }));
    this.ui.openSheet(items, {
      title: 'Verpackung', cats: PKG_CATS,
      coins: () => this.coins,
      onBuy: (it) => this.buy(it.cost, 'pkg:' + it.id, () => { it.type.unlocked = true; }),
      onSelect: (it) => {
        this.state = 'pickPkg';
        this.pkgType = it.type;
        this.flyPackage(this.packages.slotOf(it.id));
      },
      onClose: () => { if (this.state === 'picker') this.state = 'pickPkg'; },
    });
  }

  /** Freischalten mit Münzen (Päckchen und Deko); wird gespeichert. */
  buy(cost, key, apply) {
    if (this.coins < cost) return false;
    this.coins -= cost; save.coins = this.coins; save.unlock(key);
    apply();
    this.ui.setCoins(this.coins, true);
    return true;
  }

  /** Kontaktschatten des Päckchens auf dem Tisch an Position x/z (0 = ausblenden). */
  pkgShadow(i, x, z) {
    const [fw, fd] = this.packages.footprint(i);
    this.packages.setBlob(i, x, TABLE_Y + 0.003, z, fw * 1.45, fd * 1.6);
  }

  lidShadow(show) {
    const L = TABLE_SPOT.lid, [fw, fd] = this.packages.footprint(this.pkgSlot);
    if (show) this.packages.setBlob(SHADOW_LID, L.x, TABLE_Y + 0.004, L.z, (fw + 2 * PKG.lidPad) * 1.35, (fd + 2 * PKG.lidPad) * 1.5, TABLE_SPOT.lidRy);
    else this.packages.setBlob(SHADOW_LID, 0, 0, 0, 0, 0);
  }

  /** Päckchen fliegt vom Regal auf den Tisch; der Deckel geht ab und liegt flach vorne daneben. */
  flyPackage(i) {
    this.state = 'packing';
    this.pkgSlot = i;
    this.ui.hint('');
    this.packages.setActive(i);
    this.packages.onShelf[i] = 0;
    this.packages.update(0, -1);
    this.packages.setBlob(i, 0, 0, 0, 0, 0);
    const from = this.packages.home[i], to = TABLE_SPOT.pkg, lidTo = TABLE_SPOT.lid;
    haptic(8);
    this.play(0.6, (e, t) => {
      _a.lerpVectors(from, to, e); _a.y += Math.sin(t * Math.PI) * 0.6;
      this.packages.setClosed(i, _a, 0, PKG_SHELF_SCALE + (1 - PKG_SHELF_SCALE) * e);
    }, () => {
      this.pkgShadow(i, to.x, to.z);
      sndPop();
      // Deckel abheben und mit Abstand flach vorne neben das Päckchen legen
      _b.copy(to); _b.y += this.packages.lidY;
      const lid0 = _b.clone();
      this.play(0.55, (e, t) => {
        _a.lerpVectors(lid0, lidTo, e); _a.y += Math.sin(t * Math.PI) * 0.45;
        this.packages.setLid(i, _a, Math.sin(t * Math.PI) * 0.35, TABLE_SPOT.lidRy * e, 0, 1);
      }, () => {
        this.lidShadow(true);
        this.state = 'pickSoap';
        this.barBaseY = this.bar.position.y;
        this.ui.hint('Tippe auf die Seife, um sie einzupacken');
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
    const p0 = TABLE_SPOT.soap, to = TABLE_SPOT.pkg, fit = this.packages.fit(i);
    const ry0 = bar.rotation.y, ry1 = Math.round(ry0 / Math.PI) * Math.PI;
    this.packages.setBlob(SHADOW_SOAP, 0, 0, 0, 0, 0);
    haptic(8);
    // Seife passt sich der Form an (Herz/rund: etwas kleiner, im Herz weiter hinten)
    this.play(0.6, (e, t) => {
      const sc = BAR_TABLE_SCALE * (1 + (fit.s - 1) * e);
      bar.scale.set(sc, sc, sc);
      bar.position.set(p0.x + (to.x - p0.x) * e, TABLE_Y + BAR_HALF_H * sc / BAR_TABLE_SCALE + PKG.wall * e + Math.sin(t * Math.PI) * 0.7, p0.z + (to.z + fit.dz - p0.z) * e);
      bar.rotation.set(Math.sin(t * Math.PI) * 0.25, ry0 + (ry1 - ry0) * e, 0);
    }, () => {
      sndPop();
      this.toDecorFill();
    });
  }

  // ---------- Dekorieren ----------
  /** Seife liegt im offenen Päckchen: Füllungen/Perlen/Blüten aus dem unteren Regal hineinziehen. */
  toDecorFill() {
    this.state = 'decorFill';
    this.deco.customer = this.order ? this.order.customer : '';
    this.armed = null;
    this.ui.hint('Zeit für Dekoration – wähle sie im Regal');
    this.decoActions();
  }

  decoActions() {
    const acts = [];
    const phase = this.state === 'decorFill' ? 'fill' : 'lid';
    if (this.deco.applied.some((it) => phaseOf(it) === phase)) acts.push({ label: '↶ Rückgängig', onClick: () => this.undoDeco(phase) });
    if (this.state === 'decorFill') acts.push({ label: 'Deckel drauf', alt: true, onClick: () => this.closeLid() });
    this.ui.actions(acts);
    this.ui.setDeco(this.deco.bonus);
  }

  undoDeco(phase) {
    if (this.drag || this.deco.busy) return;
    const it = this.deco.undo(phase, phaseOf);
    if (it) { sndPop(); this.ui.popup(`${it.name} entfernt`); }
    this.decoActions();
  }

  closeLid(then) {
    if (this.state !== 'decorFill' || this.drag || this.deco.busy) return;
    this.state = 'packing';
    this.armed = null;
    this.ui.actions([]);
    this.ui.hint('');
    const i = this.pkgSlot, to = TABLE_SPOT.pkg;
    const lidFrom = TABLE_SPOT.lid;
    _b.copy(to); _b.y += this.packages.lidY;
    const lidTo = _b.clone();
    this.lidShadow(false);
    this.play(0.5, (e, t) => {
      _a.lerpVectors(lidFrom, lidTo, e); _a.y += Math.sin(t * Math.PI) * 0.5;
      this.packages.setLid(i, _a, Math.sin(t * Math.PI) * 0.35, TABLE_SPOT.lidRy * (1 - e), 0, 1);
    }, () => {
      this.bar.visible = false;
      sndPop(); haptic(15);
      this.state = 'packed';
      this.ui.hint('Jetzt Schleife oder Anhänger – unten im Regal');
      this.decoActions();
      if (then) then();
    });
  }

  /** Für Tests: Bildschirm-Pixel einer Deko-Stelle im Regal bzw. des Päckchens auf dem Tisch. */
  testPx(what) {
    const s = DECO_SPOTS.find((d) => d.group === what);
    if (s) _t.set(s.x, DECO_Y + 0.06, SHELF_Z); else _t.copy(TABLE_SPOT.pkg).setY(TABLE_Y + 0.3);
    _t.project(this.camera);
    return { x: (_t.x + 1) / 2 * window.innerWidth, y: (1 - _t.y) / 2 * window.innerHeight };
  }

  /** Antippen des unteren Regals: welche Deko-Gruppe? (nur beim Tippen) */
  pickDecoShelf() {
    let best = null, bd = 0.1 * 0.1;
    for (const s of DECO_SPOTS) {
      _t.set(s.x, DECO_Y + 0.06, SHELF_Z).project(this.camera);
      const dx = _t.x - this.tapNdc.x, dy = (_t.y - this.tapNdc.y) * 0.7, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = s.group; }
    }
    return best;
  }

  /** Warum diese Deko gerade nicht geht (oder null). */
  decoBlocked(it) {
    const ph = phaseOf(it);
    if (ph === 'fill' && this.state === 'packed') return 'Der Deckel ist schon zu';
    if (ph === 'fill') {
      if (this.deco.countOf(it) >= FILL_CAP) return 'Davon ist genug drin';
      const kinds = this.deco.applied.filter((x) => phaseOf(x) === 'fill');
      if (!kinds.includes(it) && kinds.length >= FILL_MAX_KINDS) return `Höchstens ${FILL_MAX_KINDS} Füllungen`;
    }
    return null;
  }

  /** Auswahl einer Deko-Gruppe (wie bei den Päckchen); Reiter zeigen die Nachbar-Gruppen. */
  openDecoSheet(groupId) {
    const back = this.state;
    const phase = groupOf(groupId).phase;
    const thumbs = this.deco.makeThumbs(this.renderer, DECO_ITEMS);
    const items = DECO_ITEMS.filter((it) => phaseOf(it) === phase).map((it) => ({
      id: it.id, name: it.name, cat: groupOf(it.group).name, thumb: thumbs[it.id], unlocked: it.unlocked, cost: it.cost, bonus: it.bonus,
      sub: (this.deco.has(it) ? '✔ ' : '') + `+${it.bonus} 🪙`, disabled: this.decoBlocked(it), item: it,
    }));
    this.state = 'decoSheet';
    this.armed = null;
    this.ui.openSheet(items, {
      title: groupOf(groupId).name, cats: DECO_GROUPS.filter((g) => g.phase === phase).map((g) => g.name), startCat: groupOf(groupId).name,
      coins: () => this.coins,
      onBuy: (x) => this.buy(x.cost, 'deco:' + x.id, () => { x.item.unlocked = true; }),
      onSelect: (x) => { this.state = back; this.autoPlace(x.item); },
      onHold: (x, ev) => { this.state = back; this.startDrag(x.item, ev); },
      onClose: () => { this.state = back; },
    });
  }

  /**
   * Deko angetippt: fliegt von selbst aufs Paket (Ziehen mit gehaltenem Finger geht weiterhin).
   * Schleife/Anhänger bei offenem Paket: erst Deckel automatisch drauf, dann draufsetzen.
   */
  autoPlace(item) {
    if (this.drag || this.deco.busy) return;
    if (phaseOf(item) === 'lid' && this.state === 'decorFill') { this.closeLid(() => this.autoPlace(item)); return; }
    const why = this.decoBlocked(item);
    if (why) { this.ui.hint(why); return; }
    _dragPos.copy(TABLE_SPOT.pkg); _dragPos.y = TABLE_Y + 0.75; _dragPos.z += 0.15;
    this.deco.beginHand(item, _dragPos);
    this.deco.drop(() => { sndPop(); haptic(10); this.ui.popup(`+${item.bonus} 🪙 ${item.name}`); this.decoActions(); });
    this.ui.hint(this.state === 'decorFill' ? 'Mehr Deko – oder Deckel drauf' : 'Mehr Deko – oder zum Versenden zur Seite wischen');
  }

  /** Deko gewählt (angetippt): beim nächsten Drücken schwebt sie unter dem Finger. */
  arm(item) {
    this.armed = item;
    this.ui.hint(`${item.name} – halten und aufs Paket ziehen`);
  }

  startDrag(item, e) {
    this.armed = null;
    this.drag = { item, id: e.pointerId, x: e.clientX, y: e.clientY };
    this.swipe.active = false;
    this.dragTarget(_dragPos);
    this.deco.beginHand(item, _dragPos);
    haptic(8);
    this.ui.hint('Über dem Paket loslassen');
  }

  /** Zielpunkt der schwebenden Deko: etwas über dem Finger, auf einer Ebene über dem Tisch. */
  dragTarget(out) {
    const W = window.innerWidth, H = window.innerHeight;
    _ndc.set(this.drag.x / W * 2 - 1, -((this.drag.y - DRAG_LIFT) / H) * 2 + 1);
    _ray.setFromCamera(_ndc, this.camera);
    if (!_ray.ray.intersectPlane(_dragPlane, out)) out.copy(TABLE_SPOT.pkg);
    return out;
  }

  dragMove(e) {
    if (e.pointerId !== this.drag.id) return;
    this.drag.x = e.clientX; this.drag.y = e.clientY;
  }

  dragEnd(e, cancel) {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    this.drag = null;
    const P = TABLE_SPOT.pkg, [fw, fd] = this.packages.footprint(this.pkgSlot), hp = this.deco.handPos;
    const over = !cancel && Math.abs(hp.x - P.x) < fw / 2 + 0.22 && Math.abs(hp.z - P.z) < fd / 2 + 0.3;
    if (over && phaseOf(d.item) === 'lid' && this.state === 'decorFill') {
      this.deco.endHand(); this.closeLid(() => this.autoPlace(d.item)); return;
    }
    const why = this.decoBlocked(d.item);
    if (over && !why) {
      this.deco.drop(() => { sndPop(); haptic(10); this.ui.popup(`+${d.item.bonus} 🪙 ${d.item.name}`); this.decoActions(); });
      this.ui.hint(this.state === 'decorFill' ? 'Mehr Deko – oder Deckel drauf' : 'Zum Versenden zur Seite wischen');
    } else {
      this.deco.fallAway();
      this.ui.hint(why || (this.state === 'decorFill' ? 'Über dem offenen Paket loslassen' : 'Über dem Paket loslassen'));
    }
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
    this.pkgShadow(this.pkgSlot, _a.x, _a.z);
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
      this.pkgShadow(this.pkgSlot, _a.x, _a.z);
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
      this.pkgShadow(i, _a.x, _a.z);
    }, () => {
      this.packages.hide(i);
      const earned = this.price + (this.pkgType ? this.pkgType.bonus : 0) + this.deco.bonus;
      this.lastEarned = earned;
      this.deco.reset(); this.ui.setDeco(0);
      this.additives = []; this.quality = null;
      this.coins += earned; save.coins = this.coins;
      this.ui.setCoins(this.coins, true);
      sndCoin(); haptic(20);
      const db = earned - this.price - (this.pkgType ? this.pkgType.bonus : 0);
      this.ui.popup(db > 0 ? `+${earned} 🪙 (Deko +${db})` : `+${earned} 🪙`);
      // Schale kommt zurück, Päckchen wieder ins Regal, neue Bestellung
      this.bowl.visible = true; this.bowlShadow.visible = true;
      this.play(0.45, (e) => {
        const k = Math.max(0.001, e);
        this.bowl.scale.set(k, k, k); this.bowl.position.y = -0.25 * (1 - e);
        this.bowlShadow.scale.set(k, k, k);
      }, null, easeOut);
      this.packages.reset();
      document.body.classList.remove('table-mode');
      // fertiger Zettel verschwindet, ein neuer klappt an seinem Platz herunter
      const ni = this.activeNote;
      this.activeNote = -1;
      if (ni >= 0) {
        this.notes.set(ni, null);
        this.order = null;
        setTimeout(() => this.notes.set(ni, makeOrder({ avoid: this.noteNames(), avoidRecipes: this.noteRecipes() }), { animate: true }), 450);
      }
      this.toChoose();
    }, (t) => t * t);
  }

  // ---------- pro Frame ----------
  update(dt, time) {
    // nächste gewünschte Seife im Regal hüpft leicht (zeigt: hier antippen)
    let bob = -1;
    if (this.state === 'shelf') {
      const list = this.shelf.soaps;
      // erste Sorte, von der noch deutlich zu wenig drin ist (ohne Allokation)
      const mix = this.order ? this.order.mix : null;
      if (mix) for (let k = 0; k < mix.length && bob < 0; k++) if ((this.pcts[mix[k].soap.id] || 0) < mix[k].pct - 4) bob = list.indexOf(mix[k].soap);
    }
    this.shelf.update(dt, time, bob);
    this.notes.update(dt, time, this.state === 'choose');
    // schwebende Deko folgt dem Finger (geglättet) und schaukelt leicht
    if (this.drag) {
      this.dragTarget(_dragTarget);
      _dragPos.lerp(_dragTarget, 1 - Math.exp(-16 * dt));
      this.deco.moveHand(_dragPos, time);
    }
    this.deco.update(dt);
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
    this.refreshMix();   // Mischungs-Balken live (DOM nur bei Änderung)
    this.knife.position.set(this.knifeX, this.knifeY, this.knifeZ);
    this.knife.rotation.z = this.knifeTilt;
  }

  completeSlice() {
    const done = this.block.finishSlice(this.onCube);
    this.slicesCut++;
    sndCut(); haptic(12);
    if (this.slicesCut === 1) this.ui.hint('');
    if (this.slicesCut % 2 === 0 || done) this.ui.popup();
    if (done) { this.stopCutting(); return; }
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

  /** Präsentation: fertige Seife steigt in die Bildmitte, Licht + Funkeln, mit dem Finger drehbar. */
  updateBar(dt, time) {
    this.barT = Math.min(1, this.barT + dt * 1.3);
    const e = 1 - Math.pow(1 - this.barT, 3);
    const s = 0.6 + 0.65 * e + Math.sin(this.barT * Math.PI) * 0.08;
    this.bar.scale.set(s, s, s);
    const y = 0.25 + e * 1.05 + Math.sin(time * 1.6) * 0.025 * e;
    this.bar.position.set(0, y, 0.1);
    const sc = this.showcase;
    sc.update(dt, time, 0, y, 0.1);
    this.bar.rotation.set(sc.pitch * e, sc.yaw, 0, 'YXZ');
  }
}
