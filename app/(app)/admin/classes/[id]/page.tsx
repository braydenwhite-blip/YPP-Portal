import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { getAdminClassDetail } from "@/lib/admin-class-operations";
import {
  adminPublishClassOffering,
  adminUnpublishClassOffering,
  adminCloseEnrollment,
  adminReopenEnrollment,
  adminCancelClassOffering,
  adminMarkClassCompleted,
  adminUpdateCapacity,
} from "@/lib/admin-class-operations";

export const dynamic = "force-dynamic";

export default async function AdminClassDetailPage({
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

  const approvalStatus = detail.approval?.status ?? "NOT_REQUESTED";
  const isInReview =
    approvalStatus === "REQUESTED" ||
    approvalStatus === "UNDER_REVIEW" ||
    approvalStatus === "CHANGES_REQUESTED";

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin · Class</p>
          <h1 className="page-title">{detail.title}</h1>
          <p className="page-subtitle">
            {detail.template?.title ? `From template: ${detail.template.title}` : null}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Link href="/admin/classes" className="button" style={{ fontSize: 13 }}>
            ← All classes
          </Link>
          <Link
            href={`/admin/classes/${detail.id}/roster`}
            className="button primary"
            style={{ fontSize: 13 }}
          >
            View roster
          </Link>
          {detail.isPublic && (
            <Link
              href={`/curriculum/${detail.id}`}
              className="button secondary"
              style={{ fontSize: 13 }}
              target="_blank"
            >
              Student page ↗
            </Link>
          )}
        </div>
      </div>

      <div className="grid two" style={{ gap: 20, alignItems: "start" }}>
        <div style={{ display: "grid", gap: 16 }}>
          <Section title="Status">
            <Row>
              <Cell label="Class status" value={detail.status.replace("_", " ")} />
              <Cell label="Enrollment" value={detail.enrollmentOpen ? "Open" : "Closed"} />
              <Cell label="Public" value={detail.isPublic ? "Yes" : "No"} />
            </Row>
            <Row>
              <Cell
                label="Approval"
                value={approvalStatus.replace(/_/g, " ")}
                tone={detail.isApproved ? "ok" : isInReview ? "warn" : "muted"}
              />
              <Cell
                label="Requested"
                value={detail.approval?.requestedAt?.toLocaleString() ?? "—"}
              />
              <Cell
                label="Reviewed"
                value={detail.approval?.reviewedAt?.toLocaleString() ?? "—"}
              />
            </Row>
            {detail.approval?.requestNotes && (
              <NoteBlock label="Instructor request notes" body={detail.approval.requestNotes} />
            )}
            {detail.approval?.reviewNotes && (
              <NoteBlock label="Reviewer notes" body={detail.approval.reviewNotes} />
            )}
            {isInReview && (
              <p style={{ marginTop: 8 }}>
                <Link href={`/admin/classes/${detail.id}/review`} className="button primary" style={{ fontSize: 13 }}>
                  Open review panel
                </Link>
              </p>
            )}
          </Section>

          <Section title="Instructor">
            <p style={{ margin: 0 }}>
              <strong>{detail.instructor.name}</strong> · {detail.instructor.email}
            </p>
            <p style={{ marginTop: 4, color: "var(--text-secondary)" }}>
              {detail.chapter?.name ?? "No chapter"}
            </p>
          </Section>

          <Section title="Schedule">
            <Row>
              <Cell label="Starts" value={detail.startDate.toLocaleString()} />
              <Cell label="Ends" value={detail.endDate.toLocaleString()} />
            </Row>
            <Row>
              <Cell label="Days" value={detail.meetingDays.join(", ") || "—"} />
              <Cell label="Time" value={detail.meetingTime || "—"} />
              <Cell label="Timezone" value={detail.timezone} />
            </Row>
            <Row>
              <Cell label="Sessions scheduled" value={String(detail._count.sessions)} />
              <Cell label="Semester" value={detail.semester ?? "—"} />
            </Row>
          </Section>

          <Section title="Location & Arrival">
            <Row>
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
            </Row>
            {detail.deliveryMode === "IN_PERSON" && (
              <Row>
                <Cell
                  label="Address"
                  value={detail.locationAddress || "—"}
                  tone={!detail.locationAddress ? "bad" : undefined}
                />
              </Row>
            )}
            {(detail.deliveryMode === "VIRTUAL" || detail.deliveryMode === "HYBRID") && (
              <Row>
                <Cell
                  label="Meeting link"
                  value={detail.zoomLink || "—"}
                  tone={!detail.zoomLink ? "bad" : undefined}
                />
              </Row>
            )}
            {detail.deliveryMode !== "IN_PERSON" && (
              <p style={{ marginTop: 6, fontSize: 12, color: "var(--text-secondary)" }}>
                Online links are optional for in-person classes — most YPP classes meet in
                person.
              </p>
            )}
          </Section>

          <Section title="Capacity & Registration">
            <Row>
              <Cell label="Capacity" value={String(detail.capacity)} />
              <Cell
                label="Confirmed"
                value={String(detail.confirmedCount)}
                tone={detail.confirmedCount >= detail.capacity ? "warn" : undefined}
              />
              <Cell
                label="Waitlisted"
                value={String(detail.waitlistedCount)}
                tone={detail.waitlistedCount > 0 ? "warn" : undefined}
              />
            </Row>
            <form action={adminUpdateCapacity} style={inlineForm}>
              <input type="hidden" name="offeringId" value={detail.id} />
              <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                Update capacity
              </label>
              <input
                type="number"
                name="capacity"
                min={1}
                defaultValue={detail.capacity}
                className="input"
                style={{ width: 100 }}
              />
              <button type="submit" className="button" style={{ fontSize: 12 }}>
                Save capacity
              </button>
            </form>
          </Section>

          {detail.template && (
            <Section title="Curriculum">
              <Row>
                <Cell label="Interest area" value={detail.template.interestArea} />
                <Cell label="Difficulty" value={detail.template.difficultyLevel} />
                <Cell label="Target ages" value={detail.template.targetAgeGroup ?? "—"} />
              </Row>
              {detail.template.description && (
                <p style={{ margin: "8px 0 0", fontSize: 14 }}>
                  {detail.template.description.slice(0, 400)}
                  {detail.template.description.length > 400 ? "…" : ""}
                </p>
              )}
              {Array.isArray(detail.template.prerequisites) &&
                detail.template.prerequisites.length > 0 && (
                  <p style={{ marginTop: 8, fontSize: 13 }}>
                    <strong>Prerequisites:</strong>{" "}
                    {detail.template.prerequisites.join(", ")}
                  </p>
                )}
              {Array.isArray(detail.template.learningOutcomes) &&
                detail.template.learningOutcomes.length > 0 && (
                  <p style={{ marginTop: 8, fontSize: 13 }}>
                    <strong>Learning outcomes:</strong>{" "}
                    {detail.template.learningOutcomes.join("; ")}
                  </p>
                )}
            </Section>
          )}
        </div>

        <aside style={{ display: "grid", gap: 16 }}>
          <Section title="Publishing controls">
            {!detail.isApproved && (
              <p style={{ margin: 0, fontSize: 13, color: "#9f1239" }}>
                This class has not been approved. Approve it from the review panel before
                publishing.
              </p>
            )}
            {detail.isApproved && detail.status === "DRAFT" && (
              <form action={adminPublishClassOffering} style={stackedForm}>
                <input type="hidden" name="offeringId" value={detail.id} />
                <button type="submit" className="button primary" style={{ fontSize: 13 }}>
                  Publish &amp; open enrollment
                </button>
                <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>
                  Sets status to PUBLISHED and opens enrollment.
                </p>
              </form>
            )}
            {(detail.status === "PUBLISHED" || detail.status === "IN_PROGRESS") && (
              <>
                <form action={adminUnpublishClassOffering} style={stackedForm}>
                  <input type="hidden" name="offeringId" value={detail.id} />
                  <button type="submit" className="button outline" style={{ fontSize: 13 }}>
                    Unpublish (return to draft)
                  </button>
                </form>
                {detail.enrollmentOpen ? (
                  <form action={adminCloseEnrollment} style={stackedForm}>
                    <input type="hidden" name="offeringId" value={detail.id} />
                    <button type="submit" className="button" style={{ fontSize: 13 }}>
                      Close enrollment
                    </button>
                  </form>
                ) : (
                  <form action={adminReopenEnrollment} style={stackedForm}>
                    <input type="hidden" name="offeringId" value={detail.id} />
                    <button type="submit" className="button" style={{ fontSize: 13 }}>
                      Reopen enrollment
                    </button>
                  </form>
                )}
              </>
            )}
            {detail.status !== "CANCELLED" && detail.status !== "COMPLETED" && (
              <>
                <form action={adminMarkClassCompleted} style={stackedForm}>
                  <input type="hidden" name="offeringId" value={detail.id} />
                  <button type="submit" className="button outline" style={{ fontSize: 13 }}>
                    Mark completed
                  </button>
                </form>
                <form action={adminCancelClassOffering} style={stackedForm}>
                  <input type="hidden" name="offeringId" value={detail.id} />
                  <button
                    type="submit"
                    className="button outline"
                    style={{ fontSize: 13, color: "#991b1b" }}
                  >
                    Cancel class
                  </button>
                </form>
              </>
            )}
          </Section>

          <Section title="Quick links">
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
              <li>
                <Link href={`/admin/classes/${detail.id}/roster`}>Open roster</Link>
              </li>
              <li>
                <Link href={`/admin/classes/${detail.id}/review`}>Review panel</Link>
              </li>
              <li>
                <Link href="/admin/curricula">Curriculum review queue</Link>
              </li>
              <li>
                <Link href="/admin/instructor-readiness">Instructor readiness</Link>
              </li>
            </ul>
          </Section>

          <Section title="Activity">
            <p style={{ margin: 0, fontSize: 13 }}>
              <strong>Created:</strong> {detail.createdAt.toLocaleString()}
            </p>
            <p style={{ margin: 0, fontSize: 13 }}>
              <strong>Updated:</strong> {detail.updatedAt.toLocaleString()}
            </p>
            <p style={{ margin: 0, fontSize: 13 }}>
              <strong>Announcements:</strong> {detail._count.announcements}
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

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: 10,
        marginBottom: 8,
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
  tone?: "ok" | "warn" | "bad" | "muted";
}) {
  const palette: Record<string, string> = {
    ok: "#166534",
    warn: "#854d0e",
    bad: "#991b1b",
    muted: "#6b7280",
  };
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--text-secondary)", textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ fontSize: 14, color: tone ? palette[tone] : "inherit", fontWeight: 600 }}>
        {value}
      </div>
    </div>
  );
}

function NoteBlock({ label, body }: { label: string; body: string }) {
  return (
    <div
      style={{
        marginTop: 10,
        padding: "10px 12px",
        background: "var(--surface-alt, #f9fafb)",
        borderRadius: 8,
        fontSize: 13,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div>{body}</div>
    </div>
  );
}

const inlineForm: React.CSSProperties = {
  display: "flex",
  gap: 6,
  alignItems: "center",
  marginTop: 10,
  flexWrap: "wrap",
};

const stackedForm: React.CSSProperties = {
  display: "grid",
  gap: 6,
  marginTop: 10,
};
