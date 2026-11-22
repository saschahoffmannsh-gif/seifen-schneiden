// Konfetti: kleiner Pool aus Plättchen in einem InstancedMesh. Nur aktiv, solange etwas fliegt.
import * as THREE from 'three';

const MAX = 240;
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion();
const _e = new THREE.Euler(), _s = new THREE.Vector3(1, 1, 1), _c = new THREE.Color();
const _zero = new THREE.Matrix4().makeScale(0, 0, 0);
const COLORS = [0xff6f91, 0xffc75f, 0x6fd3ff, 0x8ce99a, 0xc39bff, 0xffffff];

export class Confetti {
  constructor(scene) {
    this.mesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.06, 0.035),
      new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
      MAX,
    );
    this.mesh.frustumCulled = false;
    for (let i = 0; i < MAX; i++) { this.mesh.setMatrixAt(i, _zero); this.mesh.setColorAt(i, _c.set(COLORS[i % COLORS.length])); }
    scene.add(this.mesh);
    this.p = new Float32Array(MAX * 3); this.v = new Float32Array(MAX * 3);
    this.r = new Float32Array(MAX * 3); this.life = new Float32Array(MAX);
    this.alive = 0;
  }

  burst(x, y, z, n = 120) {
    for (let k = 0, i = 0; i < MAX && k < n; i++) {
      if (this.life[i] > 0) continue;
      const o = i * 3, a = Math.random() * Math.PI * 2, sp = 1.2 + Math.random() * 1.8;
      this.p[o] = x; this.p[o + 1] = y; this.p[o + 2] = z;
      this.v[o] = Math.cos(a) * sp * 0.6; this.v[o + 1] = 2 + Math.random() * 2.2; this.v[o + 2] = Math.sin(a) * sp * 0.4 + 0.5;
      this.r[o] = Math.random() * 6; this.r[o + 1] = Math.random() * 6; this.r[o + 2] = Math.random() * 6;
      this.life[i] = 1.6 + Math.random() * 0.6;
      this.alive++; k++;
    }
  }

  update(dt) {
    if (this.alive === 0) return;
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) continue;
      const o = i * 3;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.mesh.setMatrixAt(i, _zero); this.alive--; continue; }
      this.v[o + 1] -= 4.5 * dt;                      // leichte Schwerkraft
      this.v[o] *= 1 - 1.5 * dt; this.v[o + 2] *= 1 - 1.5 * dt; // Luftwiderstand
      if (this.v[o + 1] < -0.9) this.v[o + 1] = -0.9;
      this.p[o] += this.v[o] * dt; this.p[o + 1] += this.v[o + 1] * dt; this.p[o + 2] += this.v[o + 2] * dt;
      this.r[o] += dt * 7; this.r[o + 1] += dt * 5;
      _p.set(this.p[o], this.p[o + 1], this.p[o + 2]);
      _q.setFromEuler(_e.set(this.r[o], this.r[o + 1], this.r[o + 2]));
      const s = Math.min(1, this.life[i] * 2);
      _s.set(s, s, s);
      this.mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
