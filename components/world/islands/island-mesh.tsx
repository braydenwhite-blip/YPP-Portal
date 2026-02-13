"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import * as THREE from "three";
import type { PassionIsland } from "@/lib/world-actions";
import { getTheme, seedRandom } from "../constants";
import { getTierConfig } from "./island-tiers";
import { IslandLabel } from "./island-label";
import { IslandTrees } from "./island-trees";
import { IslandStructures } from "./island-structures";

interface IslandMeshProps {
  island: PassionIsland;
  position: [number, number, number];
  index: number;
  isSelected: boolean;
  isHovered: boolean;
  dimmed?: boolean;
  onSelect: () => void;
  onHover: (hovering: boolean) => void;
}

export function IslandMesh({
  island,
  position,
  index,
  isSelected,
  isHovered,
  dimmed = false,
  onSelect,
  onHover,
}: IslandMeshProps) {
  const theme = getTheme(island.category);
  const tier = getTierConfig(island.level);
  const groupRef = useRef<THREE.Group>(null);

  const radius = tier.radius + (island.isPrimary ? 1 : 0);
  const height = tier.height + (island.isPrimary ? 0.5 : 0);

  // Displace top vertices for organic terrain
  const geometry = useMemo(() => {
    const geo = new THREE.CylinderGeometry(radius, radius * 1.1, height, 16, 4);
    const pos = geo.attributes.position.array as Float32Array;
    const rng = seedRandom(index * 777 + island.id.charCodeAt(0));
    const count = pos.length / 3;
    for (let i = 0; i < count; i++) {
      const y = pos[i * 3 + 1];
      // Only displace top-face vertices
      if (y > height * 0.4) {
        pos[i * 3] += (rng() - 0.5) * 0.4;
        pos[i * 3 + 1] += rng() * 0.3;
        pos[i * 3 + 2] += (rng() - 0.5) * 0.4;
      }
    }
    geo.computeVertexNormals();
    return geo;
  }, [radius, height, index, island.id]);

  // Selection ring animation
  const ringRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ringRef.current) {
      ringRef.current.rotation.z = clock.getElapsedTime() * 0.5;
    }
  });

  const dimOpacity = dimmed ? 0.25 : 1;

  return (
    <Float speed={1.5} floatIntensity={0.3} rotationIntensity={0}>
      <group ref={groupRef} position={position}>
        {/* Island body */}
        <mesh
          geometry={geometry}
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
          onPointerOver={(e) => { e.stopPropagation(); onHover(true); document.body.style.cursor = "pointer"; }}
          onPointerOut={() => { onHover(false); document.body.style.cursor = "default"; }}
        >
          <meshStandardMaterial
            color={tier.topColor}
            roughness={0.8}
            metalness={0}
            emissive={isHovered && !dimmed ? theme.gradient[0] : "#000000"}
            emissiveIntensity={isHovered && !dimmed ? 0.15 : 0}
            transparent={dimmed}
            opacity={dimOpacity}
          />
        </mesh>

        {/* Side/underwater taper */}
        <mesh position={[0, -height * 0.6, 0]}>
          <coneGeometry args={[radius * 0.9, height * 0.8, 12]} />
          <meshStandardMaterial color={tier.sideColor} roughness={0.9} transparent={dimmed} opacity={dimOpacity} />
        </mesh>

        {/* Beach ring */}
        <mesh position={[0, height * 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[radius * 0.85, 0.15, 6, 24]} />
          <meshStandardMaterial color="#fde68a" transparent opacity={dimmed ? 0.12 : 0.5} />
        </mesh>

        {/* Trees */}
        <IslandTrees
          count={tier.trees}
          islandRadius={radius}
          islandHeight={height}
          canopyColor={theme.gradient[0]}
          seed={index * 1000 + island.id.charCodeAt(0)}
        />

        {/* Structures */}
        <IslandStructures
          structures={tier.structures}
          islandHeight={height}
          accentColor={theme.accent}
        />

        {/* Selection ring */}
        {isSelected && (
          <mesh
            ref={ringRef}
            position={[0, 0.1, 0]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <torusGeometry args={[radius + 1, 0.12, 8, 32]} />
            <meshStandardMaterial
              color={theme.gradient[0]}
              emissive={theme.gradient[0]}
              emissiveIntensity={0.6}
              transparent
              opacity={0.7}
            />
          </mesh>
        )}

        {/* Primary passion crown glow */}
        {island.isPrimary && (
          <pointLight
            position={[0, height + 2, 0]}
            color="#fbbf24"
            intensity={0.5}
            distance={8}
          />
        )}

        {/* Label */}
        <IslandLabel
          name={island.name}
          level={island.level}
          currentLevel={island.currentLevel}
          color={theme.gradient[0]}
          position={[0, height / 2 + (tier.trees > 3 ? 3.5 : 2.5), 0]}
        />
      </group>
    </Float>
  );
}
