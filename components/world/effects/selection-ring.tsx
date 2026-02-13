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
 * Dual rotating emissive torus rings at the base of the selected island.
 * Outer ring uses island theme color; inner ring counter-rotates in brand pink.
 */
export function SelectionRing({ position, radius, color, visible }: SelectionRingProps) {
  const outerRef = useRef<THREE.Mesh>(null);
  const innerRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (outerRef.current && visible) {
      outerRef.current.rotation.z = t * 0.6;
      const pulse = 1 + Math.sin(t * 3) * 0.08;
      outerRef.current.scale.set(pulse, pulse, pulse);
    }
    if (innerRef.current && visible) {
      innerRef.current.rotation.z = -t * 0.8;
      const pulse = 1 + Math.sin(t * 3 + Math.PI) * 0.06;
      innerRef.current.scale.set(pulse, pulse, pulse);
    }
  });

  if (!visible) return null;

  return (
    <group position={position} rotation={[Math.PI / 2, 0, 0]}>
      {/* Outer ring — island theme color */}
      <mesh ref={outerRef}>
        <torusGeometry args={[radius + 1.5, 0.15, 8, 48]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.7}
          transparent
          opacity={0.6}
        />
      </mesh>
      {/* Inner ring — brand pink, counter-rotating */}
      <mesh ref={innerRef}>
        <torusGeometry args={[radius + 0.8, 0.1, 8, 48]} />
        <meshStandardMaterial
          color="#ec4899"
          emissive="#ec4899"
          emissiveIntensity={0.5}
          transparent
          opacity={0.4}
        />
      </mesh>
    </group>
  );
}
