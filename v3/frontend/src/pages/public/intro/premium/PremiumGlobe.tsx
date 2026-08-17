import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { MeshTransmissionMaterial, Ring } from '@react-three/drei'
import * as THREE from 'three'

const MAGENTA = '#d62974'
const MAGENTA_LIGHT = '#f4a7c8'
const GLASS_PINK = '#fff1f7'
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
  const [earthMap, setEarthMap] = useState<THREE.Texture | null>(null)
  const sceneWidth = useThree((state) => state.size.width)
  const targetScale = useRef(1)
  const pointer = useRef(new THREE.Vector2())

  useEffect(() => {
    let mounted = true
    const loader = new THREE.TextureLoader()

    loader.load(
      EARTH_TEXTURE_URL,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace
        texture.anisotropy = 4
        texture.needsUpdate = true
        if (mounted) setEarthMap(texture)
        else texture.dispose()
      },
      undefined,
      () => {
        // La intro sigue funcionando aunque GitHub/raw o la red no entregue la textura.
        if (mounted) setEarthMap(null)
      },
    )

    return () => {
      mounted = false
      setEarthMap((texture) => {
        texture?.dispose()
        return null
      })
    }
  }, [])

  const transmissionResolution = sceneWidth <= 760 ? 512 : sceneWidth <= 1024 ? 768 : 1024

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
        <Ring args={[2.3, 2.33, 64]} rotation={[Math.PI / 2.5, 0.2, 0]}>
          <meshBasicMaterial color={MAGENTA} transparent opacity={0.48} side={THREE.DoubleSide} />
        </Ring>
        <Ring args={[2.1, 2.125, 64]} rotation={[Math.PI / 3, -0.1, 0]}>
          <meshBasicMaterial color={MAGENTA_LIGHT} transparent opacity={0.34} side={THREE.DoubleSide} />
        </Ring>
      </group>

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
          color={GLASS_PINK}
          roughness={0}
          chromaticAberration={0.006}
          anisotropicBlur={0}
          clearcoat={1}
          clearcoatRoughness={0}
          envMapIntensity={0.72}
          resolution={transmissionResolution}
        />
      </mesh>

      <mesh scale={1.44} rotation={[0.45, Math.PI / 1.7, 0]}>
        <sphereGeometry args={[1, 64, 64]} />
        <meshStandardMaterial
          map={earthMap ?? undefined}
          color={earthMap ? '#fff9fb' : '#f4a7c8'}
          emissive={earthMap ? '#fff4f8' : '#d62974'}
          emissiveMap={earthMap ?? undefined}
          emissiveIntensity={earthMap ? 0.32 : 0.18}
          roughness={0.5}
        />
      </mesh>

      {!earthMap && (
        <group rotation={[0.1, 0.4, 0]}>
          <Ring args={[1.47, 1.49, 96]} rotation={[Math.PI / 2, 0, 0]}>
            <meshBasicMaterial color="#fff7fb" transparent opacity={0.55} side={THREE.DoubleSide} />
          </Ring>
          <Ring args={[1.47, 1.49, 96]} rotation={[Math.PI / 2, Math.PI / 3, 0]}>
            <meshBasicMaterial color="#fff7fb" transparent opacity={0.42} side={THREE.DoubleSide} />
          </Ring>
          <Ring args={[1.47, 1.49, 96]} rotation={[Math.PI / 2, -Math.PI / 3, 0]}>
            <meshBasicMaterial color="#fff7fb" transparent opacity={0.42} side={THREE.DoubleSide} />
          </Ring>
        </group>
      )}

      <pointLight position={[0, 0, 1.5]} color="#ffd8e8" intensity={3.2} distance={6} />
    </group>
  )
}
