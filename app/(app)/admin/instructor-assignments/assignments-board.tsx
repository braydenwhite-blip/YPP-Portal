import Link from "next/link";
import {
  formatAssignmentRole,
  formatAssignmentStatus,
  assignmentStatusTone,
  ASSIGNMENT_STATUSES,
} from "@/lib/regular-instructor-assignments-display";
import {
  updateRegularInstructorAssignmentStatus,
  deleteRegularInstructorAssignment,
} from "@/lib/regular-instructor-assignments";
import type { AssignmentDashboardRow } from "@/lib/regular-instructor-assignments";

const TONE_COLORS: Record<string, { bg: string; color: string }> = {
  good: { bg: "#dcfce7", color: "#166534" },
  warn: { bg: "#fef3c7", color: "#854d0e" },
  bad: { bg: "#fee2e2", color: "#991b1b" },
  neutral: { bg: "#e5e7eb", color: "#374151" },
};

const COVERAGE_BADGES: Record<
  string,
  { label: string; bg: string; color: string }
> = {
  UNCOVERED: { label: "Uncovered", bg: "#fee2e2", color: "#991b1b" },
  PARTIAL: { label: "Partially covered", bg: "#fef3c7", color: "#854d0e" },
  COVERED: { label: "Covered", bg: "#dcfce7", color: "#166534" },
};

function formatDate(value: Date | null | undefined) {
  if (!value) return "TBD";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function AssignmentsBoard({
  rows,
}: {
  rows: AssignmentDashboardRow[];
}) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {rows.map((row) => (
        <OfferingRow key={row.id} row={row} />
      ))}
    </div>
  );
}

function OfferingRow({ row }: { row: AssignmentDashboardRow }) {
  const coverage = COVERAGE_BADGES[row.coverageState];
  return (
    <div className="card" style={{ padding: 16 }}>
      <div
        style={{
          display: "flex",
          gap: 16,
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: "2 1 320px", minWidth: 0 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span
              style={{
                padding: "2px 8px",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 700,
                background: coverage.bg,
                color: coverage.color,
              }}
            >
              {coverage.label}
            </span>
            {row.template?.interestArea && (
              <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                {row.template.interestArea}
              </span>
            )}
            {row.template?.targetAgeGroup && (
              <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                · Ages {row.template.targetAgeGroup}
              </span>
            )}
          </div>
          <h3
            style={{
              margin: "6px 0 4px",
              fontSize: 15,
              fontWeight: 700,
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            <Link
              href={`/admin/classes/${row.id}`}
              style={{ color: "inherit", textDecoration: "none" }}
            >
              {row.title}
            </Link>
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: "var(--text-secondary)",
            }}
          >
            {row.chapter?.name ?? "Unassigned chapter"} ·{" "}
            {formatDate(row.startDate)} – {formatDate(row.endDate)} ·{" "}
            {row.meetingDays.join("/") || "No days set"} {row.meetingTime} ·{" "}
            {row.deliveryMode}
          </p>
        </div>

        <div style={{ flex: "3 1 360px", minWidth: 0 }}>
          <h4
            style={{
              margin: "0 0 6px",
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              color: "var(--text-secondary)",
              letterSpacing: 0.4,
            }}
          >
            Assignments ({row.regularInstructorAssignments.length})
          </h4>
          {row.regularInstructorAssignments.length === 0 ? (
            <p
              style={{
                margin: 0,
                fontSize: 12,
                color: "var(--text-secondary)",
                fontStyle: "italic",
              }}
            >
              {row.instructor
                ? `Legacy lead: ${row.instructor.name}. No assignment records yet.`
                : "No instructors assigned yet."}
            </p>
          ) : (
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "grid",
                gap: 4,
              }}
            >
              {row.regularInstructorAssignments.map((a) => {
                const tone = TONE_COLORS[assignmentStatusTone(a.status)];
                return (
                  <li
                    key={a.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>
                      {a.instructor.name}
                    </span>
                    <span style={{ color: "var(--text-secondary)" }}>
                      · {formatAssignmentRole(a.role)}
                    </span>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 999,
                        fontSize: 10,
                        fontWeight: 700,
                        background: tone.bg,
                        color: tone.color,
                      }}
                    >
                      {formatAssignmentStatus(a.status)}
                    </span>
                    <form
                      action={updateRegularInstructorAssignmentStatus}
                      style={{
                        marginLeft: "auto",
                        display: "flex",
                        gap: 4,
                        alignItems: "center",
                      }}
                    >
                      <input type="hidden" name="assignmentId" value={a.id} />
                      <select
                        name="status"
                        defaultValue={a.status}
                        aria-label={`Status for ${a.instructor.name}`}
                        style={{
                          fontSize: 10,
                          padding: "2px 4px",
                          borderRadius: 4,
                          border: "1px solid var(--border)",
                          background: "var(--bg)",
                        }}
                      >
                        {ASSIGNMENT_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {formatAssignmentStatus(s)}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        style={{
                          fontSize: 10,
                          padding: "2px 8px",
                          borderRadius: 4,
                          border: "1px solid var(--border)",
                          background: "var(--bg)",
                          cursor: "pointer",
                        }}
                      >
                        Update
                      </button>
                    </form>
                    <form action={deleteRegularInstructorAssignment}>
                      <input type="hidden" name="assignmentId" value={a.id} />
                      <button
                        type="submit"
                        aria-label={`Remove ${a.instructor.name}`}
                        title="Remove assignment"
                        style={{
                          fontSize: 10,
                          padding: "2px 6px",
                          borderRadius: 4,
                          border: "1px solid var(--border)",
                          background: "var(--bg)",
                          cursor: "pointer",
                          color: "#991b1b",
                        }}
                      >
                        ✕
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div
          style={{
            flex: "0 0 auto",
            display: "flex",
            flexDirection: "column",
            gap: 6,
            alignItems: "flex-end",
          }}
        >
          <Link
            href={`/admin/instructor-assignments/new?offering=${row.id}`}
            className="button"
            style={{ fontSize: 12, padding: "6px 12px" }}
          >
            + Assign instructor
          </Link>
          <Link
            href={`/admin/classes/${row.id}`}
            style={{
              fontSize: 11,
              color: "var(--text-secondary)",
              textDecoration: "none",
            }}
          >
            Manage class →
          </Link>
        </div>
      </div>
    </div>
  );
}
