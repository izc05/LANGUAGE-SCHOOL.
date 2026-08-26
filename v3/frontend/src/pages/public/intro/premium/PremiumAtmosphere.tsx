import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Cloud, Clouds } from '@react-three/drei'
import * as THREE from 'three'

export default function PremiumAtmosphere() {
  const groupRef = useRef<THREE.Group>(null)
  const compact = useThree((state) => state.size.width <= 760)

  useFrame((state) => {
    if (groupRef.current) groupRef.current.rotation.y = state.clock.elapsedTime * 0.014
  })

  return (
    <group ref={groupRef}>
      <Clouds material={THREE.MeshLambertMaterial} limit={compact ? 260 : 420}>
        <Cloud
          seed={1}
          scale={1.92}
          volume={5.7}
          color="#ffffff"
          fade={122}
          segments={compact ? 28 : 42}
          bounds={[10, 2.2, 10]}
          position={[0, 1.2, -5.6]}
          opacity={0.32}
        />
        <Cloud
          seed={2}
          scale={1.82}
          volume={4.8}
          color="#fdf0f5"
          fade={120}
          segments={compact ? 20 : 30}
          bounds={[8, 3, 8]}
          position={[-7, 0.2, -2.6]}
          opacity={0.24}
        />
        <Cloud
          seed={3}
          scale={1.82}
          volume={4.8}
          color="#fdf0f5"
          fade={120}
          segments={compact ? 20 : 30}
          bounds={[8, 3, 8]}
          position={[7, -0.8, 0.5]}
          opacity={0.24}
        />
        <Cloud
          seed={4}
          scale={1.42}
          volume={3.8}
          color="#ffffff"
          fade={118}
          segments={compact ? 14 : 22}
          bounds={[6, 2, 6]}
          position={[0, -3.3, 1.7]}
          opacity={0.2}
        />
        <Cloud
          seed={5}
          scale={1.16}
          volume={3}
          color="#fff6fa"
          fade={124}
          segments={compact ? 12 : 18}
          bounds={[5, 2, 5]}
          position={[0, 3.5, -2]}
          opacity={0.14}
        />
      </Clouds>
    </group>
  )
}
