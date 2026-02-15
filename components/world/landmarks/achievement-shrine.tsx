"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { LandmarkMarker } from "./landmark-marker";
import { Label3D } from "../scene/label-3d";

interface AchievementShrineProps {
  position: [number, number, number];
  badgeCount: number;
  certCount: number;
  isSelected?: boolean;
  onClick?: () => void;
}

export function AchievementShrine3D({
  position,
  badgeCount,
  certCount,
  isSelected = false,
  onClick,
}: AchievementShrineProps) {
  const starRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const auraRef = useRef<THREE.Mesh>(null);
  const total = badgeCount + certCount;
  const glowIntensity = Math.min(total * 0.15, 1.5);

  const gemColors = useMemo(
    () => ["#ef4444", "#3b82f6", "#22c55e", "#a855f7", "#f59e0b", "#ec4899", "#14b8a6", "#f97316"],
    [],
  );

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // Rotating star
    if (starRef.current) {
      starRef.current.rotation.y = t * 0.8;
      starRef.current.position.y = 3.5 + Math.sin(t * 1.5) * 0.15;
    }

    // Aura pulse when there are achievements
    if (auraRef.current) {
      const targetScale = total > 0 ? 1 + Math.sin(t * 0.8) * 0.15 : 0;
      const s = auraRef.current.scale.x;
      auraRef.current.scale.setScalar(s + (targetScale - s) * 0.05);
      const mat = auraRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = total > 0 ? 0.06 + Math.sin(t * 1.2) * 0.03 : 0;
    }

    // Selection ring
    if (ringRef.current) {
      ringRef.current.rotation.y = t * 0.5;
      const targetScale = isSelected ? 1 : 0;
      const s = ringRef.current.scale.x;
      const newScale = s + (targetScale - s) * 0.08;
      ringRef.current.scale.set(newScale, newScale, newScale);
    }
  });

  return (
    <group
      position={position}
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      onPointerOver={() => { document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { document.body.style.cursor = "default"; }}
    >
      {/* Ground circle */}
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2.5, 16]} />
        <meshStandardMaterial color="#b45309" roughness={0.9} />
      </mesh>

      {/* Base platform — stepped */}
      <mesh position={[0, 0.15, 0]}>
        <boxGeometry args={[3.2, 0.3, 2.7]} />
        <meshStandardMaterial color="#d97706" roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[2.8, 0.2, 2.3]} />
        <meshStandardMaterial color="#fbbf24" roughness={0.3} metalness={0.4} />
      </mesh>

      {/* Pyramid roof */}
      <mesh position={[0, 2.5, 0]}>
        <coneGeometry args={[1.8, 1.5, 4]} />
        <meshStandardMaterial color="#f59e0b" roughness={0.3} metalness={0.3} />
      </mesh>

      {/* Pillars with capitals */}
      {[[-1.1, 0, -0.8], [1.1, 0, -0.8], [-1.1, 0, 0.8], [1.1, 0, 0.8]].map((pos, i) => (
        <group key={i} position={[pos[0], 0, pos[2]]}>
          <mesh position={[0, 1.3, 0]}>
            <cylinderGeometry args={[0.12, 0.15, 2, 6]} />
            <meshStandardMaterial color="#d97706" />
          </mesh>
          {/* Capital */}
          <mesh position={[0, 2.3, 0]}>
            <boxGeometry args={[0.35, 0.1, 0.35]} />
            <meshStandardMaterial color="#fbbf24" metalness={0.5} />
          </mesh>
        </group>
      ))}

      {/* Rotating star on top */}
      <mesh ref={starRef} position={[0, 3.5, 0]}>
        <octahedronGeometry args={[0.4, 0]} />
        <meshStandardMaterial
          color="#fbbf24"
          emissive="#fbbf24"
          emissiveIntensity={glowIntensity}
          roughness={0.1}
          metalness={0.8}
        />
      </mesh>
      <pointLight position={[0, 3.5, 0]} color="#fbbf24" intensity={glowIntensity} distance={12} />

      {/* Achievement aura — large transparent sphere */}
      <mesh ref={auraRef} position={[0, 1.5, 0]} scale={0}>
        <sphereGeometry args={[3, 16, 16]} />
        <meshBasicMaterial
          color="#fbbf24"
          transparent
          opacity={0}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      {/* Gem spheres around base — orbit slowly */}
      {Array.from({ length: Math.min(badgeCount, 8) }).map((_, i) => {
        const angle = (i / Math.min(badgeCount, 8)) * Math.PI * 2;
        const gemX = Math.cos(angle) * 1.8;
        const gemZ = Math.sin(angle) * 1.8;
        return (
          <mesh key={i} position={[gemX, 0.9, gemZ]}>
            <sphereGeometry args={[0.15, 6, 6]} />
            <meshStandardMaterial
              color={gemColors[i % gemColors.length]}
              emissive={gemColors[i % gemColors.length]}
              emissiveIntensity={0.4}
              roughness={0.1}
              metalness={0.6}
            />
          </mesh>
        );
      })}

      {/* Certificate pedestals — small golden blocks */}
      {Array.from({ length: Math.min(certCount, 4) }).map((_, i) => {
        const cx = (i - 1.5) * 0.6;
        return (
          <group key={`cert-${i}`} position={[cx, 0.6, -1.0]}>
            <mesh>
              <boxGeometry args={[0.25, 0.15, 0.03]} />
              <meshStandardMaterial color="#fef3c7" emissive="#fbbf24" emissiveIntensity={0.2} />
            </mesh>
          </group>
        );
      })}

      {/* Selection ring */}
      <mesh ref={ringRef} position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={0}>
        <torusGeometry args={[3, 0.06, 8, 32]} />
        <meshStandardMaterial
          color="#f59e0b"
          emissive="#f59e0b"
          emissiveIntensity={0.6}
          transparent
          opacity={0.7}
        />
      </mesh>

      {/* Label */}
      <Label3D position={[0, 4.5, 0]} color="#92400e" fontSize={14} bold outline>
        Shrine
        {total > 0 && (
          <><br /><span style={{ fontSize: "10px", color: "#d97706" }}>{badgeCount} badges · {certCount} certs</span></>
        )}
      </Label3D>

      <LandmarkMarker position={[1.5, 4.7, 0]} count={total} color="#f59e0b" />
    </group>
  );
}
