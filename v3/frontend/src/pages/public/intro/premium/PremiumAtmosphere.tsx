import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Cloud, Clouds } from '@react-three/drei'
import * as THREE from 'three'

export default function PremiumAtmosphere() {
  const groupRef = useRef<THREE.Group>(null)
  const compact = useThree((state) => state.size.width <= 760)

  useFrame((state) => {
    if (groupRef.current) groupRef.current.rotation.y = state.clock.elapsedTime * 0.018
  })

  return (
    <group ref={groupRef}>
      <Clouds material={THREE.MeshLambertMaterial} limit={compact ? 320 : 520}>
        <Cloud
          seed={1}
          scale={2.08}
          volume={6.3}
          color="#ffffff"
          fade={120}
          segments={compact ? 32 : 50}
          bounds={[10, 2.2, 10]}
          position={[0, 1, -5]}
          opacity={0.44}
        />
        <Cloud
          seed={2}
          scale={2.02}
          volume={5.35}
          color="#fdf0f5"
          fade={118}
          segments={compact ? 24 : 38}
          bounds={[8, 3, 8]}
          position={[-6, 0, -2]}
          opacity={0.34}
        />
        <Cloud
          seed={3}
          scale={2.02}
          volume={5.35}
          color="#fdf0f5"
          fade={118}
          segments={compact ? 24 : 38}
          bounds={[8, 3, 8]}
          position={[6, -1, 1]}
          opacity={0.34}
        />
        <Cloud
          seed={4}
          scale={1.55}
          volume={4.25}
          color="#ffffff"
          fade={116}
          segments={compact ? 16 : 26}
          bounds={[6, 2, 6]}
          position={[0, -3, 2]}
          opacity={0.28}
        />
        <Cloud
          seed={5}
          scale={1.3}
          volume={3.4}
          color="#fff6fa"
          fade={122}
          segments={compact ? 14 : 22}
          bounds={[5, 2, 5]}
          position={[0, 3.2, -1.5]}
          opacity={0.2}
        />
      </Clouds>
    </group>
  )
}
