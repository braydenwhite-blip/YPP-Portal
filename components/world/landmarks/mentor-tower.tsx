"use client";

import { Billboard, Text } from "@react-three/drei";
import { LandmarkMarker } from "./landmark-marker";

interface MentorTowerProps {
  position: [number, number, number];
  mentorName: string | null;
  onClick?: () => void;
}

export function MentorTower3D({ position, mentorName, onClick }: MentorTowerProps) {
  const hasmentor = !!mentorName;

  return (
    <group
      position={position}
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      onPointerOver={() => { document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { document.body.style.cursor = "default"; }}
    >
      {/* Tower body */}
      <mesh position={[0, 2, 0]}>
        <cylinderGeometry args={[0.6, 0.8, 4, 8]} />
        <meshStandardMaterial color="#7c3aed" transparent opacity={0.9} />
      </mesh>

      {/* Cone roof */}
      <mesh position={[0, 4.3, 0]}>
        <coneGeometry args={[1, 1.2, 8]} />
        <meshStandardMaterial color="#5b21b6" />
      </mesh>

      {/* Window glow */}
      <mesh position={[0, 2.5, 0.65]}>
        <boxGeometry args={[0.3, 0.4, 0.05]} />
        <meshStandardMaterial
          color={hasmentor ? "#fbbf24" : "#1e1b4b"}
          emissive={hasmentor ? "#fbbf24" : "#000000"}
          emissiveIntensity={hasmentor ? 0.8 : 0}
        />
      </mesh>
      <mesh position={[0, 1.5, 0.65]}>
        <boxGeometry args={[0.3, 0.4, 0.05]} />
        <meshStandardMaterial
          color={hasmentor ? "#fbbf24" : "#1e1b4b"}
          emissive={hasmentor ? "#fbbf24" : "#000000"}
          emissiveIntensity={hasmentor ? 0.6 : 0}
        />
      </mesh>

      {/* Top beacon */}
      <pointLight
        position={[0, 5, 0]}
        color="#fbbf24"
        intensity={hasmentor ? 1 : 0.1}
        distance={8}
      />
      <mesh position={[0, 5, 0]}>
        <sphereGeometry args={[0.15, 8, 8]} />
        <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={hasmentor ? 1 : 0.1} />
      </mesh>

      {/* Flag on top */}
      <mesh position={[0, 5.2, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.6, 4]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>

      {/* Label */}
      <Billboard position={[0, 6, 0]}>
        <Text fontSize={0.6} color="#7c3aed" fontWeight={700} outlineWidth={0.04} outlineColor="#000">
          Mentor Tower
        </Text>
        {mentorName && (
          <Text fontSize={0.4} color="#a78bfa" position={[0, -0.6, 0]} outlineWidth={0.03} outlineColor="#000">
            {mentorName}
          </Text>
        )}
      </Billboard>

      <LandmarkMarker position={[1, 6.2, 0]} count={hasmentor ? 0 : 1} color="#7c3aed" />
    </group>
  );
}
