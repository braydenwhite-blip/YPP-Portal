"use client";

import { useMemo } from "react";
import * as THREE from "three";
import type { PassionIsland } from "@/lib/world-actions";
import { getTheme } from "../constants";

interface BridgesProps {
  islands: PassionIsland[];
  positions: { x: number; y: number; z: number }[];
}

/**
 * Curved tube bridges between consecutive islands.
 * The arc rises above the water and blends the two island colors.
 */
export function Bridges({ islands, positions }: BridgesProps) {
  const bridges = useMemo(() => {
    if (islands.length < 2) return [];

    const result: {
      key: string;
      curve: THREE.CatmullRomCurve3;
      color: string;
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

      const themeA = getTheme(islands[i].category);
      result.push({
        key: `bridge-${i}`,
        curve,
        color: themeA.gradient[0],
      });
    }

    return result;
  }, [islands, positions]);

  return (
    <group>
      {bridges.map((bridge) => (
        <BridgeTube key={bridge.key} curve={bridge.curve} color={bridge.color} />
      ))}
    </group>
  );
}

function BridgeTube({ curve, color }: { curve: THREE.CatmullRomCurve3; color: string }) {
  const geometry = useMemo(() => {
    return new THREE.TubeGeometry(curve, 24, 0.08, 6, false);
  }, [curve]);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color={color}
        transparent
        opacity={0.25}
        emissive={color}
        emissiveIntensity={0.1}
      />
    </mesh>
  );
}
