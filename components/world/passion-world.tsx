"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import type { WorldData, PassionIsland } from "@/lib/world-actions";

// ═══════════════════════════════════════════════════════════════
// CONSTANTS & CONFIG
// ═══════════════════════════════════════════════════════════════

const CATEGORY_THEMES: Record<
  string,
  { gradient: [string, string]; accent: string; terrain: string; emoji: string }
> = {
  ARTS: { gradient: ["#f472b6", "#ec4899"], accent: "#be185d", terrain: "#fce7f3", emoji: "🎨" },
  MUSIC: { gradient: ["#a78bfa", "#8b5cf6"], accent: "#6d28d9", terrain: "#ede9fe", emoji: "🎵" },
  SPORTS: { gradient: ["#34d399", "#10b981"], accent: "#047857", terrain: "#d1fae5", emoji: "⚽" },
  STEM: { gradient: ["#60a5fa", "#3b82f6"], accent: "#1d4ed8", terrain: "#dbeafe", emoji: "🔬" },
  BUSINESS: { gradient: ["#fbbf24", "#f59e0b"], accent: "#b45309", terrain: "#fef3c7", emoji: "💼" },
  SERVICE: { gradient: ["#f87171", "#ef4444"], accent: "#b91c1c", terrain: "#fee2e2", emoji: "🤝" },
  HEALTH_WELLNESS: { gradient: ["#2dd4bf", "#14b8a6"], accent: "#0f766e", terrain: "#ccfbf1", emoji: "💚" },
  TRADES: { gradient: ["#fb923c", "#f97316"], accent: "#c2410c", terrain: "#ffedd5", emoji: "🔧" },
  ENTERTAINMENT: { gradient: ["#e879f9", "#d946ef"], accent: "#a21caf", terrain: "#fae8ff", emoji: "🎬" },
  WRITING: { gradient: ["#a3e635", "#84cc16"], accent: "#4d7c0f", terrain: "#ecfccb", emoji: "✍️" },
  DANCE: { gradient: ["#fb7185", "#f43f5e"], accent: "#be123c", terrain: "#ffe4e6", emoji: "💃" },
  CODING: { gradient: ["#38bdf8", "#0ea5e9"], accent: "#0369a1", terrain: "#e0f2fe", emoji: "💻" },
  OTHER: { gradient: ["#94a3b8", "#64748b"], accent: "#334155", terrain: "#f1f5f9", emoji: "✨" },
};

const LEVEL_LABELS: Record<string, { label: string; scale: number; trees: number }> = {
  EXPLORING: { label: "Exploring", scale: 0.7, trees: 1 },
  DEVELOPING: { label: "Developing", scale: 0.85, trees: 3 },
  ADVANCING: { label: "Advancing", scale: 1.0, trees: 5 },
  MASTERING: { label: "Mastering", scale: 1.15, trees: 8 },
};

function getTheme(category: string) {
  return CATEGORY_THEMES[category] ?? CATEGORY_THEMES.OTHER;
}

// ═══════════════════════════════════════════════════════════════
// ISLAND POSITIONS — organic scatter in a viewport
// ═══════════════════════════════════════════════════════════════

function getIslandPositions(count: number): { x: number; y: number }[] {
  // Golden-angle spiral for natural-looking distribution
  const positions: { x: number; y: number }[] = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const centerX = 600;
  const centerY = 400;

  for (let i = 0; i < count; i++) {
    const radius = 120 + Math.sqrt(i) * 110;
    const angle = i * goldenAngle;
    positions.push({
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius * 0.65, // Flatten for isometric feel
    });
  }
  return positions;
}

// ═══════════════════════════════════════════════════════════════
// SVG SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════

function WaveLayer({ y, color, speed, id }: { y: number; color: string; speed: number; id: string }) {
  return (
    <g>
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
    </g>
  );
}

function Cloud({ x, y, scale }: { x: number; y: number; scale: number }) {
  return (
    <g transform={`translate(${x}, ${y}) scale(${scale})`} opacity={0.5}>
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

function Trees({ count, baseX, baseY, color }: { count: number; baseX: number; baseY: number; color: string }) {
  const trees = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const radius = 18 + Math.random() * 12;
    const tx = baseX + Math.cos(angle) * radius;
    const ty = baseY + Math.sin(angle) * radius * 0.5 - 8;
    const h = 8 + Math.random() * 6;
    trees.push(
      <g key={i}>
        <line x1={tx} y1={ty} x2={tx} y2={ty - h * 0.4} stroke="#8B4513" strokeWidth="1.5" />
        <ellipse cx={tx} cy={ty - h * 0.6} rx={h * 0.35} ry={h * 0.45} fill={color} opacity={0.85} />
      </g>,
    );
  }
  return <>{trees}</>;
}

function IslandShape({
  cx,
  cy,
  scale,
  theme,
  hasBuildings,
}: {
  cx: number;
  cy: number;
  scale: number;
  theme: ReturnType<typeof getTheme>;
  hasBuildings: boolean;
}) {
  const r = 40 * scale;
  // Organic island shape using bezier
  const points = `
    M${cx - r} ${cy + 4}
    C${cx - r} ${cy - r * 0.5} ${cx - r * 0.5} ${cy - r * 0.7} ${cx} ${cy - r * 0.65}
    C${cx + r * 0.5} ${cy - r * 0.7} ${cx + r} ${cy - r * 0.5} ${cx + r} ${cy + 4}
    C${cx + r * 0.8} ${cy + r * 0.35} ${cx + r * 0.3} ${cy + r * 0.45} ${cx} ${cy + r * 0.4}
    C${cx - r * 0.3} ${cy + r * 0.45} ${cx - r * 0.8} ${cy + r * 0.35} ${cx - r} ${cy + 4}
    Z
  `;

  return (
    <g>
      {/* Island shadow */}
      <ellipse
        cx={cx + 3}
        cy={cy + r * 0.4 + 5}
        rx={r * 0.9}
        ry={r * 0.2}
        fill="rgba(0,0,0,0.1)"
      />
      {/* Underwater base */}
      <ellipse
        cx={cx}
        cy={cy + r * 0.35}
        rx={r * 0.85}
        ry={r * 0.25}
        fill={theme.gradient[1]}
        opacity={0.2}
      />
      {/* Main island */}
      <path d={points} fill={theme.terrain} stroke={theme.gradient[0]} strokeWidth="1.5" />
      {/* Grass overlay */}
      <path
        d={`
          M${cx - r * 0.8} ${cy}
          C${cx - r * 0.5} ${cy - r * 0.3} ${cx + r * 0.5} ${cy - r * 0.3} ${cx + r * 0.8} ${cy}
          C${cx + r * 0.5} ${cy + r * 0.1} ${cx - r * 0.5} ${cy + r * 0.1} ${cx - r * 0.8} ${cy}
          Z
        `}
        fill={theme.gradient[0]}
        opacity={0.15}
      />
      {/* Beach rim */}
      <ellipse
        cx={cx}
        cy={cy + r * 0.2}
        rx={r * 0.7}
        ry={r * 0.1}
        fill="#fde68a"
        opacity={0.35}
      />
      {/* Small building if developing+ */}
      {hasBuildings && (
        <g>
          <rect
            x={cx - 5}
            y={cy - r * 0.5 - 8}
            width={10}
            height={12}
            rx={1}
            fill={theme.gradient[0]}
            opacity={0.8}
          />
          <polygon
            points={`${cx - 7},${cy - r * 0.5 - 8} ${cx},${cy - r * 0.5 - 16} ${cx + 7},${cy - r * 0.5 - 8}`}
            fill={theme.accent}
            opacity={0.9}
          />
          <rect
            x={cx - 1.5}
            y={cy - r * 0.5 - 4}
            width={3}
            height={5}
            fill={theme.accent}
            opacity={0.6}
          />
        </g>
      )}
    </g>
  );
}

// ═══════════════════════════════════════════════════════════════
// ISLAND COMPONENT (clickable, animated)
// ═══════════════════════════════════════════════════════════════

function Island({
  island,
  x,
  y,
  index,
  isSelected,
  onSelect,
}: {
  island: PassionIsland;
  x: number;
  y: number;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const theme = getTheme(island.category);
  const levelConfig = LEVEL_LABELS[island.level] ?? LEVEL_LABELS.EXPLORING;
  const scale = levelConfig.scale + (island.isPrimary ? 0.15 : 0);
  const r = 40 * scale;

  return (
    <g
      onClick={onSelect}
      style={{ cursor: "pointer" }}
      className="island-group"
    >
      {/* Gentle bob animation */}
      <animateTransform
        attributeName="transform"
        type="translate"
        values={`0,0; 0,${-2 + (index % 3)}; 0,0`}
        dur={`${3 + (index % 4) * 0.5}s`}
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

      {/* The island itself */}
      <IslandShape
        cx={x}
        cy={y}
        scale={scale}
        theme={theme}
        hasBuildings={island.level !== "EXPLORING"}
      />

      {/* Trees */}
      <Trees count={levelConfig.trees} baseX={x} baseY={y - 5} color={theme.gradient[0]} />

      {/* Primary passion flag */}
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

      {/* Emoji icon */}
      <text
        x={x}
        y={y - r * 0.25}
        textAnchor="middle"
        fontSize={16 * scale}
        style={{ pointerEvents: "none" }}
      >
        {theme.emoji}
      </text>

      {/* Island name */}
      <text
        x={x}
        y={y + r * 0.5 + 14}
        textAnchor="middle"
        fontSize={10}
        fontWeight={700}
        fill={theme.accent}
        style={{ pointerEvents: "none", textShadow: "0 1px 2px rgba(255,255,255,0.8)" }}
      >
        {island.name}
      </text>

      {/* Level indicator */}
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
        width={Math.min(32, (island.xpPoints / Math.max(island.xpPoints + 50, 100)) * 32)}
        height={3}
        rx={1.5}
        fill={theme.gradient[0]}
      />
    </g>
  );
}

// ═══════════════════════════════════════════════════════════════
// WORLD LANDMARK PLACEHOLDERS
// ═══════════════════════════════════════════════════════════════

function QuestBoardLandmark({ x, y }: { x: number; y: number }) {
  return (
    <g className="landmark" style={{ cursor: "pointer" }} opacity={0.65}>
      <title>Quest Board — Coming Soon</title>
      {/* Signpost */}
      <line x1={x} y1={y + 10} x2={x} y2={y - 15} stroke="#8B4513" strokeWidth="3" />
      <rect x={x - 15} y={y - 15} width={30} height={14} rx={2} fill="#DEB887" stroke="#8B4513" strokeWidth="1" />
      <rect x={x - 12} y={y - 5} width={24} height={10} rx={2} fill="#DEB887" stroke="#8B4513" strokeWidth="1" />
      <text x={x} y={y - 6} textAnchor="middle" fontSize="5" fill="#5C3317" fontWeight="700">QUESTS</text>
      <text x={x} y={y + 2} textAnchor="middle" fontSize="4" fill="#5C3317">BOARD</text>
      <text x={x} y={y + 26} textAnchor="middle" fontSize="8" fill="#8B6914" fontWeight="600">Quest Board</text>
    </g>
  );
}

function MentorTowerLandmark({ x, y, mentorName }: { x: number; y: number; mentorName: string | null }) {
  return (
    <g className="landmark" style={{ cursor: "pointer" }} opacity={mentorName ? 0.85 : 0.5}>
      <title>{mentorName ? `Mentor Tower — ${mentorName}` : "Mentor Tower — No mentor assigned"}</title>
      {/* Tower */}
      <rect x={x - 8} y={y - 20} width={16} height={30} rx={2} fill="#7c3aed" opacity={0.8} />
      <polygon points={`${x - 10},${y - 20} ${x},${y - 32} ${x + 10},${y - 20}`} fill="#5b21b6" />
      <rect x={x - 2} y={y - 8} width={4} height={6} rx={1} fill="#c4b5fd" />
      <circle cx={x} cy={y - 26} r={2} fill="#fbbf24" />
      {/* Window glow */}
      <rect x={x - 3} y={y - 16} width={2.5} height={3} rx={0.5} fill="#c4b5fd" opacity={0.7} />
      <rect x={x + 1} y={y - 16} width={2.5} height={3} rx={0.5} fill="#c4b5fd" opacity={0.7} />
      <text x={x} y={y + 18} textAnchor="middle" fontSize="8" fill="#5b21b6" fontWeight="600">Mentor Tower</text>
      {mentorName && (
        <text x={x} y={y + 27} textAnchor="middle" fontSize="6" fill="#7c3aed" opacity={0.7}>
          {mentorName}
        </text>
      )}
    </g>
  );
}

function AchievementShrineLandmark({ x, y, badgeCount, certCount }: { x: number; y: number; badgeCount: number; certCount: number }) {
  return (
    <g className="landmark" style={{ cursor: "pointer" }} opacity={0.7}>
      <title>Achievement Shrine — {badgeCount} badges, {certCount} certificates</title>
      {/* Temple */}
      <rect x={x - 12} y={y - 10} width={24} height={16} rx={1} fill="#fbbf24" opacity={0.8} />
      <polygon points={`${x - 15},${y - 10} ${x},${y - 22} ${x + 15},${y - 10}`} fill="#f59e0b" />
      {/* Pillars */}
      <rect x={x - 10} y={y - 10} width={3} height={16} fill="#d97706" opacity={0.6} />
      <rect x={x + 7} y={y - 10} width={3} height={16} fill="#d97706" opacity={0.6} />
      {/* Star */}
      <text x={x} y={y - 13} textAnchor="middle" fontSize="8">⭐</text>
      <text x={x} y={y + 16} textAnchor="middle" fontSize="8" fill="#92400e" fontWeight="600">Shrine</text>
      {(badgeCount + certCount) > 0 && (
        <g>
          <circle cx={x + 14} cy={y - 18} r={7} fill="#ef4444" />
          <text x={x + 14} y={y - 15} textAnchor="middle" fontSize="7" fill="white" fontWeight="700">
            {badgeCount + certCount}
          </text>
        </g>
      )}
    </g>
  );
}

function ChapterTownLandmark({ x, y, chapterName, memberCount }: { x: number; y: number; chapterName: string | null; memberCount: number }) {
  return (
    <g className="landmark" style={{ cursor: "pointer" }} opacity={chapterName ? 0.75 : 0.45}>
      <title>{chapterName ? `${chapterName} — ${memberCount} members` : "Chapter Town — Join a chapter"}</title>
      {/* Town cluster */}
      <rect x={x - 14} y={y - 8} width={10} height={12} rx={1} fill="#3b82f6" opacity={0.7} />
      <rect x={x - 2} y={y - 14} width={12} height={18} rx={1} fill="#2563eb" opacity={0.8} />
      <rect x={x + 12} y={y - 6} width={8} height={10} rx={1} fill="#60a5fa" opacity={0.6} />
      {/* Roofs */}
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
}

function SeasonalEventLandmark({ x, y, count }: { x: number; y: number; count: number }) {
  return (
    <g className="landmark" style={{ cursor: "pointer" }} opacity={count > 0 ? 0.8 : 0.45}>
      <title>{count > 0 ? `${count} active challenges & events` : "No active events"}</title>
      {/* Tent / festival */}
      <polygon points={`${x - 14},${y + 6} ${x},${y - 16} ${x + 14},${y + 6}`} fill="#ef4444" opacity={0.7} />
      <polygon points={`${x - 10},${y + 6} ${x},${y - 10} ${x + 10},${y + 6}`} fill="#fbbf24" opacity={0.5} />
      <line x1={x} y1={y - 16} x2={x} y2={y - 20} stroke="#8B4513" strokeWidth="1.5" />
      <polygon points={`${x},${y - 20} ${x + 6},${y - 18} ${x},${y - 16}`} fill="#ef4444" />
      <text x={x} y={y + 16} textAnchor="middle" fontSize="8" fill="#b91c1c" fontWeight="600">Events</text>
      {count > 0 && (
        <g>
          <circle cx={x + 12} cy={y - 14} r={7} fill="#16a34a" />
          <text x={x + 12} y={y - 11} textAnchor="middle" fontSize="7" fill="white" fontWeight="700">
            {count}
          </text>
        </g>
      )}
    </g>
  );
}

// ═══════════════════════════════════════════════════════════════
// ISLAND DETAIL PANEL
// ═══════════════════════════════════════════════════════════════

function IslandDetail({ island, onClose }: { island: PassionIsland; onClose: () => void }) {
  const theme = getTheme(island.category);
  const levelConfig = LEVEL_LABELS[island.level] ?? LEVEL_LABELS.EXPLORING;

  return (
    <div className="world-panel" style={{ borderColor: theme.gradient[0] }}>
      <button className="world-panel-close" onClick={onClose}>&times;</button>
      <div className="world-panel-header" style={{ background: `linear-gradient(135deg, ${theme.gradient[0]}, ${theme.gradient[1]})` }}>
        <span className="world-panel-emoji">{theme.emoji}</span>
        <div>
          <h3 className="world-panel-title">{island.name}</h3>
          <span className="world-panel-subtitle">
            {levelConfig.label} · Level {island.currentLevel}
            {island.isPrimary && " · Primary Passion"}
          </span>
        </div>
      </div>

      <div className="world-panel-body">
        {/* XP Bar */}
        <div className="world-stat-row">
          <span className="world-stat-label">Passion XP</span>
          <span className="world-stat-value" style={{ color: theme.accent }}>{island.xpPoints}</span>
        </div>
        <div className="world-xp-bar">
          <div
            className="world-xp-fill"
            style={{
              width: `${Math.min(100, (island.xpPoints / Math.max(island.xpPoints + 50, 100)) * 100)}%`,
              background: `linear-gradient(90deg, ${theme.gradient[0]}, ${theme.gradient[1]})`,
            }}
          />
        </div>

        {/* Stats grid */}
        <div className="world-stats-grid">
          <div className="world-mini-stat">
            <span className="world-mini-value">{island.courseCount}</span>
            <span className="world-mini-label">Courses</span>
          </div>
          <div className="world-mini-stat">
            <span className="world-mini-value">{island.badgeCount}</span>
            <span className="world-mini-label">Badges</span>
          </div>
          <div className="world-mini-stat">
            <span className="world-mini-value">{island.challengeCount}</span>
            <span className="world-mini-label">Challenges</span>
          </div>
          <div className="world-mini-stat">
            <span className="world-mini-value">{island.projectCount}</span>
            <span className="world-mini-label">Projects</span>
          </div>
        </div>

        {/* Timeline */}
        <div className="world-panel-meta">
          Started {new Date(island.startedAt).toLocaleDateString()} ·
          Last active {new Date(island.lastActiveAt).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// HUD (Heads-Up Display)
// ═══════════════════════════════════════════════════════════════

function WorldHUD({ data }: { data: WorldData }) {
  return (
    <div className="world-hud">
      {/* Player Info */}
      <div className="world-hud-player">
        <div className="world-hud-avatar">
          {data.avatarUrl ? (
            <img src={data.avatarUrl} alt="" />
          ) : (
            data.playerName.charAt(0).toUpperCase()
          )}
        </div>
        <div className="world-hud-info">
          <div className="world-hud-name">{data.playerName}</div>
          <div className="world-hud-level">
            Lv.{data.level} {data.levelTitle}
          </div>
        </div>
      </div>

      {/* XP Bar */}
      <div className="world-hud-xp">
        <div className="world-hud-xp-bar">
          <div
            className="world-hud-xp-fill"
            style={{ width: `${data.xpProgress * 100}%` }}
          />
        </div>
        <div className="world-hud-xp-text">
          {data.totalXP} XP
          {data.nextLevelTitle && (
            <span className="world-hud-xp-next">
              {data.xpForNextLevel - data.xpIntoLevel} to {data.nextLevelTitle}
            </span>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="world-hud-stats">
        <div className="world-hud-stat" title="Islands explored">
          <span className="world-hud-stat-icon">🏝️</span>
          <span>{data.islands.length}</span>
        </div>
        <div className="world-hud-stat" title="Badges earned">
          <span className="world-hud-stat-icon">🏅</span>
          <span>{data.totalBadges}</span>
        </div>
        <div className="world-hud-stat" title="Certificates">
          <span className="world-hud-stat-icon">📜</span>
          <span>{data.totalCertificates}</span>
        </div>
        <div className="world-hud-stat" title="Challenges completed">
          <span className="world-hud-stat-icon">⚔️</span>
          <span>{data.totalChallenges}</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ACTIVITY LOG
// ═══════════════════════════════════════════════════════════════

function ActivityLog({ activities }: { activities: WorldData["recentActivity"] }) {
  if (activities.length === 0) return null;

  return (
    <div className="world-activity">
      <div className="world-activity-title">Recent Activity</div>
      {activities.slice(0, 5).map((a) => (
        <div key={a.id} className="world-activity-item">
          <span className="world-activity-xp">+{a.amount} XP</span>
          <span className="world-activity-reason">{a.reason}</span>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN PASSION WORLD COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function PassionWorld({ data }: { data: WorldData }) {
  const [selectedIsland, setSelectedIsland] = useState<PassionIsland | null>(null);
  const [viewBox, setViewBox] = useState("0 0 1200 800");
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  // Compute island positions
  const positions = getIslandPositions(data.islands.length);

  // Landmark positions (around edges)
  const landmarks = {
    questBoard: { x: 100, y: 200 },
    mentorTower: { x: 1080, y: 180 },
    shrine: { x: 1050, y: 620 },
    chapterTown: { x: 120, y: 600 },
    events: { x: 600, y: 740 },
  };

  // Pan controls
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as Element).closest(".island-group, .landmark")) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      const dx = (e.clientX - dragStart.x) * 1.5;
      const dy = (e.clientY - dragStart.y) * 1.5;
      setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      setDragStart({ x: e.clientX, y: e.clientY });
    },
    [isDragging, dragStart],
  );

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  // Update viewBox based on offset
  useEffect(() => {
    setViewBox(`${-offset.x} ${-offset.y} 1200 800`);
  }, [offset]);

  return (
    <div className="passion-world">
      {/* HUD */}
      <WorldHUD data={data} />

      {/* Activity Log */}
      <ActivityLog activities={data.recentActivity} />

      {/* Back to Dashboard */}
      <Link href="/" className="world-back-btn">
        &larr; Dashboard
      </Link>

      {/* The Map */}
      <svg
        ref={svgRef}
        viewBox={viewBox}
        className="world-svg"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <defs>
          {/* Ocean gradient */}
          <linearGradient id="ocean" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0c4a6e" />
            <stop offset="40%" stopColor="#0369a1" />
            <stop offset="100%" stopColor="#0284c7" />
          </linearGradient>
          {/* Star sparkle filter */}
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Water pattern */}
          <pattern id="waterPattern" width="60" height="60" patternUnits="userSpaceOnUse">
            <circle cx="30" cy="30" r="1" fill="rgba(255,255,255,0.06)" />
            <circle cx="10" cy="10" r="0.5" fill="rgba(255,255,255,0.04)" />
            <circle cx="50" cy="15" r="0.8" fill="rgba(255,255,255,0.05)" />
          </pattern>
        </defs>

        {/* Ocean */}
        <rect x="-400" y="-400" width="2000" height="1600" fill="url(#ocean)" />
        <rect x="-400" y="-400" width="2000" height="1600" fill="url(#waterPattern)" />

        {/* Waves */}
        <WaveLayer y={760} color="#0ea5e9" speed={12} id="wave1" />
        <WaveLayer y={775} color="#38bdf8" speed={15} id="wave2" />
        <WaveLayer y={790} color="#7dd3fc" speed={18} id="wave3" />

        {/* Clouds */}
        <Cloud x={50} y={60} scale={0.8} />
        <Cloud x={400} y={40} scale={1.1} />
        <Cloud x={750} y={70} scale={0.9} />
        <Cloud x={1050} y={50} scale={0.7} />

        {/* Compass rose */}
        <g transform="translate(60, 80)" opacity={0.3}>
          <circle cx="0" cy="0" r="20" fill="none" stroke="#fbbf24" strokeWidth="1" />
          <line x1="0" y1="-22" x2="0" y2="22" stroke="#fbbf24" strokeWidth="0.5" />
          <line x1="-22" y1="0" x2="22" y2="0" stroke="#fbbf24" strokeWidth="0.5" />
          <text x="0" y="-25" textAnchor="middle" fontSize="8" fill="#fbbf24" fontWeight="700">N</text>
        </g>

        {/* Connection lines between islands (bridges/paths) */}
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

        {/* Landmarks */}
        <QuestBoardLandmark x={landmarks.questBoard.x} y={landmarks.questBoard.y} />
        <MentorTowerLandmark
          x={landmarks.mentorTower.x}
          y={landmarks.mentorTower.y}
          mentorName={data.mentorName}
        />
        <AchievementShrineLandmark
          x={landmarks.shrine.x}
          y={landmarks.shrine.y}
          badgeCount={data.totalBadges}
          certCount={data.totalCertificates}
        />
        <ChapterTownLandmark
          x={landmarks.chapterTown.x}
          y={landmarks.chapterTown.y}
          chapterName={data.chapterName}
          memberCount={data.chapterMemberCount}
        />
        <SeasonalEventLandmark
          x={landmarks.events.x}
          y={landmarks.events.y}
          count={data.activeChallenges + data.upcomingEventCount}
        />

        {/* Empty state — if no passions yet */}
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

        {/* Islands */}
        {data.islands.map((island, i) => (
          <Island
            key={island.id}
            island={island}
            x={positions[i]?.x ?? 600}
            y={positions[i]?.y ?? 400}
            index={i}
            isSelected={selectedIsland?.id === island.id}
            onSelect={() =>
              setSelectedIsland(
                selectedIsland?.id === island.id ? null : island,
              )
            }
          />
        ))}

        {/* World title */}
        <text x="600" y="30" textAnchor="middle" fontSize="14" fill="rgba(255,255,255,0.35)" fontWeight="700" letterSpacing="3">
          THE PASSION WORLD
        </text>
      </svg>

      {/* Island Detail Panel */}
      {selectedIsland && (
        <IslandDetail
          island={selectedIsland}
          onClose={() => setSelectedIsland(null)}
        />
      )}

      {/* Inline Styles */}
      <style>{`
        .passion-world {
          position: relative;
          width: 100%;
          height: 100vh;
          overflow: hidden;
          background: #0c4a6e;
          user-select: none;
        }

        .world-svg {
          width: 100%;
          height: 100%;
          cursor: grab;
        }
        .world-svg:active {
          cursor: grabbing;
        }

        /* ── HUD ── */
        .world-hud {
          position: absolute;
          top: 16px;
          left: 16px;
          z-index: 10;
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 10px 16px;
          background: rgba(15, 23, 42, 0.85);
          backdrop-filter: blur(12px);
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.1);
          color: white;
        }
        .world-hud-player {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .world-hud-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: linear-gradient(135deg, #8b5cf6, #6366f1);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 16px;
          overflow: hidden;
          border: 2px solid rgba(255,255,255,0.2);
        }
        .world-hud-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .world-hud-name {
          font-weight: 700;
          font-size: 13px;
        }
        .world-hud-level {
          font-size: 11px;
          color: #94a3b8;
        }
        .world-hud-xp {
          min-width: 160px;
        }
        .world-hud-xp-bar {
          width: 100%;
          height: 6px;
          background: rgba(255,255,255,0.1);
          border-radius: 3px;
          overflow: hidden;
        }
        .world-hud-xp-fill {
          height: 100%;
          background: linear-gradient(90deg, #fbbf24, #f59e0b);
          border-radius: 3px;
          transition: width 0.6s ease;
        }
        .world-hud-xp-text {
          font-size: 10px;
          color: #94a3b8;
          margin-top: 3px;
          display: flex;
          justify-content: space-between;
        }
        .world-hud-xp-next {
          color: #64748b;
        }
        .world-hud-stats {
          display: flex;
          gap: 12px;
          padding-left: 12px;
          border-left: 1px solid rgba(255,255,255,0.1);
        }
        .world-hud-stat {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          color: #cbd5e1;
        }
        .world-hud-stat-icon {
          font-size: 14px;
        }

        /* ── Back button ── */
        .world-back-btn {
          position: absolute;
          bottom: 16px;
          left: 16px;
          z-index: 10;
          padding: 8px 16px;
          background: rgba(15, 23, 42, 0.85);
          backdrop-filter: blur(12px);
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.1);
          color: #94a3b8;
          font-size: 12px;
          text-decoration: none;
          transition: color 0.2s;
        }
        .world-back-btn:hover {
          color: white;
        }

        /* ── Activity Log ── */
        .world-activity {
          position: absolute;
          bottom: 16px;
          right: 16px;
          z-index: 10;
          width: 220px;
          padding: 12px;
          background: rgba(15, 23, 42, 0.85);
          backdrop-filter: blur(12px);
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.1);
          color: white;
        }
        .world-activity-title {
          font-size: 11px;
          font-weight: 700;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }
        .world-activity-item {
          display: flex;
          gap: 8px;
          align-items: baseline;
          padding: 4px 0;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          font-size: 11px;
        }
        .world-activity-item:last-child {
          border-bottom: none;
        }
        .world-activity-xp {
          color: #fbbf24;
          font-weight: 700;
          white-space: nowrap;
        }
        .world-activity-reason {
          color: #94a3b8;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* ── Island Detail Panel ── */
        .world-panel {
          position: absolute;
          top: 80px;
          right: 16px;
          z-index: 20;
          width: 280px;
          background: rgba(15, 23, 42, 0.92);
          backdrop-filter: blur(16px);
          border-radius: 14px;
          border: 2px solid;
          overflow: hidden;
          color: white;
          animation: panelSlideIn 0.25s ease;
        }
        @keyframes panelSlideIn {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .world-panel-close {
          position: absolute;
          top: 8px;
          right: 10px;
          background: none;
          border: none;
          color: rgba(255,255,255,0.6);
          font-size: 20px;
          cursor: pointer;
          z-index: 1;
          line-height: 1;
        }
        .world-panel-close:hover {
          color: white;
        }
        .world-panel-header {
          padding: 16px;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .world-panel-emoji {
          font-size: 28px;
        }
        .world-panel-title {
          font-size: 16px;
          font-weight: 700;
          margin: 0;
          color: white;
        }
        .world-panel-subtitle {
          font-size: 11px;
          color: rgba(255,255,255,0.7);
        }
        .world-panel-body {
          padding: 16px;
        }
        .world-stat-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
        }
        .world-stat-label {
          font-size: 12px;
          color: #94a3b8;
        }
        .world-stat-value {
          font-size: 16px;
          font-weight: 700;
        }
        .world-xp-bar {
          width: 100%;
          height: 8px;
          background: rgba(255,255,255,0.1);
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 16px;
        }
        .world-xp-fill {
          height: 100%;
          border-radius: 4px;
          transition: width 0.5s ease;
        }
        .world-stats-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-bottom: 12px;
        }
        .world-mini-stat {
          padding: 8px;
          background: rgba(255,255,255,0.05);
          border-radius: 8px;
          text-align: center;
        }
        .world-mini-value {
          display: block;
          font-size: 18px;
          font-weight: 700;
          color: white;
        }
        .world-mini-label {
          display: block;
          font-size: 10px;
          color: #64748b;
          margin-top: 2px;
        }
        .world-panel-meta {
          font-size: 10px;
          color: #64748b;
          text-align: center;
          padding-top: 8px;
          border-top: 1px solid rgba(255,255,255,0.06);
        }

        /* ── Responsive ── */
        @media (max-width: 768px) {
          .world-hud {
            flex-wrap: wrap;
            gap: 8px;
            padding: 8px 12px;
            max-width: calc(100% - 32px);
          }
          .world-hud-stats {
            border-left: none;
            padding-left: 0;
            gap: 8px;
          }
          .world-hud-xp {
            min-width: 120px;
          }
          .world-panel {
            width: calc(100% - 32px);
            top: auto;
            bottom: 60px;
            right: 16px;
          }
          .world-activity {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
