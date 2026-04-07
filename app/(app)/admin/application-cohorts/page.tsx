import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import ApplicationCohortManager from "@/components/application-cohort-manager";

export default async function ApplicationCohortsPage() {
  const session = await getSession();

  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    redirect("/");
  }

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
    <div style={{ maxWidth: "960px", margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ marginBottom: "32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
          <span
            style={{
              display: "inline-block",
              padding: "2px 10px",
              borderRadius: "9999px",
              fontSize: "12px",
              fontWeight: 600,
              backgroundColor: "#fee2e2",
              color: "#991b1b",
            }}
          >
            Admin
          </span>
        </div>
        <h1 style={{ margin: "0 0 4px 0", fontSize: "28px", fontWeight: 700 }}>
          Application Cohorts
        </h1>
        <p style={{ margin: 0, fontSize: "14px", color: "#6b7280" }}>
          Manage application cohorts and batch process application statuses.
        </p>
      </div>

      <ApplicationCohortManager cohorts={serializedCohorts} />
    </div>
  );
}
