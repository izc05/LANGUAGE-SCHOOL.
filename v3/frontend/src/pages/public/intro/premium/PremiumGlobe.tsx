import { MeshTransmissionMaterial } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef, useState } from 'react'
import * as THREE from 'three'

const MAGENTA = '#d62974'
const MAGENTA_LIGHT = '#f4a7c8'

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

    // Los reflejos se desplazan muy despacio como en una burbuja real.
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
      {/*
        Cristal real: recupera la óptica de la esfera original de Antigravity.
        No hay Tierra, malla ni relleno decorativo; el volumen nace de refracción,
        clearcoat y de los Lightformers del entorno.
      */}
      <mesh
        onPointerOver={() => introComplete && setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[1.5, 128, 128]} />
        <MeshTransmissionMaterial
          backside
          backsideThickness={0.16}
          thickness={0.24}
          color="#fffafd"
          roughness={hovered && introComplete ? 0.018 : 0.028}
          chromaticAberration={hovered && introComplete ? 0.024 : 0.016}
          anisotropicBlur={0.055}
          clearcoat={1}
          clearcoatRoughness={0.018}
          envMapIntensity={1.7}
          ior={1.33}
          resolution={resolution}
        />
      </mesh>

      {/* Contracara apenas perceptible: da espesor sin convertirla en una bola blanca. */}
      <mesh scale={0.987}>
        <sphereGeometry args={[1.5, 96, 96]} />
        <meshPhysicalMaterial
          color="#ffdbea"
          transparent
          opacity={0.018}
          transmission={1}
          thickness={0.025}
          roughness={0}
          clearcoat={1}
          clearcoatRoughness={0}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      <group ref={highlightRef}>
        {/* Reflejo largo de estudio: no dibuja una órbita, solo una luz curvada. */}
        <mesh position={[-0.48, 0.62, 1.27]} rotation={[0.08, 0.32, -0.82]}>
          <torusGeometry args={[0.54, 0.018, 16, 120, Math.PI * 0.64]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.72} depthWrite={false} />
        </mesh>
        <mesh position={[-0.42, 0.55, 1.31]} rotation={[0.06, 0.30, -0.80]}>
          <torusGeometry args={[0.63, 0.007, 12, 120, Math.PI * 0.52]} />
          <meshBasicMaterial color={MAGENTA_LIGHT} transparent opacity={0.38} depthWrite={false} />
        </mesh>

        {/* Reflejo secundario más corto en el lado opuesto. */}
        <mesh position={[0.88, -0.72, 1.02]} rotation={[0.08, -0.24, 2.36]}>
          <torusGeometry args={[0.27, 0.009, 12, 72, Math.PI * 0.58]} />
          <meshBasicMaterial color={MAGENTA} transparent opacity={0.28} depthWrite={false} />
        </mesh>

        {/* Hot-spots de cristal, muy pequeños. */}
        <mesh position={[-0.96, 0.47, 1.11]}>
          <sphereGeometry args={[0.027, 20, 20]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.9} depthWrite={false} />
        </mesh>
        <mesh position={[-0.86, 0.36, 1.20]}>
          <sphereGeometry args={[0.015, 16, 16]} />
          <meshBasicMaterial color={MAGENTA_LIGHT} transparent opacity={0.8} depthWrite={false} />
        </mesh>
      </group>

      {/* Iluminación equivalente a la que hacía brillar la Tierra original. */}
      <pointLight position={[-1.7, 1.5, 2.5]} color="#fff7fc" intensity={5.2} distance={7} />
      <pointLight position={[1.55, -0.95, 2.2]} color={MAGENTA_LIGHT} intensity={2.8} distance={6} />
      <pointLight position={[0.2, -0.1, -0.35]} color="#fff2f8" intensity={3.6} distance={3.8} />
    </group>
  )
}
