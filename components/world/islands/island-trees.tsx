"use client";

import { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import type { DeviceTier } from "../hooks/use-device-tier";
import { seedRandom } from "../constants";

// ═══════════════════════════════════════════════════════════════
// IslandTrees — Performance-tuned with InstancedMesh
// Instead of N individual meshes, uses 2 InstancedMesh (trunks + canopies).
// ═══════════════════════════════════════════════════════════════

/** LOD segments for trees */
const TREE_LOD = {
  LOW:    { trunkSegs: 3, canopySegs: 4 },
  MEDIUM: { trunkSegs: 5, canopySegs: 6 },
  HIGH:   { trunkSegs: 6, canopySegs: 8 },
} as const;

/** Shared trunk material */
const trunkMaterial = new THREE.MeshStandardMaterial({ color: "#8B4513" });

interface IslandTreesProps {
  count: number;
  islandRadius: number;
  islandHeight: number;
  canopyColor: string;
  seed: number;
  deviceTier?: DeviceTier;
}

export function IslandTrees({
  count,
  islandRadius,
  islandHeight,
  canopyColor,
  seed,
  deviceTier = "MEDIUM",
}: IslandTreesProps) {
  const lod = TREE_LOD[deviceTier];

  // Compute tree positions deterministically
  const trees = useMemo(() => {
    const r = seedRandom(seed);
    const result = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + r() * 0.5;
      const dist = (islandRadius * 0.3) + r() * (islandRadius * 0.5);
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const trunkH = 0.8 + r() * 0.6;
      const canopyR = 0.4 + r() * 0.3;
      result.push({ x, z, trunkH, canopyR });
    }
    return result;
  }, [count, islandRadius, seed]);

  // Shared geometries
  const trunkGeo = useMemo(
    () => new THREE.CylinderGeometry(0.08, 0.12, 1, lod.trunkSegs),
    [lod.trunkSegs],
  );
  const canopyGeo = useMemo(
    () => new THREE.SphereGeometry(1, lod.canopySegs, lod.canopySegs - 1),
    [lod.canopySegs],
  );

  // Canopy material (colored per island)
  const canopyMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: canopyColor }),
    [canopyColor],
  );

  // Instanced trunk mesh
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const canopyRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    const tempMatrix = new THREE.Matrix4();

    // Set trunk instance transforms
    if (trunkRef.current) {
      for (let i = 0; i < trees.length; i++) {
        const t = trees[i];
        tempMatrix.identity();
        tempMatrix.makeScale(1, t.trunkH, 1);
        tempMatrix.setPosition(t.x, t.trunkH / 2, t.z);
        trunkRef.current.setMatrixAt(i, tempMatrix);
      }
      trunkRef.current.instanceMatrix.needsUpdate = true;
    }

    // Set canopy instance transforms
    if (canopyRef.current) {
      for (let i = 0; i < trees.length; i++) {
        const t = trees[i];
        tempMatrix.identity();
        tempMatrix.makeScale(t.canopyR, t.canopyR, t.canopyR);
        tempMatrix.setPosition(t.x, t.trunkH + t.canopyR * 0.5, t.z);
        canopyRef.current.setMatrixAt(i, tempMatrix);
      }
      canopyRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [trees]);

  if (count === 0) return null;

  return (
    <group position={[0, islandHeight / 2, 0]}>
      <instancedMesh ref={trunkRef} args={[trunkGeo, trunkMaterial, count]} />
      <instancedMesh ref={canopyRef} args={[canopyGeo, canopyMat, count]} />
    </group>
  );
}
