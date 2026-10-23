// See-through hole: fragments that are nearer to the camera than the player and fall
// inside a screen-space circle around her get dithered away, like a torn paper window.
import * as THREE from 'three';

export const cutUniforms = {
  uCutCenter: { value: new THREE.Vector2(-9999, -9999) },
  uCutRadius: { value: 1 },
  uCutDepth: { value: 0 },
};

// Buildings: each building has a fade value (0..1) in a small data texture, eased over
// time on the CPU; the shader screen-door dithers away up to 65% of a faded building.
export function applyBuildingFade(material, fade) {
  material.userData.cutaway = true;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uFadeTex = fade.tex;
    shader.uniforms.uFadeW = fade.width;
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', `attribute float aId; varying float vFade;
uniform sampler2D uFadeTex; uniform float uFadeW;
void main() {`)
      .replace('#include <project_vertex>', `#include <project_vertex>
	vFade = aId < 0.0 ? 0.0 : texture2D(uFadeTex, vec2((aId + 0.5) / uFadeW, 0.5)).r;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'varying float vFade;\nvoid main() {')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
	if (vFade > 0.01) {
		vec2 a = floor(gl_FragCoord.xy / 2.0);
		vec2 h = 0.5 * a;
		float b2h = fract(h.x * 0.5 + h.y * h.y * 0.75);
		float b2 = fract(a.x * 0.5 + a.y * a.y * 0.75);
		if (fract(b2h * 0.25 + b2) < vFade * 0.65) discard;
	}`);
  };
  material.needsUpdate = true;
}

export function applyCutaway(material) {
  if (material.userData.cutaway) return;
  material.userData.cutaway = true;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, cutUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'varying float vCutDepth;\nvarying float vCutY;\nvoid main() {')
      .replace('#include <project_vertex>', '#include <project_vertex>\n\tvCutDepth = -mvPosition.z;\n\tvCutY = (modelMatrix * vec4(transformed, 1.0)).y;');
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', `varying float vCutDepth; varying float vCutY;
uniform vec2 uCutCenter; uniform float uCutRadius; uniform float uCutDepth;
void main() {`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
	{
		float r = length(gl_FragCoord.xy - uCutCenter) / uCutRadius;
		if (r < 1.0 && vCutY > 0.35 && vCutDepth < uCutDepth - 1.2) {
			float keep = smoothstep(0.7, 1.0, r);
			float n = fract(sin(dot(floor(gl_FragCoord.xy / 3.0), vec2(12.9898, 78.233))) * 43758.5453);
			if (n >= keep) discard;
		}
	}`);
  };
  material.needsUpdate = true;
}

// Applies to every per-stage material under root; shared cached materials (characters,
// generic props) are left alone so the couple never gets cut.
export function applyCutawayTree(root) {
  root.traverse((o) => {
    if (!o.material) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!m.userData.shared && !o.isSprite) applyCutaway(m);
    }
  });
}

const _v = new THREE.Vector3();
export function updateCutaway(camera, target, bufferW, bufferH) {
  _v.copy(target).project(camera);
  cutUniforms.uCutCenter.value.set((_v.x + 1) / 2 * bufferW, (_v.y + 1) / 2 * bufferH);
  cutUniforms.uCutRadius.value = Math.min(bufferW, bufferH) * 0.24;
  _v.copy(target).applyMatrix4(camera.matrixWorldInverse);
  cutUniforms.uCutDepth.value = -_v.z;
}
