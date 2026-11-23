// Präsentation der fertigen Seife nach dem Ausformen: Spot- und Kantenlicht, ein Lichtstreif, der
// einmal über die Seife wandert, funkelnde Glanzpunkte (ein Points-Objekt mit Stern-Textur, additiv)
// und eine dezente Vignette (CSS). Die Seife lässt sich mit dem Finger drehen (Gieren + begrenztes
// Nicken, mit Schwung und Dämpfung); in Ruhe dreht sie sich langsam von selbst.
// Billig: keine Schattenkarten, kein Post-Processing, keine Allokationen pro Frame.
import * as THREE from 'three';

const N_SPARK = 28;
const PITCH_MIN = -0.35, PITCH_MAX = 0.85, PITCH_REST = 0.32;

function starTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.15, 'rgba(255,250,235,0.85)'); rg.addColorStop(0.5, 'rgba(255,240,210,0.12)'); rg.addColorStop(1, 'rgba(255,240,210,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.beginPath(); g.moveTo(32, 0); g.lineTo(35, 29); g.lineTo(64, 32); g.lineTo(35, 35); g.lineTo(32, 64); g.lineTo(29, 35); g.lineTo(0, 32); g.lineTo(29, 29); g.closePath(); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Showcase {
  constructor(scene) {
    this.active = false;
    this.key = new THREE.SpotLight(0xfff3e0, 0, 8, 0.2, 0.9, 1.2);
    this.key.position.set(0.9, 3.4, 2.4);
    this.rim = new THREE.DirectionalLight(0xffe6c8, 0);
    this.rim.position.set(-1.5, 2.2, -2.5);
    this.sweep = new THREE.PointLight(0xffffff, 0, 2.2, 1.6);
    for (const l of [this.key, this.rim, this.sweep]) { l.castShadow = false; scene.add(l); }
    scene.add(this.key.target); scene.add(this.rim.target);
    // Glanzpunkte
    const pos = new Float32Array(N_SPARK * 3);
    this.spGeo = new THREE.BufferGeometry();
    this.spGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.spMat = new THREE.PointsMaterial({ map: starTexture(), size: 0.13, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, color: 0xfff1d0 });
    this.sparks = new THREE.Points(this.spGeo, this.spMat);
    this.sparks.frustumCulled = false; this.sparks.visible = false;
    scene.add(this.sparks);
    this.seed = new Float32Array(N_SPARK * 4);
    for (let i = 0; i < N_SPARK; i++) {
      this.seed[i * 4] = Math.random() * 6.283; this.seed[i * 4 + 1] = 0.55 + Math.random() * 0.45;
      this.seed[i * 4 + 2] = (Math.random() - 0.5) * 0.55; this.seed[i * 4 + 3] = Math.random() * 6.283;
    }
    this.vignette = document.getElementById('vignette');
    // Drehen
    this.yaw = 0; this.pitch = PITCH_REST; this.vYaw = 0; this.vPitch = 0;
    this.drag = null; this.idle = 0; this.t = 0;
  }

  start(bar) {
    this.active = true; this.bar = bar; this.t = 0;
    this.yaw = -0.6; this.pitch = PITCH_REST; this.vYaw = 1.2; this.vPitch = 0; this.idle = 0; this.drag = null;
    this.sparks.visible = true;
    if (this.vignette) this.vignette.classList.add('show');
  }

  stop() {
    this.active = false; this.drag = null;
    this.key.intensity = 0; this.rim.intensity = 0; this.sweep.intensity = 0;
    this.sparks.visible = false; this.spMat.opacity = 0;
    if (this.vignette) this.vignette.classList.remove('show');
  }

  // ---------- Finger ----------
  down(e) { this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() }; this.vYaw = 0; this.vPitch = 0; this.idle = 0; }
  move(e) {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return false;
    const now = performance.now(), dt = Math.max(8, now - d.t) / 1000;
    const dx = e.clientX - d.x, dy = e.clientY - d.y, k = 6 / window.innerWidth;
    this.yaw += dx * k; this.pitch = THREE.MathUtils.clamp(this.pitch + dy * k * 0.8, PITCH_MIN, PITCH_MAX);
    // Geschwindigkeit geglättet (für den Schwung nach dem Loslassen)
    this.vYaw = this.vYaw * 0.5 + (dx * k / dt) * 0.5; this.vPitch = this.vPitch * 0.5 + (dy * k * 0.8 / dt) * 0.5;
    d.x = e.clientX; d.y = e.clientY; d.t = now;
    return true;
  }
  up(e) { if (!this.drag || e.pointerId !== this.drag.id) return false; this.drag = null; this.idle = 0; return true; }
  get dragging() { return !!this.drag; }

  /** Pro Frame (nur während der Präsentation). e = Aufsteigen 0..1 der Seife. */
  update(dt, time, cx, cy, cz) {
    if (!this.active) return;
    this.t += dt;
    const t = this.t;
    // Licht weich einblenden
    const fade = Math.min(1, t * 1.5);
    this.key.intensity = 5 * fade; this.rim.intensity = 2.6 * fade;
    this.key.target.position.set(cx, cy, cz); this.rim.target.position.set(cx, cy, cz);
    // Lichtstreif: wandert einmal (bei 0,5 s – 1,7 s) von links nach rechts vor der Seife vorbei, danach alle 6 s erneut
    const sw = ((t - 0.5) % 6) / 1.2;
    if (t > 0.5 && sw >= 0 && sw <= 1) {
      this.sweep.intensity = Math.sin(sw * Math.PI) * 6;
      this.sweep.position.set(cx - 0.9 + sw * 1.8, cy + 0.35, cz + 0.55);
    } else this.sweep.intensity = 0;
    // Drehen: Schwung mit Dämpfung, in Ruhe langsames Selbstdrehen, Nicken federt zur Ruhelage
    if (!this.drag) {
      this.idle += dt;
      this.yaw += this.vYaw * dt; this.pitch += this.vPitch * dt;
      const damp = Math.exp(-2.6 * dt);
      this.vYaw *= damp; this.vPitch *= damp;
      if (this.idle > 1.2) this.vYaw += (0.5 - this.vYaw) * (1 - Math.exp(-0.8 * dt));
      this.pitch += (PITCH_REST - this.pitch) * (1 - Math.exp(-1.5 * dt)) * (this.idle > 0.6 ? 1 : 0);
      if (this.pitch < PITCH_MIN) { this.pitch = PITCH_MIN; this.vPitch = 0; }
      if (this.pitch > PITCH_MAX) { this.pitch = PITCH_MAX; this.vPitch = 0; }
    }
    // Glanzpunkte auf einer Hülle um die Seife, funkeln nacheinander
    const p = this.spGeo.attributes.position.array, sd = this.seed;
    for (let i = 0; i < N_SPARK; i++) {
      const a = sd[i * 4] + time * 0.25, r = sd[i * 4 + 1];
      p[i * 3] = cx + Math.cos(a) * r * 0.9; p[i * 3 + 1] = cy + sd[i * 4 + 2] + Math.sin(time * 0.7 + sd[i * 4 + 3]) * 0.05; p[i * 3 + 2] = cz + Math.sin(a) * r * 0.6;
    }
    this.spGeo.attributes.position.needsUpdate = true;
    this.spMat.opacity = fade * (0.55 + 0.45 * Math.sin(time * 5.3)) ;
    this.spMat.size = 0.1 + 0.05 * Math.sin(time * 3.1);
  }
}
