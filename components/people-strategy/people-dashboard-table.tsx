"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { GoalRatingColor } from "@prisma/client";

import { QUARTERLY_REVIEW_DECISION_LABELS } from "@/lib/people-strategy/constants";
import { GOAL_RATING_ORDER } from "@/lib/people-strategy/constants";
import { requestMonthlyFeedback } from "@/lib/people-strategy/feedback-request-actions";
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
import { PersonLink } from "@/components/people-strategy/person-link";
import { PeopleAvatar } from "@/components/people-strategy/people-suite";

const TREND_STYLES: Record<TrendWord, { color: string; label: string }> = {
  Improving: { color: "#047857", label: "Improving ↑" },
  Declining: { color: "#b91c1c", label: "Declining ↓" },
  Stable: { color: "#475569", label: "Stable →" },
  "Insufficient Data": { color: "#64748b", label: "Insufficient Data" },
};

const RATING_SHORT_LABELS: Record<GoalRatingColor, string> = {
  BEHIND_SCHEDULE: "Behind",
  GETTING_STARTED: "Starting",
  ACHIEVED: "On Track",
  ABOVE_AND_BEYOND: "Above",
};

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
  return <PeopleAvatar name={row.name || row.email} />;
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
      <span
        aria-hidden
        style={{ width: 7, height: 7, borderRadius: "50%", background: c.dot }}
      />
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
    return <span style={{ fontSize: 11, color: "#64748b" }}>{emptyLabel}</span>;
  }
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 3 }}>
      {actions.slice(0, 3).map((a) => (
        <li key={a.id} style={{ fontSize: 11, lineHeight: 1.35 }}>
          <Link href={`/actions/${a.id}`} style={{ color: a.overdue ? "#b91c1c" : "#334155", textDecoration: "none", fontWeight: a.overdue ? 700 : 500 }}>
            {a.title}
          </Link>
          <span style={{ color: a.overdue ? "#dc2626" : "#64748b" }}>
            {" · "}{a.overdue ? "Overdue " : "Due "}{a.deadlineLabel}
          </span>
        </li>
      ))}
      {actions.length > 3 ? (
        <li style={{ fontSize: 10, color: "#64748b" }}>+{actions.length - 3} more</li>
      ) : null}
    </ul>
  );
}

function CheckInDots({ dots }: { dots: DashboardCheckInDot[] }) {
  if (dots.length === 0) {
    return <span style={{ fontSize: 11, color: "#64748b" }}>No check-ins</span>;
  }
  // Render most-recent on the right (reverse the most-recent-first input).
  const ordered = [...dots].reverse();
  return (
    <span style={{ display: "inline-flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
      {ordered.map((d, i) => {
        const c = d.rating ? RATING_COLORS[d.rating] : NO_RATING_COLOR;
        const shortLabel = d.rating ? RATING_SHORT_LABELS[d.rating] : "No data";
        return (
          <span
            key={`${d.monthLabel}-${i}`}
            aria-label={`${d.monthLabel}: ${c.label}`}
            title={`${d.monthLabel}: ${c.label}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "2px 6px",
              borderRadius: 999,
              background: c.bg,
              color: c.text,
              border: "1px solid rgba(15,23,42,0.14)",
              fontSize: 10,
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            <span
              aria-hidden
              style={{
                width: 8,
                height: 8,
                borderRadius: d.rating ? "50%" : 2,
                background: c.dot,
                border: "1px solid rgba(15,23,42,0.2)",
                flexShrink: 0,
              }}
            />
            {d.monthLabel}: {shortLabel}
          </span>
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
  canRequestFeedback,
}: {
  rows: PeopleDashboardRow[];
  departments: string[];
  /** True when ENABLE_PEOPLE_DASHBOARD + ENABLE_ACTION_TRACKER_EMAILS are on. */
  canRequestFeedback: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [rating, setRating] = useState("");
  const [successionOnly, setSuccessionOnly] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

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

  // Selection only ever references visible rows, so filtering can't leave a
  // "ghost" selected id behind the toolbar count.
  const filteredIds = useMemo(() => filtered.map((r) => r.id), [filtered]);
  const selectedVisible = useMemo(
    () => filteredIds.filter((id) => selected.has(id)),
    [filteredIds, selected]
  );
  const allVisibleSelected =
    filteredIds.length > 0 && selectedVisible.length === filteredIds.length;

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const id of filteredIds) next.delete(id);
      } else {
        for (const id of filteredIds) next.add(id);
      }
      return next;
    });
  }

  function handleRequestFeedback() {
    const subjectUserIds = selectedVisible;
    if (subjectUserIds.length === 0) return;
    setFeedbackMessage(null);
    startTransition(async () => {
      try {
        const result = await requestMonthlyFeedback({ subjectUserIds });
        setFeedbackMessage(
          result.created === 0
            ? `No new requests — collaborators for ${result.subjects} member(s) were already asked this month.`
            : `Sent ${result.emailsSent} email(s) · ${result.created} new request(s) across ${result.subjects} member(s).`
        );
        setSelected(new Set());
        router.refresh();
      } catch (err) {
        setFeedbackMessage(
          err instanceof Error ? `Could not send: ${err.message}` : "Could not send feedback requests."
        );
      }
    });
  }

  const successionCount = useMemo(() => rows.filter((r) => r.successor).length, [rows]);

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
          {successionOnly ? `★ Succession View: On (${successionCount})` : "Succession View"}
        </button>

        {canRequestFeedback ? (
          <button
            type="button"
            className="button small"
            onClick={handleRequestFeedback}
            disabled={isPending || selectedVisible.length === 0}
            title={
              selectedVisible.length === 0
                ? "Select one or more members first"
                : "Email recent collaborators for confidential monthly feedback"
            }
          >
            {isPending
              ? "Sending…"
              : `Request Monthly Feedback${
                  selectedVisible.length > 0 ? ` (${selectedVisible.length})` : ""
                }`}
          </button>
        ) : null}

      </div>

      {feedbackMessage ? (
        <p
          role={feedbackMessage.startsWith("Could not") ? "alert" : "status"}
          style={{
            margin: "10px 0 0",
            fontSize: 12,
            fontWeight: 600,
            color: feedbackMessage.startsWith("Could not") ? "#b91c1c" : "#047857",
          }}
        >
          {feedbackMessage}
        </p>
      ) : null}

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
              <span
                aria-hidden
                style={{ width: 9, height: 9, borderRadius: "50%", background: RATING_COLORS[r].dot }}
              />
              {RATING_COLORS[r].label}
            </span>
          ))}
        </div>
      </div>

      {successionOnly ? (
        <div
          style={{
            margin: "12px 0 0",
            padding: "8px 12px",
            borderRadius: 8,
            background: "#f5f3ff",
            border: "1px solid #ddd6fe",
            color: "#5b21b6",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          ★ Succession View — showing {filtered.length} succession candidate
          {filtered.length === 1 ? "" : "s"} (latest Quarterly Review flagged On Track / Above &amp;
          Beyond on both axes). Matrix label and latest decision shown per member.
        </div>
      ) : null}

      <p style={{ fontSize: 11, color: "#64748b", margin: "10px 0 0" }}>
        Showing {filtered.length} of {rows.length} {rows.length === 1 ? "member" : "members"}
      </p>

      {/* Member table */}
      <div style={{ overflowX: "auto", marginTop: 8 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 920 }}>
          <thead>
            <tr>
              {canRequestFeedback ? (
                <th style={{ ...headStyle, width: 32 }}>
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAllVisible}
                    aria-label="Select all visible members"
                    disabled={filteredIds.length === 0}
                  />
                </th>
              ) : null}
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
                <td colSpan={canRequestFeedback ? 7 : 6} style={{ ...cellStyle, textAlign: "center", color: "#64748b", padding: 24 }}>
                  No members match the current filters.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.id} style={selected.has(row.id) ? { background: "#f5f3ff" } : undefined}>
                  {canRequestFeedback ? (
                    <td style={{ ...cellStyle, width: 32 }}>
                      <input
                        type="checkbox"
                        checked={selected.has(row.id)}
                        onChange={() => toggleOne(row.id)}
                        aria-label={`Select ${row.name || row.email}`}
                      />
                    </td>
                  ) : null}
                  {/* Member */}
                  <td style={cellStyle}>
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <Avatar row={row} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>
                          <PersonLink id={row.id} style={{ color: "inherit" }}>
                            {row.name || row.email}
                          </PersonLink>
                        </div>
                        <div style={{ color: "#64748b" }}>{row.role ?? "—"}</div>
                        {row.mentorName ? (
                          <div style={{ color: "#64748b", fontSize: 11 }}>
                            Mentor:{" "}
                            <PersonLink id={row.mentorId} style={{ color: "inherit" }}>
                              {row.mentorName}
                            </PersonLink>
                          </div>
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
                        <span style={{ color: "#64748b", fontSize: 11 }}>
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
                        <span style={{ fontSize: 10, color: "#64748b" }}>{row.quarterly.quarter}</span>
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
                      <span style={{ fontSize: 11, color: "#64748b" }}>No review yet</span>
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
                    <Link
                      href={`/admin/instructors/${row.id}/manage#people-strategy`}
                      className="button outline small"
                      style={{ whiteSpace: "nowrap" }}
                    >
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
