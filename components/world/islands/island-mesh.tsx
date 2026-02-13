"use client";

import { useRef, useMemo, memo } from "react";
import { useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import * as THREE from "three";
import type { PassionIsland } from "@/lib/world-actions";
import type { DeviceTier } from "../hooks/use-device-tier";
import { getTheme, seedRandom } from "../constants";
import { getTierConfig } from "./island-tiers";
import { IslandLabel } from "./island-label";
import { IslandTrees } from "./island-trees";
import { IslandStructures } from "./island-structures";

// ═══════════════════════════════════════════════════════════════
// Organic Island Mesh — SphereGeometry mound with noise displacement
// ═══════════════════════════════════════════════════════════════

/** LOD polygon budgets per device tier */
const LOD = {
  LOW:    { widthSegs: 6,  heightSegs: 3,  torusRadial: 4, torusTubular: 16 },
  MEDIUM: { widthSegs: 10, heightSegs: 5,  torusRadial: 6, torusTubular: 24 },
  HIGH:   { widthSegs: 14, heightSegs: 7,  torusRadial: 8, torusTubular: 32 },
} as const;

/** Cached material for beach rings (shared across all islands) */
const beachMaterial = new THREE.MeshStandardMaterial({
  color: "#fde68a",
  transparent: true,
  opacity: 0.5,
});

const beachMaterialDimmed = new THREE.MeshStandardMaterial({
  color: "#fde68a",
  transparent: true,
  opacity: 0.12,
});

interface IslandMeshProps {
  island: PassionIsland;
  position: [number, number, number];
  index: number;
  isSelected: boolean;
  isHovered: boolean;
  dimmed?: boolean;
  deviceTier?: DeviceTier;
  onSelect: () => void;
  onHover: (hovering: boolean) => void;
}

export const IslandMesh = memo(function IslandMesh({
  island,
  position,
  index,
  isSelected,
  isHovered,
  dimmed = false,
  deviceTier = "MEDIUM",
  onSelect,
  onHover,
}: IslandMeshProps) {
  const theme = getTheme(island.category);
  const tier = getTierConfig(island.level);
  const groupRef = useRef<THREE.Group>(null);
  const lod = LOD[deviceTier];

  const radius = tier.radius + (island.isPrimary ? 1 : 0);
  const height = tier.height + (island.isPrimary ? 0.5 : 0);

  // Organic mound geometry: squashed sphere with noise displacement
  const geometry = useMemo(() => {
    const geo = new THREE.SphereGeometry(radius, lod.widthSegs, lod.heightSegs);
    const pos = geo.attributes.position.array as Float32Array;
    const rng = seedRandom(index * 777 + island.id.charCodeAt(0));
    const count = pos.length / 3;

    for (let i = 0; i < count; i++) {
      const x = pos[i * 3];
      let y = pos[i * 3 + 1];
      const z = pos[i * 3 + 2];

      if (y >= 0) {
        // Top hemisphere: flatten to 0.35× for mound shape
        y *= 0.35;
        // Noise displacement with radial falloff (more at center, less at edges)
        const distFromCenter = Math.sqrt(x * x + z * z) / radius;
        const radialFalloff = Math.max(0, 1 - distFromCenter * 0.8);
        y += (rng() - 0.3) * 0.5 * radialFalloff;
      } else {
        // Bottom hemisphere: extend downward 1.5× for natural underwater taper
        y *= 1.5;
      }

      pos[i * 3 + 1] = y;
    }

    geo.computeVertexNormals();
    return geo;
  }, [radius, index, island.id, lod.widthSegs, lod.heightSegs]);

  // Surface height at the equator (where trees/structures sit)
  const surfaceY = radius * 0.35;

  // Cached torus geometry for beach ring
  const torusGeo = useMemo(
    () => new THREE.TorusGeometry(radius * 0.85, 0.15, lod.torusRadial, lod.torusTubular),
    [radius, lod.torusRadial, lod.torusTubular],
  );

  // Cached materials (recreated only when colors or dimmed state change)
  const bodyMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: tier.topColor,
        roughness: 0.8,
        metalness: 0,
        emissive: isHovered && !dimmed ? theme.gradient[0] : "#000000",
        emissiveIntensity: isHovered && !dimmed ? 0.15 : 0,
        transparent: dimmed,
        opacity: dimmed ? 0.25 : 1,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tier.topColor, isHovered, dimmed, theme.gradient[0]],
  );

  // Selection ring animation
  const ringRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ringRef.current) {
      ringRef.current.rotation.z = clock.getElapsedTime() * 0.5;
    }
  });

  // Selection ring torus (LOD-aware)
  const ringGeo = useMemo(
    () => new THREE.TorusGeometry(radius + 1, 0.12, lod.torusRadial, lod.torusTubular),
    [radius, lod.torusRadial, lod.torusTubular],
  );

  const ringMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: theme.gradient[0],
        emissive: theme.gradient[0],
        emissiveIntensity: 0.6,
        transparent: true,
        opacity: 0.7,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [theme.gradient[0]],
  );

  // On LOW tier, skip Float animation for performance
  const floatSpeed = deviceTier === "LOW" ? 0 : 1.5;
  const floatIntensity = deviceTier === "LOW" ? 0 : 0.3;

  // On LOW tier, limit tree count
  const treeCount = deviceTier === "LOW" ? Math.min(tier.trees, 3) : tier.trees;

  return (
    <Float speed={floatSpeed} floatIntensity={floatIntensity} rotationIntensity={0}>
      <group ref={groupRef} position={position}>
        {/* Island body — organic mound */}
        <mesh
          geometry={geometry}
          material={bodyMaterial}
          castShadow={deviceTier !== "LOW"}
          receiveShadow={deviceTier !== "LOW"}
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
          onPointerOver={(e) => { e.stopPropagation(); onHover(true); document.body.style.cursor = "pointer"; }}
          onPointerOut={() => { onHover(false); document.body.style.cursor = "default"; }}
        />

        {/* Beach ring at equator */}
        <mesh
          position={[0, 0, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          geometry={torusGeo}
          material={dimmed ? beachMaterialDimmed : beachMaterial}
        />

        {/* Trees on top surface */}
        <IslandTrees
          count={treeCount}
          islandRadius={radius}
          islandHeight={surfaceY * 2}
          canopyColor={theme.gradient[0]}
          seed={index * 1000 + island.id.charCodeAt(0)}
          deviceTier={deviceTier}
        />

        {/* Structures */}
        {(deviceTier !== "LOW" || isSelected) && (
          <IslandStructures
            structures={tier.structures}
            islandHeight={surfaceY * 2}
            accentColor={theme.accent}
          />
        )}

        {/* Selection ring */}
        {isSelected && (
          <mesh
            ref={ringRef}
            position={[0, 0.1, 0]}
            rotation={[Math.PI / 2, 0, 0]}
            geometry={ringGeo}
            material={ringMaterial}
          />
        )}

        {/* Primary passion crown glow (skip on LOW) */}
        {island.isPrimary && deviceTier !== "LOW" && (
          <pointLight
            position={[0, surfaceY + 2, 0]}
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
          position={[0, surfaceY + (tier.trees > 3 ? 3.5 : 2.5), 0]}
        />
      </group>
    </Float>
  );
},
(prev, next) =>
  prev.island.id === next.island.id &&
  prev.island.xpPoints === next.island.xpPoints &&
  prev.island.level === next.island.level &&
  prev.island.currentLevel === next.island.currentLevel &&
  prev.island.isPrimary === next.island.isPrimary &&
  prev.isSelected === next.isSelected &&
  prev.isHovered === next.isHovered &&
  prev.dimmed === next.dimmed &&
  prev.deviceTier === next.deviceTier &&
  prev.position[0] === next.position[0] &&
  prev.position[1] === next.position[1] &&
  prev.position[2] === next.position[2],
);
