// @ts-nocheck
import * as THREE from 'three'

const C_ROSE = new THREE.Color('#e99fbd')
const C_BLUSH = new THREE.Color('#f5cedd')
const C_HAZE = new THREE.Color('#fdebf2')
const C_PEARL = new THREE.Color('#fff9fb')
const C_WHITE = new THREE.Color('#ffffff')
const C_BG = new THREE.Color('#fffdfd')
const DURATION = 2600

let transitionRunning = false

const cloudVert = /* glsl */ `
  varying vec2 vUv;
  varying float vDepth;
  varying float vAlpha;
  attribute float aDepth;
  attribute float aAlpha;
  uniform float uTime;
  uniform float uProgress;

  void main() {
    vUv = uv;
    vAlpha = aAlpha;
    vDepth = aDepth;

    vec3 pos = position;
    float zShift = uProgress * 19.0 * (0.34 + aDepth * 0.66);
    pos.z += zShift;

    float drift = uTime * 0.025 * (0.55 + aDepth * 0.45);
    pos.x += sin(drift + aDepth * 5.2) * 0.16;
    pos.y += cos(drift * 0.62 + aDepth * 2.4) * 0.06;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

const cloudFrag = /* glsl */ `
  varying vec2 vUv;
  varying float vDepth;
  varying float vAlpha;
  uniform float uTime;
  uniform float uProgress;
  uniform float uFade;
  uniform vec3 uColorA;
  uniform vec3 uColorB;

  float hash(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p = p * 2.05 + vec2(1.7, 9.2);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv - 0.5;
    float t = uTime * 0.018 + vDepth * 4.7;

    vec2 warp = vec2(
      fbm(uv * 1.25 + vec2(t, t * 0.35)),
      fbm(uv * 1.35 + vec2(-t * 0.45, t + 2.6))
    ) - 0.5;
    warp *= 0.11;

    vec2 q = uv + warp;
    float ellipse = length(q * vec2(0.82, 1.72));
    float veil = 1.0 - smoothstep(0.23, 0.5, ellipse);

    float texture = fbm(q * 2.45 + vec2(t * 0.55, -t * 0.24));
    float wisps = smoothstep(0.22, 0.84, texture);
    float innerGlow = 1.0 - smoothstep(0.02, 0.48, ellipse);

    float alpha = veil * mix(0.48, 0.82, wisps) * vAlpha;
    alpha *= 1.0 - uFade;
    if (alpha < 0.012) discard;

    float tint = clamp(texture * 0.42 + innerGlow * 0.18 + vDepth * 0.08, 0.0, 1.0);
    vec3 col = mix(uColorA, uColorB, tint);
    col = mix(col, vec3(1.0), 0.22 + uFade * 0.72);

    gl_FragColor = vec4(col, alpha);
  }
`

const fadeVert = /* glsl */ `
  void main() { gl_Position = vec4(position, 1.0); }
`

const fadeFrag = /* glsl */ `
  uniform float uOpacity;
  uniform vec3 uColor;
  void main() { gl_FragColor = vec4(uColor, uOpacity); }
`

function createCloudGeometry(depth: number, alpha: number) {
  const geometry = new THREE.PlaneGeometry(1, 1, 1, 1)
  geometry.setAttribute('aDepth', new THREE.BufferAttribute(new Float32Array(4).fill(depth), 1))
  geometry.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(4).fill(alpha), 1))
  return geometry
}

function makeCloudMaterial(colorA: THREE.Color, colorB: THREE.Color) {
  return new THREE.ShaderMaterial({
    vertexShader: cloudVert,
    fragmentShader: cloudFrag,
    uniforms: {
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uFade: { value: 0 },
      uColorA: { value: colorA.clone() },
      uColorB: { value: colorB.clone() },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    side: THREE.DoubleSide,
  })
}

function buildScene() {
  const scene = new THREE.Scene()
  scene.background = C_BG.clone()
  scene.fog = new THREE.FogExp2(C_HAZE, 0.026)

  const cloudMeshes: THREE.Mesh[] = []
  const count = 46
  const layers = 4

  for (let i = 0; i < count; i += 1) {
    const layer = i % layers
    const depth = layer / (layers - 1)
    const alpha = THREE.MathUtils.randFloat(0.18, 0.42) * (0.9 + depth * 0.1)
    const material = makeCloudMaterial(C_PEARL, depth > 0.55 ? C_BLUSH : C_HAZE)
    const mesh = new THREE.Mesh(createCloudGeometry(depth, alpha), material)

    const angle = (i / count) * Math.PI * 2 * 2.35 + layer * 0.28
    const radius = THREE.MathUtils.randFloat(1.25, 7.1) * (1 - depth * 0.18)
    const zPos = -depth * 19 - THREE.MathUtils.randFloat(1.5, 6.5)

    mesh.position.set(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius * 0.58,
      zPos,
    )

    const width = THREE.MathUtils.randFloat(5.0, 10.5) * (0.72 + depth * 0.48)
    const height = width * THREE.MathUtils.randFloat(0.28, 0.48)
    mesh.scale.set(width, height, 1)
    mesh.rotation.z = THREE.MathUtils.randFloat(-0.2, 0.2)

    cloudMeshes.push(mesh)
    scene.add(mesh)
  }

  // A few very soft rose veils provide depth without becoming dense cotton clouds.
  for (let i = 0; i < 7; i += 1) {
    const depth = THREE.MathUtils.randFloat(0.45, 0.9)
    const material = makeCloudMaterial(C_HAZE, C_ROSE)
    const mesh = new THREE.Mesh(
      createCloudGeometry(depth, THREE.MathUtils.randFloat(0.1, 0.22)),
      material,
    )

    mesh.position.set(
      THREE.MathUtils.randFloatSpread(8),
      THREE.MathUtils.randFloatSpread(4.5),
      -5 - Math.random() * 11,
    )

    const width = THREE.MathUtils.randFloat(6.5, 11)
    mesh.scale.set(width, width * THREE.MathUtils.randFloat(0.24, 0.38), 1)
    mesh.rotation.z = THREE.MathUtils.randFloat(-0.16, 0.16)

    cloudMeshes.push(mesh)
    scene.add(mesh)
  }

  scene.add(new THREE.AmbientLight(C_WHITE, 1.3))
  const directional = new THREE.DirectionalLight(C_BLUSH, 0.7)
  directional.position.set(5, 5, 5)
  scene.add(directional)

  const fsMat = new THREE.ShaderMaterial({
    vertexShader: fadeVert,
    fragmentShader: fadeFrag,
    uniforms: {
      uOpacity: { value: 0 },
      uColor: { value: C_WHITE.clone() },
    },
    transparent: true,
    depthTest: false,
    depthWrite: false,
  })

  const fsQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), fsMat)
  const fsScene = new THREE.Scene()
  const fsCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  fsScene.add(fsQuad)

  return { scene, cloudMeshes, fsMat, fsQuad, fsScene, fsCamera }
}

function createOverlay() {
  const canvas = document.createElement('canvas')
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '99999',
    opacity: '0',
    transition: 'opacity 0.16s ease',
    pointerEvents: 'none',
    width: '100vw',
    height: '100vh',
    display: 'block',
  })
  document.body.appendChild(canvas)
  return canvas
}

export function runPremiumCloudTransition(onComplete: () => void) {
  if (transitionRunning) return
  transitionRunning = true

  const canvas = createOverlay()
  const width = window.innerWidth
  const height = window.innerHeight
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  })

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
  renderer.setSize(width, height)
  renderer.sortObjects = true

  const camera = new THREE.PerspectiveCamera(68, width / height, 0.01, 60)
  camera.position.set(0, 0, 8)

  const { scene, cloudMeshes, fsMat, fsQuad, fsScene, fsCamera } = buildScene()
  requestAnimationFrame(() => { canvas.style.opacity = '1' })

  const startTime = performance.now()
  let rafId = 0

  const cleanup = () => {
    cancelAnimationFrame(rafId)
    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      object.geometry?.dispose()
      const material = object.material
      if (Array.isArray(material)) material.forEach((item) => item.dispose())
      else material?.dispose()
    })
    fsQuad.geometry.dispose()
    fsMat.dispose()
    renderer.dispose()
    renderer.forceContextLoss?.()
    canvas.remove()
    transitionRunning = false
  }

  const tick = (now: number) => {
    rafId = requestAnimationFrame(tick)
    const elapsed = (now - startTime) * 0.001
    const progress = Math.min(elapsed / (DURATION * 0.001), 1)

    for (const mesh of cloudMeshes) {
      const material = mesh.material as THREE.ShaderMaterial
      material.uniforms.uTime.value = elapsed
      material.uniforms.uProgress.value = progress
      material.uniforms.uFade.value = Math.max(0, (progress - 0.73) / 0.27)
      mesh.quaternion.copy(camera.quaternion)
    }

    const flyP = Math.min(progress / 0.91, 1)
    const ease = flyP < 0.5
      ? 2 * flyP * flyP
      : 1 - Math.pow(-2 * flyP + 2, 2) / 2

    camera.position.z = 8 - ease * 9.2
    camera.position.y = Math.sin(ease * Math.PI) * 0.16
    camera.position.x = Math.sin(ease * Math.PI * 0.72) * 0.12
    camera.rotation.z = Math.sin(ease * Math.PI) * 0.005

    const exitP = Math.max(0, (progress - 0.58) / 0.42)
    const currentA = C_PEARL.clone().lerp(C_WHITE, exitP)
    const currentB = C_BLUSH.clone().lerp(C_WHITE, exitP)

    for (const mesh of cloudMeshes) {
      const material = mesh.material as THREE.ShaderMaterial
      material.uniforms.uColorA.value.copy(currentA)
      material.uniforms.uColorB.value.copy(currentB)
    }

    if (scene.fog instanceof THREE.FogExp2) {
      scene.fog.color.lerpColors(C_HAZE, C_WHITE, exitP)
      scene.fog.density = THREE.MathUtils.lerp(0.026, 0.012, exitP)
    }

    if (scene.background instanceof THREE.Color) {
      scene.background.lerpColors(C_BG, C_WHITE, Math.max(0, (progress - 0.76) / 0.24))
    }

    const finalFade = Math.max(0, (progress - 0.86) / 0.14)
    fsMat.uniforms.uColor.value.copy(C_WHITE)
    fsMat.uniforms.uOpacity.value = finalFade

    renderer.autoClear = true
    renderer.render(scene, camera)
    renderer.autoClear = false
    renderer.render(fsScene, fsCamera)

    if (progress >= 1) {
      cleanup()
      onComplete()
    }
  }

  rafId = requestAnimationFrame(tick)
}
