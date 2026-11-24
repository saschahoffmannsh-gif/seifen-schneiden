// Bestell-Zettel: kleine Papierzettel, mit Klebestreifen vorne an das mittlere Brett geklebt
// (hängen unter der Brettkante, verdecken also die Seifen auf dem Brett nicht).
// Billig: EIN InstancedMesh für alle Zettel (Inhalt aus einem Canvas-Atlas, eine Kachel pro
// Zettel, wird nur bei Änderungen neu gezeichnet) + EIN InstancedMesh für die Klebestreifen.
// Antippen: nur beim Tippen, über die Bildschirmnähe.
import * as THREE from 'three';
import { drawShapeIcon } from './shapes.js';
import { MIDDLE_SHELF, WALL_Z, SHELF_FRONT_Z } from './setting/wall.js';

export const NOTE_COUNT = 3;
const W = 0.34, H = 0.4;                 // Zettelgröße (Welt-Einheiten)
const TW = 384, TH = Math.round(TW * H / W);   // höher aufgelöst: Schrift bleibt scharf
const SERIF = "'Fraunces', Georgia, serif", SANS = "'DM Sans', system-ui, sans-serif";
const soapRgb = (s) => `rgb(${s.base.map((c) => Math.round(c * 255)).join(',')})`;
const spaced = (g, px) => { if ('letterSpacing' in g) g.letterSpacing = px + 'px'; };
function rngFor(seed) { let t = seed >>> 0; return () => { t += 0x6d2b79f5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; }
const XS = [-1.08, -0.27, 0.54];        // Plätze (Bildmitte liegt bei x ~ -0.27)
const ROT = [0.06, -0.04, 0.05];

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const _p = new THREE.Vector3(), _s = new THREE.Vector3(), _v = new THREE.Vector3();
const _zero = new THREE.Matrix4().makeScale(0, 0, 0);

export class OrderNotes {
  constructor(scene) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = TW * NOTE_COUNT; this.canvas.height = TH;
    this.g = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 4;
    this.tex.generateMipmaps = true;

    const geo = new THREE.PlaneGeometry(W, H).translate(0, -H / 2, 0); // Ursprung oben in der Mitte
    // leicht gewölbt: Papier biegt sich unten etwas nach vorne
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) { const y = -pos.getY(i) / H; pos.setZ(i, y * y * 0.05); }
    geo.computeVertexNormals();
    geo.setAttribute('aTile', new THREE.InstancedBufferAttribute(new Float32Array(NOTE_COUNT).map((_, i) => i), 1));
    const mat = new THREE.MeshLambertMaterial({ map: this.tex, side: THREE.DoubleSide });
    mat.defines = { NOTE_TILES: NOTE_COUNT.toFixed(1) };
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aTile;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\n vMapUv = vec2((aTile + 0.01 + 0.98 * uv.x) / NOTE_TILES, uv.y);\n#endif');
    };
    mat.customProgramCacheKey = () => 'note';
    this.mesh = new THREE.InstancedMesh(geo, mat, NOTE_COUNT);
    const tapeMat = new THREE.MeshLambertMaterial({ color: 0xf1e6c8, transparent: true, opacity: 0.78 });
    this.tape = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.17, 0.065), tapeMat, NOTE_COUNT);
    for (const m of [this.mesh, this.tape]) {
      for (let i = 0; i < NOTE_COUNT; i++) m.setMatrixAt(i, _zero);
      m.frustumCulled = false;
      scene.add(m);
    }
    this.z = SHELF_FRONT_Z + 0.004;
    this.top = MIDDLE_SHELF.y + 0.015;        // Klebestreifen sitzt über der Brett-Oberkante
    this.orders = new Array(NOTE_COUNT).fill(null);
    this.active = new Uint8Array(NOTE_COUNT);
    this.pop = new Float32Array(NOTE_COUNT).fill(1);  // 0..1 Einblend-Animation
    this.wiggle = false;
    // Canvas-Schrift braucht geladene Webfonts: danach alle Zettel neu zeichnen
    if (document.fonts && document.fonts.load) {
      Promise.all([`italic 500 38px ${SERIF}`, `500 30px ${SERIF}`, `600 19px ${SANS}`].map((f) => document.fonts.load(f)))
        .then(() => { for (let i = 0; i < NOTE_COUNT; i++) if (this.orders[i]) this.draw(i); }).catch(() => {});
    }
  }

  /** Zettel i zeigt eine Bestellung (null = leer). Zeichnet nur diese Kachel neu. */
  set(i, order, { active = false, animate = false } = {}) {
    this.orders[i] = order; this.active[i] = active ? 1 : 0;
    this.draw(i);
    if (animate) this.pop[i] = 0;
    this.place(i, 0);
  }

  setActive(i, on) { this.active[i] = on ? 1 : 0; this.draw(i); }

  draw(i) {
    const g = this.g, x0 = i * TW, o = this.orders[i];
    g.clearRect(x0, 0, TW, TH);
    if (!o) { this.tex.needsUpdate = true; return; }
    const S = TW / 256;                      // Zeichnung in 256er-Koordinaten, Kachel höher aufgelöst
    g.save(); g.translate(x0, 0); g.scale(S, S);
    const w = 256, h = TH / S, cx = w / 2;
    // Papier: warmes Elfenbein, feine Körnung, Rand minimal dunkler (handgeschöpft)
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#fdf9f1'); grad.addColorStop(1, '#f4ecdd');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    const rnd = rngFor(i * 977 + (o.customer || '').length * 31);
    for (let k = 0; k < 700; k++) { g.fillStyle = rnd() < 0.5 ? 'rgba(120,90,50,0.05)' : 'rgba(255,255,255,0.35)'; g.fillRect(rnd() * w, rnd() * h, 1.2, 1.2); }
    const edge = g.createRadialGradient(cx, h * 0.45, h * 0.35, cx, h * 0.45, h * 0.75);
    edge.addColorStop(0, 'rgba(150,110,60,0)'); edge.addColorStop(1, 'rgba(150,110,60,0.14)');
    g.fillStyle = edge; g.fillRect(0, 0, w, h);
    // feiner Goldrahmen (doppelte Haarlinie)
    g.strokeStyle = 'rgba(184,149,93,0.75)'; g.lineWidth = 1.6; g.strokeRect(9, 9, w - 18, h - 18);
    g.strokeStyle = 'rgba(184,149,93,0.4)'; g.lineWidth = 0.8; g.strokeRect(13, 13, w - 26, h - 26);
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    // Kopf: Eyebrow + Name
    spaced(g, 3); g.fillStyle = '#9a7a52'; g.font = `600 13px ${SANS}`; g.fillText('BESTELLUNG', cx, 40); spaced(g, 0);
    g.fillStyle = '#392920'; g.font = `italic 500 38px ${SERIF}`;
    g.fillText(o.customer, cx, 82, w - 40);
    // kleines Ornament
    g.strokeStyle = 'rgba(184,149,93,0.8)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(cx - 44, 98); g.lineTo(cx - 8, 98); g.moveTo(cx + 8, 98); g.lineTo(cx + 44, 98); g.stroke();
    g.fillStyle = '#b8955d'; g.beginPath(); g.moveTo(cx, 93); g.lineTo(cx + 4, 98); g.lineTo(cx, 103); g.lineTo(cx - 4, 98); g.closePath(); g.fill();
    const bar = (items, bx, by, bw, bh) => {
      let acc = 0;
      g.save(); g.beginPath(); g.roundRect(bx, by, bw, bh, bh / 2); g.clip();
      items.forEach((m) => {
        const ww = bw * m.pct / 100;
        g.fillStyle = soapRgb(m.soap); g.fillRect(bx + acc, by, ww + 0.5, bh);
        if (acc > 0) { g.fillStyle = 'rgba(253,249,241,0.95)'; g.fillRect(bx + acc - 1, by, 2, bh); }
        acc += ww;
      });
      const sh = g.createLinearGradient(0, by, 0, by + bh);
      sh.addColorStop(0, 'rgba(255,255,255,0.35)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(60,40,20,0.12)');
      g.fillStyle = sh; g.fillRect(bx, by, bw, bh);
      g.restore();
      g.strokeStyle = 'rgba(90,60,30,0.25)'; g.lineWidth = 1; g.beginPath(); g.roundRect(bx, by, bw, bh, bh / 2); g.stroke();
    };
    if (o.items && o.items.length > 1) {
      // mehrere Seifen: je Seife „SEIFE k“ + Balken + eine Zeile mit den Anteilen
      const n = o.items.length, step = n > 2 ? 42 : 60, y0 = 114;
      o.items.forEach((it, k) => {
        const y = y0 + k * step;
        g.textAlign = 'left'; spaced(g, 2); g.fillStyle = '#9a7a52'; g.font = `600 11px ${SANS}`; g.fillText(`SEIFE ${k + 1}`, 26, y + 10); spaced(g, 0);
        bar(it.mix, 92, y, w - 118, 12);
        g.textAlign = 'center'; g.fillStyle = '#392920'; g.font = `500 ${n > 2 ? 14 : 15.5}px ${SANS}`;
        g.fillText(it.mix.map((m) => `${m.soap.name} ${m.pct}`).join(' · ') + ' %', cx, y + (n > 2 ? 30 : 34), w - 40);
      });
    } else {
      // Mischung: schlanker, abgerundeter Balken
      bar(o.mix, 26, 116, w - 52, 18);
      // Zeilen: Farbpunkt, Name, Prozent rechtsbündig
      o.mix.forEach((m, k) => {
        const y = 156 + k * 25;
        g.fillStyle = soapRgb(m.soap); g.beginPath(); g.arc(34, y - 6, 6.5, 0, 6.283); g.fill();
        g.strokeStyle = 'rgba(60,40,20,0.25)'; g.lineWidth = 1; g.stroke();
        g.textAlign = 'left'; g.fillStyle = '#4a3628'; g.font = `500 18px ${SANS}`; g.fillText(m.soap.name, 50, y, 140);
        g.textAlign = 'right'; g.fillStyle = '#392920'; g.font = `600 18px ${SANS}`; g.fillText(`${m.pct} %`, w - 26, y);
      });
      // Seifenform: Symbol + Name als eigene Zeile
      const fy = 156 + o.mix.length * 25;
      if (o.shape) {
        drawShapeIcon(g, o.shape.id, 34, fy - 6, 19, '#e3cba9', 'rgba(90,60,30,0.6)');
        g.textAlign = 'left'; g.fillStyle = '#4a3628'; g.font = `500 18px ${SANS}`; g.fillText('Form', 50, fy, 90);
        g.textAlign = 'right'; g.fillStyle = '#392920'; g.font = `600 18px ${SANS}`; g.fillText(o.shape.name, w - 26, fy, 150);
      }
      const yy = fy - 2 + (o.shape ? 25 : 0);
      if (o.additive) { g.textAlign = 'center'; g.fillStyle = '#8a6a3e'; g.font = `italic 400 18px ${SERIF}`; g.fillText(`mit ${o.additive.name}`, cx, yy, w - 40); }
    }
    // Trennlinie + Belohnung (Goldmünze)
    g.strokeStyle = 'rgba(184,149,93,0.45)'; g.lineWidth = 1; g.beginPath(); g.moveTo(30, h - 55); g.lineTo(w - 30, h - 55); g.stroke();
    const mx = cx - 26, my = h - 29;
    const cg = g.createRadialGradient(mx - 4, my - 5, 2, mx, my, 15);
    cg.addColorStop(0, '#f6e2a6'); cg.addColorStop(0.6, '#d9b35e'); cg.addColorStop(1, '#a98238');
    g.fillStyle = cg; g.beginPath(); g.arc(mx, my, 14, 0, 6.283); g.fill();
    g.strokeStyle = 'rgba(120,85,30,0.7)'; g.lineWidth = 1.2; g.beginPath(); g.arc(mx, my, 10, 0, 6.283); g.stroke();
    g.textAlign = 'left'; g.fillStyle = '#392920'; g.font = `500 28px ${SERIF}`; g.fillText(String(o.total || o.reward), mx + 22, my + 9);
    if (this.active[i]) {
      // Stempel „In Arbeit“: salbeigrün, leicht schräg, doppelte Kontur
      g.save(); g.translate(cx, h / 2 + 34); g.rotate(-0.26);
      g.globalAlpha = 0.85; g.strokeStyle = '#6f8a62'; g.lineWidth = 2.5; g.beginPath(); g.roundRect(-84, -26, 168, 52, 8); g.stroke();
      g.lineWidth = 1; g.beginPath(); g.roundRect(-78, -20, 156, 40, 5); g.stroke();
      g.fillStyle = '#6f8a62'; spaced(g, 3); g.font = `600 20px ${SANS}`; g.textAlign = 'center'; g.fillText('IN ARBEIT', 2, 7); spaced(g, 0);
      g.restore();
    }
    g.restore();
    this.tex.needsUpdate = true;
  }

  /** Matrix für Zettel i (mit optionalem Wackeln) setzen. */
  place(i, wob) {
    if (!this.orders[i]) { this.mesh.setMatrixAt(i, _zero); this.tape.setMatrixAt(i, _zero); }
    else {
      const k = this.pop[i], e = 1 - (1 - k) * (1 - k) * (1 - k);
      _q.setFromEuler(_e.set(-0.06 - (1 - e) * 1.2, 0, ROT[i] + wob));   // klappt beim Einblenden von oben herunter
      _p.set(XS[i], this.top, this.z);
      this.mesh.setMatrixAt(i, _m.compose(_p, _q, _s.set(1, 1, 1)));
      _q.setFromEuler(_e.set(0, 0, ROT[i] * 0.6 - 0.08));
      _p.set(XS[i] + 0.01, this.top - 0.01, this.z + 0.006);
      this.tape.setMatrixAt(i, _m.compose(_p, _q, _s.set(1, 1, 1)));
    }
    this.mesh.instanceMatrix.needsUpdate = true; this.tape.instanceMatrix.needsUpdate = true;
  }

  /** Pro Frame: Einblenden + leichtes Wackeln als Hinweis (nur wenn gewählt werden soll). */
  update(dt, time, wiggle) {
    for (let i = 0; i < NOTE_COUNT; i++) {
      const animating = this.pop[i] < 1;
      if (animating) this.pop[i] = Math.min(1, this.pop[i] + dt / 0.5);
      if (animating || wiggle || this.wiggle) this.place(i, wiggle ? Math.sin(time * 4 + i * 1.7) * 0.03 : 0);
    }
    this.wiggle = wiggle;
  }

  /** Antippen: welcher Zettel? (Bildschirmnähe zur Zettelmitte) */
  pick(ndc, camera) {
    // genaues Rechteck (etwas Rand für dicke Finger, aber nie über die Brett-Oberkante -> Seifen bleiben frei)
    for (let i = 0; i < NOTE_COUNT; i++) {
      if (!this.orders[i]) continue;
      _v.set(XS[i] - W / 2, this.top - 0.02, this.z).project(camera);
      const x0 = _v.x - 0.025, y1 = _v.y;
      _v.set(XS[i] + W / 2, this.top - H - 0.03, this.z).project(camera);
      if (ndc.x > x0 && ndc.x < _v.x + 0.025 && ndc.y < y1 && ndc.y > _v.y - 0.02) return i;
    }
    return -1;
  }

  screenPos(i, camera) { return _v.set(XS[i], this.top - H * 0.45, this.z).project(camera).clone(); }
}
