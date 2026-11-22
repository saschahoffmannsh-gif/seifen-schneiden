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
//  * Vorderseite: leicht gewölbt ("Kissen"-Form, echte Geometrie) und mit eingepresster
//    Marke (Mulde + Blatt + "SEIFE") per Steigungs-Textur, die nur die Normalen kippt.
//    Die Farbe bleibt einheitlich; das Relief sitzt auf der Außenhaut der vordersten
//    Würfel und verschwindet mit ihnen beim Schneiden.
import * as THREE from 'three';
import { BLOCK, CUBE, BLOCK_BASE_Y, SOAP_RADIUS, SOAP_BULGE } from './config.js';
import { makeReliefTexture, RELIEF_SLOPE } from './relief.js';

export function createBlockMaterial() {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.42, metalness: 0, envMapIntensity: 0.7 });
  const uniforms = {
    uHalf: { value: new THREE.Vector3(BLOCK.nx * CUBE / 2, BLOCK.ny * CUBE / 2, BLOCK.nz * CUBE / 2) },
    uCenter: { value: new THREE.Vector3(0, BLOCK_BASE_Y + BLOCK.ny * CUBE / 2, 0) },
    uRadius: { value: SOAP_RADIUS },
    uBulge: { value: SOAP_BULGE },
    uRelief: { value: makeReliefTexture() },
    uReliefSlope: { value: RELIEF_SLOPE },
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform vec3 uHalf; uniform vec3 uCenter; uniform float uRadius; uniform float uBulge;
        attribute float aHidden;
        varying float vShell; varying float vFront; varying vec2 vCubeUv; varying vec2 vFaceUv;`)
      .replace('#include <beginnormal_vertex>', `
        vec3 objectNormal = normal;
        vec3 roundedLocal = position;
        vShell = 0.0; vFront = 0.0; vCubeUv = uv; vFaceUv = vec2(0.5);
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
          bool onFront = p.z > uHalf.z - 0.002;            // Vertex liegt auf der Vorderseite
          if (vShell > 0.5 && normal.z > 0.5) { vFront = 1.0; vFaceUv = p.xy / (2.0 * uHalf.xy) + 0.5; }
          if (dl > uRadius) p = q + d / dl * uRadius;    // Ecken abrunden
          if (onFront) {
            // Kissen-Wölbung der Vorderseite (zur Mitte hin leicht nach vorne)
            vec2 f = clamp(p.xy / uHalf.xy, -1.0, 1.0);
            vec2 w = 1.0 - f * f;
            p.z += uBulge * w.x * w.y;
            if (vShell > 0.5) {
              vec2 dz = uBulge * vec2(-2.0 * f.x / uHalf.x * w.y, -2.0 * f.y / uHalf.y * w.x);
              objectNormal = normalize(objectNormal - vec3(dz, 0.0) * max(objectNormal.z, 0.0));
            }
          }
          roundedLocal = (p + uCenter - t) / sc;
          // Verdeckte Innenfläche (Nachbarwürfel liegt direkt davor)? -> zu einem Punkt zusammenfallen
          // lassen. Spart Pixel-Arbeit und verhindert feine Rasterlinien auf der Außenhaut.
          float bit = an.x > 0.5 ? (normal.x > 0.0 ? 1.0 : 2.0)
                    : an.y > 0.5 ? (normal.y > 0.0 ? 4.0 : 8.0)
                    : (normal.z > 0.0 ? 16.0 : 32.0);
          if (mod(floor(aHidden / bit + 0.001), 2.0) > 0.5) roundedLocal = vec3(0.0);
        }`)
      .replace('#include <begin_vertex>', 'vec3 transformed = roundedLocal;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D uRelief; uniform float uReliefSlope;
        varying float vShell; varying float vFront; varying vec2 vCubeUv; varying vec2 vFaceUv;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec4 rel = vec4(0.5, 0.5, 0.0, 1.0);
        if (vFront > 0.5) rel = texture2D(uRelief, vFaceUv);
        // ganz leichte Licht-Verdeckung tief in der Mulde (Umgebungslicht kommt schlechter hinein)
        diffuseColor.rgb *= 1.0 - 0.05 * rel.b;
        // feine Fuge nur auf Schnitt-/Innenflächen
        float e = min(min(vCubeUv.x, 1.0 - vCubeUv.x), min(vCubeUv.y, 1.0 - vCubeUv.y));
        diffuseColor.rgb *= mix(1.0, 0.86, (1.0 - smoothstep(0.0, 0.07, e)) * (1.0 - vShell));`)
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
        if (vFront > 0.5) {
          // Steigungen der Prägung (Welt-Einheiten) -> Normale kippen (Vorderseite liegt in der xy-Ebene)
          vec2 gr = (rel.rg * 2.0 - 1.0) * uReliefSlope;
          vec3 tX = normalize((viewMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
          vec3 tY = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
          normal = normalize(normal - gr.x * tX - gr.y * tY);
        }`);
  };
  return mat;
}

/** Lose Würfel: gleiche wachsige Optik, Würfel selbst leicht abgerundet (Geometrie). */
export function createLooseMaterial() {
  return new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0, envMapIntensity: 0.7 });
}
