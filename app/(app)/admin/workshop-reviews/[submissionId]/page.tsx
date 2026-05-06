import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import {
  difficultyLabel,
  isSubmissionReviewable,
  recommendationLabel,
  sourceTypeLabel,
  submissionStatusLabel,
  submissionStatusTone,
} from "@/lib/workshop-proposal-constants";
import {
  normalizeCustomWorkshop,
  normalizeReflection,
} from "@/lib/workshop-proposal-validation";
import { ReviewDecisionForm } from "./review-form";
import { StartReviewBanner } from "./start-review";

export default async function WorkshopReviewDetailPage({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  const { submissionId } = await params;
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN") && !roles.includes("CHAPTER_PRESIDENT")) {
    redirect("/");
  }

  const submission = await prisma.workshopProposalSubmission.findUnique({
    where: { id: submissionId },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          email: true,
          chapter: { select: { name: true } },
          instructorApplication: {
            select: {
              applicationTrack: true,
              instructorSubtype: true,
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
  });

  if (!submission) notFound();

  const custom =
    submission.sourceType === "CUSTOM_DESIGN"
      ? normalizeCustomWorkshop(submission.customWorkshop)
      : null;
  const reflection = normalizeReflection(submission.reflection);

  // Compute training progress for the applicant — reviewers want context.
  const trainingAssignments = await prisma.trainingAssignment.findMany({
    where: { userId: submission.authorId },
    select: { status: true, module: { select: { required: true, title: true } } },
  });
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
            {submission.author.instructorApplication?.instructorSubtype === "SUMMER_WORKSHOP"
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

      {submission.author.instructorApplication?.instructorSubtype !== "SUMMER_WORKSHOP" ? (
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
            <strong>{submission.author.instructorApplication?.instructorSubtype ?? "unknown"}</strong>,
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

        <aside style={{ position: "sticky", top: 16, alignSelf: "start" }}>
          <ReviewDecisionForm
            submissionId={submission.id}
            disabled={!isSubmissionReviewable(submission.status)}
          />
        </aside>
      </div>
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
