"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";
import { LandmarkMarker } from "./landmark-marker";

interface QuestBoardProps {
  position: [number, number, number];
  questCount: number;
  completedCount?: number;
  isSelected?: boolean;
  onClick?: () => void;
}

export function QuestBoard3D({
  position,
  questCount,
  completedCount = 0,
  isSelected = false,
  onClick,
}: QuestBoardProps) {
  const scrollGroupRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.PointLight>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // Scrolls gently bob when there are active quests
    if (scrollGroupRef.current && questCount > 0) {
      scrollGroupRef.current.children.forEach((child, i) => {
        child.position.y = 0.7 + Math.sin(t * 1.5 + i * 0.8) * 0.05;
      });
    }

    // Beacon glow pulses
    if (glowRef.current) {
      const intensity = questCount > 0
        ? 0.6 + Math.sin(t * 2) * 0.3
        : 0.1;
      glowRef.current.intensity = intensity;
    }

    // Selection ring rotation
    if (ringRef.current) {
      ringRef.current.rotation.y = t * 0.5;
      const targetScale = isSelected ? 1 : 0;
      const s = ringRef.current.scale.x;
      const newScale = s + (targetScale - s) * 0.08;
      ringRef.current.scale.set(newScale, newScale, newScale);
    }
  });

  return (
    <group
      position={position}
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      onPointerOver={() => { document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { document.body.style.cursor = "default"; }}
    >
      {/* Ground base platform */}
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[1.5, 1.8, 0.2, 8]} />
        <meshStandardMaterial color="#8B7355" roughness={0.8} />
      </mesh>

      {/* Main post */}
      <mesh position={[0, 1.2, 0]}>
        <cylinderGeometry args={[0.12, 0.15, 2.4, 6]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>

      {/* Top sign plank */}
      <mesh position={[0, 2.2, 0.15]}>
        <boxGeometry args={[2, 0.7, 0.08]} />
        <meshStandardMaterial color="#DEB887" />
      </mesh>
      {/* Plank text */}
      <Billboard position={[0, 2.2, 0.22]}>
        <Text fontSize={0.22} color="#5C3317" fontWeight={700}>
          QUESTS
        </Text>
      </Billboard>

      {/* Bottom sign plank */}
      <mesh position={[0, 1.4, 0.15]}>
        <boxGeometry args={[1.6, 0.5, 0.08]} />
        <meshStandardMaterial color="#DEB887" />
      </mesh>
      <Billboard position={[0, 1.4, 0.22]}>
        <Text fontSize={0.18} color="#5C3317">
          {questCount > 0 ? `${questCount} Active` : "No Quests"}
        </Text>
      </Billboard>

      {/* Scroll meshes based on quest count */}
      <group ref={scrollGroupRef}>
        {Array.from({ length: Math.min(questCount, 5) }).map((_, i) => (
          <group key={i} position={[-0.6 + i * 0.3, 0.7, 0.2]}>
            <mesh>
              <cylinderGeometry args={[0.08, 0.08, 0.4, 6]} />
              <meshStandardMaterial color="#f5f5dc" />
            </mesh>
            {/* Scroll caps */}
            <mesh position={[0, 0.2, 0]}>
              <cylinderGeometry args={[0.1, 0.1, 0.03, 6]} />
              <meshStandardMaterial color="#8B4513" />
            </mesh>
            <mesh position={[0, -0.2, 0]}>
              <cylinderGeometry args={[0.1, 0.1, 0.03, 6]} />
              <meshStandardMaterial color="#8B4513" />
            </mesh>
          </group>
        ))}
      </group>

      {/* Completed tally marks — small notches on the post */}
      {completedCount > 0 && Array.from({ length: Math.min(completedCount, 10) }).map((_, i) => (
        <mesh key={`tally-${i}`} position={[-0.15, 0.3 + i * 0.06, 0.1]}>
          <boxGeometry args={[0.18, 0.02, 0.02]} />
          <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.3} />
        </mesh>
      ))}

      {/* Beacon lantern on top */}
      <mesh position={[0, 2.7, 0]}>
        <octahedronGeometry args={[0.15, 0]} />
        <meshStandardMaterial
          color="#fbbf24"
          emissive="#fbbf24"
          emissiveIntensity={questCount > 0 ? 0.8 : 0.1}
          transparent
          opacity={0.9}
        />
      </mesh>
      <pointLight
        ref={glowRef}
        position={[0, 2.7, 0]}
        color="#fbbf24"
        intensity={0.5}
        distance={8}
        decay={2}
      />

      {/* Selection ring */}
      <mesh ref={ringRef} position={[0, 0.15, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={0}>
        <torusGeometry args={[2.2, 0.06, 8, 32]} />
        <meshStandardMaterial
          color="#f59e0b"
          emissive="#f59e0b"
          emissiveIntensity={0.6}
          transparent
          opacity={0.7}
        />
      </mesh>

      {/* Label */}
      <Billboard position={[0, 3.3, 0]}>
        <Text fontSize={0.6} color="#8B6914" fontWeight={700} outlineWidth={0.04} outlineColor="#000">
          Quest Board
        </Text>
      </Billboard>

      <LandmarkMarker position={[1.2, 3.5, 0]} count={questCount} color="#f59e0b" />
    </group>
  );
}
