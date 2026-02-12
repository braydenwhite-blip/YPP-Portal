"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { TimeOfDayData } from "../hooks/use-time-of-day";
import type { DeviceTier } from "../hooks/use-device-tier";

// ═══════════════════════════════════════════════════════════════
// Weather System — Golden rays, fog banks, aurora, light effects
// ═══════════════════════════════════════════════════════════════

interface WeatherProps {
  timeData: TimeOfDayData;
  tier: DeviceTier;
  /** True when user has been active recently (affects god-rays vs fog) */
  isActive?: boolean;
  /** True to trigger a short aurora burst (e.g. on level-up) */
  auroraFlash?: boolean;
}

export function Weather({ timeData, tier, isActive = true, auroraFlash = false }: WeatherProps) {
  if (tier === "LOW") return null;

  return (
    <group>
      {/* Golden god-rays during dawn/dusk when user is active */}
      <GoldenRays timeData={timeData} visible={isActive} />

      {/* Rolling fog banks during night or idle periods */}
      <FogBanks timeData={timeData} visible={!isActive || timeData.phase === "NIGHT"} />

      {/* Aurora for night phase or level-up flash */}
      {(timeData.phase === "NIGHT" || auroraFlash) && tier === "HIGH" && (
        <Aurora intensity={auroraFlash ? 1.5 : 0.6} />
      )}
    </group>
  );
}

// ─── Golden God-Rays ────────────────────────────────────────

function GoldenRays({ timeData, visible }: { timeData: TimeOfDayData; visible: boolean }) {
  const groupRef = useRef<THREE.Group>(null);

  // Only visible during golden hours (dawn/dusk)
  const isGoldenHour = timeData.phase === "DAWN" || timeData.phase === "DUSK";
  const show = visible && isGoldenHour;

  const rays = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => ({
      angle: (i / 5) * Math.PI * 0.3 - 0.15 * Math.PI,
      width: 0.8 + Math.random() * 0.6,
      length: 80 + Math.random() * 40,
      offset: Math.random() * Math.PI * 2,
    }));
  }, []);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    // Fade in/out
    const targetOpacity = show ? 0.12 : 0;
    groupRef.current.children.forEach((child, i) => {
      const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
      if (mat.opacity !== undefined) {
        const pulse = 0.8 + Math.sin(clock.getElapsedTime() * 0.3 + rays[i].offset) * 0.2;
        mat.opacity += (targetOpacity * pulse - mat.opacity) * 0.05;
      }
    });

    // Point rays from sun direction
    groupRef.current.lookAt(
      timeData.sunPosition[0],
      timeData.sunPosition[1],
      timeData.sunPosition[2],
    );
  });

  return (
    <group ref={groupRef} position={[0, 20, 0]}>
      {rays.map((ray, i) => (
        <mesh
          key={i}
          rotation={[0, ray.angle, 0]}
        >
          <planeGeometry args={[ray.width, ray.length]} />
          <meshBasicMaterial
            color="#ffcc66"
            transparent
            opacity={0}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
}

// ─── Fog Banks ──────────────────────────────────────────────

function FogBanks({ timeData, visible }: { timeData: TimeOfDayData; visible: boolean }) {
  const groupRef = useRef<THREE.Group>(null);

  const banks = useMemo(() => {
    return Array.from({ length: 4 }, (_, i) => ({
      x: (i - 1.5) * 40,
      z: 20 + i * 15,
      width: 30 + Math.random() * 20,
      speed: 0.3 + Math.random() * 0.2,
      offset: Math.random() * Math.PI * 2,
    }));
  }, []);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();
    const nightBoost = timeData.phase === "NIGHT" ? 0.4 : 0;
    const targetOpacity = visible ? 0.08 + nightBoost * 0.06 : 0;

    groupRef.current.children.forEach((child, i) => {
      const mesh = child as THREE.Mesh;
      const bank = banks[i];
      // Drift slowly
      mesh.position.x = bank.x + Math.sin(t * bank.speed + bank.offset) * 8;
      mesh.position.z = bank.z + Math.cos(t * bank.speed * 0.7 + bank.offset) * 5;

      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity += (targetOpacity - mat.opacity) * 0.03;
    });
  });

  return (
    <group ref={groupRef}>
      {banks.map((bank, i) => (
        <mesh
          key={i}
          position={[bank.x, 2, bank.z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[bank.width, bank.width * 0.6]} />
          <meshBasicMaterial
            color={timeData.phase === "NIGHT" ? "#1a2040" : "#d0e0f0"}
            transparent
            opacity={0}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

// ─── Aurora Borealis ────────────────────────────────────────

function Aurora({ intensity }: { intensity: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);

  const geometry = useMemo(() => {
    const width = 120;
    const segments = 40;
    const geo = new THREE.PlaneGeometry(width, 30, segments, 4);
    return geo;
  }, []);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();

    // Undulate vertices
    const positions = meshRef.current.geometry.attributes.position.array as Float32Array;
    const count = positions.length / 3;
    for (let i = 0; i < count; i++) {
      const x = positions[i * 3];
      const origY = positions[i * 3 + 1];
      positions[i * 3 + 2] =
        Math.sin(x * 0.05 + t * 0.3) * 5 +
        Math.cos(x * 0.08 + t * 0.5) * 3;
      positions[i * 3 + 1] = origY + Math.sin(x * 0.03 + t * 0.2) * 2;
    }
    meshRef.current.geometry.attributes.position.needsUpdate = true;

    // Color shift between green and purple
    if (matRef.current) {
      const hue = 0.3 + Math.sin(t * 0.15) * 0.12; // oscillate 0.18-0.42
      matRef.current.color.setHSL(hue, 0.8, 0.5);
      matRef.current.opacity = intensity * (0.12 + Math.sin(t * 0.4) * 0.04);
    }
  });

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      position={[0, 80, -100]}
      rotation={[0.3, 0, 0]}
    >
      <meshBasicMaterial
        ref={matRef}
        color="#44ff88"
        transparent
        opacity={0.15}
        side={THREE.DoubleSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}
