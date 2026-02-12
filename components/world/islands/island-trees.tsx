"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { seedRandom } from "../constants";

interface IslandTreesProps {
  count: number;
  islandRadius: number;
  islandHeight: number;
  canopyColor: string;
  seed: number;
}

export function IslandTrees({ count, islandRadius, islandHeight, canopyColor, seed }: IslandTreesProps) {
  const rng = useMemo(() => seedRandom(seed), [seed]);

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

  return (
    <group position={[0, islandHeight / 2, 0]}>
      {trees.map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]}>
          {/* Trunk */}
          <mesh position={[0, t.trunkH / 2, 0]}>
            <cylinderGeometry args={[0.08, 0.12, t.trunkH, 5]} />
            <meshStandardMaterial color="#8B4513" />
          </mesh>
          {/* Canopy */}
          <mesh position={[0, t.trunkH + t.canopyR * 0.5, 0]}>
            <sphereGeometry args={[t.canopyR, 6, 5]} />
            <meshStandardMaterial color={canopyColor} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
