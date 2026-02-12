"use client";

import { Text } from "@react-three/drei";

/**
 * 3D compass rose sitting on the water surface.
 * Ring + cardinal direction lines + "N" label.
 */
export function Compass() {
  return (
    <group position={[-60, 0.3, -55]}>
      {/* Outer ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[3, 0.06, 8, 32]} />
        <meshStandardMaterial color="#fbbf24" transparent opacity={0.4} />
      </mesh>

      {/* Inner ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2, 0.04, 8, 32]} />
        <meshStandardMaterial color="#fbbf24" transparent opacity={0.25} />
      </mesh>

      {/* N-S line */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <boxGeometry args={[0.04, 7, 0.01]} />
        <meshStandardMaterial color="#fbbf24" transparent opacity={0.3} />
      </mesh>

      {/* E-W line */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <boxGeometry args={[7, 0.04, 0.01]} />
        <meshStandardMaterial color="#fbbf24" transparent opacity={0.3} />
      </mesh>

      {/* Cardinal labels */}
      <Text
        position={[0, 0.1, -3.8]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.9}
        color="#fbbf24"
        fontWeight={700}
        anchorX="center"
        anchorY="middle"
      >
        N
      </Text>
      <Text
        position={[0, 0.1, 3.8]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.6}
        color="#fbbf24"
        anchorX="center"
        anchorY="middle"
      >
        S
      </Text>
      <Text
        position={[3.8, 0.1, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.6}
        color="#fbbf24"
        anchorX="center"
        anchorY="middle"
      >
        E
      </Text>
      <Text
        position={[-3.8, 0.1, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.6}
        color="#fbbf24"
        anchorX="center"
        anchorY="middle"
      >
        W
      </Text>

      {/* Center diamond */}
      <mesh position={[0, 0.15, 0]} rotation={[Math.PI / 2, Math.PI / 4, 0]}>
        <boxGeometry args={[0.5, 0.5, 0.05]} />
        <meshStandardMaterial
          color="#fbbf24"
          emissive="#fbbf24"
          emissiveIntensity={0.3}
          transparent
          opacity={0.5}
        />
      </mesh>
    </group>
  );
}
