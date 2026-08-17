import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const MAGENTA = '#d62974'
const MAGENTA_LIGHT = '#f4a7c8'
const PEARL = '#fffafd'

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

export default function PremiumGlobe({ introComplete, scaleRef }: PremiumGlobeProps) {
  const groupRef = useRef<THREE.Group>(null)
  const reflectionRef = useRef<THREE.Group>(null)
  const [hovered, setHovered] = useState(false)
  const targetScale = useRef(1)
  const pointer = useRef(new THREE.Vector2())

  useFrame((state, delta) => {
    if (!groupRef.current || !reflectionRef.current) return

    const baseScale = responsiveGlobeScale(state.size.width)
    groupRef.current.position.y = responsiveGlobeY(state.size.width)

    if (!introComplete) {
      groupRef.current.scale.setScalar(Math.max(0, scaleRef.current) * baseScale)
    }

    reflectionRef.current.rotation.z = state.clock.elapsedTime * 0.028
    reflectionRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.16) * 0.08

    if (introComplete) {
      pointer.current.x = THREE.MathUtils.lerp(pointer.current.x, state.pointer.x, 0.08)
      pointer.current.y = THREE.MathUtils.lerp(pointer.current.y, state.pointer.y, 0.08)

      groupRef.current.rotation.x = pointer.current.y * 0.08
      groupRef.current.rotation.y = pointer.current.x * 0.1

      targetScale.current = baseScale * (hovered ? 1.025 : 1)
      const currentScale = groupRef.current.scale.x
      groupRef.current.scale.setScalar(THREE.MathUtils.damp(currentScale, targetScale.current, 4, delta))
    }
  })

  return (
    <group ref={groupRef} position={[0, -0.2, 0]} scale={0}>
      <mesh
        onPointerOver={() => introComplete && setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[1.5, 96, 96]} />
        <meshPhysicalMaterial
          color={PEARL}
          transparent
          opacity={0.16}
          transmission={1}
          thickness={0.025}
          roughness={0}
          metalness={0}
          clearcoat={1}
          clearcoatRoughness={0}
          iridescence={0.82}
          iridescenceIOR={1.18}
          iridescenceThicknessRange={[120, 430]}
          envMapIntensity={0.92}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      <mesh scale={0.986}>
        <sphereGeometry args={[1.5, 80, 80]} />
        <meshPhysicalMaterial
          color="#ffffff"
          transparent
          opacity={0.035}
          transmission={1}
          thickness={0.012}
          roughness={0}
          clearcoat={1}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      <group ref={reflectionRef}>
        <mesh rotation={[0, 0, 0]}>
          <torusGeometry args={[1.5, 0.012, 16, 160]} />
          <meshBasicMaterial color={MAGENTA} transparent opacity={0.26} depthWrite={false} />
        </mesh>

        <mesh rotation={[0.28, 0.72, -0.24]}>
          <torusGeometry args={[1.492, 0.009, 14, 140]} />
          <meshBasicMaterial color={MAGENTA_LIGHT} transparent opacity={0.2} depthWrite={false} />
        </mesh>

        <mesh position={[-0.66, 0.72, 1.23]} rotation={[0.08, 0.38, -0.72]}>
          <torusGeometry args={[0.36, 0.022, 12, 64, Math.PI * 0.88]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.52} depthWrite={false} />
        </mesh>

        <mesh position={[-0.49, 0.56, 1.32]} rotation={[0.06, 0.34, -0.7]}>
          <torusGeometry args={[0.46, 0.012, 12, 72, Math.PI * 0.7]} />
          <meshBasicMaterial color={MAGENTA_LIGHT} transparent opacity={0.34} depthWrite={false} />
        </mesh>

        <mesh position={[0.83, -0.72, 1.02]} rotation={[0.1, -0.28, 2.3]}>
          <torusGeometry args={[0.24, 0.012, 10, 48, Math.PI * 0.72]} />
          <meshBasicMaterial color={MAGENTA} transparent opacity={0.2} depthWrite={false} />
        </mesh>
      </group>

      <pointLight position={[-1.8, 1.65, 2.8]} color="#fff8fc" intensity={4.4} distance={7} />
      <pointLight position={[1.8, -1.1, 2.1]} color={MAGENTA_LIGHT} intensity={2.2} distance={6} />
    </group>
  )
}
