"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { GoalRatingColor } from "@prisma/client";

import { QUARTERLY_REVIEW_DECISION_LABELS } from "@/lib/people-strategy/constants";
import { GOAL_RATING_ORDER } from "@/lib/people-strategy/constants";
import {
  NO_RATING_COLOR,
  RATING_COLORS,
  type TrendWord,
} from "@/lib/people-strategy/people-dashboard-selectors";
import type {
  DashboardActionView,
  DashboardCheckInDot,
  PeopleDashboardRow,
} from "@/lib/people-strategy/people-dashboard";

const TREND_STYLES: Record<TrendWord, { color: string; label: string }> = {
  Improving: { color: "#047857", label: "Improving ↑" },
  Declining: { color: "#b91c1c", label: "Declining ↓" },
  Stable: { color: "#475569", label: "Stable →" },
  "Insufficient Data": { color: "#94a3b8", label: "Insufficient Data" },
};

function Initials({ name, email }: { name: string; email: string }) {
  const source = name || email;
  const initials = source
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      aria-hidden
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 36,
        height: 36,
        borderRadius: "50%",
        background: "#e2e8f0",
        color: "#475569",
        fontSize: 13,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {initials || "?"}
    </span>
  );
}

function Avatar({ row }: { row: PeopleDashboardRow }) {
  if (row.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={row.avatarUrl}
        alt=""
        width={36}
        height={36}
        style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
      />
    );
  }
  return <Initials name={row.name} email={row.email} />;
}

function RatingChip({ rating, prefix }: { rating: GoalRatingColor; prefix: string }) {
  const c = RATING_COLORS[rating];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 11,
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: 999,
        background: c.bg,
        color: c.text,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: c.dot }} />
      {prefix}: {c.label}
    </span>
  );
}

function ActionList({
  actions,
  emptyLabel,
}: {
  actions: DashboardActionView[];
  emptyLabel: string;
}) {
  if (actions.length === 0) {
    return <span style={{ fontSize: 11, color: "#94a3b8" }}>{emptyLabel}</span>;
  }
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 3 }}>
      {actions.slice(0, 3).map((a) => (
        <li key={a.id} style={{ fontSize: 11, lineHeight: 1.35 }}>
          <Link href={`/actions/${a.id}`} style={{ color: a.overdue ? "#b91c1c" : "#334155", textDecoration: "none", fontWeight: a.overdue ? 700 : 500 }}>
            {a.title}
          </Link>
          <span style={{ color: a.overdue ? "#dc2626" : "#94a3b8" }}>
            {" · "}{a.overdue ? "Overdue " : "Due "}{a.deadlineLabel}
          </span>
        </li>
      ))}
      {actions.length > 3 ? (
        <li style={{ fontSize: 10, color: "#94a3b8" }}>+{actions.length - 3} more</li>
      ) : null}
    </ul>
  );
}

function CheckInDots({ dots }: { dots: DashboardCheckInDot[] }) {
  if (dots.length === 0) {
    return <span style={{ fontSize: 11, color: "#94a3b8" }}>No check-ins</span>;
  }
  // Render most-recent on the right (reverse the most-recent-first input).
  const ordered = [...dots].reverse();
  return (
    <span style={{ display: "inline-flex", gap: 5, alignItems: "center" }}>
      {ordered.map((d, i) => {
        const c = d.rating ? RATING_COLORS[d.rating] : NO_RATING_COLOR;
        return (
          <span
            key={`${d.monthLabel}-${i}`}
            title={`${d.monthLabel}: ${c.label}`}
            style={{ width: 12, height: 12, borderRadius: "50%", background: c.dot, border: "1px solid rgba(0,0,0,0.06)" }}
          />
        );
      })}
    </span>
  );
}

const cellStyle: React.CSSProperties = {
  padding: "12px 10px",
  borderBottom: "1px solid #e2e8f0",
  verticalAlign: "top",
  fontSize: 12,
};

const headStyle: React.CSSProperties = {
  padding: "10px",
  textAlign: "left",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.4,
  color: "#64748b",
  borderBottom: "2px solid #e2e8f0",
  whiteSpace: "nowrap",
};

export function PeopleDashboardTable({
  rows,
  departments,
}: {
  rows: PeopleDashboardRow[];
  departments: string[];
}) {
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [rating, setRating] = useState("");
  const [successionOnly, setSuccessionOnly] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (successionOnly && !r.successor) return false;
      if (department && !r.departments.includes(department)) return false;
      if (rating && r.quarterly?.performanceRating !== rating) return false;
      if (q) {
        const haystack = [r.name, r.email, r.role ?? "", ...r.expertise, ...r.departments]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, department, rating, successionOnly]);

  return (
    <div>
      {/* Tabs + filters */}
      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
          marginTop: 16,
          padding: "12px 14px",
          background: "#f8fafc",
          borderRadius: 10,
          border: "1px solid #e2e8f0",
        }}
      >
        <select
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className="input"
          style={{ fontSize: 12, padding: "6px 8px" }}
          aria-label="Filter by department"
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>

        <select
          value={rating}
          onChange={(e) => setRating(e.target.value)}
          className="input"
          style={{ fontSize: 12, padding: "6px 8px" }}
          aria-label="Filter by performance rating"
        >
          <option value="">All Ratings</option>
          {GOAL_RATING_ORDER.map((r) => (
            <option key={r} value={r}>
              {RATING_COLORS[r].label}
            </option>
          ))}
        </select>

        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search people…"
          className="input"
          style={{ fontSize: 12, padding: "6px 8px", flex: "1 1 180px", minWidth: 140 }}
          aria-label="Search people"
        />

        <button
          type="button"
          onClick={() => setSuccessionOnly((v) => !v)}
          className={successionOnly ? "button small" : "button outline small"}
          aria-pressed={successionOnly}
        >
          {successionOnly ? "★ Succession View: On" : "Succession View"}
        </button>

        <button type="button" className="button outline small" disabled title="Coming soon">
          + Add Member
        </button>
      </div>

      {/* Keys */}
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginTop: 12, fontSize: 11, color: "#64748b" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <strong style={{ color: "#475569" }}>Actions key:</strong>
          <span>🟦 Lead</span>
          <span>🟩 Executing</span>
          <span style={{ color: "#b91c1c" }}>● Overdue</span>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <strong style={{ color: "#475569" }}>Ratings key:</strong>
          {GOAL_RATING_ORDER.map((r) => (
            <span key={r} style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: RATING_COLORS[r].dot }} />
              {RATING_COLORS[r].label}
            </span>
          ))}
        </div>
      </div>

      <p style={{ fontSize: 11, color: "#94a3b8", margin: "10px 0 0" }}>
        Showing {filtered.length} of {rows.length} {rows.length === 1 ? "member" : "members"}
      </p>

      {/* Member table */}
      <div style={{ overflowX: "auto", marginTop: 8 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 920 }}>
          <thead>
            <tr>
              <th style={headStyle}>Member</th>
              <th style={headStyle}>Dept / Expertise</th>
              <th style={headStyle}>Active Actions &amp; Deadlines</th>
              <th style={headStyle}>Quarterly Review</th>
              <th style={headStyle}>Monthly Check-Ins</th>
              <th style={headStyle} />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ ...cellStyle, textAlign: "center", color: "#94a3b8", padding: 24 }}>
                  No members match the current filters.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.id}>
                  {/* Member */}
                  <td style={cellStyle}>
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <Avatar row={row} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{row.name || row.email}</div>
                        <div style={{ color: "#64748b" }}>{row.role ?? "—"}</div>
                        {row.mentorName ? (
                          <div style={{ color: "#94a3b8", fontSize: 11 }}>Mentor: {row.mentorName}</div>
                        ) : null}
                        {row.workloadWarning ? (
                          <div style={{ marginTop: 4, color: "#b45309", fontSize: 11, fontWeight: 600 }}>
                            ⚠ {row.workloadWarning}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </td>

                  {/* Dept / Expertise */}
                  <td style={cellStyle}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <span style={{ fontWeight: 600, color: "#334155" }}>
                        {row.departments.length > 0 ? row.departments.join(", ") : "—"}
                      </span>
                      {row.expertise.length > 0 ? (
                        <span style={{ color: "#94a3b8", fontSize: 11 }}>
                          {row.expertise.slice(0, 3).join(" · ")}
                        </span>
                      ) : null}
                    </div>
                  </td>

                  {/* Active Actions */}
                  <td style={cellStyle}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#1d4ed8", textTransform: "uppercase", letterSpacing: 0.3 }}>
                          Lead ({row.leadActions.length})
                        </div>
                        <ActionList actions={row.leadActions} emptyLabel="No lead actions" />
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#047857", textTransform: "uppercase", letterSpacing: 0.3 }}>
                          Executing ({row.executingActions.length})
                        </div>
                        <ActionList actions={row.executingActions} emptyLabel="No executing actions" />
                      </div>
                    </div>
                  </td>

                  {/* Quarterly Review */}
                  <td style={cellStyle}>
                    {row.quarterly ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        <span style={{ fontSize: 10, color: "#94a3b8" }}>{row.quarterly.quarter}</span>
                        <RatingChip rating={row.quarterly.performanceRating} prefix="Perf" />
                        <RatingChip rating={row.quarterly.potentialRating} prefix="Pot" />
                        <span style={{ fontSize: 11, color: "#475569", fontStyle: "italic" }}>
                          {row.quarterly.matrixLabel}
                        </span>
                        <span style={{ fontSize: 10, color: "#64748b" }}>
                          {QUARTERLY_REVIEW_DECISION_LABELS[row.quarterly.decision]}
                        </span>
                        {row.successor ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              alignSelf: "flex-start",
                              fontSize: 11,
                              fontWeight: 700,
                              padding: "2px 8px",
                              borderRadius: 999,
                              background: "#f5f3ff",
                              color: "#6d28d9",
                            }}
                          >
                            ★ Successor
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>No review yet</span>
                    )}
                  </td>

                  {/* Monthly Check-Ins */}
                  <td style={cellStyle}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      <CheckInDots dots={row.checkInDots} />
                      <span style={{ fontSize: 11, fontWeight: 600, color: TREND_STYLES[row.trend].color }}>
                        {TREND_STYLES[row.trend].label}
                      </span>
                    </div>
                  </td>

                  {/* View / Review */}
                  <td style={cellStyle}>
                    <Link href={`/people/${row.id}`} className="button outline small" style={{ whiteSpace: "nowrap" }}>
                      View / Review
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
