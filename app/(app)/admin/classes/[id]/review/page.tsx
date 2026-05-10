import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { getAdminClassDetail } from "@/lib/admin-class-operations";
import {
  approveOfferingApproval,
  requestOfferingApprovalRevision,
  rejectOfferingApproval,
} from "@/lib/offering-approval-actions";

export const dynamic = "force-dynamic";

export default async function AdminClassReviewPage({
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
  const detail = await getAdminClassDetail(id);
  if (!detail) notFound();

  const status = detail.approval?.status ?? "NOT_REQUESTED";
  const isOpenForReview =
    status === "REQUESTED" ||
    status === "UNDER_REVIEW" ||
    status === "CHANGES_REQUESTED" ||
    status === "REJECTED";

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin · Proposal review</p>
          <h1 className="page-title">{detail.title}</h1>
          <p className="page-subtitle">
            Submitted by {detail.instructor.name} ({detail.instructor.email})
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={`/admin/classes/${detail.id}`} className="button" style={{ fontSize: 13 }}>
            ← Class detail
          </Link>
          <Link href="/admin/classes?tab=review" className="button secondary" style={{ fontSize: 13 }}>
            All proposals
          </Link>
        </div>
      </div>

      <div className="grid two" style={{ gap: 20, alignItems: "start" }}>
        <div style={{ display: "grid", gap: 16 }}>
          <Section title="At a glance">
            <Grid>
              <Cell label="Approval" value={status.replace(/_/g, " ")} />
              <Cell label="Class status" value={detail.status.replace("_", " ")} />
              <Cell label="Format" value={detail.deliveryMode.replace("_", " ")} />
              <Cell label="Capacity" value={String(detail.capacity)} />
              <Cell label="Chapter" value={detail.chapter?.name ?? "—"} />
              <Cell label="Semester" value={detail.semester ?? "—"} />
            </Grid>
          </Section>

          <Section title="Proposal description">
            <p style={{ marginTop: 0 }}>
              <strong>Title:</strong> {detail.title}
            </p>
            {detail.template?.description && (
              <p style={{ marginTop: 0, whiteSpace: "pre-line" }}>
                {detail.template.description}
              </p>
            )}
            {detail.template?.targetAgeGroup && (
              <p>
                <strong>Target ages:</strong> {detail.template.targetAgeGroup}
              </p>
            )}
            {detail.template?.classDurationMin && (
              <p>
                <strong>Session length:</strong> {detail.template.classDurationMin} min
              </p>
            )}
            {detail.template?.durationWeeks && (
              <p>
                <strong>Duration:</strong> {detail.template.durationWeeks} weeks ·{" "}
                {detail.template.sessionsPerWeek}× per week
              </p>
            )}
            {Array.isArray(detail.template?.learningOutcomes) &&
              detail.template.learningOutcomes.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <strong>Learning outcomes:</strong>
                  <ul>
                    {detail.template.learningOutcomes.map((outcome: string, idx: number) => (
                      <li key={idx}>{outcome}</li>
                    ))}
                  </ul>
                </div>
              )}
            {Array.isArray(detail.template?.prerequisites) &&
              detail.template.prerequisites.length > 0 && (
                <p>
                  <strong>Prerequisites:</strong>{" "}
                  {detail.template.prerequisites.join(", ")}
                </p>
              )}
          </Section>

          <Section title="In-person logistics">
            <Grid>
              <Cell label="Format" value={detail.deliveryMode.replace("_", " ")} />
              <Cell
                label="Location"
                value={detail.locationName || "—"}
                tone={
                  detail.deliveryMode === "IN_PERSON" && !detail.locationName
                    ? "bad"
                    : undefined
                }
              />
              <Cell
                label="Address"
                value={detail.locationAddress || "—"}
                tone={
                  detail.deliveryMode === "IN_PERSON" && !detail.locationAddress
                    ? "bad"
                    : undefined
                }
              />
              <Cell label="Room" value={detail.room || "—"} />
              <Cell label="Days" value={detail.meetingDays.join(", ") || "—"} />
              <Cell label="Time" value={detail.meetingTime || "—"} />
              <Cell label="Timezone" value={detail.timezone} />
              <Cell label="First session" value={detail.startDate.toLocaleString()} />
              <Cell label="Last session" value={detail.endDate.toLocaleString()} />
            </Grid>
            {detail.arrivalInstructions && (
              <div style={{ marginTop: 10, fontSize: 13 }}>
                <strong>Arrival instructions:</strong>{" "}
                <span style={{ whiteSpace: "pre-line" }}>
                  {detail.arrivalInstructions}
                </span>
              </div>
            )}
            {Array.isArray(detail.materialsList) && detail.materialsList.length > 0 && (
              <div style={{ marginTop: 10, fontSize: 13 }}>
                <strong>Materials:</strong>
                <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                  {detail.materialsList.map((item: string, idx: number) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            {(detail.deliveryMode === "VIRTUAL" || detail.deliveryMode === "HYBRID") && (
              <p style={{ marginTop: 8, fontSize: 13 }}>
                <strong>Meeting link:</strong>{" "}
                {detail.zoomLink ? detail.zoomLink : <span style={{ color: "#991b1b" }}>missing</span>}
              </p>
            )}
          </Section>

          <Section title="Instructor's request notes">
            {detail.approval?.requestNotes ? (
              <p style={{ margin: 0, whiteSpace: "pre-line" }}>
                {detail.approval.requestNotes}
              </p>
            ) : (
              <p style={{ margin: 0, color: "var(--text-secondary)" }}>
                No notes left by the instructor.
              </p>
            )}
          </Section>

          {detail.approval?.reviewNotes && (
            <Section title="Previous reviewer notes">
              <p style={{ margin: 0, whiteSpace: "pre-line" }}>
                {detail.approval.reviewNotes}
              </p>
            </Section>
          )}
        </div>

        <aside style={{ display: "grid", gap: 16 }}>
          <Section title="Decision">
            {!isOpenForReview && status === "APPROVED" && (
              <p style={{ margin: 0, color: "#166534" }}>
                This proposal is already approved. Use the publish controls on the class
                detail page to open it for signup.
              </p>
            )}
            {!isOpenForReview && status === "NOT_REQUESTED" && (
              <p style={{ margin: 0, color: "var(--text-secondary)" }}>
                The instructor has not yet requested review on this offering.
              </p>
            )}

            {isOpenForReview && (
              <>
                <form action={approveOfferingApproval} style={blockForm}>
                  <input type="hidden" name="offeringId" value={detail.id} />
                  <label style={fieldLabel}>
                    Approval note (optional)
                    <input name="reviewNotes" className="input" />
                  </label>
                  <button type="submit" className="button primary" style={{ fontSize: 13 }}>
                    Approve proposal
                  </button>
                  <p style={smallNote}>
                    Approval marks the class admin-cleared. Open enrollment separately on
                    the class detail page.
                  </p>
                </form>

                <form action={requestOfferingApprovalRevision} style={blockForm}>
                  <input type="hidden" name="offeringId" value={detail.id} />
                  <input type="hidden" name="status" value="CHANGES_REQUESTED" />
                  <label style={fieldLabel}>
                    What does the instructor need to fix?
                    <textarea
                      name="reviewNotes"
                      className="input"
                      rows={3}
                      required
                      placeholder="Be specific — the instructor sees this verbatim."
                    />
                  </label>
                  <button type="submit" className="button outline" style={{ fontSize: 13 }}>
                    Request revisions
                  </button>
                </form>

                <form action={rejectOfferingApproval} style={blockForm}>
                  <input type="hidden" name="offeringId" value={detail.id} />
                  <label style={fieldLabel}>
                    Why is this being rejected?
                    <textarea
                      name="reviewNotes"
                      className="input"
                      rows={3}
                      required
                      placeholder="Required. Document the reason for the audit trail."
                    />
                  </label>
                  <button
                    type="submit"
                    className="button outline"
                    style={{ fontSize: 13, color: "#991b1b", borderColor: "#fca5a5" }}
                  >
                    Reject proposal
                  </button>
                </form>
              </>
            )}
          </Section>

          <Section title="Instructor">
            <p style={{ margin: 0 }}>
              <strong>{detail.instructor.name}</strong>
            </p>
            <p style={{ margin: 0, fontSize: 13 }}>{detail.instructor.email}</p>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-secondary)" }}>
              {detail.chapter?.name ?? "No chapter"}
            </p>
          </Section>

          <Section title="Audit trail">
            <p style={{ margin: 0, fontSize: 13 }}>
              <strong>Approval status:</strong> {status.replace(/_/g, " ")}
            </p>
            <p style={{ margin: 0, fontSize: 13 }}>
              <strong>Submitted:</strong>{" "}
              {detail.approval?.requestedAt?.toLocaleString() ?? "—"}
            </p>
            <p style={{ margin: 0, fontSize: 13 }}>
              <strong>Last reviewed:</strong>{" "}
              {detail.approval?.reviewedAt?.toLocaleString() ?? "—"}
            </p>
          </Section>
        </aside>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card">
      <h2 className="section-title" style={{ margin: "0 0 10px" }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: 12,
      }}
    >
      {children}
    </div>
  );
}

function Cell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn" | "bad";
}) {
  const palette: Record<string, string> = {
    ok: "#166534",
    warn: "#854d0e",
    bad: "#991b1b",
  };
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--text-secondary)", textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: tone ? palette[tone] : "inherit" }}>
        {value}
      </div>
    </div>
  );
}

const blockForm: React.CSSProperties = {
  display: "grid",
  gap: 8,
  marginBottom: 14,
};

const fieldLabel: React.CSSProperties = {
  display: "grid",
  gap: 4,
  fontSize: 12,
  color: "var(--text-secondary)",
};

const smallNote: React.CSSProperties = {
  margin: 0,
  fontSize: 11,
  color: "var(--text-secondary)",
};
