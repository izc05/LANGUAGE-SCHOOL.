// @ts-nocheck
import * as THREE from 'three'

const C_DEEP = new THREE.Color('#c2185b')
const C_MID = new THREE.Color('#e91e8c')
const C_SOFT = new THREE.Color('#f8bbd0')
const C_HAZE = new THREE.Color('#fce4ec')
const C_WHITE = new THREE.Color('#ffffff')
const C_BG = new THREE.Color('#fffcfd')
const DURATION = 2800

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
    float zShift = uProgress * 22.0 * (0.3 + aDepth * 0.7);
    pos.z += zShift;
    float drift = uTime * 0.04 * (0.6 + aDepth * 0.4);
    pos.x += sin(drift + aDepth * 6.28) * 0.25;
    pos.y += cos(drift * 0.8 + aDepth * 2.1) * 0.12;
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
      mix(hash(i + vec2(0,0)), hash(i + vec2(1,0)), u.x),
      mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p = p * 2.1 + vec2(1.7, 9.2);
      a *= 0.5;
    }
    return v;
  }

  float cloudShape(vec2 uv) {
    float body = length(uv * vec2(1.0, 1.6)) - 0.28;
    float lobe1 = length((uv - vec2(0.00, 0.14)) * vec2(1.1, 1.0)) - 0.18;
    float lobe2 = length((uv - vec2(-0.15, 0.10)) * vec2(1.2, 1.0)) - 0.14;
    float lobe3 = length((uv - vec2(0.15, 0.09)) * vec2(1.2, 1.0)) - 0.13;
    float lobe4 = length((uv - vec2(-0.26, 0.03)) * vec2(1.3, 1.1)) - 0.10;
    float lobe5 = length((uv - vec2(0.26, 0.02)) * vec2(1.3, 1.1)) - 0.10;
    return min(body, min(lobe1, min(lobe2, min(lobe3, min(lobe4, lobe5)))));
  }

  void main() {
    vec2 uv = vUv - 0.5;
    float t = uTime * 0.04 + vDepth * 5.1;
    vec2 warp = vec2(
      fbm(uv * 1.8 + vec2(t, t * 0.5)),
      fbm(uv * 1.8 + vec2(t * 0.7, t + 3.7))
    ) * 0.14;

    float sdf = cloudShape(uv + warp);
    if (sdf > 0.04) discard;

    float edgeFade = 1.0 - smoothstep(-0.04, 0.03, sdf);
    float tex = pow(fbm(uv * 3.5 + vec2(t * 0.5, -t * 0.3)), 0.9);
    float shading = smoothstep(-0.3, 0.2, uv.y);
    float alpha = clamp(edgeFade * vAlpha * (1.0 - uFade * 1.3), 0.0, 1.0);
    vec3 col = mix(uColorA, uColorB, tex * 0.6 + shading * 0.5);
    col = mix(col, vec3(1.0), uFade * 0.9);
    gl_FragColor = vec4(col, alpha);
  }
`

const flashVert = /* glsl */ `
  void main() { gl_Position = vec4(position, 1.0); }
`

const flashFrag = /* glsl */ `
  uniform float uOpacity;
  uniform vec3 uColor;
  void main() { gl_FragColor = vec4(uColor, uOpacity); }
`

function createCloudGeometry(depth: number, alpha: number, scale: number) {
  const geometry = new THREE.PlaneGeometry(1, 1, 1, 1)
  geometry.setAttribute('aDepth', new THREE.BufferAttribute(new Float32Array(4).fill(depth), 1))
  geometry.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(4).fill(alpha), 1))
  return geometry
}

function makeCloudMaterial(colorA: THREE.Color, colorB: THREE.Color, additive = false) {
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
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    side: THREE.DoubleSide,
  })
}

function buildScene() {
  const scene = new THREE.Scene()
  scene.background = C_BG.clone()
  scene.fog = new THREE.FogExp2(C_HAZE, 0.055)

  const cloudMeshes: THREE.Mesh[] = []
  const count = 80
  const layers = 5

  for (let i = 0; i < count; i += 1) {
    const layer = i % layers
    const depth = layer / (layers - 1)
    const alpha = THREE.MathUtils.randFloat(0.55, 0.9)
    const material = makeCloudMaterial(C_MID, C_HAZE)
    const mesh = new THREE.Mesh(createCloudGeometry(depth, alpha, 1), material)

    const angle = (i / count) * Math.PI * 2 * 3.7
    const radius = THREE.MathUtils.randFloat(1.5, 6.5) * (1 - depth * 0.3)
    const zPos = -depth * 22 - Math.random() * 6
    mesh.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.7, zPos)

    const scale = THREE.MathUtils.randFloat(3, 8) * (0.5 + depth * 0.8)
    mesh.scale.set(scale, scale * THREE.MathUtils.randFloat(0.7, 1.1), 1)
    mesh.rotation.z = Math.random() * Math.PI * 2
    cloudMeshes.push(mesh)
    scene.add(mesh)
  }

  for (let i = 0; i < 12; i += 1) {
    const material = makeCloudMaterial(C_DEEP, C_SOFT, true)
    const mesh = new THREE.Mesh(
      createCloudGeometry(0.8, THREE.MathUtils.randFloat(0.3, 0.6), 1),
      material,
    )
    mesh.position.set(
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 1.5,
      -2 - Math.random() * 8,
    )
    const scale = THREE.MathUtils.randFloat(1.5, 4)
    mesh.scale.set(scale, scale, 1)
    mesh.rotation.z = Math.random() * Math.PI * 2
    cloudMeshes.push(mesh)
    scene.add(mesh)
  }

  const flashLight = new THREE.PointLight(C_MID, 0, 40)
  flashLight.position.set(0, 3, -6)
  scene.add(flashLight)

  const flashLight2 = new THREE.PointLight(C_SOFT, 0, 25)
  flashLight2.position.set(-4, -2, -10)
  scene.add(flashLight2)

  scene.add(new THREE.AmbientLight(C_HAZE, 1.2))
  const directional = new THREE.DirectionalLight(C_SOFT, 1.5)
  directional.position.set(5, 5, 5)
  scene.add(directional)

  const fsMat = new THREE.ShaderMaterial({
    vertexShader: flashVert,
    fragmentShader: flashFrag,
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

  return { scene, cloudMeshes, flashLight, flashLight2, fsMat, fsQuad, fsScene, fsCamera }
}

function createOverlay() {
  const canvas = document.createElement('canvas')
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '99999',
    opacity: '0',
    transition: 'opacity 0.1s ease',
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(width, height)
  renderer.sortObjects = true

  const camera = new THREE.PerspectiveCamera(72, width / height, 0.01, 60)
  camera.position.set(0, 0, 8)

  const { scene, cloudMeshes, flashLight, flashLight2, fsMat, fsQuad, fsScene, fsCamera } = buildScene()
  requestAnimationFrame(() => { canvas.style.opacity = '1' })

  const startTime = performance.now()
  let rafId = 0
  let nextFlash = 0.18
  let shakeDecay = 0
  const shake = new THREE.Vector3()
  const timeouts: number[] = []

  const cleanup = () => {
    cancelAnimationFrame(rafId)
    timeouts.forEach((id) => window.clearTimeout(id))
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
      material.uniforms.uFade.value = Math.max(0, (progress - 0.78) / 0.22)
      mesh.quaternion.copy(camera.quaternion)
    }

    const flyP = Math.min(progress / 0.9, 1)
    const ease = flyP < 0.5
      ? 2 * flyP * flyP
      : 1 - Math.pow(-2 * flyP + 2, 2) / 2

    camera.position.z = 8 - ease * 10
    camera.position.y = Math.sin(ease * Math.PI) * 0.4
    const spiral = ease * Math.PI * 0.15
    camera.position.x = Math.sin(spiral) * ease * 0.2
    camera.rotation.z = Math.sin(ease * Math.PI) * 0.015

    if (shakeDecay > 0) {
      shakeDecay -= 0.03
      shake.set(
        (Math.random() - 0.5) * 0.025 * shakeDecay,
        (Math.random() - 0.5) * 0.018 * shakeDecay,
        0,
      )
      camera.position.add(shake)
    }

    const exitP = Math.max(0, (progress - 0.55) / 0.45)
    const currentA = C_MID.clone().lerp(C_HAZE, exitP)
    const currentB = C_SOFT.clone().lerp(C_WHITE, exitP)
    for (const mesh of cloudMeshes) {
      const material = mesh.material as THREE.ShaderMaterial
      material.uniforms.uColorA.value.copy(currentA)
      material.uniforms.uColorB.value.copy(currentB)
    }

    if (scene.fog instanceof THREE.FogExp2) scene.fog.color.lerpColors(C_HAZE, C_WHITE, exitP)
    if (scene.background instanceof THREE.Color) {
      scene.background.lerpColors(C_BG, C_WHITE, Math.max(0, (progress - 0.82) / 0.18))
    }

    if (progress > nextFlash && progress < 0.72) {
      const intensity = THREE.MathUtils.randFloat(5, 14)
      flashLight.intensity = intensity
      flashLight2.intensity = intensity * 0.4
      flashLight.color.copy(Math.random() > 0.4 ? C_MID : C_SOFT)
      shakeDecay = 0.5
      fsMat.uniforms.uColor.value.copy(Math.random() > 0.5 ? C_WHITE : C_SOFT)
      fsMat.uniforms.uOpacity.value = THREE.MathUtils.randFloat(0.1, 0.3)
      const timeoutId = window.setTimeout(() => {
        flashLight.intensity = 0
        flashLight2.intensity = 0
        fsMat.uniforms.uOpacity.value = 0
      }, THREE.MathUtils.randInt(120, 250))
      timeouts.push(timeoutId)
      nextFlash = progress + THREE.MathUtils.randFloat(0.14, 0.28)
    }

    const finalFade = Math.max(0, (progress - 0.85) / 0.15)
    fsMat.uniforms.uColor.value.copy(C_WHITE)
    fsMat.uniforms.uOpacity.value = Math.max(fsMat.uniforms.uOpacity.value, finalFade)

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
