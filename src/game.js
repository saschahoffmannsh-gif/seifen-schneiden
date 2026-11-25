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
import { sndCut, sndPaper, sndDrawer, sndStack, sndWood, sndThump, sndGlass, sndCeramic, sndCardboard, sndLid, sndFabric, sndCoins, sndCreak, sndSlide, haptic } from './audio.js';
import { SHELF_SCALE } from './shelfSoaps.js';
import { PKG, TABLE_SPOT, PKG_SHELF_SCALE, SHADOW_SOAP, SHADOW_LID } from './packages.js';
import { TABLE_Y, CABINET, SHELF_FRONT_Z } from './setting/wall.js';
import { OrderNotes, NOTE_COUNT } from './orderNotes.js';
import { barsNeeded, makeOrder, orderSorts, setItem, slicesNeeded } from './orders.js';
import { ADDITIVES, ADD_CATS, MAX_ADDITIVES, additiveThumb } from './additives.js';
import { cabinetLayout } from './cabinet.js';
import { save, applyUnlocks, BAR_SLICES, BAR_PRICE, STOCK_MAX } from './save.js';
import { SOAP_SHAPES, DEFAULT_SHAPE, giftShapes, shapeGeometry, shapeEmboss, shapeIconURL, insideShape, shapeTopY } from './shapes.js';
import { PKG_CATS, PACKAGE_TYPES } from './decor.js';
import { Deco } from './deco.js';
import { Showcase } from './showcase.js';
import { CutRig } from './cutRig.js';
import { DECO_ITEMS, DECO_GROUPS, phaseOf, groupOf } from './decoItems.js';
import { DECO_SPOTS, DECO_Y, SHELF_Z } from './setting/wall.js';
import { KNIFE_X, SKEW_RISE, ZOOM_FIT_W, ZOOM_FIT_H, CLOSE_DIR, poseKnife, syncSlope } from './cutGeom.js';

const FILL_CAP = 40, FILL_MAX_KINDS = 4;     // Teile pro Füllungs-Sorte, verschiedene Füllungen
const DRAG_LIFT = 55;                        // px: Deko schwebt so weit über dem Finger
const _dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(TABLE_Y + 0.75));
const _dragPos = new THREE.Vector3(), _dragTarget = new THREE.Vector3();

const TAKE_MAX = 9;                                 // Stücke je Sorte, die ins Regal passen (Zähler einstellig)
const BAR_TABLE_SCALE = 0.85;                       // Seife auf dem Tisch / im Päckchen
const BAR_HALF_H = 0.18 * BAR_TABLE_SCALE;          // halbe Höhe der liegenden Seife
const ZOOM_TIME = 0.85;                             // s für die Kamerafahrt zur Seife und zurück
const PRESENT_LIFT = 0.12;                          // Präsentation: so weit steigt die Seife (unter der Ergebniskarte)
const easeInOut = (t) => t * t * (3 - 2 * t);
const easeOut = (t) => 1 - (1 - t) * (1 - t) * (1 - t);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _t = new THREE.Vector3();

const _m4 = new THREE.Matrix4(), _qq = new THREE.Quaternion(), _qq2 = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0), _side = new THREE.Vector3(1, 0, 0);
const _ray = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _hit = new THREE.Vector3();
const _plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -(BLOCK.nz * CUBE / 2 + 0.05));
const _invM = new THREE.Matrix4(), _camDir = new THREE.Vector3();
const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);

const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

export class Game {
  constructor({ renderer, scene, camera, camBase, ovenLight, bg, bowl, bowlShadow }, ui, input, block, loose, knife, confetti, shelf, packages) {
    Object.assign(this, { renderer, scene, camera, camBase, ovenLight, bg, bowl, bowlShadow, ui, input, block, loose, knife, confetti, shelf, packages });
    this.anims = [];             // laufende Animationen (werden nur bei Ereignissen angelegt)
    this.pkgSlot = -1;
    this.swipe = { active: false, x0: 0, y0: 0, t0: 0, dx: 0 };
    // Seife im Regal antippen: Raycast NUR beim Tippen, nicht pro Frame
    this.tapNdc = new THREE.Vector2();
    const canvas = renderer.domElement;
    this.isAvailable = (x) => this.slicesLeft(x.id) > 0;   // nur Sorten mit Seife im Regal antippbar
    const endSwitchTap = (e) => {
      const t = this.switchTap; this.switchTap = null;
      if (!t || e.pointerId !== t.id || this.state !== 'cutting' || e.type !== 'pointerup') return;
      if (Math.hypot(e.clientX - t.x, e.clientY - t.y) < 12 && performance.now() - t.t < 600) this.switchSoap(t.i);
    };
    canvas.addEventListener('pointerup', endSwitchTap);
    canvas.addEventListener('pointercancel', endSwitchTap);
    canvas.addEventListener('pointerdown', (e) => {
      const st = this.state;
      const r = canvas.getBoundingClientRect();
      this.tapNdc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      if (st === 'unmolded') { this.showcase.down(e); return; }
      if (st === 'decorFill' || st === 'packed') {
        if (this.drag || this.deco.busy) return;
        // Deko-Regal antippen > gewählte Deko ziehen > (zu) Päckchen wegwischen
        const gr = this.pickDecoShelf();
        if (gr && st === 'decorFill' && groupOf(gr).phase === 'lid') { this.lidFirst(); return; }
        if (gr) { this.openDecoSheet(gr); return; }
        // Deckel antippen = Deckel drauf (nur so geht er zu)
        if (st === 'decorFill' && this.hitLid(e)) { this.closeLid(); return; }
        if (this.armed) { this.startDrag(this.armed, e); return; }
        if (st === 'packed') this.swipeStart(e);
        return;
      }
      // beim Schneiden andere Seife im Regal antippen = Seife wechseln
      // erst beim Loslassen und nur als echter Tipp (ohne Wischen): das schräge Messer ruht etwas höher,
      // ein Wisch, der dort über einer Regal-Seife beginnt, darf die Seife nicht wechseln
      if (st === 'cutting') {
        const i = this.shelf.pick(this.tapNdc, this.camera, (s) => s !== this.block.soap, true);   // nur direkt getroffen (Wischen beginnt oft in der Nähe)
        this.switchTap = i >= 0 ? { i, x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId } : null;
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
    applyUnlocks(SOAP_SHAPES, 'shape:');
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
    this.knifeX = 0; this.knifeTargetY = 0; this.cutHeld = false; this.cutGrab = 0;
    this.knifeY = 2; this.knifeZ = 0; this.knifeTilt = 0;
    this.sliceProgress = 0; this.cutRaw = -1; this.returning = false; this.slicesCut = 0;
    knife.position.set(0, 2.2, BLOCK.nz * CUBE / 2 + 0.03);
    knife.visible = false;
    // Seife + Messer + Seifenbrett kippen gemeinsam (45° nach hinten beim Schneiden)
    this.rig = new CutRig(scene);
    this.rig.add(block.mesh);
    this.rig.add(knife);
    // Kamera: Grundstellung <-> Nahaufnahme der Seife beim Schneiden (weich überblendet)
    this.zoomT = 0; this.zoomE = 0; this.camVersion = -1;
    this.closePos = new THREE.Vector3(); this.closeLook = new THREE.Vector3();

    // Fertige Seife (Geometrie + Material einmalig; nur die Textur wechselt pro Seife)
    this.barMat = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0 });
    // Oberseite mit Prägung (Bump je Seifenform), Seiten glatt; Geometrie wechselt mit der Form
    this.barTopMat = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0, bumpScale: 7 });
    this.shape = DEFAULT_SHAPE;
    this.bar = new THREE.Mesh(shapeGeometry(DEFAULT_SHAPE.id), [this.barTopMat, this.barMat]);
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
    // gelöste Würfel: aus Block-Koordinaten in die Welt (gekippte Seife), mit gleicher Lage
    this.onCube = (x, y, z, r, g, b, id) => { this.rig.toWorld(_a.set(x, y, z), _b); loose.spawn(_b.x, _b.y, _b.z, r, g, b, id, this.rig.outer.rotation.x); };

    // Bestell-Zettel am mittleren Brett + Seifenschrank
    this.notes = new OrderNotes(scene);
    // Puzzle-Kurve: erster Auftrag ist der Lernauftrag (1 Seife); daneben hängt von Anfang an ein Auftrag mit 2 Seifen
    for (let i = 0; i < NOTE_COUNT; i++) this.notes.set(i, this.newOrder(i === 0 && save.done === 0, i === 1));
    this.activeNote = -1;
    this.order = null;
    // Seifenschrank-Zähler: take = Map soapId -> geholte Stücke, takeDrawer = soapId -> Schublade mit dem Zähler
    this.take = new Map(); this.stocked = false;
    // Seifen im Regal für diesen Auftrag: soapId -> { pieces: ganze+angeschnittene Stücke, cur: Scheiben im vordersten Stück }
    this.supply = new Map(); this.pending = 0;
    this.cabLayout = cabinetLayout();
    this.toChoose();
  }

  /** Neuer Auftrag nach der Puzzle-Kurve (orders.soapCountFor); mindestens ein Mehr-Seifen-Auftrag hängt immer am Brett. */
  newOrder(first = false, forceMulti = false) {
    const multiOnBoard = this.notes && this.notes.orders.some((o) => o && o.items.length > 1 && o !== this.order);
    const soapCount = forceMulti || (!first && !multiOnBoard) ? (save.done >= 4 && Math.random() < 0.3 ? 3 : 2) : 0;
    return makeOrder({ first, done: save.done, soapCount, avoid: this.noteNames(), avoidRecipes: this.noteRecipes() });
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
    this.ui.openNote(o, this.state === 'choose' && !this.order, () => this.acceptOrder(i));
  }

  acceptOrder(i) {
    if (this.state !== 'choose') return;
    this.order = this.notes.orders[i];
    this.activeNote = i;
    this.notes.setActive(i, true);
    this.cutIds.clear();
    this.resetOrderProgress();
    this.ui.setOrder(this.order);
    this.refreshMix();
    sndPaper();
    this.toShelf();
  }

  /** Auftrag (wieder) von vorn: Seife 1, nichts geholt, Schale leer, vorgemerkte Münzen weg. */
  resetOrderProgress() {
    setItem(this.order, 0);
    this.take.clear(); this.supply.clear(); this.stocked = false; this.pending = 0;
    this.additives = []; this.warnedAdd = false;
    this.soapStars = [];   // Shop-Bewertung: Sterne je fertiger Seife dieses Auftrags
    this.cutIds.clear();
    this.loose.clear();
    this.shelf.setSoaps([]);
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
    this.ui.setMix(this.order, this.pcts, fill, this.additives, null, null);
  }

  /** Sorten der Bestellung, von denen noch deutlich zu wenig in der Form ist. */
  missingSoaps() { return this.order ? this.order.mix.filter((m) => (this.pcts[m.soap.id] || 0) < m.pct - 4).map((m) => m.soap) : []; }

  /**
   * Vollbild-Schrank: Seifen für den ganzen Auftrag herausnehmen. Jedes Fach ist immer voll; jedes
   * Antippen nimmt ein ganzes Stück mehr (Zähler am Fach), das Minus legt eins zurück. Mit
   * „Ins Regal stellen“ ist die Auswahl für diesen Auftrag endgültig (Schrank bleibt danach zu).
   * Kein Hinweis, wie viele Stücke nötig sind – das ist das Rätsel.
   */
  openCabinet() {
    if (this.stocked && this.order) { this.cabinetLocked(); return; }
    const back = this.state;
    this.state = 'cabinet';
    sndCreak(); haptic(8);   // Schranktür knarrt, dann gehen die Türen auf
    const o = this.order;
    const findText = () => {
      if (!o) return 'Nimm zuerst eine Bestellung an';
      const n = o.items.length, sorts = orderSorts(o).map((s) => s.name).join(', ');
      return n > 1 ? `${n} Seifen · ${sorts}` : `Gesucht: ${sorts}`;
    };
    this.ui.hint('');
    const taken = (d) => d.kind === 'soap' && (this.take.get(d.soap.id) || 0) > 0;
    this.ui.openCabinet(this.cabLayout, findText(), (d) => !!o && taken(d), (d) => {
      if (d.kind === 'locked') return 'Noch gesperrt';
      if (!o) return 'Nimm zuerst eine Bestellung an';
      if (!orderSorts(o).includes(d.soap)) return 'Nicht in der Bestellung';
      const t = this.take.get(d.soap.id) || 0;
      if (t >= TAKE_MAX) return `Mehr als ${TAKE_MAX} passen nicht ins Regal`;
      this.take.set(d.soap.id, t + 1);
      if (!t) sndDrawer(); else sndStack(t + 1);
      haptic(t ? 8 : 12);
      return { find: findText(), count: t + 1 };
    }, () => { if (back === 'choose') this.toChoose(); else this.toShelf(); }, null, {
      count: (d) => (taken(d) ? this.take.get(d.soap.id) : 0),
      need: () => Infinity,          // keine verräterische Farbe: ob es reicht, sieht man erst beim Schneiden
      canEdit: () => !!o && !this.stocked,
      dec: (d) => {
        if (!o || this.stocked || !taken(d)) return null;
        const t = this.take.get(d.soap.id) - 1;
        if (t > 0) this.take.set(d.soap.id, t); else this.take.delete(d.soap.id);
        sndStack(t, false); haptic(6);
        return { find: findText(), count: t };
      },
      done: () => (o && !this.stocked ? { ready: this.takeTotal() > 0, label: this.takeLabel() } : null),
      onDone: () => this.stockShelf(),
      focus: (d) => !!o && orderSorts(o).includes(d.soap),
    });
  }

  /** Schrank antippen, obwohl die Seifen für diesen Auftrag schon geholt sind: sanfter Hinweis. */
  cabinetLocked() {
    sndWood(0, 0.45); haptic(6);
    this.ui.popup('Der Schrank bleibt zu');
    this.ui.hint('Erst nach diesem Auftrag wieder – arbeite mit den Seifen im Regal');
  }

  takeTotal() { let n = 0; for (const v of this.take.values()) n += v; return n; }

  /** Knopf-Text im Schrank: 'Ins Regal stellen · 3 Stücke'. */
  takeLabel() {
    const n = this.takeTotal();
    return n ? `Ins Regal stellen · ${n} ${n === 1 ? 'Stück' : 'Stücke'}` : 'Ins Regal stellen';
  }

  /** Geholte Stücke einer Sorte (für Anzeige und spätere Seifenkörbe). */
  takenBars(id) { return this.take.get(id) || 0; }

  /** Sorten, die im Regal stehen (in Auftrags-Reihenfolge, nur geholte). */
  shelfSorts() { return orderSorts(this.order).filter((x) => this.supply.has(x.id)); }

  /** Scheiben, die von einer Sorte im Regal noch übrig sind (angeschnittene Scheiben zählen als verbraucht). */
  slicesLeft(id) { const s = this.supply.get(id); return s && s.pieces > 0 ? (s.pieces - 1) * SLICES + s.cur : 0; }

  /** Regal zeigt je Sorte das vorderste Stück (kürzer, wenn angeschnitten) und dahinter die vollen Ersatzstücke. */
  updateShelfSupply(list = this.shelf.soaps) {
    list.forEach((x, i) => { const s = this.supply.get(x.id); this.shelf.setSpares(i, s ? Math.max(0, s.pieces - 1) : 0); this.shelf.setCount(i, s ? s.pieces : 0); });
  }

  /** Alle geholten Seifen fliegen (nacheinander) von oben auf das mittlere Brett. Ab jetzt ist der Schrank zu. */
  stockShelf() {
    this.state = 'stocking';
    this.stocked = true;
    for (const [id, n] of this.take) this.supply.set(id, { pieces: n, cur: SLICES });
    const list = this.shelfSorts();
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
        this.shelf.place(i, _t, SHELF_SCALE * (0.4 + 0.6 * k));
      }
    }, () => {
      this.shelf.setSoaps(list, this.shelfFracs()); this.updateShelfSupply(list); sndWood();
      if (this.checkEnough()) this.toShelf();
    }, (t) => t);
  }

  /** Länge der Seifenstücke im Regal: so viele Scheiben, wie das vorderste Stück noch hat. */
  shelfFracs() { return this.shelfSorts().map((x) => (this.supply.get(x.id).pieces > 0 ? this.supply.get(x.id).cur : 0) / SLICES); }

  /**
   * Reicht es noch? Für jede Sorte: noch gebrauchte Scheiben (Rest der aktuellen Seife + alle späteren
   * Seifen) gegen die Scheiben im Regal. Sobald es rechnerisch nicht mehr reichen kann, ist der Auftrag
   * gescheitert – sofort (kein Weiterspielen ins Leere). Toleranz wie bei der Mischung: 4 %.
   */
  shortage() {
    const o = this.order;
    if (!o || !this.stocked) return null;
    const later = slicesNeeded(o, o.cur + 1);
    for (const x of orderSorts(o)) {
      const m = o.mix.find((q) => q.soap === x);
      const nowNeed = m ? Math.max(0, Math.ceil((m.pct - (this.pcts[x.id] || 0) - 4) / PCT_PER_SLICE)) : 0;
      const need = nowNeed + (later.get(x.id) || 0), have = this.slicesLeft(x.id);
      if (need > have) return { soap: x, need, have };
    }
    return null;
  }

  /** Prüft auf Mangel und zeigt ggf. den Bildschirm „Nicht genug Seife“. true = alles gut. */
  checkEnough() {
    const miss = this.shortage();
    if (!miss) return true;
    this.failOrder(miss);
    return false;
  }

  /** Auftrag gescheitert: freundlicher Bildschirm mit Erklärung, „Nochmal versuchen“ setzt den Auftrag zurück. */
  failOrder(miss) {
    const o = this.order;
    this.state = 'failed';
    this.knife.visible = false;
    this.ui.actions([]); this.ui.hint('');
    const total = slicesNeeded(o).get(miss.soap.id) || 0;
    const parts = o.items.map((it, k) => { const m = it.mix.find((q) => q.soap === miss.soap); return m ? `Seife ${k + 1}: ${m.pct} %` : null; }).filter(Boolean);
    const took = this.take.get(miss.soap.id) || 0;
    sndThump(0.4); haptic(30);
    this.ui.showFail({
      title: 'Nicht genug Seife',
      soap: miss.soap,
      lines: [
        parts.length > 1 ? `${miss.soap.name} für den ganzen Auftrag: ${parts.join(' + ')} = ${total * PCT_PER_SLICE} %` : `${miss.soap.name} gebraucht – ${parts[0]}`,
        `Das sind ${total} Scheiben – genommen: ${took} ${took === 1 ? 'Stück' : 'Stücke'} (${took * SLICES} Scheiben)` + (miss.have > 0 ? `, übrig ${miss.have}` : ''),
      ],
      rule: `1 Stück = ${SLICES} Scheiben = 100 % einer Seife. Plane alle Seifen des Auftrags, bevor du den Schrank schließt.`,
      onRetry: () => this.retryOrder(),
      onOther: () => this.abandonOrder(),
    });
  }

  /** Nochmal versuchen: gleicher Auftrag, Schrank wieder offen, alles auf Anfang. */
  retryOrder() {
    this.block.mesh.visible = false; this.block.slice = -1;
    this.resetOrderProgress();
    this.ui.setOrder(this.order); this.refreshMix();
    this.toShelf();
  }

  /** Anderen Auftrag wählen: dieser Zettel bleibt am Brett (nicht mehr „in Arbeit“). */
  abandonOrder() {
    this.block.mesh.visible = false; this.block.slice = -1;
    this.resetOrderProgress();
    if (this.activeNote >= 0) this.notes.setActive(this.activeNote, false);
    this.activeNote = -1;
    this.toChoose();
  }

  // ---------- Zustandswechsel ----------
  toShelf() {
    this.state = 'shelf';
    this.ui.setCut(null);
    this.knife.visible = false;
    this.refreshMix();
    const missing = this.missingSoaps();
    const multi = this.order.items.length > 1 ? `Seife ${this.order.cur + 1} von ${this.order.items.length} · ` : '';
    if (!this.stocked) this.ui.hint(this.order.items.length > 1 ? `${this.order.items.length} Seifen – hol alle Stücke aus dem Schrank` : 'Hol die Seifen aus dem Schrank');
    else if (missing.length) {
      const m = this.order.mix.find((x) => x.soap === missing[0]);
      this.ui.hint(`${multi}${m.soap.name}: ${m.pct / PCT_PER_SLICE} Scheiben für ${m.pct} % – tippe aufs Stück`);
    } else this.ui.hint(multi + (this.order.additive && !this.additives.includes(this.order.additive) ? `Fast fertig – noch ${this.order.additive.name} hinzufügen` : 'Die Mischung stimmt – jetzt schmelzen'));
    const acts = [];
    if (this.stocked) acts.push({ label: '✨ Zusätze', onClick: () => this.openAdditives() });
    if (this.loose.used > 0) acts.push({ label: '🔥 Schmelzen', alt: true, onClick: () => this.toOven() });
    this.ui.actions(acts);
  }

  /** Seife im Regal angetippt: sie fliegt über die Schale, dann geht das Schneiden los. */
  pickSoap(slot) {
    if (this.state !== 'shelf') return;
    const soap = this.shelf.soaps[slot];
    if (this.slicesLeft(soap.id) <= 0) {
      this.ui.hint(`${soap.name} ist aufgebraucht`);
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
    this.ui.hint(m ? `${m.pct / PCT_PER_SLICE - Math.round(have / PCT_PER_SLICE)} Scheiben ${soap.name} · nach unten wischen` : 'Nach unten wischen');   // kurz: eine Zeile, mehr Platz für die Nahaufnahme
    this.rig.reset();
    this.block.load(soap, this.supply.get(soap.id).cur);   // das vorderste (evtl. angeschnittene) Stück
    this.ui.actions([{ label: '✋ Fertig mit dieser Seife', onClick: () => this.stopCutting() }]);
    this.loose.blockHalfX = this.block.halfX; this.loose.blockHalfZ = this.block.halfZ;
    this.loose.blockTop = this.block.topY;
    this.knife.visible = true;
    this.knifeY = this.block.topY + 0.6;
    this.knifeZ = this.block.cutZ;
    this.knifeX = KNIFE_X; this.knifeTilt = 0;
    this.cutHeld = this.input.down ? 'stale' : false;   // Finger vom Antippen im Regal schneidet nicht
    this.sliceProgress = 0; this.cutRaw = -1; this.returning = false; this.slicesCut = 0;
    this.loose.blockTop = -1; // Würfel fallen vorne weg, keine Kollision mit der Blockoberseite nötig
    haptic(8);
  }

  /**
   * Schneiden beenden (Knopf oder Stück ist alle). Verbrauchte Scheiben gehen vom Vorrat ab;
   * eine angefangene Scheibe zählt als verbraucht (der Rest davon ist Verschnitt). Der Rest des
   * Stücks bleibt im Vorrat (im Regal sichtbar kürzer) für diese und spätere Bestellungen.
   */
  /** Andere Seife angetippt: die aktuelle fliegt zurück ins Regal, die neue über die Schale. */
  switchSoap(slot) {
    if (this.state !== 'cutting') return;
    this.stopCutting(slot);
  }

  stopCutting(next = -1) {
    if (this.state !== 'cutting') return;
    const soap = this.block.soap;
    const used = this.slicesCut + (this.block.colRows.some((r) => r > 0) ? 1 : 0);   // angeschnitten (auch nur an der Spitze) = verbraucht
    // verbrauchte Scheiben gehen vom vordersten Stück ab; ist es alle, rückt das nächste volle Stück nach
    const sup = this.supply.get(soap.id);
    sup.cur -= used;
    const usedUp = sup.cur <= 0;
    if (usedUp) { sup.pieces--; sup.cur = sup.pieces > 0 ? SLICES : 0; }
    this.block.mesh.visible = false;
    this.block.slice = -1;
    this.loose.blockTop = -1;
    this.knife.visible = false;
    this.ui.actions([]);
    this.refreshMix();
    const p = Math.round(this.pcts[soap.id] || 0);
    if (used) { this.confetti.burst(0, BLOCK_BASE_Y + 0.2, 0.3, 60); this.ui.popup(`${soap.emoji} ${p} %`); }
    sndThump(0.5); haptic(20);
    const list = this.shelfSorts();
    this.shelf.setSoaps(list, this.shelfFracs()); this.updateShelfSupply(list);
    // das Stück fliegt sichtbar zurück auf seinen Platz im Regal (ist es alle, fliegt nichts zurück)
    const home = list.indexOf(soap);
    if (home >= 0 && !usedUp) { const ang = this.rig.piecePose(this.shelf.frac[home], _t); this.shelf.flyBack(home, _t, ang); }
    if (!this.checkEnough()) return;
    if (next >= 0) { this.toShelf(); this.pickSoap(next); return; }
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
      sndGlass(); haptic(12);
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
    this.ui.hint('');   // beim Schmelzen kein Fenster: nur Topf und Szene
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
    this.barTopMat.map = this.barMat.map; this.barTopMat.roughness = this.barMat.roughness; this.barTopMat.needsUpdate = true;
    this.shape = null;   // Form wird erst beim Ausformen gewählt
    this.fill = Math.max(0.08, this.loose.fillHeight());
    this.liquid.visible = true;
    this.liquid.scale.set(BOWL.floorR, 0.001, BOWL.floorR);
  }

  toReveal() {
    this.state = 'reveal';
    this.ovenLight.intensity = 0;
    this.bg.copy(this.bgBase);
    sndCeramic();
    this.ui.hint('Geschmolzen – wähle die Seifenform');
    this.ui.actions([{ label: '✨ Aus der Form nehmen', onClick: () => this.openShapes() }]);
  }

  /** Gussform wählen (gesperrte Formen mit Schloss, wie bei den Päckchen); die gewünschte ist markiert. */
  openShapes() {
    if (this.state !== 'reveal') return;
    const want = this.order && this.order.shape;
    this.state = 'shapeSheet';
    const items = SOAP_SHAPES.map((s) => ({ id: s.id, name: s.name, cat: 'Seifenformen', thumb: shapeIconURL(s.id), unlocked: s.unlocked, cost: s.cost, bonus: s.bonus,
      sub: s === want ? '✔ gewünscht' : (s.bonus ? `+${s.bonus} 🪙` : 'Standard'), shape: s }));
    this.ui.openSheet(items, {
      title: 'Seifenform wählen', cats: ['Seifenformen'], startCat: 'Seifenformen', coins: () => this.coins,
      onBuy: (x) => this.buy(x.cost, 'shape:' + x.id, () => { x.shape.unlocked = true; }),
      onSelect: (x) => { this.state = 'reveal'; this.unmold(x.shape); },
      onClose: () => { if (this.state === 'shapeSheet') this.state = 'reveal'; },
    });
    // gewünschte Form gleich sichtbar machen
    const k = SOAP_SHAPES.indexOf(want);
    if (k > 1) requestAnimationFrame(() => { const c = document.querySelectorAll('#pkg-list .pkg-card')[k]; if (c) c.scrollIntoView({ inline: 'center', block: 'nearest' }); });
  }

  unmold(shape = (this.order && this.order.shape) || DEFAULT_SHAPE) {
    if (this.state !== 'reveal') return;
    this.shape = shape;
    this.bar.geometry = shapeGeometry(shape.id);
    this.barTopMat.bumpMap = shapeEmboss(shape.id); this.barTopMat.needsUpdate = true;
    this.quality = this.rateMix();
    this.loose.clear();
    this.liquid.visible = false;
    this.bar.visible = true;
    this.barT = 0;
    this.confetti.burst(0, 0.8, 0.4, 140);
    sndThump(); haptic(25);
    this.ui.popup('Wunderschön!');
    const q = this.quality || this.rateMix();
    this.price = q.price;
    this.buildBarBits();
    this.ui.showQuality(q);
    this.ui.hint((q.stars === 3 ? 'Perfekt' : q.stars === 2 ? 'Eine schöne Seife' : 'Fast') + ' – dreh sie mit dem Finger');
    this.showcase.start(this.bar);
    this.ui.actions([{ label: `🪙 Verkaufen für ${this.price}`, alt: true, onClick: () => this.sell() }]);
    this.bar.scale.set(0.6, 0.6, 0.6); this.bar.rotation.set(0, 0, 0);
    // Schale verschwindet für die Präsentation (die Seife steht frei im Licht)
    this.play(0.25, (e) => {
      const k = Math.max(0.001, 1 - e);
      this.bowl.scale.set(k, k, k); this.bowl.position.y = -0.25 * e; this.bowlShadow.scale.set(k, k, k);
    }, () => { this.bowl.visible = false; this.bowlShadow.visible = false; });
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
    rows.push({ label: '🫙 Füllung', value: `${fill} % voll`, cls: Math.abs(fill - 100) <= 5 ? 'good' : Math.abs(fill - 100) > 15 ? 'bad' : '' });
    let price = Math.round(o.reward * [0, 0.7, 1, 1.25][stars]);
    if (o.additive) {
      const ok = this.additives.includes(o.additive);
      rows.push({ label: `${o.additive.emoji} ${o.additive.name}`, value: ok ? '✔ wie gewünscht' : 'fehlt · −20 %', cls: ok ? 'good' : 'bad' });
      if (!ok) price = Math.round(price * 0.8);
    }
    // Seifenform: falsche Form -> −30 % (einfach und sichtbar); erst beim Ausformen bekannt
    if (o.shape && this.shape) {
      const ok = this.shape === o.shape;
      rows.push({ label: '◇ Form', value: ok ? `✔ ${o.shape.name}` : `${this.shape.name} statt ${o.shape.name} −30 %`, cls: ok ? 'good' : 'bad' });
      if (!ok) price = Math.round(price * 0.7);
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
    // je nach Seifenform: oben nur innerhalb des Umrisses (mit Abstand zur Rundung), vorne nur beim Riegel
    const sid = (this.shape || DEFAULT_SHAPE).id;
    const spot = (i, onTop, out, nrm) => {
      if (onTop || sid !== 'klassisch') {
        let x = 0, z = 0;
        for (let k = 0; k < 40; k++) { x = (Math.random() - 0.5) * 0.9; z = (Math.random() - 0.5) * 0.64; if (insideShape(sid, x, z, 0.1)) break; }
        out.set(x, shapeTopY(sid, x, z), z); nrm.set(0, 1, 0);
      } else { out.set((Math.random() - 0.5) * 0.7, (Math.random() - 0.5) * 0.12, 0.32); nrm.set(0, 0, 1); }
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
      sndThump(0.8); haptic(10);
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
      sndCardboard();
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
      sndThump(0.6);
      this.toDecorFill();
    });
  }

  // ---------- Dekorieren ----------
  /** Seife liegt im offenen Päckchen: Füllungen/Perlen/Blüten aus dem unteren Regal hineinziehen. */
  toDecorFill() {
    this.state = 'decorFill';
    this.deco.customer = this.order ? this.order.customer : '';
    this.armed = null;
    this.ui.hint('Dekoriere – dann auf den Deckel tippen');
    this.lidT0 = this.now || 0;
    this.decoActions();
  }

  decoActions() {
    const acts = [];
    const phase = this.state === 'decorFill' ? 'fill' : 'lid';
    if (this.deco.applied.some((it) => phaseOf(it) === phase)) acts.push({ label: '↶ Rückgängig', onClick: () => this.undoDeco(phase) });
    this.ui.actions(acts);
    this.ui.setDeco(this.deco.bonus);
  }

  undoDeco(phase) {
    if (this.drag || this.deco.busy) return;
    const it = this.deco.undo(phase, phaseOf);
    if (it) { sndFabric(); this.ui.popup(`${it.name} entfernt`); }
    this.decoActions();
  }

  /** Schleife/Anhänger/Siegel bei offenem Paket: dezenter Hinweis, Deckel wackelt kurz. */
  lidFirst() {
    this.ui.hint('Erst den Deckel schließen – tippe auf den Deckel');
    this.lidNudge = this.now || 0;
    haptic(6);
  }

  /** Bildschirm-Rechteck des daneben liegenden Deckels (großzügig, für Finger). */
  lidRect() {
    const L = TABLE_SPOT.lid, [fw, fd] = this.packages.footprint(this.pkgSlot);
    const hw = fw / 2 + PKG.lidPad, hd = fd / 2 + PKG.lidPad, c = Math.cos(TABLE_SPOT.lidRy), sn = Math.sin(TABLE_SPOT.lidRy);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    const W = window.innerWidth, H = window.innerHeight;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const y of [0, PKG.lidH]) {
      const lx = sx * hw, lz = sz * hd;
      _t.set(L.x + lx * c + lz * sn, TABLE_Y + y, L.z - lx * sn + lz * c).project(this.camera);
      const px = (_t.x + 1) / 2 * W, py = (1 - _t.y) / 2 * H;
      x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
    }
    return { x0, y0, x1, y1, x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
  }
  hitLid(e) {
    const r = this.lidRect(), pad = 16;
    return e.clientX > r.x0 - pad && e.clientX < r.x1 + pad && e.clientY > r.y0 - pad && e.clientY < r.y1 + pad;
  }

  /** Deckel liegt offen daneben: hüpft ab und zu leicht (zeigt: antippen); nach Hinweis wackelt er. */
  updateLidHint(time) {
    const i = this.pkgSlot; if (i < 0) return;
    const T = time - (this.lidT0 || 0), N = time - (this.lidNudge ?? -9);
    let hop = 0, tilt = 0;
    const ph = (T - 1.2) % 3.2;                      // alle 3,2 s ein kleiner Doppelhüpfer
    if (T > 1.2 && ph < 0.5) { hop = Math.abs(Math.sin(ph / 0.5 * Math.PI * 2)) * 0.035 * (ph < 0.25 ? 1 : 0.55); tilt = hop * 1.4; }
    if (N < 0.6) { const k = 1 - N / 0.6; hop = Math.max(hop, Math.abs(Math.sin(N * 18)) * 0.05 * k); tilt = Math.sin(N * 22) * 0.12 * k; }
    _a.copy(TABLE_SPOT.lid); _a.y += hop;
    this.packages.setLid(i, _a, tilt, TABLE_SPOT.lidRy, 0, 1);
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
      sndLid(); haptic(15);
      this.state = 'packed';
      this.ui.hint('Jetzt Schleife oder Anhänger – unten im Regal');
      this.decoActions();
      if (then) then();
    });
  }

  /**
   * Für Tests/Layout: Bildschirm-Rechtecke (CSS-Pixel) der Dinge, die nie von UI verdeckt werden dürfen
   * (Seife, Schale, Päckchen, Deckel) – je nach Zustand. Projektion der 8 Ecken der Weltbox.
   */
  focusRects() {
    const out = [], st = this.state, W = window.innerWidth, H = window.innerHeight;
    const add = (name, box) => {
      if (box.isEmpty()) return;
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (let k = 0; k < 8; k++) {
        _t.set(k & 1 ? box.max.x : box.min.x, k & 2 ? box.max.y : box.min.y, k & 4 ? box.max.z : box.min.z).project(this.camera);
        const px = (_t.x + 1) / 2 * W, py = (1 - _t.y) / 2 * H;
        x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
      }
      out.push({ name, x0, y0, x1, y1 });
    };
    const box = new THREE.Box3();
    if (st === 'cutting' && this.block.mesh.visible) {
      // gekippte Seife: die 8 Ecken über das Gestell in die Welt
      box.set(_a.set(-this.block.halfX, this.block.bottomY, -this.block.halfZ), _b.set(this.block.halfX, this.block.topY, this.block.frontZ));
      box.applyMatrix4(this.rig.inner.matrixWorld);
      add('seife', box);
    }
    // Schale: nur der Bereich, in dem die Würfel/die flüssige Seife liegen (Boden bis halbe Höhe)
    // Nahaufnahme beim Schneiden: statt der ganzen Schale die Stelle, an der die Würfel landen (vor der Seife)
    if (st === 'cutting' && this.bowl.visible) {
      this.rig.fullTiltCenter(_t, -BLOCK.ny * CUBE / 2);   // Unterkante der gekippten Seife (Mitte)
      add('landezone', box.set(_a.set(-this.block.halfX - 0.1, 0, _t.z - 0.1), _b.set(this.block.halfX + 0.1, 0.25, Math.min(BOWL.floorR * 0.9, _t.z + 0.45))));
    }
    if ((st === 'shelf' || st === 'oven') && this.bowl.visible) add('schale-innen', box.set(_a.set(-BOWL.floorR, 0, -BOWL.floorR), _b.set(BOWL.floorR, BOWL.height * 0.5, BOWL.floorR)));
    if ((st === 'reveal' || st === 'unmolded' || st === 'pickPkg' || st === 'picker' || st === 'pickSoap') && this.bar.visible) add('seife', box.setFromObject(this.bar));
    if ((st === 'pickSoap' || st === 'decorFill' || st === 'packed') && this.pkgSlot >= 0) {
      const P = TABLE_SPOT.pkg, [fw, fd] = this.packages.footprint(this.pkgSlot);
      add('paeckchen', box.set(_a.set(P.x - fw / 2, TABLE_Y, P.z - fd / 2), _b.set(P.x + fw / 2, TABLE_Y + PKG.h + (st === 'packed' ? PKG.lidH : 0), P.z + fd / 2)));
      if (st !== 'packed') { const r = this.lidRect(); out.push({ name: 'deckel', x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1 }); }
    }
    return out;
  }

  /** Für Tests: Bildschirm-y (px) von Messer-Ruhelage, Ober- und Unterkante der Schnittebene (gekippt) + x der Mitte. */
  testCutPx() {
    const H = window.innerHeight, W = window.innerWidth, b = this.block, M = this.rig.inner.matrixWorld;
    const pr = (y) => { _t.set(0, y, b.cutZ).applyMatrix4(M).project(this.camera); return [(_t.x + 1) / 2 * W, (1 - _t.y) / 2 * H]; };
    const r = pr(b.topY + 0.06 + SKEW_RISE), t = pr(b.topY), u = pr(b.bottomY);
    // Bildschirm-Punkte (die Mittellinie der gekippten Seife läuft im Bild leicht schräg)
    return { rest: r[1], top: t[1], bot: u[1], x: t[0], restX: r[0], botX: u[0], zoom: this.zoomE, tilt: this.rig.e };
  }

  testRayLocalY(x, y) {
    _ndc.set(x, y); _ray.setFromCamera(_ndc, this.camera);
    _plane.normal.set(0, 0, 1); _plane.constant = -this.block.cutZ; _plane.applyMatrix4(this.rig.inner.matrixWorld);
    if (!_ray.ray.intersectPlane(_plane, _hit)) return null;
    return _hit.applyMatrix4(_invM.copy(this.rig.inner.matrixWorld).invert()).toArray();
  }

  /** Für Tests: Bildschirm-Pixel einer Deko-Stelle im Regal bzw. des Päckchens auf dem Tisch. */
  testPx(what) {
    const s = DECO_SPOTS.find((d) => d.group === what);
    if (what === 'lid') { const r = this.lidRect(); return { x: r.x, y: r.y }; }
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
    if (phaseOf(item) === 'lid' && this.state === 'decorFill') { this.lidFirst(); return; }
    const why = this.decoBlocked(item);
    if (why) { this.ui.hint(why); return; }
    _dragPos.copy(TABLE_SPOT.pkg); _dragPos.y = TABLE_Y + 0.75; _dragPos.z += 0.15;
    this.deco.beginHand(item, _dragPos);
    this.deco.drop(() => { sndFabric(); haptic(10); this.ui.popup(`+${item.bonus} 🪙 ${item.name}`); this.decoActions(); });
    this.ui.hint(this.state === 'decorFill' ? 'Mehr Deko – oder auf den Deckel tippen' : 'Mehr Deko – oder zum Versenden zur Seite wischen');
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
    if (phaseOf(d.item) === 'lid' && this.state === 'decorFill') { this.deco.fallAway(); this.lidFirst(); return; }
    const why = this.decoBlocked(d.item);
    if (over && !why) {
      this.deco.drop(() => { sndFabric(); haptic(10); this.ui.popup(`+${d.item.bonus} 🪙 ${d.item.name}`); this.decoActions(); });
      this.ui.hint(this.state === 'decorFill' ? 'Mehr Deko – oder auf den Deckel tippen' : 'Zum Versenden zur Seite wischen');
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
      // Shop-Bewertung je Seife: Genauigkeit der Mischung -> 0–5 Sterne, fehlender Wunsch-Zusatz / falsche Form je −1
      {
        const o = this.order, q = this.quality;
        if (o && q) {
          let st = q.accuracy / 20;
          if (o.additive && !this.additives.includes(o.additive)) st -= 1;
          if (o.shape && this.shape && this.shape !== o.shape) st -= 1;
          (this.soapStars || (this.soapStars = [])).push(Math.max(1, Math.min(5, st)));
        }
      }
      this.deco.reset(); this.ui.setDeco(0);
      this.additives = []; this.quality = null;
      const o = this.order, more = o && o.cur < o.items.length - 1;
      const db = earned - this.price - (this.pkgType ? this.pkgType.bonus : 0);
      if (more) {
        // Seife k von n fertig: Münzen werden vorgemerkt und erst mit der letzten Seife ausgezahlt
        this.pending += earned;
        sndCardboard(0.7); haptic(14);
        this.ui.popup(`Seife ${o.cur + 1} von ${o.items.length} fertig · +${earned} 🪙`);
      } else {
        const total = earned + this.pending;
        this.lastEarned = total; this.pending = 0;
        this.coins += total; save.coins = this.coins;
        save.done = save.done + 1;
        // Bestellung fertig: Durchschnitt ihrer Seifen geht als eine Bewertung (1–5 Sterne) in die Shop-Bewertung
        if (this.soapStars && this.soapStars.length) save.addRating(this.soapStars.reduce((a, b) => a + b, 0) / this.soapStars.length);
        this.soapStars = [];
        this.ui.setCoins(this.coins, true);
        sndCoins(); haptic(20);
        this.ui.popup(o && o.items.length > 1 ? `+${total} 🪙 für ${o.items.length} Seifen` : db > 0 ? `+${total} 🪙 (Deko +${db})` : `+${total} 🪙`);
        // neue Seifenform geschenkt (Oval nach 2, Rund nach 5 Aufträgen) – kommt ab jetzt auch in Bestellungen vor
        const gifts = giftShapes(save.done);
        if (gifts.length) setTimeout(() => { sndStack(3); this.ui.popup(`Neue Form geschenkt: ${gifts.map((g) => g.name).join(', ')}`); }, 1300);
      }
      // Schale kommt zurück, Päckchen wieder ins Regal, neue Bestellung
      this.bowl.visible = true; this.bowlShadow.visible = true;
      this.play(0.45, (e) => {
        const k = Math.max(0.001, e);
        this.bowl.scale.set(k, k, k); this.bowl.position.y = -0.25 * (1 - e);
        this.bowlShadow.scale.set(k, k, k);
      }, null, easeOut);
      this.packages.reset();
      document.body.classList.remove('table-mode');
      if (more) {
        // nächste Seife desselben Auftrags: Regal (mit den Resten) bleibt, Schrank bleibt zu
        setItem(o, o.cur + 1);
        this.cutIds.clear();
        this.ui.setOrder(o); this.refreshMix();
        this.toShelf();
        this.checkEnough();
        return;
      }
      // fertiger Zettel verschwindet, ein neuer klappt an seinem Platz herunter
      const ni = this.activeNote;
      this.activeNote = -1;
      if (ni >= 0) {
        this.notes.set(ni, null);
        this.order = null;
        setTimeout(() => this.notes.set(ni, this.newOrder(), { animate: true }), 450);
      }
      this.toChoose();
    }, (t) => t * t);
  }

  // ---------- pro Frame ----------
  /**
   * Bühne freihalten: Ist die Bestell-/Hinweis-Leiste unten so hoch, dass sie in die Schale ragen würde,
   * rutscht das Bild (Kamera-Ausschnitt) sanft nach oben. DOM wird nur alle 0,25 s gelesen.
   */
  updateViewShift(dt) {
    const st = this.state;
    this.vsT = (this.vsT || 0) - dt;
    if (this.vsT <= 0 && !this.drag) {           // beim Ziehen von Deko steht das Bild still
      this.vsT = 0.12;
      let need = 0;
      const H = window.innerHeight, vs = this.viewShift || 0;
      const work = ((st === 'shelf' || st === 'cutting' || st === 'oven' || st === 'flying' || st === 'between' || st === 'stocking') && this.bowl.visible)
        || ((st === 'pickSoap' || st === 'decorFill' || st === 'packed') && this.pkgSlot >= 0);
      const q = document.getElementById('quality');
      const present = !work && q && q.classList.contains('show') && this.bar.visible;
      if (work) {
        // unterster Punkt von Schale/Päckchen/Deckel (ohne Verschiebung) muss über der Leiste unten bleiben
        const dockTop = document.getElementById('dock').getBoundingClientRect().top;
        let low = -1e9;
        for (const r of this.focusRects()) low = Math.max(low, r.y1 + vs);
        // am Päckchen gleich Platz für das „+N Deko“-Schild lassen, damit das Bild später nicht nachrutscht
        const reserve = (st === 'pickSoap' || st === 'decorFill' || st === 'packed') ? 30 : 0;
        need = Math.max(0, low + 10 + reserve - dockTop);
      } else if (present) {
        // Präsentation: Seife unter die Ergebniskarte schieben (Bild nach unten = negative Verschiebung)
        const qb = q.offsetTop + q.offsetHeight;   // ohne Einblend-Transform (sonst 12 px zu wenig)
        let top = 1e9;
        for (const r of this.focusRects()) if (r.name === 'seife') top = Math.min(top, r.y0 + vs);
        need = Math.max(0, qb + 24 - top);   // Luft fürs Wippen + Drehen
      }
      // während der Arbeit nur nachgeben, nie zurückspringen (kein Pendeln bei wechselnden Hinweisen / Drehen)
      // Kamera-Modus gewechselt (Nahaufnahme <-> normal): Merkwert neu beginnen
      const mode = this.zoomTarget ? 1 : 0;
      if (mode !== this.vsMode) { this.vsMode = mode; this.vsKeep = 0; }
      this.vsKeep = (work || present) ? Math.max(this.vsKeep || 0, need) : 0;
      this.viewShiftTarget = present ? -Math.min(this.vsKeep, H * 0.2) : Math.min(this.vsKeep, H * (mode ? 0.16 : 0.12));   // 0.12: Platz für höhere Zettel (Mehr-Seifen + Zusatz); Nahaufnahme: etwas mehr Spielraum (Landestelle der Würfel)
    }
    const prev = this.viewShift || 0;
    this.viewShift = damp(prev, this.viewShiftTarget || 0, 10, dt);
    if (Math.abs(this.viewShift) >= 0.3) this.camera.setViewOffset(window.innerWidth, window.innerHeight, 0, this.viewShift, window.innerWidth, window.innerHeight);
    else if (this.camera.view && this.camera.view.enabled) this.camera.clearViewOffset();
  }

  update(dt, time) {
    this.now = time;
    this.updateRigAndCamera(dt);
    this.updateViewShift(dt);
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
    if (this.state === 'decorFill' && !this.deco.busy) this.updateLidHint(time);
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
  /**
   * Schneiden: Das Messer steht an seinem Platz und folgt dem Finger 1:1 senkrecht (runter UND hoch).
   * Nur die Abwärtsbewegung schneidet: Fortschritt der Scheibe = tiefste erreichte Messerposition.
   * Unten angekommen ist die Scheibe ab; Messer fährt hoch und eine Scheibe nach hinten.
   * Loslassen mittendrin: Messer gleitet zurück nach oben, das Angeschnittene bleibt angeschnitten.
   */
  updateCutting(dt) {
    const inp = this.input;
    // Ruhelage: auch die vorauseilende (linke) Seite der Schneide steht knapp über der Seife
    const top = this.block.topY, height = top - this.block.bottomY, rest = top + 0.06 + SKEW_RISE;
    if (!inp.down) this.cutHeld = false;
    let follow = false;
    if (inp.down && this.cutHeld !== 'stale' && !this.returning) {
      // Schnittebene liegt in Block-Koordinaten (Seife ist gekippt): Ebene in die Welt, Treffer zurück
      _plane.normal.set(0, 0, 1); _plane.constant = -this.knifeZ;
      _plane.applyMatrix4(this.rig.inner.matrixWorld);
      _invM.copy(this.rig.inner.matrixWorld).invert();
      // Griffpunkt = Aufsetzpunkt des Fingers (nicht erst die Lage im nächsten Bild): das Messer springt
      // nicht zum Finger, sondern bewegt sich ab da exakt mit ihm
      if (!this.cutHeld) {
        const fresh = inp.seq !== this.grabSeq;   // neu aufgesetzt: ab dem Aufsetzpunkt; Finger blieb liegen: ab jetzt
        if (fresh ? this.planeY(inp.downX, inp.downY) : this.planeY(inp.x, inp.y)) { this.cutHeld = true; this.cutGrab = this.knifeY - _hit.y; this.grabSeq = inp.seq; }
      }
      if (this.cutHeld === true && this.planeY(inp.x, inp.y)) {
        this.knifeTargetY = THREE.MathUtils.clamp(_hit.y + this.cutGrab, top - height, top + 0.55 + SKEW_RISE);
        follow = true;
      }
    }
    const prevY = this.knifeY;
    if (this.returning) {
      // automatisch hochfahren und eine Scheibe nach hinten wechseln
      this.knifeY = damp(this.knifeY, rest, CUT.returnSpeed, dt);
      this.knifeZ = damp(this.knifeZ, this.block.cutZ, CUT.returnSpeed, dt);
      if (rest - this.knifeY < 0.02) { this.returning = false; this.sliceProgress = 0; this.cutRaw = -1; this.cutHeld = inp.down ? false : this.cutHeld; }
    } else {
      // 1:1 dem Finger nach; ohne Finger gleitet es sanft zurück nach oben
      this.knifeY = follow ? this.knifeTargetY : damp(this.knifeY, rest, 7, dt);
      this.knifeZ = damp(this.knifeZ, this.block.cutZ, 16, dt);
      if (this.block.active && follow && this.knifeY < prevY - 1e-4) {
        // nur abwärts: Tiefe der Schneide in der Seife = Fortschritt (hoch schneidet nicht)
        // Tiefe an der hinteren Seite = Fortschritt; die Spitze links ist um lead voraus und löst schon vorher
        const lead = SKEW_RISE / height;
        const raw = Math.min(1, (top - this.knifeY) / height);
        if (raw > (this.cutRaw ?? -1)) {
          this.cutRaw = raw;
          const depth = Math.max(0, raw);
          this.sliceProgress = depth >= 0.985 ? 1 : Math.max(this.sliceProgress, depth);
          const n = this.block.cutTo(this.sliceProgress >= 1 ? 1 : raw, this.onCube, lead);
          if (n) { sndCut(); haptic(5); }
          if (this.sliceProgress >= 1) this.completeSlice();
        }
      }
    }
    // Messer neigt sich kaum: ruhige, gerade Führung
    this.knifeTilt = damp(this.knifeTilt, 0, 10, dt);
    this.refreshMix();   // Mischungs-Balken live (DOM nur bei Änderung)
    // Messer (Ursprung bei KNIFE_X) um die Schräge gedreht; knifeY ist die Schneide an der hinteren Spalte
    poseKnife(this.knife, this.knifeY, this.knifeZ, this.knifeTilt);
    this.knifeVy = dt > 0 ? (this.knifeY - prevY) / dt : 0;   // für die Würfel auf der Klinge (Block-y/s)
  }

  /** Finger (NDC) -> Punkt auf der Schnittebene in Block-Koordinaten (_hit). Ebene/Inverse vorher setzen. */
  planeY(x, y) {
    _ndc.set(x, y);
    _ray.setFromCamera(_ndc, this.camera);
    if (!_ray.ray.intersectPlane(_plane, _hit)) return false;
    _hit.applyMatrix4(_invM);
    return true;
  }

  /** Kipp-Gestell, Rutsche für die Würfel und Kamera (Nahaufnahme beim Schneiden). Pro Frame, ohne Allokation. */
  updateRigAndCamera(dt) {
    const on = this.state === 'cutting' && this.block.mesh.visible;
    this.rig.update(dt, on);
    // Rutsche: aktuelle Schnittfläche/Stufe in Block-Koordinaten an die Würfel-Physik geben
    const sl = this.loose.slope;
    syncSlope(this.loose, this.rig, this.block, { on: this.state === 'cutting' && !this.returning && this.knife.visible, y: this.knifeY, z: this.knifeZ, vy: this.knifeVy });
    sndSlide(sl.on ? this.loose.slideN : 0);
    // Kamera: weich (smootherstep) zur Nahaufnahme und zurück
    const target = on ? 1 : 0;
    this.zoomTarget = target;
    if (this.zoomT !== target) this.zoomT = target > this.zoomT ? Math.min(1, this.zoomT + dt / ZOOM_TIME) : Math.max(0, this.zoomT - dt / ZOOM_TIME);
    const e = smoother(this.zoomT);
    if (e === this.zoomE && this.camVersion === this.camBase.version) return;
    this.zoomE = e;
    if (this.camVersion !== this.camBase.version) { this.camVersion = this.camBase.version; this.computeClose(); }
    const c = this.camera, B = this.camBase;
    c.position.lerpVectors(B.pos, this.closePos, e);
    _a.lerpVectors(B.look, this.closeLook, e);
    c.lookAt(_a);
    c.updateMatrixWorld();
  }

  /** Nahaufnahme: gleiche Blickrichtung wie sonst, Abstand so, dass Seife + Messer groß, aber ganz im Bild sind. */
  computeClose() {
    const c = this.camera, B = this.camBase;
    this.rig.fullTiltCenter(this.closeLook, -0.1);
    // etwas flacher und leicht von rechts: so liest man die Neigung (Seitenkante + Brett) und die Schnittkante
    _camDir.copy(CLOSE_DIR);
    const vf = THREE.MathUtils.degToRad(c.fov), hf = 2 * Math.atan(Math.tan(vf / 2) * c.aspect);
    const dist = Math.max(ZOOM_FIT_W / 2 / Math.tan(hf / 2), ZOOM_FIT_H / 2 / Math.tan(vf / 2));
    this.closePos.copy(this.closeLook).addScaledVector(_camDir, dist);
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
    const y = 0.25 + e * PRESENT_LIFT + Math.sin(time * 1.6) * 0.025 * e;
    this.bar.position.set(0, y, 0.1);
    const sc = this.showcase;
    sc.update(dt, time, 0, y, 0.1);
    this.bar.rotation.set(sc.pitch * e, sc.yaw, 0, 'YXZ');
  }
}
