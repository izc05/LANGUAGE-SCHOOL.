import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const MAGENTA = '#d62974'

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
  const point = useRef(new THREE.Vector3())
  const tangent = useRef(new THREE.Vector3())
  const up = useRef(new THREE.Vector3(0, 1, 0))

  const fuselageGeo = useMemo(() => {
    const points: THREE.Vector2[] = []
    for (let i = 0; i <= 40; i += 1) {
      const x = i / 40
      let r = 0.045
      if (x < 0.3) {
        const t = x / 0.3
        r = 0.045 * (0.1 + 0.9 * t)
      } else if (x > 0.75) {
        const t = (x - 0.75) / 0.25
        r = 0.045 * Math.cos(t * Math.PI / 2)
      }
      points.push(new THREE.Vector2(r, (0.5 - x) * 1.4))
    }
    const geo = new THREE.LatheGeometry(points, 32)
    geo.rotateX(Math.PI / 2)
    return geo
  }, [])

  const wingGeo = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(0, -0.2)
    shape.lineTo(0.9, 0.2)
    shape.lineTo(0.9, 0.3)
    shape.lineTo(0, 0.15)
    shape.lineTo(0, -0.2)
    const geo = new THREE.ShapeGeometry(shape)
    geo.rotateX(Math.PI / 2)
    return geo
  }, [])

  const tailGeo = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(0.55, -0.02)
    shape.lineTo(0.65, 0.25)
    shape.lineTo(0.75, 0.25)
    shape.lineTo(0.7, -0.02)
    shape.lineTo(0.55, -0.02)
    const geo = new THREE.ShapeGeometry(shape)
    geo.rotateY(Math.PI / 2)
    return geo
  }, [])

  useFrame(() => {
    if (!groupRef.current) return
    const t = Math.max(0, Math.min(progressRef.current, 0.999))
    flightPath.getPointAt(t, point.current)
    groupRef.current.position.copy(point.current)
    flightPath.getTangentAt(t, tangent.current)
    const bankAmount = Math.sin(t * Math.PI * 4) * 0.4

    const matrix = new THREE.Matrix4()
    up.current.set(0, 1, 0).applyAxisAngle(tangent.current, bankAmount)
    matrix.lookAt(point.current, point.current.clone().add(tangent.current), up.current)
    groupRef.current.quaternion.setFromRotationMatrix(matrix)

    const scale = 0.7 + (1 - t) * 0.5
    groupRef.current.scale.setScalar(scale)
    groupRef.current.visible = t < 0.99
  })

  return (
    <group ref={groupRef}>
      <mesh geometry={fuselageGeo}>
        <meshPhysicalMaterial color={MAGENTA} clearcoat={1} roughness={0.1} metalness={0.1} />
      </mesh>

      <mesh geometry={wingGeo}>
        <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={wingGeo} scale={[-1, 1, 1]}>
        <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} />
      </mesh>

      <mesh geometry={tailGeo}>
        <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} />
      </mesh>

      <mesh geometry={wingGeo} position={[0, 0, 0.6]} scale={[0.3, 0.3, 0.3]}>
        <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={wingGeo} position={[0, 0, 0.6]} scale={[-0.3, 0.3, 0.3]}>
        <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} />
      </mesh>

      <pointLight position={[-1.4, -0.05, 0.2]} color="#ff0000" intensity={1} distance={2} />
      <pointLight position={[1.4, -0.05, 0.2]} color="#00ff00" intensity={1} distance={2} />
    </group>
  )
}
