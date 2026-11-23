// Deko am Päckchen in 3D: Füllungen (Perlmutt-/Metallperlen, Blüten, Rosen, Lavendel …) als wenige
// InstancedMeshes im Päckchen, Deckel-Deko (Bänder, Siegel, Sticker, Anhänger, Naturdeko) als
// kleine Gruppen aus gemeinsam genutzten Geometrien/Materialien.
// Ziehen mit dem Finger: eine Handvoll Teile (bzw. ein Stück) schwebt über dem Finger
// (eigene kleine InstancedMeshes), beim Loslassen über dem Päckchen fällt es hinein.
// Keine Allokationen pro Frame: alle Vektoren/Matrizen sind vorab angelegt.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PKG } from './packages.js';
import { makeBlobTexture, rng } from './setting/textures.js';
import { TABLE_Y } from './setting/wall.js';
import { flowerGeometry, roseGeometry, sprigGeometry, petalGeometry, bowGeometry } from './decoGeo.js';

// in der Hand etwas größer (gut sichtbar unter dem Finger), beim Hineinfallen auf Normalgröße
const HAND_BOOST = 2;
const KINDS = ['pearl', 'metal', 'heart', 'flower', 'rose', 'sprig', 'petal'];
const CAP = 260, HAND = 24;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color(), _v = new THREE.Vector3();
const _zero = new THREE.Matrix4().makeScale(0, 0, 0);
const kindOf = (look) => look.geo;
const ROUND = { pearl: 1, metal: 1 };

function heartShape(k = 1) {
  const s = new THREE.Shape();
  for (let i = 0; i <= 40; i++) {
    const t = i / 40 * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3, y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    if (i === 0) s.moveTo(x / 17 * k, (y + 2.5) / 17 * k); else s.lineTo(x / 17 * k, (y + 2.5) / 17 * k);
  }
  return s;
}

/** Text mittig, verkleinert bis er in maxW passt. */
function fitText(c, text, x, y, maxW, style, family, size, color) {
  c.fillStyle = color; c.textAlign = 'center';
  let s = size; do { c.font = `${style} ${s}px ${family}`; s -= 2; } while (c.measureText(text).width > maxW && s > 12);
  c.fillText(text, x, y);
}

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export class Deco {
  constructor(scene, packages) {
    this.scene = scene; this.packages = packages;
    this.geo = {
      pearl: new THREE.SphereGeometry(1, 20, 14),
      metal: new THREE.SphereGeometry(1, 16, 12),
      heart: new THREE.ExtrudeGeometry(heartShape(1), { depth: 0.35, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 3 }).center().rotateX(-Math.PI / 2),
      flower: flowerGeometry(),
      rose: roseGeometry(),
      sprig: sprigGeometry(),
      petal: petalGeometry(),
    };
    const veg = { vertexColors: true, side: THREE.DoubleSide };
    this.mat = {
      // Perlmutt: schillernd (Iridescence), weicher Glanz (Sheen), Klarlack-Reflexe aus der Umgebung
      pearl: new THREE.MeshPhysicalMaterial({ roughness: 0.22, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.08,
        iridescence: 1, iridescenceIOR: 1.6, iridescenceThicknessRange: [180, 520], sheen: 0.6, sheenRoughness: 0.35, sheenColor: 0xfff2f6, envMapIntensity: 1.6 }),
      metal: new THREE.MeshStandardMaterial({ roughness: 0.16, metalness: 1, envMapIntensity: 1.8 }),
      heart: new THREE.MeshPhysicalMaterial({ roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.15 }),
      flower: new THREE.MeshStandardMaterial({ ...veg, roughness: 0.65 }),
      rose: new THREE.MeshStandardMaterial({ ...veg, roughness: 0.75 }),
      sprig: new THREE.MeshStandardMaterial({ ...veg, roughness: 0.8 }),
      petal: new THREE.MeshPhysicalMaterial({ ...veg, roughness: 0.45, sheen: 0.8, sheenRoughness: 0.4, sheenColor: 0xffffff }),
    };
    // Inhalt (im Päckchen-Raum) und Hand (Welt-Raum)
    this.content = {}; this.hand = {};
    for (const k of KINDS) {
      const c = new THREE.InstancedMesh(this.geo[k], this.mat[k], CAP);
      const h = new THREE.InstancedMesh(this.geo[k], this.mat[k], HAND);
      for (const m of [c, h]) { for (let i = 0; i < m.count; i++) { m.setMatrixAt(i, _zero); m.setColorAt(i, _c.set(1, 1, 1)); } m.frustumCulled = false; m.count = 0; }
      packages.content.add(c); scene.add(h);
      this.content[k] = c; this.hand[k] = h;
    }
    this.records = [];                       // { item, kind, m: Matrix4, color: Color }
    this.lidItems = {};                      // group -> { item, obj }
    this.applied = [];                       // Reihenfolge (für Rückgängig)
    this.lidMats = new Map();
    // Hand-Zustand (vorab angelegt)
    this.handItem = null; this.handObj = null;
    this.handOff = Array.from({ length: HAND }, () => new THREE.Vector3());
    this.handRot = Array.from({ length: HAND }, () => new THREE.Euler());
    this.handScale = Array.from({ length: HAND }, () => new THREE.Vector3());
    this.handKind = new Array(HAND).fill('pearl');
    this.handN = 0;
    this.handPos = new THREE.Vector3();
    this.from = Array.from({ length: HAND }, () => new THREE.Vector3());
    this.to = Array.from({ length: HAND }, () => new THREE.Vector3());
    this.toLocal = Array.from({ length: HAND }, () => new THREE.Matrix4());
    this.anim = null;
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: makeBlobTexture(), transparent: true, depthWrite: false, opacity: 0.8 }));
    this.shadow.visible = false; scene.add(this.shadow);
    this.r = rng(99);
  }

  // ---------- Bonus / Zustand ----------
  get bonus() { let b = 0; for (const it of this.applied) b += it.bonus; return b; }
  has(item) { return this.applied.includes(item); }

  reset() {
    this.records.length = 0; this.applied.length = 0;
    for (const g of Object.keys(this.lidItems)) this.removeLid(g);
    this.rebuild();
    this.endHand();
    this.packages.suppressBow = false;
  }

  /** Inhalt-InstancedMeshes aus den Einträgen neu schreiben (nur bei Änderungen). */
  rebuild() {
    for (const k of KINDS) this.content[k].count = 0;
    for (const r of this.records) {
      const m = this.content[r.kind];
      if (m.count >= CAP) continue;
      m.setMatrixAt(m.count, r.m); m.setColorAt(m.count, r.color); m.count++;
    }
    for (const k of KINDS) { const m = this.content[k]; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  }

  /** Letzte Deko wieder entfernen. phase: nur Deko dieser Phase. */
  undo(phase, phaseOf) {
    for (let i = this.applied.length - 1; i >= 0; i--) {
      const it = this.applied[i];
      if (phaseOf(it) !== phase) continue;
      this.applied.splice(i, 1);
      if (it.look.geo) { for (let k = this.records.length - 1; k >= 0; k--) if (this.records[k].item === it) this.records.splice(k, 1); this.rebuild(); }
      else this.removeLid(it.group);
      return it;
    }
    return null;
  }

  removeLid(group) {
    const e = this.lidItems[group];
    if (!e) return;
    this.packages.lidContent.remove(e.obj);
    e.obj.traverse((m) => { if (m.userData.own) m.geometry.dispose(); });
    delete this.lidItems[group];
    if (group === 'baender') this.packages.setBowHidden(false);
  }

  // ---------- Deckel-Deko bauen ----------
  lidMat(key, make) { if (!this.lidMats.has(key)) this.lidMats.set(key, make()); return this.lidMats.get(key); }

  buildLidItem(item, foot, lidTop, heart = false) {
    const L = item.look, g = new THREE.Group(), box = this.lidMat('boxGeo', () => new THREE.BoxGeometry(1, 1, 1));
    const add = (geo, mat, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => {
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz); g.add(m); return m;
    };
    if (L.type === 'ribbon') {
      const tex = L.tex ? this.lidMat('tex' + L.tex, () => {
        const t = canvasTex(64, 64, (c, w, h) => {
          c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h);
          if (L.tex === 'twine') { c.strokeStyle = '#c62f2f'; c.lineWidth = 5; for (let k = -64; k < 128; k += 12) { c.beginPath(); c.moveTo(k, 0); c.lineTo(k + 20, h); c.stroke(); } }
          if (L.tex === 'raffia') { for (let k = 0; k < w; k += 3) { c.fillStyle = `rgba(150,110,50,${0.15 + (k % 7) * 0.04})`; c.fillRect(k, 0, 1.5, h); } }
          if (L.tex === 'gingham') { c.fillStyle = 'rgba(200,40,60,0.45)'; for (let k = 0; k < 64; k += 16) { c.fillRect(k, 0, 8, h); c.fillRect(0, k, w, 8); } }
          if (L.tex === 'lace') { c.clearRect(0, 0, w, h); c.fillStyle = '#fff'; c.fillRect(0, 0, w, 8); c.fillRect(0, h - 8, w, 8); for (let x = 8; x < w; x += 16) for (let y = 16; y < h - 8; y += 16) { c.beginPath(); c.arc(x, y, 6, 0, 6.283); c.lineWidth = 2.5; c.strokeStyle = '#fff'; c.stroke(); } }
        });
        t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 6); return t;
      }) : null;
      const mat = this.lidMat('rib' + item.id, () => {
        const o = { color: L.color, roughness: L.rough, metalness: L.metal || 0, map: tex, alphaTest: L.tex === 'lace' ? 0.5 : 0, side: THREE.DoubleSide };
        if (L.opacity) Object.assign(o, { transparent: true, opacity: L.opacity, depthWrite: false });
        // Satin: weicher Glanz an den Kanten; Gold: Metall mit Umgebungsreflexen
        return L.sheen ? new THREE.MeshPhysicalMaterial({ ...o, sheen: 1, sheenRoughness: 0.25, sheenColor: 0xffffff, clearcoat: 0.4, clearcoatRoughness: 0.2 })
          : new THREE.MeshStandardMaterial({ ...o, envMapIntensity: L.metal ? 3 : 1 });
      });
      // Herz: Quer-Band durch die beiden Bögen, Längs-Band von der Kerbe bis zur Spitze (nicht über den Rand hinaus)
      let lx = foot[0] + 2 * PKG.lidPad + 0.012, lz = foot[1] + 2 * PKG.lidPad + 0.012, zx = 0, zc = 0;
      if (heart) { lx *= 0.9; zx = -lz * 0.17; zc = lz * 0.09; lz *= 0.8; }
      const y = lidTop + 0.004;
      // Band läuft einmal ums Paket: oben über Kreuz, an den Seiten bis zur Unterkante (Herz: nur oben).
      // Sechseck: beide Bänder laufen über flache Seiten (90° und 30°), nicht über die Ecken.
      const lh = lidTop + 0.004, bh = this.packages.lidY, pad = 2 * PKG.lidPad;
      const hex = this.packages.types[this.packages.active]?.shape === 'hex' && !heart;
      const straps = heart ? [[0, lx / 2, 0, zx], [Math.PI / 2, lz / 2, 0, zc]]
        : hex ? [[Math.PI / 2, lz / 2, 0, 0], [Math.PI / 6, lz / 2, 0, 0]]
          : [[0, lx / 2, 0, 0], [Math.PI / 2, lz / 2, 0, 0]];
      straps.forEach(([ang, half, ox, oz], k) => {
        const dx = Math.cos(ang), dz = -Math.sin(ang);
        add(box, mat, ox, y + k * 0.001, oz, half * 2, 0.006, L.w, 0, ang, 0);
        if (heart) return;
        for (const s of [-1, 1]) {
          add(box, mat, ox + s * dx * half, y - lh / 2, oz + s * dz * half, 0.006, lh, L.w, 0, ang, 0);
          const hb = half - pad / 2;
          add(box, mat, ox + s * dx * hb, -bh / 2, oz + s * dz * hb, 0.006, bh, L.w, 0, ang, 0);
        }
      });
      // echte Schleife: zwei Schlaufen, Knoten, zwei Enden
      const k = L.w < 0.04 ? 0.75 : 1;
      const bg = this.lidMat('bow' + L.w, () => bowGeometry(L.w * (L.w < 0.04 ? 1.4 : 1), 0.2));
      const bow = new THREE.Mesh(bg, mat);
      bow.scale.setScalar(k * 1.15); bow.position.set(0, y + 0.004, zc * 0 + zx); g.add(bow);
    } else if (L.type === 'woodtag') {
      // Holzscheibe mit Jahresringen, eingebranntem Namen und Rinde am Rand, an Schnur
      const name = this.customer || '';
      const top = this.lidMat('wood' + name, () => new THREE.MeshStandardMaterial({ roughness: 0.8, map: canvasTex(256, 256, (c) => {
        const gr = c.createRadialGradient(128, 128, 10, 128, 128, 128); gr.addColorStop(0, '#e9cf9f'); gr.addColorStop(1, '#d1aa72');
        c.fillStyle = gr; c.beginPath(); c.arc(128, 128, 127, 0, 6.283); c.fill();
        c.strokeStyle = 'rgba(140,96,50,0.35)'; for (let r = 14; r < 120; r += 9 + (r % 5)) { c.lineWidth = 1.5; c.beginPath(); c.ellipse(132, 126, r, r * 0.94, 0.2, 0, 6.283); c.stroke(); }
        c.fillStyle = '#4a2a12'; c.beginPath(); c.arc(128, 40, 10, 0, 6.283); c.fill();
        fitText(c, name || 'Für dich', 128, 150, 190, 'bold', 'Georgia, serif', 64, 'rgba(70,35,12,0.92)');
      }) }));
      const bark = this.lidMat('bark', () => new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 1 }));
      // Scheibe mit Rinde; die bemalte Holzfläche ist eine eigene Kreisfläche (richtige Leserichtung)
      const disc = new THREE.Group(); disc.position.y = lidTop + 0.01; disc.rotation.set(-0.08, 0.15, 0.06); g.add(disc);
      disc.add(new THREE.Mesh(this.lidMat('woodG', () => new THREE.CylinderGeometry(0.1, 0.1, 0.018, 36)), bark));
      const face = new THREE.Mesh(this.lidMat('woodF', () => new THREE.CircleGeometry(0.094, 36).rotateX(-Math.PI / 2)), top);
      face.position.y = 0.0095; disc.add(face);
    } else if (L.type === 'tag') {
      // Hänge-Anhänger (Kraftpapier o. ä.) mit Loch, Öse und dem Namen der Kundin/des Kunden
      const name = this.customer || '';
      const mat = this.lidMat('tag' + item.id + name, () => new THREE.MeshStandardMaterial({ roughness: 0.85, side: THREE.DoubleSide, alphaTest: 0.5, map: canvasTex(256, 128, (c, w, h) => {
        c.beginPath(); c.moveTo(40, 4); c.lineTo(w - 6, 4); c.lineTo(w - 6, h - 4); c.lineTo(40, h - 4); c.lineTo(6, h - 38); c.lineTo(6, 38); c.closePath();
        c.fillStyle = L.paper; c.fill();
        // Papierfasern
        for (let k = 0; k < 160; k++) { c.fillStyle = `rgba(80,50,20,${Math.random() * 0.06})`; c.fillRect(Math.random() * w, Math.random() * h, 2, 1); }
        c.strokeStyle = L.edge; c.lineWidth = 3; c.setLineDash([6, 4]);
        c.beginPath(); c.moveTo(44, 12); c.lineTo(w - 14, 12); c.lineTo(w - 14, h - 12); c.lineTo(44, h - 12); c.lineTo(14, h - 40); c.lineTo(14, 40); c.closePath(); c.stroke(); c.setLineDash([]);
        // Öse
        c.fillStyle = L.edge; c.beginPath(); c.arc(34, 64, 13, 0, 6.283); c.fill();
        c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.arc(34, 64, 7, 0, 6.283); c.fill(); c.globalCompositeOperation = 'source-over';
        c.fillStyle = L.ink; c.textAlign = 'center'; c.font = 'italic 22px Georgia, serif'; c.fillText(name ? 'Für' : 'Für dich', 150, 44);
        if (name) fitText(c, name, 150, 96, 170, 'italic bold', 'Georgia, serif', 50, L.ink);
      }) }));
      const geo = this.lidMat('tagG', () => new THREE.PlaneGeometry(0.34, 0.17).rotateX(-Math.PI / 2));
      const t = new THREE.Mesh(geo, mat); t.position.set(0, lidTop + 0.006, 0); t.rotation.set(0.05, 0.28, 0.02); g.add(t);
      t.name = 'tag';
    } else if (L.type === 'card') {
      const name = this.customer || '';
      const mat = this.lidMat('card' + name, () => new THREE.MeshLambertMaterial({ map: canvasTex(256, 176, (c, w, h) => {
        c.fillStyle = '#fffaf0'; c.fillRect(0, 0, w, h);
        c.strokeStyle = '#e2b6c0'; c.lineWidth = 5; c.strokeRect(9, 9, w - 18, h - 18);
        c.fillStyle = '#b5475f'; c.textAlign = 'center'; c.font = 'italic bold 34px Georgia, serif';
        c.fillText('Alles Liebe', 128, 76);
        if (name) fitText(c, 'für ' + name, 128, 128, 210, 'italic', 'Georgia, serif', 30, '#7a4a56');
      }) }));
      add(box, mat, 0, lidTop + 0.004, 0, 0.27, 0.006, 0.19, 0, -0.25, 0);
    } else if (L.type === 'sticker') {
      const top = this.lidMat('st' + item.id, () => new THREE.MeshLambertMaterial({ map: canvasTex(128, 128, (c, w, h) => {
        c.fillStyle = L.color; c.beginPath(); c.arc(64, 64, 62, 0, 6.283); c.fill();
        c.strokeStyle = L.ink; c.lineWidth = 3; c.setLineDash([5, 4]); c.beginPath(); c.arc(64, 64, 52, 0, 6.283); c.stroke(); c.setLineDash([]);
        c.fillStyle = L.ink; c.textAlign = 'center'; c.font = L.text.length > 2 ? 'italic bold 26px Georgia, serif' : 'bold 64px Georgia, serif';
        c.fillText(L.text, 64, L.text.length > 2 ? 74 : 86);
      }) }));
      const side = this.lidMat('stS', () => new THREE.MeshLambertMaterial({ color: 0xf4efe6 }));
      const geo = this.lidMat('stG', () => new THREE.CylinderGeometry(0.1, 0.1, 0.005, 32));
      const m = new THREE.Mesh(geo, [side, top, side]); m.position.y = lidTop + 0.003; m.rotation.y = 0.3; g.add(m);
    } else if (L.type === 'washi') {
      const mat = this.lidMat('washi', () => new THREE.MeshLambertMaterial({ transparent: true, opacity: 0.92, map: canvasTex(128, 32, (c, w, h) => {
        c.fillStyle = L.color; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(255,255,255,0.7)';
        for (let x = 0; x < w; x += 16) { c.beginPath(); c.arc(x + 8, 16, 4, 0, 6.283); c.fill(); }
      }) }));
      add(box, mat, 0.02, lidTop + 0.003, 0, 0.42, 0.003, 0.07, 0, 0.7, 0);
    } else if (L.type === 'seal') {
      const mat = this.lidMat('seal' + item.id, () => new THREE.MeshStandardMaterial({ color: L.color, roughness: 0.35, metalness: L.metal || 0.05 }));
      const blob = this.lidMat('sealG', () => {
        const gg = new THREE.CylinderGeometry(1, 1, 1, 18); const p = gg.attributes.position;
        for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)), k = 1 + Math.sin(a * 7) * 0.06; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
        gg.computeVertexNormals(); return gg;
      });
      add(blob, mat, 0, lidTop + 0.012, 0, 0.085, 0.024, 0.085);
      add(blob, mat, 0, lidTop + 0.026, 0, 0.058, 0.01, 0.058);
    } else if (L.type === 'orange') {
      const top = this.lidMat('orange', () => new THREE.MeshStandardMaterial({ roughness: 0.6, map: canvasTex(128, 128, (c) => {
        c.fillStyle = '#c25a12'; c.beginPath(); c.arc(64, 64, 63, 0, 6.283); c.fill();
        c.fillStyle = '#f3c07a'; c.beginPath(); c.arc(64, 64, 55, 0, 6.283); c.fill();
        for (let k = 0; k < 10; k++) { const a = k / 10 * 6.283; c.fillStyle = '#e47a1e'; c.beginPath(); c.moveTo(64, 64); c.arc(64, 64, 50, a + 0.06, a + 0.57); c.fill(); }
      }) }));
      const side = this.lidMat('orangeS', () => new THREE.MeshLambertMaterial({ color: 0xc25a12 }));
      const m = new THREE.Mesh(this.lidMat('orangeG', () => new THREE.CylinderGeometry(0.085, 0.085, 0.014, 28)), [side, top, side]);
      m.position.y = lidTop + 0.008; m.rotation.set(0.12, 0, 0.1); g.add(m);
    } else if (L.type === 'cinnamon') {
      const mat = this.lidMat('cin', () => new THREE.MeshLambertMaterial({ color: 0x8a4a22 }));
      const cyl = this.lidMat('cinG', () => new THREE.CylinderGeometry(0.018, 0.018, 0.22, 10));
      for (const dz of [-0.02, 0.02, 0]) add(cyl, mat, 0, lidTop + 0.02 + (dz === 0 ? 0.028 : 0), dz, 1, 1, 1, 0, 0, Math.PI / 2);
      const tw = this.lidMat('twineMat', () => new THREE.MeshLambertMaterial({ color: 0xd9c7a8 }));
      add(box, tw, 0, lidTop + 0.03, 0, 0.012, 0.07, 0.07);
    } else if (L.type === 'eucalyptus') {
      const stem = this.lidMat('eucS', () => new THREE.MeshLambertMaterial({ color: 0x6f7f5a }));
      const leaf = this.lidMat('eucL', () => new THREE.MeshLambertMaterial({ color: 0x9db59a }));
      const sph = this.lidMat('sph', () => new THREE.SphereGeometry(1, 10, 8));
      add(box, stem, 0, lidTop + 0.008, 0, 0.26, 0.008, 0.008, 0, 0.3, 0);
      for (let k = 0; k < 7; k++) { const t = -0.11 + k * 0.035, s = k % 2 ? 1 : -1; add(sph, leaf, t * Math.cos(0.3), lidTop + 0.012, -t * Math.sin(0.3) + s * 0.03, 0.03, 0.006, 0.026); }
    } else if (L.type === 'cone') {
      const mat = this.lidMat('cone', () => new THREE.MeshLambertMaterial({ color: 0x7a4a26, flatShading: true }));
      const cg = this.lidMat('coneG', () => new THREE.ConeGeometry(1, 1, 7));
      for (let k = 0; k < 4; k++) add(cg, mat, -0.03 + k * 0.022, lidTop + 0.035, 0, 0.042 - k * 0.006, 0.05, 0.042 - k * 0.006, 0, 0, -Math.PI / 2);
    }
    return g;
  }

  /** Schnur vom Loch des Anhängers zum Knoten der Schleife (Mitte des Deckels). */
  addTagString(o, slot, type) {
    const pk = this.packages, i = pk.active, top = pk.lidTop(i) + 0.007;
    const hole = type === 'tag' ? new THREE.Vector3(-0.121, top, 0.034) : new THREE.Vector3(0, top + 0.014, -0.07);
    const zx = pk.types[i].shape === 'heart' ? -0.08 : 0;
    const knot = new THREE.Vector3(-slot.x, top + 0.004, -slot.z + zx);
    const mid = hole.clone().lerp(knot, 0.5); mid.x += 0.03; mid.z += 0.03;
    const curve = new THREE.CatmullRomCurve3([hole, hole.clone().lerp(mid, 0.5).add(new THREE.Vector3(0, 0.002, 0.012)), mid, knot]);
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.006, 5), this.lidMat('stringMat', () => new THREE.MeshLambertMaterial({ color: 0xb89870 })));
    m.userData.own = true; o.add(m);
  }

  /** Platz der Deckel-Deko je Gruppe (Deckel-Koordinaten). */
  lidSlot(group, foot, out) {
    const hz = foot[1] / 2 + PKG.lidPad, shape = this.packages.types[this.packages.active].shape;
    if (group === 'baender') return out.set(0, 0, 0);
    // Siegel/Sticker neben die Schleife (auf dem Knoten wäre es verdeckt)
    if (group === 'siegel') return shape === 'heart' ? out.set(-0.27, 0, -0.02) : out.set(-0.24, 0, 0.12);
    if (group === 'anhaenger') return shape === 'heart' ? out.set(0.2, 0, 0.1) : out.set(0.24, 0, Math.min(0.2, hz - 0.12));
    return out.set(0.24, 0, -0.13);
  }

  // ---------- Hand (schwebt beim Ziehen über dem Finger) ----------
  beginHand(item, pos) {
    this.endHand();
    this.handItem = item;
    this.handPos.copy(pos);
    const L = item.look;
    if (L.geo) {
      const n = Math.min(HAND, L.n), k = kindOf(L), r = this.r;
      this.handN = n;
      for (let i = 0; i < n; i++) {
        const a = r() * 6.283, d = Math.sqrt(r()) * (L.geo === 'sprig' ? 0.1 : 0.085);
        this.handOff[i].set(Math.cos(a) * d, (r() - 0.5) * 0.05, Math.sin(a) * d);
        this.handRot[i].set((r() - 0.5) * 1.2, r() * 6.283, (r() - 0.5) * 1.2);
        this.partScale(L, this.handScale[i]);
        this.handKind[i] = k;
        const h = this.hand[k];
        _c.set(L.colors[i % L.colors.length]);
        h.setColorAt(h.count, _c); h.count++;
      }
      this.hand[k].instanceColor.needsUpdate = true;
    } else {
      const pk = this.packages, i = pk.active;
      this.handObj = this.buildLidItem(item, pk.footprint(i), pk.lidTop(i), pk.types[i].shape === 'heart');
      this.scene.add(this.handObj);
    }
    this.shadow.visible = true;
    this.moveHand(pos, 0);
  }

  partScale(L, out) {
    // etwas größer als in echt, damit es auf dem Handy gut zu sehen ist
    const s = (L.size[0] + this.r() * (L.size[1] - L.size[0])) * 1.7;
    return out.set(s, s, s);
  }

  /** Hand an Position pos (Welt), sanftes Schaukeln. Keine Allokationen. */
  moveHand(pos, time) {
    this.handPos.copy(pos);
    const bob = Math.sin(time * 3.2) * 0.02, sway = Math.sin(time * 2.1) * 0.12;
    if (this.handObj) {
      this.handObj.position.set(pos.x, pos.y + bob, pos.z);
      this.handObj.rotation.set(0.25 + sway * 0.4, sway, sway * 0.5);
    } else if (this.handN) {
      const k = this.handKind[0], h = this.hand[k];
      for (let i = 0; i < this.handN; i++) {
        const o = this.handOff[i];
        _p.set(pos.x + o.x + Math.sin(time * 2 + i) * 0.006, pos.y + o.y + bob, pos.z + o.z);
        _e.copy(this.handRot[i]); _e.y += sway; _q.setFromEuler(_e);
        _s.copy(this.handScale[i]).multiplyScalar(HAND_BOOST);
        h.setMatrixAt(i, _m.compose(_p, _q, _s));
      }
      h.instanceMatrix.needsUpdate = true;
    }
    const hgt = pos.y - TABLE_Y, sc = 0.32 / (1 + hgt * 0.6);
    this.shadow.position.set(pos.x, TABLE_Y + 0.006, pos.z);
    this.shadow.scale.set(sc, 1, sc * 0.8);
    this.shadow.material.opacity = 0.75 / (1 + hgt);
  }

  endHand() {
    for (const k of KINDS) { this.hand[k].count = 0; }
    this.handN = 0;
    if (this.handObj) { this.scene.remove(this.handObj); this.handObj = null; }
    this.handItem = null;
    this.shadow.visible = false;
  }

  // ---------- Fallenlassen ----------
  /** Zufälliger Platz im Päckchen (Päckchen-Koordinaten): neben der Seife oder obendrauf. */
  restSpot(L, out, outScale) {
    const pk = this.packages, i = pk.active, shape = pk.types[i].shape, fit = pk.fit(i), r = this.r;
    const [fw, fd] = pk.footprint(i);
    let x = 0, z = 0;
    const soapFirst = r() < 0.75;   // meistens auf der Seife (gut sichtbar), sonst daneben
    for (let k = 0; k < 30; k++) {
      if (soapFirst) { x = (r() - 0.5) * 0.8 * fit.s; z = fit.dz + (r() - 0.5) * 0.5 * fit.s; break; }
      x = (r() - 0.5) * fw; z = (r() - 0.5) * fd;
      if (shape === 'box' && Math.abs(x) < fw / 2 - 0.07 && Math.abs(z) < fd / 2 - 0.07) break;
      if ((shape === 'round' || shape === 'hex') && Math.hypot(x, z) < fw / 2 * (shape === 'hex' ? 0.84 : 1) - 0.07) break;
      if (shape === 'heart' && (x / 0.56) ** 2 + ((z + 0.07) / 0.5) ** 2 < 1) break;
    }
    this.partScale(L, outScale);
    const onSoap = Math.abs(x) < 0.425 * fit.s && Math.abs(z - fit.dz) < 0.28 * fit.s;
    const top = PKG.wall + 0.306 * fit.s;
    const y = onSoap ? top + outScale.y * (ROUND[L.geo] ? 0.6 : 0.25) + 0.004 : 0.04 + r() * 0.13;
    // nicht durch den Deckel (Deckel-Oberseite bei lidY + lidH)
    return out.set(x, Math.min(y, this.packages.lidY + PKG.lidH - 0.008 - outScale.y * (ROUND[L.geo] ? 1 : 0.5)), z);
  }

  /** Loslassen über dem Päckchen: Teile fallen hinein bzw. Deckel-Deko legt sich auf den Deckel. */
  drop(onDone) {
    const item = this.handItem, L = item.look, pk = this.packages;
    if (L.geo) {
      const n = this.handN;
      for (let i = 0; i < n; i++) {
        const o = this.handOff[i];
        this.from[i].set(this.handPos.x + o.x, this.handPos.y + o.y, this.handPos.z + o.z);
        this.restSpot(L, _v, this.handScale[i]);
        _q.setFromEuler(_e.set((this.r() - 0.5) * 0.5, this.r() * 6.283, (this.r() - 0.5) * 0.5));
        this.toLocal[i].compose(_v, _q, this.handScale[i]);
        this.to[i].copy(_v).applyMatrix4(pk.content.matrix);
      }
      this.anim = { t: 0, dur: 0.5, kind: 'fill', item, onDone };
    } else {
      const i = pk.active, foot = pk.footprint(i);
      this.removeLid(item.group);
      this.lidSlot(item.group, foot, _v);
      this.to[0].copy(_v).applyMatrix4(pk.lidContent.matrix);
      this.from[0].copy(this.handObj.position);
      this.anim = { t: 0, dur: 0.4, kind: 'lid', item, onDone, slot: _v.clone() };
    }
    this.shadow.visible = false;
  }

  /** Loslassen daneben: fällt herunter und verschwindet (kostet nichts). */
  fallAway() {
    for (let i = 0; i < this.handN; i++) { const o = this.handOff[i]; this.from[i].set(this.handPos.x + o.x, this.handPos.y + o.y, this.handPos.z + o.z); }
    if (this.handObj) this.from[0].copy(this.handObj.position);
    this.anim = { t: 0, dur: 0.45, kind: 'away' };
    this.shadow.visible = false;
  }

  get busy() { return !!this.anim; }

  update(dt) {
    const a = this.anim;
    if (!a) return;
    a.t = Math.min(1, a.t + dt / a.dur);
    const t = a.t, fall = t * t;
    if (a.kind === 'fill') {
      const h = this.hand[this.handKind[0]];
      for (let i = 0; i < this.handN; i++) {
        const tt = Math.min(1, Math.max(0, t * 1.25 - i * 0.025)), f = tt * tt;
        _p.lerpVectors(this.from[i], this.to[i], f);
        _e.copy(this.handRot[i]); _e.x += tt * 3; _q.setFromEuler(_e);
        _s.copy(this.handScale[i]).multiplyScalar(HAND_BOOST + (1 - HAND_BOOST) * f);
        h.setMatrixAt(i, _m.compose(_p, _q, _s));
      }
      h.instanceMatrix.needsUpdate = true;
    } else if (a.kind === 'lid') {
      const o = this.handObj;
      o.position.lerpVectors(this.from[0], this.to[0], fall);
      const sq = t > 0.8 ? 1 - Math.sin((t - 0.8) / 0.2 * Math.PI) * 0.15 : 1;
      o.scale.set(1, sq, 1);
      o.rotation.x *= 0.85; o.rotation.z *= 0.85;
    } else {
      const h = this.handN ? this.hand[this.handKind[0]] : null;
      for (let i = 0; i < this.handN; i++) {
        _p.copy(this.from[i]); _p.y -= fall * 0.8;
        _q.setFromEuler(this.handRot[i]);
        _s.copy(this.handScale[i]).multiplyScalar(HAND_BOOST * (1 - t));
        h.setMatrixAt(i, _m.compose(_p, _q, _s));
      }
      if (h) h.instanceMatrix.needsUpdate = true;
      if (this.handObj) { this.handObj.position.y = this.from[0].y - fall * 0.8; this.handObj.scale.setScalar(Math.max(0.001, 1 - t)); }
    }
    if (t < 1) return;
    this.anim = null;
    if (a.kind === 'fill') {
      for (let i = 0; i < this.handN; i++) {
        _c.set(a.item.look.colors[i % a.item.look.colors.length]);
        this.records.push({ item: a.item, kind: this.handKind[i], m: this.toLocal[i].clone(), color: _c.clone() });
      }
      if (!this.applied.includes(a.item)) this.applied.push(a.item);
      this.rebuild();
      this.endHand();
    } else if (a.kind === 'lid') {
      const o = this.handObj; this.handObj = null;
      this.scene.remove(o);
      o.position.copy(a.slot); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1);
      this.packages.lidContent.add(o);
      this.lidItems[a.item.group] = { item: a.item, obj: o };
      if (a.item.look.type === 'tag' || a.item.look.type === 'woodtag') this.addTagString(o, a.slot, a.item.look.type);
      if (a.item.group === 'baender') this.packages.setBowHidden(true);
      const prev = this.applied.findIndex((x) => x.group === a.item.group);
      if (prev >= 0) this.applied.splice(prev, 1);
      this.applied.push(a.item);
      this.endHand();
    } else this.endHand();
    if (a.onDone) a.onDone();
  }

  /** Füllung: wie viele Teile dieser Sorte schon drin sind (Obergrenze pro Sorte). */
  countOf(item) { let n = 0; for (const r of this.records) if (r.item === item) n++; return n; }

  /** Vorschaubilder (einmalig) für die Auswahl: gleiche 3D-Teile, auf einem Schälchen bzw. Kärtchen. */
  makeThumbs(renderer, items) {
    if (this.thumbs) return this.thumbs;
    const S = 192, rt = new THREE.WebGLRenderTarget(S, S);
    rt.texture.colorSpace = THREE.SRGBColorSpace;
    const sc = new THREE.Scene();
    sc.environment = this.scene.environment; sc.environmentIntensity = 0.6;
    sc.add(new THREE.HemisphereLight(0xfff4e6, 0xa8744c, 1.3));
    const sun = new THREE.DirectionalLight(0xfff0dc, 1.4); sun.position.set(1.5, 4, 2.5); sc.add(sun);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 10);
    const px = new Uint8Array(S * S * 4), cv = document.createElement('canvas'); cv.width = cv.height = S;
    const c2 = cv.getContext('2d'), img = c2.createImageData(S, S);
    const prevTarget = renderer.getRenderTarget(), prevAlpha = renderer.getClearAlpha(), prevColor = new THREE.Color();
    renderer.getClearColor(prevColor); renderer.setClearColor(0x000000, 0);
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.14, 0.03, 32), new THREE.MeshStandardMaterial({ color: 0xece6dc, roughness: 0.4 }));
    const card = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.4), new THREE.MeshLambertMaterial({ color: 0xc39563 }));
    const r = rng(5);
    this.thumbs = {};
    for (const it of items) {
      const g = new THREE.Group();
      const L = it.look;
      if (L.geo) {
        g.add(plate);
        const k = kindOf(L), n = Math.min(26, L.n * 2), m = new THREE.InstancedMesh(this.geo[k], this.mat[k], n);
        for (let i = 0; i < n; i++) {
          const a = r() * 6.283, d = Math.sqrt(r()) * 0.12;
          this.partScale(L, _s); _s.multiplyScalar(L.geo === 'sprig' ? 1.0 : 1.4);
          _q.setFromEuler(_e.set((r() - 0.5) * 0.6, r() * 6.3, (r() - 0.5) * 0.6));
          m.setMatrixAt(i, _m.compose(_p.set(Math.cos(a) * d, 0.02 + r() * 0.03, Math.sin(a) * d), _q, _s));
          m.setColorAt(i, _c.set(L.colors[i % L.colors.length]));
        }
        g.add(m);
        cam.position.set(0, 0.42, 0.5); cam.lookAt(0, 0, 0);
      } else {
        g.add(card);
        const o = this.buildLidItem(it, [0.42, 0.32], 0.01); g.add(o);
        cam.position.set(0, 0.7, 0.75); cam.lookAt(0, 0, 0);
      }
      sc.add(g);
      renderer.setRenderTarget(rt); renderer.clear(); renderer.render(sc, cam);
      renderer.readRenderTargetPixels(rt, 0, 0, S, S, px);
      for (let y = 0; y < S; y++) img.data.set(px.subarray((S - 1 - y) * S * 4, (S - y) * S * 4), y * S * 4);
      c2.putImageData(img, 0, 0);
      sc.remove(g);
      this.thumbs[it.id] = cv.toDataURL('image/png');
    }
    renderer.setRenderTarget(prevTarget); renderer.setClearColor(prevColor, prevAlpha);
    rt.dispose();
    return this.thumbs;
  }
}
