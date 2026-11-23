// Bestell-Zettel: kleine Papierzettel, mit Klebestreifen vorne an das mittlere Brett geklebt
// (hängen unter der Brettkante, verdecken also die Seifen auf dem Brett nicht).
// Billig: EIN InstancedMesh für alle Zettel (Inhalt aus einem Canvas-Atlas, eine Kachel pro
// Zettel, wird nur bei Änderungen neu gezeichnet) + EIN InstancedMesh für die Klebestreifen.
// Antippen: nur beim Tippen, über die Bildschirmnähe.
import * as THREE from 'three';
import { MIDDLE_SHELF, WALL_Z, SHELF_FRONT_Z } from './setting/wall.js';

export const NOTE_COUNT = 3;
const W = 0.34, H = 0.4;                 // Zettelgröße (Welt-Einheiten)
const TW = 256, TH = Math.round(TW * H / W);
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
    // Papier: cremeweiß, feine Linien, leicht vergilbter Rand
    const grad = g.createLinearGradient(x0, 0, x0, TH);
    grad.addColorStop(0, '#fffaf0'); grad.addColorStop(1, '#f6ead3');
    g.fillStyle = grad; g.fillRect(x0, 0, TW, TH);
    g.strokeStyle = 'rgba(120,150,200,0.25)'; g.lineWidth = 2;
    for (let y = 92; y < TH - 10; y += 30) { g.beginPath(); g.moveTo(x0 + 14, y); g.lineTo(x0 + TW - 14, y); g.stroke(); }
    g.strokeStyle = 'rgba(160,110,60,0.35)'; g.lineWidth = 4; g.strokeRect(x0 + 2, 2, TW - 4, TH - 4);
    g.fillStyle = '#8a5a3c'; g.textAlign = 'center';
    g.font = 'bold 26px Georgia, serif'; g.fillText('Bestellung', x0 + TW / 2, 44);
    g.fillStyle = '#4a2e22'; g.font = 'italic bold 40px Georgia, serif';
    g.fillText(o.customer, x0 + TW / 2, 92);
    // Mischung als gestapelter Balken (Anteile wie bestellt), darunter die Prozente
    const bx = x0 + 18, bw = TW - 36, by = 108, bh = 40;
    let acc = 0;
    g.save(); g.beginPath(); g.roundRect(bx, by, bw, bh, 12); g.clip();
    o.mix.forEach((m) => {
      const w = bw * m.pct / 100;
      g.fillStyle = `rgb(${m.soap.base.map((c) => Math.round(c * 255)).join(',')})`;
      g.fillRect(bx + acc, by, w + 0.5, bh);
      g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(bx + acc + 4, by + 5, Math.max(0, w - 8), 7);
      if (acc > 0) { g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(bx + acc - 1.5, by, 3, bh); }
      g.fillStyle = 'rgba(40,20,10,0.85)'; g.font = 'bold 20px system-ui, sans-serif'; g.textAlign = 'center';
      if (w > 40) g.fillText(`${m.pct}%`, bx + acc + w / 2, by + 30);
      acc += w;
    });
    g.restore();
    g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 3; g.beginPath(); g.roundRect(bx, by, bw, bh, 12); g.stroke();
    g.textAlign = 'left'; g.font = 'bold 22px Georgia, serif';
    o.mix.forEach((m, k) => {
      const y = 180 + k * 26;
      g.fillStyle = `rgb(${m.soap.base.map((c) => Math.round(c * 255)).join(',')})`;
      g.beginPath(); g.roundRect(x0 + 22, y - 16, 22, 18, 5); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 2; g.stroke();
      g.fillStyle = '#4a2e22'; g.fillText(`${m.pct} % ${m.soap.name}`, x0 + 52, y, TW - 70);
    });
    if (o.additive) { g.fillStyle = '#7a4a10'; g.font = 'italic bold 20px Georgia, serif'; g.textAlign = 'center'; g.fillText(`mit ${o.additive.name}`, x0 + TW / 2, 180 + o.mix.length * 26 + 2, TW - 24); }
    // Münze + Belohnung
    g.fillStyle = '#e8b830'; g.beginPath(); g.arc(x0 + TW / 2 - 36, 284, 16, 0, 6.283); g.fill();
    g.strokeStyle = '#b8860b'; g.lineWidth = 3; g.stroke();
    g.fillStyle = '#8a5a00'; g.font = 'bold 30px Georgia, serif'; g.textAlign = 'left';
    g.fillText(String(o.reward), x0 + TW / 2 - 12, 295);
    if (this.active[i]) {
      g.save(); g.translate(x0 + TW / 2, TH / 2 + 30); g.rotate(-0.35);
      g.strokeStyle = 'rgba(46,155,95,0.85)'; g.lineWidth = 6; g.strokeRect(-100, -30, 200, 60);
      g.fillStyle = 'rgba(46,155,95,0.9)'; g.font = 'bold 34px system-ui, sans-serif'; g.textAlign = 'center';
      g.fillText('IN ARBEIT', 0, 12); g.restore();
    }
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
