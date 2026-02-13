"use client";

import { useMemo, useCallback } from "react";
import type { PassionIsland } from "@/lib/world-actions";
import { getTheme } from "../constants";
import styles from "../passion-world.module.css";

// ═══════════════════════════════════════════════════════════════
// Minimap — Bird's-eye inset showing islands, landmarks, viewport
// ═══════════════════════════════════════════════════════════════

interface MinimapProps {
  islands: PassionIsland[];
  positions: { x: number; y: number; z: number }[];
  landmarkPositions: Record<string, [number, number, number]>;
  cameraTarget?: { x: number; z: number };
  onClickIsland?: (island: PassionIsland) => void;
  onClickPosition?: (worldX: number, worldZ: number) => void;
  selectedId?: string | null;
}

// World coordinate range (our 3D layout goes roughly from -70 to 70)
const WORLD_MIN = -80;
const WORLD_MAX = 80;
const WORLD_SIZE = WORLD_MAX - WORLD_MIN;

// Minimap size in pixels
const MAP_W = 140;
const MAP_H = 100;

function worldToMinimap(wx: number, wz: number): { mx: number; my: number } {
  return {
    mx: ((wx - WORLD_MIN) / WORLD_SIZE) * MAP_W,
    my: ((wz - WORLD_MIN) / WORLD_SIZE) * MAP_H,
  };
}

function minimapToWorld(mx: number, my: number): { wx: number; wz: number } {
  return {
    wx: (mx / MAP_W) * WORLD_SIZE + WORLD_MIN,
    wz: (my / MAP_H) * WORLD_SIZE + WORLD_MIN,
  };
}

const LANDMARK_ICONS: Record<string, string> = {
  questBoard: "\u{1F4DC}",
  mentorTower: "\u{1F3F0}",
  shrine: "\u2B50",
  chapterTown: "\u{1F3D8}\uFE0F",
  events: "\u{1F3AA}",
};

export function Minimap({
  islands,
  positions,
  landmarkPositions,
  cameraTarget,
  onClickIsland,
  onClickPosition,
  selectedId,
}: MinimapProps) {
  // Pre-calculate island dots
  const dots = useMemo(() => {
    return islands.map((island, i) => {
      const pos = positions[i];
      if (!pos) return null;
      const { mx, my } = worldToMinimap(pos.x, pos.z);
      const theme = getTheme(island.category);
      return {
        island,
        mx,
        my,
        color: theme.gradient[0],
        isPrimary: island.isPrimary,
      };
    }).filter(Boolean) as { island: PassionIsland; mx: number; my: number; color: string; isPrimary: boolean }[];
  }, [islands, positions]);

  // Landmark dots
  const landmarkDots = useMemo(() => {
    return Object.entries(landmarkPositions).map(([key, pos]) => {
      const { mx, my } = worldToMinimap(pos[0], pos[2]);
      return { key, mx, my, icon: LANDMARK_ICONS[key] || "?" };
    });
  }, [landmarkPositions]);

  // Camera viewport indicator
  const viewportIndicator = useMemo(() => {
    if (!cameraTarget) return null;
    const { mx, my } = worldToMinimap(cameraTarget.x, cameraTarget.z);
    return { mx, my };
  }, [cameraTarget]);

  // Click on minimap background to jump camera
  const handleMinimapClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const { wx, wz } = minimapToWorld(mx, my);
      onClickPosition?.(wx, wz);
    },
    [onClickPosition],
  );

  return (
    <div className={styles.minimap} title="Minimap — Click to jump">
      <div className={styles.minimapLabel}>Minimap</div>
      <div
        className={styles.minimapCanvas}
        style={{ width: MAP_W, height: MAP_H }}
        onClick={handleMinimapClick}
      >
        {/* Water grid lines */}
        <svg
          className={styles.minimapGrid}
          width={MAP_W}
          height={MAP_H}
          viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        >
          {/* Grid */}
          {[0.25, 0.5, 0.75].map((frac) => (
            <g key={frac} opacity={0.15}>
              <line x1={frac * MAP_W} y1={0} x2={frac * MAP_W} y2={MAP_H} stroke="white" strokeWidth={0.5} />
              <line x1={0} y1={frac * MAP_H} x2={MAP_W} y2={frac * MAP_H} stroke="white" strokeWidth={0.5} />
            </g>
          ))}
        </svg>

        {/* Landmark icons */}
        {landmarkDots.map((lm) => (
          <div
            key={lm.key}
            className={styles.minimapLandmark}
            style={{ left: lm.mx, top: lm.my }}
            title={lm.key.replace(/([A-Z])/g, " $1").trim()}
          >
            {lm.icon}
          </div>
        ))}

        {/* Island dots */}
        {dots.map((d) => (
          <button
            key={d.island.id}
            className={`${styles.minimapDot} ${selectedId === d.island.id ? styles.minimapDotSelected : ""} ${d.isPrimary ? styles.minimapDotPrimary : ""}`}
            style={{
              left: d.mx,
              top: d.my,
              background: d.color,
              boxShadow: selectedId === d.island.id ? `0 0 6px 2px ${d.color}` : undefined,
            }}
            title={d.island.name}
            onClick={(e) => {
              e.stopPropagation();
              onClickIsland?.(d.island);
            }}
          />
        ))}

        {/* Camera viewport indicator */}
        {viewportIndicator && (
          <div
            className={styles.minimapViewport}
            style={{
              left: viewportIndicator.mx - 12,
              top: viewportIndicator.my - 8,
            }}
          />
        )}
      </div>
    </div>
  );
}
