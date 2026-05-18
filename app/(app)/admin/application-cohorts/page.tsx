import { prisma } from "@/lib/prisma";
import ApplicationCohortManager from "@/components/application-cohort-manager";
import { requireAdminPage } from "@/lib/page-guards";

export default async function ApplicationCohortsPage() {
  await requireAdminPage();

  const cohorts = await prisma.applicationCohort.findMany({
    include: {
      _count: {
        select: {
          instructorApplications: true,
          chapterPresidentApplications: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const serializedCohorts = cohorts.map((cohort) => ({
    ...cohort,
    createdAt: cohort.createdAt.toISOString(),
  }));

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <span className="badge">Admin</span>
          <h1 className="page-title">Application Cohorts</h1>
          <p className="page-subtitle">
            Manage application cohorts and batch process application statuses.
          </p>
        </div>
      </div>

      <ApplicationCohortManager cohorts={serializedCohorts} />
    </div>
  );
}
