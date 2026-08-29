import { MeshDistortMaterial, MeshTransmissionMaterial } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

const INTRO_SECONDS = 7.6
const GLOBE_POSITION: [number, number, number] = [0.35, 0.08, -1.45]

function LatitudeRing({ y, radius }: { y: number; radius: number }) {
  return <mesh position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[radius, 0.012, 10, 96]} /><meshBasicMaterial color="#d62974" transparent opacity={0.34} depthWrite={false} /></mesh>
}

function GlobeGrid() {
  return (
    <group>
      <mesh><sphereGeometry args={[1.47, 64, 64]} /><meshBasicMaterial color="#d62974" transparent opacity={0.11} wireframe depthWrite={false} /></mesh>
      <mesh><torusGeometry args={[1.5, 0.014, 10, 128]} /><meshBasicMaterial color="#d62974" transparent opacity={0.52} depthWrite={false} /></mesh>
      <mesh rotation={[0, Math.PI / 3, 0]}><torusGeometry args={[1.5, 0.014, 10, 128]} /><meshBasicMaterial color="#d62974" transparent opacity={0.37} depthWrite={false} /></mesh>
      <mesh rotation={[0, -Math.PI / 3, 0]}><torusGeometry args={[1.5, 0.014, 10, 128]} /><meshBasicMaterial color="#d62974" transparent opacity={0.37} depthWrite={false} /></mesh>
      <LatitudeRing y={0.72} radius={1.31} />
      <LatitudeRing y={0} radius={1.5} />
      <LatitudeRing y={-0.72} radius={1.31} />
    </group>
  )
}

function CrystalHalo() {
  return (
    <group position={[0, 0, -0.55]} rotation={[0.12, 0.18, 0]}>
      <mesh><ringGeometry args={[1.72, 2.2, 96]} /><meshBasicMaterial color="#ef8fba" transparent opacity={0.06} side={THREE.DoubleSide} depthWrite={false} /></mesh>
      <mesh rotation={[0, 0, Math.PI / 3.8]}><torusGeometry args={[2.05, 0.022, 10, 160]} /><meshBasicMaterial color="#f4a9c8" transparent opacity={0.11} depthWrite={false} /></mesh>
      <mesh rotation={[0, 0, -Math.PI / 4.5]}><torusGeometry args={[1.9, 0.01, 8, 160]} /><meshBasicMaterial color="#fff1f7" transparent opacity={0.3} depthWrite={false} /></mesh>
    </group>
  )
}

export default function GlobeScene({ reducedMotion, interactive }: { reducedMotion: boolean; interactive: boolean }) {
  const globe = useRef<THREE.Group>(null)
  const core = useRef<THREE.Mesh>(null)
  const inner = useRef<THREE.Mesh>(null)
  const light = useRef<THREE.PointLight>(null)
  const pointerTarget = useMemo(() => new THREE.Vector2(), [])
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)

  useEffect(() => {
    if (!interactive || reducedMotion) {
      document.body.style.cursor = ''
      return
    }
    document.body.style.cursor = hovered ? 'pointer' : ''
    return () => { document.body.style.cursor = '' }
  }, [hovered, interactive, reducedMotion])

  useFrame((state, delta) => {
    if (!globe.current) return
    const reveal = reducedMotion || interactive ? 1 : THREE.MathUtils.smoothstep(Math.min(state.clock.elapsedTime / INTRO_SECONDS, 1), 0.3, 0.68)
    globe.current.visible = reveal > 0.01
    const targetScale = THREE.MathUtils.lerp(0.02, pressed ? 0.965 : hovered && interactive ? 1.045 : 1, reveal)
    const currentScale = globe.current.scale.x || 0.02
    globe.current.scale.setScalar(THREE.MathUtils.damp(currentScale, targetScale, 5.8, delta))

    const interaction = interactive && !reducedMotion ? 1 : 0.32
    pointerTarget.set(state.pointer.y * 0.085 * interaction, state.pointer.x * 0.11 * interaction)
    globe.current.rotation.x = THREE.MathUtils.damp(globe.current.rotation.x, pointerTarget.x, 3.5, delta)
    globe.current.rotation.y += reducedMotion ? 0 : delta * (interactive ? 0.09 : 0.055)
    globe.current.rotation.z = THREE.MathUtils.damp(globe.current.rotation.z, -0.06 + state.pointer.x * 0.03 * interaction, 3, delta)
    globe.current.position.y = GLOBE_POSITION[1] + (reducedMotion ? 0 : Math.sin(state.clock.elapsedTime * 0.7) * 0.055)

    if (light.current) {
      light.current.position.x = state.pointer.x * (interactive ? 2.3 : 1.2)
      light.current.position.y = 0.35 + state.pointer.y * (interactive ? 1.6 : 0.7)
      light.current.intensity = 8 + reveal * 11 + (hovered && interactive ? 4 : 0)
    }
    if (core.current) {
      const pointerBias = interactive && !reducedMotion ? Math.abs(state.pointer.x) * 0.009 + Math.abs(state.pointer.y) * 0.008 : 0
      core.current.rotation.z = THREE.MathUtils.damp(core.current.rotation.z, state.pointer.x * -0.025 * interaction, 4, delta)
      core.current.scale.setScalar(1 + pointerBias)
    }
    if (inner.current) {
      const pulse = reducedMotion ? 1 : 1 + Math.sin(state.clock.elapsedTime * (interactive ? 1.35 : 1.15)) * (interactive ? 0.024 : 0.018)
      inner.current.scale.setScalar(pulse)
    }
  })

  return (
    <group ref={globe} position={GLOBE_POSITION}>
      <CrystalHalo />
      <mesh position={[0, 0, -0.32]} scale={1.13}><sphereGeometry args={[1.46, 64, 64]} /><meshBasicMaterial color="#f5a8ca" transparent opacity={0.055} side={THREE.BackSide} depthWrite={false} /></mesh>
      <mesh ref={inner}>
        <sphereGeometry args={[1.04, 72, 72]} />
        <MeshDistortMaterial color="#f6a9c9" emissive="#d62974" emissiveIntensity={0.08} roughness={0.46} metalness={0} transparent opacity={0.34} depthWrite={false} distort={reducedMotion ? 0 : interactive ? 0.095 : 0.07} speed={reducedMotion ? 0 : interactive ? 0.58 : 0.4} />
      </mesh>
      <mesh
        ref={core}
        onPointerEnter={(event) => { event.stopPropagation(); if (interactive) setHovered(true) }}
        onPointerLeave={() => { setHovered(false); setPressed(false) }}
        onPointerDown={(event) => { event.stopPropagation(); if (interactive) setPressed(true) }}
        onPointerUp={(event) => { event.stopPropagation(); setPressed(false) }}
      >
        <sphereGeometry args={[1.37, 96, 96]} />
        <MeshTransmissionMaterial backside backsideThickness={0.2} thickness={0.48} color="#ffd9e8" roughness={hovered && interactive ? 0.045 : 0.07} chromaticAberration={hovered && interactive ? 0.028 : 0.018} anisotropicBlur={0.16} clearcoat={1} clearcoatRoughness={0.05} envMapIntensity={1.25} />
      </mesh>
      <GlobeGrid />
      <mesh rotation={[Math.PI / 2.6, 0.22, -0.08]}><torusGeometry args={[1.82, 0.018, 12, 180]} /><meshBasicMaterial color="#d62974" transparent opacity={0.31} depthWrite={false} /></mesh>
      <mesh rotation={[Math.PI / 2.75, 0.22, -0.08]}><torusGeometry args={[1.92, 0.006, 8, 180]} /><meshBasicMaterial color="#ffb9d4" transparent opacity={0.38} depthWrite={false} /></mesh>
      <pointLight ref={light} position={[-0.7, 0.6, 2]} color="#ef72aa" intensity={10} distance={6} />
      <pointLight position={[0.35, -0.15, -0.3]} color="#fff4f8" intensity={5.5} distance={3.8} />
    </group>
  )
}
