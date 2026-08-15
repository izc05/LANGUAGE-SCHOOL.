import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Cloud, Clouds } from '@react-three/drei'
import * as THREE from 'three'

export default function PremiumAtmosphere() {
  const groupRef = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (groupRef.current) groupRef.current.rotation.y = state.clock.elapsedTime * 0.02
  })

  return (
    <group ref={groupRef}>
      <Clouds material={THREE.MeshLambertMaterial} limit={400}>
        <Cloud
          seed={1}
          scale={2}
          volume={6}
          color="#ffffff"
          fade={100}
          segments={40}
          bounds={[10, 2, 10]}
          position={[0, 1, -5]}
          opacity={0.4}
        />
        <Cloud
          seed={2}
          scale={2}
          volume={5}
          color="#fdf0f5"
          fade={100}
          segments={30}
          bounds={[8, 3, 8]}
          position={[-6, 0, -2]}
          opacity={0.3}
        />
        <Cloud
          seed={3}
          scale={2}
          volume={5}
          color="#fdf0f5"
          fade={100}
          segments={30}
          bounds={[8, 3, 8]}
          position={[6, -1, 1]}
          opacity={0.3}
        />
        <Cloud
          seed={4}
          scale={1.5}
          volume={4}
          color="#ffffff"
          fade={100}
          segments={20}
          bounds={[6, 2, 6]}
          position={[0, -3, 2]}
          opacity={0.25}
        />
      </Clouds>
    </group>
  )
}
