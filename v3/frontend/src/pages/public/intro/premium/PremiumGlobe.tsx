import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { MeshTransmissionMaterial, Ring, useTexture } from '@react-three/drei'
import * as THREE from 'three'

const MAGENTA = '#d62974'
const MAGENTA_LIGHT = '#f4a7c8'
const EARTH_TEXTURE_URL = 'https://raw.githubusercontent.com/izc05/web-v1.1/44fa75a35e59693fd53486a0798f258ac58b0fdb/public/earth.jpg'

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
  const coreRef = useRef<THREE.Mesh>(null)
  const haloRef = useRef<THREE.Group>(null)
  const [hovered, setHovered] = useState(false)
  const earthMap = useTexture(EARTH_TEXTURE_URL)
  const targetScale = useRef(1)
  const pointer = useRef(new THREE.Vector2())

  useFrame((state, delta) => {
    if (!groupRef.current || !coreRef.current || !haloRef.current) return

    const baseScale = responsiveGlobeScale(state.size.width)
    groupRef.current.position.y = responsiveGlobeY(state.size.width)

    if (!introComplete) {
      groupRef.current.scale.setScalar(Math.max(0, scaleRef.current) * baseScale)
    }

    groupRef.current.rotation.y += delta * 0.015

    if (introComplete) {
      pointer.current.x = THREE.MathUtils.lerp(pointer.current.x, state.pointer.x, 0.1)
      pointer.current.y = THREE.MathUtils.lerp(pointer.current.y, state.pointer.y, 0.1)

      groupRef.current.rotation.x = pointer.current.y * 0.2
      groupRef.current.rotation.z = pointer.current.x * -0.1

      targetScale.current = baseScale * (hovered ? 1.04 : 1)
      const currentScale = groupRef.current.scale.x
      groupRef.current.scale.setScalar(THREE.MathUtils.damp(currentScale, targetScale.current, 4, delta))
      haloRef.current.rotation.z = state.clock.elapsedTime * 0.1
    }
  })

  return (
    <group ref={groupRef} position={[0, -0.2, 0]} scale={0}>
      <group ref={haloRef}>
        <Ring args={[2.3, 2.32, 64]} rotation={[Math.PI / 2.5, 0.2, 0]}>
          <meshBasicMaterial color={MAGENTA} transparent opacity={0.3} side={THREE.DoubleSide} />
        </Ring>
        <Ring args={[2.1, 2.11, 64]} rotation={[Math.PI / 3, -0.1, 0]}>
          <meshBasicMaterial color={MAGENTA_LIGHT} transparent opacity={0.2} side={THREE.DoubleSide} />
        </Ring>
      </group>

      <mesh>
        <sphereGeometry args={[1.52, 32, 32]} />
        <meshBasicMaterial color={MAGENTA} wireframe transparent opacity={0.015} />
      </mesh>

      <mesh
        ref={coreRef}
        onPointerOver={() => introComplete && setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[1.5, 64, 64]} />
        <MeshTransmissionMaterial
          backside
          backsideThickness={0.1}
          thickness={0.2}
          color="#ffffff"
          roughness={0}
          chromaticAberration={0.01}
          anisotropicBlur={0}
          clearcoat={1}
          clearcoatRoughness={0}
          envMapIntensity={0.8}
          resolution={1024}
        />
      </mesh>

      <mesh scale={1.44} rotation={[0.45, Math.PI / 1.7, 0]}>
        <sphereGeometry args={[1, 64, 64]} />
        <meshStandardMaterial
          map={earthMap}
          color="#ffffff"
          emissive="#ffffff"
          emissiveMap={earthMap}
          emissiveIntensity={0.3}
          roughness={0.5}
        />
      </mesh>

      <pointLight position={[0, 0, 1.5]} color="#ffffff" intensity={4} distance={6} />
    </group>
  )
}
