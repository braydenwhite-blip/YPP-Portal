import Link from "next/link";
import {
  listOfferingsForAssignmentPicker,
  rankInstructorsForOffering,
  createRegularInstructorAssignment,
} from "@/lib/regular-instructor-assignments";
import { requireAdminPage } from "@/lib/page-guards";
import {
  ASSIGNMENT_ROLES,
  ASSIGNMENT_STATUSES,
  formatAssignmentRole,
  formatAssignmentStatus,
} from "@/lib/regular-instructor-assignments-display";

type SearchParams = { offering?: string };

export const dynamic = "force-dynamic";

export default async function NewAssignmentPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  await requireAdminPage();

  const params = (await searchParams) ?? {};
  const offeringId = params.offering ?? null;

  const offerings = await listOfferingsForAssignmentPicker();
  const matches = offeringId
    ? await rankInstructorsForOffering({ offeringId, limit: 12 })
    : [];

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin · Regular instructors</p>
          <h1 className="page-title">New instructor assignment</h1>
          <p className="page-subtitle">
            Pick a class offering, review the suggested instructors, then
            assign.
          </p>
        </div>
        <div>
          <Link href="/admin/instructor-assignments" className="button">
            ← Back to assignments
          </Link>
        </div>
      </div>

      <div className="grid two" style={{ gap: 16, alignItems: "start" }}>
        <div className="card" style={{ padding: 16 }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>1. Pick a class offering</h3>
          <form method="get" style={{ display: "grid", gap: 8 }}>
            <label htmlFor="offering" style={labelStyle}>
              Class offering
            </label>
            <select
              id="offering"
              name="offering"
              defaultValue={offeringId ?? ""}
              style={inputStyle}
            >
              <option value="">Select a class…</option>
              {offerings.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.title} · {o.chapter?.name ?? "No chapter"} ·{" "}
                  {new Date(o.startDate).toLocaleDateString()}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="button"
              style={{
                background: "var(--ypp-purple, #6b21c8)",
                color: "#fff",
                fontSize: 13,
              }}
            >
              See suggested instructors
            </button>
          </form>
        </div>

        {offeringId && (
          <div className="card" style={{ padding: 16 }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>
              2. Confirm role and status
            </h3>
            <p
              style={{
                margin: "0 0 12px",
                fontSize: 12,
                color: "var(--text-secondary)",
              }}
            >
              Pick an instructor from the suggestions below. Submitting creates
              the assignment with the chosen role and status.
            </p>
            <p style={{ margin: 0, fontSize: 12 }}>
              <strong>Tip:</strong> If the instructor needs training or
              curriculum review first, choose <em>Blocked: training</em> or{" "}
              <em>Blocked: curriculum</em> so the dashboard surfaces it.
            </p>
          </div>
        )}
      </div>

      {offeringId && (
        <>
          <h3
            style={{
              fontSize: 13,
              fontWeight: 700,
              textTransform: "uppercase",
              color: "var(--text-secondary)",
              letterSpacing: 0.5,
              marginTop: 24,
              marginBottom: 12,
            }}
          >
            Suggested instructors
          </h3>
          {matches.length === 0 ? (
            <div className="card">
              <p style={{ margin: 0, color: "var(--text-secondary)" }}>
                No instructors found in the candidate pool. Check that there
                are users with the INSTRUCTOR role assigned.
              </p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {matches.map((match) => (
                <MatchCard
                  key={match.instructor.id}
                  match={match}
                  offeringId={offeringId}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MatchCard({
  match,
  offeringId,
}: {
  match: Awaited<ReturnType<typeof rankInstructorsForOffering>>[number];
  offeringId: string;
}) {
  const scoreColor =
    match.score >= 50
      ? "#166534"
      : match.score >= 25
        ? "#854d0e"
        : "#991b1b";
  return (
    <div
      className="card"
      style={{
        padding: 14,
        display: "flex",
        gap: 16,
        alignItems: "flex-start",
        flexWrap: "wrap",
      }}
    >
      <div style={{ flex: "1 1 280px", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <strong style={{ fontSize: 14 }}>{match.instructor.name}</strong>
          {match.instructor.chapterName && (
            <span
              style={{ fontSize: 11, color: "var(--text-secondary)" }}
            >
              {match.instructor.chapterName}
            </span>
          )}
          <span
            style={{
              marginLeft: "auto",
              fontSize: 18,
              fontWeight: 700,
              color: scoreColor,
            }}
            title="Match score"
          >
            {match.score}
          </span>
        </div>

        {match.reasons.length > 0 && (
          <ul style={listStyle}>
            {match.reasons.map((r, i) => (
              <li key={i} style={{ color: "#166534" }}>
                + {r}
              </li>
            ))}
          </ul>
        )}
        {match.warnings.length > 0 && (
          <ul style={listStyle}>
            {match.warnings.map((w, i) => (
              <li key={i} style={{ color: "#991b1b" }}>
                − {w}
              </li>
            ))}
          </ul>
        )}
        <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--text-secondary)" }}>
          Active assignments: {match.currentLoad}
          {match.readinessReady ? " · Ready to teach" : " · Not yet ready"}
        </p>
      </div>

      <form
        action={createRegularInstructorAssignment}
        style={{
          flex: "0 0 240px",
          display: "grid",
          gap: 6,
        }}
      >
        <input type="hidden" name="offeringId" value={offeringId} />
        <input
          type="hidden"
          name="instructorId"
          value={match.instructor.id}
        />
        <label style={labelStyle}>Role</label>
        <select name="role" defaultValue="LEAD" style={inputStyle}>
          {ASSIGNMENT_ROLES.map((r) => (
            <option key={r} value={r}>
              {formatAssignmentRole(r)}
            </option>
          ))}
        </select>
        <label style={labelStyle}>Status</label>
        <select
          name="status"
          defaultValue={match.readinessReady ? "OFFERED" : "NEEDS_TRAINING"}
          style={inputStyle}
        >
          {ASSIGNMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {formatAssignmentStatus(s)}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="button"
          style={{
            background: "var(--ypp-purple, #6b21c8)",
            color: "#fff",
            fontSize: 12,
            marginTop: 4,
          }}
        >
          Assign {match.instructor.name.split(" ")[0]}
        </button>
      </form>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  color: "var(--text-secondary)",
  letterSpacing: 0.4,
};

const inputStyle: React.CSSProperties = {
  fontSize: 13,
  padding: "6px 10px",
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "var(--bg)",
};

const listStyle: React.CSSProperties = {
  margin: "6px 0 0",
  paddingLeft: 18,
  fontSize: 12,
  listStyle: "none",
};
