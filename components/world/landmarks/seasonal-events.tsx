"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { LandmarkMarker } from "./landmark-marker";
import { Label3D } from "../scene/label-3d";

interface SeasonalEventsProps {
  position: [number, number, number];
  count: number;
  isSelected?: boolean;
  onClick?: () => void;
}

export function SeasonalEvents3D({
  position,
  count,
  isSelected = false,
  onClick,
}: SeasonalEventsProps) {
  const active = count > 0;
  const ringRef = useRef<THREE.Mesh>(null);
  const flagRef = useRef<THREE.Mesh>(null);
  const buntingRef = useRef<THREE.Group>(null);

  // Season color based on current month
  const month = new Date().getMonth();
  const seasonColor = month < 3 ? "#60a5fa" : month < 6 ? "#22c55e" : month < 9 ? "#f59e0b" : "#ef4444";

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

    // Flag wave
    if (flagRef.current && active) {
      flagRef.current.rotation.z = Math.sin(t * 3) * 0.15;
    }

    // Bunting sway
    if (buntingRef.current && active) {
      buntingRef.current.children.forEach((child, i) => {
        child.position.y = 0.3 + Math.sin(t * 2 + i * 0.9) * 0.08;
        child.rotation.z = Math.sin(t * 1.5 + i * 1.2) * 0.1;
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
      {/* Ground platform */}
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2.5, 8]} />
        <meshStandardMaterial color="#5c4033" roughness={0.9} />
      </mesh>

      {/* Main tent */}
      <mesh position={[0, 1.2, 0]}>
        <coneGeometry args={[2, 2.4, 6]} />
        <meshStandardMaterial
          color={seasonColor}
          transparent
          opacity={active ? 0.85 : 0.4}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Tent stripes */}
      <mesh position={[0, 1.25, 0.01]}>
        <coneGeometry args={[1.95, 2.3, 6]} />
        <meshStandardMaterial
          color="white"
          transparent
          opacity={active ? 0.12 : 0.04}
          side={THREE.FrontSide}
        />
      </mesh>

      {/* Center pole */}
      <mesh position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 3, 4]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>

      {/* Flag on top — animated */}
      <mesh ref={flagRef} position={[0.25, 3.0, 0]}>
        <boxGeometry args={[0.5, 0.3, 0.02]} />
        <meshStandardMaterial color={active ? "#ef4444" : "#94a3b8"} />
      </mesh>

      {/* Entrance opening */}
      <mesh position={[0, 0.35, 1.5]}>
        <boxGeometry args={[0.8, 0.7, 0.02]} />
        <meshStandardMaterial color={seasonColor} transparent opacity={active ? 0.5 : 0.2} />
      </mesh>

      {/* Bunting lines if active */}
      {active && (
        <group ref={buntingRef}>
          {[0, 1.2, 2.4, 3.6, 4.8].map((angle, i) => {
            const rad = (angle / 5) * Math.PI * 2;
            const x = Math.cos(rad) * 1.6;
            const z = Math.sin(rad) * 1.6;
            const colors = ["#ef4444", "#fbbf24", "#22c55e", "#3b82f6", "#a855f7"];
            return (
              <group key={i} position={[x, 0.3, z]}>
                <mesh>
                  <boxGeometry args={[0.3, 0.2, 0.02]} />
                  <meshStandardMaterial color={colors[i]} />
                </mesh>
                {/* String connecting to pole */}
                <mesh position={[-x * 0.3, 0.5, -z * 0.3]} rotation={[0, 0, Math.atan2(1, Math.sqrt(x * x + z * z))]}>
                  <cylinderGeometry args={[0.01, 0.01, 1.2, 3]} />
                  <meshStandardMaterial color="#8B4513" transparent opacity={0.4} />
                </mesh>
              </group>
            );
          })}
        </group>
      )}

      {/* Warm glow inside tent */}
      {active && (
        <pointLight position={[0, 0.5, 0]} color="#fbbf24" intensity={0.4} distance={3} decay={2} />
      )}

      {/* Selection ring */}
      <mesh ref={ringRef} position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={0}>
        <torusGeometry args={[2.8, 0.06, 8, 32]} />
        <meshStandardMaterial
          color={seasonColor}
          emissive={seasonColor}
          emissiveIntensity={0.6}
          transparent
          opacity={0.7}
        />
      </mesh>

      {/* Label */}
      <Label3D position={[0, 3.8, 0]} color="#b91c1c" fontSize={14} bold outline>
        Events
      </Label3D>

      <LandmarkMarker position={[1.5, 4, 0]} count={count} color="#16a34a" />
    </group>
  );
}
