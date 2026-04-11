"use client";

import { useState } from "react";

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
    <div id="preferences">
      <div className="card" style={{ marginBottom: 28 }}>
        <h3>Customize your experience</h3>
        <p>
          Adjust these settings to make YPP Portal work best for you. Changes are saved automatically.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 20 }}>Dashboard Layout</h3>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: "block", marginBottom: 12, fontWeight: 600 }}>Layout Style</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            {[
              { value: "default", label: "Default", desc: "Balanced view with all sections" },
              { value: "minimal", label: "Minimal", desc: "Clean and simple" },
              { value: "detailed", label: "Detailed", desc: "Show everything" },
            ].map((layout) => (
              <div
                key={layout.value}
                onClick={() => handleChange("dashboardLayout", layout.value)}
                style={{
                  padding: 16,
                  border: "2px solid var(--border-color)",
                  borderRadius: 8,
                  cursor: "pointer",
                  transition: "all 0.2s",
                  backgroundColor:
                    settings.dashboardLayout === layout.value ? "rgba(var(--primary-rgb), 0.1)" : "transparent",
                  borderColor: settings.dashboardLayout === layout.value ? "var(--primary-color)" : "var(--border-color)",
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{layout.label}</div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{layout.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: 20, marginTop: 20 }}>
          <h4 style={{ marginBottom: 16 }}>Show on Dashboard</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { field: "showXPProgress", label: "XP and Level Progress" },
              { field: "showStreaks", label: "Practice Streaks" },
              { field: "showUpcomingEvents", label: "Upcoming Events" },
              { field: "showPeerActivity", label: "Classmate Activity Feed" },
            ].map((option) => (
              <label key={option.field} style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={settings[option.field as keyof typeof settings] as boolean}
                  onChange={(e) => handleChange(option.field, e.target.checked)}
                  style={{ width: 18, height: 18 }}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 20 }}>Content Preferences</h3>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={settings.autoPlayVideos}
              onChange={(e) => handleChange("autoPlayVideos", e.target.checked)}
              style={{ width: 18, height: 18 }}
            />
            <div>
              <div style={{ fontWeight: 600 }}>Auto-play videos</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                Videos start playing automatically when you open them
              </div>
            </div>
          </label>
        </div>

        <div>
          <label style={{ display: "block", marginBottom: 12, fontWeight: 600 }}>Video Quality</label>
          <select
            value={settings.videoQuality}
            onChange={(e) => handleChange("videoQuality", e.target.value)}
            style={{ width: "100%", maxWidth: 300, padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6 }}
          >
            <option value="auto">Auto (recommended)</option>
            <option value="high">High (1080p)</option>
            <option value="medium">Medium (720p)</option>
            <option value="low">Low (480p)</option>
          </select>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 20 }}>Notifications</h3>
        <p style={{ margin: "0 0 10px", color: "var(--text-secondary)", fontSize: 14 }}>
          Notification delivery now follows one fixed portal-wide policy instead of individual per-user toggles.
        </p>
        <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 13 }}>
          Portal reminders stay inside the app, email updates are sent automatically, and urgent alerts are already
          marked for SMS delivery once text support is enabled.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 20 }}>Privacy</h3>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={settings.showProfilePublicly}
              onChange={(e) => handleChange("showProfilePublicly", e.target.checked)}
              style={{ width: 18, height: 18 }}
            />
            <div>
              <div style={{ fontWeight: 600 }}>Show profile publicly</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                Your profile and portfolio can be viewed by anyone with the link
              </div>
            </div>
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={settings.showProgressToClassmates}
              onChange={(e) => handleChange("showProgressToClassmates", e.target.checked)}
              style={{ width: 18, height: 18 }}
            />
            <div>
              <div style={{ fontWeight: 600 }}>Share progress with classmates</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                Other students in your classes can see your achievements and milestones
              </div>
            </div>
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={settings.allowPeerMessages}
              onChange={(e) => handleChange("allowPeerMessages", e.target.checked)}
              style={{ width: 18, height: 18 }}
            />
            <div>
              <div style={{ fontWeight: 600 }}>Allow peer messages</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                Other students can send you direct messages
              </div>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}
