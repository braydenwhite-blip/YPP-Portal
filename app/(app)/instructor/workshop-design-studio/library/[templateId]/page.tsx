import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { withPrismaFallback } from "@/lib/prisma-guard";
import { getWorkshopStudioGateStatus } from "@/lib/workshop-proposal-access";
import {
  difficultyLabel,
  isSubmissionEditable,
} from "@/lib/workshop-proposal-constants";
import { getOrCreateApplicantSubmission } from "@/lib/workshop-proposal-actions";
import { TemplatePreviewSelect } from "./preview";

export default async function WorkshopTemplatePreviewPage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;
  const roles = session.user.roles ?? [];

  const gate = await getWorkshopStudioGateStatus(userId, roles);
  if (!gate.unlocked) {
    if (gate.reason === "WRONG_SUBTYPE") {
      redirect("/instructor/lesson-design-studio");
    }
    if (gate.reason === "FEATURE_DISABLED") {
      redirect("/instructor-training?locked=workshop-design-studio-closed");
    }
    redirect("/instructor-training?locked=workshop-design-studio");
  }

  const [template, submission] = await Promise.all([
    withPrismaFallback(
      "workshop-template-preview:template",
      () =>
        prisma.workshopProposalTemplate.findUnique({
          where: { id: templateId },
        }),
      null
    ),
    gate.reason === "REVIEWER_BYPASS"
      ? Promise.resolve(null)
      : withPrismaFallback(
          "workshop-template-preview:submission",
          () => getOrCreateApplicantSubmission(),
          null
        ),
  ]);

  if (!template) notFound();
  if (template.status !== "APPROVED" && gate.reason !== "REVIEWER_BYPASS") {
    // Hide unapproved templates from applicants entirely.
    notFound();
  }

  const editable = submission ? isSubmissionEditable(submission.status) : true;
  const isCurrentlySelected =
    submission?.sourceType === "TEMPLATE_SELECTION" &&
    submission.templateId === template.id;

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Link
          href="/instructor/workshop-design-studio/library"
          className="link"
          style={{ fontSize: 13 }}
        >
          ← Back to workshop library
        </Link>
      </div>

      <div className="topbar">
        <div>
          <p className="badge">Workshop preview</p>
          <h1 className="page-title">{template.title}</h1>
          <p className="page-subtitle">
            {template.category} · {template.targetAgeRange} ·{" "}
            {template.estimatedMinutes} min ·{" "}
            {difficultyLabel(template.difficulty)}
          </p>
        </div>
      </div>

      {gate.reason === "REVIEWER_BYPASS" && template.status !== "APPROVED" ? (
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
            <strong>Not visible to applicants.</strong> This template&rsquo;s
            status is {template.status.toLowerCase()}. Set it to{" "}
            <strong>Approved</strong> in the admin library to publish.
          </p>
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) 280px",
          gap: 24,
        }}
      >
        <article className="card">
          <section style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>Description</h3>
            <p style={{ lineHeight: 1.6 }}>{template.description}</p>
          </section>

          {template.learningObjectives.length > 0 ? (
            <section style={{ marginBottom: 16 }}>
              <h3>Learning objectives</h3>
              <ul style={{ paddingLeft: 18, lineHeight: 1.6 }}>
                {template.learningObjectives.map((obj, i) => (
                  <li key={i}>{obj}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <section style={{ marginBottom: 16 }}>
            <h3>Activity plan</h3>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                fontFamily: "inherit",
                margin: 0,
                lineHeight: 1.6,
              }}
            >
              {template.activityPlan}
            </pre>
          </section>

          {template.materials.length > 0 ? (
            <section style={{ marginBottom: 16 }}>
              <h3>Materials needed</h3>
              <ul style={{ paddingLeft: 18, lineHeight: 1.6 }}>
                {template.materials.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {template.tags.length > 0 ? (
            <section>
              <h3>Tags</h3>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {template.tags.map((tag) => (
                  <span key={tag} className="pill pill-small">
                    {tag}
                  </span>
                ))}
              </div>
            </section>
          ) : null}
        </article>

        <aside style={{ position: "sticky", top: 16, alignSelf: "start" }}>
          <TemplatePreviewSelect
            templateId={template.id}
            isCurrentlySelected={isCurrentlySelected}
            editable={editable}
            isReviewerPreview={gate.reason === "REVIEWER_BYPASS"}
          />
        </aside>
      </div>
    </div>
  );
}
