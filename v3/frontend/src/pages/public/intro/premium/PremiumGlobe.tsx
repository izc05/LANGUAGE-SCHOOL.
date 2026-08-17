import { MeshTransmissionMaterial } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef, useState } from 'react'
import * as THREE from 'three'

const MAGENTA = '#d62974'
const MAGENTA_LIGHT = '#f4a7c8'
const ROSE_GLASS = '#ffd9e8'
const ROSE_HIGHLIGHT = '#ffe8f1'

type PremiumGlobeProps = {
  introComplete: boolean
  scaleRef: React.MutableRefObject<number>
}

function responsiveGlobeScale(width: number) {
  if (width <= 480) return 0.46
  if (width <= 760) return 0.54
  if (width <= 1024) return 0.82
  return 1
}

function responsiveGlobeY(width: number) {
  if (width <= 480) return 0.22
  if (width <= 760) return 0.14
  return -0.2
}

function transmissionResolution(width: number) {
  if (width <= 760) return 512
  if (width <= 1180) return 768
  return 1024
}

export default function PremiumGlobe({ introComplete, scaleRef }: PremiumGlobeProps) {
  const groupRef = useRef<THREE.Group>(null)
  const highlightRef = useRef<THREE.Group>(null)
  const pointer = useRef(new THREE.Vector2())
  const targetScale = useRef(1)
  const [hovered, setHovered] = useState(false)

  useFrame((state, delta) => {
    if (!groupRef.current || !highlightRef.current) return

    const baseScale = responsiveGlobeScale(state.size.width)
    groupRef.current.position.y = responsiveGlobeY(state.size.width)

    if (!introComplete) {
      groupRef.current.scale.setScalar(Math.max(0, scaleRef.current) * baseScale)
    }

    highlightRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.18) * 0.035
    highlightRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.14) * 0.045

    if (introComplete) {
      pointer.current.x = THREE.MathUtils.lerp(pointer.current.x, state.pointer.x, 0.07)
      pointer.current.y = THREE.MathUtils.lerp(pointer.current.y, state.pointer.y, 0.07)

      groupRef.current.rotation.x = pointer.current.y * 0.06
      groupRef.current.rotation.y = pointer.current.x * 0.08

      targetScale.current = baseScale * (hovered ? 1.018 : 1)
      groupRef.current.scale.setScalar(
        THREE.MathUtils.damp(groupRef.current.scale.x, targetScale.current, 4, delta),
      )
    }
  })

  const resolution = typeof window === 'undefined' ? 768 : transmissionResolution(window.innerWidth)

  return (
    <group ref={groupRef} position={[0, -0.2, 0]} scale={0}>
      <mesh
        onPointerOver={() => introComplete && setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[1.5, 128, 128]} />
        <MeshTransmissionMaterial
          backside
          backsideThickness={0.075}
          thickness={0.13}
          transmission={1}
          color="#fff9fc"
          attenuationColor={ROSE_GLASS}
          attenuationDistance={4.8}
          roughness={hovered && introComplete ? 0.012 : 0.018}
          chromaticAberration={hovered && introComplete ? 0.014 : 0.009}
          anisotropicBlur={0.032}
          clearcoat={1}
          clearcoatRoughness={0.012}
          envMapIntensity={1.5}
          ior={1.18}
          resolution={resolution}
        />
      </mesh>

      <mesh scale={0.989}>
        <sphereGeometry args={[1.5, 96, 96]} />
        <meshPhysicalMaterial
          color={ROSE_GLASS}
          transparent
          opacity={0.009}
          transmission={1}
          thickness={0.012}
          roughness={0}
          clearcoat={1}
          clearcoatRoughness={0}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      <group ref={highlightRef}>
        <mesh position={[-0.48, 0.62, 1.27]} rotation={[0.08, 0.32, -0.82]}>
          <torusGeometry args={[0.54, 0.016, 16, 120, Math.PI * 0.64]} />
          <meshBasicMaterial color={ROSE_HIGHLIGHT} transparent opacity={0.68} depthWrite={false} />
        </mesh>
        <mesh position={[-0.42, 0.55, 1.31]} rotation={[0.06, 0.30, -0.80]}>
          <torusGeometry args={[0.63, 0.007, 12, 120, Math.PI * 0.52]} />
          <meshBasicMaterial color={MAGENTA_LIGHT} transparent opacity={0.46} depthWrite={false} />
        </mesh>

        <mesh position={[0.88, -0.72, 1.02]} rotation={[0.08, -0.24, 2.36]}>
          <torusGeometry args={[0.27, 0.008, 12, 72, Math.PI * 0.58]} />
          <meshBasicMaterial color={MAGENTA_LIGHT} transparent opacity={0.36} depthWrite={false} />
        </mesh>

        <mesh position={[-0.96, 0.47, 1.11]}>
          <sphereGeometry args={[0.025, 20, 20]} />
          <meshBasicMaterial color={ROSE_HIGHLIGHT} transparent opacity={0.88} depthWrite={false} />
        </mesh>
        <mesh position={[-0.86, 0.36, 1.20]}>
          <sphereGeometry args={[0.014, 16, 16]} />
          <meshBasicMaterial color={MAGENTA_LIGHT} transparent opacity={0.82} depthWrite={false} />
        </mesh>
      </group>

      <pointLight position={[-1.7, 1.5, 2.5]} color={ROSE_HIGHLIGHT} intensity={4.8} distance={7} />
      <pointLight position={[1.55, -0.95, 2.2]} color={MAGENTA_LIGHT} intensity={3.2} distance={6} />
      <pointLight position={[0.2, -0.1, -0.35]} color="#ffe8f2" intensity={2.8} distance={3.8} />
    </group>
  )
}
