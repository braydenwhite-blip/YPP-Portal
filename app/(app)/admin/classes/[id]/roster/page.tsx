import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import {
  getAdminClassRoster,
  adminPromoteFromWaitlist,
  adminUpdateEnrollmentStatus,
  adminUpdateCapacity,
} from "@/lib/admin-class-operations";

export const dynamic = "force-dynamic";

type RosterEntry = NonNullable<
  Awaited<ReturnType<typeof getAdminClassRoster>>
>["enrollments"][number];

export default async function AdminClassRosterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    redirect("/");
  }

  const { id } = await params;
  const data = await getAdminClassRoster(id);
  if (!data) notFound();

  const { offering, enrollments, groups } = data;
  const overCapacity = groups.confirmed.length > offering.capacity;
  const seenStudentIds = new Map<string, number>();
  for (const entry of enrollments) {
    seenStudentIds.set(
      entry.student.id,
      (seenStudentIds.get(entry.student.id) ?? 0) + 1,
    );
  }
  const duplicates = new Set(
    [...seenStudentIds.entries()]
      .filter(([, count]) => count > 1)
      .map(([studentId]) => studentId),
  );

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin · Roster</p>
          <h1 className="page-title">{offering.title}</h1>
          <p className="page-subtitle">
            {groups.confirmed.length}/{offering.capacity} confirmed ·{" "}
            {groups.waitlisted.length} waitlisted ·{" "}
            {offering.enrollmentOpen ? "Enrollment open" : "Enrollment closed"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={`/admin/classes/${offering.id}`} className="button" style={{ fontSize: 13 }}>
            ← Class detail
          </Link>
        </div>
      </div>

      {overCapacity && (
        <div
          className="card"
          style={{ background: "#fee2e2", border: "1px solid #fca5a5", marginBottom: 16 }}
        >
          <strong>Confirmed roster exceeds capacity.</strong>{" "}
          {groups.confirmed.length} confirmed against capacity {offering.capacity}.
          Move someone to waitlist or raise the capacity.
        </div>
      )}

      <div className="grid two" style={{ gap: 16, marginBottom: 16 }}>
        <div className="card">
          <h3 className="section-title" style={{ margin: "0 0 8px" }}>
            Capacity
          </h3>
          <form action={adminUpdateCapacity} style={inlineForm}>
            <input type="hidden" name="offeringId" value={offering.id} />
            <input
              type="number"
              name="capacity"
              min={1}
              defaultValue={offering.capacity}
              className="input"
              style={{ width: 100 }}
            />
            <button type="submit" className="button" style={{ fontSize: 12 }}>
              Save capacity
            </button>
          </form>
        </div>
        <div className="card">
          <h3 className="section-title" style={{ margin: "0 0 8px" }}>
            Waitlist
          </h3>
          <form action={adminPromoteFromWaitlist}>
            <input type="hidden" name="offeringId" value={offering.id} />
            <button
              type="submit"
              className="button primary"
              style={{ fontSize: 12 }}
              disabled={
                groups.waitlisted.length === 0 ||
                groups.confirmed.length >= offering.capacity
              }
            >
              Promote next from waitlist
            </button>
          </form>
        </div>
      </div>

      <RosterSection
        title={`Confirmed (${groups.confirmed.length})`}
        emptyText="No confirmed students yet."
        rows={groups.confirmed}
        duplicates={duplicates}
        actions={["WAITLIST", "DROP", "COMPLETE"]}
      />
      <RosterSection
        title={`Waitlisted (${groups.waitlisted.length})`}
        emptyText="No one on the waitlist."
        rows={groups.waitlisted}
        duplicates={duplicates}
        actions={["ENROLL", "DROP"]}
      />
      <RosterSection
        title={`Dropped (${groups.dropped.length})`}
        emptyText="No drops."
        rows={groups.dropped}
        duplicates={duplicates}
        actions={["ENROLL"]}
        muted
      />
      <RosterSection
        title={`Completed (${groups.completed.length})`}
        emptyText="No completions yet."
        rows={groups.completed}
        duplicates={duplicates}
        actions={[]}
        muted
      />
    </div>
  );
}

function RosterSection({
  title,
  emptyText,
  rows,
  duplicates,
  actions,
  muted = false,
}: {
  title: string;
  emptyText: string;
  rows: RosterEntry[];
  duplicates: Set<string>;
  actions: ("ENROLL" | "WAITLIST" | "DROP" | "COMPLETE")[];
  muted?: boolean;
}) {
  return (
    <section className="card" style={{ marginBottom: 16, opacity: muted ? 0.85 : 1 }}>
      <h2 className="section-title" style={{ marginTop: 0 }}>
        {title}
      </h2>
      {rows.length === 0 ? (
        <p style={{ margin: 0, color: "var(--text-secondary)" }}>{emptyText}</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#faf5ff" }}>
                <th style={th}>Student</th>
                <th style={th}>Grade</th>
                <th style={th}>Email</th>
                <th style={th}>Parent / Guardian</th>
                <th style={th}>Signed up</th>
                <th style={th}>Status</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((entry) => (
                <RosterRow
                  key={entry.id}
                  entry={entry}
                  isDuplicate={duplicates.has(entry.student.id)}
                  actions={actions}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function RosterRow({
  entry,
  isDuplicate,
  actions,
}: {
  entry: RosterEntry;
  isDuplicate: boolean;
  actions: ("ENROLL" | "WAITLIST" | "DROP" | "COMPLETE")[];
}) {
  const parents = entry.student.studentLinks ?? [];
  const primaryParent = parents[0]?.parent;
  const grade =
    entry.student.profile?.grade != null
      ? String(entry.student.profile.grade)
      : "—";
  const parentEmail =
    primaryParent?.email ?? entry.student.profile?.parentEmail ?? "—";
  const parentPhone =
    primaryParent?.phone ?? entry.student.profile?.parentPhone ?? null;

  return (
    <tr style={{ borderBottom: "1px solid var(--border)" }}>
      <td style={td}>
        <div style={{ fontWeight: 600 }}>
          {entry.student.name}
          {isDuplicate && (
            <span
              style={{
                marginLeft: 6,
                fontSize: 10,
                fontWeight: 700,
                padding: "1px 6px",
                background: "#fee2e2",
                color: "#991b1b",
                borderRadius: 4,
              }}
            >
              DUPLICATE
            </span>
          )}
        </div>
        {entry.waitlistPosition != null && (
          <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
            #{entry.waitlistPosition} on waitlist
          </div>
        )}
      </td>
      <td style={td}>{grade}</td>
      <td style={td}>
        <div>{entry.student.email}</div>
        {entry.student.phone && (
          <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
            {entry.student.phone}
          </div>
        )}
      </td>
      <td style={td}>
        {primaryParent ? (
          <>
            <div>{primaryParent.name}</div>
            <div style={{ fontSize: 12 }}>{parentEmail}</div>
            {parentPhone && (
              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{parentPhone}</div>
            )}
          </>
        ) : entry.student.profile?.parentEmail ? (
          <>
            <div style={{ fontSize: 12 }}>{entry.student.profile.parentEmail}</div>
            {entry.student.profile.parentPhone && (
              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                {entry.student.profile.parentPhone}
              </div>
            )}
          </>
        ) : (
          <span style={{ color: "var(--text-secondary)" }}>—</span>
        )}
      </td>
      <td style={td}>{entry.enrolledAt.toLocaleDateString()}</td>
      <td style={td}>
        <span style={statusBadge(entry.status)}>{entry.status}</span>
      </td>
      <td style={td}>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {actions.includes("ENROLL") && (
            <ActionForm enrollmentId={entry.id} status="ENROLLED" label="Confirm" />
          )}
          {actions.includes("WAITLIST") && (
            <ActionForm enrollmentId={entry.id} status="WAITLISTED" label="Waitlist" />
          )}
          {actions.includes("COMPLETE") && (
            <ActionForm enrollmentId={entry.id} status="COMPLETED" label="Complete" />
          )}
          {actions.includes("DROP") && (
            <ActionForm enrollmentId={entry.id} status="DROPPED" label="Drop" danger />
          )}
        </div>
      </td>
    </tr>
  );
}

function ActionForm({
  enrollmentId,
  status,
  label,
  danger = false,
}: {
  enrollmentId: string;
  status: "ENROLLED" | "WAITLISTED" | "DROPPED" | "COMPLETED";
  label: string;
  danger?: boolean;
}) {
  return (
    <form action={adminUpdateEnrollmentStatus}>
      <input type="hidden" name="enrollmentId" value={enrollmentId} />
      <input type="hidden" name="status" value={status} />
      <button
        type="submit"
        className="button"
        style={{
          fontSize: 11,
          padding: "3px 8px",
          color: danger ? "#991b1b" : undefined,
        }}
      >
        {label}
      </button>
    </form>
  );
}

function statusBadge(status: string): React.CSSProperties {
  const palette: Record<string, { bg: string; color: string }> = {
    ENROLLED: { bg: "#dcfce7", color: "#166534" },
    WAITLISTED: { bg: "#fef3c7", color: "#854d0e" },
    DROPPED: { bg: "#fee2e2", color: "#991b1b" },
    COMPLETED: { bg: "#f3e8ff", color: "#6b21a8" },
  };
  const c = palette[status] ?? { bg: "#e5e7eb", color: "#374151" };
  return {
    padding: "2px 8px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    background: c.bg,
    color: c.color,
  };
}

const th: React.CSSProperties = {
  padding: "8px 10px",
  textAlign: "left",
  borderBottom: "1px solid var(--border)",
  fontSize: 12,
  fontWeight: 700,
  color: "var(--text-secondary)",
};

const td: React.CSSProperties = {
  padding: "8px 10px",
  verticalAlign: "top",
};

const inlineForm: React.CSSProperties = {
  display: "flex",
  gap: 6,
  alignItems: "center",
};
