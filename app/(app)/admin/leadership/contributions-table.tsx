"use client";

// Filterable contributions table for the admin leadership dashboard.
// Filtering/grouping logic lives in lib/leadership/filters.ts (tested).

import Link from "next/link";
import { useMemo, useState } from "react";
import type {
  LeadershipContributionStatus,
  LeadershipExpectedLevel,
  LeadershipRoleCategory,
} from "@prisma/client";
import {
  filterContributions,
  type ContributionFilters,
  type ContributionRow,
} from "@/lib/leadership/filters";
import {
  CONTRIBUTION_STATUS_META,
  EXPECTED_LEVEL_META,
  LEADERSHIP_ROLE_CATALOG,
  LEADERSHIP_ROLE_CATEGORIES,
} from "@/lib/leadership/constants";
import { LevelBadge, StatusPill, WeightBadge, formatLeadershipDate } from "@/components/leadership/ui";
import { ContributionStatusSelect, DeleteContributionButton } from "@/components/leadership/contribution-controls";

export function ContributionsTable({
  rows,
  instructors,
}: {
  rows: ContributionRow[];
  instructors: Array<{ id: string; name: string }>;
}) {
  const [filters, setFilters] = useState<ContributionFilters>({});

  const filtered = useMemo(() => filterContributions(rows, filters), [rows, filters]);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <select
          value={filters.category ?? "ALL"}
          onChange={(event) =>
            setFilters((f) => ({ ...f, category: event.target.value as LeadershipRoleCategory | "ALL" }))
          }
          style={{ fontSize: 13, padding: "4px 8px", borderRadius: 6 }}
          aria-label="Filter by role type"
        >
          <option value="ALL">All role types</option>
          {LEADERSHIP_ROLE_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {LEADERSHIP_ROLE_CATALOG[category].label}
            </option>
          ))}
        </select>

        <select
          value={filters.instructorId ?? "ALL"}
          onChange={(event) => setFilters((f) => ({ ...f, instructorId: event.target.value }))}
          style={{ fontSize: 13, padding: "4px 8px", borderRadius: 6 }}
          aria-label="Filter by instructor"
        >
          <option value="ALL">All instructors</option>
          {instructors.map((instructor) => (
            <option key={instructor.id} value={instructor.id}>
              {instructor.name}
            </option>
          ))}
        </select>

        <select
          value={filters.level ?? "ALL"}
          onChange={(event) =>
            setFilters((f) => ({ ...f, level: event.target.value as LeadershipExpectedLevel | "ALL" }))
          }
          style={{ fontSize: 13, padding: "4px 8px", borderRadius: 6 }}
          aria-label="Filter by level"
        >
          <option value="ALL">All levels</option>
          {(Object.keys(EXPECTED_LEVEL_META) as LeadershipExpectedLevel[]).map((level) => (
            <option key={level} value={level}>
              {EXPECTED_LEVEL_META[level].label}
            </option>
          ))}
        </select>

        <select
          value={filters.status ?? "ALL"}
          onChange={(event) =>
            setFilters((f) => ({ ...f, status: event.target.value as LeadershipContributionStatus | "ALL" }))
          }
          style={{ fontSize: 13, padding: "4px 8px", borderRadius: 6 }}
          aria-label="Filter by status"
        >
          <option value="ALL">All statuses</option>
          {(Object.keys(CONTRIBUTION_STATUS_META) as LeadershipContributionStatus[]).map((status) => (
            <option key={status} value={status}>
              {CONTRIBUTION_STATUS_META[status].label}
            </option>
          ))}
        </select>

        <input
          value={filters.search ?? ""}
          onChange={(event) => setFilters((f) => ({ ...f, search: event.target.value }))}
          placeholder="Search…"
          style={{ fontSize: 13, padding: "4px 8px", borderRadius: 6, border: "1px solid #e5e7eb" }}
        />
      </div>

      <p style={{ fontSize: 12, color: "var(--muted, #6b7280)", margin: "0 0 8px" }}>
        {filtered.length} of {rows.length} contributions
      </p>

      {filtered.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--muted, #6b7280)" }}>
          No contributions match the current filters.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {filtered.map((row) => (
            <div
              key={row.id}
              className="card"
              style={{
                padding: 12,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <div>
                <Link href={`/admin/instructors/${row.instructorId}`} style={{ fontWeight: 600 }}>
                  {row.instructorName}
                </Link>
                <div style={{ fontSize: 13 }}>{row.title}</div>
                <div style={{ fontSize: 12, color: "var(--muted, #6b7280)" }}>
                  {LEADERSHIP_ROLE_CATALOG[row.category]?.label ?? row.category}
                  {row.relatedLabel ? ` · ${row.relatedLabel}` : ""}
                  {row.adminOwnerName ? ` · Owner: ${row.adminOwnerName}` : ""}
                  {" · "}
                  {row.lastActivityAt
                    ? `Last activity ${formatLeadershipDate(row.lastActivityAt)}`
                    : `Started ${formatLeadershipDate(row.startDate)}`}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <LevelBadge level={row.expectedLevel} />
                <WeightBadge weight={row.weight} isOwnership={row.isOwnership} />
                {!row.reviewVisible && (
                  <span className="pill pill-small pill-neutral">Hidden from reviews</span>
                )}
                <ContributionStatusSelect contributionId={row.id} status={row.status} />
                <DeleteContributionButton contributionId={row.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function StatusLegend() {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {(Object.keys(CONTRIBUTION_STATUS_META) as LeadershipContributionStatus[]).map((status) => (
        <StatusPill key={status} status={status} />
      ))}
    </div>
  );
}
