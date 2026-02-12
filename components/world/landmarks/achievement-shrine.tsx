"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";
import { LandmarkMarker } from "./landmark-marker";

interface AchievementShrineProps {
  position: [number, number, number];
  badgeCount: number;
  certCount: number;
  onClick?: () => void;
}

export function AchievementShrine3D({ position, badgeCount, certCount, onClick }: AchievementShrineProps) {
  const starRef = useRef<THREE.Mesh>(null);
  const total = badgeCount + certCount;
  const glowIntensity = Math.min(total * 0.15, 1.5);

  useFrame(({ clock }) => {
    if (starRef.current) {
      starRef.current.rotation.y = clock.getElapsedTime() * 0.8;
    }
  });

  return (
    <group
      position={position}
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      onPointerOver={() => { document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { document.body.style.cursor = "default"; }}
    >
      {/* Base platform */}
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[3, 0.6, 2.5]} />
        <meshStandardMaterial color="#fbbf24" roughness={0.3} metalness={0.4} />
      </mesh>

      {/* Pyramid roof */}
      <mesh position={[0, 2.5, 0]}>
        <coneGeometry args={[1.8, 1.5, 4]} />
        <meshStandardMaterial color="#f59e0b" roughness={0.3} metalness={0.3} />
      </mesh>

      {/* Pillars */}
      {[[-1.1, 0, -0.8], [1.1, 0, -0.8], [-1.1, 0, 0.8], [1.1, 0, 0.8]].map((pos, i) => (
        <mesh key={i} position={[pos[0], 1.3, pos[2]]}>
          <cylinderGeometry args={[0.12, 0.15, 2, 6]} />
          <meshStandardMaterial color="#d97706" />
        </mesh>
      ))}

      {/* Rotating star on top */}
      <mesh ref={starRef} position={[0, 3.5, 0]}>
        <octahedronGeometry args={[0.4, 0]} />
        <meshStandardMaterial
          color="#fbbf24"
          emissive="#fbbf24"
          emissiveIntensity={glowIntensity}
          roughness={0.1}
          metalness={0.8}
        />
      </mesh>
      <pointLight position={[0, 3.5, 0]} color="#fbbf24" intensity={glowIntensity} distance={10} />

      {/* Gem spheres around base (1 per badge, max 8 visible) */}
      {Array.from({ length: Math.min(badgeCount, 8) }).map((_, i) => {
        const angle = (i / Math.min(badgeCount, 8)) * Math.PI * 2;
        const gemX = Math.cos(angle) * 1.8;
        const gemZ = Math.sin(angle) * 1.8;
        const colors = ["#ef4444", "#3b82f6", "#22c55e", "#a855f7", "#f59e0b", "#ec4899", "#14b8a6", "#f97316"];
        return (
          <mesh key={i} position={[gemX, 0.9, gemZ]}>
            <sphereGeometry args={[0.15, 6, 6]} />
            <meshStandardMaterial
              color={colors[i % colors.length]}
              emissive={colors[i % colors.length]}
              emissiveIntensity={0.4}
              roughness={0.1}
              metalness={0.6}
            />
          </mesh>
        );
      })}

      {/* Label */}
      <Billboard position={[0, 4.5, 0]}>
        <Text fontSize={0.6} color="#92400e" fontWeight={700} outlineWidth={0.04} outlineColor="#000">
          Shrine
        </Text>
      </Billboard>

      <LandmarkMarker position={[1.5, 4.7, 0]} count={total} color="#f59e0b" />
    </group>
  );
}
