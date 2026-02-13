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
}

export const WorldHUD = memo(function WorldHUD({ data, soundEnabled, onToggleSound }: WorldHUDProps) {
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
      <div className={styles.hud}>
        {/* Player identity */}
        <div className={styles.hudPlayer}>
          <div className={`${styles.hudAvatar} ${showLevelUp ? styles.hudAvatarGlow : ""}`}>
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

        {/* XP bar */}
        <div className={styles.hudXp}>
          <div className={styles.hudXpBar}>
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

        {/* Stats row */}
        <div className={styles.hudStats}>
          <div className={styles.hudStat} title="Islands explored">
            <span className={styles.hudStatIcon}>{"\u{1F3DD}\uFE0F"}</span>
            <span>{data.islands.length}</span>
          </div>
          <div className={styles.hudStat} title="Badges earned">
            <span className={styles.hudStatIcon}>{"\u{1F3C5}"}</span>
            <span>{data.totalBadges}</span>
          </div>
          <div className={styles.hudStat} title="Certificates">
            <span className={styles.hudStatIcon}>{"\u{1F4DC}"}</span>
            <span>{data.totalCertificates}</span>
          </div>
          <div className={styles.hudStat} title="Challenges completed">
            <span className={styles.hudStatIcon}>{"\u2694\uFE0F"}</span>
            <span>{data.totalChallenges}</span>
          </div>
          <div className={styles.hudStat} title="Projects">
            <span className={styles.hudStatIcon}>{"\u{1F680}"}</span>
            <span>{data.totalProjects}</span>
          </div>
          {onToggleSound && (
            <button
              className={styles.hudSoundBtn}
              onClick={onToggleSound}
              title={soundEnabled ? "Mute" : "Unmute"}
            >
              {soundEnabled ? "\u{1F50A}" : "\u{1F507}"}
            </button>
          )}
        </div>
      </div>

      {/* Level-up ceremony overlay */}
      {showLevelUp && (
        <div className={styles.levelUpOverlay}>
          <div className={styles.levelUpContent}>
            <div className={styles.levelUpIcon}>{"\u2B50"}</div>
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
