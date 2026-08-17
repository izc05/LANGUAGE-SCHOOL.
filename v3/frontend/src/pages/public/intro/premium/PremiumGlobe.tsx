import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const MAGENTA = '#d62974'
const MAGENTA_LIGHT = '#f4a7c8'
const PEARL = '#fffafd'

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

const bubbleVertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`

const bubbleFragmentShader = /* glsl */ `
  uniform vec3 uPink;
  uniform vec3 uPinkLight;
  uniform vec3 uWhite;

  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);

    float facing = max(dot(normal, viewDir), 0.0);
    float fresnel = pow(1.0 - facing, 2.35);

    vec3 upperLight = normalize(vec3(-0.55, 0.72, 0.92));
    vec3 lowerLight = normalize(vec3(0.72, -0.62, 0.78));
    float upperGlint = pow(max(dot(normal, upperLight), 0.0), 11.0);
    float lowerGlint = pow(max(dot(normal, lowerLight), 0.0), 15.0);

    vec3 reflected = reflect(-upperLight, normal);
    float specular = pow(max(dot(reflected, viewDir), 0.0), 30.0);

    float pinkMix = clamp(fresnel * 1.35 + lowerGlint * 0.55, 0.0, 1.0);
    vec3 color = mix(uWhite, uPinkLight, pinkMix);
    color = mix(color, uPink, fresnel * 0.32);
    color += uWhite * (upperGlint * 0.64 + specular * 0.9);

    // El centro queda casi vacío; el volumen se define por los reflejos del borde.
    float alpha = 0.008
      + fresnel * 0.255
      + upperGlint * 0.085
      + lowerGlint * 0.075
      + specular * 0.16;

    gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.48));
  }
`

export default function PremiumGlobe({ introComplete, scaleRef }: PremiumGlobeProps) {
  const groupRef = useRef<THREE.Group>(null)
  const reflectionRef = useRef<THREE.Group>(null)
  const [hovered, setHovered] = useState(false)
  const targetScale = useRef(1)
  const pointer = useRef(new THREE.Vector2())
  const uniforms = useMemo(() => ({
    uPink: { value: new THREE.Color(MAGENTA) },
    uPinkLight: { value: new THREE.Color(MAGENTA_LIGHT) },
    uWhite: { value: new THREE.Color(PEARL) },
  }), [])

  useFrame((state, delta) => {
    if (!groupRef.current || !reflectionRef.current) return

    const baseScale = responsiveGlobeScale(state.size.width)
    groupRef.current.position.y = responsiveGlobeY(state.size.width)

    if (!introComplete) {
      groupRef.current.scale.setScalar(Math.max(0, scaleRef.current) * baseScale)
    }

    reflectionRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.18) * 0.028
    reflectionRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.13) * 0.035

    if (introComplete) {
      pointer.current.x = THREE.MathUtils.lerp(pointer.current.x, state.pointer.x, 0.08)
      pointer.current.y = THREE.MathUtils.lerp(pointer.current.y, state.pointer.y, 0.08)

      groupRef.current.rotation.x = pointer.current.y * 0.055
      groupRef.current.rotation.y = pointer.current.x * 0.07

      targetScale.current = baseScale * (hovered ? 1.018 : 1)
      const currentScale = groupRef.current.scale.x
      groupRef.current.scale.setScalar(THREE.MathUtils.damp(currentScale, targetScale.current, 4, delta))
    }
  })

  return (
    <group ref={groupRef} position={[0, -0.2, 0]} scale={0}>
      <mesh
        onPointerOver={() => introComplete && setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[1.5, 128, 128]} />
        <shaderMaterial
          vertexShader={bubbleVertexShader}
          fragmentShader={bubbleFragmentShader}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          side={THREE.FrontSide}
          blending={THREE.NormalBlending}
        />
      </mesh>

      {/* Segundo cascarón casi imperceptible: da profundidad sin rellenar la esfera. */}
      <mesh scale={0.988}>
        <sphereGeometry args={[1.5, 96, 96]} />
        <meshBasicMaterial
          color={MAGENTA_LIGHT}
          transparent
          opacity={0.018}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      <group ref={reflectionRef}>
        {/* Aro exterior de cristal: fino, limpio y sin aspecto metálico. */}
        <mesh>
          <torusGeometry args={[1.503, 0.008, 12, 220]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.46} depthWrite={false} />
        </mesh>
        <mesh rotation={[0, 0, 0.018]}>
          <torusGeometry args={[1.507, 0.0045, 10, 220]} />
          <meshBasicMaterial color={MAGENTA_LIGHT} transparent opacity={0.62} depthWrite={false} />
        </mesh>

        {/* Reflejo principal superior izquierdo, como una burbuja iluminada. */}
        <mesh position={[-0.58, 0.68, 1.22]} rotation={[0.04, 0.18, -0.78]}>
          <torusGeometry args={[0.43, 0.025, 14, 90, Math.PI * 0.82]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.78} depthWrite={false} />
        </mesh>
        <mesh position={[-0.53, 0.61, 1.27]} rotation={[0.04, 0.2, -0.76]}>
          <torusGeometry args={[0.54, 0.012, 12, 100, Math.PI * 0.68]} />
          <meshBasicMaterial color={MAGENTA_LIGHT} transparent opacity={0.48} depthWrite={false} />
        </mesh>

        {/* Reflejo secundario inferior derecho. */}
        <mesh position={[0.78, -0.78, 1.08]} rotation={[0.08, -0.2, 2.26]}>
          <torusGeometry args={[0.28, 0.014, 10, 62, Math.PI * 0.72]} />
          <meshBasicMaterial color={MAGENTA} transparent opacity={0.34} depthWrite={false} />
        </mesh>

        {/* Pequeños puntos de luz para reforzar el carácter de cristal. */}
        <mesh position={[-0.94, 0.44, 1.13]}>
          <sphereGeometry args={[0.031, 20, 20]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.86} depthWrite={false} />
        </mesh>
        <mesh position={[-0.82, 0.34, 1.23]}>
          <sphereGeometry args={[0.018, 16, 16]} />
          <meshBasicMaterial color={MAGENTA_LIGHT} transparent opacity={0.72} depthWrite={false} />
        </mesh>
      </group>

      <pointLight position={[-1.9, 1.75, 2.8]} color="#fff8fc" intensity={3.2} distance={7} />
      <pointLight position={[1.9, -1.15, 2.2]} color={MAGENTA_LIGHT} intensity={1.7} distance={6} />
    </group>
  )
}
