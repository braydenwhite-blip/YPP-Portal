"use client";

import { useMemo, useState, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import { Ocean } from "./ocean";
import { SkyEnvironment } from "./sky-environment";
import { CameraController } from "./camera-controller";
import type { DeviceTier } from "../hooks/use-device-tier";
import type { WorldData, PassionIsland } from "@/lib/world-actions";
import { getIslandPositions3D } from "../islands/island-layout";
import { IslandMesh } from "../islands/island-mesh";
import { QuestBoard3D } from "../landmarks/quest-board";
import { MentorTower3D } from "../landmarks/mentor-tower";
import { AchievementShrine3D } from "../landmarks/achievement-shrine";
import { ChapterTown3D } from "../landmarks/chapter-town";
import { SeasonalEvents3D } from "../landmarks/seasonal-events";
import { useIslandInteraction } from "../hooks/use-island-interaction";
import { Bridges } from "../effects/bridges";
import { Compass } from "../effects/compass";
import { useWorldControls } from "../hooks/use-world-controls";
import { getTheme } from "../constants";
import { getTierConfig } from "../islands/island-tiers";
import { SelectionRing } from "../effects/selection-ring";
import { CinematicIntro } from "./cinematic-intro";
import { KeyboardControls } from "./keyboard-controls";
import { AmbientLife } from "./ambient-life";

interface WorldSceneProps {
  tier: DeviceTier;
  data: WorldData;
  onSelectIsland?: (island: PassionIsland | null) => void;
}

export function WorldScene({ tier, data, onSelectIsland }: WorldSceneProps) {
  const dpr: [number, number] = tier === "LOW" ? [1, 1] : [1, 1.5];

  return (
    <Canvas
      dpr={dpr}
      gl={{
        powerPreference: tier === "LOW" ? "low-power" : "default",
        antialias: tier !== "LOW",
      }}
      shadows={false}
      camera={{ position: [0, 80, 120], fov: 50 }}
      style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
      aria-label="Interactive 3D map of your passion islands"
    >
      <SceneContent tier={tier} data={data} onSelectIsland={onSelectIsland} />
    </Canvas>
  );
}

/** Inner component — runs inside the Canvas R3F context */
function SceneContent({
  tier,
  data,
  onSelectIsland,
}: {
  tier: DeviceTier;
  data: WorldData;
  onSelectIsland?: (island: PassionIsland | null) => void;
}) {
  const { selectedId, hoveredId, select, hover, deselect } = useIslandInteraction();
  const { focusOnIsland, returnToOverview } = useWorldControls();
  const [introComplete, setIntroComplete] = useState(false);

  const positions = useMemo(
    () => getIslandPositions3D(data.islands.length),
    [data.islands.length],
  );

  // Landmark positions at world edges
  const lm = useMemo(() => ({
    questBoard: [-55, 0, -30] as [number, number, number],
    mentorTower: [55, 0, -30] as [number, number, number],
    shrine: [55, 0, 40] as [number, number, number],
    chapterTown: [-55, 0, 40] as [number, number, number],
    events: [0, 0, 60] as [number, number, number],
  }), []);

  // Selected island info for selection ring
  const selectedIslandInfo = useMemo(() => {
    if (!selectedId) return null;
    const idx = data.islands.findIndex((isl) => isl.id === selectedId);
    if (idx === -1) return null;
    const island = data.islands[idx];
    const pos = positions[idx];
    const theme = getTheme(island.category);
    const tierCfg = getTierConfig(island.level);
    return { pos, color: theme.gradient[0], radius: tierCfg.radius + (island.isPrimary ? 1 : 0) };
  }, [selectedId, data.islands, positions]);

  // Primary island position for cinematic intro drift
  const primaryIslandPos = useMemo<[number, number, number] | null>(() => {
    const primary = data.islands.find((isl) => isl.isPrimary);
    if (!primary) return null;
    const idx = data.islands.indexOf(primary);
    const pos = positions[idx];
    return pos ? [pos.x, pos.y, pos.z] : null;
  }, [data.islands, positions]);

  const handleSelectIsland = useCallback((island: PassionIsland, pos: [number, number, number]) => {
    const newId = selectedId === island.id ? null : island.id;
    select(newId);
    onSelectIsland?.(newId ? island : null);
    if (newId) {
      focusOnIsland(pos);
    } else {
      returnToOverview();
    }
  }, [selectedId, select, onSelectIsland, focusOnIsland, returnToOverview]);

  const handleDeselect = useCallback(() => {
    deselect();
    onSelectIsland?.(null);
    returnToOverview();
  }, [deselect, onSelectIsland, returnToOverview]);

  const handleIntroComplete = useCallback(() => {
    setIntroComplete(true);
  }, []);

  return (
    <>
      <SkyEnvironment />
      <Ocean tier={tier} />
      <CameraController />

      {/* Cinematic intro on first visit */}
      <CinematicIntro
        primaryIslandPos={primaryIslandPos}
        onIntroComplete={handleIntroComplete}
      />

      {/* Keyboard navigation */}
      {introComplete && (
        <KeyboardControls
          islands={data.islands}
          positions={positions}
          selectedId={selectedId}
          onSelectIsland={handleSelectIsland}
          onDeselect={handleDeselect}
        />
      )}

      {/* Ambient life: boats, birds, fish */}
      <AmbientLife tier={tier} />

      {/* Compass rose */}
      <Compass />

      {/* Bridges between consecutive islands */}
      <Bridges islands={data.islands} positions={positions} />

      {/* Selection ring on selected island */}
      {selectedIslandInfo && (
        <SelectionRing
          position={[selectedIslandInfo.pos.x, 0.2, selectedIslandInfo.pos.z]}
          radius={selectedIslandInfo.radius}
          color={selectedIslandInfo.color}
          visible
        />
      )}

      {/* Islands */}
      {data.islands.map((island, i) => {
        const pos = positions[i];
        return (
          <IslandMesh
            key={island.id}
            island={island}
            position={[pos.x, pos.y, pos.z]}
            index={i}
            isSelected={selectedId === island.id}
            isHovered={hoveredId === island.id}
            onSelect={() => handleSelectIsland(island, [pos.x, pos.y, pos.z])}
            onHover={(h) => hover(h ? island.id : null)}
          />
        );
      })}

      {/* Landmarks */}
      <QuestBoard3D
        position={lm.questBoard}
        questCount={data.activeChallenges}
      />
      <MentorTower3D
        position={lm.mentorTower}
        mentorName={data.mentorName}
      />
      <AchievementShrine3D
        position={lm.shrine}
        badgeCount={data.totalBadges}
        certCount={data.totalCertificates}
      />
      <ChapterTown3D
        position={lm.chapterTown}
        chapterName={data.chapterName}
        memberCount={data.chapterMemberCount}
      />
      <SeasonalEvents3D
        position={lm.events}
        count={data.activeChallenges + data.upcomingEventCount}
      />
    </>
  );
}
