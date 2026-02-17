"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { PassionIsland } from "@/lib/world-actions";
import type { WorldData } from "@/lib/world-actions";
import { LEVEL_LABELS, getTheme } from "../constants";
import styles from "../passion-world.module.css";

// ═══════════════════════════════════════════════════════════════
// Enhanced Island Detail Panel — Level ring, stats, activity
// ═══════════════════════════════════════════════════════════════

const LEVEL_ORDER = ["EXPLORING", "DEVELOPING", "ADVANCING", "MASTERING"];

function getLevelProgress(level: string): number {
  const idx = LEVEL_ORDER.indexOf(level);
  if (idx === -1) return 0;
  return (idx + 1) / LEVEL_ORDER.length;
}

function daysSince(date: Date): number {
  const now = new Date();
  return Math.max(0, Math.floor((now.getTime() - new Date(date).getTime()) / 86_400_000));
}

function formatRelative(date: Date): string {
  const days = daysSince(date);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

/** SVG level progress ring */
function LevelRing({
  progress,
  color,
  size = 56,
  strokeWidth = 4,
  children,
}: {
  progress: number;
  color: string;
  size?: number;
  strokeWidth?: number;
  children?: React.ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);

  return (
    <div className={styles.levelRingContainer} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
        />
        {/* Progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className={styles.levelRingInner}>
        {children}
      </div>
    </div>
  );
}

export function IslandDetail({
  island,
  data,
  onClose,
}: {
  island: PassionIsland;
  data?: WorldData;
  onClose: () => void;
}) {
  const theme = getTheme(island.category);
  const levelConfig = LEVEL_LABELS[island.level] ?? LEVEL_LABELS.EXPLORING;
  const levelProgress = getLevelProgress(island.level);
  const age = daysSince(island.startedAt);

  // Filter recent activity for this island
  const islandActivity = useMemo(() => {
    if (!data?.recentActivity) return [];
    return data.recentActivity
      .filter((a) => a.passionId === island.passionId)
      .slice(0, 5);
  }, [data?.recentActivity, island.passionId]);

  // XP needed estimate: use a curve based on current level
  const levelIdx = LEVEL_ORDER.indexOf(island.level);
  const xpThresholds = [0, 100, 300, 600, 1000];
  const xpCurrent = island.xpPoints;
  const xpNextLevel = xpThresholds[Math.min(levelIdx + 1, xpThresholds.length - 1)] || xpCurrent + 100;
  const xpPrevLevel = xpThresholds[levelIdx] || 0;
  const xpInLevel = Math.max(0, xpCurrent - xpPrevLevel);
  const xpNeeded = Math.max(1, xpNextLevel - xpPrevLevel);
  const xpBarPct = Math.min(100, (xpInLevel / xpNeeded) * 100);

  // Total stats
  const totalItems = island.courseCount + island.badgeCount + island.challengeCount + island.projectCount;

  return (
    <div
      className={styles.panel}
      style={{ borderColor: theme.gradient[0] }}
      role="dialog"
      aria-label={`${island.name} island details`}
      aria-modal="false"
    >
      {/* Drag handle for mobile bottom sheet */}
      <div className={styles.panelDragHandle} aria-hidden="true">
        <div className={styles.panelDragBar} />
      </div>
      <button className={styles.panelClose} onClick={onClose} aria-label="Close island details">
        &times;
      </button>

      {/* ── Header with level ring ── */}
      <div
        className={styles.panelHeader}
        style={{
          background: `linear-gradient(135deg, ${theme.gradient[0]}, ${theme.gradient[1]})`,
        }}
      >
        <LevelRing progress={levelProgress} color="rgba(255,255,255,0.9)">
          <span className={styles.levelRingEmoji}>{theme.emoji}</span>
        </LevelRing>
        <div>
          <h3 className={styles.panelTitle}>{island.name}</h3>
          <span className={styles.panelSubtitle}>
            {levelConfig.label} · Level {island.currentLevel}
            {island.isPrimary && " · Primary"}
          </span>
        </div>
      </div>

      <div className={styles.panelBody}>
        {/* ── XP Progress ── */}
        <div className={styles.statRow}>
          <span className={styles.statLabel}>Passion XP</span>
          <span className={styles.statValue} style={{ color: theme.accent }}>
            {island.xpPoints.toLocaleString()}
          </span>
        </div>
        <div className={styles.xpBar}>
          <div
            className={styles.xpFill}
            style={{
              width: `${xpBarPct}%`,
              background: `linear-gradient(90deg, ${theme.gradient[0]}, ${theme.gradient[1]})`,
            }}
          />
        </div>
        <div className={styles.islandXpLabel}>
          {levelIdx < LEVEL_ORDER.length - 1 ? (
            <>{Math.max(0, xpNextLevel - xpCurrent).toLocaleString()} XP to {LEVEL_LABELS[LEVEL_ORDER[levelIdx + 1]]?.label}</>
          ) : (
            <>Mastery achieved</>
          )}
        </div>

        {/* ── Level Milestones ── */}
        <div className={styles.levelMilestones}>
          {LEVEL_ORDER.map((lvl, i) => {
            const cfg = LEVEL_LABELS[lvl];
            const isActive = i <= levelIdx;
            return (
              <div
                key={lvl}
                className={`${styles.milestone} ${isActive ? styles.milestoneActive : ""}`}
                style={isActive ? { borderColor: theme.gradient[0], color: theme.gradient[0] } : undefined}
              >
                <div className={styles.milestoneDot} style={isActive ? { background: theme.gradient[0] } : undefined} />
                <span>{cfg.label}</span>
              </div>
            );
          })}
        </div>

        {/* ── Stats Grid ── */}
        <div className={styles.statsGrid}>
          <div className={styles.miniStat}>
            <span className={styles.miniValue}>{island.courseCount}</span>
            <span className={styles.miniLabel}>Courses</span>
          </div>
          <div className={styles.miniStat}>
            <span className={styles.miniValue}>{island.badgeCount}</span>
            <span className={styles.miniLabel}>Badges</span>
          </div>
          <div className={styles.miniStat}>
            <span className={styles.miniValue}>{island.challengeCount}</span>
            <span className={styles.miniLabel}>Challenges</span>
          </div>
          <div className={styles.miniStat}>
            <span className={styles.miniValue}>{island.projectCount}</span>
            <span className={styles.miniLabel}>Projects</span>
          </div>
        </div>

        {/* ── Progress bar for total items ── */}
        {totalItems > 0 && (
          <div className={styles.islandProgressSection}>
            <div className={styles.islandProgressHeader}>
              <span>Total Activities</span>
              <span style={{ color: theme.accent, fontWeight: 700 }}>{totalItems}</span>
            </div>
            <div className={styles.islandProgressTrack}>
              {island.courseCount > 0 && (
                <div
                  className={styles.islandProgressSegment}
                  style={{
                    width: `${(island.courseCount / totalItems) * 100}%`,
                    background: theme.gradient[0],
                  }}
                  title={`${island.courseCount} courses`}
                />
              )}
              {island.badgeCount > 0 && (
                <div
                  className={styles.islandProgressSegment}
                  style={{
                    width: `${(island.badgeCount / totalItems) * 100}%`,
                    background: theme.gradient[1],
                  }}
                  title={`${island.badgeCount} badges`}
                />
              )}
              {island.challengeCount > 0 && (
                <div
                  className={styles.islandProgressSegment}
                  style={{
                    width: `${(island.challengeCount / totalItems) * 100}%`,
                    background: theme.accent,
                  }}
                  title={`${island.challengeCount} challenges`}
                />
              )}
              {island.projectCount > 0 && (
                <div
                  className={styles.islandProgressSegment}
                  style={{
                    width: `${(island.projectCount / totalItems) * 100}%`,
                    background: theme.terrain,
                  }}
                  title={`${island.projectCount} projects`}
                />
              )}
            </div>
            <div className={styles.islandProgressLegend}>
              <span style={{ color: theme.gradient[0] }}>Courses</span>
              <span style={{ color: theme.gradient[1] }}>Badges</span>
              <span style={{ color: theme.accent }}>Challenges</span>
              <span style={{ color: theme.terrain }}>Projects</span>
            </div>
          </div>
        )}

        {/* ── Recent Activity Timeline ── */}
        {islandActivity.length > 0 && (
          <div className={styles.landmarkSection}>
            <div className={styles.landmarkSectionTitle}>Recent Activity</div>
            <div className={styles.islandTimeline}>
              {islandActivity.map((a) => (
                <div key={a.id} className={styles.timelineItem}>
                  <div
                    className={styles.timelineDot}
                    style={{ background: theme.gradient[0] }}
                  />
                  <div className={styles.timelineContent}>
                    <span className={styles.timelineReason}>{a.reason}</span>
                    <span className={styles.timelineXp}>+{a.amount} XP</span>
                  </div>
                  <span className={styles.timelineTime}>
                    {formatRelative(a.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Island Meta ── */}
        <div className={styles.islandMetaGrid}>
          <div className={styles.islandMetaItem}>
            <span className={styles.islandMetaLabel}>Island Age</span>
            <span className={styles.islandMetaValue}>
              {age === 0 ? "Today" : age === 1 ? "1 day" : `${age} days`}
            </span>
          </div>
          <div className={styles.islandMetaItem}>
            <span className={styles.islandMetaLabel}>Last Active</span>
            <span className={styles.islandMetaValue}>{formatRelative(island.lastActiveAt)}</span>
          </div>
          <div className={styles.islandMetaItem}>
            <span className={styles.islandMetaLabel}>Category</span>
            <span className={styles.islandMetaValue} style={{ color: theme.accent }}>
              {island.category.replace(/_/g, " ")}
            </span>
          </div>
          <div className={styles.islandMetaItem}>
            <span className={styles.islandMetaLabel}>Certificates</span>
            <span className={styles.islandMetaValue}>{island.certificateCount}</span>
          </div>
        </div>

        {/* ── Grow This Island ── */}
        <div className={styles.landmarkSection}>
          <div className={styles.landmarkSectionTitle}>Grow This Island</div>
          <div className={styles.panelActions}>
            <Link href="/courses/recommended" className={styles.panelLink}>
              <span className={styles.panelLinkIcon}>{"\u{1F4DA}"}</span>
              <span className={styles.panelLinkText}>
                {island.category.replace(/_/g, " ")} Courses
              </span>
              <span className={styles.panelLinkArrow}>&rarr;</span>
            </Link>
            <Link href="/challenges" className={styles.panelLink}>
              <span className={styles.panelLinkIcon}>{"\u{1F3AF}"}</span>
              <span className={styles.panelLinkText}>Take a Challenge (+XP)</span>
              <span className={styles.panelLinkArrow}>&rarr;</span>
            </Link>
            <Link href="/activities" className={styles.panelLink}>
              <span className={styles.panelLinkIcon}>{"\u{1F9ED}"}</span>
              <span className={styles.panelLinkText}>Activity Hub</span>
              <span className={styles.panelLinkArrow}>&rarr;</span>
            </Link>
            <Link href="/discover/try-it" className={styles.panelLink}>
              <span className={styles.panelLinkIcon}>{"\u{1F9EA}"}</span>
              <span className={styles.panelLinkText}>Try-It Activities</span>
              <span className={styles.panelLinkArrow}>&rarr;</span>
            </Link>
            <Link href="/incubator" className={styles.panelLink}>
              <span className={styles.panelLinkIcon}>{"\u{1F680}"}</span>
              <span className={styles.panelLinkText}>Incubator Projects</span>
              <span className={styles.panelLinkArrow}>&rarr;</span>
            </Link>
            <Link href="/pathways" className={styles.panelLink}>
              <span className={styles.panelLinkIcon}>{"\u{1F5FA}\uFE0F"}</span>
              <span className={styles.panelLinkText}>Learning Pathways</span>
              <span className={styles.panelLinkArrow}>&rarr;</span>
            </Link>
          </div>
        </div>

        {/* ── Your Progress ── */}
        <div className={styles.landmarkSection}>
          <div className={styles.landmarkSectionTitle}>Your Progress</div>
          <div className={styles.panelActions}>
            <Link href="/badges" className={styles.panelLink}>
              <span className={styles.panelLinkIcon}>{"\u{1F3C5}"}</span>
              <span className={styles.panelLinkText}>{island.badgeCount} Badge{island.badgeCount !== 1 ? "s" : ""} Earned</span>
              <span className={styles.panelLinkArrow}>&rarr;</span>
            </Link>
            <Link href="/certificates" className={styles.panelLink}>
              <span className={styles.panelLinkIcon}>{"\u{1F4DC}"}</span>
              <span className={styles.panelLinkText}>{island.certificateCount} Certificate{island.certificateCount !== 1 ? "s" : ""}</span>
              <span className={styles.panelLinkArrow}>&rarr;</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
