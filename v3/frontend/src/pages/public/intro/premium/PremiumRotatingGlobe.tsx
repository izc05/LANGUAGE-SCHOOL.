import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

type LonLat = [number, number]

const LAND = '#ed86b2'
const LAND_EDGE = '#d85f95'

// Siluetas geográficas optimizadas para una esfera pequeña: más detalle de costa
// donde aporta reconocimiento y masas/islas separadas donde el agua debe respirar.
const LANDMASSES: LonLat[][] = [
  [[-168,72],[-160,70],[-153,66],[-147,62],[-141,59],[-136,56],[-132,53],[-129,50],[-127,47],[-125,44],[-124,40],[-123,37],[-121,35],[-118,33],[-115,32],[-112,32],[-108,31],[-104,30],[-101,29],[-98,26],[-96,28],[-93,29],[-90,29],[-87,30],[-85,30],[-83,28],[-81,25],[-80,28],[-80,32],[-78,35],[-76,38],[-73,41],[-70,43],[-67,45],[-64,48],[-60,51],[-58,55],[-61,58],[-65,60],[-70,62],[-76,64],[-82,66],[-88,68],[-95,70],[-105,72],[-116,73],[-127,74],[-138,73],[-149,72],[-160,73]],
  [[-117,32],[-112,32],[-108,31],[-104,30],[-101,29],[-98,26],[-97,23],[-96,20],[-94,18],[-91,18],[-89,21],[-87,21],[-86,19],[-88,17],[-91,15],[-94,16],[-97,18],[-101,18],[-104,20],[-107,23],[-110,25],[-113,29]],
  [[-91,18],[-89,18],[-88,16],[-87,15],[-85,15],[-84,14],[-83,12],[-82,10],[-80,9],[-78,9],[-77,8],[-78,10],[-80,11],[-82,12],[-84,14],[-86,16],[-88,17]],
  [[-79,9],[-76,8],[-74,10],[-71,11],[-69,12],[-66,10],[-62,10],[-60,8],[-58,7],[-55,5],[-52,4],[-50,1],[-49,-1],[-45,-2],[-42,-3],[-38,-5],[-35,-6],[-35,-10],[-37,-13],[-38,-16],[-39,-20],[-41,-22],[-43,-23],[-46,-24],[-48,-27],[-50,-30],[-53,-33],[-57,-35],[-60,-39],[-62,-41],[-65,-43],[-66,-46],[-68,-49],[-70,-53],[-73,-55],[-75,-50],[-74,-46],[-73,-42],[-72,-38],[-72,-34],[-71,-30],[-71,-25],[-70,-20],[-71,-17],[-74,-15],[-76,-12],[-78,-9],[-80,-6],[-81,-3],[-80,0],[-79,3],[-78,6]],
  [[-18,36],[-13,36],[-9,35],[-6,35],[-2,36],[3,37],[8,37],[12,36],[16,34],[20,32],[24,31],[28,31],[32,30],[34,27],[36,23],[38,18],[40,12],[43,11],[50,11],[51,8],[49,5],[47,2],[45,-2],[43,-6],[41,-10],[40,-15],[37,-20],[34,-25],[31,-29],[27,-33],[22,-35],[17,-35],[12,-34],[8,-32],[4,-29],[1,-25],[-3,-20],[-6,-15],[-9,-10],[-12,-5],[-15,1],[-17,8],[-17,15],[-16,22],[-15,28]],
  [[-10,36],[-10,43],[-6,47],[-2,50],[3,53],[8,55],[13,57],[18,59],[24,61],[30,63],[38,65],[47,67],[57,69],[68,71],[79,73],[90,74],[101,74],[112,72],[123,69],[134,66],[145,63],[155,61],[165,58],[176,55],[178,51],[173,48],[165,46],[157,44],[149,42],[143,39],[138,37],[133,35],[128,32],[124,29],[121,26],[118,23],[114,21],[110,19],[106,20],[102,22],[98,24],[94,26],[90,28],[86,29],[82,31],[78,32],[74,34],[69,35],[64,36],[59,38],[54,39],[49,40],[44,41],[39,42],[34,43],[29,44],[24,45],[19,46],[14,47],[9,46],[4,44],[0,42],[-5,40]],
  [[-9,43],[-6,44],[-2,43],[3,42],[3,39],[1,37],[-3,36],[-7,37],[-9,40]],
  [[7,46],[11,46],[13,44],[13,42],[15,40],[17,38],[16,37],[14,38],[13,40],[11,42],[9,44]],
  [[14,46],[19,46],[23,44],[25,42],[24,40],[22,39],[21,37],[20,36],[19,39],[17,41],[15,43]],
  [[5,58],[8,61],[11,64],[15,67],[19,70],[24,71],[29,70],[28,66],[25,63],[22,60],[18,58],[14,56],[10,56]],
  [[26,41],[30,42],[35,42],[40,41],[44,39],[42,37],[36,36],[31,36],[27,38]],
  [[34,31],[38,31],[42,29],[47,26],[51,25],[55,23],[56,20],[54,17],[50,15],[46,13],[44,12],[43,16],[41,20],[39,24],[36,28]],
  [[68,24],[72,24],[76,26],[80,24],[83,20],[86,18],[85,14],[82,10],[79,8],[77,9],[75,12],[73,16],[71,20]],
  [[94,27],[98,25],[102,23],[106,22],[109,20],[108,17],[106,15],[105,12],[103,10],[101,8],[100,5],[102,2],[104,1],[105,4],[104,8],[106,10],[108,12],[110,15],[112,18],[114,20]],
  [[126,39],[129,42],[130,39],[129,35],[127,34]],
  [[113,-11],[116,-14],[120,-16],[125,-15],[130,-18],[135,-20],[139,-23],[143,-25],[147,-29],[151,-33],[153,-37],[151,-40],[147,-43],[142,-44],[137,-42],[132,-39],[127,-37],[122,-34],[118,-31],[115,-27],[113,-22]],
  [[-53,83],[-46,82],[-40,80],[-35,77],[-30,73],[-29,69],[-33,64],[-39,60],[-45,60],[-50,63],[-55,68],[-59,74],[-58,79]],
  [[43,-12],[47,-13],[50,-17],[50,-21],[48,-25],[45,-26],[43,-22],[42,-17]],
  [[130,32],[133,34],[136,35],[139,38],[141,41],[145,44],[144,40],[142,37],[140,34],[136,32]],
  [[-7,50],[-5,52],[-5,55],[-4,58],[-2,59],[0,57],[1,54],[0,51],[-3,50]],
  [[-10,51],[-9,54],[-8,55],[-6,55],[-6,52],[-8,51]],
  [[-25,66],[-21,65],[-17,64],[-14,65],[-16,68],[-21,68]],
  [[79.5,9.8],[81.5,8.7],[81.8,7],[80.8,5.8],[79.7,6.5]],
  [[120.2,25.3],[121.6,24],[121.3,22],[120.2,23]],
  [[95,5],[99,3],[103,0],[105,-3],[104,-6],[100,-4],[97,-1]],
  [[105,-6],[111,-6],[115,-8],[113,-9],[108,-8]],
  [[109,7],[114,7],[119,5],[118,0],[115,-3],[110,-2]],
  [[119,2],[123,1],[124,-3],[122,-5],[120,-3]],
  [[120,18],[123,17],[125,13],[124,10],[122,8],[120,11]],
  [[172,-34],[175,-37],[177,-39],[176,-41],[173,-39]],
  [[166,-41],[170,-42],[173,-44],[170,-47],[167,-46]],
  [[-85,23],[-81,23],[-77,21],[-75,20],[-78,20],[-82,21]],
  [[-74,20],[-71,20],[-68,19],[-70,18],[-73,18]],
  [[145,-40],[148,-41],[147,-43],[145,-44],[144,-42]]
]

const WATER_CUTOUTS: LonLat[][] = [
  [[-96,63],[-91,66],[-84,65],[-78,62],[-80,57],[-84,53],[-90,53],[-95,57]],
  [[-6,36],[0,36],[5,37],[10,38],[15,39],[20,39],[25,38],[30,36],[35,35],[36,33],[32,31],[27,31],[22,32],[17,33],[12,34],[7,35],[2,35],[-3,35]],
  [[27,46],[31,47],[36,46],[41,44],[40,42],[36,41],[31,42],[28,44]],
  [[47,47],[51,47],[54,44],[53,40],[51,37],[48,39],[47,43]],
  [[33,29],[35,27],[37,23],[40,18],[42,13],[40,12],[37,17],[35,22]],
  [[48,30],[52,29],[56,27],[55,24],[51,25],[48,27]]
]

function tracePolygon(ctx: CanvasRenderingContext2D, points: LonLat[], width: number, height: number) {
  const project = ([lon, lat]: LonLat) => [
    ((lon + 180) / 360) * width,
    ((90 - lat) / 180) * height,
  ] as const

  const first = project(points[0])
  ctx.beginPath()
  ctx.moveTo(first[0], first[1])

  for (let i = 1; i < points.length; i += 1) {
    const point = project(points[i])
    ctx.lineTo(point[0], point[1])
  }

  ctx.closePath()
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
  ctx.lineWidth = 1.55
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.globalAlpha = 0.7

  LANDMASSES.forEach((land) => {
    tracePolygon(ctx, land, canvas.width, canvas.height)
    ctx.fill()
    ctx.stroke()
  })

  // El océano no lleva color. Estas máscaras recuperan agua real en zonas que
  // definen visualmente los continentes: Hudson, Mediterráneo, Negro, Caspio,
  // Mar Rojo y Golfo Pérsico.
  ctx.save()
  ctx.globalCompositeOperation = 'destination-out'
  ctx.globalAlpha = 1
  WATER_CUTOUTS.forEach((water) => {
    tracePolygon(ctx, water, canvas.width, canvas.height)
    ctx.fill()
  })
  ctx.restore()

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
          opacity={0.79}
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
