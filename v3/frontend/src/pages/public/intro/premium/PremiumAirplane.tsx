import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const MAGENTA = '#d62974'
const MAGENTA_DARK = '#9e164f'
const PEARL = '#fffdfd'
const METAL = '#d7d1d5'
const CANOPY = '#3b2632'

export const flightPath = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-8, -2, 6),
  new THREE.Vector3(-4, -0.5, 4),
  new THREE.Vector3(-1, 0.5, 1.5),
  new THREE.Vector3(1, 0.5, 0),
  new THREE.Vector3(2.5, 0, -1.5),
  new THREE.Vector3(1, -0.5, -3),
  new THREE.Vector3(-1, 0, -2.5),
  new THREE.Vector3(-1.5, 0.5, -1),
  new THREE.Vector3(0, 0.8, -0.5),
  new THREE.Vector3(1.5, 1, 1),
], false, 'catmullrom', 0.5)

export default function PremiumAirplane({ progressRef }: { progressRef: React.MutableRefObject<number> }) {
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
        radius = 0.118 * Math.pow(1 - tail, 0.72) + 0.008
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

  useFrame(() => {
    if (!groupRef.current) return

    const t = Math.max(0, Math.min(progressRef.current, 0.999))
    flightPath.getPointAt(t, point.current)
    groupRef.current.position.copy(point.current)
    flightPath.getTangentAt(t, tangent.current)

    const bankAmount = Math.sin(t * Math.PI * 4) * 0.28
    up.current.set(0, 1, 0).applyAxisAngle(tangent.current, bankAmount)
    lookTarget.current.copy(point.current).add(tangent.current)
    orientationMatrix.current.lookAt(point.current, lookTarget.current, up.current)
    groupRef.current.quaternion.setFromRotationMatrix(orientationMatrix.current)

    const baseScale = 0.68 + (1 - t) * 0.42
    const exitFactor = t <= 0.955
      ? 1
      : THREE.MathUtils.smoothstep(1 - t, 0.001, 0.045)

    groupRef.current.scale.setScalar(baseScale * exitFactor)
    groupRef.current.visible = t < 0.999

    if (lightRef.current) {
      lightRef.current.intensity = 1.2 * exitFactor
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

      <pointLight ref={lightRef} position={[0, -0.04, 0.85]} color={MAGENTA} intensity={1.2} distance={2.6} />
    </group>
  )
}
