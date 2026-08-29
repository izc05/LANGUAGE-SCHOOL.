import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

const INTRO_SECONDS = 7.6
const APPROACH_END = 0.47
const ORBIT_END = 0.84
const GLOBE_CENTER = new THREE.Vector3(0.35, 0.08, -1.45)

function BrandPlane() {
  return (
    <group scale={0.92}>
      <mesh scale={[0.16, 0.16, 0.88]}>
        <sphereGeometry args={[1, 28, 28]} />
        <meshPhysicalMaterial color="#d62974" roughness={0.18} clearcoat={1} clearcoatRoughness={0.06} />
      </mesh>
      <mesh position={[0, 0, -0.92]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.16, 0.42, 28]} />
        <meshPhysicalMaterial color="#d62974" roughness={0.16} clearcoat={1} />
      </mesh>
      <mesh position={[0, -0.01, -0.02]} rotation={[0, 0, -0.025]}>
        <boxGeometry args={[1.52, 0.045, 0.36]} />
        <meshPhysicalMaterial color="#f4a7c8" roughness={0.17} clearcoat={1} />
      </mesh>
      <mesh position={[0, 0.01, 0.6]}>
        <boxGeometry args={[0.68, 0.04, 0.22]} />
        <meshStandardMaterial color="#cc1f67" roughness={0.22} />
      </mesh>
      <mesh position={[0, 0.18, 0.69]} rotation={[0.08, 0, 0]}>
        <boxGeometry args={[0.04, 0.36, 0.22]} />
        <meshStandardMaterial color="#cc1f67" roughness={0.22} />
      </mesh>
      <pointLight position={[0, 0, 0.22]} intensity={4.8} distance={2.8} color="#ef7caf" />
    </group>
  )
}

export default function FlightScene({ reducedMotion, settled }: { reducedMotion: boolean; settled: boolean }) {
  const plane = useRef<THREE.Group>(null)
  const orientation = useMemo(() => new THREE.Quaternion(), [])
  const bank = useMemo(() => new THREE.Quaternion(), [])
  const forward = useMemo(() => new THREE.Vector3(0, 0, -1), [])
  const tangent = useMemo(() => new THREE.Vector3(), [])
  const point = useMemo(() => new THREE.Vector3(), [])
  const nextPoint = useMemo(() => new THREE.Vector3(), [])

  const approach = useMemo(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(-5.8, -2.35, 5.7),
    new THREE.Vector3(-4.1, -1.4, 4.5),
    new THREE.Vector3(-2.6, -0.35, 2.9),
    new THREE.Vector3(-1.25, 0.45, 1.15),
    new THREE.Vector3(0.1, 0.55, -0.25),
    new THREE.Vector3(2, 0.48, -1.15),
  ], false, 'catmullrom', 0.42), [])

  const pathPoints = useMemo(() => {
    const points = approach.getPoints(100)
    for (let index = 0; index <= 120; index += 1) {
      const progress = index / 120
      const angle = 0.15 + progress * Math.PI * 2
      points.push(new THREE.Vector3(
        GLOBE_CENTER.x + Math.cos(angle) * 2.02,
        GLOBE_CENTER.y + 0.34 + Math.sin(angle * 1.2) * 0.38,
        GLOBE_CENTER.z + Math.sin(angle) * 1.5,
      ))
    }
    points.push(new THREE.Vector3(1.95, 1.35, -0.92))
    points.push(new THREE.Vector3(1.72, 1.52, -0.72))
    return points
  }, [approach])

  const trailGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints(pathPoints)
    geometry.setDrawRange(0, 1)
    return geometry
  }, [pathPoints])
  const trailMaterial = useMemo(() => new THREE.LineBasicMaterial({ color: '#d62974', transparent: true, opacity: 0.16, depthWrite: false }), [])
  const trail = useMemo(() => new THREE.Line(trailGeometry, trailMaterial), [trailGeometry, trailMaterial])

  useEffect(() => () => {
    trailGeometry.dispose()
    trailMaterial.dispose()
  }, [trailGeometry, trailMaterial])

  useFrame((state, delta) => {
    if (!plane.current) return
    const cycle = reducedMotion || settled ? 0.985 : Math.min(state.clock.elapsedTime / INTRO_SECONDS, 0.985)
    let progress = 0
    let bankAmount = 0

    if (cycle <= APPROACH_END) {
      const local = THREE.MathUtils.smoothstep(cycle / APPROACH_END, 0, 1)
      point.copy(approach.getPointAt(Math.min(local, 0.998)))
      nextPoint.copy(approach.getPointAt(Math.min(local + 0.008, 0.999)))
      progress = local * 0.42
      bankAmount = Math.sin(local * Math.PI) * 0.07
    } else if (cycle <= ORBIT_END) {
      const local = THREE.MathUtils.smoothstep((cycle - APPROACH_END) / (ORBIT_END - APPROACH_END), 0, 1)
      const angle = 0.15 + local * Math.PI * 2
      const nextAngle = angle + 0.025
      point.set(GLOBE_CENTER.x + Math.cos(angle) * 2.02, GLOBE_CENTER.y + 0.34 + Math.sin(angle * 1.2) * 0.38, GLOBE_CENTER.z + Math.sin(angle) * 1.5)
      nextPoint.set(GLOBE_CENTER.x + Math.cos(nextAngle) * 2.02, GLOBE_CENTER.y + 0.34 + Math.sin(nextAngle * 1.2) * 0.38, GLOBE_CENTER.z + Math.sin(nextAngle) * 1.5)
      progress = 0.42 + local * 0.5
      bankAmount = -0.13
    } else {
      const local = THREE.MathUtils.smoothstep((cycle - ORBIT_END) / (1 - ORBIT_END), 0, 1)
      point.set(1.95 - local * 0.23, 1.35 + local * 0.17, -0.92 + local * 0.2)
      nextPoint.set(1.72, 1.53, -0.7)
      progress = 0.92 + local * 0.08
      bankAmount = -0.025
    }

    tangent.copy(nextPoint).sub(point).normalize()
    orientation.setFromUnitVectors(forward, tangent)
    bank.setFromAxisAngle(tangent, reducedMotion ? 0 : bankAmount)
    orientation.multiply(bank)
    plane.current.position.copy(point)
    plane.current.quaternion.slerp(orientation, 1 - Math.exp(-delta * 10))
    const nearCamera = THREE.MathUtils.clamp((point.z + 3.5) / 9, 0, 1)
    plane.current.scale.setScalar(0.7 + nearCamera * 0.18)
    plane.current.visible = true
    trail.visible = !settled && !reducedMotion
    trail.geometry.setDrawRange(0, Math.max(2, Math.floor(progress * pathPoints.length)))
    trailMaterial.opacity = 0.07 + Math.sin(Math.min(progress, 1) * Math.PI) * 0.16
  })

  return <group><primitive object={trail} /><group ref={plane}><BrandPlane /></group></group>
}
