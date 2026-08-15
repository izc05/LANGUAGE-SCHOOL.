import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, Lightformer, Preload } from '@react-three/drei'
import { Suspense, useEffect, useRef, useState, type MutableRefObject } from 'react'
import * as THREE from 'three'
import PremiumAirplane from './premium/PremiumAirplane'
import PremiumAtmosphere from './premium/PremiumAtmosphere'
import PremiumGlobe from './premium/PremiumGlobe'
import { runPremiumCloudTransition } from './premium/cloudTransition'
import './premium/premium-intro.css'

const INTRO_DURATION = 8

type IntroPageProps = {
  onEnter: () => void
}

type SceneControllerProps = {
  reducedMotion: boolean
  skipped: boolean
  planeProgress: MutableRefObject<number>
  globeScale: MutableRefObject<number>
  onBrandVisible: () => void
  onActionsVisible: () => void
  onSettled: () => void
}

function easeInOutQuad(value: number) {
  return value < 0.5
    ? 2 * value * value
    : 1 - Math.pow(-2 * value + 2, 2) / 2
}

function backOut(value: number) {
  const c1 = 1.2
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(value - 1, 3) + c1 * Math.pow(value - 1, 2)
}

function SceneController({
  reducedMotion,
  skipped,
  planeProgress,
  globeScale,
  onBrandVisible,
  onActionsVisible,
  onSettled,
}: SceneControllerProps) {
  const fired = useRef({ brand: false, actions: false, settled: false })

  useFrame((state) => {
    if (reducedMotion || skipped) {
      planeProgress.current = 1
      globeScale.current = 1
      state.camera.position.z = 5

      if (!fired.current.brand) {
        fired.current.brand = true
        onBrandVisible()
      }
      if (!fired.current.actions) {
        fired.current.actions = true
        onActionsVisible()
      }
      if (!fired.current.settled) {
        fired.current.settled = true
        onSettled()
      }
      return
    }

    const elapsed = state.clock.elapsedTime
    const flightProgress = THREE.MathUtils.clamp(elapsed / INTRO_DURATION, 0, 1)
    planeProgress.current = easeInOutQuad(flightProgress)

    const cameraProgress = THREE.MathUtils.clamp(elapsed / (INTRO_DURATION * 0.7), 0, 1)
    state.camera.position.z = THREE.MathUtils.lerp(15, 5, easeInOutQuad(cameraProgress))

    const globeProgress = THREE.MathUtils.clamp((elapsed - INTRO_DURATION * 0.4) / 3, 0, 1)
    globeScale.current = globeProgress <= 0 ? 0 : Math.max(0, backOut(globeProgress))

    if (elapsed >= INTRO_DURATION * 0.75 && !fired.current.brand) {
      fired.current.brand = true
      onBrandVisible()
    }

    if (elapsed >= INTRO_DURATION * 0.85 && !fired.current.actions) {
      fired.current.actions = true
      onActionsVisible()
    }

    if (elapsed >= INTRO_DURATION && !fired.current.settled) {
      fired.current.settled = true
      planeProgress.current = 1
      globeScale.current = 1
      onSettled()
    }
  })

  return null
}

function PremiumScene({
  reducedMotion,
  skipped,
  settled,
  planeProgress,
  globeScale,
  onBrandVisible,
  onActionsVisible,
  onSettled,
}: {
  reducedMotion: boolean
  skipped: boolean
  settled: boolean
  planeProgress: MutableRefObject<number>
  globeScale: MutableRefObject<number>
  onBrandVisible: () => void
  onActionsVisible: () => void
  onSettled: () => void
}) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 15], fov: 40, near: 0.1, far: 60 }}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
    >
      <SceneController
        reducedMotion={reducedMotion}
        skipped={skipped}
        planeProgress={planeProgress}
        globeScale={globeScale}
        onBrandVisible={onBrandVisible}
        onActionsVisible={onActionsVisible}
        onSettled={onSettled}
      />

      <color attach="background" args={['#fffcfd']} />
      <fog attach="fog" args={['#fffcfd', 5, 20]} />

      <ambientLight intensity={1.5} color="#ffffff" />
      <directionalLight position={[5, 5, 5]} intensity={2} color="#ffffff" />
      <directionalLight position={[-5, 5, -5]} intensity={1} color="#f4a7c8" />

      <PremiumAtmosphere />

      <Suspense fallback={null}>
        <PremiumGlobe introComplete={settled} scaleRef={globeScale} />
      </Suspense>

      <PremiumAirplane progressRef={planeProgress} />

      <Environment resolution={256}>
        <group rotation={[-Math.PI / 2, 0, 0]}>
          <Lightformer form="circle" intensity={4} rotation-x={Math.PI / 2} position={[0, 5, -9]} scale={2} />
          <Lightformer form="circle" intensity={2} rotation-y={Math.PI / 2} position={[-5, 1, -1]} scale={2} />
          <Lightformer form="circle" intensity={2} rotation-y={Math.PI / 2} position={[5, 1, -1]} scale={2} />
          <Lightformer form="circle" intensity={2} rotation-y={-Math.PI / 2} position={[10, 1, 0]} scale={8} />
        </group>
      </Environment>
      <Preload all />
    </Canvas>
  )
}

function browserSupportsWebGl(): boolean {
  let gl: WebGLRenderingContext | WebGL2RenderingContext | null = null
  try {
    const canvas = document.createElement('canvas')
    const options: WebGLContextAttributes = { failIfMajorPerformanceCaveat: true }
    gl = canvas.getContext('webgl2', options) || canvas.getContext('webgl', options)
    if (!gl) return false

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
    const renderer = debugInfo ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)) : ''
    return !/(swiftshader|llvmpipe|software|basic render)/i.test(renderer)
  } catch {
    return false
  } finally {
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
  }
}

export default function IntroPage({ onEnter }: IntroPageProps) {
  const [reducedMotion, setReducedMotion] = useState(false)
  const [webGlAvailable] = useState(browserSupportsWebGl)
  const [skipped, setSkipped] = useState(false)
  const [brandVisible, setBrandVisible] = useState(false)
  const [actionsVisible, setActionsVisible] = useState(false)
  const [settled, setSettled] = useState(false)
  const [transitioning, setTransitioning] = useState(false)
  const planeProgress = useRef(0)
  const globeScale = useRef(0)

  useEffect(() => {
    document.title = 'Language School · Rocío Ruiz'
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReducedMotion(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    if (!webGlAvailable || reducedMotion) {
      setBrandVisible(true)
      setActionsVisible(true)
      setSettled(true)
    }
  }, [reducedMotion, webGlAvailable])

  function skipIntro() {
    planeProgress.current = 1
    globeScale.current = 1
    setSkipped(true)
    setBrandVisible(true)
    setActionsVisible(true)
    setSettled(true)
  }

  function enterAcademy() {
    if (!settled || transitioning) return

    if (!webGlAvailable || reducedMotion) {
      onEnter()
      return
    }

    setTransitioning(true)
    try {
      runPremiumCloudTransition(onEnter)
    } catch {
      setTransitioning(false)
      onEnter()
    }
  }

  const classes = [
    'premium-intro',
    reducedMotion ? 'reduced-motion' : '',
    brandVisible ? 'brand-visible' : '',
    actionsVisible ? 'actions-visible' : '',
    settled ? 'settled' : '',
  ].filter(Boolean).join(' ')

  return (
    <main className={classes}>
      {webGlAvailable ? (
        <div className="premium-intro-canvas" aria-hidden="true">
          <PremiumScene
            reducedMotion={reducedMotion}
            skipped={skipped}
            settled={settled}
            planeProgress={planeProgress}
            globeScale={globeScale}
            onBrandVisible={() => setBrandVisible(true)}
            onActionsVisible={() => setActionsVisible(true)}
            onSettled={() => setSettled(true)}
          />
        </div>
      ) : (
        <div className="premium-static-globe" aria-hidden="true" />
      )}

      <div className="premium-intro-glow" aria-hidden="true" />
      <div className="premium-intro-vignette" aria-hidden="true" />

      <div className="premium-intro-ui">
        <section className="premium-brand-lockup" aria-label="Language School Rocío Ruiz">
          <span className="premium-brand-language">LANGUAGE</span>
          <strong className="premium-brand-school">School</strong>
          <div className="premium-brand-divider" aria-hidden="true" />
          <span className="premium-brand-rocio">ROCÍO RUIZ</span>
        </section>

        {!settled && !reducedMotion && (
          <button className="premium-skip-button" type="button" onClick={skipIntro}>
            Saltar intro
          </button>
        )}

        <div className="premium-entry-actions" aria-hidden={!actionsVisible}>
          <p className="premium-instruction">
            {webGlAvailable ? 'Mueve el cursor sobre el mundo' : 'Bienvenido a Language School'}
          </p>
          <button
            className="premium-enter-button intro-enter-button"
            type="button"
            onClick={enterAcademy}
            disabled={!settled || transitioning}
          >
            <span>{transitioning ? 'ENTRANDO…' : 'ENTRAR'}</span>
            {!transitioning && <span aria-hidden="true" className="premium-enter-arrow">↗</span>}
          </button>
        </div>
      </div>
    </main>
  )
}
