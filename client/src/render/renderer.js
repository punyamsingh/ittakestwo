import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

// Runs after tone mapping, in display space: vignette, a red edge pulse when
// the local player is hit, and a warm edge glow when they're near the rim.
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uVignette: { value: 0.32 },
    uHit: { value: 0 },
    uDanger: { value: 0 },
    uTime: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uVignette;
    uniform float uHit;
    uniform float uDanger;
    uniform float uTime;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 d = vUv - 0.5;
      float r = length(d * vec2(1.0, 0.85));
      c.rgb *= mix(1.0, 1.0 - uVignette, smoothstep(0.28, 0.82, r));
      float edge = smoothstep(0.32, 0.78, r);
      c.rgb = mix(c.rgb, vec3(1.0, 0.16, 0.24), edge * uHit * 0.6);
      float pulse = 0.65 + 0.35 * sin(uTime * 9.0);
      c.rgb = mix(c.rgb, vec3(1.0, 0.45, 0.2), edge * uDanger * 0.35 * pulse);
      gl_FragColor = c;
    }
  `,
};

export function createRenderer(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  container.appendChild(renderer.domElement);
  return renderer;
}

export function createComposer(renderer, scene, camera) {
  // EffectComposer's default target has no MSAA, which is why edges were jagged.
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(window.innerWidth, window.innerHeight);

  composer.addPass(new RenderPass(scene, camera));
  // High threshold: only emissive surfaces bloom, not sunlit ground (that caused the milky haze).
  const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.7, 0.5, 1.0);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  // Dynamic resolution: trade render scale for frame rate on weaker GPUs.
  const maxRatio = Math.min(window.devicePixelRatio, 2);
  let ratio = maxRatio;
  let elapsed = 0;
  let frames = 0;
  let goodWindows = 0;
  function setRatio(next) {
    ratio = next;
    renderer.setPixelRatio(ratio);
    composer.setPixelRatio(ratio);
    resize();
  }
  function adapt(dt) {
    elapsed += dt;
    frames++;
    if (elapsed < 1.5) return false;
    const fps = frames / elapsed;
    elapsed = 0;
    frames = 0;
    if (fps < 40 && ratio > 0.75) {
      goodWindows = 0;
      setRatio(Math.max(0.75, ratio - 0.25));
      return true;
    }
    goodWindows = fps > 57 ? goodWindows + 1 : 0;
    if (goodWindows >= 3 && ratio < maxRatio) {
      goodWindows = 0;
      setRatio(Math.min(maxRatio, ratio + 0.25));
      return true;
    }
    return false;
  }

  return { composer, bloom, grade: grade.uniforms, resize, adapt };
}
