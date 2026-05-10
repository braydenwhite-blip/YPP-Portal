import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { withPrismaFallback } from "@/lib/prisma-guard";
import { getWorkshopStudioGateStatus } from "@/lib/workshop-proposal-access";
import {
  isSubmissionEditable,
  sourceTypeLabel,
  submissionStatusLabel,
  workshopFormatLabel,
} from "@/lib/workshop-proposal-constants";
import {
  customWorkshopIssues,
  normalizeCustomWorkshop,
  normalizeReflection,
  reflectionIssues,
  submissionIssues,
} from "@/lib/workshop-proposal-validation";
import { getOrCreateApplicantSubmission } from "@/lib/workshop-proposal-actions";
import { ReviewerFeedbackCard } from "../reviewer-feedback";
import { ReviewSubmitForm } from "./form";

export default async function WorkshopReviewSubmitPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;
  const roles = session.user.roles ?? [];

  const gate = await getWorkshopStudioGateStatus(userId, roles);
  if (!gate.unlocked) {
    if (gate.reason === "WRONG_SUBTYPE") {
      redirect("/instructor/lesson-design-studio");
    }
    redirect("/instructor-training?locked=workshop-design-studio");
  }
  if (gate.reason === "REVIEWER_BYPASS") {
    redirect("/admin/workshop-reviews");
  }

  const submission = await withPrismaFallback(
    "workshop-review:submission",
    () => getOrCreateApplicantSubmission(),
    null
  );
  if (!submission) {
    return (
      <div style={{ maxWidth: 600, margin: "60px auto", padding: 24 }}>
        <p>Could not load your workshop. Try again in a moment.</p>
      </div>
    );
  }

  const template = submission.templateId
    ? await withPrismaFallback(
        "workshop-review:template",
        () =>
          prisma.workshopProposalTemplate.findUnique({
            where: { id: submission.templateId as string },
            select: {
              id: true,
              title: true,
              category: true,
              targetAgeRange: true,
              estimatedMinutes: true,
            },
          }),
        null
      )
    : null;

  const editable = isSubmissionEditable(submission.status);
  const custom =
    submission.sourceType === "CUSTOM_DESIGN"
      ? normalizeCustomWorkshop(submission.customWorkshop)
      : null;
  const reflection = normalizeReflection(submission.reflection);

  const allIssues = submissionIssues({
    sourceType: submission.sourceType,
    custom,
    reflection,
    templateId: submission.templateId,
  });
  const customSpecificIssues = custom ? customWorkshopIssues(custom) : [];
  const reflectionSpecificIssues = reflectionIssues(reflection);

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Link
          href="/instructor/workshop-design-studio"
          className="link"
          style={{ fontSize: 13 }}
        >
          ← Back to Workshop Design Studio
        </Link>
      </div>

      <div className="topbar">
        <div>
          <p className="badge">Workshop Design Studio · Review &amp; submit</p>
          <h1 className="page-title">Review &amp; submit your workshop</h1>
          <p className="page-subtitle">
            Last polish pass. Skim what you&rsquo;ve built, finish the
            reflection, then submit for review.
          </p>
        </div>
      </div>

      {!editable ? (
        <div
          className="card"
          role="status"
          style={{
            marginBottom: 16,
            borderColor: "#f59e0b",
            background: "#fffbeb",
          }}
        >
          <p style={{ margin: 0, fontSize: 13, color: "#92400e" }}>
            <strong>{submissionStatusLabel(submission.status)}.</strong>{" "}
            Your submission is locked while a reviewer takes a look.
          </p>
        </div>
      ) : null}

      <ReviewerFeedbackCard
        applicantFeedback={submission.applicantFeedback}
        reviewedAt={submission.reviewedAt?.toISOString() ?? null}
      />

      <section className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginTop: 0 }}>Path</h3>
        <p style={{ marginTop: 0, color: "var(--muted)" }}>
          {sourceTypeLabel(submission.sourceType)}
        </p>

        {submission.sourceType === "CUSTOM_DESIGN" && custom ? (
          <div style={{ marginTop: 12 }}>
            <p style={{ margin: "0 0 4px", fontWeight: 600 }}>
              {custom.title || <em style={{ color: "var(--muted)" }}>Untitled workshop</em>}
            </p>
            <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
              {custom.targetAgeGroup || "Age group missing"} · {custom.lengthMinutes || "?"} min
              · {custom.category || "Category missing"}
            </p>
            <p
              style={{
                margin: "4px 0 0",
                fontSize: 13,
                color: "var(--muted)",
              }}
            >
              {workshopFormatLabel(custom.format)}
              {custom.capacity ? ` · capacity ${custom.capacity}` : ""}
              {custom.availability ? ` · ${custom.availability}` : ""}
            </p>
            {custom.locationNotes ? (
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: 13,
                  color: "var(--muted)",
                }}
              >
                Location: {custom.locationNotes}
              </p>
            ) : null}
            <Link
              href="/instructor/workshop-design-studio/design"
              className="link"
              style={{ fontSize: 13, marginTop: 8, display: "inline-block" }}
            >
              {editable ? "Edit your design →" : "Review your design →"}
            </Link>
          </div>
        ) : null}

        {submission.sourceType === "TEMPLATE_SELECTION" && template ? (
          <div style={{ marginTop: 12 }}>
            <p style={{ margin: "0 0 4px", fontWeight: 600 }}>{template.title}</p>
            <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
              {template.category} · {template.targetAgeRange} · {template.estimatedMinutes} min
            </p>
            <Link
              href={`/instructor/workshop-design-studio/library/${template.id}`}
              className="link"
              style={{ fontSize: 13, marginTop: 8, display: "inline-block" }}
            >
              Re-read the workshop →
            </Link>
          </div>
        ) : null}

        {submission.sourceType === "TEMPLATE_SELECTION" && !template ? (
          <p style={{ marginTop: 12, fontSize: 13, color: "#b45309" }}>
            The workshop you selected is no longer available. Pick another one
            from the library.
          </p>
        ) : null}
      </section>

      <ReviewSubmitForm
        sourceType={submission.sourceType}
        initialReflection={reflection}
        editable={editable}
        canSubmit={allIssues.length === 0 && editable}
        customIssues={customSpecificIssues}
        reflectionIssues={reflectionSpecificIssues}
        allIssues={allIssues}
      />
    </div>
  );
}
