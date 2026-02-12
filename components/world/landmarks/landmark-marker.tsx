"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";

interface LandmarkMarkerProps {
  position: [number, number, number];
  count: number;
  color?: string;
}

/** Floating pulsing "!" indicator — visible when count > 0 */
export function LandmarkMarker({ position, count, color = "#ef4444" }: LandmarkMarkerProps) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      const t = clock.getElapsedTime();
      groupRef.current.position.y = position[1] + Math.sin(t * 3) * 0.3;
      const s = 1 + Math.sin(t * 4) * 0.1;
      groupRef.current.scale.set(s, s, s);
    }
  });

  if (count <= 0) return null;

  return (
    <group ref={groupRef} position={position}>
      <Billboard>
        <Text
          fontSize={1.2}
          color={color}
          anchorX="center"
          anchorY="middle"
          fontWeight={700}
          outlineWidth={0.08}
          outlineColor="#000000"
        >
          !
        </Text>
      </Billboard>
      {/* Glow sphere behind */}
      <mesh>
        <sphereGeometry args={[0.5, 8, 8]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.5}
          transparent
          opacity={0.3}
        />
      </mesh>
    </group>
  );
}
