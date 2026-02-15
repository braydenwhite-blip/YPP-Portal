"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  memo,
} from "react";
import { useRouter } from "next/navigation";
import type { WorldData, PassionIsland } from "@/lib/world-actions";
import styles from "./passion-world.module.css";
import { LEVEL_LABELS, getTheme, getTreeData } from "./constants";
import { getIslandPositions } from "./islands/island-layout";
import { WorldHUD } from "./overlay/world-hud";
import { ActivityLog } from "./overlay/activity-log";
import { IslandDetail } from "./overlay/island-detail";
import { QuestPanel } from "./overlay/quest-panel";
import { MentorPanel } from "./overlay/mentor-panel";
import { ShrinePanel } from "./overlay/shrine-panel";
import { ChapterPanel } from "./overlay/chapter-panel";
import { EventsPanel } from "./overlay/events-panel";
import { SearchFilter } from "./overlay/search-filter";
import { Onboarding } from "./overlay/onboarding";
import { DiscoveryQuizPanel } from "./overlay/discovery-quiz-panel";
import { useSound } from "./hooks/use-sound";

type LandmarkType = "quest-board" | "mentor-tower" | "shrine" | "chapter-town" | "events" | null;

const BASE_W = 1200;
const BASE_H = 800;
const CULL_BUFFER = 250;

// ═══════════════════════════════════════════════════════════════
// SVG SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════

function WaveLayer({
  y,
  color,
  speed,
}: {
  y: number;
  color: string;
  speed: number;
}) {
  return (
    <path
      d={`M0 ${y} Q150 ${y - 15} 300 ${y} T600 ${y} T900 ${y} T1200 ${y} V900 H0 Z`}
      fill={color}
      opacity={0.4}
    >
      <animateTransform
        attributeName="transform"
        type="translate"
        values="0,0; -300,0; 0,0"
        dur={`${speed}s`}
        repeatCount="indefinite"
      />
    </path>
  );
}

function Cloud({
  x,
  y,
  scale,
}: {
  x: number;
  y: number;
  scale: number;
}) {
  return (
    <g
      transform={`translate(${x}, ${y}) scale(${scale})`}
      opacity={0.5}
    >
      <ellipse cx="0" cy="0" rx="30" ry="12" fill="white" />
      <ellipse cx="-15" cy="-5" rx="20" ry="10" fill="white" />
      <ellipse cx="15" cy="-5" rx="22" ry="11" fill="white" />
      <ellipse cx="5" cy="-10" rx="18" ry="9" fill="white" />
      <animateTransform
        attributeName="transform"
        type="translate"
        values={`${x},${y}; ${x + 800},${y}; ${x},${y}`}
        dur={`${60 + scale * 30}s`}
        repeatCount="indefinite"
      />
    </g>
  );
}

// ═══════════════════════════════════════════════════════════════
// MEMOIZED ISLAND COMPONENT
// ═══════════════════════════════════════════════════════════════

interface IslandProps {
  island: PassionIsland;
  x: number;
  y: number;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
}

const Island = memo(
  function Island({ island, x, y, index, isSelected, onSelect }: IslandProps) {
    const theme = getTheme(island.category);
    const levelConfig = LEVEL_LABELS[island.level] ?? LEVEL_LABELS.EXPLORING;
    const scale = levelConfig.scale + (island.isPrimary ? 0.15 : 0);
    const r = 40 * scale;

    // Deterministic trees
    const trees = useMemo(
      () =>
        getTreeData(levelConfig.trees, x, y - 5, index * 1000 + island.id.charCodeAt(0)),
      [levelConfig.trees, x, y, index, island.id],
    );

    // Precompute bezier path
    const islandPath = useMemo(() => {
      return `
        M${cx(r, -1)} ${cy(r, 0.1)}
        C${cx(r, -1)} ${cy(r, -0.5)} ${cx(r, -0.5)} ${cy(r, -0.7)} ${x} ${cy(r, -0.65)}
        C${cx(r, 0.5)} ${cy(r, -0.7)} ${cx(r, 1)} ${cy(r, -0.5)} ${cx(r, 1)} ${cy(r, 0.1)}
        C${cx(r, 0.8)} ${cy(r, 0.35)} ${cx(r, 0.3)} ${cy(r, 0.45)} ${x} ${cy(r, 0.4)}
        C${cx(r, -0.3)} ${cy(r, 0.45)} ${cx(r, -0.8)} ${cy(r, 0.35)} ${cx(r, -1)} ${cy(r, 0.1)}
        Z
      `;
      function cx(radius: number, frac: number) {
        return x + radius * frac;
      }
      function cy(radius: number, frac: number) {
        return y + 4 + radius * frac;
      }
    }, [x, y, r]);

    const grassPath = useMemo(() => {
      return `
        M${x - r * 0.8} ${y}
        C${x - r * 0.5} ${y - r * 0.3} ${x + r * 0.5} ${y - r * 0.3} ${x + r * 0.8} ${y}
        C${x + r * 0.5} ${y + r * 0.1} ${x - r * 0.5} ${y + r * 0.1} ${x - r * 0.8} ${y}
        Z
      `;
    }, [x, y, r]);

    const bobValues = `0,0; 0,${-2 + (index % 3)}; 0,0`;
    const bobDur = `${3 + (index % 4) * 0.5}s`;

    return (
      <g onClick={onSelect} style={{ cursor: "pointer" }}>
        <animateTransform
          attributeName="transform"
          type="translate"
          values={bobValues}
          dur={bobDur}
          repeatCount="indefinite"
        />

        {/* Selection ring */}
        {isSelected && (
          <ellipse
            cx={x}
            cy={y + r * 0.2}
            rx={r + 10}
            ry={r * 0.4 + 5}
            fill="none"
            stroke={theme.gradient[0]}
            strokeWidth="2"
            strokeDasharray="6 3"
            opacity={0.7}
          >
            <animateTransform
              attributeName="transform"
              type="rotate"
              values={`0 ${x} ${y + r * 0.2}; 360 ${x} ${y + r * 0.2}`}
              dur="20s"
              repeatCount="indefinite"
            />
          </ellipse>
        )}

        {/* Shadow */}
        <ellipse
          cx={x + 3}
          cy={y + r * 0.4 + 5}
          rx={r * 0.9}
          ry={r * 0.2}
          fill="rgba(0,0,0,0.1)"
        />
        {/* Underwater base */}
        <ellipse
          cx={x}
          cy={y + r * 0.35}
          rx={r * 0.85}
          ry={r * 0.25}
          fill={theme.gradient[1]}
          opacity={0.2}
        />
        {/* Main island */}
        <path
          d={islandPath}
          fill={theme.terrain}
          stroke={theme.gradient[0]}
          strokeWidth="1.5"
        />
        {/* Grass overlay */}
        <path d={grassPath} fill={theme.gradient[0]} opacity={0.15} />
        {/* Beach rim */}
        <ellipse
          cx={x}
          cy={y + r * 0.2}
          rx={r * 0.7}
          ry={r * 0.1}
          fill="#fde68a"
          opacity={0.35}
        />

        {/* Building (Developing+) */}
        {island.level !== "EXPLORING" && (
          <g>
            <rect
              x={x - 5}
              y={y - r * 0.5 - 8}
              width={10}
              height={12}
              rx={1}
              fill={theme.gradient[0]}
              opacity={0.8}
            />
            <polygon
              points={`${x - 7},${y - r * 0.5 - 8} ${x},${y - r * 0.5 - 16} ${x + 7},${y - r * 0.5 - 8}`}
              fill={theme.accent}
              opacity={0.9}
            />
            <rect
              x={x - 1.5}
              y={y - r * 0.5 - 4}
              width={3}
              height={5}
              fill={theme.accent}
              opacity={0.6}
            />
          </g>
        )}

        {/* Trees */}
        {trees.map((t, i) => (
          <g key={i}>
            <line
              x1={t.tx}
              y1={t.ty}
              x2={t.tx}
              y2={t.ty - t.h * 0.4}
              stroke="#8B4513"
              strokeWidth="1.5"
            />
            <ellipse
              cx={t.tx}
              cy={t.ty - t.h * 0.6}
              rx={t.h * 0.35}
              ry={t.h * 0.45}
              fill={theme.gradient[0]}
              opacity={0.85}
            />
          </g>
        ))}

        {/* Primary flag */}
        {island.isPrimary && (
          <g>
            <line
              x1={x + r * 0.5}
              y1={y - r * 0.6}
              x2={x + r * 0.5}
              y2={y - r * 0.6 - 18}
              stroke="#8B4513"
              strokeWidth="1.5"
            />
            <polygon
              points={`${x + r * 0.5},${y - r * 0.6 - 18} ${x + r * 0.5 + 10},${y - r * 0.6 - 14} ${x + r * 0.5},${y - r * 0.6 - 10}`}
              fill="#fbbf24"
            />
          </g>
        )}

        {/* Emoji */}
        <text
          x={x}
          y={y - r * 0.25}
          textAnchor="middle"
          fontSize={16 * scale}
          style={{ pointerEvents: "none" }}
        >
          {theme.emoji}
        </text>

        {/* Name */}
        <text
          x={x}
          y={y + r * 0.5 + 14}
          textAnchor="middle"
          fontSize={10}
          fontWeight={700}
          fill={theme.accent}
          style={{ pointerEvents: "none" }}
        >
          {island.name}
        </text>

        {/* Level label */}
        <text
          x={x}
          y={y + r * 0.5 + 25}
          textAnchor="middle"
          fontSize={8}
          fill={theme.accent}
          opacity={0.7}
          style={{ pointerEvents: "none" }}
        >
          {levelConfig.label} · Lv{island.currentLevel}
        </text>

        {/* XP mini-bar */}
        <rect
          x={x - 16}
          y={y + r * 0.5 + 30}
          width={32}
          height={3}
          rx={1.5}
          fill={theme.terrain}
          stroke={theme.gradient[0]}
          strokeWidth={0.5}
        />
        <rect
          x={x - 16}
          y={y + r * 0.5 + 30}
          width={Math.min(
            32,
            (island.xpPoints / Math.max(island.xpPoints + 50, 100)) * 32,
          )}
          height={3}
          rx={1.5}
          fill={theme.gradient[0]}
        />
      </g>
    );
  },
  (prev, next) =>
    prev.island.id === next.island.id &&
    prev.island.xpPoints === next.island.xpPoints &&
    prev.island.level === next.island.level &&
    prev.island.currentLevel === next.island.currentLevel &&
    prev.isSelected === next.isSelected &&
    prev.x === next.x &&
    prev.y === next.y,
);

// ═══════════════════════════════════════════════════════════════
// WORLD LANDMARKS — clickable SVG icons that open panels
// ═══════════════════════════════════════════════════════════════

const QuestBoardLandmark = memo(function QuestBoardLandmark({
  x,
  y,
  onSelect,
}: {
  x: number;
  y: number;
  onSelect: () => void;
}) {
  return (
    <g onClick={onSelect} style={{ cursor: "pointer" }} opacity={0.85}>
      <title>Quest Board</title>
      {/* Hit area */}
      <rect x={x - 25} y={y - 25} width={50} height={55} fill="transparent" />
      <line x1={x} y1={y + 10} x2={x} y2={y - 15} stroke="#8B4513" strokeWidth="3" />
      <rect x={x - 15} y={y - 15} width={30} height={14} rx={2} fill="#DEB887" stroke="#8B4513" strokeWidth="1" />
      <rect x={x - 12} y={y - 5} width={24} height={10} rx={2} fill="#DEB887" stroke="#8B4513" strokeWidth="1" />
      <text x={x} y={y - 6} textAnchor="middle" fontSize="5" fill="#5C3317" fontWeight="700">QUESTS</text>
      <text x={x} y={y + 2} textAnchor="middle" fontSize="4" fill="#5C3317">BOARD</text>
      <text x={x} y={y + 26} textAnchor="middle" fontSize="8" fill="#8B6914" fontWeight="600">Quest Board</text>
    </g>
  );
});

const MentorTowerLandmark = memo(function MentorTowerLandmark({
  x,
  y,
  mentorName,
  onSelect,
}: {
  x: number;
  y: number;
  mentorName: string | null;
  onSelect: () => void;
}) {
  return (
    <g onClick={onSelect} style={{ cursor: "pointer" }} opacity={mentorName ? 0.85 : 0.6}>
      <title>{mentorName ? `Mentor Tower — ${mentorName}` : "Mentor Tower — No mentor assigned"}</title>
      {/* Hit area */}
      <rect x={x - 15} y={y - 35} width={30} height={65} fill="transparent" />
      <rect x={x - 8} y={y - 20} width={16} height={30} rx={2} fill="#7c3aed" opacity={0.8} />
      <polygon points={`${x - 10},${y - 20} ${x},${y - 32} ${x + 10},${y - 20}`} fill="#5b21b6" />
      <rect x={x - 2} y={y - 8} width={4} height={6} rx={1} fill="#c4b5fd" />
      <circle cx={x} cy={y - 26} r={2} fill="#fbbf24" />
      <rect x={x - 3} y={y - 16} width={2.5} height={3} rx={0.5} fill="#c4b5fd" opacity={0.7} />
      <rect x={x + 1} y={y - 16} width={2.5} height={3} rx={0.5} fill="#c4b5fd" opacity={0.7} />
      <text x={x} y={y + 18} textAnchor="middle" fontSize="8" fill="#5b21b6" fontWeight="600">Mentor Tower</text>
      {mentorName && (
        <text x={x} y={y + 27} textAnchor="middle" fontSize="6" fill="#7c3aed" opacity={0.7}>{mentorName}</text>
      )}
    </g>
  );
});

const AchievementShrineLandmark = memo(function AchievementShrineLandmark({
  x,
  y,
  badgeCount,
  certCount,
  onSelect,
}: {
  x: number;
  y: number;
  badgeCount: number;
  certCount: number;
  onSelect: () => void;
}) {
  return (
    <g onClick={onSelect} style={{ cursor: "pointer" }} opacity={0.85}>
      <title>Achievement Shrine — {badgeCount} badges, {certCount} certificates</title>
      {/* Hit area */}
      <rect x={x - 20} y={y - 25} width={40} height={50} fill="transparent" />
      <rect x={x - 12} y={y - 10} width={24} height={16} rx={1} fill="#fbbf24" opacity={0.8} />
      <polygon points={`${x - 15},${y - 10} ${x},${y - 22} ${x + 15},${y - 10}`} fill="#f59e0b" />
      <rect x={x - 10} y={y - 10} width={3} height={16} fill="#d97706" opacity={0.6} />
      <rect x={x + 7} y={y - 10} width={3} height={16} fill="#d97706" opacity={0.6} />
      <text x={x} y={y - 13} textAnchor="middle" fontSize="8">{"\u2B50"}</text>
      <text x={x} y={y + 16} textAnchor="middle" fontSize="8" fill="#92400e" fontWeight="600">Shrine</text>
      {badgeCount + certCount > 0 && (
        <g>
          <circle cx={x + 14} cy={y - 18} r={7} fill="#ef4444" />
          <text x={x + 14} y={y - 15} textAnchor="middle" fontSize="7" fill="white" fontWeight="700">
            {badgeCount + certCount}
          </text>
        </g>
      )}
    </g>
  );
});

const ChapterTownLandmark = memo(function ChapterTownLandmark({
  x,
  y,
  chapterName,
  memberCount,
  onSelect,
}: {
  x: number;
  y: number;
  chapterName: string | null;
  memberCount: number;
  onSelect: () => void;
}) {
  return (
    <g onClick={onSelect} style={{ cursor: "pointer" }} opacity={chapterName ? 0.85 : 0.55}>
      <title>{chapterName ? `${chapterName} — ${memberCount} members` : "Chapter Town — Join a chapter"}</title>
      {/* Hit area */}
      <rect x={x - 18} y={y - 25} width={42} height={55} fill="transparent" />
      <rect x={x - 14} y={y - 8} width={10} height={12} rx={1} fill="#3b82f6" opacity={0.7} />
      <rect x={x - 2} y={y - 14} width={12} height={18} rx={1} fill="#2563eb" opacity={0.8} />
      <rect x={x + 12} y={y - 6} width={8} height={10} rx={1} fill="#60a5fa" opacity={0.6} />
      <polygon points={`${x - 15},${y - 8} ${x - 9},${y - 14} ${x - 3},${y - 8}`} fill="#1d4ed8" opacity={0.8} />
      <polygon points={`${x - 3},${y - 14} ${x + 4},${y - 22} ${x + 11},${y - 14}`} fill="#1e40af" opacity={0.9} />
      <polygon points={`${x + 11},${y - 6} ${x + 16},${y - 11} ${x + 21},${y - 6}`} fill="#1d4ed8" opacity={0.7} />
      <text x={x + 3} y={y + 16} textAnchor="middle" fontSize="8" fill="#1e40af" fontWeight="600">
        {chapterName ?? "Chapter Town"}
      </text>
      {memberCount > 0 && (
        <text x={x + 3} y={y + 25} textAnchor="middle" fontSize="6" fill="#3b82f6" opacity={0.7}>
          {memberCount} explorers
        </text>
      )}
    </g>
  );
});

const SeasonalEventLandmark = memo(function SeasonalEventLandmark({
  x,
  y,
  count,
  onSelect,
}: {
  x: number;
  y: number;
  count: number;
  onSelect: () => void;
}) {
  return (
    <g onClick={onSelect} style={{ cursor: "pointer" }} opacity={count > 0 ? 0.85 : 0.55}>
      <title>{count > 0 ? `${count} active challenges & events` : "No active events"}</title>
      {/* Hit area */}
      <rect x={x - 18} y={y - 25} width={36} height={50} fill="transparent" />
      <polygon points={`${x - 14},${y + 6} ${x},${y - 16} ${x + 14},${y + 6}`} fill="#ef4444" opacity={0.7} />
      <polygon points={`${x - 10},${y + 6} ${x},${y - 10} ${x + 10},${y + 6}`} fill="#fbbf24" opacity={0.5} />
      <line x1={x} y1={y - 16} x2={x} y2={y - 20} stroke="#8B4513" strokeWidth="1.5" />
      <polygon points={`${x},${y - 20} ${x + 6},${y - 18} ${x},${y - 16}`} fill="#ef4444" />
      <text x={x} y={y + 16} textAnchor="middle" fontSize="8" fill="#b91c1c" fontWeight="600">Events</text>
      {count > 0 && (
        <g>
          <circle cx={x + 12} cy={y - 14} r={7} fill="#16a34a" />
          <text x={x + 12} y={y - 11} textAnchor="middle" fontSize="7" fill="white" fontWeight="700">{count}</text>
        </g>
      )}
    </g>
  );
});

// ═══════════════════════════════════════════════════════════════
// VIEWPORT CULLING — only render islands in view
// ═══════════════════════════════════════════════════════════════

function isInViewport(
  ix: number,
  iy: number,
  vx: number,
  vy: number,
  vw: number,
  vh: number,
): boolean {
  return (
    ix >= vx - CULL_BUFFER &&
    ix <= vx + vw + CULL_BUFFER &&
    iy >= vy - CULL_BUFFER &&
    iy <= vy + vh + CULL_BUFFER
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN PASSION WORLD COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function PassionWorld({ data }: { data: WorldData }) {
  const router = useRouter();
  const [selectedIsland, setSelectedIsland] =
    useState<PassionIsland | null>(null);
  const [selectedLandmark, setSelectedLandmark] = useState<LandmarkType>(null);
  const [filteredIds, setFilteredIds] = useState<Set<string> | null>(null);
  const [hudCollapsed, setHudCollapsed] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isExiting, setIsExiting] = useState(false);
  const [isEntering, setIsEntering] = useState(true);
  const [showQuiz, setShowQuiz] = useState(false);
  const { enabled: soundEnabled, toggle: toggleSound, playSound } = useSound();
  const svgRef = useRef<SVGSVGElement>(null);

  // Clear entering state after animation completes
  useEffect(() => {
    const timer = setTimeout(() => setIsEntering(false), 700);
    return () => clearTimeout(timer);
  }, []);

  const handleExit = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => router.push("/"), 600);
  }, [router]);

  // rAF-based pan state (refs to avoid re-renders during drag)
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number>(0);
  const pendingDelta = useRef({ x: 0, y: 0 });

  // Stable island positions
  const positions = useMemo(
    () => getIslandPositions(data.islands.length),
    [data.islands.length],
  );

  // Landmark positions
  const landmarks = useMemo(
    () => ({
      questBoard: { x: 100, y: 200 },
      mentorTower: { x: 1080, y: 180 },
      shrine: { x: 1050, y: 620 },
      chapterTown: { x: 120, y: 600 },
      events: { x: 600, y: 740 },
    }),
    [],
  );

  // Compute viewBox
  const viewBox = `${-offset.x} ${-offset.y} ${BASE_W} ${BASE_H}`;
  const vx = -offset.x;
  const vy = -offset.y;

  // rAF pan loop
  const flushPan = useCallback(() => {
    const dx = pendingDelta.current.x;
    const dy = pendingDelta.current.y;
    if (dx !== 0 || dy !== 0) {
      pendingDelta.current = { x: 0, y: 0 };
      setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    }
    if (isDraggingRef.current) {
      rafRef.current = requestAnimationFrame(flushPan);
    }
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as Element).closest("[data-interactive]")) return;
      isDraggingRef.current = true;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      rafRef.current = requestAnimationFrame(flushPan);
    },
    [flushPan],
  );

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const dx = (e.clientX - dragStartRef.current.x) * 1.5;
    const dy = (e.clientY - dragStartRef.current.y) * 1.5;
    pendingDelta.current = {
      x: pendingDelta.current.x + dx,
      y: pendingDelta.current.y + dy,
    };
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
    cancelAnimationFrame(rafRef.current);
  }, []);

  // Cleanup rAF on unmount
  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // Stable select handlers
  const selectHandlers = useMemo(() => {
    return data.islands.map((island) => () => {
      setSelectedIsland((prev) =>
        prev?.id === island.id ? null : island,
      );
      setSelectedLandmark(null);
      playSound("select");
    });
  }, [data.islands, playSound]);

  // Landmark select handlers
  const handleSelectLandmark = useCallback((lm: LandmarkType) => {
    setSelectedLandmark((prev) => prev === lm ? null : lm);
    setSelectedIsland(null);
    playSound("landmark");
  }, [playSound]);

  // Viewport-culled islands
  const visibleIslands = useMemo(() => {
    if (data.islands.length <= 20) {
      return data.islands.map((_, i) => i);
    }
    const visible: number[] = [];
    for (let i = 0; i < data.islands.length; i++) {
      const pos = positions[i];
      if (pos && isInViewport(pos.x, pos.y, vx, vy, BASE_W, BASE_H)) {
        visible.push(i);
      }
    }
    return visible;
  }, [data.islands, positions, vx, vy]);

  return (
    <div className={`${styles.world}${isEntering ? ` ${styles.worldEntering}` : ""}${isExiting ? ` ${styles.worldExiting}` : ""}`} role="application" aria-label="Passion World — interactive map of your passions">
      {/* HTML overlays */}
      <WorldHUD
        data={data}
        soundEnabled={soundEnabled}
        onToggleSound={toggleSound}
        isCollapsed={hudCollapsed}
        onToggleCollapse={() => setHudCollapsed((p) => !p)}
      />
      <ActivityLog activities={data.recentActivity} />
      <button className={styles.backBtn} aria-label="Return to dashboard" onClick={handleExit}>
        &larr; Dashboard
      </button>
      <button
        className={styles.discoverBtn}
        onClick={() => { setShowQuiz(true); setSelectedIsland(null); setSelectedLandmark(null); }}
        aria-label="Take Passion Discovery Quiz"
      >
        {"\u{1FA84}"} Discover
      </button>

      {/* Sound toggle */}
      <button
        className={styles.soundToggle}
        onClick={toggleSound}
        aria-label={soundEnabled ? "Mute sounds" : "Enable sounds"}
        title={soundEnabled ? "Mute sounds" : "Enable sounds"}
      >
        {soundEnabled ? "\u{1F50A}" : "\u{1F507}"}
      </button>

      {/* ─── SVG World Map ─── */}
      <svg
        ref={svgRef}
        viewBox={viewBox}
        className={styles.svg}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <defs>
          <linearGradient id="ocean" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0c4a6e" />
            <stop offset="40%" stopColor="#0369a1" />
            <stop offset="100%" stopColor="#0284c7" />
          </linearGradient>
          <linearGradient id="sunGlow" x1="0.5" y1="0" x2="0.5" y2="1">
            <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="lightBeam" cx="0.5" cy="0" r="0.7">
            <stop offset="0%" stopColor="rgba(255,255,255,0.06)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
          <pattern
            id="waterPattern"
            width="60"
            height="60"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="30" cy="30" r="1" fill="rgba(255,255,255,0.06)" />
            <circle cx="10" cy="10" r="0.5" fill="rgba(255,255,255,0.04)" />
            <circle cx="50" cy="15" r="0.8" fill="rgba(255,255,255,0.05)" />
          </pattern>
        </defs>

        {/* Ocean */}
        <rect x="-400" y="-400" width="2000" height="1600" fill="url(#ocean)" />
        <rect x="-400" y="-400" width="2000" height="1600" fill="url(#waterPattern)" />

        {/* Sun glow at top */}
        <ellipse cx="600" cy="-50" rx="500" ry="200" fill="url(#sunGlow)" />

        {/* Light rays */}
        <rect x="200" y="-100" width="800" height="500" fill="url(#lightBeam)" opacity="0.5" />

        {/* Waves */}
        <WaveLayer y={760} color="#0ea5e9" speed={12} />
        <WaveLayer y={775} color="#38bdf8" speed={15} />
        <WaveLayer y={790} color="#7dd3fc" speed={18} />

        {/* Clouds */}
        <Cloud x={50} y={60} scale={0.8} />
        <Cloud x={400} y={40} scale={1.1} />
        <Cloud x={750} y={70} scale={0.9} />
        <Cloud x={1050} y={50} scale={0.7} />

        {/* Compass */}
        <g transform="translate(60, 80)" opacity={0.3}>
          <circle cx="0" cy="0" r="20" fill="none" stroke="#fbbf24" strokeWidth="1" />
          <line x1="0" y1="-22" x2="0" y2="22" stroke="#fbbf24" strokeWidth="0.5" />
          <line x1="-22" y1="0" x2="22" y2="0" stroke="#fbbf24" strokeWidth="0.5" />
          <text x="0" y="-25" textAnchor="middle" fontSize="8" fill="#fbbf24" fontWeight="700">N</text>
        </g>

        {/* Bridges connecting islands */}
        {data.islands.length > 1 &&
          positions.slice(0, -1).map((pos, i) => {
            const next = positions[i + 1];
            return (
              <line
                key={`bridge-${i}`}
                x1={pos.x}
                y1={pos.y + 15}
                x2={next.x}
                y2={next.y + 15}
                stroke="rgba(255,255,255,0.12)"
                strokeWidth="1.5"
                strokeDasharray="6 8"
              />
            );
          })}

        {/* Landmarks — clickable to open panels */}
        <g data-interactive>
          <QuestBoardLandmark x={landmarks.questBoard.x} y={landmarks.questBoard.y} onSelect={() => handleSelectLandmark("quest-board")} />
          <MentorTowerLandmark x={landmarks.mentorTower.x} y={landmarks.mentorTower.y} mentorName={data.mentorName} onSelect={() => handleSelectLandmark("mentor-tower")} />
          <AchievementShrineLandmark x={landmarks.shrine.x} y={landmarks.shrine.y} badgeCount={data.totalBadges} certCount={data.totalCertificates} onSelect={() => handleSelectLandmark("shrine")} />
          <ChapterTownLandmark x={landmarks.chapterTown.x} y={landmarks.chapterTown.y} chapterName={data.chapterName} memberCount={data.chapterMemberCount} onSelect={() => handleSelectLandmark("chapter-town")} />
          <SeasonalEventLandmark x={landmarks.events.x} y={landmarks.events.y} count={data.activeChallenges + data.upcomingEventCount} onSelect={() => handleSelectLandmark("events")} />
        </g>

        {/* Empty state */}
        {data.islands.length === 0 && (
          <g>
            <text x="600" y="380" textAnchor="middle" fontSize="18" fill="white" fontWeight="700" opacity={0.8}>
              Your world awaits...
            </text>
            <text x="600" y="410" textAnchor="middle" fontSize="12" fill="white" opacity={0.5}>
              Take the Passion Discovery Quiz to grow your first island
            </text>
          </g>
        )}

        {/* Islands (viewport-culled, memoized) */}
        {visibleIslands.map((i) => {
          const island = data.islands[i];
          const pos = positions[i];
          return (
            <g key={island.id} data-interactive>
              <Island
                island={island}
                x={pos?.x ?? 600}
                y={pos?.y ?? 400}
                index={i}
                isSelected={selectedIsland?.id === island.id}
                onSelect={selectHandlers[i]}
              />
            </g>
          );
        })}

        {/* Title */}
        <text
          x="600"
          y="30"
          textAnchor="middle"
          fontSize="14"
          fill="rgba(255,255,255,0.35)"
          fontWeight="700"
          letterSpacing="3"
        >
          THE PASSION WORLD
        </text>
      </svg>

      {/* Search & category filter */}
      <SearchFilter
        islands={data.islands}
        onFilter={setFilteredIds}
        onFocusIsland={(island) => {
          setSelectedIsland(island);
          setSelectedLandmark(null);
        }}
      />

      {selectedIsland && (
        <IslandDetail
          island={selectedIsland}
          data={data}
          onClose={() => setSelectedIsland(null)}
        />
      )}

      {/* Landmark panels */}
      {selectedLandmark === "quest-board" && (
        <QuestPanel data={data} onClose={() => setSelectedLandmark(null)} />
      )}
      {selectedLandmark === "mentor-tower" && (
        <MentorPanel data={data} onClose={() => setSelectedLandmark(null)} />
      )}
      {selectedLandmark === "shrine" && (
        <ShrinePanel data={data} onClose={() => setSelectedLandmark(null)} />
      )}
      {selectedLandmark === "chapter-town" && (
        <ChapterPanel data={data} onClose={() => setSelectedLandmark(null)} />
      )}
      {selectedLandmark === "events" && (
        <EventsPanel data={data} onClose={() => setSelectedLandmark(null)} />
      )}

      {/* Passion Discovery Quiz */}
      {showQuiz && (
        <DiscoveryQuizPanel
          onClose={() => setShowQuiz(false)}
          onIslandsCreated={() => router.refresh()}
        />
      )}

      {/* Onboarding tutorial */}
      <Onboarding introComplete={true} />
    </div>
  );
}
