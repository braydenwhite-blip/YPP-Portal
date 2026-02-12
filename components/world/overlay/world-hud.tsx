"use client";

import { memo } from "react";
import type { WorldData } from "@/lib/world-actions";
import styles from "../passion-world.module.css";

export const WorldHUD = memo(function WorldHUD({ data }: { data: WorldData }) {
  return (
    <div className={styles.hud}>
      <div className={styles.hudPlayer}>
        <div className={styles.hudAvatar}>
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

      <div className={styles.hudXp}>
        <div className={styles.hudXpBar}>
          <div
            className={styles.hudXpFill}
            style={{ width: `${data.xpProgress * 100}%` }}
          />
        </div>
        <div className={styles.hudXpText}>
          {data.totalXP} XP
          {data.nextLevelTitle && (
            <span className={styles.hudXpNext}>
              {data.xpForNextLevel - data.xpIntoLevel} to{" "}
              {data.nextLevelTitle}
            </span>
          )}
        </div>
      </div>

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
      </div>
    </div>
  );
});
