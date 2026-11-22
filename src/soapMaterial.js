// Materialien für die Seife: weich glänzend/wachsig (MeshStandardMaterial + Umgebungslicht),
// Farbe pro Würfel über instanceColor.
//
// Der intakte Block bekommt einen kleinen Shader-Zusatz (einmal kompiliert, keine Kosten pro Frame
// außer ein paar Rechenschritten pro Vertex):
//  * Alle Würfel-Ecken werden auf die Form eines abgerundeten Seifenstücks projiziert
//    -> die Silhouette ist rund wie ein echtes Stück Seife.
//  * Außenflächen bekommen glatte Normalen (wirkt wie eine durchgehende Seifenoberfläche).
//  * Innen-/Schnittflächen behalten flache Würfel-Normalen und eine feine dunkle Fuge
//    -> an der Schnittfläche sieht man die Würfelstruktur.
import * as THREE from 'three';
import { BLOCK, CUBE, BLOCK_BASE_Y, SOAP_RADIUS } from './config.js';

export function createBlockMaterial() {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.42, metalness: 0, envMapIntensity: 0.7 });
  const uniforms = {
    uHalf: { value: new THREE.Vector3(BLOCK.nx * CUBE / 2, BLOCK.ny * CUBE / 2, BLOCK.nz * CUBE / 2) },
    uCenter: { value: new THREE.Vector3(0, BLOCK_BASE_Y + BLOCK.ny * CUBE / 2, 0) },
    uRadius: { value: SOAP_RADIUS },
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform vec3 uHalf; uniform vec3 uCenter; uniform float uRadius;
        varying float vShell; varying vec2 vCubeUv;`)
      .replace('#include <beginnormal_vertex>', `
        vec3 objectNormal = normal;
        vec3 roundedLocal = position;
        vShell = 0.0; vCubeUv = uv;
        float sc = length(instanceMatrix[0].xyz);
        if (sc > 1e-6) {
          vec3 t = instanceMatrix[3].xyz;
          vec3 p = position * sc + t - uCenter;          // Position relativ zur Seifenmitte
          vec3 inner = uHalf - uRadius;
          vec3 q = clamp(p, -inner, inner);
          vec3 d = p - q;
          float dl = length(d);
          // Liegt die Fläche außen am Seifenstück? (Normalenachse am Rand und nach außen zeigend)
          vec3 an = abs(normal);
          float pa = an.x > 0.5 ? p.x * normal.x : (an.y > 0.5 ? p.y * normal.y : p.z * normal.z);
          float ha = an.x > 0.5 ? uHalf.x : (an.y > 0.5 ? uHalf.y : uHalf.z);
          if (pa > ha - 0.002) { vShell = 1.0; if (dl > 1e-5) objectNormal = d / dl; }
          if (dl > uRadius) p = q + d / dl * uRadius;    // Ecken abrunden
          roundedLocal = (p + uCenter - t) / sc;
        }`)
      .replace('#include <begin_vertex>', 'vec3 transformed = roundedLocal;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying float vShell; varying vec2 vCubeUv;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        // feine Fuge nur auf Schnitt-/Innenflächen
        float e = min(min(vCubeUv.x, 1.0 - vCubeUv.x), min(vCubeUv.y, 1.0 - vCubeUv.y));
        diffuseColor.rgb *= mix(1.0, 0.8, (1.0 - smoothstep(0.0, 0.07, e)) * (1.0 - vShell));`);
  };
  return mat;
}

/** Lose Würfel: gleiche wachsige Optik, Würfel selbst leicht abgerundet (Geometrie). */
export function createLooseMaterial() {
  return new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0, envMapIntensity: 0.7 });
}
