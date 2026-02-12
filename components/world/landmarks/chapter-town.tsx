"use client";

import { Billboard, Text } from "@react-three/drei";
import { LandmarkMarker } from "./landmark-marker";

interface ChapterTownProps {
  position: [number, number, number];
  chapterName: string | null;
  memberCount: number;
  onClick?: () => void;
}

export function ChapterTown3D({ position, chapterName, memberCount, onClick }: ChapterTownProps) {
  const buildingCount = chapterName ? Math.min(2 + Math.floor(memberCount / 10), 4) : 2;

  const buildings = [
    { x: -1, z: 0, w: 1, h: 2, d: 1, color: "#3b82f6" },
    { x: 0.8, z: 0.3, w: 1.3, h: 2.8, d: 1.2, color: "#2563eb" },
    { x: 2.2, z: -0.2, w: 0.9, h: 1.6, d: 0.8, color: "#60a5fa" },
    { x: -0.5, z: 1.5, w: 1, h: 1.8, d: 0.9, color: "#3b82f6" },
  ].slice(0, buildingCount);

  return (
    <group
      position={position}
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      onPointerOver={() => { document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { document.body.style.cursor = "default"; }}
    >
      {buildings.map((b, i) => (
        <group key={i} position={[b.x, 0, b.z]}>
          {/* Building body */}
          <mesh position={[0, b.h / 2, 0]}>
            <boxGeometry args={[b.w, b.h, b.d]} />
            <meshStandardMaterial color={b.color} transparent opacity={chapterName ? 0.9 : 0.5} />
          </mesh>
          {/* Pyramid roof */}
          <mesh position={[0, b.h + 0.3, 0]}>
            <coneGeometry args={[b.w * 0.7, 0.6, 4]} />
            <meshStandardMaterial color="#1d4ed8" transparent opacity={chapterName ? 0.9 : 0.5} />
          </mesh>
          {/* Window */}
          <mesh position={[0, b.h * 0.6, b.d / 2 + 0.01]}>
            <boxGeometry args={[0.2, 0.25, 0.02]} />
            <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={chapterName ? 0.4 : 0} />
          </mesh>
        </group>
      ))}

      {/* Chimney smoke on main building */}
      {chapterName && (
        <pointLight position={[0.8, 3.5, 0.3]} color="#94a3b8" intensity={0.3} distance={3} />
      )}

      {/* Label */}
      <Billboard position={[0.5, 4.5, 0]}>
        <Text fontSize={0.6} color="#1e40af" fontWeight={700} outlineWidth={0.04} outlineColor="#000">
          {chapterName ?? "Chapter Town"}
        </Text>
        {memberCount > 0 && (
          <Text fontSize={0.4} color="#3b82f6" position={[0, -0.6, 0]} outlineWidth={0.03} outlineColor="#000">
            {memberCount} explorers
          </Text>
        )}
      </Billboard>

      <LandmarkMarker position={[2, 4.7, 0]} count={chapterName ? 0 : 1} color="#3b82f6" />
    </group>
  );
}
