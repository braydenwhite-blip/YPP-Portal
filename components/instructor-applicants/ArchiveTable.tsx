"use client";

import { useState, useMemo, type ReactNode } from "react";

type ArchiveApp = {
  id: string;
  status: string;
  archivedAt: Date | string | null;
  updatedAt: Date | string;
  subjectsOfInterest: string | null;
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
};

const DECISION_LABELS: Record<string, string> = {
  APPROVE: "Approved",
  REJECT: "Rejected",
  HOLD: "On Hold",
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
        av = (a.applicant.name ?? a.applicant.email).toLowerCase();
        bv = (b.applicant.name ?? b.applicant.email).toLowerCase();
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
      <div
        style={{
          padding: "48px 24px",
          textAlign: "center",
          color: "var(--muted)",
          fontSize: 14,
        }}
      >
        No archived applications yet. Applications are archived 30 days after reaching a terminal state.
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input
          className="input"
          placeholder="Search applicants..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 260, marginBottom: 0 }}
        />
        <select
          className="input"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ width: "auto", marginBottom: 0 }}
        >
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <span style={{ fontSize: 13, color: "var(--muted)" }}>
          {filtered.length} of {applications.length}
        </span>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--border)" }}>
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
              <tr
                key={app.id}
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <td style={{ padding: "10px 12px", fontWeight: 600 }}>
                  {app.applicant.name ?? app.applicant.email}
                </td>
                <td style={{ padding: "10px 12px", color: "var(--muted)" }}>
                  {app.applicant.chapter?.name ?? "—"}
                </td>
                <td style={{ padding: "10px 12px", color: "var(--muted)", maxWidth: 150 }}>
                  {app.subjectsOfInterest
                    ? app.subjectsOfInterest.split(/[\s,;]+/).filter(Boolean).slice(0, 2).join(", ")
                    : "—"}
                </td>
                <td style={{ padding: "10px 12px", color: "var(--muted)" }}>
                  {app.reviewer?.name ?? "—"}
                </td>
                <td style={{ padding: "10px 12px" }}>
                  <span className={`status-pill ${app.status.toLowerCase().replace(/_/g, "-")}`}>
                    {STATUS_LABELS[app.status] ?? app.status.replace(/_/g, " ")}
                  </span>
                </td>
                <td style={{ padding: "10px 12px" }}>
                  {app.chairDecision
                    ? DECISION_LABELS[app.chairDecision.action] ?? app.chairDecision.action
                    : "—"}
                </td>
                <td style={{ padding: "10px 12px", color: "var(--muted)", whiteSpace: "nowrap" }}>
                  {app.archivedAt
                    ? new Date(app.archivedAt).toLocaleDateString()
                    : new Date(app.updatedAt).toLocaleDateString()}
                </td>
                <td style={{ padding: "10px 12px" }}>
                  <a
                    href={`/applications/instructor/${app.id}`}
                    style={{ fontSize: 12, color: "var(--link, #2563eb)", textDecoration: "underline" }}
                  >
                    View
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
      style={{
        padding: "8px 12px",
        textAlign: "left",
        fontWeight: 700,
        fontSize: 11,
        color: "var(--muted)",
        textTransform: "uppercase",
        letterSpacing: "0.3px",
        cursor: onClick ? "pointer" : undefined,
        whiteSpace: "nowrap",
        userSelect: "none",
      }}
    >
      {children}
      {sorted && <span style={{ marginLeft: 4 }}>{dir === "asc" ? "↑" : "↓"}</span>}
    </th>
  );
}
