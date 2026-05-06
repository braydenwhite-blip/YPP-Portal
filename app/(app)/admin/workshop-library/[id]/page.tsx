import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { withPrismaFallback } from "@/lib/prisma-guard";
import {
  difficultyLabel,
  submissionStatusLabel,
  templateStatusLabel,
} from "@/lib/workshop-proposal-constants";
import { TemplateForm } from "../template-form";
import { TemplateStatusActions } from "./status-actions";

export default async function EditWorkshopTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) redirect("/");

  const template = await withPrismaFallback(
    "admin-workshop-library-detail:template",
    () =>
      prisma.workshopProposalTemplate.findUnique({
        where: { id },
        include: {
          submissions: {
            orderBy: { updatedAt: "desc" },
            take: 12,
            include: {
              author: { select: { id: true, name: true, email: true } },
            },
          },
          _count: { select: { submissions: true } },
        },
      }),
    null
  );
  if (!template) notFound();
  const submissionCount = template._count?.submissions ?? 0;

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Link
          href="/admin/workshop-library"
          className="link"
          style={{ fontSize: 13 }}
        >
          ← Back to Workshop Library
        </Link>
      </div>

      <div className="topbar">
        <div>
          <p className="badge">Admin · Workshop template</p>
          <h1 className="page-title">{template.title}</h1>
          <p className="page-subtitle">
            {templateStatusLabel(template.status)} ·{" "}
            {template.category} · {template.targetAgeRange} ·{" "}
            {template.estimatedMinutes} min ·{" "}
            {difficultyLabel(template.difficulty)}
          </p>
        </div>
        <TemplateStatusActions
          templateId={template.id}
          status={template.status}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) 320px",
          gap: 24,
        }}
      >
        <TemplateForm
          mode="edit"
          initial={{
            id: template.id,
            title: template.title,
            category: template.category,
            targetAgeRange: template.targetAgeRange,
            estimatedMinutes: template.estimatedMinutes,
            description: template.description,
            learningObjectives: template.learningObjectives,
            activityPlan: template.activityPlan,
            materials: template.materials,
            difficulty: template.difficulty,
            tags: template.tags,
            status: template.status,
          }}
        />

        <aside className="card" style={{ alignSelf: "start" }}>
          <h3 style={{ marginTop: 0 }}>Applicant selections</h3>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 0 }}>
            {submissionCount === 0
              ? "No applicants have picked this workshop yet."
              : `${submissionCount} applicant${submissionCount === 1 ? "" : "s"} chose this template.`}
          </p>
          {template.submissions.length > 0 ? (
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "grid",
                gap: 8,
              }}
            >
              {template.submissions.map((s) => (
                <li
                  key={s.id}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: 8,
                    fontSize: 13,
                  }}
                >
                  <Link
                    href={`/admin/workshop-reviews/${s.id}`}
                    style={{ color: "inherit", textDecoration: "none" }}
                  >
                    <strong>{s.author.name}</strong>
                    <br />
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>
                      {submissionStatusLabel(s.status)} ·{" "}
                      {new Date(s.updatedAt).toLocaleDateString()}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
