"use client";

import { Billboard, Text } from "@react-three/drei";
import { LandmarkMarker } from "./landmark-marker";

interface QuestBoardProps {
  position: [number, number, number];
  questCount: number;
  onClick?: () => void;
}

export function QuestBoard3D({ position, questCount, onClick }: QuestBoardProps) {
  return (
    <group
      position={position}
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      onPointerOver={() => { document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { document.body.style.cursor = "default"; }}
    >
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

      {/* Bottom sign plank */}
      <mesh position={[0, 1.4, 0.15]}>
        <boxGeometry args={[1.6, 0.5, 0.08]} />
        <meshStandardMaterial color="#DEB887" />
      </mesh>

      {/* Scroll meshes based on quest count */}
      {Array.from({ length: Math.min(questCount, 3) }).map((_, i) => (
        <mesh key={i} position={[-0.5 + i * 0.5, 0.7, 0.2]}>
          <cylinderGeometry args={[0.08, 0.08, 0.4, 6]} />
          <meshStandardMaterial color="#f5f5dc" />
        </mesh>
      ))}

      {/* Label */}
      <Billboard position={[0, 3, 0]}>
        <Text fontSize={0.6} color="#8B6914" fontWeight={700} outlineWidth={0.04} outlineColor="#000">
          Quest Board
        </Text>
      </Billboard>

      <LandmarkMarker position={[1.2, 3.2, 0]} count={questCount} color="#f59e0b" />
    </group>
  );
}
