"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";
import { LandmarkMarker } from "./landmark-marker";

interface ChapterTownProps {
  position: [number, number, number];
  chapterName: string | null;
  memberCount: number;
  isSelected?: boolean;
  onClick?: () => void;
}

export function ChapterTown3D({
  position,
  chapterName,
  memberCount,
  isSelected = false,
  onClick,
}: ChapterTownProps) {
  const hasChapter = !!chapterName;
  const buildingCount = hasChapter ? Math.min(2 + Math.floor(memberCount / 10), 4) : 2;
  const ringRef = useRef<THREE.Mesh>(null);
  const smokeRef = useRef<THREE.Group>(null);

  const buildings = [
    { x: -1, z: 0, w: 1, h: 2, d: 1, color: "#3b82f6" },
    { x: 0.8, z: 0.3, w: 1.3, h: 2.8, d: 1.2, color: "#2563eb" },
    { x: 2.2, z: -0.2, w: 0.9, h: 1.6, d: 0.8, color: "#60a5fa" },
    { x: -0.5, z: 1.5, w: 1, h: 1.8, d: 0.9, color: "#3b82f6" },
  ].slice(0, buildingCount);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // Selection ring
    if (ringRef.current) {
      ringRef.current.rotation.y = t * 0.5;
      const targetScale = isSelected ? 1 : 0;
      const s = ringRef.current.scale.x;
      const newScale = s + (targetScale - s) * 0.08;
      ringRef.current.scale.set(newScale, newScale, newScale);
    }

    // Chimney smoke particles rise
    if (smokeRef.current && hasChapter) {
      smokeRef.current.children.forEach((child, i) => {
        const mesh = child as THREE.Mesh;
        mesh.position.y = ((t * 0.3 + i * 0.7) % 2) + 3.2;
        const mat = mesh.material as THREE.MeshBasicMaterial;
        const progress = (mesh.position.y - 3.2) / 2;
        mat.opacity = 0.15 * (1 - progress);
        mesh.scale.setScalar(0.1 + progress * 0.3);
      });
    }
  });

  return (
    <group
      position={position}
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      onPointerOver={() => { document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { document.body.style.cursor = "default"; }}
    >
      {/* Town ground platform */}
      <mesh position={[0.5, 0.05, 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[3.5, 8]} />
        <meshStandardMaterial color="#4a3728" roughness={0.9} />
      </mesh>

      {/* Cobblestone path */}
      <mesh position={[0.5, 0.08, -1.5]}>
        <boxGeometry args={[1, 0.03, 2]} />
        <meshStandardMaterial color="#6b7280" roughness={0.9} />
      </mesh>

      {buildings.map((b, i) => (
        <group key={i} position={[b.x, 0, b.z]}>
          {/* Building body */}
          <mesh position={[0, b.h / 2, 0]}>
            <boxGeometry args={[b.w, b.h, b.d]} />
            <meshStandardMaterial color={b.color} transparent opacity={hasChapter ? 0.9 : 0.5} />
          </mesh>
          {/* Pyramid roof */}
          <mesh position={[0, b.h + 0.3, 0]}>
            <coneGeometry args={[b.w * 0.7, 0.6, 4]} />
            <meshStandardMaterial color="#1d4ed8" transparent opacity={hasChapter ? 0.9 : 0.5} />
          </mesh>
          {/* Front window */}
          <mesh position={[0, b.h * 0.6, b.d / 2 + 0.01]}>
            <boxGeometry args={[0.2, 0.25, 0.02]} />
            <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={hasChapter ? 0.4 : 0} />
          </mesh>
          {/* Door on ground floor */}
          {i < 2 && (
            <mesh position={[0, 0.3, b.d / 2 + 0.01]}>
              <boxGeometry args={[0.25, 0.6, 0.02]} />
              <meshStandardMaterial color="#92400e" />
            </mesh>
          )}
        </group>
      ))}

      {/* Town well in center */}
      {hasChapter && (
        <group position={[0.5, 0, 0.5]}>
          <mesh position={[0, 0.3, 0]}>
            <cylinderGeometry args={[0.3, 0.35, 0.4, 8]} />
            <meshStandardMaterial color="#78716c" />
          </mesh>
          <mesh position={[0, 0.6, 0]}>
            <torusGeometry args={[0.32, 0.03, 6, 12]} />
            <meshStandardMaterial color="#44403c" />
          </mesh>
        </group>
      )}

      {/* Chimney smoke particles */}
      {hasChapter && (
        <group ref={smokeRef} position={[0.8, 0, 0.3]}>
          {Array.from({ length: 3 }).map((_, i) => (
            <mesh key={i} position={[0, 3.5 + i * 0.5, 0]}>
              <sphereGeometry args={[0.1, 6, 6]} />
              <meshBasicMaterial color="#d1d5db" transparent opacity={0.1} depthWrite={false} />
            </mesh>
          ))}
        </group>
      )}

      {/* Street lantern */}
      {hasChapter && (
        <group position={[-1.5, 0, -0.8]}>
          <mesh position={[0, 0.8, 0]}>
            <cylinderGeometry args={[0.03, 0.04, 1.6, 4]} />
            <meshStandardMaterial color="#374151" />
          </mesh>
          <pointLight position={[0, 1.6, 0]} color="#fbbf24" intensity={0.3} distance={4} decay={2} />
          <mesh position={[0, 1.55, 0]}>
            <boxGeometry args={[0.15, 0.2, 0.15]} />
            <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.5} transparent opacity={0.8} />
          </mesh>
        </group>
      )}

      {/* Selection ring */}
      <mesh ref={ringRef} position={[0.5, 0.1, 0.5]} rotation={[-Math.PI / 2, 0, 0]} scale={0}>
        <torusGeometry args={[3.5, 0.06, 8, 32]} />
        <meshStandardMaterial
          color="#3b82f6"
          emissive="#3b82f6"
          emissiveIntensity={0.6}
          transparent
          opacity={0.7}
        />
      </mesh>

      {/* Label */}
      <Billboard position={[0.5, 4.5, 0]}>
        <Text fontSize={0.6} color="#1e40af" fontWeight={700} outlineWidth={0.04} outlineColor="#000">
          {chapterName ?? "Chapter Town"}
        </Text>
        {memberCount > 0 && (
          <Text fontSize={0.4} color="#3b82f6" position={[0, -0.6, 0]} outlineWidth={0.03} outlineColor="#000">
            {memberCount} explorers
          </Text>
        )}
      </Billboard>

      <LandmarkMarker position={[2.5, 4.7, 0]} count={hasChapter ? 0 : 1} color="#3b82f6" />
    </group>
  );
}
