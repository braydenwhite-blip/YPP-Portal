"use client";

import { memo, useState, useEffect, useRef } from "react";
import type { WorldData } from "@/lib/world-actions";
import styles from "../passion-world.module.css";

// ═══════════════════════════════════════════════════════════════
// Enhanced World HUD — Avatar, XP, stats + level-up ceremony
// ═══════════════════════════════════════════════════════════════

interface WorldHUDProps {
  data: WorldData;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const WorldHUD = memo(function WorldHUD({ data, soundEnabled, onToggleSound, isCollapsed, onToggleCollapse }: WorldHUDProps) {
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [xpFlash, setXpFlash] = useState(false);
  const prevXpRef = useRef(data.totalXP);
  const prevLevelRef = useRef(data.level);

  // Detect level-up or XP gain
  useEffect(() => {
    if (data.level > prevLevelRef.current) {
      setShowLevelUp(true);
      const timer = setTimeout(() => setShowLevelUp(false), 4000);
      prevLevelRef.current = data.level;
      return () => clearTimeout(timer);
    }
    prevLevelRef.current = data.level;
  }, [data.level]);

  useEffect(() => {
    if (data.totalXP > prevXpRef.current) {
      setXpFlash(true);
      const timer = setTimeout(() => setXpFlash(false), 800);
      prevXpRef.current = data.totalXP;
      return () => clearTimeout(timer);
    }
    prevXpRef.current = data.totalXP;
  }, [data.totalXP]);

  return (
    <>
      <div className={`${styles.hud} ${isCollapsed ? styles.hudCollapsed : ""}`} role="status" aria-live="polite" aria-label="Player status">
        {/* Collapse toggle (mobile) */}
        {onToggleCollapse && (
          <button
            className={styles.hudCollapseBtn}
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? "Expand HUD" : "Collapse HUD"}
            aria-expanded={!isCollapsed}
          >
            {isCollapsed ? "\u25BC" : "\u25B2"}
          </button>
        )}

        {/* Player identity */}
        <div className={styles.hudPlayer}>
          <div className={`${styles.hudAvatar} ${showLevelUp ? styles.hudAvatarGlow : ""}`} role="img" aria-label={`${data.playerName} avatar`}>
            {data.avatarUrl ? (
              <img src={data.avatarUrl} alt={data.playerName} />
            ) : (
              data.playerName.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <div className={styles.hudName}>{data.playerName}</div>
            <div className={styles.hudLevel}>
              Lv.{data.level} {data.levelTitle}
            </div>
          </div>
        </div>

        {/* XP bar (hidden when collapsed) */}
        {!isCollapsed && (
          <div className={styles.hudXp} aria-label={`${data.totalXP.toLocaleString()} XP, ${Math.round(data.xpProgress * 100)}% to next level`}>
            <div className={styles.hudXpBar} role="progressbar" aria-valuenow={Math.round(data.xpProgress * 100)} aria-valuemin={0} aria-valuemax={100}>
              <div
                className={`${styles.hudXpFill} ${xpFlash ? styles.hudXpFlash : ""}`}
                style={{ width: `${data.xpProgress * 100}%` }}
              />
            </div>
            <div className={styles.hudXpText}>
              <span className={xpFlash ? styles.hudXpPulse : ""}>
                {data.totalXP.toLocaleString()} XP
              </span>
              {data.nextLevelTitle && (
                <span className={styles.hudXpNext}>
                  {(data.xpForNextLevel - data.xpIntoLevel).toLocaleString()} to{" "}
                  {data.nextLevelTitle}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Stats row (hidden when collapsed) */}
        {!isCollapsed && (
          <div className={styles.hudStats} role="group" aria-label="Player statistics">
            <div className={styles.hudStat} title="Islands explored" aria-label={`${data.islands.length} islands explored`}>
              <span className={styles.hudStatIcon} aria-hidden="true">{"\u{1F3DD}\uFE0F"}</span>
              <span>{data.islands.length}</span>
            </div>
            <div className={styles.hudStat} title="Badges earned" aria-label={`${data.totalBadges} badges earned`}>
              <span className={styles.hudStatIcon} aria-hidden="true">{"\u{1F3C5}"}</span>
              <span>{data.totalBadges}</span>
            </div>
            <div className={styles.hudStat} title="Certificates" aria-label={`${data.totalCertificates} certificates`}>
              <span className={styles.hudStatIcon} aria-hidden="true">{"\u{1F4DC}"}</span>
              <span>{data.totalCertificates}</span>
            </div>
            <div className={styles.hudStat} title="Challenges completed" aria-label={`${data.totalChallenges} challenges completed`}>
              <span className={styles.hudStatIcon} aria-hidden="true">{"\u2694\uFE0F"}</span>
              <span>{data.totalChallenges}</span>
            </div>
            <div className={styles.hudStat} title="Projects" aria-label={`${data.totalProjects} projects`}>
              <span className={styles.hudStatIcon} aria-hidden="true">{"\u{1F680}"}</span>
              <span>{data.totalProjects}</span>
            </div>
            {onToggleSound && (
              <button
                className={styles.hudSoundBtn}
                onClick={onToggleSound}
                aria-label={soundEnabled ? "Mute sounds" : "Enable sounds"}
                title={soundEnabled ? "Mute" : "Unmute"}
              >
                {soundEnabled ? "\u{1F50A}" : "\u{1F507}"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Level-up ceremony overlay */}
      {showLevelUp && (
        <div className={styles.levelUpOverlay} role="alert" aria-live="assertive">
          <div className={styles.levelUpContent}>
            <div className={styles.levelUpIcon} aria-hidden="true">{"\u2B50"}</div>
            <div className={styles.levelUpTitle}>Level Up!</div>
            <div className={styles.levelUpLevel}>
              Level {data.level} — {data.levelTitle}
            </div>
            <div className={styles.levelUpMessage}>
              Your world grows stronger
            </div>
          </div>
        </div>
      )}
    </>
  );
});
