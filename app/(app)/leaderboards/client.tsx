"use client";

import { useState, useEffect } from "react";
import { getLeaderboard } from "@/lib/engagement-actions";

const CATEGORIES = [
  { value: "XP", label: "Total XP", color: "#7c3aed" },
  { value: "STREAKS", label: "Longest Streak", color: "#d97706" },
  { value: "CHALLENGES", label: "Challenges", color: "#3b82f6" },
  { value: "PRACTICE_HOURS", label: "Practice Hours", color: "#16a34a" },
];

const PERIODS = [
  { value: "WEEKLY", label: "This Week" },
  { value: "MONTHLY", label: "This Month" },
  { value: "ALL_TIME", label: "All Time" },
];

export function LeaderboardTabs() {
  const [category, setCategory] = useState("XP");
  const [period, setPeriod] = useState("WEEKLY");
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getLeaderboard(category, period)
      .then((data) => setEntries(data as any[]))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [category, period]);

  const catInfo = CATEGORIES.find((c) => c.value === category) || CATEGORIES[0];

  return (
    <div>
      {/* Category Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setCategory(cat.value)}
            className={`button ${category === cat.value ? "primary" : "secondary"} small`}
            style={category === cat.value ? { background: cat.color } : undefined}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Period Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`button ${period === p.value ? "primary" : "secondary"} small`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Leaderboard Table */}
      <div className="card">
        {loading ? (
          <div style={{ textAlign: "center", padding: 32, color: "var(--text-secondary)" }}>
            Loading...
          </div>
        ) : entries.length === 0 ? (
          <div style={{ textAlign: "center", padding: 32, color: "var(--text-secondary)" }}>
            No leaderboard data yet for this period. Keep engaging to climb the ranks!
          </div>
        ) : (
          <div>
            {/* Top 3 Podium */}
            {entries.length >= 3 && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "end", gap: 16, marginBottom: 24, paddingTop: 12 }}>
                {[entries[1], entries[0], entries[2]].map((entry, idx) => {
                  const position = idx === 0 ? 2 : idx === 1 ? 1 : 3;
                  const heights = { 1: 100, 2: 75, 3: 60 };
                  const medals = { 1: "Gold", 2: "Silver", 3: "Bronze" };
                  const medalColors = { 1: "#d97706", 2: "#9ca3af", 3: "#b45309" };
                  return (
                    <div key={entry.id} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                        {entry.user?.name || "Unknown"}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>
                        {Math.round(entry.score)}
                      </div>
                      <div style={{
                        width: 72,
                        height: heights[position as 1 | 2 | 3],
                        background: `${catInfo.color}20`,
                        borderTop: `4px solid ${medalColors[position as 1 | 2 | 3]}`,
                        borderRadius: "4px 4px 0 0",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontSize: 20,
                        color: medalColors[position as 1 | 2 | 3],
                      }}>
                        #{position}
                      </div>
                      <div style={{ fontSize: 10, color: medalColors[position as 1 | 2 | 3], fontWeight: 600 }}>
                        {medals[position as 1 | 2 | 3]}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Full List */}
            <div style={{ borderTop: "1px solid var(--gray-200)", paddingTop: 16 }}>
              {entries.map((entry: any, i: number) => (
                <div
                  key={entry.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 0",
                    borderBottom: i < entries.length - 1 ? "1px solid var(--gray-200)" : "none",
                  }}
                >
                  <div style={{
                    width: 32,
                    textAlign: "center",
                    fontWeight: 700,
                    fontSize: 14,
                    color: i < 3 ? catInfo.color : "var(--text-secondary)",
                  }}>
                    #{entry.rank || i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      {entry.user?.name || "Unknown"}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      Level {entry.user?.level || 1}
                    </div>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: catInfo.color }}>
                    {Math.round(entry.score)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
