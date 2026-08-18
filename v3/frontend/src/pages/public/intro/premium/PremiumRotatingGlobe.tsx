import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

type LonLat = [number, number]

const LAND = '#ed86b2'
const LAND_EDGE = '#d85f95'

const CONTINENTS: LonLat[][] = [
  [[-168,72],[-150,66],[-137,57],[-126,50],[-124,42],[-117,32],[-106,24],[-98,19],[-90,20],[-84,25],[-80,31],[-74,39],[-66,45],[-60,53],[-65,60],[-82,66],[-103,72],[-127,73],[-150,72]],
  [[-82,12],[-73,10],[-64,4],[-52,-5],[-47,-15],[-52,-28],[-58,-38],[-66,-50],[-73,-54],[-77,-40],[-79,-25],[-74,-10],[-69,-2],[-75,6]],
  [[-18,36],[-7,43],[8,45],[20,39],[31,31],[39,17],[44,5],[41,-10],[33,-24],[22,-34],[10,-35],[1,-28],[-5,-16],[-13,-3],[-17,13]],
  [[-10,36],[-4,44],[5,51],[17,55],[31,58],[44,55],[56,50],[68,53],[80,57],[95,60],[111,55],[126,48],[139,43],[149,52],[161,58],[174,52],[169,41],[154,32],[141,26],[129,20],[117,14],[108,7],[99,12],[91,22],[80,25],[72,20],[62,24],[52,31],[42,36],[32,38],[22,40],[12,42],[4,40]],
  [[113,-11],[126,-14],[139,-20],[151,-28],[153,-39],[143,-44],[130,-39],[118,-33],[112,-23]],
  [[-52,83],[-36,78],[-25,70],[-30,62],[-43,59],[-56,66],[-62,75]],
  [[44,-13],[50,-16],[50,-25],[45,-26],[42,-20]],
  [[130,32],[136,35],[141,41],[145,44],[142,36]],
  [[-8,50],[-3,58],[2,59],[1,52]],
]

function drawPolygon(ctx: CanvasRenderingContext2D, points: LonLat[], width: number, height: number) {
  const project = ([lon, lat]: LonLat) => [((lon + 180) / 360) * width, ((90 - lat) / 180) * height] as const
  const first = project(points[0])
  ctx.beginPath()
  ctx.moveTo(first[0], first[1])
  for (let i = 1; i < points.length; i += 1) {
    const p = project(points[i])
    ctx.lineTo(p[0], p[1])
  }
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
}

function makeLandTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 2048
  canvas.height = 1024
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = LAND
  ctx.strokeStyle = LAND_EDGE
  ctx.lineWidth = 2.2
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.globalAlpha = 0.72

  CONTINENTS.forEach((continent) => drawPolygon(ctx, continent, canvas.width, canvas.height))

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.anisotropy = 4
  texture.needsUpdate = true
  return texture
}

function RotatingLand({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null)
  const texture = useMemo(makeLandTexture, [])

  useEffect(() => () => texture?.dispose(), [texture])

  useFrame((state, delta) => {
    if (!groupRef.current) return
    if (!reducedMotion) groupRef.current.rotation.y += delta * 0.16
    groupRef.current.rotation.x = 0.08 + Math.sin(state.clock.elapsedTime * 0.18) * 0.012
    groupRef.current.rotation.z = -0.055
  })

  if (!texture) return null

  return (
    <group ref={groupRef} rotation={[0.08, -0.7, -0.055]}>
      <mesh>
        <sphereGeometry args={[1.48, 128, 128]} />
        <meshPhysicalMaterial
          map={texture}
          transparent
          opacity={0.82}
          alphaTest={0.02}
          depthWrite={false}
          side={THREE.FrontSide}
          roughness={0.62}
          metalness={0}
          clearcoat={0.18}
          clearcoatRoughness={0.5}
        />
      </mesh>
    </group>
  )
}

export default function PremiumRotatingGlobe() {
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReducedMotion(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  return (
    <div className="intro-orbit-globe-canvas" aria-hidden="true">
      <Canvas
        dpr={[1, 1.55]}
        camera={{ position: [0, 0, 4.4], fov: 40, near: 0.1, far: 20 }}
        gl={{ antialias: true, alpha: true, stencil: false, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => gl.setClearColor('#ffffff', 0)}
      >
        <ambientLight intensity={1.5} color="#ffffff" />
        <directionalLight position={[-3, 4, 5]} intensity={1.15} color="#fff7fb" />
        <directionalLight position={[4, -2, 3]} intensity={0.55} color="#f5b4cf" />
        <RotatingLand reducedMotion={reducedMotion} />
      </Canvas>
    </div>
  )
}
