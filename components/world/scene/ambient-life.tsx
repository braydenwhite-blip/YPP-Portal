"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { DeviceTier } from "../hooks/use-device-tier";

interface AmbientLifeProps {
  tier: DeviceTier;
}

export function AmbientLife({ tier }: AmbientLifeProps) {
  return (
    <group>
      <SailingBoats count={tier === "LOW" ? 1 : 3} />
      <Seabirds count={tier === "LOW" ? 2 : 5} />
      {tier !== "LOW" && <JumpingFish />}
    </group>
  );
}

// ─── Sailing Boats ──────────────────────────────────────────

function SailingBoats({ count }: { count: number }) {
  const boats = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      orbitRadius: 35 + i * 18,
      speed: 0.08 + i * 0.03,
      offset: (i / count) * Math.PI * 2,
      y: -0.15,
    }));
  }, [count]);

  return (
    <group>
      {boats.map((boat, i) => (
        <SailingBoat key={i} {...boat} />
      ))}
    </group>
  );
}

function SailingBoat({
  orbitRadius,
  speed,
  offset,
  y,
}: {
  orbitRadius: number;
  speed: number;
  offset: number;
  y: number;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime() * speed + offset;
    const x = Math.cos(t) * orbitRadius;
    const z = Math.sin(t) * orbitRadius;
    groupRef.current.position.set(x, y + Math.sin(t * 3) * 0.1, z);
    // Face direction of travel
    groupRef.current.rotation.y = -t + Math.PI / 2;
  });

  return (
    <group ref={groupRef}>
      {/* Hull */}
      <mesh>
        <boxGeometry args={[1.2, 0.25, 0.45]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
      {/* Mast */}
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 1, 4]} />
        <meshStandardMaterial color="#654321" />
      </mesh>
      {/* Sail */}
      <mesh position={[0.15, 0.6, 0]} rotation={[0, 0.3, 0]}>
        <planeGeometry args={[0.5, 0.7]} />
        <meshStandardMaterial color="white" side={THREE.DoubleSide} transparent opacity={0.9} />
      </mesh>
    </group>
  );
}

// ─── Seabirds ───────────────────────────────────────────────

function Seabirds({ count }: { count: number }) {
  const birds = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      loopRadius: 60 + (i % 3) * 10,
      height: 25 + i * 3,
      speed: 0.15 + (i % 2) * 0.05,
      offset: (i / count) * Math.PI * 2,
      // V-formation offset
      vOffsetX: (i - Math.floor(count / 2)) * 1.5,
      vOffsetZ: Math.abs(i - Math.floor(count / 2)) * 1.2,
    }));
  }, [count]);

  return (
    <group>
      {birds.map((bird, i) => (
        <Seabird key={i} {...bird} />
      ))}
    </group>
  );
}

function Seabird({
  loopRadius,
  height,
  speed,
  offset,
  vOffsetX,
  vOffsetZ,
}: {
  loopRadius: number;
  height: number;
  speed: number;
  offset: number;
  vOffsetX: number;
  vOffsetZ: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const wingLRef = useRef<THREE.Mesh>(null);
  const wingRRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime() * speed + offset;
    const baseX = Math.cos(t) * loopRadius;
    const baseZ = Math.sin(t) * loopRadius;
    groupRef.current.position.set(
      baseX + vOffsetX,
      height + Math.sin(t * 2) * 0.5,
      baseZ + vOffsetZ,
    );
    groupRef.current.rotation.y = -t + Math.PI / 2;

    // Wing flap
    const flapAngle = Math.sin(clock.getElapsedTime() * 8) * 0.4;
    if (wingLRef.current) wingLRef.current.rotation.z = flapAngle;
    if (wingRRef.current) wingRRef.current.rotation.z = -flapAngle;
  });

  return (
    <group ref={groupRef}>
      {/* Body */}
      <mesh>
        <boxGeometry args={[0.3, 0.08, 0.1]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      {/* Left wing */}
      <mesh ref={wingLRef} position={[0, 0, 0.2]}>
        <boxGeometry args={[0.25, 0.02, 0.35]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
      {/* Right wing */}
      <mesh ref={wingRRef} position={[0, 0, -0.2]}>
        <boxGeometry args={[0.25, 0.02, 0.35]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
    </group>
  );
}

// ─── Jumping Fish ───────────────────────────────────────────

function JumpingFish() {
  const fishRef = useRef<THREE.Mesh>(null);
  const state = useRef({
    active: false,
    startTime: 0,
    x: 0,
    z: 0,
    nextJump: 3 + Math.random() * 5,
    elapsed: 0,
  });

  useFrame(({ clock }) => {
    const s = state.current;
    s.elapsed = clock.getElapsedTime();

    if (!s.active) {
      if (s.elapsed > s.nextJump) {
        // Start a new jump
        s.active = true;
        s.startTime = s.elapsed;
        s.x = (Math.random() - 0.5) * 80;
        s.z = (Math.random() - 0.5) * 80;
      }
      if (fishRef.current) fishRef.current.visible = false;
      return;
    }

    const jumpDuration = 1.2;
    const t = (s.elapsed - s.startTime) / jumpDuration;

    if (t > 1) {
      s.active = false;
      s.nextJump = s.elapsed + 5 + Math.random() * 8;
      if (fishRef.current) fishRef.current.visible = false;
      return;
    }

    // Parabolic arc
    const y = -4 * (t - 0.5) ** 2 + 1; // peaks at 1 when t=0.5
    const height = y * 2.5;

    if (fishRef.current) {
      fishRef.current.visible = height > 0;
      fishRef.current.position.set(s.x, Math.max(0, height), s.z);
      fishRef.current.rotation.x = -Math.PI * t; // flip as it arcs
    }
  });

  return (
    <mesh ref={fishRef} visible={false}>
      <sphereGeometry args={[0.2, 5, 4]} />
      <meshStandardMaterial color="#94a3b8" metalness={0.3} roughness={0.5} />
    </mesh>
  );
}
