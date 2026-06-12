"use client";

import { useState, useMemo, type ReactNode } from "react";

import { formatApplicantDisplayName } from "@/lib/applicant-display-name";
import {
  DataTableShell,
  EmptyStateV2,
  StatusBadge,
  TableCell,
  TableV2,
  type StatusTone,
} from "@/components/ui-v2";

const STATUS_TONES: Record<string, StatusTone> = {
  APPROVED: "success",
  REJECTED: "danger",
  ON_HOLD: "warning",
  WITHDRAWN: "neutral",
  WAITLISTED: "info",
};

type ArchiveApp = {
  id: string;
  status: string;
  archivedAt: Date | string | null;
  updatedAt: Date | string;
  subjectsOfInterest: string | null;
  legalName?: string | null;
  preferredFirstName?: string | null;
  lastName?: string | null;
  applicant: {
    name: string | null;
    email: string;
    chapter: { name: string } | null;
  };
  reviewer: { name: string | null } | null;
  chairDecision: { action: string; decidedAt: Date | string } | null;
};

interface ArchiveTableProps {
  applications: ArchiveApp[];
}

const STATUS_LABELS: Record<string, string> = {
  APPROVED: "Approved",
  REJECTED: "Rejected",
  ON_HOLD: "On Hold",
  WITHDRAWN: "Withdrawn",
  WAITLISTED: "Waitlisted",
};

const DECISION_LABELS: Record<string, string> = {
  APPROVE: "Approved",
  APPROVE_WITH_CONDITIONS: "Approved (conditions)",
  REJECT: "Rejected",
  HOLD: "On Hold",
  WAITLIST: "Waitlisted",
  REQUEST_INFO: "Info Requested",
  REQUEST_SECOND_INTERVIEW: "2nd Interview",
};

export default function ArchiveTable({ applications }: ArchiveTableProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortKey, setSortKey] = useState<"archivedAt" | "applicant" | "status">("archivedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filtered = useMemo(() => {
    let result = applications;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) =>
          formatApplicantDisplayName(a).toLowerCase().includes(q) ||
          (a.legalName ?? "").toLowerCase().includes(q) ||
          (a.preferredFirstName ?? "").toLowerCase().includes(q) ||
          (a.lastName ?? "").toLowerCase().includes(q) ||
          (a.applicant.name ?? "").toLowerCase().includes(q) ||
          a.applicant.email.toLowerCase().includes(q) ||
          (a.applicant.chapter?.name ?? "").toLowerCase().includes(q)
      );
    }
    if (statusFilter) {
      result = result.filter((a) => a.status === statusFilter);
    }
    return [...result].sort((a, b) => {
      let av: string, bv: string;
      if (sortKey === "archivedAt") {
        av = String(a.archivedAt ?? a.updatedAt);
        bv = String(b.archivedAt ?? b.updatedAt);
      } else if (sortKey === "applicant") {
        av = formatApplicantDisplayName(a).toLowerCase();
        bv = formatApplicantDisplayName(b).toLowerCase();
      } else {
        av = a.status;
        bv = b.status;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [applications, search, statusFilter, sortKey, sortDir]);

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) {
      setSortDir((d: "asc" | "desc") => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  if (applications.length === 0) {
    return (
      <EmptyStateV2
        icon="🗄️"
        title="No archived applications yet"
        body="Applications are automatically archived 30 days after a final decision is made."
      />
    );
  }

  return (
    <div>
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <input
          className="h-9 w-full max-w-64 rounded-[8px] border border-line bg-surface px-2.5 text-[13px] text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-400"
          placeholder="Search applicants..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="h-9 max-w-52 rounded-[8px] border border-line bg-surface px-2.5 text-[13px] text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-400"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <span className="text-[12.5px] text-ink-muted">
          {filtered.length} of {applications.length}
        </span>
      </div>

      <DataTableShell>
        <TableV2>
          <thead>
            <tr>
              <Th onClick={() => toggleSort("applicant")} sorted={sortKey === "applicant"} dir={sortDir}>
                Applicant
              </Th>
              <Th>Chapter</Th>
              <Th>Subjects</Th>
              <Th>Reviewer</Th>
              <Th onClick={() => toggleSort("status")} sorted={sortKey === "status"} dir={sortDir}>
                Status
              </Th>
              <Th>Chair decision</Th>
              <Th onClick={() => toggleSort("archivedAt")} sorted={sortKey === "archivedAt"} dir={sortDir}>
                Archived
              </Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((app) => (
              <tr key={app.id} className="hover:bg-surface-soft">
                <TableCell className="font-semibold">
                  {formatApplicantDisplayName(app)}
                </TableCell>
                <TableCell className="text-ink-muted">
                  {app.applicant.chapter?.name ?? "—"}
                </TableCell>
                <TableCell className="text-ink-muted">
                  {app.subjectsOfInterest
                    ? app.subjectsOfInterest.split(/[\s,;]+/).filter(Boolean).slice(0, 2).join(", ")
                    : "—"}
                </TableCell>
                <TableCell className="text-ink-muted">
                  {app.reviewer?.name ?? "—"}
                </TableCell>
                <TableCell>
                  <StatusBadge tone={STATUS_TONES[app.status] ?? "neutral"}>
                    {STATUS_LABELS[app.status] ?? app.status.replace(/_/g, " ")}
                  </StatusBadge>
                </TableCell>
                <TableCell className="text-ink-muted">
                  {app.chairDecision
                    ? DECISION_LABELS[app.chairDecision.action] ?? app.chairDecision.action
                    : "—"}
                </TableCell>
                <TableCell className="text-[12.5px] text-ink-muted">
                  {app.archivedAt
                    ? new Date(app.archivedAt).toLocaleDateString()
                    : new Date(app.updatedAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <a
                    href={`/applications/instructor/${app.id}`}
                    className="text-[12.5px] font-semibold text-brand-600 hover:text-brand-700"
                  >
                    View →
                  </a>
                </TableCell>
              </tr>
            ))}
          </tbody>
        </TableV2>
      </DataTableShell>
    </div>
  );
}

function Th({
  children,
  onClick,
  sorted,
  dir,
}: {
  children: ReactNode;
  onClick?: () => void;
  sorted?: boolean;
  dir?: "asc" | "desc";
}) {
  return (
    <th
      onClick={onClick}
      className={`border-b border-line-soft px-5 py-2.5 text-left text-[11.5px] font-bold uppercase tracking-[0.06em] text-ink-muted${onClick ? " cursor-pointer select-none hover:text-ink" : ""}`}
    >
      {children}
      {sorted && <span className="ml-1">{dir === "asc" ? "↑" : "↓"}</span>}
    </th>
  );
}
