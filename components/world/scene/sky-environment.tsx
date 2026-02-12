"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Sky } from "@react-three/drei";
import * as THREE from "three";
import type { TimeOfDayData } from "../hooks/use-time-of-day";
import type { DeviceTier } from "../hooks/use-device-tier";

// ═══════════════════════════════════════════════════════════════
// Dynamic Sky + Day/Night Cycle
// ═══════════════════════════════════════════════════════════════

interface SkyEnvironmentProps {
  timeData?: TimeOfDayData;
  tier?: DeviceTier;
}

export function SkyEnvironment({ timeData, tier = "MEDIUM" }: SkyEnvironmentProps) {
  // Fallback values when timeData not provided (backwards compatible)
  const sun = timeData?.sunPosition ?? [100, 60, 100] as [number, number, number];
  const ambientInt = timeData?.ambientIntensity ?? 0.6;
  const ambientCol = timeData?.ambientColor ?? "#ffffff";
  const dirInt = timeData?.directionalIntensity ?? 1.2;
  const dirCol = timeData?.directionalColor ?? "#fff5e0";
  const hemiSky = timeData?.hemiSkyColor ?? "#87ceeb";
  const hemiGround = timeData?.hemiGroundColor ?? "#3a6b35";
  const hemiInt = timeData?.hemiIntensity ?? 0.3;
  const turbidity = timeData?.turbidity ?? 8;
  const rayleigh = timeData?.rayleigh ?? 2;
  const fogColor = timeData?.fogColor ?? "#c8dff5";
  const fogNear = timeData?.fogNear ?? 150;
  const fogFar = timeData?.fogFar ?? 500;
  const starsOpacity = timeData?.starsOpacity ?? 0;

  return (
    <>
      {/* Sky dome */}
      <Sky
        distance={450000}
        sunPosition={sun}
        turbidity={turbidity}
        rayleigh={rayleigh}
        mieCoefficient={0.005}
        mieDirectionalG={0.8}
      />

      {/* Stars visible at night */}
      {starsOpacity > 0.01 && tier !== "LOW" && (
        <Starfield opacity={starsOpacity} />
      )}

      {/* Moon visible at night */}
      {starsOpacity > 0.3 && (
        <Moon opacity={starsOpacity} sunPosition={sun} />
      )}

      {/* Scene fog for depth */}
      <fog attach="fog" args={[fogColor, fogNear, fogFar]} />

      {/* Lighting */}
      <ambientLight intensity={ambientInt} color={ambientCol} />
      <directionalLight
        position={sun}
        intensity={dirInt}
        color={dirCol}
        castShadow={false}
      />
      <hemisphereLight
        args={[hemiSky, hemiGround, hemiInt]}
      />
    </>
  );
}

// ─── Starfield ──────────────────────────────────────────────

function Starfield({ opacity }: { opacity: number }) {
  const pointsRef = useRef<THREE.Points>(null);

  const starGeo = useMemo(() => {
    const count = 800;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Random points on a large hemisphere above the scene
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random()); // bias toward zenith
      const r = 300 + Math.random() * 100;

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi); // always positive = above horizon
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      sizes[i] = 0.5 + Math.random() * 1.5;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("size", new THREE.Float32BufferAttribute(sizes, 1));
    return geo;
  }, []);

  // Gentle twinkle
  useFrame(({ clock }) => {
    if (!pointsRef.current) return;
    const mat = pointsRef.current.material as THREE.PointsMaterial;
    const twinkle = 0.85 + Math.sin(clock.getElapsedTime() * 0.5) * 0.15;
    mat.opacity = opacity * twinkle;
  });

  return (
    <points ref={pointsRef} geometry={starGeo}>
      <pointsMaterial
        color="#ffffff"
        size={1.2}
        sizeAttenuation
        transparent
        opacity={opacity}
        depthWrite={false}
      />
    </points>
  );
}

// ─── Moon ───────────────────────────────────────────────────

function Moon({ opacity, sunPosition }: { opacity: number; sunPosition: [number, number, number] }) {
  const meshRef = useRef<THREE.Mesh>(null);

  // Moon is opposite the sun
  const moonPos = useMemo<[number, number, number]>(() => {
    return [
      -sunPosition[0] * 0.8,
      Math.max(sunPosition[1] > 0 ? 60 : 120, Math.abs(sunPosition[1]) * 0.6),
      -sunPosition[2] * 0.8,
    ];
  }, [sunPosition]);

  // Slow rotation for visual interest
  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.y = clock.getElapsedTime() * 0.02;
  });

  return (
    <group position={moonPos}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[8, 16, 16]} />
        <meshStandardMaterial
          color="#f0e6d2"
          emissive="#f0e6d2"
          emissiveIntensity={0.4 * opacity}
          transparent
          opacity={opacity}
        />
      </mesh>
      {/* Moon glow */}
      <pointLight
        color="#c8d8f0"
        intensity={0.3 * opacity}
        distance={200}
        decay={2}
      />
    </group>
  );
}
