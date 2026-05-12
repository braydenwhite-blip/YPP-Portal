import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { withPrismaFallback } from "@/lib/prisma-guard";
import {
  difficultyLabel,
  isSubmissionReviewable,
  recommendationLabel,
  sourceTypeLabel,
  submissionStatusLabel,
  submissionStatusTone,
  workshopFormatLabel,
} from "@/lib/workshop-proposal-constants";
import {
  normalizeCustomWorkshop,
  normalizeReflection,
  submissionIssues,
} from "@/lib/workshop-proposal-validation";
import type { WorkshopOutline } from "@/lib/summer-workshop";
import { ReviewDecisionForm } from "./review-form";
import { StartReviewBanner } from "./start-review";

/**
 * Normalize the legacy `InstructorApplication.workshopOutline` JSON column
 * (collected at signup time, before the WorkshopProposalSubmission flow
 * existed) into a typed read-only shape. The new submission table is the
 * source of truth for review; this is purely informational context.
 */
function normalizeLegacyWorkshopOutline(
  value: unknown
): WorkshopOutline | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const asString = (x: unknown) => (typeof x === "string" ? x.trim() : "");
  const asStringArray = (x: unknown) =>
    Array.isArray(x)
      ? x.filter((s): s is string => typeof s === "string").map((s) => s.trim()).filter(Boolean)
      : [];
  const asPositiveInt = (x: unknown) => {
    const n = Number(x);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
  };
  const outline: WorkshopOutline = {
    title: asString(v.title),
    ageRange: asString(v.ageRange),
    durationMinutes: asPositiveInt(v.durationMinutes),
    learningGoals: asStringArray(v.learningGoals),
    activityFlow: asString(v.activityFlow),
    materialsNeeded: asStringArray(v.materialsNeeded),
    engagementHook: asString(v.engagementHook),
    adaptationNotes: asString(v.adaptationNotes),
  };
  // Only return the outline if it contains some signal; an empty Json object
  // has nothing useful to render.
  const hasSignal =
    outline.title ||
    outline.ageRange ||
    outline.durationMinutes ||
    outline.learningGoals.length > 0 ||
    outline.activityFlow ||
    outline.materialsNeeded.length > 0 ||
    outline.engagementHook ||
    outline.adaptationNotes;
  return hasSignal ? outline : null;
}

export default async function WorkshopReviewDetailPage({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  const { submissionId } = await params;
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");
  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");
  const isChapterLead = roles.includes("CHAPTER_PRESIDENT");
  if (!isAdmin && !isChapterLead) {
    redirect("/");
  }

  const submission = await withPrismaFallback(
    "workshop-review-detail:submission",
    () =>
      prisma.workshopProposalSubmission.findUnique({
        where: { id: submissionId },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              chapterId: true,
              chapter: { select: { name: true } },
              instructorApplications: {
                where: {
                  status: {
                    notIn: ["REJECTED", "WITHDRAWN"],
                  },
                },
                orderBy: { createdAt: "desc" },
                take: 1,
                select: {
                  applicationTrack: true,
                  instructorSubtype: true,
                  workshopOutline: true,
                },
              },
            },
          },
          template: true,
          reviews: {
            where: { committed: true },
            orderBy: { committedAt: "desc" },
            include: {
              reviewer: { select: { id: true, name: true, email: true } },
            },
          },
        },
      }),
    null
  );

  if (!submission) notFound();

  // Chapter-scoped reviewer guard: chapter leads can only open submissions
  // from their own chapter. Admins bypass.
  if (!isAdmin && isChapterLead) {
    const reviewer = await withPrismaFallback(
      "workshop-review-detail:reviewer-chapter",
      () =>
        prisma.user.findUnique({
          where: { id: session.user.id },
          select: { chapterId: true },
        }),
      null
    );
    if (
      !reviewer?.chapterId ||
      !submission.author.chapterId ||
      reviewer.chapterId !== submission.author.chapterId
    ) {
      // Don't leak existence of out-of-chapter submissions — show 404.
      notFound();
    }
  }

  const custom =
    submission.sourceType === "CUSTOM_DESIGN"
      ? normalizeCustomWorkshop(submission.customWorkshop)
      : null;
  const reflection = normalizeReflection(submission.reflection);
  const incompleteIssues = submissionIssues({
    sourceType: submission.sourceType,
    custom,
    reflection,
    templateId: submission.templateId,
  });

  // Surface the live assignment state so admins know whether an approved
  // proposal still needs a placement. Wrapped in withPrismaFallback so a
  // transient pool blip never breaks the review page.
  const assignments = await withPrismaFallback(
    "workshop-review-detail:assignments",
    () =>
      prisma.instructorAssignment.findMany({
        where: {
          OR: [
            { proposalId: submission.id },
            { instructorId: submission.authorId },
          ],
          status: { in: ["SUGGESTED", "PENDING", "CONFIRMED", "COMPLETED"] },
        },
        orderBy: { assignedAt: "desc" },
        include: {
          opportunity: {
            select: {
              id: true,
              title: true,
              partnerName: true,
              startDate: true,
              endDate: true,
              locationCity: true,
              locationState: true,
              status: true,
            },
          },
        },
      }),
    () => [] as Awaited<
      ReturnType<typeof prisma.instructorAssignment.findMany<{
        include: { opportunity: { select: { id: true; title: true; partnerName: true; startDate: true; endDate: true; locationCity: true; locationState: true; status: true } } };
      }>>
    >
  );
  // After the re-application schema change, `instructorApplications` is a
  // newest-first list (we `take: 1`); pull the active row out for legacy
  // callers below.
  const activeInstructorApplication =
    submission.author.instructorApplications[0] ?? null;
  const legacyOutline = normalizeLegacyWorkshopOutline(
    activeInstructorApplication?.workshopOutline ?? null
  );

  // Compute training progress for the applicant — reviewers want context.
  const trainingAssignments = await withPrismaFallback(
    "workshop-review-detail:training-assignments",
    () =>
      prisma.trainingAssignment.findMany({
        where: { userId: submission.authorId },
        select: { status: true, module: { select: { required: true, title: true } } },
      }),
    [] as { status: string; module: { required: boolean; title: string } }[]
  );
  const requiredCount = trainingAssignments.filter((a) => a.module.required).length;
  const completedRequired = trainingAssignments.filter(
    (a) => a.module.required && a.status === "COMPLETE"
  ).length;

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Link
          href="/admin/workshop-reviews"
          className="link"
          style={{ fontSize: 13 }}
        >
          ← Back to Workshop Reviews
        </Link>
      </div>

      <div className="topbar">
        <div>
          <p className="badge">Workshop submission · Reviewer view</p>
          <h1 className="page-title">{submission.author.name}</h1>
          <p className="page-subtitle">
            {submission.author.email}
            {submission.author.chapter
              ? ` · ${submission.author.chapter.name}`
              : ""}
            {" · "}
            {sourceTypeLabel(submission.sourceType)}
          </p>
        </div>
        <div>
          <span
            className={`pill${
              submissionStatusTone(submission.status) === "success"
                ? " pill-success"
                : ""
            }`}
          >
            {submissionStatusLabel(submission.status)}
          </span>
        </div>
      </div>

      <div className="grid three" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="kpi">
            {completedRequired}/{requiredCount}
          </div>
          <div className="kpi-label">Required training complete</div>
        </div>
        <div className="card">
          <div className="kpi">
            {activeInstructorApplication?.instructorSubtype === "SUMMER_WORKSHOP"
              ? "Summer Workshop"
              : "Standard"}
          </div>
          <div className="kpi-label">Applicant subtype</div>
        </div>
        <div className="card">
          <div className="kpi">
            {submission.submittedAt
              ? new Date(submission.submittedAt).toLocaleDateString()
              : "—"}
          </div>
          <div className="kpi-label">Submitted</div>
        </div>
      </div>

      {activeInstructorApplication?.instructorSubtype !== "SUMMER_WORKSHOP" ? (
        <div
          className="card"
          role="alert"
          style={{
            marginBottom: 16,
            borderColor: "#dc2626",
            background: "#fef2f2",
          }}
        >
          <p style={{ margin: 0, fontSize: 13, color: "#7f1d1d" }}>
            <strong>Heads up.</strong> This applicant&rsquo;s subtype is{" "}
            <strong>{activeInstructorApplication?.instructorSubtype ?? "unknown"}</strong>,
            not SUMMER_WORKSHOP. They shouldn&rsquo;t have a workshop submission
            — flag this to admin if it looks wrong.
          </p>
        </div>
      ) : null}

      {isSubmissionReviewable(submission.status) ? (
        <StartReviewBanner
          submissionId={submission.id}
          status={submission.status}
        />
      ) : null}

      {incompleteIssues.length > 0 &&
      isSubmissionReviewable(submission.status) ? (
        <div
          className="card"
          role="alert"
          style={{
            marginBottom: 16,
            borderColor: "#f59e0b",
            background: "#fffbeb",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 600,
              color: "#92400e",
            }}
          >
            Proposal is missing {incompleteIssues.length} item
            {incompleteIssues.length === 1 ? "" : "s"} the applicant should
            still fix.
          </p>
          <ul
            style={{
              margin: "8px 0 0 18px",
              fontSize: 12,
              color: "#92400e",
              lineHeight: 1.55,
            }}
          >
            {incompleteIssues.slice(0, 6).map((i) => (
              <li key={i}>{i}</li>
            ))}
            {incompleteIssues.length > 6 ? (
              <li>…and {incompleteIssues.length - 6} more</li>
            ) : null}
          </ul>
          <p
            style={{
              margin: "8px 0 0",
              fontSize: 12,
              color: "#92400e",
            }}
          >
            Prefer <strong>Request changes</strong> over Approve so the
            applicant fills these in before we commit.
          </p>
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) 360px",
          gap: 24,
        }}
      >
        <article className="card" style={{ display: "grid", gap: 16 }}>
          {submission.sourceType === "CUSTOM_DESIGN" && custom ? (
            <>
              <Section title="Workshop title">
                <p style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
                  {custom.title || <em style={{ color: "var(--muted)" }}>No title</em>}
                </p>
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: 13,
                    color: "var(--muted)",
                  }}
                >
                  {custom.targetAgeGroup} · {custom.lengthMinutes} min ·{" "}
                  {custom.category}
                </p>
              </Section>

              <Section title="Logistics">
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 12,
                    marginBottom: custom.locationNotes || custom.safetyNotes ? 12 : 0,
                  }}
                >
                  <LogisticsCell
                    label="Format"
                    value={workshopFormatLabel(custom.format)}
                    missing={!custom.format}
                  />
                  <LogisticsCell
                    label="Capacity"
                    value={custom.capacity ? `${custom.capacity} students` : ""}
                    missing={!custom.capacity}
                  />
                  <LogisticsCell
                    label="Availability"
                    value={custom.availability}
                    missing={!custom.availability}
                  />
                </div>
                {custom.locationNotes ? (
                  <div style={{ marginBottom: 8 }}>
                    <p
                      style={{
                        margin: "0 0 2px",
                        fontSize: 12,
                        fontWeight: 600,
                        color: "var(--muted)",
                      }}
                    >
                      Location
                    </p>
                    <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>
                      {custom.locationNotes}
                    </p>
                  </div>
                ) : custom.format && custom.format !== "VIRTUAL" ? (
                  <p style={{ margin: 0, fontSize: 13, color: "#b45309" }}>
                    Location not provided.
                  </p>
                ) : null}
                {custom.safetyNotes ? (
                  <div style={{ marginTop: 8 }}>
                    <p
                      style={{
                        margin: "0 0 2px",
                        fontSize: 12,
                        fontWeight: 600,
                        color: "var(--muted)",
                      }}
                    >
                      Safety &amp; supervision
                    </p>
                    <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>
                      {custom.safetyNotes}
                    </p>
                  </div>
                ) : custom.format && custom.format !== "VIRTUAL" ? (
                  <p style={{ margin: 0, fontSize: 13, color: "#b45309" }}>
                    Safety notes not provided.
                  </p>
                ) : null}
              </Section>
              <Section title="Learning objective">
                <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>
                  {custom.learningObjective}
                </p>
              </Section>
              <Section title="Opening hook">
                <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>
                  {custom.openingHook}
                </p>
              </Section>
              <Section title="Main activity">
                <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>
                  {custom.mainActivity}
                </p>
              </Section>
              <Section title="Student participation plan">
                <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>
                  {custom.participationPlan}
                </p>
              </Section>
              <Section title="Wrap-up">
                <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>
                  {custom.wrapUp}
                </p>
              </Section>
              <Section title="Backup plan">
                <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>
                  {custom.backupPlan}
                </p>
              </Section>
              {custom.materials.length > 0 ? (
                <Section title="Materials">
                  <ul style={{ paddingLeft: 18, margin: 0, lineHeight: 1.6 }}>
                    {custom.materials.map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                </Section>
              ) : null}
            </>
          ) : null}

          {submission.sourceType === "TEMPLATE_SELECTION" ? (
            <>
              <Section title="Selected workshop">
                {submission.template ? (
                  <>
                    <p style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
                      {submission.template.title}
                    </p>
                    <p
                      style={{
                        margin: "4px 0 0",
                        fontSize: 13,
                        color: "var(--muted)",
                      }}
                    >
                      {submission.template.category} ·{" "}
                      {submission.template.targetAgeRange} ·{" "}
                      {submission.template.estimatedMinutes} min ·{" "}
                      {difficultyLabel(submission.template.difficulty)}
                    </p>
                    <Link
                      href={`/admin/workshop-library/${submission.template.id}`}
                      className="link"
                      style={{ fontSize: 13, marginTop: 8, display: "inline-block" }}
                    >
                      Open template in library →
                    </Link>
                  </>
                ) : (
                  <p style={{ color: "#b45309" }}>
                    The applicant&rsquo;s selected template was deleted or
                    archived after they picked it.
                  </p>
                )}
              </Section>
            </>
          ) : null}

          <Section title="Reflection">
            <ReflectionRow
              q="Why did you choose this workshop?"
              a={reflection.whyChosen}
            />
            <ReflectionRow
              q="How would you adapt it for your specific audience?"
              a={reflection.audienceAdaptation}
            />
            <ReflectionRow
              q="What part might be hardest to teach?"
              a={reflection.hardestPart}
            />
            <ReflectionRow
              q="How would you keep students engaged?"
              a={reflection.engagementPlan}
            />
          </Section>

          {legacyOutline ? (
            <Section title="Original signup outline (legacy)">
              <p
                style={{
                  margin: "0 0 12px",
                  fontSize: 12,
                  color: "var(--muted)",
                  lineHeight: 1.5,
                }}
              >
                Captured during the applicant&rsquo;s signup, before the
                Workshop Design Studio existed. Read-only — the submission
                above is the source of truth for review.
              </p>
              <div
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: 12,
                  background: "var(--surface-alt, #fafafa)",
                  display: "grid",
                  gap: 10,
                  fontSize: 13,
                }}
              >
                {legacyOutline.title ? (
                  <p style={{ margin: 0 }}>
                    <strong>Title:</strong> {legacyOutline.title}
                  </p>
                ) : null}
                {legacyOutline.ageRange || legacyOutline.durationMinutes ? (
                  <p style={{ margin: 0, color: "var(--muted)" }}>
                    {legacyOutline.ageRange ? legacyOutline.ageRange : ""}
                    {legacyOutline.ageRange && legacyOutline.durationMinutes
                      ? " · "
                      : ""}
                    {legacyOutline.durationMinutes
                      ? `${legacyOutline.durationMinutes} min`
                      : ""}
                  </p>
                ) : null}
                {legacyOutline.learningGoals.length > 0 ? (
                  <div>
                    <strong>Learning goals:</strong>
                    <ul style={{ paddingLeft: 18, margin: "4px 0 0" }}>
                      {legacyOutline.learningGoals.map((g, i) => (
                        <li key={i}>{g}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {legacyOutline.activityFlow ? (
                  <div>
                    <strong>Activity flow:</strong>
                    <p style={{ whiteSpace: "pre-wrap", margin: "4px 0 0" }}>
                      {legacyOutline.activityFlow}
                    </p>
                  </div>
                ) : null}
                {legacyOutline.materialsNeeded.length > 0 ? (
                  <div>
                    <strong>Materials:</strong>
                    <ul style={{ paddingLeft: 18, margin: "4px 0 0" }}>
                      {legacyOutline.materialsNeeded.map((m, i) => (
                        <li key={i}>{m}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {legacyOutline.engagementHook ? (
                  <p style={{ margin: 0 }}>
                    <strong>Engagement hook:</strong>{" "}
                    {legacyOutline.engagementHook}
                  </p>
                ) : null}
                {legacyOutline.adaptationNotes ? (
                  <p style={{ margin: 0 }}>
                    <strong>Adaptation notes:</strong>{" "}
                    {legacyOutline.adaptationNotes}
                  </p>
                ) : null}
              </div>
            </Section>
          ) : null}

          {submission.reviews.length > 0 ? (
            <Section title="Review history">
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
                {submission.reviews.map((r) => (
                  <li
                    key={r.id}
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      padding: 12,
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: 13,
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <strong>{r.reviewer.name}</strong>
                      <span style={{ color: "var(--muted)" }}>
                        {r.committedAt
                          ? new Date(r.committedAt).toLocaleString()
                          : ""}
                      </span>
                    </p>
                    {r.overallRecommendation ? (
                      <p
                        style={{
                          margin: "4px 0",
                          fontSize: 13,
                          fontWeight: 600,
                        }}
                      >
                        {recommendationLabel(r.overallRecommendation)}
                      </p>
                    ) : null}
                    <Ratings r={r} />
                    {r.applicantFeedback ? (
                      <p style={{ margin: "8px 0 0", fontSize: 13 }}>
                        <strong>Sent to applicant:</strong>{" "}
                        {r.applicantFeedback}
                      </p>
                    ) : null}
                    {r.internalNote ? (
                      <p
                        style={{
                          margin: "6px 0 0",
                          fontSize: 13,
                          color: "var(--muted)",
                        }}
                      >
                        <strong>Internal note:</strong> {r.internalNote}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
        </article>

        <aside
          style={{
            position: "sticky",
            top: 16,
            alignSelf: "start",
            display: "grid",
            gap: 16,
          }}
        >
          <ReviewDecisionForm
            submissionId={submission.id}
            disabled={!isSubmissionReviewable(submission.status)}
            incompleteIssues={incompleteIssues}
          />
          <AssignmentSidebar
            submissionStatus={submission.status}
            assignments={assignments}
          />
        </aside>
      </div>
    </div>
  );
}

function AssignmentSidebar({
  submissionStatus,
  assignments,
}: {
  submissionStatus: import("@prisma/client").WorkshopProposalSubmissionStatus;
  assignments: Array<{
    id: string;
    status: string;
    role: string;
    opportunity: {
      id: string;
      title: string;
      partnerName: string | null;
      startDate: Date | null;
      endDate: Date | null;
      locationCity: string | null;
      locationState: string | null;
      status: string;
    };
  }>;
}) {
  if (submissionStatus !== "APPROVED") {
    // Pre-approval, assignment isn't actionable; keep the sidebar
    // focused on the decision form above.
    return null;
  }
  return (
    <div className="card">
      <h3 style={{ marginTop: 0, fontSize: 14 }}>Placement</h3>
      {assignments.length === 0 ? (
        <>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: "var(--muted)",
              lineHeight: 1.55,
            }}
          >
            Approved — not yet matched with a workshop or camp.
          </p>
          <Link
            href="/admin/instructor-assignments"
            className="button small"
            style={{
              display: "inline-block",
              marginTop: 10,
              textDecoration: "none",
            }}
          >
            Open assignment board →
          </Link>
        </>
      ) : (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "grid",
            gap: 10,
          }}
        >
          {assignments.map((a) => (
            <li
              key={a.id}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: 10,
              }}
            >
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>
                {a.opportunity.title}
              </p>
              <p
                style={{
                  margin: "2px 0 0",
                  fontSize: 11,
                  color: "var(--muted)",
                  lineHeight: 1.45,
                }}
              >
                {a.opportunity.partnerName ?? ""}
                {a.opportunity.partnerName &&
                (a.opportunity.locationCity || a.opportunity.startDate)
                  ? " · "
                  : ""}
                {[a.opportunity.locationCity, a.opportunity.locationState]
                  .filter(Boolean)
                  .join(", ")}
                {a.opportunity.startDate
                  ? ` · ${new Date(
                      a.opportunity.startDate
                    ).toLocaleDateString()}`
                  : ""}
              </p>
              <p
                style={{
                  margin: "6px 0 0",
                  fontSize: 11,
                  color: "var(--muted)",
                }}
              >
                {a.status} · {a.role}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LogisticsCell({
  label,
  value,
  missing,
}: {
  label: string;
  value: string;
  missing: boolean;
}) {
  return (
    <div>
      <p
        style={{
          margin: "0 0 2px",
          fontSize: 12,
          fontWeight: 600,
          color: "var(--muted)",
          textTransform: "uppercase",
          letterSpacing: 0.4,
        }}
      >
        {label}
      </p>
      <p
        style={{
          margin: 0,
          fontSize: 14,
          color: missing ? "#b45309" : "inherit",
        }}
      >
        {missing ? "Missing" : value}
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 style={{ marginTop: 0, fontSize: 14, color: "var(--muted)" }}>{title}</h3>
      {children}
    </section>
  );
}

function ReflectionRow({ q, a }: { q: string; a: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <p
        style={{
          margin: "0 0 4px",
          fontSize: 13,
          fontWeight: 600,
          color: "var(--muted)",
        }}
      >
        {q}
      </p>
      <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>
        {a || <em style={{ color: "var(--muted)" }}>No answer.</em>}
      </p>
    </div>
  );
}

function Ratings({
  r,
}: {
  r: {
    clarityRating: number | null;
    engagementRating: number | null;
    feasibilityRating: number | null;
    ageAppropriatenessRating: number | null;
    preparednessRating: number | null;
    alignmentRating: number | null;
  };
}) {
  const items: { label: string; value: number | null }[] = [
    { label: "Clarity", value: r.clarityRating },
    { label: "Engagement", value: r.engagementRating },
    { label: "Feasibility", value: r.feasibilityRating },
    { label: "Age appropriateness", value: r.ageAppropriatenessRating },
    { label: "Preparedness", value: r.preparednessRating },
    { label: "YPP values", value: r.alignmentRating },
  ];
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: 6,
        marginTop: 6,
        fontSize: 12,
      }}
    >
      {items.map((i) => (
        <div key={i.label}>
          <span style={{ color: "var(--muted)" }}>{i.label}: </span>
          <strong>{i.value ?? "—"}</strong>
        </div>
      ))}
    </div>
  );
}
