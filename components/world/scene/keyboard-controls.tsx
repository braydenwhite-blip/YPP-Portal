"use client";

import { useEffect, useCallback } from "react";
import { useThree } from "@react-three/fiber";
import type { PassionIsland } from "@/lib/world-actions";

interface KeyboardControlsProps {
  islands: PassionIsland[];
  positions: { x: number; y: number; z: number }[];
  selectedId: string | null;
  onSelectIsland: (island: PassionIsland, pos: [number, number, number]) => void;
  onDeselect: () => void;
}

/**
 * Keyboard navigation for the 3D world.
 * - Tab: cycle through islands
 * - Enter: focus on current island
 * - Escape: deselect / return to overview
 * - +/-: zoom in/out
 */
export function KeyboardControls({
  islands,
  positions,
  selectedId,
  onSelectIsland,
  onDeselect,
}: KeyboardControlsProps) {
  const { camera, controls } = useThree();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Tab: cycle islands
      if (e.key === "Tab" && islands.length > 0) {
        e.preventDefault();
        const currentIdx = selectedId
          ? islands.findIndex((isl) => isl.id === selectedId)
          : -1;
        const nextIdx = (currentIdx + (e.shiftKey ? -1 : 1) + islands.length) % islands.length;
        const island = islands[nextIdx];
        const pos = positions[nextIdx];
        if (island && pos) {
          onSelectIsland(island, [pos.x, pos.y, pos.z]);
        }
        return;
      }

      // Enter: focus on selected
      if (e.key === "Enter" && selectedId) {
        const idx = islands.findIndex((isl) => isl.id === selectedId);
        if (idx !== -1) {
          const pos = positions[idx];
          onSelectIsland(islands[idx], [pos.x, pos.y, pos.z]);
        }
        return;
      }

      // Escape: deselect
      if (e.key === "Escape") {
        onDeselect();
        return;
      }

      // +/- zoom
      if (e.key === "=" || e.key === "+") {
        camera.position.multiplyScalar(0.9);
        if (controls && "update" in controls) {
          (controls as unknown as { update: () => void }).update();
        }
        return;
      }
      if (e.key === "-" || e.key === "_") {
        camera.position.multiplyScalar(1.1);
        if (controls && "update" in controls) {
          (controls as unknown as { update: () => void }).update();
        }
        return;
      }
    },
    [camera, controls, islands, positions, selectedId, onSelectIsland, onDeselect],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return null; // Pure logic component
}
