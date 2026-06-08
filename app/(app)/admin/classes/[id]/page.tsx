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
  adminUpdateLogistics,
  adminReassignInstructor,
} from "@/lib/admin-class-operations";
import { getOfferingTimeline } from "@/lib/class-offering-timeline";
import { computePublishReadiness } from "@/lib/class-publish-readiness";
import { PublishReadinessChecklist } from "@/components/classes/publish-readiness-checklist";
import { listPartnerOptions } from "@/lib/partners-queries";
import { setClassPartner } from "@/lib/partners-actions";
import { PersonLink } from "@/components/people-strategy/person-link";
import { isActionTrackerEnabled, isOperationsHubEnabled } from "@/lib/feature-flags";
import { getActionsForEntity } from "@/lib/people-strategy/action-queries";
import { canCreateAction } from "@/lib/people-strategy/action-permissions";
import { getMenteeSupport } from "@/lib/people-strategy/connections";
import { LinkedActionsPanel } from "@/components/people-strategy/linked-actions-panel";

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
  const [detail, timeline, partnerOptions] = await Promise.all([
    getAdminClassDetail(id),
    getOfferingTimeline(id, 25),
    listPartnerOptions(),
  ]);
  if (!detail) notFound();

  // People Strategy Operating System — class connections panel. Additive and
  // double-flagged: the linked-action reads are tracker-gated, and the whole
  // panel is hidden unless the Operations Hub flag is on, so existing admins
  // see no change with the flags off.
  const operationsEnabled = isOperationsHubEnabled() && isActionTrackerEnabled();
  const viewer = {
    id: session?.user?.id ?? "",
    roles: session?.user?.roles ?? [],
    primaryRole: session?.user?.primaryRole ?? null,
    adminSubtypes: session?.user?.adminSubtypes ?? [],
  };
  const [linkedActions, leadSupport] = operationsEnabled
    ? await Promise.all([
        getActionsForEntity("CLASS_OFFERING", id, viewer),
        getMenteeSupport(detail.instructor.id),
      ])
    : [[], null];
  const canCreate = canCreateAction(viewer);

  const approvalStatus = detail.approval?.status ?? "NOT_REQUESTED";
  const isInReview =
    approvalStatus === "REQUESTED" ||
    approvalStatus === "UNDER_REVIEW" ||
    approvalStatus === "CHANGES_REQUESTED";

  const readiness = computePublishReadiness({
    title: detail.title,
    description: detail.template?.description,
    instructorId: detail.instructorId,
    startDate: detail.startDate,
    endDate: detail.endDate,
    meetingDays: detail.meetingDays,
    meetingTime: detail.meetingTime,
    capacity: detail.capacity,
    targetAgeGroup: detail.template?.targetAgeGroup,
    deliveryMode: detail.deliveryMode,
    locationName: detail.locationName,
    locationAddress: detail.locationAddress,
    zoomLink: detail.zoomLink,
    sessionCount: detail._count.sessions,
    approvalStatus,
    grandfatheredTrainingExemption: detail.grandfatheredTrainingExemption,
    editHref: `/instructor/class-settings?offering=${detail.id}`,
    reviewHref: `/admin/classes/${detail.id}/review`,
  });

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
          {operationsEnabled && (
            <Section title="Support & mentor status">
              {leadSupport ? (
                <p style={{ margin: 0, fontSize: 13 }}>
                  Lead instructor{" "}
                  <strong>{detail.instructor.name ?? detail.instructor.email}</strong>{" "}
                  is mentored by{" "}
                  <PersonLink
                    id={leadSupport.mentor.id}
                    style={{ color: "var(--ypp-purple)", fontWeight: 600 }}
                  >
                    {leadSupport.mentor.name ?? leadSupport.mentor.email}
                  </PersonLink>
                  .
                </p>
              ) : (
                <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
                  The lead instructor does not have an active mentor yet.
                </p>
              )}
            </Section>
          )}

          {operationsEnabled && (
            <LinkedActionsPanel
              actions={linkedActions}
              heading="Class actions"
              createHref={`/actions/new?relatedType=CLASS_OFFERING&relatedId=${detail.id}`}
              createLabel="Create action for this class"
              canCreate={canCreate}
              emptyHint="No actions are linked to this class yet."
            />
          )}

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
            <form action={adminReassignInstructor} style={inlineForm}>
              <input type="hidden" name="offeringId" value={detail.id} />
              <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                Reassign to (instructor user ID)
              </label>
              <input
                name="instructorId"
                className="input"
                placeholder="user_..."
                style={{ fontFamily: "monospace", fontSize: 12 }}
              />
              <button type="submit" className="button" style={{ fontSize: 12 }}>
                Reassign instructor
              </button>
            </form>
            <p style={{ marginTop: 4, fontSize: 11, color: "var(--text-secondary)" }}>
              The new user must have the INSTRUCTOR role. Reassignment does not
              re-validate readiness — use only when the original instructor is
              unreachable.
            </p>
          </Section>

          <Section title="Partner">
            {detail.partner ? (
              <p style={{ margin: 0 }}>
                <strong>{detail.partner.name}</strong>
                {detail.partner.relationshipLead ? (
                  <>
                    {" · Relationship Lead: "}
                    <PersonLink
                      id={detail.partner.relationshipLead.id}
                      style={{ color: "var(--ypp-purple)", fontWeight: 600 }}
                    >
                      {detail.partner.relationshipLead.name ||
                        detail.partner.relationshipLead.email}
                    </PersonLink>
                  </>
                ) : (
                  " · No Relationship Lead"
                )}
              </p>
            ) : (
              <p style={{ margin: 0, color: "var(--text-secondary)" }}>No partner assigned.</p>
            )}
            <form action={setClassPartner} style={inlineForm}>
              <input type="hidden" name="offeringId" value={detail.id} />
              <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                Assign partner
              </label>
              <select
                name="partnerId"
                className="input"
                defaultValue={detail.partner?.id ?? ""}
                style={{ fontSize: 12 }}
              >
                <option value="">— No partner —</option>
                {partnerOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
              <button type="submit" className="button" style={{ fontSize: 12 }}>
                Save partner
              </button>
            </form>
            <p style={{ marginTop: 4, fontSize: 11, color: "var(--text-secondary)" }}>
              Manage the partner directory and Relationship Leads under{" "}
              <Link href="/admin/partners" style={{ color: "var(--ypp-purple)" }}>
                Admin · Partners
              </Link>
              .
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
              <Cell label="Room" value={detail.room || "—"} />
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
            {detail.arrivalInstructions ? (
              <NoteBlock label="Arrival instructions" body={detail.arrivalInstructions} />
            ) : (
              <p style={{ marginTop: 6, fontSize: 12, color: "var(--text-secondary)" }}>
                No arrival instructions on file. Add them below so families know where to
                go.
              </p>
            )}
            {Array.isArray(detail.materialsList) && detail.materialsList.length > 0 ? (
              <div style={{ marginTop: 10 }}>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-secondary)",
                    textTransform: "uppercase",
                    marginBottom: 4,
                  }}
                >
                  Materials
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                  {detail.materialsList.map((item: string, idx: number) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <form action={adminUpdateLogistics} style={stackedForm}>
              <input type="hidden" name="offeringId" value={detail.id} />
              <h3
                className="section-title"
                style={{ margin: "16px 0 6px", fontSize: 13 }}
              >
                Update logistics
              </h3>
              <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                Room (optional)
                <input
                  name="room"
                  className="input"
                  defaultValue={detail.room ?? ""}
                  placeholder="e.g. Studio B"
                />
              </label>
              <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                Arrival instructions
                <textarea
                  name="arrivalInstructions"
                  className="input"
                  rows={3}
                  defaultValue={detail.arrivalInstructions ?? ""}
                  placeholder="Enter through the back gate; sign in at the front desk."
                />
              </label>
              <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                Materials (one per line)
                <textarea
                  name="materialsList"
                  className="input"
                  rows={3}
                  defaultValue={(detail.materialsList ?? []).join("\n")}
                  placeholder={"Sketchbook\nGraphite pencils\nWater bottle"}
                />
              </label>
              <button type="submit" className="button" style={{ fontSize: 13 }}>
                Save logistics
              </button>
              <p style={{ margin: 0, fontSize: 11, color: "var(--text-secondary)" }}>
                Each save is journaled to the class timeline.
              </p>
            </form>

            {detail.deliveryMode !== "IN_PERSON" && (
              <p style={{ marginTop: 10, fontSize: 12, color: "var(--text-secondary)" }}>
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
          {detail.status === "DRAFT" && (
            <Section title="Publish readiness">
              <PublishReadinessChecklist readiness={readiness} />
            </Section>
          )}
          <Section title="Publishing controls">
            {!detail.isApproved && (
              <p style={{ margin: 0, fontSize: 13, color: "#9f1239" }}>
                This class has not been approved. Approve it from the review panel before
                publishing.
              </p>
            )}
            {detail.isApproved && detail.status === "DRAFT" && readiness.ready && (
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
            {detail.isApproved && detail.status === "DRAFT" && !readiness.ready && (
              <p style={{ margin: 0, fontSize: 13, color: "#9f1239" }}>
                Resolve the {readiness.missing.length} item
                {readiness.missing.length === 1 ? "" : "s"} in the readiness checklist above before
                publishing.
              </p>
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
              <li>
                <Link href="/admin/classes/reports">Class reports</Link>
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

          <Section title="Timeline">
            {timeline.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
                No admin actions on this class yet.
              </p>
            ) : (
              <ul
                style={{
                  margin: 0,
                  padding: 0,
                  listStyle: "none",
                  display: "grid",
                  gap: 10,
                }}
              >
                {timeline.map((event) => (
                  <li
                    key={event.id}
                    style={{
                      borderLeft: "3px solid var(--ypp-purple, #6b21c8)",
                      paddingLeft: 10,
                    }}
                  >
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      {event.createdAt.toLocaleString()} ·{" "}
                      {event.actor?.name ?? "System"}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                      {event.kind.replace(/_/g, " ")}
                    </div>
                    {event.summary && (
                      <div style={{ fontSize: 13 }}>{event.summary}</div>
                    )}
                  </li>
                ))}
              </ul>
            )}
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
