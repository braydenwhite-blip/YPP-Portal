"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatEnum } from "@/lib/format-utils";
import { MentorTagDropdown } from "../_components/mentor-tag-dropdown";

export type RosterMentee = {
  mentorshipId: string;
  menteeId: string;
  menteeName: string;
  menteePrimaryRole: string | null;
  cycleStage: string;
  mentorTag: string | null;
  ctaLabel: string;
  ctaHref: string | null;
  ctaDisabled: boolean;
  ctaPrimary: boolean;
  isQuiet: boolean;
  needsAttention: boolean;
};

const STAGE_META: Record<string, { label: string; color: string; bg: string }> = {
  KICKOFF_PENDING: { label: "Kickoff pending", color: "#92400e", bg: "#fef3c7" },
  REFLECTION_DUE: { label: "Reflection due", color: "#3730a3", bg: "#e0e7ff" },
  REFLECTION_SUBMITTED: { label: "Ready for review", color: "#1e40af", bg: "#dbeafe" },
  CHANGES_REQUESTED: { label: "Changes requested", color: "#c2410c", bg: "#fff7ed" },
  REVIEW_SUBMITTED: { label: "With chair", color: "#475569", bg: "#f1f5f9" },
  APPROVED: { label: "Feedback released", color: "#166534", bg: "#dcfce7" },
  PAUSED: { label: "Paused", color: "#57534e", bg: "#f5f5f4" },
  COMPLETE: { label: "Cycle complete", color: "#166534", bg: "#dcfce7" },
};

function Chip({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span
      style={{
        fontSize: 10,
        padding: "2px 8px",
        borderRadius: 999,
        background: bg,
        color,
        fontWeight: 700,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function RosterRow({ mentee }: { mentee: RosterMentee }) {
  const stage = STAGE_META[mentee.cycleStage] ?? {
    label: formatEnum(mentee.cycleStage),
    color: "var(--muted)",
    bg: "var(--bg-2)",
  };

  return (
    <li
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderLeft: mentee.needsAttention
          ? "3px solid #f59e0b"
          : "1px solid var(--border)",
        padding: "13px 17px",
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        columnGap: 16,
        rowGap: 10,
        alignItems: "center",
      }}
    >
      <div style={{ minWidth: 0, display: "grid", gap: 7 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <Link
            href={`/people/${mentee.menteeId}`}
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "var(--text)",
              textDecoration: "none",
            }}
          >
            {mentee.menteeName}
          </Link>
          {mentee.menteePrimaryRole && (
            <span style={{ fontSize: 11, color: "var(--muted)" }}>
              {formatEnum(mentee.menteePrimaryRole)}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Chip label={stage.label} color={stage.color} bg={stage.bg} />
          {mentee.mentorTag === "FOLLOW_UP_NEEDED" && (
            <Chip label="Follow-up" color="#991b1b" bg="#fee2e2" />
          )}
          {mentee.mentorTag === "OUTSTANDING_PERFORMANCE" && (
            <Chip label="Outstanding" color="#6b21c8" bg="#f3e8ff" />
          )}
          {mentee.isQuiet && <Chip label="Quiet" color="#92400e" bg="#fef3c7" />}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          justifyContent: "flex-end",
        }}
      >
        <MentorTagDropdown
          mentorshipId={mentee.mentorshipId}
          currentTag={mentee.mentorTag}
        />
        {mentee.ctaDisabled || !mentee.ctaHref ? (
          <span style={{ fontSize: 12, color: "var(--muted)", fontStyle: "italic" }}>
            {mentee.ctaLabel}
          </span>
        ) : (
          <Link
            href={mentee.ctaHref}
            className={`button ${mentee.ctaPrimary ? "primary" : "secondary"} small`}
            style={{ whiteSpace: "nowrap" }}
          >
            {mentee.ctaLabel} →
          </Link>
        )}
      </div>
    </li>
  );
}

interface MentorRosterProps {
  active: RosterMentee[];
  inactive: RosterMentee[];
}

/**
 * The full mentee directory — every mentee the user mentors, sorted with
 * the ones needing action first, then alphabetically. Distinct from the
 * hub's triage list: this is the "look up anyone" surface, with a name
 * filter for mentors carrying a large roster.
 */
export function MentorRoster({ active, inactive }: MentorRosterProps) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const showSearch = active.length + inactive.length >= 6;

  const filteredActive = useMemo(
    () => (q ? active.filter((m) => m.menteeName.toLowerCase().includes(q)) : active),
    [active, q]
  );
  const filteredInactive = useMemo(
    () => (q ? inactive.filter((m) => m.menteeName.toLowerCase().includes(q)) : inactive),
    [inactive, q]
  );

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {showSearch && (
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="input"
          placeholder="Filter mentees by name…"
          aria-label="Filter mentees by name"
          style={{ maxWidth: 360 }}
        />
      )}

      {filteredActive.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: 14, margin: "4px 0" }}>
          {q
            ? `No mentees match “${query.trim()}”.`
            : "No active mentees this cycle."}
        </p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
          {filteredActive.map((m) => (
            <RosterRow key={m.mentorshipId} mentee={m} />
          ))}
        </ul>
      )}

      {filteredInactive.length > 0 && (
        <details
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            padding: "14px 18px",
          }}
        >
          <summary
            style={{
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--muted)",
            }}
          >
            Inactive / paused ({filteredInactive.length})
          </summary>
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: "14px 0 0",
              display: "grid",
              gap: 8,
            }}
          >
            {filteredInactive.map((m) => (
              <RosterRow key={m.mentorshipId} mentee={m} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
