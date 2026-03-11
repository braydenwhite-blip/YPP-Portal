"use client";

import { useCallback } from "react";
import type { PassionIsland } from "@/lib/world-actions";
import { getTheme } from "./constants";
import styles from "./passion-world.module.css";

const WORLD_W = 1200;
const WORLD_H = 800;
const MM_W = 160;
const MM_H = 100;
const SX = MM_W / WORLD_W;
const SY = MM_H / WORLD_H;

interface MinimapProps {
  islands: PassionIsland[];
  positions: { x: number; y: number }[];
  offset: { x: number; y: number };
  scale: number;
  onNavigate: (newOffset: { x: number; y: number }) => void;
}

export function Minimap({ islands, positions, offset, scale, onNavigate }: MinimapProps) {
  // Viewport rectangle in minimap coordinates
  const vpX = (-offset.x) * SX;
  const vpY = (-offset.y) * SY;
  const vpW = (WORLD_W / scale) * SX;
  const vpH = (WORLD_H / scale) * SY;

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      // Map click → world center → new offset
      const worldX = (mx / MM_W) * WORLD_W;
      const worldY = (my / MM_H) * WORLD_H;
      onNavigate({
        x: WORLD_W / (2 * scale) - worldX,
        y: WORLD_H / (2 * scale) - worldY,
      });
    },
    [scale, onNavigate],
  );

  return (
    <div
      className={styles.minimap}
      onClick={handleClick}
      title="Click to navigate"
      role="img"
      aria-label="World minimap"
    >
      <svg
        width={MM_W}
        height={MM_H}
        viewBox={`0 0 ${MM_W} ${MM_H}`}
        style={{ display: "block" }}
      >
        {/* Ocean background */}
        <rect width={MM_W} height={MM_H} fill="#0c4a6e" rx="4" />

        {/* Island dots */}
        {islands.map((island, i) => {
          const pos = positions[i];
          if (!pos) return null;
          const theme = getTheme(island.category);
          return (
            <circle
              key={island.id}
              cx={pos.x * SX}
              cy={pos.y * SY}
              r={island.isPrimary ? 3.5 : 2}
              fill={theme.gradient[0]}
              opacity={0.9}
            />
          );
        })}

        {/* Viewport indicator */}
        <rect
          x={vpX}
          y={vpY}
          width={Math.min(MM_W, vpW)}
          height={Math.min(MM_H, vpH)}
          fill="rgba(255,255,255,0.08)"
          stroke="rgba(255,255,255,0.5)"
          strokeWidth="1"
          rx="2"
          style={{ pointerEvents: "none" }}
        />
      </svg>
      <div className={styles.minimapLabel}>Map</div>
    </div>
  );
}
