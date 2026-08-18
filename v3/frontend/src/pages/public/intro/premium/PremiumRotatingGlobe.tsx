import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

type LonLat = [number, number]

const LAND = '#ed86b2'
const LAND_EDGE = '#d85f95'

// Siluetas deliberadamente simplificadas para conservar rendimiento, pero con
// más puntos de costa e islas para que los continentes se reconozcan mejor.
const CONTINENTS: LonLat[][] = [
  [[-168,72],[-158,69],[-151,65],[-145,61],[-139,58],[-134,55],[-130,51],[-127,48],[-125,44],[-124,40],[-122,37],[-118,34],[-114,31],[-110,27],[-105,24],[-99,20],[-94,18],[-90,20],[-87,23],[-84,26],[-82,29],[-81,32],[-79,35],[-76,39],[-72,43],[-68,46],[-64,50],[-60,54],[-62,58],[-67,61],[-74,63],[-82,66],[-91,68],[-101,71],[-113,73],[-126,74],[-139,73],[-151,72]],
  [[-82,12],[-78,10],[-74,8],[-71,5],[-67,2],[-63,-2],[-59,-5],[-55,-8],[-51,-12],[-48,-16],[-47,-21],[-49,-26],[-52,-31],[-56,-35],[-60,-39],[-64,-44],[-67,-49],[-70,-54],[-73,-52],[-75,-46],[-76,-40],[-78,-34],[-79,-27],[-79,-20],[-77,-14],[-74,-8],[-71,-3],[-69,2],[-72,6],[-77,9]],
  [[-18,36],[-14,37],[-10,36],[-6,35],[-2,35],[3,37],[8,38],[13,37],[18,35],[23,33],[28,31],[32,28],[35,24],[38,20],[40,15],[42,10],[44,5],[43,0],[41,-5],[40,-10],[37,-16],[34,-22],[30,-27],[25,-31],[20,-34],[14,-35],[9,-34],[4,-31],[0,-27],[-4,-22],[-7,-16],[-10,-10],[-13,-4],[-15,2],[-17,9],[-17,16],[-16,23],[-15,29]],
  [[-10,36],[-7,41],[-4,46],[0,50],[5,54],[11,57],[18,59],[26,60],[34,60],[42,58],[49,56],[57,53],[64,52],[71,54],[79,57],[88,59],[97,59],[106,57],[114,54],[122,50],[128,46],[134,43],[139,42],[142,45],[146,49],[151,53],[158,56],[165,56],[172,53],[177,49],[173,45],[167,42],[160,39],[153,36],[146,33],[140,29],[134,25],[128,22],[123,18],[119,14],[114,11],[109,8],[104,7],[100,9],[96,13],[92,18],[88,22],[83,25],[79,25],[75,23],[71,21],[67,21],[63,24],[59,28],[55,31],[50,34],[45,36],[40,38],[35,39],[30,39],[25,40],[20,42],[15,43],[10,43],[5,41],[0,40],[-5,38]],
  [[112,-11],[116,-13],[121,-14],[126,-15],[131,-18],[136,-20],[141,-24],[145,-28],[149,-32],[152,-36],[153,-40],[150,-43],[145,-45],[140,-44],[135,-42],[130,-39],[125,-37],[121,-34],[118,-30],[115,-26],[113,-21],[112,-16]],
  [[-52,83],[-46,82],[-40,80],[-35,77],[-31,73],[-28,69],[-30,65],[-34,62],[-39,60],[-44,60],[-49,62],[-54,66],[-58,71],[-60,76],[-57,80]],
  [[43,-12],[46,-14],[49,-17],[50,-20],[50,-24],[48,-26],[45,-25],[43,-22],[42,-18]],
  [[129,32],[132,34],[135,35],[138,37],[140,40],[142,43],[145,44],[144,41],[143,37],[141,34],[138,32],[134,31]],
  [[-10,50],[-7,53],[-6,56],[-4,58],[-1,59],[1,57],[1,54],[0,51],[-3,50],[-6,50]],
  [[166,-34],[171,-36],[175,-40],[178,-44],[174,-47],[170,-45],[168,-41]],
  [[-25,66],[-20,65],[-16,64],[-15,66],[-18,68],[-22,68]],
  [[-9,43],[-7,43],[-5,42],[-4,40],[-6,39],[-8,40]],
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
  ctx.lineWidth = 1.8
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.globalAlpha = 0.7

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
          opacity={0.8}
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
