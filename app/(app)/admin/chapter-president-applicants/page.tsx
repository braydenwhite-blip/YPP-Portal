import Link from "next/link";

import { ApplicationReviewShell } from "@/components/applications/application-review-shell";
import { CPApplicantsClient } from "./client";
import { PageHeaderV2 } from "@/components/ui-v2";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/page-guards";
import { formatApplicantDisplayName } from "@/lib/applicant-display-name";
import {
  CP_PIPELINE_LANES,
  cpMissingRequirements,
  cpNextAction,
  cpPipelineLaneId,
  cpStatusLabel,
  cpStrongestSignal,
} from "@/lib/chapter-president-lifecycle";

function formatDate(value: Date) {
  return value.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}


async function loadApplications() {
  return prisma.chapterPresidentApplication.findMany({
    where: { archivedAt: null },
    include: {
      applicant: {
        select: {
          id: true,
          name: true,
          email: true,
          chapter: { select: { name: true } },
        },
      },
      chapter: { select: { id: true, name: true, city: true, region: true } },
      reviewer: { select: { name: true } },
      linkedPerson: { select: { id: true, name: true } },
      mentorAdvisor: { select: { id: true, name: true } },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });
}

export default async function AdminCPApplicantsPage() {
  await requireAdminPage();

  const applications = await loadApplications();
  const serialized = applications.map((app) => ({
    id: app.id,
    status: app.status,
    createdAt: app.createdAt.toISOString(),
    updatedAt: app.updatedAt.toISOString(),
    email: app.applicant.email,
    name: formatApplicantDisplayName(app),
    schoolName: app.schoolName,
    location: [app.city, app.stateProvince].filter(Boolean).join(", "),
  }));

  const grouped = CP_PIPELINE_LANES.map((lane) => ({
    ...lane,
    applications: applications.filter((app) => cpPipelineLaneId(app.status) === lane.id),
  }));

  const readyForReview = applications.filter((app) =>
    ["SUBMITTED", "INITIAL_REVIEW", "UNDER_REVIEW"].includes(app.status)
  ).length;

  return (
    <ApplicationReviewShell
      maxWidth={1200}
      header={
        <PageHeaderV2
          eyebrow="Applicants"
          title="Chapter president pipeline"
          subtitle={`${applications.length} applicants · ${readyForReview} ready for review`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="#final_decision"
                className="text-[13px] font-semibold text-brand-700 hover:underline"
              >
                Decision queue
              </Link>
              <Link
                href="#accepted_onboarding"
                className="text-[13px] font-semibold text-brand-700 hover:underline"
              >
                Onboarding queue
              </Link>
              <CPApplicantsClient applications={serialized} />
            </div>
          }
        />
      }
      actions={[
        { label: "Home", href: "/", icon: "compass" },
        { label: "Instructor board", href: "/admin/instructor-applicants", icon: "list" },
      ]}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 16,
          alignItems: "start",
        }}
      >
        {grouped.map((lane) => (
          <section
            key={lane.id}
            id={lane.id}
            className="card"
            style={{ padding: 14, minHeight: 220 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 12 }}>
              <h2 className="section-title" style={{ margin: 0, fontSize: 15 }}>
                {lane.title}
              </h2>
              <span className="pill">{lane.applications.length}</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {lane.applications.length === 0 && (
                <div
                  style={{
                    border: "1px dashed var(--border)",
                    borderRadius: 8,
                    padding: 14,
                    color: "var(--muted)",
                    fontSize: 13,
                    textAlign: "center",
                  }}
                >
                  No CP applicants here
                </div>
              )}

              {lane.applications.map((app) => {
                const displayName = formatApplicantDisplayName(app);
                const location = [
                  app.schoolName,
                  app.chapter?.name ?? app.partnerSchool ?? app.potentialChapterLocation,
                  [app.city, app.stateProvince].filter(Boolean).join(", "),
                ]
                  .filter(Boolean)
                  .join(" - ");
                const missing = cpMissingRequirements(app);

                return (
                  <Link
                    key={app.id}
                    href={`/admin/chapter-president-applicants/${app.id}`}
                    className="card"
                    style={{
                      display: "block",
                      textDecoration: "none",
                      color: "inherit",
                      borderRadius: 8,
                      padding: 14,
                      boxShadow: "none",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <strong style={{ fontSize: 14 }}>{displayName}</strong>
                      <span className="badge" style={{ whiteSpace: "nowrap" }}>
                        {cpStatusLabel(app.status)}
                      </span>
                    </div>
                    <p style={{ margin: "4px 0 8px", color: "var(--muted)", fontSize: 12 }}>
                      {location || app.applicant.email}
                    </p>
                    <p style={{ margin: "0 0 10px", fontSize: 13, lineHeight: 1.45 }}>
                      {cpStrongestSignal(app)}
                    </p>
                    <div style={{ display: "grid", gap: 5, fontSize: 12, color: "var(--muted)" }}>
                      <span>
                        <strong style={{ color: "var(--text)" }}>Next:</strong>{" "}
                        {cpNextAction(app)}
                      </span>
                      <span>
                        <strong style={{ color: "var(--text)" }}>Owner:</strong>{" "}
                        {app.reviewer?.name ?? "Needs reviewer"}
                      </span>
                      <span>
                        <strong style={{ color: "var(--text)" }}>Last activity:</strong>{" "}
                        {formatDate(app.updatedAt)}
                      </span>
                      {missing.length > 0 && (
                        <span style={{ color: "#b45309" }}>
                          {missing.slice(0, 2).join(" - ")}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </ApplicationReviewShell>
  );
}
