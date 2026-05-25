"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  sourceTypeLabel,
  submissionStatusLabel,
} from "@/lib/workshop-proposal-constants";
import type {
  WorkshopProposalSourceType,
  WorkshopProposalSubmissionStatus,
} from "@prisma/client";

type ReviewQueueFiltersProps = {
  currentSearch: string;
  currentStatus: WorkshopProposalSubmissionStatus | "";
  currentSource: WorkshopProposalSourceType | "";
  /** "assigned" | "unassigned" | "" — only meaningful for APPROVED rows. */
  currentAssignment: "assigned" | "unassigned" | "";
  currentCategory: string;
  categories: string[];
  totalVisible: number;
  totalAll: number;
};

const STATUSES: WorkshopProposalSubmissionStatus[] = [
  "SUBMITTED",
  "IN_REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED",
  "REJECTED",
];

const SOURCES: WorkshopProposalSourceType[] = [
  "CUSTOM_DESIGN",
  "TEMPLATE_SELECTION",
];

/**
 * URL-driven filter bar for the admin Workshop Reviews queue. Search debounce
 * is local; status + source flips fire immediately. The source of truth is the
 * URL so a filtered view is shareable / reload-stable, and the parent server
 * component re-runs against the new query string.
 */
export function ReviewQueueFilters({
  currentSearch,
  currentStatus,
  currentSource,
  currentAssignment,
  currentCategory,
  categories,
  totalVisible,
  totalAll,
}: ReviewQueueFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function update(patch: Record<string, string>) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    for (const [k, v] of Object.entries(patch)) {
      if (!v) params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "?");
  }

  function debouncedSearch(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => update({ q: value }), 200);
  }

  const hasAny = Boolean(
    currentSearch ||
      currentStatus ||
      currentSource ||
      currentAssignment ||
      currentCategory
  );

  return (
    <div
      className="card"
      style={{
        marginBottom: 16,
        display: "flex",
        gap: 12,
        flexWrap: "wrap",
        alignItems: "end",
      }}
    >
      <label
        style={{
          display: "grid",
          gap: 4,
          flex: "2 1 220px",
          minWidth: 200,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600 }}>Search</span>
        <input
          className="input"
          type="search"
          defaultValue={currentSearch}
          placeholder="Applicant name, email, or template…"
          onChange={(e) => debouncedSearch(e.target.value)}
        />
      </label>
      <label style={{ display: "grid", gap: 4, flex: "1 1 160px", minWidth: 140 }}>
        <span style={{ fontSize: 12, fontWeight: 600 }}>Status</span>
        <select
          className="input"
          value={currentStatus}
          onChange={(e) => update({ status: e.target.value })}
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {submissionStatusLabel(s)}
            </option>
          ))}
        </select>
      </label>
      <label style={{ display: "grid", gap: 4, flex: "1 1 180px", minWidth: 160 }}>
        <span style={{ fontSize: 12, fontWeight: 600 }}>Source</span>
        <select
          className="input"
          value={currentSource}
          onChange={(e) => update({ source: e.target.value })}
        >
          <option value="">Any path</option>
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {sourceTypeLabel(s)}
            </option>
          ))}
        </select>
      </label>
      <label style={{ display: "grid", gap: 4, flex: "1 1 160px", minWidth: 140 }}>
        <span style={{ fontSize: 12, fontWeight: 600 }}>Category</span>
        <select
          className="input"
          value={currentCategory}
          onChange={(e) => update({ category: e.target.value })}
          disabled={categories.length === 0}
        >
          <option value="">Any category</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label style={{ display: "grid", gap: 4, flex: "1 1 180px", minWidth: 160 }}>
        <span style={{ fontSize: 12, fontWeight: 600 }}>Assignment</span>
        <select
          className="input"
          value={currentAssignment}
          onChange={(e) => update({ assignment: e.target.value })}
        >
          <option value="">Any placement</option>
          <option value="unassigned">Approved · not yet placed</option>
          <option value="assigned">Approved · placed</option>
        </select>
      </label>
      <div
        style={{
          marginLeft: "auto",
          display: "flex",
          gap: 8,
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 12, color: "var(--muted)" }}>
          Showing {totalVisible} of {totalAll}
        </span>
        {hasAny ? (
          <button
            type="button"
            className="button small secondary"
            onClick={() =>
              update({
                q: "",
                status: "",
                source: "",
                category: "",
                assignment: "",
              })
            }
          >
            Clear filters
          </button>
        ) : null}
      </div>
    </div>
  );
}
