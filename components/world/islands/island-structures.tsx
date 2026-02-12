"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface StructuresProps {
  structures: string[];
  islandHeight: number;
  accentColor: string;
}

export function IslandStructures({ structures, islandHeight, accentColor }: StructuresProps) {
  const y = islandHeight / 2;

  return (
    <group position={[0, y, 0]}>
      {structures.map((s) => {
        switch (s) {
          case "seed":
            return <Seed key={s} />;
          case "flag":
            return <Flag key={s} color={accentColor} />;
          case "campfire":
            return <Campfire key={s} />;
          case "dock":
            return <Dock key={s} />;
          case "cottage":
            return <Cottage key={s} color={accentColor} />;
          case "boat":
            return <Boat key={s} />;
          case "castle":
            return <Castle key={s} color={accentColor} />;
          case "lighthouse":
            return <Lighthouse key={s} />;
          case "aura":
            return <AuraRing key={s} color={accentColor} />;
          default:
            return null;
        }
      })}
    </group>
  );
}

function Seed() {
  return (
    <mesh position={[0, 0.15, 0]}>
      <sphereGeometry args={[0.2, 6, 5]} />
      <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.3} />
    </mesh>
  );
}

function Flag({ color }: { color: string }) {
  return (
    <group position={[1.5, 0, 0]}>
      <mesh position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 1.8, 4]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
      <mesh position={[0.3, 1.5, 0]}>
        <boxGeometry args={[0.6, 0.35, 0.02]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

function Campfire() {
  return (
    <group position={[-0.8, 0, 0.5]}>
      {/* Logs */}
      <mesh position={[0, 0.06, 0]} rotation={[0, 0.4, Math.PI / 2]}>
        <cylinderGeometry args={[0.06, 0.06, 0.5, 4]} />
        <meshStandardMaterial color="#654321" />
      </mesh>
      <mesh position={[0, 0.06, 0]} rotation={[0, -0.4, Math.PI / 2]}>
        <cylinderGeometry args={[0.06, 0.06, 0.5, 4]} />
        <meshStandardMaterial color="#654321" />
      </mesh>
      {/* Flame glow */}
      <pointLight position={[0, 0.3, 0]} color="#ff6600" intensity={0.8} distance={3} />
      <mesh position={[0, 0.2, 0]}>
        <octahedronGeometry args={[0.15, 0]} />
        <meshStandardMaterial color="#ff4500" emissive="#ff4500" emissiveIntensity={0.8} transparent opacity={0.8} />
      </mesh>
    </group>
  );
}

function Dock() {
  return (
    <group position={[2.5, -0.2, 0]}>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[1.8, 0.1, 0.6]} />
        <meshStandardMaterial color="#deb887" />
      </mesh>
      {/* Posts */}
      <mesh position={[-0.7, -0.3, 0.25]}>
        <cylinderGeometry args={[0.05, 0.05, 0.6, 4]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
      <mesh position={[0.7, -0.3, 0.25]}>
        <cylinderGeometry args={[0.05, 0.05, 0.6, 4]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
    </group>
  );
}

function Cottage({ color }: { color: string }) {
  return (
    <group position={[0, 0, -1]}>
      {/* Walls */}
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[1.2, 1, 1]} />
        <meshStandardMaterial color="#deb887" />
      </mesh>
      {/* Roof */}
      <mesh position={[0, 1.2, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[1, 0.6, 4]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Door */}
      <mesh position={[0, 0.3, 0.51]}>
        <boxGeometry args={[0.3, 0.5, 0.02]} />
        <meshStandardMaterial color="#654321" />
      </mesh>
      {/* Window */}
      <mesh position={[0.35, 0.6, 0.51]}>
        <boxGeometry args={[0.2, 0.2, 0.02]} />
        <meshStandardMaterial color="#87ceeb" emissive="#87ceeb" emissiveIntensity={0.2} />
      </mesh>
    </group>
  );
}

function Boat() {
  return (
    <group position={[3.5, -0.3, 1.5]} rotation={[0, 0.5, 0]}>
      <mesh>
        <boxGeometry args={[0.8, 0.2, 0.35]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
      {/* Mast */}
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.8, 4]} />
        <meshStandardMaterial color="#654321" />
      </mesh>
      {/* Sail */}
      <mesh position={[0.12, 0.5, 0]}>
        <boxGeometry args={[0.35, 0.5, 0.01]} />
        <meshStandardMaterial color="white" transparent opacity={0.9} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function Castle({ color }: { color: string }) {
  return (
    <group position={[0, 0, -0.5]}>
      {/* Main keep */}
      <mesh position={[0, 1, 0]}>
        <boxGeometry args={[1.5, 2, 1.5]} />
        <meshStandardMaterial color="#94a3b8" />
      </mesh>
      {/* Towers */}
      {[[-0.8, 0, -0.8], [0.8, 0, -0.8], [-0.8, 0, 0.8], [0.8, 0, 0.8]].map((pos, i) => (
        <group key={i} position={pos as [number, number, number]}>
          <mesh position={[0, 1.2, 0]}>
            <cylinderGeometry args={[0.3, 0.35, 2.4, 6]} />
            <meshStandardMaterial color="#cbd5e1" />
          </mesh>
          <mesh position={[0, 2.6, 0]}>
            <coneGeometry args={[0.4, 0.5, 6]} />
            <meshStandardMaterial color={color} />
          </mesh>
        </group>
      ))}
      {/* Banner */}
      <mesh position={[0, 2.5, 0.76]}>
        <boxGeometry args={[0.8, 0.5, 0.02]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

function Lighthouse() {
  const beamRef = useRef<THREE.SpotLight>(null);

  useFrame(({ clock }) => {
    if (beamRef.current) {
      const t = clock.getElapsedTime();
      beamRef.current.target.position.set(
        Math.cos(t * 1.0) * 20,
        0,
        Math.sin(t * 1.0) * 20,
      );
      beamRef.current.target.updateMatrixWorld();
    }
  });

  return (
    <group position={[3, 0, -2]}>
      {/* Tower */}
      <mesh position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.3, 0.5, 3, 8]} />
        <meshStandardMaterial color="white" />
      </mesh>
      {/* Red stripe */}
      <mesh position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.32, 0.42, 0.6, 8]} />
        <meshStandardMaterial color="#ef4444" />
      </mesh>
      {/* Lamp housing */}
      <mesh position={[0, 3.2, 0]}>
        <cylinderGeometry args={[0.35, 0.3, 0.5, 8]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      {/* Lamp */}
      <pointLight position={[0, 3.3, 0]} color="#fbbf24" intensity={2} distance={15} />
      {/* Rotating beam */}
      <spotLight
        ref={beamRef}
        position={[0, 3.3, 0]}
        angle={0.15}
        penumbra={0.5}
        intensity={3}
        distance={40}
        color="#fbbf24"
      />
    </group>
  );
}

function AuraRing({ color }: { color: string }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.rotation.z = clock.getElapsedTime() * 0.3;
      const s = 1 + Math.sin(clock.getElapsedTime() * 2) * 0.05;
      meshRef.current.scale.set(s, s, s);
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 0.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[4, 0.08, 8, 32]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} transparent opacity={0.6} />
    </mesh>
  );
}
