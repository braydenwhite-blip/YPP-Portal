"use client";

import { useMemo } from "react";
import * as THREE from "three";
import type { PassionIsland } from "@/lib/world-actions";

interface BridgesProps {
  islands: PassionIsland[];
  positions: { x: number; y: number; z: number }[];
}

/**
 * Curved tube bridges between consecutive islands.
 * Uses brand purple (#7c3aed) with pink emissive (#ec4899) for portal integration.
 */
export function Bridges({ islands, positions }: BridgesProps) {
  const bridges = useMemo(() => {
    if (islands.length < 2) return [];

    const result: {
      key: string;
      curve: THREE.CatmullRomCurve3;
    }[] = [];

    for (let i = 0; i < islands.length - 1; i++) {
      const a = positions[i];
      const b = positions[i + 1];
      if (!a || !b) continue;

      const mid = new THREE.Vector3(
        (a.x + b.x) / 2,
        2 + Math.sqrt((b.x - a.x) ** 2 + (b.z - a.z) ** 2) * 0.06,
        (a.z + b.z) / 2,
      );

      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(a.x, 0.5, a.z),
        mid,
        new THREE.Vector3(b.x, 0.5, b.z),
      ]);

      result.push({ key: `bridge-${i}`, curve });
    }

    return result;
  }, [islands, positions]);

  return (
    <group>
      {bridges.map((bridge) => (
        <BridgeTube key={bridge.key} curve={bridge.curve} />
      ))}
    </group>
  );
}

function BridgeTube({ curve }: { curve: THREE.CatmullRomCurve3 }) {
  const geometry = useMemo(() => {
    return new THREE.TubeGeometry(curve, 24, 0.08, 6, false);
  }, [curve]);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color="#7c3aed"
        transparent
        opacity={0.35}
        emissive="#ec4899"
        emissiveIntensity={0.15}
      />
    </mesh>
  );
}
