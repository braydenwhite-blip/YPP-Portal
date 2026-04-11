"use client";

import { useState } from "react";
import styles from "./personalization-page.module.css";

export default function PersonalizationSettingsClient() {
  const [settings, setSettings] = useState({
    dashboardLayout: "default",
    showXPProgress: true,
    showStreaks: true,
    showUpcomingEvents: true,
    showPeerActivity: true,
    autoPlayVideos: false,
    videoQuality: "auto",
    showProfilePublicly: true,
    showProgressToClassmates: true,
    allowPeerMessages: true,
  });

  const handleChange = (field: string, value: unknown) => {
    setSettings({ ...settings, [field]: value });
  };

  return (
    <div id="preferences" className={styles.prefStack}>
      <div className={styles.prefCard}>
        <div className={styles.prefCardHead}>
          <div className={styles.prefIcon} aria-hidden>
            ▣
          </div>
          <div>
            <h3>Dashboard layout</h3>
            <p className={styles.prefLead}>Choose a density and what appears on your home view.</p>
          </div>
        </div>
        <div className={styles.prefCardBody}>
          <span className={styles.prefLabel}>Layout style</span>
          <div className={styles.layoutGrid}>
            {[
              { value: "default", label: "Default", desc: "Balanced view with all sections" },
              { value: "minimal", label: "Minimal", desc: "Clean and simple" },
              { value: "detailed", label: "Detailed", desc: "Show everything" },
            ].map((layout) => (
              <button
                key={layout.value}
                type="button"
                onClick={() => handleChange("dashboardLayout", layout.value)}
                className={`${styles.layoutOption} ${
                  settings.dashboardLayout === layout.value ? styles.layoutOptionSelected : ""
                }`}
              >
                <div className={styles.layoutOptionTitle}>{layout.label}</div>
                <div className={styles.layoutOptionDesc}>{layout.desc}</div>
              </button>
            ))}
          </div>

          <div className={styles.prefDivider}>
            <h4 className={styles.prefSubheading}>Show on dashboard</h4>
            <div className={styles.toggleList}>
              {[
                { field: "showXPProgress", label: "XP and level progress" },
                { field: "showStreaks", label: "Practice streaks" },
                { field: "showUpcomingEvents", label: "Upcoming events" },
                { field: "showPeerActivity", label: "Classmate activity feed" },
              ].map((option) => (
                <label key={option.field} className={styles.toggleRow}>
                  <input
                    type="checkbox"
                    checked={settings[option.field as keyof typeof settings] as boolean}
                    onChange={(e) => handleChange(option.field, e.target.checked)}
                  />
                  <span className={styles.toggleText}>
                    <strong>{option.label}</strong>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.prefCard}>
        <div className={styles.prefCardHead}>
          <div className={styles.prefIcon} aria-hidden>
            ▶
          </div>
          <div>
            <h3>Content</h3>
            <p className={styles.prefLead}>How videos and media behave in the portal.</p>
          </div>
        </div>
        <div className={styles.prefCardBody}>
          <label className={styles.toggleRow}>
            <input
              type="checkbox"
              checked={settings.autoPlayVideos}
              onChange={(e) => handleChange("autoPlayVideos", e.target.checked)}
            />
            <span className={styles.toggleText}>
              <strong>Auto-play videos</strong>
              <span>Videos start when you open them (uses more data).</span>
            </span>
          </label>

          <div className={styles.prefDivider}>
            <label className={styles.prefLabel} htmlFor="video-quality">
              Video quality
            </label>
            <select
              id="video-quality"
              className={styles.selectField}
              value={settings.videoQuality}
              onChange={(e) => handleChange("videoQuality", e.target.value)}
            >
              <option value="auto">Auto (recommended)</option>
              <option value="high">High (1080p)</option>
              <option value="medium">Medium (720p)</option>
              <option value="low">Low (480p)</option>
            </select>
          </div>
        </div>
      </div>

      <div className={`${styles.prefCard} ${styles.noteCard}`}>
        <div className={styles.prefCardHead}>
          <div className={styles.prefIcon} aria-hidden>
            🔔
          </div>
          <div>
            <h3>Notifications</h3>
            <p className={styles.prefLead}>How alerts are delivered across the platform.</p>
          </div>
        </div>
        <div className={styles.prefCardBody}>
          <p className={styles.noteBody}>
            Notification delivery follows one portal-wide policy instead of individual toggles here.
          </p>
          <p className={styles.noteBody}>
            Reminders stay in the app; email updates go out automatically; urgent alerts can use SMS when text support
            is enabled.
          </p>
        </div>
      </div>

      <div className={styles.prefCard}>
        <div className={styles.prefCardHead}>
          <div className={styles.prefIcon} aria-hidden>
            ◎
          </div>
          <div>
            <h3>Privacy</h3>
            <p className={styles.prefLead}>Who can see your profile and progress.</p>
          </div>
        </div>
        <div className={styles.prefCardBody}>
          <div className={styles.toggleList}>
            <label className={styles.toggleRow}>
              <input
                type="checkbox"
                checked={settings.showProfilePublicly}
                onChange={(e) => handleChange("showProfilePublicly", e.target.checked)}
              />
              <span className={styles.toggleText}>
                <strong>Show profile publicly</strong>
                <span>Profile and portfolio can be viewed by anyone with the link.</span>
              </span>
            </label>

            <label className={styles.toggleRow}>
              <input
                type="checkbox"
                checked={settings.showProgressToClassmates}
                onChange={(e) => handleChange("showProgressToClassmates", e.target.checked)}
              />
              <span className={styles.toggleText}>
                <strong>Share progress with classmates</strong>
                <span>Others in your classes can see achievements and milestones.</span>
              </span>
            </label>

            <label className={styles.toggleRow}>
              <input
                type="checkbox"
                checked={settings.allowPeerMessages}
                onChange={(e) => handleChange("allowPeerMessages", e.target.checked)}
              />
              <span className={styles.toggleText}>
                <strong>Allow peer messages</strong>
                <span>Other students can send you direct messages.</span>
              </span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
