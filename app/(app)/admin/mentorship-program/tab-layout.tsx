"use client";

import { useState } from "react";

export type Tab = "pairings" | "chairs" | "goals" | "reports";

interface Props {
  pairingsPanel: React.ReactNode;
  chairsPanel: React.ReactNode;
  goalsPanel: React.ReactNode;
  reportsPanel: React.ReactNode;
  stats: {
    activePairings: number;
    activeChairs: number;
    activeGoals: number;
  };
}

export default function TabLayout({ pairingsPanel, chairsPanel, goalsPanel, reportsPanel, stats }: Props) {
  const [tab, setTab] = useState<Tab>("pairings");

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "pairings", label: "Mentor Pairings", count: stats.activePairings },
    { id: "chairs", label: "Committee Chairs", count: stats.activeChairs },
    { id: "goals", label: "Program Goals", count: stats.activeGoals },
    { id: "reports", label: "Reports" },
  ];

  return (
    <div>
      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          gap: "0.25rem",
          borderBottom: "2px solid var(--border)",
          marginBottom: "1.5rem",
        }}
      >
        {tabs.map(({ id, label, count }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="button ghost"
            style={{
              borderRadius: "var(--radius-sm) var(--radius-sm) 0 0",
              borderBottom: tab === id ? "2px solid var(--ypp-purple-500)" : "2px solid transparent",
              marginBottom: "-2px",
              fontWeight: tab === id ? 600 : 400,
              color: tab === id ? "var(--ypp-purple-600)" : "var(--muted)",
              paddingBottom: "0.6rem",
            }}
          >
            {label}
            {count != null && (
              <span
                className="badge"
                style={{
                  marginLeft: "0.4rem",
                  background: tab === id ? "var(--ypp-purple-100)" : "var(--surface-alt)",
                  color: tab === id ? "var(--ypp-purple-700)" : "var(--muted)",
                }}
              >
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Panel */}
      {tab === "pairings" && pairingsPanel}
      {tab === "chairs" && chairsPanel}
      {tab === "goals" && goalsPanel}
      {tab === "reports" && reportsPanel}
    </div>
  );
}
