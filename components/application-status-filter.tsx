"use client";

import { useState, useMemo, type ReactNode } from "react";

interface ApplicationStatusFilterProps {
  applications: { id: string; status: string }[];
  children: (visibleIds: Set<string>) => ReactNode;
}

const STATUS_OPTIONS = [
  { value: "ALL", label: "All" },
  { value: "ACTIVE", label: "Active" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "UNDER_REVIEW", label: "Under Review" },
  { value: "INTERVIEW_SCHEDULED", label: "Interview Scheduled" },
  { value: "INTERVIEW_COMPLETED", label: "Interview Completed" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "REJECTED", label: "Rejected" },
  { value: "WITHDRAWN", label: "Withdrawn" },
];

const FINAL_STATUSES = ["ACCEPTED", "REJECTED", "WITHDRAWN"];

export default function ApplicationStatusFilter({
  applications,
  children,
}: ApplicationStatusFilterProps) {
  const [filter, setFilter] = useState("ALL");

  const visibleIds = useMemo(() => {
    if (filter === "ALL") return new Set(applications.map((a) => a.id));
    if (filter === "ACTIVE") {
      return new Set(
        applications
          .filter((a) => !FINAL_STATUSES.includes(a.status))
          .map((a) => a.id)
      );
    }
    return new Set(
      applications.filter((a) => a.status === filter).map((a) => a.id)
    );
  }, [filter, applications]);

  // Count per status for the badges
  const counts = useMemo(() => {
    const map: Record<string, number> = { ALL: applications.length, ACTIVE: 0 };
    for (const a of applications) {
      map[a.status] = (map[a.status] || 0) + 1;
      if (!FINAL_STATUSES.includes(a.status)) map.ACTIVE++;
    }
    return map;
  }, [applications]);

  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {STATUS_OPTIONS.map((opt) => {
          const count = counts[opt.value] || 0;
          if (opt.value !== "ALL" && opt.value !== "ACTIVE" && count === 0) return null;
          const isActive = filter === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFilter(opt.value)}
              style={{
                padding: "4px 12px",
                fontSize: 12,
                fontWeight: isActive ? 600 : 400,
                border: `1px solid ${isActive ? "#7c3aed" : "var(--border)"}`,
                borderRadius: 16,
                background: isActive ? "#f5f3ff" : "transparent",
                color: isActive ? "#7c3aed" : "var(--muted)",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {opt.label} ({count})
            </button>
          );
        })}
      </div>
      {visibleIds.size === 0 ? (
        <div className="card">
          <p style={{ color: "var(--muted)", textAlign: "center", padding: 24 }}>
            No applications match this filter.
          </p>
        </div>
      ) : (
        children(visibleIds)
      )}
    </div>
  );
}
