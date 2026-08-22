import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

type LonLat = [number, number]
type TopologyTransform = { scale: [number, number]; translate: [number, number] }
type TopologyGeometry = {
  type: 'Polygon' | 'MultiPolygon' | 'GeometryCollection'
  arcs?: number[][] | number[][][]
  geometries?: TopologyGeometry[]
}
type LandTopology = {
  transform?: TopologyTransform
  arcs: number[][][]
  objects: { land: TopologyGeometry }
}

const LAND = '#ed86b2'
const LAND_EDGE = '#d85f95'
const WORLD_ATLAS_110M = 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-110m.json'
const TEXTURE_WIDTH = 1280
const TEXTURE_HEIGHT = 640

// Respaldo inmediato y sin red. Se sustituye por cartografía Natural Earth
// cuando termina de cargar el atlas; así la portada nunca queda vacía.
const FALLBACK_LAND: LonLat[][] = [
  [[-168,72],[-150,66],[-137,57],[-126,50],[-124,42],[-117,32],[-106,24],[-98,19],[-90,20],[-84,25],[-80,31],[-74,39],[-66,45],[-60,53],[-65,60],[-82,66],[-103,72],[-127,73],[-150,72]],
  [[-82,12],[-73,10],[-64,4],[-52,-5],[-47,-15],[-52,-28],[-58,-38],[-66,-50],[-73,-54],[-77,-40],[-79,-25],[-74,-10],[-69,-2],[-75,6]],
  [[-18,36],[-7,43],[8,45],[20,39],[31,31],[39,17],[44,5],[41,-10],[33,-24],[22,-34],[10,-35],[1,-28],[-5,-16],[-13,-3],[-17,13]],
  [[-10,36],[-4,44],[5,51],[17,55],[31,58],[44,55],[56,50],[68,53],[80,57],[95,60],[111,55],[126,48],[139,43],[149,52],[161,58],[174,52],[169,41],[154,32],[141,26],[129,20],[117,14],[108,7],[99,12],[91,22],[80,25],[72,20],[62,24],[52,31],[42,36],[32,38],[22,40],[12,42],[4,40]],
  [[113,-11],[126,-14],[139,-20],[151,-28],[153,-39],[143,-44],[130,-39],[118,-33],[112,-23]],
  [[-52,83],[-36,78],[-25,70],[-30,62],[-43,59],[-56,66],[-62,75]],
  [[43,-12],[50,-16],[50,-25],[45,-26],[42,-20]],
  [[130,32],[136,35],[141,41],[145,44],[142,36]],
  [[-10,50],[-3,58],[2,59],[1,52]],
  [[166,-34],[171,-36],[175,-40],[178,-44],[174,-47],[170,-45],[168,-41]],
]

function makeCanvasTexture(rings: LonLat[][]) {
  const canvas = document.createElement('canvas')
  canvas.width = TEXTURE_WIDTH
  canvas.height = TEXTURE_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = LAND
  ctx.strokeStyle = LAND_EDGE
  ctx.globalAlpha = 0.7
  ctx.lineWidth = 1.15
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.beginPath()

  rings.forEach((ring) => traceWrappedRing(ctx, ring, canvas.width, canvas.height))

  ctx.fill('evenodd')
  ctx.stroke()

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.anisotropy = 4
  texture.needsUpdate = true
  return texture
}

function traceWrappedRing(
  ctx: CanvasRenderingContext2D,
  ring: LonLat[],
  width: number,
  height: number,
) {
  if (ring.length < 3) return

  const projected: [number, number][] = []
  let previousX: number | null = null

  ring.forEach(([lon, lat]) => {
    let x = ((lon + 180) / 360) * width
    const y = ((90 - lat) / 180) * height

    if (previousX !== null) {
      while (x - previousX > width / 2) x -= width
      while (x - previousX < -width / 2) x += width
    }

    projected.push([x, y])
    previousX = x
  })

  const minX = Math.min(...projected.map(([x]) => x))
  const maxX = Math.max(...projected.map(([x]) => x))

  for (const shift of [-width, 0, width]) {
    if (maxX + shift < 0 || minX + shift > width) continue
    ctx.moveTo(projected[0][0] + shift, projected[0][1])
    for (let i = 1; i < projected.length; i += 1) {
      ctx.lineTo(projected[i][0] + shift, projected[i][1])
    }
    ctx.closePath()
  }
}

function decodeTopology(topology: LandTopology): LonLat[][] {
  const transform = topology.transform
  const arcCache = new Map<number, LonLat[]>()

  const decodeArc = (signedIndex: number) => {
    const reversed = signedIndex < 0
    const index = reversed ? ~signedIndex : signedIndex
    const cached = arcCache.get(index)
    if (cached) return reversed ? [...cached].reverse() : cached

    let x = 0
    let y = 0
    const decoded: LonLat[] = topology.arcs[index].map(([dx, dy]) => {
      x += dx
      y += dy
      if (!transform) return [x, y]
      return [
        x * transform.scale[0] + transform.translate[0],
        y * transform.scale[1] + transform.translate[1],
      ]
    })

    arcCache.set(index, decoded)
    return reversed ? [...decoded].reverse() : decoded
  }

  const joinRing = (arcIndexes: number[]) => {
    const ring: LonLat[] = []
    arcIndexes.forEach((arcIndex, arcPosition) => {
      const arc = decodeArc(arcIndex)
      ring.push(...(arcPosition === 0 ? arc : arc.slice(1)))
    })
    return ring
  }

  const rings: LonLat[][] = []

  const visitGeometry = (geometry: TopologyGeometry) => {
    if (geometry.type === 'GeometryCollection') {
      geometry.geometries?.forEach(visitGeometry)
      return
    }

    if (geometry.type === 'Polygon') {
      ;(geometry.arcs as number[][] | undefined)?.forEach((ring) => rings.push(joinRing(ring)))
      return
    }

    ;(geometry.arcs as number[][][] | undefined)?.forEach((polygon) => {
      polygon.forEach((ring) => rings.push(joinRing(ring)))
    })
  }

  visitGeometry(topology.objects.land)
  return rings
}

async function loadDetailedTexture(signal: AbortSignal) {
  const response = await fetch(WORLD_ATLAS_110M, { signal, cache: 'force-cache' })
  if (!response.ok) throw new Error(`World atlas HTTP ${response.status}`)
  const topology = (await response.json()) as LandTopology
  const rings = decodeTopology(topology)
  if (!rings.length) throw new Error('World atlas without land geometry')
  return makeCanvasTexture(rings)
}

function RotatingLand({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null)
  const fallbackTexture = useMemo(() => makeCanvasTexture(FALLBACK_LAND), [])
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(fallbackTexture)

  useEffect(() => {
    const controller = new AbortController()
    let detailedTexture: THREE.CanvasTexture | null = null
    const loadTimer = window.setTimeout(() => {
      loadDetailedTexture(controller.signal)
        .then((loaded) => {
          if (!loaded || controller.signal.aborted) {
            loaded?.dispose()
            return
          }
          detailedTexture = loaded
          setTexture(loaded)
        })
        .catch(() => {
          // El fallback local es intencionado: una caída de CDN no rompe la entrada.
        })
    }, 850)

    return () => {
      window.clearTimeout(loadTimer)
      controller.abort()
      detailedTexture?.dispose()
    }
  }, [])

  useEffect(() => () => fallbackTexture?.dispose(), [fallbackTexture])

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
        <sphereGeometry args={[1.48, 72, 72]} />
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
        dpr={[1, 1.25]}
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
