"use client";

import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";
import { LandmarkMarker } from "./landmark-marker";

interface SeasonalEventsProps {
  position: [number, number, number];
  count: number;
  onClick?: () => void;
}

export function SeasonalEvents3D({ position, count, onClick }: SeasonalEventsProps) {
  const active = count > 0;

  // Season color based on current month
  const month = new Date().getMonth();
  const seasonColor = month < 3 ? "#60a5fa" : month < 6 ? "#22c55e" : month < 9 ? "#f59e0b" : "#ef4444";

  return (
    <group
      position={position}
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      onPointerOver={() => { document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { document.body.style.cursor = "default"; }}
    >
      {/* Tent / cone shape */}
      <mesh position={[0, 1.2, 0]}>
        <coneGeometry args={[2, 2.4, 6]} />
        <meshStandardMaterial
          color={seasonColor}
          transparent
          opacity={active ? 0.85 : 0.4}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Center pole */}
      <mesh position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 3, 4]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>

      {/* Flag on top */}
      <mesh position={[0.2, 3, 0]}>
        <boxGeometry args={[0.5, 0.3, 0.02]} />
        <meshStandardMaterial color={active ? "#ef4444" : "#94a3b8"} />
      </mesh>

      {/* Bunting lines if active */}
      {active && (
        <>
          {[0, 1.2, 2.4, 3.6, 4.8].map((angle, i) => {
            const rad = (angle / 5) * Math.PI * 2;
            const x = Math.cos(rad) * 1.6;
            const z = Math.sin(rad) * 1.6;
            const colors = ["#ef4444", "#fbbf24", "#22c55e", "#3b82f6", "#a855f7"];
            return (
              <mesh key={i} position={[x, 0.3, z]}>
                <boxGeometry args={[0.3, 0.2, 0.02]} />
                <meshStandardMaterial color={colors[i]} />
              </mesh>
            );
          })}
        </>
      )}

      {/* Label */}
      <Billboard position={[0, 3.8, 0]}>
        <Text fontSize={0.6} color="#b91c1c" fontWeight={700} outlineWidth={0.04} outlineColor="#000">
          Events
        </Text>
      </Billboard>

      <LandmarkMarker position={[1.5, 4, 0]} count={count} color="#16a34a" />
    </group>
  );
}
