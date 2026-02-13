"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";
import { LandmarkMarker } from "./landmark-marker";

interface MentorTowerProps {
  position: [number, number, number];
  mentorName: string | null;
  isSelected?: boolean;
  onClick?: () => void;
}

export function MentorTower3D({
  position,
  mentorName,
  isSelected = false,
  onClick,
}: MentorTowerProps) {
  const hasMentor = !!mentorName;
  const beamRef = useRef<THREE.Mesh>(null);
  const orbRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const windowRefs = useRef<(THREE.MeshStandardMaterial | null)[]>([]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // Guidance beam — spiraling light column when mentor is active
    if (beamRef.current) {
      const targetOpacity = hasMentor ? 0.12 + Math.sin(t * 0.8) * 0.05 : 0;
      const mat = beamRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity += (targetOpacity - mat.opacity) * 0.05;
      beamRef.current.rotation.y = t * 0.3;
    }

    // Floating wisdom orb
    if (orbRef.current) {
      orbRef.current.position.y = 5.5 + Math.sin(t * 1.2) * 0.3;
      orbRef.current.rotation.y = t * 0.8;
      orbRef.current.rotation.x = Math.sin(t * 0.5) * 0.2;
    }

    // Window flicker (candle-like)
    windowRefs.current.forEach((mat, i) => {
      if (!mat || !hasMentor) return;
      const flicker = 0.6 + Math.sin(t * 3 + i * 1.7) * 0.15 + Math.sin(t * 7.3 + i * 2.1) * 0.05;
      mat.emissiveIntensity = flicker;
    });

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
      {/* Stone foundation */}
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[1.2, 1.4, 0.3, 8]} />
        <meshStandardMaterial color="#4a3728" roughness={0.9} />
      </mesh>

      {/* Tower body — tapered cylinder */}
      <mesh position={[0, 2, 0]}>
        <cylinderGeometry args={[0.6, 0.8, 4, 8]} />
        <meshStandardMaterial color="#7c3aed" transparent opacity={0.9} />
      </mesh>

      {/* Stone band detail */}
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.82, 0.82, 0.15, 8]} />
        <meshStandardMaterial color="#5b21b6" />
      </mesh>
      <mesh position={[0, 3, 0]}>
        <cylinderGeometry args={[0.62, 0.62, 0.1, 8]} />
        <meshStandardMaterial color="#5b21b6" />
      </mesh>

      {/* Cone roof */}
      <mesh position={[0, 4.3, 0]}>
        <coneGeometry args={[1, 1.2, 8]} />
        <meshStandardMaterial color="#5b21b6" />
      </mesh>

      {/* Windows with candle glow */}
      {[
        { y: 2.5, z: 0.65 },
        { y: 1.5, z: 0.65 },
        { y: 2.0, z: -0.65 },
      ].map((w, i) => (
        <mesh key={i} position={[0, w.y, w.z]}>
          <boxGeometry args={[0.3, 0.4, 0.05]} />
          <meshStandardMaterial
            ref={(ref) => { windowRefs.current[i] = ref; }}
            color={hasMentor ? "#fbbf24" : "#1e1b4b"}
            emissive={hasMentor ? "#fbbf24" : "#000000"}
            emissiveIntensity={hasMentor ? 0.8 : 0}
          />
        </mesh>
      ))}

      {/* Floating wisdom orb on top */}
      <mesh ref={orbRef} position={[0, 5.5, 0]}>
        <octahedronGeometry args={[0.25, 1]} />
        <meshStandardMaterial
          color="#c084fc"
          emissive="#a855f7"
          emissiveIntensity={hasMentor ? 1.2 : 0.2}
          roughness={0.1}
          metalness={0.5}
          transparent
          opacity={0.9}
        />
      </mesh>
      <pointLight
        position={[0, 5.5, 0]}
        color="#a855f7"
        intensity={hasMentor ? 1.2 : 0.1}
        distance={10}
        decay={2}
      />

      {/* Guidance beam — vertical light column when mentor is connected */}
      <mesh ref={beamRef} position={[0, 12, 0]}>
        <cylinderGeometry args={[0.3, 0.8, 16, 8, 1, true]} />
        <meshBasicMaterial
          color="#a855f7"
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Spiral runes around tower base when mentor is connected */}
      {hasMentor && (
        <>
          {Array.from({ length: 6 }).map((_, i) => {
            const angle = (i / 6) * Math.PI * 2;
            const rx = Math.cos(angle) * 1.0;
            const rz = Math.sin(angle) * 1.0;
            return (
              <mesh key={`rune-${i}`} position={[rx, 0.35, rz]} rotation={[0, -angle, 0]}>
                <boxGeometry args={[0.15, 0.15, 0.02]} />
                <meshStandardMaterial
                  color="#c084fc"
                  emissive="#c084fc"
                  emissiveIntensity={0.5}
                  transparent
                  opacity={0.6}
                />
              </mesh>
            );
          })}
        </>
      )}

      {/* Selection ring */}
      <mesh ref={ringRef} position={[0, 0.15, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={0}>
        <torusGeometry args={[2, 0.06, 8, 32]} />
        <meshStandardMaterial
          color="#7c3aed"
          emissive="#7c3aed"
          emissiveIntensity={0.6}
          transparent
          opacity={0.7}
        />
      </mesh>

      {/* Flag on top */}
      <mesh position={[0, 5.2, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.6, 4]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>

      {/* Label */}
      <Billboard position={[0, 6.2, 0]}>
        <Text fontSize={0.6} color="#7c3aed" fontWeight={700} outlineWidth={0.04} outlineColor="#000">
          Mentor Tower
        </Text>
        {mentorName && (
          <Text fontSize={0.4} color="#a78bfa" position={[0, -0.6, 0]} outlineWidth={0.03} outlineColor="#000">
            {mentorName}
          </Text>
        )}
      </Billboard>

      <LandmarkMarker position={[1, 6.4, 0]} count={hasMentor ? 0 : 1} color="#7c3aed" />
    </group>
  );
}
