import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { withPrismaFallback } from "@/lib/prisma-guard";
import { getWorkshopStudioGateStatus } from "@/lib/workshop-proposal-access";
import {
  isSubmissionEditable,
  isSubmissionReviewable,
  submissionStatusLabel,
  submissionStatusTone,
  sourceTypeLabel,
} from "@/lib/workshop-proposal-constants";
import { getOrCreateApplicantSubmission } from "@/lib/workshop-proposal-actions";
import { ChooseWorkshopPathButtons } from "./choice-buttons";
import { ReviewerFeedbackCard } from "./reviewer-feedback";

export default async function WorkshopDesignStudioPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;
  const roles = session.user.roles ?? [];

  const gate = await getWorkshopStudioGateStatus(userId, roles);
  if (!gate.unlocked) {
    if (gate.reason === "WRONG_SUBTYPE") {
      // Standard instructors should never land here — bounce them to LDS.
      redirect("/instructor/lesson-design-studio");
    }
    // Training not done yet — back to the academy with a banner.
    redirect("/instructor-training?locked=workshop-design-studio");
  }

  // Reviewers previewing the studio see a read-only view (no submission row).
  const isReviewerPreview = gate.reason === "REVIEWER_BYPASS";
  const sp = (await searchParams) ?? {};
  const justSubmitted = sp.submitted === "1";

  const submission = isReviewerPreview
    ? null
    : await withPrismaFallback(
        "workshop-studio:submission",
        () => getOrCreateApplicantSubmission(),
        null
      );

  const editable = submission ? isSubmissionEditable(submission.status) : true;

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Link
          href="/instructor-training"
          className="link"
          style={{ fontSize: 13 }}
        >
          ← Back to Instructor Training Academy
        </Link>
      </div>

      <div className="topbar">
        <div>
          <p className="badge">Summer Workshop Instructor Application</p>
          <h1 className="page-title">Workshop Design Studio</h1>
          <p className="page-subtitle">
            Complete training, then submit or select a workshop. You can either
            design your own workshop or choose an approved workshop from
            YPP&rsquo;s library.
          </p>
        </div>
      </div>

      {isReviewerPreview ? (
        <div
          className="card"
          role="status"
          style={{
            marginBottom: 16,
            borderColor: "#a78bfa",
            background: "#f5f3ff",
          }}
        >
          <p style={{ margin: 0, fontSize: 13, color: "#5b21b6" }}>
            <strong>Reviewer preview.</strong> You&rsquo;re looking at the
            applicant view. Use the admin reviews page to score submissions.
          </p>
        </div>
      ) : null}

      {justSubmitted && submission && submission.status !== "DRAFT" ? (
        <div
          className="card"
          role="status"
          style={{
            marginBottom: 16,
            borderColor: "#16a34a",
            background: "#f0fdf4",
          }}
        >
          <p style={{ margin: 0, fontWeight: 600, color: "#14532d" }}>
            Workshop submitted — thanks!
          </p>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: 13,
              color: "#166534",
              lineHeight: 1.55,
            }}
          >
            A reviewer will read it next. You&rsquo;ll see their feedback here
            and on your application status page once they finish.
          </p>
        </div>
      ) : null}

      {submission && submission.status !== "DRAFT" ? (
        <div
          className="card"
          role="status"
          style={{
            marginBottom: 16,
            borderColor:
              submissionStatusTone(submission.status) === "success"
                ? "#16a34a"
                : submissionStatusTone(submission.status) === "danger"
                  ? "#dc2626"
                  : submissionStatusTone(submission.status) === "warn"
                    ? "#f59e0b"
                    : "#6366f1",
          }}
        >
          <p style={{ margin: 0, fontWeight: 600 }}>
            Status: {submissionStatusLabel(submission.status)}
          </p>
          {submission.applicantFeedback ? (
            <p
              style={{
                margin: "8px 0 0",
                fontSize: 14,
                color: "var(--muted)",
                lineHeight: 1.55,
              }}
            >
              <strong>Reviewer feedback:</strong>{" "}
              {submission.applicantFeedback}
            </p>
          ) : null}
          {isSubmissionReviewable(submission.status) ? (
            <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--muted)" }}>
              Your submission is with a reviewer. You&rsquo;ll see their
              feedback here once they finish.
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Path picker */}
      <section className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ marginTop: 0 }}>Choose your workshop path</h2>
        <p style={{ color: "var(--muted)", marginTop: 0, fontSize: 14 }}>
          Both paths land in the same review queue. Pick the one that lets you
          show your strongest planning work.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 16,
            marginTop: 16,
          }}
        >
          <article
            className="card"
            style={{
              borderWidth: 2,
              borderColor:
                submission?.sourceType === "CUSTOM_DESIGN"
                  ? "var(--ypp-purple)"
                  : "var(--border)",
            }}
          >
            <h3 style={{ marginTop: 0 }}>Design my own workshop</h3>
            <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.55 }}>
              Build a workshop outline from scratch — title, hook, activity,
              wrap-up, backup plan. Best when you have a clear idea you want to
              try.
            </p>
            <ul style={{ fontSize: 13, color: "var(--muted)", paddingLeft: 18 }}>
              <li>Full control over the topic and flow</li>
              <li>Reviewers grade your planning craft directly</li>
              <li>Takes 30–45 minutes</li>
            </ul>
            <ChooseWorkshopPathButtons
              currentSource={submission?.sourceType ?? null}
              path="CUSTOM_DESIGN"
              continueHref="/instructor/workshop-design-studio/design"
              disabled={!editable}
            />
          </article>

          <article
            className="card"
            style={{
              borderWidth: 2,
              borderColor:
                submission?.sourceType === "TEMPLATE_SELECTION"
                  ? "var(--ypp-purple)"
                  : "var(--border)",
            }}
          >
            <h3 style={{ marginTop: 0 }}>Choose from approved workshops</h3>
            <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.55 }}>
              Pick a workshop from YPP&rsquo;s library and answer four
              reflection questions about how you&rsquo;d teach it. Great when
              you want to show range without designing from scratch.
            </p>
            <ul style={{ fontSize: 13, color: "var(--muted)", paddingLeft: 18 }}>
              <li>Skip the design step — you start with a complete plan</li>
              <li>Reviewers grade your reflection and adaptation</li>
              <li>Takes 15–25 minutes</li>
            </ul>
            <ChooseWorkshopPathButtons
              currentSource={submission?.sourceType ?? null}
              path="TEMPLATE_SELECTION"
              continueHref="/instructor/workshop-design-studio/library"
              disabled={!editable}
            />
          </article>
        </div>
      </section>

      {submission ? (
        <section className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginTop: 0 }}>Your current submission</h3>
          <p style={{ color: "var(--muted)", marginTop: 0, fontSize: 14 }}>
            Source: <strong>{sourceTypeLabel(submission.sourceType)}</strong>
            {" · "}Last updated{" "}
            {new Date(submission.updatedAt).toLocaleString()}
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            {editable ? (
              <>
                <Link
                  href={
                    submission.sourceType === "CUSTOM_DESIGN"
                      ? "/instructor/workshop-design-studio/design"
                      : "/instructor/workshop-design-studio/library"
                  }
                  className="button small"
                  style={{ textDecoration: "none" }}
                >
                  Continue editing
                </Link>
                <Link
                  href="/instructor/workshop-design-studio/review"
                  className="button small secondary"
                  style={{ textDecoration: "none" }}
                >
                  Open review &amp; submit
                </Link>
              </>
            ) : (
              // Submission is locked (in review, approved, rejected). Send them
              // to the review page — that's the read-only summary; the design
              // and library pages would just show a "locked" banner.
              <Link
                href="/instructor/workshop-design-studio/review"
                className="button small"
                style={{ textDecoration: "none" }}
              >
                View your submission
              </Link>
            )}
          </div>
          {submission.reviewedAt ? (
            <ReviewerFeedbackCard
              applicantFeedback={submission.applicantFeedback}
              reviewedAt={submission.reviewedAt.toISOString()}
            />
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
