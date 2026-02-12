"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { DeviceTier } from "../hooks/use-device-tier";

interface OceanProps {
  tier?: DeviceTier;
}

export function Ocean({ tier = "MEDIUM" }: OceanProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  const segments = tier === "LOW" ? 32 : tier === "MEDIUM" ? 48 : 64;

  // Store original Y positions for wave animation
  const baseY = useMemo(() => {
    const geo = new THREE.PlaneGeometry(500, 500, segments, segments);
    geo.rotateX(-Math.PI / 2);
    const positions = geo.attributes.position.array as Float32Array;
    const yValues = new Float32Array(positions.length / 3);
    for (let i = 0; i < yValues.length; i++) {
      yValues[i] = positions[i * 3 + 1];
    }
    return { geometry: geo, yValues };
  }, [segments]);

  useFrame(({ clock }) => {
    if (!meshRef.current || tier === "LOW") return;
    const geo = meshRef.current.geometry;
    const positions = geo.attributes.position.array as Float32Array;
    const t = clock.getElapsedTime();
    const count = positions.length / 3;

    for (let i = 0; i < count; i++) {
      const x = positions[i * 3];
      const z = positions[i * 3 + 2];
      positions[i * 3 + 1] =
        baseY.yValues[i] +
        Math.sin(x * 0.04 + t * 0.8) * 0.4 +
        Math.cos(z * 0.06 + t * 0.6) * 0.3 +
        Math.sin((x + z) * 0.03 + t * 0.4) * 0.2;
    }
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
  });

  return (
    <mesh ref={meshRef} geometry={baseY.geometry} receiveShadow>
      <meshStandardMaterial
        color="#0369a1"
        transparent
        opacity={0.85}
        roughness={0.3}
        metalness={0.1}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
