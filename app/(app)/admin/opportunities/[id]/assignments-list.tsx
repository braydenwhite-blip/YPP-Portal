import {
  removeAssignment,
  updateAssignmentStatus,
} from "@/lib/workshop-opportunity-actions";

type Assignment = {
  id: string;
  role: string;
  status: string;
  assignedAt: Date;
  instructorConfirmedAt: Date | null;
  partnerConfirmedAt: Date | null;
  instructorNotes: string | null;
  internalNotes: string | null;
  instructor: {
    id: string;
    name: string | null;
    email: string | null;
    profile: { city: string | null; stateProvince: string | null } | null;
  };
  proposal: {
    id: string;
    status: string;
    template: { id: string; title: string } | null;
  } | null;
};

const STATUS_PILL: Record<string, string> = {
  SUGGESTED: "pill",
  PENDING: "pill pill-pending",
  CONFIRMED: "pill pill-success",
  WAITLISTED: "pill pill-info",
  DECLINED: "pill pill-attention",
  CANCELLED: "pill pill-declined",
  COMPLETED: "pill pill-purple",
};

const STATUS_OPTIONS = [
  "SUGGESTED",
  "PENDING",
  "CONFIRMED",
  "WAITLISTED",
  "DECLINED",
  "CANCELLED",
  "COMPLETED",
] as const;

export default function AssignmentsList({
  opportunityId,
  assignments,
}: {
  opportunityId: string;
  assignments: Assignment[];
}) {
  if (assignments.length === 0) {
    return (
      <div className="empty">
        <p>No instructors assigned yet.</p>
        <p style={{ fontSize: 13, marginTop: 4 }}>
          Pick from the suggestions panel on the right, or use “Shortlist top 5”.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {assignments.map((a) => {
        const location = [
          a.instructor.profile?.city,
          a.instructor.profile?.stateProvince,
        ]
          .filter(Boolean)
          .join(", ");
        return (
          <div
            key={a.id}
            className="card"
            style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 600 }}>
                  {a.instructor.name ?? "Unnamed instructor"}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {a.instructor.email}
                  {location ? ` · ${location}` : ""}
                </div>
                <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span className={STATUS_PILL[a.status] ?? "pill"}>{a.status.toLowerCase()}</span>
                  <span className="pill pill-small">{a.role.replace(/_/g, " ").toLowerCase()}</span>
                  {a.proposal && (
                    <span className="pill pill-small pill-purple">
                      Curriculum: {a.proposal.template?.title ?? "Custom design"}
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 180 }}>
                <form action={updateAssignmentStatus} style={{ display: "flex", gap: 6 }}>
                  <input type="hidden" name="assignmentId" value={a.id} />
                  <select name="status" defaultValue={a.status} style={selectStyle}>
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s.toLowerCase()}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="button small">
                    Save
                  </button>
                </form>
                <form action={removeAssignment}>
                  <input type="hidden" name="assignmentId" value={a.id} />
                  <button type="submit" className="button small ghost" style={{ width: "100%" }}>
                    Remove
                  </button>
                </form>
              </div>
            </div>

            {a.instructorConfirmedAt || a.partnerConfirmedAt ? (
              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                {a.instructorConfirmedAt &&
                  `Instructor confirmed ${a.instructorConfirmedAt.toLocaleDateString()}`}
                {a.instructorConfirmedAt && a.partnerConfirmedAt && " · "}
                {a.partnerConfirmedAt &&
                  `Partner confirmed ${a.partnerConfirmedAt.toLocaleDateString()}`}
              </div>
            ) : null}

            {a.instructorNotes && (
              <details style={{ fontSize: 12 }}>
                <summary style={{ cursor: "pointer", fontWeight: 600 }}>
                  Instructor-visible notes
                </summary>
                <div style={{ whiteSpace: "pre-wrap", marginTop: 6 }}>{a.instructorNotes}</div>
              </details>
            )}
            {a.internalNotes && (
              <details style={{ fontSize: 12 }}>
                <summary style={{ cursor: "pointer", fontWeight: 600 }}>
                  Internal admin notes
                </summary>
                <div
                  style={{
                    whiteSpace: "pre-wrap",
                    marginTop: 6,
                    color: "var(--text-secondary)",
                  }}
                >
                  {a.internalNotes}
                </div>
              </details>
            )}
          </div>
        );
      })}
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  padding: "6px 8px",
  borderRadius: 6,
  border: "1px solid var(--border)",
  fontSize: 12,
  background: "white",
};
