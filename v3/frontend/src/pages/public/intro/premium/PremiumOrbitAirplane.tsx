import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

const MAGENTA = '#d62974'
const MAGENTA_DARK = '#9e164f'
const PEARL = '#fffdfd'
const METAL = '#d7d1d5'
const CANOPY = '#3b2632'

function PremiumOrbitAirplaneModel({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null)
  const lightRef = useRef<THREE.PointLight>(null)
  const point = useRef(new THREE.Vector3())
  const tangent = useRef(new THREE.Vector3())
  const up = useRef(new THREE.Vector3(0, 1, 0))
  const lookTarget = useRef(new THREE.Vector3())
  const orientationMatrix = useRef(new THREE.Matrix4())

  const fuselageGeo = useMemo(() => {
    const profile: THREE.Vector2[] = []
    for (let i = 0; i <= 56; i += 1) {
      const t = i / 56
      let radius: number

      if (t < 0.18) {
        const nose = t / 0.18
        radius = 0.012 + 0.118 * Math.pow(nose, 0.68)
      } else if (t < 0.7) {
        const middle = (t - 0.18) / 0.52
        radius = 0.13 - 0.012 * middle
      } else {
        const tail = (t - 0.7) / 0.3
        radius = 0.118 * Math.pow(Math.max(0, 1 - tail), 0.72) + 0.008
      }

      profile.push(new THREE.Vector2(radius, -1.02 + t * 2.04))
    }

    const geometry = new THREE.LatheGeometry(profile, 40)
    geometry.rotateX(Math.PI / 2)
    return geometry
  }, [])

  const wingGeo = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(0.08, -0.28)
    shape.lineTo(1.05, 0.18)
    shape.lineTo(0.94, 0.38)
    shape.lineTo(0.2, 0.14)
    shape.lineTo(0.08, -0.28)
    const geometry = new THREE.ShapeGeometry(shape)
    geometry.rotateX(Math.PI / 2)
    return geometry
  }, [])

  const stabilizerGeo = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(0.04, -0.05)
    shape.lineTo(0.48, 0.16)
    shape.lineTo(0.42, 0.27)
    shape.lineTo(0.08, 0.14)
    shape.lineTo(0.04, -0.05)
    const geometry = new THREE.ShapeGeometry(shape)
    geometry.rotateX(Math.PI / 2)
    return geometry
  }, [])

  const finGeo = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(-0.12, 0)
    shape.lineTo(0.08, 0.44)
    shape.lineTo(0.18, 0.42)
    shape.lineTo(0.22, 0)
    shape.lineTo(-0.12, 0)
    const geometry = new THREE.ShapeGeometry(shape)
    geometry.rotateY(-Math.PI / 2)
    return geometry
  }, [])

  useFrame((state) => {
    if (!groupRef.current) return

    const angle = reducedMotion
      ? -0.72
      : -0.72 + (state.clock.elapsedTime / 12.5) * Math.PI * 2

    const radiusX = 2.48
    const radiusY = 2.02
    const depth = Math.sin(angle) * 0.24

    point.current.set(
      Math.cos(angle) * radiusX,
      Math.sin(angle) * radiusY,
      depth,
    )

    tangent.current.set(
      -Math.sin(angle) * radiusX,
      Math.cos(angle) * radiusY,
      Math.cos(angle) * 0.24,
    ).normalize()

    groupRef.current.position.copy(point.current)

    const bankAmount = -0.26 + Math.sin(angle * 2) * 0.08
    up.current.set(0, 1, 0).applyAxisAngle(tangent.current, bankAmount)
    lookTarget.current.copy(point.current).add(tangent.current)
    orientationMatrix.current.lookAt(point.current, lookTarget.current, up.current)
    groupRef.current.quaternion.setFromRotationMatrix(orientationMatrix.current)

    const responsiveScale = state.size.width <= 420 ? 0.31 : 0.37
    const perspectiveScale = THREE.MathUtils.mapLinear(depth, -0.24, 0.24, 0.92, 1.08)
    groupRef.current.scale.setScalar(responsiveScale * perspectiveScale)

    if (lightRef.current) {
      lightRef.current.intensity = reducedMotion ? 0.9 : 1.05 + Math.sin(angle) * 0.18
    }
  })

  return (
    <group ref={groupRef}>
      <mesh geometry={fuselageGeo}>
        <meshPhysicalMaterial
          color={PEARL}
          metalness={0.14}
          roughness={0.18}
          clearcoat={1}
          clearcoatRoughness={0.06}
        />
      </mesh>

      <mesh position={[0, -0.105, -0.04]}>
        <boxGeometry args={[0.022, 0.018, 1.38]} />
        <meshPhysicalMaterial color={MAGENTA} metalness={0.08} roughness={0.2} clearcoat={1} />
      </mesh>

      <mesh geometry={wingGeo} position={[0, -0.018, -0.03]}>
        <meshPhysicalMaterial color={PEARL} side={THREE.DoubleSide} metalness={0.16} roughness={0.16} clearcoat={1} />
      </mesh>
      <mesh geometry={wingGeo} position={[0, -0.018, -0.03]} scale={[-1, 1, 1]}>
        <meshPhysicalMaterial color={PEARL} side={THREE.DoubleSide} metalness={0.16} roughness={0.16} clearcoat={1} />
      </mesh>

      <mesh geometry={stabilizerGeo} position={[0, 0.015, 0.67]}>
        <meshPhysicalMaterial color={PEARL} side={THREE.DoubleSide} roughness={0.18} clearcoat={1} />
      </mesh>
      <mesh geometry={stabilizerGeo} position={[0, 0.015, 0.67]} scale={[-1, 1, 1]}>
        <meshPhysicalMaterial color={PEARL} side={THREE.DoubleSide} roughness={0.18} clearcoat={1} />
      </mesh>

      <mesh geometry={finGeo} position={[0, 0.055, 0.68]}>
        <meshPhysicalMaterial color={MAGENTA} side={THREE.DoubleSide} roughness={0.16} clearcoat={1} />
      </mesh>

      <mesh position={[0, 0.095, -0.55]} scale={[0.115, 0.07, 0.25]}>
        <sphereGeometry args={[1, 32, 24]} />
        <meshPhysicalMaterial
          color={CANOPY}
          metalness={0.2}
          roughness={0.08}
          clearcoat={1}
          transparent
          opacity={0.9}
        />
      </mesh>

      {[-0.34, 0.34].map((x) => (
        <group key={x} position={[x, -0.075, 0.16]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.075, 0.095, 0.5, 28, 1, false]} />
            <meshPhysicalMaterial color={METAL} metalness={0.72} roughness={0.18} clearcoat={0.75} />
          </mesh>
          <mesh position={[0, 0, -0.252]}>
            <circleGeometry args={[0.068, 28]} />
            <meshStandardMaterial color="#171317" metalness={0.45} roughness={0.22} />
          </mesh>
          <mesh position={[0, 0, 0.252]} rotation={[0, Math.PI, 0]}>
            <circleGeometry args={[0.055, 28]} />
            <meshBasicMaterial color={MAGENTA_DARK} />
          </mesh>
        </group>
      ))}

      <mesh position={[-1.01, 0, 0.2]}>
        <sphereGeometry args={[0.025, 16, 12]} />
        <meshBasicMaterial color="#c81f4d" />
      </mesh>
      <mesh position={[1.01, 0, 0.2]}>
        <sphereGeometry args={[0.025, 16, 12]} />
        <meshBasicMaterial color="#eafcff" />
      </mesh>

      <pointLight ref={lightRef} position={[0, -0.04, 0.85]} color={MAGENTA} intensity={1.1} distance={2.6} />
    </group>
  )
}

export default function PremiumOrbitAirplane() {
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReducedMotion(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  return (
    <div className="intro-orbit-plane-canvas" data-testid="intro-orbit-plane" aria-hidden="true">
      <Canvas
        dpr={[1, 1.25]}
        camera={{ position: [0, 0, 8.8], fov: 38, near: 0.1, far: 30 }}
        gl={{ antialias: true, alpha: true, stencil: false, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => gl.setClearColor('#ffffff', 0)}
      >
        <ambientLight intensity={1.55} color="#ffffff" />
        <directionalLight position={[4.5, 5.5, 6]} intensity={2.2} color="#ffffff" />
        <directionalLight position={[-4, 2.5, 2]} intensity={0.85} color="#f4a7c8" />

        <PremiumOrbitAirplaneModel reducedMotion={reducedMotion} />

      </Canvas>
    </div>
  )
}
