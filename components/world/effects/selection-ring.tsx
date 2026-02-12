"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface SelectionRingProps {
  position: [number, number, number];
  radius: number;
  color: string;
  visible: boolean;
}

/**
 * Rotating emissive torus that appears at the base of the selected island.
 * Pulses and rotates continuously.
 */
export function SelectionRing({ position, radius, color, visible }: SelectionRingProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (meshRef.current && visible) {
      meshRef.current.rotation.z = clock.getElapsedTime() * 0.6;
      const pulse = 1 + Math.sin(clock.getElapsedTime() * 3) * 0.08;
      meshRef.current.scale.set(pulse, pulse, pulse);
    }
  });

  if (!visible) return null;

  return (
    <mesh
      ref={meshRef}
      position={position}
      rotation={[Math.PI / 2, 0, 0]}
    >
      <torusGeometry args={[radius + 1.5, 0.15, 8, 48]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.7}
        transparent
        opacity={0.6}
      />
    </mesh>
  );
}
