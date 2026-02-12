"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Season } from "../hooks/use-time-of-day";
import type { DeviceTier } from "../hooks/use-device-tier";

// ═══════════════════════════════════════════════════════════════
// Seasonal Particle Effects
// Spring: cherry blossom petals drifting down
// Summer: warm dust motes floating upward
// Fall:   orange/red leaves tumbling
// Winter: snowflakes falling gently
// ═══════════════════════════════════════════════════════════════

interface SeasonalThemeProps {
  season: Season;
  tier: DeviceTier;
}

const SEASON_CONFIG: Record<Season, {
  color: string;
  color2: string;
  count: { LOW: number; MEDIUM: number; HIGH: number };
  size: number;
  speed: number;
  drift: number;
  direction: "down" | "up";
}> = {
  SPRING: {
    color: "#ffb7c5",
    color2: "#ffc0cb",
    count: { LOW: 20, MEDIUM: 60, HIGH: 120 },
    size: 0.3,
    speed: 0.5,
    drift: 1.2,
    direction: "down",
  },
  SUMMER: {
    color: "#ffd700",
    color2: "#ffecb3",
    count: { LOW: 15, MEDIUM: 40, HIGH: 80 },
    size: 0.15,
    speed: 0.2,
    drift: 0.8,
    direction: "up",
  },
  FALL: {
    color: "#e65100",
    color2: "#ff8f00",
    count: { LOW: 20, MEDIUM: 50, HIGH: 100 },
    size: 0.35,
    speed: 0.7,
    drift: 1.5,
    direction: "down",
  },
  WINTER: {
    color: "#e8eaf6",
    color2: "#ffffff",
    count: { LOW: 25, MEDIUM: 80, HIGH: 160 },
    size: 0.2,
    speed: 0.35,
    drift: 0.6,
    direction: "down",
  },
};

export function SeasonalTheme({ season, tier }: SeasonalThemeProps) {
  if (tier === "LOW") return null;

  return <SeasonalParticles season={season} tier={tier} />;
}

function SeasonalParticles({ season, tier }: { season: Season; tier: DeviceTier }) {
  const pointsRef = useRef<THREE.Points>(null);
  const config = SEASON_CONFIG[season];
  const count = config.count[tier];

  // Initial positions & per-particle random data
  const { geometry, randoms } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const rands = new Float32Array(count * 4); // phase, driftScale, speedScale, colorMix

    const c1 = new THREE.Color(config.color);
    const c2 = new THREE.Color(config.color2);

    for (let i = 0; i < count; i++) {
      // Spread across world area
      positions[i * 3] = (Math.random() - 0.5) * 160;
      positions[i * 3 + 1] = Math.random() * 40 + 5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 160;

      const mix = Math.random();
      const col = c1.clone().lerp(c2, mix);
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;

      rands[i * 4] = Math.random() * Math.PI * 2; // phase
      rands[i * 4 + 1] = 0.5 + Math.random(); // drift scale
      rands[i * 4 + 2] = 0.6 + Math.random() * 0.8; // speed scale
      rands[i * 4 + 3] = mix; // color mix (unused for now)
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    return { geometry: geo, randoms: rands };
  }, [count, config.color, config.color2]);

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;
    const t = clock.getElapsedTime();
    const positions = pointsRef.current.geometry.attributes.position.array as Float32Array;
    const particleCount = positions.length / 3;

    for (let i = 0; i < particleCount; i++) {
      const phase = randoms[i * 4];
      const driftScale = randoms[i * 4 + 1];
      const speedScale = randoms[i * 4 + 2];

      // Horizontal drift (wind-like)
      positions[i * 3] += Math.sin(t * 0.5 + phase) * config.drift * driftScale * 0.02;
      positions[i * 3 + 2] += Math.cos(t * 0.3 + phase * 1.3) * config.drift * driftScale * 0.015;

      // Vertical movement
      const vSpeed = config.speed * speedScale * 0.03;
      if (config.direction === "down") {
        positions[i * 3 + 1] -= vSpeed;
        // Reset when below water level
        if (positions[i * 3 + 1] < -1) {
          positions[i * 3 + 1] = 35 + Math.random() * 10;
          positions[i * 3] = (Math.random() - 0.5) * 160;
          positions[i * 3 + 2] = (Math.random() - 0.5) * 160;
        }
      } else {
        positions[i * 3 + 1] += vSpeed;
        // Reset when too high
        if (positions[i * 3 + 1] > 50) {
          positions[i * 3 + 1] = 1 + Math.random() * 5;
          positions[i * 3] = (Math.random() - 0.5) * 160;
          positions[i * 3 + 2] = (Math.random() - 0.5) * 160;
        }
      }
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        size={config.size}
        vertexColors
        transparent
        opacity={0.7}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}
