"use client";

import { useState, useTransition } from "react";
import { logPractice } from "@/lib/practice-actions";

interface PracticeLog {
  id: string;
  passionId: string;
  activity: string;
  duration: number;
  mood: string | null;
  notes: string | null;
  date: string; // ISO string (serialised from server)
}

interface PracticeStats {
  sessionsThisMonth: number;
  totalMinutes: number;
  streak: number;
}

const MOOD_MAP: Record<string, { emoji: string; label: string }> = {
  GREAT: { emoji: "\uD83C\uDF1F", label: "Great" },
  GOOD: { emoji: "\uD83D\uDE0A", label: "Good" },
  OK: { emoji: "\uD83D\uDE10", label: "OK" },
  FRUSTRATED: { emoji: "\uD83D\uDE24", label: "Frustrated" },
};

function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function PracticeLogClient({
  initialLogs,
  stats,
}: {
  initialLogs: PracticeLog[];
  stats: PracticeStats;
}) {
  const [isLogging, setIsLogging] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await logPractice(formData);
        setIsLogging(false);
      } catch {
        // Form stays open on error so the user can retry
      }
    });
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Track</p>
          <h1 className="page-title">Practice Log</h1>
        </div>
        <button
          onClick={() => setIsLogging(true)}
          className="button primary"
        >
          Log Practice Session
        </button>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>Track Your Practice</h3>
        <p>
          Consistency is key! Log your practice sessions to track progress,
          identify patterns, and build momentum. Even 10 minutes counts!
        </p>
      </div>

      {/* Stats */}
      <div className="grid three" style={{ marginBottom: 28 }}>
        <div className="card">
          <div className="kpi">{stats.sessionsThisMonth}</div>
          <div className="kpi-label">Sessions This Month</div>
        </div>
        <div className="card">
          <div className="kpi">{stats.totalMinutes}</div>
          <div className="kpi-label">Total Minutes</div>
        </div>
        <div className="card">
          <div className="kpi">
            {stats.streak}
            {stats.streak > 0 && (
              <span style={{ marginLeft: 4, fontSize: "0.7em" }}>
                {"\uD83D\uDD25"}
              </span>
            )}
          </div>
          <div className="kpi-label">Day Streak</div>
        </div>
      </div>

      {/* Log Form Modal */}
      {isLogging && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            zIndex: 1000,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsLogging(false);
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: 500,
              width: "100%",
              maxHeight: "90vh",
              overflow: "auto",
            }}
          >
            <h3>Log Practice Session</h3>
            <form action={handleSubmit} style={{ marginTop: 16 }}>
              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: 8,
                    fontWeight: 600,
                  }}
                >
                  What did you practice? *
                </label>
                <select
                  name="passionId"
                  required
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid var(--border-color)",
                    borderRadius: 6,
                  }}
                >
                  <option value="">Select passion area</option>
                  <option value="visual-arts">Visual Arts</option>
                  <option value="sports">Sports</option>
                  <option value="music">Music</option>
                  <option value="writing">Writing</option>
                  <option value="dance">Dance</option>
                  <option value="theater">Theater</option>
                  <option value="coding">Coding</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: 8,
                    fontWeight: 600,
                  }}
                >
                  Activity *
                </label>
                <input
                  type="text"
                  name="activity"
                  required
                  placeholder="e.g., Watercolor painting, Basketball drills"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid var(--border-color)",
                    borderRadius: 6,
                  }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: 8,
                    fontWeight: 600,
                  }}
                >
                  Duration (minutes) *
                </label>
                <input
                  type="number"
                  name="duration"
                  required
                  min="1"
                  max="480"
                  placeholder="30"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid var(--border-color)",
                    borderRadius: 6,
                  }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: 8,
                    fontWeight: 600,
                  }}
                >
                  How did it go?
                </label>
                <select
                  name="mood"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid var(--border-color)",
                    borderRadius: 6,
                  }}
                >
                  <option value="GREAT">
                    {"\uD83C\uDF1F"} Great - I&apos;m in the zone!
                  </option>
                  <option value="GOOD">
                    {"\uD83D\uDE0A"} Good - Making progress
                  </option>
                  <option value="OK">
                    {"\uD83D\uDE10"} OK - Showed up
                  </option>
                  <option value="FRUSTRATED">
                    {"\uD83D\uDE24"} Frustrated - Struggling
                  </option>
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: 8,
                    fontWeight: 600,
                  }}
                >
                  Notes (optional)
                </label>
                <textarea
                  name="notes"
                  rows={3}
                  placeholder="What did you work on? Any breakthroughs or challenges?"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid var(--border-color)",
                    borderRadius: 6,
                    fontFamily: "inherit",
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <button
                  type="submit"
                  className="button primary"
                  disabled={isPending}
                >
                  {isPending ? "Saving..." : "Save Practice Log"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsLogging(false)}
                  className="button secondary"
                  disabled={isPending}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Recent Sessions */}
      <div>
        <div className="section-title">Recent Practice Sessions</div>
        {initialLogs.length === 0 ? (
          <div
            className="card"
            style={{
              textAlign: "center",
              padding: 40,
              color: "var(--muted)",
            }}
          >
            <p style={{ fontSize: 15 }}>
              No practice sessions yet. Log your first session to get started!
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {initialLogs.map((log) => {
              const moodInfo = log.mood ? MOOD_MAP[log.mood] : null;
              return (
                <div key={log.id} className="card">
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "start",
                    }}
                  >
                    <div>
                      <h4 style={{ margin: 0 }}>{log.activity}</h4>
                      {log.notes && (
                        <div
                          style={{
                            fontSize: 14,
                            color: "var(--text-secondary)",
                            marginTop: 4,
                          }}
                        >
                          {log.notes}
                        </div>
                      )}
                      <div
                        style={{
                          fontSize: 13,
                          marginTop: 8,
                          color: "var(--muted)",
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                          alignItems: "center",
                        }}
                      >
                        {moodInfo && (
                          <span>
                            {moodInfo.emoji} {moodInfo.label}
                          </span>
                        )}
                        <span>{formatRelativeDate(log.date)}</span>
                        <span>{log.duration} min</span>
                        <span
                          className="pill pill-small"
                          style={{
                            background: "var(--gray-100)",
                            color: "var(--gray-600)",
                          }}
                        >
                          {log.passionId}
                        </span>
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "var(--success)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      +10 XP
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
